import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, DollarSign, Clock, Building2, Package, X, AlertCircle, XCircle, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface SupplierComparisonProps {
  quotationId: number;
  onClose: () => void;
  onComplete: () => void;
}

interface SupplierQuotationItem {
  id: number;
  quotationItemId: number;
  unitPrice: number;
  totalPrice: number;
  deliveryDays: number;
  brand?: string;
  model?: string;
  observations?: string;
  isAvailable?: boolean;
  unavailabilityReason?: string;
  // Campos de desconto
  discountPercentage?: number;
  discountValue?: number;
  originalTotalPrice?: number;
  discountedTotalPrice?: number;
}

interface SupplierQuotationData {
  id: number;
  supplier: {
    id: number;
    name: string;
    email: string;
  };
  status: string;
  receivedAt: string;
  totalValue: number;
  items: SupplierQuotationItem[];
  deliveryDays: number;
  warranty: string;
  warrantyPeriod: string;
  paymentTerms: string;
  observations: string;
  discountType?: string;
  discountValue?: number;
  includesFreight?: boolean;
  freightValue?: number;
}

export default function SupplierComparison({ quotationId, onClose, onComplete }: SupplierComparisonProps) {
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [observations, setObservations] = useState("");
  const [createNewRequestForUnavailable, setCreateNewRequestForUnavailable] = useState(false);
  const [unavailableItemsOption, setUnavailableItemsOption] = useState<'none' | 'with-rfq' | 'without-rfq'>('none');
  const [selectedItems, setSelectedItems] = useState<{[key: number]: boolean}>({});
  const [nonSelectedItemsOption, setNonSelectedItemsOption] = useState<'none' | 'separate-quotation' | 'info-only'>('none');
  const [showItemSelection, setShowItemSelection] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: suppliersData = [], isLoading } = useQuery<SupplierQuotationData[]>({
    queryKey: [`/api/quotations/${quotationId}/supplier-comparison`],
  });

  // Fetch quotation items to get descriptions
  const { data: quotationItems = [] } = useQuery<any[]>({
    queryKey: [`/api/quotations/${quotationId}/items`],
    enabled: !!quotationId,
  });

  const selectSupplierMutation = useMutation({
    mutationFn: async (data: { 
      selectedSupplierId: number; 
      totalValue: number; 
      observations: string; 
      createNewRequest?: boolean; 
      unavailableItems?: any[];
      unavailableItemsOption?: string;
      selectedItems?: any[];
      nonSelectedItemsOption?: string;
      nonSelectedItems?: any[];
    }) => {
      return apiRequest(`/api/quotations/${quotationId}/select-supplier`, { method: "POST", body: data });
    },
    onSuccess: (response) => {
      let description = "O fornecedor foi selecionado com sucesso e a solicitação avançou para Aprovação A2.";
      
      if (createNewRequestForUnavailable && hasUnavailableItems) {
        description += " Uma nova solicitação foi criada automaticamente para os itens indisponíveis.";
      }
      
      if (response.nonSelectedRequestId && response.nonSelectedItemsCount > 0) {
        description += ` Uma nova solicitação foi criada com os ${response.nonSelectedItemsCount} itens não selecionados na fase de Cotação.`;
      }
      
      toast({
        title: "Fornecedor selecionado",
        description,
      });
      // Invalidate all related queries to ensure UI updates immediately
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      queryClient.invalidateQueries({ queryKey: [`/api/quotations/${quotationId}/supplier-comparison`] });
      queryClient.invalidateQueries({ queryKey: [`/api/quotations/${quotationId}/supplier-quotations`] });
      queryClient.invalidateQueries({ predicate: (query) => 
        !!(query.queryKey[0] && typeof query.queryKey[0] === 'string' &&
        (query.queryKey[0].includes('quotations') || query.queryKey[0].includes('purchase-requests')))
      });
      onComplete();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível selecionar o fornecedor.",
        variant: "destructive",
      });
    },
  });

  const handleSelectSupplier = () => {
    if (!selectedSupplierId) {
      toast({
        title: "Atenção",
        description: "Selecione um fornecedor antes de continuar.",
        variant: "destructive",
      });
      return;
    }

    const selectedSupplier = suppliersData.find(s => s.supplier.id === selectedSupplierId);
    if (!selectedSupplier) return;

    // Preparar lista de itens indisponíveis se necessário
    const unavailableItemsData = hasUnavailableItems && unavailableItemsOption !== 'none'
      ? unavailableItems.map(item => ({
          quotationItemId: item.quotationItemId,
          reason: item.unavailabilityReason || "Item indisponível"
        }))
      : undefined;

    // Preparar lista de itens selecionados se estiver em modo de seleção individual
    const selectedItemsData = showItemSelection 
      ? Object.entries(selectedItems)
          .filter(([_, isSelected]) => isSelected)
          .map(([itemId, _]) => ({ quotationItemId: parseInt(itemId) }))
      : undefined;

    // Preparar lista de itens NÃO selecionados para cotação separada
    const nonSelectedItemsData = showItemSelection && nonSelectedItemsOption === 'separate-quotation'
      ? Object.entries(selectedItems)
          .filter(([_, isSelected]) => !isSelected) // Itens NÃO selecionados
          .map(([itemId, _]) => ({ quotationItemId: parseInt(itemId) }))
      : undefined;

    selectSupplierMutation.mutate({
      selectedSupplierId,
      totalValue: selectedSupplier.totalValue,
      observations,
      createNewRequest: hasUnavailableItems && unavailableItemsOption !== 'none',
      unavailableItems: unavailableItemsData,
      unavailableItemsOption,
      selectedItems: selectedItemsData,
      nonSelectedItemsOption: showItemSelection ? nonSelectedItemsOption : 'none',
      nonSelectedItems: nonSelectedItemsData,
    });
  };

  // Detectar itens indisponíveis apenas do fornecedor selecionado
  const selectedSupplierData = selectedSupplierId 
    ? suppliersData.find(s => s.supplier.id === selectedSupplierId)
    : null;
    
  const unavailableItems = selectedSupplierData 
    ? selectedSupplierData.items.filter(item => item.isAvailable === false)
    : [];
  
  const hasUnavailableItems = unavailableItems.length > 0 && selectedSupplierId !== null;

  // Função para inicializar seleção de itens disponíveis
  const initializeItemSelection = () => {
    if (selectedSupplierData) {
      const availableItems = selectedSupplierData.items.filter(item => item.isAvailable !== false);
      const initialSelection: {[key: number]: boolean} = {};
      availableItems.forEach(item => {
        initialSelection[item.quotationItemId] = true; // Por padrão, todos os itens disponíveis são selecionados
      });
      setSelectedItems(initialSelection);
    }
  };

  // Inicializar seleção quando fornecedor for selecionado e modo de seleção ativado
  const handleToggleItemSelection = () => {
    if (!showItemSelection) {
      initializeItemSelection();
    }
    setShowItemSelection(!showItemSelection);
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <p>Carregando dados das cotações...</p>
        </div>
      </div>
    );
  }

  const receivedQuotations = suppliersData.filter(sq => sq.status === 'received');
  const noResponseQuotations = suppliersData.filter(sq => sq.status === 'no_response');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Comparação de Fornecedores</h2>
            <Button variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {receivedQuotations.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Nenhuma cotação foi recebida ainda. Aguarde as respostas dos fornecedores para fazer a comparação.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {noResponseQuotations.length > 0 && (
                <Alert className="mb-6">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Fornecedores que não responderam:</strong> {noResponseQuotations.map(sq => sq.supplier.name).join(", ")}
                    <br />
                    A comparação será feita apenas com os fornecedores que responderam.
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-6">
                {receivedQuotations.map((supplierData) => (
                  <Card 
                    key={supplierData.id} 
                    className={`cursor-pointer transition-all ${
                      selectedSupplierId === supplierData.supplier.id 
                        ? 'ring-2 ring-blue-500 bg-blue-50' 
                        : 'hover:shadow-md'
                    }`}
                    onClick={() => setSelectedSupplierId(supplierData.supplier.id)}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-5 w-5" />
                          {supplierData.supplier.name}
                        </div>
                        {selectedSupplierId === supplierData.supplier.id && (
                          <CheckCircle className="h-5 w-5 text-blue-600" />
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Valor Total */}
                        <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium">Valor Total</span>
                          </div>
                          <span className="text-lg font-bold text-green-600">
                            R$ {supplierData.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        {/* Prazo de Entrega */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium">Prazo</span>
                          </div>
                          <span className="text-sm">{supplierData.deliveryDays} dias</span>
                        </div>

                        {/* Condições de Pagamento */}
                        <div>
                          <span className="text-sm font-medium text-gray-600">Pagamento:</span>
                          <p className="text-sm mt-1">{supplierData.paymentTerms}</p>
                        </div>

                        {/* Período de Garantia */}
                        <div>
                          <span className="text-sm font-medium text-gray-600">Período de Garantia:</span>
                          <p className="text-sm mt-1">{supplierData.warrantyPeriod || supplierData.warranty || "Não informado"}</p>
                        </div>

                        {/* Desconto da Proposta */}
        {(supplierData.discountType && supplierData.discountType !== 'none' && supplierData.discountValue) && (
          <div>
            <span className="text-sm font-medium text-gray-600">Desconto da Proposta:</span>
            <p className="text-sm mt-1 text-green-600 font-medium">
              {supplierData.discountType === 'percentage' 
                ? `${supplierData.discountValue}%`
                : `R$ ${Number(supplierData.discountValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
              }
            </p>
          </div>
        )}

        {/* Frete */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium">Frete</span>
          </div>
          <div className="text-sm">
            {supplierData.includesFreight ? (
              <span className="text-blue-600 font-medium">
                R$ {Number(supplierData.freightValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            ) : (
              <span className="text-gray-500">Não incluso</span>
            )}
          </div>
        </div>

                        {/* Itens */}
                        <div>
                          <span className="text-sm font-medium text-gray-600">Itens:</span>
                          <div className="mt-2 space-y-2">
                            {supplierData.items.slice(0, 3).map((item) => (
                              <div key={item.id} className={`text-xs p-2 rounded ${
                                item.isAvailable === false 
                                  ? 'bg-red-50 border border-red-200' 
                                  : 'bg-gray-50'
                              }`}>
                                <div className="flex justify-between items-center">
                                  <div className="flex items-center gap-1">
                                    {item.isAvailable === false && (
                                      <XCircle className="h-3 w-3 text-red-500 flex-shrink-0" />
                                    )}
                                    <span className={`font-medium ${
                                      item.isAvailable === false ? 'text-red-700' : ''
                                    }`}>
                                      {(() => {
                                        const quotationItem = quotationItems.find(qi => qi.id === item.quotationItemId);
                                        return quotationItem ? quotationItem.description : `Item #${item.quotationItemId}`;
                                      })()}
                                    </span>
                                  </div>
                                  <span className={item.isAvailable === false ? 'text-red-600' : ''}>
                                    {item.isAvailable === false 
                                      ? 'Indisponível' 
                                      : `R$ ${Number(item.unitPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                    }
                                  </span>
                                </div>
                                {item.brand && (
                                  <div className="text-xs text-gray-500">{item.brand} {item.model}</div>
                                )}
                                {item.isAvailable === false && item.unavailabilityReason && (
                                  <div className="text-xs text-red-600 mt-1 italic">
                                    Motivo: {item.unavailabilityReason}
                                  </div>
                                )}
                              </div>
                            ))}
                            {supplierData.items.length > 3 && (
                              <p className="text-xs text-gray-500">
                                +{supplierData.items.length - 3} itens adicionais
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Observações */}
                        {supplierData.observations && (
                          <div>
                            <span className="text-sm font-medium text-gray-600">Observações:</span>
                            <p className="text-xs mt-1 text-gray-500">{supplierData.observations}</p>
                          </div>
                        )}

                        {/* Badge de Status */}
                        <div className="flex justify-between items-center">
                          <Badge variant="outline" className="text-xs">
                            Recebido em {new Date(supplierData.receivedAt).toLocaleDateString('pt-BR')}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Detailed Items Comparison */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Comparação Detalhada de Itens
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-3 font-medium">Item</th>
                          {receivedQuotations.map((supplier) => (
                            <th key={supplier.id} className="text-center p-3 font-medium border-l">
                              {supplier.supplier.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {/* Get all unique items from all suppliers */}
                        {Array.from(
                          new Set(
                            receivedQuotations.flatMap(sq => 
                              sq.items.map(item => item.quotationItemId)
                            )
                          )
                        ).map((quotationItemId) => (
                          <tr key={quotationItemId} className="border-b hover:bg-gray-50">
                            <td className="p-3 font-medium">
                              {(() => {
                                const quotationItem = quotationItems.find(qi => qi.id === quotationItemId);
                                return quotationItem ? quotationItem.description : `Item #${quotationItemId}`;
                              })()}
                            </td>
                            {receivedQuotations.map((supplier) => {
                              const item = supplier.items.find(
                                item => item.quotationItemId === quotationItemId
                              );
                              return (
                                <td key={supplier.id} className={`p-3 border-l text-center ${
                                  item && item.isAvailable === false ? 'bg-red-50' : ''
                                }`}>
                                  {item ? (
                                    item.isAvailable === false ? (
                                      <div className="space-y-1">
                                        <div className="flex items-center justify-center gap-1 text-red-600">
                                          <XCircle className="h-4 w-4" />
                                          <span className="font-bold">Indisponível</span>
                                        </div>
                                        {item.unavailabilityReason && (
                                          <div className="text-xs text-red-600 italic">
                                            {item.unavailabilityReason}
                                          </div>
                                        )}
                                        {item.brand && (
                                          <div className="text-xs text-gray-500">
                                            {item.brand} {item.model}
                                          </div>
                                        )}
                                        {item.observations && (
                                          <div className="text-xs text-gray-400 italic">
                                            {item.observations}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="space-y-1">
                                        <div className="font-bold text-green-600">
                                          R$ {Number(item.unitPrice).toLocaleString('pt-BR', { 
                                            minimumFractionDigits: 2 
                                          })}
                                        </div>
                                        

                                        
                                        {/* Desconto do Item */}
                                        {(item.discountPercentage || item.discountValue) && (
                                          <div className="text-xs text-orange-600">
                                            Desconto: {item.discountPercentage 
                                              ? `${item.discountPercentage}%`
                                              : `R$ ${Number(item.discountValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                            }
                                          </div>
                                        )}
                                        
                                        {/* Valor Final */}
                                        <div className="text-sm font-semibold text-green-700">
                                          Total Final: R$ {Number(item.discountedTotalPrice || item.totalPrice).toLocaleString('pt-BR', { 
                                            minimumFractionDigits: 2 
                                          })}
                                        </div>
                                        {item.deliveryDays && (
                                          <div className="text-xs text-blue-600">
                                            {item.deliveryDays} dias
                                          </div>
                                        )}
                                        {item.brand && (
                                          <div className="text-xs text-gray-500">
                                            {item.brand} {item.model}
                                          </div>
                                        )}
                                        {item.observations && (
                                          <div className="text-xs text-gray-400 italic">
                                            {item.observations}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  ) : (
                                    <span className="text-gray-400 text-sm">Não cotado</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Observações da Decisão */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Observações da Decisão</CardTitle>
                </CardHeader>
                <CardContent>
                  <Label htmlFor="observations">
                    Justifique a escolha do fornecedor (opcional)
                  </Label>
                  <Textarea
                    id="observations"
                    value={observations}
                    onChange={(e) => setObservations(e.target.value)}
                    placeholder="Ex: Melhor custo-benefício, menor prazo de entrega, maior qualidade, etc."
                    rows={3}
                    className="mt-2"
                  />
                </CardContent>
              </Card>

              {/* Opções para itens indisponíveis */}
              {selectedSupplierId && hasUnavailableItems && (
                <Card className="mb-6 border-orange-200 bg-orange-50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-orange-800">
                      <AlertCircle className="h-5 w-5" />
                      Itens Indisponíveis Encontrados
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <p className="font-medium text-orange-800 mb-2">
                          {unavailableItems.length} item(ns) indisponível(is):
                        </p>
                        <ul className="list-disc list-inside space-y-1 text-sm text-orange-700">
                          {unavailableItems.map((item, index) => {
                            const quotationItem = quotationItems.find(qi => qi.id === item.quotationItemId);
                            return (
                              <li key={index}>
                                {quotationItem?.description || `Item ${item.quotationItemId}`}
                                {item.unavailabilityReason && (
                                  <span className="text-orange-600"> - {item.unavailabilityReason}</span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>

                      <div className="space-y-3">
                        <p className="font-medium text-gray-900">Escolha uma opção para os itens indisponíveis:</p>
                        
                        <div className="space-y-2">
                          <label className="flex items-start space-x-3 cursor-pointer">
                            <input
                              type="radio"
                              name="unavailableOption"
                              value="none"
                              checked={unavailableItemsOption === 'none'}
                              onChange={(e) => setUnavailableItemsOption(e.target.value as any)}
                              className="mt-1"
                            />
                            <div>
                              <span className="font-medium">Não realizar nenhuma ação</span>
                              <p className="text-sm text-gray-600">Prosseguir para Aprovação A2 sem os itens indisponíveis</p>
                            </div>
                          </label>

                          <label className="flex items-start space-x-3 cursor-pointer">
                            <input
                              type="radio"
                              name="unavailableOption"
                              value="with-rfq"
                              checked={unavailableItemsOption === 'with-rfq'}
                              onChange={(e) => setUnavailableItemsOption(e.target.value as any)}
                              className="mt-1"
                            />
                            <div>
                              <span className="font-medium">Criar solicitação aprovada A1 com RFQ gerada</span>
                              <p className="text-sm text-gray-600">
                                Mantém fornecedores selecionados anteriormente (exceto o atual) e gera RFQ automaticamente
                              </p>
                            </div>
                          </label>

                          <label className="flex items-start space-x-3 cursor-pointer">
                            <input
                              type="radio"
                              name="unavailableOption"
                              value="without-rfq"
                              checked={unavailableItemsOption === 'without-rfq'}
                              onChange={(e) => setUnavailableItemsOption(e.target.value as any)}
                              className="mt-1"
                            />
                            <div>
                              <span className="font-medium">Criar solicitação aprovada A1 aguardando nova RFQ</span>
                              <p className="text-sm text-gray-600">
                                Criará solicitação na fase de Cotação aguardando criação de nova RFQ
                              </p>
                            </div>
                          </label>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Seleção individual de itens */}
              {selectedSupplierId && selectedSupplierData && (
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Seleção de Itens
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleToggleItemSelection}
                      >
                        {showItemSelection ? 'Seleção Simples' : 'Seleção Individual'}
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {showItemSelection ? (
                      <div className="space-y-4">
                        <p className="text-sm text-gray-600">
                          Selecione individualmente os itens que deseja adquirir do fornecedor escolhido:
                        </p>
                        
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {selectedSupplierData.items
                            .filter(item => item.isAvailable !== false)
                            .map((item) => {
                              const quotationItem = quotationItems.find(qi => qi.id === item.quotationItemId);
                              return (
                                <label key={item.id} className="flex items-center space-x-3 p-2 border rounded hover:bg-gray-50 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={selectedItems[item.quotationItemId] || false}
                                    onChange={(e) => setSelectedItems(prev => ({
                                      ...prev,
                                      [item.quotationItemId]: e.target.checked
                                    }))}
                                    className="rounded"
                                  />
                                  <div className="flex-1">
                                    <span className="font-medium">
                                      {quotationItem?.description || `Item ${item.quotationItemId}`}
                                    </span>
                                    <div className="text-sm text-gray-600">
                                      R$ {Number(item.unitPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                      {item.brand && ` - ${item.brand} ${item.model}`}
                                    </div>
                                  </div>
                                </label>
                              );
                            })}
                        </div>

                        {/* Opções para itens não selecionados */}
                        <div className="border-t pt-4 space-y-3">
                          <p className="font-medium text-gray-900">
                            O que fazer com os itens não selecionados?
                          </p>
                          
                          <div className="space-y-2">
                            <label className="flex items-start space-x-3 cursor-pointer">
                              <input
                                type="radio"
                                name="nonSelectedOption"
                                value="none"
                                checked={nonSelectedItemsOption === 'none'}
                                onChange={(e) => setNonSelectedItemsOption(e.target.value as any)}
                                className="mt-1"
                              />
                              <div>
                                <span className="font-medium">Não realizar nenhuma ação</span>
                                <p className="text-sm text-gray-600">Prosseguir para Aprovação A2 apenas com itens selecionados</p>
                              </div>
                            </label>

                            <label className="flex items-start space-x-3 cursor-pointer">
                              <input
                                type="radio"
                                name="nonSelectedOption"
                                value="separate-quotation"
                                checked={nonSelectedItemsOption === 'separate-quotation'}
                                onChange={(e) => setNonSelectedItemsOption(e.target.value as any)}
                                className="mt-1"
                              />
                              <div>
                                <span className="font-medium">Gerar cotação separada para itens não selecionados</span>
                                <p className="text-sm text-gray-600">
                                  Criar nova solicitação aprovada A1 com os itens NÃO selecionados, 
                                  na fase de Cotação aguardando nova RFQ
                                </p>
                              </div>
                            </label>

                            <label className="flex items-start space-x-3 cursor-pointer">
                              <input
                                type="radio"
                                name="nonSelectedOption"
                                value="info-only"
                                checked={nonSelectedItemsOption === 'info-only'}
                                onChange={(e) => setNonSelectedItemsOption(e.target.value as any)}
                                className="mt-1"
                              />
                              <div>
                                <span className="font-medium">Manter apenas como informação</span>
                                <p className="text-sm text-gray-600">Salvar informações para ações futuras, sem criar nova solicitação</p>
                              </div>
                            </label>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-600">
                        Todos os itens disponíveis do fornecedor selecionado serão incluídos na compra.
                        Clique em "Seleção Individual" para escolher itens específicos.
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Ações */}
              <div className="flex justify-end gap-4">
                <Button variant="outline" onClick={onClose}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSelectSupplier}
                  disabled={!selectedSupplierId || selectSupplierMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {selectSupplierMutation.isPending ? (
                    "Processando..."
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Selecionar Fornecedor e Avançar
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}