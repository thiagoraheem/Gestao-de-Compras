// @ts-nocheck

const selectWhereQueue: any[] = [];
const updateReturningQueue: any[] = [];

const selectBuilder = {
  from: jest.fn().mockReturnThis(),
  where: jest.fn(() => Promise.resolve(selectWhereQueue.shift() ?? [])),
};

const updateBuilder = {
  set: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  returning: jest.fn(() => Promise.resolve(updateReturningQueue.shift() ?? [{ id: 1 }])),
};

const mockDb = {
  select: jest.fn(() => selectBuilder),
  update: jest.fn(() => updateBuilder),
  execute: jest.fn().mockResolvedValue(true),
};

const mockNotifyRequestConclusion = jest.fn();

jest.mock("../db", () => ({
  db: mockDb,
}));

jest.mock("../email-service", () => ({
  notifyRequestConclusion: (...args: any[]) => mockNotifyRequestConclusion(...args),
}));

jest.mock("../../shared/schema", () => ({
  receipts: { __t: "receipts" },
  users: { __t: "users" },
  purchaseOrders: { __t: "purchase_orders" },
  purchaseRequests: { __t: "purchase_requests" },
  auditLogs: { __t: "audit_logs" },
}));

jest.mock("drizzle-orm", () => ({
  ...jest.requireActual("drizzle-orm"),
  eq: jest.fn(),
  and: jest.fn(),
  sql: (strings: any, ...values: any[]) => ({ strings, values }),
}));

describe("Ciclo desacoplado: receipts não alteram purchase_requests", () => {
  beforeEach(() => {
    process.env.FEATURE_DECOUPLE_RECEIPTS_LIFECYCLE = "true";
    selectWhereQueue.length = 0;
    updateReturningQueue.length = 0;
    jest.clearAllMocks();
  });

  it("finishReceiptWithoutErp não atualiza purchase_requests quando a flag está ativa", async () => {
    const { finishReceiptWithoutErp } = await import("../services/receipt-service");
    const { receipts, purchaseRequests } = await import("../../shared/schema");

    selectWhereQueue.push([{ id: 1, isBuyer: true }]);
    selectWhereQueue.push([{ id: 10, purchaseOrderId: 20, status: "conf_fisica" }]);
    selectWhereQueue.push([]);
    selectWhereQueue.push([{ id: 20, purchaseRequestId: 5 }]);

    updateReturningQueue.push([{ id: 10, status: "fiscal_conferida", receiptPhase: "concluido" }]);

    await finishReceiptWithoutErp(1, 10);

    const updatedTables = mockDb.update.mock.calls.map((c: any[]) => c[0]);
    expect(updatedTables).toContain(receipts);
    expect(updatedTables).not.toContain(purchaseRequests);
    expect(mockNotifyRequestConclusion).not.toHaveBeenCalled();
  });
});
