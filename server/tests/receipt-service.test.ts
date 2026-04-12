
import { finishReceiptWithoutErp } from "../services/receipt-service";
import { db } from "../db";
import { notifyRequestConclusion } from "../email-service";
import { eq, and, sql } from "drizzle-orm";

// Mock external dependencies
const mockQueryBuilder = {
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  returning: jest.fn().mockReturnThis(),
  then: jest.fn().mockImplementation((callback) => Promise.resolve([]).then(callback)),
};

jest.mock("../db", () => ({
  db: {
    select: jest.fn(() => mockQueryBuilder),
    update: jest.fn(() => mockQueryBuilder),
    execute: jest.fn(),
  }
}));

jest.mock("../email-service", () => ({
  notifyRequestConclusion: jest.fn(),
}));

describe("Receipt Service: finishReceiptWithoutErp", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset implementations
    mockQueryBuilder.from.mockReturnThis();
    mockQueryBuilder.where.mockReturnThis();
    mockQueryBuilder.set.mockReturnThis();
    mockQueryBuilder.returning.mockReturnThis();
    // Default: empty array
    mockQueryBuilder.then.mockImplementation((callback) => Promise.resolve([]).then(callback));
  });

  it("should throw error if user is not a buyer", async () => {
    // Mock user query to return non-buyer
    // 1st call to db.select() is for user
    // We can change behavior based on call order or inspection, but simplest is to mock the sequence of `then` calls
    // However, `then` is on the SAME object if we reuse `mockQueryBuilder`.
    // So we need to mock `then` to return different values sequentially.
    
    mockQueryBuilder.then
      .mockImplementationOnce((cb) => Promise.resolve([{ id: 1, isBuyer: false }]).then(cb)); // User

    await expect(finishReceiptWithoutErp(1, 100))
      .rejects.toThrow("Apenas compradores podem realizar esta ação.");
  });

  it("should throw error if receipt not found", async () => {
    mockQueryBuilder.then
      .mockImplementationOnce((cb) => Promise.resolve([{ id: 1, isBuyer: true }]).then(cb)) // User
      .mockImplementationOnce((cb) => Promise.resolve([]).then(cb)); // Receipt (not found)

    await expect(finishReceiptWithoutErp(1, 100))
      .rejects.toThrow("Recebimento não encontrado");
  });

  it("should throw error if receipt already finished", async () => {
    mockQueryBuilder.then
      .mockImplementationOnce((cb) => Promise.resolve([{ id: 1, isBuyer: true }]).then(cb)) // User
      .mockImplementationOnce((cb) => Promise.resolve([{ id: 100, status: 'fiscal_conferida' }]).then(cb)); // Receipt

    await expect(finishReceiptWithoutErp(1, 100))
      .rejects.toThrow("Recebimento já finalizado.");
  });

  it("should successfully finish receipt without ERP", async () => {
    // 1. User query
    mockQueryBuilder.then
      .mockImplementationOnce((cb) => Promise.resolve([{ id: 1, isBuyer: true }]).then(cb))
    // 2. Receipt query
      .mockImplementationOnce((cb) => Promise.resolve([{ id: 100, status: 'conf_fisica', purchaseOrderId: 50 }]).then(cb))
    // 3. Update receipt
      .mockImplementationOnce((cb) => Promise.resolve([{ id: 100, status: 'fiscal_conferida' }]).then(cb))
    // 4. Check pending receipts (empty = all done)
      .mockImplementationOnce((cb) => Promise.resolve([]).then(cb))
    // 5. Get Purchase Order
      .mockImplementationOnce((cb) => Promise.resolve([{ id: 50, purchaseRequestId: 10 }]).then(cb))
    // 6. Get Purchase Request (must be sent to physical receipt)
      .mockImplementationOnce((cb) => Promise.resolve([{ id: 10, sentToPhysicalReceipt: true }]).then(cb))
    // 7. Update Purchase Request
      .mockImplementationOnce((cb) => Promise.resolve([]).then(cb));

    const result = await finishReceiptWithoutErp(1, 100);

    expect(result).toEqual({ id: 100, status: 'fiscal_conferida' });
    expect(db.execute).toHaveBeenCalled(); // Audit log
    expect(notifyRequestConclusion).toHaveBeenCalledWith(10);
  });
});
