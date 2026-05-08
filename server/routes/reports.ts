import { Request, Response } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "./auth";
import { pool } from "../db";
import { reportService } from "../services/report-service";

export function registerReportRoutes(app: any) {
  // Export purchase requests report as CSV
  app.get(
    "/api/reports/purchase-requests/export",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const csvContent = await reportService.generatePurchaseRequestCSV(req.query);
        const BOM = "\uFEFF";
        
        const timestamp = new Date().getTime();
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="relatorio_solicitacoes_${timestamp}.csv"`);
        res.send(BOM + csvContent);
        
      } catch (error: any) {
        console.error("Export Error: ", error);
        res.status(500).json({ message: "Failed to export CSV" });
      }
    }
  );

  // Purchase requests report endpoint
  app.get(
    "/api/reports/purchase-requests",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const result = await reportService.getPurchaseRequestReport(req.query);
        res.json(result);
      } catch (error) {
        console.error("Report Error:", error);
        res.status(500).json({ message: "Failed to fetch purchase requests report" });
      }
    }
  );


  // Suppliers detailed report endpoint
  app.get(
    "/api/reports/suppliers",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const { supplierId, startDate, endDate } = req.query as { supplierId?: string; startDate?: string; endDate?: string };
        const id = supplierId ? parseInt(supplierId) : NaN;
        if (!supplierId || isNaN(id)) {
          return res.status(400).json({ message: "Parâmetro supplierId é obrigatório e deve ser numérico" });
        }

        const report = await reportService.getSupplierDetailedReport(id, startDate, endDate);
        res.json(report);
      } catch (error: any) {
        console.error("Suppliers report error:", error);
        res.status(error.message === "Fornecedor não encontrado" ? 404 : 500).json({ message: error.message || "Failed to fetch suppliers report" });
      }
    }
  );
}
