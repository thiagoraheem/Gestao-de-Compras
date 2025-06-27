import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertDepartmentSchema, insertCostCenterSchema, insertSupplierSchema, insertPurchaseRequestSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize default data
  await storage.initializeDefaultData();

  // Users routes
  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const user = await storage.createUser(userData);
      res.status(201).json(user);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(400).json({ message: "Invalid user data" });
    }
  });

  app.put("/api/users/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userData = insertUserSchema.partial().parse(req.body);
      const user = await storage.updateUser(id, userData);
      res.json(user);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(400).json({ message: "Invalid user data" });
    }
  });

  // Departments routes
  app.get("/api/departments", async (req, res) => {
    try {
      const departments = await storage.getAllDepartments();
      res.json(departments);
    } catch (error) {
      console.error("Error fetching departments:", error);
      res.status(500).json({ message: "Failed to fetch departments" });
    }
  });

  app.post("/api/departments", async (req, res) => {
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
  app.get("/api/cost-centers", async (req, res) => {
    try {
      const costCenters = await storage.getAllCostCenters();
      res.json(costCenters);
    } catch (error) {
      console.error("Error fetching cost centers:", error);
      res.status(500).json({ message: "Failed to fetch cost centers" });
    }
  });

  app.get("/api/cost-centers/department/:departmentId", async (req, res) => {
    try {
      const departmentId = parseInt(req.params.departmentId);
      const costCenters = await storage.getCostCentersByDepartment(departmentId);
      res.json(costCenters);
    } catch (error) {
      console.error("Error fetching cost centers by department:", error);
      res.status(500).json({ message: "Failed to fetch cost centers" });
    }
  });

  app.post("/api/cost-centers", async (req, res) => {
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
  app.get("/api/suppliers", async (req, res) => {
    try {
      const suppliers = await storage.getAllSuppliers();
      res.json(suppliers);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      res.status(500).json({ message: "Failed to fetch suppliers" });
    }
  });

  app.post("/api/suppliers", async (req, res) => {
    try {
      const supplierData = insertSupplierSchema.parse(req.body);
      const supplier = await storage.createSupplier(supplierData);
      res.status(201).json(supplier);
    } catch (error) {
      console.error("Error creating supplier:", error);
      res.status(400).json({ message: "Invalid supplier data" });
    }
  });

  app.put("/api/suppliers/:id", async (req, res) => {
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
  app.get("/api/payment-methods", async (req, res) => {
    try {
      const paymentMethods = await storage.getAllPaymentMethods();
      res.json(paymentMethods);
    } catch (error) {
      console.error("Error fetching payment methods:", error);
      res.status(500).json({ message: "Failed to fetch payment methods" });
    }
  });

  // Purchase Requests routes
  app.get("/api/purchase-requests", async (req, res) => {
    try {
      const requests = await storage.getAllPurchaseRequests();
      res.json(requests);
    } catch (error) {
      console.error("Error fetching purchase requests:", error);
      res.status(500).json({ message: "Failed to fetch purchase requests" });
    }
  });

  app.get("/api/purchase-requests/phase/:phase", async (req, res) => {
    try {
      const phase = req.params.phase;
      const requests = await storage.getPurchaseRequestsByPhase(phase);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching purchase requests by phase:", error);
      res.status(500).json({ message: "Failed to fetch purchase requests" });
    }
  });

  app.get("/api/purchase-requests/:id", async (req, res) => {
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

  app.post("/api/purchase-requests", async (req, res) => {
    try {
      const requestData = insertPurchaseRequestSchema.parse(req.body);
      const request = await storage.createPurchaseRequest(requestData);
      res.status(201).json(request);
    } catch (error) {
      console.error("Error creating purchase request:", error);
      res.status(400).json({ message: "Invalid purchase request data" });
    }
  });

  app.put("/api/purchase-requests/:id", async (req, res) => {
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
  app.post("/api/purchase-requests/:id/approve-a1", async (req, res) => {
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

  app.post("/api/purchase-requests/:id/update-quotation", async (req, res) => {
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

  const httpServer = createServer(app);
  return httpServer;
}
