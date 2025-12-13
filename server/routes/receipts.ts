import type { Express, Request, Response } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { db } from "../db";
import {
  receipts,
  insertReceiptSchema,
  attachments,
  receiptNfXmls,
  receiptItems,
  receiptInstallments,
} from "@shared/schema";
import { parseNFeXml } from "../services/nfe-parser";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import fetch from "node-fetch";

function generateReceiptNumber() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `REC-${y}${m}${d}-${rand}`;
}

const xmlUpload = multer({
  storage: multer.diskStorage({
    destination: function (_req, _file, cb) {
      const uploadDir = "./uploads/nfe_xml";
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      cb(null, uploadDir);
    },
    filename: function (_req, file, cb) {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
    },
  }),
  fileFilter: function (_req, file, cb) {
    const allowed = ["application/xml", "text/xml"];
    cb(null, allowed.includes(file.mimetype));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

export function registerReceiptsRoutes(app: Express) {
  app.post("/api/recebimentos/import-xml", xmlUpload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Arquivo XML é obrigatório" });
      }
      const xmlContent = await fs.promises.readFile(req.file.path, "utf-8");

      const parsed = parseNFeXml(xmlContent);

      const prIdRaw = (req.body?.purchaseRequestId ?? req.query?.purchaseRequestId) as any;
      const purchaseRequestId = prIdRaw ? Number(prIdRaw) : undefined;
      let savedAttachmentId: number | undefined = undefined;
      try {
        const [att] = await db.insert(attachments).values({
          purchaseRequestId: purchaseRequestId,
          fileName: req.file.originalname,
          filePath: req.file.path,
          fileType: req.file.mimetype,
          fileSize: req.file.size,
          attachmentType: "recebimento_nf_xml",
        }).returning();
        savedAttachmentId = att?.id as any;
      } catch {}

      const result = await db.transaction(async (tx) => {
        const [createdReceipt] = await tx.insert(receipts).values({
          receiptNumber: generateReceiptNumber(),
          purchaseOrderId: purchaseRequestId ? undefined as any : null,
          status: "rascunho",
          receiptType: "produto",
          documentNumber: parsed.header.documentNumber,
          documentSeries: parsed.header.documentSeries,
          documentKey: parsed.header.documentKey,
          documentIssueDate: parsed.header.issueDate ? new Date(parsed.header.issueDate) : null,
          documentEntryDate: parsed.header.entryDate ? new Date(parsed.header.entryDate) : null,
          totalAmount: (parsed.header.totals?.vNF || parsed.header.totals?.vProd || "0") as any,
          installmentsCount: Array.isArray(parsed.installments) ? parsed.installments.length : null,
          createdAt: new Date(),
        } as any).returning();
        const receiptId = createdReceipt.id;
        await tx.insert(receiptNfXmls).values({
          receiptId,
          xmlContent,
          xmlHash: parsed.xmlHash,
        } as any);
        for (const it of parsed.items || []) {
          await tx.insert(receiptItems).values({
            receiptId,
            lineNumber: it.lineNumber,
            description: it.description,
            unit: it.unit,
            quantity: it.quantity as any,
            unitPrice: it.unitPrice as any,
            totalPrice: it.totalPrice as any,
            ncm: it.ncm,
            cfop: it.cfop,
            icmsRate: it.taxes?.icmsRate as any,
            icmsAmount: it.taxes?.icmsAmount as any,
            ipiRate: it.taxes?.ipiRate as any,
            ipiAmount: it.taxes?.ipiAmount as any,
            pisRate: it.taxes?.pisRate as any,
            pisAmount: it.taxes?.pisAmount as any,
            cofinsRate: it.taxes?.cofinsRate as any,
            cofinsAmount: it.taxes?.cofinsAmount as any,
            quantityReceived: (it.quantity ?? "0") as any,
            condition: "xml",
            createdAt: new Date(),
          } as any);
        }
        for (const dup of parsed.installments || []) {
          await tx.insert(receiptInstallments).values({
            receiptId,
            installmentNumber: dup.number || "",
            dueDate: dup.dueDate ? new Date(dup.dueDate) : new Date(),
            amount: (dup.amount ?? "0") as any,
          } as any);
        }
        return createdReceipt;
      });
      try {
        await db.execute(sql`INSERT INTO audit_logs (purchase_request_id, action_type, action_description, performed_by, before_data, after_data, affected_tables)
          VALUES (${0}, ${'recebimento_import_xml'}, ${'Importação de XML NF-e (prévia)'}, ${null}, ${null}, ${JSON.stringify({ documentKey: parsed.header.documentKey })}::jsonb, ${sql`ARRAY['receipts']`} );`);
      } catch {}

      return res.json({
        receipt: result,
        preview: {
          header: parsed.header,
          items: parsed.items,
          installments: parsed.installments,
          totals: parsed.header.totals,
        },
        attachment: savedAttachmentId ? { id: savedAttachmentId } : undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao processar XML";
      return res.status(400).json({ message });
    }
  });

  app.get("/api/nfe/attachments", async (req: Request, res: Response) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const search = String(req.query.search || "").trim().toLowerCase();
      const prId = req.query.purchaseRequestId ? Number(req.query.purchaseRequestId) : undefined;
      const baseWhere = prId
        ? sql`${attachments.attachmentType} = 'recebimento_nf_xml' AND ${attachments.purchaseRequestId} = ${prId}`
        : sql`${attachments.attachmentType} = 'recebimento_nf_xml'`;
      const rows = await db.select().from(attachments).where(baseWhere).limit(limit);
      const result: any[] = [];
      for (const row of rows) {
        try {
          const content = await fs.promises.readFile(row.filePath, "utf-8");
          const parsed = parseNFeXml(content);
          const header = parsed?.header || {};
          const hay = `${row.fileName} ${header.documentNumber || ''} ${header.documentSeries || ''} ${header.supplier?.name || ''} ${header.supplier?.cnpjCpf || ''}`.toLowerCase();
          if (search && !hay.includes(search)) continue;
          result.push({
            id: row.id,
            fileName: row.fileName,
            uploadedAt: row.uploadedAt,
            documentNumber: header.documentNumber,
            documentSeries: header.documentSeries,
            documentKey: header.documentKey,
            supplierName: header.supplier?.name,
            supplierCnpjCpf: header.supplier?.cnpjCpf,
            total: header.totals?.vNF || header.totals?.vProd,
          });
        } catch {}
      }
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Erro ao listar NF-es" });
    }
  });

  app.get("/api/nfe/attachments/:id/preview", async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "ID inválido" });
      const [att] = await db.select().from(attachments).where(sql`${attachments.id} = ${id} AND ${attachments.attachmentType} = 'recebimento_nf_xml'`).limit(1);
      if (!att) return res.status(404).json({ message: "Anexo não encontrado" });
      const content = await fs.promises.readFile(att.filePath, "utf-8");
      const parsed = parseNFeXml(content);
      const preview = {
        header: parsed.header,
        items: parsed.items,
        installments: parsed.installments,
        totals: parsed.header.totals,
      };
      try {
        await db.execute(sql`INSERT INTO audit_logs (purchase_request_id, action_type, action_description, performed_by, before_data, after_data, affected_tables)
          VALUES (${att.purchaseRequestId ?? 0}, ${'recebimento_preview_xml'}, ${'Pré-visualização de XML NF-e (anexo)'}, ${null}, ${null}, ${JSON.stringify({ attachmentId: att.id, documentKey: parsed.header.documentKey })}::jsonb, ${sql`ARRAY['receipts']`} );`);
      } catch {}
      res.json({ preview, attachment: { id: att.id }, xmlRaw: content });
    } catch (error) {
      res.status(500).json({ message: "Erro ao gerar prévia de NF-e" });
    }
  });

  // Create draft (servico/avulso)
  app.post("/api/recebimentos", async (req: Request, res: Response) => {
    try {
      const payload = insertReceiptSchema.parse(req.body);
      if ((payload.receiptType === "servico" || payload.receiptType === "avulso") && (!payload.costCenterId || !payload.chartOfAccountsId)) {
        return res.status(400).json({ message: "Centro de Custo e Plano de Contas são obrigatórios" });
      }
      const [created] = await db.insert(receipts).values({
        receiptNumber: generateReceiptNumber(),
        ...payload,
        status: "rascunho",
        createdAt: new Date(),
      } as any).returning();
      try {
        await db.execute(sql`INSERT INTO audit_logs (purchase_request_id, action_type, action_description, performed_by, before_data, after_data, affected_tables)
          VALUES (${0}, ${'recebimento_criar'}, ${'Criação de recebimento'}, ${null}, ${null}, ${JSON.stringify({ receiptId: created.id, type: created.receiptType })}::jsonb, ${sql`ARRAY['receipts']`} );`);
      } catch {}
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Erro ao criar recebimento" });
    }
  });

  app.get("/api/recebimentos/:id", async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const [rec] = await db.select().from(receipts).where(eq(receipts.id, id));
    if (!rec) return res.status(404).json({ message: "Recebimento não encontrado" });
    res.json({ receipt: rec });
  });

  app.put("/api/recebimentos/:id", async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const updates = req.body;
      const [updated] = await db.update(receipts).set({ ...updates, updatedAt: new Date() }).where(eq(receipts.id, id)).returning();
      if (!updated) return res.status(404).json({ message: "Recebimento não encontrado" });
      res.json(updated);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Erro ao atualizar recebimento" });
    }
  });

  app.post("/api/recebimentos/:id/validar", async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const [rec] = await db.select().from(receipts).where(eq(receipts.id, id));
    if (!rec) return res.status(404).json({ message: "Recebimento não encontrado" });
    if ((rec.receiptType === "servico" || rec.receiptType === "avulso") && (!rec.costCenterId || !rec.chartOfAccountsId)) {
      return res.status(400).json({ message: "Centro de Custo e Plano de Contas são obrigatórios" });
    }
    if (rec.receiptType === "produto") {
      const xmlRows = await db.select().from(receiptNfXmls).where(eq(receiptNfXmls.receiptId, id));
      if (xmlRows.length === 0) return res.status(400).json({ message: "XML NF-e não associado ao recebimento" });
    }
    const [updated] = await db.update(receipts).set({ status: "validado_compras" }).where(eq(receipts.id, id)).returning();
    try {
      await db.execute(sql`INSERT INTO audit_logs (purchase_request_id, action_type, action_description, performed_by, before_data, after_data, affected_tables)
        VALUES (${0}, ${'recebimento_validar'}, ${'Validação de recebimento'}, ${null}, ${null}, ${JSON.stringify({ receiptId: updated.id, status: updated.status })}::jsonb, ${sql`ARRAY['receipts']`} );`);
    } catch {}
    res.json(updated);
  });

  app.post("/api/recebimentos/:id/enviar-locador", async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const [rec] = await db.select().from(receipts).where(eq(receipts.id, id));
    if (!rec) return res.status(404).json({ message: "Recebimento não encontrado" });
    if (rec.status !== "validado_compras") return res.status(400).json({ message: "Recebimento precisa estar validado" });

    const items = await db.select().from(receiptItems).where(eq(receiptItems.receiptId, id));
    const installments = await db.select().from(receiptInstallments).where(eq(receiptInstallments.receiptId, id));
    const [xmlRow] = await db.select().from(receiptNfXmls).where(eq(receiptNfXmls.receiptId, id));

    const dto: any = {
      tipo_documento: rec.receiptType,
      identificacao: {
        id_recebimento_compras: String(rec.id),
        numero_documento: rec.documentNumber || "",
        serie_documento: rec.documentSeries || "",
        chave_nfe: rec.documentKey || "",
        data_emissao: rec.documentIssueDate ? new Date(rec.documentIssueDate).toISOString() : null,
        data_entrada: rec.documentEntryDate ? new Date(rec.documentEntryDate).toISOString() : null,
      },
      fornecedor: {
        cnpj: null,
        id_fornecedor_locador: rec.locadorSupplierId || null,
      },
      total: {
        valor_total: Number(rec.totalAmount || 0),
        valor_produtos: null,
        valor_descontos: null,
        valor_frete: null,
        valor_ipi: null,
      },
      centro_custo: {
        codigo: null,
        id_locador: null,
      },
      plano_contas: {
        codigo: null,
        id_locador: null,
      },
      itens: items.map((it: any) => ({
        numero_item: it.lineNumber || null,
        descricao: it.description || null,
        quantidade: it.quantity ? Number(it.quantity) : null,
        unidade: it.unit || null,
        valor_unitario: it.unitPrice ? Number(it.unitPrice) : null,
        valor_total: it.totalPrice ? Number(it.totalPrice) : null,
        codigo_produto_locador: it.locadorProductCode || null,
        id_produto_locador: it.locadorProductId || null,
        ncm: it.ncm || null,
        cfop: it.cfop || null,
      })),
      parcelas: installments.map((p: any) => ({
        numero: p.installmentNumber,
        data_vencimento: p.dueDate ? new Date(p.dueDate).toISOString().slice(0, 10) : null,
        valor: p.amount ? Number(p.amount) : null,
      })),
      xml_nfe: xmlRow?.xmlContent || null,
    };

    let respJson: any;
    let integStatus = "erro_integracao";
    let integMessage = "Erro de integração";
    let locadorId: string | null = null;
    try {
      const resp = await fetch(`${req.protocol}://${req.get("host")}/api/v1/recebimentos`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: req.headers.authorization || "" },
        body: JSON.stringify(dto),
      });
      respJson = await resp.json();
      if (resp.ok && respJson?.status_integracao === "integrada") {
        integStatus = "integrado_locador";
        integMessage = respJson?.mensagem || "Integrado";
        locadorId = respJson?.id_recebimento_locador || null;
      } else {
        integStatus = "erro_integracao";
        integMessage = respJson?.mensagem || `Erro ${resp.status}`;
      }
    } catch (e: any) {
      integStatus = "erro_integracao";
      integMessage = e?.message || "Erro de integração";
    }

    const [updated] = await db.update(receipts).set({ status: integStatus, integrationMessage: integMessage, locadorReceiptId: locadorId }).where(eq(receipts.id, id)).returning();
    try {
      await db.execute(sql`INSERT INTO audit_logs (purchase_request_id, action_type, action_description, performed_by, before_data, after_data, affected_tables)
        VALUES (${0}, ${'recebimento_envio_locador'}, ${'Envio do recebimento ao Locador'}, ${null}, ${null}, ${JSON.stringify({ receiptId: updated.id, status: updated.status })}::jsonb, ${sql`ARRAY['receipts']`} );`);
    } catch {}
    res.json({ status_integracao: updated.status === "integrado_locador" ? "integrada" : "erro", id_recebimento_locador: updated.locadorReceiptId, mensagem: updated.integrationMessage });
  });
}
