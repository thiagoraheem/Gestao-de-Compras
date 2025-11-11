import { z } from "zod";
import {
  insertSupplierSchema,
  suppliers,
  supplierIntegrationItems,
  type InsertSupplier,
  type SupplierIntegrationItem,
  type SupplierIntegrationRun,
} from "@shared/schema";
import { db } from "../db";
import {
  createSupplierIntegrationRun,
  updateSupplierIntegrationRun,
  insertSupplierIntegrationItems,
  getSupplierIntegrationItems,
  getSupplierIntegrationItemsByIds,
  getSupplierIntegrationRun,
  listSupplierIntegrationRuns,
} from "../repositories/supplier-integration-repository";
import {
  erpService,
  type ERPSupplier,
  type SupplierFetchResult,
} from "../erp-service";
import { validateCNPJ } from "../cnpj-validator";
import { validateCPF } from "../cpf-validator";
import { and, eq, notInArray } from "drizzle-orm";

type SupplierSnapshot = {
  id: number;
  name: string;
  cnpj: string | null;
  cpf: string | null;
  contact: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  paymentTerms: string | null;
  idSupplierERP: number | null;
};

type IntegrationAction = "create" | "update" | "review";

type MatchType = "idsuppliererp" | "cnpj" | "cpf" | "none";

type IntegrationDifference = {
  erp: string | null;
  local: string | null;
};

type IntegrationItemPayload = {
  erp: ERPSupplier;
  local?: SupplierSnapshot | null;
  insertData?: InsertSupplier;
  updateData?: { id: number; changes: Partial<InsertSupplier> };
  createdSupplierId?: number;
  appliedAt?: string;
  failureMessage?: string;
};

type PreparedIntegrationItem = {
  erpId: string;
  erpName: string;
  erpDocument: string | null;
  action: IntegrationAction;
  matchType: MatchType;
  status: SupplierIntegrationItem["status"];
  selected: boolean;
  localSupplierId: number | null;
  payload: IntegrationItemPayload;
  differences: Record<string, IntegrationDifference> | null;
  issues: string[] | null;
};

type SupplierIntegrationSummary = {
  totalFromErp: number;
  actionable: number;
  create: number;
  update: number;
  invalid: number;
  ignored: number;
};

type IntegrationStatusCounters = {
  pending: number;
  applied: number;
  failed: number;
  skipped: number;
  invalid: number;
  cancelled: number;
};

type StartIntegrationParams = {
  userId: number;
  search?: string;
  limit?: number;
};

type ApplyIntegrationParams = {
  runId: number;
  userId: number;
  itemIds?: number[];
};

type CancelIntegrationParams = {
  runId: number;
  userId: number;
};

type IntegrationRunResponse = {
  run: SupplierIntegrationRun;
  items: SupplierIntegrationItemDTO[];
  summary: SupplierIntegrationSummary & { statusCounters: IntegrationStatusCounters };
};

type SupplierIntegrationItemDTO = SupplierIntegrationItem & {
  payload: IntegrationItemPayload;
  differences: Record<string, IntegrationDifference>;
  issues: string[];
};

const insertSupplierSafeSchema = insertSupplierSchema;

const sanitizeDocument = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  if (value == "00.000.000/0000-00") return undefined;
  if (value == "000.000.000-00") return undefined;
  const digits = value.replace(/\D+/g, "");
  return digits.length ? digits : undefined;
};

const hasValue = (value?: string | null): boolean =>
  value !== null && value !== undefined && value !== "";

const differenceFields: Array<keyof Pick<InsertSupplier, "name" | "contact" | "email" | "phone" | "address" | "paymentTerms">> = [
  "name",
  "contact",
  "email",
  "phone",
  "address",
  "paymentTerms",
];

const integrationIssuesSchema = z.array(z.string()).optional().default([]);

