import type { Express } from "express";
import { isAuthenticated } from "./middleware";
import { pool } from "../db";

export function registerAuditRoutes(app: Express) {
  app.post("/api/audit/log", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { purchaseRequestId, actionType, actionDescription, beforeData, afterData } = req.body || {};
      if (!purchaseRequestId || !actionType) {
        return res.status(400).json({ message: "purchaseRequestId e actionType são obrigatórios" });
      }
      await pool.query(
        `INSERT INTO audit_logs (purchase_request_id, performed_by, action_type, action_description, performed_at, before_data, after_data)
         VALUES ($1, $2, $3, $4, NOW(), $5, $6)`,
        [
          purchaseRequestId,
          userId,
          String(actionType),
          String(actionDescription || ""),
          beforeData ? JSON.stringify(beforeData) : null,
          afterData ? JSON.stringify(afterData) : null,
        ]
      );
      res.json({ ok: true });
    } catch (error: any) {
      console.error("Audit log error:", error);
      res.status(500).json({ message: "Failed to write audit log" });
    }
  });

  app.get("/api/audit/logs/:requestId", isAuthenticated, async (req, res) => {
    try {
      const requestId = Number(req.params.requestId);
      if (isNaN(requestId)) {
        return res.status(400).json({ message: "Invalid request ID" });
      }

      const logs = await pool.query(
        `SELECT al.*, u.first_name, u.last_name, u.username 
         FROM audit_logs al
         LEFT JOIN users u ON al.performed_by = u.id
         WHERE al.purchase_request_id = $1
         ORDER BY al.performed_at DESC`,
        [requestId]
      );

      res.json(logs.rows);
    } catch (error: any) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });
}

