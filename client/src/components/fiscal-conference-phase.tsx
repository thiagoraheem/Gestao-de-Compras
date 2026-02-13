import React, { useState, forwardRef, useImperativeHandle, useEffect, useMemo, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import PdfViewer from "./pdf-viewer";
import { ErrorBoundary } from "./error-boundary";
import { Eye, X, FileText, Check, Clock, ArrowLeft, RefreshCw, Edit, Undo2, Download } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import PendencyModal from "./pendency-modal";
import { ReceiptProvider, useReceipt } from "./receipt/ReceiptContext";
import { ReceiptManualEntry } from "./receipt/ReceiptManualEntry";
import { ReceiptXmlImport } from "./receipt/ReceiptXmlImport";
import { ReceiptFinancial } from "./receipt/ReceiptFinancial";
import { useReceiptActions } from "./receipt/useReceiptActions";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import PurchaseRequestHeaderCard from "./purchase-request-header-card";
import { PHASE_LABELS } from "@/lib/types";
import { formatCurrency } from "@/lib/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface FiscalConferencePhaseProps {
  request: any;
  onClose: () => void;
  mode?: 'view' | 'physical' | 'fiscal';
  onPreviewOpen?: () => void;
  onPreviewClose?: () => void;
  className?: string;
  hideTabsByDefault?: boolean;
  onPreviewPDF?: () => void;
  onDownloadPDF?: () => void;
  isLoadingPreview?: boolean;
  isDownloading?: boolean;
  canViewPDF?: boolean;
}

export interface FiscalConferencePhaseHandle {
  reset: () => void;
  previewPDF: () => void;
  downloadPDF: () => void;
}

