import type { Express, Request, Response } from "express";
import { auditService } from "../services/audit-service";
import { isAuthenticated, isReceiver } from "./middleware";
import { storage } from "../storage";
import multer from "multer";
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
  users,
} from "../../shared/schema";
import { notifyRequestConclusion, notifyFinancialDepartment } from "../email-service";
import { purchaseReceiveService, PurchaseReceiveRequest } from "../integracao_locador/services/purchase-receive-service";
import { parseNFeXml } from "../services/nfe-parser";
import { parseNFSeXml } from "../services/nfse-parser";
import { receiptService } from "../services/receipt-service";
import { z } from "zod";
import { eq, sql, and, like, or, desc, asc } from "drizzle-orm";
// @ts-ignore
import fetch from "node-fetch";
import { fileStorageService } from "../services/file-storage-service";
import { realtime } from "../realtime";
import { REALTIME_CHANNELS, PURCHASE_REQUEST_EVENTS, RECEIPT_EVENTS } from "../../shared/realtime-events";

import { generateReceiptNumber } from "../utils/generate-receipt-number";
import { NotFoundError, ValidationError, UnauthorizedError } from "../utils/errors";

function parseOptionalBoolean(value: any): boolean | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true" || v === "1" || v === "sim" || v === "yes") return true;
    if (v === "false" || v === "0" || v === "nao" || v === "não" || v === "no") return false;
  }
  throw new Error("INVALID_BOOLEAN");
}

const xmlUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: function (_req, file, cb) {
    const allowed = ["application/xml", "text/xml"];
    cb(null, allowed.includes(file.mimetype));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

export function registerReceiptsRoutes(app: Express) {
  app.get("/api/receipts/board", isAuthenticated, async (req: Request, res: Response) => {
    const results = await receiptService.getReceiptsBoard();
    res.json(results);
  });

  app.get("/api/receipts/pending-conference", isAuthenticated, async (req: Request, res: Response) => {
    const results = await receiptService.getPendingConference();
    res.json(results);
  });

  app.patch("/api/receipts/:id(\\d+)/update-phase", isAuthenticated, async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const { newPhase } = req.body;
    const userId = req.session.userId!;

    if (!["recebimento_fisico", "conf_fiscal", "cancelado"].includes(newPhase)) {
      throw new ValidationError("Fase inválida para atualização manual");
    }

    const [receipt] = await db.select().from(receipts).where(eq(receipts.id, id));
    if (!receipt) throw new NotFoundError("Recebimento não encontrado");

    const [updated] = await db.update(receipts)
      .set({ receiptPhase: newPhase, updatedAt: new Date() } as any)
      .where(eq(receipts.id, id))
      .returning();

    await auditService.log({
      purchaseRequestId: receipt.purchaseRequestId || 0,
      actionType: 'receipt_phase_changed',
      actionDescription: `Fase do recebimento alterada para ${newPhase}`,
      performedBy: userId,
      afterData: { receiptId: id, phase: newPhase },
      affectedTables: ['receipts']
    });

    res.json(updated);
  });

  app.delete("/api/receipts/:id(\\d+)", isAuthenticated, async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const userId = req.session.userId!;
    const result = await receiptService.deleteReceipt(id, userId);
    res.json(result);
  });

  app.post("/api/purchase-requests/:id(\\d+)/receipts", isAuthenticated, async (req: Request, res: Response) => {
    const purchaseRequestId = Number(req.params.id);
    const userId = req.session.userId!;
    const newReceipt = await receiptService.createReceiptForRequest(purchaseRequestId, userId);
    res.status(201).json(newReceipt);
  });
  app.get("/api/receipts/search", isAuthenticated, async (req: Request, res: Response) => {
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

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(receipts)
      .leftJoin(suppliers, eq(receipts.supplierId, suppliers.id))
      .where(whereClause);

    const total = Number(countResult.count);

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
  });

  app.get("/api/recebimentos/:id(\\d+)/items", isAuthenticated, async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const items = await db.select().from(receiptItems).where(eq(receiptItems.receiptId, id));
    res.json(items);
  });

  app.get("/api/receipts/request/:requestId", isAuthenticated, async (req: Request, res: Response) => {
    const requestId = Number(req.params.requestId);

    const [purchaseOrder] = await db
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.purchaseRequestId, requestId))
      .limit(1);

    if (!purchaseOrder) {
      throw new NotFoundError("Pedido de compra não encontrado");
    }

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

    const receiptsWithItems = await Promise.all(receiptsList.rows.map(async (receipt) => {
      const items = await db.select().from(receiptItems).where(eq(receiptItems.receiptId, Number(receipt.id)));

      if (typeof receipt.observations === 'string') {
        try {
          receipt.observations = JSON.parse(receipt.observations);
        } catch (e) {
        }
      }

      return { ...receipt, items };
    }));

    res.json(receiptsWithItems);
  });

  app.post("/api/recebimentos/parse-existing/:id(\\d+)", isAuthenticated, isReceiver, async (req: Request, res: Response) => {
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

  app.post("/api/recebimentos/import-xml", isAuthenticated, isReceiver, xmlUpload.single("file"), async (req: Request, res: Response) => {
    const reqTypeRaw = String((req.body?.receiptType ?? req.query?.receiptType ?? "produto")).toLowerCase();
    const isService = reqTypeRaw === "servico";
    let parsed: ReturnType<typeof parseNFeXml> | ReturnType<typeof parseNFSeXml> | undefined;

    if (!req.file) {
      throw new ValidationError("Arquivo XML é obrigatório");
    }
    const xmlContent = req.file.buffer.toString("utf-8");

    try {
      parsed = isService ? parseNFSeXml(xmlContent) : parseNFeXml(xmlContent);
    } catch (err) {
      if (isService) {
        try {
          parseNFeXml(xmlContent);
          throw new ValidationError("XML é de NF-e; selecione o tipo Produto");
        } catch (e) {
          if (e instanceof ValidationError) throw e;
          throw new ValidationError("XML inválido ou não reconhecido como NFS-e");
        }
      } else {
        try {
          parseNFSeXml(xmlContent);
          throw new ValidationError("XML é de NFS-e; selecione o tipo Serviço");
        } catch (e) {
          if (e instanceof ValidationError) throw e;
          throw new ValidationError("XML inválido ou não reconhecido como NF-e");
        }
      }
    }

    if (!parsed) {
      throw new ValidationError("Erro ao processar XML");
    }

    const prIdRaw = (req.body?.purchaseRequestId ?? req.query?.purchaseRequestId) as any;
    const purchaseRequestId = prIdRaw ? Number(prIdRaw) : undefined;
    let savedAttachmentId: number | undefined = undefined;
    try {
      const storedFile = await fileStorageService.uploadFile({
        category: "nfe-xml",
        entityId: purchaseRequestId ?? req.file.originalname,
        originalName: req.file.originalname,
        contentType: req.file.mimetype,
        buffer: req.file.buffer,
        preferredLocalName: `${req.file.fieldname}-${Date.now()}-${Math.round(Math.random() * 1e9)}${(req.file.originalname.match(/\.[^.]+$/)?.[0]) || ".xml"}`,
      });
      const [att] = await db.insert(attachments).values({
        purchaseRequestId: purchaseRequestId,
        fileName: req.file.originalname,
        filePath: storedFile.filePath,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        attachmentType: isService ? "recebimento_nfse_xml" : "recebimento_nf_xml",
      }).returning();
      savedAttachmentId = att?.id as any;
    } catch { }

    if (reqTypeRaw === "servico") {
      const missing: string[] = [];
      if (!parsed.header.documentNumber) missing.push("Número da nota");
      if (!parsed.header.supplier?.cnpjCpf) missing.push("CNPJ do prestador");
      if (!parsed.header.totals?.vNF) missing.push("Valor total");
      if (!Array.isArray(parsed.items) || parsed.items.length === 0) missing.push("Itens/Serviços");
      if (missing.length) {
        throw new ValidationError(`XML NFS-e com campos faltantes: ${missing.join(", ")}`);
      }
    }

    // Encontrar o pedido de compra associado, se houver um ID de solicitação
    let poId: number | null = null;
    if (purchaseRequestId) {
      const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.purchaseRequestId, purchaseRequestId));
      if (po) poId = po.id;
    }

    const p = parsed;
    let result;
    try {
      result = await db.transaction(async (tx) => {
        const [createdReceipt] = await tx.insert(receipts).values({
          receiptNumber: generateReceiptNumber(),
          purchaseOrderId: poId || null,
          purchaseRequestId: purchaseRequestId || null,
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
            locadorProductCode: (it as any).code,
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
    } catch (error) {
      let message = error instanceof Error ? error.message : "Erro ao processar XML";
      if (message.includes("receipt_nf_xmls_xml_hash_unique") || message.includes("receipt_nf_xmls_xml_hash_key") || (message.includes("duplicate key") && message.includes("xml_hash"))) {
        message = "Esta Nota Fiscal já foi importada anteriormente no sistema.";
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
      await auditService.log({
        actionType: 'recebimento_import_xml_error',
        actionDescription: String(message),
        performedBy: req.session?.userId,
        affectedTables: ['receipts']
      });
      throw new ValidationError(message);
    }

    await auditService.log({
      actionType: isService ? 'recebimento_import_nfse' : 'recebimento_import_xml',
      actionDescription: isService ? 'Importação de XML NFS-e (prévia)' : 'Importação de XML NF-e (prévia)',
      performedBy: req.session?.userId,
      afterData: { documentId: parsed.header.documentKey || parsed.header.documentNumber },
      affectedTables: ['receipts']
    });

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
  });

  app.get("/api/nfe/attachments", isAuthenticated, async (req: Request, res: Response) => {
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
        const content = (await fileStorageService.readFileBuffer(row.filePath)).toString("utf-8");
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
      } catch { }
    }
    res.json(result);
  });

  app.get("/api/nfe/attachments/:id/preview", isAuthenticated, async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) throw new ValidationError("ID inválido");
    const [att] = await db.select().from(attachments).where(sql`${attachments.id} = ${id} AND ${attachments.attachmentType} = 'recebimento_nf_xml'`).limit(1);
    if (!att) throw new NotFoundError("Anexo não encontrado");
    const content = (await fileStorageService.readFileBuffer(att.filePath)).toString("utf-8");
    const parsed = parseNFeXml(content);
    const preview = {
      header: parsed.header,
      items: parsed.items,
      installments: parsed.installments,
      totals: parsed.header.totals,
    };
    await auditService.log({
      purchaseRequestId: att.purchaseRequestId || 0,
      actionType: 'recebimento_preview_xml',
      actionDescription: 'Pré-visualização de XML NF-e (anexo)',
      performedBy: req.session?.userId,
      afterData: { attachmentId: att.id, documentKey: parsed.header.documentKey },
      affectedTables: ['receipts']
    });
    res.json({ preview, attachment: { id: att.id }, xmlRaw: content });
  });

  // Create draft (servico/avulso)
  app.post("/api/recebimentos", isAuthenticated, isReceiver, async (req: Request, res: Response) => {
    const payload = insertReceiptSchema.parse(req.body);
    if ((payload.receiptType === "servico" || payload.receiptType === "avulso") && (!payload.costCenterId || !payload.chartOfAccountsId)) {
      throw new ValidationError("Centro de Custo e Plano de Contas são obrigatórios");
    }
    const [created] = await db.insert(receipts).values({
      receiptNumber: generateReceiptNumber(),
      ...payload,
      status: "rascunho",
      createdAt: new Date(),
    } as any).returning();
    await auditService.log({
      actionType: 'recebimento_criar',
      actionDescription: 'Criação de recebimento',
      performedBy: req.session?.userId,
      afterData: { receiptId: created.id, type: created.receiptType },
      affectedTables: ['receipts']
    });
    res.status(201).json(created);
  });

  app.get("/api/recebimentos/:id(\\d+)", isAuthenticated, async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const [rec] = await db.select().from(receipts).where(eq(receipts.id, id));
    if (!rec) throw new NotFoundError("Recebimento não encontrado");
    res.json({ receipt: rec });
  });

  app.put("/api/recebimentos/:id(\\d+)", isAuthenticated, isReceiver, async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const updates = req.body;
    const [updated] = await db.update(receipts).set({ ...updates, updatedAt: new Date() }).where(eq(receipts.id, id)).returning();
    if (!updated) throw new NotFoundError("Recebimento não encontrado");
    res.json(updated);
  });

  app.get("/api/receipts/:id(\\d+)", isAuthenticated, async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const [rec] = await db.select().from(receipts).where(eq(receipts.id, id));

    if (!rec) throw new NotFoundError("Recebimento não encontrado");

    const items = await db.select().from(receiptItems).where(eq(receiptItems.receiptId, id));
    const installments = await db.select().from(receiptInstallments).where(eq(receiptInstallments.receiptId, id));
    const allocations = await db.select().from(receiptAllocations).where(eq(receiptAllocations.receiptId, id));

    const result = {
      ...rec,
      items,
      installments,
      allocations
    };

    res.json(result);
  });

  app.post("/api/receipts/:id(\\d+)/confirm-fiscal", isAuthenticated, isReceiver, async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const {
      paymentMethodCode,
      invoiceDueDate,
      hasInstallments,
      installmentCount,
      installments,
      allocations,
      allocationMode,
      receiptType,
      documentNumber,
      documentSeries,
      issueDate,
      totalAmount,
      emitterCnpj,
      processFiscal
    } = req.body;

    console.log("Confirmando fiscalização do recebimento:", id);

    const [rec] = await db.select().from(receipts).where(eq(receipts.id, id));
    if (!rec) throw new NotFoundError("Recebimento não encontrado");

    const effectiveReceiptType = String(receiptType || rec.receiptType || "").trim().toLowerCase();
    const items = await db.select().from(receiptItems).where(eq(receiptItems.receiptId, id));
    if (effectiveReceiptType !== "avulso" && (!items || items.length === 0)) {
      throw new ValidationError("Erro de validação: A nota fiscal não possui itens vinculados. Verifique a importação ou inclusão manual.");
    }

    // 1. Update Receipt Basic Info & Observations
    let currentObs: any = {};
    if (typeof rec.observations === 'string') {
      try {
        currentObs = JSON.parse(rec.observations);
      } catch (e) {
        currentObs = { note: rec.observations };
      }
    } else {
      currentObs = rec.observations || {};
    }

    let parsedProcessFiscal: boolean | undefined = undefined;
    try {
      parsedProcessFiscal = parseOptionalBoolean(processFiscal);
    } catch {
      throw new ValidationError("Erro de validação: processFiscal deve ser booleano (true/false).");
    }
    const effectiveProcessFiscal = parsedProcessFiscal ?? true;
    const currentErpOptions =
      (currentObs?.erpOptions && typeof currentObs.erpOptions === "object" && !Array.isArray(currentObs.erpOptions))
        ? currentObs.erpOptions
        : {};

    const newObs = {
      ...currentObs,
      financial: {
        paymentMethodCode,
        invoiceDueDate,
        hasInstallments,
        installmentCount,
        installments // Store raw installments in obs for reference
      },
      rateio: {
        mode: allocationMode,
        allocations // Store raw allocations in obs for reference
      },
      erpOptions: {
        ...currentErpOptions,
        ...(typeof parsedProcessFiscal === "boolean" ? { processFiscal: parsedProcessFiscal } : {}),
      },
      emitterCnpj // Store manually entered CNPJ if any
    };

    // Update receipt fields
    await db.update(receipts).set({
      documentNumber: documentNumber || rec.documentNumber,
      documentSeries: documentSeries || rec.documentSeries,
      documentIssueDate: issueDate ? new Date(issueDate) : rec.documentIssueDate,
      totalAmount: totalAmount ? String(totalAmount).replace(',', '.') : rec.totalAmount,
      receiptType: receiptType || rec.receiptType,
      observations: JSON.stringify(newObs)
    }).where(eq(receipts.id, id));

    // 2. Update Installments (Replace)
    await db.delete(receiptInstallments).where(eq(receiptInstallments.receiptId, id));
    if (Array.isArray(installments) && installments.length > 0) {
      for (const inst of installments) {
        await db.insert(receiptInstallments).values({
          receiptId: id,
          installmentNumber: String(inst.number || 1),
          dueDate: inst.dueDate ? new Date(inst.dueDate) : new Date(),
          amount: String(inst.amount || 0).replace(',', '.'),
          // method: inst.method // If schema has it
        } as any);
      }
    }

    // 3. Update Allocations (Replace)
    await db.delete(receiptAllocations).where(eq(receiptAllocations.receiptId, id));
    if (Array.isArray(allocations) && allocations.length > 0) {
      for (const alloc of allocations) {
        if (alloc.costCenterId || alloc.chartOfAccountsId) {
          await db.insert(receiptAllocations).values({
            receiptId: id,
            costCenterId: alloc.costCenterId ? Number(alloc.costCenterId) : null,
            chartOfAccountsId: alloc.chartOfAccountsId ? Number(alloc.chartOfAccountsId) : null,
            amount: String(alloc.amount || 0).replace(',', '.'),
            percentage: String(alloc.percentage || 0).replace(',', '.')
          } as any);
        }
      }
    }

    // 4. Check Flag and Process ERP Integration
    const cfg = await configService.getLocadorConfig();

    if (!cfg.sendEnabled) {
      // Flag DISABLED: Skip ERP, mark as conferred locally
      const message = "Integração ERP desabilitada. Conferência finalizada localmente.";

      const [updated] = await db.update(receipts)
        .set({
          status: "fiscal_conferida",
          integrationMessage: message,
          receiptPhase: "concluido", // Move to Conclusion in Flow 2
          approvedAt: new Date(),
          approvedBy: req.session?.userId || null
        } as any)
        .where(eq(receipts.id, id))
        .returning();

      // Notify Flow 2 about the phase change
      realtime.publish(REALTIME_CHANNELS.RECEIPTS, {
        event: RECEIPT_EVENTS.PHASE_CHANGED,
        payload: { id, receiptPhase: "concluido", status: "fiscal_conferida" }
      });

      // Check if all receipts for this PO are done
      if (rec.purchaseOrderId) {
        const pendingReceipts = await db.select()
          .from(receipts)
          .where(and(
            eq(receipts.purchaseOrderId, rec.purchaseOrderId),
            sql`status NOT IN ('fiscal_conferida', 'conferida', 'integrado_locador')`,
            sql`id != ${id}`
          ));

        if (pendingReceipts.length === 0) {
          const [order] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, rec.purchaseOrderId));
          if (order && order.purchaseRequestId) {
            // If all receipts are finished, move PR to conclusion
            await db.update(purchaseRequests)
              .set({ currentPhase: "conclusao_compra", updatedAt: new Date() })
              .where(eq(purchaseRequests.id, order.purchaseRequestId));

            // Notify Flow 1
            realtime.publish(REALTIME_CHANNELS.PURCHASE_REQUESTS, {
              event: PURCHASE_REQUEST_EVENTS.PHASE_CHANGED,
              payload: { id: order.purchaseRequestId, currentPhase: "conclusao_compra" }
            });
          }
        }
      }

      await auditService.log({
        actionType: 'conferencia_fiscal_local',
        actionDescription: 'Conferência fiscal finalizada (ERP desabilitado)',
        performedBy: req.session?.userId,
        afterData: { receiptId: updated.id, status: updated.status },
        affectedTables: ['receipts']
      });

      return res.json({
        success: true,
        receipt: updated,
        erp: {
          success: true,
          message: message,
          code: "SKIPPED_BY_CONFIG"
        }
      });
    }

    // Flag ENABLED: Process normal ERP integration
    // Reuse logic from 'enviar-locador' or call it internally?
    // For now, I'll replicate the core logic or call the service directly.
    // Ideally, we should refactor 'enviar-locador' to be a function, but for safety/speed I will implement the call here using the updated data.

    try {
      // Installments and Allocations are already in variables or DB, but let's use the ones we just saved/received for consistency
      // actually, let's fetch from DB to be safe they are saved
      const dbInstallments = await db.select().from(receiptInstallments).where(eq(receiptInstallments.receiptId, id));
      const dbAllocations = await db.select().from(receiptAllocations).where(eq(receiptAllocations.receiptId, id));

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

      const fornecedorIdFromReceipt = rec.locadorSupplierId ? Number(rec.locadorSupplierId) : undefined;
      const fornecedorLocalId = rec.supplierId ? Number(rec.supplierId) : purchaseOrder?.supplierId ? Number(purchaseOrder.supplierId) : undefined;
      let supplierData: any = undefined;

      if (fornecedorLocalId) {
        [supplierData] = await db.select().from(suppliers).where(eq(suppliers.id, fornecedorLocalId));
      }

      const fornecedorIdFromSupplier = supplierData?.idSupplierERP != null ? Number(supplierData.idSupplierERP) : undefined;
      const fornecedorId = Number.isFinite(fornecedorIdFromReceipt as any)
        ? (fornecedorIdFromReceipt as number)
        : Number.isFinite(fornecedorIdFromSupplier as any)
          ? (fornecedorIdFromSupplier as number)
          : undefined;

      if (!supplierData && fornecedorId) {
        [supplierData] = await db.select().from(suppliers).where(eq(suppliers.idSupplierERP, fornecedorId));
      }

      const cnpjFornecedor: string | undefined = supplierData?.cnpj || undefined;
      const nomeFornecedor: string | undefined = supplierData?.name || undefined;

      // Get PO items to fallback for product code if missing in receipt items
      const poItems = rec.purchaseOrderId ? await storage.getPurchaseOrderItems(rec.purchaseOrderId) : [];
      const poItemsMap = new Map(poItems.map(poi => [poi.id, poi.itemCode]));

      const payload: PurchaseReceiveRequest = {
        pedido_id: purchaseOrder?.id || 0,
        numero_pedido: purchaseOrder?.orderNumber || "",
        numero_solicitacao: purchaseRequest?.requestNumber || "",
        solicitacao_id: purchaseRequest?.id || 0,
        data_pedido: purchaseOrder?.createdAt ? new Date(purchaseOrder.createdAt).toISOString() : undefined,
        justificativa: purchaseRequest?.justification || "",
        processFiscal: effectiveProcessFiscal,
        fornecedor: {
          fornecedor_id: fornecedorId,
          cnpj: cnpjFornecedor,
          nome: nomeFornecedor,
        },
        nota_fiscal: {
          numero: documentNumber || rec.documentNumber || "",
          serie: documentSeries || rec.documentSeries || "",
          chave_nfe: rec.documentKey || "",
          data_emissao: (issueDate || rec.documentIssueDate) ? new Date(issueDate || rec.documentIssueDate).toISOString() : undefined,
          valor_total: (totalAmount && !isNaN(Number(String(totalAmount).replace(',', '.'))))
            ? Number(String(totalAmount).replace(',', '.'))
            : (rec.totalAmount && !isNaN(Number(rec.totalAmount)))
              ? Number(rec.totalAmount)
              : 0,
        },
        condicoes_pagamento: {
          empresa_id: companyErpId,
          forma_pagamento: paymentMethodCode ? Number(paymentMethodCode) : undefined,
          data_vencimento: invoiceDueDate
            ? new Date(invoiceDueDate).toISOString()
            : dbInstallments[0]?.dueDate
              ? new Date(dbInstallments[0].dueDate as any).toISOString()
              : undefined,
          parcelas: dbInstallments.length || 1,
          rateio: dbAllocations.map((a) => ({
            centro_custo_id: a.costCenterId ? Number(a.costCenterId) : undefined,
            plano_conta_id: a.chartOfAccountsId ? Number(a.chartOfAccountsId) : undefined,
            valor: Number(a.amount || 0),
            percentage: a.percentage ? Number(a.percentage) : undefined,
          })),
          parcelas_detalhes: dbInstallments.map((dup, index) => {
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
          codigo_produto: it.locadorProductCode || (it.purchaseOrderItemId ? poItemsMap.get(it.purchaseOrderItemId) : undefined),
          descricao: it.description || "",
          unidade: it.unit || "UN",
          quantidade: Number(it.quantity || 0),
          preco_unitario: Number(it.unitPrice || 0),
          ncm: it.ncm || undefined,
          cest: undefined,
        })),
      };

      // Call ERP
      const erpResponse = await purchaseReceiveService.submit(payload);

      if (erpResponse?.status === "erro") {
        const errorMsg = erpResponse.mensagem || "Erro retornado pelo ERP";
        const [updated] = await db.update(receipts)
          .set({
            status: "erro_integracao",
            integrationMessage: errorMsg,
            observations: JSON.stringify({
              ...newObs,
              lastErpAttempt: {
                success: false,
                time: new Date().toISOString(),
                message: errorMsg,
              },
            }),
          })
          .where(eq(receipts.id, id))
          .returning();

        return res.json({
          success: true,
          receipt: updated,
          erp: {
            success: false,
            message: errorMsg,
            code: "ERP_ERROR"
          }
        });
      }

      // Success
      const [updated] = await db.update(receipts)
        .set({
          status: "integrado_locador", // or fiscal_conferida + integrated?
          integrationMessage: "Integrado com sucesso",
          receiptPhase: "concluido", // Move to Conclusion in Flow 2
          approvedAt: new Date(),
          approvedBy: req.session?.userId || null
        } as any)
        .where(eq(receipts.id, id))
        .returning();

      // Notify Flow 2 about the phase change
      realtime.publish(REALTIME_CHANNELS.RECEIPTS, {
        event: RECEIPT_EVENTS.PHASE_CHANGED,
        payload: { id, receiptPhase: "concluido", status: "integrado_locador" }
      });

      // Check if all receipts for this PO are done (same logic as above)
      if (rec.purchaseOrderId) {
        const pendingReceipts = await db.select()
          .from(receipts)
          .where(and(
            eq(receipts.purchaseOrderId, rec.purchaseOrderId),
            sql`status NOT IN ('fiscal_conferida', 'conferida', 'integrado_locador')`,
            sql`id != ${id}`
          ));

        if (pendingReceipts.length === 0) {
          const [order] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, rec.purchaseOrderId));
          if (order && order.purchaseRequestId) {
            await db.update(purchaseRequests)
              .set({ currentPhase: "conclusao_compra", updatedAt: new Date() })
              .where(eq(purchaseRequests.id, order.purchaseRequestId));

            // Notify Flow 1 about the phase change
            realtime.publish(REALTIME_CHANNELS.PURCHASE_REQUESTS, {
              event: PURCHASE_REQUEST_EVENTS.PHASE_CHANGED,
              payload: { id: order.purchaseRequestId, currentPhase: "conclusao_compra" }
            });

            try {
              await notifyRequestConclusion(order.purchaseRequestId);
            } catch (emailError) {
              console.error("Erro ao enviar notificação de conclusão (conferência fiscal integrada ao ERP):", emailError);
            }
          }
        }
      }

      await auditService.log({
        purchaseRequestId: purchaseRequest?.id || 0,
        actionType: 'conferencia_fiscal_erp',
        actionDescription: 'Conferência fiscal finalizada (Integrado)',
        performedBy: req.session?.userId,
        afterData: { receiptId: updated.id, status: updated.status },
        affectedTables: ['receipts']
      });

      return res.json({
        success: true,
        receipt: updated,
        erp: {
          success: true,
          message: "Integrado com sucesso",
          code: "SUCCESS"
        }
      });

    } catch (error: any) {
      console.error("Erro na integração com Locador (Confirm Fiscal):", error);
      let integMessage = error?.message || "Erro de integração";

      if (error?.details) {
        const detailsStr = typeof error.details === 'string'
          ? error.details
          : JSON.stringify(error.details);
        integMessage = `${integMessage} - Detalhes: ${detailsStr.substring(0, 500)}`;
      }

      const [updated] = await db.update(receipts)
        .set({
          status: "erro_integracao",
          integrationMessage: integMessage,
          observations: JSON.stringify({
            ...newObs,
            lastErpAttempt: {
              success: false,
              time: new Date().toISOString(),
              message: integMessage,
            },
          }),
        })
        .where(eq(receipts.id, id))
        .returning();

      return res.json({
        success: true,
        receipt: updated,
        erp: {
          success: false,
          message: integMessage,
          code: "ERROR",
        },
      });
    }
  });

  app.post("/api/receipts/:id/finish-without-erp", async (req: Request, res: Response) => {
    if (!req.session?.userId) throw new UnauthorizedError("Não autenticado");

    const updated = await receiptService.finishReceiptWithoutErp(req.session.userId, Number(req.params.id));

    // Notify Flow 2
    realtime.publish(REALTIME_CHANNELS.RECEIPTS, {
      event: RECEIPT_EVENTS.PHASE_CHANGED,
      payload: { id: updated.id, receiptPhase: "concluido", status: updated.status }
    });

    // If PR was also updated, notify Flow 1
    if (updated.purchaseOrderId) {
      const [order] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, updated.purchaseOrderId));
      if (order && order.purchaseRequestId) {
        const [reqPR] = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, order.purchaseRequestId));
        if (reqPR.currentPhase === "conclusao_compra") {
          realtime.publish(REALTIME_CHANNELS.PURCHASE_REQUESTS, {
            event: PURCHASE_REQUEST_EVENTS.PHASE_CHANGED,
            payload: { id: reqPR.id, currentPhase: "conclusao_compra" }
          });
        }
      }
    }

    return res.json({ success: true, receipt: updated });
  });

  app.post("/api/receipts/:id/undo-fiscal-conference", isAuthenticated, async (req, res) => {
    const id = Number(req.params.id);
    const userId = req.session.userId!;
    const updated = await receiptService.undoFiscalConference(id, userId);
    return res.json({ success: true, receipt: updated });
  });

  app.post("/api/recebimentos/:id/validar", isAuthenticated, isReceiver, async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const [rec] = await db.select().from(receipts).where(eq(receipts.id, id));
    if (!rec) throw new NotFoundError("Recebimento não encontrado");
    if ((rec.receiptType === "servico" || rec.receiptType === "avulso") && (!rec.costCenterId || !rec.chartOfAccountsId)) {
      throw new ValidationError("Centro de Custo e Plano de Contas são obrigatórios");
    }
    if (rec.receiptType === "produto") {
      const xmlRows = await db.select().from(receiptNfXmls).where(eq(receiptNfXmls.receiptId, id));
      if (xmlRows.length === 0) throw new ValidationError("XML NF-e não associado ao recebimento");
    }
    const [updated] = await db.update(receipts).set({ status: "nf_confirmada", approvedAt: new Date() }).where(eq(receipts.id, id)).returning();
    await auditService.log({
      actionType: 'recebimento_validar',
      actionDescription: 'Validação de recebimento',
      performedBy: req.session?.userId,
      afterData: { receiptId: updated.id, status: updated.status },
      affectedTables: ['receipts']
    });
    res.json(updated);
  });

  app.post("/api/recebimentos/:id/enviar-locador", isAuthenticated, isReceiver, async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const [rec] = await db.select().from(receipts).where(eq(receipts.id, id));
    if (!rec) throw new NotFoundError("Recebimento não encontrado");
    if (!["validado_compras", "nf_confirmada", "recebimento_confirmado", "recebimento_parcial", "erro_integracao"].includes(rec.status)) {
      throw new ValidationError("Recebimento precisa estar validado ou com erro de integração para ser enviado");
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

        await auditService.log({
          purchaseRequestId: purchaseRequest?.id || 0,
          actionType: 'recebimento_envio_bloqueado',
          actionDescription: 'Envio ao ERP bloqueado por configuração',
          performedBy: req.session?.userId,
          afterData: { receiptId: updated.id, status: updated.status },
          affectedTables: ['receipts']
        });

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

      const fornecedorIdFromReceipt = rec.locadorSupplierId ? Number(rec.locadorSupplierId) : undefined;
      const fornecedorLocalId = rec.supplierId ? Number(rec.supplierId) : purchaseOrder?.supplierId ? Number(purchaseOrder.supplierId) : undefined;
      let supplierData: any = undefined;

      if (fornecedorLocalId) {
        [supplierData] = await db.select().from(suppliers).where(eq(suppliers.id, fornecedorLocalId));
      }

      const fornecedorIdFromSupplier = supplierData?.idSupplierERP != null ? Number(supplierData.idSupplierERP) : undefined;
      const fornecedorId = Number.isFinite(fornecedorIdFromReceipt as any)
        ? (fornecedorIdFromReceipt as number)
        : Number.isFinite(fornecedorIdFromSupplier as any)
          ? (fornecedorIdFromSupplier as number)
          : undefined;

      if (!supplierData && fornecedorId) {
        [supplierData] = await db.select().from(suppliers).where(eq(suppliers.idSupplierERP, fornecedorId));
      }

      // Get PO items to fallback for product code if missing in receipt items
      const poItems = rec.purchaseOrderId ? await storage.getPurchaseOrderItems(rec.purchaseOrderId) : [];
      const poItemsMap = new Map(poItems.map(poi => [poi.id, poi.itemCode]));

      const payload: PurchaseReceiveRequest = {
        pedido_id: purchaseOrder?.id || 0,
        numero_pedido: purchaseOrder?.orderNumber || "",
        numero_solicitacao: purchaseRequest?.requestNumber || "",
        solicitacao_id: purchaseRequest?.id || 0,
        data_pedido: purchaseOrder?.createdAt ? new Date(purchaseOrder.createdAt).toISOString() : undefined,
        justificativa: purchaseRequest?.justification || "",
        fornecedor: {
          fornecedor_id: Number.isFinite(fornecedorId as any) ? (fornecedorId as number) : undefined,
          cnpj: supplierData?.cnpj || undefined,
          nome: supplierData?.name || undefined,
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
          codigo_produto: it.locadorProductCode || (it.purchaseOrderItemId ? poItemsMap.get(it.purchaseOrderItemId) : undefined),
          descricao: it.description || "",
          unidade: it.unit || "UN",
          quantidade: Number(it.quantity || 0),
          preco_unitario: Number(it.unitPrice || 0),
          ncm: it.ncm || undefined,
          cest: undefined,
        })),
      };

      // Call ERP
      const erpResponse = await purchaseReceiveService.submit(payload);

      if (erpResponse?.status === "erro") {
        const errorMsg = erpResponse.mensagem || "Erro retornado pelo ERP";
        const [updated] = await db.update(receipts)
          .set({ status: "erro_integracao", integrationMessage: errorMsg })
          .where(eq(receipts.id, id))
          .returning();

        return res.json({
          status_integracao: "erro",
          id_recebimento_locador: null,
          mensagem: errorMsg
        });
      }

      const [updated] = await db.update(receipts)
        .set({
          status: "integrado_locador",
          integrationMessage: "Integrado com sucesso",
          receiptPhase: "concluido" // Conclude in Flow 2
        } as any)
        .where(eq(receipts.id, id))
        .returning();

      // Notify Flow 2 about the phase change
      realtime.publish(REALTIME_CHANNELS.RECEIPTS, {
        event: RECEIPT_EVENTS.PHASE_CHANGED,
        payload: { id, receiptPhase: "concluido", status: "integrado_locador" }
      });

      // Check if all receipts for this PO are done
      if (rec.purchaseOrderId) {
        const pendingReceipts = await db.select()
          .from(receipts)
          .where(and(
            eq(receipts.purchaseOrderId, rec.purchaseOrderId),
            sql`status NOT IN ('fiscal_conferida', 'conferida', 'integrado_locador')`,
            sql`id != ${id}`
          ));

        if (pendingReceipts.length === 0) {
          const [order] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, rec.purchaseOrderId));
          if (order && order.purchaseRequestId) {
            // If all receipts are finished, move PR to conclusion
            await db.update(purchaseRequests)
              .set({ currentPhase: "conclusao_compra", updatedAt: new Date() })
              .where(eq(purchaseRequests.id, order.purchaseRequestId));

            // Notify Flow 1
            realtime.publish(REALTIME_CHANNELS.PURCHASE_REQUESTS, {
              event: PURCHASE_REQUEST_EVENTS.PHASE_CHANGED,
              payload: { id: order.purchaseRequestId, currentPhase: "conclusao_compra" }
            });
          }
        }
      }

      await auditService.log({
        purchaseRequestId: purchaseRequest?.id || 0,
        actionType: 'recebimento_envio_locador',
        actionDescription: 'Envio do recebimento ao Locador',
        performedBy: req.session?.userId,
        afterData: { receiptId: updated.id, status: updated.status },
        affectedTables: ['receipts']
      });

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

  app.post("/api/requests/:id(\\d+)/return-to-receipt", isAuthenticated, async (req, res) => {
    const requestId = parseInt(req.params.id);
    const userId = req.session.userId!;
    const result = await receiptService.returnToPhysicalReceipt(requestId, userId);
    res.json(result);
  });

  app.post("/api/receipts/:id(\\d+)/undo-physical-conference", isAuthenticated, async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const userId = req.session.userId!;
    const result = await receiptService.undoPhysicalConference(id, userId);
    res.json(result);
  });


  app.get("/api/purchase-orders/:id/receipts", isAuthenticated, async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const receiptsList = await storage.getReceiptsByPurchaseOrderId(id);

    const enriched = await Promise.all(
      receiptsList.map(async (rec: any) => {
        const items = await db
          .select()
          .from(receiptItems)
          .where(eq(receiptItems.receiptId, rec.id));

        const mappedItems = items.map(item => ({
          ...item,
          requestedQuantity: item.quantity
        }));

        let receivedByName = String(rec.receivedBy);

        if (rec.receivedBy) {
          try {
            const user = await storage.getUser(rec.receivedBy);
            if (user) {
              receivedByName =
                (user.firstName && user.lastName
                  ? `${user.firstName} ${user.lastName}`.trim()
                  : user.firstName) ||
                user.username ||
                String(rec.receivedBy);
            }
          } catch {
          }
        }

        return {
          ...rec,
          items: mappedItems,
          approval_date: rec.approvedAt,
          receivedByName,
        };
      }),
    );

    res.json(enriched);
  });

  // New Endpoint: Confirm Physical Receipt
  app.post(
    "/api/purchase-requests/:id/confirm-physical",
    isAuthenticated,
    isReceiver,
    async (req, res) => {
      const id = parseInt(req.params.id);
      const userId = req.session.userId!;
      const result = await receiptService.confirmPhysical(id, userId, req.body);
      res.json(result);
    });

  // Confirm Fiscal Receipt
  app.post(
    "/api/purchase-requests/:id/confirm-fiscal",
    isAuthenticated,
    isReceiver,
    async (req, res) => {
      const id = parseInt(req.params.id);
      const userId = req.session.userId!;
      const { observations } = req.body;

      const request = await storage.getPurchaseRequestById(id);
      if (!request) throw new NotFoundError("Solicitação não encontrada");

      await db.update(purchaseRequests)
        .set({
          fiscalReceiptAt: new Date(),
          fiscalReceiptById: userId,
          currentPhase: "conclusao_compra"
        })
        .where(eq(purchaseRequests.id, id));

      try {
        await notifyRequestConclusion(id);
      } catch (emailError) {
        console.error("Erro ao enviar notificação de conclusão (confirm-fiscal):", emailError);
      }

      await auditService.log({
        purchaseRequestId: id,
        actionType: "conferencia_fiscal",
        actionDescription: "Conferência fiscal realizada",
        performedBy: userId,
        afterData: { observations },
        affectedTables: ['purchase_requests']
      });

      res.json({ success: true });
    }
  );

  // New Endpoint: Finalize Receipt (Move to Conclusion)
  app.post(
    "/api/purchase-requests/:id/finalize-receipt",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const id = parseInt(req.params.id);
      const request = await storage.getPurchaseRequestById(id);
      
      if (!request?.physicalReceiptAt || !request?.fiscalReceiptAt) {
         throw new ValidationError("É necessário concluir as etapas Física e Fiscal antes de finalizar.");
      }

      await storage.updatePurchaseRequest(id, {
        currentPhase: "conclusao_compra",
        receivedDate: new Date(),
        receivedById: req.session.userId
      });

      try {
        await notifyRequestConclusion(id);
      } catch (emailError) {
        console.error("Erro ao enviar notificação de conclusão (finalizar recebimento):", emailError);
      }

      res.json({ success: true });
    }
  );

  app.post(
    "/api/purchase-requests/:id/confirm-receipt",
    isAuthenticated,
    isReceiver,
    async (req: Request, res: Response) => {
      const id = parseInt(req.params.id);
      const { receivedById, receiptMode, paymentMethodCode, invoiceDueDate, nfNumber, nfSeries, nfIssueDate, nfEntryDate, nfTotal, manualCostCenterId, manualChartOfAccountsId, manualItems, allocations: rawAllocations, allocationMode, finalStatus } = req.body;

      const request = await storage.getPurchaseRequestById(id);
      if (!request || request.currentPhase !== "recebimento") {
        throw new ValidationError("Request must be in the receiving phase");
      }

      const purchaseOrder = await storage.getPurchaseOrderByRequestId(id);
      if (!purchaseOrder) {
        throw new NotFoundError("Pedido de compra não encontrado para a solicitação");
      }

      if (receiptMode !== "avulso") {
        const receiptsList = await storage.getReceiptsByPurchaseOrderId(purchaseOrder.id);
        const confirmedReceipt = receiptsList.find((rec) =>
          ["nf_confirmada", "recebimento_confirmado", "recebimento_parcial", "validado_compras"].includes(rec.status),
        );
        if (!confirmedReceipt) {
          throw new ValidationError("Necessário cadastro prévio da NF para confirmar o recebimento.");
        }
      }

      const receipt = await storage.createReceipt({
        purchaseOrderId: purchaseOrder.id,
        status: finalStatus ? "recebimento_confirmado" : "recebimento_parcial",
        receivedBy: receivedById,
        receivedAt: new Date(),
        observations: JSON.stringify({
          mode: receiptMode,
          financial: { paymentMethodCode: paymentMethodCode || null, invoiceDueDate: invoiceDueDate || null },
          nf: { number: nfNumber, series: nfSeries, issueDate: nfIssueDate, entryDate: nfEntryDate, total: nfTotal },
          accounting: { costCenterId: manualCostCenterId, chartOfAccountsId: manualChartOfAccountsId },
          itemsCount: Array.isArray(manualItems) ? manualItems.length : 0,
          rateio: { mode: allocationMode || null }
        }),
      } as any);

      const receivedQuantities: Record<number, number> | undefined = (req.body as any).receivedQuantities;
      if (receiptMode !== "avulso" && receivedQuantities && typeof receivedQuantities === "object") {
        const poItems = await storage.getPurchaseOrderItems(purchaseOrder.id);
        for (const it of poItems) {
          const qty = Number(receivedQuantities[it.id] || 0);
          if (qty > 0) {
            const current = Number(it.quantityReceived || 0);
            await db.update(purchaseOrderItems)
              .set({ quantityReceived: String(current + qty) })
              .where(eq(purchaseOrderItems.id, it.id));
            
            await db.insert(receiptItems).values({
              receiptId: receipt.id,
              purchaseOrderItemId: it.id,
              quantity: String(qty),
              unitPrice: it.unitPrice,
              totalPrice: String(qty * Number(it.unitPrice)),
              createdAt: new Date(),
            } as any);
          }
        }
      }

      await storage.updatePurchaseRequest(id, {
        currentPhase: finalStatus ? "conclusao_compra" : "recebimento",
        receivedById: receivedById,
        receivedDate: new Date(),
      });

      res.json(receipt);
    }
  );
}
