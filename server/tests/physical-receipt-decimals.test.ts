// @ts-nocheck
import express from "express";
import request from "supertest";

const mockStorage = {
  getPurchaseRequestById: jest.fn(),
  getPurchaseOrderByRequestId: jest.fn(),
  getPurchaseOrderItems: jest.fn(),
};

const mockDb = {
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  returning: jest.fn().mockResolvedValue([{ id: 1 }]),
  execute: jest.fn().mockResolvedValue(true),
};

jest.mock("../storage", () => ({ storage: mockStorage }));
jest.mock("../db", () => ({
  db: mockDb,
  purchaseOrders: { id: "id", fulfillmentStatus: "fulfillment_status" },
  purchaseOrderItems: { id: "id", quantityReceived: "quantity_received" },
  receipts: { id: "id" },
  receiptItems: { id: "id" },
  purchaseRequests: { id: "id", currentPhase: "current_phase" },
  eq: jest.fn(),
  sql: jest.fn(),
}));
jest.mock("../email-service", () => ({
  notifyNewRequest: jest.fn(),
  sendRFQToSuppliers: jest.fn(),
  notifyApprovalA1: jest.fn(),
  notifyApprovalA2: jest.fn(),
  notifyRejection: jest.fn(),
  testEmailConfiguration: jest.fn(),
  notifyRequestConclusion: jest.fn(),
}));
jest.mock("../pdf-service", () => ({
  PDFService: {
    generatePurchaseOrder: jest.fn(),
  },
}));
jest.mock("../services/supplier-integration", () => ({
  supplierIntegrationService: {
    searchByCNPJ: jest.fn(),
  },
}));

process.env.SESSION_SECRET = "test-secret-must-be-at-least-32-chars-long";
import { registerRoutes } from "../routes";

describe("Physical Receipt with Decimal Quantities", () => {
  let app: any;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.session = { userId: 1 };
      req.isAuthenticated = () => true;
      next();
    });
    registerRoutes(app);
    jest.clearAllMocks();
  });

  it("accepts decimal quantities and updates fulfillment status", async () => {
    mockStorage.getPurchaseRequestById.mockResolvedValue({ id: 10 });
    mockStorage.getPurchaseOrderByRequestId.mockResolvedValue({ id: 20, supplierId: 5 });
    mockStorage.getPurchaseOrderItems.mockResolvedValue([
      { id: 100, description: "Item 1", unit: "UN", quantity: "10", quantityReceived: "2", unitPrice: "5.00", itemCode: "CODE1" },
      { id: 101, description: "Item 2", unit: "UN", quantity: "5", quantityReceived: "0", unitPrice: "3.00", itemCode: "CODE2" },
    ]);

    const res = await request(app)
      .post("/api/purchase-requests/10/confirm-physical")
      .send({
        receivedQuantities: {
          100: 1.5,
          101: 2.25,
        },
        manualNFNumber: "NF-123",
        manualNFSeries: "1",
        observations: "Teste com decimais",
      });

    expect(res.status).toBe(200);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("rejects negative quantities", async () => {
    mockStorage.getPurchaseRequestById.mockResolvedValue({ id: 11 });
    mockStorage.getPurchaseOrderByRequestId.mockResolvedValue({ id: 21, supplierId: 5 });

    const res = await request(app)
      .post("/api/purchase-requests/11/confirm-physical")
      .send({
        receivedQuantities: {
          100: -1,
        },
        manualNFNumber: "NF-123",
        manualNFSeries: "1",
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Quantidade inválida/);
  });
});
