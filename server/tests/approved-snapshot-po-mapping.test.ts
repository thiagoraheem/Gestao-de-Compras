import { buildPurchaseOrderItemsFromApprovedSnapshot } from "../routes/approval-rules";

describe("buildPurchaseOrderItemsFromApprovedSnapshot", () => {
  it("mapeia itens aprovados para itens do PO usando supplierQuotationItemId → quotationItemId (suporta divisão de item)", () => {
    const quotationItems = [
      { id: 11, itemCode: "A-001", description: "Item A", unit: "UN" },
      { id: 12, itemCode: "B-001", description: "Item B", unit: "UN" },
    ];

    const supplierQuotationItems = [
      { id: 101, quotationItemId: 11, confirmedUnit: "UN" },
      { id: 102, quotationItemId: 12, confirmedUnit: "UN" },
    ];

    const approvedItems = [
      {
        id: 1,
        quotationId: 99,
        supplierQuotationItemId: 101,
        purchaseRequestItemId: 5,
        approvedQuantity: "2",
        unitPrice: "10.0000",
        totalPrice: "20.0000",
      },
      {
        id: 2,
        quotationId: 99,
        supplierQuotationItemId: 102,
        purchaseRequestItemId: 5,
        approvedQuantity: "3",
        unitPrice: "5.0000",
        totalPrice: "15.0000",
      },
    ];

    const result = buildPurchaseOrderItemsFromApprovedSnapshot({
      approvedItems,
      supplierQuotationItems,
      quotationItems,
    });

    expect(result.items).toHaveLength(2);
    expect(result.items.map((i) => i.description)).toEqual(["Item A", "Item B"]);
    expect(result.items.map((i) => i.itemCode)).toEqual(["A-001", "B-001"]);
    expect(result.itemsTotal).toBeCloseTo(35, 6);
  });
});
