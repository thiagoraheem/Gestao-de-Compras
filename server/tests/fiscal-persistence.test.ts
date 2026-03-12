
// @ts-nocheck
import express from 'express';
import request from 'supertest';

// Mocks
const mockStorage = {
  getReceiptById: jest.fn(),
  getUserById: jest.fn().mockResolvedValue({ id: 1, name: 'Test User' }),
  getUser: jest.fn().mockResolvedValue({ id: 1, isReceiver: true, isAdmin: true }),
  initializeDefaultData: jest.fn().mockResolvedValue(true),
  getReceiptsByPurchaseOrderId: jest.fn().mockResolvedValue([]),
  getPurchaseOrderById: jest.fn(),
};

const mockPurchaseReceiveService = {
  submit: jest.fn(),
};

const selectWhereQueue: any[] = [];
const updateReturningQueue: any[] = [];

const mockDb = {
  select: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  insert: jest.fn(),
  execute: jest.fn().mockResolvedValue(true),
};

const selectBuilder = {
  from: jest.fn().mockReturnThis(),
  where: jest.fn(() => Promise.resolve(selectWhereQueue.shift() ?? [])),
};

const updateBuilder = {
  set: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  returning: jest.fn(() => Promise.resolve(updateReturningQueue.shift() ?? [{ id: 1 }])),
};

const deleteBuilder = {
  where: jest.fn().mockReturnThis(),
};

const insertBuilder = {
  values: jest.fn().mockReturnThis(),
};

mockDb.select.mockImplementation(() => selectBuilder);
mockDb.update.mockImplementation(() => updateBuilder);
mockDb.delete.mockImplementation(() => deleteBuilder);
mockDb.insert.mockImplementation(() => insertBuilder);

