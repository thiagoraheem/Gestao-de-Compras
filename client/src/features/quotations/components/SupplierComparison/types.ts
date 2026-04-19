export interface SupplierQuotationItem {
  id: number;
  quotationItemId: number;
  unitPrice: number;
  totalPrice: number;
  deliveryDays: number;
  brand?: string;
  model?: string;
  observations?: string;
  isAvailable?: boolean;
  unavailabilityReason?: string;
  // Campos de desconto
  discountPercentage?: number;
  discountValue?: number;
  originalTotalPrice?: number;
  discountedTotalPrice?: number;
  availableQuantity?: number;
  confirmedUnit?: string;
}

export interface SupplierQuotationData {
  id: number;
  supplier: {
    id: number;
    name: string;
    email: string;
  };
  status: string;
  receivedAt: string;
  totalValue: number;
  items: SupplierQuotationItem[];
  deliveryDays: number;
  warranty: string;
  warrantyPeriod: string;
  paymentTerms: string;
  observations: string;
  discountType?: string;
  discountValue?: number;
  includesFreight?: boolean;
  freightValue?: number;
}
