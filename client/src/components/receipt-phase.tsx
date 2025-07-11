import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { X, Check, Package, User, Building, Calendar, DollarSign, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { URGENCY_LABELS, CATEGORY_LABELS } from "@/lib/types";
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
      const response = await apiRequest("POST", `/api/purchase-requests/${request?.id}/confirm-receipt`, {
        receivedById: user?.id,
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
      const response = await apiRequest("POST", `/api/purchase-requests/${request.id}/report-issue`, {
        reportedById: user?.id,
        pendencyReason,
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

  const formatCurrency = (value: any) => {
    if (!value) return "N/A";
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(Number(value));
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

  // Combine items with supplier quotation data (same logic as conclusion phase)
  const itemsWithPrices = useMemo(() => {
    if (!Array.isArray(items) || !Array.isArray(supplierQuotationItems)) {
      return [];
    }

    return (items as any[]).map((item: any) => {
      // Find matching supplier quotation item by description (same as conclusion phase)
      const supplierItem = (supplierQuotationItems as any[]).find((sqi: any) => 
        sqi.description === item.description || 
        sqi.itemCode === item.itemCode
      );
      
      const unitPrice = supplierItem ? parseFloat(supplierItem.unitPrice) || 0 : 0;
      const quantity = parseFloat(item.requestedQuantity) || 0;
      const totalPrice = quantity * unitPrice;
      
      return {
        ...item,
        unitPrice: unitPrice,
        totalPrice: totalPrice,
        brand: supplierItem?.brand || '',
        deliveryTime: supplierItem?.deliveryDays ? `${supplierItem.deliveryDays} dias` : '',
        supplier: selectedSupplierQuotation?.supplier
      };
    });
  }, [items, supplierQuotationItems, selectedSupplierQuotation]);

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Recebimento de Material</h2>
          <p className="text-sm text-gray-500">
            Confirme o recebimento ou reporte pendências
          </p>
        </div>
        <Button variant="ghost" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
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
                <p className="text-sm font-medium text-gray-500">Número</p>
                <Badge variant="outline" className="mt-1">
                  {request.requestNumber}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Categoria</p>
                <p className="text-sm">{CATEGORY_LABELS[request.category as keyof typeof CATEGORY_LABELS]}</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-500">Justificativa</p>
              <p className="text-sm mt-1">{request.justification}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Urgência</p>
                <Badge 
                  variant={request.urgency === "alto" ? "destructive" : "secondary"} 
                  className="mt-1"
                >
                  {URGENCY_LABELS[request.urgency as keyof typeof URGENCY_LABELS]}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Valor Total</p>
                <p className="text-sm font-medium mt-1">{formatCurrency(request.totalValue)}</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-500">Data de Criação</p>
              <p className="text-sm mt-1">{formatDate(request.createdAt)}</p>
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
              <p className="text-sm font-medium text-gray-500">Solicitante</p>
              <p className="text-sm mt-1">
                {request.requester ? 
                  `${request.requester.firstName} ${request.requester.lastName}` : 
                  "N/A"
                }
              </p>
              <p className="text-xs text-gray-400">{request.requester?.email}</p>
            </div>

            {request.approverA1 && (
              <div>
                <p className="text-sm font-medium text-gray-500">Aprovador A1</p>
                <p className="text-sm mt-1">
                  {`${request.approverA1.firstName} ${request.approverA1.lastName}`}
                </p>
                <p className="text-xs text-gray-400">{request.approverA1.email}</p>
              </div>
            )}

            {request.approverA2 && (
              <div>
                <p className="text-sm font-medium text-gray-500">Aprovador A2</p>
                <p className="text-sm mt-1">
                  {`${request.approverA2.firstName} ${request.approverA2.lastName}`}
                </p>
                <p className="text-xs text-gray-400">{request.approverA2.email}</p>
              </div>
            )}

            {request.costCenter && (
              <div>
                <p className="text-sm font-medium text-gray-500">Centro de Custo</p>
                <p className="text-sm mt-1">{request.costCenter.name}</p>
                <p className="text-xs text-gray-400">Código: {request.costCenter.code}</p>
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
              <div>
                <p className="text-sm font-medium text-gray-500">Condições de Pagamento</p>
                <p className="text-sm mt-1">{selectedSupplierQuotation.paymentTerms || 'N/A'}</p>
              </div>
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
      {request.purchaseOrderObservations && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Observações do Pedido de Compra
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 whitespace-pre-wrap">
                {request.purchaseOrderObservations}
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
            <div className="rounded-md border">
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
                        {item.requestedQuantity}
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
              <div className="border-t bg-gray-50 p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">
                    Total Geral ({itemsWithPrices.length} {itemsWithPrices.length === 1 ? 'item' : 'itens'})
                  </span>
                  <span className="text-lg font-bold text-green-600">
                    {formatCurrency(
                      itemsWithPrices.reduce((total: number, item: any) => total + (item.totalPrice || 0), 0)
                    )}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhum item encontrado</p>
              <p className="text-sm">Os dados dos itens serão carregados automaticamente</p>
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
                <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">
                        {history.approver?.firstName} {history.approver?.lastName}
                      </p>
                      <Badge variant={history.approved ? "default" : "destructive"}>
                        {history.approved ? "Aprovado" : "Rejeitado"}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDate(history.createdAt)}
                    </p>
                    {history.rejectionReason && (
                      <p className="text-sm text-red-600 mt-2">
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
      <div className="flex justify-end space-x-3">
        <Button variant="outline" onClick={onClose}>
          Fechar
        </Button>
        <Button
          variant="destructive"
          onClick={() => setIsPendencyModalOpen(true)}
          disabled={reportIssueMutation.isPending}
        >
          <X className="mr-2 h-4 w-4" />
          Reportar Pendência
        </Button>
        <Button
          onClick={() => confirmReceiptMutation.mutate()}
          disabled={confirmReceiptMutation.isPending}
          className="bg-green-600 hover:bg-green-700"
        >
          <Check className="mr-2 h-4 w-4" />
          Confirmar Recebimento
        </Button>
      </div>

      {/* Pendency Modal */}
      <PendencyModal
        isOpen={isPendencyModalOpen}
        onClose={() => setIsPendencyModalOpen(false)}
        onConfirm={(reason) => reportIssueMutation.mutate(reason)}
        isLoading={reportIssueMutation.isPending}
      />
    </div>
  );
}