// Apply mocks
jest.mock('../storage', () => ({ storage: mockStorage }));
jest.mock('../integracao_locador/services/purchase-receive-service', () => ({ 
  purchaseReceiveService: mockPurchaseReceiveService 
}));
jest.mock('../db', () => ({ 
  db: mockDb,
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
    on: jest.fn(),
    end: jest.fn().mockResolvedValue(true),
  },
  receipts: { id: 'id', observations: 'observations', status: 'status' },
  receiptItems: { receiptId: 'receipt_id' },
  eq: jest.fn(),
  sql: jest.fn()
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
jest.mock('../services/configService', () => ({
  configService: {
    getLocadorConfig: jest.fn().mockResolvedValue({ sendEnabled: true }),
  },
}));

process.env.SESSION_SECRET = 'test-secret-must-be-at-least-32-chars-long';
// Import routes after mocks
import { registerRoutes } from '../routes';

describe('Fiscal Data Persistence & Recovery', () => {
  let app: any;
  let server: any;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    // Mock auth middleware
    app.use((req: any, res, next) => {
      req.session = { userId: 1 };
      req.isAuthenticated = () => true;
      next();
    });
    server = await registerRoutes(app);
    jest.clearAllMocks();
    selectWhereQueue.length = 0;
    updateReturningQueue.length = 0;
  });

  afterEach(async () => {
    if (server?.listening) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('should persist financial data even if ERP integration fails', async () => {
    // Setup: Receipt exists, has items
    selectWhereQueue.push([{ 
      id: 200, 
      status: 'conf_fisica', 
      observations: '{}', 
      receiptType: 'produto',
      purchaseOrderId: 1,
      supplierId: 1,
      documentIssueDate: new Date('2023-01-01')
    }]);
    selectWhereQueue.push([{ id: 1, locadorProductCode: 'ITEM-1', description: 'Item', unit: 'UN', quantity: 1, unitPrice: 1 }]); // Has items

    // Mock PO, PR, Supplier for ERP
    selectWhereQueue.push([]); // installments
    selectWhereQueue.push([]); // allocations
    selectWhereQueue.push([{ id: 1, purchaseRequestId: 1, orderNumber: 'PO-1', createdAt: new Date('2023-01-01') }]); // purchaseOrder
    selectWhereQueue.push([{ id: 1, requestNumber: 'PR-1', justification: 'J', companyId: null }]); // purchaseRequest

    // Mock ERP failure
    mockPurchaseReceiveService.submit.mockRejectedValue(new Error('Simulated ERP Error'));
    updateReturningQueue.push([{ id: 200, status: 'erro_integracao' }]);

    const payload = { 
        paymentMethodCode: '001', 
        allocations: [{ costCenterId: 1, chartOfAccountsId: 1, amount: 100 }],
        invoiceDueDate: '2023-01-01',
        hasInstallments: false,
        installmentCount: 1,
        installments: []
    };

    const res = await request(app)
      .post('/api/receipts/200/confirm-fiscal')
      .send(payload);

    // Expect success response for local persistence, with ERP flagged as failed
    expect(res.status).toBe(200);
    expect(res.body?.erp?.success).toBe(false);

    // Verify DB update was called to save observations
    expect(mockDb.update).toHaveBeenCalled();
    expect(updateBuilder.set).toHaveBeenCalled();

    // Check content of the update
    const setCalls = updateBuilder.set.mock.calls;
    const obsUpdate = setCalls.find((call) => {
      try {
        if (!call?.[0]?.observations) return false;
        const parsed = JSON.parse(call[0].observations);
        return !!parsed?.lastErpAttempt;
      } catch {
        return false;
      }
    });
    expect(obsUpdate).toBeDefined();
    
    const savedObs = JSON.parse(obsUpdate[0].observations);
    
    // Verify financial data is persisted
    expect(savedObs.financial).toBeDefined();
    expect(savedObs.financial.paymentMethodCode).toBe('001');
    expect(savedObs.financial.invoiceDueDate).toBe('2023-01-01');
    
    // Verify error info is persisted
    expect(savedObs.lastErpAttempt).toBeDefined();
    expect(savedObs.lastErpAttempt.success).toBe(false);
    expect(savedObs.lastErpAttempt.message).toBe('Simulated ERP Error');
  });

  it('should update receiptType to avulso and bypass item validation', async () => {
    // Setup: We simulate that the DB *will* return the updated type after our update call
    selectWhereQueue.push([{ 
      id: 300, 
      status: 'conf_fisica', 
      observations: '{}', 
      receiptType: 'avulso', // The route fetches this AFTER the update we expect
      purchaseOrderId: null,
      supplierId: null,
      documentIssueDate: new Date('2023-01-01')
    }]);
    
    // Mock NO items found
    selectWhereQueue.push([]); 

    // Mock successful ERP
    mockPurchaseReceiveService.submit.mockResolvedValue({ success: true, message: 'Integrated' });

    const payload = { 
        paymentMethodCode: '001', 
        allocations: [{ costCenterId: 1, chartOfAccountsId: 1, amount: 100 }],
        invoiceDueDate: '2023-01-01',
        hasInstallments: false,
        installmentCount: 1,
        installments: [],
        receiptType: 'avulso',
        documentNumber: '12345',
        totalAmount: '100.00'
    };

    const res = await request(app)
      .post('/api/receipts/300/confirm-fiscal')
      .send(payload);

    // Should be success
    expect(res.status).toBe(200);

    // Check if db.update was called to update receipt type
    const setCalls = updateBuilder.set.mock.calls;
    // We expect one of the update calls to contain receiptType: 'avulso'
    const typeUpdate = setCalls.find(call => call[0].receiptType === 'avulso');
    expect(typeUpdate).toBeDefined();
    
    // Also verify manual fields update
    expect(typeUpdate[0].documentNumber).toBe('12345');
    expect(typeUpdate[0].totalAmount).toBe('100.00');
  });

  it('should persist financial data and update status on success', async () => {
    // Setup
    selectWhereQueue.push([{ 
      id: 201, 
      status: 'conf_fisica', 
      observations: '{}',
      receiptType: 'produto',
      purchaseOrderId: 1,
      supplierId: 1,
      documentIssueDate: new Date('2023-01-01')
    }]);
    selectWhereQueue.push([{ id: 1, locadorProductCode: 'ITEM-1', description: 'Item', unit: 'UN', quantity: 1, unitPrice: 1 }]); // Has items
    
    selectWhereQueue.push([]); // installments
    selectWhereQueue.push([]); // allocations
    selectWhereQueue.push([{ id: 1, purchaseRequestId: 1, orderNumber: 'PO-1', createdAt: new Date('2023-01-01') }]); // purchaseOrder
    selectWhereQueue.push([{ id: 1, requestNumber: 'PR-1', justification: 'J', companyId: null }]); // purchaseRequest

    // Mock ERP success
    mockPurchaseReceiveService.submit.mockResolvedValue({ success: true, message: 'OK' });
    updateReturningQueue.push([{ id: 201, status: 'integrado_locador' }]);

    const payload = { 
        paymentMethodCode: '002', 
        allocations: [{ costCenterId: 2, chartOfAccountsId: 2, amount: 200 }],
        invoiceDueDate: '2023-02-02',
        hasInstallments: false,
        installmentCount: 1,
        installments: []
    };

    const res = await request(app)
      .post('/api/receipts/201/confirm-fiscal')
      .send(payload);

    expect(res.status).toBe(200);
    
    // Verify DB update
    const setCalls = updateBuilder.set.mock.calls;
    const statusCall = setCalls.find(call => call[0].status === 'integrado_locador');
    expect(statusCall).toBeDefined();

    const obsCall = setCalls.find(call => !!call?.[0]?.observations);
    expect(obsCall).toBeDefined();

    const savedObs = JSON.parse(obsCall[0].observations);
    expect(savedObs.financial.paymentMethodCode).toBe('002');
  });

  it('should use linked receipt items for avulso receipt and not fallback', async () => {
    selectWhereQueue.push([
      {
        id: 400,
        status: 'conf_fisica',
        observations: '{}',
        receiptType: 'avulso',
        purchaseOrderId: 10,
        supplierId: 10,
        documentIssueDate: new Date('2023-01-01'),
      },
    ]);

    // Receipt items MUST come from receipt_items (not fallback)
    selectWhereQueue.push([
      {
        id: 500,
        receiptId: 400,
        purchaseOrderItemId: 99,
        locadorProductCode: 'ITEM-RECEIVED',
        description: 'Received Item',
        quantity: 5,
        unitPrice: 100,
        totalPrice: 500,
        unit: 'UN',
      },
    ]);

    selectWhereQueue.push([]); // installments
    selectWhereQueue.push([]); // allocations
    selectWhereQueue.push([{ id: 10, purchaseRequestId: 10, orderNumber: 'PO-10', createdAt: new Date('2023-01-01') }]); // purchaseOrder
    selectWhereQueue.push([{ id: 10, requestNumber: 'PR-10', justification: 'J', companyId: 1 }]); // purchaseRequest
    selectWhereQueue.push([{ id: 1, idCompanyERP: 1 }]); // company
    updateReturningQueue.push([{ id: 400, status: 'integrado_locador' }]);

    // Mock ERP success
    mockPurchaseReceiveService.submit.mockResolvedValue({ success: true, message: 'OK' });

    const payload = { 
        paymentMethodCode: '002', 
        allocations: [{ costCenterId: 2, chartOfAccountsId: 2, amount: 200 }],
        invoiceDueDate: '2023-02-02',
        hasInstallments: false,
        installmentCount: 1,
        installments: [],
        receiptType: 'avulso'
    };

    const res = await request(app)
      .post('/api/receipts/400/confirm-fiscal')
      .send(payload);

    expect(res.status).toBe(200);
    
    // Check if ERP submit was called with the receipt items
    expect(mockPurchaseReceiveService.submit).toHaveBeenCalled();
    const submitCall = mockPurchaseReceiveService.submit.mock.calls[0][0];
    
    expect(submitCall.itens).toHaveLength(1);
    expect(submitCall.itens[0].codigo_produto).toBe('ITEM-RECEIVED');
    expect(submitCall.itens[0].quantidade).toBe(5); 
  });
});