function toDto(item: SupplierIntegrationItem): SupplierIntegrationItemDTO {
  const payload = (item.payload ?? {}) as IntegrationItemPayload;
  const differences = (item.differences ?? {}) as Record<string, IntegrationDifference>;
  const issues = Array.isArray(item.issues)
    ? (item.issues as unknown[]).map(String)
    : [];

  return {
    ...item,
    payload,
    differences,
    issues,
  };
}

export class SupplierIntegrationService {
  async startIntegration(
    params: StartIntegrationParams,
  ): Promise<IntegrationRunResponse> {
    const run = await createSupplierIntegrationRun({
      status: "running",
      createdBy: params.userId,
      totalSuppliers: 0,
      processedSuppliers: 0,
      createdSuppliers: 0,
      updatedSuppliers: 0,
      ignoredSuppliers: 0,
      invalidSuppliers: 0,
      metadata: {
        search: params.search ?? null,
        limit: params.limit ?? null,
        startedAt: new Date().toISOString(),
      },
    });

    try {
      const erpResult = await erpService.fetchSuppliers({
        search: params.search,
        limit: params.limit,
      });

      const { items: preparedItems, summary } = await this.buildIntegrationDraft(
        erpResult,
      );

      const itemsToInsert = preparedItems.map((item) => ({
        runId: run.id,
        erpId: item.erpId,
        erpDocument: item.erpDocument,
        erpName: item.erpName,
        action: item.action,
        matchType: item.matchType,
        status: item.status,
        selected: item.selected,
        localSupplierId: item.localSupplierId,
        payload: item.payload,
        differences: item.differences,
        issues: item.issues,
      }));

      await insertSupplierIntegrationItems(itemsToInsert);

      const updatedRun =
        (await updateSupplierIntegrationRun(run.id, {
          status: "ready",
          totalSuppliers: summary.totalFromErp,
          processedSuppliers: summary.actionable,
          createdSuppliers: summary.create,
          updatedSuppliers: summary.update,
          ignoredSuppliers: summary.ignored,
          invalidSuppliers: summary.invalid,
          message:
            summary.create + summary.update > 0
              ? "Fornecedores prontos para integração"
              : "Nenhum fornecedor requer integração",
          metadata: {
            ...(run.metadata ?? {}),
            summary,
            totalFetched: summary.totalFromErp,
            generatedAt: new Date().toISOString(),
          },
        })) ?? run;

      const storedItems = await getSupplierIntegrationItems(run.id);
      const normalizedItems = storedItems.map(toDto);
      const statusCounters = this.computeStatusCounters(normalizedItems);

      return {
        run: updatedRun,
        items: normalizedItems,
        summary: {
          ...summary,
          statusCounters,
        },
      };
    } catch (error) {
      await updateSupplierIntegrationRun(run.id, {
        status: "failed",
        finishedAt: new Date(),
        message:
          error instanceof Error
            ? error.message
            : "Falha ao carregar fornecedores do ERP",
        metadata: {
          ...(run.metadata ?? {}),
          failedAt: new Date().toISOString(),
          error: error instanceof Error ? error.message : "unknown",
        },
      });
      throw error;
    }
  }

  async getRunDetails(runId: number): Promise<IntegrationRunResponse> {
    const run = await getSupplierIntegrationRun(runId);
    if (!run) {
      throw new Error("Integração não encontrada");
    }

    const items = await getSupplierIntegrationItems(runId);
    const normalizedItems = items.map(toDto);
    const summary = this.buildSummaryFromRun(run, normalizedItems);

    return {
      run,
      items: normalizedItems,
      summary,
    };
  }

  async listHistory(limit = 20): Promise<IntegrationRunResponse[]> {
    const runs = await listSupplierIntegrationRuns(limit);
    const responses: IntegrationRunResponse[] = [];

    for (const run of runs) {
      const items = await getSupplierIntegrationItems(run.id);
      const normalized = items.map(toDto);
      responses.push({
        run,
        items: normalized,
        summary: this.buildSummaryFromRun(run, normalized),
      });
    }

    return responses;
  }

