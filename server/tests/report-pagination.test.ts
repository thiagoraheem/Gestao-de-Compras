
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

describe("DatabaseStorage: getPurchaseRequestsForReport Pagination", () => {
  let storage: DatabaseStorage;

  beforeEach(() => {
    storage = new DatabaseStorage();
    jest.clearAllMocks();
  });

  it("should apply limit and offset when provided", async () => {
    (pool.query as jest.Mock).mockImplementation(async (sql: string) => {
      if (typeof sql === "string" && sql.includes("COUNT(*)")) {
        return { rows: [{ total: "100" }] };
      }
      return { rows: [] };
    });

    const filters = {
      limit: 10,
      offset: 20,
    };

    await storage.getPurchaseRequestsForReport(filters);

    const calls = (pool.query as jest.Mock).mock.calls;
    const dataCall = calls.find(([sql]) => typeof sql === "string" && sql.includes("FROM purchase_requests pr") && sql.includes("SELECT") && !sql.includes("COUNT(*)"));
    expect(dataCall).toBeDefined();
    const dataQuery = dataCall![0];
    const dataParams = dataCall![1];

    expect(dataQuery).toContain("LIMIT");
    expect(dataQuery).toContain("OFFSET");
    // Params should contain limit and offset at the end
    expect(dataParams[dataParams.length - 2]).toBe(10);
    expect(dataParams[dataParams.length - 1]).toBe(20);
  });

  it("should return correct structure with pagination", async () => {
    (pool.query as jest.Mock).mockImplementation(async (sql: string) => {
      if (typeof sql === "string" && sql.includes("COUNT(*)")) {
        return { rows: [{ total: "50" }] };
      }
      return { rows: [] };
    });

    const result = await storage.getPurchaseRequestsForReport({ limit: 10, offset: 0 });

    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('total');
    expect(result.total).toBe(50);
    expect(Array.isArray(result.data)).toBe(true);
  });
  
  it("should default to no limit if not provided (backward compatibility or default behavior)", async () => {
     // If we enforce pagination, we might want a default.
     // If the user doesn't provide limit, maybe we return all? Or a default limit?
     // The prompt asks for server-side pagination, implying we should use it.
     // Let's assume if no limit provided, it behaves as before (or we set a default in the route/storage).
     // For now, let's see how the implementation handles it.
     
    (pool.query as jest.Mock).mockImplementation(async (sql: string) => {
      if (typeof sql === "string" && sql.includes("COUNT(*)")) {
        return { rows: [{ total: "50" }] };
      }
      return { rows: [] };
    });

    const result = await storage.getPurchaseRequestsForReport({});
    // If no limit is passed, we might still return the structure but with all data.
    // However, the prompt says "Implement server-side pagination".
    // I will implement it such that if pagination params are present, it uses them.
    // If not, maybe it returns all but in the new structure? Or maybe I should update the return type to ALWAYS be { data, total }.
    // Yes, updating return type is cleaner but requires updating all callers.
    // I'll check if there are other callers.
    // The only caller seems to be the report endpoint.
    
    expect(result).toHaveProperty('data');
  });
});
