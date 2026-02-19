import React, { useState, useMemo, useEffect, forwardRef, useImperativeHandle } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import PdfViewer from "./pdf-viewer";
import { ErrorBoundary } from "./error-boundary";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { X, Check, User, FileText, Download, Eye, Plus, ArrowLeft, History } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PHASE_LABELS } from "@/lib/types";
import { formatCurrency } from "@/lib/currency";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import PendencyModal from "./pendency-modal";
import PurchaseRequestHeaderCard from "./purchase-request-header-card";

interface ReceiptPhaseProps {
  request: any;
  onClose: () => void;
  className?: string;
  onPreviewOpen?: () => void;
  onPreviewClose?: () => void;
  mode?: 'view' | 'physical';
  hideTabsByDefault?: boolean;
  compactHeader?: boolean;
}

export interface ReceiptPhaseHandle {
  previewPDF: () => void;
  downloadPDF: () => void;
}

const ReceiptPhase = forwardRef((props: ReceiptPhaseProps, ref: React.Ref<ReceiptPhaseHandle>) => {
  const { request, onClose, className, onPreviewOpen, onPreviewClose, mode = 'view' } = props;
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'dashboard' | 'new_receipt'>('dashboard');

  // --- PDF Logic ---
  const [isDownloading, setIsDownloading] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfBuffer, setPdfBuffer] = useState<ArrayBuffer | null>(null);
  const [previewMimeType, setPreviewMimeType] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewLoaded, setPreviewLoaded] = useState(false);

  // --- Receipt Form State ---
  const [receivedQuantities, setReceivedQuantities] = useState<Record<number, number>>({});
  const [manualNFNumber, setManualNFNumber] = useState<string>("");
  const [manualNFSeries, setManualNFSeries] = useState<string>("");
  const [isPendencyModalOpen, setIsPendencyModalOpen] = useState(false);

  // Check permissions
  const canPerformReceiptActions = user?.isReceiver || user?.isAdmin;

  // --- Data Fetching ---
  const { data: purchaseOrder } = useQuery<any>({
    queryKey: [`/api/purchase-orders/by-request/${request?.id}`],
    enabled: !!request?.id,
  });

  const { data: items = [] } = useQuery<any[]>({
    queryKey: [`/api/purchase-orders/${purchaseOrder?.id}/items`],
    enabled: !!purchaseOrder?.id,
  });

  // Fetch existing receipts
  const { data: existingReceipts = [] } = useQuery<any[]>({
    queryKey: [`/api/purchase-orders/${purchaseOrder?.id}/receipts`],
    enabled: !!purchaseOrder?.id,
  });

  const { data: quotation } = useQuery<any>({
    queryKey: [`/api/quotations/purchase-request/${request.id}`],
  });

  const { data: supplierQuotations = [] } = useQuery<any[]>({
    queryKey: [`/api/quotations/${quotation?.id}/supplier-quotations`],
    enabled: !!quotation?.id,
  });

  const selectedSupplierQuotation: any = supplierQuotations.find((sq: any) => sq.isChosen === true) || supplierQuotations[0];
  const { data: selectedSupplier } = useQuery<any>({
    queryKey: [`/api/suppliers/${selectedSupplierQuotation?.supplierId}`],
    enabled: !!selectedSupplierQuotation?.supplierId,
  });

  // --- Mutations ---
  const confirmPhysicalMutation = useMutation({
    mutationFn: async () => {
      const hasAnyQty = Object.values(receivedQuantities).some(v => Number(v) > 0);
      if (!hasAnyQty) throw new Error("Informe as quantidades recebidas");
      if (!manualNFNumber) throw new Error("Informe o número da Nota Fiscal");

      const response = await apiRequest(
        `/api/purchase-requests/${request?.id}/confirm-physical`,
        {
          method: "POST",
          body: {
            receivedQuantities,
            manualNFNumber,
            manualNFSeries,
            observations: "Confirmado via Recebimento Físico"
          },
        }
      );
      return response;
    },
    onSuccess: async (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      queryClient.invalidateQueries({ queryKey: [`/api/purchase-orders/${purchaseOrder?.id}/receipts`] });
      queryClient.invalidateQueries({ queryKey: [`/api/purchase-orders/${purchaseOrder?.id}/items`] });
      
      toast({ title: "Sucesso", description: "Recebimento físico registrado!" });
      setViewMode('dashboard');
      setReceivedQuantities({});
      setManualNFNumber("");
      setManualNFSeries("");
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message || "Erro ao confirmar", variant: "destructive" });
    }
  });

  const reportIssueMutation = useMutation({
    mutationFn: async (pendencyReason: string) => {
      const response = await apiRequest(`/api/purchase-requests/${request.id}/report-issue`, {
        method: "POST",
        body: { reportedById: user?.id, pendencyReason, receivedQuantities },
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
      toast({ title: "Erro", description: "Não foi possível reportar a pendência", variant: "destructive" });
    },
  });

  // --- Helper Functions ---
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

      if (!response.ok) throw new Error('Falha ao gerar PDF');

      const contentType = response.headers.get('content-type') || '';
      const buffer = await response.arrayBuffer();
      setPdfBuffer(buffer);
      const base64 = arrayBufferToBase64(buffer);
      const url = `data:application/pdf;base64,${base64}`;
      setPdfPreviewUrl(url);
      setPreviewMimeType(contentType);
      setPreviewLoaded(false);
      
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
      toast({ title: "Erro", description: "Falha ao carregar pré-visualização do PDF", variant: "destructive" });
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch(`/api/purchase-requests/${request.id}/pdf`, { method: 'GET' });
      if (!response.ok) throw new Error('Falha ao gerar PDF');
      
      const contentType = response.headers.get('Content-Type') || '';
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `Pedido_Compra_${request.requestNumber}.${contentType.includes('application/pdf') ? 'pdf' : contentType.includes('text/html') ? 'html' : 'bin'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Sucesso",
        description: contentType.includes('application/pdf') ? "PDF do pedido de compra baixado com sucesso!" : "Documento alternativo baixado com sucesso!",
      });
    } catch (error) {
      toast({ title: "Erro", description: "Falha ao baixar PDF", variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleClosePreview = () => {
    try { onPreviewClose && onPreviewClose(); } catch { }
    setShowPreviewModal(false);
    if (pdfPreviewUrl) {
      window.URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(null);
    }
    setPreviewMimeType(null);
  };

  const handleDownloadFromPreview = () => {
    if (pdfPreviewUrl) {
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = pdfPreviewUrl;
      a.download = `Pedido_Compra_${request.requestNumber}.${previewMimeType && previewMimeType.includes('text/html') ? 'html' : 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      toast({
        title: "Sucesso",
        description: previewMimeType && previewMimeType.includes('application/pdf') ? "PDF do pedido de compra baixado com sucesso!" : "Documento alternativo baixado com sucesso!",
      });
    }
  };

  useImperativeHandle(ref, () => ({
    previewPDF: handlePreviewPDF,
    downloadPDF: handleDownloadPDF,
  }));

  const formatDate = (date: any) => {
    if (!date) return "N/A";
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR });
  };

  // --- Calculations ---
  const itemsWithPrices = useMemo(() => {
    if (!Array.isArray(items)) return [];
    return items.map(item => {
      const unitPrice = Number(item.unitPrice) || 0;
      const quantity = Number(item.quantity) || 0;
      const totalPrice = Number(item.totalPrice) || 0;
      return {
        ...item,
        unitPrice,
        quantity,
        totalPrice,
      };
    });
  }, [items]);

  const canConfirm = useMemo(() => {
    // Basic validation: must have some quantity and NF number
    const hasAnyQty = Object.values(receivedQuantities).some(v => Number(v) > 0);
    return hasAnyQty && manualNFNumber.length > 0;
  }, [receivedQuantities, manualNFNumber]);

  // --- Render Preview Modal ---
  if (showPreviewModal) {
    return (
      <div className={cn("flex flex-col h-full", className)}>
        <div className="flex-shrink-0 bg-background border-b border-border sticky top-0 z-30 pb-3 mb-4 rounded-t-lg">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Pré-visualização - Pedido de Compra {request.requestNumber}</h3>
            <div className="flex gap-2">
              <Button onClick={handleDownloadFromPreview} size="sm" className="bg-green-600 hover:bg-green-700">
                <Download className="w-4 h-4 mr-2" />
                Baixar PDF
              </Button>
              <Button onClick={handleClosePreview} size="sm" variant="outline">
                <X className="w-4 h-4 mr-2" />
                Voltar
              </Button>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-hidden flex flex-col min-h-[60vh]">
          {pdfBuffer ? (
            <ErrorBoundary fallback={
              <div className="flex items-center justify-center h-full p-6 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 rounded-lg">
                <p>Erro ao exibir PDF. O arquivo pode estar corrompido ou ser incompatível.</p>
              </div>
            }>
              <PdfViewer data={pdfBuffer} />
            </ErrorBoundary>
          ) : (
             <div className="flex items-center justify-center h-[70vh] bg-slate-100 dark:bg-slate-800 rounded-lg border border-border">
               <div className="text-center">
                 <FileText className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto mb-4" />
                 <p className="text-slate-600 dark:text-slate-300">Carregando pré-visualização...</p>
               </div>
             </div>
          )}
        </div>
      </div>
    );
  }

  // --- Render Dashboard ---
  if (viewMode === 'dashboard') {
    return (
      <div className={cn("space-y-6", className)}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Gerenciamento de Recebimento</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">Histórico de NFs e status do pedido</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handlePreviewPDF}
              disabled={isLoadingPreview}
              className="border-green-600 text-green-600 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-900/20"
            >
               <Eye className="w-4 h-4 mr-2" />
               {isLoadingPreview ? "Carregando..." : "Visualizar PDF"}
            </Button>
            
            <Button 
               onClick={handleDownloadPDF}
               disabled={isDownloading}
               className="bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
            >
               <Download className="w-4 h-4 mr-2" />
               {isDownloading ? "Baixando..." : "Baixar PDF"}
            </Button>

            <Button variant="outline" onClick={onClose}>Fechar</Button>
            {canPerformReceiptActions && (
              <Button onClick={() => setViewMode('new_receipt')}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Recebimento
              </Button>
            )}
          </div>
        </div>

        <PurchaseRequestHeaderCard
          context="physical"
          requestNumber={request?.requestNumber}
          orderNumber={purchaseOrder?.orderNumber}
          requesterName={request?.requester ? `${request.requester.firstName} ${request.requester.lastName}` : "N/A"}
          supplierName={selectedSupplier?.name || "Não definido"}
          orderDate={formatDate(purchaseOrder?.createdAt || request?.createdAt || null)}
          totalValue={formatCurrency(purchaseOrder?.totalValue ?? request?.totalValue ?? 0)}
          //totalValue={typeof request?.totalValue === "number" ? formatCurrency(request.totalValue) : "R$ 0,00"}
          status={(request?.phase && (PHASE_LABELS as any)[request.phase]) || "—"}
          creationDate={request?.createdAt ? format(new Date(request.createdAt), "dd/MM/yyyy HH:mm") : "N/A"}
        />

        {/* Global Progress */}
        <Card>
          <CardHeader>
            <CardTitle>Progresso do Pedido</CardTitle>
            <CardDescription>Visão geral dos itens recebidos vs solicitados</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="space-y-4">
               {itemsWithPrices.map((item: any) => {
                 const percent = item.quantity > 0 ? Math.min(100, (item.quantityReceived / item.quantity) * 100) : 0;
                 return (
                   <div key={item.id} className="space-y-1">
                     <div className="flex justify-between text-sm">
                       <span>{item.description}</span>
                       <span className="text-muted-foreground">{Number(item.quantityReceived).toLocaleString('pt-BR')} / {Number(item.quantity).toLocaleString('pt-BR')}</span>
                     </div>
                     <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                       <div className="h-full bg-primary transition-all" style={{ width: `${percent}%` }} />
                     </div>
                   </div>
                 );
               })}
             </div>
          </CardContent>
        </Card>

        {/* Receipt History List */}
        <Card>
          <CardHeader>
             <CardTitle>Histórico de Recebimentos (NFs)</CardTitle>
          </CardHeader>
          <CardContent>
            {existingReceipts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Nenhum recebimento registrado.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número NF</TableHead>
                    <TableHead>Série</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Recebido Por</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {existingReceipts.map((rec: any) => (
                    <TableRow key={rec.id}>
                      <TableCell>{rec.documentNumber || 'N/A'}</TableCell>
                      <TableCell>{rec.documentSeries || '-'}</TableCell>
                      <TableCell>{format(new Date(rec.createdAt), "dd/MM/yyyy HH:mm")}</TableCell>
                      <TableCell>
                        <Badge variant={rec.status === 'conf_fisica' ? 'secondary' : rec.status === 'conferida' ? 'default' : 'outline'}>
                          {rec.status === 'conf_fisica' ? 'Aguardando Fiscal' : rec.status}
                        </Badge>
                      </TableCell>
                      <TableCell>User ID: {rec.receivedBy}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Render New Receipt Form ---
  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Novo Recebimento</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">Informe os dados da Nota Fiscal e quantidades</p>
        </div>
        <Button variant="ghost" onClick={() => setViewMode('dashboard')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>
      </div>

      <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Dados da Nota Fiscal</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>Número da Nota Fiscal</Label><Input value={manualNFNumber} onChange={(e) => setManualNFNumber(e.target.value)} placeholder="NF-00000000" /></div>
              <div><Label>Série</Label><Input value={manualNFSeries} onChange={(e) => setManualNFSeries(e.target.value)} placeholder="S-000" /></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Itens a Receber</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-center">Qtd Pedido</TableHead>
                    <TableHead className="text-center">Recebido Anteriormente</TableHead>
                    <TableHead className="text-center">Qtd Atual (NF)</TableHead>
                    <TableHead className="text-center">Saldo Restante</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itemsWithPrices.map((it: any) => {
                    const max = Number(it.quantity || 0);
                    const prev = Number(it.quantityReceived || 0);
                    const current = Number(receivedQuantities[it.id] || 0);
                    const remaining = Math.max(0, max - prev);
                    
                    const isOver = (prev + current) > max;
                    const isFullyReceived = prev >= max;

                    return (
                      <TableRow key={it.id} className={cn(isOver ? "bg-red-50 dark:bg-red-900/10" : "", isFullyReceived && "bg-muted/50")}>
                        <TableCell>{it.itemCode || ""} - {it.description}</TableCell>
                        <TableCell className="text-center">{max}</TableCell>
                        <TableCell className="text-center text-muted-foreground">{prev}</TableCell>
                        <TableCell className="text-center">
                        <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div>
                                  <DecimalInput
                                    value={isFullyReceived ? 0 : current}
                                    precision={4}
                                    className={cn("w-24 mx-auto", isFullyReceived && "cursor-not-allowed opacity-50 bg-muted")}
                                    disabled={isFullyReceived}
                                    onChange={(standardValue) => {
                                      if (!standardValue) {
                                        setReceivedQuantities(p => ({ ...p, [it.id]: 0 }));
                                        return;
                                      }
                                      const v = Number(standardValue);
                                      if (!Number.isFinite(v) || v < 0) {
                                        return;
                                      }
                                      setReceivedQuantities(p => ({ ...p, [it.id]: v }));
                                    }}
                                  />
                                </div>
                              </TooltipTrigger>
                              {isFullyReceived && (
                                <TooltipContent>
                                  <p>Este item já foi recebido em sua totalidade.</p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="text-center font-medium">
                           {remaining - current}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
      </div>

      <div className="sticky bottom-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm pt-4 pb-2 border-t border-slate-200 dark:border-slate-800 mt-6 flex justify-between gap-3 flex-col sm:flex-row sm:items-center">
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setViewMode('dashboard')}>Cancelar</Button>
          <Button
            variant="destructive"
            onClick={() => setIsPendencyModalOpen(true)}
          >
            <X className="mr-2 h-4 w-4" />
            Reportar Divergência
          </Button>
        </div>
        <Button 
          onClick={() => confirmPhysicalMutation.mutate()} 
          disabled={!canConfirm || confirmPhysicalMutation.isPending}
          className="bg-green-600 hover:bg-green-700"
        >
          <Check className="mr-2 h-4 w-4" />
          Confirmar Recebimento
        </Button>
      </div>
      
      <PendencyModal
        isOpen={isPendencyModalOpen}
        onClose={() => setIsPendencyModalOpen(false)}
        onConfirm={(reason) => reportIssueMutation.mutate(reason)}
        isLoading={reportIssueMutation.isPending}
      />
    </div>
  );
});

export default ReceiptPhase;