  async applyIntegration(
    params: ApplyIntegrationParams,
  ): Promise<IntegrationRunResponse> {
    const run = await getSupplierIntegrationRun(params.runId);
    if (!run) {
      throw new Error("Integração não encontrada");
    }

    if (run.status === "cancelled") {
      throw new Error("Integração já foi cancelada");
    }

    if (run.status === "completed") {
      throw new Error("Integração já foi concluída");
    }

    if (run.status === "failed" && !params.itemIds?.length) {
      throw new Error(
        "Integração em estado de falha. Selecione os itens a serem processados novamente.",
      );
    }

    const itemsToProcess = params.itemIds?.length
      ? await getSupplierIntegrationItemsByIds(run.id, params.itemIds)
      : await getSupplierIntegrationItems(run.id);

    if (!itemsToProcess.length) {
      throw new Error("Nenhum item selecionado para processamento");
    }

    const actionableItems = itemsToProcess.filter(
      (item) =>
        item.selected &&
        item.status === "pending" &&
        (item.action === "create" || item.action === "update"),
    );

    if (!actionableItems.length) {
      throw new Error("Nenhum item pendente selecionado para processamento");
    }

    const selectedIds = actionableItems.map((item) => item.id);

    if (params.itemIds?.length) {
      await db
        .update(supplierIntegrationItems)
        .set({ status: "skipped", selected: false })
        .where(
          and(
            eq(supplierIntegrationItems.runId, run.id),
            notInArray(supplierIntegrationItems.id, selectedIds),
            eq(supplierIntegrationItems.status, "pending"),
          ),
        );
    }

    const result = await db.transaction(async (tx) => {
      let createdCount = 0;
      let updatedCount = 0;
      let failedCount = 0;

      for (const item of actionableItems) {
        const payload = (item.payload ?? {}) as IntegrationItemPayload;
        const erpId = Number.parseInt(item.erpId, 10);

        if (item.action === "create") {
          try {
            if (!payload.insertData) {
              throw new Error("Dados de criação não disponíveis");
            }

            const insertData = payload.insertData;

            // Validar documentos
            if (insertData.cnpj && !validateCNPJ(insertData.cnpj)) {
              throw new Error("CNPJ inválido");
            }
            if (insertData.cpf && !validateCPF(insertData.cpf)) {
              throw new Error("CPF inválido");
            }

            const [created] = await tx
              .insert(suppliers)
              .values(insertData)
              .returning({ id: suppliers.id });

            await tx
              .update(supplierIntegrationItems)
              .set({
                status: "applied",
                localSupplierId: created.id,
                selected: false,
                payload: {
                  ...payload,
                  createdSupplierId: created.id,
                  appliedAt: new Date().toISOString(),
                },
              })
              .where(eq(supplierIntegrationItems.id, item.id));

            createdCount += 1;
          } catch (error) {
            failedCount += 1;
            await tx
              .update(supplierIntegrationItems)
              .set({
                status: "failed",
                selected: false,
                issues: integrationIssuesSchema.parse([
                  error instanceof Error
                    ? error.message
                    : "Falha ao criar fornecedor",
                ]),
                payload: {
                  ...payload,
                  failureMessage:
                    error instanceof Error ? error.message : "Erro desconhecido",
                },
              })
              .where(eq(supplierIntegrationItems.id, item.id));
          }
        } else if (item.action === "update") {
          try {
            const targetId = item.localSupplierId ?? payload.local?.id;
            if (!targetId) {
              throw new Error("Fornecedor local não encontrado para atualização");
            }

            await tx
              .update(suppliers)
              .set({ idSupplierERP: erpId })
              .where(eq(suppliers.id, targetId));

            await tx
              .update(supplierIntegrationItems)
              .set({
                status: "applied",
                localSupplierId: targetId,
                selected: false,
                payload: {
                  ...payload,
                  appliedAt: new Date().toISOString(),
                },
              })
              .where(eq(supplierIntegrationItems.id, item.id));

            updatedCount += 1;
          } catch (error) {
            failedCount += 1;
            await tx
              .update(supplierIntegrationItems)
              .set({
                status: "failed",
                selected: false,
                issues: integrationIssuesSchema.parse([
                  error instanceof Error
                    ? error.message
                    : "Falha ao atualizar fornecedor",
                ]),
                payload: {
                  ...payload,
                  failureMessage:
                    error instanceof Error ? error.message : "Erro desconhecido",
                },
              })
              .where(eq(supplierIntegrationItems.id, item.id));
          }
        }
      }

      return {
        createdCount,
        updatedCount,
        failedCount,
      };
    });

    const newStatus =
      result.failedCount > 0 && result.createdCount + result.updatedCount === 0
        ? "failed"
        : "completed";

    const updatedRun =
      (await updateSupplierIntegrationRun(run.id, {
        status: newStatus,
        processedSuppliers: result.createdCount + result.updatedCount,
        createdSuppliers: result.createdCount,
        updatedSuppliers: result.updatedCount,
        finishedAt: new Date(),
        message:
          result.failedCount > 0
            ? `Integração concluída com ${result.failedCount} falha(s)`
            : "Integração concluída com sucesso",
        metadata: {
          ...(run.metadata ?? {}),
          appliedAt: new Date().toISOString(),
          appliedBy: params.userId,
          lastResult: result,
        },
      })) ?? run;

    const items = await getSupplierIntegrationItems(run.id);
    const normalized = items.map(toDto);
    const summary = this.buildSummaryFromRun(updatedRun, normalized);

    return {
      run: updatedRun,
      items: normalized,
      summary,
    };
  }

