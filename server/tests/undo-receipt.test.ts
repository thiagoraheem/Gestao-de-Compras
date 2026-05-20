import { undoReceiptForPurchaseRequest } from "../services/receipt-service";
import { db } from "../db";

jest.mock("../email-service", () => ({
  notifyRequestConclusion: jest.fn(),
}));

const mockQueryBuilder: any = {
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  returning: jest.fn().mockReturnThis(),
  then: jest.fn().mockImplementation((callback: any) => Promise.resolve([]).then(callback)),
};

const tx: any = {
  delete: jest.fn(() => ({ where: jest.fn().mockResolvedValue(undefined) })),
  update: jest.fn(() => ({ set: jest.fn().mockReturnThis(), where: jest.fn().mockResolvedValue(undefined) })),
  insert: jest.fn(() => ({ values: jest.fn().mockResolvedValue(undefined) })),
};

jest.mock("../db", () => ({
  db: {
    select: jest.fn(() => mockQueryBuilder),
    transaction: jest.fn(async (fn: any) => fn(tx)),
  },
}));

describe("Undo Receiving", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQueryBuilder.from.mockReturnThis();
    mockQueryBuilder.where.mockReturnThis();
    mockQueryBuilder.limit.mockReturnThis();
    mockQueryBuilder.orderBy.mockReturnThis();
    mockQueryBuilder.set.mockReturnThis();
    mockQueryBuilder.returning.mockReturnThis();
    mockQueryBuilder.then.mockImplementation((callback: any) => Promise.resolve([]).then(callback));
  });

  it("bloqueia se houver recebimento sincronizado com ERP", async () => {
    mockQueryBuilder.then
      .mockImplementationOnce((cb: any) => Promise.resolve([{ id: 1, isBuyer: true }]).then(cb))
      .mockImplementationOnce((cb: any) => Promise.resolve([{ id: 10, currentPhase: "pedido_concluido" }]).then(cb))
      .mockImplementationOnce((cb: any) => Promise.resolve([{ id: 20 }]).then(cb))
      .mockImplementationOnce((cb: any) => Promise.resolve([{ id: 100, receiptNumber: "REC-100", status: "integrado_locador", receiptPhase: "concluido", locadorReceiptId: "X", createdAt: new Date() }]).then(cb));

    await expect(undoReceiptForPurchaseRequest(10, 1, { confirm: true, expectedReceiptIds: [100] }))
      .rejects.toThrow(/já foi enviado ao ERP/i);
  });

  it("exige confirmação quando existem recebimentos parciais (múltiplos recibos)", async () => {
    mockQueryBuilder.then
      .mockImplementationOnce((cb: any) => Promise.resolve([{ id: 1, isBuyer: true }]).then(cb))
      .mockImplementationOnce((cb: any) => Promise.resolve([{ id: 10, currentPhase: "pedido_concluido" }]).then(cb))
      .mockImplementationOnce((cb: any) => Promise.resolve([{ id: 20 }]).then(cb))
      .mockImplementationOnce((cb: any) => Promise.resolve([
        { id: 101, receiptNumber: "REC-101", status: "rascunho", receiptPhase: "recebimento_fisico", locadorReceiptId: null, createdAt: new Date() },
        { id: 102, receiptNumber: "REC-102", status: "conf_fisica", receiptPhase: "conf_fiscal", locadorReceiptId: null, createdAt: new Date() },
      ]).then(cb));

    await expect(undoReceiptForPurchaseRequest(10, 1, { confirm: false, expectedReceiptIds: [101, 102] }))
      .rejects.toThrow(/Confirme/i);
  });

  it("executa em transação e redefine fase para pedido_compra quando confirmado", async () => {
    mockQueryBuilder.then
      .mockImplementationOnce((cb: any) => Promise.resolve([{ id: 1, isBuyer: true }]).then(cb))
      .mockImplementationOnce((cb: any) => Promise.resolve([{ id: 10, currentPhase: "pedido_concluido" }]).then(cb))
      .mockImplementationOnce((cb: any) => Promise.resolve([{ id: 20 }]).then(cb))
      .mockImplementationOnce((cb: any) => Promise.resolve([
        { id: 201, receiptNumber: "REC-201", status: "rascunho", receiptPhase: "recebimento_fisico", locadorReceiptId: null, createdAt: new Date() },
        { id: 202, receiptNumber: "REC-202", status: "conf_fisica", receiptPhase: "conf_fiscal", locadorReceiptId: null, createdAt: new Date() },
      ]).then(cb));

    const result = await undoReceiptForPurchaseRequest(10, 1, { confirm: true, expectedReceiptIds: [201, 202] });

    expect(result).toEqual(expect.objectContaining({ success: true, newPhase: "pedido_compra" }));
    expect((db as any).transaction).toHaveBeenCalled();
    expect(tx.delete).toHaveBeenCalled();
    expect(tx.update).toHaveBeenCalled();
    expect(tx.insert).toHaveBeenCalled();
  });
});
