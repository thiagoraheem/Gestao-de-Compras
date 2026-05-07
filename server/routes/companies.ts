import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { insertCompanySchema } from "../../shared/schema";
import { isAuthenticated, isAdmin } from "./middleware";
import { fileStorageService } from "../services/file-storage-service";
import mime from "mime-types";

export function registerCompanyRoutes(app: Express) {
  app.get("/api/companies", isAuthenticated, async (req, res) => {
    try {
      const companies = await storage.getAllCompanies();
      res.json(companies);
    } catch (error) {
      console.error("Error fetching companies:", error);
      res.status(500).json({ message: "Failed to fetch companies" });
    }
  });

  app.get("/api/companies/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const company = await storage.getCompanyById(id);
      if (!company) return res.status(404).json({ message: "Company not found" });
      res.json(company);
    } catch (error) {
      console.error("Error fetching company:", error);
      res.status(500).json({ message: "Failed to fetch company" });
    }
  });

  app.post("/api/companies", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const companyData = insertCompanySchema.parse(req.body);
      if (companyData.cnpj) {
        const { validateCNPJ } = await import("../cnpj-validator");
        if (!validateCNPJ(companyData.cnpj)) return res.status(400).json({ message: "CNPJ inválido" });
      }
      const company = await storage.createCompany(companyData);
      res.status(201).json(company);
    } catch (error) {
      console.error("Error creating company:", error);
      if (error && typeof error === "object" && "code" in error && error.code === "23505") {
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
      if (companyData.cnpj) {
        const { validateCNPJ } = await import("../cnpj-validator");
        if (!validateCNPJ(companyData.cnpj)) return res.status(400).json({ message: "CNPJ inválido" });
      }
      const company = await storage.updateCompany(id, companyData);
      res.json(company);
    } catch (error) {
      console.error("Error updating company:", error);
      if (error && typeof error === "object" && "code" in error && error.code === "23505") {
        res.status(400).json({ message: "CNPJ já está sendo usado por outra empresa" });
      } else {
        res.status(400).json({ message: "Dados da empresa inválidos" });
      }
    }
  });

  app.delete("/api/companies/:id", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCompany(id);
      res.json({ message: "Company deactivated successfully" });
    } catch (error: any) {
      console.error("Error deleting company:", error);
      res.status(500).json({ message: "Failed to delete company" });
    }
  });

  app.post("/api/companies/:id/upload-logo", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const companyId = parseInt(req.params.id);
      const { logoBase64 } = req.body;
      if (!logoBase64) return res.status(400).json({ message: "Nenhum arquivo de logo foi enviado" });

      const base64Match = String(logoBase64).match(/^data:(image\/(?:jpeg|jpg|png));base64,(.+)$/);
      if (!base64Match) return res.status(400).json({ message: "Formato de logo inválido. Apenas PNG, JPG, JPEG são aceitos." });

      const [, mimeType, encodedContent] = base64Match;
      const logoBuffer = Buffer.from(encodedContent, "base64");
      if (logoBuffer.length > 5 * 1024 * 1024) return res.status(400).json({ message: "Logo muito grande. Tamanho máximo: 5MB" });

      const company = await storage.getCompanyById(companyId);
      if (!company) return res.status(404).json({ message: "Empresa não encontrada" });

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
        await fileStorageService.deleteFile(company.logoUrl);
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
    } catch (error) {
      console.error("Error uploading company logo:", error);
      res.status(500).json({ message: "Erro ao enviar logo da empresa" });
    }
  });

  app.get("/api/companies/:id/logo", async (req: Request, res: Response) => {
    try {
      const companyId = parseInt(req.params.id);
      const company = await storage.getCompanyById(companyId);
      if (!company || (!company.logoUrl && !company.logoBase64)) return res.status(404).json({ message: "Logo não encontrado" });

      if (company.logoUrl) {
        const file = await fileStorageService.openFileStream(company.logoUrl);
        res.setHeader("Content-Type", file.contentType);
        if (file.contentLength) res.setHeader("Content-Length", file.contentLength);
        file.stream.pipe(res);
        return;
      }

      const base64Match = company.logoBase64?.match(/^data:(image\/(?:jpeg|jpg|png));base64,(.+)$/);
      if (!base64Match) return res.status(404).json({ message: "Logo não encontrado" });

      const [, mimeType, encodedContent] = base64Match;
      const buffer = Buffer.from(encodedContent, "base64");
      res.setHeader("Content-Type", mimeType);
      res.setHeader("Content-Length", buffer.length);
      res.send(buffer);
    } catch (error) {
      console.error("Error serving company logo:", error);
      res.status(500).json({ message: "Erro ao servir logo da empresa" });
    }
  });
}
