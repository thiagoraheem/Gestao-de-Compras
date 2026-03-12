
// @ts-nocheck
import express from 'express';
import request from 'supertest';
import { configService } from "../services/configService";

// Mocks
const mockStorage = {
  getReceiptById: jest.fn(),
  getUserById: jest.fn().mockResolvedValue({ id: 1, name: 'Test User' }),
  initializeDefaultData: jest.fn().mockResolvedValue(true),
  getReceiptsByPurchaseOrderId: jest.fn().mockResolvedValue([]),
};

const mockPurchaseReceiveService = {
  submit: jest.fn(),
};

const selectQueue: any[] = [];
const returningQueue: any[] = [];

function createSelectChain() {
  const chain: any = {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    then: (resolve: any) => resolve(selectQueue.shift() ?? []),
  };
  return chain;
}

const actionChain: any = {
  set: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  returning: jest.fn().mockImplementation(() => Promise.resolve(returningQueue.shift() ?? [{ id: 1 }])) ,
  then: (resolve: any) => resolve(undefined),
};

const mockDb: any = {
  select: jest.fn(() => createSelectChain()),
  update: jest.fn(() => actionChain),
  delete: jest.fn(() => actionChain),
  insert: jest.fn(() => actionChain),
  execute: jest.fn().mockResolvedValue(true),
};

// Apply mocks
jest.mock('../storage', () => ({ storage: mockStorage }));
jest.mock('../integracao_locador/services/purchase-receive-service', () => ({ 
  purchaseReceiveService: mockPurchaseReceiveService 
}));
jest.mock('../db', () => ({ 
  db: mockDb,
  pool: {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    connect: jest.fn(),
    on: jest.fn(),
    end: jest.fn().mockResolvedValue(true),
  },
  receipts: { id: 'id', observations: 'observations', status: 'status' },
  receiptItems: { receiptId: 'receipt_id' },
  receiptInstallments: { receiptId: 'receipt_id' },
  receiptAllocations: { receiptId: 'receipt_id' },
  purchaseOrders: { id: 'id' },
  purchaseRequests: { id: 'id' },
  companies: { id: 'id' },
  eq: jest.fn()
}));
jest.mock('../email-service', () => ({
  notifyNewRequest: jest.fn(),
  sendRFQToSuppliers: jest.fn(),
  notifyApprovalA1: jest.fn(),
  notifyApprovalA2: jest.fn(),
  notifyRejection: jest.fn(),
  testEmailConfiguration: jest.fn(),
  notifyRequestConclusion: jest.fn(),
}));
jest.mock('../pdf-service', () => ({
  PDFService: {
    generatePurchaseOrder: jest.fn(),
  }
}));
jest.mock('../services/supplier-integration', () => ({
  supplierIntegrationService: {
    searchByCNPJ: jest.fn(),
  }
}));
jest.mock("../services/configService", () => ({
  configService: {
    getLocadorConfig: jest.fn(),
  },
}));

process.env.SESSION_SECRET = 'test-secret-must-be-at-least-32-chars-long';
// Import routes after mocks
import { registerRoutes } from '../routes';

