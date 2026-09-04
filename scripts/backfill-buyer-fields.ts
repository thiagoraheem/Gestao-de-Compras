/**
 * =============================================================
 * SCRIPT: BACKFILL DOS CAMPOS DO COMPRADOR NOS PEDIDOS DE COMPRA
 * =============================================================
 * Preenche buyer_name, buyer_phone e buyer_email de todos os
 * purchase_orders existentes a partir de:
 *   1) createdBy -> users (usuário que CRIOU o PO - preferencial)
 *   2) purchase_requests.requesterId -> users (fallback p/POs antigos)
 *
 * COMO USAR:
 *   # Modo segurança (padrão) - NÃO ALTERA NADA. Apenas simula:
 *   npx tsx scripts/backfill-buyer-fields.ts
 *
 *   # Aplicar as alterações efetivamente:
 *   npx tsx scripts/backfill-buyer-fields.ts --apply
 *
 *   # Forçar sobrescrita mesmo se os campos já estiverem preenchidos:
 *   npx tsx scripts/backfill-buyer-fields.ts --apply --overwrite
 *
 * Data: 2026-08-27
 */

import "dotenv/config";
import { db } from "../server/db";
import {
  purchaseOrders,
  users,
  companies,
  purchaseRequests,
} from "../shared/schema";
import { eq, sql, isNull, and, or } from "drizzle-orm";

// ---- Argumentos CLI ----
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const OVERWRITE = args.includes("--overwrite");
const DRY_RUN = !APPLY;

const LOG_PREFIX = DRY_RUN ? "[DRY-RUN] " : "[APPLY]   ";

interface BuyerCandidate {
  buyerName: string | null;
  buyerEmail: string | null;
  buyerPhone: string | null;
  source: "createdBy" | "requesterId" | null;
  sourceUserId?: number;
}

// --------------------------------------------------------------
// Passo 1: Busca todos os purchase_orders com joins para dados
// --------------------------------------------------------------
async function fetchAllPurchaseOrdersWithSourceData() {
  const rows = await db
    .select({
      id: purchaseOrders.id,
      orderNumber: purchaseOrders.orderNumber,
      createdBy: purchaseOrders.createdBy,
      purchaseRequestId: purchaseOrders.purchaseRequestId,
      existing: {
        buyerName: purchaseOrders.buyerName,
        buyerEmail: purchaseOrders.buyerEmail,
        buyerPhone: purchaseOrders.buyerPhone,
        contactPhone: purchaseOrders.contactPhone,
      },
      creator: {
        id: users.id,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        companyId: users.companyId,
        phone: users.phone,
      },
      creatorCompany: {
        phone: companies.phone,
      },
      prRequesterId: purchaseRequests.requesterId,
    })
    .from(purchaseOrders)
    .leftJoin(users, eq(users.id, purchaseOrders.createdBy))
    .leftJoin(companies, eq(companies.id, users.companyId))
    .leftJoin(
      purchaseRequests,
      eq(purchaseRequests.id, purchaseOrders.purchaseRequestId)
    )
    .orderBy(purchaseOrders.id);

  return rows;
}

// --------------------------------------------------------------
// Passo 2: Busca dados do Solicitante (fallback via requester)
// --------------------------------------------------------------
const requesterCache = new Map<number, any>();

