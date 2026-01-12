import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { pool } from "../db";
import { isAuthenticated, isAdmin } from "./middleware";
import { z } from "zod";

// Schema for approval configuration
const approvalConfigSchema = z.object({
  valueThreshold: z.union([
    z.string().min(1, "Value threshold is required"),
    z.number().positive("Value threshold must be positive")
  ]).transform((val) => typeof val === 'number' ? val.toString() : val),
  reason: z.string().min(1, "Reason is required"),
});

// Schema for approval request with dual approval support
const approveA2WithRulesSchema = z.object({
  approved: z.boolean(),
  rejectionReason: z.string().optional(),
  rejectionAction: z.enum(["recotacao", "arquivar"]).optional(),
  approverId: z.number(),
  isFirstApproval: z.boolean().optional(), // For dual approval flow
});

// Helper to clean IP address (remove port if present)
function cleanIpAddress(ip: string): string {
  if (!ip) return "unknown";
  
  // Handle IPv4-mapped IPv6 addresses
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  
  // Handle IPv4 with port (e.g. 1.2.3.4:5678)
  if (ip.includes('.') && ip.includes(':')) {
    const colonIndex = ip.lastIndexOf(':');
    if (colonIndex !== -1) {
        const port = ip.substring(colonIndex + 1);
        if (/^\d+$/.test(port)) {
            return ip.substring(0, colonIndex);
        }
    }
  }
  
  return ip;
}

