import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { sendRFQToSuppliers, notifyNewRequest, notifyApprovalA1, notifyApprovalA2, notifyRejection, testEmailConfiguration } from "./email-service";
import { 
  insertUserSchema, 
  insertCompanySchema,
  insertDepartmentSchema, 
  insertCostCenterSchema, 
  insertSupplierSchema, 
  insertDeliveryLocationSchema,
  insertPurchaseRequestSchema,
  insertPurchaseRequestItemSchema,
  insertQuotationSchema,
  insertQuotationItemSchema,
  insertSupplierQuotationSchema,
  insertSupplierQuotationItemSchema
} from "@shared/schema";
import { z } from "zod";
import bcrypt from "bcryptjs";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import multer from "multer";
import path from "path";
import fs from "fs";
import mime from "mime-types";

// Configuração do multer para upload de arquivos de cotação
const quotationUpload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      const uploadDir = './uploads/supplier_quotations';
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  fileFilter: function (req, file, cb) {
    // Aceitar apenas arquivos PDF, DOC, DOCX, XLS, XLSX, TXT, PNG, JPG, JPEG
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'image/png',
      'image/jpeg',
      'image/jpg'
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não suportado. Apenas PDF, DOC, DOCX, XLS, XLSX, TXT, PNG, JPG são permitidos.'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// Configuração do multer para upload de logos de empresas
const logoUpload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      const uploadDir = './uploads/company_logos';
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  fileFilter: function (req, file, cb) {
    // Aceitar apenas imagens PNG, JPG, JPEG
    const allowedMimeTypes = [
      'image/png',
      'image/jpeg',
      'image/jpg'
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não suportado. Apenas PNG, JPG, JPEG são permitidos para logos.'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB para logos
  }
});

// Session type declaration
declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

// Authentication middleware
function isAuthenticated(req: Request, res: Response, next: Function) {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ message: "Unauthorized" });
  }
}

