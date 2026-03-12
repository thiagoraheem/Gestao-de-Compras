
import { DatabaseStorage } from "../storage";
import { pool } from "../db";

// Mock the pool
jest.mock("../db", () => {
  const query = jest.fn();
  return {
    pool: {
      query,
      connect: jest.fn(async () => ({
        query,
        release: jest.fn(),
      })),
    },
    db: {
      select: jest.fn(),
    },
  };
});

describe("DatabaseStorage: getPurchaseRequestsForReport Optional Dates", () => {
  let storage: DatabaseStorage;

  beforeEach(() => {
    storage = new DatabaseStorage();
    jest.clearAllMocks();
    
    // Default mock implementation
    (pool.query as jest.Mock).mockImplementation(async (sql: string) => {
      if (typeof sql === "string" && sql.includes("COUNT(*)")) {
        return { rows: [{ total: "0" }] };
      }
      return { rows: [] };
    });
  });

  it("should apply startDate filter when only startDate is provided", async () => {
    const filters = {
      startDate: new Date("2023-01-01T00:00:00.000Z"),
    };

    await storage.getPurchaseRequestsForReport(filters);

    const calls = (pool.query as jest.Mock).mock.calls;
    // Look for the data query, not the count query
    const dataCall = calls.find(([sql]) => typeof sql === "string" && sql.includes("FROM purchase_requests pr") && sql.includes("SELECT") && !sql.includes("COUNT(*)"));
    
    expect(dataCall).toBeDefined();
    const sql = dataCall![0];
    const params = dataCall![1];

    expect(sql).toContain("pr.created_at >= $");
    expect(sql).not.toContain("pr.created_at <= $"); // Should not have end date
    expect(params).toContainEqual(filters.startDate);
  });

  it("should apply endDate filter when only endDate is provided", async () => {
    const filters = {
      endDate: new Date("2023-12-31T23:59:59.999Z"),
    };

    await storage.getPurchaseRequestsForReport(filters);

    const calls = (pool.query as jest.Mock).mock.calls;
    const dataCall = calls.find(([sql]) => typeof sql === "string" && sql.includes("FROM purchase_requests pr") && sql.includes("SELECT") && !sql.includes("COUNT(*)"));
    
    expect(dataCall).toBeDefined();
    const sql = dataCall![0];
    const params = dataCall![1];

    expect(sql).not.toContain("pr.created_at >= $"); // Should not have start date
    expect(sql).toContain("pr.created_at <= $");
    expect(params).toContainEqual(filters.endDate);
  });

  it("should apply both filters when range is provided", async () => {
    const filters = {
      startDate: new Date("2023-01-01T00:00:00.000Z"),
      endDate: new Date("2023-12-31T23:59:59.999Z"),
    };

    await storage.getPurchaseRequestsForReport(filters);

    const calls = (pool.query as jest.Mock).mock.calls;
    const dataCall = calls.find(([sql]) => typeof sql === "string" && sql.includes("FROM purchase_requests pr") && sql.includes("SELECT") && !sql.includes("COUNT(*)"));
    
    expect(dataCall).toBeDefined();
    const sql = dataCall![0];
    const params = dataCall![1];

    expect(sql).toContain("pr.created_at >= $");
    expect(sql).toContain("pr.created_at <= $");
    expect(params).toContainEqual(filters.startDate);
    expect(params).toContainEqual(filters.endDate);
  });

  it("should allow query without dates if other filters are present", async () => {
    const filters = {
      itemDescription: "Notebook",
    };

    await storage.getPurchaseRequestsForReport(filters);

    const calls = (pool.query as jest.Mock).mock.calls;
    const dataCall = calls.find(([sql]) => typeof sql === "string" && sql.includes("FROM purchase_requests pr") && sql.includes("SELECT") && !sql.includes("COUNT(*)"));
    
    expect(dataCall).toBeDefined();
    const sql = dataCall![0];
    const params = dataCall![1];

    expect(sql).not.toContain("pr.created_at >=");
    expect(sql).not.toContain("pr.created_at <=");
    expect(sql).toContain("purchase_request_items WHERE description ILIKE $");
    expect(params).toContain("%Notebook%");
  });
});
