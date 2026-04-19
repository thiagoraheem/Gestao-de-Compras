import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface UseConclusionDataProps {
  request: any;
  onClose?: () => void;
}

export function useConclusionData({ request, onClose }: UseConclusionDataProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isArchiving, setIsArchiving] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showAttachmentViewer, setShowAttachmentViewer] = useState(false);
  const [dataIntegrityIssues, setDataIntegrityIssues] = useState<string[]>([]);
  const [erpLogs, setErpLogs] = useState<{ time: Date; message: string; type: 'info' | 'success' | 'error' }[]>([]);

  // Fetch all related data
  const { data: items = [], isLoading: itemsLoading } = useQuery<any[]>({
    queryKey: [`/api/purchase-requests/${request.id}/items`],
  });

  const { data: purchaseOrder } = useQuery<any>({
    queryKey: [`/api/purchase-orders/by-request/${request?.id}`],
    enabled: !!request?.id,
  });

  const { data: purchaseOrderItems = [] } = useQuery<any[]>({
    queryKey: [`/api/purchase-orders/${purchaseOrder?.id}/items`],
    enabled: !!purchaseOrder?.id,
  });

  const { data: approvalHistory = [], isLoading: approvalHistoryLoading } = useQuery<any[]>({
    queryKey: [`/api/purchase-requests/${request.id}/approval-history`],
  });

  const { data: completeTimeline = [], isLoading: timelineLoading } = useQuery<any[]>({
    queryKey: [`/api/purchase-requests/${request.id}/complete-timeline`],
  });

  const { data: attachments = [], isLoading: attachmentsLoading } = useQuery<any[]>({
    queryKey: [`/api/purchase-requests/${request.id}/attachments`],
  });

  const { data: requester, isLoading: requesterLoading } = useQuery<any>({
    queryKey: [`/api/users/${request.requesterId}`],
    enabled: !!request.requesterId,
  });

  const { data: allCostCenters = [], isLoading: costCentersLoading } = useQuery<any[]>({
    queryKey: ['/api/cost-centers'],
  });

  const { data: allDepartments = [], isLoading: departmentsLoading } = useQuery<any[]>({
    queryKey: ['/api/departments'],
  });

  const costCenter = allCostCenters.find((cc: any) => cc.id === request.costCenterId);
  const department = costCenter ? allDepartments.find((d: any) => d.id === costCenter.departmentId) : null;

  const { data: quotation, isLoading: quotationLoading } = useQuery<any>({
    queryKey: [`/api/quotations/purchase-request/${request.id}`],
  });

  const { data: supplierQuotations = [], isLoading: supplierQuotationsLoading } = useQuery<any[]>({
    queryKey: [`/api/quotations/${quotation?.id}/supplier-quotations`],
    enabled: !!quotation?.id,
  });

  const selectedSupplierQuotation = supplierQuotations.find((sq: any) => sq.isChosen) || supplierQuotations[0];

  const { data: supplierQuotationItems = [], isLoading: supplierQuotationItemsLoading } = useQuery<any[]>({
    queryKey: [`/api/supplier-quotations/${selectedSupplierQuotation?.id}/items`],
    enabled: !!selectedSupplierQuotation?.id,
  });

  const { data: quotationAttachments = [], isLoading: quotationAttachmentsLoading } = useQuery<any[]>({
    queryKey: [`/api/quotations/${quotation?.id}/attachments`],
    enabled: !!quotation?.id,
  });

  const { data: receipts = [], isLoading: receiptsLoading } = useQuery<any[]>({
    queryKey: [`/api/receipts/request/${request.id}`],
    enabled: !!request.id,
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (itemsLoading || receiptsLoading) return;

    const issues: string[] = [];
    const totalReceived = purchaseOrderItems.reduce((acc, item) => acc + (parseFloat(item.quantityReceived) || 0), 0);
    
    if (receipts.length > 0) {
       const totalInReceipts = receipts.reduce((acc: number, r: any) => {
          return acc + (r.items?.reduce((iAcc: number, item: any) => iAcc + (parseFloat(item.quantity) || 0), 0) || 0);
       }, 0);
       
       if (Math.abs(totalReceived - totalInReceipts) > 0.01) {
          console.warn(`Discrepância de quantidade: Total recebido no pedido (${totalReceived}) difere da soma das notas fiscais (${totalInReceipts})`);
       }
    } else if (totalReceived > 0) {
       issues.push("Atenção: Existem registros de recebimento legados sem notas fiscais vinculadas. Os dados foram preservados e estão exibidos abaixo.");
    }

    setDataIntegrityIssues(prev => {
      const sameLength = prev.length === issues.length;
      const sameContent = sameLength && prev.every((value, index) => value === issues[index]);
      if (sameContent) return prev;
      return issues;
    });
  }, [itemsLoading, receiptsLoading, purchaseOrderItems, receipts]);

  const latestReceipt = useMemo(() => {
    if (!receipts || receipts.length === 0) return null;
    return receipts[0];
  }, [receipts]);

  const receipt = latestReceipt;
  const receiptLoading = receiptsLoading;

  const { data: auditLogs = [], isLoading: auditLogsLoading } = useQuery<any[]>({
    queryKey: [`/api/audit/logs/${request.id}`],
    enabled: !!request.id,
    refetchInterval: 5000,
  });

  function normalizeReceiptObservations(raw: any): any {
    if (!raw) return {};
    if (typeof raw === "object") return raw;
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") return parsed;
        return { general: raw };
      } catch {
        return { general: raw };
      }
    }
    return { general: String(raw) };
  }

  const receiptObs = useMemo(() => {
    if (!receipt?.observations) return {};
    return normalizeReceiptObservations(receipt.observations);
  }, [receipt]);

  const lastErpAttempt = receiptObs.lastErpAttempt || receiptObs.erp;

  useEffect(() => {
    if (lastErpAttempt) {
      setErpLogs(prev => {
        const isDuplicate = prev.some(l => l.message === lastErpAttempt.message && Math.abs(l.time.getTime() - new Date(lastErpAttempt.time).getTime()) < 1000);
        if (isDuplicate) return prev;
        return [
          {
            time: new Date(lastErpAttempt.time),
            message: lastErpAttempt.message,
            type: lastErpAttempt.success ? 'success' : 'error'
          },
          ...prev
        ];
      });
    }
  }, [lastErpAttempt]);

  const retryErpMutation = useMutation({
    mutationFn: async () => {
      if (!receipt?.id) throw new Error("Nota fiscal não encontrada");
      setErpLogs(prev => [{ time: new Date(), message: "Iniciando reenvio para o ERP...", type: 'info' }, ...prev]);
      return apiRequest(`/api/recebimentos/${receipt.id}/enviar-locador`, {
        method: "POST",
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/receipts/request/${request.id}`] });
      const isSuccess = data.status_integracao === 'integrada' || data.status_integracao === 'sucesso';
      const message = data.mensagem || (isSuccess ? "Integrado com sucesso" : "Erro na integração");
      setErpLogs(prev => [{ time: new Date(), message: `ERP Resposta: ${message}`, type: isSuccess ? 'success' : 'error' }, ...prev]);
      if (!isSuccess) {
         toast({ title: "Aviso ERP", description: `Erro na integração: ${message}`, variant: "destructive" });
      } else {
         toast({ title: "Sucesso", description: "Reenvio ao ERP realizado com sucesso!" });
      }
    },
    onError: (err: any) => {
      setErpLogs(prev => [{ time: new Date(), message: `Falha no envio: ${err.message}`, type: 'error' }, ...prev]);
      toast({ title: "Erro", description: err.message || "Erro ao reenviar para ERP", variant: "destructive" });
    }
  });

  const archiveMutation = useMutation({
    mutationFn: async (data: { conclusionObservations?: string }) => {
      return apiRequest(`/api/purchase-requests/${request.id}/archive`, {
        method: "PATCH",
        body: data,
      });
    },
    onSuccess: () => {
      toast({ title: "Sucesso", description: "Solicitação arquivada com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      onClose?.();
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message || "Erro ao arquivar solicitação", variant: "destructive" });
    },
  });

  const exportPDFMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/purchase-requests/${request.id}/completion-summary-pdf`, { method: "GET" });
      if (!response.ok) throw new Error("Erro ao gerar PDF");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `conclusao-${request.requestNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => toast({ title: "Sucesso", description: "PDF gerado com sucesso" }),
    onError: (error: any) => toast({ title: "Erro", description: error.message || "Erro ao gerar PDF", variant: "destructive" }),
  });

  const downloadPurchaseOrderPDFMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/purchase-requests/${request.id}/pdf`, {
        method: "GET", headers: { 'Content-Type': 'application/pdf' },
      });
      if (!response.ok) throw new Error("Erro ao baixar PDF do Pedido de Compra");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Pedido_Compra_${request.requestNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => toast({ title: "Sucesso", description: "PDF do Pedido de Compra baixado com sucesso!" }),
    onError: (error: any) => toast({ title: "Erro", description: error.message || "Erro ao baixar PDF do Pedido de Compra", variant: "destructive" }),
  });

  const isLoading = itemsLoading || approvalHistoryLoading || attachmentsLoading || quotationLoading || supplierQuotationItemsLoading || requesterLoading || costCentersLoading || departmentsLoading || quotationAttachmentsLoading || timelineLoading;

  return {
    items, purchaseOrder, purchaseOrderItems, approvalHistory, completeTimeline, attachments, requester, costCenter, department,
    quotation, supplierQuotations, selectedSupplierQuotation, supplierQuotationItems, quotationAttachments, receipts,
    dataIntegrityIssues, receipt, auditLogs, erpLogs, isArchiving, setIsArchiving, showArchiveDialog, setShowArchiveDialog,
    showAttachmentViewer, setShowAttachmentViewer, retryErpMutation, archiveMutation, exportPDFMutation, downloadPurchaseOrderPDFMutation,
    isLoading, timelineLoading
  };
}
