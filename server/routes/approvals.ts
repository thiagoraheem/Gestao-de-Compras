import type { Express } from "express";
import { isAuthenticated } from "./middleware";
import { db } from "../db";
import { purchaseRequests } from "@shared/schema";
import { and, eq, isNull, sql } from "drizzle-orm";

export function registerApprovalsRoutes(app: Express) {
  app.get("/api/approvals/pending-count", isAuthenticated, async (req, res) => {
    const userId = req.session.userId!;
    const a1Rows = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(purchaseRequests)
      .where(and(eq(purchaseRequests.currentPhase, "aprovacao_a1"), eq(purchaseRequests.approverA1Id, userId), isNull(purchaseRequests.approvedA1)));
    const a2Rows = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(purchaseRequests)
      .where(and(eq(purchaseRequests.currentPhase, "aprovacao_a2"), sql`(
        ${purchaseRequests.approverA2Id} = ${userId} OR (
          ${purchaseRequests.requiresDualApproval} = true AND (
            ${purchaseRequests.firstApproverA2Id} = ${userId} AND ${purchaseRequests.firstApprovalDate} IS NULL
          ) OR (
            ${purchaseRequests.finalApproverId} = ${userId} AND ${purchaseRequests.finalApprovalDate} IS NULL
          )
        )
      )`, isNull(purchaseRequests.approvedA2)));
    const a1 = Number(a1Rows[0]?.count || 0);
    const a2 = Number(a2Rows[0]?.count || 0);
    const total = a1 + a2;
    const ts = new Date().toISOString();
    res.json({ a1, a2, total, ts });
  });
}