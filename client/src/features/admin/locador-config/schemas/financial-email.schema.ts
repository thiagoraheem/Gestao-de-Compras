import { z } from "zod";

export const financialEmailConfigSchema = z.object({
  enabled: z.boolean(),
  emails: z.string(),
});

export type FinancialEmailConfigFormData = z.infer<typeof financialEmailConfigSchema>;

export type FinancialEmailApiConfig = {
  enabled: boolean;
  emails: string;
};
