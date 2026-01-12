import React, { useState, forwardRef, useImperativeHandle, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import PdfViewer from "./pdf-viewer";
import { Eye, X, Check, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import PendencyModal from "./pendency-modal";
import { ReceiptProvider, useReceipt } from "./receipt/ReceiptContext";
import { ReceiptItems } from "./receipt/ReceiptItems";
import { useReceiptActions } from "./receipt/useReceiptActions";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ReceiptPhaseProps {
  request: any;
  onClose: () => void;
  mode?: 'view' | 'physical' | 'fiscal';
  onPreviewOpen?: () => void;
  onPreviewClose?: () => void;
  className?: string;
  hideTabsByDefault?: boolean;
}

export interface ReceiptPhaseHandle {
  reset: () => void;
  previewPDF: () => void;
  downloadPDF: () => void;
}

const ReceiptPhaseContent = forwardRef<ReceiptPhaseHandle, ReceiptPhaseProps>((props, ref) => {
  const { onPreviewOpen, onPreviewClose, className } = props;
  const {
    activeTab, setActiveTab,
    request,
    activeRequest,
    onClose,
    canPerformReceiptActions,
    isPendencyModalOpen, setIsPendencyModalOpen,
    itemsWithPrices,
    receivedQuantities,
    manualNFNumber, setManualNFNumber,
    manualNFSeries, setManualNFSeries,
    purchaseOrder,
  } = useReceipt();

  const isAllItemsConfirmed = React.useMemo(() => {
     if (!itemsWithPrices || itemsWithPrices.length === 0) return false;
     
     // Check if any item has excess
     const hasExcess = itemsWithPrices.some((it: any) => {
        const prev = Number(it.quantityReceived || 0);
        const current = Number(receivedQuantities[it.id] || 0);
        const max = Number(it.quantity || 0);
        return (prev + current) > max;
     });
     
     if (hasExcess) return false;

     // Check if all items are fully received (exact match)
     return itemsWithPrices.every((it: any) => {
        const prev = Number(it.quantityReceived || 0);
        const current = Number(receivedQuantities[it.id] || 0);
        const max = Number(it.quantity || 0);
        return (prev + current) === max;
     });
  }, [itemsWithPrices, receivedQuantities]);

  const { confirmPhysicalMutation, reportIssueMutation } = useReceiptActions();
  const { toast } = useToast();

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

  // Force active tab to items
  useEffect(() => {
    if (activeTab !== 'items') {
      setActiveTab('items');
    }
  }, [activeTab, setActiveTab]);

  return (
    <div className={cn("flex flex-col h-full bg-slate-50/50 dark:bg-slate-900/50 transition-all duration-300", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Recebimento Físico</h2>
          <p className="text-muted-foreground">
            Confirme o recebimento físico dos itens do pedido.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              "flex gap-1",
              activeRequest?.physicalReceiptAt
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
            )}
          >
            {activeRequest?.physicalReceiptAt ? (
              <Check className="w-3 h-3" />
            ) : (
              <Clock className="w-3 h-3" />
            )}
            {activeRequest?.physicalReceiptAt ? "Recebimento Físico Concluído" : "Recebimento Físico Pendente"}
          </Badge>
        </div>
      </div>

      {/* Purchase Info Summary */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-border">
         <div>
            <p className="text-xs text-muted-foreground uppercase font-bold">Solicitação / Pedido</p>
            <p className="font-medium text-base text-blue-600">
               #{request.requestNumber} {request.purchaseOrderNumber ? `/ ${request.purchaseOrderNumber}` : ''}
            </p>
         </div>
         <div>
            <p className="text-xs text-muted-foreground uppercase font-bold">Solicitante</p>
            <p className="font-medium">
               {request.requester?.firstName} {request.requester?.lastName}
            </p>
         </div>
         <div>
            <p className="text-xs text-muted-foreground uppercase font-bold">Fornecedor</p>
            <p className="font-medium">
               {request.chosenSupplier?.name || "Não informado"}
            </p>
         </div>
         <div>
            <p className="text-xs text-muted-foreground uppercase font-bold">Data do Pedido</p>
            <p className="font-medium">
               {request.purchaseOrderDate ? new Date(request.purchaseOrderDate).toLocaleDateString('pt-BR') : formatDistanceToNow(new Date(request.createdAt), { addSuffix: true, locale: ptBR })}
            </p>
         </div>
         <div>
            <p className="text-xs text-muted-foreground uppercase font-bold">Valor Total</p>
            <p className="font-medium">
               {request.purchaseOrderValue ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(request.purchaseOrderValue)) : 'R$ 0,00'}
            </p>
         </div>
         <div>
            <p className="text-xs text-muted-foreground uppercase font-bold">Status Atual</p>
            <p className="font-medium">
               <Badge variant="outline" className="capitalize">{request.currentPhase?.replace('_', ' ') || 'Pendente'}</Badge>
            </p>
         </div>
      </div>

      <div className="space-y-4">
          <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-800 mb-4">
            <h3 className="text-sm font-semibold mb-3">Dados da Nota Fiscal</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nf-number">Número da Nota Fiscal</Label>
                <Input
                  id="nf-number"
                  placeholder="NF-00000000"
                  value={manualNFNumber}
                  onChange={(e) => setManualNFNumber(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="nf-series">Série</Label>
                <Input
                  id="nf-series"
                  placeholder="S-000"
                  value={manualNFSeries}
                  onChange={(e) => setManualNFSeries(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
          <ReceiptItems />
      </div>

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

          {canPerformReceiptActions && (
            <>
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
                onClick={() => confirmPhysicalMutation.mutate()}
                disabled={confirmPhysicalMutation.isPending || !!activeRequest?.physicalReceiptAt || !isAllItemsConfirmed}
                className={cn(
                  "w-full sm:w-auto flex items-center justify-center",
                  isAllItemsConfirmed ? "bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600" : "opacity-50 cursor-not-allowed"
                )}
                title={!isAllItemsConfirmed ? "Confirme a quantidade recebida de todos os itens para prosseguir" : ""}
              >
                <Check className="mr-2 h-4 w-4 flex-shrink-0" />
                <span className="truncate">Confirmar Recebimento Físico</span>
              </Button>
            </>
          )}
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

const ReceiptPhase = forwardRef<ReceiptPhaseHandle, ReceiptPhaseProps>((props, ref) => {
  return (
    <ReceiptProvider request={props.request} onClose={props.onClose} mode="physical">
      <ReceiptPhaseContent {...props} ref={ref} />
    </ReceiptProvider>
  );
});

export default ReceiptPhase;
