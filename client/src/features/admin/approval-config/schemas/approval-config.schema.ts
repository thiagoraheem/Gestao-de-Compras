import { z } from "zod";

export const approvalConfigSchema = z.object({
  valueThreshold: z.string().min(1, "Valor limite é obrigatório"),
  reason: z.string().min(10, "Justificativa deve ter pelo menos 10 caracteres"),
});

export type ApprovalConfigFormData = z.infer<typeof approvalConfigSchema>;

export interface ApprovalConfiguration {
  id: number;
  valueThreshold: string;
  isActive: boolean;
  effectiveDate: string;
  createdBy: number;
  reason: string;
  createdAt: string;
  updatedAt: string;
  creator?: {
    firstName: string;
    lastName: string;
  };
}

export interface ConfigurationHistory {
  id: number;
  configurationId: number;
  oldValueThreshold: string;
  newValueThreshold: string;
  reason: string;
  changedBy: number;
  changedAt: string;
  changer?: {
    firstName: string;
    lastName: string;
  };
}
