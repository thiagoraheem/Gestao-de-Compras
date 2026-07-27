import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "./middleware";
import { insertUnitOfMeasureSchema } from "../../shared/schema";
import { auditService } from "../services/audit-service";
import { NotFoundError, ValidationError } from "../utils/errors";

export function registerUnitOfMeasureRoutes(app: Express) {
  // Get all units of measure
  app.get("/api/units-of-measure", isAuthenticated, async (req: Request, res: Response) => {
    const includeInactive = req.query.includeInactive === "true";
    const units = await storage.getAllUnitsOfMeasure(includeInactive);
    res.json(units);
  });

  // Get unit of measure by code
  app.get("/api/units-of-measure/:code", isAuthenticated, async (req: Request, res: Response) => {
    const { code } = req.params;
    const unit = await storage.getUnitOfMeasureByCode(code);
    if (!unit) {
      throw new NotFoundError("Unidade de medida não encontrada");
    }
    res.json(unit);
  });

  // Create new unit of measure
  app.post("/api/units-of-measure", isAuthenticated, async (req: Request, res: Response) => {
    const parsedData = insertUnitOfMeasureSchema.parse(req.body);
    const existing = await storage.getUnitOfMeasureByCode(parsedData.code);
    if (existing) {
      throw new ValidationError(`A unidade de medida com código "${parsedData.code.toUpperCase()}" já está cadastrada.`);
    }

    const unit = await storage.createUnitOfMeasure(parsedData);

    await auditService.log({
      actionType: 'unit_of_measure_created',
      actionDescription: `Unidade de medida ${unit.code} (${unit.description}) criada`,
      performedBy: req.session.userId,
      afterData: unit,
      affectedTables: ['units_of_measure']
    });

    res.status(201).json(unit);
  });

  // Update unit of measure
  app.put("/api/units-of-measure/:code", isAuthenticated, async (req: Request, res: Response) => {
    const { code } = req.params;
    const beforeData = await storage.getUnitOfMeasureByCode(code);
    if (!beforeData) {
      throw new NotFoundError("Unidade de medida não encontrada");
    }

    const updateData = insertUnitOfMeasureSchema.partial().parse(req.body);
    const updatedUnit = await storage.updateUnitOfMeasure(code, updateData);

    await auditService.log({
      actionType: 'unit_of_measure_updated',
      actionDescription: `Unidade de medida ${code} atualizada`,
      performedBy: req.session.userId,
      beforeData,
      afterData: updatedUnit,
      affectedTables: ['units_of_measure']
    });

    res.json(updatedUnit);
  });

  // Check if unit of measure can be deleted
  app.get("/api/units-of-measure/:code/can-delete", isAuthenticated, async (req: Request, res: Response) => {
    const { code } = req.params;
    const result = await storage.checkUnitOfMeasureCanBeDeleted(code);
    res.json(result);
  });

  // Delete / Inactivate unit of measure
  app.delete("/api/units-of-measure/:code", isAuthenticated, async (req: Request, res: Response) => {
    const { code } = req.params;
    const canDeleteResult = await storage.checkUnitOfMeasureCanBeDeleted(code);
    
    if (!canDeleteResult.canDelete) {
      // Inactivate instead if it cannot be hard deleted
      const beforeData = await storage.getUnitOfMeasureByCode(code);
      const updatedUnit = await storage.updateUnitOfMeasure(code, { active: false });

      await auditService.log({
        actionType: 'unit_of_measure_inactivated',
        actionDescription: `Unidade de medida ${code} desativada por conter itens vinculados`,
        performedBy: req.session.userId,
        beforeData,
        afterData: updatedUnit,
        affectedTables: ['units_of_measure']
      });

      return res.json({ 
        message: "Unidade de medida desativada com sucesso pois possui itens vinculados", 
        inactivated: true,
        unit: updatedUnit 
      });
    }

    const beforeData = await storage.getUnitOfMeasureByCode(code);
    await storage.deleteUnitOfMeasure(code);

    await auditService.log({
      actionType: 'unit_of_measure_deleted',
      actionDescription: `Unidade de medida ${code} excluída`,
      performedBy: req.session.userId,
      beforeData,
      affectedTables: ['units_of_measure']
    });

    res.json({ message: "Unidade de medida excluída com sucesso", deleted: true });
  });
}
