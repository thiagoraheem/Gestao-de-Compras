import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { insertCompanySchema } from "../../shared/schema";
import { isAuthenticated, isAdmin } from "./middleware";
import { fileStorageService } from "../services/file-storage-service";
import mime from "mime-types";
import { NotFoundError, ValidationError, UnauthorizedError } from "../utils/errors";
import { auditService } from "../services/audit-service";

export function registerCompanyRoutes(app: Express) {
  app.get("/api/companies", isAuthenticated, async (req, res) => {
    const companies = await storage.getAllCompanies();
    res.json(companies);
  });

  app.get("/api/companies/:id", isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const company = await storage.getCompanyById(id);
    if (!company) throw new NotFoundError("Empresa não encontrada");
    res.json(company);
  });

  app.post("/api/companies", isAuthenticated, isAdmin, async (req, res) => {
    const companyData = insertCompanySchema.parse(req.body);
    if (companyData.cnpj) {
      const { validateCNPJ } = await import("../cnpj-validator");
      if (!validateCNPJ(companyData.cnpj)) throw new ValidationError("CNPJ inválido");
    }
    const company = await storage.createCompany(companyData);

    await auditService.log({
      actionType: 'company_created',
      actionDescription: `Empresa ${company.name} criada`,
      performedBy: (req.session as any).userId,
      afterData: company,
      affectedTables: ['companies']
    });

    res.status(201).json(company);
  });

  app.put("/api/companies/:id", isAuthenticated, isAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    const beforeData = await storage.getCompanyById(id);
    if (!beforeData) throw new NotFoundError("Empresa não encontrada");

    const companyData = insertCompanySchema.partial().parse(req.body);
    if (companyData.cnpj) {
      const { validateCNPJ } = await import("../cnpj-validator");
      if (!validateCNPJ(companyData.cnpj)) throw new ValidationError("CNPJ inválido");
    }
    const company = await storage.updateCompany(id, companyData);

    await auditService.log({
      actionType: 'company_updated',
      actionDescription: `Empresa ${company.name} atualizada`,
      performedBy: (req.session as any).userId,
      beforeData,
      afterData: company,
      affectedTables: ['companies']
    });

    res.json(company);
  });

  app.delete("/api/companies/:id", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const company = await storage.getCompanyById(id);
    if (!company) throw new NotFoundError("Empresa não encontrada");

    await storage.deleteCompany(id);

    await auditService.log({
      actionType: 'company_deleted',
      actionDescription: `Empresa ${company.name} desativada`,
      performedBy: (req.session as any).userId,
      beforeData: company,
      affectedTables: ['companies']
    });

    res.json({ message: "Company deactivated successfully" });
  });

  app.post("/api/companies/:id/upload-logo", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    const companyId = parseInt(req.params.id);
    const { logoBase64 } = req.body;
    if (!logoBase64) throw new ValidationError("Nenhum arquivo de logo foi enviado");

    const base64Match = String(logoBase64).match(/^data:(image\/(?:jpeg|jpg|png));base64,(.+)$/);
    if (!base64Match) throw new ValidationError("Formato de logo inválido. Apenas PNG, JPG, JPEG são aceitos.");

    const [, mimeType, encodedContent] = base64Match;
    const logoBuffer = Buffer.from(encodedContent, "base64");
    if (logoBuffer.length > 5 * 1024 * 1024) throw new ValidationError("Logo muito grande. Tamanho máximo: 5MB");

    const company = await storage.getCompanyById(companyId);
    if (!company) throw new NotFoundError("Empresa não encontrada");

    let uploadedLogo;
    try {
      uploadedLogo = await fileStorageService.uploadFile({
        category: "company-logos", entityId: companyId,
        originalName: `company-logo.${mime.extension(mimeType) || "png"}`,
        contentType: mimeType, buffer: logoBuffer,
        preferredLocalName: `logo-${Date.now()}-${companyId}.${mime.extension(mimeType) || "png"}`,
      });
    } catch (storageError) {
      console.error("Error uploading company logo:", storageError);
      uploadedLogo = null;
    }

    if (company.logoUrl && company.logoUrl !== fileStorageService.buildCompanyLogoProxyUrl(companyId)) {
      await fileStorageService.deleteFile(company.logoUrl).catch(() => {});
    }

    const updatedCompany = await storage.updateCompany(companyId, uploadedLogo
      ? { logoUrl: uploadedLogo.filePath, logoBase64: null }
      : { logoBase64 });

    res.json({
      message: "Logo enviado com sucesso",
      logoUrl: fileStorageService.buildCompanyLogoProxyUrl(companyId),
      logoBase64: uploadedLogo ? null : logoBase64,
      company: { ...updatedCompany, logoUrl: updatedCompany.logoUrl ? fileStorageService.buildCompanyLogoProxyUrl(companyId) : updatedCompany.logoBase64 || null },
    });
  });

  app.get("/api/companies/:id/logo", async (req: Request, res: Response) => {
    const companyId = parseInt(req.params.id);
    const company = await storage.getCompanyById(companyId);
    if (!company || (!company.logoUrl && !company.logoBase64)) throw new NotFoundError("Logo não encontrado");

    if (company.logoUrl) {
      const file = await fileStorageService.openFileStream(company.logoUrl);
      res.setHeader("Content-Type", file.contentType);
      if (file.contentLength) res.setHeader("Content-Length", file.contentLength);
      file.stream.pipe(res);
      return;
    }

    const base64Match = company.logoBase64?.match(/^data:(image\/(?:jpeg|jpg|png));base64,(.+)$/);
    if (!base64Match) throw new NotFoundError("Logo não encontrado");

    const [, mimeType, encodedContent] = base64Match;
    const buffer = Buffer.from(encodedContent, "base64");
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
  });
}