  async cancelIntegration(
    params: CancelIntegrationParams,
  ): Promise<IntegrationRunResponse> {
    const run = await getSupplierIntegrationRun(params.runId);
    if (!run) {
      throw new Error("Integração não encontrada");
    }

    if (run.status === "completed") {
      throw new Error("Integração já concluída não pode ser cancelada");
    }

    await db
      .update(supplierIntegrationItems)
      .set({ status: "cancelled", selected: false })
      .where(eq(supplierIntegrationItems.runId, run.id));

    const updatedRun =
      (await updateSupplierIntegrationRun(run.id, {
        status: "cancelled",
        finishedAt: new Date(),
        message: "Processo cancelado pelo usuário",
        cancelledBy: params.userId,
        metadata: {
          ...(run.metadata ?? {}),
          cancelledAt: new Date().toISOString(),
          cancelledBy: params.userId,
        },
      })) ?? run;

    const items = await getSupplierIntegrationItems(run.id);
    const normalized = items.map(toDto);
    const summary = this.buildSummaryFromRun(updatedRun, normalized);

    return {
      run: updatedRun,
      items: normalized,
      summary,
    };
  }

  private async buildIntegrationDraft(
    erpResult: SupplierFetchResult,
  ): Promise<{
    items: PreparedIntegrationItem[];
    summary: SupplierIntegrationSummary;
  }> {
    const snapshot = await this.loadSupplierSnapshot();
    const byErpId = new Map<number, SupplierSnapshot>();
    const byCnpj = new Map<string, SupplierSnapshot>();
    const byCpf = new Map<string, SupplierSnapshot>();

    for (const supplier of snapshot) {
      if (supplier.idSupplierERP) {
        byErpId.set(supplier.idSupplierERP, supplier);
      }
      const cnpjDigits = sanitizeDocument(supplier.cnpj);
      if (cnpjDigits) {
        byCnpj.set(cnpjDigits, supplier);
      }
      const cpfDigits = sanitizeDocument(supplier.cpf);
      if (cpfDigits) {
        byCpf.set(cpfDigits, supplier);
      }
    }

    const summary: SupplierIntegrationSummary = {
      totalFromErp: erpResult.total,
      actionable: 0,
      create: 0,
      update: 0,
      invalid: 0,
      ignored: 0,
    };

    const items: PreparedIntegrationItem[] = [];

    for (const supplier of erpResult.suppliers) {
      const erpId = supplier.id;
      const existingById = byErpId.get(erpId);
      if (existingById) {
        summary.ignored += 1;
        continue;
      }

      const issues: string[] = [];
      if (!hasValue(supplier.name)) {
        issues.push("Nome do fornecedor não informado pelo ERP");
      }
      if (!supplier.cnpj && !supplier.cpf) {
        issues.push("CNPJ ou CPF não informado pelo ERP");
      }

      let matchType: MatchType = "none";
      let localMatch: SupplierSnapshot | undefined;

      if (supplier.cnpj) {
        localMatch = byCnpj.get(supplier.cnpj);
        if (localMatch) {
          matchType = "cnpj";
        }
      }
      if (!localMatch && supplier.cpf) {
        localMatch = byCpf.get(supplier.cpf);
        if (localMatch) {
          matchType = "cpf";
        }
      }

      if (localMatch) {
        summary.actionable += 1;
        summary.update += 1;

        const differences = this.computeDifferences(supplier, localMatch);

        items.push({
          erpId: String(erpId),
          erpName: supplier.name,
          erpDocument: supplier.document ?? supplier.cnpj ?? supplier.cpf ?? null,
          action: "update",
          matchType,
          status: "pending",
          selected: true,
          localSupplierId: localMatch.id,
          payload: {
            erp: supplier,
            local: localMatch,
            updateData: { id: localMatch.id, changes: { idSupplierERP: erpId } },
          },
          differences,
          issues: issues.length ? issues : null,
        });
        continue;
      }

      if (issues.length) {
        summary.actionable += 1;
        summary.invalid += 1;
        items.push({
          erpId: String(erpId),
          erpName: supplier.name,
          erpDocument: supplier.document ?? supplier.cnpj ?? supplier.cpf ?? null,
          action: "review",
          matchType: "none",
          status: "invalid",
          selected: false,
          localSupplierId: null,
          payload: { erp: supplier },
          differences: null,
          issues,
        });
        continue;
      }

      const insertCandidate = this.buildInsertData(supplier);
      if (!insertCandidate.success) {
        summary.actionable += 1;
        summary.invalid += 1;
        items.push({
          erpId: String(erpId),
          erpName: supplier.name,
          erpDocument: supplier.document ?? supplier.cnpj ?? supplier.cpf ?? null,
          action: "review",
          matchType: "none",
          status: "invalid",
          selected: false,
          localSupplierId: null,
          payload: { erp: supplier },
          differences: null,
          issues: insertCandidate.issues,
        });
        continue;
      }

      summary.actionable += 1;
      summary.create += 1;

      items.push({
        erpId: String(erpId),
        erpName: supplier.name,
        erpDocument: supplier.document ?? supplier.cnpj ?? supplier.cpf ?? null,
        action: "create",
        matchType: "none",
        status: "pending",
        selected: true,
        localSupplierId: null,
        payload: {
          erp: supplier,
          insertData: insertCandidate.data,
        },
        differences: null,
        issues: null,
      });
    }

    return { items, summary };
  }

