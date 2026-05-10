import { storage } from "../storage";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { receipts, receiptItems } from "../../shared/schema";

export interface DashboardFilters {
  period?: string;
  department?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  dateFilterType?: string;
}

export class DashboardService {
  async getDashboardData(userId: number, filters: DashboardFilters): Promise<any> {
    const {
      period = "30",
      department = "all",
      status = "all",
      startDate: startDateParam,
      endDate: endDateParam,
      dateFilterType = "created",
    } = filters;

    // Calculate date range
    let startDate: Date;
    let endDate: Date;

    if (startDateParam && endDateParam) {
      startDate = new Date(startDateParam as string);
      endDate = new Date(endDateParam as string);
    } else {
      const daysAgo = parseInt(period as string);
      startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);
      endDate = new Date();
    }

    // Get all purchase requests
    const allRequests = await storage.getAllPurchaseRequests();
    const allCostCenters = await storage.getAllCostCenters();
    const selectedDeptId = department !== "all" ? Number(department) : null;
    
    const filteredRequests = allRequests.filter((request) => {
      let isInPeriod = false;

      // Apply date filter based on type
      if (dateFilterType === "created") {
        const createdAt = new Date(request.createdAt!);
        isInPeriod = createdAt >= startDate && createdAt <= endDate;
      } else if (dateFilterType === "completion") {
        if (request.currentPhase === "arquivado" && request.updatedAt) {
          const completionDate = new Date(request.updatedAt);
          isInPeriod = completionDate >= startDate && completionDate <= endDate;
        } else {
          isInPeriod = false;
        }
      } else if (dateFilterType === "both") {
        const createdAt = new Date(request.createdAt!);
        const creationMatch = createdAt >= startDate && createdAt <= endDate;

        let completionMatch = false;
        if (request.currentPhase === "arquivado" && request.updatedAt) {
          const completionDate = new Date(request.updatedAt);
          completionMatch = completionDate >= startDate && completionDate <= endDate;
        }

        isInPeriod = creationMatch || completionMatch;
      }

      const departmentMatch = selectedDeptId == null
        ? true
        : (() => {
            const cc = allCostCenters.find((c) => c.id === request.costCenterId);
            return cc ? cc.departmentId === selectedDeptId : false;
          })();

      const statusMatch = status === "all" || request.currentPhase === status;

      return isInPeriod && departmentMatch && statusMatch;
    });

    // Calculate KPIs
    const totalActiveRequests = filteredRequests.filter((req) => req.currentPhase !== "arquivado").length;

    const totalProcessingValue = filteredRequests.reduce((sum, req) => {
      const value = Number(req.totalValue) || Number(req.availableBudget) || 0;
      return sum + value;
    }, 0);

    const approvedRequests = filteredRequests.filter((req) => req.currentPhase !== "solicitacao" && req.approvalDateA1);
    const averageApprovalTime = approvedRequests.length > 0
      ? Math.round(
          approvedRequests.reduce((sum, req) => {
            const created = new Date(req.createdAt || new Date());
            const approved = new Date(req.approvalDateA1!);
            return sum + (approved.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
          }, 0) / approvedRequests.length
        )
      : 0;

    const totalRequestsWithDecision = filteredRequests.filter((req) => req.currentPhase !== "solicitacao").length;
    const approvedRequestsCount = filteredRequests.filter((req) => req.approvedA1 !== false && req.currentPhase !== "solicitacao").length;
    const approvalRate = totalRequestsWithDecision > 0 ? Math.round((approvedRequestsCount / totalRequestsWithDecision) * 100) : 0;

    const departments = await storage.getAllDepartments();
    const requestsByDepartment = departments
      .map((dept) => {
        const deptRequests = filteredRequests.filter((req) => {
          const cc = allCostCenters.find((c) => c.id === req.costCenterId);
          return cc ? cc.departmentId === dept.id : false;
        });
        return { name: dept.name, value: deptRequests.length };
      })
      .filter((item) => item.value > 0);

    const urgencyDistribution = [
      { name: "Baixa", value: filteredRequests.filter((req) => req.urgency === "baixo").length },
      { name: "Média", value: filteredRequests.filter((req) => req.urgency === "medio").length },
      { name: "Alta", value: filteredRequests.filter((req) => req.urgency === "alto").length },
      { name: "Crítica", value: filteredRequests.filter((req) => req.urgency === "critico" || req.urgency === "alta_urgencia").length },
    ].filter((item) => item.value > 0);

    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const monthRequests = allRequests.filter((req) => {
        const reqDate = new Date(req.createdAt || new Date());
        return reqDate >= monthStart && reqDate <= monthEnd;
      });

      monthlyTrend.push({
        month: date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
        requests: monthRequests.length,
      });
    }

