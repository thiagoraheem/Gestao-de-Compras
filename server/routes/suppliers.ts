import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { insertSupplierSchema, updateSupplierSchema } from "../../shared/schema";
import { isAuthenticated, isAdminOrBuyer } from "./middleware";
import { supplierIntegrationService } from "../services/supplier-integration";

/**
 * Supplier management routes extracted from routes.ts (Phase 2).
 * Handles CRUD + ERP integration sync.
 */
export function registerSupplierRoutes(app: Express) {
  app.get("/api/suppliers", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const companyId = req.query.companyId ? parseInt(req.query.companyId as string) : undefined;
      const suppliers = await storage.getAllSuppliers(companyId);
      res.json(suppliers);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      res.status(500).json({ message: "Failed to fetch suppliers" });
    }
  });

  app.get("/api/suppliers/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid supplier ID" });
      const supplier = await storage.getSupplierById(id);
      if (!supplier) return res.status(404).json({ message: "Supplier not found" });
      res.json(supplier);
    } catch (error) {
      console.error("Error fetching supplier:", error);
      res.status(500).json({ message: "Failed to fetch supplier" });
    }
  });

  app.post("/api/suppliers", isAuthenticated, isAdminOrBuyer, async (req: Request, res: Response) => {
    try {
      const supplierData = insertSupplierSchema.parse(req.body);
      if (supplierData.type === 0 && supplierData.cnpj) {
        const { validateCNPJ } = await import("../cnpj-validator");
        if (!validateCNPJ(supplierData.cnpj)) return res.status(400).json({ message: "CNPJ inválido" });
      }
      if (supplierData.type === 2 && supplierData.cpf) {
        const { validateCPF } = await import("../cpf-validator");
        if (!validateCPF(supplierData.cpf)) return res.status(400).json({ message: "CPF inválido" });
      }
      const supplier = await storage.createSupplier(supplierData);
      res.status(201).json(supplier);
    } catch (error) {
      console.error("Error creating supplier:", error);
      if (error && typeof error === "object" && "code" in error && error.code === "23505") {
        res.status(400).json({ message: "CNPJ ou CPF já está sendo usado por outro fornecedor" });
      } else {
        res.status(400).json({ message: "Erro ao criar fornecedor" });
      }
    }
  });

  app.put("/api/suppliers/:id", isAuthenticated, isAdminOrBuyer, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const supplierData = updateSupplierSchema.parse(req.body);
      if (supplierData.type === 0 && supplierData.cnpj) {
        const { validateCNPJ } = await import("../cnpj-validator");
        if (!validateCNPJ(supplierData.cnpj)) return res.status(400).json({ message: "CNPJ inválido" });
      }
      if (supplierData.type === 2 && supplierData.cpf) {
        const { validateCPF } = await import("../cpf-validator");
        if (!validateCPF(supplierData.cpf)) return res.status(400).json({ message: "CPF inválido" });
      }
      const supplier = await storage.updateSupplier(id, supplierData);
      res.json(supplier);
    } catch (error) {
      console.error("Error updating supplier:", error);
      if (error && typeof error === "object" && "code" in error && error.code === "23505") {
        res.status(400).json({ message: "CNPJ ou CPF já está sendo usado por outro fornecedor" });
      } else {
        res.status(400).json({ message: "Erro ao atualizar fornecedor" });
      }
    }
  });

  // ERP Integration: Start sync
  app.post("/api/suppliers/integration/start", isAuthenticated, isAdminOrBuyer, async (req: Request, res: Response) => {
    const user = req.session.userId;
    if (!user) return res.status(401).json({ message: "Usuário não autenticado" });
    try {
      const { search, limit } = req.body ?? {};
      const numericLimit = typeof limit === "number" ? limit : typeof limit === "string" && limit.trim() ? parseInt(limit, 10) : undefined;
      const result = await supplierIntegrationService.startIntegration({
        userId: user,
        search: typeof search === "string" && search.trim().length > 0 ? search : undefined,
        limit: typeof numericLimit === "number" && Number.isFinite(numericLimit) && numericLimit > 0 ? Math.min(numericLimit, 1000) : undefined,
      });
      res.json(result);
    } catch (error) {
      console.error("Error starting supplier integration:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Erro ao iniciar integração de fornecedores" });
    }
  });

  // ERP Integration: List runs
  app.get("/api/suppliers/integration/runs", isAuthenticated, isAdminOrBuyer, async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? Math.min(100, Math.max(1, parseInt(String(req.query.limit), 10) || 20)) : 20;
      const runs = await supplierIntegrationService.listHistory(limit);
      res.json(runs);
    } catch (error) {
      console.error("Error fetching supplier integration history:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Erro ao buscar histórico de integrações" });
    }
  });

  // ERP Integration: Get run details
  app.get("/api/suppliers/integration/runs/:id", isAuthenticated, isAdminOrBuyer, async (req, res) => {
    try {
      const runId = parseInt(req.params.id, 10);
      if (!Number.isFinite(runId)) return res.status(400).json({ message: "Identificador da integração inválido" });
      const run = await supplierIntegrationService.getRunDetails(runId);
      res.json(run);
    } catch (error) {
      console.error("Error fetching supplier integration run:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Erro ao buscar dados da integração" });
    }
  });

  // ERP Integration: Apply run
  app.post("/api/suppliers/integration/runs/:id/apply", isAuthenticated, isAdminOrBuyer, async (req, res) => {
    const user = req.session.userId;
    if (!user) return res.status(401).json({ message: "Usuário não autenticado" });
    try {
      const runId = parseInt(req.params.id, 10);
      if (!Number.isFinite(runId)) return res.status(400).json({ message: "Identificador da integração inválido" });
      const rawItemIds = Array.isArray(req.body?.itemIds) ? req.body.itemIds : undefined;
      const itemIds = rawItemIds?.map((v: unknown) => Number(v as any)).filter((v: unknown) => Number.isInteger(Number(v)) && Number(v) > 0);
      const result = await supplierIntegrationService.applyIntegration({
        runId, userId: user,
        itemIds: itemIds && itemIds.length > 0 ? itemIds : undefined,
      });
      res.json(result);
    } catch (error) {
      console.error("Error applying supplier integration:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Erro ao aplicar integração" });
    }
  });

  // ERP Integration: Cancel run
  app.post("/api/suppliers/integration/runs/:id/cancel", isAuthenticated, isAdminOrBuyer, async (req, res) => {
    const user = req.session.userId;
    if (!user) return res.status(401).json({ message: "Usuário não autenticado" });
    try {
      const runId = parseInt(req.params.id, 10);
      if (!Number.isFinite(runId)) return res.status(400).json({ message: "Identificador da integração inválido" });
      const result = await supplierIntegrationService.cancelIntegration({ runId, userId: user });
      res.json(result);
    } catch (error) {
      console.error("Error cancelling supplier integration:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Erro ao cancelar integração" });
    }
  });
}
