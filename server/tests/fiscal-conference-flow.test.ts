
import express from "express";
// @ts-ignore
import request from "supertest";
import { registerReceiptsRoutes } from "../routes/receipts";
// @ts-ignore
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { configService } from "../services/configService";
import { purchaseReceiveService } from "../integracao_locador/services/purchase-receive-service";
import { db } from "../db";

// Mock dependencies
jest.mock("../db");
jest.mock("../services/configService");
jest.mock("../integracao_locador/services/purchase-receive-service");

// Helper to mock Drizzle chains
const mockChain = () => {
  const chain: any = {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ rows: [] }),
    then: (resolve: any) => resolve([]), // Default resolve to empty array
  };
  return chain;
};

describe("Fiscal Conference Flow (Flag Disabled)", () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    // Mock session middleware
    app.use((req: any, res, next) => {
      req.session = { userId: 1 };
      next();
    });
    registerReceiptsRoutes(app);
    jest.clearAllMocks();
  });

  it("should return receipt details structure correctly", async () => {
    // Mock DB Select for GET
    const mockReceipt = {
      id: 999,
      receiptNumber: "REC-999",
      status: "conferencia_fiscal",
      totalAmount: 500
    };
    
    const chain = mockChain();
    chain.then = (resolve: any) => resolve([mockReceipt]); 

    (db.select as jest.Mock).mockReturnValue(chain);

    const response = await request(app).get("/api/receipts/999");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("id", 999);
    expect(response.body).toHaveProperty("items"); 
    expect(response.body).toHaveProperty("installments");
    expect(response.body).toHaveProperty("allocations");
  });

  it("should SKIP ERP integration when sendEnabled is FALSE", async () => {
    // 1. Mock Config
    (configService.getLocadorConfig as jest.Mock).mockResolvedValue({
      sendEnabled: false
    });

    // 2. Mock DB Select (Find Receipt)
    const mockReceipt = {
      id: 123,
      receiptNumber: "REC-001",
      status: "conferencia_fiscal",
      purchaseOrderId: 456,
      observations: "{}"
    };

    // We need to control what the chain resolves to based on the call
    // This is tricky with a single mock chain.
    // Let's make db.select return a chain that resolves to [mockReceipt] first time?
    // In the code:
    // 1. db.select().from(receipts).where(...) -> [rec]
    // 2. db.update()... (update basic info)
    // 3. db.delete()... (installments)
    // 4. db.insert()... (installments)
    // 5. db.delete()... (allocations)
    // 6. db.insert()... (allocations)
    // 7. configService.getLocadorConfig()
    // 8. db.update()... (status: fiscal_conferida) -> [updated]
    // 9. db.select()... (pending receipts) -> []
    // 10. db.select()... (purchase order) -> [order]
    // 11. db.update()... (purchase request)
    // 12. db.execute()... (audit log)

    // Simplified mock approach:
    // We only care that it runs and returns the expected JSON.
    // We can make all selects return something valid to avoid crashes.
    
    const chain = mockChain();
    chain.then = (resolve: any) => resolve([mockReceipt]); // Default returns receipt list

    (db.select as jest.Mock).mockReturnValue(chain);
    (db.update as jest.Mock).mockReturnValue(chain);
    (db.delete as jest.Mock).mockReturnValue(chain);
    (db.insert as jest.Mock).mockReturnValue(chain);
    (db.execute as jest.Mock).mockResolvedValue({ rows: [] });

    // Spy on service
    const submitSpy = jest.spyOn(purchaseReceiveService, "submit");

    const response = await request(app)
      .post("/api/receipts/123/confirm-fiscal")
      .send({
        paymentMethodCode: "001",
        totalAmount: 100,
        installments: [],
        allocations: []
      });

    expect(response.status).toBe(200);
    expect(response.body.erp).toEqual({
      success: true,
      message: "Integração ERP desabilitada. Conferência finalizada localmente.",
      code: "SKIPPED_BY_CONFIG"
    });
    expect(submitSpy).not.toHaveBeenCalled();
  });

  it("should CALL ERP integration when sendEnabled is TRUE", async () => {
    // 1. Mock Config
    (configService.getLocadorConfig as jest.Mock).mockResolvedValue({
      sendEnabled: true
    });

    const mockReceipt = {
      id: 123,
      receiptNumber: "REC-001",
      status: "conferencia_fiscal",
      purchaseOrderId: 456,
      observations: "{}"
    };

    const chain = mockChain();
    chain.then = (resolve: any) => resolve([mockReceipt]); 

    (db.select as jest.Mock).mockReturnValue(chain);
    (db.update as jest.Mock).mockReturnValue(chain);
    (db.delete as jest.Mock).mockReturnValue(chain);
    (db.insert as jest.Mock).mockReturnValue(chain);
    (db.execute as jest.Mock).mockResolvedValue({ rows: [] });

    const submitSpy = jest.spyOn(purchaseReceiveService, "submit").mockResolvedValue({} as any);

    const response = await request(app)
      .post("/api/receipts/123/confirm-fiscal")
      .send({
        paymentMethodCode: "001",
        totalAmount: 100,
        installments: [],
        allocations: []
      });

    expect(response.status).toBe(200);
    expect(response.body.erp).toEqual({
      success: true,
      message: "Integrado com sucesso",
      code: "SUCCESS"
    });
    expect(submitSpy).toHaveBeenCalled();
  });
});
