import { insertSupplierQuotationItemSchema } from "../shared/schema.ts";

function tryParse(name, payload) {
  try {
    const result = insertSupplierQuotationItemSchema.parse(payload);
    console.log(`✓ ${name}: parsed OK`);
    console.log({ availableQuantity: result.availableQuantity });
  } catch (e) {
    console.error(`✗ ${name}: parse failed`);
    console.error(e?.errors || e);
    process.exitCode = 1;
  }
}

// Minimal valid payload with numeric availableQuantity
tryParse("numeric availableQuantity", {
  supplierQuotationId: 1,
  quotationItemId: 99,
  unitPrice: "10.00",
  totalPrice: "100.00",
  availableQuantity: 1,
});

// Payload with string availableQuantity
tryParse("string availableQuantity", {
  supplierQuotationId: 1,
  quotationItemId: 100,
  unitPrice: "5.00",
  totalPrice: "25.00",
  availableQuantity: "2",
});

// Payload with null availableQuantity
tryParse("null availableQuantity", {
  supplierQuotationId: 1,
  quotationItemId: 101,
  unitPrice: "1.00",
  totalPrice: "1.00",
  availableQuantity: null,
});