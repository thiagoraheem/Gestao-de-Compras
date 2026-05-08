import { storage } from "../storage";
import { 
  notifyApprovalA1, 
  notifyApprovalA2, 
  notifyRejection 
} from "../email-service";
import { realtime } from "../realtime";
import { REALTIME_CHANNELS, PURCHASE_REQUEST_EVENTS } from "../../shared/realtime-events";
import { purchaseOrderService } from "./purchase-order-service";

export class WorkflowService {
  async sendToApproval(id: number): Promise<any> {
    const request = await storage.getPurchaseRequestById(id);
    if (!request || request.currentPhase !== "solicitacao") {
      throw new Error("Request must be in the request phase");
    }

    const updateData = {
      currentPhase: "aprovacao_a1" as any,
      updatedAt: new Date(),
    };

    const updatedRequest = await storage.updatePurchaseRequest(id, updateData);

    // Send notification to approvers A1
    try {
      await notifyApprovalA1(updatedRequest);
    } catch (emailError) {
      console.error("Error sending approval notification:", emailError);
    }

    realtime.publish(REALTIME_CHANNELS.PURCHASE_REQUESTS, {
      event: PURCHASE_REQUEST_EVENTS.PHASE_CHANGED,
      payload: { id, currentPhase: updateData.currentPhase, updatedAt: updatedRequest.updatedAt },
    });

    return updatedRequest;
  }

  async approveA1(id: number, approved: boolean, rejectionReason: string | null, approverId: number): Promise<any> {
    const request = await storage.getPurchaseRequestById(id);
    if (!request || request.currentPhase !== "aprovacao_a1") {
      throw new Error("Request must be in the A1 approval phase");
    }

    const updateData = {
      approverA1Id: approverId,
      approvedA1: approved,
      approvalDateA1: new Date(),
      currentPhase: approved ? "cotacao" : "arquivado",
      rejectionReasonA1: approved ? null : rejectionReason || "Solicitação reprovada",
      updatedAt: new Date(),
    } as const;

    // Create approval history entry
    await storage.createApprovalHistory({
      purchaseRequestId: id,
      approverType: "A1",
      approverId: approverId,
      approved: approved,
      rejectionReason: approved ? null : rejectionReason || "Solicitação reprovada",
    });

    const updatedRequest = await storage.updatePurchaseRequest(id, updateData);

    // Send rejection notification email if request was rejected
    if (!approved && rejectionReason) {
      await notifyRejection(updatedRequest, rejectionReason, "A1");
    }

    realtime.publish(REALTIME_CHANNELS.PURCHASE_REQUESTS, {
      event: PURCHASE_REQUEST_EVENTS.PHASE_CHANGED,
      payload: { id, currentPhase: updateData.currentPhase, updatedAt: updatedRequest.updatedAt },
    });

    return updatedRequest;
  }

  async approveA2(id: number, approved: boolean, rejectionReason: string | null, rejectionAction: string | null, approverId: number): Promise<any> {
    const request = await storage.getPurchaseRequestById(id);
    if (!request || request.currentPhase !== "aprovacao_a2") {
      throw new Error("Request must be in the A2 approval phase");
    }

    let newPhase = "pedido_compra";
    if (!approved) {
      if (rejectionAction === "recotacao") {
        newPhase = "cotacao";
      } else {
        newPhase = "arquivado";
      }
    }

    const updateData = {
      approverA2Id: approverId,
      approvalDateA2: new Date(),
      approvedA2: approved,
      rejectionReasonA2: approved ? null : rejectionReason,
      rejectionActionA2: approved ? null : rejectionAction,
      currentPhase: newPhase as any,
      lastPhase: newPhase === "arquivado" ? request.currentPhase : undefined,
      updatedAt: new Date(),
    } as const;

    // Create approval history entry
    await storage.createApprovalHistory({
      purchaseRequestId: id,
      approverType: "A2",
      approverId: approverId,
      approved: approved,
      rejectionReason: approved ? null : rejectionReason || "Solicitação reprovada",
    });

    const updatedRequest = await storage.updatePurchaseRequest(id, updateData);

    // If approved, create purchase order automatically
    if (approved) {
      try {
        await purchaseOrderService.createPurchaseOrderFromQuotation(id, approverId, {
          auditActionType: 'po_created_a2'
        });
      } catch (purchaseOrderError) {
        console.error("Error creating purchase order automatically:", purchaseOrderError);
      }
    }

    // Send rejection notification email if request was rejected
    if (!approved && rejectionReason) {
      await notifyRejection(updatedRequest, rejectionReason, "A2");
    }

    realtime.publish(REALTIME_CHANNELS.PURCHASE_REQUESTS, {
      event: PURCHASE_REQUEST_EVENTS.PHASE_CHANGED,
      payload: { id, currentPhase: newPhase, updatedAt: updatedRequest.updatedAt },
    });

    return updatedRequest;
  }

  async archiveRequest(id: number, conclusionObservations: string): Promise<any> {
    const currentRequest = await storage.getPurchaseRequestById(id);
    if (!currentRequest) throw new Error("Request not found");

    const updates = {
      currentPhase: "arquivado" as const,
      lastPhase: currentRequest.currentPhase,
      conclusionObservations,
      archivedDate: new Date(),
    };

    const request = await storage.updatePurchaseRequest(id, updates);

    realtime.publish(REALTIME_CHANNELS.PURCHASE_REQUESTS, {
      event: PURCHASE_REQUEST_EVENTS.PHASE_CHANGED,
      payload: { id, currentPhase: "arquivado", updatedAt: request.updatedAt },
    });

    return request;
  }

  async unarchiveRequest(id: number, userId: number): Promise<any> {
    const request = await storage.getPurchaseRequestById(id);
    if (!request) throw new Error("Solicitação não encontrada");
    if (request.currentPhase !== "arquivado") throw new Error("Solicitação não está arquivada");

    const targetPhase = request.lastPhase || "cotacao";

    const updated = await storage.updatePurchaseRequest(id, {
      currentPhase: targetPhase as any,
      lastPhase: null,
    });

    realtime.publish(REALTIME_CHANNELS.PURCHASE_REQUESTS, {
      event: PURCHASE_REQUEST_EVENTS.PHASE_CHANGED,
      payload: { id, currentPhase: targetPhase, updatedAt: updated.updatedAt },
    });

    return updated;
  }
}

export const workflowService = new WorkflowService();
