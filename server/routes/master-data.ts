import type { Express } from "express";
import { db } from "../db";
import { costCenters } from "@shared/schema";

export function registerMasterDataRoutes(app: Express) {
  app.get("/api/centros-custo", async (_req, res) => {
    const rows = await db.select().from(costCenters);
    res.json(rows);
  });

  app.get("/api/plano-contas", async (_req, res) => {
    res.json([]);
  });

  app.post("/api/sync/centros-custo", async (req, res) => {
    const data = Array.isArray(req.body) ? req.body : [];
    res.json({ synced: data.length });
  });

  app.post("/api/sync/plano-contas", async (req, res) => {
    const data = Array.isArray(req.body) ? req.body : [];
    res.json({ synced: data.length });
  });
}