    const phaseNames = {
      solicitacao: "Solicitação",
      aprovacao_a1: "Aprovação A1",
      cotacao: "Cotação",
      aprovacao_a2: "Aprovação A2",
      pedido_compra: "Pedido Compra",
      conclusao_compra: "Conclusão",
      recebimento: "Recebimento",
      arquivado: "Arquivado",
    };

    const phases = ["solicitacao", "aprovacao_a1", "cotacao", "aprovacao_a2", "pedido_compra", "conclusao_compra", "recebimento", "arquivado"];
    const phaseConversion = phases.map((phase) => ({
      name: phaseNames[phase as keyof typeof phaseNames] || phase,
      value: filteredRequests.filter((req) => req.currentPhase === phase).length,
    }));

    const topDepartments = departments
      .map((dept) => {
        const deptRequests = filteredRequests.filter((req) => {
          const cc = allCostCenters.find((c) => c.id === req.costCenterId);
          return cc ? cc.departmentId === dept.id : false;
        });
        const totalValue = deptRequests.reduce((sum, req) => sum + (Number(req.totalValue) || Number(req.availableBudget) || 0), 0);
        return { name: dept.name, totalValue, requestCount: deptRequests.length };
      })
      .filter((item) => item.totalValue > 0)
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 5);

    const suppliers = await storage.getAllSuppliers();
    const topSuppliers = suppliers
      .map((supplier) => {
        const supplierRequests = filteredRequests.filter((req) => req.chosenSupplierId === supplier.id);
        const totalValue = supplierRequests.reduce((sum, req) => sum + (Number(req.totalValue) || 0), 0);
        return { name: supplier.name, requestCount: supplierRequests.length, totalValue };
      })
      .filter((item) => item.requestCount > 0)
      .sort((a, b) => b.requestCount - a.requestCount)
      .slice(0, 5);

    const delayedRequests = filteredRequests
      .filter((req) => {
        const daysSinceCreated = (Date.now() - new Date(req.createdAt || new Date()).getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceCreated > 15 && req.currentPhase !== "arquivado";
      })
      .map((req) => ({
        id: req.id,
        requestNumber: req.requestNumber,
        phase: req.currentPhase,
        daysDelayed: Math.floor((Date.now() - new Date(req.createdAt || new Date()).getTime()) / (1000 * 60 * 60 * 24)) - 15,
      }));

    const costCenterSummary = allCostCenters
      .map((cc) => {
        const ccRequests = filteredRequests.filter((req) => req.costCenterId === cc.id);
        const totalValue = ccRequests.reduce((sum, req) => sum + (Number(req.totalValue) || Number(req.availableBudget) || 0), 0);
        return { name: cc.name, totalValue, requestCount: ccRequests.length };
      })
      .filter((item) => item.totalValue > 0)
      .sort((a, b) => b.totalValue - a.totalValue);

    let valueSaved = 0;
    try {
      const quotations = await storage.getAllQuotations();
      for (const quotation of quotations) {
        const relatedRequest = filteredRequests.find((req) => req.id === quotation.purchaseRequestId);
        if (!relatedRequest || !relatedRequest.chosenSupplierId) continue;
        const supplierQuotations = await storage.getSupplierQuotations(quotation.id);
        const chosenSupplierQuotation = supplierQuotations.find((sq) => sq.isChosen && sq.supplierId === relatedRequest.chosenSupplierId);
        if (!chosenSupplierQuotation) continue;
        
        let itemsOriginalSum = 0;
        let itemsDiscountedSum = 0;
        try {
          const items = await storage.getSupplierQuotationItems(chosenSupplierQuotation.id);
          for (const it of items || []) {
            const orig = Number((it as any).originalTotalPrice ?? (it as any).totalPrice ?? 0) || 0;
            const discCand = Number((it as any).discountedTotalPrice ?? (it as any).totalPrice ?? 0) || 0;
            const pct = Number((it as any).discountPercentage ?? 0) || 0;
            const fixed = Number((it as any).discountValue ?? 0) || 0;
            let discTotal = discCand;
            if ((it as any).discountedTotalPrice == null && (pct > 0 || fixed > 0)) {
              const pctValue = pct > 0 ? (orig * pct) / 100 : 0;
              const totalDisc = Math.max(0, pctValue + fixed);
              discTotal = Math.max(0, orig - totalDisc);
            }
            itemsOriginalSum += orig;
            itemsDiscountedSum += Math.min(orig, Math.max(0, discTotal));
          }
        } catch {}
        
        const subtotalAfterItems = itemsDiscountedSum > 0 ? itemsDiscountedSum : (chosenSupplierQuotation.subtotalValue ? Number(chosenSupplierQuotation.subtotalValue) : 0);
        let proposalDiscount = 0;
        const type = String(chosenSupplierQuotation.discountType || 'none');
        const value = Number(chosenSupplierQuotation.discountValue || 0) || 0;
        if (subtotalAfterItems > 0) {
          if (type === 'percentage' && value > 0) {
            proposalDiscount = (subtotalAfterItems * value) / 100;
          } else if (type === 'fixed' && value > 0) {
            proposalDiscount = value;
          } else if (chosenSupplierQuotation.finalValue && chosenSupplierQuotation.subtotalValue) {
            const sub = Number(chosenSupplierQuotation.subtotalValue) || 0;
            const fin = Number(chosenSupplierQuotation.finalValue) || 0;
            proposalDiscount = Math.max(0, sub - fin);
          }
        }
        
        const finalValue = chosenSupplierQuotation.finalValue ? Number(chosenSupplierQuotation.finalValue) || 0 : Math.max(0, subtotalAfterItems - proposalDiscount);
        const computedOriginal = itemsOriginalSum > 0 ? itemsOriginalSum : Math.max(0, subtotalAfterItems + proposalDiscount);
        const savings = Math.max(0, computedOriginal - finalValue);
        valueSaved += savings;
      }
    } catch (error) {
      console.error("Error calculating value saved:", error);
    }

    return {
      totalActiveRequests,
      totalProcessingValue,
      averageApprovalTime,
      approvalRate,
      requestsByDepartment,
      monthlyTrend,
      urgencyDistribution,
      phaseConversion,
      topDepartments,
      topSuppliers,
      delayedRequests,
      costCenterSummary,
      costSavings: 0,
      valueSaved,
      spendUnderManagement: totalActiveRequests > 0 ? Math.round((filteredRequests.filter((req) => req.chosenSupplierId).length / totalActiveRequests) * 100) : 0,
      contractCompliance: 0,
      slaCompliance: Math.round(100 - (delayedRequests.length / Math.max(totalActiveRequests, 1)) * 100),
      averagePurchaseOrderValue: totalActiveRequests > 0 ? Math.round(totalProcessingValue / totalActiveRequests) : 0,
      supplierPerformance: { onTimeDelivery: suppliers.length > 0 ? 95 : 0, qualityScore: suppliers.length > 0 ? 92 : 0, responseTime: suppliers.length > 0 ? 2.5 : 0 },
      budgetAnalysis: {
        plannedBudget: Math.round(totalProcessingValue * 1.15),
        actualSpend: totalProcessingValue,
        variance: totalProcessingValue > 0 ? Math.round(((totalProcessingValue * 1.15 - totalProcessingValue) / (totalProcessingValue * 1.15)) * 100) : 0,
        utilizationRate: totalProcessingValue > 0 ? Math.round((totalProcessingValue / (totalProcessingValue * 1.15)) * 100) : 0,
      },
      riskAnalysis: {
        highRiskSuppliers: Math.floor(suppliers.length * 0.1),
        criticalItems: filteredRequests.filter((req) => req.urgency === "alto" || req.urgency === "alta_urgencia").length,
        singleSourceItems: Math.floor(totalActiveRequests * 0.15),
        riskScore: delayedRequests.length > totalActiveRequests * 0.2 ? "Alto" : delayedRequests.length > totalActiveRequests * 0.1 ? "Médio" : "Baixo",
      },
      procurementEfficiency: {
        avgProcessingTime: averageApprovalTime,
        automationRate: Math.round((filteredRequests.filter((req) => req.approvedA1 !== null).length / Math.max(totalActiveRequests, 1)) * 100),
        digitalAdoption: Math.round((filteredRequests.filter((req) => req.chosenSupplierId).length / Math.max(totalActiveRequests, 1)) * 100),
      },
    };
  }
}

export const dashboardService = new DashboardService();
