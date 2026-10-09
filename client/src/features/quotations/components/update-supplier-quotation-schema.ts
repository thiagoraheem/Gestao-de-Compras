import { z } from "zod";

const SUPPORTED_CURRENCIES = ['BRL', 'USD', 'EUR', 'GBP'] as const;
type CurrencyCode = typeof SUPPORTED_CURRENCIES[number];

function normalizeCurrencyCode(code: string | null | undefined): CurrencyCode {
  if (!code) return 'BRL';
  const upper = code.toUpperCase().trim();
  if ((SUPPORTED_CURRENCIES as readonly string[]).includes(upper)) {
    return upper as CurrencyCode;
  }
  return 'BRL';
}

export const updateSupplierQuotationSchema = z.object({
  items: z.array(
    z.object({
      quotationItemId: z.number(),
      unitPrice: z.string().optional(),
      deliveryDays: z.string().optional(),
      brand: z.string().optional(),
      model: z.string().optional(),
      observations: z.string().optional(),
      discountType: z.enum(["none", "percentage", "fixed"]).default("percentage"),
      discountValue: z.string().optional(),
      discountPercentage: z.string().optional(),
      isAvailable: z.boolean().default(true),
      unavailabilityReason: z.string().optional(),
      availableQuantity: z.string().optional(),
      confirmedUnit: z.string().optional(),
      quantityAdjustmentReason: z.string().optional(),
      description: z.string().optional(),
      customDescription: z.string().optional(),
      itemCode: z.string().optional(),
      productCode: z.string().optional(),
      unit: z.string().optional(),
    })
    .refine((data) => {
      if (data.isAvailable) {
        return data.unitPrice && data.unitPrice.trim().length > 0;
      }
      return true;
    }, {
      message: "Preço unitário é obrigatório para produtos disponíveis",
      path: ["unitPrice"],
    })
    .refine((data) => {
      if (!data.isAvailable) {
        return data.unavailabilityReason && data.unavailabilityReason.trim().length > 0;
      }
      return true;
    }, {
      message: "Motivo da indisponibilidade é obrigatório para produtos indisponíveis",
      path: ["unavailabilityReason"],
    })
    .refine((data) => {
      if (data.availableQuantity && data.availableQuantity.trim().length > 0) {
        const availableQty = parseFloat(data.availableQuantity);
        if (!isNaN(availableQty) && availableQty > 0) {
          return true;
        }
      }
      return true;
    }, {
      message: "Quantidade disponível deve ser um número válido",
      path: ["availableQuantity"],
    })
    .refine((data) => {
      const filled = (data.discountValue ?? "").trim().length > 0 && parseFloat(data.discountValue || "0") > 0;
      const typeNeedsValue = data.discountType === "percentage" || data.discountType === "fixed";
      if (filled && !typeNeedsValue) return false;
      return true;
    }, {
      message: "Informe o tipo de desconto (% ou $)",
      path: ["discountType"],
    })
  ),
  paymentTerms: z.string().optional(),
  deliveryTerms: z.string().optional(),
  warrantyPeriod: z.string().optional(),
  observations: z.string().optional(),
  discountType: z.enum(["none", "percentage", "fixed"]).default("none"),
  discountValue: z.string().optional(),
  includesFreight: z.boolean().default(false),
  freightValue: z.string().optional(),
  currencyCode: z
    .enum(SUPPORTED_CURRENCIES as unknown as [string, ...string[]])
    .optional()
    .default('BRL')
    .transform((val) => normalizeCurrencyCode(val)),
  exchangeRate: z
    .union([z.string(), z.number()])
    .optional()
    .refine(
      (v) => v === undefined || v === null || v === '' || Number(v) > 0,
      'Taxa de câmbio deve ser maior que zero'
    ),
}).refine(
  (data) => {
    const code = (data.currencyCode || 'BRL').toUpperCase();
    if (code !== 'BRL') {
      const rate = data.exchangeRate ? Number(data.exchangeRate) : 0;
      return rate > 0;
    }
    return true;
  },
  {
    message: 'Para moedas diferentes de BRL, a taxa de câmbio é obrigatória e deve ser maior que zero',
    path: ['exchangeRate'],
  }
);

export type UpdateSupplierQuotationData = z.infer<
  typeof updateSupplierQuotationSchema
>;
