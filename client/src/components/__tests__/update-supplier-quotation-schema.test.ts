
import { updateSupplierQuotationSchema } from '../update-supplier-quotation-schema';


describe('updateSupplierQuotationSchema', () => {
  const validBaseItem = {
    quotationItemId: 1,
    unitPrice: "100.00",
    deliveryDays: "5",
    brand: "Brand",
    model: "Model",
    observations: "",
    isAvailable: true,
    unavailabilityReason: "",
    availableQuantity: "",
    confirmedUnit: "",
    quantityAdjustmentReason: "",
  };

  const createData = (discountPercentage?: string, discountValue?: string) => ({
    items: [
      {
        ...validBaseItem,
        discountPercentage,
        discountValue,
      }
    ],
    paymentTerms: "",
    deliveryTerms: "",
    warrantyPeriod: "",
    observations: "",
    discountType: "none",
    discountValue: "",
    includesFreight: false,
    freightValue: "",
  });

  it('should be valid when both discount fields are empty/undefined', () => {
    const data = createData(undefined, undefined);
    const result = updateSupplierQuotationSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should be valid when discountPercentage has value and discountValue is empty', () => {
    const data = createData("10", "");
    const result = updateSupplierQuotationSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should be valid when discountValue has value and discountPercentage is empty', () => {
    const data = createData("", "10");
    const result = updateSupplierQuotationSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should be valid when both discount fields are "0"', () => {
    const data = createData("0", "0");
    const result = updateSupplierQuotationSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should be valid when discountPercentage is "10" and discountValue is "0"', () => {
    const data = createData("10", "0");
    const result = updateSupplierQuotationSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should be valid when discountPercentage is "0" and discountValue is "10"', () => {
    const data = createData("0", "10");
    const result = updateSupplierQuotationSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should be INVALID when both discount fields have positive values', () => {
    const data = createData("10", "5");
    const result = updateSupplierQuotationSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Preencha apenas um tipo de desconto (percentual ou valor)");
    }
  });
});
