import { db } from "../db";
import { 
  quotations, 
  supplierQuotations, 
  purchaseOrders, 
  receipts, 
  quotationVersionHistory,
} from "../../shared/schema";
import { eq, desc } from "drizzle-orm";
import { purchaseRequestRepository } from "../repositories/purchase-request-repository";
import { userRepository } from "../repositories/user-repository";

export class TimelineService {
  async getCompleteTimeline(purchaseRequestId: number): Promise<any[]> {
    // Get the purchase request details
    const request = await purchaseRequestRepository.getPurchaseRequestById(purchaseRequestId);
    if (!request) {
      return [];
    }

    const timeline: any[] = [];

    // 1. Request Creation
    timeline.push({
      id: 'request_created',
      type: 'creation',
      phase: 'solicitacao',
      action: 'Solicitação criada',
      userId: request.requesterId,
      userName: (() => {
        const first = (request as any).requester?.firstName;
        const last = (request as any).requester?.lastName;
        const username = (request as any).requester?.username;
        if (first && last) return `${first} ${last}`;
        if (username) return username;
        return '';
      })() || 'Sistema',
      timestamp: request.createdAt,
      status: 'completed',
      icon: 'file-plus',
      description: `Solicitação de compra ${request.requestNumber} iniciada.`
    });

    // 2. Approval A1
    if (request.approvedA1 !== undefined && request.approvedA1 !== null) {
      let approverName = 'Sistema';
      if (request.approverA1Id) {
        const approver = await userRepository.getUser(request.approverA1Id);
        if (approver) {
          approverName = approver.firstName && approver.lastName ? `${approver.firstName} ${approver.lastName}` : approver.username || 'Sistema';
        }
      }

      timeline.push({
        id: 'approval_a1',
        type: 'approval',
        phase: 'aprovacao_a1',
        action: request.approvedA1 ? 'Aprovação A1 concedida' : 'Aprovação A1 rejeitada',
        userId: request.approverA1Id,
        userName: approverName,
        timestamp: request.approvalDateA1 || request.updatedAt,
        status: request.approvedA1 ? 'completed' : 'rejected',
        icon: request.approvedA1 ? 'check-circle' : 'x-circle',
        description: request.approvedA1 ? 'Solicitação aprovada pelo gestor imediato.' : `Solicitação rejeitada. Motivo: ${request.rejectionReasonA1 || 'Não informado'}`
      });
    }

    // 3. Quotation (RFQ)
    const rfq = await db.select().from(quotations).where(eq(quotations.purchaseRequestId, purchaseRequestId)).limit(1);
    if (rfq.length > 0) {
      const quotation = rfq[0];
      let buyerName = 'Sistema';
      if ((quotation as any).buyerId) {
        const buyer = await userRepository.getUser((quotation as any).buyerId);
        if (buyer) {
          buyerName = buyer.firstName && buyer.lastName ? `${buyer.firstName} ${buyer.lastName}` : buyer.username || 'Sistema';
        }
      }

      timeline.push({
        id: `rfq_${quotation.id}`,
        type: 'quotation',
        phase: 'cotacao',
        action: 'Cotação iniciada',
        userId: (quotation as any).buyerId,
        userName: buyerName,
        timestamp: quotation.createdAt,
        status: 'completed',
        icon: 'search',
        description: `Processo de cotação iniciado para os itens solicitados.`
      });

      // 3.1 Quotation History (Versions)
      const versions = await db.select().from(quotationVersionHistory).where(eq(quotationVersionHistory.quotationId, quotation.id)).orderBy(desc(quotationVersionHistory.createdAt));
      for (const version of versions) {
        let editorName = 'Sistema';
        if ((version as any).createdBy) {
          const editor = await userRepository.getUser((version as any).createdBy);
          if (editor) {
            editorName = editor.firstName && editor.lastName ? `${editor.firstName} ${editor.lastName}` : editor.username || 'Sistema';
          }
        }
        timeline.push({
          id: `rfq_version_${version.id}`,
          type: 'quotation_update',
          phase: 'cotacao',
          action: 'Cotação atualizada',
          userId: (version as any).createdBy,
          userName: editorName,
          timestamp: version.createdAt,
          status: 'completed',
          icon: 'history',
          description: (version as any).reason || `Nova versão da cotação salva.`
        });
      }

      // 3.2 Supplier Quotations
      const suppliersList = await db.select().from(supplierQuotations).where(eq(supplierQuotations.quotationId, quotation.id));
      for (const sq of suppliersList) {
        timeline.push({
          id: `supplier_quote_${sq.id}`,
          type: 'supplier_quotation',
          phase: 'cotacao',
          action: 'Resposta de fornecedor',
          userId: null,
          userName: (sq as any).supplierName || 'Fornecedor',
          timestamp: (sq as any).updatedAt || sq.createdAt,
          status: 'completed',
          icon: 'truck',
          description: `Valores e condições recebidos do fornecedor.`
        });
      }
    }

    // 4. Approval A2
    if (request.approvedA2 !== undefined && request.approvedA2 !== null) {
      let approverName = 'Sistema';
      if (request.approverA2Id) {
        const approver = await userRepository.getUser(request.approverA2Id);
        if (approver) {
          approverName = approver.firstName && approver.lastName ? `${approver.firstName} ${approver.lastName}` : approver.username || 'Sistema';
        }
      }

      timeline.push({
        id: 'approval_a2',
        type: 'approval',
        phase: 'aprovacao_a2',
        action: request.approvedA2 ? 'Aprovação A2 concedida' : 'Aprovação A2 rejeitada',
        userId: request.approverA2Id,
        userName: approverName,
        timestamp: request.approvalDateA2 || request.updatedAt,
        status: request.approvedA2 ? 'completed' : 'rejected',
        icon: request.approvedA2 ? 'shield-check' : 'shield-alert',
        description: request.approvedA2 ? 'Mapa comparativo aprovado pela diretoria/compras.' : `Mapa comparativo rejeitado. Motivo: ${request.rejectionReasonA2 || 'Não informado'}`
      });
    }

    // 5. Purchase Order (PO)
    const poResult = await db.select().from(purchaseOrders).where(eq(purchaseOrders.purchaseRequestId, purchaseRequestId)).limit(1);
    let hasDetailedReceipts = false;
    if (poResult.length > 0) {
      const po = poResult[0];
      timeline.push({
        id: `po_${po.id}`,
        type: 'purchase_order',
        phase: 'pedido_compra',
        action: 'Pedido de Compra gerado',
        userId: po.createdBy,
        userName: 'ERP Integration',
        timestamp: (po as any).orderDate || po.createdAt,
        status: 'completed',
        icon: 'shopping-cart',
        description: `Pedido de Compra ${po.orderNumber} emitido via ERP.`
      });

      // 4.1 Detailed Receipts (Physical & Fiscal)
      const linkedReceipts = await db.select().from(receipts).where(eq(receipts.purchaseOrderId, po.id));
      if (linkedReceipts.length > 0) {
        hasDetailedReceipts = true;
        for (const receipt of linkedReceipts) {
          // Physical Receipt Event
          let receiverName = 'Sistema';
          if (receipt.receivedBy) {
            const receiver = await userRepository.getUser(receipt.receivedBy);
            if (receiver) {
              receiverName = receiver.firstName && receiver.lastName
                ? `${receiver.firstName} ${receiver.lastName}`
                : receiver.username || 'Sistema';
            }
          }

          timeline.push({
            id: `receipt_${receipt.id}_physical`,
            type: 'receipt',
            phase: 'recebimento',
            action: `Recebimento Físico - NF ${receipt.documentNumber || 'S/N'}`,
            userId: receipt.receivedBy,
            userName: receiverName,
            timestamp: receipt.receivedAt || receipt.createdAt,
            status: 'completed',
            icon: 'package',
            description: `Recebimento da Nota Fiscal ${receipt.documentNumber || 'S/N'} (Série: ${receipt.documentSeries || '-'})`
          });

          // Fiscal Conference Event
          if (receipt.approvedAt || ['conferida', 'nf_confirmada', 'fiscal_conferida'].includes(receipt.status || '')) {
            let approverName = 'Sistema';
            if (receipt.approvedBy) {
              const approver = await userRepository.getUser(receipt.approvedBy);
              if (approver) {
                approverName = approver.firstName && approver.lastName
                  ? `${approver.firstName} ${approver.lastName}`
                  : approver.username || 'Sistema';
              }
            }

            timeline.push({
              id: `receipt_${receipt.id}_fiscal`,
              type: 'fiscal_conference',
              phase: 'conf_fiscal',
              action: `Conferência Fiscal - NF ${receipt.documentNumber || 'S/N'}`,
              userId: receipt.approvedBy,
              userName: approverName,
              timestamp: receipt.approvedAt || receipt.createdAt || new Date(),
              status: 'completed',
              icon: 'file-check',
              description: `Conferência Fiscal realizada with sucesso.`
            });
          }
        }
      }
    }

    if (request.receivedDate && !hasDetailedReceipts) {
      let receiverName = 'Sistema';
      if (request.receivedById) {
        const receiver = await userRepository.getUser(request.receivedById);
        if (receiver) {
          receiverName = receiver.firstName && receiver.lastName
            ? `${receiver.firstName} ${receiver.lastName}`
            : receiver.username || 'Sistema';
        }
      }
      timeline.push({
        id: 'material_received',
        type: 'receipt',
        phase: 'recebimento',
        action: 'Material recebido',
        userId: request.receivedById,
        userName: receiverName,
        timestamp: request.receivedDate,
        status: 'completed',
        icon: 'package-check',
        description: request.pendencyReason ? `Recebimento com pendência: ${request.pendencyReason}` : 'Material recebido e conferido'
      });
    }

    if (request.currentPhase === 'conclusao_compra' || request.currentPhase === 'arquivado') {
      let finisherName = 'Sistema';
      if (request.buyerId) {
        const buyer = await userRepository.getUser(request.buyerId);
        if (buyer) {
          finisherName = buyer.firstName && buyer.lastName ? `${buyer.firstName} ${buyer.lastName}` : buyer.username || 'Sistema';
        }
      } else if (request.approverA2Id) {
        const approverA2 = await userRepository.getUser(request.approverA2Id);
        if (approverA2) {
          finisherName = approverA2.firstName && approverA2.lastName ? `${approverA2.firstName} ${approverA2.lastName}` : approverA2.username || 'Sistema';
        }
      } else if (request.requesterId) {
        const requesterUserRes = await userRepository.getUser(request.requesterId);
        if (requesterUserRes) {
          finisherName = requesterUserRes.firstName && requesterUserRes.lastName ? `${requesterUserRes.firstName} ${requesterUserRes.lastName}` : requesterUserRes.username || 'Sistema';
        }
      }
      timeline.push({
        id: 'process_completed',
        type: 'completion',
        phase: request.currentPhase,
        action: request.currentPhase === 'arquivado' ? 'Processo arquivado' : 'Processo concluído',
        userId: request.buyerId || request.approverA2Id || request.requesterId,
        userName: finisherName,
        timestamp: (request as any).archivedDate || request.updatedAt || new Date(),
        status: 'completed',
        icon: request.currentPhase === 'arquivado' ? 'archive' : 'check-circle-2',
        description: request.currentPhase === 'arquivado' 
          ? (request as any).conclusionObservations || 'Processo arquivado com sucesso'
          : 'Processo de compra concluído'
      });
    }

    // Sort timeline by timestamp with stable tie-breaker using business phase order
    const phaseRank: Record<string, number> = {
      solicitacao: 1,
      aprovacao_a1: 2,
      cotacao: 3,
      aprovacao_a2: 4,
      pedido_compra: 5,
      recebimento: 6,
      conclusao_compra: 7,
      arquivado: 8,
    };
    timeline.sort((a, b) => {
      const ta = new Date(a.timestamp).getTime();
      const tb = new Date(b.timestamp).getTime();
      if (ta !== tb) return ta - tb;
      const ra = phaseRank[a.phase] ?? 99;
      const rb = phaseRank[b.phase] ?? 99;
      if (ra !== rb) return ra - rb;
      const sa = String(a.id);
      const sb = String(b.id);
      return sa.localeCompare(sb);
    });

    return timeline;
  }
}

export const timelineService = new TimelineService();
