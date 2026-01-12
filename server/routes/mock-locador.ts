import type { Express, Request, Response } from "express";
import { db } from "../db";
import { costCenters, chartOfAccounts } from "../../shared/schema";

type MockState = {
  responseMode: "success" | "error";
  requireToken: boolean;
  expectedToken?: string;
  errorStatus?: number;
  errorMessage?: string;
};

const state: MockState = {
  responseMode: "success",
  requireToken: false,
  errorStatus: 400,
  errorMessage: "Erro de integração simulado",
};

function checkAuth(req: Request) {
  if (!state.requireToken) return true;
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return false;
  const token = auth.substring("Bearer ".length).trim();
  if (state.expectedToken && token !== state.expectedToken) return false;
  return true;
}

export function registerMockLocadorRoutes(app: Express) {
  app.post("/mock/locador/config", (req: Request, res: Response) => {
    const body = req.body || {};
    state.responseMode = body.responseMode === "error" ? "error" : "success";
    state.requireToken = Boolean(body.requireToken);
    state.expectedToken = body.expectedToken || state.expectedToken;
    state.errorStatus = body.errorStatus || state.errorStatus;
    state.errorMessage = body.errorMessage || state.errorMessage;
    res.json({ ok: true, state });
  });

  app.get("/api/v1/centros-custo", async (req: Request, res: Response) => {
    if (!checkAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    const rows = await db.select().from(costCenters);
    if (!rows.length) {
      return res.json([
        { id: "123", codigo: "CC01", nome: "Operacional" },
        { id: "124", codigo: "ADM01", nome: "Administrativo" },
      ]);
    }
    return res.json(rows.map((r) => ({ id: String(r.externalId || r.id), codigo: r.code, nome: r.name })));
  });

  app.get("/api/v1/plano-contas", async (req: Request, res: Response) => {
    if (!checkAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    const rows = await db.select().from(chartOfAccounts);
    if (!rows.length) {
      return res.json([
        { id: "500", codigo: "3.2.1.01", descricao: "Despesas com Serviços Terceirizados" },
        { id: "501", codigo: "1.1.5.01", descricao: "Materiais de Consumo" },
      ]);
    }
    return res.json(rows.map((r) => ({ id: String(r.externalId || r.id), codigo: r.code, descricao: r.description })));
  });

  app.post("/api/v1/recebimentos", async (req: Request, res: Response) => {
    if (!checkAuth(req)) return res.status(401).json({ message: "Unauthorized" });
    const body = req.body || {};
    const hasTipo = typeof body.tipo_documento === "string";
    const hasIdent = body.identificacao && typeof body.identificacao === "object";
    const hasTotal = body.total && typeof body.total === "object";
    if (!hasTipo || !hasIdent || !hasTotal) {
      return res.status(400).json({ message: "Dados inválidos" });
    }
    if (state.responseMode === "error") {
      return res.status(state.errorStatus || 400).json({
        status_integracao: "erro",
        id_recebimento_locador: null,
        mensagem: state.errorMessage || "Erro de integração simulado",
      });
    }

    // Simulação de erro de Schema XML (RNG6110)
    // Se o XML contiver CompNfse mas não tiver o namespace correto, retorna erro igual ao da produção
    if (body.xml_nfe && typeof body.xml_nfe === 'string' && body.xml_nfe.includes('CompNfse') && !body.xml_nfe.includes('http://www.abrasf.org.br/nfse.xsd')) {
       return res.status(400).json({
         codigoFatura: 84838,
         idEmpresa: 3,
         status: "ERRO",
         mensagem: "Falha HTTP 400 (BadRequest): RNG6110 - Falha Schema Xml",
         numeroNfse: null,
         protocolo: null,
         chave: null,
         urlPdf: null,
         urlConsulta: null,
         dataEmissao: null
       });
    }

    return res.json({
      status_integracao: "integrada",
      id_recebimento_locador: Math.floor(Math.random() * 100000).toString(),
      mensagem: "Processado com sucesso",
    });
  });
}
