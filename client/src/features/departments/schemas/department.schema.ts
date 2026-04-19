import { z } from "zod";

export const departmentSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
});

export const costCenterSchema = z.object({
  code: z.string().min(1, "Código é obrigatório"),
  name: z.string().min(1, "Nome é obrigatório"),
  departmentId: z.number({
    required_error: "Departamento é obrigatório",
    invalid_type_error: "Selecione um departamento válido"
  }).min(1, "Departamento é obrigatório"),
  description: z.string().optional(),
});

export type DepartmentFormData = z.infer<typeof departmentSchema>;
export type CostCenterFormData = z.infer<typeof costCenterSchema>;
