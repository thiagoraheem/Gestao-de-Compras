import type { Express, Request, Response } from "express";
import { isAuthenticated } from "./middleware";
import { storage } from "../storage";
import multer from "multer";
import fs from "fs";
import path from "path";
import { db } from "../db";
import { configService } from "../services/configService";
import {
  receipts,
  insertReceiptSchema,
  attachments,
  receiptNfXmls,
  receiptItems,
  receiptInstallments,
  suppliers,
  purchaseOrders,
  purchaseRequests,
  receiptAllocations,
  companies,
  purchaseOrderItems,
  purchaseRequestItems,
} from "../../shared/schema";
import { purchaseReceiveService, PurchaseReceiveRequest } from "../integracao_locador/services/purchase-receive-service";
import { parseNFeXml } from "../services/nfe-parser";
import { parseNFSeXml } from "../services/nfse-parser";
import { z } from "zod";
import { eq, sql, and, like, or, desc, asc } from "drizzle-orm";
// @ts-ignore
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
  app.get("/api/receipts/search", async (req: Request, res: Response) => {
    try {
      const { 
        number, 
        series, 
        cnpj, 
        accessKey, 
        supplierName, 
        startDate, 
        endDate, 
        page = "1", 
        limit = "20" 
      } = req.query;

      const pageNum = Number(page);
      const limitNum = Number(limit);
      const offset = (pageNum - 1) * limitNum;

      const conditions = [];

      if (number) conditions.push(like(receipts.documentNumber, `%${String(number)}%`));
      if (series) conditions.push(eq(receipts.documentSeries, String(series)));
      if (accessKey) conditions.push(like(receipts.documentKey, `%${String(accessKey)}%`));
      
      if (startDate) {
        conditions.push(sql`${receipts.documentIssueDate} >= ${new Date(String(startDate)).toISOString()}`);
      }
      if (endDate) {
        // Adjust end date to include the full day
        const end = new Date(String(endDate));
        end.setHours(23, 59, 59, 999);
        conditions.push(sql`${receipts.documentIssueDate} <= ${end.toISOString()}`);
      }

      let baseQuery = db.select({
        id: receipts.id,
        receiptNumber: receipts.receiptNumber,
        documentNumber: receipts.documentNumber,
        documentSeries: receipts.documentSeries,
        documentKey: receipts.documentKey,
        documentIssueDate: receipts.documentIssueDate,
        documentEntryDate: receipts.documentEntryDate,
        totalAmount: receipts.totalAmount,
        status: receipts.status,
        receiptType: receipts.receiptType,
        createdAt: receipts.createdAt,
        supplierName: suppliers.name,
        supplierCnpj: suppliers.cnpj,
      })
      .from(receipts)
      .leftJoin(suppliers, eq(receipts.supplierId, suppliers.id));

      if (cnpj) {
        conditions.push(like(suppliers.cnpj, `%${String(cnpj).replace(/\D/g, '')}%`));
      }
      
      if (supplierName) {
        conditions.push(like(suppliers.name, `%${String(supplierName)}%`));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Get total count for pagination
      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(receipts)
        .leftJoin(suppliers, eq(receipts.supplierId, suppliers.id))
        .where(whereClause);

      const total = Number(countResult.count);

      // Get paginated results
      const results = await baseQuery
        .where(whereClause)
        .orderBy(desc(receipts.createdAt))
        .limit(limitNum)
        .offset(offset);

      res.json({
        data: results,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      });
    } catch (error) {
       console.error("Error searching receipts:", error);
       res.status(500).json({ message: "Erro ao buscar notas fiscais" });
    }
  });

  app.get("/api/recebimentos/:id/items", async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const items = await db.select().from(receiptItems).where(eq(receiptItems.receiptId, id));
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar itens da nota fiscal" });
    }
  });

  app.get("/api/receipts/request/:requestId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const requestId = Number(req.params.requestId);
      
      // 1. Find Purchase Order
      const [purchaseOrder] = await db
        .select()
        .from(purchaseOrders)
        .where(eq(purchaseOrders.purchaseRequestId, requestId))
        .limit(1);

      if (!purchaseOrder) {
        return res.status(404).json({ message: "Pedido de compra não encontrado" });
      }

      // 2. Find Receipts linked to this Purchase Order
      const receiptsList = await db.execute(sql`
        SELECT DISTINCT r.*, 
               r.approved_at as approval_date,
               u_rec.first_name as receiver_first_name, u_rec.last_name as receiver_last_name,
               u_app.first_name as approver_first_name, u_app.last_name as approver_last_name
        FROM receipts r
        JOIN receipt_items ri ON r.id = ri.receipt_id
        JOIN purchase_order_items poi ON ri.purchase_order_item_id = poi.id
        LEFT JOIN users u_rec ON r.received_by = u_rec.id
        LEFT JOIN users u_app ON r.approved_by = u_app.id
        WHERE poi.purchase_order_id = ${purchaseOrder.id}
        ORDER BY r.created_at DESC
      `);

      // Always return an array, even if empty
      const receiptsWithItems = await Promise.all(receiptsList.rows.map(async (receipt) => {
          // Fetch items for each receipt
          const items = await db.select().from(receiptItems).where(eq(receiptItems.receiptId, Number(receipt.id)));
          
          // Parse observations if string
          if (typeof receipt.observations === 'string') {
              try {
                  receipt.observations = JSON.parse(receipt.observations);
              } catch (e) {
                  // keep as string
              }
          }

          return { ...receipt, items };
      }));

      res.json(receiptsWithItems);
    } catch (error) {
      console.error("Error fetching receipt by request ID:", error);
      res.status(500).json({ message: "Erro ao buscar nota fiscal" });
    }
  });

  app.post("/api/recebimentos/parse-existing/:id", async (req: Request, res: Response) => {
      try {
        const id = Number(req.params.id);
        const [xmlRow] = await db.select().from(receiptNfXmls).where(eq(receiptNfXmls.receiptId, id));

        if (!xmlRow) {
            return res.status(404).json({ message: "XML não encontrado para este recebimento" });
        }

        const xmlContent = xmlRow.xmlContent;
        let parsed;
        let isService = false;
        try {
            parsed = parseNFeXml(xmlContent);
        } catch (e) {
            try {
                parsed = parseNFSeXml(xmlContent);
                isService = true;
            } catch (e2) {
                 return res.status(400).json({ message: "XML armazenado é inválido ou formato desconhecido" });
            }
        }

        return res.json({
            receipt: { id },
            preview: {
              header: parsed.header,
              items: parsed.items,
              installments: parsed.installments,
              totals: parsed.header.totals,
            },
        });

      } catch (error) {
          const message = error instanceof Error ? error.message : "Erro ao processar XML existente";
          res.status(400).json({ message });
      }
  });

  app.post("/api/recebimentos/import-xml", xmlUpload.single("file"), async (req: Request, res: Response) => {
    const reqTypeRaw = String((req.body?.receiptType ?? req.query?.receiptType ?? "produto")).toLowerCase();
      const isService = reqTypeRaw === "servico";
      let parsed: ReturnType<typeof parseNFeXml> | ReturnType<typeof parseNFSeXml> | undefined;
      try {
        if (!req.file) {
          return res.status(400).json({ message: "Arquivo XML é obrigatório" });
        }
        const xmlContent = await fs.promises.readFile(req.file.path, "utf-8");

        try {
          parsed = isService ? parseNFSeXml(xmlContent) : parseNFeXml(xmlContent);
        } catch (err) {
        if (isService) {
          try {
            parseNFeXml(xmlContent);
            return res.status(400).json({ message: "XML é de NF-e; selecione o tipo Produto" });
          } catch {
            return res.status(400).json({ message: "XML inválido ou não reconhecido como NFS-e" });
          }
        } else {
          try {
            parseNFSeXml(xmlContent);
            return res.status(400).json({ message: "XML é de NFS-e; selecione o tipo Serviço" });
          } catch {
            return res.status(400).json({ message: "XML inválido ou não reconhecido como NF-e" });
          }
        }
      }
      
      if (!parsed) {
        return res.status(400).json({ message: "Erro ao processar XML" });
      }

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
          attachmentType: isService ? "recebimento_nfse_xml" : "recebimento_nf_xml",
        }).returning();
        savedAttachmentId = att?.id as any;
      } catch {}

      if (reqTypeRaw === "servico") {
        const missing: string[] = [];
        if (!parsed.header.documentNumber) missing.push("Número da nota");
        if (!parsed.header.supplier?.cnpjCpf) missing.push("CNPJ do prestador");
        if (!parsed.header.totals?.vNF) missing.push("Valor total");
        if (!Array.isArray(parsed.items) || parsed.items.length === 0) missing.push("Itens/Serviços");
        if (missing.length) {
          return res.status(400).json({ message: `XML NFS-e com campos faltantes: ${missing.join(", ")}` });
        }
      }

      const p = parsed;
      const result = await db.transaction(async (tx) => {
        const [createdReceipt] = await tx.insert(receipts).values({
          receiptNumber: generateReceiptNumber(),
          purchaseOrderId: purchaseRequestId ? undefined as any : null,
          status: "nf_pendente",
          receiptType: isService ? "servico" : "produto",
          documentNumber: p.header.documentNumber,
          documentSeries: p.header.documentSeries,
          documentKey: p.header.documentKey,
          documentIssueDate: p.header.issueDate ? new Date(p.header.issueDate) : null,
          documentEntryDate: p.header.entryDate ? new Date(p.header.entryDate) : null,
          totalAmount: (p.header.totals?.vNF || (p as any).header.totals?.vProd || "0") as any,
          installmentsCount: Array.isArray(p.installments) ? p.installments.length : null,
          createdAt: new Date(),
        } as any).returning();
        const receiptId = createdReceipt.id;
        await tx.insert(receiptNfXmls).values({
          receiptId,
          xmlContent,
          xmlHash: p.xmlHash,
        } as any);
        for (const it of p.items || []) {
          await tx.insert(receiptItems).values({
            receiptId,
            lineNumber: it.lineNumber,
            description: it.description,
            unit: it.unit,
            quantity: it.quantity as any,
            unitPrice: it.unitPrice as any,
            totalPrice: it.totalPrice as any,
            ncm: (it as any).ncm,
            cfop: (it as any).cfop,
            icmsRate: (it as any).taxes?.icmsRate as any,
            icmsAmount: (it as any).taxes?.icmsAmount as any,
            ipiRate: (it as any).taxes?.ipiRate as any,
            ipiAmount: (it as any).taxes?.ipiAmount as any,
            pisRate: (it as any).taxes?.pisRate as any,
            pisAmount: (it as any).taxes?.pisAmount ?? (it as any).taxes?.pisAmount as any,
            cofinsRate: (it as any).taxes?.cofinsRate as any,
            cofinsAmount: (it as any).taxes?.cofinsAmount as any,
            quantityReceived: (it.quantity ?? "0") as any,
            condition: "xml",
            createdAt: new Date(),
          } as any);
        }
        for (const dup of p.installments || []) {
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
          VALUES (${0}, ${isService ? 'recebimento_import_nfse' : 'recebimento_import_xml'}, ${isService ? 'Importação de XML NFS-e (prévia)' : 'Importação de XML NF-e (prévia)'}, ${null}, ${null}, ${JSON.stringify({ documentId: parsed.header.documentKey || parsed.header.documentNumber })}::jsonb, ${sql`ARRAY['receipts']`} );`);
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
      let message = error instanceof Error ? error.message : "Erro ao processar XML";
      if (message.includes("receipt_nf_xmls_xml_hash_unique") || message.includes("receipt_nf_xmls_xml_hash_key") || (message.includes("duplicate key") && message.includes("xml_hash"))) {
        message = "Esta Nota Fiscal já foi importada anteriormente no sistema.";
        // Return 200 with warning and preview so frontend can still populate data
        if (parsed) {
           return res.json({
            warning: message,
            preview: {
              header: parsed.header,
              items: parsed.items,
              installments: parsed.installments,
              totals: parsed.header.totals,
            }
          });
        }
      }
      try {
        await db.execute(sql`INSERT INTO audit_logs (purchase_request_id, action_type, action_description, performed_by, before_data, after_data, affected_tables)
          VALUES (${0}, ${'recebimento_import_xml_error'}, ${String(message)}, ${null}, ${null}, ${null}, ${sql`ARRAY['receipts']`} );`);
      } catch {}
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
    const [updated] = await db.update(receipts).set({ status: "nf_confirmada", approvedAt: new Date() }).where(eq(receipts.id, id)).returning();
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
    if (!["validado_compras", "nf_confirmada", "recebimento_confirmado", "recebimento_parcial", "erro_integracao"].includes(rec.status)) {
      return res.status(400).json({ message: "Recebimento precisa estar validado ou com erro de integração para ser enviado" });
    }

    const cfg = await configService.getLocadorConfig();
    
    try {
      const items = await db.select().from(receiptItems).where(eq(receiptItems.receiptId, id));
      const installments = await db.select().from(receiptInstallments).where(eq(receiptInstallments.receiptId, id));
      const allocations = await db.select().from(receiptAllocations).where(eq(receiptAllocations.receiptId, id));

      let purchaseOrder: any = undefined;
      if (rec.purchaseOrderId) {
        [purchaseOrder] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, rec.purchaseOrderId));
      }

      let purchaseRequest: any = undefined;
      if (purchaseOrder?.purchaseRequestId) {
        [purchaseRequest] = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, purchaseOrder.purchaseRequestId));
      }

      let companyErpId: number | undefined = undefined;
      if (purchaseRequest?.companyId) {
        const [company] = await db.select().from(companies).where(eq(companies.id, purchaseRequest.companyId));
        if (company && company.idCompanyERP != null) {
          companyErpId = Number(company.idCompanyERP);
        }
      }

      if (!cfg.sendEnabled) {
        const message = "Envio desabilitado por configuração";
        const [updated] = await db.update(receipts)
          .set({ status: "erro_integracao", integrationMessage: message })
          .where(eq(receipts.id, id))
          .returning();

        try {
          await db.execute(sql`INSERT INTO audit_logs (purchase_request_id, action_type, action_description, performed_by, before_data, after_data, affected_tables)
            VALUES (${purchaseRequest?.id || 0}, ${'recebimento_envio_bloqueado'}, ${'Envio ao ERP bloqueado por configuração'}, ${null}, ${null}, ${JSON.stringify({ receiptId: updated.id, status: updated.status })}::jsonb, ${sql`ARRAY['receipts']`} );`);
        } catch {}

        return res.json({ 
          status_integracao: "bloqueado", 
          id_recebimento_locador: null, 
          mensagem: message 
        });
      }

      let obsData: any = null;
      try {
        obsData = rec.observations ? JSON.parse(String(rec.observations)) : null;
      } catch {
        obsData = null;
      }

      const paymentMethodCode = obsData?.financial?.paymentMethodCode;
      const invoiceDueDate = obsData?.financial?.invoiceDueDate;

      const fornecedorId = rec.locadorSupplierId ? Number(rec.locadorSupplierId) : undefined;

      const payload: PurchaseReceiveRequest = {
        pedido_id: purchaseOrder?.id || 0,
        numero_pedido: purchaseOrder?.orderNumber || "",
        numero_solicitacao: purchaseRequest?.requestNumber || "",
        solicitacao_id: purchaseRequest?.id || 0,
        data_pedido: purchaseOrder?.createdAt ? new Date(purchaseOrder.createdAt).toISOString() : undefined,
        justificativa: purchaseRequest?.justification || "",
        fornecedor: {
          fornecedor_id: Number.isFinite(fornecedorId as any) ? (fornecedorId as number) : undefined,
          cnpj: undefined,
          nome: undefined,
        },
        nota_fiscal: {
          numero: rec.documentNumber || "",
          serie: rec.documentSeries || "",
          chave_nfe: rec.documentKey || "",
          data_emissao: rec.documentIssueDate ? new Date(rec.documentIssueDate).toISOString() : undefined,
          valor_total: Number(rec.totalAmount || 0),
        },
        condicoes_pagamento: {
          empresa_id: companyErpId,
          forma_pagamento: paymentMethodCode ? Number(paymentMethodCode) : undefined,
          data_vencimento: invoiceDueDate
            ? new Date(invoiceDueDate).toISOString()
            : installments[0]?.dueDate
            ? new Date(installments[0].dueDate as any).toISOString()
            : undefined,
          parcelas: installments.length || 1,
          rateio: allocations.map((a) => ({
            centro_custo_id: a.costCenterId ? Number(a.costCenterId) : undefined,
            plano_conta_id: a.chartOfAccountsId ? Number(a.chartOfAccountsId) : undefined,
            valor: Number(a.amount || 0),
            percentual: a.percentage ? Number(a.percentage) : undefined,
          })),
          parcelas_detalhes: installments.map((dup, index) => {
            const numeroParcelaRaw = dup.installmentNumber;
            const numeroParcela = numeroParcelaRaw ? Number(numeroParcelaRaw) : index + 1;
            return {
              data_vencimento: dup.dueDate ? new Date(dup.dueDate as any).toISOString() : undefined,
              valor: Number(dup.amount || 0),
              forma_pagamento: paymentMethodCode ? Number(paymentMethodCode) : undefined,
              numero_parcela: Number.isFinite(numeroParcela) ? numeroParcela : index + 1,
            };
          }),
        },
        itens: items.map((it) => ({
          codigo_produto: it.locadorProductCode || undefined,
          descricao: it.description || "",
          unidade: it.unit || "UN",
          quantidade: Number(it.quantity || 0),
          preco_unitario: Number(it.unitPrice || 0),
          ncm: it.ncm || undefined,
          cest: undefined,
        })),
      };

      await purchaseReceiveService.submit(payload);

      const [updated] = await db.update(receipts)
        .set({ status: "integrado_locador", integrationMessage: "Integrado com sucesso" })
        .where(eq(receipts.id, id))
        .returning();

      try {
        await db.execute(sql`INSERT INTO audit_logs (purchase_request_id, action_type, action_description, performed_by, before_data, after_data, affected_tables)
          VALUES (${purchaseRequest?.id || 0}, ${'recebimento_envio_locador'}, ${'Envio do recebimento ao Locador'}, ${null}, ${null}, ${JSON.stringify({ receiptId: updated.id, status: updated.status })}::jsonb, ${sql`ARRAY['receipts']`} );`);
      } catch {}

      res.json({ 
        status_integracao: "integrada", 
        id_recebimento_locador: null, // New endpoint doesn't return ID
        mensagem: "Integrado com sucesso" 
      });

    } catch (error: any) {
      console.error("Erro na integração com Locador:", error);
      const integMessage = error.message || "Erro de integração";
      
      const [updated] = await db.update(receipts)
        .set({ status: "erro_integracao", integrationMessage: integMessage })
        .where(eq(receipts.id, id))
        .returning();

      res.json({ 
        status_integracao: "erro", 
        id_recebimento_locador: null, 
        mensagem: integMessage 
      });
    }
  });

  // Endpoint to return purchase request from fiscal conference to physical receipt
  app.post("/api/requests/:id/return-to-receipt", isAuthenticated, async (req, res) => {
    try {
      const requestId = parseInt(req.params.id);
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);

      // Permissions check: Admin, Manager, Buyer or Receiver
      if (!user?.isAdmin && !user?.isReceiver && !user?.isBuyer && !user?.isManager) {
        return res.status(403).json({ message: "Sem permissão para retornar solicitação" });
      }

      await storage.returnToPhysicalReceipt(requestId, userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error returning request to receipt:", error);
      res.status(500).json({ message: error.message || "Erro ao retornar solicitação" });
    }
  });

  // New Endpoint: Undo Physical Conference
  app.post("/api/receipts/:id/undo-physical-conference", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const userId = req.session.userId!;

      const receipt = await db.query.receipts.findFirst({
        where: eq(receipts.id, id),
        with: {
          items: true
        }
      });

      if (!receipt) {
        return res.status(404).json({ message: "Recebimento não encontrado" });
      }

      // Check permissions (Receiver or Admin)
      const user = await storage.getUser(userId);
      if (!user?.isReceiver && !user?.isAdmin && !user?.isManager) {
        return res.status(403).json({ message: "Sem permissão para desfazer conferência" });
      }

      // 1. Revert quantities in purchaseOrderItems
      if (receipt.items && receipt.items.length > 0) {
        for (const item of receipt.items) {
          if (item.purchaseOrderItemId) {
             // Decrement quantityReceived
             // Using sql to ensure atomic update and handle potential nulls if any
             await db.execute(sql`
               UPDATE purchase_order_items 
               SET quantity_received = GREATEST(0, COALESCE(quantity_received, 0) - ${item.quantityReceived})
               WHERE id = ${item.purchaseOrderItemId}
             `);
          }
        }
      }

      // 2. Delete related records
      // Receipt items
      await db.delete(receiptItems).where(eq(receiptItems.receiptId, id));
      // Allocations
      await db.delete(receiptAllocations).where(eq(receiptAllocations.receiptId, id));
      // XMLs
      await db.delete(receiptNfXmls).where(eq(receiptNfXmls.receiptId, id));
      // Installments
      await db.delete(receiptInstallments).where(eq(receiptInstallments.receiptId, id));
      
      // 3. Delete the receipt itself
      await db.delete(receipts).where(eq(receipts.id, id));

      // 4. Check if any receipts remain for the PO
      let requestUpdated = false;
      let requestId = 0;
      if (receipt.purchaseOrderId) {
        const remainingReceipts = await db.select().from(receipts).where(eq(receipts.purchaseOrderId, receipt.purchaseOrderId));
        
        // Find Request ID from Order
        const order = await db.query.purchaseOrders.findFirst({
            where: eq(purchaseOrders.id, receipt.purchaseOrderId),
            columns: { purchaseRequestId: true }
        });
        requestId = order?.purchaseRequestId || 0;

        if (remainingReceipts.length === 0 && order) {
             // Revert Request Phase to 'recebimento' (Waiting for Receipt)
             // And clear physicalReceiptAt
             await db.update(purchaseRequests)
               .set({ 
                   currentPhase: "recebimento", 
                   physicalReceiptAt: null,
                   physicalReceiptById: null,
                   updatedAt: new Date()
               })
               .where(eq(purchaseRequests.id, order.purchaseRequestId));
            requestUpdated = true;
        }
      }

      // 5. Audit Log
      try {
        await db.execute(sql`INSERT INTO audit_logs (purchase_request_id, action_type, action_description, performed_by, before_data, after_data, affected_tables)
          VALUES (${requestId}, ${'desfazer_conferencia_fisica'}, ${`Desfazer conferência física e exclusão - NF ${receipt.documentNumber || receipt.receiptNumber}`}, ${userId}, ${JSON.stringify({ receiptId: id, status: receipt.status })}::jsonb, ${JSON.stringify({ deleted: true, requestPhaseReverted: requestUpdated })}::jsonb, ${sql`ARRAY['receipts', 'purchase_order_items', 'purchase_requests']`} );`);
      } catch {}

      res.json({ success: true, message: "Conferência física desfeita e registro removido com sucesso" });

    } catch (error) {
      console.error("Error undoing physical conference:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Erro ao desfazer conferência" });
    }
  });

}
