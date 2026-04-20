import { z } from "zod";

export const updateSupplierQuotationSchema = z.object({
  items: z.array(
    z.object({
      quotationItemId: z.number(),
      unitPrice: z.string().optional(),
      deliveryDays: z.string().optional(),
      brand: z.string().optional(),
      model: z.string().optional(),
      observations: z.string().optional(),
      discountPercentage: z.string().optional(),
      discountValue: z.string().optional(),
      isAvailable: z.boolean().default(true),
      unavailabilityReason: z.string().optional(),
      availableQuantity: z.string().optional(),
      confirmedUnit: z.string().optional(),
      quantityAdjustmentReason: z.string().optional(),
    })
    .refine((data) => {
      // Se o produto estiver disponível, o preço unitário é obrigatório
      if (data.isAvailable) {
        return data.unitPrice && data.unitPrice.trim().length > 0;
      }
      return true; // Para produtos indisponíveis, não validamos o preço
    }, {
      message: "Preço unitário é obrigatório para produtos disponíveis",
      path: ["unitPrice"],
    })
    .refine((data) => {
      // Se o produto estiver indisponível, o motivo da indisponibilidade é obrigatório
      if (!data.isAvailable) {
        return data.unavailabilityReason && data.unavailabilityReason.trim().length > 0;
      }
      return true; // Para produtos disponíveis, não validamos o motivo
    }, {
      message: "Motivo da indisponibilidade é obrigatório para produtos indisponíveis",
      path: ["unavailabilityReason"],
    })
    .refine((data) => {
      // Se quantidade disponível for diferente da solicitada, motivo é obrigatório
      if (data.availableQuantity && data.availableQuantity.trim().length > 0) {
        const availableQty = parseFloat(data.availableQuantity);
        if (!isNaN(availableQty) && availableQty > 0) {
          return true; // Quantidade válida
        }
      }
      return true; // Sem quantidade disponível especificada
    }, {
      message: "Quantidade disponível deve ser um número válido",
      path: ["availableQuantity"],
    })
    .refine((data) => {
      // Somente um tipo de desconto pode ser preenchido por item (exceto se forem zero)
      const hasPercentage = data.discountPercentage && parseFloat(data.discountPercentage) > 0;
      const hasValue = data.discountValue && parseFloat(data.discountValue) > 0;
      return !(hasPercentage && hasValue);
    }, {
      message: "Preencha apenas um tipo de desconto (percentual ou valor)",
      path: ["discountPercentage"],
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
});

export type UpdateSupplierQuotationData = z.infer<
  typeof updateSupplierQuotationSchema
>;
