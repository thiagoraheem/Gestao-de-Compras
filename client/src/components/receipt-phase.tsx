import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { X, Check, Package, User, Building, Calendar, DollarSign, FileText, Download, Eye, Truck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { URGENCY_LABELS, CATEGORY_LABELS } from "@/lib/types";
import { formatCurrency } from "@/lib/currency";
// import AttachmentsViewer from "./attachments-viewer";
// import ItemsViewer from "./items-viewer";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import PendencyModal from "./pendency-modal";

interface ReceiptPhaseProps {
  request: any;
  onClose: () => void;
  className?: string;
}

export interface ReceiptPhaseHandle {
  previewPDF: () => void;
  downloadPDF: () => void;
}

import { forwardRef, useImperativeHandle } from "react";

const ReceiptPhase = forwardRef<ReceiptPhaseHandle, ReceiptPhaseProps>(function ReceiptPhase({ request, onClose, className }: ReceiptPhaseProps, ref) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isPendencyModalOpen, setIsPendencyModalOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Check if user has permission to perform receipt actions
  const canPerformReceiptActions = user?.isReceiver || user?.isAdmin;

  

  // Buscar dados relacionados
  // Primeiro buscar o pedido de compra relacionado à solicitação
  const { data: purchaseOrder } = useQuery<any>({
    queryKey: [`/api/purchase-orders/by-request/${request?.id}`],
    enabled: !!request?.id,
  });

  // Buscar itens do pedido de compra (não da solicitação)
  const { data: items = [] } = useQuery<any[]>({
    queryKey: [`/api/purchase-orders/${purchaseOrder?.id}/items`],
    enabled: !!purchaseOrder?.id,
  });

  // Fetch approval history
  const { data: approvalHistory = [] } = useQuery({
    queryKey: [`/api/purchase-requests/${request.id}/approval-history`],
  });

  // Fetch supplier quotations to get selected supplier
  const { data: quotation } = useQuery({
    queryKey: [`/api/quotations/purchase-request/${request.id}`],
  });

  const { data: supplierQuotations = [] } = useQuery({
    queryKey: [`/api/quotations/${quotation?.id}/supplier-quotations`],
    enabled: !!quotation?.id,
  });

  // Get selected supplier quotation (ensure we find the chosen one)
  const selectedSupplierQuotation = supplierQuotations.find((sq: any) => sq.isChosen === true) || supplierQuotations[0];
  
  // Calculate freight value
  const freightValue = selectedSupplierQuotation?.includesFreight && selectedSupplierQuotation?.freightValue 
    ? parseFloat(selectedSupplierQuotation.freightValue?.toString().replace(/[^\d.,]/g, '').replace(',', '.')) || 0
    : 0;
  
  // Fetch supplier quotation items with prices
  const { data: supplierQuotationItems = [] } = useQuery({
    queryKey: [`/api/supplier-quotations/${selectedSupplierQuotation?.id}/items`],
    enabled: !!selectedSupplierQuotation?.id,
  });



  // Fetch quotation items to map descriptions
  const { data: quotationItems = [] } = useQuery({
    queryKey: [`/api/quotations/${quotation?.id}/items`],
    enabled: !!quotation?.id,
  });

  // Mutations for receipt actions
  const confirmReceiptMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/purchase-requests/${request?.id}/confirm-receipt`, {
        method: "POST",
        body: { receivedById: user?.id },
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      toast({
        title: "Sucesso",
        description: "Recebimento confirmado! Item movido para Conclusão.",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível confirmar o recebimento",
        variant: "destructive",
      });
    },
  });

  const reportIssueMutation = useMutation({
    mutationFn: async (pendencyReason: string) => {
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

  // Função para gerar pré-visualização do PDF
  const handlePreviewPDF = async () => {
    setIsLoadingPreview(true);
    try {
      const response = await fetch(`/api/purchase-requests/${request.id}/pdf`, {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error('Falha ao gerar PDF');
      }

      const contentType = response.headers.get('Content-Type') || '';
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
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

  // Função para download do PDF
  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch(`/api/purchase-requests/${request.id}/pdf`, {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error('Falha ao gerar PDF');
      }

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
      toast({
        title: "Erro",
        description: "Falha ao baixar PDF do pedido de compra",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  // Função para baixar PDF da pré-visualização
  const handleDownloadFromPreview = () => {
    if (pdfPreviewUrl) {
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = pdfPreviewUrl;
      a.download = `Pedido_Compra_${request.requestNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      toast({
        title: "Sucesso",
        description: "PDF do pedido de compra baixado com sucesso!",
      });
    }
  };

  // Limpar URL do blob quando o modal for fechado
  const handleClosePreview = () => {
    setShowPreviewModal(false);
    if (pdfPreviewUrl) {
      window.URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(null);
    }
  };

  useImperativeHandle(ref, () => ({
    previewPDF: handlePreviewPDF,
    downloadPDF: handleDownloadPDF,
  }));



  const formatDate = (date: any) => {
    if (!date) return "N/A";
    return formatDistanceToNow(new Date(date), { 
      addSuffix: true, 
      locale: ptBR 
    });
  };

  // Get selected supplier from quotations
  const selectedSupplier = selectedSupplierQuotation;

  // Para a fase de recebimento, usar diretamente os dados dos itens que já vêm com preços do pedido de compra
  const itemsWithPrices = Array.isArray(items) ? items.map(item => {
    // Os itens do pedido de compra já vêm com os preços corretos da API
    const unitPrice = Number(item.unitPrice) || 0;
    const quantity = Number(item.quantity) || 0;
    const totalPrice = Number(item.totalPrice) || 0;
    
    return {
      ...item,
      unitPrice: unitPrice,
      originalUnitPrice: unitPrice,
      itemDiscount: 0, // Para pedidos de compra, não há desconto adicional
      totalPrice: totalPrice,
      originalTotalPrice: totalPrice,
      brand: item.brand || '',
      deliveryTime: item.deliveryTime || '',
      isAvailable: true
    };
  }) : [];

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Recebimento de Material</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">Confirme o recebimento ou reporte pendências</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Request Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Informações da Solicitação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Número</p>
                <Badge variant="outline" className="mt-1">
                  {request.requestNumber}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Categoria</p>
                <p className="text-sm text-slate-700 dark:text-slate-300">{CATEGORY_LABELS[request.category as keyof typeof CATEGORY_LABELS]}</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Justificativa</p>
              <p className="text-sm mt-1 text-slate-700 dark:text-slate-300">{request.justification}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Urgência</p>
                <Badge 
                  variant={request.urgency === "alto" ? "destructive" : "secondary"} 
                  className="mt-1"
                >
                  {URGENCY_LABELS[request.urgency as keyof typeof URGENCY_LABELS]}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Valor Total</p>
                <p className="text-sm font-medium mt-1 text-slate-700 dark:text-slate-300">{formatCurrency(request.totalValue)}</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Data de Criação</p>
              <p className="text-sm mt-1 text-slate-700 dark:text-slate-300">{formatDate(request.createdAt)}</p>
            </div>
          </CardContent>
        </Card>

        {/* People Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Responsáveis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Solicitante</p>
              <p className="text-sm mt-1 text-slate-700 dark:text-slate-300">
                {request.requester ? 
                  `${request.requester.firstName} ${request.requester.lastName}` : 
                  "N/A"
                }
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{request.requester?.email}</p>
            </div>

            {request.approverA1 && (
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Aprovador A1</p>
                <p className="text-sm mt-1 text-slate-700 dark:text-slate-300">
                  {`${request.approverA1.firstName} ${request.approverA1.lastName}`}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{request.approverA1.email}</p>
              </div>
            )}

            {request.approverA2 && (
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Aprovador A2</p>
                <p className="text-sm mt-1 text-slate-700 dark:text-slate-300">
                  {`${request.approverA2.firstName} ${request.approverA2.lastName}`}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{request.approverA2.email}</p>
              </div>
            )}

            {request.costCenter && (
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Centro de Custo</p>
                <p className="text-sm mt-1 text-slate-700 dark:text-slate-300">{request.costCenter.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Código: {request.costCenter.code}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Selected Supplier Information */}
      {selectedSupplierQuotation && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5 text-green-600" />
              Fornecedor Selecionado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Nome do Fornecedor</p>
                <p className="text-sm font-semibold mt-1">{selectedSupplierQuotation.supplier?.name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">E-mail</p>
                <p className="text-sm mt-1">{selectedSupplierQuotation.supplier?.email || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Contato</p>
                <p className="text-sm mt-1">{selectedSupplierQuotation.supplier?.contact || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">CNPJ</p>
                <p className="text-sm mt-1">{selectedSupplierQuotation.supplier?.cnpj || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Valor Total da Proposta</p>
                <p className="text-lg font-bold text-green-600 mt-1">
                  {formatCurrency(selectedSupplierQuotation.totalValue)}
                </p>
              </div>
              
              {/* Freight Information - Highlighted */}
              <div className="col-span-full">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Truck className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                    <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Informações de Frete</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Frete Incluso</p>
                      <p className="text-sm mt-1 text-slate-700 dark:text-slate-300">
                        {selectedSupplierQuotation.includesFreight ? 'Sim' : 'Não'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Valor do Frete</p>
                      <p className="text-lg font-bold text-blue-800 dark:text-blue-300 mt-1">
                        {freightValue > 0 ? formatCurrency(freightValue) : 'Não incluso'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Condições de Pagamento</p>
                <p className="text-sm mt-1">{selectedSupplierQuotation.paymentTerms || 'N/A'}</p>
              </div>
              
              {/* Desconto da Proposta */}
              {(selectedSupplierQuotation.discountType && selectedSupplierQuotation.discountType !== 'none' && selectedSupplierQuotation.discountValue) && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Desconto da Proposta</p>
                  <p className="text-lg font-bold text-green-600 mt-1">
                    {selectedSupplierQuotation.discountType === 'percentage' 
                      ? `${selectedSupplierQuotation.discountValue}%`
                      : formatCurrency(selectedSupplierQuotation.discountValue)
                    }
                  </p>
                </div>
              )}
            </div>
            
            {selectedSupplierQuotation.choiceReason && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm font-medium text-green-800">Justificativa da Escolha:</p>
                <p className="text-sm text-green-700 mt-1">{selectedSupplierQuotation.choiceReason}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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

      

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Itens da Compra</CardTitle>
        </CardHeader>
        <CardContent>
          {itemsWithPrices.length > 0 ? (
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
              
              {/* Total Summary */}
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
                
                {/* Freight Display */}
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-blue-600 dark:text-blue-300 flex items-center gap-1">
                    <Truck className="h-4 w-4" />
                    Frete
                  </span>
                  <span className="text-base font-semibold text-blue-600 dark:text-blue-300">
                    {freightValue > 0 ? formatCurrency(freightValue) : 'Não incluso'}
                  </span>
                </div>
                
                {/* Total with Freight */}
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
              <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhum item encontrado</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">Os dados dos itens serão carregados automaticamente</p>
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

      <Separator />

      {/* Action Buttons */}
      <div className="sticky bottom-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm pt-4 pb-2 border-t border-slate-200 dark:border-slate-800 mt-6">
        <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="w-full sm:w-auto order-last sm:order-first"
          >
            Fechar
          </Button>
          {canPerformReceiptActions ? (
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
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
                onClick={() => confirmReceiptMutation.mutate()}
                disabled={confirmReceiptMutation.isPending}
                className="bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 w-full sm:w-auto flex items-center justify-center"
              >
                <Check className="mr-2 h-4 w-4 flex-shrink-0" />
                <span className="truncate">Confirmar Recebimento</span>
              </Button>
            </div>
          ) : (
            <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center justify-center sm:justify-start p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-border">
              <User className="mr-2 h-4 w-4 flex-shrink-0" />
              <span className="text-center sm:text-left">
                Apenas usuários com perfil "Recebedor" podem confirmar recebimentos
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Pendency Modal */}
      <PendencyModal
        isOpen={isPendencyModalOpen}
        onClose={() => setIsPendencyModalOpen(false)}
        onConfirm={(reason) => reportIssueMutation.mutate(reason)}
        isLoading={reportIssueMutation.isPending}
      />

      {/* Modal de Pré-visualização do PDF */}
      <Dialog open={showPreviewModal} onOpenChange={handleClosePreview}>
        <DialogContent className="sm:max-w-6xl max-h-[90vh] overflow-hidden p-0 sm:rounded-lg" aria-describedby="receipt-pdf-preview-desc">
          <div className="flex-shrink-0 bg-background border-b border-border sticky top-0 z-30 px-6 py-3 rounded-t-lg">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base font-semibold">Pré-visualização - Pedido de Compra {request.requestNumber}</DialogTitle>
              <div className="flex gap-2">
                <Button
                  onClick={handleDownloadFromPreview}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Baixar PDF
                </Button>
                <Button onClick={handleClosePreview} size="sm" variant="outline">
                  <X className="w-4 h-4 mr-2" />
                  Fechar
                </Button>
              </div>
            </div>
            <p id="receipt-pdf-preview-desc" className="sr-only">Pré-visualização do documento em PDF do pedido de compra</p>
          </div>
          <div className="px-6 pt-0 pb-2">
            <div className="flex-1 overflow-hidden">
              {pdfPreviewUrl ? (
                <iframe
                  src={pdfPreviewUrl}
                  className="w-full h-[72vh] border border-border rounded-lg bg-slate-50 dark:bg-slate-900"
                  title="Pré-visualização do PDF"
                />
              ) : (
                <div className="flex items-center justify-center h-[72vh] bg-slate-100 dark:bg-slate-800 rounded-lg border border-border">
                  <div className="text-center">
                    <FileText className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto mb-4" />
                    <p className="text-slate-600 dark:text-slate-300">Carregando pré-visualização...</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex-shrink-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800 sticky bottom-0 z-30 px-6 py-3">
            <div className="flex justify-end gap-3">
              <Button
                onClick={handleDownloadFromPreview}
                size="sm"
                className="bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
              >
                <Download className="w-4 h-4 mr-2" />
                Baixar PDF
              </Button>
              <Button onClick={handleClosePreview} size="sm" variant="outline">
                <X className="w-4 h-4 mr-2" />
                Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
});

export default ReceiptPhase;
