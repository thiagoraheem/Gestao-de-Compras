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
  }, [request?.purchaseObservations, form]);

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
      // Fallback: tenta por descrição exata
      if (qi.description && item.description && 
          qi.description.trim().toLowerCase() === item.description.trim().toLowerCase()) {
        return true;
      }
      // Fallback: tenta por código do item
      if (qi.itemCode && item.itemCode && qi.itemCode === item.itemCode) {
        return true;
      }
      // Fallback: tenta por descrição parcial
      if (qi.description && item.description) {
        const qiDesc = qi.description.trim().toLowerCase();
        const itemDesc = item.description.trim().toLowerCase();
        return qiDesc.includes(itemDesc) || itemDesc.includes(qiDesc);
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
        
        return {
          ...item,
          unitPrice: unitPrice, // Manter o preço unitário original
          originalUnitPrice: unitPrice,
          itemDiscount: itemDiscount,
          totalPrice: discountedTotal, // Usar o total com desconto
          originalTotalPrice: originalTotal,
          brand: supplierItem.brand || '',
          deliveryTime: supplierItem.deliveryDays ? `${supplierItem.deliveryDays} dias` : ''
        };
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
      deliveryTime: ''
    };
  }) : [];

  // Calcular valores totais
  const subtotal = itemsWithPrices.reduce((sum: number, item: any) => 
    sum + (Number(item.totalPrice) || 0), 0
  );
  
  // Calcular desconto total dos itens
  const itemDiscountTotal = itemsWithPrices.reduce((sum: number, item: any) => 
    sum + (Number(item.itemDiscount) || 0), 0
  );
  
  // Calcular desconto da proposta
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
  const finalTotal = subtotal - totalDiscount;



  // Organizar histórico de aprovações
  const aprovacaoA1 = Array.isArray(approvalHistory) ? 
    approvalHistory.find((h: any) => h.approverType === 'A1') : null;
  const aprovacaoA2 = Array.isArray(approvalHistory) ? 
    approvalHistory.find((h: any) => h.approverType === 'A2') : null;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header com título e botão de fechar */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">Pedido de Compra</h2>
            {request.hasPendency && (
              <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-300">
                <X className="w-3 h-3 mr-1" />
                PENDÊNCIA
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            Solicitação {request.requestNumber} - Resumo completo do processo
          </p>
          {request.hasPendency && request.pendencyReason && (
            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">
                <strong>Motivo da Pendência:</strong> {request.pendencyReason}
              </p>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleAdvanceToReceipt}
            disabled={advanceToReceiptMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Truck className="w-4 h-4 mr-2" />
            {advanceToReceiptMutation.isPending ? "Avançando..." : "Avançar para Recebimento"}
          </Button>
          <Button
            onClick={handlePreviewPDF}
            disabled={isLoadingPreview}
            variant="outline"
            className="border-green-600 text-green-600 hover:bg-green-50"
          >
            <Eye className="w-4 h-4 mr-2" />
            {isLoadingPreview ? "Carregando..." : "Visualizar PDF"}
          </Button>
          <Button
            onClick={handleDownloadPDF}
            disabled={isDownloading}
            className="bg-green-600 hover:bg-green-700"
          >
            <Download className="w-4 h-4 mr-2" />
            {isDownloading ? "Gerando PDF..." : "Baixar PDF"}
          </Button>
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Fechar
          </Button>
        </div>
      </div>

      {/* Resumo da Solicitação */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Informações da Solicitação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Solicitante:</span>
                <span>{request.requester ? `${request.requester.firstName} ${request.requester.lastName}` : "Não informado"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Departamento:</span>
                <span>{request.department?.name || "Não informado"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Data da Solicitação:</span>
                <span>{new Date(request.createdAt).toLocaleDateString('pt-BR')}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Urgência:</span>
                <Badge variant={request.urgency === 'alto' ? 'destructive' : 'secondary'}>
                  {request.urgency === 'alto' ? 'Alto' : request.urgency === 'medio' ? 'Médio' : request.urgency === 'baixo' ? 'Baixo' : request.urgency}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Categoria:</span>
                <span>{request.category}</span>
              </div>
              {selectedSupplier && (
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Fornecedor Selecionado:</span>
                  <span className="text-green-600 font-medium">{selectedSupplier.name}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Entrega Ideal:</span>
                <span>
                  {request.idealDeliveryDate 
                    ? new Date(request.idealDeliveryDate).toLocaleDateString('pt-BR')
                    : "Não especificada"
                  }
                </span>
              </div>
            </div>
          </div>
          <div>
            <span className="font-medium">Justificativa:</span>
            <p className="text-sm text-muted-foreground mt-1">{request.justification}</p>
          </div>
        </CardContent>
      </Card>

      {/* Itens da Solicitação */}
      <Card>
        <CardHeader>
          <CardTitle>Itens Solicitados</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingSupplierItems ? (
            <div className="text-center py-4">Carregando itens...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-200 px-4 py-2 text-left">Item</th>
                    <th className="border border-gray-200 px-4 py-2 text-center">Qtd.</th>
                    <th className="border border-gray-200 px-4 py-2 text-center">Unidade</th>
                    <th className="border border-gray-200 px-4 py-2 text-center">Valor Unit.</th>
                    <th className="border border-gray-200 px-4 py-2 text-center">Valor Total</th>
                    <th className="border border-gray-200 px-4 py-2 text-center">Marca</th>
                    <th className="border border-gray-200 px-4 py-2 text-center">Prazo</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsWithPrices.map((item: any, index: number) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="border border-gray-200 px-4 py-2">
                        <div className="font-medium">{item.description}</div>
                        {item.specifications && (
                          <div className="text-sm text-muted-foreground">
                            Especificações: {item.specifications}
                          </div>
                        )}
                      </td>
                      <td className="border border-gray-200 px-4 py-2 text-center">
                        {item.requestedQuantity}
                      </td>
                      <td className="border border-gray-200 px-4 py-2 text-center">
                        {item.unit || 'UND'}
                      </td>
                      <td className="border border-gray-200 px-4 py-2 text-center">
                        R$ {typeof item.unitPrice === 'number' ? item.unitPrice.toFixed(2).replace('.', ',') : '0,00'}
                      </td>
                      <td className="border border-gray-200 px-4 py-2 text-center font-medium">
                        R$ {typeof item.totalPrice === 'number' ? item.totalPrice.toFixed(2).replace('.', ',') : '0,00'}
                      </td>
                      <td className="border border-gray-200 px-4 py-2 text-center">
                        {item.brand || '-'}
                      </td>
                      <td className="border border-gray-200 px-4 py-2 text-center">
                        {item.deliveryTime || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-bold">
                    <td className="border border-gray-200 px-4 py-2" colSpan={4}>
                      Subtotal:
                    </td>
                    <td className="border border-gray-200 px-4 py-2 text-center">
                      R$ {subtotal.toFixed(2).replace('.', ',')}
                    </td>
                    <td className="border border-gray-200 px-4 py-2" colSpan={2}></td>
                  </tr>
                  {totalDiscount > 0 && (
                    <tr>
                      <td className="border border-gray-200 px-4 py-2" colSpan={4}>
                        Desconto Total:
                      </td>
                      <td className="border border-gray-200 px-4 py-2 text-center text-red-600">
                        - R$ {totalDiscount.toFixed(2).replace('.', ',')}
                      </td>
                      <td className="border border-gray-200 px-4 py-2" colSpan={2}></td>
                    </tr>
                  )}
                  <tr className="bg-gray-100 font-bold">
                    <td className="border border-gray-200 px-4 py-2" colSpan={4}>
                      Total Geral:
                    </td>
                    <td className="border border-gray-200 px-4 py-2 text-center">
                      R$ {finalTotal.toFixed(2).replace('.', ',')}
                    </td>
                    <td className="border border-gray-200 px-4 py-2" colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fornecedor Vencedor */}
      {selectedSupplierQuotation && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="w-5 h-5" />
              Fornecedor Vencedor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="text-sm">
                  <span className="font-medium text-gray-600">Nome:</span>
                  <p className="text-lg font-semibold">{selectedSupplierQuotation.supplier?.name || selectedSupplier?.name}</p>
                </div>
                <div className="text-sm">
                  <span className="font-medium text-gray-600">E-mail:</span>
                  <p>{selectedSupplierQuotation.supplier?.email || selectedSupplier?.email}</p>
                </div>
                <div className="text-sm">
                  <span className="font-medium text-gray-600">Telefone:</span>
                  <p>{selectedSupplierQuotation.supplier?.phone || selectedSupplier?.phone || 'Não informado'}</p>
                </div>
                <div className="text-sm">
                  <span className="font-medium text-gray-600">CNPJ:</span>
                  <p>{selectedSupplierQuotation.supplier?.cnpj || selectedSupplier?.cnpj || 'Não informado'}</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="text-sm">
                  <span className="font-medium text-gray-600">Valor Total da Proposta:</span>
                  <p className="text-lg font-semibold text-green-600">
                    R$ {finalTotal.toFixed(2).replace('.', ',')}
                  </p>
                </div>
                {totalDiscount > 0 && (
                  <div className="text-sm">
                    <span className="font-medium text-gray-600">Desconto Total Aplicado:</span>
                    <p className="text-lg font-semibold text-red-600">
                      - R$ {totalDiscount.toFixed(2).replace('.', ',')}
                    </p>
                  </div>
                )}
                <div className="text-sm">
                  <span className="font-medium text-gray-600">Prazo de Entrega:</span>
                  <p>{selectedSupplierQuotation.deliveryTerms || 'Não informado'}</p>
                </div>
                <div className="text-sm">
                  <span className="font-medium text-gray-600">Condições de Pagamento:</span>
                  <p>{selectedSupplierQuotation.paymentTerms || 'Não informado'}</p>
                </div>
                {selectedSupplierQuotation.observations && (
                  <div className="text-sm">
                    <span className="font-medium text-gray-600">Observações:</span>
                    <p>{selectedSupplierQuotation.observations}</p>
                  </div>
                )}
                
                {/* Desconto da Proposta */}
                {(selectedSupplierQuotation.discountType && selectedSupplierQuotation.discountType !== 'none' && selectedSupplierQuotation.discountValue) && (
                  <div className="text-sm">
                    <span className="font-medium text-gray-600">Desconto da Proposta:</span>
                    <p className="text-lg font-semibold text-green-600">
                      {selectedSupplierQuotation.discountType === 'percentage' 
                        ? `${selectedSupplierQuotation.discountValue}%`
                        : `R$ ${Number(selectedSupplierQuotation.discountValue).toFixed(2).replace('.', ',')}`
                      }
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Histórico de Aprovações */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Aprovações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {aprovacaoA1 && (
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div className="flex-1">
                  <div className="font-medium">Aprovação A1</div>
                  <div className="text-sm text-muted-foreground">
                    {aprovacaoA1.approved ? 'Aprovado' : 'Rejeitado'} por {aprovacaoA1.approver?.firstName} {aprovacaoA1.approver?.lastName} em{" "}
                    {new Date(aprovacaoA1.createdAt).toLocaleDateString('pt-BR')}
                  </div>
                  {aprovacaoA1.rejectionReason && (
                    <div className="text-sm text-muted-foreground">
                      Motivo: {aprovacaoA1.rejectionReason}
                    </div>
                  )}
                </div>
              </div>
            )}
            {aprovacaoA2 && (
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div className="flex-1">
                  <div className="font-medium">Aprovação A2</div>
                  <div className="text-sm text-muted-foreground">
                    {aprovacaoA2.approved ? 'Aprovado' : 'Rejeitado'} por {aprovacaoA2.approver?.firstName} {aprovacaoA2.approver?.lastName} em{" "}
                    {new Date(aprovacaoA2.createdAt).toLocaleDateString('pt-BR')}
                  </div>
                  {aprovacaoA2.rejectionReason && (
                    <div className="text-sm text-muted-foreground">
                      Motivo: {aprovacaoA2.rejectionReason}
                    </div>
                  )}
                </div>
              </div>
            )}
            {!aprovacaoA1 && !aprovacaoA2 && (
              <div className="text-center text-muted-foreground py-4">
                Nenhuma aprovação encontrada no histórico
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Observações do Pedido */}
      <Card>
        <CardHeader>
          <CardTitle>Observações do Pedido de Compra</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="purchaseObservations"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações Adicionais</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        rows={4} 
                        placeholder="Adicione observações específicas para o pedido de compra..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={updateRequestMutation.isPending}>
                {updateRequestMutation.isPending ? "Salvando..." : "Salvar Observações"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Anexos */}
      {Array.isArray(attachments) && attachments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Anexos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {attachments.map((attachment: any) => (
                <div key={attachment.id} className="flex items-center gap-2 p-2 border rounded">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{attachment.filename}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal de Pré-visualização do PDF */}
      <Dialog open={showPreviewModal} onOpenChange={handleClosePreview}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Pré-visualização - Pedido de Compra {request.requestNumber}</span>
              <div className="flex gap-2">
                <Button
                  onClick={handleDownloadFromPreview}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Baixar PDF
                </Button>
                <Button
                  onClick={handleClosePreview}
                  size="sm"
                  variant="outline"
                >
                  <X className="w-4 h-4 mr-2" />
                  Fechar
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden">
            {pdfPreviewUrl ? (
              <iframe
                src={pdfPreviewUrl}
                className="w-full h-[75vh] border rounded-lg"
                title="Pré-visualização do PDF"
              />
            ) : (
              <div className="flex items-center justify-center h-[75vh] bg-gray-50 rounded-lg">
                <div className="text-center">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Carregando pré-visualização...</p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}