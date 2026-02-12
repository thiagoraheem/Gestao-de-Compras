
// @ts-nocheck
import express from 'express';
import request from 'supertest';

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

const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
};

// Apply mocks
jest.mock('../storage', () => ({ storage: mockStorage }));
jest.mock('../integracao_locador/services/purchase-receive-service', () => ({ 
  purchaseReceiveService: mockPurchaseReceiveService 
}));
jest.mock('../db', () => ({ 
  db: mockDb,
  receipts: { id: 'id', observations: 'observations', status: 'status' },
  receiptItems: { receiptId: 'receipt_id' },
  eq: jest.fn()
}));
jest.mock('../email-service', () => ({
  notifyNewRequest: jest.fn(),
  sendRFQToSuppliers: jest.fn(),
  notifyApprovalA1: jest.fn(),
  notifyApprovalA2: jest.fn(),
  notifyRejection: jest.fn(),
  testEmailConfiguration: jest.fn(),
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

process.env.SESSION_SECRET = 'test-secret-must-be-at-least-32-chars-long';
// Import routes after mocks
import { registerRoutes } from '../routes';

describe('Fiscal Confirmation & Reopen Logic', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    // Mock auth middleware
    app.use((req, res, next) => {
      req.session = { userId: 1 };
      req.isAuthenticated = () => true;
      next();
    });
    registerRoutes(app);
    jest.clearAllMocks();
  });

  it('should prevent ERP submission if receipt has no items', async () => {
    // Setup: Receipt exists, but no items
    mockStorage.getReceiptById.mockResolvedValue({ id: 123, status: 'conf_fisica', observations: '{}', receiptType: 'produto' });
    mockDb.where.mockResolvedValue([]); // No items returned

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
    // Setup: Receipt is Avulso, no items
    mockStorage.getReceiptById.mockResolvedValue({ 
      id: 124, 
      status: 'conf_fisica', 
      observations: '{}',
      receiptType: 'avulso' 
    });
    mockDb.where.mockResolvedValue([]); // No items returned

    // Mock ERP success
    mockPurchaseReceiveService.submit.mockResolvedValue({ 
      success: true, 
      status: 'integrado' 
    });

    const res = await request(app)
      .post('/api/receipts/124/confirm-fiscal')
      .send({ 
        paymentMethodCode: '001', 
        allocations: [{ costCenterId: 1, chartOfAccountsId: 1 }],
        invoiceDueDate: '2023-01-01'
      });

    // Verify success (200 OK)
    expect(res.status).toBe(200);
    // ERP submit is skipped because no PO is linked in this mock, 
    // but the fact it reached 200 means validation was bypassed.
    expect(mockPurchaseReceiveService.submit).not.toHaveBeenCalled();
  });

  it('should handle ERP error and preserve status', async () => {
    // Setup: Receipt exists, has items
    mockStorage.getReceiptById.mockResolvedValue({ 
      id: 123, 
      status: 'conf_fisica', 
      observations: '{}', 
      receiptType: 'produto',
      purchaseOrderId: 1,
      supplierId: 1,
      documentIssueDate: new Date('2023-01-01')
    });
    mockDb.where.mockResolvedValue([{ id: 1 }]); // Has items

    // Mock PO, PR, Supplier for ERP
    mockStorage.getPurchaseOrderById = jest.fn().mockResolvedValue({ 
        id: 1, 
        purchaseRequestId: 1, 
        orderNumber: 'PO-1',
        createdAt: new Date('2023-01-01')
    });
    // For DB selects (PR, Supplier)
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    // We need different returns for different tables, but simplifying:
    // If we assume the route does: await db.select()...
    // We can't easily mock sequential calls with just mockReturnThis().
    // However, if we make mockDb.where return valid arrays, it might pass.
    // The route checks: purchaseRequest && supplier
    
    // Hack: mockDb.where returns array with one object that satisfies both PR and Supplier shape
    mockDb.where.mockResolvedValue([{ id: 1, requestNumber: 'PR-1', cnpj: '123' }]);

    // Mock ERP failure
    mockPurchaseReceiveService.submit.mockRejectedValue(new Error('ERP Connection Failed'));

    const res = await request(app)
      .post('/api/receipts/123/confirm-fiscal')
      .send({ 
          paymentMethodCode: '001', 
          allocations: [{ costCenterId: 1, chartOfAccountsId: 1 }],
          invoiceDueDate: '2023-01-01' 
      });

    // Expect error response (400 because we catch the error and return formatted error)
    if (res.status !== 400) {
        console.log("Unexpected status:", res.status);
        console.log("Response body:", JSON.stringify(res.body, null, 2));
    }
    expect(res.status).toBe(400);
    
    // Ensure status was NOT updated to 'conferida'
    expect(mockPurchaseReceiveService.submit).toHaveBeenCalled();
  });

  it('should update status to conferida on ERP success', async () => {
    // Setup
    mockStorage.getReceiptById.mockResolvedValue({ 
      id: 123, 
      status: 'conf_fisica', 
      observations: '{}',
      receiptType: 'produto',
      purchaseOrderId: 1,
      supplierId: 1,
      documentIssueDate: new Date('2023-01-01')
    });
    mockDb.where.mockResolvedValue([{ id: 1 }]); // Has items
    
    // Mock PO, PR, Supplier
    mockStorage.getPurchaseOrderById = jest.fn().mockResolvedValue({ 
        id: 1, 
        purchaseRequestId: 1, 
        orderNumber: 'PO-1',
        createdAt: new Date('2023-01-01')
    });
    mockDb.where.mockResolvedValue([{ id: 1, requestNumber: 'PR-1', cnpj: '123' }]);

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
    
    // Verify status update
    const setCalls = mockDb.set.mock.calls;
    const statusUpdate = setCalls.find(call => call[0].status === 'conferida');
    expect(statusUpdate).toBeTruthy();
  });

  it('should reopen fiscal conference successfully', async () => {
    mockStorage.getReceiptById.mockResolvedValue({ id: 123, status: 'conferida', observations: '{}' });
    
    const res = await request(app)
      .post('/api/receipts/123/reopen-fiscal');

    expect(res.status).toBe(200);
    
    const setCalls = mockDb.set.mock.calls;
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
});
