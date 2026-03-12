
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

describe("DatabaseStorage: getPurchaseRequestsForReport", () => {
  let storage: DatabaseStorage;

  beforeEach(() => {
    storage = new DatabaseStorage();
    jest.clearAllMocks();
  });

  it("should include item description filter in SQL query", async () => {
    // Mock the response for the main query
    (pool.query as jest.Mock).mockResolvedValue({ rows: [] });

    const filters = {
      itemDescription: "cadeira",
    };

    await storage.getPurchaseRequestsForReport(filters);

    const calls = (pool.query as jest.Mock).mock.calls;
    const queryCall = calls.find(([sql]) => typeof sql === "string" && sql.includes("purchase_request_items"));
    expect(queryCall).toBeDefined();
    const calledQuery = queryCall![0];
    const calledParams = queryCall![1];

    expect(calledQuery).toContain("purchase_request_items");
    expect(calledQuery).toContain("description ILIKE");
    expect(calledParams).toContain("%cadeira%");
  });
  
  it("should not include item description filter when empty", async () => {
    (pool.query as jest.Mock).mockResolvedValue({ rows: [] });

    const filters = {
      itemDescription: "",
    };

    await storage.getPurchaseRequestsForReport(filters);

    const reportSqlCalls = (pool.query as jest.Mock).mock.calls
      .map((c) => c[0])
      .filter((sql) => typeof sql === "string" && sql.includes("purchase_requests pr"));
    
    expect(reportSqlCalls.length).toBeGreaterThan(0);
    for (const sql of reportSqlCalls) {
      expect(sql).not.toContain("purchase_request_items");
    }
  });

  it("should handle special characters and accents in item description", async () => {
    (pool.query as jest.Mock).mockResolvedValue({ rows: [] });

    const filters = {
      itemDescription: "pão de açúcar",
    };

    await storage.getPurchaseRequestsForReport(filters);

    const calls = (pool.query as jest.Mock).mock.calls;
    const paramsCall = calls.find(([, params]) => Array.isArray(params) && params.includes("%pão de açúcar%"));
    expect(paramsCall).toBeDefined();
    const calledParams = paramsCall![1];
    expect(calledParams).toContain("%pão de açúcar%");
  });
});

describe("DatabaseStorage: getDistinctItemDescriptions", () => {
  let storage: DatabaseStorage;

  beforeEach(() => {
    storage = new DatabaseStorage();
    jest.clearAllMocks();
  });

  it("should fetch distinct descriptions with limit", async () => {
    const mockRows = [{ description: "Item A" }, { description: "Item B" }];
    (pool.query as jest.Mock).mockResolvedValue({ rows: mockRows });

    const result = await storage.getDistinctItemDescriptions("Item");

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("SELECT DISTINCT description FROM purchase_request_items"),
      expect.arrayContaining(["%Item%"])
    );
    expect(result).toEqual(["Item A", "Item B"]);
  });
});
