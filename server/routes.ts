import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  sendRFQToSuppliers,
  notifyNewRequest,
  notifyApprovalA1,
  notifyApprovalA2,
  notifyRejection,
  testEmailConfiguration,
} from "./email-service";
import { invalidateCache } from "./cache";
import { PDFService } from "./pdf-service";
import bcrypt from "bcryptjs";
import {
  insertUserSchema,
  insertCompanySchema,
  insertDepartmentSchema,
  insertCostCenterSchema,
  insertSupplierSchema,
  updateSupplierSchema,
  insertDeliveryLocationSchema,
  insertPurchaseRequestSchema,
  insertPurchaseRequestItemSchema,
  insertQuotationSchema,
  insertQuotationItemSchema,
  insertSupplierQuotationSchema,
  insertSupplierQuotationItemSchema,
  insertPurchaseOrderSchema,
  insertPurchaseOrderItemSchema,
} from "@shared/schema";
import { z } from "zod";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import path from "path";
import fs from "fs";
import mime from "mime-types";
import { fileURLToPath } from "url";
// Import modular routes
import { registerAllRoutes } from "./routes/index";
import {
  isAuthenticated,
  canApproveRequest,
  isAdmin,
  isAdminOrBuyer,
} from "./routes/middleware";
import { quotationUpload } from "./routes/upload-config";
import { QuantityValidationMiddleware } from "./middleware/quantity-validation";
import { quotationSyncService } from './services/quotation-sync';
import { quotationVersionService } from './services/quotation-versioning';
import { notificationService } from './services/notification-service';

// ES modules compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Multer configuration now handled in modular routes

// Session type declaration
declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

// Middlewares now handled in modular routes
// Removed duplicate middleware definitions

// All middleware functions have been moved to ./routes/middleware.ts
// This includes: isAuthenticated, canApproveRequest, isAdmin, isAdminOrBuyer

