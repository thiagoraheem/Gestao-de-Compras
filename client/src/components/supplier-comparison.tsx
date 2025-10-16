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
        <div className="bg-white rounded-lg p-3">
          <p className="text-sm">Carregando dados das cotações...</p>
        </div>
      </div>
    );
  }

  const receivedQuotations = suppliersData.filter(sq => sq.status === 'received');
  const noResponseQuotations = suppliersData.filter(sq => sq.status === 'no_response');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-1 md:p-2">
      <div className="bg-white rounded-lg max-w-6xl w-full mx-1 md:mx-2 max-h-[95vh] overflow-y-auto">
        <div className="p-2 md:p-3">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-sm md:text-base lg:text-lg font-bold">Comparação de Fornecedores</h2>
            <Button variant="ghost" onClick={onClose} className="h-6 w-6 p-0">
              <X className="h-3 w-3" />
            </Button>
          </div>

          {receivedQuotations.length === 0 ? (
            <Alert>
              <AlertCircle className="h-3 w-3" />
              <AlertDescription className="text-xs">
                Nenhuma cotação foi recebida ainda. Aguarde as respostas dos fornecedores para fazer a comparação.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {noResponseQuotations.length > 0 && (
                <Alert className="mb-2">
                  <AlertCircle className="h-3 w-3" />
                  <AlertDescription className="text-xs">
                    <strong>Fornecedores que não responderam:</strong> {noResponseQuotations.map(sq => sq.supplier.name).join(", ")}
                    <br />
                    A comparação será feita apenas com os fornecedores que responderam.
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2 mb-2">
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
                    <CardHeader className="pb-1">
                      <CardTitle className="text-xs md:text-sm flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {supplierData.supplier.name}
                        </div>
                        {selectedSupplierId === supplierData.supplier.id && (
                          <CheckCircle className="h-3 w-3 text-blue-600" />
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-2">
                      <div className="space-y-1">
                        {/* Valor Total */}
                        <div className="flex justify-between items-center p-1 bg-green-50 rounded">
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3 text-green-600" />
                            <span className="text-xs font-medium text-green-700">Valor Total</span>
                          </div>
                          <span className="text-xs font-bold text-green-700">
                            R$ {Number(supplierData.totalValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        {/* Prazo de Entrega */}
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-blue-600" />
                            <span className="text-xs font-medium text-gray-600">Prazo</span>
                          </div>
                          <span className="text-xs">{supplierData.deliveryDays} dias</span>
                        </div>

                        {/* Garantia */}
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-medium text-gray-600">Garantia</span>
                          <span className="text-xs">{supplierData.warranty || 'Não informado'}</span>
                        </div>

                        {/* Condições de Pagamento */}
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-medium text-gray-600">Pagamento</span>
                          <span className="text-xs">{supplierData.paymentTerms || 'Não informado'}</span>
                        </div>

                        {/* Frete */}
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-1">
                            <Truck className="h-3 w-3 text-orange-600" />
                            <span className="text-xs font-medium text-gray-600">Frete</span>
                          </div>
                          {supplierData.includesFreight ? (
                            <Badge variant="secondary" className="text-xs">Incluso</Badge>
                          ) : supplierData.freightValue ? (
                            <span className="text-xs">R$ {Number(supplierData.freightValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          ) : (
                            <span className="text-xs text-gray-500">Não incluso</span>
                          )}
                        </div>

                        {/* Itens */}
                        <div>
                          <span className="text-xs font-medium text-gray-600">Itens:</span>
                          <div className="mt-1 space-y-1">
                            {supplierData.items.slice(0, 3).map((item) => (
                              <div key={item.id} className={`text-xs p-1 rounded ${
                                item.isAvailable === false 
                                  ? 'bg-red-50 border border-red-200' 
                                  : 'bg-gray-50'
                              }`}>
                                <div className="flex justify-between items-center">
                                  <div className="flex items-center gap-1">
                                    {item.isAvailable === false && (
                                      <XCircle className="h-3 w-3 text-red-500 flex-shrink-0" />
                                    )}
                                    <span className={`font-medium text-xs ${
                                      item.isAvailable === false ? 'text-red-700' : ''
                                    }`}>
                                      {(() => {
                                        const quotationItem = quotationItems.find(qi => qi.id === item.quotationItemId);
                                        return quotationItem ? quotationItem.description : `Item #${item.quotationItemId}`;
                                      })()}
                                    </span>
                                  </div>
                                  <span className={`text-xs ${item.isAvailable === false ? 'text-red-600' : ''}`}>
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
                            <span className="text-xs font-medium text-gray-600">Observações:</span>
                            <p className="text-xs mt-1 text-gray-500">{supplierData.observations}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Tabela Comparativa */}
              <Card className="mb-2">
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs md:text-sm flex items-center gap-1">
                    <Package className="h-3 w-3" />
                    Comparação Detalhada por Item
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="p-1 text-left text-xs font-medium">Item</th>
                          {receivedQuotations.map((supplier) => (
                            <th key={supplier.id} className="p-1 text-center border-l text-xs font-medium">
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
                            <td className="p-1 font-medium text-xs">
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
                                <td key={supplier.id} className={`p-1 border-l text-center text-xs ${
                                  item && item.isAvailable === false ? 'bg-red-50' : ''
                                }`}>
                                  {item ? (
                                    item.isAvailable === false ? (
                                      <div className="space-y-1">
                                        <div className="text-red-600 font-medium">Indisponível</div>
                                        {item.unavailabilityReason && (
                                          <div className="text-xs text-red-500 italic">
                                            {item.unavailabilityReason}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="space-y-1">
                                        <div className="font-medium">
                                          R$ {Number(item.unitPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                          {item.deliveryDays} dias
                                        </div>
                                        {item.brand && (
                                          <div className="text-xs text-gray-500">
                                            {item.brand} {item.model}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  ) : (
                                    <span className="text-gray-400">-</span>
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

              {/* Observações */}
              <Card className="mb-2">
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs md:text-sm">Observações da Seleção</CardTitle>
                </CardHeader>
                <CardContent className="p-2">
                  <Label htmlFor="observations" className="text-xs">
                    Justificativa para a escolha do fornecedor (opcional)
                  </Label>
                  <Textarea
                    id="observations"
                    value={observations}
                    onChange={(e) => setObservations(e.target.value)}
                    placeholder="Descreva os motivos que levaram à escolha deste fornecedor..."
                    rows={2}
                    className="mt-1 text-xs min-h-[50px]"
                  />
                </CardContent>
              </Card>

              {/* Itens Indisponíveis */}
              {hasUnavailableItems && (
                <Card className="mb-2 border-orange-200 bg-orange-50">
                  <CardHeader className="pb-1">
                    <CardTitle className="text-xs md:text-sm text-orange-800 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Itens Indisponíveis Detectados
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-2">
                    <div className="bg-white p-2 rounded mb-2">
                      <p className="text-xs text-orange-800 mb-2">
                        <strong>Atenção:</strong> O fornecedor selecionado informou que alguns itens estão indisponíveis:
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-xs text-orange-700">
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

                    <div className="space-y-2">
                      <p className="font-medium text-gray-900 text-xs">Escolha uma opção para os itens indisponíveis:</p>
                      
                      <div className="space-y-1">
                        <label className="flex items-start space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="unavailableItemsOption"
                            value="none"
                            checked={unavailableItemsOption === 'none'}
                            onChange={(e) => setUnavailableItemsOption(e.target.value as any)}
                            className="mt-1"
                          />
                          <div>
                            <div className="text-xs font-medium">Ignorar itens indisponíveis</div>
                            <p className="text-xs text-gray-600">
                              Continuar apenas com os itens disponíveis. Os itens indisponíveis serão removidos da solicitação.
                            </p>
                          </div>
                        </label>

                        <label className="flex items-start space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="unavailableItemsOption"
                            value="with-rfq"
                            checked={unavailableItemsOption === 'with-rfq'}
                            onChange={(e) => setUnavailableItemsOption(e.target.value as any)}
                            className="mt-1"
                          />
                          <div>
                            <div className="text-xs font-medium">Criar nova cotação para itens indisponíveis</div>
                            <p className="text-xs text-gray-600">

                              Mantém fornecedores selecionados anteriormente (exceto o atual) e gera RFQ automaticamente
                            </p>
                          </div>
                        </label>

                        <label className="flex items-start space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="unavailableItemsOption"
                            value="without-rfq"
                            checked={unavailableItemsOption === 'without-rfq'}
                            onChange={(e) => setUnavailableItemsOption(e.target.value as any)}
                            className="mt-1"
                          />
                          <div>
                            <div className="text-xs font-medium">Criar nova solicitação para itens indisponíveis</div>
                            <p className="text-xs text-gray-600">
                              Cria uma nova solicitação de compra que precisará passar por todo o processo novamente
                            </p>
                          </div>
                        </label>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Seleção Individual de Itens */}
              {showItemSelection && (
                <Card className="mb-2 border-blue-200 bg-blue-50">
                  <CardHeader className="pb-1">
                    <CardTitle className="text-xs md:text-sm text-blue-800">Seleção Individual de Itens</CardTitle>
                  </CardHeader>
                  <CardContent className="p-2">
                    <div className="bg-white p-2 rounded mb-2">
                      <p className="text-xs text-blue-800 mb-2">
                        Selecione quais itens deseja incluir nesta compra:
                      </p>
                      <div className="space-y-1">
                        {selectedSupplierData?.items
                          .filter(item => item.isAvailable !== false)
                          .map((item) => {
                            const quotationItem = quotationItems.find(qi => qi.id === item.quotationItemId);
                            return (
                              <label key={item.id} className="flex items-center space-x-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedItems[item.quotationItemId] || false}
                                  onChange={(e) => setSelectedItems(prev => ({
                                    ...prev,
                                    [item.quotationItemId]: e.target.checked
                                  }))}
                                />
                                <div className="flex-1">
                                  <div className="text-xs font-medium">
                                    {quotationItem?.description || `Item #${item.quotationItemId}`}
                                  </div>
                                  <div className="text-xs text-gray-600">
                                    R$ {Number(item.unitPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} - {item.deliveryDays} dias
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="font-medium text-gray-900 text-xs">O que fazer com os itens NÃO selecionados?</p>
                      
                      <div className="space-y-1">
                        <label className="flex items-start space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="nonSelectedItemsOption"
                            value="none"
                            checked={nonSelectedItemsOption === 'none'}
                            onChange={(e) => setNonSelectedItemsOption(e.target.value as any)}
                            className="mt-1"
                          />
                          <div>
                            <div className="text-xs font-medium">Ignorar itens não selecionados</div>
                            <p className="text-xs text-gray-600">
                              Os itens não selecionados serão removidos da solicitação
                            </p>
                          </div>
                        </label>

                        <label className="flex items-start space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="nonSelectedItemsOption"
                            value="separate-quotation"
                            checked={nonSelectedItemsOption === 'separate-quotation'}
                            onChange={(e) => setNonSelectedItemsOption(e.target.value as any)}
                            className="mt-1"
                          />
                          <div>
                            <div className="text-xs font-medium">Criar cotação separada</div>
                            <p className="text-xs text-gray-600">
                              Criar uma nova cotação apenas para os itens não selecionados
                            </p>
                          </div>
                        </label>

                        <label className="flex items-start space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="nonSelectedItemsOption"
                            value="info-only"
                            checked={nonSelectedItemsOption === 'info-only'}
                            onChange={(e) => setNonSelectedItemsOption(e.target.value as any)}
                            className="mt-1"
                          />
                          <div>
                            <div className="text-xs font-medium">Apenas para informação</div>
                            <p className="text-xs text-gray-600">
                              Manter registro dos itens não selecionados apenas para histórico
                            </p>
                          </div>
                        </label>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button 
                  variant="outline" 
                  onClick={onClose}
                  className="h-7 text-xs"
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSelectSupplier}
                  disabled={!selectedSupplierId || selectSupplierMutation.isPending}
                  className="bg-green-600 hover:bg-green-700 h-7 text-xs"
                >
                  {selectSupplierMutation.isPending ? (
                    "Processando..."
                  ) : (
                    <>
                      <CheckCircle className="h-3 w-3 mr-1" />
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