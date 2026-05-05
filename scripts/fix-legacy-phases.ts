import { db } from "../server/db";
import { purchaseRequests, receipts, receiptItems, purchaseOrderItems } from "../shared/schema";
import { eq, inArray, sql } from "drizzle-orm";

async function fixLegacyData() {
  console.log("Iniciando correção de dados legados...");

  // 1. Mover solicitações em fases legadas para 'pedido_concluido'
  const legacyPhases = ['recebimento', 'conf_fiscal', 'conclusao_compra'];
  const updatedRequests = await db.update(purchaseRequests)
    .set({ currentPhase: 'pedido_concluido' })
    .where(inArray(purchaseRequests.currentPhase, legacyPhases as any))
    .returning({ id: purchaseRequests.id });

  console.log(`${updatedRequests.length} solicitações movidas para 'pedido_concluido'.`);

  // 2. Identificar recebimentos que estão 100% concluídos mas ainda em 'recebimento_fisico'
  // Usamos uma query direta para calcular o percentual e atualizar
  const finishedReceipts = await db.execute(sql`
    WITH receipt_progress AS (
      SELECT 
        r.id,
        COALESCE(SUM(ri.quantity_received), 0) as total_received,
        NULLIF(SUM(poi.quantity), 0) as total_expected
      FROM receipts r
      JOIN receipt_items ri ON r.id = ri.receipt_id
      JOIN purchase_order_items poi ON ri.purchase_order_item_id = poi.id
      WHERE r.receipt_phase = 'recebimento_fisico'
      GROUP BY r.id
    )
    UPDATE receipts
    SET receipt_phase = 'conf_fiscal'
    WHERE id IN (
      SELECT id FROM receipt_progress 
      WHERE total_received >= total_expected AND total_expected > 0
    )
    RETURNING id;
  `);

  console.log(`${finishedReceipts.rows.length} recebimentos movidos para 'conf_fiscal' (100% concluídos).`);

  console.log("Correção concluída com sucesso!");
  process.exit(0);
}

fixLegacyData().catch(err => {
  console.error("Erro ao executar correção:", err);
  process.exit(1);
});
