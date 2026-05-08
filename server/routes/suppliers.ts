import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { insertSupplierSchema, updateSupplierSchema } from "../../shared/schema";
import { isAuthenticated, isAdminOrBuyer } from "./middleware";
import { supplierIntegrationService } from "../services/supplier-integration";
import { NotFoundError, ValidationError, UnauthorizedError } from "../utils/errors";
import { auditService } from "../services/audit-service";

/**
 * Supplier management routes extracted from routes.ts (Phase 2).
 * Handles CRUD + ERP integration sync.
 */
export function registerSupplierRoutes(app: Express) {
  app.get("/api/suppliers", isAuthenticated, async (req: Request, res: Response) => {
    const companyId = req.query.companyId ? parseInt(req.query.companyId as string) : undefined;
    const suppliers = await storage.getAllSuppliers(companyId);
    res.json(suppliers);
  });

  app.get("/api/suppliers/:id", isAuthenticated, async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new ValidationError("ID de fornecedor inválido");
    const supplier = await storage.getSupplierById(id);
    if (!supplier) throw new NotFoundError("Fornecedor não encontrado");
    res.json(supplier);
  });

  app.post("/api/suppliers", isAuthenticated, isAdminOrBuyer, async (req: Request, res: Response) => {
    const supplierData = insertSupplierSchema.parse(req.body);
    if (supplierData.type === 0 && supplierData.cnpj) {
      const { validateCNPJ } = await import("../cnpj-validator");
      if (!validateCNPJ(supplierData.cnpj)) throw new ValidationError("CNPJ inválido");
    }
    if (supplierData.type === 2 && supplierData.cpf) {
      const { validateCPF } = await import("../cpf-validator");
      if (!validateCPF(supplierData.cpf)) throw new ValidationError("CPF inválido");
    }
    const supplier = await storage.createSupplier(supplierData);

    await auditService.log({
      actionType: 'supplier_created',
      actionDescription: `Fornecedor ${supplier.name} criado`,
      performedBy: req.session.userId,
      afterData: supplier,
      affectedTables: ['suppliers']
    });

    res.status(201).json(supplier);
  });

  app.put("/api/suppliers/:id", isAuthenticated, isAdminOrBuyer, async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const beforeData = await storage.getSupplierById(id);
    if (!beforeData) throw new NotFoundError("Fornecedor não encontrado");

    const supplierData = updateSupplierSchema.parse(req.body);
    if (supplierData.type === 0 && supplierData.cnpj) {
      const { validateCNPJ } = await import("../cnpj-validator");
      if (!validateCNPJ(supplierData.cnpj)) throw new ValidationError("CNPJ inválido");
    }
    if (supplierData.type === 2 && supplierData.cpf) {
      const { validateCPF } = await import("../cpf-validator");
      if (!validateCPF(supplierData.cpf)) throw new ValidationError("CPF inválido");
    }
    const supplier = await storage.updateSupplier(id, supplierData);

    await auditService.log({
      actionType: 'supplier_updated',
      actionDescription: `Fornecedor ${supplier.name} atualizado`,
      performedBy: req.session.userId,
      beforeData,
      afterData: supplier,
      affectedTables: ['suppliers']
    });

    res.json(supplier);
  });

  // ERP Integration: Start sync
  app.post("/api/suppliers/integration/start", isAuthenticated, isAdminOrBuyer, async (req: Request, res: Response) => {
    const user = req.session.userId;
    if (!user) throw new UnauthorizedError("Usuário não autenticado");

    const { search, limit } = req.body ?? {};
    const numericLimit = typeof limit === "number" ? limit : typeof limit === "string" && limit.trim() ? parseInt(limit, 10) : undefined;
    const result = await supplierIntegrationService.startIntegration({
      userId: user,
      search: typeof search === "string" && search.trim().length > 0 ? search : undefined,
      limit: typeof numericLimit === "number" && Number.isFinite(numericLimit) && numericLimit > 0 ? Math.min(numericLimit, 1000) : undefined,
    });
    res.json(result);
  });

  // ERP Integration: List runs
  app.get("/api/suppliers/integration/runs", isAuthenticated, isAdminOrBuyer, async (req: Request, res: Response) => {
    const limit = req.query.limit ? Math.min(100, Math.max(1, parseInt(String(req.query.limit), 10) || 20)) : 20;
    const runs = await supplierIntegrationService.listHistory(limit);
    res.json(runs);
  });

  // ERP Integration: Get run details
  app.get("/api/suppliers/integration/runs/:id", isAuthenticated, isAdminOrBuyer, async (req, res) => {
    const runId = parseInt(req.params.id, 10);
    if (!Number.isFinite(runId)) throw new ValidationError("Identificador da integração inválido");
    const run = await supplierIntegrationService.getRunDetails(runId);
    res.json(run);
  });

  // ERP Integration: Apply run
  app.post("/api/suppliers/integration/runs/:id/apply", isAuthenticated, isAdminOrBuyer, async (req, res) => {
    const user = req.session.userId;
    if (!user) throw new UnauthorizedError("Usuário não autenticado");

    const runId = parseInt(req.params.id, 10);
    if (!Number.isFinite(runId)) throw new ValidationError("Identificador da integração inválido");
    const rawItemIds = Array.isArray(req.body?.itemIds) ? req.body.itemIds : undefined;
    const itemIds = rawItemIds?.map((v: unknown) => Number(v as any)).filter((v: unknown) => Number.isInteger(Number(v)) && Number(v) > 0);
    const result = await supplierIntegrationService.applyIntegration({
      runId, userId: user,
      itemIds: itemIds && itemIds.length > 0 ? itemIds : undefined,
    });
    res.json(result);
  });

  // ERP Integration: Cancel run
  app.post("/api/suppliers/integration/runs/:id/cancel", isAuthenticated, isAdminOrBuyer, async (req, res) => {
    const user = req.session.userId;
    if (!user) throw new UnauthorizedError("Usuário não autenticado");

    const runId = parseInt(req.params.id, 10);
    if (!Number.isFinite(runId)) throw new ValidationError("Identificador da integração inválido");
    const result = await supplierIntegrationService.cancelIntegration({ runId, userId: user });
    res.json(result);
  });
}
