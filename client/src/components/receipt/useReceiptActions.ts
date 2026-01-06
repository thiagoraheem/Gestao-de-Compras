import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useReceipt } from "./ReceiptContext";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export function useReceiptActions() {
  const {
    request,
    receiptType,
    purchaseOrder,
    manualNFNumber,
    manualNFSeries,
    manualNFIssueDate,
    manualNFEntryDate,
    manualTotal,
    manualNFAccessKey,
    manualItems,
    nfReceiptId,
    setNfReceiptId,
    paymentMethodCode,
    invoiceDueDate,
    allocations,
    allocationMode,
    setActiveTab,
    receivedQuantities,
    setIsPendencyModalOpen,
    onClose,
  } = useReceipt();

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const confirmPhysicalMutation = useMutation({
    mutationFn: async () => {
      const hasAnyQty = Object.values(receivedQuantities).some(v => Number(v) > 0);
      if (!hasAnyQty) throw new Error("Informe as quantidades recebidas");

      const response = await apiRequest(
        `/api/purchase-requests/${request.id}/confirm-physical`,
        {
          method: "POST",
          body: {
            receivedQuantities,
            observations: "Confirmado via Recebimento Físico"
          },
        }
      );
      return response;
    },
    onSuccess: async (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      toast({ title: "Sucesso", description: "Recebimento físico confirmado!" });
      
      if (data.isFullyComplete) {
         try {
           await apiRequest(`/api/purchase-requests/${request.id}/finalize-receipt`, { method: "POST" });
           toast({ title: "Processo Concluído", description: "Recebimento finalizado e integrado!" });
         } catch (e) {
           console.error("Error finalizing", e);
         }
      }
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message || "Erro ao confirmar", variant: "destructive" });
    }
  });

  const reportIssueMutation = useMutation({
    mutationFn: async (pendencyReason: string) => {
      // Assuming user ID is handled on backend via session or we need to pass it?
      // Original code used user?.id. Context has user? No. Context has useAuth? 
      // useReceipt uses useAuth internally but doesn't expose user.
      // But apiRequest usually handles auth cookie.
      // However, the backend endpoint expects reportedById in body?
      // Let's check original code: body: { reportedById: user?.id, pendencyReason }
      // If I don't have user here, I should get it from useAuth.
      const response = await apiRequest(`/api/purchase-requests/${request.id}/report-issue`, {
        method: "POST",
        body: { reportedById: user?.id, pendencyReason },
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      setIsPendencyModalOpen(false);
      toast({
        title: "Pendência Reportada",
        description: "Item retornado para Pedido de Compra com tag de pendência.",
        variant: "destructive",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível reportar a pendência",
        variant: "destructive",
      });
    },
  });

  const confirmNfMutation = useMutation({
    mutationFn: async () => {
      const normalizedItems = receiptType === "servico"
        ? manualItems.map((item: any, index: number) => ({
            lineNumber: index + 1,
            description: item.description,
            unit: item.unit || "SV",
            quantity: 1,
            unitPrice: Number(item.netValue ?? item.unitPrice ?? 0),
            totalPrice: Number(item.netValue ?? item.unitPrice ?? 0),
            purchaseOrderItemId: item.purchaseOrderItemId,
          }))
        : manualItems.map((item: any, index: number) => ({
            lineNumber: index + 1,
            description: item.description,
            unit: item.unit || "UN",
            quantity: Number(item.quantity ?? 0),
            unitPrice: Number(item.unitPrice ?? 0),
            totalPrice: Number((Number(item.quantity ?? 0) * Number(item.unitPrice ?? 0)).toFixed(2)),
            ncm: item.ncm,
            purchaseOrderItemId: item.purchaseOrderItemId,
          }));
          
      return apiRequest(`/api/purchase-requests/${request?.id}/confirm-nf`, {
        method: "POST",
        body: {
          receiptType,
          purchaseOrderId: purchaseOrder?.id,
          nfNumber: manualNFNumber,
          nfSeries: manualNFSeries,
          nfIssueDate: manualNFIssueDate,
          nfEntryDate: manualNFEntryDate,
          nfTotal: manualTotal,
          nfAccessKey: manualNFAccessKey,
          manualItems: receiptType === "avulso" ? [] : normalizedItems,
          xmlReceiptId: nfReceiptId,
          paymentMethodCode,
          invoiceDueDate,
          allocations,
          allocationMode,
        },
      });
    },
    onSuccess: (data: any) => {
      if (data?.receipt?.id) setNfReceiptId(data.receipt.id);
      queryClient.invalidateQueries({ queryKey: [`/api/purchase-requests/${request?.id}/nf-status`] });
      toast({ title: "NF confirmada", description: "Nota Fiscal validada com sucesso." });
      setActiveTab("financeiro");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao confirmar NF",
        description: error?.message || "Não foi possível confirmar a Nota Fiscal.",
        variant: "destructive",
      });
    },
  });

  return {
    confirmNfMutation,
    confirmPhysicalMutation,
    reportIssueMutation
  };
}
