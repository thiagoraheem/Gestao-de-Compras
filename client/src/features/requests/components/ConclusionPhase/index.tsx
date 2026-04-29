import { useMemo, forwardRef, useImperativeHandle } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Separator } from "@/shared/ui/separator";
import { Textarea } from "@/shared/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useConclusionData } from "./useConclusionData";
import { generatePrintableHTML } from "./ConclusionPrintTemplate";
import { PHASE_LABELS, URGENCY_LABELS, CATEGORY_LABELS, PURCHASE_PHASES } from "@/lib/types";
import ProcessTimeline from "@/features/requests/components/process-timeline";
import {
  Download,
  FileText,
  User,
  Calendar,
  Building,
  Clock,
  CheckCircle,
  Package,
  Truck,
  X,
  Archive,
  Mail,
  Printer,
  History,
  DollarSign,
  AlertCircle,
  Eye,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  MapPin,
  Phone,
  ExternalLink,
  Star,
  AlertTriangle,
  RefreshCw,
  Activity,
  PieChart
} from "lucide-react";
import { format, formatDistanceToNow, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

const archiveSchema = z.object({
  conclusionObservations: z.string().optional(),
});

type ArchiveFormData = z.infer<typeof archiveSchema>;

const formatDate = (date: any, formatStr: string = "dd/MM/yyyy HH:mm") => {
  if (!date) return "N/A";
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "N/A";
    return format(d, formatStr, { locale: ptBR });
  } catch {
    return "N/A";
  }
};

interface ConclusionPhaseProps {
  request: any;
  onClose: () => void;
  className?: string;
}

export interface ConclusionPhaseHandle {
  downloadPurchaseOrderPDF: () => void;
  exportPDF: () => void;
  printSummary: () => void;
  sendEmail: () => void;
  openArchiveDialog: () => void;
}

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

