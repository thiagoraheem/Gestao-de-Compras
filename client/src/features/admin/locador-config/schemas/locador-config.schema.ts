import { z } from "zod";

export const locadorConfigSchema = z.object({
  enabled: z.boolean(),
  sendEnabled: z.boolean().default(true),
  baseUrl: z.string().url(),
  endpoints: z.object({
    combo: z.object({
      fornecedor: z.string().min(1),
      centroCusto: z.string().min(1),
      planoContas: z.string().min(1),
      empresa: z.string().min(1),
      formaPagamento: z.string().min(1),
    }),
    post: z.object({
      enviarSolicitacao: z.string().optional(),
      recebimento: z.string().optional(),
    }),
  }),
  credentials: z.object({
    login: z.string().min(1),
    senha: z.string().optional(),
  }),
});

export type LocadorConfigFormData = z.infer<typeof locadorConfigSchema>;

export type ApiConfig = {
  enabled: boolean;
  sendEnabled: boolean;
  baseUrl: string;
  endpoints: LocadorConfigFormData["endpoints"];
  credentials: {
    login: string;
    senha: string;
  };
};