export async function registerRoutes(app: Express): Promise<Server> {
  // Validate required environment variables
  if (!process.env.SESSION_SECRET) {
    throw new Error(
      "SESSION_SECRET environment variable is required for security. Please set a strong, random secret key.",
    );
  }

  if (process.env.SESSION_SECRET.length < 32) {
    throw new Error(
      "SESSION_SECRET must be at least 32 characters long for security.",
    );
  }

  // Configure PostgreSQL session store
  const PgSession = connectPgSimple(session);

  // Configure session with PostgreSQL store
  app.use(
    session({
      store: new PgSession({
        pool: pool,
        tableName: "sessions",
        createTableIfMissing: false,
      }),
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      name: "sessionId", // Custom session name
      cookie: {
        secure: false, // Set to true in production with HTTPS
        httpOnly: true,
        maxAge: 8 * 60 * 60 * 1000, // 8 hours
        sameSite: "lax", // Protect against CSRF
      },
      rolling: true, // Reset expiration on activity
    }),
  );

  // Multer configuration removed - was specific to purchase request attachments
  // Supplier uploads now use a different approach

  // Initialize default data
  await storage.initializeDefaultData();

  // Register modular routes (includes authentication, etc.)
  registerAllRoutes(app);

  // Legacy routes - TODO: Move these to modular structure
  // Keeping existing routes for now to maintain functionality

  // Note: Authentication routes have been moved to ./routes/auth.ts
  // All authentication endpoints (/api/auth/*) are now handled by the modular auth router

  // app.get("/api/auth/check") - moved to ./routes/auth.ts

  // Password recovery endpoints moved to ./routes/auth.ts

  // Companies routes
  app.get("/api/companies", isAuthenticated, async (req, res) => {
    try {
      const companies = await storage.getAllCompanies();
      res.json(companies);
    } catch (error) {
      console.error("Error fetching companies:", error);
      res.status(500).json({ message: "Failed to fetch companies" });
    }
  });

  app.get("/api/companies/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const company = await storage.getCompanyById(id);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      res.json(company);
    } catch (error) {
      console.error("Error fetching company:", error);
      res.status(500).json({ message: "Failed to fetch company" });
    }
  });

  app.post("/api/companies", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const companyData = insertCompanySchema.parse(req.body);

      // Validar CNPJ se fornecido
      if (companyData.cnpj) {
        const { validateCNPJ } = await import("./cnpj-validator");
        if (!validateCNPJ(companyData.cnpj)) {
          return res.status(400).json({ message: "CNPJ inválido" });
        }
      }

      const company = await storage.createCompany(companyData);
      res.status(201).json(company);
    } catch (error) {
      console.error("Error creating company:", error);
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "23505"
      ) {
        res
          .status(400)
          .json({ message: "CNPJ já está sendo usado por outra empresa" });
      } else {
        res.status(400).json({ message: "Dados da empresa inválidos" });
      }
    }
  });

  app.put("/api/companies/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const companyData = insertCompanySchema.partial().parse(req.body);

      // Validar CNPJ se fornecido
      if (companyData.cnpj) {
        const { validateCNPJ } = await import("./cnpj-validator");
        if (!validateCNPJ(companyData.cnpj)) {
          return res.status(400).json({ message: "CNPJ inválido" });
        }
      }

      const company = await storage.updateCompany(id, companyData);
      res.json(company);
    } catch (error) {
      console.error("Error updating company:", error);
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "23505"
      ) {
        res
          .status(400)
          .json({ message: "CNPJ já está sendo usado por outra empresa" });
      } else {
        res.status(400).json({ message: "Dados da empresa inválidos" });
      }
    }
  });

  app.delete(
    "/api/companies/:id",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        await storage.deleteCompany(id);
        res.json({ message: "Company deactivated successfully" });
      } catch (error) {
        console.error("Error deleting company:", error);
        res.status(500).json({ message: "Failed to delete company" });
      }
    },
  );

  // Upload logo for company (base64 version)
  app.post(
    "/api/companies/:id/upload-logo",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const companyId = parseInt(req.params.id);
        const { logoBase64 } = req.body;

        if (!logoBase64) {
          return res
            .status(400)
            .json({ message: "Nenhum arquivo de logo foi enviado" });
        }

        // Validar formato base64
        const base64Regex = /^data:image\/(jpeg|jpg|png);base64,/;
        if (!base64Regex.test(logoBase64)) {
          return res
            .status(400)
            .json({
              message:
                "Formato de logo inválido. Apenas PNG, JPG, JPEG são aceitos.",
            });
        }

        // Verificar tamanho (limite de 5MB)
        const sizeInBytes = logoBase64.length * 0.75; // base64 é ~33% maior que arquivo original
        if (sizeInBytes > 5 * 1024 * 1024) {
          return res
            .status(400)
            .json({ message: "Logo muito grande. Tamanho máximo: 5MB" });
        }

        // Verificar se a empresa existe
        const company = await storage.getCompanyById(companyId);
        if (!company) {
          return res.status(404).json({ message: "Empresa não encontrada" });
        }

        // Atualizar a empresa com o logo base64
        const updatedCompany = await storage.updateCompany(companyId, {
          logoBase64,
        });

        res.json({
          message: "Logo enviado com sucesso",
          logoBase64: logoBase64,
          company: updatedCompany,
        });
      } catch (error) {
        console.error("Error uploading company logo:", error);
        res.status(500).json({ message: "Erro ao enviar logo da empresa" });
      }
    },
  );

  // Note: Logo serving route removed - logos now stored as base64 in database

  // Users routes
  app.get("/api/users", isAuthenticated, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/users", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      // Get current user to check if they can set admin permissions
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser?.isAdmin) {
        return res
          .status(403)
          .json({ message: "Apenas administradores podem criar usuários" });
      }

      // Only admins can set admin permissions
      if (userData.isAdmin && !currentUser.isAdmin) {
        return res
          .status(403)
          .json({
            message:
              "Apenas administradores podem conceder permissões de administrador",
          });
      }

      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
      });

      // Set user cost centers if provided
      if (req.body.costCenterIds && Array.isArray(req.body.costCenterIds)) {
        await storage.setUserCostCenters(user.id, req.body.costCenterIds);
      }

      res.status(201).json(user);
    } catch (error) {
      console.error("Error creating user:", error);

      // Check if it's a unique constraint violation for email
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "23505" &&
        "constraint" in error &&
        error.constraint === "users_email_unique"
      ) {
        res
          .status(400)
          .json({
            message: "Este e-mail já está sendo usado por outro usuário",
          });
      } else {
        res.status(400).json({ message: "Dados do usuário inválidos" });
      }
    }
  });

  app.put("/api/users/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userData = insertUserSchema.partial().parse(req.body);

      // Get current user to check if they can set admin permissions
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser?.isAdmin) {
        return res
          .status(403)
          .json({ message: "Apenas administradores podem editar usuários" });
      }

      // Get the user being updated
      const userBeingUpdated = await storage.getUser(id);
      if (!userBeingUpdated) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      // Only admins can change admin permissions
      if (
        "isAdmin" in userData &&
        userData.isAdmin !== userBeingUpdated.isAdmin
      ) {
        if (!currentUser.isAdmin) {
          return res
            .status(403)
            .json({
              message:
                "Apenas administradores podem alterar permissões de administrador",
            });
        }
      }

      // Prevent user from removing their own admin privileges if they are the only admin
      if (id === currentUser.id && userData.isAdmin === false) {
        const allUsers = await storage.getAllUsers();
        const adminCount = allUsers.filter(
          (u) => u.isAdmin && u.id !== id,
        ).length;
        if (adminCount === 0) {
          return res
            .status(400)
            .json({
              message:
                "Não é possível remover sua própria permissão de administrador. Deve existir pelo menos um administrador no sistema.",
            });
        }
      }

      // If password is provided, hash it
      if (userData.password) {
        userData.password = await bcrypt.hash(userData.password, 10);
      }

      const user = await storage.updateUser(id, userData);

      // Update user cost centers if provided
      if (req.body.costCenterIds !== undefined) {
        await storage.setUserCostCenters(id, req.body.costCenterIds);
      }

      res.json(user);
    } catch (error) {
      console.error("Error updating user:", error);

      // Check if it's a unique constraint violation for email
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "23505" &&
        "constraint" in error &&
        error.constraint === "users_email_unique"
      ) {
        res
          .status(400)
          .json({
            message: "Este e-mail já está sendo usado por outro usuário",
          });
      } else {
        res.status(400).json({ message: "Dados do usuário inválidos" });
      }
    }
  });

  // Check if user can be deleted
  app.get(
    "/api/users/:id/can-delete",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const result = await storage.checkUserCanBeDeleted(id);
        res.json(result);
      } catch (error) {
        console.error("Error checking if user can be deleted:", error);
        res
          .status(500)
          .json({ message: "Failed to check user deletion eligibility" });
      }
    },
  );

  // Delete user
  app.delete("/api/users/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      // Check if user can be deleted first
      const canDeleteCheck = await storage.checkUserCanBeDeleted(id);
      if (!canDeleteCheck.canDelete) {
        return res.status(400).json({
          message: canDeleteCheck.reason,
          associatedRequests: canDeleteCheck.associatedRequests,
        });
      }

      await storage.deleteUser(id);
      res.json({ message: "Usuário excluído com sucesso" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Update user profile (without password)
  app.patch("/api/users/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const sessionUserId = (req.session as any).userId;

      // Users can only update their own profile
      if (userId !== sessionUserId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { firstName, lastName, email } = req.body;
      const user = await storage.updateUser(userId, {
        firstName,
        lastName,
        email,
      });
      res.json(user);
    } catch (error) {
      console.error("Error updating profile:", error);

      // Check if it's a unique constraint violation for email
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "23505" &&
        "constraint" in error &&
        error.constraint === "users_email_unique"
      ) {
        res
          .status(400)
          .json({
            message: "Este e-mail já está sendo usado por outro usuário",
          });
      } else {
        res.status(400).json({ message: "Falha ao atualizar perfil" });
      }
    }
  });

  // Change password
  app.post(
    "/api/users/:id/change-password",
    isAuthenticated,
    async (req, res) => {
      try {
        const userId = parseInt(req.params.id);
        const sessionUserId = (req.session as any).userId;

        // Users can only change their own password
        if (userId !== sessionUserId) {
          return res.status(403).json({ message: "Forbidden" });
        }

        const { currentPassword, newPassword } = req.body;

        // Get user to verify current password
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        // Verify current password
        const isValidPassword = await bcrypt.compare(
          currentPassword,
          user.password,
        );
        if (!isValidPassword) {
          return res.status(400).json({ message: "Senha atual incorreta" });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await storage.updateUser(userId, { password: hashedPassword });

        res.json({ message: "Password changed successfully" });
      } catch (error) {
        console.error("Error changing password:", error);
        res.status(400).json({ message: "Failed to change password" });
      }
    },
  );

  app.get("/api/users/:id/cost-centers", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const costCenterIds = await storage.getUserCostCenters(id);
      res.json(costCenterIds);
    } catch (error) {
      console.error("Error fetching user cost centers:", error);
      res.status(500).json({ message: "Failed to fetch user cost centers" });
    }
  });

  // Departments routes
  app.get("/api/departments", isAuthenticated, async (req, res) => {
    try {
      const companyId = req.query.companyId
        ? parseInt(req.query.companyId as string)
        : undefined;
      const departments = await storage.getAllDepartments(companyId);
      res.json(departments);
    } catch (error) {
      console.error("Error fetching departments:", error);
      res.status(500).json({ message: "Failed to fetch departments" });
    }
  });

  app.post("/api/departments", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const departmentData = insertDepartmentSchema.parse(req.body);
      const department = await storage.createDepartment(departmentData);
      res.status(201).json(department);
    } catch (error) {
      console.error("Error creating department:", error);
      res.status(400).json({ message: "Invalid department data" });
    }
  });

  app.put(
    "/api/departments/:id",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const departmentData = insertDepartmentSchema.partial().parse(req.body);
        const department = await storage.updateDepartment(id, departmentData);
        res.json(department);
      } catch (error) {
        console.error("Error updating department:", error);
        res.status(400).json({ message: "Failed to update department" });
      }
    },
  );

  app.get(
    "/api/departments/:id/can-delete",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const result = await storage.checkDepartmentCanBeDeleted(id);
        res.json(result);
      } catch (error) {
        console.error("Error checking department can be deleted:", error);
        res
          .status(500)
          .json({
            message: "Erro ao verificar se departamento pode ser excluído",
          });
      }
    },
  );

  app.delete(
    "/api/departments/:id",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);

        // First check if it can be deleted
        const canDeleteResult = await storage.checkDepartmentCanBeDeleted(id);
        if (!canDeleteResult.canDelete) {
          return res.status(400).json({ message: canDeleteResult.reason });
        }

        await storage.deleteDepartment(id);
        res.json({ message: "Departamento excluído com sucesso" });
      } catch (error) {
        console.error("Error deleting department:", error);
        res.status(500).json({ message: "Erro ao excluir departamento" });
      }
    },
  );

  // Cost Centers routes
  app.get("/api/cost-centers", isAuthenticated, async (req, res) => {
    try {
      const costCenters = await storage.getAllCostCenters();
      res.json(costCenters);
    } catch (error) {
      console.error("Error fetching cost centers:", error);
      res.status(500).json({ message: "Failed to fetch cost centers" });
    }
  });

  app.get(
    "/api/cost-centers/department/:departmentId",
    isAuthenticated,
    async (req, res) => {
      try {
        const departmentId = parseInt(req.params.departmentId);
        const costCenters =
          await storage.getCostCentersByDepartment(departmentId);
        res.json(costCenters);
      } catch (error) {
        console.error("Error fetching cost centers by department:", error);
        res.status(500).json({ message: "Failed to fetch cost centers" });
      }
    },
  );

  app.post("/api/cost-centers", isAuthenticated, isAdmin, async (req, res) => {
    try {
      // Validate required fields before parsing
      if (!req.body.code || !req.body.name || !req.body.departmentId) {
        return res.status(400).json({
          message: "Campos obrigatórios: código, nome e departamento",
        });
      }

      const costCenterData = insertCostCenterSchema.parse(req.body);

      const costCenter = await storage.createCostCenter(costCenterData);
      res.status(201).json(costCenter);
    } catch (error) {
      console.error("Error creating cost center:", error);

      // Handle database constraint errors
      if (error && typeof error === "object" && "code" in error) {
        if (error.code === "23505") {
          return res
            .status(400)
            .json({ message: "Código do centro de custo já existe" });
        }
        if (error.code === "23503") {
          return res.status(400).json({ message: "Departamento inválido" });
        }
      }

      // Handle Zod validation errors
      if (error && typeof error === "object" && "issues" in error) {
        const zodError = error as any;
        const firstIssue = zodError.issues?.[0];
        if (firstIssue) {
          return res.status(400).json({
            message: `Erro de validação: ${firstIssue.message}`,
          });
        }
      }

      // Handle generic parsing errors
      if (error instanceof Error && error.message.includes("parse")) {
        return res.status(400).json({
          message: "Dados inválidos. Verifique os campos obrigatórios.",
        });
      }

      // Generic error fallback
      res.status(400).json({
        message:
          error instanceof Error
            ? error.message
            : "Erro ao criar centro de custo",
      });
    }
  });

  app.put(
    "/api/cost-centers/:id",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const costCenterData = insertCostCenterSchema.partial().parse(req.body);
        const costCenter = await storage.updateCostCenter(id, costCenterData);
        res.json(costCenter);
      } catch (error) {
        console.error("Error updating cost center:", error);
        res.status(400).json({ message: "Failed to update cost center" });
      }
    },
  );

  app.get(
    "/api/cost-centers/:id/can-delete",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const result = await storage.checkCostCenterCanBeDeleted(id);
        res.json(result);
      } catch (error) {
        console.error("Error checking cost center can be deleted:", error);
        res
          .status(500)
          .json({
            message: "Erro ao verificar se centro de custo pode ser excluído",
          });
      }
    },
  );

  app.delete(
    "/api/cost-centers/:id",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);

        // First check if it can be deleted
        const canDeleteResult = await storage.checkCostCenterCanBeDeleted(id);
        if (!canDeleteResult.canDelete) {
          return res.status(400).json({ message: canDeleteResult.reason });
        }

        await storage.deleteCostCenter(id);
        res.json({ message: "Centro de custo excluído com sucesso" });
      } catch (error) {
        console.error("Error deleting cost center:", error);
        res.status(500).json({ message: "Erro ao excluir centro de custo" });
      }
    },
  );

  // Suppliers routes
  app.get("/api/suppliers", isAuthenticated, async (req, res) => {
    try {
      const companyId = req.query.companyId
        ? parseInt(req.query.companyId as string)
        : undefined;
      const suppliers = await storage.getAllSuppliers(companyId);
      res.json(suppliers);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      res.status(500).json({ message: "Failed to fetch suppliers" });
    }
  });

  app.post(
    "/api/suppliers",
    isAuthenticated,
    isAdminOrBuyer,
    async (req, res) => {
      try {
        const supplierData = insertSupplierSchema.parse(req.body);
        const supplier = await storage.createSupplier(supplierData);
        res.status(201).json(supplier);
      } catch (error) {
        console.error("Error creating supplier:", error);
        res.status(400).json({ message: "Invalid supplier data" });
      }
    },
  );

  app.put(
    "/api/suppliers/:id",
    isAuthenticated,
    isAdminOrBuyer,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const supplierData = updateSupplierSchema.parse(req.body);

        // Validar CNPJ se fornecido
        if (supplierData.cnpj) {
          const { validateCNPJ } = await import("./cnpj-validator");
          if (!validateCNPJ(supplierData.cnpj)) {
            return res.status(400).json({ message: "CNPJ inválido" });
          }
        }

        const supplier = await storage.updateSupplier(id, supplierData);
        res.json(supplier);
      } catch (error) {
        console.error("Error updating supplier:", error);
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "23505"
        ) {
          res
            .status(400)
            .json({ message: "CNPJ já está sendo usado por outro fornecedor" });
        } else {
          res.status(400).json({ message: "Erro ao atualizar fornecedor" });
        }
      }
    },
  );

  // Payment Methods routes
  app.get("/api/payment-methods", isAuthenticated, async (req, res) => {
    try {
      const paymentMethods = await storage.getAllPaymentMethods();
      res.json(paymentMethods);
    } catch (error) {
      console.error("Error fetching payment methods:", error);
      res.status(500).json({ message: "Failed to fetch payment methods" });
    }
  });

  // Delivery Locations routes
  app.get("/api/delivery-locations", isAuthenticated, async (req, res) => {
    try {
      const deliveryLocations = await storage.getAllDeliveryLocations();
      res.json(deliveryLocations);
    } catch (error) {
      console.error("Error fetching delivery locations:", error);
      res.status(500).json({ message: "Failed to fetch delivery locations" });
    }
  });

  app.get("/api/delivery-locations/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deliveryLocation = await storage.getDeliveryLocationById(id);
      if (!deliveryLocation) {
        return res.status(404).json({ message: "Delivery location not found" });
      }
      res.json(deliveryLocation);
    } catch (error) {
      console.error("Error fetching delivery location:", error);
      res.status(500).json({ message: "Failed to fetch delivery location" });
    }
  });

  app.post(
    "/api/delivery-locations",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const deliveryLocationData = insertDeliveryLocationSchema.parse(
          req.body,
        );
        const deliveryLocation =
          await storage.createDeliveryLocation(deliveryLocationData);
        res.status(201).json(deliveryLocation);
      } catch (error) {
        console.error("Error creating delivery location:", error);

        // Check for specific database constraint errors
        if (error instanceof Error) {
          if (
            error.message.includes("unique constraint") ||
            error.message.includes("duplicate key")
          ) {
            return res
              .status(400)
              .json({ message: "Já existe um local de entrega com este nome" });
          }
          if (error.message.includes("not null constraint")) {
            return res
              .status(400)
              .json({
                message: "Todos os campos obrigatórios devem ser preenchidos",
              });
          }
        }

        res.status(400).json({ message: "Erro ao criar local de entrega" });
      }
    },
  );

  app.put(
    "/api/delivery-locations/:id",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const deliveryLocationData = insertDeliveryLocationSchema
          .partial()
          .parse(req.body);
        const deliveryLocation = await storage.updateDeliveryLocation(
          id,
          deliveryLocationData,
        );
        res.json(deliveryLocation);
      } catch (error) {
        console.error("Error updating delivery location:", error);

        // Check for specific database constraint errors
        if (error instanceof Error) {
          if (
            error.message.includes("unique constraint") ||
            error.message.includes("duplicate key")
          ) {
            return res
              .status(400)
              .json({ message: "Já existe um local de entrega com este nome" });
          }
          if (error.message.includes("not null constraint")) {
            return res
              .status(400)
              .json({
                message: "Todos os campos obrigatórios devem ser preenchidos",
              });
          }
        }

        res.status(400).json({ message: "Erro ao atualizar local de entrega" });
      }
    },
  );

  app.delete(
    "/api/delivery-locations/:id",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        await storage.deleteDeliveryLocation(id);
        res.json({ message: "Delivery location deactivated successfully" });
      } catch (error) {
        console.error("Error deactivating delivery location:", error);
        res
          .status(500)
          .json({ message: "Failed to deactivate delivery location" });
      }
    },
  );

  // Purchase Requests routes
  app.get("/api/purchase-requests", isAuthenticated, async (req, res) => {
    try {
      const companyId = req.query.companyId
        ? parseInt(req.query.companyId as string)
        : undefined;
      const requests = await storage.getAllPurchaseRequests(companyId);

      res.json(requests);
    } catch (error) {
      console.error("Error fetching purchase requests:", error);
      res.status(500).json({ message: "Failed to fetch purchase requests" });
    }
  });

  app.get(
    "/api/purchase-requests/phase/:phase",
    isAuthenticated,
    async (req, res) => {
      try {
        const phase = req.params.phase;
        const requests = await storage.getPurchaseRequestsByPhase(phase);
        res.json(requests);
      } catch (error) {
        console.error("Error fetching purchase requests by phase:", error);
        res.status(500).json({ message: "Failed to fetch purchase requests" });
      }
    },
  );

  app.get("/api/purchase-requests/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const request = await storage.getPurchaseRequestById(id);
      if (!request) {
        return res.status(404).json({ message: "Purchase request not found" });
      }

      res.json(request);
    } catch (error) {
      console.error("Error fetching purchase request:", error);
      res.status(500).json({ message: "Failed to fetch purchase request" });
    }
  });

  app.post("/api/purchase-requests", isAuthenticated, async (req, res) => {
    try {
      const { items, ...requestData } = req.body;

      // Validate request data
      const validatedRequestData =
        insertPurchaseRequestSchema.parse(requestData);

      // Validate items if provided
      let validatedItems: (typeof insertPurchaseRequestItemSchema._type)[] = [];
      if (items && Array.isArray(items)) {
        validatedItems = items.map((item: any) => {
          const processedItem = insertPurchaseRequestItemSchema.parse({
            ...item,
            purchaseRequestId: 0,
            productCode: item.productCode || null, // Explicitly include productCode
            description: item.description || "",
            unit: item.unit || "",
            requestedQuantity: item.requestedQuantity || 0,
            technicalSpecification: item.technicalSpecification || null,
            approvedQuantity: undefined,
          });
          return processedItem;
        });
      }

      // Create the request
      const request = await storage.createPurchaseRequest(validatedRequestData);

      // Create items if any
      if (validatedItems.length > 0) {
        const itemsWithRequestId = validatedItems.map((item) => ({
          ...item,
          purchaseRequestId: request.id,
        }));

        // Criar itens individualmente para evitar problemas de validação
        for (const item of itemsWithRequestId) {
          await storage.createPurchaseRequestItem(item);
        }
      }

      // Send notification to buyers about the new request
      notifyNewRequest(request).catch((error) => {
        console.error("Erro ao enviar notificação de nova solicitação:", error);
      });

      // Invalidate cache for purchase requests
      invalidateCache(["/api/purchase-requests"]);

      res.status(201).json(request);
    } catch (error) {
      console.error("Error creating purchase request:", error);
      res.status(400).json({ message: "Invalid purchase request data" });
    }
  });

  app.put("/api/purchase-requests/:id", isAuthenticated, async (req, res) => {
    try {
      const idParam = req.params.id;

      // Handle temporary IDs
      if (idParam.startsWith("temp_")) {
        return res
          .status(400)
          .json({
            message: "Solicitação precisa ser salva antes de ser atualizada",
          });
      }

      const id = parseInt(idParam);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID inválido" });
      }
      const { items, ...requestData } = req.body;

      // Validate request data
      const validatedRequestData = insertPurchaseRequestSchema
        .partial()
        .parse(requestData);

      // Update the purchase request
      const request = await storage.updatePurchaseRequest(
        id,
        validatedRequestData,
      );

      // Handle items if provided
      if (items && Array.isArray(items)) {
        // First, remove all existing items
        const existingItems = await storage.getPurchaseRequestItems(id);
        for (const item of existingItems) {
          await storage.deletePurchaseRequestItem(item.id);
        }

        // Then, add new items
        const validatedItems = items.map((item) =>
          insertPurchaseRequestItemSchema.parse({
            ...item,
            purchaseRequestId: id,
          }),
        );
        await storage.createPurchaseRequestItems(validatedItems);
      }

      // Invalidate cache for purchase requests
      invalidateCache(["/api/purchase-requests"]);

      res.json(request);
    } catch (error) {
      console.error("Error updating purchase request:", error);
      res.status(400).json({ message: "Invalid purchase request data" });
    }
  });

  app.patch("/api/purchase-requests/:id", isAuthenticated, async (req, res) => {
    try {
      const idParam = req.params.id;

      // Handle temporary IDs
      if (idParam.startsWith("temp_")) {
        return res
          .status(400)
          .json({
            message: "Solicitação precisa ser salva antes de ser atualizada",
          });
      }

      const id = parseInt(idParam);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID inválido" });
      }

      // Validate request data (only partial update)
      const validatedRequestData = insertPurchaseRequestSchema
        .partial()
        .parse(req.body);

      // Update the purchase request
      const request = await storage.updatePurchaseRequest(
        id,
        validatedRequestData,
      );

      // Send WebSocket notification
      const wsManager = app.get('wsManager');
      console.log('WebSocket Manager found:', !!wsManager);
      if (wsManager) {
        console.log('Sending WebSocket notification for purchase request:', request.id);
        wsManager.notifyClients('purchase_requests', 'updated', {
          id: request.id,
          currentPhase: request.currentPhase,
          requestNumber: request.requestNumber,
          updatedAt: request.updatedAt
        });
      }

      // Invalidate cache for purchase requests
      invalidateCache(["/api/purchase-requests"]);

      res.json(request);
    } catch (error) {
      console.error("Error updating purchase request:", error);
      res.status(400).json({ message: "Invalid purchase request data" });
    }
  });

  // Purchase Request Items routes
  app.get(
    "/api/purchase-requests/:id/items",
    isAuthenticated,
    async (req, res) => {
      try {
        const idParam = req.params.id;

        // Handle temporary IDs - return empty array for temp requests
        if (idParam.startsWith("temp_")) {
          return res.json([]);
        }

        const purchaseRequestId = parseInt(idParam);
        if (isNaN(purchaseRequestId)) {
          return res.status(400).json({ message: "ID inválido" });
        }
        const includeTransferred = req.query.includeTransferred === "true";
        const items = await storage.getPurchaseRequestItems(
          purchaseRequestId,
          includeTransferred,
        );

        // Map the items to match the frontend EditableItem interface
        const mappedItems = items.map((item) => ({
          id: item.id,
          description: item.description,
          unit: item.unit,
          requestedQuantity: parseFloat(item.requestedQuantity) || 0,
          technicalSpecification: item.technicalSpecification || "",
          isTransferred: item.isTransferred,
          transferReason: item.transferReason,
          transferredToRequestId: item.transferredToRequestId,
        }));

        res.json(mappedItems);
      } catch (error) {
        console.error("Error fetching purchase request items:", error);
        res.status(500).json({ message: "Failed to fetch items" });
      }
    },
  );

  app.post(
    "/api/purchase-requests/:id/items",
    isAuthenticated,
    async (req, res) => {
      try {
        const purchaseRequestId = parseInt(req.params.id);
        const itemData = insertPurchaseRequestItemSchema.parse({
          ...req.body,
          purchaseRequestId,
        });
        const item = await storage.createPurchaseRequestItem(itemData);
        res.status(201).json(item);
      } catch (error) {
        console.error("Error creating purchase request item:", error);
        res.status(400).json({ message: "Invalid item data" });
      }
    },
  );

  app.put(
    "/api/purchase-request-items/:id",
    isAuthenticated,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const itemData = insertPurchaseRequestItemSchema
          .partial()
          .parse(req.body);
        const item = await storage.updatePurchaseRequestItem(id, itemData);
        res.json(item);
      } catch (error) {
        console.error("Error updating purchase request item:", error);
        res.status(400).json({ message: "Invalid item data" });
      }
    },
  );

  app.delete(
    "/api/purchase-request-items/:id",
    isAuthenticated,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        await storage.deletePurchaseRequestItem(id);
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting purchase request item:", error);
        res.status(500).json({ message: "Failed to delete item" });
      }
    },
  );

  // Phase transition routes
  app.post(
    "/api/purchase-requests/:id/send-to-approval",
    isAuthenticated,
    async (req, res) => {
      try {
        const idParam = req.params.id;

        // Handle temporary IDs
        if (idParam.startsWith("temp_")) {
          return res
            .status(400)
            .json({
              message:
                "Solicitação precisa ser salva antes de ser enviada para aprovação",
            });
        }

        const id = parseInt(idParam);
        if (isNaN(id)) {
          return res.status(400).json({ message: "ID inválido" });
        }

        const request = await storage.getPurchaseRequestById(id);
        if (!request || request.currentPhase !== "solicitacao") {
          return res
            .status(400)
            .json({ message: "Request must be in the request phase" });
        }

        const updateData = {
          currentPhase: "aprovacao_a1" as any,
          updatedAt: new Date(),
        };

        const updatedRequest = await storage.updatePurchaseRequest(
          id,
          updateData,
        );

        // Send WebSocket notification for real-time updates
        const wsManager = app.get('wsManager');
        if (wsManager) {
          wsManager.notifyClients('purchase_requests', 'updated', {
            id: updatedRequest.id,
            currentPhase: updatedRequest.currentPhase,
            requestNumber: updatedRequest.requestNumber,
            updatedAt: updatedRequest.updatedAt
          });
        }

        // Send notification to approvers A1
        try {
          await notifyApprovalA1(updatedRequest);
        } catch (emailError) {
          console.error("Error sending approval notification:", emailError);
          // Continue with the update even if email fails
        }

        // Invalidate cache for purchase requests
        invalidateCache(["/api/purchase-requests"]);

        res.json(updatedRequest);
      } catch (error) {
        console.error("Error sending to approval:", error);
        res.status(400).json({ message: "Failed to send to approval" });
      }
    },
  );

  app.get(
    "/api/purchase-requests/:id/can-approve-a1",
    isAuthenticated,
    async (req, res) => {
      try {
        const idParam = req.params.id;

        // Handle temporary IDs
        if (idParam.startsWith("temp_")) {
          return res.json({
            canApprove: false,
            message: "Solicitação temporária não pode ser aprovada",
          });
        }

        const requestId = parseInt(idParam);
        if (isNaN(requestId)) {
          return res.status(400).json({ message: "ID inválido" });
        }

        const userId = req.session.userId;

        const request = await storage.getPurchaseRequestById(requestId);
        if (!request) {
          return res
            .status(404)
            .json({ message: "Purchase request not found" });
        }

        const userCostCenters = await storage.getUserCostCenters(userId);
        const canApprove = userCostCenters.includes(request.costCenterId);

        res.json({
          canApprove,
          requestCostCenter: request.costCenter,
          userCostCenters: userCostCenters,
        });
      } catch (error) {
        console.error("Error checking approval permissions:", error);
        res
          .status(500)
          .json({ message: "Failed to check approval permissions" });
      }
    },
  );

  app.post(
    "/api/purchase-requests/:id/approve-a1",
    isAuthenticated,
    canApproveRequest,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const { approved, rejectionReason, approverId } = req.body;

        const request = await storage.getPurchaseRequestById(id);

        if (!request || request.currentPhase !== "aprovacao_a1") {
          return res
            .status(400)
            .json({ message: "Request must be in the A1 approval phase" });
        }

        const updateData = {
          approverA1Id: approverId,
          approvedA1: approved,
          approvalDateA1: new Date(),
          currentPhase: approved ? "cotacao" : "arquivado",
          rejectionReasonA1: approved
            ? null
            : rejectionReason || "Solicitação reprovada",
          updatedAt: new Date(),
        } as const;

        // Create approval history entry
        await storage.createApprovalHistory({
          purchaseRequestId: id,
          approverType: "A1",
          approverId: approverId,
          approved: approved,
          rejectionReason: approved
            ? null
            : rejectionReason || "Solicitação reprovada",
        });

        const updatedRequest = await storage.updatePurchaseRequest(
          id,
          updateData,
        );

        // Send WebSocket notification for real-time updates
        const wsManager = app.get('wsManager');
        if (wsManager) {
          wsManager.notifyClients('purchase_requests', 'updated', {
            id: updatedRequest.id,
            currentPhase: updatedRequest.currentPhase,
            requestNumber: updatedRequest.requestNumber,
            updatedAt: updatedRequest.updatedAt,
            approved: approved,
            approvalLevel: 'A1'
          });
        }

        // Send rejection notification email if request was rejected
        if (!approved && rejectionReason) {
          await notifyRejection(updatedRequest, rejectionReason, "A1");
        }

        // Invalidate cache for purchase requests
        invalidateCache(["/api/purchase-requests"]);

        res.json(updatedRequest);
      } catch (error) {
        if (error instanceof Error) {
          console.error("Error approving A1:", error);
          console.error("Stack trace:", error.stack);
          res
            .status(400)
            .json({
              message: "Failed to process approval",
              error: error.message,
            });
        } else {
          res.status(400).json({ message: "Failed to process approval" });
        }
      }
    },
  );

  app.post(
    "/api/purchase-requests/:id/update-quotation",
    isAuthenticated,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const { buyerId, totalValue, paymentMethodId } = req.body;

        const updates = {
          buyerId,
          totalValue,
          paymentMethodId,
          currentPhase: "aprovacao_a2" as const,
        };

        const request = await storage.updatePurchaseRequest(id, updates);
        
        // Invalidate cache for purchase requests
        invalidateCache(["/api/purchase-requests"]);
        
        res.json(request);
      } catch (error) {
        console.error("Error updating quotation:", error);
        res.status(400).json({ message: "Failed to update quotation" });
      }
    },
  );

  app.post(
    "/api/purchase-requests/:id/approve-a2",
    isAuthenticated,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const { approved, rejectionReason, rejectionAction, approverId } =
          req.body;

        const request = await storage.getPurchaseRequestById(id);
        if (!request || request.currentPhase !== "aprovacao_a2") {
          return res
            .status(400)
            .json({ message: "Request must be in the A2 approval phase" });
        }

        let newPhase = "pedido_compra";
        if (!approved) {
          if (rejectionAction === "recotacao") {
            newPhase = "cotacao"; // Return to quotation phase
          } else {
            newPhase = "arquivado"; // Archive
          }
        }

        const updateData = {
          approverA2Id: approverId,
          approvalDateA2: new Date(),
          approvedA2: approved,
          rejectionReasonA2: approved ? null : rejectionReason,
          rejectionActionA2: approved ? null : rejectionAction,
          currentPhase: newPhase as any,
          updatedAt: new Date(),
        } as const;

        // Create approval history entry
        await storage.createApprovalHistory({
          purchaseRequestId: id,
          approverType: "A2",
          approverId: approverId,
          approved: approved,
          rejectionReason: approved
            ? null
            : rejectionReason || "Solicitação reprovada",
        });

        const updatedRequest = await storage.updatePurchaseRequest(
          id,
          updateData,
        );

        // Send WebSocket notification for real-time updates
        const wsManager = app.get('wsManager');
        if (wsManager) {
          wsManager.notifyClients('purchase_requests', 'updated', {
            id: updatedRequest.id,
            currentPhase: updatedRequest.currentPhase,
            requestNumber: updatedRequest.requestNumber,
            updatedAt: updatedRequest.updatedAt,
            approved: approved,
            approvalLevel: 'A2'
          });
        }

        // Se aprovado, criar automaticamente o purchase order
        if (approved) {
          try {
            // Buscar cotação
            const quotation = await storage.getQuotationByPurchaseRequestId(id);
            if (quotation) {
              const supplierQuotations = await storage.getSupplierQuotations(
                quotation.id,
              );
              const chosenSupplierQuotation = supplierQuotations.find(
                (sq) => sq.isChosen,
              );

              if (chosenSupplierQuotation) {
                // Verificar se já existe um purchase order
                const existingPurchaseOrder =
                  await storage.getPurchaseOrderByRequestId(id);
                // Check existing purchase order
                if (!existingPurchaseOrder) {
                  // Buscar itens do purchase request
                  const purchaseRequestItems =
                    await storage.getPurchaseRequestItems(id);

                  if (purchaseRequestItems.length > 0) {
                    // Gerar número do pedido
                    const orderNumber = `PO-${new Date().getFullYear()}-${String(id).padStart(3, "0")}`;

                    // Criar o purchase order
                    const purchaseOrderData = {
                      orderNumber,
                      purchaseRequestId: id,
                      supplierId: chosenSupplierQuotation.supplierId,
                      quotationId: quotation.id,
                      status: "draft" as const,
                      totalValue: chosenSupplierQuotation.totalValue || "0",
                      paymentTerms: null,
                      deliveryTerms: null,
                      deliveryAddress: null,
                      contactPerson: null,
                      contactPhone: null,
                      observations: null,
                      approvedBy: null,
                      approvedAt: null,
                      createdBy: approverId,
                    };

                    // Creating purchase order
                    const purchaseOrder =
                      await storage.createPurchaseOrder(purchaseOrderData);

                    // Buscar itens da cotação do fornecedor para obter preços
                    const supplierQuotationItems =
                      await storage.getSupplierQuotationItems(
                        chosenSupplierQuotation.id,
                      );

                    // Criar os itens do purchase order apenas para itens disponíveis
                    for (const requestItem of purchaseRequestItems) {
                      // Encontrar o item correspondente na cotação do fornecedor
                      // Primeiro buscar os quotation items para fazer o mapeamento correto
                      const quotationItems = await storage.getQuotationItems(
                        quotation.id,
                      );

                      // Encontrar o quotation item que corresponde ao request item
                      const quotationItem = quotationItems.find(
                        (qi) =>
                          qi.purchaseRequestItemId === requestItem.id ||
                          qi.description?.toLowerCase().trim() ===
                            requestItem.description?.toLowerCase().trim(),
                      );

                      // Encontrar o supplier quotation item usando o quotationItemId
                      const supplierItem = quotationItem
                        ? supplierQuotationItems.find(
                            (si) => si.quotationItemId === quotationItem.id,
                          )
                        : null;

                      // Pular itens marcados como indisponíveis
                      if (supplierItem && supplierItem.isAvailable === false) {
                        // Item indisponível será pulado
                        continue;
                      }

                      const purchaseOrderItemData = {
                        purchaseOrderId: purchaseOrder.id,
                        itemCode:
                          requestItem.productCode || `ITEM-${requestItem.id}`,
                        description: requestItem.description,
                        quantity:
                          requestItem.approvedQuantity ||
                          requestItem.requestedQuantity ||
                          "0",
                        unit: requestItem.unit,
                        unitPrice: supplierItem?.unitPrice || "0",
                        totalPrice: supplierItem?.totalPrice || "0",
                        deliveryDeadline: null,
                        costCenterId: request.costCenterId,
                        accountCode: null,
                      };

                      await storage.createPurchaseOrderItem(
                        purchaseOrderItemData,
                      );
                    }
                  }
                }
              }
            }
          } catch (purchaseOrderError) {
            console.error(
              "Erro ao criar purchase order automaticamente:",
              purchaseOrderError,
            );
            // Não falhar a aprovação se houver erro na criação do purchase order
          }
        }

        // Send rejection notification email if request was rejected
        if (!approved && rejectionReason) {
          await notifyRejection(updatedRequest, rejectionReason, "A2");
        }

        // Invalidate cache for purchase requests
        invalidateCache(["/api/purchase-requests"]);

        res.json(updatedRequest);
      } catch (error) {
        console.error("Error approving A2:", error);
        res.status(400).json({ message: "Failed to process A2 approval" });
      }
    },
  );

  // Mark supplier as no response
  app.post(
    "/api/supplier-quotations/:id/mark-no-response",
    isAuthenticated,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const supplierQuotation = await storage.updateSupplierQuotation(id, {
          status: "no_response",
          updatedAt: new Date(),
        });
        res.json(supplierQuotation);
      } catch (error) {
        console.error("Error marking supplier as no response:", error);
        res
          .status(400)
          .json({ message: "Failed to mark supplier as no response" });
      }
    },
  );

  // Get selected supplier for A2 approval
  app.get(
    "/api/purchase-requests/:id/selected-supplier",
    isAuthenticated,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);

        // Get quotation for this purchase request
        const quotation = await storage.getQuotationByPurchaseRequestId(id);
        if (!quotation) {
          return res.json(null);
        }

        // Get supplier quotations for this quotation
        const supplierQuotations = await storage.getSupplierQuotations(
          quotation.id,
        );
        const selectedSupplier = supplierQuotations.find((sq) => sq.isChosen);

        if (!selectedSupplier) {
          return res.json(null);
        }

        // Get supplier details
        const supplier = await storage.getSupplierById(
          selectedSupplier.supplierId,
        );

        // Get supplier quotation items
        const items = await storage.getSupplierQuotationItems(
          selectedSupplier.id,
        );

        res.json({
          supplier,
          quotation: selectedSupplier,
          items,
          choiceReason: selectedSupplier.choiceReason,
        });
      } catch (error) {
        console.error("Error getting selected supplier:", error);
        res.status(500).json({ message: "Failed to get selected supplier" });
      }
    },
  );

  // Add isReceiver permission check middleware
  async function isReceiver(req: Request, res: Response, next: Function) {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user?.isReceiver && !user?.isAdmin) {
      return res
        .status(403)
        .json({
          message: "Acesso negado: permissão de recebimento necessária",
        });
    }

    next();
  }

  app.post(
    "/api/purchase-requests/:id/confirm-receipt",
    isAuthenticated,
    isReceiver,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const { receivedById } = req.body;

        const request = await storage.getPurchaseRequestById(id);
        if (!request || request.currentPhase !== "recebimento") {
          return res
            .status(400)
            .json({ message: "Request must be in the receiving phase" });
        }

        const updateData = {
          receivedById: receivedById,
          receivedDate: new Date(),
          currentPhase: "conclusao_compra" as any,
          updatedAt: new Date(),
        };

        const updatedRequest = await storage.updatePurchaseRequest(
          id,
          updateData,
        );

        // Send WebSocket notification for real-time updates
        const wsManager = app.get('wsManager');
        if (wsManager) {
          wsManager.notifyClients('purchase_requests', 'updated', {
            id: updatedRequest.id,
            currentPhase: updatedRequest.currentPhase,
            requestNumber: updatedRequest.requestNumber,
            updatedAt: updatedRequest.updatedAt,
            action: 'receipt_confirmed'
          });
        }

        res.json(updatedRequest);
      } catch (error) {
        console.error("Error confirming receipt:", error);
        res.status(400).json({ message: "Failed to confirm receipt" });
      }
    },
  );

  app.post(
    "/api/purchase-requests/:id/report-issue",
    isAuthenticated,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const { reportedById, pendencyReason } = req.body;

        const request = await storage.getPurchaseRequestById(id);
        if (!request || request.currentPhase !== "recebimento") {
          return res
            .status(400)
            .json({ message: "Request must be in the receiving phase" });
        }

        const updateData = {
          currentPhase: "pedido_compra" as any,
          hasPendency: true,
          pendencyReason: pendencyReason || "Pendência reportada",
          updatedAt: new Date(),
        };

        const updatedRequest = await storage.updatePurchaseRequest(
          id,
          updateData,
        );
        res.json(updatedRequest);
      } catch (error) {
        console.error("Error reporting issue:", error);
        res.status(400).json({ message: "Failed to report issue" });
      }
    },
  );

  app.get(
    "/api/purchase-requests/:id/approval-history",
    isAuthenticated,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const history = await storage.getApprovalHistory(id);
        res.json(history);
      } catch (error) {
        console.error("Error fetching approval history:", error);
        res.status(500).json({ message: "Failed to fetch approval history" });
      }
    },
  );

  // Complete timeline endpoint for all phase transitions
  app.get(
    "/api/purchase-requests/:id/complete-timeline",
    isAuthenticated,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const timeline = await storage.getCompleteTimeline(id);
        res.json(timeline);
      } catch (error) {
        console.error("Error fetching complete timeline:", error);
        res.status(500).json({ message: "Failed to fetch complete timeline" });
      }
    },
  );

  app.post(
    "/api/purchase-requests/:id/create-purchase-order",
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const { purchaseObservations } = req.body;
        const userId = req.session?.userId;

        if (!userId) {
          return res.status(401).json({ message: "User not authenticated" });
        }

        // Buscar o purchase request e dados relacionados
        const purchaseRequest = await storage.getPurchaseRequest(id);
        if (!purchaseRequest) {
          return res
            .status(404)
            .json({ message: "Purchase request not found" });
        }

        // Buscar cotação e fornecedor escolhido
        const quotation = await storage.getQuotationByPurchaseRequestId(id);
        if (!quotation) {
          return res
            .status(400)
            .json({ message: "No quotation found for this purchase request" });
        }

        const supplierQuotations = await storage.getSupplierQuotations(
          quotation.id,
        );
        const chosenSupplierQuotation = supplierQuotations.find(
          (sq) => sq.isChosen,
        );
        if (!chosenSupplierQuotation) {
          return res
            .status(400)
            .json({ message: "No supplier chosen for this quotation" });
        }

        // Buscar itens do purchase request
        const purchaseRequestItems = await storage.getPurchaseRequestItems(id);
        if (purchaseRequestItems.length === 0) {
          return res
            .status(400)
            .json({ message: "No items found for this purchase request" });
        }

        // Buscar itens da cotação do fornecedor para obter preços
        const supplierQuotationItems = await storage.getSupplierQuotationItems(
          chosenSupplierQuotation.id,
        );

        // Verificar se já existe um purchase order para este request
        const existingPurchaseOrder =
          await storage.getPurchaseOrderByRequestId(id);
        if (existingPurchaseOrder) {
          return res
            .status(400)
            .json({
              message: "Purchase order already exists for this request",
            });
        }

        // Gerar número do pedido
        const orderNumber = `PO-${new Date().getFullYear()}-${String(id).padStart(3, "0")}`;

        // Criar o purchase order
        const purchaseOrderData = {
          orderNumber,
          purchaseRequestId: id,
          supplierId: chosenSupplierQuotation.supplierId,
          quotationId: quotation.id,
          status: "draft" as const,
          totalValue: chosenSupplierQuotation.totalValue || "0",
          paymentTerms: null,
          deliveryTerms: null,
          deliveryAddress: null,
          contactPerson: null,
          contactPhone: null,
          observations: purchaseObservations || null,
          approvedBy: null,
          approvedAt: null,
          createdBy: userId,
        };

        const purchaseOrder =
          await storage.createPurchaseOrder(purchaseOrderData);

        // Criar os itens do purchase order
        for (const requestItem of purchaseRequestItems) {
          // Primeiro buscar os quotation items para fazer o mapeamento correto
          const quotationItems = await storage.getQuotationItems(quotation.id);

          // Encontrar o quotation item que corresponde ao request item
          const quotationItem = quotationItems.find(
            (qi) =>
              qi.purchaseRequestItemId === requestItem.id ||
              qi.description?.toLowerCase().trim() ===
                requestItem.description?.toLowerCase().trim(),
          );

          // Encontrar o supplier quotation item usando o quotationItemId
          const supplierItem = quotationItem
            ? supplierQuotationItems.find(
                (si) => si.quotationItemId === quotationItem.id,
              )
            : null;

          const purchaseOrderItemData = {
            purchaseOrderId: purchaseOrder.id,
            itemCode: requestItem.productCode || `ITEM-${requestItem.id}`,
            description: requestItem.description,
            quantity:
              requestItem.approvedQuantity ||
              requestItem.requestedQuantity ||
              "0",
            unit: requestItem.unit,
            unitPrice: supplierItem?.unitPrice || "0",
            totalPrice: supplierItem?.totalPrice || "0",
            deliveryDeadline: null,
            costCenterId: purchaseRequest.costCenterId,
            accountCode: null,
          };

          await storage.createPurchaseOrderItem(purchaseOrderItemData);
        }

        // Atualizar o purchase request
        const updates = {
          purchaseDate: new Date(),
          purchaseObservations,
          currentPhase: "pedido_compra" as const,
        };

        const updatedRequest = await storage.updatePurchaseRequest(id, updates);

        res.json({
          purchaseRequest: updatedRequest,
          purchaseOrder: purchaseOrder,
          message: "Purchase order created successfully",
        });
      } catch (error) {
        console.error("Error creating purchase order:", error);
        res
          .status(500)
          .json({
            message: "Failed to create purchase order",
            error: error.message,
          });
      }
    },
  );

  app.post("/api/purchase-requests/:id/receive-material", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { receivedById } = req.body;

      const updates = {
        receivedById,
        receivedDate: new Date(),
        currentPhase: "recebimento" as const,
      };

      const request = await storage.updatePurchaseRequest(id, updates);
      res.json(request);
    } catch (error) {
      console.error("Error receiving material:", error);
      res.status(400).json({ message: "Failed to record material receipt" });
    }
  });

  // Purchase Orders endpoints
  app.post("/api/purchase-orders", isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertPurchaseOrderSchema.parse(req.body);
      const purchaseOrder = await storage.createPurchaseOrder(validatedData);
      res.status(201).json(purchaseOrder);
    } catch (error) {
      console.error("Error creating purchase order:", error);
      res
        .status(500)
        .json({
          message: "Failed to create purchase order",
          error: error.message,
        });
    }
  });

  app.get("/api/purchase-orders/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const purchaseOrder = await storage.getPurchaseOrderById(id);

      if (!purchaseOrder) {
        return res.status(404).json({ message: "Purchase order not found" });
      }

      res.json(purchaseOrder);
    } catch (error) {
      console.error("Error fetching purchase order:", error);
      res.status(500).json({ message: "Failed to fetch purchase order" });
    }
  });

  app.get("/api/purchase-requests/:id/purchase-order", async (req, res) => {
    try {
      const purchaseRequestId = parseInt(req.params.id);
      const purchaseOrder =
        await storage.getPurchaseOrderByRequestId(purchaseRequestId);

      if (!purchaseOrder) {
        return res
          .status(404)
          .json({ message: "Purchase order not found for this request" });
      }

      res.json(purchaseOrder);
    } catch (error) {
      console.error("Error fetching purchase order by request:", error);
      res.status(500).json({ message: "Failed to fetch purchase order" });
    }
  });

  app.get("/api/purchase-orders/:id/items", async (req, res) => {
    try {
      const purchaseOrderId = parseInt(req.params.id);
      const items = await storage.getPurchaseOrderItems(purchaseOrderId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching purchase order items:", error);
      res.status(500).json({ message: "Failed to fetch purchase order items" });
    }
  });

  // Admin endpoint to search purchase request by request number
  app.get(
    "/api/admin/purchase-requests/search/:requestNumber",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const { requestNumber } = req.params;
        const request = await storage.getPurchaseRequestByNumber(requestNumber);

        if (!request) {
          return res
            .status(404)
            .json({ message: "Solicitação não encontrada" });
        }

        // Get complete request data with relationships
        const [items, attachments, costCenter, requester] = await Promise.all([
          storage.getPurchaseRequestItems(request.id),
          storage.getAttachmentsByPurchaseRequestId(request.id),
          storage.getCostCenterById(request.costCenterId),
          storage.getUser(request.requesterId),
        ]);

        const enrichedRequest = {
          ...request,
          items,
          attachments,
          costCenter,
          requester: requester
            ? {
                id: requester.id,
                firstName: requester.firstName,
                lastName: requester.lastName,
                email: requester.email,
              }
            : null,
        };

        res.json(enrichedRequest);
      } catch (error) {
        console.error("Error searching purchase request:", error);
        res.status(500).json({ message: "Falha ao buscar solicitação" });
      }
    },
  );

  // Admin endpoint to update complete purchase request data
  app.patch(
    "/api/admin/purchase-requests/:id",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const {
          category,
          urgency,
          justification,
          idealDeliveryDate,
          availableBudget,
          additionalInfo,
          currentPhase,
          items,
        } = req.body;

        // Validate phase
        const validPhases = [
          "solicitacao",
          "aprovacao_a1",
          "cotacao",
          "aprovacao_a2",
          "pedido_compra",
          "recebimento",
          "conclusao_compra",
          "arquivado",
        ] as const;
        if (currentPhase && !validPhases.includes(currentPhase)) {
          return res.status(400).json({ message: "Fase inválida" });
        }

        // Update main request data
        const updates: any = {};
        if (category !== undefined) updates.category = category;
        if (urgency !== undefined) updates.urgency = urgency;
        if (justification !== undefined) updates.justification = justification;
        if (idealDeliveryDate !== undefined)
          updates.idealDeliveryDate = idealDeliveryDate
            ? new Date(idealDeliveryDate)
            : null;
        if (availableBudget !== undefined)
          updates.availableBudget = availableBudget;
        if (additionalInfo !== undefined)
          updates.additionalInfo = additionalInfo;
        if (currentPhase !== undefined) updates.currentPhase = currentPhase;

        const updatedRequest = await storage.updatePurchaseRequest(id, updates);

        // Update items if provided
        if (items && Array.isArray(items)) {
          // Get existing items
          const existingItems = await storage.getPurchaseRequestItems(id);

          // Update existing items and add new ones
          for (const item of items) {
            if (item.id && existingItems.some((ei) => ei.id === item.id)) {
              // Update existing item
              await storage.updatePurchaseRequestItem(item.id, {
                description: item.description,
                unit: item.unit,
                requestedQuantity: item.requestedQuantity,
                technicalSpecification: item.technicalSpecification,
              });
            } else if (!item.id) {
              // Add new item
              await storage.createPurchaseRequestItem({
                purchaseRequestId: id,
                description: item.description,
                unit: item.unit,
                requestedQuantity: item.requestedQuantity,
                technicalSpecification: item.technicalSpecification,
              });
            }
          }
        }

        res.json(updatedRequest);
      } catch (error) {
        console.error("Error updating purchase request:", error);
        res.status(500).json({ message: "Falha ao atualizar solicitação" });
      }
    },
  );

  // Admin endpoint to audit purchase request data integrity
  app.get(
    "/api/admin/purchase-requests/:id/audit",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        
        // Get purchase request
        const request = await storage.getPurchaseRequestById(id);
        if (!request) {
          return res.status(404).json({ message: "Solicitação não encontrada" });
        }

        const auditResults = {
          requestId: id,
          requestNumber: request.requestNumber,
          issues: [] as any[],
          summary: {
            totalIssues: 0,
            orphanedQuotationItems: 0,
            missingReferences: 0,
            valueDiscrepancies: 0,
            quantityDiscrepancies: 0
          }
        };

        // Get all related data
        const [purchaseRequestItems, quotations] = await Promise.all([
          storage.getPurchaseRequestItems(id),
          pool.query(
            `SELECT q.*, qi.id as quotation_item_id, qi.description as qi_description, 
                    qi.unit as qi_unit, qi.quantity as qi_quantity,
                    qi.purchase_request_item_id
             FROM quotations q
             LEFT JOIN quotation_items qi ON q.id = qi.quotation_id
             WHERE q.purchase_request_id = $1
             ORDER BY q.id, qi.id`,
            [id]
          )
        ]);

        const quotationData = quotations.rows;

        // 1. Check for orphaned quotation items (without purchaseRequestItemId)
        const orphanedItems = quotationData.filter(row => 
          row.quotation_item_id && !row.purchase_request_item_id
        );

        orphanedItems.forEach(item => {
          auditResults.issues.push({
            type: 'orphaned_quotation_item',
            severity: 'high',
            description: `Item de cotação "${item.qi_description}" não está vinculado a nenhum item da solicitação original`,
            quotationItemId: item.quotation_item_id,
            quotationId: item.id,
            data: {
              description: item.qi_description,
              unit: item.qi_unit,
              quantity: item.qi_quantity
            }
          });
          auditResults.summary.orphanedQuotationItems++;
        });

        // 2. Check for missing references in quotation items
        const quotationItemsWithRefs = quotationData.filter(row => 
          row.quotation_item_id && row.purchase_request_item_id
        );

        for (const qItem of quotationItemsWithRefs) {
          const prItem = purchaseRequestItems.find(pri => pri.id === qItem.purchase_request_item_id);
          if (!prItem) {
            auditResults.issues.push({
              type: 'missing_reference',
              severity: 'high',
              description: `Item de cotação referencia um item da solicitação que não existe (ID: ${qItem.purchase_request_item_id})`,
              quotationItemId: qItem.quotation_item_id,
              quotationId: qItem.id,
              referencedItemId: qItem.purchase_request_item_id
            });
            auditResults.summary.missingReferences++;
          }
        }

        // 3. Check for value discrepancies between related items
        for (const qItem of quotationItemsWithRefs) {
          const prItem = purchaseRequestItems.find(pri => pri.id === qItem.purchase_request_item_id);
          if (prItem) {
            // Check quantity discrepancies
            if (parseFloat(qItem.qi_quantity) !== parseFloat(prItem.requestedQuantity)) {
              auditResults.issues.push({
                type: 'quantity_discrepancy',
                severity: 'medium',
                description: `Divergência de quantidade entre item da solicitação e cotação`,
                quotationItemId: qItem.quotation_item_id,
                purchaseRequestItemId: prItem.id,
                data: {
                  requestQuantity: prItem.requestedQuantity,
                  quotationQuantity: qItem.qi_quantity,
                  description: prItem.description
                }
              });
              auditResults.summary.quantityDiscrepancies++;
            }

            // Check description consistency
            if (qItem.qi_description.toLowerCase().trim() !== prItem.description.toLowerCase().trim()) {
              auditResults.issues.push({
                type: 'description_discrepancy',
                severity: 'low',
                description: `Divergência de descrição entre item da solicitação e cotação`,
                quotationItemId: qItem.quotation_item_id,
                purchaseRequestItemId: prItem.id,
                data: {
                  requestDescription: prItem.description,
                  quotationDescription: qItem.qi_description
                }
              });
            }
          }
        }

        // 4. Check for supplier quotation items integrity
        const supplierQuotations = await pool.query(
          `SELECT sq.*, sqi.id as sq_item_id, sqi.quotation_item_id, sqi.unit_price, sqi.total_price
           FROM supplier_quotations sq
           LEFT JOIN supplier_quotation_items sqi ON sq.id = sqi.supplier_quotation_id
           WHERE sq.quotation_id IN (SELECT id FROM quotations WHERE purchase_request_id = $1)`,
          [id]
        );

        for (const sqItem of supplierQuotations.rows) {
          if (sqItem.sq_item_id && sqItem.quotation_item_id) {
            const quotationItem = quotationData.find(qi => qi.quotation_item_id === sqItem.quotation_item_id);
            if (!quotationItem) {
              auditResults.issues.push({
                type: 'missing_quotation_item_reference',
                severity: 'high',
                description: `Item de cotação de fornecedor referencia um item de cotação que não existe`,
                supplierQuotationItemId: sqItem.sq_item_id,
                referencedQuotationItemId: sqItem.quotation_item_id
              });
              auditResults.summary.missingReferences++;
            }
          }
        }

        // 5. Check for value discrepancies between supplier quotation and purchase order
        const purchaseOrder = await pool.query(
          `SELECT po.id, po.total_value as po_total_value
           FROM purchase_orders po
           WHERE po.purchase_request_id = $1`,
          [id]
        );

        if (purchaseOrder.rows.length > 0) {
          const po = purchaseOrder.rows[0];
          
          // Get purchase order items total
          const purchaseOrderItems = await pool.query(
            `SELECT poi.total_price
             FROM purchase_order_items poi
             WHERE poi.purchase_order_id = $1`,
            [po.id]
          );

          const poItemsTotal = purchaseOrderItems.rows.reduce((sum, item) => 
            sum + parseFloat(item.total_price || 0), 0
          );

          // Get selected supplier quotation total
          const selectedSupplierQuotation = supplierQuotations.rows.find(sq => sq.is_chosen === true);
          
          if (selectedSupplierQuotation) {
            const supplierQuotationTotal = parseFloat(selectedSupplierQuotation.total_value || 0);
            const purchaseOrderTotal = parseFloat(po.po_total_value || 0);
            
            // Check discrepancy between supplier quotation and purchase order items
            const itemsDiscrepancy = Math.abs(supplierQuotationTotal - poItemsTotal);
            const orderDiscrepancy = Math.abs(supplierQuotationTotal - purchaseOrderTotal);
            
            // Consider significant if difference is more than 1% or R$ 10
            const significantThreshold = Math.max(supplierQuotationTotal * 0.01, 10);
            
            if (itemsDiscrepancy > significantThreshold) {
              auditResults.issues.push({
                type: 'quotation_purchase_order_value_discrepancy',
                severity: 'high',
                description: `Divergência de valores entre cotação do fornecedor (R$ ${supplierQuotationTotal.toFixed(2)}) e soma dos itens do pedido de compra (R$ ${poItemsTotal.toFixed(2)})`,
                supplierQuotationId: selectedSupplierQuotation.id,
                purchaseOrderId: po.id,
                data: {
                  supplierQuotationTotal: supplierQuotationTotal,
                  purchaseOrderItemsTotal: poItemsTotal,
                  purchaseOrderTotal: purchaseOrderTotal,
                  discrepancy: itemsDiscrepancy
                }
              });
              auditResults.summary.valueDiscrepancies++;
            }
            
            if (orderDiscrepancy > significantThreshold) {
              auditResults.issues.push({
                type: 'quotation_purchase_order_total_discrepancy',
                severity: 'medium',
                description: `Divergência entre valor total da cotação (R$ ${supplierQuotationTotal.toFixed(2)}) e valor total do pedido de compra (R$ ${purchaseOrderTotal.toFixed(2)})`,
                supplierQuotationId: selectedSupplierQuotation.id,
                purchaseOrderId: po.id,
                data: {
                  supplierQuotationTotal: supplierQuotationTotal,
                  purchaseOrderTotal: purchaseOrderTotal,
                  discrepancy: orderDiscrepancy
                }
              });
              auditResults.summary.valueDiscrepancies++;
            }
          }
        }

        auditResults.summary.totalIssues = auditResults.issues.length;

        res.json(auditResults);
      } catch (error) {
        console.error("Error auditing purchase request:", error);
        res.status(500).json({ message: "Falha ao auditar solicitação" });
      }
    }
  );

  // Admin endpoint to fix purchase request data integrity issues
  app.post(
    "/api/admin/purchase-requests/:id/fix-data",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const { fixTypes = [], dryRun = false } = req.body;
        
        // Get purchase request
        const request = await storage.getPurchaseRequestById(id);
        if (!request) {
          return res.status(404).json({ message: "Solicitação não encontrada" });
        }

        const fixResults = {
          requestId: id,
          requestNumber: request.requestNumber,
          dryRun,
          fixes: [] as any[],
          summary: {
            totalFixes: 0,
            orphanedItemsFixed: 0,
            referencesFixed: 0,
            quantitiesFixed: 0,
            descriptionsFixed: 0
          }
        };

        // Get audit data first by calling the audit endpoint internally
        const orphanedItems = await pool.query(
          `SELECT qi.id as quotation_item_id, qi.description, qi.quantity
           FROM quotations q
           JOIN quotation_items qi ON q.id = qi.quotation_id
           WHERE q.purchase_request_id = $1 AND qi.purchase_request_item_id IS NULL`,
          [id]
        );

        // Fix orphaned quotation items
        if (fixTypes.includes('orphaned_quotation_item') || fixTypes.includes('all')) {
          for (const item of orphanedItems.rows) {
            if (!dryRun) {
              // Create corresponding purchase request item
              const newPrItem = await storage.createPurchaseRequestItem({
                purchaseRequestId: id,
                description: item.description,
                unit: 'UN', // Default unit since it's not available in quotation_items
                requestedQuantity: item.quantity,
                technicalSpecification: `Item adicionado durante RFQ - sincronizado automaticamente`
              });

              // Update quotation item to reference the new purchase request item
              await pool.query(
                `UPDATE quotation_items SET purchase_request_item_id = $1 WHERE id = $2`,
                [newPrItem.id, item.quotation_item_id]
              );

              fixResults.fixes.push({
                type: 'orphaned_quotation_item',
                action: 'created_purchase_request_item_and_linked',
                quotationItemId: item.quotation_item_id,
                newPurchaseRequestItemId: newPrItem.id,
                description: `Criado item na solicitação e vinculado ao item de cotação`
              });
            } else {
              fixResults.fixes.push({
                type: 'orphaned_quotation_item',
                action: 'would_create_purchase_request_item_and_link',
                quotationItemId: item.quotation_item_id,
                description: `Criaria item na solicitação e vincularia ao item de cotação`
              });
            }
            fixResults.summary.orphanedItemsFixed++;
          }
        }

        // Fix missing references in quotation items
        if (fixTypes.includes('missing_reference') || fixTypes.includes('all')) {
          const missingRefs = await pool.query(
            `SELECT qi.id as quotation_item_id, qi.purchase_request_item_id as invalid_ref_id
             FROM quotations q
             JOIN quotation_items qi ON q.id = qi.quotation_id
             LEFT JOIN purchase_request_items pri ON qi.purchase_request_item_id = pri.id
             WHERE q.purchase_request_id = $1 
             AND qi.purchase_request_item_id IS NOT NULL 
             AND pri.id IS NULL`,
            [id]
          );

          for (const item of missingRefs.rows) {
            if (!dryRun) {
              // Set reference to NULL for invalid references
              await pool.query(
                `UPDATE quotation_items SET purchase_request_item_id = NULL WHERE id = $1`,
                [item.quotation_item_id]
              );

              fixResults.fixes.push({
                type: 'missing_reference',
                action: 'removed_invalid_reference',
                quotationItemId: item.quotation_item_id,
                invalidRefId: item.invalid_ref_id,
                description: `Removida referência inválida para item inexistente (ID: ${item.invalid_ref_id})`
              });
            } else {
              fixResults.fixes.push({
                type: 'missing_reference',
                action: 'would_remove_invalid_reference',
                quotationItemId: item.quotation_item_id,
                invalidRefId: item.invalid_ref_id,
                description: `Removeria referência inválida para item inexistente (ID: ${item.invalid_ref_id})`
              });
            }
            fixResults.summary.referencesFixed++;
          }
        }

        // Fix quantity discrepancies
        if (fixTypes.includes('quantity_discrepancy') || fixTypes.includes('all')) {
          const quantityDiscrepancies = await pool.query(
            `SELECT qi.id as quotation_item_id, qi.quantity as qi_quantity, 
                    pri.requested_quantity as pri_quantity, pri.id as purchase_request_item_id
             FROM quotations q
             JOIN quotation_items qi ON q.id = qi.quotation_id
             JOIN purchase_request_items pri ON qi.purchase_request_item_id = pri.id
             WHERE q.purchase_request_id = $1 
             AND qi.quantity::decimal != pri.requested_quantity::decimal`,
            [id]
          );

          for (const item of quantityDiscrepancies.rows) {
            if (!dryRun) {
              // Update quotation item quantity to match purchase request item
              await pool.query(
                `UPDATE quotation_items SET quantity = $1 WHERE id = $2`,
                [item.pri_quantity, item.quotation_item_id]
              );

              // Also update related supplier quotation items
              await pool.query(
                `UPDATE supplier_quotation_items 
                 SET available_quantity = $1
                 WHERE quotation_item_id = $2`,
                [item.pri_quantity, item.quotation_item_id]
              );

              fixResults.fixes.push({
                type: 'quantity_discrepancy',
                action: 'synchronized_quantities',
                quotationItemId: item.quotation_item_id,
                purchaseRequestItemId: item.purchase_request_item_id,
                oldQuantity: item.qi_quantity,
                newQuantity: item.pri_quantity,
                description: `Quantidade sincronizada: ${item.qi_quantity} → ${item.pri_quantity}`
              });
            } else {
              fixResults.fixes.push({
                type: 'quantity_discrepancy',
                action: 'would_synchronize_quantities',
                quotationItemId: item.quotation_item_id,
                purchaseRequestItemId: item.purchase_request_item_id,
                oldQuantity: item.qi_quantity,
                newQuantity: item.pri_quantity,
                description: `Sincronizaria quantidade: ${item.qi_quantity} → ${item.pri_quantity}`
              });
            }
            fixResults.summary.quantitiesFixed++;
          }
        }

        // Fix missing quotation item references in supplier quotations
        if (fixTypes.includes('missing_quotation_item_reference') || fixTypes.includes('all')) {
          const missingQuotationRefs = await pool.query(
            `SELECT sqi.id as supplier_quotation_item_id, sqi.quotation_item_id as invalid_qi_ref
             FROM supplier_quotations sq
             JOIN supplier_quotation_items sqi ON sq.id = sqi.supplier_quotation_id
             LEFT JOIN quotation_items qi ON sqi.quotation_item_id = qi.id
             WHERE sq.quotation_id IN (SELECT id FROM quotations WHERE purchase_request_id = $1)
             AND sqi.quotation_item_id IS NOT NULL 
             AND qi.id IS NULL`,
            [id]
          );

          for (const item of missingQuotationRefs.rows) {
            if (!dryRun) {
              // Set quotation_item_id to NULL for invalid references
              await pool.query(
                `UPDATE supplier_quotation_items SET quotation_item_id = NULL WHERE id = $1`,
                [item.supplier_quotation_item_id]
              );

              fixResults.fixes.push({
                type: 'missing_quotation_item_reference',
                action: 'removed_invalid_quotation_item_reference',
                supplierQuotationItemId: item.supplier_quotation_item_id,
                invalidQuotationItemId: item.invalid_qi_ref,
                description: `Removida referência inválida para quotation_item inexistente (ID: ${item.invalid_qi_ref})`
              });
            } else {
              fixResults.fixes.push({
                type: 'missing_quotation_item_reference',
                action: 'would_remove_invalid_quotation_item_reference',
                supplierQuotationItemId: item.supplier_quotation_item_id,
                invalidQuotationItemId: item.invalid_qi_ref,
                description: `Removeria referência inválida para quotation_item inexistente (ID: ${item.invalid_qi_ref})`
              });
            }
            fixResults.summary.referencesFixed++;
          }
        }

        // Fix value discrepancies between supplier quotation and purchase order
        if (fixTypes.includes('quotation_purchase_order_value_discrepancy') || 
            fixTypes.includes('quotation_purchase_order_total_discrepancy') || 
            fixTypes.includes('all')) {
          
          const purchaseOrder = await pool.query(
            `SELECT po.id, po.total_value as po_total_value
             FROM purchase_orders po
             WHERE po.purchase_request_id = $1`,
            [id]
          );

          if (purchaseOrder.rows.length > 0) {
            const po = purchaseOrder.rows[0];
            
            // Get purchase order items
            const purchaseOrderItems = await pool.query(
              `SELECT poi.id, poi.total_price
               FROM purchase_order_items poi
               WHERE poi.purchase_order_id = $1`,
              [po.id]
            );

            const poItemsTotal = purchaseOrderItems.rows.reduce((sum, item) => 
              sum + parseFloat(item.total_price || 0), 0
            );

            // Get selected supplier quotation
            const selectedSupplierQuotation = await pool.query(
              `SELECT sq.id, sq.total_value
               FROM supplier_quotations sq
               JOIN quotations q ON sq.quotation_id = q.id
               WHERE q.purchase_request_id = $1 AND sq.is_chosen = true`,
              [id]
            );

            if (selectedSupplierQuotation.rows.length > 0) {
              const sq = selectedSupplierQuotation.rows[0];
              const supplierQuotationTotal = parseFloat(sq.total_value || 0);
              const purchaseOrderTotal = parseFloat(po.po_total_value || 0);
              
              const itemsDiscrepancy = Math.abs(supplierQuotationTotal - poItemsTotal);
              const orderDiscrepancy = Math.abs(supplierQuotationTotal - purchaseOrderTotal);
              const significantThreshold = Math.max(supplierQuotationTotal * 0.01, 10);
              
              // Fix items discrepancy by updating purchase order items proportionally
              if (itemsDiscrepancy > significantThreshold && 
                  (fixTypes.includes('quotation_purchase_order_value_discrepancy') || fixTypes.includes('all'))) {
                
                if (!dryRun) {
                  // Calculate proportional adjustment factor
                  const adjustmentFactor = supplierQuotationTotal / poItemsTotal;
                  
                  for (const item of purchaseOrderItems.rows) {
                    const currentTotal = parseFloat(item.total_price || 0);
                    const newTotal = currentTotal * adjustmentFactor;
                    
                    await pool.query(
                      `UPDATE purchase_order_items 
                       SET total_price = $1, unit_price = total_price / quantity
                       WHERE id = $2`,
                      [newTotal, item.id]
                    );
                  }
                  
                  // Update purchase order total
                  await pool.query(
                    `UPDATE purchase_orders SET total_value = $1 WHERE id = $2`,
                    [supplierQuotationTotal, po.id]
                  );

                  fixResults.fixes.push({
                    type: 'quotation_purchase_order_value_discrepancy',
                    action: 'synchronized_purchase_order_values',
                    supplierQuotationId: sq.id,
                    purchaseOrderId: po.id,
                    oldItemsTotal: poItemsTotal,
                    newItemsTotal: supplierQuotationTotal,
                    adjustmentFactor: adjustmentFactor,
                    description: `Valores dos itens do pedido de compra sincronizados com cotação: R$ ${poItemsTotal.toFixed(2)} → R$ ${supplierQuotationTotal.toFixed(2)}`
                  });

                  // Log detailed value synchronization
                  await pool.query(
                    `INSERT INTO audit_logs (purchase_request_id, performed_by, action_type, action_description, performed_at)
                     VALUES ($1, $2, $3, $4, NOW())`,
                    [
                      id,
                      req.session.userId,
                      'value_discrepancy_fix_items',
                      `Sincronização de valores: itens do pedido ajustados de R$ ${poItemsTotal.toFixed(2)} para R$ ${supplierQuotationTotal.toFixed(2)} (fator: ${adjustmentFactor.toFixed(4)})`
                    ]
                  );
                } else {
                  fixResults.fixes.push({
                    type: 'quotation_purchase_order_value_discrepancy',
                    action: 'would_synchronize_purchase_order_values',
                    supplierQuotationId: sq.id,
                    purchaseOrderId: po.id,
                    oldItemsTotal: poItemsTotal,
                    newItemsTotal: supplierQuotationTotal,
                    description: `Sincronizaria valores dos itens do pedido: R$ ${poItemsTotal.toFixed(2)} → R$ ${supplierQuotationTotal.toFixed(2)}`
                  });
                }
                fixResults.summary.valueDiscrepancies = (fixResults.summary.valueDiscrepancies || 0) + 1;
              }
              
              // Fix order total discrepancy
              if (orderDiscrepancy > significantThreshold && 
                  (fixTypes.includes('quotation_purchase_order_total_discrepancy') || fixTypes.includes('all'))) {
                
                if (!dryRun) {
                  await pool.query(
                    `UPDATE purchase_orders SET total_value = $1 WHERE id = $2`,
                    [supplierQuotationTotal, po.id]
                  );

                  fixResults.fixes.push({
                    type: 'quotation_purchase_order_total_discrepancy',
                    action: 'synchronized_purchase_order_total',
                    supplierQuotationId: sq.id,
                    purchaseOrderId: po.id,
                    oldTotal: purchaseOrderTotal,
                    newTotal: supplierQuotationTotal,
                    description: `Valor total do pedido sincronizado com cotação: R$ ${purchaseOrderTotal.toFixed(2)} → R$ ${supplierQuotationTotal.toFixed(2)}`
                  });

                  // Log detailed total synchronization
                  await pool.query(
                    `INSERT INTO audit_logs (purchase_request_id, performed_by, action_type, action_description, performed_at)
                     VALUES ($1, $2, $3, $4, NOW())`,
                    [
                      id,
                      req.session.userId,
                      'value_discrepancy_fix_total',
                      `Sincronização de valor total: pedido ajustado de R$ ${purchaseOrderTotal.toFixed(2)} para R$ ${supplierQuotationTotal.toFixed(2)}`
                    ]
                  );
                } else {
                  fixResults.fixes.push({
                    type: 'quotation_purchase_order_total_discrepancy',
                    action: 'would_synchronize_purchase_order_total',
                    supplierQuotationId: sq.id,
                    purchaseOrderId: po.id,
                    oldTotal: purchaseOrderTotal,
                    newTotal: supplierQuotationTotal,
                    description: `Sincronizaria valor total do pedido: R$ ${purchaseOrderTotal.toFixed(2)} → R$ ${supplierQuotationTotal.toFixed(2)}`
                  });
                }
                fixResults.summary.valueDiscrepancies = (fixResults.summary.valueDiscrepancies || 0) + 1;
              }
            }
          }
        }

        // Update request total value if items were modified
        if (!dryRun && fixResults.fixes.length > 0) {
          // Recalculate total value
          const updatedItems = await storage.getPurchaseRequestItems(id);
          let totalValue = 0;
          
          // Get latest quotation values for calculation
          const latestQuotation = await pool.query(
            `SELECT sqi.total_price 
             FROM quotations q
             JOIN quotation_items qi ON q.id = qi.quotation_id
             JOIN supplier_quotation_items sqi ON sqi.quotation_item_id = qi.id
             WHERE q.purchase_request_id = $1 AND qi.purchase_request_item_id IS NOT NULL
             ORDER BY q.created_at DESC`,
            [id]
          );

          if (latestQuotation.rows.length > 0) {
            totalValue = latestQuotation.rows.reduce((sum, item) => sum + parseFloat(item.total_price || 0), 0);
            
            await storage.updatePurchaseRequest(id, {
              totalValue: totalValue
            });

            fixResults.fixes.push({
              type: 'total_value_update',
              action: 'updated_request_total_value',
              newTotalValue: totalValue,
              description: `Valor total da solicitação atualizado`
            });
          }

          // Log the fix action
          await pool.query(
            `INSERT INTO audit_logs (purchase_request_id, performed_by, action_type, action_description, performed_at)
             VALUES ($1, $2, $3, $4, NOW())`,
            [
              id,
              req.session.userId,
              'data_integrity_fix',
              `Correção de integridade de dados aplicada: ${fixResults.fixes.length} correções realizadas`
            ]
          );
        }

        fixResults.summary.totalFixes = fixResults.fixes.length;

        res.json(fixResults);
      } catch (error) {
        console.error("Error fixing purchase request data:", error);
        res.status(500).json({ message: "Falha ao corrigir dados da solicitação" });
      }
    }
  );

  // Endpoint para atualizar a fase do cartão (Kanban) com controle de permissões
  app.patch(
    "/api/purchase-requests/:id/update-phase",
    isAuthenticated,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const { newPhase } = req.body;
        const userId = req.session.userId;

        // Get current user data
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(401).json({ message: "User not found" });
        }

        // Get current request data
        const request = await storage.getPurchaseRequestById(id);
        if (!request) {
          return res
            .status(404)
            .json({ message: "Purchase request not found" });
        }

        // Verificar se a fase é válida
        const validPhases = [
          "solicitacao",
          "aprovacao_a1",
          "cotacao",
          "aprovacao_a2",
          "pedido_compra",
          "recebimento",
          "conclusao_compra",
          "arquivado",
        ] as const;
        if (!validPhases.includes(newPhase)) {
          return res.status(400).json({ message: "Invalid phase" });
        }

        // Permission checks based on current phase and user permissions
        const currentPhase = request.currentPhase;

        // Special permission for Admin/Manager to move from "arquivado" to "aprovacao_a1"
        if (currentPhase === "arquivado" && newPhase === "aprovacao_a1") {
          if (!user.isAdmin && !user.isManager) {
            return res.status(403).json({
              message:
                "Apenas Administradores e Gerentes podem reabrir solicitações arquivadas",
            });
          }
          // Admin/Manager can move from arquivado to aprovacao_a1, continue without other checks
        } else {
          // Normal permission checks for other phase transitions
          // Check if user has permission to move from current phase
          if (currentPhase === "aprovacao_a1" && !user.isApproverA1) {
            return res
              .status(403)
              .json({
                message:
                  "Você não possui permissão para mover cards da fase Aprovação A1",
              });
          }
        }

        // Additional check for A1 approvers - must have access to cost center
        if (currentPhase === "aprovacao_a1" && user.isApproverA1) {
          const userCostCenters = await storage.getUserCostCenters(userId);
          if (!userCostCenters.includes(request.costCenterId)) {
            return res.status(403).json({
              message:
                "Você não possui permissão para aprovar solicitações deste centro de custo",
            });
          }
        }

        if (currentPhase === "aprovacao_a2" && !user.isApproverA2) {
          return res
            .status(403)
            .json({
              message:
                "Você não possui permissão para mover cards da fase Aprovação A2",
            });
        }

        if (
          currentPhase === "recebimento" &&
          !user.isReceiver &&
          !user.isAdmin
        ) {
          return res
            .status(403)
            .json({
              message:
                "Você não possui permissão para mover cards da fase Recebimento",
            });
        }

        // Validate progression from "Cotação" to "Aprovação A2"
        if (currentPhase === "cotacao" && newPhase === "aprovacao_a2") {
          // Check if quotation exists
          const quotation = await storage.getQuotationByPurchaseRequestId(id);
          if (!quotation) {
            return res
              .status(400)
              .json({
                message:
                  "Não é possível avançar para Aprovação A2: Nenhuma cotação foi criada",
              });
          }

          // Check if at least one supplier quotation exists
          const supplierQuotations = await storage.getSupplierQuotations(
            quotation.id,
          );
          if (!supplierQuotations || supplierQuotations.length === 0) {
            return res
              .status(400)
              .json({
                message:
                  "Não é possível avançar para Aprovação A2: Nenhuma cotação de fornecedor foi recebida",
              });
          }

          // Check if a supplier has been chosen
          const hasChosenSupplier = supplierQuotations.some(
            (sq) => sq.isChosen,
          );
          if (!hasChosenSupplier) {
            return res
              .status(400)
              .json({
                message:
                  "Não é possível avançar para Aprovação A2: Nenhum fornecedor foi selecionado na análise de cotações",
              });
          }
        }

        // Automatic approval logic when moving from approval phases
        let updates: any = {
          currentPhase: newPhase,
        };

        // Automatic A1 approval when moving from "aprovacao_a1" to "cotacao"
        if (
          currentPhase === "aprovacao_a1" &&
          newPhase === "cotacao" &&
          user.isApproverA1
        ) {
          updates.approverA1Id = userId;
          updates.approvalDateA1 = new Date();
          updates.approvedA1 = true;

          // Create approval history entry
          await storage.createApprovalHistory({
            purchaseRequestId: id,
            approverType: "A1",
            approverId: userId,
            approved: true,
            rejectionReason: null,
          });
        }

        // Automatic A2 approval when moving from "aprovacao_a2" to "pedido_compra"
        if (
          currentPhase === "aprovacao_a2" &&
          newPhase === "pedido_compra" &&
          user.isApproverA2
        ) {
          updates.approverA2Id = userId;
          updates.approvalDateA2 = new Date();
          updates.approvedA2 = true;

          // Create approval history entry
          await storage.createApprovalHistory({
            purchaseRequestId: id,
            approverType: "A2",
            approverId: userId,
            approved: true,
            rejectionReason: null,
          });
        }

        const updatedRequest = await storage.updatePurchaseRequest(id, updates);

        // Send WebSocket notification for real-time updates
        const wsManager = app.get('wsManager');
        if (wsManager) {
          wsManager.notifyClients('purchase_requests', 'updated', {
            id: updatedRequest.id,
            currentPhase: updatedRequest.currentPhase,
            requestNumber: updatedRequest.requestNumber,
            updatedAt: updatedRequest.updatedAt
          });
        }

        // Send email notifications based on the new phase
        if (newPhase === "aprovacao_a1") {
          notifyApprovalA1(updatedRequest).catch((error) => {
            console.error(
              "Erro ao enviar notificação para aprovadores A1:",
              error,
            );
          });
        } else if (newPhase === "aprovacao_a2") {
          notifyApprovalA2(updatedRequest).catch((error) => {
            console.error(
              "Erro ao enviar notificação para aprovadores A2:",
              error,
            );
          });
        }

        // Invalidate cache to ensure frontend gets updated data
        invalidateCache(["/api/purchase-requests"]);

        res.json(updatedRequest);
      } catch (error) {
        console.error("Error updating request phase:", error);
        res.status(400).json({ message: "Failed to update phase" });
      }
    },
  );

  // New route for advancing from "Pedido de Compra" to "Recebimento"
  app.post(
    "/api/purchase-requests/:id/advance-to-receipt",
    isAuthenticated,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const userId = req.session.userId;

        // Get current user data
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(401).json({ message: "User not found" });
        }

        // Get current request data
        const request = await storage.getPurchaseRequestById(id);
        if (!request) {
          return res
            .status(404)
            .json({ message: "Purchase request not found" });
        }

        // Verify current phase is "pedido_compra"
        if (request.currentPhase !== "pedido_compra") {
          return res
            .status(400)
            .json({
              message:
                "Solicitação deve estar na fase 'Pedido de Compra' para avançar para recebimento",
            });
        }

        // Update phase to "recebimento"
        const updatedRequest = await storage.updatePurchaseRequest(id, {
          currentPhase: "recebimento",
        });

        // Create movement history entry
        await storage.createApprovalHistory({
          purchaseRequestId: id,
          approverType: "MOVEMENT",
          approverId: userId,
          approved: true,
          rejectionReason: null,
        });

        // Send WebSocket notification for real-time updates
        const wsManager = app.get('wsManager');
        if (wsManager) {
          wsManager.notifyClients('purchase_requests', 'updated', {
            id: updatedRequest.id,
            currentPhase: updatedRequest.currentPhase,
            requestNumber: updatedRequest.requestNumber,
            updatedAt: updatedRequest.updatedAt
          });
        }

        res.json(updatedRequest);
      } catch (error) {
        console.error("Error advancing to receipt:", error);
        res.status(400).json({ message: "Failed to advance to receipt" });
      }
    },
  );

  // Attachment routes for purchase requests removed - only keeping supplier attachments

  // POST route for purchase request attachments removed

  // Download attachment route
  app.get(
    "/api/attachments/:id/download",
    isAuthenticated,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);

        // Import database and schema
        const { db } = await import("./db");
        const { attachments } = await import("../shared/schema");
        const { eq } = await import("drizzle-orm");

        // Get attachment from database
        const attachment = await db
          .select()
          .from(attachments)
          .where(eq(attachments.id, id))
          .limit(1);

        if (!attachment[0]) {
          return res.status(404).json({ message: "Anexo não encontrado" });
        }

        const filePath = attachment[0].filePath;

        // Check if file exists
        if (!fs.existsSync(filePath)) {
          return res
            .status(404)
            .json({ message: "Arquivo não encontrado no servidor" });
        }

        // Set proper headers for file download
        const mimeType = mime.lookup(filePath) || "application/octet-stream";
        res.setHeader("Content-Type", mimeType);
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${attachment[0].fileName}"`,
        );

        // Stream file to response
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
      } catch (error) {
        console.error("Error downloading attachment:", error);
        res.status(500).json({ message: "Erro ao baixar arquivo" });
      }
    },
  );

  // Delete attachment route
  app.delete(
    "/api/attachments/:id",
    isAuthenticated,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const userId = req.session.userId;

        // Import database and schema
        const { db } = await import("./db");
        const { attachments, users, supplierQuotations } = await import("../shared/schema");
        const { eq, and } = await import("drizzle-orm");

        // Get attachment from database with related data
        const attachment = await db
          .select({
            id: attachments.id,
            fileName: attachments.fileName,
            filePath: attachments.filePath,
            supplierQuotationId: attachments.supplierQuotationId,
            purchaseRequestId: attachments.purchaseRequestId,
          })
          .from(attachments)
          .where(eq(attachments.id, id))
          .limit(1);

        if (!attachment[0]) {
          return res.status(404).json({ message: "Anexo não encontrado" });
        }

        // Get user information to check permissions
        const user = await db
          .select({
            id: users.id,
            role: users.role,
          })
          .from(users)
          .where(eq(users.id, userId!))
          .limit(1);

        if (!user[0]) {
          return res.status(401).json({ message: "Usuário não encontrado" });
        }

        // Check permissions
        let hasPermission = false;

        // Admin can delete any attachment
        if (user[0].role === "admin") {
          hasPermission = true;
        }
        // For supplier quotation attachments, check if user is buyer or admin
        else if (attachment[0].supplierQuotationId && (user[0].role === "buyer" || user[0].role === "admin")) {
          hasPermission = true;
        }
        // For purchase request attachments, check if user is the requester or has appropriate role
        else if (attachment[0].purchaseRequestId) {
          // Get purchase request to check if user is the requester
          const { purchaseRequests } = await import("../shared/schema");
          const purchaseRequest = await db
            .select({
              requesterId: purchaseRequests.requesterId,
            })
            .from(purchaseRequests)
            .where(eq(purchaseRequests.id, attachment[0].purchaseRequestId))
            .limit(1);

          if (purchaseRequest[0] && 
              (purchaseRequest[0].requesterId === userId || 
               user[0].role === "buyer" || 
               user[0].role === "admin")) {
            hasPermission = true;
          }
        }

        if (!hasPermission) {
          return res.status(403).json({ message: "Sem permissão para excluir este anexo" });
        }

        // Delete physical file if it exists
        const filePath = attachment[0].filePath;
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch (fileError) {
            console.error("Error deleting physical file:", fileError);
            // Continue with database deletion even if file deletion fails
          }
        }

        // Delete attachment from database
        await db.delete(attachments).where(eq(attachments.id, id));

        res.json({ message: "Anexo excluído com sucesso" });
      } catch (error) {
        console.error("Error deleting attachment:", error);
        res.status(500).json({ message: "Erro ao excluir anexo" });
      }
    },
  );

  // Quotation routes
  app.post(
    "/api/purchase-requests/:id/quotations",
    isAuthenticated,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const {
          supplierId,
          quotedValue,
          paymentConditions,
          deliveryDays,
          observations,
        } = req.body;

        // For now, return success response as quotation functionality is simplified
        res.status(201).json({
          id: Math.floor(Math.random() * 1000000), // Generate a reasonable temporary ID
          supplierId,
          quotedValue,
          paymentConditions,
          deliveryDays,
          observations,
        });
      } catch (error) {
        console.error("Error creating quotation:", error);
        res.status(400).json({ message: "Failed to create quotation" });
      }
    },
  );

  // Duplicate approval history route removed - using the working one above

  // Quotation history routes
  app.get(
    "/api/purchase-requests/:id/quotation-history",
    isAuthenticated,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        // For now, return empty array as quotation history functionality is not fully implemented
        res.json([]);
      } catch (error) {
        console.error("Error fetching quotation history:", error);
        res.status(500).json({ message: "Failed to fetch quotation history" });
      }
    },
  );

  // RFQ (Request for Quotation) routes
  app.get("/api/quotations", isAuthenticated, async (req, res) => {
    try {
      const quotations = await storage.getAllQuotations();
      res.json(quotations);
    } catch (error) {
      console.error("Error fetching quotations:", error);
      res.status(500).json({ message: "Failed to fetch quotations" });
    }
  });

  // Get quotation by purchase request ID
  app.get("/api/purchase-requests/:id/quotations", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const quotation = await storage.getQuotationByPurchaseRequestId(id);
      if (!quotation) {
        return res.status(404).json({ message: "Quotation not found" });
      }
      res.json(quotation);
    } catch (error) {
      console.error("Error fetching quotation:", error);
      res.status(500).json({ message: "Failed to fetch quotation" });
    }
  });

  app.get("/api/quotations/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const quotation = await storage.getQuotationById(id);
      if (!quotation) {
        return res.status(404).json({ message: "Quotation not found" });
      }
      res.json(quotation);
    } catch (error) {
      console.error("Error fetching quotation:", error);
      res.status(500).json({ message: "Failed to fetch quotation" });
    }
  });

  // Get quantity comparison between suppliers for a quotation
  app.get("/api/quotations/:id/quantity-comparison", isAuthenticated, async (req, res) => {
    try {
      const quotationId = parseInt(req.params.id);
      
      // Verify quotation exists
      const quotation = await storage.getQuotationById(quotationId);
      if (!quotation) {
        return res.status(404).json({ message: "Quotation not found" });
      }

      // Get quotation items (requested quantities)
      const quotationItems = await storage.getQuotationItems(quotationId);
      
      // Get all supplier quotations for this quotation
      const supplierQuotations = await storage.getSupplierQuotations(quotationId);
      
      // Get supplier quotation items with available quantities
      const comparison = [];
      
      for (const quotationItem of quotationItems) {
        const itemComparison = {
          quotationItemId: quotationItem.id,
          itemCode: quotationItem.itemCode,
          description: quotationItem.description,
          requestedQuantity: quotationItem.quantity,
          requestedUnit: quotationItem.unit,
          suppliers: []
        };

        for (const supplierQuotation of supplierQuotations) {
          const supplierItems = await storage.getSupplierQuotationItems(supplierQuotation.id);
          const supplierItem = supplierItems.find(item => item.quotationItemId === quotationItem.id);
          
          if (supplierItem) {
            const supplier = await storage.getSupplierById(supplierQuotation.supplierId);
            
            itemComparison.suppliers.push({
              supplierId: supplierQuotation.supplierId,
              supplierName: supplier?.name || 'Unknown',
              supplierQuotationId: supplierQuotation.id,
              supplierQuotationItemId: supplierItem.id,
              availableQuantity: supplierItem.availableQuantity || 0,
              confirmedUnit: supplierItem.confirmedUnit || supplierItem.unit,
              fulfillmentPercentage: supplierItem.fulfillmentPercentage || 0,
              unitPrice: supplierItem.unitPrice || 0,
              totalPrice: supplierItem.totalPrice || 0,
              quantityAdjustmentReason: supplierItem.quantityAdjustmentReason,
              isAvailable: supplierItem.isAvailable,
              unavailabilityReason: supplierItem.unavailabilityReason,
              deliveryDays: supplierItem.deliveryDays,
              brand: supplierItem.brand,
              model: supplierItem.model
            });
          }
        }

        comparison.push(itemComparison);
      }

      res.json({
        quotationId,
        quotationNumber: quotation.quotationNumber,
        comparison
      });
    } catch (error) {
      console.error("Error fetching quantity comparison:", error);
      res.status(500).json({ message: "Failed to fetch quantity comparison" });
    }
  });

  app.get(
    "/api/quotations/purchase-request/:purchaseRequestId",
    isAuthenticated,
    async (req, res) => {
      try {
        const purchaseRequestId = parseInt(req.params.purchaseRequestId);
        const quotation =
          await storage.getQuotationByPurchaseRequestId(purchaseRequestId);
        res.json(quotation || null);
      } catch (error) {
        console.error("Error fetching quotation by purchase request:", error);
        res.status(500).json({ message: "Failed to fetch quotation" });
      }
    },
  );

  app.get(
    "/api/quotations/purchase-request/:purchaseRequestId/history",
    isAuthenticated,
    async (req, res) => {
      try {
        const purchaseRequestId = parseInt(req.params.purchaseRequestId);
        const quotationHistory =
          await storage.getRFQHistoryByPurchaseRequestId(purchaseRequestId);
        res.json(quotationHistory);
      } catch (error) {
        console.error("Error fetching quotation history:", error);
        res.status(500).json({ message: "Failed to fetch quotation history" });
      }
    },
  );

  app.post("/api/quotations", isAuthenticated, async (req, res) => {
    try {
      // Create a schema that excludes createdBy from validation since we'll provide it from session
      const quotationApiSchema = z.object({
        purchaseRequestId: z.number(),
        quotationDeadline: z.string().transform((val) => new Date(val)),
        deliveryLocationId: z.number(),
        termsAndConditions: z.string().optional(),
        technicalSpecs: z.string().optional(),
      });

      const quotationDataForApi = quotationApiSchema.parse(req.body);

      // Get the current user to check if they are a buyer
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }

      // Get the purchase request to check if buyer_id is null
      const purchaseRequest = await storage.getPurchaseRequestById(
        quotationDataForApi.purchaseRequestId,
      );
      if (!purchaseRequest) {
        return res.status(404).json({ message: "Purchase request not found" });
      }

      // If the current user is a buyer and the purchase request doesn't have a buyer_id yet,
      // associate this buyer with the purchase request
      if (currentUser.isBuyer && !purchaseRequest.buyerId) {
        await storage.updatePurchaseRequest(purchaseRequest.id, {
          buyerId: currentUser.id,
        });
      }

      // Use session user ID instead of frontend-provided createdBy for security
      const quotation = await storage.createQuotation({
        ...quotationDataForApi,
        createdBy: req.session.userId!,
      });
      res.status(201).json(quotation);
    } catch (error) {
      console.error("Error creating quotation:", error);
      res.status(400).json({ message: "Invalid quotation data" });
    }
  });

  // Send RFQ to suppliers
  app.post(
    "/api/quotations/:id/send-rfq",
    isAuthenticated,
    async (req, res) => {
      try {
        const quotationId = parseInt(req.params.id);
        const { sendEmail = false, releaseWithoutEmail = false } = req.body;

        // Validar que pelo menos uma opção foi selecionada
        if (!sendEmail && !releaseWithoutEmail) {
          return res.status(400).json({
            message:
              "Você deve selecionar pelo menos uma opção: enviar por e-mail ou liberar sem e-mail",
          });
        }

        // Get quotation details
        const quotation = await storage.getQuotationById(quotationId);
        if (!quotation) {
          return res.status(404).json({ message: "Quotation not found" });
        }

        // Get purchase request
        const purchaseRequest = await storage.getPurchaseRequestById(
          quotation.purchaseRequestId,
        );
        if (!purchaseRequest) {
          return res
            .status(404)
            .json({ message: "Purchase request not found" });
        }

        // Get the current user to check if they are a buyer
        const currentUser = await storage.getUser(req.session.userId!);
        if (!currentUser) {
          return res.status(401).json({ message: "User not found" });
        }

        // If the current user is a buyer and the purchase request doesn't have a buyer_id yet,
        // associate this buyer with the purchase request
        if (currentUser.isBuyer && !purchaseRequest.buyerId) {
          await storage.updatePurchaseRequest(purchaseRequest.id, {
            buyerId: currentUser.id,
          });
        }

        // Get quotation items
        const quotationItems = await storage.getQuotationItems(quotationId);

        // Get supplier quotations to know which suppliers to send to
        const supplierQuotations =
          await storage.getSupplierQuotations(quotationId);
        const supplierIds = supplierQuotations.map((sq) => sq.supplierId);

        // Get suppliers data
        const allSuppliers = await storage.getAllSuppliers();
        const selectedSuppliers = allSuppliers.filter((s) =>
          supplierIds.includes(s.id),
        );

        if (sendEmail && selectedSuppliers.length > 0) {
          // Import email service
          const { sendRFQToSuppliers } = await import("./email-service");

          // Get logged-in user's email
          const loggedUser = await storage.getUser(req.session.userId!);
          const senderEmail = loggedUser?.email;

          // Prepare email data
          const rfqData = {
            quotationNumber: quotation.quotationNumber,
            requestNumber: purchaseRequest.requestNumber,
            quotationDeadline: quotation.quotationDeadline
              ? quotation.quotationDeadline.toISOString()
              : "",
            items: quotationItems.map((item) => ({
              itemCode: item.itemCode,
              description: item.description,
              quantity: item.quantity,
              unit: item.unit,
              specifications: item.specifications || "",
            })),
            termsAndConditions: quotation.termsAndConditions || "",
            technicalSpecs: quotation.technicalSpecs || "",
          };

          // Send emails with logged-in user's email as sender
          const emailResult = await sendRFQToSuppliers(
            selectedSuppliers,
            rfqData,
            senderEmail,
          );

          // Update quotation status to 'sent'
          await storage.updateQuotation(quotationId, {
            status: "sent",
          });

          // Update supplier quotations status
          for (const sq of supplierQuotations) {
            await storage.updateSupplierQuotation(sq.id, {
              status: "sent",
              sentAt: new Date(),
            });
          }

          return res.json({
            success: true,
            message: `RFQ enviada por e-mail para ${selectedSuppliers.length} fornecedor(es)`,
            emailResult: {
              sent: emailResult.success,
              errors: emailResult.errors,
            },
            action: "email_sent",
          });
        } else if (releaseWithoutEmail) {
          // Release RFQ without sending emails - just update status
          await storage.updateQuotation(quotationId, {
            status: "sent",
          });

          // Update supplier quotations status
          for (const sq of supplierQuotations) {
            await storage.updateSupplierQuotation(sq.id, {
              status: "sent",
              sentAt: new Date(),
            });
          }

          return res.json({
            success: true,
            message: "RFQ liberada para a próxima etapa sem envio de e-mail",
            action: "released_without_email",
          });
        } else {
          // Fallback - just update status without sending emails
          await storage.updateQuotation(quotationId, {
            status: "sent",
          });

          return res.json({
            success: true,
            message: "Status da cotação atualizado",
            action: "status_updated",
          });
        }
      } catch (error) {
        console.error("Error sending RFQ:", error);
        res.status(500).json({
          message: "Erro ao processar RFQ",
          error: error instanceof Error ? error.message : "Erro desconhecido",
        });
      }
    },
  );

  app.put("/api/quotations/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const quotationData = insertQuotationSchema.partial().parse(req.body);

      // Get the current user to check if they are a buyer
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }

      // Get the quotation to find the purchase request
      const existingQuotation = await storage.getQuotationById(id);
      if (!existingQuotation) {
        return res.status(404).json({ message: "Quotation not found" });
      }

      // Get the purchase request to check if buyer_id is null
      const purchaseRequest = await storage.getPurchaseRequestById(
        existingQuotation.purchaseRequestId,
      );
      if (!purchaseRequest) {
        return res.status(404).json({ message: "Purchase request not found" });
      }

      // If the current user is a buyer and the purchase request doesn't have a buyer_id yet,
      // associate this buyer with the purchase request
      if (currentUser.isBuyer && !purchaseRequest.buyerId) {
        await storage.updatePurchaseRequest(purchaseRequest.id, {
          buyerId: currentUser.id,
        });
      }

      // Capture changes for notifications and versioning
      const changes = [];
      const criticalFields = ['quotationDeadline', 'termsAndConditions', 'technicalSpecs', 'status'];
      
      for (const field of criticalFields) {
        if (quotationData[field] !== undefined && 
            quotationData[field] !== existingQuotation[field]) {
          changes.push({
            field,
            previousValue: existingQuotation[field],
            newValue: quotationData[field]
          });
        }
      }

      const quotation = await storage.updateQuotation(id, quotationData);

      // Send notifications for critical changes
      if (changes.length > 0) {
        try {
          // Check for deadline changes specifically
          const deadlineChange = changes.find(c => c.field === 'quotationDeadline');
          if (deadlineChange) {
            await notificationService.sendDeadlineChangeNotification(
              id,
              new Date(deadlineChange.previousValue),
              new Date(deadlineChange.newValue),
              currentUser.id
            );
          }

          // Send critical change notifications for other fields
          const otherChanges = changes.filter(c => c.field !== 'quotationDeadline');
          if (otherChanges.length > 0) {
            await notificationService.sendCriticalChangeNotification(
              id,
              otherChanges,
              currentUser.id
            );
          }

          // Create version history for significant changes
          if (changes.some(c => ['quotationDeadline', 'termsAndConditions', 'technicalSpecs'].includes(c.field))) {
            const changeType = deadlineChange ? 'deadline_extended' : 'terms_changed';
            const changeDescription = `Alterações em: ${changes.map(c => c.field).join(', ')}`;
            
            await quotationVersionService.createVersion({
              quotationId: id,
              changeType,
              changeDescription,
              changes,
              reasonForChange: 'Atualização de cotação',
              impactAssessment: 'Alterações que podem afetar fornecedores',
              changedBy: currentUser.id
            });
          }
        } catch (notificationError) {
          console.error("Error sending notifications or creating version:", notificationError);
          // Don't fail the main operation due to notification errors
        }
      }

      res.json(quotation);
    } catch (error) {
      console.error("Error updating quotation:", error);
      res.status(400).json({ message: "Failed to update quotation" });
    }
  });

  // Quotation Items routes
  app.get(
    "/api/quotations/:quotationId/items",
    isAuthenticated,
    async (req, res) => {
      try {
        const quotationId = parseInt(req.params.quotationId);

        if (isNaN(quotationId)) {
          return res.status(400).json({ message: "Invalid quotation ID" });
        }

        const items = await storage.getQuotationItems(quotationId);
        res.json(items);
      } catch (error) {
        console.error("Error fetching quotation items:", error);
        res.status(500).json({ message: "Failed to fetch quotation items" });
      }
    },
  );

  app.post(
    "/api/quotations/:quotationId/items",
    isAuthenticated,
    async (req, res) => {
      try {
        const quotationId = parseInt(req.params.quotationId);
        const itemData = insertQuotationItemSchema.parse({
          ...req.body,
          quotationId,
        });

        // Get the current user to check if they are a buyer
        const currentUser = await storage.getUser(req.session.userId!);
        if (!currentUser) {
          return res.status(401).json({ message: "User not found" });
        }

        // Get the quotation to find the purchase request
        const quotation = await storage.getQuotationById(quotationId);
        if (!quotation) {
          return res.status(404).json({ message: "Quotation not found" });
        }

        // Get the purchase request to check if buyer_id is null
        const purchaseRequest = await storage.getPurchaseRequestById(
          quotation.purchaseRequestId,
        );
        if (!purchaseRequest) {
          return res
            .status(404)
            .json({ message: "Purchase request not found" });
        }

        // If the current user is a buyer and the purchase request doesn't have a buyer_id yet,
        // associate this buyer with the purchase request
        if (currentUser.isBuyer && !purchaseRequest.buyerId) {
          await storage.updatePurchaseRequest(purchaseRequest.id, {
            buyerId: currentUser.id,
          });
        }

        const item = await storage.createQuotationItem(itemData);
        res.status(201).json(item);
      } catch (error) {
        console.error("Error creating quotation item:", error);
        res.status(400).json({ message: "Invalid quotation item data" });
      }
    },
  );

  app.put("/api/quotation-items/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const itemData = insertQuotationItemSchema.partial().parse(req.body);

      // Get the current user to check if they are a buyer
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }

      // Since we don't have a direct way to get quotation from quotation item,
      // we'll check if the user is a buyer and handle the buyer_id association
      // in the main quotation operations. This is a less critical operation.

      const item = await storage.updateQuotationItem(id, itemData);
      res.json(item);
    } catch (error) {
      console.error("Error updating quotation item:", error);
      res.status(400).json({ message: "Failed to update quotation item" });
    }
  });

  app.delete("/api/quotation-items/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      // Get the current user to check if they are a buyer
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }

      // Since we don't have a direct way to get quotation from quotation item,
      // we'll check if the user is a buyer and handle the buyer_id association
      // in the main quotation operations. This is a less critical operation.

      await storage.deleteQuotationItem(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting quotation item:", error);
      res.status(400).json({ message: "Failed to delete quotation item" });
    }
  });

  // Supplier Quotations routes
  app.get(
    "/api/quotations/:quotationId/supplier-quotations",
    isAuthenticated,
    async (req, res) => {
      try {
        const quotationId = parseInt(req.params.quotationId);

        if (isNaN(quotationId)) {
          return res.status(400).json({ message: "Invalid quotation ID" });
        }

        const supplierQuotations =
          await storage.getSupplierQuotations(quotationId);
        res.json(supplierQuotations);
      } catch (error) {
        console.error("Error fetching supplier quotations:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch supplier quotations" });
      }
    },
  );

  app.post(
    "/api/quotations/:quotationId/supplier-quotations",
    isAuthenticated,
    async (req, res) => {
      try {
        const quotationId = parseInt(req.params.quotationId);
        const supplierQuotationData = insertSupplierQuotationSchema.parse({
          ...req.body,
          quotationId,
        });
        const supplierQuotation = await storage.createSupplierQuotation(
          supplierQuotationData,
        );
        res.status(201).json(supplierQuotation);
      } catch (error) {
        console.error("Error creating supplier quotation:", error);
        res.status(400).json({ message: "Invalid supplier quotation data" });
      }
    },
  );

  // Get specific supplier quotation for a quotation
  app.get(
    "/api/quotations/:quotationId/supplier-quotations/:supplierId",
    isAuthenticated,
    async (req, res) => {
      try {
        const quotationId = parseInt(req.params.quotationId);
        const supplierId = parseInt(req.params.supplierId);

        const supplierQuotations =
          await storage.getSupplierQuotations(quotationId);
        const supplierQuotation = supplierQuotations.find(
          (sq) => sq.supplierId === supplierId,
        );

        if (!supplierQuotation) {
          return res.json(null);
        }

        // Get items for this supplier quotation
        const items = await storage.getSupplierQuotationItems(
          supplierQuotation.id,
        );

        res.json({
          ...supplierQuotation,
          items,
        });
      } catch (error) {
        console.error("Error fetching supplier quotation:", error);
        res.status(500).json({ message: "Failed to fetch supplier quotation" });
      }
    },
  );

  app.put("/api/supplier-quotations/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const supplierQuotationData = insertSupplierQuotationSchema
        .partial()
        .parse(req.body);

      // Get the current user to check if they are a buyer
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }

      // Get the supplier quotation to find the quotation and purchase request
      const existingSupplierQuotation =
        await storage.getSupplierQuotationById(id);
      if (!existingSupplierQuotation) {
        return res
          .status(404)
          .json({ message: "Supplier quotation not found" });
      }

      // Get the quotation to find the purchase request
      const quotation = await storage.getQuotationById(
        existingSupplierQuotation.quotationId,
      );
      if (!quotation) {
        return res.status(404).json({ message: "Quotation not found" });
      }

      // Get the purchase request to check if buyer_id is null
      const purchaseRequest = await storage.getPurchaseRequestById(
        quotation.purchaseRequestId,
      );
      if (!purchaseRequest) {
        return res.status(404).json({ message: "Purchase request not found" });
      }

      // If the current user is a buyer and the purchase request doesn't have a buyer_id yet,
      // associate this buyer with the purchase request
      if (currentUser.isBuyer && !purchaseRequest.buyerId) {
        await storage.updatePurchaseRequest(purchaseRequest.id, {
          buyerId: currentUser.id,
        });
      }

      // Capture changes for notifications
      const changes = [];
      const criticalFields = ['totalValue', 'status', 'paymentTerms', 'deliveryTerms'];
      
      for (const field of criticalFields) {
        if (supplierQuotationData[field] !== undefined && 
            supplierQuotationData[field] !== existingSupplierQuotation[field]) {
          changes.push({
            field,
            previousValue: existingSupplierQuotation[field],
            newValue: supplierQuotationData[field]
          });
        }
      }

      const supplierQuotation = await storage.updateSupplierQuotation(
        id,
        supplierQuotationData,
      );

      // Send notifications for critical changes
      if (changes.length > 0) {
        try {
          await notificationService.sendCriticalChangeNotification(
            quotation.id,
            changes,
            currentUser.id
          );
        } catch (notificationError) {
          console.error("Error sending notifications:", notificationError);
          // Don't fail the main operation due to notification errors
        }
      }

      res.json(supplierQuotation);
    } catch (error) {
      console.error("Error updating supplier quotation:", error);
      res.status(400).json({ message: "Failed to update supplier quotation" });
    }
  });

  // Endpoint para sincronização de cotações
  app.post("/api/quotations/:quotationId/sync", isAuthenticated, async (req, res) => {
    try {
      const quotationId = parseInt(req.params.quotationId);
      
      if (isNaN(quotationId)) {
        return res.status(400).json({ message: "Invalid quotation ID" });
      }

      await quotationSyncService.syncQuotationItems(quotationId);
      res.json({ message: "Sincronização concluída com sucesso" });
    } catch (error) {
      console.error("Erro na sincronização:", error);
      res.status(500).json({ message: "Erro na sincronização" });
    }
  });

  // Endpoint para validação de consistência
  app.get("/api/quotations/:quotationId/validate", isAuthenticated, async (req, res) => {
    try {
      const quotationId = parseInt(req.params.quotationId);
      
      if (isNaN(quotationId)) {
        return res.status(400).json({ message: "Invalid quotation ID" });
      }

      const validationResults = await quotationSyncService.validateQuantityConsistency(quotationId);
      res.json(validationResults);
    } catch (error) {
      console.error("Erro na validação:", error);
      res.status(500).json({ message: "Erro na validação" });
    }
  });

  // Endpoint para corrigir mapeamentos
  app.post("/api/quotations/:quotationId/fix-mappings", isAuthenticated, async (req, res) => {
    try {
      const quotationId = parseInt(req.params.quotationId);
      
      if (isNaN(quotationId)) {
        return res.status(400).json({ message: "Invalid quotation ID" });
      }

      await quotationSyncService.fixMissingMappings(quotationId);
      res.json({ message: "Mapeamentos corrigidos com sucesso" });
    } catch (error) {
      console.error("Erro ao corrigir mapeamentos:", error);
      res.status(500).json({ message: "Erro ao corrigir mapeamentos" });
    }
  });

  // Quotation Versioning Endpoints
  
  // Create new version when quotation is modified
  app.post("/api/quotations/:quotationId/versions", isAuthenticated, async (req, res) => {
    try {
      const quotationId = parseInt(req.params.quotationId);
      const { changeType, changeDescription, changes, itemsAffected, reasonForChange, impactAssessment } = req.body;
      
      if (isNaN(quotationId)) {
        return res.status(400).json({ message: "Invalid quotation ID" });
      }

      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }

      // Validate the changes before creating version
      const validation = await quotationVersionService.validateVersionChange(quotationId, changes);
      if (!validation.valid) {
        return res.status(400).json({ 
          message: "Invalid changes", 
          errors: validation.errors 
        });
      }

      const versionData = {
        quotationId,
        changeType,
        changeDescription,
        changes,
        itemsAffected,
        reasonForChange,
        impactAssessment,
        changedBy: currentUser.id
      };

      const result = await quotationVersionService.createVersion(versionData);
      res.json(result);
    } catch (error) {
      console.error("Error creating quotation version:", error);
      res.status(500).json({ message: "Failed to create version" });
    }
  });

  // Get version history for a quotation
  app.get("/api/quotations/:quotationId/versions", isAuthenticated, async (req, res) => {
    try {
      const quotationId = parseInt(req.params.quotationId);
      
      if (isNaN(quotationId)) {
        return res.status(400).json({ message: "Invalid quotation ID" });
      }

      const history = await quotationVersionService.getVersionHistory(quotationId);
      res.json(history);
    } catch (error) {
      console.error("Error fetching version history:", error);
      res.status(500).json({ message: "Failed to fetch version history" });
    }
  });

  // Get specific version details
  app.get("/api/quotations/versions/:versionId", isAuthenticated, async (req, res) => {
    try {
      const versionId = parseInt(req.params.versionId);
      
      if (isNaN(versionId)) {
        return res.status(400).json({ message: "Invalid version ID" });
      }

      const version = await quotationVersionService.getVersionDetails(versionId);
      if (!version) {
        return res.status(404).json({ message: "Version not found" });
      }

      res.json(version);
    } catch (error) {
      console.error("Error fetching version details:", error);
      res.status(500).json({ message: "Failed to fetch version details" });
    }
  });

  // Compare two versions
  app.get("/api/quotations/:quotationId/versions/compare", isAuthenticated, async (req, res) => {
    try {
      const quotationId = parseInt(req.params.quotationId);
      const version1 = parseInt(req.query.version1 as string);
      const version2 = parseInt(req.query.version2 as string);
      
      if (isNaN(quotationId) || isNaN(version1) || isNaN(version2)) {
        return res.status(400).json({ message: "Invalid parameters" });
      }

      const comparison = await quotationVersionService.compareVersions(quotationId, version1, version2);
      res.json(comparison);
    } catch (error) {
      console.error("Error comparing versions:", error);
      res.status(500).json({ message: "Failed to compare versions" });
    }
  });

  // Rollback to a specific version
  app.post("/api/quotations/:quotationId/versions/:targetVersion/rollback", isAuthenticated, async (req, res) => {
    try {
      const quotationId = parseInt(req.params.quotationId);
      const targetVersion = parseInt(req.params.targetVersion);
      
      if (isNaN(quotationId) || isNaN(targetVersion)) {
        return res.status(400).json({ message: "Invalid parameters" });
      }

      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }

      // Check if user has permission to rollback (admin or manager)
      if (!currentUser.isAdmin && !currentUser.isManager) {
        return res.status(403).json({ message: "Insufficient permissions for rollback" });
      }

      const result = await quotationVersionService.rollbackToVersion(quotationId, targetVersion, currentUser.id);
      res.json(result);
    } catch (error) {
      console.error("Error rolling back version:", error);
      res.status(500).json({ message: "Failed to rollback version" });
    }
  });

  // Get latest version number
  app.get("/api/quotations/:quotationId/latest-version", isAuthenticated, async (req, res) => {
    try {
      const quotationId = parseInt(req.params.quotationId);
      
      if (isNaN(quotationId)) {
        return res.status(400).json({ message: "Invalid quotation ID" });
      }

      const latestVersion = await quotationVersionService.getLatestVersion(quotationId);
      res.json({ version: latestVersion });
    } catch (error) {
      console.error("Error fetching latest version:", error);
      res.status(500).json({ message: "Failed to fetch latest version" });
    }
  });

  // Update available quantities for supplier quotation items (with atomic transactions)
  app.put("/api/supplier-quotations/:id/update-quantities", isAuthenticated, QuantityValidationMiddleware.fullValidation, async (req, res) => {
    try {
      const supplierQuotationId = parseInt(req.params.id);
      const { items } = req.body;

      if (!Array.isArray(items)) {
        return res.status(400).json({ message: "Items array is required" });
      }

      // Get the current user
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }

      // Get supplier quotation to find quotation ID for notifications
      const supplierQuotation = await storage.getSupplierQuotationById(supplierQuotationId);
      if (!supplierQuotation) {
        return res.status(404).json({ message: "Supplier quotation not found" });
      }

      // Get client IP and user agent for audit trail
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';
      const sessionId = req.sessionID || 'unknown';

      // Capture quantity changes for notifications
      const quantityChanges = [];
      for (const item of items) {
        if (item.previousQuantity !== undefined && item.availableQuantity !== undefined) {
          quantityChanges.push({
            field: 'availableQuantity',
            itemId: item.id,
            previousValue: item.previousQuantity,
            newValue: item.availableQuantity
          });
        }
      }

      // Use atomic transaction function for quantity updates
      const result = await storage.db.query(`
        SELECT atomic_update_supplier_quotation_quantities($1, $2, $3, $4, $5, $6) as result
      `, [
        supplierQuotationId,
        JSON.stringify(items),
        currentUser.id,
        sessionId,
        clientIp,
        userAgent
      ]);

      const atomicResult = result.rows[0].result;

      if (!atomicResult.success) {
        return res.status(400).json({
          message: atomicResult.error || "Failed to update quantities",
          error_code: atomicResult.error_code,
          errors: atomicResult.errors || [],
          transaction_id: atomicResult.transaction_id
        });
      }

      // Send quantity change notifications
      if (quantityChanges.length > 0) {
        try {
          await notificationService.sendQuantityChangeNotification(
            supplierQuotation.quotationId,
            quantityChanges,
            currentUser.id
          );
        } catch (notificationError) {
          console.error("Error sending quantity change notifications:", notificationError);
          // Don't fail the main operation due to notification errors
        }
      }

      // Return success response with detailed information
      res.json({
        message: "Quantities updated successfully with atomic transaction",
        success: true,
        transaction_id: atomicResult.transaction_id,
        summary: atomicResult.summary,
        updated_items: atomicResult.updated_items,
        errors: atomicResult.errors || []
      });

    } catch (error) {
      console.error("Error in atomic quantity update:", error);
      res.status(500).json({ 
        message: "Failed to update quantities", 
        error: error.message,
        success: false
      });
    }
  });

  // Supplier Quotation Items routes
  app.get(
    "/api/supplier-quotations/:supplierQuotationId/items",
    isAuthenticated,
    async (req, res) => {
      try {
        const supplierQuotationId = parseInt(req.params.supplierQuotationId);
        const items =
          await storage.getSupplierQuotationItems(supplierQuotationId);
        res.json(items);
      } catch (error) {
        console.error("Error fetching supplier quotation items:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch supplier quotation items" });
      }
    },
  );

  app.post(
    "/api/supplier-quotations/:supplierQuotationId/items",
    isAuthenticated,
    async (req, res) => {
      try {
        const supplierQuotationId = parseInt(req.params.supplierQuotationId);
        const itemData = insertSupplierQuotationItemSchema.parse({
          ...req.body,
          supplierQuotationId,
        });

        // Get the current user to check if they are a buyer
        const currentUser = await storage.getUser(req.session.userId!);
        if (!currentUser) {
          return res.status(401).json({ message: "User not found" });
        }

        // Get the supplier quotation to find the quotation and purchase request
        const supplierQuotation =
          await storage.getSupplierQuotationById(supplierQuotationId);
        if (!supplierQuotation) {
          return res
            .status(404)
            .json({ message: "Supplier quotation not found" });
        }

        // Get the quotation to find the purchase request
        const quotation = await storage.getQuotationById(
          supplierQuotation.quotationId,
        );
        if (!quotation) {
          return res.status(404).json({ message: "Quotation not found" });
        }

        // Get the purchase request to check if buyer_id is null
        const purchaseRequest = await storage.getPurchaseRequestById(
          quotation.purchaseRequestId,
        );
        if (!purchaseRequest) {
          return res
            .status(404)
            .json({ message: "Purchase request not found" });
        }

        // If the current user is a buyer and the purchase request doesn't have a buyer_id yet,
        // associate this buyer with the purchase request
        if (currentUser.isBuyer && !purchaseRequest.buyerId) {
          await storage.updatePurchaseRequest(purchaseRequest.id, {
            buyerId: currentUser.id,
          });
        }

        const item = await storage.createSupplierQuotationItem(itemData);
        res.status(201).json(item);
      } catch (error) {
        console.error("Error creating supplier quotation item:", error);
        res
          .status(400)
          .json({ message: "Invalid supplier quotation item data" });
      }
    },
  );

  app.put(
    "/api/supplier-quotation-items/:id",
    isAuthenticated,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const itemData = insertSupplierQuotationItemSchema
          .partial()
          .parse(req.body);

        // Get the current user to check if they are a buyer
        const currentUser = await storage.getUser(req.session.userId!);
        if (!currentUser) {
          return res.status(401).json({ message: "User not found" });
        }

        // Since we don't have getSupplierQuotationItemById, we'll check if the user is a buyer
        // and if they are, we'll try to find the purchase request through the supplierQuotationId
        // that might be provided in the request body or we'll skip this check for now
        // The buyer_id association will happen in other operations like creating/updating quotations

        const item = await storage.updateSupplierQuotationItem(id, itemData);
        res.json(item);
      } catch (error) {
        console.error("Error updating supplier quotation item:", error);
        res
          .status(400)
          .json({ message: "Failed to update supplier quotation item" });
      }
    },
  );

  // Rota para deletar uma requisição de compra
  app.delete(
    "/api/purchase-requests/:id",
    isAuthenticated,
    async (req, res) => {
      try {
        const requestId = Number(req.params.id);
        const request = await storage.getPurchaseRequestById(requestId);

        if (!request) {
          return res.status(404).json({ message: "Requisição não encontrada" });
        }

        if (request.currentPhase !== "solicitacao") {
          return res
            .status(400)
            .json({
              message:
                "Só é possível excluir requisições na fase de Solicitação",
            });
        }

        if (request.approvedA1 !== null) {
          return res
            .status(400)
            .json({
              message:
                "Não é possível excluir uma requisição já aprovada/reprovada",
            });
        }

        await storage.deletePurchaseRequest(requestId);

        res.json({ message: "Requisição excluída com sucesso" });
      } catch (error) {
        console.error("Erro ao excluir requisição:", error);
        res.status(500).json({ message: "Erro ao excluir requisição" });
      }
    },
  );

  // Rota para arquivar diretamente uma requisição
  app.post(
    "/api/purchase-requests/:id/archive-direct",
    isAuthenticated,
    isAdminOrBuyer,
    async (req, res) => {
      try {
        const requestId = Number(req.params.id);
        const request = await storage.getPurchaseRequestById(requestId);

        if (!request) {
          return res.status(404).json({ message: "Requisição não encontrada" });
        }

        await storage.updatePurchaseRequest(requestId, {
          currentPhase: "arquivado",
        });

        // Invalidate cache for purchase requests
        invalidateCache(["/api/purchase-requests"]);

        const updatedRequest = await storage.getPurchaseRequestById(requestId);
        res.json(updatedRequest);
      } catch (error) {
        console.error("Erro ao arquivar requisição:", error);
        res.status(500).json({ message: "Erro ao arquivar requisição" });
      }
    },
  );

  // Rota para atualizar cotação de fornecedor (marcar como recebida com valores)
  app.post(
    "/api/quotations/:quotationId/update-supplier-quotation",
    isAuthenticated,
    async (req, res) => {
      try {
        const quotationId = parseInt(req.params.quotationId);
        const {
          supplierId,
          items,
          totalValue,
          paymentTerms,
          deliveryTerms,
          warrantyPeriod,
          observations,
          subtotalValue,
          finalValue,
          discountType,
          discountValue,
          includesFreight,
          freightValue,
        } = req.body;

        // Update supplier quotation request processing

        if (!supplierId) {
          return res
            .status(400)
            .json({ message: "ID do fornecedor é obrigatório" });
        }

        // Buscar a cotação
        const quotation = await storage.getQuotationById(quotationId);
        if (!quotation) {
          return res.status(404).json({ message: "Cotação não encontrada" });
        }

        // Get the current user to check if they are a buyer
        const currentUser = await storage.getUser(req.session.userId!);
        if (!currentUser) {
          return res.status(401).json({ message: "User not found" });
        }

        // Get the purchase request to check if buyer_id is null
        const purchaseRequest = await storage.getPurchaseRequestById(
          quotation.purchaseRequestId,
        );
        if (!purchaseRequest) {
          return res
            .status(404)
            .json({ message: "Purchase request not found" });
        }

        // If the current user is a buyer and the purchase request doesn't have a buyer_id yet,
        // associate this buyer with the purchase request
        if (currentUser.isBuyer && !purchaseRequest.buyerId) {
          await storage.updatePurchaseRequest(purchaseRequest.id, {
            buyerId: currentUser.id,
          });
        }

        // Buscar cotação do fornecedor
        const supplierQuotations =
          await storage.getSupplierQuotations(quotationId);
        let supplierQuotation = supplierQuotations.find(
          (sq) => sq.supplierId === supplierId,
        );

        if (!supplierQuotation) {
          // Criar nova cotação do fornecedor se não existir
          supplierQuotation = await storage.createSupplierQuotation({
            quotationId,
            supplierId,
            status: "received",
            totalValue: null,
            sentAt: null,
            receivedAt: new Date(),
          });
        }

        // Atualizar a cotação do fornecedor
        const updateData = {
          status: "received",
          totalValue: totalValue || null,
          subtotalValue: subtotalValue || null,
          finalValue: finalValue || null,
          discountType: discountType || null,
          discountValue: discountValue || null,
          paymentTerms: paymentTerms || null,
          deliveryTerms: deliveryTerms || null,
          warrantyPeriod: warrantyPeriod || null,
          observations: observations || null,
          includesFreight: includesFreight || false,
          freightValue: freightValue || null,
          receivedAt: new Date(),
        };

        await storage.updateSupplierQuotation(supplierQuotation.id, updateData);

        // Atualizar ou criar itens da cotação
        if (items && items.length > 0) {
          // Buscar itens existentes
          const existingItems = await storage.getSupplierQuotationItems(
            supplierQuotation.id,
          );

          for (const item of items) {
            const existingItem = existingItems.find(
              (ei) => ei.quotationItemId === item.quotationItemId,
            );

            if (existingItem) {
              // Buscar quantidade do item de cotação
              const quotationItems =
                await storage.getQuotationItems(quotationId);
              const quotationItem = quotationItems.find(
                (qi) => qi.id === item.quotationItemId,
              );
              const quantity = parseFloat(quotationItem?.quantity || "1");

              // Validar e transformar dados do item usando o schema
              const validatedItemData = insertSupplierQuotationItemSchema.partial().parse({
                unitPrice: item.unitPrice?.toString(),
                totalPrice: (item.unitPrice * quantity).toString(),
                originalTotalPrice: item.originalTotalPrice?.toString() || null,
                discountPercentage: item.discountPercentage?.toString() || null,
                discountValue: item.discountValue?.toString() || null,
                discountedTotalPrice: item.discountedTotalPrice?.toString() || null,
                deliveryDays: item.deliveryDays,
                brand: item.brand,
                model: item.model,
                observations: item.observations,
                isAvailable: item.isAvailable,
                unavailabilityReason: item.unavailabilityReason,
                availableQuantity: item.availableQuantity,
                confirmedUnit: item.confirmedUnit,
                quantityAdjustmentReason: item.quantityAdjustmentReason,
              });

              // Atualizar item existente
              await storage.updateSupplierQuotationItem(existingItem.id, validatedItemData);
            } else {
              // Buscar quantidade do item de cotação
              const quotationItems =
                await storage.getQuotationItems(quotationId);
              const quotationItem = quotationItems.find(
                (qi) => qi.id === item.quotationItemId,
              );
              const quantity = parseFloat(quotationItem?.quantity || "1");

              // Validar e transformar dados do item usando o schema
              const validatedItemData = insertSupplierQuotationItemSchema.parse({
                supplierQuotationId: supplierQuotation.id,
                quotationItemId: item.quotationItemId,
                unitPrice: item.unitPrice?.toString(),
                totalPrice: (item.unitPrice * quantity).toString(),
                originalTotalPrice: item.originalTotalPrice?.toString() || null,
                discountPercentage: item.discountPercentage?.toString() || null,
                discountValue: item.discountValue?.toString() || null,
                discountedTotalPrice: item.discountedTotalPrice?.toString() || null,
                deliveryDays: item.deliveryDays,
                brand: item.brand,
                model: item.model,
                observations: item.observations,
                isAvailable: item.isAvailable,
                unavailabilityReason: item.unavailabilityReason,
                availableQuantity: item.availableQuantity,
                confirmedUnit: item.confirmedUnit,
                quantityAdjustmentReason: item.quantityAdjustmentReason,
              });

              // Criar novo item
              await storage.createSupplierQuotationItem(validatedItemData);
            }
          }
        }

        res.json({ message: "Cotação do fornecedor atualizada com sucesso" });
      } catch (error) {
        console.error("Error updating supplier quotation:", error);
        res
          .status(500)
          .json({ message: "Erro ao atualizar cotação do fornecedor" });
      }
    },
  );

  // Upload supplier quotation files
  app.post(
    "/api/quotations/:quotationId/upload-supplier-file",
    isAuthenticated,
    quotationUpload.single("file"),
    async (req, res) => {
      try {
        const quotationId = parseInt(req.params.quotationId);
        const { attachmentType, supplierId } = req.body;

        if (!req.file) {
          console.error("No file received in upload request");
          return res
            .status(400)
            .json({ message: "Nenhum arquivo foi enviado" });
        }

        if (!supplierId) {
          console.error("No supplierId provided in upload request");
          return res
            .status(400)
            .json({ message: "ID do fornecedor é obrigatório" });
        }

        // Find supplier quotation
        const supplierQuotations =
          await storage.getSupplierQuotations(quotationId);
        const supplierQuotation = supplierQuotations.find(
          (sq) => sq.supplierId === parseInt(supplierId),
        );

        if (!supplierQuotation) {
          console.error("Supplier quotation not found:", {
            quotationId,
            supplierId,
          });
          return res
            .status(404)
            .json({ message: "Cotação do fornecedor não encontrada" });
        }

        // Add attachment to database
        const attachment = await storage.createAttachment({
          supplierQuotationId: supplierQuotation.id,
          fileName: req.file.originalname,
          filePath: `/uploads/supplier_quotations/${req.file.filename}`,
          fileType: req.file.mimetype,
          fileSize: req.file.size,
          attachmentType: attachmentType || "supplier_proposal",
        });

        res.json({
          message: "Arquivo enviado com sucesso",
          fileName: req.file.originalname,
          attachmentId: attachment.id,
        });
      } catch (error) {
        console.error("Error uploading supplier file:", error);
        res.status(500).json({ message: "Erro ao enviar arquivo" });
      }
    },
  );

  // Get all supplier attachments for a purchase request
  app.get(
    "/api/purchase-requests/:id/supplier-attachments",
    isAuthenticated,
    async (req, res) => {
      try {
        const purchaseRequestId = parseInt(req.params.id);

        // Get quotation for this purchase request
        const quotation =
          await storage.getQuotationByPurchaseRequestId(purchaseRequestId);
        if (!quotation) {
          return res.json([]);
        }

        // Get all supplier quotations
        const supplierQuotations = await storage.getSupplierQuotations(
          quotation.id,
        );

        // Get all attachments for all supplier quotations
        const allAttachments = await Promise.all(
          supplierQuotations.map(async (sq: any) => {
            // Get supplier details
            const supplier = await storage.getSupplierById(sq.supplierId);

            // Get attachments for this supplier quotation - using a simple query since we don't have a storage method
            const { db } = await import("./db");
            const { attachments } = await import("../shared/schema");
            const { eq } = await import("drizzle-orm");
            const sqAttachments = await db
              .select()
              .from(attachments)
              .where(eq(attachments.supplierQuotationId, sq.id));

            return sqAttachments.map((attachment: any) => ({
              ...attachment,
              supplierName: supplier?.name || "Fornecedor desconhecido",
              supplierId: sq.supplierId,
              supplierQuotationId: sq.id,
            }));
          }),
        );

        // Flatten the array and filter out empty arrays
        const flatAttachments = allAttachments.flat().filter(Boolean);

        res.json(flatAttachments);
      } catch (error) {
        console.error("Error fetching supplier attachments:", error);
        res
          .status(500)
          .json({ message: "Erro ao buscar anexos dos fornecedores" });
      }
    },
  );

  // Get all attachments for a quotation (from all suppliers)
  app.get(
    "/api/quotations/:quotationId/attachments",
    isAuthenticated,
    async (req, res) => {
      try {
        const quotationId = parseInt(req.params.quotationId);

        // Get all supplier quotations for this quotation
        const supplierQuotations =
          await storage.getSupplierQuotations(quotationId);

        // Get all attachments for all supplier quotations
        const { db } = await import("./db");
        const { attachments } = await import("../shared/schema");
        const { eq, inArray } = await import("drizzle-orm");

        if (supplierQuotations.length === 0) {
          return res.json([]);
        }

        const supplierQuotationIds = supplierQuotations.map((sq) => sq.id);
        const allAttachments = await db
          .select()
          .from(attachments)
          .where(
            inArray(attachments.supplierQuotationId, supplierQuotationIds),
          );

        // Add supplier information to attachments
        const attachmentsWithSupplier = await Promise.all(
          allAttachments.map(async (attachment) => {
            const supplierQuotation = supplierQuotations.find(
              (sq) => sq.id === attachment.supplierQuotationId,
            );
            const supplier = supplierQuotation
              ? await storage.getSupplierById(supplierQuotation.supplierId)
              : null;

            return {
              ...attachment,
              supplierName: supplier?.name || "Fornecedor desconhecido",
              supplierId: supplierQuotation?.supplierId,
            };
          }),
        );

        res.json(attachmentsWithSupplier);
      } catch (error) {
        console.error("Error fetching quotation attachments:", error);
        res.status(500).json({ message: "Erro ao buscar anexos da cotação" });
      }
    },
  );

  // Get supplier quotation attachments
  app.get(
    "/api/quotations/:quotationId/supplier-quotations/:supplierId/attachments",
    isAuthenticated,
    async (req, res) => {
      try {
        const quotationId = parseInt(req.params.quotationId);
        const supplierId = parseInt(req.params.supplierId);

        // Find the supplier quotation
        const supplierQuotations =
          await storage.getSupplierQuotations(quotationId);
        const supplierQuotation = supplierQuotations.find(
          (sq) => sq.supplierId === supplierId,
        );

        if (!supplierQuotation) {
          return res.json([]);
        }

        // Get attachments for this supplier quotation
        const { db } = await import("./db");
        const { attachments } = await import("../shared/schema");
        const { eq } = await import("drizzle-orm");
        const sqAttachments = await db
          .select()
          .from(attachments)
          .where(eq(attachments.supplierQuotationId, supplierQuotation.id));

        res.json(sqAttachments);
      } catch (error) {
        console.error("Error fetching supplier quotation attachments:", error);
        res.status(500).json({ message: "Erro ao buscar anexos da cotação" });
      }
    },
  );

  // Rota para selecionar fornecedor vencedor na cotação
  app.post(
    "/api/quotations/:quotationId/select-supplier",
    isAuthenticated,
    async (req, res) => {
      try {
        const quotationId = parseInt(req.params.quotationId);
        const {
          selectedSupplierId,
          totalValue,
          observations,
          unavailableItems,
          createNewRequest,
          selectedItems,
          nonSelectedItems,
          nonSelectedItemsOption,
        } = req.body;

        // Validar dados recebidos para seleção de fornecedor

        // Buscar a cotação
        const quotation = await storage.getQuotationById(quotationId);
        if (!quotation) {
          return res.status(404).json({ message: "Cotação não encontrada" });
        }

        // Buscar todas as cotações dos fornecedores
        const supplierQuotations =
          await storage.getSupplierQuotations(quotationId);

        // Marcar todas as cotações como não escolhidas primeiro
        await Promise.all(
          supplierQuotations.map((sq) =>
            storage.updateSupplierQuotation(sq.id, { isChosen: false }),
          ),
        );

        // Marcar apenas a cotação do fornecedor selecionado como escolhida
        const selectedSupplierQuotation = supplierQuotations.find(
          (sq) => sq.supplierId === selectedSupplierId,
        );
        if (selectedSupplierQuotation) {
          await storage.updateSupplierQuotation(selectedSupplierQuotation.id, {
            isChosen: true,
            choiceReason: observations,
          });

          // Processar produtos indisponíveis se houver
          if (unavailableItems && unavailableItems.length > 0) {
            const supplierQuotationItems =
              await storage.getSupplierQuotationItems(
                selectedSupplierQuotation.id,
              );

            for (const unavailableItem of unavailableItems) {
              // Encontrar o item correspondente na cotação do fornecedor
              const supplierItem = supplierQuotationItems.find(
                (item) =>
                  item.quotationItemId === unavailableItem.quotationItemId,
              );

              if (supplierItem) {
                // Marcar item como indisponível
                await storage.updateSupplierQuotationItem(supplierItem.id, {
                  isAvailable: false,
                  unavailabilityReason: unavailableItem.reason,
                });
              }
            }
          }
        }

        // Atualizar a cotação (status e observações)
        await storage.updateQuotation(quotationId, {
          status: "approved",
        });

        // Para seleção individual, marcar itens não selecionados como transferidos
        let recalculatedTotalValue = totalValue;
        if (
          selectedItems &&
          selectedItems.length > 0 &&
          nonSelectedItems &&
          nonSelectedItems.length > 0 &&
          nonSelectedItemsOption === "separate-quotation"
        ) {
          // Buscar os itens da solicitação original
          const quotationItems = await storage.getQuotationItems(quotationId);
          const originalItems = await storage.getPurchaseRequestItems(
            quotation.purchaseRequestId,
          );

          // Marcar itens não selecionados como transferidos
          for (const nonSelectedItem of nonSelectedItems) {
            // Encontrar o quotation item correspondente
            const quotationItem = quotationItems.find(
              (qi) => qi.id === nonSelectedItem.quotationItemId,
            );
            if (quotationItem) {
              // Encontrar o item original usando o purchaseRequestItemId do quotation_item
              const originalItem = originalItems.find(
                (item) => item.id === quotationItem.purchaseRequestItemId,
              );

              if (originalItem) {
                // Marcar como transferido (será atualizado com o ID da nova solicitação depois)
                await storage.updatePurchaseRequestItem(originalItem.id, {
                  isTransferred: true,
                  transferReason:
                    "Item não selecionado - movido para cotação separada",
                  transferredAt: new Date(),
                });
              }
            }
          }

          // Recalcular valor total apenas com itens selecionados
          if (selectedSupplierQuotation) {
            const supplierQuotationItems =
              await storage.getSupplierQuotationItems(
                selectedSupplierQuotation.id,
              );
            // Recalculando valor total com itens selecionados

            recalculatedTotalValue = selectedItems.reduce(
              (total, selectedItem) => {
                const supplierItem = supplierQuotationItems.find(
                  (item) =>
                    item.quotationItemId === selectedItem.quotationItemId,
                );
                if (supplierItem) {
                  // Usar discountedTotalPrice se existir, senão totalPrice
                  const itemValue =
                    supplierItem.discountedTotalPrice &&
                    parseFloat(supplierItem.discountedTotalPrice) > 0
                      ? parseFloat(supplierItem.discountedTotalPrice)
                      : parseFloat(supplierItem.totalPrice);

                  // Calculando valor do item
                  return total + itemValue;
                }
                // Item não encontrado na cotação do fornecedor
                return total;
              },
              0,
            );
          }

          // Valor recalculado após transferência de itens

          // Atualizar também o valor da cotação do fornecedor selecionado
          if (selectedSupplierQuotation) {
            await storage.updateSupplierQuotation(
              selectedSupplierQuotation.id,
              {
                totalValue: recalculatedTotalValue.toString(),
              },
            );
            // Cotação do fornecedor atualizada com novo valor
          }
        }

        // SINCRONIZAÇÃO CRÍTICA: Sincronizar itens da RFQ com a solicitação original
        // Buscar todos os itens da cotação (RFQ)
        const quotationItems = await storage.getQuotationItems(quotationId);
        const originalItems = await storage.getPurchaseRequestItems(quotation.purchaseRequestId);
        
        // Identificar itens que existem na RFQ mas não na solicitação original
        for (const quotationItem of quotationItems) {
          // Se o item não tem purchaseRequestItemId, significa que foi adicionado durante a RFQ
          if (!quotationItem.purchaseRequestItemId) {
            console.log(`Sincronizando item adicionado na RFQ: ${quotationItem.description}`);
            
            // Criar o item na solicitação original
            const newPurchaseRequestItem = await storage.createPurchaseRequestItem({
              purchaseRequestId: quotation.purchaseRequestId,
              productCode: quotationItem.productCode || '',
              description: quotationItem.description,
              technicalSpecification: quotationItem.technicalSpecification || '',
              requestedQuantity: quotationItem.quantity,
              approvedQuantity: quotationItem.quantity,
              unit: quotationItem.unit,
              estimatedUnitPrice: quotationItem.estimatedUnitPrice || '0',
              estimatedTotalPrice: quotationItem.estimatedTotalPrice || '0',
              justification: 'Item adicionado durante a criação da RFQ',
            });
            
            // Atualizar o quotation_item para referenciar o novo purchase_request_item
            await storage.updateQuotationItem(quotationItem.id, {
              purchaseRequestItemId: newPurchaseRequestItem.id,
            });
            
            console.log(`Item sincronizado com sucesso: ${quotationItem.description} -> ID: ${newPurchaseRequestItem.id}`);
          }
        }

        // Avançar a solicitação para aprovação A2
        await storage.updatePurchaseRequest(quotation.purchaseRequestId, {
          currentPhase: "aprovacao_a2",
          totalValue: recalculatedTotalValue,
          chosenSupplierId: selectedSupplierId,
          choiceReason: observations,
        });

        let newRequestId = null;
        let nonSelectedRequestId = null;

        // Criar nova solicitação para itens NÃO selecionados se solicitado
        if (
          nonSelectedItems &&
          nonSelectedItems.length > 0 &&
          nonSelectedItemsOption === "separate-quotation"
        ) {
          try {
            // Buscar a solicitação original
            const originalRequest = await storage.getPurchaseRequestById(
              quotation.purchaseRequestId,
            );
            const originalItems = await storage.getPurchaseRequestItems(
              quotation.purchaseRequestId,
              true,
            ); // Incluir itens transferidos
            const quotationItems = await storage.getQuotationItems(quotationId);

            if (originalRequest) {
              // Criar nova solicitação baseada na original para itens não selecionados
              const nonSelectedRequestData = {
                requestNumber: `${originalRequest.requestNumber}-NS${Date.now().toString().slice(-4)}`,
                requesterId: originalRequest.requesterId,
                companyId: originalRequest.companyId,
                departmentId: originalRequest.departmentId,
                costCenterId: originalRequest.costCenterId,
                category: originalRequest.category,
                justification: `Itens não selecionados da solicitação ${originalRequest.requestNumber}`,
                urgency: originalRequest.urgency,
                idealDeliveryDate: originalRequest.idealDeliveryDate,
                deliveryLocationId: originalRequest.deliveryLocationId,
                currentPhase: "cotacao" as const, // Diretamente para cotação
                approvedA1: true, // Já aprovada em A1
                approverA1Id: originalRequest.approverA1Id,
                approvalDateA1: new Date(),
                createdBy: req.session.userId || originalRequest.createdBy,
              };

              const nonSelectedRequest = await storage.createPurchaseRequest(
                nonSelectedRequestData,
              );
              nonSelectedRequestId = nonSelectedRequest.id;

              // Adicionar apenas os itens NÃO selecionados à nova solicitação
              for (const nonSelectedItem of nonSelectedItems) {
                // Encontrar o quotation_item pelo quotationItemId
                const quotationItem = quotationItems.find(
                  (qi) => qi.id === nonSelectedItem.quotationItemId,
                );

                if (quotationItem) {
                  // Encontrar o item original usando o purchaseRequestItemId do quotation_item
                  const originalItem = originalItems.find(
                    (item) => item.id === quotationItem.purchaseRequestItemId,
                  );

                  if (originalItem) {
                    // Copiando item original para nova solicitação

                    await storage.createPurchaseRequestItem({
                      purchaseRequestId: nonSelectedRequest.id,
                      productCode: originalItem.productCode,
                      description: originalItem.description,
                      technicalSpecification:
                        originalItem.technicalSpecification,
                      requestedQuantity: originalItem.requestedQuantity,
                      approvedQuantity: originalItem.approvedQuantity,
                      unit: originalItem.unit,
                      estimatedUnitPrice: originalItem.estimatedUnitPrice,
                      estimatedTotalPrice: originalItem.estimatedTotalPrice,
                      justification:
                        originalItem.justification ||
                        `Item transferido da solicitação ${originalRequest.requestNumber}`,
                    });

                    // Atualizar o item original para referenciar a nova solicitação
                    await storage.updatePurchaseRequestItem(originalItem.id, {
                      transferredToRequestId: nonSelectedRequest.id,
                    });
                  } else {
                    console.error(
                      `Item original não encontrado para quotation item ${quotationItem.id}`,
                    );
                  }
                } else {
                  console.error(
                    `Quotation item não encontrado para ${nonSelectedItem.quotationItemId}`,
                  );
                }
              }
            }
          } catch (nonSelectedRequestError) {
            console.error(
              "Erro ao criar nova solicitação para itens não selecionados:",
              nonSelectedRequestError,
            );
            // Não falhar a seleção do fornecedor se houver erro na criação da nova solicitação
          }
        }

        // Criar nova solicitação para itens indisponíveis se solicitado
        if (
          createNewRequest &&
          unavailableItems &&
          unavailableItems.length > 0
        ) {
          try {
            // Buscar a solicitação original
            const originalRequest = await storage.getPurchaseRequestById(
              quotation.purchaseRequestId,
            );
            const originalItems = await storage.getPurchaseRequestItems(
              quotation.purchaseRequestId,
              true,
            ); // Incluir itens transferidos
            const quotationItems = await storage.getQuotationItems(quotationId);

            if (originalRequest) {
              // Criar nova solicitação baseada na original
              const newRequestData = {
                requestNumber: `${originalRequest.requestNumber}-R${Date.now().toString().slice(-4)}`,
                requesterId: originalRequest.requesterId,
                companyId: originalRequest.companyId,
                departmentId: originalRequest.departmentId,
                costCenterId: originalRequest.costCenterId,
                category: originalRequest.category, // Campo obrigatório que estava faltando
                justification: `Recotação de itens indisponíveis da solicitação ${originalRequest.requestNumber}`,
                urgency: originalRequest.urgency,
                idealDeliveryDate: originalRequest.idealDeliveryDate,
                deliveryLocationId: originalRequest.deliveryLocationId,
                currentPhase: "aprovacao_a1" as const,
                approvedA1: true, // Já aprovada em A1
                approverA1Id: originalRequest.approverA1Id,
                approvalDateA1: new Date(),
                createdBy: req.session.userId || originalRequest.createdBy,
              };

              const newRequest =
                await storage.createPurchaseRequest(newRequestData);
              newRequestId = newRequest.id;

              // Adicionar apenas os itens indisponíveis à nova solicitação
              for (const unavailableItem of unavailableItems) {
                // Encontrar o quotation_item pelo quotationItemId
                const quotationItem = quotationItems.find(
                  (qi) => qi.id === unavailableItem.quotationItemId,
                );

                if (quotationItem) {
                  // Encontrar o item original usando o purchaseRequestItemId do quotation_item
                  const originalItem = originalItems.find(
                    (item) => item.id === quotationItem.purchaseRequestItemId,
                  );

                  if (originalItem) {
                    await storage.createPurchaseRequestItem({
                      purchaseRequestId: newRequest.id,
                      productCode: originalItem.productCode,
                      description: originalItem.description,
                      requestedQuantity: originalItem.requestedQuantity,
                      approvedQuantity: originalItem.approvedQuantity,
                      unit: originalItem.unit,
                      estimatedUnitPrice: originalItem.estimatedUnitPrice,
                      estimatedTotalPrice: originalItem.estimatedTotalPrice,
                      justification: `Item indisponível: ${unavailableItem.reason}`,
                    });
                  }
                }
              }

              // Avançar automaticamente para fase de cotação
              await storage.updatePurchaseRequest(newRequest.id, {
                currentPhase: "cotacao" as const,
              });
            }
          } catch (newRequestError) {
            console.error(
              "Erro ao criar nova solicitação para itens indisponíveis:",
              newRequestError,
            );
            // Não falhar a seleção do fornecedor se houver erro na criação da nova solicitação
          }
        }

        res.json({
          message: "Fornecedor selecionado com sucesso",
          newRequestId,
          nonSelectedRequestId,
          unavailableItemsCount: unavailableItems?.length || 0,
          nonSelectedItemsCount: nonSelectedItems?.length || 0,
        });
      } catch (error) {
        console.error("Error selecting supplier:", error);
        res.status(400).json({ message: "Failed to select supplier" });
      }
    },
  );

  // Rota para obter informações detalhadas de comparação de fornecedores
  app.get(
    "/api/quotations/:quotationId/supplier-comparison",
    isAuthenticated,
    async (req, res) => {
      try {
        const quotationId = parseInt(req.params.quotationId);

        // Buscar cotações dos fornecedores
        const supplierQuotations =
          await storage.getSupplierQuotations(quotationId);

        // Para cada cotação de fornecedor, buscar os itens
        const detailedComparison = await Promise.all(
          supplierQuotations.map(async (sq: any) => {
            const items = await storage.getSupplierQuotationItems(sq.id);

            return {
              ...sq,
              items,
              totalValue: Number(sq.totalValue) || 0, // Use the stored total value
              deliveryDays: sq.deliveryDays || 30,
              warranty: sq.warranty || "12 meses",
              warrantyPeriod: sq.warrantyPeriod || "12 meses",
              paymentTerms: sq.paymentTerms || "30 dias",
              observations: sq.observations || "",
              status: sq.status || "received",
            };
          }),
        );

        res.json(detailedComparison);
      } catch (error) {
        console.error("Error fetching supplier comparison:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch supplier comparison" });
      }
    },
  );

  // Rota para marcar fornecedor como não respondeu
  app.put(
    "/api/supplier-quotations/:id/mark-no-response",
    isAuthenticated,
    async (req, res) => {
      try {
        const supplierQuotationId = parseInt(req.params.id);

        const updatedSupplierQuotation = await storage.updateSupplierQuotation(
          supplierQuotationId,
          {
            status: "no_response",
          },
        );

        res.json(updatedSupplierQuotation);
      } catch (error) {
        console.error("Error marking supplier as no response:", error);
        res
          .status(500)
          .json({ message: "Failed to mark supplier as no response" });
      }
    },
  );

  // PDF Generation routes
  app.get(
    "/api/purchase-requests/:id/pdf",
    isAuthenticated,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);

        // Import PDF service
        const { PDFService } = await import("./pdf-service");

        // Generate PDF
        const pdfBuffer = await PDFService.generatePurchaseOrderPDF(id);

        // Get purchase request to use in filename
        const purchaseRequest = await storage.getPurchaseRequestById(id);
        const filename = `Pedido_Compra_${purchaseRequest?.requestNumber || id}`;

        // Check if the buffer is HTML (fallback mode)
        // Verificar os primeiros 1000 caracteres para detectar HTML
        const bufferStart = pdfBuffer.toString(
          "utf8",
          0,
          Math.min(1000, pdfBuffer.length),
        );
        const isHtmlContent =
          bufferStart.includes("HTML_FALLBACK_MARKER") ||
          bufferStart.includes("<!DOCTYPE html>") ||
          bufferStart.includes("<html>") ||
          bufferStart.includes("<HTML>") ||
          bufferStart.trim().startsWith("<");

        // PDF Generation
        if (isHtmlContent) {
          // Return HTML file for browser to print/save as PDF
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="${filename}.html"`,
          );
          res.send(pdfBuffer);
        } else {
          // Return actual PDF
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="${filename}.pdf"`,
          );
          res.setHeader("Content-Length", pdfBuffer.length);
          res.send(pdfBuffer);
        }
      } catch (error) {
        console.error("Error generating PDF:", error);
        res.status(500).json({
          message: "Erro ao gerar PDF",
          error: error instanceof Error ? error.message : "Erro desconhecido",
        });
      }
    },
  );

  // Dashboard API endpoints
  app.get("/api/dashboard", isAuthenticated, async (req, res) => {
    try {
      const {
        period = "30",
        department = "all",
        status = "all",
        startDate: startDateParam,
        endDate: endDateParam,
        dateFilterType = "created",
      } = req.query;

      // Check if user is manager, admin or buyer
      const user = await storage.getUser(req.session.userId!);
      if (!user?.isManager && !user?.isAdmin && !user?.isBuyer) {
        return res
          .status(403)
          .json({ message: "Manager, admin or buyer access required" });
      }

      // Calculate date range - use provided dates or fallback to period
      let startDate: Date;
      let endDate: Date;

      if (startDateParam && endDateParam) {
        startDate = new Date(startDateParam as string);
        endDate = new Date(endDateParam as string);
      } else {
        const daysAgo = parseInt(period as string);
        startDate = new Date();
        startDate.setDate(startDate.getDate() - daysAgo);
        endDate = new Date();
      }

      // Get all purchase requests within the period
      const allRequests = await storage.getAllPurchaseRequests();
      const filteredRequests = allRequests.filter((request) => {
        let isInPeriod = false;

        // Apply date filter based on type
        if (dateFilterType === "created") {
          const createdAt = new Date(request.createdAt!);
          isInPeriod = createdAt >= startDate && createdAt <= endDate;
        } else if (dateFilterType === "completion") {
          // Filter by completion date (arquivado phase date)
          if (request.currentPhase === "arquivado" && request.updatedAt) {
            const completionDate = new Date(request.updatedAt);
            isInPeriod =
              completionDate >= startDate && completionDate <= endDate;
          } else {
            isInPeriod = false; // Only show completed requests for completion filter
          }
        } else if (dateFilterType === "both") {
          // Filter by both creation and completion dates
          const createdAt = new Date(request.createdAt!);
          const creationMatch = createdAt >= startDate && createdAt <= endDate;

          let completionMatch = false;
          if (request.currentPhase === "arquivado" && request.updatedAt) {
            const completionDate = new Date(request.updatedAt);
            completionMatch =
              completionDate >= startDate && completionDate <= endDate;
          }

          isInPeriod = creationMatch || completionMatch;
        }

        const departmentMatch =
          department === "all" ||
          request.costCenter?.departmentId === parseInt(department as string);

        const statusMatch = status === "all" || request.currentPhase === status;

        return isInPeriod && departmentMatch && statusMatch;
      });

      // Calculate KPIs
      const totalActiveRequests = filteredRequests.filter(
        (req) => req.currentPhase !== "arquivado",
      ).length;

      // Calculate total processing value - use totalValue from requests (which should be the final value after discounts)
      const totalProcessingValue = filteredRequests.reduce(
        (sum, req) => {
          // Prioritize totalValue from the request, fallback to availableBudget
          const value = Number(req.totalValue) || Number(req.availableBudget) || 0;
          return sum + value;
        },
        0,
      );

      // Calculate average approval time (simplified)
      const approvedRequests = filteredRequests.filter(
        (req) => req.currentPhase !== "solicitacao" && req.approvalDateA1,
      );
      const averageApprovalTime =
        approvedRequests.length > 0
          ? Math.round(
              approvedRequests.reduce((sum, req) => {
                const created = new Date(req.createdAt);
                const approved = new Date(req.approvalDateA1!);
                return (
                  sum +
                  (approved.getTime() - created.getTime()) /
                    (1000 * 60 * 60 * 24)
                );
              }, 0) / approvedRequests.length,
            )
          : 0;

      // Calculate approval rate
      const totalRequestsWithDecision = filteredRequests.filter(
        (req) => req.currentPhase !== "solicitacao",
      ).length;
      const approvedRequestsCount = filteredRequests.filter(
        (req) => req.approvedA1 !== false && req.currentPhase !== "solicitacao",
      ).length;
      const approvalRate =
        totalRequestsWithDecision > 0
          ? Math.round(
              (approvedRequestsCount / totalRequestsWithDecision) * 100,
            )
          : 0;

      // Get departments for analysis
      const departments = await storage.getAllDepartments();
      const requestsByDepartment = departments
        .map((dept) => {
          const deptRequests = filteredRequests.filter(
            (req) => req.costCenter?.departmentId === dept.id,
          );
          return {
            name: dept.name,
            value: deptRequests.length,
          };
        })
        .filter((item) => item.value > 0);

      // Urgency distribution - fixed to match all 4 urgency levels available
      const urgencyDistribution = [
        {
          name: "Baixa",
          value: filteredRequests.filter((req) => req.urgency === "baixo")
            .length,
        },
        {
          name: "Média",
          value: filteredRequests.filter((req) => req.urgency === "medio")
            .length,
        },
        {
          name: "Alta",
          value: filteredRequests.filter((req) => req.urgency === "alto")
            .length,
        },
        {
          name: "Crítica",
          value: filteredRequests.filter(
            (req) =>
              req.urgency === "critico" || req.urgency === "alta_urgencia",
          ).length,
        },
      ].filter((item) => item.value > 0); // Only show urgency levels that have actual data

      // Monthly trend (last 6 months)
      const monthlyTrend = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

        const monthRequests = allRequests.filter((req) => {
          const reqDate = new Date(req.createdAt);
          return reqDate >= monthStart && reqDate <= monthEnd;
        });

        monthlyTrend.push({
          month: date.toLocaleDateString("pt-BR", {
            month: "short",
            year: "2-digit",
          }),
          requests: monthRequests.length,
        });
      }

      // Phase conversion funnel
      const phaseNames = {
        solicitacao: "Solicitação",
        aprovacao_a1: "Aprovação A1",
        cotacao: "Cotação",
        aprovacao_a2: "Aprovação A2",
        pedido_compra: "Pedido Compra",
        conclusao_compra: "Conclusão",
        recebimento: "Recebimento",
        arquivado: "Arquivado",
      };

      const phases = [
        "solicitacao",
        "aprovacao_a1",
        "cotacao",
        "aprovacao_a2",
        "pedido_compra",
        "conclusao_compra",
        "recebimento",
        "arquivado",
      ];
      const phaseConversion = phases.map((phase) => ({
        name: phaseNames[phase as keyof typeof phaseNames] || phase,
        value: filteredRequests.filter((req) => req.currentPhase === phase)
          .length,
      }));

      // Top departments by value
      const topDepartments = departments
        .map((dept) => {
          const deptRequests = filteredRequests.filter(
            (req) => req.costCenter?.departmentId === dept.id,
          );
          const totalValue = deptRequests.reduce(
            (sum, req) =>
              sum +
              (Number(req.totalValue) || Number(req.availableBudget) || 0),
            0,
          );
          return {
            name: dept.name,
            totalValue,
            requestCount: deptRequests.length,
          };
        })
        .filter((item) => item.totalValue > 0)
        .sort((a, b) => b.totalValue - a.totalValue)
        .slice(0, 5);

      // Top suppliers (simplified - would need supplier data)
      const suppliers = await storage.getAllSuppliers();
      const topSuppliers = suppliers
        .map((supplier) => {
          const supplierRequests = filteredRequests.filter(
            (req) => req.chosenSupplierId === supplier.id,
          );
          const totalValue = supplierRequests.reduce(
            (sum, req) => sum + (Number(req.totalValue) || 0),
            0,
          );
          return {
            name: supplier.name,
            requestCount: supplierRequests.length,
            totalValue,
          };
        })
        .filter((item) => item.requestCount > 0)
        .sort((a, b) => b.requestCount - a.requestCount)
        .slice(0, 5);

      // Delayed requests (simplified SLA check)
      const delayedRequests = filteredRequests
        .filter((req) => {
          const daysSinceCreated =
            (Date.now() - new Date(req.createdAt).getTime()) /
            (1000 * 60 * 60 * 24);
          return daysSinceCreated > 15 && req.currentPhase !== "arquivado"; // 15 days SLA
        })
        .map((req) => ({
          id: req.id,
          requestNumber: req.requestNumber,
          phase: req.currentPhase,
          daysDelayed:
            Math.floor(
              (Date.now() - new Date(req.createdAt).getTime()) /
                (1000 * 60 * 60 * 24),
            ) - 15,
        }));

      // Cost center summary
      const costCenters = await storage.getAllCostCenters();
      const costCenterSummary = costCenters
        .map((cc) => {
          const ccRequests = filteredRequests.filter(
            (req) => req.costCenterId === cc.id,
          );
          const totalValue = ccRequests.reduce(
            (sum, req) =>
              sum +
              (Number(req.totalValue) || Number(req.availableBudget) || 0),
            0,
          );
          return {
            name: cc.name,
            totalValue,
            requestCount: ccRequests.length,
          };
        })
        .filter((item) => item.totalValue > 0)
        .sort((a, b) => b.totalValue - a.totalValue);

      // Calculate Value Saved (Valor Economizado)
      let valueSaved = 0;
      try {
        // Get all quotations for requests with chosen suppliers
        const quotations = await storage.getAllQuotations();
        for (const quotation of quotations) {
          const relatedRequest = filteredRequests.find(
            (req) => req.id === quotation.purchaseRequestId,
          );
          if (relatedRequest && relatedRequest.chosenSupplierId) {
            const supplierQuotations = await storage.getSupplierQuotations(
              quotation.id,
            );
            const chosenSupplierQuotation = supplierQuotations.find(
              (sq) =>
                sq.isChosen &&
                sq.supplierId === relatedRequest.chosenSupplierId,
            );

            if (chosenSupplierQuotation) {
              // Use the same logic as the report: prioritize subtotal_value for originalValue
              const originalValue = chosenSupplierQuotation.subtotalValue 
                ? Number(chosenSupplierQuotation.subtotalValue)
                : Number(chosenSupplierQuotation.totalValue);
              
              const finalValue = chosenSupplierQuotation.finalValue 
                ? Number(chosenSupplierQuotation.finalValue)
                : Number(chosenSupplierQuotation.totalValue);
              
              // Only add to savings if we have valid values and there's actually a discount
              if (originalValue && finalValue && originalValue > finalValue) {
                valueSaved += originalValue - finalValue;
              }
            }
          }
        }
      } catch (error) {
        console.error("Error calculating value saved:", error);
        valueSaved = 0;
      }

      res.json({
        totalActiveRequests,
        totalProcessingValue,
        averageApprovalTime,
        approvalRate,
        requestsByDepartment,
        monthlyTrend,
        urgencyDistribution,
        phaseConversion,
        topDepartments,
        topSuppliers,
        delayedRequests,
        costCenterSummary,
        // New procurement KPIs based on industry best practices
        costSavings: 0, // Would need historical price data to calculate actual savings
        valueSaved, // Valor Economizado - calculated from quotation discounts
        spendUnderManagement:
          totalActiveRequests > 0
            ? Math.round(
                (filteredRequests.filter((req) => req.chosenSupplierId).length /
                  totalActiveRequests) *
                  100,
              )
            : 0,
        contractCompliance:
          totalActiveRequests > 0
            ? Math.round(
                (filteredRequests.filter(
                  (req) => req.contractRequired && req.chosenSupplierId,
                ).length /
                  Math.max(
                    filteredRequests.filter((req) => req.contractRequired)
                      .length,
                    1,
                  )) *
                  100,
              )
            : 0,
        slaCompliance: Math.round(
          100 -
            (delayedRequests.length / Math.max(totalActiveRequests, 1)) * 100,
        ),
        averagePurchaseOrderValue:
          totalActiveRequests > 0
            ? Math.round(totalProcessingValue / totalActiveRequests)
            : 0,
        supplierPerformance: {
          onTimeDelivery: suppliers.length > 0 ? 95 : 0, // Simulated - would need delivery tracking
          qualityScore: suppliers.length > 0 ? 92 : 0, // Simulated - would need quality metrics
          responseTime: suppliers.length > 0 ? 2.5 : 0, // Simulated - would need response tracking in days
        },
        budgetAnalysis: {
          plannedBudget: Math.round(totalProcessingValue * 1.15), // Simulated 15% budget buffer
          actualSpend: totalProcessingValue,
          variance:
            totalProcessingValue > 0
              ? Math.round(
                  ((totalProcessingValue * 1.15 - totalProcessingValue) /
                    (totalProcessingValue * 1.15)) *
                    100,
                )
              : 0,
          utilizationRate:
            totalProcessingValue > 0
              ? Math.round(
                  (totalProcessingValue / (totalProcessingValue * 1.15)) * 100,
                )
              : 0,
        },
        riskAnalysis: {
          highRiskSuppliers: Math.floor(suppliers.length * 0.1), // Simulated 10% high risk
          criticalItems: filteredRequests.filter(
            (req) => req.urgency === "alto" || req.urgency === "alta_urgencia",
          ).length,
          singleSourceItems: Math.floor(totalActiveRequests * 0.15), // Simulated 15% single source
          riskScore:
            delayedRequests.length > totalActiveRequests * 0.2
              ? "Alto"
              : delayedRequests.length > totalActiveRequests * 0.1
                ? "Médio"
                : "Baixo",
        },
        procurementEfficiency: {
          avgProcessingTime: averageApprovalTime,
          automationRate: Math.round(
            (filteredRequests.filter((req) => req.approvedA1 !== null).length /
              Math.max(totalActiveRequests, 1)) *
              100,
          ),
          digitalAdoption: Math.round(
            (filteredRequests.filter(
              (req) =>
                req.requestType === "digital" || req.attachments?.length > 0,
            ).length /
              Math.max(totalActiveRequests, 1)) *
              100,
          ),
        },
      });
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      res.status(500).json({ message: "Failed to fetch dashboard data" });
    }
  });

  // Dashboard PDF export
  app.get("/api/dashboard/export-pdf", isAuthenticated, async (req, res) => {
    try {
      const {
        period = "30",
        department = "all",
        status = "all",
        startDate: startDateParam,
        endDate: endDateParam,
        dateFilterType = "created",
      } = req.query;

      // Check if user is manager or admin
      const user = await storage.getUser(req.session.userId!);
      if (!user?.isManager && !user?.isAdmin && !user?.isBuyer) {
        return res
          .status(403)
          .json({ message: "Manager, admin or buyer access required" });
      }

      // Calculate date range with same logic as dashboard route
      let startDate: Date, endDate: Date;

      if (startDateParam && endDateParam) {
        startDate = new Date(startDateParam as string);
        endDate = new Date(endDateParam as string);
      } else {
        const daysAgo = parseInt(period as string);
        startDate = new Date();
        startDate.setDate(startDate.getDate() - daysAgo);
        endDate = new Date();
      }

      const allRequests = await storage.getAllPurchaseRequests();
      const filteredRequests = allRequests.filter((request) => {
        let isInPeriod = false;

        // Apply date filter based on type (same logic as dashboard)
        if (dateFilterType === "created") {
          const createdAt = new Date(request.createdAt!);
          isInPeriod = createdAt >= startDate && createdAt <= endDate;
        } else if (dateFilterType === "completion") {
          // Filter by completion date (arquivado phase date)
          if (request.currentPhase === "arquivado" && request.updatedAt) {
            const completionDate = new Date(request.updatedAt);
            isInPeriod =
              completionDate >= startDate && completionDate <= endDate;
          } else {
            isInPeriod = false; // Only show completed requests for completion filter
          }
        } else if (dateFilterType === "both") {
          // Filter by both creation and completion dates
          const createdAt = new Date(request.createdAt!);
          const creationMatch = createdAt >= startDate && createdAt <= endDate;

          let completionMatch = false;
          if (request.currentPhase === "arquivado" && request.updatedAt) {
            const completionDate = new Date(request.updatedAt);
            completionMatch =
              completionDate >= startDate && completionDate <= endDate;
          }

          isInPeriod = creationMatch || completionMatch;
        }

        const departmentMatch =
          department === "all" ||
          request.costCenter?.departmentId === parseInt(department as string);
        const statusMatch = status === "all" || request.currentPhase === status;
        return isInPeriod && departmentMatch && statusMatch;
      });

      // Build dashboard data object (simplified version for PDF)
      const totalActiveRequests = filteredRequests.filter(
        (req) => req.currentPhase !== "arquivado",
      ).length;
      const totalProcessingValue = filteredRequests.reduce(
        (sum, req) =>
          sum + (Number(req.totalValue) || Number(req.availableBudget) || 0),
        0,
      );

      const approvedRequests = filteredRequests.filter(
        (req) => req.currentPhase !== "solicitacao" && req.approvalDateA1,
      );
      const averageApprovalTime =
        approvedRequests.length > 0
          ? Math.round(
              approvedRequests.reduce((sum, req) => {
                const created = new Date(req.createdAt);
                const approved = new Date(req.approvalDateA1!);
                return (
                  sum +
                  (approved.getTime() - created.getTime()) /
                    (1000 * 60 * 60 * 24)
                );
              }, 0) / approvedRequests.length,
            )
          : 0;

      const dashboardData = {
        totalActiveRequests,
        totalProcessingValue,
        averageApprovalTime,
        approvalRate:
          filteredRequests.length > 0
            ? Math.round(
                (approvedRequests.length / filteredRequests.length) * 100,
              )
            : 0,
        period,
        department,
        status,
        generatedAt: new Date().toLocaleString("pt-BR"),
      };

      // Generate PDF using the PDF service
      const pdfBuffer = await PDFService.generateDashboardPDF(dashboardData);

      // Check if the buffer is HTML (fallback mode)
      const bufferStart = pdfBuffer.toString(
        "utf8",
        0,
        Math.min(1000, pdfBuffer.length),
      );
      const isHtmlContent =
        bufferStart.includes("HTML_FALLBACK_MARKER") ||
        bufferStart.includes("<!DOCTYPE html>") ||
        bufferStart.includes("<html>") ||
        bufferStart.includes("<HTML>") ||
        bufferStart.trim().startsWith("<");

      const filename = `dashboard-executivo-${new Date().toISOString().split("T")[0]}`;

      if (isHtmlContent) {
        // Return HTML file for browser to print/save as PDF
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}.html"`,
        );
        res.send(pdfBuffer);
      } else {
        // Return actual PDF
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}.pdf"`,
        );
        res.setHeader("Content-Length", pdfBuffer.length);
        res.send(pdfBuffer);
      }
    } catch (error) {
      console.error("Error generating dashboard PDF:", error);
      res.status(500).json({ error: "Erro ao gerar PDF do dashboard" });
    }
  });

  // Serve uploaded supplier quotation files
  app.get(
    "/api/files/supplier-quotations/:filename",
    isAuthenticated,
    async (req, res) => {
      try {
        const filename = req.params.filename;
        const filePath = path.join(
          process.cwd(),
          "uploads",
          "supplier_quotations",
          filename,
        );

        // Check if file exists
        if (!fs.existsSync(filePath)) {
          return res.status(404).json({ message: "Arquivo não encontrado" });
        }

        // Get file stats
        const stats = fs.statSync(filePath);
        const fileSize = stats.size;

        // Set appropriate headers
        const mimeType = mime.lookup(filePath) || "application/octet-stream";
        res.setHeader("Content-Type", mimeType);
        res.setHeader("Content-Length", fileSize);
        res.setHeader("Content-Disposition", `inline; filename="${filename}"`);

        // Stream the file
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
      } catch (error) {
        console.error("Error serving supplier quotation file:", error);
        res.status(500).json({ message: "Erro ao servir arquivo" });
      }
    },
  );

  // Test email configuration
  app.get("/api/test-email", isAuthenticated, async (req, res) => {
    try {
      const isConfigured = await testEmailConfiguration();
      res.json({
        configured: isConfigured,
        message: isConfigured
          ? "Configuração de e-mail válida"
          : "Erro na configuração de e-mail",
      });
    } catch (error) {
      console.error("Erro ao testar configuração de e-mail:", error);
      res
        .status(500)
        .json({ message: "Erro ao testar configuração de e-mail" });
    }
  });

  // Data cleanup endpoint (Admin only)
  app.post(
    "/api/admin/cleanup-purchase-data",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const { confirmationText } = req.body;

        // Require confirmation text to prevent accidental deletions
        if (confirmationText !== "CONFIRMAR LIMPEZA") {
          return res.status(400).json({
            message:
              "Texto de confirmação incorreto. Digite exatamente: CONFIRMAR LIMPEZA",
          });
        }

        await storage.cleanupPurchaseRequestsData();

        res.json({
          message:
            "Limpeza realizada com sucesso! Todos os dados de solicitações foram removidos, mantendo cadastros básicos.",
          details: {
            removed: [
              "Solicitações de compra",
              "Itens de solicitação",
              "Cotações",
              "Itens de cotação",
              "Cotações de fornecedores",
              "Pedidos de compra",
              "Recebimentos",
              "Histórico de aprovações",
              "Anexos",
            ],
            maintained: [
              "Usuários",
              "Departamentos",
              "Centros de custo",
              "Fornecedores",
              "Métodos de pagamento",
            ],
          },
        });
      } catch (error) {
        console.error("Erro na limpeza de dados:", error);
        res.status(500).json({
          message: "Erro ao realizar limpeza de dados",
          error: error instanceof Error ? error.message : "Erro desconhecido",
        });
      }
    },
  );

  // Archive purchase request endpoint for ConclusionPhase
  app.patch(
    "/api/purchase-requests/:id/archive",
    isAuthenticated,
    isAdminOrBuyer,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const { conclusionObservations } = req.body;

        const updates = {
          currentPhase: "arquivado" as const,
          conclusionObservations,
          archivedDate: new Date(),
        };

        const request = await storage.updatePurchaseRequest(id, updates);
        
        // Invalidate cache for purchase requests
        invalidateCache(["/api/purchase-requests"]);
        
        res.json(request);
      } catch (error) {
        console.error("Error archiving request:", error);
        res.status(400).json({ message: "Failed to archive request" });
      }
    },
  );

  // Send conclusion email endpoint
  app.post(
    "/api/purchase-requests/:id/send-conclusion-email",
    isAuthenticated,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const request = await storage.getPurchaseRequestById(id);

        if (!request) {
          return res
            .status(404)
            .json({ message: "Purchase request not found" });
        }

        // Here you would implement the email sending logic
        // For now, return success response
        res.json({ message: "Conclusion email sent successfully" });
      } catch (error) {
        console.error("Error sending conclusion email:", error);
        res.status(500).json({ message: "Failed to send conclusion email" });
      }
    },
  );

  // Generate completion summary PDF endpoint
  app.get(
    "/api/purchase-requests/:id/completion-summary-pdf",
    isAuthenticated,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const request = await storage.getPurchaseRequestById(id);

        if (!request) {
          return res
            .status(404)
            .json({ message: "Purchase request not found" });
        }

        // Import PDF service
        const { PDFService } = await import("./pdf-service");

        // Generate completion summary PDF
        const pdfBuffer = await PDFService.generateCompletionSummaryPDF(id);

        // Check if the buffer is HTML (fallback mode)
        const bufferStart = pdfBuffer.toString(
          "utf8",
          0,
          Math.min(1000, pdfBuffer.length),
        );
        const isHtmlContent =
          bufferStart.includes("HTML_FALLBACK_MARKER") ||
          bufferStart.includes("<!DOCTYPE html>") ||
          bufferStart.includes("<html>") ||
          bufferStart.includes("<HTML>") ||
          bufferStart.trim().startsWith("<");

        const filename = `Conclusao_${request.requestNumber}`;

        if (isHtmlContent) {
          // Return HTML file for browser to print/save as PDF
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="${filename}.html"`,
          );
          res.send(pdfBuffer);
        } else {
          // Return actual PDF
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="${filename}.pdf"`,
          );
          res.setHeader("Content-Length", pdfBuffer.length);
          res.send(pdfBuffer);
        }
      } catch (error) {
        console.error("Error generating completion PDF:", error);
        res.status(500).json({ message: "Failed to generate completion PDF" });
      }
    },
  );

  // Test ERP connection endpoint
  app.get("/api/erp/test-connection", isAuthenticated, async (req, res) => {
    try {
      const { erpService } = await import("./erp-service");
      const result = await erpService.testConnection();
      res.json(result);
    } catch (error) {
      console.error("Error testing ERP connection:", error);
      res.status(500).json({
        success: false,
        message: "Failed to test ERP connection",
      });
    }
  });

  // Product search endpoint for ERP integration
  app.get("/api/products/search", isAuthenticated, async (req, res) => {
    try {
      const { q } = req.query;

      if (!q || typeof q !== "string" || q.length < 2) {
        return res.json([]);
      }

      // Import ERP service
      const { erpService } = await import("./erp-service");

      // Search products using ERP service
      const products = await erpService.searchProducts({
        q: q,
        limit: 10,
      });

      // Return only the fields expected by the frontend
      const formattedProducts = products.map((product) => ({
        codigo: product.codigo,
        descricao: product.descricao,
        unidade: product.unidade,
      }));

      res.json(formattedProducts);
    } catch (error) {
      console.error("Error searching products:", error);
      res.status(500).json({ message: "Failed to search products" });
    }
  });

  // Get purchase order by purchase request ID
  app.get(
    "/api/purchase-orders/by-request/:requestId",
    async (req: Request, res: Response) => {
      try {
        const requestId = parseInt(req.params.requestId);

        if (isNaN(requestId)) {
          return res.status(400).json({ message: "Invalid request ID" });
        }

        const purchaseOrder =
          await storage.getPurchaseOrderByRequestId(requestId);

        if (!purchaseOrder) {
          return res
            .status(404)
            .json({ message: "Purchase order not found for this request" });
        }

        res.json(purchaseOrder);
      } catch (error) {
        console.error("Error fetching purchase order by request ID:", error);
        res.status(500).json({ message: "Failed to fetch purchase order" });
      }
    },
  );

  // Purchase order items endpoints
  app.post("/api/purchase-order-items", isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertPurchaseOrderItemSchema.parse(req.body);
      const item = await storage.createPurchaseOrderItem(validatedData);
      res.status(201).json(item);
    } catch (error) {
      console.error("Error creating purchase order item:", error);
      res
        .status(500)
        .json({
          message: "Failed to create purchase order item",
          error: error.message,
        });
    }
  });

  // Get purchase order items
  app.get(
    "/api/purchase-order-items/:purchaseOrderId",
    async (req: Request, res: Response) => {
      try {
        const purchaseOrderId = parseInt(req.params.purchaseOrderId);

        if (isNaN(purchaseOrderId)) {
          return res.status(400).json({ message: "Invalid purchase order ID" });
        }

        const items = await storage.getPurchaseOrderItems(purchaseOrderId);
        res.json(items);
      } catch (error) {
        console.error("Error fetching purchase order items:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch purchase order items" });
      }
    },
  );

  // Purchase requests report endpoint
  app.get(
    "/api/reports/purchase-requests",
    async (req: Request, res: Response) => {
      try {
        const {
          startDate,
          endDate,
          departmentId,
          requesterId,
          supplierId,
          phase,
          urgency,
          search,
        } = req.query;

        // Build filters object with validation
        const filters: any = {};

        // Validate and set date range
        if (startDate && endDate) {
          try {
            const start = new Date(startDate as string);
            const end = new Date(endDate as string);

            if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
              filters.dateRange = { start, end };
            }
          } catch (error) {
            // Invalid date range - silently ignore
          }
        }

        // Validate and set numeric filters
        if (departmentId) {
          const deptId = parseInt(departmentId as string);
          if (!isNaN(deptId)) {
            filters.departmentId = deptId;
          }
        }

        if (requesterId) {
          const reqId = parseInt(requesterId as string);
          if (!isNaN(reqId)) {
            filters.requesterId = reqId;
          }
        }

        // Validate and set string filters
        if (phase && typeof phase === "string" && phase.trim() !== "") {
          filters.phase = phase.trim();
        }

        if (urgency && typeof urgency === "string" && urgency.trim() !== "") {
          filters.urgency = urgency.trim();
        }

        if (supplierId && typeof supplierId === "string" && supplierId.trim() !== "") {
          filters.supplierId = supplierId.trim();
        }

        if (search && typeof search === "string" && search.trim() !== "") {
          filters.search = search.trim();
        }

        // Get purchase requests with related data
        const requests = await storage.getPurchaseRequestsForReport(filters);

        res.json(requests);
      } catch (error) {
        console.error("Error fetching purchase requests report:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch purchase requests report" });
      }
    },
  );

  const httpServer = createServer(app);
  return httpServer;
}