export function registerApprovalRulesRoutes(app: Express) {
  // Get current approval configuration
  app.get("/api/approval-rules/config", isAuthenticated, async (req, res) => {
    try {
      const config = await storage.getActiveApprovalConfiguration();
      res.json(config);
    } catch (error) {
      console.error("Error fetching approval configuration:", error);
      res.status(500).json({ message: "Failed to fetch approval configuration" });
    }
  });

  // Get approval type for a specific purchase request
  app.get("/api/approval-rules/:requestId", isAuthenticated, async (req, res) => {
    try {
      const requestId = parseInt(req.params.requestId);
      
      const request = await storage.getPurchaseRequestById(requestId);
      if (!request) {
        return res.status(404).json({ message: "Purchase request not found" });
      }

      const config = await storage.getActiveApprovalConfiguration();
      if (!config) {
        return res.status(500).json({ message: "No active approval configuration found" });
      }

      const totalValue = parseFloat(request.totalValue || "0");
      const threshold = parseFloat(config.valueThreshold);
      
      const requiresDualApproval = totalValue > threshold;
      
      // Get CEO and directors for dual approval
      let availableApprovers = [];
      if (requiresDualApproval) {
        availableApprovers = await storage.getCEOAndDirectors();
      } else {
        availableApprovers = await storage.getA2Approvers();
      }

      // Check current approval status
      const approvalHistory = await storage.getApprovalHistoryByRequestId(requestId);
      const a2Approvals = approvalHistory.filter(ah => ah.approverType === "A2");
      
      let approvalStatus = "pending";
      let nextApprover = null;
      let firstApprover = null;
      
      if (requiresDualApproval) {
        const firstApproval = a2Approvals.find(ah => ah.approvalStep === 'first');
        const finalApproval = a2Approvals.find(ah => ah.approvalStep === 'final');
        
        if (finalApproval) {
          approvalStatus = finalApproval.approved ? "completed" : "rejected";
        } else if (firstApproval) {
          approvalStatus = "awaiting_final";
          firstApprover = firstApproval;
          // Next approver should be CEO if first approver is not CEO
          const ceo = availableApprovers.find(u => u.isCEO);
          if (ceo && firstApproval.approverId !== ceo.id) {
            nextApprover = ceo;
          }
        } else {
          approvalStatus = "awaiting_first";
          // Next approver can be any director or CEO
          nextApprover = availableApprovers[0]; // Will be determined by frontend
        }
      } else {
        const singleApproval = a2Approvals.find(ah => ah.approved !== null);
        if (singleApproval) {
          approvalStatus = singleApproval.approved ? "completed" : "rejected";
        } else {
          approvalStatus = "pending";
          nextApprover = availableApprovers[0]; // Will be determined by frontend
        }
      }

      res.json({
        requiresDualApproval,
        valueThreshold: config.valueThreshold,
        totalValue: request.totalValue,
        approvalStatus,
        availableApprovers,
        nextApprover,
        firstApprover,
        approvalHistory: a2Approvals,
      });
    } catch (error) {
      console.error("Error fetching approval rules:", error);
      res.status(500).json({ message: "Failed to fetch approval rules" });
    }
  });

  // Process A2 approval with dual approval support
  app.post("/api/approval-rules/:requestId/approve", isAuthenticated, async (req, res) => {
    try {
      const requestId = parseInt(req.params.requestId);
      const data = approveA2WithRulesSchema.parse(req.body);
      
      const request = await storage.getPurchaseRequestById(requestId);
      if (!request || request.currentPhase !== "aprovacao_a2") {
        return res.status(400).json({ message: "Request must be in the A2 approval phase" });
      }

      // Get approval configuration
      const config = await storage.getActiveApprovalConfiguration();
      if (!config) {
        return res.status(500).json({ message: "No active approval configuration found" });
      }

      const totalValue = parseFloat(request.totalValue || "0");
      const threshold = parseFloat(config.valueThreshold);
      const requiresDualApproval = totalValue > threshold;

      // Validate approver permissions
      const user = await storage.getUserById(data.approverId);
      if (!user || !user.isApproverA2) {
        return res.status(403).json({ message: "User does not have A2 approval permissions" });
      }

      // Get existing approval history
      const approvalHistory = await storage.getApprovalHistoryByRequestId(requestId);
      const a2Approvals = approvalHistory.filter(ah => ah.approverType === "A2");

      let approvalStep = 1;
      let isComplete = false;
      let newPhase = request.currentPhase;

      if (requiresDualApproval) {
        // Dual approval logic
        if (!(user.isCEO || user.isDirector)) {
          return res.status(403).json({ message: "Dual approval requires CEO or Director permissions" });
        }

        const existingFirstApproval = a2Approvals.find(ah => ah.approvalStep === 'first');
        const existingFinalApproval = a2Approvals.find(ah => ah.approvalStep === 'final');

        if (existingFinalApproval) {
          return res.status(400).json({ message: "Request has already been finally approved or rejected" });
        }

        if (existingFirstApproval) {
          // This is the second approval
          if (existingFirstApproval.approverId === data.approverId) {
            return res.status(400).json({ message: "Same user cannot provide both approvals" });
          }
          
          // Final approval must be from CEO if first wasn't from CEO
          if (!existingFirstApproval.approved) {
            return res.status(400).json({ message: "Cannot provide final approval when first approval was rejected" });
          }

          const firstApprover = await storage.getUserById(existingFirstApproval.approverId);
          if (firstApprover && !firstApprover.isCEO && !user.isCEO) {
            return res.status(400).json({ message: "Final approval must be from CEO when first approval is not from CEO" });
          }

          approvalStep = 2;
          isComplete = true;
          
          if (data.approved) {
            newPhase = "pedido_compra";
          } else {
            newPhase = data.rejectionAction === "recotacao" ? "cotacao" : "arquivado";
          }
        } else {
          // This is the first approval
          if (!data.approved) {
            // First rejection completes the process
            isComplete = true;
            newPhase = data.rejectionAction === "recotacao" ? "cotacao" : "arquivado";
          } else {
            // For dual approval, first approval must be from Director
            // CEO cannot approve first in dual approval flow
            if (user.isCEO) {
              return res.status(400).json({ 
                message: "Para aprovação dupla, a primeira aprovação deve ser realizada por um Diretor. CEO deve aguardar a primeira aprovação." 
              });
            }
            
            // First approval by Director - stays in aprovacao_a2 for CEO final approval
            if (!user.isDirector) {
              return res.status(403).json({ 
                message: "Primeira aprovação em fluxo duplo deve ser realizada por Diretor." 
              });
            }
          }
          // If approved by Director, stays in aprovacao_a2 for CEO second approval
        }
      } else {
        // Single approval logic
        isComplete = true;
        if (data.approved) {
          newPhase = "pedido_compra";
        } else {
          newPhase = data.rejectionAction === "recotacao" ? "cotacao" : "arquivado";
        }
      }

      // Create approval history entry
      await storage.createApprovalHistoryWithStep({
        purchaseRequestId: requestId,
        approverType: "A2",
        approverId: data.approverId,
        approved: data.approved,
        rejectionReason: data.approved ? null : (data.rejectionReason || "Solicitação reprovada"),
        approvalStep: requiresDualApproval ? (approvalStep === 1 ? "first" : "final") : "single",
        approvalValue: request.totalValue ?? "0",
        requiresDualApproval,
        ipAddress: cleanIpAddress(req.ip || req.connection.remoteAddress || "unknown"),
        userAgent: req.get("User-Agent") || "unknown",
      });

      // Update purchase request if approval is complete
      let updatedRequest = request;
      if (isComplete) {
        const updateData: any = {
          currentPhase: newPhase,
          updatedAt: new Date(),
        };

        if (requiresDualApproval) {
          if (approvalStep === 1) {
            updateData.firstApproverA2Id = data.approverId;
            updateData.firstApprovalDate = new Date();
          } else {
            // Final approval (step 2) or CEO single approval
            updateData.finalApproverId = data.approverId;
            updateData.finalApprovalDate = new Date();
            updateData.approverA2Id = data.approverId; // For compatibility
            updateData.approvalDateA2 = new Date();
            updateData.approvedA2 = data.approved;
            updateData.rejectionReasonA2 = data.approved ? null : data.rejectionReason;
            updateData.rejectionActionA2 = data.approved ? null : data.rejectionAction;
          }
        } else {
          updateData.approverA2Id = data.approverId;
          updateData.approvalDateA2 = new Date();
          updateData.approvedA2 = data.approved;
          updateData.rejectionReasonA2 = data.approved ? null : data.rejectionReason;
          updateData.rejectionActionA2 = data.approved ? null : data.rejectionAction;
        }

        updatedRequest = await storage.updatePurchaseRequest(requestId, updateData);

        // Create purchase order if fully approved
        if (data.approved && newPhase === "pedido_compra") {
          try {
            await createAutomaticPurchaseOrder(requestId, data.approverId);
          } catch (purchaseOrderError) {
            console.error("Error creating automatic purchase order:", purchaseOrderError);
            // Don't fail the approval if purchase order creation fails
          }
        }

        // Send notification emails
        if (!data.approved && data.rejectionReason) {
          const { notifyRejection } = await import("../email-service");
          await notifyRejection(updatedRequest, data.rejectionReason, "A2");
        }
      }

      res.json({
        success: true,
        request: updatedRequest,
        approvalStep,
        isComplete,
        requiresDualApproval,
        nextStep: isComplete ? null : (requiresDualApproval && approvalStep === 1 ? "awaiting_final" : null),
      });
    } catch (error) {
      console.error("Error processing A2 approval with rules:", error);
      res.status(500).json({ message: "Failed to process approval" });
    }
  });

  // Admin: Update approval configuration
  app.post("/api/approval-rules/config", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const data = approvalConfigSchema.parse(req.body);
      const userId = req.session.userId!;

      const config = await storage.createApprovalConfiguration({
        valueThreshold: data.valueThreshold,
        effectiveDate: new Date(),
        reason: data.reason,
        createdBy: userId,
      });

      res.json(config);
    } catch (error) {
      console.error("Error updating approval configuration:", error);
      res.status(500).json({ message: "Failed to update approval configuration" });
    }
  });

  // Admin: Get configuration history
  app.get("/api/approval-rules/config/history", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const history = await storage.getConfigurationHistory();
      res.json(history);
    } catch (error) {
      console.error("Error fetching configuration history:", error);
      res.status(500).json({ message: "Failed to fetch configuration history" });
    }
  });
}