// Admin authorization middleware
async function isAdmin(req: Request, res: Response, next: Function) {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user || !user.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }

    next();
  } catch (error) {
    console.error("Error checking admin permissions:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Configure PostgreSQL session store
  const PgSession = connectPgSimple(session);

  // Configure session with PostgreSQL store
  app.use(session({
    store: new PgSession({
      pool: pool,
      tableName: 'session',
      createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET || 'your-secret-key-here-change-in-production',
    resave: false,
    saveUninitialized: false,
    name: 'sessionId', // Custom session name
    cookie: {
      secure: false, // Set to true in production with HTTPS
      httpOnly: true,
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
      sameSite: 'lax' // Protect against CSRF
    },
    rolling: true // Reset expiration on activity
  }));

  // Multer configuration removed - was specific to purchase request attachments
  // Supplier uploads now use a different approach

  // Initialize default data
  await storage.initializeDefaultData();



  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      const user = await storage.getUserByUsername(username);

      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);

      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      req.session.userId = user.id;
      
      // Get company data
      const company = user.companyId ? await storage.getCompanyById(user.companyId) : null;
      
      res.json({ 
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        departmentId: user.departmentId,
        companyId: user.companyId,
        company,
        isBuyer: user.isBuyer,
        isApproverA1: user.isApproverA1,
        isApproverA2: user.isApproverA2,
        isAdmin: user.isAdmin,
        isManager: user.isManager
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/check", async (req, res) => {
    if (req.session.userId) {
      const user = await storage.getUser(req.session.userId);
      if (user) {
        const department = user.departmentId ? await storage.getDepartmentById(user.departmentId) : null;
        const company = user.companyId ? await storage.getCompanyById(user.companyId) : null;
        res.json({ 
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          departmentId: user.departmentId,
          companyId: user.companyId,
          department,
          company,
          isBuyer: user.isBuyer,
          isApproverA1: user.isApproverA1,
          isApproverA2: user.isApproverA2,
          isAdmin: user.isAdmin,
          isManager: user.isManager
        });
      } else {
        res.status(401).json({ message: "Unauthorized" });
      }
    } else {
      res.status(401).json({ message: "Unauthorized" });
    }
  });

  // Password recovery endpoints
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: "E-mail é obrigatório" });
      }

      const token = await storage.generatePasswordResetToken(email);

      if (token) {
        const user = await storage.getUserByEmail(email);
        if (user) {
          // Import email service
          const { sendPasswordResetEmail } = await import('./email-service');
          await sendPasswordResetEmail(user, token);
        }
      }

      // Always return success to prevent email enumeration
      res.json({ message: "Se o e-mail existir em nossa base, você receberá instruções de recuperação" });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.post("/api/auth/validate-reset-token", async (req, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ message: "Token é obrigatório" });
      }

      const user = await storage.validatePasswordResetToken(token);

      if (!user) {
        return res.status(400).json({ message: "Token inválido ou expirado" });
      }

      res.json({ message: "Token válido" });
    } catch (error) {
      console.error("Validate reset token error:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        return res.status(400).json({ message: "Token e senha são obrigatórios" });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: "A senha deve ter no mínimo 6 caracteres" });
      }

      const success = await storage.resetPassword(token, password);

      if (!success) {
        return res.status(400).json({ message: "Token inválido ou expirado" });
      }

      res.json({ message: "Senha redefinida com sucesso" });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Companies routes
  app.get("/api/companies", isAuthenticated, isAdmin, async (req, res) => {
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
        const { validateCNPJ } = await import('./cnpj-validator');
        if (!validateCNPJ(companyData.cnpj)) {
          return res.status(400).json({ message: "CNPJ inválido" });
        }
      }
      
      const company = await storage.createCompany(companyData);
      res.status(201).json(company);
    } catch (error) {
      console.error("Error creating company:", error);
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        res.status(400).json({ message: "CNPJ já está sendo usado por outra empresa" });
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
        const { validateCNPJ } = await import('./cnpj-validator');
        if (!validateCNPJ(companyData.cnpj)) {
          return res.status(400).json({ message: "CNPJ inválido" });
        }
      }
      
      const company = await storage.updateCompany(id, companyData);
      res.json(company);
    } catch (error) {
      console.error("Error updating company:", error);
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        res.status(400).json({ message: "CNPJ já está sendo usado por outra empresa" });
      } else {
        res.status(400).json({ message: "Dados da empresa inválidos" });
      }
    }
  });

  app.delete("/api/companies/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCompany(id);
      res.json({ message: "Company deactivated successfully" });
    } catch (error) {
      console.error("Error deleting company:", error);
      res.status(500).json({ message: "Failed to delete company" });
    }
  });

  // Upload logo for company
  app.post("/api/companies/:id/upload-logo", isAuthenticated, isAdmin, logoUpload.single('logo'), async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      
      if (!req.file) {
        return res.status(400).json({ message: "Nenhum arquivo de logo foi enviado" });
      }

      // Verificar se a empresa existe
      const company = await storage.getCompanyById(companyId);
      if (!company) {
        return res.status(404).json({ message: "Empresa não encontrada" });
      }

      // Atualizar a empresa com o caminho do logo
      const logoUrl = `/uploads/company_logos/${req.file.filename}`;
      const updatedCompany = await storage.updateCompany(companyId, { logoUrl });

      res.json({ 
        message: "Logo enviado com sucesso",
        logoUrl: logoUrl,
        company: updatedCompany
      });
    } catch (error) {
      console.error("Error uploading company logo:", error);
      res.status(500).json({ message: "Erro ao enviar logo da empresa" });
    }
  });

  // Serve company logos
  app.get("/uploads/company_logos/:filename", (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, "../uploads/company_logos", filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Logo não encontrado" });
    }
    
    const mimeType = mime.lookup(filePath);
    res.setHeader('Content-Type', mimeType || 'application/octet-stream');
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  });

  // Users routes
  app.get("/api/users", isAuthenticated, isAdmin, async (req, res) => {
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
      const user = await storage.createUser({ ...userData, password: hashedPassword });

      // Set user cost centers if provided
      if (req.body.costCenterIds && Array.isArray(req.body.costCenterIds)) {
        await storage.setUserCostCenters(user.id, req.body.costCenterIds);
      }

      res.status(201).json(user);
    } catch (error) {
      console.error("Error creating user:", error);

      // Check if it's a unique constraint violation for email
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505' && 'constraint' in error && error.constraint === 'users_email_unique') {
        res.status(400).json({ message: "Este e-mail já está sendo usado por outro usuário" });
      } else {
        res.status(400).json({ message: "Dados do usuário inválidos" });
      }
    }
  });

  app.put("/api/users/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userData = insertUserSchema.partial().parse(req.body);

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
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505' && 'constraint' in error && error.constraint === 'users_email_unique') {
        res.status(400).json({ message: "Este e-mail já está sendo usado por outro usuário" });
      } else {
        res.status(400).json({ message: "Dados do usuário inválidos" });
      }
    }
  });

  // Check if user can be deleted
  app.get("/api/users/:id/can-delete", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = await storage.checkUserCanBeDeleted(id);
      res.json(result);
    } catch (error) {
      console.error("Error checking if user can be deleted:", error);
      res.status(500).json({ message: "Failed to check user deletion eligibility" });
    }
  });

  // Delete user
  app.delete("/api/users/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      // Check if user can be deleted first
      const canDeleteCheck = await storage.checkUserCanBeDeleted(id);
      if (!canDeleteCheck.canDelete) {
        return res.status(400).json({ 
          message: canDeleteCheck.reason,
          associatedRequests: canDeleteCheck.associatedRequests
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
      const user = await storage.updateUser(userId, { firstName, lastName, email });
      res.json(user);
    } catch (error) {
      console.error("Error updating profile:", error);

      // Check if it's a unique constraint violation for email
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505' && 'constraint' in error && error.constraint === 'users_email_unique') {
        res.status(400).json({ message: "Este e-mail já está sendo usado por outro usuário" });
      } else {
        res.status(400).json({ message: "Falha ao atualizar perfil" });
      }
    }
  });

  // Change password
  app.post("/api/users/:id/change-password", isAuthenticated, async (req, res) => {
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
      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
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
  });

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
      const companyId = req.query.companyId ? parseInt(req.query.companyId as string) : undefined;
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

  app.put("/api/departments/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const departmentData = insertDepartmentSchema.partial().parse(req.body);
      const department = await storage.updateDepartment(id, departmentData);
      res.json(department);
    } catch (error) {
      console.error("Error updating department:", error);
      res.status(400).json({ message: "Failed to update department" });
    }
  });

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

  app.get("/api/cost-centers/department/:departmentId", isAuthenticated, async (req, res) => {
    try {
      const departmentId = parseInt(req.params.departmentId);
      const costCenters = await storage.getCostCentersByDepartment(departmentId);
      res.json(costCenters);
    } catch (error) {
      console.error("Error fetching cost centers by department:", error);
      res.status(500).json({ message: "Failed to fetch cost centers" });
    }
  });

  app.post("/api/cost-centers", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const costCenterData = insertCostCenterSchema.parse(req.body);
      const costCenter = await storage.createCostCenter(costCenterData);
      res.status(201).json(costCenter);
    } catch (error) {
      console.error("Error creating cost center:", error);
      res.status(400).json({ message: "Invalid cost center data" });
    }
  });

  app.put("/api/cost-centers/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const costCenterData = insertCostCenterSchema.partial().parse(req.body);
      const costCenter = await storage.updateCostCenter(id, costCenterData);
      res.json(costCenter);
    } catch (error) {
      console.error("Error updating cost center:", error);
      res.status(400).json({ message: "Failed to update cost center" });
    }
  });

  // Suppliers routes
  app.get("/api/suppliers", isAuthenticated, async (req, res) => {
    try {
      const companyId = req.query.companyId ? parseInt(req.query.companyId as string) : undefined;
      const suppliers = await storage.getAllSuppliers(companyId);
      res.json(suppliers);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      res.status(500).json({ message: "Failed to fetch suppliers" });
    }
  });

  app.post("/api/suppliers", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const supplierData = insertSupplierSchema.parse(req.body);
      const supplier = await storage.createSupplier(supplierData);
      res.status(201).json(supplier);
    } catch (error) {
      console.error("Error creating supplier:", error);
      res.status(400).json({ message: "Invalid supplier data" });
    }
  });

  app.put("/api/suppliers/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const supplierData = insertSupplierSchema.partial().parse(req.body);
      const supplier = await storage.updateSupplier(id, supplierData);
      res.json(supplier);
    } catch (error) {
      console.error("Error updating supplier:", error);
      res.status(400).json({ message: "Invalid supplier data" });
    }
  });

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

  app.post("/api/delivery-locations", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const deliveryLocationData = insertDeliveryLocationSchema.parse(req.body);
      const deliveryLocation = await storage.createDeliveryLocation(deliveryLocationData);
      res.status(201).json(deliveryLocation);
    } catch (error) {
      console.error("Error creating delivery location:", error);

      // Check for specific database constraint errors
      if (error instanceof Error) {
        if (error.message.includes('unique constraint') || error.message.includes('duplicate key')) {
          return res.status(400).json({ message: "Já existe um local de entrega com este nome" });
        }
        if (error.message.includes('not null constraint')) {
          return res.status(400).json({ message: "Todos os campos obrigatórios devem ser preenchidos" });
        }
      }

      res.status(400).json({ message: "Erro ao criar local de entrega" });
    }
  });

  app.put("/api/delivery-locations/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deliveryLocationData = insertDeliveryLocationSchema.partial().parse(req.body);
      const deliveryLocation = await storage.updateDeliveryLocation(id, deliveryLocationData);
      res.json(deliveryLocation);
    } catch (error) {
      console.error("Error updating delivery location:", error);

      // Check for specific database constraint errors
      if (error instanceof Error) {
        if (error.message.includes('unique constraint') || error.message.includes('duplicate key')) {
          return res.status(400).json({ message: "Já existe um local de entrega com este nome" });
        }
        if (error.message.includes('not null constraint')) {
          return res.status(400).json({ message: "Todos os campos obrigatórios devem ser preenchidos" });
        }
      }

      res.status(400).json({ message: "Erro ao atualizar local de entrega" });
    }
  });

  app.delete("/api/delivery-locations/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteDeliveryLocation(id);
      res.json({ message: "Delivery location deactivated successfully" });
    } catch (error) {
      console.error("Error deactivating delivery location:", error);
      res.status(500).json({ message: "Failed to deactivate delivery location" });
    }
  });

  // Purchase Requests routes
  app.get("/api/purchase-requests", isAuthenticated, async (req, res) => {
    try {
      const companyId = req.query.companyId ? parseInt(req.query.companyId as string) : undefined;
      const requests = await storage.getAllPurchaseRequests(companyId);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching purchase requests:", error);
      res.status(500).json({ message: "Failed to fetch purchase requests" });
    }
  });

  app.post("/api/purchase-requests", isAuthenticated, async (req, res) => {
    try {
      const requestData = insertPurchaseRequestSchema.parse(req.body);
      const purchaseRequest = await storage.createPurchaseRequest(requestData);

      // Adicionar itens da solicitação
      if (req.body.items && Array.isArray(req.body.items)) {
        for (const item of req.body.items) {
          const itemData = insertPurchaseRequestItemSchema.parse({
            ...item,
            purchaseRequestId: purchaseRequest.id
          });
          await storage.createPurchaseRequestItem(itemData);
        }
      }

      // Send notification to buyers about the new request
      notifyNewRequest(purchaseRequest).catch(error => {
        console.error("Erro ao enviar notificação de nova solicitação:", error);
      });

      res.status(201).json(purchaseRequest);
    } catch (error) {
      console.error("Error creating purchase request:", error);
      res.status(400).json({ message: "Invalid purchase request data" });
    }
  });

  app.get("/api/purchase-requests/phase/:phase", isAuthenticated, async (req, res) => {
    try {
      const phase = req.params.phase;
      const requests = await storage.getPurchaseRequestsByPhase(phase);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching purchase requests by phase:", error);
      res.status(500).json({ message: "Failed to fetch purchase requests" });
    }
  });

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
      const validatedRequestData = insertPurchaseRequestSchema.parse(requestData);

      // Validate items if provided
      let validatedItems: typeof insertPurchaseRequestItemSchema._type[] = [];
      if (items && Array.isArray(items)) {
        validatedItems = items.map((item: any) => insertPurchaseRequestItemSchema.parse({
          ...item,
          purchaseRequestId: 0,

          description: item.description || '',
          unit: item.unit || '',
          requestedQuantity: item.requestedQuantity || 0,
          technicalSpecification: item.technicalSpecification || null,
          approvedQuantity: undefined
        }));
      }

      // Create the request
      const request = await storage.createPurchaseRequest(validatedRequestData);

      // Create items if any
      if (validatedItems.length > 0) {
        const itemsWithRequestId = validatedItems.map(item => ({
          ...item,
          purchaseRequestId: request.id,
        }));

        // Criar itens individualmente para evitar problemas de validação
        for (const item of itemsWithRequestId) {
          await storage.createPurchaseRequestItem(item);
        }
      }

      res.status(201).json(request);
    } catch (error) {
      console.error("Error creating purchase request:", error);
      res.status(400).json({ message: "Invalid purchase request data" });
    }
  });

  app.put("/api/purchase-requests/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { items, ...requestData } = req.body;

      // Validate request data
      const validatedRequestData = insertPurchaseRequestSchema.partial().parse(requestData);

      // Update the purchase request
      const request = await storage.updatePurchaseRequest(id, validatedRequestData);

      // Handle items if provided
      if (items && Array.isArray(items)) {
        // First, remove all existing items
        const existingItems = await storage.getPurchaseRequestItems(id);
        for (const item of existingItems) {
          await storage.deletePurchaseRequestItem(item.id);
        }

        // Then, add new items
        const validatedItems = items.map(item => insertPurchaseRequestItemSchema.parse({
          ...item,
          purchaseRequestId: id,
        }));
        await storage.createPurchaseRequestItems(validatedItems);
      }

      res.json(request);
    } catch (error) {
      console.error("Error updating purchase request:", error);
      res.status(400).json({ message: "Invalid purchase request data" });
    }
  });

  app.patch("/api/purchase-requests/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      // Validate request data (only partial update)
      const validatedRequestData = insertPurchaseRequestSchema.partial().parse(req.body);

      // Update the purchase request
      const request = await storage.updatePurchaseRequest(id, validatedRequestData);

      res.json(request);
    } catch (error) {
      console.error("Error updating purchase request:", error);
      res.status(400).json({ message: "Invalid purchase request data" });
    }
  });

  // Purchase Request Items routes
  app.get("/api/purchase-requests/:id/items", isAuthenticated, async (req, res) => {
    try {
      const purchaseRequestId = parseInt(req.params.id);
      const items = await storage.getPurchaseRequestItems(purchaseRequestId);

      // Map the items to match the frontend EditableItem interface
      const mappedItems = items.map(item => ({
        id: item.id,
        description: item.description,
        unit: item.unit,
        requestedQuantity: parseFloat(item.requestedQuantity) || 0,
        technicalSpecification: item.technicalSpecification || ""
      }));

      console.log(`[DEBUG] Fetched ${items.length} items for purchase request ${purchaseRequestId}:`, mappedItems);
      res.json(mappedItems);
    } catch (error) {
      console.error("Error fetching purchase request items:", error);
      res.status(500).json({ message: "Failed to fetch items" });
    }
  });

  app.post("/api/purchase-requests/:id/items", isAuthenticated, async (req, res) => {
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
  });

  app.put("/api/purchase-request-items/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const itemData = insertPurchaseRequestItemSchema.partial().parse(req.body);
      const item = await storage.updatePurchaseRequestItem(id, itemData);
      res.json(item);
    } catch (error) {
      console.error("Error updating purchase request item:", error);
      res.status(400).json({ message: "Invalid item data" });
    }
  });

  app.delete("/api/purchase-request-items/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deletePurchaseRequestItem(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting purchase request item:", error);
      res.status(500).json({ message: "Failed to delete item" });
    }
  });

  // Phase transition routes
  app.post("/api/purchase-requests/:id/send-to-approval", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      const request = await storage.getPurchaseRequestById(id);
      if (!request || request.currentPhase !== "solicitacao") {
        return res.status(400).json({ message: "Request must be in the request phase" });
      }

      const updateData = {
        currentPhase: "aprovacao_a1" as any,
        updatedAt: new Date()
      };

      const updatedRequest = await storage.updatePurchaseRequest(id, updateData);

      // Send notification to approvers A1
      try {
        await notifyApprovalA1(updatedRequest);
      } catch (emailError) {
        console.error("Error sending approval notification:", emailError);
        // Continue with the update even if email fails
      }

      res.json(updatedRequest);
    } catch (error) {
      console.error("Error sending to approval:", error);
      res.status(400).json({ message: "Failed to send to approval" });
    }
  });

  app.post("/api/purchase-requests/:id/approve-a1", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { approved, rejectionReason, approverId } = req.body;

      const request = await storage.getPurchaseRequestById(id);
      console.log('Solicitação atual:', request);

      if (!request || request.currentPhase !== "aprovacao_a1") {
        return res.status(400).json({ message: "Request must be in the A1 approval phase" });
      }

      const updateData = {
        approverA1Id: approverId,
        approvedA1: approved,
        approvalDateA1: new Date(),
        currentPhase: approved ? "cotacao" : "arquivado",
        rejectionReasonA1: approved ? null : (rejectionReason || "Solicitação reprovada"),
        updatedAt: new Date()
      } as const;

      // Create approval history entry
      await storage.createApprovalHistory({
        purchaseRequestId: id,
        approverType: "A1",
        approverId: approverId,
        approved: approved,
        rejectionReason: approved ? null : (rejectionReason || "Solicitação reprovada"),
      });

      const updatedRequest = await storage.updatePurchaseRequest(id, updateData);

      // Send rejection notification email if request was rejected
      if (!approved && rejectionReason) {
        await notifyRejection(updatedRequest, rejectionReason, 'A1');
      }

      res.json(updatedRequest);
    } catch (error) {
      if (error instanceof Error) {
        console.error("Error approving A1:", error);
        console.error("Stack trace:", error.stack);
        res.status(400).json({ message: "Failed to process approval", error: error.message });
      } else {
        res.status(400).json({ message: "Failed to process approval" });
      }
    }
  });

  app.post("/api/purchase-requests/:id/update-quotation", isAuthenticated, async (req, res) => {
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
      res.json(request);
    } catch (error) {
      console.error("Error updating quotation:", error);
      res.status(400).json({ message: "Failed to update quotation" });
    }
  });

  app.post("/api/purchase-requests/:id/approve-a2", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { approved, rejectionReason, rejectionAction, approverId } = req.body;

      console.log("A2 approval received:", { approved, rejectionReason, rejectionAction, approverId });

      const request = await storage.getPurchaseRequestById(id);
      if (!request || request.currentPhase !== "aprovacao_a2") {
        return res.status(400).json({ message: "Request must be in the A2 approval phase" });
      }

      let newPhase = "pedido_compra";
      if (!approved) {
        if (rejectionAction === "recotacao") {
          newPhase = "cotacao"; // Return to quotation phase
          console.log("Setting newPhase to 'cotacao' for new quotation");
        } else {
          newPhase = "arquivado"; // Archive
          console.log("Setting newPhase to 'arquivado' for archive");
        }
      }

      console.log("Final newPhase:", newPhase);

      const updateData = {
        approverA2Id: approverId,
        approvalDateA2: new Date(),
        approvedA2: approved,
        rejectionReasonA2: approved ? null : rejectionReason,
        rejectionActionA2: approved ? null : rejectionAction,
        currentPhase: newPhase as any,
        updatedAt: new Date()
      } as const;

      // Create approval history entry
      await storage.createApprovalHistory({
        purchaseRequestId: id,
        approverType: "A2",
        approverId: approverId,
        approved: approved,
        rejectionReason: approved ? null : (rejectionReason || "Solicitação reprovada"),
      });

      const updatedRequest = await storage.updatePurchaseRequest(id, updateData);

      // Send rejection notification email if request was rejected
      if (!approved && rejectionReason) {
        await notifyRejection(updatedRequest, rejectionReason, 'A2');
      }

      res.json(updatedRequest);
    } catch (error) {
      console.error("Error approving A2:", error);
      res.status(400).json({ message: "Failed to process A2 approval" });
    }
  });

  // Mark supplier as no response
  app.post("/api/supplier-quotations/:id/mark-no-response", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const supplierQuotation = await storage.updateSupplierQuotation(id, {
        status: "no_response",
        updatedAt: new Date()
      });
      res.json(supplierQuotation);
    } catch (error) {
      console.error("Error marking supplier as no response:", error);
      res.status(400).json({ message: "Failed to mark supplier as no response" });
    }
  });

  // Get selected supplier for A2 approval
  app.get("/api/purchase-requests/:id/selected-supplier", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      // Get quotation for this purchase request
      const quotation = await storage.getQuotationByPurchaseRequestId(id);
      if (!quotation) {
        return res.json(null);
      }

      // Get supplier quotations for this quotation
      const supplierQuotations = await storage.getSupplierQuotations(quotation.id);
      const selectedSupplier = supplierQuotations.find(sq => sq.isChosen);

      if (!selectedSupplier) {
        return res.json(null);
      }

      // Get supplier details
      const supplier = await storage.getSupplierById(selectedSupplier.supplierId);

      // Get supplier quotation items
      const items = await storage.getSupplierQuotationItems(selectedSupplier.id);

      res.json({
        supplier,
        quotation: selectedSupplier,
        items,
        choiceReason: selectedSupplier.choiceReason
      });
    } catch (error) {
      console.error("Error getting selected supplier:", error);
      res.status(500).json({ message: "Failed to get selected supplier" });
    }
  });

  // Add isReceiver permission check middleware
  async function isReceiver(req: Request, res: Response, next: Function) {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user?.isReceiver && !user?.isAdmin) {
      return res.status(403).json({ message: "Acesso negado: permissão de recebimento necessária" });
    }

    next();
  }

  app.post("/api/purchase-requests/:id/confirm-receipt", isAuthenticated, isReceiver, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { receivedById } = req.body;

      const request = await storage.getPurchaseRequestById(id);
      if (!request || request.currentPhase !== "recebimento") {
        return res.status(400).json({ message: "Request must be in the receiving phase" });
      }

      const updateData = {
        receivedById: receivedById,
        receivedDate: new Date(),
        currentPhase: "conclusao_compra" as any,
        updatedAt: new Date()
      };

      const updatedRequest = await storage.updatePurchaseRequest(id, updateData);
      res.json(updatedRequest);
    } catch (error) {
      console.error("Error confirming receipt:", error);
      res.status(400).json({ message: "Failed to confirm receipt" });
    }
  });

  app.post("/api/purchase-requests/:id/report-issue", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { reportedById, pendencyReason } = req.body;

      const request = await storage.getPurchaseRequestById(id);
      if (!request || request.currentPhase !== "recebimento") {
        return res.status(400).json({ message: "Request must be in the receiving phase" });
      }

      const updateData = {
        currentPhase: "pedido_compra" as any,
        hasPendency: true,
        pendencyReason: pendencyReason || "Pendência reportada",
        updatedAt: new Date()
      };

      const updatedRequest = await storage.updatePurchaseRequest(id, updateData);
      res.json(updatedRequest);
    } catch (error) {
      console.error("Error reporting issue:", error);
      res.status(400).json({ message: "Failed to report issue" });
    }
  });

  app.get("/api/purchase-requests/:id/approval-history", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const history = await storage.getApprovalHistory(id);
      res.json(history);
    } catch (error) {
      console.error("Error fetching approval history:", error);
      res.status(500).json({ message: "Failed to fetch approval history" });
    }
  });

  // Complete timeline endpoint for all phase transitions
  app.get("/api/purchase-requests/:id/complete-timeline", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const timeline = await storage.getCompleteTimeline(id);
      res.json(timeline);
    } catch (error) {
      console.error("Error fetching complete timeline:", error);
      res.status(500).json({ message: "Failed to fetch complete timeline" });
    }
  });

  app.post("/api/purchase-requests/:id/create-purchase-order", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { purchaseObservations } = req.body;

      const updates = {
        purchaseDate: new Date(),
        purchaseObservations,
        currentPhase: "pedido_compra"
      } as const;

      const request = await storage.updatePurchaseRequest(id, updates);
      res.json(request);
    } catch (error) {
      console.error("Error creating purchase order:", error);
      res.status(400).json({ message: "Failed to create purchase order" });
    }
  });

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



  // Endpoint para atualizar a fase do cartão (Kanban) com controle de permissões
  app.patch("/api/purchase-requests/:id/update-phase", isAuthenticated, async (req, res) => {
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
        return res.status(404).json({ message: "Purchase request not found" });
      }

      // Verificar se a fase é válida
      const validPhases = ["solicitacao", "aprovacao_a1", "cotacao", "aprovacao_a2", "pedido_compra", "recebimento", "arquivado"] as const;
      if (!validPhases.includes(newPhase)) {
        return res.status(400).json({ message: "Invalid phase" });
      }

      // Permission checks based on current phase and user permissions
      const currentPhase = request.currentPhase;

      // Check if user has permission to move from current phase
      if (currentPhase === "aprovacao_a1" && !user.isApproverA1) {
        return res.status(403).json({ message: "Você não possui permissão para mover cards da fase Aprovação A1" });
      }

      if (currentPhase === "aprovacao_a2" && !user.isApproverA2) {
        return res.status(403).json({ message: "Você não possui permissão para mover cards da fase Aprovação A2" });
      }

      // Validate progression from "Cotação" to "Aprovação A2"
      if (currentPhase === "cotacao" && newPhase === "aprovacao_a2") {
        // Check if quotation exists
        const quotation = await storage.getQuotationByPurchaseRequestId(id);
        if (!quotation) {
          return res.status(400).json({ message: "Não é possível avançar para Aprovação A2: Nenhuma cotação foi criada" });
        }

        // Check if at least one supplier quotation exists
        const supplierQuotations = await storage.getSupplierQuotations(quotation.id);
        if (!supplierQuotations || supplierQuotations.length === 0) {
          return res.status(400).json({ message: "Não é possível avançar para Aprovação A2: Nenhuma cotação de fornecedor foi recebida" });
        }

        // Check if a supplier has been chosen
        const hasChosenSupplier = supplierQuotations.some(sq => sq.isChosen);
        if (!hasChosenSupplier) {
          return res.status(400).json({ message: "Não é possível avançar para Aprovação A2: Nenhum fornecedor foi selecionado na análise de cotações" });
        }
      }

      // Automatic approval logic when moving from approval phases
      let updates: any = {
        currentPhase: newPhase,
      };

      // Automatic A1 approval when moving from "aprovacao_a1" to "cotacao"
      if (currentPhase === "aprovacao_a1" && newPhase === "cotacao" && user.isApproverA1) {
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
      if (currentPhase === "aprovacao_a2" && newPhase === "pedido_compra" && user.isApproverA2) {
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

      // Send email notifications based on the new phase
      if (newPhase === "aprovacao_a1") {
        notifyApprovalA1(updatedRequest).catch(error => {
          console.error("Erro ao enviar notificação para aprovadores A1:", error);
        });
      } else if (newPhase === "aprovacao_a2") {
        notifyApprovalA2(updatedRequest).catch(error => {
          console.error("Erro ao enviar notificação para aprovadores A2:", error);
        });
      }

      res.json(updatedRequest);
    } catch (error) {
      console.error("Error updating request phase:", error);
      res.status(400).json({ message: "Failed to update phase" });
    }
  });

  // New route for advancing from "Pedido de Compra" to "Recebimento"
  app.post("/api/purchase-requests/:id/advance-to-receipt", isAuthenticated, async (req, res) => {
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
        return res.status(404).json({ message: "Purchase request not found" });
      }

      // Verify current phase is "pedido_compra"
      if (request.currentPhase !== "pedido_compra") {
        return res.status(400).json({ message: "Solicitação deve estar na fase 'Pedido de Compra' para avançar para recebimento" });
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

      res.json(updatedRequest);
    } catch (error) {
      console.error("Error advancing to receipt:", error);
      res.status(400).json({ message: "Failed to advance to receipt" });
    }
  });

  // Attachment routes for purchase requests removed - only keeping supplier attachments

  // POST route for purchase request attachments removed

  // Download attachment route
  app.get("/api/attachments/:id/download", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      // Import database and schema
      const { db } = await import('./db');
      const { attachments } = await import('../shared/schema');
      const { eq } = await import('drizzle-orm');

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
        return res.status(404).json({ message: "Arquivo não encontrado no servidor" });
      }

      // Set proper headers for file download
      const mimeType = mime.lookup(filePath) || 'application/octet-stream';
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${attachment[0].fileName}"`);

      // Stream file to response
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      console.error("Error downloading attachment:", error);
      res.status(500).json({ message: "Erro ao baixar arquivo" });
    }
  });

  // Quotation routes
  app.post("/api/purchase-requests/:id/quotations", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { supplierId, quotedValue, paymentConditions, deliveryDays, observations } = req.body;

      // For now, return success response as quotation functionality is simplified
      res.status(201).json({ 
        id: Date.now(), 
        supplierId, 
        quotedValue, 
        paymentConditions, 
        deliveryDays, 
        observations 
      });
    } catch (error) {
      console.error("Error creating quotation:", error);
      res.status(400).json({ message: "Failed to create quotation" });
    }
  });

  // Duplicate approval history route removed - using the working one above

  // Quotation history routes
  app.get("/api/purchase-requests/:id/quotation-history", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      // For now, return empty array as quotation history functionality is not fully implemented
      res.json([]);
    } catch (error) {
      console.error("Error fetching quotation history:", error);
      res.status(500).json({ message: "Failed to fetch quotation history" });
    }
  });

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

  app.get("/api/quotations/purchase-request/:purchaseRequestId", isAuthenticated, async (req, res) => {
    try {
      const purchaseRequestId = parseInt(req.params.purchaseRequestId);
      const quotation = await storage.getQuotationByPurchaseRequestId(purchaseRequestId);
      res.json(quotation || null);
    } catch (error) {
      console.error("Error fetching quotation by purchase request:", error);
      res.status(500).json({ message: "Failed to fetch quotation" });
    }
  });

  app.get("/api/quotations/purchase-request/:purchaseRequestId/history", isAuthenticated, async (req, res) => {
    try {
      const purchaseRequestId = parseInt(req.params.purchaseRequestId);
      const quotationHistory = await storage.getRFQHistoryByPurchaseRequestId(purchaseRequestId);
      res.json(quotationHistory);
    } catch (error) {
      console.error("Error fetching quotation history:", error);
      res.status(500).json({ message: "Failed to fetch quotation history" });
    }
  });

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

      // Use session user ID instead of frontend-provided createdBy for security
      const quotation = await storage.createQuotation({
        ...quotationDataForApi,
        createdBy: req.session.userId!
      });
      res.status(201).json(quotation);
    } catch (error) {
      console.error("Error creating quotation:", error);
      res.status(400).json({ message: "Invalid quotation data" });
    }
  });

  // Send RFQ to suppliers
  app.post("/api/quotations/:id/send-rfq", isAuthenticated, async (req, res) => {
    try {
      const quotationId = parseInt(req.params.id);
      const { sendEmail = true } = req.body;

      // Get quotation details
      const quotation = await storage.getQuotationById(quotationId);
      if (!quotation) {
        return res.status(404).json({ message: "Quotation not found" });
      }

      // Get purchase request
      const purchaseRequest = await storage.getPurchaseRequestById(quotation.purchaseRequestId);
      if (!purchaseRequest) {
        return res.status(404).json({ message: "Purchase request not found" });
      }

      // Get quotation items
      const quotationItems = await storage.getQuotationItems(quotationId);

      // Get supplier quotations to know which suppliers to send to
      const supplierQuotations = await storage.getSupplierQuotations(quotationId);
      const supplierIds = supplierQuotations.map(sq => sq.supplierId);

      // Get suppliers data
      const allSuppliers = await storage.getAllSuppliers();
      const selectedSuppliers = allSuppliers.filter(s => supplierIds.includes(s.id));

      if (sendEmail && selectedSuppliers.length > 0) {
        // Import email service
        const { sendRFQToSuppliers } = await import('./email-service');

        // Get logged-in user's email
        const loggedUser = await storage.getUser(req.session.userId!);
        const senderEmail = loggedUser?.email;

        // Prepare email data
        const rfqData = {
          quotationNumber: quotation.quotationNumber,
          requestNumber: purchaseRequest.requestNumber,
          quotationDeadline: quotation.quotationDeadline ? quotation.quotationDeadline.toISOString() : '',
          items: quotationItems.map(item => ({
            itemCode: item.itemCode,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            specifications: item.specifications || ''
          })),
          termsAndConditions: quotation.termsAndConditions || '',
          technicalSpecs: quotation.technicalSpecs || ''
        };

        // Send emails with logged-in user's email as sender
        const emailResult = await sendRFQToSuppliers(selectedSuppliers, rfqData, senderEmail);

        // Update quotation status to 'sent'
        await storage.updateQuotation(quotationId, { 
          status: 'sent'
        });

        // Update supplier quotations status
        for (const sq of supplierQuotations) {
          await storage.updateSupplierQuotation(sq.id, { 
            status: 'sent',
            sentAt: new Date()
          });
        }

        return res.json({
          success: true,
          message: `RFQ enviada para ${selectedSuppliers.length} fornecedor(es)`,
          emailResult: {
            sent: emailResult.success,
            errors: emailResult.errors
          }
        });
      } else {
        // Just update status without sending emails
        await storage.updateQuotation(quotationId, { 
          status: 'sent'
        });

        return res.json({
          success: true,
          message: "Status da cotação atualizado (sem envio de e-mail)",
        });
      }
    } catch (error) {
      console.error("Error sending RFQ:", error);
      res.status(500).json({ 
        message: "Erro ao enviar RFQ",
        error: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  app.put("/api/quotations/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const quotationData = insertQuotationSchema.partial().parse(req.body);
      const quotation = await storage.updateQuotation(id, quotationData);
      res.json(quotation);
    } catch (error) {
      console.error("Error updating quotation:", error);
      res.status(400).json({ message: "Failed to update quotation" });
    }
  });

  // Quotation Items routes
  app.get("/api/quotations/:quotationId/items", isAuthenticated, async (req, res) => {
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
  });

  app.post("/api/quotations/:quotationId/items", isAuthenticated, async (req, res) => {
    try {
      const quotationId = parseInt(req.params.quotationId);
      const itemData = insertQuotationItemSchema.parse({
        ...req.body,
        quotationId
      });
      const item = await storage.createQuotationItem(itemData);
      res.status(201).json(item);
    } catch (error) {
      console.error("Error creating quotation item:", error);
      res.status(400).json({ message: "Invalid quotation item data" });
    }
  });

  app.put("/api/quotation-items/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const itemData = insertQuotationItemSchema.partial().parse(req.body);
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
      await storage.deleteQuotationItem(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting quotation item:", error);
      res.status(400).json({ message: "Failed to delete quotation item" });
    }
  });

  // Supplier Quotations routes
  app.get("/api/quotations/:quotationId/supplier-quotations", isAuthenticated, async (req, res) => {
    try {
      const quotationId = parseInt(req.params.quotationId);

      if (isNaN(quotationId)) {
        return res.status(400).json({ message: "Invalid quotation ID" });
      }

      const supplierQuotations = await storage.getSupplierQuotations(quotationId);
      res.json(supplierQuotations);
    } catch (error) {
      console.error("Error fetching supplier quotations:", error);
      res.status(500).json({ message: "Failed to fetch supplier quotations" });
    }
  });

  app.post("/api/quotations/:quotationId/supplier-quotations", isAuthenticated, async (req, res) => {
    try {
      const quotationId = parseInt(req.params.quotationId);
      const supplierQuotationData = insertSupplierQuotationSchema.parse({
        ...req.body,
        quotationId
      });
      const supplierQuotation = await storage.createSupplierQuotation(supplierQuotationData);
      res.status(201).json(supplierQuotation);
    } catch (error) {
      console.error("Error creating supplier quotation:", error);
      res.status(400).json({ message: "Invalid supplier quotation data" });
    }
  });

  // Get specific supplier quotation for a quotation
  app.get("/api/quotations/:quotationId/supplier-quotations/:supplierId", isAuthenticated, async (req, res) => {
    try {
      const quotationId = parseInt(req.params.quotationId);
      const supplierId = parseInt(req.params.supplierId);

      const supplierQuotations = await storage.getSupplierQuotations(quotationId);
      const supplierQuotation = supplierQuotations.find(sq => sq.supplierId === supplierId);

      if (!supplierQuotation) {
        return res.json(null);
      }

      // Get items for this supplier quotation
      const items = await storage.getSupplierQuotationItems(supplierQuotation.id);

      res.json({
        ...supplierQuotation,
        items
      });
    } catch (error) {
      console.error("Error fetching supplier quotation:", error);
      res.status(500).json({ message: "Failed to fetch supplier quotation" });
    }
  });

  app.put("/api/supplier-quotations/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const supplierQuotationData = insertSupplierQuotationSchema.partial().parse(req.body);
      const supplierQuotation = await storage.updateSupplierQuotation(id, supplierQuotationData);
      res.json(supplierQuotation);
    } catch (error) {
      console.error("Error updating supplier quotation:", error);
      res.status(400).json({ message: "Failed to update supplier quotation" });
    }
  });

  // Supplier Quotation Items routes
  app.get("/api/supplier-quotations/:supplierQuotationId/items", isAuthenticated, async (req, res) => {
    try {
      const supplierQuotationId = parseInt(req.params.supplierQuotationId);
      const items = await storage.getSupplierQuotationItems(supplierQuotationId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching supplier quotation items:", error);
      res.status(500).json({ message: "Failed to fetch supplier quotation items" });
    }
  });

  app.post("/api/supplier-quotations/:supplierQuotationId/items", isAuthenticated, async (req, res) => {
    try {
      const supplierQuotationId = parseInt(req.params.supplierQuotationId);
      const itemData = insertSupplierQuotationItemSchema.parse({
        ...req.body,
        supplierQuotationId
      });
      const item = await storage.createSupplierQuotationItem(itemData);
      res.status(201).json(item);
    } catch (error) {
      console.error("Error creating supplier quotation item:", error);
      res.status(400).json({ message: "Invalid supplier quotation item data" });
    }
  });

  app.put("/api/supplier-quotation-items/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const itemData = insertSupplierQuotationItemSchema.partial().parse(req.body);
      const item = await storage.updateSupplierQuotationItem(id, itemData);
      res.json(item);
    } catch (error) {
      console.error("Error updating supplier quotation item:", error);
      res.status(400).json({ message: "Failed to update supplier quotation item" });
    }
  });

  // Rota para deletar uma requisição de compra
  app.delete("/api/purchase-requests/:id", isAuthenticated, async (req, res) => {
    try {
      const requestId = Number(req.params.id);
      const request = await storage.getPurchaseRequestById(requestId);

      if (!request) {
        return res.status(404).json({ message: "Requisição não encontrada" });
      }

      if (request.currentPhase !== "solicitacao") {
        return res.status(400).json({ message: "Só é possível excluir requisições na fase de Solicitação" });
      }

      if (request.approvedA1 !== null) {
        return res.status(400).json({ message: "Não é possível excluir uma requisição já aprovada/reprovada" });
      }

      await storage.deletePurchaseRequest(requestId);

      res.json({ message: "Requisição excluída com sucesso" });
    } catch (error) {
      console.error("Erro ao excluir requisição:", error);
      res.status(500).json({ message: "Erro ao excluir requisição" });
    }
  });

  // Rota para arquivar diretamente uma requisição
  app.post("/api/purchase-requests/:id/archive-direct", isAuthenticated, async (req, res) => {
    try {
      const requestId = Number(req.params.id);
      const request = await storage.getPurchaseRequestById(requestId);

      if (!request) {
        return res.status(404).json({ message: "Requisição não encontrada" });
      }

      await storage.updatePurchaseRequest(requestId, {
        currentPhase: "arquivado"
      });

      const updatedRequest = await storage.getPurchaseRequestById(requestId);
      res.json(updatedRequest);
    } catch (error) {
      console.error("Erro ao arquivar requisição:", error);
      res.status(500).json({ message: "Erro ao arquivar requisição" });
    }
  });

  // Rota para atualizar cotação de fornecedor (marcar como recebida com valores)
  app.post("/api/quotations/:quotationId/update-supplier-quotation", isAuthenticated, async (req, res) => {
    try {
      const quotationId = parseInt(req.params.quotationId);
      const { supplierId, items, totalValue, paymentTerms, deliveryTerms, warrantyPeriod, observations } = req.body;

      console.log("Update supplier quotation request:", {
        quotationId,
        supplierId,
        items: items?.length || 0,
        totalValue,
        paymentTerms,
        deliveryTerms,
        warrantyPeriod,
        observations
      });

      if (!supplierId) {
        return res.status(400).json({ message: "ID do fornecedor é obrigatório" });
      }

      // Buscar a cotação
      const quotation = await storage.getQuotationById(quotationId);
      if (!quotation) {
        return res.status(404).json({ message: "Cotação não encontrada" });
      }

      // Buscar cotação do fornecedor
      const supplierQuotations = await storage.getSupplierQuotations(quotationId);
      let supplierQuotation = supplierQuotations.find(sq => sq.supplierId === supplierId);

      if (!supplierQuotation) {
        // Criar nova cotação do fornecedor se não existir
        supplierQuotation = await storage.createSupplierQuotation({
          quotationId,
          supplierId,
          status: "received",
          totalValue: null,
          sentAt: null,
          receivedAt: new Date()
        });
      }

      // Atualizar a cotação do fornecedor
      const updateData = {
        status: "received",
        totalValue: totalValue || null,
        paymentTerms: paymentTerms || null,
        deliveryTerms: deliveryTerms || null,
        warrantyPeriod: warrantyPeriod || null,
        observations: observations || null,
        receivedAt: new Date()
      };
      console.log("Updating supplier quotation with data:", updateData);

      await storage.updateSupplierQuotation(supplierQuotation.id, updateData);

      // Atualizar ou criar itens da cotação
      if (items && items.length > 0) {
        // Buscar itens existentes
        const existingItems = await storage.getSupplierQuotationItems(supplierQuotation.id);

        for (const item of items) {
          const existingItem = existingItems.find(ei => ei.quotationItemId === item.quotationItemId);

          if (existingItem) {
            // Buscar quantidade do item de cotação
            const quotationItems = await storage.getQuotationItems(quotationId);
            const quotationItem = quotationItems.find(qi => qi.id === item.quotationItemId);
            const quantity = parseFloat(quotationItem?.quantity || "1");

            // Atualizar item existente
            await storage.updateSupplierQuotationItem(existingItem.id, {
              unitPrice: item.unitPrice.toString(),
              totalPrice: (item.unitPrice * quantity).toString(),
              deliveryDays: item.deliveryDays,
              brand: item.brand,
              model: item.model,
              observations: item.observations
            });
          } else {
            // Buscar quantidade do item de cotação
            const quotationItems = await storage.getQuotationItems(quotationId);
            const quotationItem = quotationItems.find(qi => qi.id === item.quotationItemId);
            const quantity = parseFloat(quotationItem?.quantity || "1");

            // Criar novo item
            await storage.createSupplierQuotationItem({
              supplierQuotationId: supplierQuotation.id,
              quotationItemId: item.quotationItemId,
              unitPrice: item.unitPrice.toString(),
              totalPrice: (item.unitPrice * quantity).toString(),
              deliveryDays: item.deliveryDays,
              brand: item.brand,
              model: item.model,
              observations: item.observations
            });
          }
        }
      }

      res.json({ message: "Cotação do fornecedor atualizada com sucesso" });
    } catch (error) {
      console.error("Error updating supplier quotation:", error);
      res.status(500).json({ message: "Erro ao atualizar cotação do fornecedor" });
    }
  });

  // Upload supplier quotation files
  app.post("/api/quotations/:quotationId/upload-supplier-file", isAuthenticated, quotationUpload.single('file'), async (req, res) => {
    try {
      const quotationId = parseInt(req.params.quotationId);
      const { attachmentType, supplierId } = req.body;

      console.log("Upload request received:", {
        quotationId,
        attachmentType,
        supplierId,
        hasFile: !!req.file,
        fileName: req.file?.originalname,
        fileSize: req.file?.size
      });

      if (!req.file) {
        console.error("No file received in upload request");
        return res.status(400).json({ message: "Nenhum arquivo foi enviado" });
      }

      if (!supplierId) {
        console.error("No supplierId provided in upload request");
        return res.status(400).json({ message: "ID do fornecedor é obrigatório" });
      }

      // Find supplier quotation
      const supplierQuotations = await storage.getSupplierQuotations(quotationId);
      const supplierQuotation = supplierQuotations.find(sq => sq.supplierId === parseInt(supplierId));

      if (!supplierQuotation) {
        console.error("Supplier quotation not found:", { quotationId, supplierId });
        return res.status(404).json({ message: "Cotação do fornecedor não encontrada" });
      }

      console.log("Creating attachment for supplier quotation:", supplierQuotation.id);

      // Add attachment to database
      const attachment = await storage.createAttachment({
        supplierQuotationId: supplierQuotation.id,
        fileName: req.file.originalname,
        filePath: `/uploads/supplier_quotations/${req.file.filename}`,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        attachmentType: attachmentType || "supplier_proposal"
      });

      console.log("Attachment created successfully:", attachment.id);

      res.json({ 
        message: "Arquivo enviado com sucesso",
        fileName: req.file.originalname,
        attachmentId: attachment.id
      });
    } catch (error) {
      console.error("Error uploading supplier file:", error);
      res.status(500).json({ message: "Erro ao enviar arquivo" });
    }
  });

  // Get all supplier attachments for a purchase request
  app.get("/api/purchase-requests/:id/supplier-attachments", isAuthenticated, async (req, res) => {
    try {
      const purchaseRequestId = parseInt(req.params.id);

      // Get quotation for this purchase request
      const quotation = await storage.getQuotationByPurchaseRequestId(purchaseRequestId);
      if (!quotation) {
        return res.json([]);
      }

      // Get all supplier quotations
      const supplierQuotations = await storage.getSupplierQuotations(quotation.id);

      // Get all attachments for all supplier quotations
      const allAttachments = await Promise.all(
        supplierQuotations.map(async (sq: any) => {
          // Get supplier details
          const supplier = await storage.getSupplierById(sq.supplierId);

          // Get attachments for this supplier quotation - using a simple query since we don't have a storage method
          const { db } = await import('./db');
          const { attachments } = await import('../shared/schema');
          const { eq } = await import('drizzle-orm');
          const sqAttachments = await db.select().from(attachments).where(eq(attachments.supplierQuotationId, sq.id));

          return sqAttachments.map((attachment: any) => ({
            ...attachment,
            supplierName: supplier?.name || "Fornecedor desconhecido",
            supplierId: sq.supplierId,
            supplierQuotationId: sq.id
          }));
        })
      );

      // Flatten the array and filter out empty arrays
      const flatAttachments = allAttachments.flat().filter(Boolean);

      res.json(flatAttachments);
    } catch (error) {
      console.error("Error fetching supplier attachments:", error);
      res.status(500).json({ message: "Erro ao buscar anexos dos fornecedores" });
    }
  });

  // Get all attachments for a quotation (from all suppliers)
  app.get("/api/quotations/:quotationId/attachments", isAuthenticated, async (req, res) => {
    try {
      const quotationId = parseInt(req.params.quotationId);

      // Get all supplier quotations for this quotation
      const supplierQuotations = await storage.getSupplierQuotations(quotationId);

      // Get all attachments for all supplier quotations
      const { db } = await import('./db');
      const { attachments } = await import('../shared/schema');
      const { eq, inArray } = await import('drizzle-orm');

      if (supplierQuotations.length === 0) {
        return res.json([]);
      }

      const supplierQuotationIds = supplierQuotations.map(sq => sq.id);
      const allAttachments = await db.select().from(attachments)
        .where(inArray(attachments.supplierQuotationId, supplierQuotationIds));

      // Add supplier information to attachments
      const attachmentsWithSupplier = await Promise.all(
        allAttachments.map(async (attachment) => {
          const supplierQuotation = supplierQuotations.find(sq => sq.id === attachment.supplierQuotationId);
          const supplier = supplierQuotation ? await storage.getSupplierById(supplierQuotation.supplierId) : null;

          return {
            ...attachment,
            supplierName: supplier?.name || "Fornecedor desconhecido",
            supplierId: supplierQuotation?.supplierId,
          };
        })
      );

      res.json(attachmentsWithSupplier);
    } catch (error) {
      console.error("Error fetching quotation attachments:", error);
      res.status(500).json({ message: "Erro ao buscar anexos da cotação" });
    }
  });

  // Get supplier quotation attachments
  app.get("/api/quotations/:quotationId/supplier-quotations/:supplierId/attachments", isAuthenticated, async (req, res) => {
    try {
      const quotationId = parseInt(req.params.quotationId);
      const supplierId = parseInt(req.params.supplierId);

      // Find the supplier quotation
      const supplierQuotations = await storage.getSupplierQuotations(quotationId);
      const supplierQuotation = supplierQuotations.find(sq => sq.supplierId === supplierId);

      if (!supplierQuotation) {
        return res.json([]);
      }

      // Get attachments for this supplier quotation
      const { db } = await import('./db');
      const { attachments } = await import('../shared/schema');
      const { eq } = await import('drizzle-orm');
      const sqAttachments = await db.select().from(attachments).where(eq(attachments.supplierQuotationId, supplierQuotation.id));

      res.json(sqAttachments);
    } catch (error) {
      console.error("Error fetching supplier quotation attachments:", error);
      res.status(500).json({ message: "Erro ao buscar anexos da cotação" });
    }
  });

  // Rota para selecionar fornecedor vencedor na cotação
  app.post("/api/quotations/:quotationId/select-supplier", isAuthenticated, async (req, res) => {
    try {
      const quotationId = parseInt(req.params.quotationId);
      const { selectedSupplierId, totalValue, observations } = req.body;

      // Buscar a cotação
      const quotation = await storage.getQuotationById(quotationId);
      if (!quotation) {
        return res.status(404).json({ message: "Cotação não encontrada" });
      }

      // Buscar todas as cotações dos fornecedores
      const supplierQuotations = await storage.getSupplierQuotations(quotationId);

      // Marcar todas as cotações como não escolhidas primeiro
      await Promise.all(
        supplierQuotations.map(sq => 
          storage.updateSupplierQuotation(sq.id, { isChosen: false })
        )
      );

      // Marcar apenas a cotação do fornecedor selecionado como escolhida
      const selectedSupplierQuotation = supplierQuotations.find(sq => sq.supplierId === selectedSupplierId);
      if (selectedSupplierQuotation) {
        await storage.updateSupplierQuotation(selectedSupplierQuotation.id, { 
          isChosen: true,
          choiceReason: observations
        });
      }

      // Atualizar a cotação (status e observações)
      await storage.updateQuotation(quotationId, {
        status: "approved",
      });

      // Avançar a solicitação para aprovação A2
      await storage.updatePurchaseRequest(quotation.purchaseRequestId, {
        currentPhase: "aprovacao_a2",
        totalValue,
        chosenSupplierId: selectedSupplierId,
        choiceReason: observations
      });

      res.json({ message: "Fornecedor selecionado com sucesso" });
    } catch (error) {
      console.error("Error selecting supplier:", error);
      res.status(400).json({ message: "Failed to select supplier" });
    }
  });

  // Rota para obter informações detalhadas de comparação de fornecedores
  app.get("/api/quotations/:quotationId/supplier-comparison", isAuthenticated, async (req, res) => {
    try {
      const quotationId = parseInt(req.params.quotationId);

      // Buscar cotações dos fornecedores
      const supplierQuotations = await storage.getSupplierQuotations(quotationId);

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
            status: sq.status || "received"
          };
        })
      );

      res.json(detailedComparison);
    } catch (error) {
      console.error("Error fetching supplier comparison:", error);
      res.status(500).json({ message: "Failed to fetch supplier comparison" });
    }
  });

  // Rota para marcar fornecedor como não respondeu
  app.put("/api/supplier-quotations/:id/mark-no-response", isAuthenticated, async (req, res) => {
    try {
      const supplierQuotationId = parseInt(req.params.id);

      const updatedSupplierQuotation = await storage.updateSupplierQuotation(supplierQuotationId, {
        status: 'no_response'
      });

      res.json(updatedSupplierQuotation);
    } catch (error) {
      console.error("Error marking supplier as no response:", error);
      res.status(500).json({ message: "Failed to mark supplier as no response" });
    }
  });

  // PDF Generation routes
  app.get("/api/purchase-requests/:id/pdf", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      // Import PDF service
      const { PDFService } = await import('./pdf-service');

      // Generate PDF
      const pdfBuffer = await PDFService.generatePurchaseOrderPDF(id);

      // Get purchase request to use in filename
      const purchaseRequest = await storage.getPurchaseRequestById(id);
      const filename = `Pedido_Compra_${purchaseRequest?.requestNumber || id}`;

      // Check if the buffer is HTML (fallback mode)
      const bufferString = pdfBuffer.toString('utf8');
      if (bufferString.includes('<!DOCTYPE html>')) {
        // Return HTML file for browser to print/save as PDF
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.html"`);
        res.send(pdfBuffer);
      } else {
        // Return actual PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.send(pdfBuffer);
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ 
        message: "Erro ao gerar PDF",
        error: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  // Dashboard API endpoints
  app.get("/api/dashboard", isAuthenticated, async (req, res) => {
    try {
      const { period = "30", department = "all", status = "all" } = req.query;

      // Check if user is manager or admin
      const user = await storage.getUser(req.session.userId!);
      if (!user?.isManager && !user?.isAdmin) {
        return res.status(403).json({ message: "Manager access required" });
      }

      // Calculate date range
      const daysAgo = parseInt(period as string);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);

      // Get all purchase requests within the period
      const allRequests = await storage.getAllPurchaseRequests();
      const filteredRequests = allRequests.filter(request => {
        const createdAt = new Date(request.createdAt);
        const isInPeriod = createdAt >= startDate;

        const departmentMatch = department === "all" || 
          (request.costCenter?.departmentId === parseInt(department as string));

        const statusMatch = status === "all" || request.currentPhase === status;

        return isInPeriod && departmentMatch && statusMatch;
      });

      // Calculate KPIs
      const totalActiveRequests = filteredRequests.filter(req => 
        req.currentPhase !== "arquivado"
      ).length;

      const totalProcessingValue = filteredRequests.reduce((sum, req) => 
        sum + (Number(req.totalValue) || Number(req.availableBudget) || 0), 0
      );

      // Calculate average approval time (simplified)
      const approvedRequests = filteredRequests.filter(req => 
        req.currentPhase !== "solicitacao" && req.approvalDateA1
      );
      const averageApprovalTime = approvedRequests.length > 0 
        ? Math.round(approvedRequests.reduce((sum, req) => {
            const created = new Date(req.createdAt);
            const approved = new Date(req.approvalDateA1!);
            return sum + (approved.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
          }, 0) / approvedRequests.length)
        : 0;

      // Calculate approval rate
      const totalRequestsWithDecision = filteredRequests.filter(req => 
        req.currentPhase !== "solicitacao"
      ).length;
      const approvedRequestsCount = filteredRequests.filter(req => 
        req.approvedA1 !== false && req.currentPhase !== "solicitacao"
      ).length;
      const approvalRate = totalRequestsWithDecision > 0 
        ? Math.round((approvedRequestsCount / totalRequestsWithDecision) * 100)
        : 0;

      // Get departments for analysis
      const departments = await storage.getAllDepartments();
      const requestsByDepartment = departments.map(dept => {
        const deptRequests = filteredRequests.filter(req => 
          req.costCenter?.departmentId === dept.id
        );
        return {
          name: dept.name,
          value: deptRequests.length
        };
      }).filter(item => item.value > 0);

      // Urgency distribution
      const urgencyDistribution = [
        { name: "Baixa", value: filteredRequests.filter(req => req.urgency === "Baixo").length },
        { name: "Média", value: filteredRequests.filter(req => req.urgency === "Médio").length },
        { name: "Alta", value: filteredRequests.filter(req => req.urgency === "Alto").length }
      ].filter(item => item.value > 0);

      // Monthly trend (last 6 months)
      const monthlyTrend = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

        const monthRequests = allRequests.filter(req => {
          const reqDate = new Date(req.createdAt);
          return reqDate >= monthStart && reqDate <= monthEnd;
        });

        monthlyTrend.push({
          month: date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
          requests: monthRequests.length
        });
      }

      // Phase conversion funnel
      const phaseNames = {
        "solicitacao": "Solicitação",
        "aprovacao_a1": "Aprovação A1", 
        "cotacao": "Cotação",
        "aprovacao_a2": "Aprovação A2",
        "pedido_compra": "Pedido Compra",
        "conclusao_compra": "Conclusão",
        "recebimento": "Recebimento",
        "arquivado": "Arquivado"
      };

      const phases = [
        "solicitacao", "aprovacao_a1", "cotacao", "aprovacao_a2", 
        "pedido_compra", "conclusao_compra", "recebimento", "arquivado"
      ];
      const phaseConversion = phases.map(phase => ({
        name: phaseNames[phase as keyof typeof phaseNames] || phase,
        value: filteredRequests.filter(req => req.currentPhase === phase).length
      })).filter(item => item.value > 0);

      // Top departments by value
      const topDepartments = departments.map(dept => {
        const deptRequests = filteredRequests.filter(req => 
          req.costCenter?.departmentId === dept.id
        );
        const totalValue = deptRequests.reduce((sum, req) => 
          sum + (Number(req.totalValue) || Number(req.availableBudget) || 0), 0
        );
        return {
          name: dept.name,
          totalValue,
          requestCount: deptRequests.length
        };
      }).filter(item => item.totalValue > 0)
        .sort((a, b) => b.totalValue - a.totalValue)
        .slice(0, 5);

      // Top suppliers (simplified - would need supplier data)
      const suppliers = await storage.getAllSuppliers();
      const topSuppliers = suppliers.map(supplier => {
        const supplierRequests = filteredRequests.filter(req => 
          req.chosenSupplierId === supplier.id
        );
        const totalValue = supplierRequests.reduce((sum, req) => 
          sum + (Number(req.totalValue) || 0), 0
        );
        return {
          name: supplier.name,
          requestCount: supplierRequests.length,
          totalValue
        };
      }).filter(item => item.requestCount > 0)
        .sort((a, b) => b.requestCount - a.requestCount)
        .slice(0, 5);

      // Delayed requests (simplified SLA check)
      const delayedRequests = filteredRequests.filter(req => {
        const daysSinceCreated = (Date.now() - new Date(req.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceCreated > 15 && req.currentPhase !== "arquivado"; // 15 days SLA
      }).map(req => ({
        id: req.id,
        requestNumber: req.requestNumber,
        phase: req.currentPhase,
        daysDelayed: Math.floor((Date.now() - new Date(req.createdAt).getTime()) / (1000 * 60 * 60 * 24)) - 15
      }));

      // Cost center summary
      const costCenters = await storage.getAllCostCenters();
      const costCenterSummary = costCenters.map(cc => {
        const ccRequests = filteredRequests.filter(req => 
          req.costCenterId === cc.id
        );
        const totalValue = ccRequests.reduce((sum, req) => 
          sum + (Number(req.totalValue) || Number(req.availableBudget) || 0), 0
        );
        return {
          name: cc.name,
          totalValue,
          requestCount: ccRequests.length
        };
      }).filter(item => item.totalValue > 0)
        .sort((a, b) => b.totalValue - a.totalValue);

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
        costCenterSummary
      });
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      res.status(500).json({ message: "Failed to fetch dashboard data" });
    }
  });

  // Dashboard PDF export
  app.get('/api/dashboard/export-pdf', isAuthenticated, async (req, res) => {
    try {
      const { period, department, status } = req.query;

      // Get dashboard data (reuse the same logic)
      const dashboardResponse = await fetch(`${req.protocol}://${req.get('host')}/api/dashboard?period=${period}&department=${department}&status=${status}`, {
        headers: {
          'Cookie': req.headers.cookie || ''
        }
      });
      const dashboardData = await dashboardResponse.json();

      // Generate PDF using the PDF service
      const pdfBuffer = await PDFService.generateDashboardPDF(dashboardData);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="dashboard-executivo-${new Date().toISOString().split('T')[0]}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Error generating dashboard PDF:', error);
      res.status(500).json({ error: 'Error generating PDF' });
    }
  });

  // Serve uploaded supplier quotation files
  app.get("/api/files/supplier-quotations/:filename", isAuthenticated, async (req, res) => {
    try {
      const filename = req.params.filename;
      const filePath = path.join(process.cwd(), 'uploads', 'supplier_quotations', filename);

      console.log("Serving file:", filePath);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "Arquivo não encontrado" });
      }

      // Get file stats
      const stats = fs.statSync(filePath);
      const fileSize = stats.size;

      // Set appropriate headers
      const mimeType = mime.lookup(filePath) || 'application/octet-stream';
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', fileSize);
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

      // Stream the file
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      console.error("Error serving supplier quotation file:", error);
      res.status(500).json({ message: "Erro ao servir arquivo" });
    }
  });

  // Test email configuration
  app.get("/api/test-email", isAuthenticated, async (req, res) => {
    try {
      const isConfigured = await testEmailConfiguration();
      res.json({ 
        configured: isConfigured,
        message: isConfigured ? "Configuração de e-mail válida" : "Erro na configuração de e-mail"
      });
    } catch (error) {
      console.error("Erro ao testar configuração de e-mail:", error);
      res.status(500).json({ message: "Erro ao testar configuração de e-mail" });
    }
  });

  // Data cleanup endpoint (Admin only)
  app.post("/api/admin/cleanup-purchase-data", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { confirmationText } = req.body;

      // Require confirmation text to prevent accidental deletions
      if (confirmationText !== "CONFIRMAR LIMPEZA") {
        return res.status(400).json({ 
          message: "Texto de confirmação incorreto. Digite exatamente: CONFIRMAR LIMPEZA" 
        });
      }

      await storage.cleanupPurchaseRequestsData();

      res.json({ 
        message: "Limpeza realizada com sucesso! Todos os dados de solicitações foram removidos, mantendo cadastros básicos.",
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
            "Anexos"
          ],
          maintained: [
            "Usuários",
            "Departamentos", 
            "Centros de custo",
            "Fornecedores",
            "Métodos de pagamento"
          ]
        }
      });
    } catch (error) {
      console.error("Erro na limpeza de dados:", error);
      res.status(500).json({ 
        message: "Erro ao realizar limpeza de dados",
        error: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  // Archive purchase request endpoint for ConclusionPhase
  app.patch("/api/purchase-requests/:id/archive", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { conclusionObservations } = req.body;

      const updates = {
        currentPhase: "arquivado" as const,
        conclusionObservations,
        archivedDate: new Date(),
      };

      const request = await storage.updatePurchaseRequest(id, updates);
      res.json(request);
    } catch (error) {
      console.error("Error archiving request:", error);
      res.status(400).json({ message: "Failed to archive request" });
    }
  });

  // Send conclusion email endpoint
  app.post("/api/purchase-requests/:id/send-conclusion-email", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const request = await storage.getPurchaseRequestById(id);

      if (!request) {
        return res.status(404).json({ message: "Purchase request not found" });
      }

      // Here you would implement the email sending logic
      // For now, return success response
      res.json({ message: "Conclusion email sent successfully" });
    } catch (error) {
      console.error("Error sending conclusion email:", error);
      res.status(500).json({ message: "Failed to send conclusion email" });
    }
  });

  // Generate completion summary PDF endpoint
  app.get("/api/purchase-requests/:id/completion-summary-pdf", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const request = await storage.getPurchaseRequestById(id);

      if (!request) {
        return res.status(404).json({ message: "Purchase request not found" });
      }

      // Import PDF service
      const { PDFService } = await import('./pdf-service');

      // Generate completion summary PDF
      const pdfBuffer = await PDFService.generateCompletionSummaryPDF(id);

      // Set headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Conclusao_${request.requestNumber}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);

      // Send PDF
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating completion PDF:", error);
      res.status(500).json({ message: "Failed to generate completion PDF" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}