  private computeDifferences(
    erpSupplier: ERPSupplier,
    local: SupplierSnapshot,
  ): Record<string, IntegrationDifference> {
    const differences: Record<string, IntegrationDifference> = {};

    const candidate: InsertSupplier = {
      name: erpSupplier.name,
      contact: erpSupplier.contact ?? undefined,
      email: erpSupplier.email ?? undefined,
      phone: erpSupplier.phone ?? undefined,
      address: erpSupplier.address ?? undefined,
      paymentTerms: erpSupplier.paymentTerms ?? undefined,
      type: erpSupplier.cnpj ? 0 : 2,
      cnpj: erpSupplier.cnpj ?? undefined,
      cpf: erpSupplier.cpf ?? undefined,
      idSupplierERP: erpSupplier.id,
    } as InsertSupplier;

    for (const field of differenceFields) {
      const erpValue = hasValue(candidate[field])
        ? String(candidate[field])
        : null;
      const localValue = hasValue(local[field]) ? String(local[field]) : null;
      if (erpValue !== localValue) {
        differences[field] = { erp: erpValue, local: localValue };
      }
    }

    return differences;
  }

  private buildInsertData(
    supplier: ERPSupplier,
  ): { success: true; data: InsertSupplier } | { success: false; issues: string[] } {
    const issues: string[] = [];
    const sanitizedCnpj = supplier.cnpj;
    const sanitizedCpf = supplier.cpf;

    if (sanitizedCnpj && !validateCNPJ(sanitizedCnpj)) {
      issues.push("CNPJ inválido informado pelo ERP");
    }

    if (sanitizedCpf && !validateCPF(sanitizedCpf)) {
      issues.push("CPF inválido informado pelo ERP");
    }

    const type = sanitizedCnpj ? 0 : sanitizedCpf ? 2 : 0;

    const candidate: InsertSupplier = {
      name: supplier.name,
      type,
      cnpj: sanitizedCnpj ?? undefined,
      cpf: sanitizedCpf ?? undefined,
      contact: supplier.contact ?? undefined,
      email: supplier.email ?? undefined,
      phone: supplier.phone ?? undefined,
      address: supplier.address ?? undefined,
      paymentTerms: supplier.paymentTerms ?? undefined,
      idSupplierERP: supplier.id,
    } as InsertSupplier;

    try {
      const parsed = insertSupplierSafeSchema.parse(candidate);
      return { success: true, data: parsed };
    } catch (error) {
      if (error instanceof z.ZodError) {
        issues.push(
          error.issues[0]?.message ?? "Dados obrigatórios do fornecedor ausentes",
        );
      } else {
        issues.push("Erro inesperado ao validar dados do fornecedor");
      }
    }

    return { success: false, issues };
  }

