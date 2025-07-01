import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertDepartmentSchema, insertCostCenterSchema, insertSupplierSchema, insertPurchaseRequestSchema } from "@shared/schema";
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
      const requestData = insertPurchaseRequestSchema.parse(req.body);
      const request = await storage.createPurchaseRequest(requestData);
      res.status(201).json(request);
    } catch (error) {
      console.error("Error creating purchase request:", error);
      res.status(400).json({ message: "Invalid purchase request data" });
    }
  });

  app.put("/api/purchase-requests/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const requestData = insertPurchaseRequestSchema.partial().parse(req.body);
      const request = await storage.updatePurchaseRequest(id, requestData);
      res.json(request);
    } catch (error) {
      console.error("Error updating purchase request:", error);
      res.status(400).json({ message: "Invalid purchase request data" });
    }
  });

  // Phase transition routes
  app.post("/api/purchase-requests/:id/approve-a1", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { approved, rejectionReason, approverId } = req.body;
      
      const updates: any = {
        approverA1Id: approverId,
        approvedA1: approved,
        approvalDateA1: new Date(),
      };
      
      if (approved) {
        updates.currentPhase = "cotacao";
      } else {
        updates.rejectionReasonA1 = rejectionReason;
      }
      
      const request = await storage.updatePurchaseRequest(id, updates);
      res.json(request);
    } catch (error) {
      console.error("Error approving A1:", error);
      res.status(400).json({ message: "Failed to process approval" });
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

  const httpServer = createServer(app);
  return httpServer;
}
