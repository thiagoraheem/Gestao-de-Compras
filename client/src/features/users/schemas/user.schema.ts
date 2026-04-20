import { z } from "zod";

export const userSchema = z.object({
  username: z.string().min(1, "Username é obrigatório"),
  email: z.string().email("Email inválido"),
  password: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  departmentId: z.number().nullable().optional(),
  isBuyer: z.boolean().default(false),
  isApproverA1: z.boolean().default(false),
  isApproverA2: z.boolean().default(false),
  isAdmin: z.boolean().default(false),
  isManager: z.boolean().default(false),
  isReceiver: z.boolean().default(false),
  isCEO: z.boolean().default(false),
  isDirector: z.boolean().default(false),
  isActive: z.boolean().default(true),
}).refine((data) => {
  // Password is required only when creating a new user
  if (!data.password || data.password === "") {
    return true; // Password is optional for editing
  }
  return data.password.length >= 6;
}, {
  message: "Senha deve ter pelo menos 6 caracteres",
  path: ["password"],
}).refine((data) => {
  // CEO and Director validation: CEO cannot be Director and vice versa
  if (data.isCEO && data.isDirector) {
    return false;
  }
  return true;
}, {
  message: "Um usuário não pode ser CEO e Diretor ao mesmo tempo",
  path: ["isCEO"],
});

export const setPasswordSchema = z.object({
  password: z.string()
    .min(8, "A senha deve ter no mínimo 8 caracteres")
    .regex(/[A-Z]/, "A senha deve conter pelo menos uma letra maiúscula")
    .regex(/[a-z]/, "A senha deve conter pelo menos uma letra minúscula")
    .regex(/[0-9]/, "A senha deve conter pelo menos um número")
    .regex(/[!@#$%^&*(),.?":{}|<>]/, "A senha deve conter pelo menos um caractere especial"),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não conferem",
  path: ["confirmPassword"],
});

export type SetPasswordFormData = z.infer<typeof setPasswordSchema>;
export type UserFormData = z.infer<typeof userSchema>;
