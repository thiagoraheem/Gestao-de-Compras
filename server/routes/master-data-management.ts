import { Request, Response } from "express";
import { storage } from "../storage";
import { isAuthenticated, isAdmin } from "./middleware";
import { 
  insertDepartmentSchema, 
  insertCostCenterSchema, 
  insertDeliveryLocationSchema 
} from "../../shared/schema";

export function registerMasterDataManagementRoutes(app: any) {
  // Departments routes
  app.get("/api/departments", isAuthenticated, async (req: Request, res: Response) => {
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

  app.post("/api/departments", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const departmentData = insertDepartmentSchema.parse(req.body);
      const department = await storage.createDepartment(departmentData);
      res.status(201).json(department);
    } catch (error) {
      console.error("Error creating department:", error);
      res.status(400).json({ message: "Invalid department data" });
    }
  });

  app.put("/api/departments/:id", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
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

  app.get("/api/departments/:id/can-delete", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const result = await storage.checkDepartmentCanBeDeleted(id);
      res.json(result);
    } catch (error) {
      console.error("Error checking department can be deleted:", error);
      res.status(500).json({ message: "Erro ao verificar se departamento pode ser excluído" });
    }
  });

  app.delete("/api/departments/:id", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
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
  });

  // Cost Centers routes
  app.get("/api/cost-centers", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const costCenters = await storage.getAllCostCenters();
      res.json(costCenters);
    } catch (error) {
      console.error("Error fetching cost centers:", error);
      res.status(500).json({ message: "Failed to fetch cost centers" });
    }
  });

  app.get("/api/cost-centers/department/:departmentId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const departmentId = parseInt(req.params.departmentId);
      const costCenters = await storage.getCostCentersByDepartment(departmentId);
      res.json(costCenters);
    } catch (error) {
      console.error("Error fetching cost centers by department:", error);
      res.status(500).json({ message: "Failed to fetch cost centers" });
    }
  });

  app.post("/api/cost-centers", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      if (!req.body.code || !req.body.name || !req.body.departmentId) {
        return res.status(400).json({ message: "Campos obrigatórios: código, nome e departamento" });
      }
      const costCenterData = insertCostCenterSchema.parse(req.body);
      const costCenter = await storage.createCostCenter(costCenterData);
      res.status(201).json(costCenter);
    } catch (error) {
      console.error("Error creating cost center:", error);
      if (error && typeof error === "object" && "code" in error) {
        if (error.code === "23505") return res.status(400).json({ message: "Código do centro de custo já existe" });
        if (error.code === "23503") return res.status(400).json({ message: "Departamento inválido" });
      }
      res.status(400).json({ message: error instanceof Error ? error.message : "Erro ao criar centro de custo" });
    }
  });

  app.put("/api/cost-centers/:id", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { code, name, departmentId } = req.body as any;
      const costCenterData = { code, name, departmentId };
      const costCenter = await storage.updateCostCenter(id, costCenterData as any);
      res.json(costCenter);
    } catch (error) {
      console.error("Error updating cost center:", error);
      res.status(400).json({ message: "Failed to update cost center" });
    }
  });

  app.get("/api/cost-centers/:id/can-delete", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const result = await storage.checkCostCenterCanBeDeleted(id);
      res.json(result);
    } catch (error) {
      console.error("Error checking cost center can be deleted:", error);
      res.status(500).json({ message: "Erro ao verificar se centro de custo pode ser excluído" });
    }
  });

  app.delete("/api/cost-centers/:id", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
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
  });

  // Payment Methods routes
  app.get("/api/payment-methods", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const paymentMethods = await storage.getAllPaymentMethods();
      res.json(paymentMethods);
    } catch (error) {
      console.error("Error fetching payment methods:", error);
      res.status(500).json({ message: "Failed to fetch payment methods" });
    }
  });

  // Delivery Locations routes
  app.get("/api/delivery-locations", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const deliveryLocations = await storage.getAllDeliveryLocations();
      res.json(deliveryLocations);
    } catch (error) {
      console.error("Error fetching delivery locations:", error);
      res.status(500).json({ message: "Failed to fetch delivery locations" });
    }
  });

  app.get("/api/delivery-locations/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const deliveryLocation = await storage.getDeliveryLocationById(id);
      if (!deliveryLocation) return res.status(404).json({ message: "Delivery location not found" });
      res.json(deliveryLocation);
    } catch (error) {
      console.error("Error fetching delivery location:", error);
      res.status(500).json({ message: "Failed to fetch delivery location" });
    }
  });

  app.post("/api/delivery-locations", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const deliveryLocationData = insertDeliveryLocationSchema.parse(req.body);
      const deliveryLocation = await storage.createDeliveryLocation(deliveryLocationData);
      res.status(201).json(deliveryLocation);
    } catch (error) {
      console.error("Error creating delivery location:", error);
      res.status(400).json({ message: "Erro ao criar local de entrega" });
    }
  });

  app.put("/api/delivery-locations/:id", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const deliveryLocationData = insertDeliveryLocationSchema.partial().parse(req.body);
      const deliveryLocation = await storage.updateDeliveryLocation(id, deliveryLocationData);
      res.json(deliveryLocation);
    } catch (error) {
      console.error("Error updating delivery location:", error);
      res.status(400).json({ message: "Erro ao atualizar local de entrega" });
    }
  });

  app.delete("/api/delivery-locations/:id", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteDeliveryLocation(id);
      res.json({ message: "Delivery location deactivated successfully" });
    } catch (error) {
      console.error("Error deactivating delivery location:", error);
      res.status(500).json({ message: "Failed to deactivate delivery location" });
    }
  });
}
