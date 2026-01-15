import React, { useState, forwardRef, useImperativeHandle, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import PdfViewer from "./pdf-viewer";
import { Eye, X, FileText, Check, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import PendencyModal from "./pendency-modal";
import { ReceiptProvider, useReceipt } from "./receipt/ReceiptContext";
import { ReceiptManualEntry } from "./receipt/ReceiptManualEntry";
import { ReceiptXmlImport } from "./receipt/ReceiptXmlImport";
import { ReceiptFinancial } from "./receipt/ReceiptFinancial";
import { useReceiptActions } from "./receipt/useReceiptActions";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import PurchaseRequestHeaderCard from "./purchase-request-header-card";
import { PHASE_LABELS } from "@/lib/types";
import { formatCurrency } from "@/lib/currency";

export interface FiscalConferencePhaseProps {
  request: any;
  onClose: () => void;
  mode?: 'view' | 'physical' | 'fiscal';
  onPreviewOpen?: () => void;
  onPreviewClose?: () => void;
  className?: string;
  hideTabsByDefault?: boolean;
}

export interface FiscalConferencePhaseHandle {
  reset: () => void;
  previewPDF: () => void;
  downloadPDF: () => void;
}

const FiscalConferencePhaseContent = forwardRef<FiscalConferencePhaseHandle, FiscalConferencePhaseProps>((props, ref) => {
  const { onPreviewOpen, onPreviewClose, className } = props;
  const {
    activeTab, setActiveTab,
    request,
    activeRequest,
    onClose,
    isPendencyModalOpen, setIsPendencyModalOpen,
    approvalHistory,
    itemsWithPrices,
    freightValue,
    mode,
    purchaseOrder,
    selectedSupplier
  } = useReceipt();

  const { reportIssueMutation } = useReceiptActions();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Custom Mutation for Fiscal Confirmation (Transitions to Conclusion)
  const confirmFiscalMutation = useMutation({
    mutationFn: async () => {
      // Check if fiscal receipt is already done
      if (activeRequest?.fiscalReceiptAt) return;
      
      const response = await apiRequest(
        `/api/purchase-requests/${request.id}/confirm-fiscal`,
        { method: "POST" }
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      toast({ title: "Sucesso", description: "Conferência fiscal confirmada! Movendo para Conclusão." });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message || "Erro ao confirmar fiscal", variant: "destructive" });
    }
  });

  // Local state for PDF Preview
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfBuffer, setPdfBuffer] = useState<ArrayBuffer | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.byteLength; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    return window.btoa(binary);
  };

  const handlePreviewPDF = async () => {
    try { onPreviewOpen && onPreviewOpen(); } catch { }
    setIsLoadingPreview(true);
    setShowPreviewModal(true);
    try {
      const response = await fetch(`/api/purchase-requests/${request.id}/pdf`, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error('Falha ao gerar PDF');
      }

      const contentType = response.headers.get('content-type') || '';
      const buffer = await response.arrayBuffer();
      setPdfBuffer(buffer);
      const base64 = arrayBufferToBase64(buffer);
      const url = `data:application/pdf;base64,${base64}`;
      setPdfPreviewUrl(url);
      setShowPreviewModal(true);

      if (contentType.includes('application/pdf')) {
        toast({
          title: "Sucesso",
          description: "Pré-visualização do PDF carregada com sucesso!",
        });
      } else if (contentType.includes('text/html')) {
        toast({
          title: "Aviso",
          description: "PDF não pôde ser gerado. Exibindo documento em HTML.",
        });
      } else {
        toast({
          title: "Aviso",
          description: "Formato de arquivo inesperado na pré-visualização.",
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao carregar pré-visualização do PDF",
        variant: "destructive",
      });
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const response = await fetch(`/api/purchase-requests/${request.id}/pdf`, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store'
      });
      if (!response.ok) throw new Error('Falha ao baixar PDF');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pedido-${request.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: "Sucesso", description: "Download iniciado" });
    } catch (error) {
      toast({ title: "Erro", description: "Falha ao baixar PDF", variant: "destructive" });
    }
  };

  useImperativeHandle(ref, () => ({
    reset: () => {
      // Logic to reset if needed
    },
    previewPDF: handlePreviewPDF,
    downloadPDF: handleDownloadPDF
  }));

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: ptBR });
    } catch {
      return dateString;
    }
  };

  // Force active tab to fiscal if current tab is items
  useEffect(() => {
    if (activeTab === 'items') {
      setActiveTab('fiscal');
    }
  }, [activeTab, setActiveTab]);

  return (
    <div className={cn("flex flex-col h-full bg-slate-50/50 dark:bg-slate-900/50 transition-all duration-300", className)}>
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Conferência Fiscal</h2>
            <p className="text-muted-foreground">
              Valide as notas fiscais e informações financeiras.
            </p>
          </div>
        </div>

        <PurchaseRequestHeaderCard
          context="fiscal"
          requestNumber={request?.requestNumber}
          orderNumber={purchaseOrder?.orderNumber}
          requesterName={request?.requester ? `${request.requester.firstName} ${request.requester.lastName}` : "N/A"}
          supplierName={selectedSupplier?.name || request?.chosenSupplier?.name || "Não definido"}
          orderDate={formatDate(purchaseOrder?.createdAt || request?.createdAt || null)}
          totalValue={typeof request?.totalValue === "number" ? formatCurrency(request.totalValue) : "R$ 0,00"}
          status={(request?.phase && (PHASE_LABELS as any)[request.phase as keyof typeof PHASE_LABELS]) || "—"}
        />
      </div>

      <Tabs value={activeTab === 'items' ? 'fiscal' : activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-[600px] transition-all duration-300">
          <TabsTrigger value="xml">XML / Importação</TabsTrigger>
          <TabsTrigger value="manual_nf">Inclusão Manual</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
        </TabsList>

        <TabsContent value="manual_nf">
          <ReceiptManualEntry />
        </TabsContent>

        <TabsContent value="xml">
          <ReceiptXmlImport />
        </TabsContent>

        <TabsContent value="financeiro">
          <ReceiptFinancial />
        </TabsContent>
      </Tabs>

      <Separator className="my-6" />

      {/* Action Buttons */}
      <div className="sticky bottom-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm pt-4 pb-2 border-t border-slate-200 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto order-last sm:order-first"
          >
            Fechar
          </Button>
          <Button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handlePreviewPDF();
            }}
            disabled={isLoadingPreview}
            variant="outline"
            className="w-full sm:w-auto border-green-600 text-green-600 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-900/20"
          >
            <Eye className="w-4 h-4 mr-2" />
            {isLoadingPreview ? "Carregando..." : "Visualizar PDF"}
          </Button>

          <Button
            variant="destructive"
            onClick={() => setIsPendencyModalOpen(true)}
            disabled={reportIssueMutation.isPending}
            className="w-full sm:w-auto flex items-center justify-center"
          >
            <X className="mr-2 h-4 w-4 flex-shrink-0" />
            <span className="truncate">Reportar Pendência</span>
          </Button>
          
          <Button
            className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600"
            onClick={() => confirmFiscalMutation.mutate()}
            disabled={confirmFiscalMutation.isPending || !!activeRequest?.fiscalReceiptAt}
          >
            {activeRequest?.fiscalReceiptAt ? "Fiscal OK" : "Concluir Conferência Fiscal"}
          </Button>
        </div>
      </div>

      <PendencyModal
        isOpen={isPendencyModalOpen}
        onClose={() => setIsPendencyModalOpen(false)}
        onConfirm={(reason) => reportIssueMutation.mutate(reason)}
        isLoading={reportIssueMutation.isPending}
      />

      <Dialog open={showPreviewModal} onOpenChange={(v) => {
        setShowPreviewModal(v);
        if (!v && onPreviewClose) onPreviewClose();
      }}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col" aria-describedby="pdf-preview-desc">
          <DialogTitle>Visualizar PDF</DialogTitle>
          <p id="pdf-preview-desc" className="sr-only">Pré-visualização do PDF do pedido selecionado</p>
          <div className="flex-1 w-full bg-slate-100 rounded-md overflow-hidden">
            {pdfBuffer && <PdfViewer data={pdfBuffer} className="w-full h-full" />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
});

const FiscalConferencePhase = forwardRef<FiscalConferencePhaseHandle, FiscalConferencePhaseProps>((props, ref) => {
  return (
    <ReceiptProvider request={props.request} onClose={props.onClose} mode="fiscal">
      <FiscalConferencePhaseContent {...props} ref={ref} />
    </ReceiptProvider>
  );
});

export default FiscalConferencePhase;
