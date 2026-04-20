import { z } from "zod";

export const deliveryLocationSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  address: z.string().min(1, "Endereço é obrigatório"),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  observations: z.string().optional(),
  active: z.boolean().default(true),
});

export type DeliveryLocationFormData = z.infer<typeof deliveryLocationSchema>;
