import type { Express } from "express";
import { configService } from "../services/configService";
import { locadorHttpClient } from "../services/locadorHttpClient";

export function registerLocadorIntegrationRoutes(app: Express) {
  app.get("/api/integration/locador/combos/fornecedores", async (req, res) => {
    const cfg = await configService.getLocadorConfig();
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;

    const path = cfg.endpoints.combo.fornecedor;
    const query = new URLSearchParams();
    if (search) query.set("search", search);
    if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) query.set("limit", String(limit));

    const started = Date.now();
    const raw = await locadorHttpClient.get<any>(query.size ? `${path}?${query.toString()}` : path);
    const items = extractArray(raw).map(mapSupplierSummary);
    setUpstreamHeaders(res, items.length, started);
    res.json(items);
  });

  app.get("/api/integration/locador/combos/centros-custo", async (_req, res) => {
    const cfg = await configService.getLocadorConfig();
    const started = Date.now();
    const raw = await locadorHttpClient.get<any>(cfg.endpoints.combo.centroCusto);
    const items = extractArray(raw).map(mapCostCenter);
    setUpstreamHeaders(res, items.length, started);
    res.json(items);
  });

  app.get("/api/integration/locador/combos/planos-conta", async (_req, res) => {
    const cfg = await configService.getLocadorConfig();
    const started = Date.now();
    const raw = await locadorHttpClient.get<any>(cfg.endpoints.combo.planoContas);
    const items = extractArray(raw).map(mapChartOfAccounts);
    setUpstreamHeaders(res, items.length, started);
    res.json(items);
  });

  app.get("/api/integration/locador/combos/empresas", async (_req, res) => {
    const cfg = await configService.getLocadorConfig();
    const started = Date.now();
    const raw = await locadorHttpClient.get<any>(cfg.endpoints.combo.empresa);
    const items = extractArray(raw).map(mapEmpresa);
    setUpstreamHeaders(res, items.length, started);
    res.json(items);
  });

  app.get("/api/integration/locador/combos/formas-pagamento", async (_req, res) => {
    const cfg = await configService.getLocadorConfig();
    const started = Date.now();
    const raw = await locadorHttpClient.get<any>(cfg.endpoints.combo.formaPagamento);
    const items = extractArray(raw).map(mapPaymentMethod);
    setUpstreamHeaders(res, items.length, started);
    res.json(items);
  });

  app.post("/api/integration/locador/solicitacoes", async (req, res) => {
    const cfg = await configService.getLocadorConfig();
    const endpoint = cfg.endpoints.post.enviarSolicitacao;
    if (!endpoint) {
      return res.status(400).json({ message: "Endpoint locador.endpoints.post.enviarSolicitacao não configurado" });
    }
    const started = Date.now();
    const result = await locadorHttpClient.post<any>(endpoint, req.body);
    setUpstreamHeaders(res, undefined, started);
    res.json(result);
  });

  app.post("/api/integration/locador/recebimentos", async (req, res) => {
    const cfg = await configService.getLocadorConfig();
    const endpoint = cfg.endpoints.post.recebimento;
    if (!endpoint) {
      return res.status(400).json({ message: "Endpoint locador.endpoints.post.recebimento não configurado" });
    }
    const started = Date.now();
    const result = await locadorHttpClient.post<any>(endpoint, req.body);
    setUpstreamHeaders(res, undefined, started);
    res.json(result);
  });

  app.get("/api/integration/locador/health", async (_req, res) => {
    const result: any = { ok: true };
    try {
      const cfg = await configService.getLocadorConfig();
      const cc = await locadorHttpClient.get<any>(cfg.endpoints.combo.centroCusto);
      result.costCenters = { count: extractArray(cc).length };
    } catch (e: any) {
      result.ok = false;
      result.costCenters = { error: e?.message || String(e) };
    }
    res.json(result);
  });
}

function extractArray(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.items)) return raw.items;
  if (Array.isArray(raw?.data)) return raw.data;
  if (Array.isArray(raw?.result)) return raw.result;
  return [];
}

function setUpstreamHeaders(res: any, items: number | undefined, started: number) {
  res.set("X-Upstream", "locador");
  if (typeof items === "number") res.set("X-Upstream-Items", String(items));
  res.set("X-Upstream-Duration", String(Date.now() - started));
}

function mapCostCenter(raw: any) {
  return {
    idCostCenter: Number(raw.idCostCenter ?? raw.id ?? 0),
    parentId: raw.parentId ?? null,
    name: raw.name ?? null,
  };
}

function mapChartOfAccounts(raw: any) {
  return {
    idChartOfAccounts: Number(raw.idChartOfAccounts ?? raw.id ?? 0),
    parentId: raw.parentId ?? null,
    accountName: raw.accountName ?? raw.name ?? null,
    isPayable: raw.isPayable ?? raw.IsPayable ?? false,
  };
}

function mapPaymentMethod(raw: any) {
  return {
    codigo: raw.codigo ?? raw.code ?? raw.id ?? null,
    descricao: raw.descricao ?? raw.description ?? raw.name ?? null,
  };
}

function mapEmpresa(raw: any) {
  return {
    idCompany: Number(raw.idCompany ?? raw.id ?? 0),
    companyName: raw.companyName ?? raw.name ?? null,
    companyTrading: raw.companyTrading ?? raw.tradingName ?? raw.alias ?? null,
    cnpj: raw.cnpj ?? raw.taxId ?? raw.document ?? null,
    address: raw.address ?? null,
    phone: raw.phone ?? null,
    email: raw.email ?? null,
  };
}

function mapSupplierSummary(raw: any) {
  const id = Number(raw.id ?? raw.codigo ?? raw.supplierId ?? raw.idsuppliererp ?? raw.ids ?? 0);
  const name = raw.name ?? raw.nome ?? raw.razaoSocial ?? raw.companyName ?? raw.description ?? "";
  return {
    id,
    name: String(name || ""),
    cnpj: raw.cnpj ?? raw.cnpjCpf ?? raw.cpfCnpj ?? undefined,
    cpf: raw.cpf ?? undefined,
    email: raw.email ?? raw.eMail ?? undefined,
    phone: raw.phone ?? raw.telefone ?? raw.celular ?? undefined,
  };
}

