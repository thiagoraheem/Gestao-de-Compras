/// <reference types="jest" />
import { filterRequests, KanbanFilters } from "../kanban-filters";
import { PURCHASE_PHASES } from "../types";

// Mock data
const mockRequests = [
  {
    id: 1,
    requestNumber: "SOL-2026-001",
    urgency: "alto",
    department: { id: 10, name: "TI" },
    requester: { id: 100, name: "Alice" },
    chosenSupplier: { id: 50, name: "TechCorp" },
    currentPhase: PURCHASE_PHASES.PEDIDO_COMPRA,
    purchaseOrder: { orderNumber: "PO-2026-999" },
    createdAt: "2026-03-01T10:00:00Z",
  },
  {
    id: 2,
    requestNumber: "SOL-2026-002",
    urgency: "baixo",
    department: { id: 20, name: "RH" },
    requester: { id: 101, name: "Bob" },
    chosenSupplier: { id: 51, name: "OfficeSupply" },
    currentPhase: PURCHASE_PHASES.SOLICITACAO,
    purchaseOrder: null,
    createdAt: "2026-03-02T10:00:00Z",
  },
  {
    id: 3,
    requestNumber: "SOL-2026-003",
    urgency: "medio",
    department: { id: 10, name: "TI" },
    requester: { id: 100, name: "Alice" },
    chosenSupplier: null,
    currentPhase: PURCHASE_PHASES.COTACAO,
    purchaseOrder: null,
    createdAt: "2026-03-03T10:00:00Z",
  },
];

describe("filterRequests", () => {
  const defaultFilters: KanbanFilters = {
    department: "all",
    urgency: "all",
    requester: "all",
    supplier: "all",
  };

  test("should return all requests when no filters are applied", () => {
    const result = filterRequests(mockRequests, defaultFilters);
    expect(result).toHaveLength(3);
  });

  test("should filter by department", () => {
    const filters = { ...defaultFilters, department: "10" };
    const result = filterRequests(mockRequests, filters);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toContain(1);
    expect(result.map((r) => r.id)).toContain(3);
  });

  test("should filter by urgency", () => {
    const filters = { ...defaultFilters, urgency: "alto" };
    const result = filterRequests(mockRequests, filters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  test("should filter by requester", () => {
    const filters = { ...defaultFilters, requester: "101" };
    const result = filterRequests(mockRequests, filters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  test("should filter by supplier", () => {
    const filters = { ...defaultFilters, supplier: "50" };
    const result = filterRequests(mockRequests, filters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  test("should filter by purchase order number (exact match)", () => {
    const filters = { ...defaultFilters, purchaseOrder: "PO-2026-999" };
    const result = filterRequests(mockRequests, filters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  test("should filter by purchase order number (partial match)", () => {
    const filters = { ...defaultFilters, purchaseOrder: "999" };
    const result = filterRequests(mockRequests, filters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  test("should filter by request number (using PO filter)", () => {
    // This tests the feature where typing the Request Number also works
    const filters = { ...defaultFilters, purchaseOrder: "SOL-2026-002" };
    const result = filterRequests(mockRequests, filters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  test("should return empty array if no match found", () => {
    const filters = { ...defaultFilters, purchaseOrder: "NON-EXISTENT" };
    const result = filterRequests(mockRequests, filters);
    expect(result).toHaveLength(0);
  });

  test("should handle case insensitive search", () => {
    const filters = { ...defaultFilters, purchaseOrder: "po-2026" };
    const result = filterRequests(mockRequests, filters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });
  
  test("should combine filters", () => {
    const filters = { 
        ...defaultFilters, 
        department: "10",
        purchaseOrder: "SOL" 
    };
    const result = filterRequests(mockRequests, filters);
    expect(result).toHaveLength(2); // ID 1 and 3 are TI and have SOL in requestNumber
  });
});
