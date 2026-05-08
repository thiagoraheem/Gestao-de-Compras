import { Request, Response } from "express";
import { storage } from "../storage";
import { isAuthenticated, isAdmin } from "./middleware";
import { 
  insertDepartmentSchema, 
  insertCostCenterSchema, 
  insertDeliveryLocationSchema 
} from "../../shared/schema";
import { NotFoundError, ValidationError, UnauthorizedError } from "../utils/errors";
import { auditService } from "../services/audit-service";

export function registerMasterDataManagementRoutes(app: any) {
  // Departments routes
  app.get("/api/departments", isAuthenticated, async (req: Request, res: Response) => {
    const companyId = req.query.companyId
      ? parseInt(req.query.companyId as string)
      : undefined;
    const departments = await storage.getAllDepartments(companyId);
    res.json(departments);
  });

  app.post("/api/departments", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    const departmentData = insertDepartmentSchema.parse(req.body);
    const department = await storage.createDepartment(departmentData);

    await auditService.log({
      actionType: 'department_created',
      actionDescription: `Departamento ${department.name} criado`,
      performedBy: req.session.userId,
      afterData: department,
      affectedTables: ['departments']
    });

    res.status(201).json(department);
  });

  app.put("/api/departments/:id", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const beforeData = await storage.getDepartmentById(id);
    if (!beforeData) throw new NotFoundError("Departamento não encontrado");

    const departmentData = insertDepartmentSchema.partial().parse(req.body);
    const department = await storage.updateDepartment(id, departmentData);

    await auditService.log({
      actionType: 'department_updated',
      actionDescription: `Departamento ${department.name} atualizado`,
      performedBy: req.session.userId,
      beforeData,
      afterData: department,
      affectedTables: ['departments']
    });

    res.json(department);
  });

  app.get("/api/departments/:id/can-delete", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const result = await storage.checkDepartmentCanBeDeleted(id);
    res.json(result);
  });

  app.delete("/api/departments/:id", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const canDeleteResult = await storage.checkDepartmentCanBeDeleted(id);
    if (!canDeleteResult.canDelete) {
      throw new ValidationError(canDeleteResult.reason || "Departamento não pode ser excluído");
    }

    const department = await storage.getDepartmentById(id);
    await storage.deleteDepartment(id);

    await auditService.log({
      actionType: 'department_deleted',
      actionDescription: `Departamento ${department?.name || id} excluído`,
      performedBy: req.session.userId,
      beforeData: department,
      affectedTables: ['departments']
    });

    res.json({ message: "Departamento excluído com sucesso" });
  });

  // Cost Centers routes
  app.get("/api/cost-centers", isAuthenticated, async (req: Request, res: Response) => {
    const costCenters = await storage.getAllCostCenters();
    res.json(costCenters);
  });

  app.get("/api/cost-centers/department/:departmentId", isAuthenticated, async (req: Request, res: Response) => {
    const departmentId = parseInt(req.params.departmentId);
    const costCenters = await storage.getCostCentersByDepartment(departmentId);
    res.json(costCenters);
  });

  app.post("/api/cost-centers", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    if (!req.body.code || !req.body.name || !req.body.departmentId) {
      throw new ValidationError("Campos obrigatórios: código, nome e departamento");
    }
    const costCenterData = insertCostCenterSchema.parse(req.body);
    const costCenter = await storage.createCostCenter(costCenterData);

    await auditService.log({
      actionType: 'cost_center_created',
      actionDescription: `Centro de Custo ${costCenter.name} criado`,
      performedBy: req.session.userId,
      afterData: costCenter,
      affectedTables: ['cost_centers']
    });

    res.status(201).json(costCenter);
  });

  app.put("/api/cost-centers/:id", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const beforeData = await storage.getCostCenterById(id);
    if (!beforeData) throw new NotFoundError("Centro de custo não encontrado");

    const { code, name, departmentId } = req.body as any;
    const costCenterData = { code, name, departmentId };
    const costCenter = await storage.updateCostCenter(id, costCenterData as any);

    await auditService.log({
      actionType: 'cost_center_updated',
      actionDescription: `Centro de Custo ${costCenter.name} atualizado`,
      performedBy: req.session.userId,
      beforeData,
      afterData: costCenter,
      affectedTables: ['cost_centers']
    });

    res.json(costCenter);
  });

  app.get("/api/cost-centers/:id/can-delete", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const result = await storage.checkCostCenterCanBeDeleted(id);
    res.json(result);
  });

  app.delete("/api/cost-centers/:id", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const canDeleteResult = await storage.checkCostCenterCanBeDeleted(id);
    if (!canDeleteResult.canDelete) {
      throw new ValidationError(canDeleteResult.reason || "Centro de custo não pode ser excluído");
    }

    const costCenter = await storage.getCostCenterById(id);
    await storage.deleteCostCenter(id);

    await auditService.log({
      actionType: 'cost_center_deleted',
      actionDescription: `Centro de Custo ${costCenter?.name || id} excluído`,
      performedBy: req.session.userId,
      beforeData: costCenter,
      affectedTables: ['cost_centers']
    });

    res.json({ message: "Centro de custo excluído com sucesso" });
  });

  // Payment Methods routes
  app.get("/api/payment-methods", isAuthenticated, async (req: Request, res: Response) => {
    const paymentMethods = await storage.getAllPaymentMethods();
    res.json(paymentMethods);
  });

  // Delivery Locations routes
  app.get("/api/delivery-locations", isAuthenticated, async (req: Request, res: Response) => {
    const deliveryLocations = await storage.getAllDeliveryLocations();
    res.json(deliveryLocations);
  });

  app.get("/api/delivery-locations/:id", isAuthenticated, async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const deliveryLocation = await storage.getDeliveryLocationById(id);
    if (!deliveryLocation) throw new NotFoundError("Local de entrega não encontrado");
    res.json(deliveryLocation);
  });

  app.post("/api/delivery-locations", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    const deliveryLocationData = insertDeliveryLocationSchema.parse(req.body);
    const deliveryLocation = await storage.createDeliveryLocation(deliveryLocationData);

    await auditService.log({
      actionType: 'delivery_location_created',
      actionDescription: `Local de Entrega ${deliveryLocation.name} criado`,
      performedBy: req.session.userId,
      afterData: deliveryLocation,
      affectedTables: ['delivery_locations']
    });

    res.status(201).json(deliveryLocation);
  });

  app.put("/api/delivery-locations/:id", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const beforeData = await storage.getDeliveryLocationById(id);
    if (!beforeData) throw new NotFoundError("Local de entrega não encontrado");

    const deliveryLocationData = insertDeliveryLocationSchema.partial().parse(req.body);
    const deliveryLocation = await storage.updateDeliveryLocation(id, deliveryLocationData);

    await auditService.log({
      actionType: 'delivery_location_updated',
      actionDescription: `Local de Entrega ${deliveryLocation.name} atualizado`,
      performedBy: req.session.userId,
      beforeData,
      afterData: deliveryLocation,
      affectedTables: ['delivery_locations']
    });

    res.json(deliveryLocation);
  });

  app.delete("/api/delivery-locations/:id", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const deliveryLocation = await storage.getDeliveryLocationById(id);
    if (!deliveryLocation) throw new NotFoundError("Local de entrega não encontrado");

    await storage.deleteDeliveryLocation(id);

    await auditService.log({
      actionType: 'delivery_location_deleted',
      actionDescription: `Local de Entrega ${deliveryLocation.name} desativado`,
      performedBy: req.session.userId,
      beforeData: deliveryLocation,
      affectedTables: ['delivery_locations']
    });

    res.json({ message: "Delivery location deactivated successfully" });
  });
}
