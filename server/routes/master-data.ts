import type { Express } from "express";
import { db } from "../db";
import { costCenters } from "../../shared/schema";
import { costCenterService } from "../integracao_locador/services/cost-center-service";
import { chartOfAccountsService } from "../integracao_locador/services/chart-of-accounts-service";
import { paymentMethodService } from "../integracao_locador/services/payment-method-service";
import { purchaseReceiveService } from "../integracao_locador/services/purchase-receive-service";
import { initSwaggerWatcher } from "../integracao_locador/utils/swagger-watcher";
import { eq } from "drizzle-orm";

export function registerMasterDataRoutes(app: Express) {
  initSwaggerWatcher();

  app.get("/api/centros-custo", async (_req, res) => {
    const rows = await db.select().from(costCenters);
    res.json(rows);
  });

  app.get("/api/integracao-locador/centros-custo", async (_req, res) => {
    try {
      const started = Date.now();
      const remote = await costCenterService.list();
      res.set('X-Upstream', 'locador');
      res.set('X-Upstream-Items', String(remote.length));
      res.set('X-Upstream-Duration', String(Date.now() - started));
      if (process.env.LOG_VERBOSE === 'true' || process.env.NODE_ENV === 'development') {
        console.log(`[route] GET /api/integracao-locador/centros-custo items=${remote.length}`);
      }
      return res.json(remote);
    } catch (error) {
      if (process.env.LOG_VERBOSE === 'true' || process.env.NODE_ENV === 'development') {
        console.error(`[route] /api/integracao-locador/centros-custo failed ${String((error as any)?.message || error)}`);
      }
      res.status(502).json({ message: "Falha ao consultar Centros de Custo no Locador" });
    }
  });

  app.get("/api/plano-contas", async (_req, res) => {
    try {
      const started = Date.now();
      const remote = await chartOfAccountsService.list();
      res.set('X-Upstream', 'locador');
      res.set('X-Upstream-Items', String(remote.length));
      res.set('X-Upstream-Duration', String(Date.now() - started));
      if (process.env.LOG_VERBOSE === 'true' || process.env.NODE_ENV === 'development') {
        console.log(`[route] GET /api/plano-contas items=${remote.length}`);
      }
      return res.json(remote);
    } catch (error) {
      if (process.env.LOG_VERBOSE === 'true' || process.env.NODE_ENV === 'development') {
        console.error(`[route] /api/plano-contas failed ${String((error as any)?.message || error)}`);
      }
      res.status(502).json({ message: "Falha ao consultar Plano de Contas no Locador" });
    }
  });

  app.get("/api/integracao-locador/formas-pagamento", async (_req, res) => {
    try {
      const started = Date.now();
      const remote = await paymentMethodService.list();
      res.set('X-Upstream', 'locador');
      res.set('X-Upstream-Items', String(remote.length));
      res.set('X-Upstream-Duration', String(Date.now() - started));
      if (process.env.LOG_VERBOSE === 'true' || process.env.NODE_ENV === 'development') {
        console.log(`[route] GET /api/integracao-locador/formas-pagamento items=${remote.length}`);
      }
      return res.json(remote);
    } catch (error) {
      if (process.env.LOG_VERBOSE === 'true' || process.env.NODE_ENV === 'development') {
        console.error(`[route] /api/integracao-locador/formas-pagamento failed ${String((error as any)?.message || error)}`);
      }
      res.status(502).json({ message: "Falha ao consultar Formas de Pagamento no Locador" });
    }
  });

  app.post("/api/sync/centros-custo", async (_req, res) => {
    try {
      const remote = await costCenterService.list();
      res.json({ synced: Array.isArray(remote) ? remote.length : 0 });
    } catch (error) {
      res.status(500).json({ message: "Falha ao sincronizar Centros de Custo" });
    }
  });

  app.get("/api/integracao-locador/health", async (_req, res) => {
    const result: any = { ok: true };
    try {
      const cc = await costCenterService.list();
      result.costCenters = { count: cc.length };
    } catch (e: any) {
      result.ok = false;
      result.costCenters = { error: e?.message || String(e) };
    }
    try {
      const coa = await chartOfAccountsService.list();
      result.chartOfAccounts = { count: coa.length };
    } catch (e: any) {
      result.ok = false;
      result.chartOfAccounts = { error: e?.message || String(e) };
    }
    res.json(result);
  });

  app.post("/api/sync/plano-contas", async (req, res) => {
    const data = Array.isArray(req.body) ? req.body : [];
    res.json({ synced: data.length });
  });

  app.post("/api/integracao-locador/recebimento", async (req, res) => {
    try {
      await purchaseReceiveService.submit(req.body);
      res.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido ao enviar recebimento";
      res.status(500).json({ message });
    }
  });
}
