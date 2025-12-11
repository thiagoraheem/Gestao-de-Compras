import type { Express, Request, Response } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { db } from "../db";
import {
  receipts,
  insertReceiptSchema,
  attachments,
} from "@shared/schema";
import { parseNFeXml } from "../services/nfe-parser";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";

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
  // Import XML NF-e
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

      // Não é possível criar recebimento automaticamente: banco exige campos mínimos (pedido, recebedor, data)
      // Retorna apenas prévia parseada para o frontend preencher e salvar
      try {
        await db.execute(sql`INSERT INTO audit_logs (purchase_request_id, action_type, action_description, performed_by, before_data, after_data, affected_tables)
          VALUES (${0}, ${'recebimento_import_xml'}, ${'Importação de XML NF-e (prévia)'}, ${null}, ${null}, ${JSON.stringify({ documentKey: parsed.header.documentKey })}::jsonb, ${sql`ARRAY['receipts']`} );`);
      } catch {}

      return res.json({
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
      const rows = await db.select().from(attachments).where(sql`${attachments.attachmentType} = 'recebimento_nf_xml'`).limit(limit);
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

  // Create draft (servico/avulso)
  app.post("/api/recebimentos", async (req: Request, res: Response) => {
    try {
      const payload = insertReceiptSchema.parse(req.body);
      const [created] = await db.insert(receipts).values({
        receiptNumber: generateReceiptNumber(),
        ...payload,
      } as any).returning();
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
    const [updated] = await db.update(receipts).set({ status: "validado" }).where(eq(receipts.id, id)).returning();
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

    const [updated] = await db.update(receipts).set({ status: "integrado", createdAt: new Date() }).where(eq(receipts.id, id)).returning();
    try {
      await db.execute(sql`INSERT INTO audit_logs (purchase_request_id, action_type, action_description, performed_by, before_data, after_data, affected_tables)
        VALUES (${0}, ${'recebimento_envio_locador'}, ${'Envio do recebimento ao Locador'}, ${null}, ${null}, ${JSON.stringify({ receiptId: updated.id, status: updated.status })}::jsonb, ${sql`ARRAY['receipts']`} );`);
    } catch {}
    res.json({ status_integracao: "integrada", id_recebimento_locador: updated.id, mensagem: "Processado com sucesso" });
  });
}
