import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

export default function ReceiptPhase({ request, onClose, className }: ReceiptPhaseProps) {
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

  

  // Fetch request items
  const { data: items = [] } = useQuery({
    queryKey: [`/api/purchase-requests/${request.id}/items`],
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
        method: 'GET',
        headers: {
          'Content-Type': 'application/pdf',
        },
      });

      if (!response.ok) {
        throw new Error('Falha ao gerar PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      setPdfPreviewUrl(url);
      setShowPreviewModal(true);

      toast({
        title: "Sucesso",
        description: "Pré-visualização do PDF carregada com sucesso!",
      });
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
        method: 'GET',
        headers: {
          'Content-Type': 'application/pdf',
        },
      });

      if (!response.ok) {
        throw new Error('Falha ao gerar PDF');
      }

      // Criar blob e fazer download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `Pedido_Compra_${request.requestNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Sucesso",
        description: "PDF do pedido de compra baixado com sucesso!",
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



  const formatDate = (date: any) => {
    if (!date) return "N/A";
    return formatDistanceToNow(new Date(date), { 
      addSuffix: true, 
      locale: ptBR 
    });
  };

  // Get selected supplier from quotations
  const selectedSupplier = selectedSupplierQuotation;

  // Combine items with supplier quotation data and filter out unavailable items
  const itemsWithPrices = useMemo(() => {
    if (!Array.isArray(items) || !Array.isArray(supplierQuotationItems) || !Array.isArray(quotationItems)) {
      return [];
    }

    return (items as any[]).map((item: any) => {
      // Find the corresponding quotation item first (same logic as PDF)
      const quotationItem = (quotationItems as any[]).find((qi: any) => {
        // First try by purchaseRequestItemId (most reliable)
        if (qi.purchaseRequestItemId && item.id && qi.purchaseRequestItemId === item.id) {
          return true;
        }
        // Fallback: try by exact description match
        if (qi.description && item.description && 
            qi.description.trim().toLowerCase() === item.description.trim().toLowerCase()) {
          return true;
        }
        // Fallback: try by item code
        if (qi.itemCode && item.itemCode && qi.itemCode === item.itemCode) {
          return true;
        }
        // Fallback: try by partial description match
        if (qi.description && item.description) {
          const qiDesc = qi.description.trim().toLowerCase();
          const itemDesc = item.description.trim().toLowerCase();
          return qiDesc.includes(itemDesc) || itemDesc.includes(qiDesc);
        }
        return false;
      });
      
      if (quotationItem) {
        // Find the supplier item for this quotation item
        const supplierItem = (supplierQuotationItems as any[]).find((si: any) => 
          si.quotationItemId === quotationItem.id
        );
        
        if (supplierItem) {
          const unitPrice = Number(supplierItem.unitPrice) || 0;
          const quantity = Number(item.requestedQuantity) || 1;
          
          // Calculate price with discount if any (same logic as PDF)
          const originalTotal = unitPrice * quantity;
          let discountedTotal = originalTotal;
          let itemDiscount = 0;
          
          if (supplierItem.discountPercentage && Number(supplierItem.discountPercentage) > 0) {
            const discountPercent = Number(supplierItem.discountPercentage);
            itemDiscount = (originalTotal * discountPercent) / 100;
            discountedTotal = originalTotal - itemDiscount;
          } else if (supplierItem.discountValue && Number(supplierItem.discountValue) > 0) {
            itemDiscount = Number(supplierItem.discountValue);
            discountedTotal = Math.max(0, originalTotal - itemDiscount);
          }
          
          return {
            ...item,
            unitPrice: unitPrice,
            totalPrice: discountedTotal,
            originalTotalPrice: originalTotal,
            itemDiscount: itemDiscount,
            brand: supplierItem.brand || '',
            deliveryTime: supplierItem.deliveryDays ? `${supplierItem.deliveryDays} dias` : '',
            supplier: selectedSupplierQuotation?.supplier,
            isAvailable: supplierItem?.isAvailable !== false
          };
        }
      }
      
      return {
        ...item,
        unitPrice: 0,
        totalPrice: 0,
        originalTotalPrice: 0,
        itemDiscount: 0,
        brand: '',
        deliveryTime: '',
        supplier: selectedSupplierQuotation?.supplier,
        isAvailable: false
      };
    }).filter((item: any) => item.isAvailable); // Filter out unavailable items
  }, [items, supplierQuotationItems, quotationItems, selectedSupplierQuotation]);

  return (
    <div className={cn("space-y-2 md:space-y-3 lg:space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg md:text-xl lg:text-2xl font-semibold text-gray-900">Recebimento - {request.requestNumber}</h2>
          <p className="text-xs md:text-sm text-gray-500">
            Confirme o recebimento ou reporte pendências
          </p>
        </div>
        <div className="flex gap-1 md:gap-2">
          <Button
            onClick={handlePreviewPDF}
            disabled={isLoadingPreview}
            variant="outline"
            className="border-green-600 text-green-600 hover:bg-green-50 h-6 md:h-7 lg:h-8 text-xs md:text-sm"
          >
            <Eye className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
            {isLoadingPreview ? "Carregando..." : "Visualizar PDF"}
          </Button>
          <Button
            onClick={handleDownloadPDF}
            disabled={isDownloading}
            className="bg-green-600 hover:bg-green-700 h-6 md:h-7 lg:h-8 text-xs md:text-sm"
          >
            <Download className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
            {isDownloading ? "Baixando..." : "Baixar PDF"}
          </Button>
          <Button variant="outline" onClick={onClose} className="h-6 md:h-7 lg:h-8 text-xs md:text-sm">
            <X className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
            Fechar
          </Button>
        </div>
      </div>

      {/* Request Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 md:gap-3 lg:gap-4">
        <Card>
          <CardHeader className="pb-1 md:pb-2">
            <CardTitle className="text-sm md:text-base lg:text-lg flex items-center gap-1 md:gap-2">
              <FileText className="h-3 w-3 md:h-4 md:w-4 lg:h-5 lg:w-5" />
              Informações da Solicitação
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 md:p-3 lg:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1 md:gap-2 lg:gap-4">
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-500">Número</p>
                <p className="text-xs md:text-sm font-semibold mt-1">{request.requestNumber}</p>
              </div>
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-500">Categoria</p>
                <p className="text-xs md:text-sm">{CATEGORY_LABELS[request.category as keyof typeof CATEGORY_LABELS]}</p>
              </div>
            </div>

            <div className="mt-1 md:mt-2 lg:mt-4">
              <p className="text-xs md:text-sm font-medium text-gray-500">Justificativa</p>
              <p className="text-xs md:text-sm mt-1">{request.justification}</p>
            </div>

            <div className="grid grid-cols-2 gap-1 md:gap-2 lg:gap-4 mt-1 md:mt-2 lg:mt-4">
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-500">Urgência</p>
                <Badge 
                  variant={request.urgency === 'high' ? 'destructive' : request.urgency === 'medium' ? 'default' : 'secondary'} 
                  className="text-xs"
                >
                  {URGENCY_LABELS[request.urgency as keyof typeof URGENCY_LABELS]}
                </Badge>
              </div>
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-500">Valor Total</p>
                <p className="text-sm md:text-base lg:text-lg font-bold text-green-600">
                  {formatCurrency(request.totalValue || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 md:pb-2">
            <CardTitle className="text-sm md:text-base lg:text-lg flex items-center gap-1 md:gap-2">
              <User className="h-3 w-3 md:h-4 md:w-4 lg:h-5 lg:w-5" />
              Responsáveis
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 md:p-3 lg:p-6">
            <div className="space-y-1 md:space-y-2">
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-500">Solicitante</p>
                <p className="text-xs md:text-sm mt-1">
                  {request.requester ? 
                    `${request.requester.firstName} ${request.requester.lastName}` : 
                    "N/A"
                  }
                </p>
                <p className="text-xs text-gray-400">{request.requester?.email}</p>
              </div>

              {request.approverA1 && (
                <div>
                  <p className="text-xs md:text-sm font-medium text-gray-500">Aprovador A1</p>
                  <p className="text-xs md:text-sm mt-1">
                    {`${request.approverA1.firstName} ${request.approverA1.lastName}`}
                  </p>
                  <p className="text-xs text-gray-400">{request.approverA1.email}</p>
                </div>
              )}

              {request.approverA2 && (
                <div>
                  <p className="text-xs md:text-sm font-medium text-gray-500">Aprovador A2</p>
                  <p className="text-xs md:text-sm mt-1">
                    {`${request.approverA2.firstName} ${request.approverA2.lastName}`}
                  </p>
                  <p className="text-xs text-gray-400">{request.approverA2.email}</p>
                </div>
              )}

              {request.costCenter && (
                <div>
                  <p className="text-xs md:text-sm font-medium text-gray-500">Centro de Custo</p>
                  <p className="text-xs md:text-sm mt-1">{request.costCenter.name}</p>
                  <p className="text-xs text-gray-400">Código: {request.costCenter.code}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Selected Supplier Information */}
      {selectedSupplierQuotation && (
        <Card>
          <CardHeader className="pb-1 md:pb-2">
            <CardTitle className="text-sm md:text-base lg:text-lg flex items-center gap-1 md:gap-2">
              <Building className="h-3 w-3 md:h-4 md:w-4 lg:h-5 lg:w-5 text-green-600" />
              Fornecedor Selecionado
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 md:p-3 lg:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1 md:gap-2 lg:gap-4 mb-1 md:mb-2 lg:mb-4">
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-500">Nome do Fornecedor</p>
                <p className="text-xs md:text-sm font-semibold mt-1">{selectedSupplierQuotation.supplier?.name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-500">E-mail</p>
                <p className="text-xs md:text-sm mt-1">{selectedSupplierQuotation.supplier?.email || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-500">Contato</p>
                <p className="text-xs md:text-sm mt-1">{selectedSupplierQuotation.supplier?.contact || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-500">CNPJ</p>
                <p className="text-xs md:text-sm mt-1">{selectedSupplierQuotation.supplier?.cnpj || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-500">Valor Total</p>
                <p className="text-sm md:text-base lg:text-lg font-bold text-green-600">
                  {formatCurrency(selectedSupplierQuotation.totalValue || 0)}
                </p>
              </div>
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-500 flex items-center gap-1">
                  <Truck className="h-3 w-3 md:h-4 md:w-4" />
                  Frete
                </p>
                <p className="text-xs md:text-sm mt-1">
                  {selectedSupplierQuotation.includesFreight ? 
                    `R$ ${freightValue.toFixed(2).replace('.', ',')}` : 
                    'Não incluso'
                  }
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1 md:gap-2 lg:gap-4">
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-500">Condições de Pagamento</p>
                <p className="text-xs md:text-sm mt-1">{selectedSupplierQuotation.paymentTerms || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-500">Prazo de Entrega</p>
                <p className="text-xs md:text-sm mt-1">{selectedSupplierQuotation.deliveryTerms || 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Items Table */}
      <Card>
        <CardHeader className="pb-1 md:pb-2">
          <CardTitle className="text-sm md:text-base lg:text-lg">Itens da Compra</CardTitle>
        </CardHeader>
        <CardContent className="p-1 md:p-2 lg:p-6">
          {itemsWithPrices.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs md:text-sm py-1 md:py-2">Descrição</TableHead>
                    <TableHead className="text-center text-xs md:text-sm py-1 md:py-2">Qtd</TableHead>
                    <TableHead className="text-center text-xs md:text-sm py-1 md:py-2">Unidade</TableHead>
                    <TableHead className="text-right text-xs md:text-sm py-1 md:py-2">Valor Unit.</TableHead>
                    <TableHead className="text-right text-xs md:text-sm py-1 md:py-2">Valor Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itemsWithPrices.map((item: any, index: number) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium text-xs md:text-sm py-1 md:py-2">
                        {item.description}
                      </TableCell>
                      <TableCell className="text-center text-xs md:text-sm py-1 md:py-2">
                        {item.requestedQuantity}
                      </TableCell>
                      <TableCell className="text-center text-xs md:text-sm py-1 md:py-2">
                        {item.unit}
                      </TableCell>
                      <TableCell className="text-right text-xs md:text-sm py-1 md:py-2">
                        {formatCurrency(item.unitPrice || 0)}
                      </TableCell>
                      <TableCell className="text-right text-xs md:text-sm font-medium py-1 md:py-2">
                        {formatCurrency(item.totalPrice || 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-2 md:py-4 text-gray-500">
              <Package className="h-6 w-6 md:h-8 md:w-8 mx-auto mb-1 md:mb-2 opacity-50" />
              <p className="text-xs md:text-sm">Nenhum item encontrado</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Receipt Actions */}
      {canPerformReceiptActions && (
        <Card>
          <CardHeader className="pb-1 md:pb-2">
            <CardTitle className="text-sm md:text-base lg:text-lg">Ações de Recebimento</CardTitle>
          </CardHeader>
          <CardContent className="p-2 md:p-3 lg:p-6">
            <div className="flex flex-col sm:flex-row gap-1 md:gap-2">
              <Button
                onClick={() => confirmReceiptMutation.mutate()}
                disabled={confirmReceiptMutation.isPending}
                className="flex-1 bg-green-600 hover:bg-green-700 text-xs md:text-sm h-6 md:h-7 lg:h-10"
              >
                <Check className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" />
                {confirmReceiptMutation.isPending ? 'Confirmando...' : 'Confirmar Recebimento'}
              </Button>
              <Button
                onClick={() => setIsPendencyModalOpen(true)}
                variant="outline"
                className="flex-1 border-red-600 text-red-600 hover:bg-red-50 text-xs md:text-sm h-6 md:h-7 lg:h-10"
              >
                <X className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" />
                Reportar Pendência
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* PDF Preview Modal */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="max-w-4xl h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-sm md:text-base">Visualização do Pedido de Compra</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {pdfPreviewUrl ? (
              <iframe
                src={pdfPreviewUrl}
                className="w-full h-full border-0"
                title="Visualização do Pedido de Compra"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-xs md:text-sm text-gray-500">Carregando visualização...</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Pendency Modal */}
      <PendencyModal
        isOpen={isPendencyModalOpen}
        onClose={() => setIsPendencyModalOpen(false)}
        requestId={request.id}
        onPendencyReported={() => {
          setIsPendencyModalOpen(false);
          onClose();
        }}
      />
    </div>
  );
}