  private async loadSupplierSnapshot(): Promise<SupplierSnapshot[]> {
    return db
      .select({
        id: suppliers.id,
        name: suppliers.name,
        cnpj: suppliers.cnpj,
        cpf: suppliers.cpf,
        contact: suppliers.contact,
        email: suppliers.email,
        phone: suppliers.phone,
        address: suppliers.address,
        paymentTerms: suppliers.paymentTerms,
        idSupplierERP: suppliers.idSupplierERP,
      })
      .from(suppliers);
  }

  private computeStatusCounters(
    items: SupplierIntegrationItemDTO[],
  ): IntegrationStatusCounters {
    const counters: IntegrationStatusCounters = {
      pending: 0,
      applied: 0,
      failed: 0,
      skipped: 0,
      invalid: 0,
      cancelled: 0,
    };

    for (const item of items) {
      if (item.status in counters) {
        counters[item.status as keyof IntegrationStatusCounters] += 1;
      }
    }

    return counters;
  }

  private buildSummaryFromRun(
    run: SupplierIntegrationRun,
    items: SupplierIntegrationItemDTO[],
  ): SupplierIntegrationSummary & { statusCounters: IntegrationStatusCounters } {
    const counters = this.computeStatusCounters(items);

    return {
      totalFromErp: run.totalSuppliers,
      actionable: run.processedSuppliers,
      create: run.createdSuppliers,
      update: run.updatedSuppliers,
      invalid: run.invalidSuppliers,
      ignored: run.ignoredSuppliers,
      statusCounters: counters,
    };
  }
}

export const supplierIntegrationService = new SupplierIntegrationService();