const ConclusionPhase = forwardRef<ConclusionPhaseHandle, ConclusionPhaseProps>(function ConclusionPhase({ request, onClose, className }: ConclusionPhaseProps, ref) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    items, purchaseOrder, purchaseOrderItems, completeTimeline, attachments, requester, costCenter, department,
    quotation, supplierQuotations, selectedSupplierQuotation, supplierQuotationItems, quotationAttachments, receipts,
    dataIntegrityIssues, receipt, auditLogs, erpLogs, isArchiving, setIsArchiving, showArchiveDialog, setShowArchiveDialog,
    showAttachmentViewer, setShowAttachmentViewer, retryErpMutation, archiveMutation, exportPDFMutation, downloadPurchaseOrderPDFMutation,
    isLoading, timelineLoading
  } = useConclusionData({ request, onClose });

  const form = useForm<ArchiveFormData>({
    resolver: zodResolver(archiveSchema),
    defaultValues: {
      conclusionObservations: "",
    },
  });

  const handleArchive = async (data: ArchiveFormData) => {
    setIsArchiving(true);
    try {
      await archiveMutation.mutateAsync(data);
    } finally {
      setIsArchiving(false);
      setShowArchiveDialog(false);
    }
  };

  const handlePrint = () => {
    const printContent = generatePrintableHTML({
      request,
      totalProcessTime,
      totalItemsValue,
      requester,
      department,
      costCenter,
      selectedSupplier,
      items,
      supplierQuotationItems,
      completeTimeline,
      getItemStatus
    });

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
        printWindow.onafterprint = () => printWindow.close();
      };
    }
  };

  const handleSendEmail = async () => {
    try {
      await apiRequest(`/api/purchase-requests/${request.id}/send-conclusion-email`, {
        method: "POST",
      });
      toast({
        title: "Sucesso",
        description: "Resumo enviado por e-mail",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao enviar e-mail",
        variant: "destructive",
      });
    }
  };

  // Calculate metrics
  const selectedSupplier = selectedSupplierQuotation;
  const totalProcessTime = (request.createdAt && !isNaN(new Date(request.createdAt).getTime())) 
    ? differenceInDays(new Date(), new Date(request.createdAt)) 
    : 0;

  // Calculate total items value - prioritize request.totalValue for consistency
  const totalItemsValue = useMemo(() => {
    // Priority 1: Use request's total value to maintain consistency with Kanban card
    if (request.totalValue && parseFloat(request.totalValue) > 0) {
      return parseFloat(request.totalValue);
    }

    // Priority 2: Use selected supplier quotation's total value if available
    if (selectedSupplierQuotation?.totalValue && parseFloat(selectedSupplierQuotation.totalValue) > 0) {
      return parseFloat(selectedSupplierQuotation.totalValue);
    }

    // Priority 3: Calculate from supplier quotation items (excluding unavailable items)
    if (supplierQuotationItems && supplierQuotationItems.length > 0 && items && items.length > 0) {
      return items.reduce((sum: number, item: any) => {
        // Find matching supplier quotation item
        const supplierItem = supplierQuotationItems.find((sqi: any) => {
          // First try by purchaseRequestItemId (most reliable)
          if (sqi.purchaseRequestItemId && item.id && sqi.purchaseRequestItemId === item.id) {
            return true;
          }
          // Fallback: try by description, item code, or quotationItemId
          return sqi.description === item.description ||
            sqi.itemCode === item.itemCode ||
            sqi.quotationItemId === item.id;
        });

        // Only include available items in the total
        if (supplierItem && supplierItem.isAvailable !== false) {
          const unitPrice = parseFloat(supplierItem.unitPrice) || 0;
          const quantity = parseFloat(item.requestedQuantity) || 0;
          return sum + (quantity * unitPrice);
        }

        return sum;
      }, 0);
    }

    // Priority 4: Use available budget as fallback
    if (request.availableBudget && parseFloat(request.availableBudget) > 0) {
      return parseFloat(request.availableBudget);
    }

    // Default: 0
    return 0;
  }, [request, selectedSupplierQuotation, supplierQuotationItems, items]);

  // Função para formatar quantidades no padrão brasileiro
  const formatQuantity = (quantity: number | string) => {
    const num = typeof quantity === 'string' ? parseFloat(quantity) : quantity;
    return Number(num || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  };

  // Get status indicators
  const getItemStatus = (item: any) => {
    // If we have explicit quantityReceived (from backend fix), use it
    if (item.quantityReceived !== undefined && item.quantityReceived !== null) {
      const received = Number(item.quantityReceived);
      const requested = Number(item.requestedQuantity || item.quantity || 0);
      
      if (received >= requested && requested > 0) return 'received';
      if (received > 0) return 'pending'; // Partial receipt
      return 'pending';
    }

    // Fallback logic if needed
    return item.requestedQuantity > 0 ? 'received' : 'pending';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'received':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'divergent':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'received':
        return <Badge variant="default" className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">Recebido</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">Pendente</Badge>;
      case 'divergent':
        return <Badge variant="destructive">Divergente</Badge>;
      default:
        return <Badge variant="outline">Não informado</Badge>;
    }
  };

  // isLoading already provided by hook

  useImperativeHandle(ref, () => ({
    downloadPurchaseOrderPDF: () => downloadPurchaseOrderPDFMutation.mutate(),
    exportPDF: () => exportPDFMutation.mutate(),
    printSummary: () => handlePrint(),
    sendEmail: () => handleSendEmail(),
    openArchiveDialog: () => setShowArchiveDialog(true),
  }))

  return (
    <div className={className}>
{/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Conclusão da Compra</h2>
          <p className="text-muted-foreground">Solicitação {request.requestNumber}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadPurchaseOrderPDFMutation.mutate()}
            disabled={downloadPurchaseOrderPDFMutation.isPending}
            className="border-blue-600 text-blue-600 hover:bg-blue-50"
          >
            <FileText className="h-4 w-4 mr-2" />
            {downloadPurchaseOrderPDFMutation.isPending ? "Baixando..." : "PDF Pedido de Compra"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportPDFMutation.mutate()}
            disabled={exportPDFMutation.isPending}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
          >
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSendEmail}
          >
            <Mail className="h-4 w-4 mr-2" />
            Enviar E-mail
          </Button>

          {request.currentPhase === PURCHASE_PHASES.CONCLUSAO_COMPRA && (
            <Dialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                >
                  <Archive className="h-4 w-4 mr-2" />
                  Arquivar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Arquivar Solicitação</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleArchive)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="conclusionObservations"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Observações de Conclusão (Opcional)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Adicione observações sobre a conclusão do processo..."
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowArchiveDialog(false)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        disabled={isArchiving}
                      >
                        {isArchiving ? "Arquivando..." : "Arquivar"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          )}

          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <Clock className="h-6 w-6 animate-spin mr-2" />
          <span>Carregando informações da conclusão...</span>
        </div>
      ) : (
      <div className="space-y-6">
        {/* Data Integrity Warnings */}
        {dataIntegrityIssues.length > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <h4 className="flex items-center gap-2 font-medium text-yellow-800 dark:text-yellow-200 mb-2">
              <AlertTriangle className="h-4 w-4" />
              Avisos de Integridade de Dados
            </h4>
            <ul className="list-disc list-inside space-y-1">
              {dataIntegrityIssues.map((issue, idx) => (
                <li key={idx} className="text-sm text-yellow-700 dark:text-yellow-300">
                  {issue}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Process Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Tempo Total</p>
                  <p className="text-2xl font-bold text-foreground">{totalProcessTime} dias</p>
                </div>
                <Clock className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card >

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Valor Total</p>
                  <p className="text-2xl font-bold text-foreground">
                    {totalItemsValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">Concluído</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div >

        {/* Request Summary */}
        < Card >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Resumo da Solicitação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-4">
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Número da Solicitação</span>
                  <p className="text-lg font-semibold">{request.requestNumber}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Data de Criação</span>
                  <p>{formatDate(request.createdAt)}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Status Final</span>
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    {PHASE_LABELS[request.currentPhase as keyof typeof PHASE_LABELS]}
                  </Badge>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Solicitante</span>
                  <p className="font-medium">
                    {requester ? `${requester.firstName} ${requester.lastName}` : request.requesterName || 'Não informado'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {requester?.email || request.requesterEmail || 'Não informado'}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Departamento</span>
                  <p>{department?.name || request.departmentName || 'Não informado'}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Centro de Custo</span>
                  <p>{costCenter?.code} - {costCenter?.name || 'Não informado'}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Categoria</span>
                  <Badge variant="outline">{CATEGORY_LABELS[request.category as keyof typeof CATEGORY_LABELS]}</Badge>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Urgência</span>
                  <Badge variant="outline">{URGENCY_LABELS[request.urgency as keyof typeof URGENCY_LABELS]}</Badge>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Orçamento Disponível</span>
                  <p className="font-medium">
                    {request.availableBudget?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'Não informado'}
                  </p>
                </div>
              </div>
            </div>

            <Separator className="my-4" />

            <div>
              <span className="text-sm font-medium text-muted-foreground">Justificativa</span>
              <p className="mt-1 text-foreground">{request.justification}</p>
            </div>
          </CardContent>
        </Card >

        {/* Selected Supplier */}
        {
          selectedSupplier && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Fornecedor Selecionado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Nome do Fornecedor</span>
                      <p className="text-lg font-semibold text-foreground">{selectedSupplier.supplier?.name || 'Não informado'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Contato</span>
                      <div className="flex items-center gap-2 mt-1">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <p>{selectedSupplier.supplier?.phone || 'Não informado'}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <p>{selectedSupplier.supplier?.email || 'Não informado'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Valor da Cotação</span>
                      <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                        {selectedSupplier.totalValue ?
                          parseFloat(selectedSupplier.totalValue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) :
                          (request.totalValue ?
                            parseFloat(request.totalValue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) :
                            'Não informado'
                          )
                        }
                      </p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Prazo de Entrega</span>
                      <p>{selectedSupplier.deliveryTerms || selectedSupplier.deliveryTime || 'Não informado'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Status</span>
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        Selecionado
                      </Badge>
                    </div>

                    {/* Desconto da Proposta */}
                    {(selectedSupplier.discountType && selectedSupplier.discountType !== 'none' && selectedSupplier.discountValue) && (
                      <div>
                        <span className="text-sm font-medium text-muted-foreground">Desconto da Proposta</span>
                        <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                          {selectedSupplier.discountType === 'percentage'
                            ? `${selectedSupplier.discountValue}%`
                            : `R$ ${Number(selectedSupplier.discountValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                          }
                        </p>
                      </div>
                    )}
                  </div>
                </div>


              </CardContent>
            </Card>
          )
        }

        {/* Purchase Order Data */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Dados do Pedido de Compra
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Número do Pedido</span>
                  <p className="text-lg font-semibold">{purchaseOrder.orderNumber || request.requestNumber}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Data de Emissão</span>
                  <p>{formatDate(request.createdAt)}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Status do Pedido</span>
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    Entregue
                  </Badge>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Condições de Pagamento</span>
                  <p>{request.paymentConditions || 'Conforme contrato'}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Local de Entrega</span>
                  <div className="flex items-center gap-2 mt-1">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <p>{request.deliveryLocation || 'Sede da empresa'}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Physical Receipt Section */}
        {receipts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Recebimento Físico
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-8">
                {receipts.map((currentReceipt: any, index: number) => (
                  <div key={currentReceipt.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4 bg-muted/30 p-2 rounded">
                        <div className="flex items-center gap-3">
                            <Badge variant="outline">#{index + 1}</Badge>
                            <h3 className="font-semibold text-sm flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                Nota Fiscal: {currentReceipt.documentNumber} (Série: {currentReceipt.documentSeries})
                            </h3>
                        </div>
                         <Badge 
                            variant={['conf_fisica', 'nf_confirmada', 'conferida', 'completed', 'fiscal_conferida'].includes(currentReceipt.status) ? 'default' : 'secondary'} 
                            className={['conf_fisica', 'nf_confirmada', 'conferida', 'completed', 'fiscal_conferida'].includes(currentReceipt.status) ? "bg-green-100 text-green-800" : ""}
                        >
                            {['conf_fisica', 'nf_confirmada', 'conferida', 'completed', 'fiscal_conferida'].includes(currentReceipt.status) ? 'Concluído' : 'Pendente'}
                        </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="space-y-4">
                        <div>
                            <span className="text-sm font-medium text-muted-foreground">Data do Recebimento</span>
                            <p>{formatDate(currentReceipt.received_at || currentReceipt.created_at)}</p>
                        </div>
                        <div>
                            <span className="text-sm font-medium text-muted-foreground">Responsável pelo Recebimento</span>
                            <p>{currentReceipt.receiver_first_name} {currentReceipt.receiver_last_name}</p>
                        </div>
                        </div>
                        <div className="space-y-4">
                        <div>
                            <span className="text-sm font-medium text-muted-foreground">Observações</span>
                            {(() => {
                              const obs = normalizeReceiptObservations(currentReceipt.observations);
                              return (
                                <p>{obs.physical || obs.general || 'Sem observações'}</p>
                              );
                            })()}
                        </div>
                        </div>
                    </div>

                    {/* Nested Items Received Table */}
                    <div className="mt-4">
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                            <Package className="h-4 w-4" /> Itens desta Nota
                        </h4>
                        <div className="overflow-x-auto border rounded-md">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50">
                                    <tr className="border-b">
                                        <th className="text-left py-2 px-3">Item</th>
                                        <th className="text-left py-2 px-3">Unidade</th>
                                        <th className="text-right py-2 px-3">Qtd. Recebida</th>
                                        <th className="text-right py-2 px-3">Preço Unit.</th>
                                        <th className="text-right py-2 px-3">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentReceipt.items?.map((item: any) => (
                                        <tr key={item.id} className="border-b last:border-0">
                                            <td className="py-2 px-3">{item.description}</td>
                                            <td className="py-2 px-3">{item.unit}</td>
                                            <td className="text-right py-2 px-3 font-medium">{formatQuantity(item.quantity)}</td>
                                            <td className="text-right py-2 px-3">{parseFloat(item.unitPrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                            <td className="text-right py-2 px-3">{parseFloat(item.totalPrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                        </tr>
                                    ))}
                                    {(!currentReceipt.items || currentReceipt.items.length === 0) && (
                                        <tr><td colSpan={5} className="text-center py-4 text-muted-foreground">Nenhum item encontrado nesta nota.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                  </div>
                ))}

                {/* Physical Receipt History */}
                <div className="border rounded-md p-4 bg-muted/20">
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Histórico Completo de Recebimento
                    </h4>
                    <div className="space-y-3">
                    {auditLogs
                        .filter((log: any) => 
                        (log.actionType && (log.actionType.includes('receipt') || log.actionType === 'recebimento_fisico')) || 
                        (log.action && log.action.includes('receipt')) || 
                        log.entityType === 'receipt'
                        )
                        .map((log: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-start text-sm border-b border-border/50 last:border-0 pb-2 last:pb-0">
                        <div>
                            <span className="font-medium">{log.action || 'Ação desconhecida'}</span>
                            <p className="text-muted-foreground text-xs">{log.first_name} {log.last_name}</p>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDate(log.performed_at)}
                        </span>
                        </div>
                    ))}
                    {auditLogs.filter((log: any) => 
                        (log.actionType && (log.actionType.includes('receipt') || log.actionType === 'recebimento_fisico')) || 
                        (log.action && log.action.includes('receipt')) || 
                        log.entityType === 'receipt'
                    ).length === 0 && (
                        <p className="text-sm text-muted-foreground">Nenhum histórico registrado.</p>
                    )}
                    </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Fiscal Conference Section */}
        {receipts.some((r: any) => ['conferida', 'nf_confirmada', 'fiscal_conferida'].includes(r.status)) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Conferência Fiscal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-8">
              {receipts
                .filter((r: any) => ['conferida', 'nf_confirmada', 'fiscal_conferida'].includes(r.status))
                .map((currentReceipt: any, index: number) => {
                  const obs = normalizeReceiptObservations(currentReceipt.observations);
                  return (
                  <div key={currentReceipt.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4 bg-muted/30 p-2 rounded">
                        <div className="flex items-center gap-3">
                            <Badge variant="outline">#{index + 1}</Badge>
                            <h3 className="font-semibold text-sm flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                Nota Fiscal: {currentReceipt.documentNumber} (Série: {currentReceipt.documentSeries})
                            </h3>
                        </div>
                        <Badge 
                            variant="default" 
                            className="bg-green-100 text-green-800"
                        >
                            Conferido
                        </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="space-y-4">
                        <div>
                            <span className="text-sm font-medium text-muted-foreground">Data da Conferência</span>
                            <p>{formatDate(currentReceipt.approval_date)}</p>
                        </div>
                        <div>
                            <span className="text-sm font-medium text-muted-foreground">Fiscal Responsável</span>
                            <p>{currentReceipt.approver_first_name ? `${currentReceipt.approver_first_name} ${currentReceipt.approver_last_name}` : 'Usuário não identificado'}</p>
                        </div>
                        </div>
                        <div className="space-y-4">
                             <div>
                                <span className="text-sm font-medium text-muted-foreground">Observações Fiscais</span>
                                <p>{obs?.fiscal || obs?.general || 'Sem observações'}</p>
                             </div>
                        </div>
                    </div>

                    {/* ERP Integration Details */}
                    {obs?.erp && (
                      <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-md border">
                        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                          <Activity className="h-4 w-4" /> Integração ERP
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Status:</span>
                            <span className={`ml-2 font-medium ${obs.erp.success ? 'text-green-600' : 'text-red-600'}`}>
                              {obs.erp.success ? 'Sucesso' : 'Erro'}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Mensagem:</span>
                            <span className="ml-2">{obs.erp.message || '-'}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Data:</span>
                            <span className="ml-2">{formatDate(obs.erp.time, "dd/MM/yyyy HH:mm")}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Rateio Information */}
                    {obs?.rateio && (
                      <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-md border">
                         <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                           <PieChart className="h-4 w-4" /> Dados de Rateio
                         </h4>
                         <div className="space-y-2">
                            {obs.rateio.allocations?.map((alloc: any, i: number) => (
                                <div key={i} className="flex justify-between text-sm border-b last:border-0 pb-1">
                                    <span>{alloc.costCenterName || `Centro de Custo ${alloc.costCenterId}`}</span>
                                    <span className="font-mono">
                                        {parseFloat(alloc.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        {alloc.percentage && ` (${alloc.percentage}%)`}
                                    </span>
                                </div>
                            ))}
                         </div>
                      </div>
                    )}
                    
                    {/* Financial Info */}
                     {obs?.financial && (
                      <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-md border">
                         <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                           <DollarSign className="h-4 w-4" /> Dados Financeiros
                         </h4>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-muted-foreground">Vencimento:</span>
                                <span className="ml-2">{formatDate(obs.financial.invoiceDueDate, "dd/MM/yyyy")}</span>
                            </div>
                            {obs.financial.paymentMethodCode && (
                                <div>
                                    <span className="text-muted-foreground">Forma de Pagamento:</span>
                                    <span className="ml-2">{obs.financial.paymentMethodCode}</span>
                                </div>
                            )}
                         </div>
                      </div>
                    )}

                  </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Complete Process Timeline */}
        <ProcessTimeline timeline={completeTimeline} isLoading={timelineLoading} />

        {/* Dados do Processo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <History className="h-5 w-5" />
              Dados do Processo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Informações da Solicitação */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-foreground border-b border-border pb-2">📋 Solicitação</h4>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Número da Solicitação</span>
                    <p className="font-medium">{request.requestNumber}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Data de Criação</span>
                    <p>{formatDate(request.createdAt)}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Solicitante</span>
                    <p>{requester ? `${requester.firstName} ${requester.lastName}` : request.requesterName || 'Não informado'}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Departamento</span>
                    <p>{department?.name || request.departmentName || 'Não informado'}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Centro de Custo</span>
                    <p>{costCenter?.code} - {costCenter?.name || 'Não informado'}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Quantidade Total de Itens</span>
                    <p className="font-medium">{formatQuantity(items.reduce((sum: number, item: any) => sum + (parseFloat(item.requestedQuantity) || 0), 0))}</p>
                  </div>
                </div>
              </div>

              {/* Dados da Cotação */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-foreground border-b border-border pb-2">💰 Cotação</h4>
                {quotation ? (
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Número da Cotação</span>
                      <p className="font-medium">{quotation.quotationNumber}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Data de Criação</span>
                      <p>{formatDate(quotation.createdAt)}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Status</span>
                      <Badge variant="outline">{quotation.status}</Badge>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Fornecedores Participantes</span>
                      <p className="font-medium">{supplierQuotations.length}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Dados da cotação não disponíveis</p>
                )}
              </div>

              {/* Cotação Vencedora */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-foreground border-b border-border pb-2">🏆 Cotação Vencedora</h4>
                {selectedSupplierQuotation ? (
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Fornecedor</span>
                      <p className="font-medium">{selectedSupplierQuotation.supplierName}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Valor Total da Proposta</span>
                      <p className="font-medium text-green-600">
                        {parseFloat(selectedSupplierQuotation.totalValue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Data de Submissão</span>
                      <p>{formatDate(selectedSupplierQuotation.submissionDate)}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Itens Cotados</span>
                      <p className="font-medium">{supplierQuotationItems.filter((item: any) => item.isAvailable !== false).length}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Dados da cotação vencedora não disponíveis</p>
                )}
              </div>

              {/* Pedido de Compra */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-foreground border-b border-border pb-2">📄 Pedido de Compra</h4>
                {purchaseOrder ? (
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Número do Pedido</span>
                      <p className="font-medium">{purchaseOrder.orderNumber}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Data de Criação</span>
                      <p>{formatDate(purchaseOrder.createdAt)}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Valor Total</span>
                      <p className="font-medium text-green-600">
                        {parseFloat(purchaseOrder.totalValue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Itens no Pedido</span>
                      <p className="font-medium">{formatQuantity(purchaseOrderItems.reduce((sum: number, item: any) => sum + (parseFloat(item.quantity) || 0), 0))}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Dados do pedido de compra não disponíveis</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>



        {/* Attachments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Anexos do Processo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Anexos da Solicitação Original */}
              {attachments.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-3">Anexos da Solicitação</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {attachments.map((attachment: any) => (
                      <div key={attachment.id} className="flex items-center gap-3 p-3 border border-border rounded-lg">
                        <FileText className="h-8 w-8 text-blue-500" />
                        <div className="flex-1">
                          <p className="font-medium">{attachment.fileName || attachment.filename}</p>
                          <p className="text-sm text-muted-foreground">{attachment.fileType}</p>
                          <p className="text-xs text-gray-500">
                            {attachment.attachmentType === 'requisition' ? 'Anexo de Solicitação' : attachment.attachmentType}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" asChild>
                          <a href={`/api/attachments/${attachment.id}/download`} target="_blank">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Anexos de Cotações de Fornecedores */}
              {quotationAttachments.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-3">Anexos de Cotações</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {quotationAttachments.map((attachment: any) => (
                      <div key={attachment.id} className="flex items-center gap-3 p-3 border border-border rounded-lg">
                        <FileText className="h-8 w-8 text-green-500" />
                        <div className="flex-1">
                          <p className="font-medium">{attachment.fileName || attachment.filename}</p>
                          <p className="text-sm text-muted-foreground">{attachment.fileType}</p>
                          <p className="text-xs text-gray-500">
                            Proposta de {attachment.supplierName || 'Fornecedor'}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" asChild>
                          <a href={`/api/attachments/${attachment.id}/download`} target="_blank">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mensagem quando não há anexos */}
              {attachments.length === 0 && quotationAttachments.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                  <p>Nenhum anexo encontrado para esta solicitação</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Process Completion Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Status do Processo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium text-green-900 dark:text-green-300">Processo Concluído</p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Todas as etapas foram executadas com sucesso. O processo está finalizado.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {request.currentPhase === PURCHASE_PHASES.CONCLUSAO_COMPRA && (
          <Dialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Arquivar Solicitação</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleArchive)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="conclusionObservations"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observações de Conclusão (Opcional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Adicione observações sobre a conclusão do processo..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowArchiveDialog(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={isArchiving}
                    >
                      {isArchiving ? "Arquivando..." : "Arquivar"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div >
      )}
    </div >
  );
})

export default ConclusionPhase