const FiscalDashboard = ({ request, onClose, onSelectReceipt, onPreviewPDF, onDownloadPDF, isLoadingPreview, isDownloading, canViewPDF }: any) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [undoReceiptId, setUndoReceiptId] = useState<number | null>(null);

  const { data: purchaseOrder } = useQuery<any>({
    queryKey: [`/api/purchase-orders/by-request/${request?.id}`],
    enabled: !!request?.id,
  });

  const { data: receipts = [] } = useQuery<any[]>({
    queryKey: [`/api/purchase-orders/${purchaseOrder?.id}/receipts`],
    enabled: !!purchaseOrder?.id,
  });

  const undoConferenceMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest(`/api/receipts/${id}/undo-physical-conference`, { method: "POST" });
      return response;
    },
    onSuccess: () => {
      toast({ title: "Sucesso", description: "Conferência física desfeita com sucesso." });
      queryClient.invalidateQueries({ queryKey: [`/api/purchase-orders/${purchaseOrder?.id}/receipts`] });
      queryClient.invalidateQueries({ queryKey: [`/api/purchase-orders/${purchaseOrder?.id}/items`] });
      queryClient.invalidateQueries({ queryKey: [`/api/purchase-orders/by-request/${request?.id}`] });
      setUndoReceiptId(null);
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message || "Erro ao desfazer conferência.", variant: "destructive" });
      setUndoReceiptId(null);
    }
  });

  // Filter receipts that need fiscal conference or are already done
  const pendingReceipts = receipts.filter(r => r.status === 'conf_fisica');
  const doneReceipts = receipts.filter(r => r.status === 'conferida' || r.status === 'fiscal_conferida');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Conferência Fiscal</h2>
          <p className="text-muted-foreground">Selecione uma Nota Fiscal para conferência</p>
        </div>
        <div className="flex gap-2">
            {canViewPDF && (
            <>
            <Button
                type="button"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onPreviewPDF && onPreviewPDF();
                }}
                disabled={isLoadingPreview}
                variant="outline"
                className="border-green-600 text-green-600 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-900/20"
            >
                <Eye className="w-4 h-4 mr-2" />
                {isLoadingPreview ? "Carregando..." : "Visualizar PDF"}
            </Button>
            <Button 
                onClick={onDownloadPDF}
                disabled={isDownloading}
                className="bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
            >
                <Download className="w-4 h-4 mr-2" />
                {isDownloading ? "Baixando..." : "Baixar PDF"}
            </Button>
            </>
            )}
            <Button variant="outline" onClick={onClose}>Fechar</Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Notas Pendentes de Conferência</CardTitle></CardHeader>
        <CardContent>
          {pendingReceipts.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Nenhuma nota fiscal aguardando conferência.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número NF</TableHead>
                  <TableHead>Série</TableHead>
                  <TableHead>Recebido Em</TableHead>
                  <TableHead>Recebido Por</TableHead>
                  <TableHead>Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingReceipts.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>{r.documentNumber || 'N/A'}</TableCell>
                    <TableCell>{r.documentSeries || '-'}</TableCell>
                    <TableCell>{format(new Date(r.receivedAt), "dd/MM/yyyy HH:mm")}</TableCell>
                    <TableCell>{r.receivedByName || r.receivedBy || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button size="sm" onClick={() => onSelectReceipt(r.id)}>
                          Conferir
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700 dark:border-orange-900/30 dark:text-orange-400 dark:hover:bg-orange-900/20"
                          onClick={() => setUndoReceiptId(r.id)}
                          title="Desfazer conferência física"
                        >
                          <Undo2 className="w-4 h-4 mr-2" />
                          Desfazer
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Histórico de Conferências</CardTitle></CardHeader>
        <CardContent>
          {doneReceipts.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Nenhuma nota fiscal conferida.</p>
          ) : (
             <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número NF</TableHead>
                  <TableHead>Série</TableHead>
                  <TableHead>Conferido Em</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {doneReceipts.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>{r.documentNumber || 'N/A'}</TableCell>
                    <TableCell>{r.documentSeries || '-'}</TableCell>
                    <TableCell>{r.approvedAt ? format(new Date(r.approvedAt), "dd/MM/yyyy HH:mm") : '-'}</TableCell>
                    <TableCell><Badge className="bg-green-600">Conferida</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!undoReceiptId} onOpenChange={(open) => !open && setUndoReceiptId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desfazer Conferência Física?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá remover completamente o registro de recebimento e reverter a quantidade dos itens para "Pendente".
              Caso seja o único recebimento, a solicitação voltará para a fase de Recebimento.
              Esta ação será registrada no log de auditoria e não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => undoReceiptId && undoConferenceMutation.mutate(undoReceiptId)}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              Confirmar Reversão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const FiscalConferencePhaseContent = forwardRef<FiscalConferencePhaseHandle, FiscalConferencePhaseProps & { onBack: () => void }>((props, ref) => {
  const { onPreviewOpen, onPreviewClose, className, onBack, onPreviewPDF, onDownloadPDF, isLoadingPreview, isDownloading, canViewPDF } = props;
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
    selectedSupplier,
    nfReceiptId, // This comes from context, populated by receiptId prop
    isFinancialValid,
    setShowValidationErrors,
    paymentMethodCode,
    invoiceDueDate,
    hasInstallments,
    installmentCount,
    installments,
    allocations,
    allocationMode,
    // Destructure manual entry fields for fiscal confirmation
    receiptType,
    manualNFNumber,
    manualNFSeries,
    manualNFIssueDate,
    manualTotal,
    manualNFEmitterCNPJ
  } = useReceipt();

  const { reportIssueMutation } = useReceiptActions();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch current receipt data for status updates
  const { data: currentReceipt } = useQuery<any>({
    queryKey: [`/api/receipts/${nfReceiptId}`],
    enabled: !!nfReceiptId,
  });

  const reopenFiscalMutation = useMutation({
    mutationFn: async () => {
        if (!nfReceiptId) throw new Error("ID da nota não encontrado");
        return apiRequest(`/api/receipts/${nfReceiptId}/reopen-fiscal`, { method: "POST" });
    },
    onSuccess: () => {
        toast({ title: "Sucesso", description: "Conferência reaberta para edição." });
        queryClient.invalidateQueries({ queryKey: [`/api/receipts/${nfReceiptId}`] });
        queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
    },
    onError: (err: any) => {
        toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  });

  // Extract ERP info
  const receiptObs = useMemo(() => {
      if (!currentReceipt?.observations) return {};
      try {
          return typeof currentReceipt.observations === 'string' ? JSON.parse(currentReceipt.observations) : currentReceipt.observations;
      } catch { return {}; }
  }, [currentReceipt]);

  const lastErpAttempt = receiptObs.lastErpAttempt || receiptObs.erp;
  const isConferred = currentReceipt?.status === 'conferida';

  // ERP Logs State
  const [erpLogs, setErpLogs] = useState<{ time: Date; message: string; type: 'info' | 'success' | 'error' }[]>([]);

  // Update local logs from persisted data if available
  useEffect(() => {
      if (lastErpAttempt) {
          setErpLogs(prev => {
              // Avoid duplicate logs if already present
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

  // Custom Mutation for Fiscal Confirmation
  const confirmFiscalMutation = useMutation({
    mutationFn: async () => {
      // Use the specific receipt ID if available
      const targetReceiptId = nfReceiptId; 
      if (!targetReceiptId) throw new Error("Nenhuma nota fiscal selecionada");

      // Validate before sending
      if (!isFinancialValid) {
        setShowValidationErrors(true);
        throw new Error("Preencha todos os campos obrigatórios financeiros: Forma de Pagamento, Vencimento e Rateio.");
      }
      
      setErpLogs(prev => [{ time: new Date(), message: "Iniciando envio para o ERP...", type: 'info' }, ...prev]);

      const response = await apiRequest(
        `/api/receipts/${targetReceiptId}/confirm-fiscal`,
        { 
          method: "POST",
          body: {
            paymentMethodCode,
            invoiceDueDate,
            hasInstallments,
            installmentCount,
            installments,
            allocations,
            allocationMode,
            // Pass header data to ensure DB is updated before validation
            receiptType,
            documentNumber: manualNFNumber,
            documentSeries: manualNFSeries,
            issueDate: manualNFIssueDate,
            totalAmount: manualTotal,
            emitterCnpj: manualNFEmitterCNPJ
          }
        }
      );
      return response;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: [`/api/receipts/${nfReceiptId}`] });
      
      if (data.erp) {
        const erpStatus = data.erp.success ? 'success' : 'error';
        setErpLogs(prev => [{ 
           time: new Date(), 
           message: `ERP Resposta: ${data.erp.code} - ${data.erp.message}`, 
           type: erpStatus 
        }, ...prev]);
        
        if (!data.erp.success) {
           toast({ title: "Aviso ERP", description: `Erro na integração: ${data.erp.message}`, variant: "destructive" });
        } else {
           toast({ title: "Sucesso", description: "Conferência fiscal confirmada e enviada ao ERP!" });
           setTimeout(() => onBack(), 2000); // Give time to read logs
           return; 
        }
      } else {
        toast({ title: "Sucesso", description: "Conferência fiscal confirmada!" });
      }
      
      // Delay closing if there are logs to show
      if (!data.erp?.success) {
         // Stay open
      } else {
         setTimeout(() => onBack(), 2000);
      }
    },
    onError: (err: any) => {
      setErpLogs(prev => [{ time: new Date(), message: `Falha no envio: ${err.message}`, type: 'error' }, ...prev]);
      toast({ title: "Erro na Validação", description: err.message || "Erro ao confirmar fiscal", variant: "destructive" });
      // Refetch to show persistent status if updated in backend
      queryClient.invalidateQueries({ queryKey: [`/api/receipts/${nfReceiptId}`] });
    }
  });

  useImperativeHandle(ref, () => ({
    reset: () => {},
    previewPDF: () => onPreviewPDF && onPreviewPDF(),
    downloadPDF: () => onDownloadPDF && onDownloadPDF(),
  }));

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: ptBR });
    } catch {
      return dateString;
    }
  };

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
          <Button variant="ghost" onClick={onBack}>
             <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
          </Button>
        </div>

        <PurchaseRequestHeaderCard
          context="fiscal"
          requestNumber={request?.requestNumber}
          orderNumber={purchaseOrder?.orderNumber}
          requesterName={request?.requester ? `${request.requester.firstName} ${request.requester.lastName}` : "N/A"}
          supplierName={selectedSupplier?.name || request?.chosenSupplier?.name || "Não definido"}
          orderDate={formatDate(purchaseOrder?.createdAt || request?.createdAt || null)}
          totalValue={formatCurrency(purchaseOrder?.totalValue ?? request?.totalValue ?? 0)}
          status={(request?.phase && (PHASE_LABELS as any)[request.phase as keyof typeof PHASE_LABELS]) || "—"}
          creationDate={request?.createdAt ? format(new Date(request.createdAt), "dd/MM/yyyy HH:mm") : "N/A"}
        />
      </div>

      <Tabs value={activeTab === 'items' ? 'fiscal' : activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 lg:w-[600px] transition-all duration-300">
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

      {/* ERP Status Section - Persistent */}
      {lastErpAttempt && (
        <div className={cn("mb-4 px-4 py-3 border rounded-md shadow-sm mx-1", 
            lastErpAttempt.success ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800" : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
        )}>
           <h4 className={cn("text-sm font-semibold mb-1 flex items-center gap-2",
               lastErpAttempt.success ? "text-green-800 dark:text-green-300" : "text-red-800 dark:text-red-300"
           )}>
             {lastErpAttempt.success ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
             Status da Integração ERP
           </h4>
           <div className="text-xs space-y-1">
              <p>
                  <span className="font-medium">Tentativa:</span> {format(new Date(lastErpAttempt.time), "dd/MM/yyyy HH:mm:ss")}
              </p>
              <p>
                  <span className="font-medium">Status:</span> {lastErpAttempt.success ? "Sucesso" : "Falha"}
              </p>
              <p>
                  <span className="font-medium">Mensagem:</span> {lastErpAttempt.message}
              </p>
           </div>
        </div>
      )}

      {/* ERP Logs */}
      {erpLogs.length > 0 && (
        <div className="mb-4 px-4 py-3 border rounded-md bg-white dark:bg-slate-800 shadow-sm mx-1">
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Log de Integração ERP
          </h4>
          <div className="space-y-1 max-h-32 overflow-y-auto text-xs font-mono">
            {erpLogs.map((log, i) => (
              <div key={i} className={cn("flex items-center gap-2", 
                log.type === 'success' ? "text-green-600 dark:text-green-400" : 
                log.type === 'error' ? "text-red-600 dark:text-red-400" : "text-slate-500 dark:text-slate-400"
              )}>
                <span className="opacity-70">[{format(log.time, "HH:mm:ss")}]</span>
                <span>{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="sticky bottom-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm pt-4 pb-2 border-t border-slate-200 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
          <Button
            variant="outline"
            onClick={onBack}
            className="w-full sm:w-auto order-last sm:order-first"
          >
            Voltar
          </Button>
          {canViewPDF && (
          <>
          <Button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onPreviewPDF && onPreviewPDF();
            }}
            disabled={isLoadingPreview}
            variant="outline"
            className="w-full sm:w-auto border-green-600 text-green-600 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-900/20"
          >
            <Eye className="w-4 h-4 mr-2" />
            {isLoadingPreview ? "Carregando..." : "Visualizar PDF"}
          </Button>
          
          <Button 
             onClick={onDownloadPDF}
             disabled={isDownloading}
             className="w-full sm:w-auto bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
          >
             <Download className="w-4 h-4 mr-2" />
             {isDownloading ? "Baixando..." : "Baixar PDF"}
          </Button>
          </>
          )}

          {isConferred && (
             <Button
                variant="outline"
                className="w-full sm:w-auto border-blue-600 text-blue-600 hover:bg-blue-50"
                onClick={() => reopenFiscalMutation.mutate()}
                disabled={reopenFiscalMutation.isPending}
             >
                <Edit className="w-4 h-4 mr-2" />
                {reopenFiscalMutation.isPending ? "Reabrindo..." : "Editar Conferência"}
             </Button>
          )}

          {isConferred && !lastErpAttempt?.success && (
             <Button
                variant="outline"
                className="w-full sm:w-auto border-orange-600 text-orange-600 hover:bg-orange-50"
                onClick={() => confirmFiscalMutation.mutate()}
                disabled={confirmFiscalMutation.isPending}
             >
                <RefreshCw className="w-4 h-4 mr-2" />
                {confirmFiscalMutation.isPending ? "Reenviando..." : "Reenviar ao ERP"}
             </Button>
          )}

          {!isConferred && (
            <Button
                className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600"
                onClick={() => confirmFiscalMutation.mutate()}
                disabled={confirmFiscalMutation.isPending}
            >
                {confirmFiscalMutation.isPending ? "Processando..." : "Concluir Conferência Fiscal"}
            </Button>
          )}
        </div>
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

const FiscalConferencePhase = forwardRef<FiscalConferencePhaseHandle, FiscalConferencePhaseProps>((props, ref) => {
  const [selectedReceiptId, setSelectedReceiptId] = useState<number | null>(null);
  const { request, onPreviewOpen, onPreviewClose } = props;
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Permission check: Admin, Manager, Receiver, Buyer can view PDF
  const canViewPDF = true; // user?.isAdmin || user?.isManager || user?.isReceiver || user?.isBuyer;

  // Local state for PDF Preview
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfBuffer, setPdfBuffer] = useState<ArrayBuffer | null>(null);
  const [previewMimeType, setPreviewMimeType] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  
  const contentRef = useRef<any>(null);

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
      setPreviewMimeType(contentType);
      
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
      
      setShowPreviewModal(true);
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
    setIsDownloading(true);
    try {
      const response = await fetch(`/api/purchase-requests/${request.id}/pdf`, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store'
      });
      if (!response.ok) throw new Error('Falha ao baixar PDF');
      
      const contentType = response.headers.get('Content-Type') || '';
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
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

  useImperativeHandle(ref, () => ({
    reset: () => {
        if (contentRef.current && contentRef.current.reset) {
            contentRef.current.reset();
        }
    },
    previewPDF: handlePreviewPDF,
    downloadPDF: handleDownloadPDF
  }));

  const commonProps = {
    onPreviewPDF: handlePreviewPDF,
    onDownloadPDF: handleDownloadPDF,
    isLoadingPreview,
    isDownloading,
    canViewPDF
  };

  return (
    <>
        {!selectedReceiptId ? (
            <FiscalDashboard 
                request={props.request} 
                onClose={props.onClose} 
                onSelectReceipt={setSelectedReceiptId} 
                {...commonProps}
            />
        ) : (
            <ReceiptProvider request={props.request} onClose={props.onClose} mode="fiscal" receiptId={selectedReceiptId}>
            <FiscalConferencePhaseContent 
                {...props} 
                ref={contentRef} 
                onBack={() => setSelectedReceiptId(null)} 
                {...commonProps}
            />
            </ReceiptProvider>
        )}

        <Dialog open={showPreviewModal} onOpenChange={(v) => {
            setShowPreviewModal(v);
            if (!v && onPreviewClose) onPreviewClose();
            if (!v) {
                // cleanup
                if (pdfPreviewUrl) {
                   // no-op
                }
                setPreviewMimeType(null);
            }
        }}>
            <DialogContent className="max-w-4xl h-[80vh] flex flex-col" aria-describedby="pdf-preview-desc">
            <div className="flex items-center justify-between">
                <DialogTitle>Visualizar PDF</DialogTitle>
                <div className="flex gap-2 mr-6">
                    <Button 
                        onClick={() => {
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
                        }} 
                        size="sm" 
                        className="bg-green-600 hover:bg-green-700"
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Baixar PDF
                    </Button>
                </div>
            </div>
            <p id="pdf-preview-desc" className="sr-only">Pré-visualização do PDF do pedido selecionado</p>
            <div className="flex-1 w-full bg-slate-100 rounded-md overflow-hidden dark:bg-slate-800">
                {pdfBuffer ? (
                <ErrorBoundary fallback={
                    <div className="flex items-center justify-center h-full p-6 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 rounded-lg">
                    <p>Erro ao exibir PDF. O arquivo pode estar corrompido ou ser incompatível.</p>
                    </div>
                }>
                    <PdfViewer data={pdfBuffer} className="w-full h-full" />
                </ErrorBoundary>
                ) : (
                <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                        <FileText className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto mb-4" />
                        <p className="text-slate-600 dark:text-slate-300">Carregando pré-visualização...</p>
                    </div>
                </div>
                )}
            </div>
            </DialogContent>
        </Dialog>
    </>
  );
});

export default FiscalConferencePhase;
