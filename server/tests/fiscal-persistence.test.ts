
// @ts-nocheck
import express from 'express';
import request from 'supertest';

// Mocks
const mockStorage = {
  getReceiptById: jest.fn(),
  getUserById: jest.fn().mockResolvedValue({ id: 1, name: 'Test User' }),
  initializeDefaultData: jest.fn().mockResolvedValue(true),
  getReceiptsByPurchaseOrderId: jest.fn().mockResolvedValue([]),
  getPurchaseOrderById: jest.fn(),
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

describe('Fiscal Data Persistence & Recovery', () => {
  let app: any;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    // Mock auth middleware
    app.use((req: any, res, next) => {
      req.session = { userId: 1 };
      req.isAuthenticated = () => true;
      next();
    });
    registerRoutes(app);
    jest.clearAllMocks();
  });

  it('should persist financial data even if ERP integration fails', async () => {
    // Setup: Receipt exists, has items
    mockStorage.getReceiptById.mockResolvedValue({ 
      id: 200, 
      status: 'conf_fisica', 
      observations: '{}', 
      receiptType: 'produto',
      purchaseOrderId: 1,
      supplierId: 1,
      documentIssueDate: new Date('2023-01-01')
    });
    mockDb.where.mockResolvedValue([{ id: 1 }]); // Has items

    // Mock PO, PR, Supplier for ERP
    mockStorage.getPurchaseOrderById.mockResolvedValue({ 
        id: 1, 
        purchaseRequestId: 1, 
        orderNumber: 'PO-1',
        createdAt: new Date('2023-01-01')
    });
    
    // Mock successful fetch of PR and Supplier
    mockDb.where.mockResolvedValue([{ id: 1, requestNumber: 'PR-1', cnpj: '123' }]);

    // Mock ERP failure
    mockPurchaseReceiveService.submit.mockRejectedValue(new Error('Simulated ERP Error'));

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

    // Expect error response because ERP failed
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Erro na integração ERP/);

    // Verify DB update was called to save observations
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockDb.set).toHaveBeenCalled();

    // Check content of the update
    const setCalls = mockDb.set.mock.calls;
    // Find the call that sets observations
    const obsUpdate = setCalls.find(call => call[0].observations);
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
    mockStorage.getReceiptById.mockResolvedValue({ 
      id: 300, 
      status: 'conf_fisica', 
      observations: '{}', 
      receiptType: 'avulso', // The route fetches this AFTER the update we expect
      purchaseOrderId: null,
      supplierId: null,
      documentIssueDate: new Date('2023-01-01')
    });
    
    // Mock NO items found
    mockDb.where.mockResolvedValue([]); 

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
    const setCalls = mockDb.set.mock.calls;
    // We expect one of the update calls to contain receiptType: 'avulso'
    const typeUpdate = setCalls.find(call => call[0].receiptType === 'avulso');
    expect(typeUpdate).toBeDefined();
    
    // Also verify manual fields update
    expect(typeUpdate[0].documentNumber).toBe('12345');
    expect(typeUpdate[0].totalAmount).toBe('100.00');
  });

  it('should persist financial data and update status on success', async () => {
    // Setup
    mockStorage.getReceiptById.mockResolvedValue({ 
      id: 201, 
      status: 'conf_fisica', 
      observations: '{}',
      receiptType: 'produto',
      purchaseOrderId: 1,
      supplierId: 1,
      documentIssueDate: new Date('2023-01-01')
    });
    mockDb.where.mockResolvedValue([{ id: 1 }]); // Has items
    
    mockStorage.getPurchaseOrderById.mockResolvedValue({ 
        id: 1, 
        purchaseRequestId: 1, 
        orderNumber: 'PO-1',
        createdAt: new Date('2023-01-01')
    });
    mockDb.where.mockResolvedValue([{ id: 1, requestNumber: 'PR-1', cnpj: '123' }]);

    // Mock ERP success
    mockPurchaseReceiveService.submit.mockResolvedValue({ success: true, message: 'OK' });

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
    const setCalls = mockDb.set.mock.calls;
    const updateCall = setCalls.find(call => call[0].status === 'conferida');
    expect(updateCall).toBeDefined();
    
    const savedObs = JSON.parse(updateCall[0].observations);
    expect(savedObs.financial.paymentMethodCode).toBe('002');
    expect(savedObs.erp.success).toBe(true);
  });

  it('should use linked receipt items for avulso receipt and not fallback', async () => {
    // Reset mocks to avoid interference
    mockDb.where.mockReset();
    mockDb.where.mockReturnThis();

    // Setup: Receipt is Avulso, has PO
    mockStorage.getReceiptById.mockResolvedValue({ 
      id: 400, 
      status: 'conf_fisica', 
      observations: '{}',
      receiptType: 'avulso', 
      purchaseOrderId: 10,
      supplierId: 10,
      documentIssueDate: new Date('2023-01-01')
    });
    
    // Mock items found in receipt_items (simulating correct Physical Receipt behavior)
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    
    // Mock PO
    mockStorage.getPurchaseOrderById.mockResolvedValue({ 
        id: 10, 
        purchaseRequestId: 10, 
        orderNumber: 'PO-10',
        createdAt: new Date('2023-01-01')
    });
    
    // Mock DB response for PR and Supplier (ERP integration)
    mockDb.where
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // 1. update call (receiptType update)
      .mockResolvedValueOnce([ // 2. receiptItems (FOUND!)
          { 
              id: 500,
              receiptId: 400,
              purchaseOrderItemId: 99, 
              locadorProductCode: 'ITEM-RECEIVED', 
              description: 'Received Item',
              quantity: 5,        // Correct quantity for this receipt
              unitPrice: 100,
              totalPrice: 500
          }
      ])
      // Fallback query (purchaseOrderItems) should NOT happen now
      .mockResolvedValueOnce([{ id: 10 }]) // 3. PR Existence Check (Audit Log)
      .mockResolvedValueOnce([{ id: 10, requestNumber: 'PR-10', companyId: 1 }]) // 4. purchaseRequest (ERP)
      .mockResolvedValueOnce([{ id: 10, name: 'Supplier', cnpj: '123' }]); // 5. supplier

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