// Helper function to create automatic purchase order
async function createAutomaticPurchaseOrder(requestId: number, approverId: number) {
  // Get quotation
  const quotation = await storage.getQuotationByPurchaseRequestId(requestId);
  if (!quotation) return;

  const supplierQuotations = await storage.getSupplierQuotations(quotation.id);
  const chosenSupplierQuotation = supplierQuotations.find(sq => sq.isChosen);

  if (!chosenSupplierQuotation) return;

  // Check if purchase order already exists
  const existingPurchaseOrder = await storage.getPurchaseOrderByRequestId(requestId);
  if (existingPurchaseOrder) return;

  const supplierQuotationItems = await storage.getSupplierQuotationItems(chosenSupplierQuotation.id);
  if (supplierQuotationItems.length === 0) return;

  // Generate order number
  const orderNumber = `PO-${new Date().getFullYear()}-${String(requestId).padStart(3, "0")}`;

  // Create purchase order
  const purchaseOrderData = {
    orderNumber,
    purchaseRequestId: requestId,
    supplierId: chosenSupplierQuotation.supplierId,
    quotationId: quotation.id,
    status: "draft" as const,
    totalValue: chosenSupplierQuotation.totalValue || "0",
    paymentTerms: null,
    deliveryTerms: null,
    deliveryAddress: null,
    contactPerson: null,
    contactPhone: null,
    observations: null,
    approvedBy: null,
    approvedAt: null,
    createdBy: approverId,
  };

  const purchaseOrder = await storage.createPurchaseOrder(purchaseOrderData);

  const quotationItems = await storage.getQuotationItems(quotation.id);

  let itemsTotal = 0;
  for (const si of supplierQuotationItems) {
    if (si.isAvailable === false) continue;
    const qi = quotationItems.find(q => q.id === si.quotationItemId);
    const description = qi?.description || "";
    const unit = si.confirmedUnit || qi?.unit || "UN";
    const quantity = si.availableQuantity ?? qi?.quantity ?? "0";
    const unitPrice = si.unitPrice || "0";
    const baseTotal = (parseFloat(unitPrice) || 0) * (parseFloat(quantity as any) || 0);
    let itemDiscount = 0;
    let totalPrice = baseTotal;
    if (si.discountPercentage && parseFloat(si.discountPercentage as any) > 0) {
      itemDiscount = (baseTotal * parseFloat(si.discountPercentage as any)) / 100;
    } else if (si.discountValue && parseFloat(si.discountValue as any) > 0) {
      itemDiscount = parseFloat(si.discountValue as any);
    }
    totalPrice = Math.max(0, baseTotal - itemDiscount);
    itemsTotal += totalPrice;
    const purchaseOrderItemData = {
      purchaseOrderId: purchaseOrder.id,
      itemCode: qi?.itemCode || `ITEM-${si.id}`,
      description,
      quantity,
      unit,
      unitPrice,
      totalPrice: totalPrice.toFixed(4),
      deliveryDeadline: null,
      costCenterId: null,
      accountCode: null,
    };

    await storage.createPurchaseOrderItem(purchaseOrderItemData);
  }
  try {
    const supplierTotal = parseFloat(chosenSupplierQuotation.totalValue || "0");
    const discrepancy = Math.abs(supplierTotal - itemsTotal);
    await pool.query(
      `INSERT INTO audit_logs (purchase_request_id, performed_by, action_type, action_description, performed_at, before_data, after_data)
       VALUES ($1, $2, $3, $4, NOW(), $5, $6)`,
      [
        requestId,
        approverId,
        'po_created_a2',
        `PO criado na A2 a partir da cotação vencedora. Soma itens: R$ ${itemsTotal.toFixed(4)} | Total cotação: R$ ${supplierTotal.toFixed(4)} | Diferença: R$ ${discrepancy.toFixed(4)}`,
        JSON.stringify({ supplierTotal }),
        JSON.stringify({ itemsTotal })
      ]
    );
  } catch {}
}
