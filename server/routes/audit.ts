import type { Express } from "express";
import { isAuthenticated } from "./middleware";
import { auditService } from "../services/audit-service";
import { ValidationError } from "../utils/errors";
import { pool } from "../db";

export function registerAuditRoutes(app: Express) {
  app.post("/api/audit/log", isAuthenticated, async (req, res) => {
    const userId = req.session.userId!;
    const { purchaseRequestId, actionType, actionDescription, beforeData, afterData } = req.body || {};
    
    if (!purchaseRequestId || !actionType) {
      throw new ValidationError("purchaseRequestId e actionType são obrigatórios");
    }

    await auditService.log({
      purchaseRequestId,
      performedBy: userId,
      actionType: String(actionType),
      actionDescription: String(actionDescription || ""),
      beforeData,
      afterData,
      affectedTables: [] // Opcional, mas recomendado informar se souber
    });

    res.json({ ok: true });
  });

  app.get("/api/audit/logs/:requestId", isAuthenticated, async (req, res) => {
    const requestId = Number(req.params.requestId);
    if (isNaN(requestId)) {
      throw new ValidationError("ID de solicitação inválido");
    }

    // Nota: Mantendo pool.query para consulta por enquanto, mas o ideal seria um UserRepository/AuditRepository
    const logs = await pool.query(
      `SELECT al.*, u.first_name, u.last_name, u.username 
       FROM audit_logs al
       LEFT JOIN users u ON al.performed_by = u.id
       WHERE al.purchase_request_id = $1
       ORDER BY al.performed_at DESC`,
      [requestId]
    );

    res.json(logs.rows);
  });
}

