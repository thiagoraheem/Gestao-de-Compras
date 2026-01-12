import React, { useState, forwardRef, useImperativeHandle, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import PdfViewer from "./pdf-viewer";
import { Eye, X, FileText, Check, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import PendencyModal from "./pendency-modal";
import { ReceiptProvider, useReceipt } from "./receipt/ReceiptContext";
import { ReceiptBasicInfo } from "./receipt/ReceiptBasicInfo";
import { ReceiptManualEntry } from "./receipt/ReceiptManualEntry";
import { ReceiptXmlImport } from "./receipt/ReceiptXmlImport";
import { ReceiptFinancial } from "./receipt/ReceiptFinancial";
import { ReceiptSupplierInfo } from "./receipt/ReceiptSupplierInfo";
import { useReceiptActions } from "./receipt/useReceiptActions";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Truck } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

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
    mode
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Conferência Fiscal</h2>
          <p className="text-muted-foreground">
            Valide as notas fiscais e informações financeiras.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              "flex gap-1",
              activeRequest?.fiscalReceiptAt
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
            )}
          >
            {activeRequest?.fiscalReceiptAt ? (
              <Check className="w-3 h-3" />
            ) : (
              <Clock className="w-3 h-3" />
            )}
            {activeRequest?.fiscalReceiptAt ? "Conf. Fiscal Concluída" : "Conf. Fiscal Pendente"}
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab === 'items' ? 'fiscal' : activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-[600px] transition-all duration-300">
          <TabsTrigger value="fiscal">Info. Básicas</TabsTrigger>
          <TabsTrigger value="xml">XML / Importação</TabsTrigger>
          <TabsTrigger value="manual_nf">Inclusão Manual</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
        </TabsList>

        <TabsContent value="fiscal">
          <div className="space-y-6">
            <ReceiptBasicInfo />
            <ReceiptSupplierInfo />
            
            {/* Purchase Order Observations */}
            {(request.purchaseOrderObservations || request.purchaseObservations) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    Observações do Pedido de Compra
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-sm text-blue-800 dark:text-blue-300 whitespace-pre-wrap">
                      {request.purchaseOrderObservations || request.purchaseObservations || 'Nenhuma observação encontrada'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Items Summary Table for Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle>Itens da Compra</CardTitle>
              </CardHeader>
              <CardContent>
                {itemsWithPrices && itemsWithPrices.length > 0 ? (
                  <div className="rounded-md border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="text-center">Qtd</TableHead>
                          <TableHead className="text-center">Unidade</TableHead>
                          <TableHead className="text-right">Valor Unit.</TableHead>
                          <TableHead className="text-right">Valor Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {itemsWithPrices.map((item: any, index: number) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">
                              {item.description}
                            </TableCell>
                            <TableCell className="text-center">
                              {Number(item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="text-center">
                              {item.unit}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(item.unitPrice)}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(item.totalPrice)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="border-t border-border bg-slate-50 dark:bg-slate-900 p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                          Subtotal ({itemsWithPrices.length} {itemsWithPrices.length === 1 ? 'item' : 'itens'})
                        </span>
                        <span className="text-base font-semibold text-slate-800 dark:text-slate-200">
                          {formatCurrency(
                            itemsWithPrices.reduce((total: number, item: any) => total + (item.totalPrice || 0), 0)
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-blue-600 dark:text-blue-300 flex items-center gap-1">
                          <Truck className="h-4 w-4" />
                          Frete
                        </span>
                        <span className="text-base font-semibold text-blue-600 dark:text-blue-300">
                          {freightValue > 0 ? formatCurrency(freightValue) : 'Não incluso'}
                        </span>
                      </div>
                      <div className="border-t pt-3">
                        <div className="flex justify-between items-center">
                          <span className="text-base font-bold text-slate-800 dark:text-slate-200">
                            Total Geral
                          </span>
                          <span className="text-xl font-bold text-green-600 dark:text-green-400">
                            {formatCurrency(
                              (itemsWithPrices.reduce((total: number, item: any) => total + (item.totalPrice || 0), 0) || 0) + (freightValue || 0)
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                    <p>Nenhum item encontrado</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Approval History */}
            {Array.isArray(approvalHistory) && approvalHistory.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Histórico de Aprovações</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(approvalHistory as any[]).map((history: any, index: number) => (
                      <div key={index} className="flex items-start space-x-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-border">
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">
                              {history.approver?.firstName} {history.approver?.lastName}
                            </p>
                            <Badge variant={history.approved ? "default" : "destructive"}>
                              {history.approved ? "Aprovado" : "Rejeitado"}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                            {formatDate(history.createdAt)}
                          </p>
                          {history.rejectionReason && (
                            <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                              <strong>Motivo:</strong> {history.rejectionReason}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

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
