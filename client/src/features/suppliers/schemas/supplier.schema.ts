import { z } from "zod";

export const supplierSchema = z
  .object({
    name: z.string().min(1, "Nome é obrigatório"),
    type: z.number().default(0),
    cnpj: z.string().optional(),
    cpf: z.string().optional(),
    contact: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    website: z.string().optional(),
    address: z.string().optional(),
    paymentTerms: z.string().optional(),
    idSupplierERP: z
      .union([z.string(), z.number(), z.null()])
      .optional()
      .transform((val) => {
        if (val === null || val === undefined || val === "") return null;
        return typeof val === "string" ? parseInt(val, 10) : val;
      }),
  })
  .refine(
    (data) => {
      if (data.type === 0) {
        // Pessoa Jurídica: CNPJ, Contato, Email e Telefone obrigatórios
        return data.cnpj && data.contact && data.email && data.phone;
      } else if (data.type === 1) {
        // Online: Website obrigatório
        return !!data.website;
      } else if (data.type === 2) {
        // Pessoa Física: CPF, Contato, Email e Telefone obrigatórios
        return data.cpf && data.contact && data.email && data.phone;
      }
      return true;
    },
    {
      message:
        "Campos obrigatórios não preenchidos para o tipo de fornecedor selecionado",
    },
  );

export type SupplierFormData = z.infer<typeof supplierSchema>;
