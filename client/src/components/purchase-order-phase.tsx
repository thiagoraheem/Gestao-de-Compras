import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
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
  Eye
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import debug from "@/lib/debug";

const purchaseOrderSchema = z.object({
  purchaseObservations: z.string().optional(),
});

type PurchaseOrderFormData = z.infer<typeof purchaseOrderSchema>;

interface PurchaseOrderPhaseProps {
  request: any;
  onClose: () => void;
  className?: string;
}

export default function PurchaseOrderPhase({ request, onClose, className }: PurchaseOrderPhaseProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const form = useForm<PurchaseOrderFormData>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: {
      purchaseObservations: request?.purchaseObservations || "",
    },
  });

  // Reset form when request data changes (including after successful updates)
  useEffect(() => {
    form.reset({
      purchaseObservations: request?.purchaseObservations || "",
    });
  }, [request?.purchaseObservations]); // Removido 'form' das dependências

  // Buscar dados relacionados
  const { data: items = [] } = useQuery<any[]>({
    queryKey: [`/api/purchase-requests/${request?.id}/items`],
    enabled: !!request?.id,
  });

  const { data: approvalHistory = [] } = useQuery<any[]>({
    queryKey: [`/api/purchase-requests/${request?.id}/approval-history`],
    enabled: !!request?.id,
  });

  const { data: attachments = [] } = useQuery<any[]>({
    queryKey: [`/api/purchase-requests/${request?.id}/attachments`],
    enabled: !!request?.id,
  });

  const { data: quotation } = useQuery<any>({
    queryKey: [`/api/quotations/purchase-request/${request?.id}`],
    enabled: !!request?.id,
  });

  const { data: supplierQuotations = [] } = useQuery<any[]>({
    queryKey: [`/api/quotations/${quotation?.id}/supplier-quotations`],
    enabled: !!quotation?.id,
  });

  // Buscar items do fornecedor selecionado para obter preços
  const selectedSupplierQuotation = supplierQuotations.find((sq: any) => sq.isChosen === true) || supplierQuotations.find((sq: any) => sq.totalValue);
  
  const { data: supplierQuotationItems = [], isLoading: isLoadingSupplierItems } = useQuery<any[]>({
    queryKey: [`/api/supplier-quotations/${selectedSupplierQuotation?.id}/items`],
    enabled: !!selectedSupplierQuotation?.id,
  });

  // Buscar dados do fornecedor selecionado
  const { data: selectedSupplier } = useQuery<any>({
    queryKey: [`/api/suppliers/${selectedSupplierQuotation?.supplierId}`],
    enabled: !!selectedSupplierQuotation?.supplierId,
  });



  // Mutation para salvar observações
  const updateRequestMutation = useMutation({
    mutationFn: async (data: PurchaseOrderFormData) => {
      return apiRequest(`/api/purchase-requests/${request.id}`, {
        method: "PATCH",
        body: data
      });
    },
    onSuccess: (updatedRequest) => {
      toast({
        title: "Sucesso",
        description: "Observações do pedido atualizadas com sucesso!",
      });
      // Invalidate queries to refetch updated data
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      queryClient.invalidateQueries({ predicate: (query) => !!(query.queryKey[0] === "/api/purchase-requests") });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao atualizar observações do pedido",
        variant: "destructive",
      });
    },
  });

  // Mutation para avançar para recebimento
  const advanceToReceiptMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/purchase-requests/${request.id}/advance-to-receipt`, {
        method: "POST"
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      toast({
        title: "Sucesso",
        description: "Solicitação movida para recebimento com sucesso!",
      });
      onClose(); // Close the modal after successful advance
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Falha ao avançar para recebimento",
        variant: "destructive",
      });
    },
  });

  const handleAdvanceToReceipt = () => {
    if (window.confirm("Confirma o avanço desta solicitação para a fase de Recebimento?")) {
      advanceToReceiptMutation.mutate();
    }
  };

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

  const onSubmit = (data: PurchaseOrderFormData) => {
    updateRequestMutation.mutate(data);
  };

  // Buscar itens da cotação para fazer a correspondência
  const { data: quotationItems = [] } = useQuery<any[]>({
    queryKey: [`/api/quotations/${quotation?.id}/items`],
    enabled: !!quotation?.id,
  });

  // Combinar itens com preços do fornecedor selecionado
  const itemsWithPrices = Array.isArray(items) ? items.map(item => {
    // Encontrar o item correspondente na cotação usando purchaseRequestItemId
    const quotationItem = quotationItems.find((qi: any) => {
      // Primeiro tenta por purchaseRequestItemId (método mais confiável)
      if (qi.purchaseRequestItemId && item.id && qi.purchaseRequestItemId === item.id) {
        return true;
      }
      return false;
    }) || quotationItems.find((qi: any) => {
      // Segundo: tenta por descrição exata
       if (qi.description && item.description && 
           qi.description.trim().toLowerCase() === item.description.trim().toLowerCase()) {
         return true;
       }
      return false;
    }) || quotationItems.find((qi: any) => {
      // Terceiro: tenta por código do item
       if (qi.itemCode && item.itemCode && qi.itemCode === item.itemCode) {
         return true;
       }
      return false;
    }) || quotationItems.find((qi: any) => {
      // Último recurso: descrição parcial muito restritiva
      if (qi.description && item.description) {
        const qiDesc = qi.description.trim().toLowerCase();
        const itemDesc = item.description.trim().toLowerCase();
        
        // Só considera correspondência parcial se as descrições forem muito similares
        // E se não há risco de correspondência cruzada
        const similarity = Math.min(qiDesc.length, itemDesc.length) / Math.max(qiDesc.length, itemDesc.length);
        
        // Verifica se não há outro item com descrição mais similar
        const hasMoreSimilarItem = quotationItems.some((otherQi: any) => {
          if (otherQi.id === qi.id || !otherQi.description) return false;
          const otherDesc = otherQi.description.trim().toLowerCase();
          const otherSimilarity = Math.min(otherDesc.length, itemDesc.length) / Math.max(otherDesc.length, itemDesc.length);
          return otherSimilarity > similarity && (otherDesc.includes(itemDesc) || itemDesc.includes(otherDesc));
        });
        
        if (similarity > 0.85 && !hasMoreSimilarItem && (qiDesc.includes(itemDesc) || itemDesc.includes(qiDesc))) {
           return true;
         }
      }
      return false;
    });
    
    if (quotationItem) {
      // Encontrar o preço do fornecedor para este item da cotação
      const supplierItem = supplierQuotationItems.find((si: any) => si.quotationItemId === quotationItem.id);
      
      if (supplierItem) {
        const unitPrice = Number(supplierItem.unitPrice) || 0;
        const quantity = Number(item.requestedQuantity) || 1;
        
        // Calcular preço com desconto se houver
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
        
        const result = {
          ...item,
          unitPrice: unitPrice, // Manter o preço unitário original
          originalUnitPrice: unitPrice,
          itemDiscount: itemDiscount,
          totalPrice: discountedTotal, // Usar o total com desconto
          originalTotalPrice: originalTotal,
          brand: supplierItem.brand || '',
          deliveryTime: supplierItem.deliveryDays ? `${supplierItem.deliveryDays} dias` : '',
          isAvailable: supplierItem.isAvailable !== false // Considerar disponível se não especificado
        };
        
        return result;
       }
     }
    return {
      ...item,
      unitPrice: 0,
      originalUnitPrice: 0,
      itemDiscount: 0,
      totalPrice: 0,
      originalTotalPrice: 0,
      brand: '',
      deliveryTime: '',
      isAvailable: true // Considerar disponível se não há informação do fornecedor
    };
  }).filter((item: any) => item.isAvailable) : []; // Filtrar apenas itens disponíveis

  // Calcular valores totais
  // Usar o valor original dos itens para o subtotal (sem desconto aplicado)
  const subtotal = itemsWithPrices.reduce((sum: number, item: any) => 
    sum + (Number(item.originalTotalPrice) || 0), 0
  );
  
  // Calcular desconto total dos itens
  const itemDiscountTotal = itemsWithPrices.reduce((sum: number, item: any) => 
    sum + (Number(item.itemDiscount) || 0), 0
  );
  
  // Calcular desconto da proposta sobre o subtotal original
  let proposalDiscount = 0;
  if (selectedSupplierQuotation?.discountType && selectedSupplierQuotation.discountType !== 'none' && selectedSupplierQuotation.discountValue) {
    const discountValue = Number(selectedSupplierQuotation.discountValue) || 0;
    if (selectedSupplierQuotation.discountType === 'percentage') {
      proposalDiscount = (subtotal * discountValue) / 100;
    } else if (selectedSupplierQuotation.discountType === 'fixed') {
      proposalDiscount = discountValue;
    }
  }
  
  const totalDiscount = itemDiscountTotal + proposalDiscount;
  
  // Calcular frete
  const freightValue = selectedSupplierQuotation?.includesFreight && selectedSupplierQuotation?.freightValue 
    ? Number(selectedSupplierQuotation.freightValue) || 0 
    : 0;
  
  const finalTotal = subtotal - totalDiscount + freightValue;



  // Organizar histórico de aprovações
  const aprovacaoA1 = Array.isArray(approvalHistory) ? 
    approvalHistory.find((h: any) => h.approverType === 'A1') : null;
  const aprovacaoA2 = Array.isArray(approvalHistory) ? 
    approvalHistory.find((h: any) => h.approverType === 'A2') : null;

  return (
    <div className={`space-y-2 md:space-y-3 lg:space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg md:text-xl lg:text-2xl font-bold">
          Pedido de Compra #{request.purchaseOrderNumber || request.id}
        </h2>
        <Button
          onClick={onClose}
          variant="ghost"
          size="sm"
          className="h-6 w-6 md:h-8 md:w-8 p-0"
        >
          <X className="h-3 w-3 md:h-4 md:w-4" />
        </Button>
      </div>

      {/* Request Information */}
      <Card>
        <CardHeader className="pb-1 md:pb-2">
          <CardTitle className="text-sm md:text-base lg:text-lg flex items-center gap-1 md:gap-2">
            <User className="h-3 w-3 md:h-4 md:w-4 lg:h-5 lg:w-5" />
            Informações da Solicitação
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 md:p-3 lg:p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1 md:gap-2 lg:gap-4">
            <div>
              <span className="text-xs md:text-sm font-medium text-gray-500">Solicitante</span>
              <p className="text-xs md:text-sm lg:text-base font-semibold">{request.requester?.name}</p>
            </div>
            <div>
              <span className="text-xs md:text-sm font-medium text-gray-500">Centro de Custo</span>
              <p className="text-xs md:text-sm lg:text-base">{request.costCenter}</p>
            </div>
            <div>
              <span className="text-xs md:text-sm font-medium text-gray-500">Data da Solicitação</span>
              <p className="text-xs md:text-sm lg:text-base">
                {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true, locale: ptBR })}
              </p>
            </div>
            <div>
              <span className="text-xs md:text-sm font-medium text-gray-500">Urgência</span>
              <Badge variant={request.urgency === 'high' ? 'destructive' : request.urgency === 'medium' ? 'default' : 'secondary'} className="text-xs">
                {request.urgency}
              </Badge>
            </div>
            <div>
              <span className="text-xs md:text-sm font-medium text-gray-500">Status</span>
              <Badge variant="default" className="text-xs">Pedido de Compra</Badge>
            </div>
            <div>
              <span className="text-xs md:text-sm font-medium text-gray-500">Valor Total</span>
              <p className="text-sm md:text-base lg:text-lg font-bold text-green-600">
                R$ {(request.totalValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
          
          <div className="mt-1 md:mt-2 lg:mt-4">
            <span className="text-xs md:text-sm font-medium text-gray-500">Justificativa</span>
            <p className="mt-1 text-xs md:text-sm lg:text-base">{request.justification}</p>
          </div>
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card>
        <CardHeader className="pb-1 md:pb-2">
          <CardTitle className="text-sm md:text-base lg:text-lg flex items-center gap-1 md:gap-2">
            <Package className="h-3 w-3 md:h-4 md:w-4 lg:h-5 lg:w-5" />
            Itens do Pedido
          </CardTitle>
        </CardHeader>
        <CardContent className="p-1 md:p-2 lg:p-6">
          {itemsWithPrices.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-200 text-xs md:text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="border border-gray-200 px-1 md:px-2 py-0.5 md:py-1 text-left text-xs md:text-sm">Descrição</th>
                    <th className="border border-gray-200 px-1 md:px-2 py-0.5 md:py-1 text-center text-xs md:text-sm">Qtd</th>
                    <th className="border border-gray-200 px-1 md:px-2 py-0.5 md:py-1 text-center text-xs md:text-sm">Un.</th>
                    <th className="border border-gray-200 px-1 md:px-2 py-0.5 md:py-1 text-center text-xs md:text-sm">Preço Unit.</th>
                    <th className="border border-gray-200 px-1 md:px-2 py-0.5 md:py-1 text-center text-xs md:text-sm">Total</th>
                    <th className="border border-gray-200 px-1 md:px-2 py-0.5 md:py-1 text-center text-xs md:text-sm">Marca</th>
                    <th className="border border-gray-200 px-1 md:px-2 py-0.5 md:py-1 text-center text-xs md:text-sm">Prazo</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsWithPrices.map((item: any, index: number) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="border border-gray-200 px-1 md:px-2 py-0.5 md:py-1">
                        <div className="font-medium text-xs md:text-sm">{item.description}</div>
                        {item.specifications && (
                          <div className="text-xs text-muted-foreground">
                            Especificações: {item.specifications}
                          </div>
                        )}
                      </td>
                      <td className="border border-gray-200 px-1 md:px-2 py-0.5 md:py-1 text-center text-xs md:text-sm">
                        {item.requestedQuantity}
                      </td>
                      <td className="border border-gray-200 px-1 md:px-2 py-0.5 md:py-1 text-center text-xs md:text-sm">
                        {item.unit || 'UND'}
                      </td>
                      <td className="border border-gray-200 px-1 md:px-2 py-0.5 md:py-1 text-center text-xs md:text-sm">
                        R$ {typeof item.unitPrice === 'number' ? item.unitPrice.toFixed(2).replace('.', ',') : '0,00'}
                      </td>
                      <td className="border border-gray-200 px-1 md:px-2 py-0.5 md:py-1 text-center font-medium text-xs md:text-sm">
                        {item.itemDiscount > 0 ? (
                          <div>
                            <div className="text-xs text-gray-500 line-through">
                              R$ {typeof item.originalTotalPrice === 'number' ? item.originalTotalPrice.toFixed(2).replace('.', ',') : '0,00'}
                            </div>
                            <div className="text-green-600">
                              R$ {typeof item.totalPrice === 'number' ? item.totalPrice.toFixed(2).replace('.', ',') : '0,00'}
                            </div>
                          </div>
                        ) : (
                          <span>R$ {typeof item.totalPrice === 'number' ? item.totalPrice.toFixed(2).replace('.', ',') : '0,00'}</span>
                        )}
                      </td>
                      <td className="border border-gray-200 px-1 md:px-2 py-0.5 md:py-1 text-center text-xs md:text-sm">
                        {item.brand || '-'}
                      </td>
                      <td className="border border-gray-200 px-1 md:px-2 py-0.5 md:py-1 text-center text-xs md:text-sm">
                        {item.deliveryTime || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-2 md:py-4 text-gray-500">
              <Package className="h-6 w-6 md:h-8 md:w-8 mx-auto mb-1 md:mb-2 opacity-50" />
              <p className="text-xs md:text-sm">Nenhum item encontrado</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Supplier Information */}
      {selectedSupplierQuotation && (
        <Card>
          <CardHeader className="pb-1 md:pb-2">
            <CardTitle className="text-sm md:text-base lg:text-lg flex items-center gap-1 md:gap-2">
              <Building className="h-3 w-3 md:h-4 md:w-4 lg:h-5 lg:w-5" />
              Fornecedor Vencedor
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 md:p-3 lg:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1 md:gap-2 lg:gap-4">
              <div>
                <span className="text-xs md:text-sm font-medium text-gray-500">Nome</span>
                <p className="text-sm md:text-base lg:text-lg font-semibold">{selectedSupplierQuotation.supplier?.name || selectedSupplier?.name}</p>
              </div>
              <div>
                <span className="text-xs md:text-sm font-medium text-gray-500">E-mail</span>
                <p className="text-xs md:text-sm lg:text-base">{selectedSupplierQuotation.supplier?.email || selectedSupplier?.email}</p>
              </div>
              <div>
                <span className="text-xs md:text-sm font-medium text-gray-500">Telefone</span>
                <p className="text-xs md:text-sm lg:text-base">{selectedSupplierQuotation.supplier?.phone || selectedSupplier?.phone || 'Não informado'}</p>
              </div>
              <div>
                <span className="text-xs md:text-sm font-medium text-gray-500">CNPJ</span>
                <p className="text-xs md:text-sm lg:text-base">{selectedSupplierQuotation.supplier?.cnpj || selectedSupplier?.cnpj || 'Não informado'}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1 md:gap-2 lg:gap-4 mt-1 md:mt-2 lg:mt-4">
              <div>
                <span className="text-xs md:text-sm font-medium text-gray-500">Valor Total da Proposta</span>
                <p className="text-sm md:text-base lg:text-lg font-bold text-green-600">
                  R$ {(selectedSupplierQuotation.totalValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <span className="text-xs md:text-sm font-medium text-gray-500 flex items-center gap-1">
                  <Truck className="h-3 w-3 md:h-4 md:w-4" />
                  Frete
                </span>
                <p className="text-sm md:text-base lg:text-lg font-semibold">
                  {selectedSupplierQuotation.includesFreight ? (
                    <span className="text-blue-600">
                      R$ {(selectedSupplierQuotation.freightValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  ) : (
                    <span className="text-gray-500">Não incluso</span>
                  )}
                </p>
              </div>
            </div>
            
            <div className="mt-1 md:mt-2 lg:mt-4">
              <span className="text-xs md:text-sm font-medium text-gray-500">Condições de Pagamento</span>
              <p className="text-xs md:text-sm lg:text-base">{selectedSupplierQuotation.paymentTerms || 'N/A'}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Purchase Order Observations */}
      <Card>
        <CardHeader className="pb-1 md:pb-2">
          <CardTitle className="text-sm md:text-base lg:text-lg">Observações do Pedido de Compra</CardTitle>
        </CardHeader>
        <CardContent className="p-2 md:p-3 lg:p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-1 md:space-y-2 lg:space-y-4">
              <FormField
                control={form.control}
                name="purchaseObservations"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs md:text-sm">Observações</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Adicione observações específicas para o pedido de compra..."
                        className="min-h-[50px] md:min-h-[60px] lg:min-h-[80px] text-xs md:text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
              <Button 
                type="submit" 
                disabled={updateObservationsMutation.isPending}
                className="w-full text-xs md:text-sm h-6 md:h-7 lg:h-10"
              >
                {updateObservationsMutation.isPending ? 'Salvando...' : 'Salvar Observações'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* PDF Actions */}
      <Card>
        <CardHeader className="pb-1 md:pb-2">
          <CardTitle className="text-sm md:text-base lg:text-lg">Pedido de Compra (PDF)</CardTitle>
        </CardHeader>
        <CardContent className="p-2 md:p-3 lg:p-6">
          <div className="flex flex-col sm:flex-row gap-1 md:gap-2">
            <Button
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              className="flex-1 text-xs md:text-sm h-6 md:h-7 lg:h-10"
            >
              <Download className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" />
              {isDownloading ? 'Baixando...' : 'Baixar PDF'}
            </Button>
            <Button
              onClick={handlePreviewPdf}
              disabled={isLoadingPreview}
              variant="outline"
              className="flex-1 text-xs md:text-sm h-6 md:h-7 lg:h-10"
            >
              <Eye className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" />
              {isLoadingPreview ? 'Carregando...' : 'Visualizar PDF'}
            </Button>
          </div>
        </CardContent>
      </Card>

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
    </div>
  );
}