async function getRequester(userId: number) {
  if (!userId) return null;
  if (requesterCache.has(userId)) return requesterCache.get(userId);
  const [row] = await db
    .select({
      id: users.id,
      username: users.username,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      companyId: users.companyId,
      phone: users.phone,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  let companyPhone: string | null = null;
  if (row?.companyId) {
    const [c] = await db
      .select({ phone: companies.phone })
      .from(companies)
      .where(eq(companies.id, row.companyId))
      .limit(1);
    companyPhone = c?.phone ?? null;
  }

  const enriched = { ...row, companyPhone };
  requesterCache.set(userId, enriched);
  return enriched;
}

// --------------------------------------------------------------
// Passo 3: Monta o candidato a "dados do comprador"
// --------------------------------------------------------------
// Ordem de prioridade telefone: 1) users.phone  2) contact_phone  3) companies.phone
function buildBuyerFromUser(u: any, fallbackPhone: string | null): BuyerCandidate {
  if (!u) return { buyerName: null, buyerEmail: null, buyerPhone: null, source: null };
  const firstName = u.firstName ?? "";
  const lastName = u.lastName ?? "";
  const fullNameRaw = `${firstName} ${lastName}`.trim();
  const buyerName = fullNameRaw.length > 0 ? fullNameRaw : (u.username ?? null);
  // Prioridade: users.phone > contact_phone (fallbackPhone) > company.phone
  const buyerPhone =
    (u.phone && String(u.phone).trim() !== "" ? u.phone : null) ??
    (fallbackPhone && String(fallbackPhone).trim() !== "" ? fallbackPhone : null) ??
    (u.companyPhone && String(u.companyPhone).trim() !== "" ? u.companyPhone : null) ??
    null;
  return {
    buyerName,
    buyerEmail: u.email ?? null,
    buyerPhone,
    source: u === null ? null : "createdBy",
    sourceUserId: u.id,
  };
}

async function computeCandidate(row: any): Promise<BuyerCandidate> {
  // Fonte 1: createdBy
  if (row.createdBy && row.creator) {
    const candidate = buildBuyerFromUser(
      { ...row.creator, companyPhone: row.creatorCompany?.phone ?? null },
      row.existing.contactPhone ?? null
    );
    candidate.source = "createdBy";
    candidate.sourceUserId = row.creator.id;
    if (candidate.buyerName) return candidate;
  }

  // Fonte 2: purchase_requests.requesterId
  if (row.prRequesterId) {
    const requester = await getRequester(row.prRequesterId);
    if (requester) {
      const candidate = buildBuyerFromUser(requester, row.existing.contactPhone ?? null);
      candidate.source = "requesterId";
      candidate.sourceUserId = requester.id;
      return candidate;
    }
  }

  return { buyerName: null, buyerEmail: null, buyerPhone: null, source: null };
}

function needsUpdate(
  existing: { buyerName: string | null; buyerEmail: string | null; buyerPhone: string | null },
  candidate: BuyerCandidate
): boolean {
  if (OVERWRITE) return !!candidate.buyerName;
  const anyEmpty =
    !existing.buyerName ||
    existing.buyerName.trim() === "" ||
    !existing.buyerEmail ||
    !existing.buyerPhone;
  const anyDiff =
    (candidate.buyerName && candidate.buyerName !== existing.buyerName) ||
    (candidate.buyerEmail && candidate.buyerEmail !== existing.buyerEmail) ||
    (candidate.buyerPhone && candidate.buyerPhone !== existing.buyerPhone);
  return anyEmpty && !!candidate.buyerName && anyDiff;
}

// --------------------------------------------------------------
// Passo 4: Aplica UPDATE (ou apenas imprime em DRY-RUN)
// --------------------------------------------------------------
async function applyUpdate(
  poId: number,
  data: { buyerName: string | null; buyerEmail: string | null; buyerPhone: string | null }
) {
  if (DRY_RUN) return;
  await db
    .update(purchaseOrders)
    .set({
      buyerName: data.buyerName,
      buyerEmail: data.buyerEmail,
      buyerPhone: data.buyerPhone,
    })
    .where(eq(purchaseOrders.id, poId));
}

// --------------------------------------------------------------
// Execução principal
// --------------------------------------------------------------
async function main() {
  console.log("\n" + "=".repeat(70));
  console.log(LOG_PREFIX + "SCRIPT BACKFILL - DADOS DO COMPRADOR NOS PEDIDOS DE COMPRA");
  console.log("=".repeat(70));
  console.log(LOG_PREFIX + "Modo......: " + (DRY_RUN ? "DRY RUN (nada será alterado)" : "APLICAR MUDANÇAS"));
  console.log(LOG_PREFIX + "Overwrite.: " + (OVERWRITE ? "SIM (sobrescreve campos já preenchidos)" : "NÃO (apenas campos vazios)"));
  console.log("=".repeat(70) + "\n");

  const allRows = await fetchAllPurchaseOrdersWithSourceData();
  console.log(`Total de purchase_orders encontrados: ${allRows.length}\n`);

  const summary = {
    total: allRows.length,
    updated: 0,
    skippedAlreadyFilled: 0,
    skippedNoSource: 0,
    errors: 0,
    bySource: { createdBy: 0, requesterId: 0 } as Record<string, number>,
  };

  const changedSample: any[] = [];

  for (const row of allRows) {
    try {
      const candidate = await computeCandidate(row);

      if (!candidate.buyerName) {
        summary.skippedNoSource++;
        console.log(
          `  ⚠️  PO #${row.id} (${row.orderNumber}): NÃO ENCONTRADA FONTE (createdBy=${row.createdBy}, requesterId=${row.prRequesterId})`
        );
        continue;
      }

      if (!needsUpdate(row.existing, candidate)) {
        summary.skippedAlreadyFilled++;
        continue;
      }

      // Executa update (ou apenas anota no dry-run)
      await applyUpdate(row.id, {
        buyerName: candidate.buyerName,
        buyerEmail: candidate.buyerEmail,
        buyerPhone: candidate.buyerPhone,
      });

      summary.updated++;
      if (candidate.source) summary.bySource[candidate.source]++;

      if (changedSample.length < 10) {
        changedSample.push({
          id: row.id,
          orderNumber: row.orderNumber,
          source: candidate.source,
          sourceUserId: candidate.sourceUserId,
          before: row.existing,
          after: {
            buyerName: candidate.buyerName,
            buyerEmail: candidate.buyerEmail,
            buyerPhone: candidate.buyerPhone,
          },
        });
      }
    } catch (err: any) {
      summary.errors++;
      console.error(`  ❌ ERRO no PO #${row.id}: ${err.message ?? String(err)}`);
    }
  }

  // ---- Relatório final ----
  console.log("\n" + "-".repeat(70));
  console.log("RELATÓRIO FINAL");
  console.log("-".repeat(70));
  console.log(`  Total de Pedidos de Compra: ${summary.total}`);
  console.log(`  ✅ Atualizados.............: ${summary.updated}`);
  console.log(`       ├─ via createdBy.....: ${summary.bySource.createdBy ?? 0}`);
  console.log(`       └─ via requesterId...: ${summary.bySource.requesterId ?? 0}`);
  console.log(`  ⏭  Já preenchidos..........: ${summary.skippedAlreadyFilled}`);
  console.log(`  ⚠️  Sem fonte de dados.....: ${summary.skippedNoSource}`);
  console.log(`  ❌ Com erros...............: ${summary.errors}`);
  console.log("-".repeat(70) + "\n");

  if (changedSample.length > 0) {
    console.log("💡 AMOSTRA DAS ALTERAÇÕES (primeiros 10):");
    console.log(
      JSON.stringify(
        changedSample.map((s) => ({
          PO: `${s.orderNumber} (#${s.id})`,
          origem: `${s.source} (userId=${s.sourceUserId})`,
          antes: s.before,
          depois: s.after,
        })),
        null,
        2
      )
    );
    console.log("");
  }

  if (DRY_RUN) {
    console.log("👉 Nenhuma alteração foi efetuada, pois você está em modo DRY-RUN.");
    console.log("👉 Para APLICAR, rode novamente com: --apply");
    if (summary.updated > 0) {
      console.log(`👉 Total de ${summary.updated} pedidos seriam atualizados.\n`);
    }
  } else {
    console.log("✅ Alterações aplicadas com sucesso.\n");
  }

  await db.$client.end?.().catch(() => {});
  process.exit(summary.errors === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