describe('Fiscal Confirmation & Reopen Logic', () => {
  let app;
  let server;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    // Mock auth middleware
    app.use((req, res, next) => {
      req.session = { userId: 1 };
      req.isAuthenticated = () => true;
      next();
    });
    server = await registerRoutes(app);
    jest.clearAllMocks();
    selectQueue.splice(0, selectQueue.length);
    returningQueue.splice(0, returningQueue.length);
  });

  it('should prevent ERP submission if receipt has no items', async () => {
    (configService.getLocadorConfig as jest.Mock).mockResolvedValue({ sendEnabled: true });
    selectQueue.push(
      [{ id: 123, status: 'conf_fisica', observations: '{}', receiptType: 'produto', purchaseOrderId: null }],
      [],
    );

    const res = await request(app)
      .post('/api/receipts/123/confirm-fiscal')
      .send({ 
        paymentMethodCode: '001', 
        allocations: [{ costCenterId: 1, chartOfAccountsId: 1 }],
        invoiceDueDate: '2023-01-01'
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/não possui itens/);
    expect(mockPurchaseReceiveService.submit).not.toHaveBeenCalled();
  });

  it('should bypass item validation if receipt type is Avulso', async () => {
    (configService.getLocadorConfig as jest.Mock).mockResolvedValue({ sendEnabled: false });
    selectQueue.push(
      [{ id: 124, status: 'conf_fisica', observations: '{}', receiptType: 'avulso', purchaseOrderId: null }],
      [],
    );
    returningQueue.push([{ id: 124, status: "fiscal_conferida" }]);

    const res = await request(app)
      .post('/api/receipts/124/confirm-fiscal')
      .send({ 
        paymentMethodCode: '001', 
        allocations: [{ costCenterId: 1, chartOfAccountsId: 1 }],
        invoiceDueDate: '2023-01-01'
      });

    // Verify success (200 OK)
    expect(res.status).toBe(200);
    // ERP submit is skipped because sendEnabled=false
    expect(mockPurchaseReceiveService.submit).not.toHaveBeenCalled();
  });

  it('should handle ERP error and preserve status', async () => {
    (configService.getLocadorConfig as jest.Mock).mockResolvedValue({ sendEnabled: true });
    selectQueue.push(
      [{ id: 123, status: 'conf_fisica', observations: '{}', receiptType: 'produto', purchaseOrderId: null, documentIssueDate: new Date('2023-01-01') }],
      [{ id: 1, description: "Item 1", unit: "UN", quantity: "1", unitPrice: "1", locadorProductCode: "P1" }],
      [],
      [],
    );
    returningQueue.push([{ id: 123, status: "erro_integracao" }]);

    // Mock ERP failure
    mockPurchaseReceiveService.submit.mockRejectedValue(new Error('ERP Connection Failed'));

    const res = await request(app)
      .post('/api/receipts/123/confirm-fiscal')
      .send({ 
          paymentMethodCode: '001', 
          allocations: [{ costCenterId: 1, chartOfAccountsId: 1 }],
          invoiceDueDate: '2023-01-01' 
      });

    expect(res.status).toBe(200);
    expect(res.body?.erp?.success).toBe(false);
    expect(mockPurchaseReceiveService.submit).toHaveBeenCalled();
  });

  it('should update status to conferida on ERP success', async () => {
    (configService.getLocadorConfig as jest.Mock).mockResolvedValue({ sendEnabled: true });
    selectQueue.push(
      [{ id: 123, status: 'conf_fisica', observations: '{}', receiptType: 'produto', purchaseOrderId: null, documentIssueDate: new Date('2023-01-01') }],
      [{ id: 1, description: "Item 1", unit: "UN", quantity: "1", unitPrice: "1", locadorProductCode: "P1" }],
      [],
      [],
    );
    returningQueue.push([{ id: 123, status: "integrado_locador" }]);

    // Mock ERP success
    mockPurchaseReceiveService.submit.mockResolvedValue({ success: true });

    const res = await request(app)
      .post('/api/receipts/123/confirm-fiscal')
      .send({ 
          paymentMethodCode: '001', 
          allocations: [{ costCenterId: 1, chartOfAccountsId: 1 }],
          invoiceDueDate: '2023-01-01' 
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body?.erp?.success).toBe(true);
    
    // Verify status update
    const setCalls = actionChain.set.mock.calls;
    const statusUpdate = setCalls.find(call => call[0].status === 'integrado_locador');
    expect(statusUpdate).toBeTruthy();
  });

  it('should reopen fiscal conference successfully', async () => {
    mockStorage.getReceiptById.mockResolvedValue({ id: 123, status: 'conferida', observations: '{}' });
    
    const res = await request(app)
      .post('/api/receipts/123/reopen-fiscal');

    expect(res.status).toBe(200);
    
    const setCalls = actionChain.set.mock.calls;
    const statusUpdate = setCalls.find(call => call[0].status === 'conf_fisica');
    expect(statusUpdate).toBeTruthy();
  });

  it('should not reopen if not conferida', async () => {
    mockStorage.getReceiptById.mockResolvedValue({ id: 123, status: 'rascunho' });
    
    const res = await request(app)
      .post('/api/receipts/123/reopen-fiscal');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Apenas notas conferidas/);
  });

  afterEach(async () => {
    if (server?.listening) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
