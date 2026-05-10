import { Request, Response } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "./auth";
import { ValidationError, NotFoundError } from "../utils/errors";
import { pool } from "../db";
import { reportService } from "../services/report-service";

export function registerReportRoutes(app: any) {
  // Export purchase requests report as CSV
  app.get(
    "/api/reports/purchase-requests/export",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const csvContent = await reportService.generatePurchaseRequestCSV(req.query);
      const BOM = "\uFEFF";
      
      const timestamp = new Date().getTime();
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="relatorio_solicitacoes_${timestamp}.csv"`);
      res.send(BOM + csvContent);
    }
  );

  // Purchase requests report endpoint
  app.get(
    "/api/reports/purchase-requests",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const result = await reportService.getPurchaseRequestReport(req.query);
      res.json(result);
    }
  );


  // Suppliers detailed report endpoint
  app.get(
    "/api/reports/suppliers",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const { supplierId, startDate, endDate } = req.query as { supplierId?: string; startDate?: string; endDate?: string };
      const id = supplierId ? parseInt(supplierId) : NaN;
      if (!supplierId || isNaN(id)) {
        throw new ValidationError("Parâmetro supplierId é obrigatório e deve ser numérico");
      }

      const report = await reportService.getSupplierDetailedReport(id, startDate, endDate);
      res.json(report);
    }
  );
}
