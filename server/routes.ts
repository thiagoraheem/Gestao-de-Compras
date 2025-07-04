import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertUserSchema, 
  insertDepartmentSchema, 
  insertCostCenterSchema, 
  insertSupplierSchema, 
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

export async function registerRoutes(app: Express): Promise<Server> {
  // Configure session
  app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-here',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true in production with HTTPS
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

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
      res.json({ 
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        departmentId: user.departmentId,
        isBuyer: user.isBuyer,
        isApproverA1: user.isApproverA1,
        isApproverA2: user.isApproverA2
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
        res.json({ 
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          departmentId: user.departmentId,
          department,
          isBuyer: user.isBuyer,
          isApproverA1: user.isApproverA1,
          isApproverA2: user.isApproverA2
        });
      } else {
        res.status(401).json({ message: "Unauthorized" });
      }
    } else {
      res.status(401).json({ message: "Unauthorized" });
    }
  });

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

  app.post("/api/users", isAuthenticated, async (req, res) => {
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
      res.status(400).json({ message: "Invalid user data" });
    }
  });

  app.put("/api/users/:id", isAuthenticated, async (req, res) => {
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
      res.status(400).json({ message: "Invalid user data" });
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
      res.status(400).json({ message: "Failed to update profile" });
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
      const departments = await storage.getAllDepartments();
      res.json(departments);
    } catch (error) {
      console.error("Error fetching departments:", error);
      res.status(500).json({ message: "Failed to fetch departments" });
    }
  });

  app.post("/api/departments", isAuthenticated, async (req, res) => {
    try {
      const departmentData = insertDepartmentSchema.parse(req.body);
      const department = await storage.createDepartment(departmentData);
      res.status(201).json(department);
    } catch (error) {
      console.error("Error creating department:", error);
      res.status(400).json({ message: "Invalid department data" });
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

  app.post("/api/cost-centers", isAuthenticated, async (req, res) => {
    try {
      const costCenterData = insertCostCenterSchema.parse(req.body);
      const costCenter = await storage.createCostCenter(costCenterData);
      res.status(201).json(costCenter);
    } catch (error) {
      console.error("Error creating cost center:", error);
      res.status(400).json({ message: "Invalid cost center data" });
    }
  });

  // Suppliers routes
  app.get("/api/suppliers", isAuthenticated, async (req, res) => {
    try {
      const suppliers = await storage.getAllSuppliers();
      res.json(suppliers);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      res.status(500).json({ message: "Failed to fetch suppliers" });
    }
  });

  app.post("/api/suppliers", isAuthenticated, async (req, res) => {
    try {
      const supplierData = insertSupplierSchema.parse(req.body);
      const supplier = await storage.createSupplier(supplierData);
      res.status(201).json(supplier);
    } catch (error) {
      console.error("Error creating supplier:", error);
      res.status(400).json({ message: "Invalid supplier data" });
    }
  });

  app.put("/api/suppliers/:id", isAuthenticated, async (req, res) => {
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

  // Purchase Requests routes
  app.get("/api/purchase-requests", isAuthenticated, async (req, res) => {
    try {
      const requests = await storage.getAllPurchaseRequests();
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
      let validatedItems = [];
      if (items && Array.isArray(items)) {
        validatedItems = items.map((item: any) => insertPurchaseRequestItemSchema.parse({
          ...item,
          purchaseRequestId: 0, // Será substituído depois com o ID correto
          // Garantir que os valores são passados corretamente
          itemNumber: item.itemNumber || '',
          description: item.description || '',
          unit: item.unit || '',
          requestedQuantity: item.requestedQuantity || 0,
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

  // Purchase Request Items routes
  app.get("/api/purchase-requests/:id/items", isAuthenticated, async (req, res) => {
    try {
      const purchaseRequestId = parseInt(req.params.id);
      const items = await storage.getPurchaseRequestItems(purchaseRequestId);
      res.json(items);
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
  app.post("/api/purchase-requests/:id/approve-a1", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { approved, rejectionReason, approverId } = req.body;
      
      // Debug: Log dos dados recebidos
      console.log('Dados recebidos:', { id, approved, rejectionReason, approverId });

      // Verificar se a fase atual é válida
      const request = await storage.getPurchaseRequestById(id);
      console.log('Solicitação atual:', request);

      if (!request || request.currentPhase !== "aprovacao_a1") {
        return res.status(400).json({ message: "Request must be in the A1 approval phase" });
      }

      // Garantindo que todos os campos sejam atualizados em uma única operação
      const updateData = {
        approverA1Id: approverId,
        approvedA1: approved,
        approvalDateA1: new Date(),
        currentPhase: approved ? "cotacao" : "arquivado",
        rejectionReasonA1: approved ? null : (rejectionReason || "Solicitação reprovada"),
        updatedAt: new Date() // Garantir que o timestamp seja atualizado
      };

      // Debug: Log dos dados de atualização
      console.log('Dados para atualização:', updateData);

      // Atualizando a solicitação
      const updatedRequest = await storage.updatePurchaseRequest(id, updateData);

      // Debug: Log da solicitação atualizada
      console.log('Solicitação após atualização:', updatedRequest);

      res.json(updatedRequest);
    } catch (error) {
      // Debug: Log detalhado do erro
      console.error("Error approving A1:", error);
      console.error("Stack trace:", error.stack);
      res.status(400).json({ message: "Failed to process approval", error: error.message });
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
        currentPhase: "aprovacao_a2",
      };
      
      const request = await storage.updatePurchaseRequest(id, updates);
      res.json(request);
    } catch (error) {
      console.error("Error updating quotation:", error);
      res.status(400).json({ message: "Failed to update quotation" });
    }
  });

  app.post("/api/purchase-requests/:id/approve-a2", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { approverId, chosenSupplierId, choiceReason, negotiatedValue, discountsObtained, deliveryDate } = req.body;
      
      const updates = {
        approverA2Id: approverId,
        chosenSupplierId,
        choiceReason,
        negotiatedValue,
        discountsObtained,
        deliveryDate: new Date(deliveryDate),
        currentPhase: "pedido_compra",
      };
      
      const request = await storage.updatePurchaseRequest(id, updates);
      res.json(request);
    } catch (error) {
      console.error("Error approving A2:", error);
      res.status(400).json({ message: "Failed to process approval" });
    }
  });

  app.post("/api/purchase-requests/:id/create-purchase-order", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { purchaseObservations } = req.body;
      
      const updates = {
        purchaseDate: new Date(),
        purchaseObservations,
        currentPhase: "conclusao_compra",
      };
      
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
        currentPhase: "recebimento",
      };
      
      const request = await storage.updatePurchaseRequest(id, updates);
      res.json(request);
    } catch (error) {
      console.error("Error receiving material:", error);
      res.status(400).json({ message: "Failed to record material receipt" });
    }
  });

  app.post("/api/purchase-requests/:id/archive", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      const updates = {
        currentPhase: "arquivado",
      };
      
      const request = await storage.updatePurchaseRequest(id, updates);
      res.json(request);
    } catch (error) {
      console.error("Error archiving request:", error);
      res.status(400).json({ message: "Failed to archive request" });
    }
  });

  // Endpoint para atualizar a fase do cartão (Kanban)
  app.patch("/api/purchase-requests/:id/update-phase", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { newPhase } = req.body;

      // Verificar se a fase é válida
      const validPhases = ['solicitacao', 'aprovacao_a1', 'cotacao', 'aprovacao_a2', 'pedido_compra', 'recebimento', 'arquivado'];
      if (!validPhases.includes(newPhase)) {
        return res.status(400).json({ message: "Invalid phase" });
      }

      const updates = {
        currentPhase: newPhase,
      };

      const request = await storage.updatePurchaseRequest(id, updates);
      res.json(request);
    } catch (error) {
      console.error("Error updating request phase:", error);
      res.status(400).json({ message: "Failed to update phase" });
    }
  });

  // Attachment routes
  app.get("/api/purchase-requests/:id/attachments", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      // For now, return empty array as attachment functionality is not fully implemented
      res.json([]);
    } catch (error) {
      console.error("Error fetching attachments:", error);
      res.status(500).json({ message: "Failed to fetch attachments" });
    }
  });

  app.post("/api/purchase-requests/:id/attachments", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      // For now, return success response as file upload functionality is not fully implemented
      res.status(201).json({ message: "Attachment uploaded successfully" });
    } catch (error) {
      console.error("Error uploading attachment:", error);
      res.status(400).json({ message: "Failed to upload attachment" });
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

  // Approval history routes
  app.get("/api/purchase-requests/:id/approval-history", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      // For now, return empty array as approval history functionality is not fully implemented
      res.json([]);
    } catch (error) {
      console.error("Error fetching approval history:", error);
      res.status(500).json({ message: "Failed to fetch approval history" });
    }
  });

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

  app.post("/api/quotations", isAuthenticated, async (req, res) => {
    try {
      const quotationData = insertQuotationSchema.parse(req.body);
      const quotation = await storage.createQuotation(quotationData);
      res.status(201).json(quotation);
    } catch (error) {
      console.error("Error creating quotation:", error);
      res.status(400).json({ message: "Invalid quotation data" });
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

  const httpServer = createServer(app);
  return httpServer;
}
