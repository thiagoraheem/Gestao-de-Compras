import { Request, Response } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { receipts, receiptItems } from "../../shared/schema";
import { isAuthenticated } from "./auth";
import { PDFService } from "../pdf-service";
import { dashboardService } from "../services/dashboard-service";

export function registerDashboardRoutes(app: any) {
  // Dashboard API endpoint
  app.get("/api/dashboard", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      
      // Check if user is manager, admin or buyer
      const user = await storage.getUser(userId);
      if (!user?.isManager && !user?.isAdmin && !user?.isBuyer) {
        return res
          .status(403)
          .json({ message: "Manager, admin or buyer access required" });
      }

      const dashboardData = await dashboardService.getDashboardData(userId, req.query);
      res.json(dashboardData);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      res.status(500).json({ message: "Failed to fetch dashboard data" });
    }
  });

  // Dashboard PDF export
  app.get("/api/dashboard/export-pdf", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const {
        period = "30",
        department = "all",
        status = "all",
        startDate: startDateParam,
        endDate: endDateParam,
        dateFilterType = "created",
      } = req.query;

      // Check if user is manager or admin
      const user = await storage.getUser(req.session.userId!);
      if (!user?.isManager && !user?.isAdmin && !user?.isBuyer) {
        return res
          .status(403)
          .json({ message: "Manager, admin or buyer access required" });
      }

      // Calculate date range
      let startDate: Date, endDate: Date;

      if (startDateParam && endDateParam) {
        startDate = new Date(startDateParam as string);
        endDate = new Date(endDateParam as string);
      } else {
        const daysAgo = parseInt(period as string);
        startDate = new Date();
        startDate.setDate(startDate.getDate() - daysAgo);
        endDate = new Date();
      }

      // Generate PDF
      const pdfBuffer = await PDFService.generateDashboardPDF({
        startDate,
        endDate,
        departmentId: department !== "all" ? Number(department) : undefined,
        status: status !== "all" ? (status as string) : undefined,
        dateFilterType: dateFilterType as any,
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="Dashboard_Compras_${new Date().toISOString().split("T")[0]}.pdf"`,
      );
      res.setHeader("Content-Length", pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error exporting dashboard PDF:", error);
      res.status(500).json({ message: "Failed to export dashboard PDF" });
    }
  });
}
