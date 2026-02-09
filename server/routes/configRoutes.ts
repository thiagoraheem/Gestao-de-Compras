import type { Express } from "express";
import { configService } from "../services/configService";
import { isAuthenticated, isAdmin } from "./middleware";

export function registerConfigRoutes(app: Express) {
  app.get("/api/config/locador", isAuthenticated, isAdmin, async (_req, res) => {
    const cfg = await configService.getLocadorConfigPublic();
    res.json(cfg);
  });

  app.put("/api/config/locador", isAuthenticated, isAdmin, async (req, res) => {
    const updatedBy = req.session.userId ?? null;
    const cfg = await configService.updateLocadorConfig(req.body, updatedBy);
    res.json(cfg);
  });

  app.post("/api/config/locador/reload", isAuthenticated, isAdmin, async (_req, res) => {
    const cfg = await configService.reloadLocadorConfig();
    res.json(cfg);
  });
}

