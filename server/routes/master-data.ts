import type { Express } from "express";
import { db } from "../db";
import { costCenters } from "../../shared/schema";
import { initSwaggerWatcher } from "../integracao_locador/utils/swagger-watcher";
import { eq } from "drizzle-orm";
import { configService } from "../services/configService";
import { locadorHttpClient } from "../services/locadorHttpClient";

export function registerMasterDataRoutes(app: Express) {
  initSwaggerWatcher();

  app.get("/api/centros-custo", async (_req, res) => {
    const rows = await db.select().from(costCenters);
    res.json(rows);
  });

  app.get("/api/integracao-locador/centros-custo", async (_req, res) => {
    try {
      const started = Date.now();
      const cfg = await configService.getLocadorConfig();
      const raw = await locadorHttpClient.get<any>(cfg.endpoints.combo.centroCusto);
      const remote = extractArray(raw).map((raw: any) => ({
        idCostCenter: Number(raw.idCostCenter ?? raw.id ?? 0),
        parentId: raw.parentId ?? null,
        name: raw.name ?? null,
      }));
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
      const cfg = await configService.getLocadorConfig();
      const raw = await locadorHttpClient.get<any>(cfg.endpoints.combo.planoContas);
      const remote = extractArray(raw).map((raw: any) => ({
        idChartOfAccounts: Number(raw.idChartOfAccounts ?? raw.id ?? 0),
        parentId: raw.parentId ?? null,
        accountName: raw.accountName ?? raw.name ?? null,
        isPayable: raw.isPayable ?? raw.IsPayable ?? false,
      }));
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
      const cfg = await configService.getLocadorConfig();
      const raw = await locadorHttpClient.get<any>(cfg.endpoints.combo.formaPagamento);
      const remote = extractArray(raw).map((item: any) => ({
        codigo: item.codigo ?? item.code ?? item.id ?? null,
        descricao: item.descricao ?? item.description ?? item.name ?? null,
      }));
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

  app.get("/api/integracao-locador/empresas", async (_req, res) => {
    try {
      const started = Date.now();
      const cfg = await configService.getLocadorConfig();
      const raw = await locadorHttpClient.get<any>(cfg.endpoints.combo.empresa);
      const remote = extractArray(raw).map((item: any) => ({
        idCompany: Number(item.idCompany ?? item.id ?? 0),
        companyName: item.companyName ?? item.name ?? null,
        companyTrading: item.companyTrading ?? item.tradingName ?? item.alias ?? null,
        cnpj: item.cnpj ?? item.taxId ?? item.document ?? null,
        address: item.address ?? null,
        phone: item.phone ?? null,
        email: item.email ?? null,
      }));
      res.set('X-Upstream', 'locador');
      res.set('X-Upstream-Items', String(remote.length));
      res.set('X-Upstream-Duration', String(Date.now() - started));
      if (process.env.LOG_VERBOSE === 'true' || process.env.NODE_ENV === 'development') {
        console.log(`[route] GET /api/integracao-locador/empresas items=${remote.length}`);
      }
      return res.json(remote);
    } catch (error) {
      if (process.env.LOG_VERBOSE === 'true' || process.env.NODE_ENV === 'development') {
        console.error(`[route] /api/integracao-locador/empresas failed ${String((error as any)?.message || error)}`);
      }
      res.status(502).json({ message: "Falha ao consultar Empresas no Locador" });
    }
  });


  app.post("/api/sync/centros-custo", async (_req, res) => {
    try {
      const cfg = await configService.getLocadorConfig();
      const raw = await locadorHttpClient.get<any>(cfg.endpoints.combo.centroCusto);
      res.json({ synced: extractArray(raw).length });
    } catch (error) {
      res.status(500).json({ message: "Falha ao sincronizar Centros de Custo" });
    }
  });

  app.get("/api/integracao-locador/health", async (_req, res) => {
    const result: any = { ok: true };
    try {
      const cfg = await configService.getLocadorConfig();
      const cc = await locadorHttpClient.get<any>(cfg.endpoints.combo.centroCusto);
      result.costCenters = { count: extractArray(cc).length };
    } catch (e: any) {
      result.ok = false;
      result.costCenters = { error: e?.message || String(e) };
    }
    try {
      const cfg = await configService.getLocadorConfig();
      const coa = await locadorHttpClient.get<any>(cfg.endpoints.combo.planoContas);
      result.chartOfAccounts = { count: extractArray(coa).length };
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
      const cfg = await configService.getLocadorConfig();
      const endpoint = cfg.endpoints.post.recebimento;
      if (!endpoint) {
        return res.status(400).json({ message: "Endpoint locador.endpoints.post.recebimento não configurado" });
      }
      await locadorHttpClient.post(endpoint, req.body);
      res.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido ao enviar recebimento";
      res.status(500).json({ message });
    }
  });
}

function extractArray(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.items)) return raw.items;
  if (Array.isArray(raw?.data)) return raw.data;
  if (Array.isArray(raw?.result)) return raw.result;
  return [];
}
