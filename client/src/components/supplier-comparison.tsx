import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, DollarSign, Clock, Building2, Package, X, AlertCircle, XCircle, Truck, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Slider } from "@/components/ui/slider";

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
  availableQuantity?: number;
  confirmedUnit?: string;
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
  const [showRecommendedDetails, setShowRecommendedDetails] = useState(false);
  const [weights, setWeights] = useState({ price: 60, delivery: 20, discount: 10, freight: 5, payment: 5 });
  const [paramsOpen, setParamsOpen] = useState(false);
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

  const recommendedSupplier = (() => {
    if (receivedQuotations.length === 0) return null;
    const values = receivedQuotations.map(sq => Number(sq.totalValue || 0));
    const days = receivedQuotations.map(sq => Number(sq.deliveryDays || 0));
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const minDays = Math.min(...days);
    const maxDays = Math.max(...days);
    const effectiveDiscountFractions = receivedQuotations.map(sq => {
      if (!sq.discountType || !sq.discountValue) return 0;
      const val = Number(sq.discountValue);
      if (sq.discountType === 'percentage') return Math.min(Math.max(val / 100, 0), 1);
      const total = Number(sq.totalValue || 0) || 1;
      return Math.min(Math.max(val / total, 0), 1);
    });
    const maxDiscountFrac = Math.max(...effectiveDiscountFractions, 0);
    const paymentDaysArray = receivedQuotations.map(sq => {
      const match = String(sq.paymentTerms || '').match(/\d+/);
      return match ? Number(match[0]) : 0;
    });
    const maxPaymentDays = Math.max(...paymentDaysArray, 0);
    const normalize = (val: number, min: number, max: number) => {
      if (!isFinite(val) || !isFinite(min) || !isFinite(max) || max === min) return 0.5;
      return (val - min) / (max - min);
    };
    const normalizedWeights = (() => {
      const sum = weights.price + weights.delivery + weights.discount + weights.freight + weights.payment;
      const safeSum = sum > 0 ? sum : 1;
      return {
        price: weights.price / safeSum,
        delivery: weights.delivery / safeSum,
        discount: weights.discount / safeSum,
        freight: weights.freight / safeSum,
        payment: weights.payment / safeSum,
      };
    })();
    const scoreFor = (sq: SupplierQuotationData) => {
      const priceNorm = normalize(Number(sq.totalValue || 0), minValue, maxValue);
      const deliveryNorm = normalize(Number(sq.deliveryDays || 0), minDays, maxDays);
      const discountFrac = (() => {
        if (!sq.discountType || !sq.discountValue) return 0;
        const val = Number(sq.discountValue);
        const frac = sq.discountType === 'percentage' ? Math.min(Math.max(val / 100, 0), 1) : Math.min(Math.max(val / (Number(sq.totalValue || 0) || 1), 0), 1);
        if (maxDiscountFrac <= 0) return 0.5;
        return frac / maxDiscountFrac;
      })();
      const freightNorm = sq.includesFreight ? 1 : 0;
      const paymentDays = (() => {
        const match = String(sq.paymentTerms || '').match(/\d+/);
        return match ? Number(match[0]) : 0;
      })();
      const paymentNorm = maxPaymentDays > 0 ? paymentDays / maxPaymentDays : 0.5;
      const total = (1 - priceNorm) * normalizedWeights.price
        + (1 - deliveryNorm) * normalizedWeights.delivery
        + discountFrac * normalizedWeights.discount
        + freightNorm * normalizedWeights.freight
        + paymentNorm * normalizedWeights.payment;
      return total;
    };
    const scored = receivedQuotations.map(sq => ({ sq, score: scoreFor(sq) }));
    scored.sort((a, b) => b.score - a.score);
    return scored[0].sq;
  })();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex-shrink-0 bg-white border-b sticky top-0 z-30 px-6 py-3 rounded-t-lg">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-semibold">Comparação de Fornecedores</h2>
            <Button variant="ghost" size="icon" onClick={onClose} className="p-2">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="px-6 pt-6 pb-24">

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
              {/* Parametrização de Pesos (colapsável) */}
              <Collapsible open={paramsOpen} onOpenChange={setParamsOpen}>
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>Parâmetros de Recomendação</span>
                        <span className="text-xs text-gray-500">(opcional)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setWeights({ price: 60, delivery: 20, discount: 10, freight: 5, payment: 5 })}>Restaurar padrão</Button>
                        <CollapsibleTrigger className="flex items-center gap-1 text-xs px-2 py-1 border rounded hover:bg-gray-50">
                          {paramsOpen ? 'Ocultar' : 'Mostrar'}
                          <ChevronDown className={`h-3 w-3 transition-transform ${paramsOpen ? 'rotate-180' : ''}`} />
                        </CollapsibleTrigger>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs">Preço (peso {weights.price}%)</Label>
                          <Slider value={[weights.price]} min={0} max={100} step={1} onValueChange={(v) => setWeights(w => ({ ...w, price: v[0] }))} className="mt-2" aria-label="Peso Preço" />
                        </div>
                        <div>
                          <Label className="text-xs">Prazo (peso {weights.delivery}%)</Label>
                          <Slider value={[weights.delivery]} min={0} max={100} step={1} onValueChange={(v) => setWeights(w => ({ ...w, delivery: v[0] }))} className="mt-2" aria-label="Peso Prazo" />
                        </div>
                        <div>
                          <Label className="text-xs">Desconto (peso {weights.discount}%)</Label>
                          <Slider value={[weights.discount]} min={0} max={100} step={1} onValueChange={(v) => setWeights(w => ({ ...w, discount: v[0] }))} className="mt-2" aria-label="Peso Desconto" />
                        </div>
                        <div>
                          <Label className="text-xs">Frete (peso {weights.freight}%)</Label>
                          <Slider value={[weights.freight]} min={0} max={100} step={1} onValueChange={(v) => setWeights(w => ({ ...w, freight: v[0] }))} className="mt-2" aria-label="Peso Frete" />
                        </div>
                        <div>
                          <Label className="text-xs">Pagamento (peso {weights.payment}%)</Label>
                          <Slider value={[weights.payment]} min={0} max={100} step={1} onValueChange={(v) => setWeights(w => ({ ...w, payment: v[0] }))} className="mt-2" aria-label="Peso Pagamento" />
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-gray-600">Os pesos são normalizados automaticamente para a recomendação.</div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>

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
                        <div className="flex items-center gap-2">
                          {recommendedSupplier && recommendedSupplier.supplier.id === supplierData.supplier.id && (
                            <Badge variant="default" className="bg-green-600">Recomendado</Badge>
                          )}
                          {selectedSupplierId === supplierData.supplier.id && (
                            <CheckCircle className="h-5 w-5 text-blue-600" />
                          )}
                        </div>
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

              {recommendedSupplier && (
                <Card className="mb-6 border-green-300 bg-green-50">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        Fornecedor Recomendado
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setShowRecommendedDetails(true)}>Ver detalhes completos</Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="font-semibold">{recommendedSupplier.supplier.name}</div>
                        <div className="text-sm">Valor Total: R$ {Number(recommendedSupplier.totalValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                        <div className="text-sm">Prazo: {recommendedSupplier.deliveryDays} dias</div>
                        <div className="text-sm">Pagamento: {recommendedSupplier.paymentTerms || 'Não informado'}</div>
                        {recommendedSupplier.discountType && recommendedSupplier.discountValue && (
                          <div className="text-sm">Desconto: {recommendedSupplier.discountType === 'percentage' ? `${recommendedSupplier.discountValue}%` : `R$ ${Number(recommendedSupplier.discountValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}</div>
                        )}
                        <div className="text-sm">Frete: {recommendedSupplier.includesFreight ? `R$ ${Number(recommendedSupplier.freightValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Não incluso'}</div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Vantagens competitivas</div>
                        <ul className="text-sm list-disc list-inside space-y-1">
                          <li>Melhor relação entre preço e prazo</li>
                          {recommendedSupplier.includesFreight && <li>Frete incluído</li>}
                          {recommendedSupplier.discountValue && <li>Desconto aplicado</li>}
                          <li>Condições de pagamento favoráveis</li>
                        </ul>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">Comparativo</div>
                        <div className="text-xs">Preço: recomendado vs. média dos demais</div>
                        <div className="text-xs">Prazo: recomendado vs. média dos demais</div>
                        <div className="text-xs">Pagamento: recomendado vs. demais</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm font-medium">Avaliação</div>
                        <div className="text-xs">Qualidade e histórico: sem dados disponíveis</div>
                        <div className="text-xs">Benefícios adicionais: conforme informado acima</div>
                      </div>
                    </div>
                    <div className="mt-4 text-sm">
                      Justificativa: melhor custo-benefício, condições comerciais adequadas e prazo competitivo com atendimento consistente.
                    </div>
                  </CardContent>
                </Card>
              )}

              {recommendedSupplier && (
                <Dialog open={showRecommendedDetails} onOpenChange={setShowRecommendedDetails}>
                  <DialogContent className="max-w-4xl">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        Detalhes do Fornecedor Recomendado
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <div className="font-semibold">{recommendedSupplier.supplier.name}</div>
                          <div className="text-sm">Valor Total: R$ {Number(recommendedSupplier.totalValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                          <div className="text-sm">Prazo: {recommendedSupplier.deliveryDays} dias</div>
                          <div className="text-sm">Pagamento: {recommendedSupplier.paymentTerms || 'Não informado'}</div>
                          <div className="text-sm">Garantia: {recommendedSupplier.warrantyPeriod || recommendedSupplier.warranty || 'Não informado'}</div>
                          <div className="text-sm">Frete: {recommendedSupplier.includesFreight ? `R$ ${Number(recommendedSupplier.freightValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Não incluso'}</div>
                        </div>
                        <div className="space-y-1">
                          {recommendedSupplier.discountType && recommendedSupplier.discountValue && (
                            <div className="text-sm">Desconto: {recommendedSupplier.discountType === 'percentage' ? `${recommendedSupplier.discountValue}%` : `R$ ${Number(recommendedSupplier.discountValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}</div>
                          )}
                          {recommendedSupplier.observations && (
                            <div className="text-sm">Observações: {recommendedSupplier.observations}</div>
                          )}
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-2 text-xs">Item</th>
                              <th className="text-center p-2 text-xs">Disponibilidade</th>
                              <th className="text-right p-2 text-xs">Vlr. Unit.</th>
                              <th className="text-right p-2 text-xs">Vlr. Desconto</th>
                              <th className="text-right p-2 text-xs">Vlr Final</th>
                              <th className="text-center p-2 text-xs">Prazo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {recommendedSupplier.items.map((item, idx) => (
                              <tr key={idx} className="border-b hover:bg-gray-50">
                                <td className="p-2 text-xs">
                                  {(() => {
                                    const qi = quotationItems.find(q => q.id === item.quotationItemId);
                                    return qi ? qi.description : `Item #${item.quotationItemId}`;
                                  })()}
                                </td>
                                <td className="p-2 text-center text-xs">
                                  {item.isAvailable === false ? 'Indisponível' : 'Disponível'}
                                </td>
                                <td className="p-2 text-right text-xs">
                                  R$ {Number(item.unitPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="p-2 text-right text-xs">
                                  {(item.discountPercentage || item.discountValue) ? (
                                    item.discountPercentage ? `${item.discountPercentage}%` : `R$ ${Number(item.discountValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                  ) : '-'}
                                </td>
                                <td className="p-2 text-right text-xs font-semibold">
                                  R$ {Number(item.discountedTotalPrice || item.totalPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="p-2 text-center text-xs">{item.deliveryDays ? `${item.deliveryDays} dias` : '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}

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
                            {(() => {
                              const bestFinalPrice = (() => {
                                const values = receivedQuotations.map((supplier) => {
                                  const it = supplier.items.find(i => i.quotationItemId === quotationItemId);
                                  if (!it || it.isAvailable === false) return Infinity;
                                  return Number(it.discountedTotalPrice || it.totalPrice);
                                });
                                const min = Math.min(...values);
                                return isFinite(min) ? min : null;
                              })();
                              return receivedQuotations.map((supplier) => {
                                const item = supplier.items.find(
                                  item => item.quotationItemId === quotationItemId
                                );
                                const finalValue = item ? Number(item.discountedTotalPrice || item.totalPrice) : null;
                                const isBest = item && item.isAvailable !== false && bestFinalPrice !== null && finalValue === bestFinalPrice;
                                return (
                                  <td key={supplier.id} className={`p-3 border-l text-center ${
                                    item && item.isAvailable === false ? 'bg-red-50' : ''
                                  } ${isBest ? 'bg-green-50 ring-2 ring-green-300' : ''}`}>
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
                                          {isBest && (
                                            <div className="flex justify-center">
                                              <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-800 border-green-300">Melhor valor</Badge>
                                            </div>
                                          )}
                                          {(() => {
                                            const qi = quotationItems.find(q => q.id === item.quotationItemId);
                                            const requestedQty = qi?.quantity ? parseFloat(qi.quantity) : undefined;
                                            const qty = item.availableQuantity ?? requestedQty ?? (item.unitPrice ? Math.round(Number(item.discountedTotalPrice || item.totalPrice) / Number(item.unitPrice)) : undefined);
                                            const unit = item.confirmedUnit || qi?.unit;
                                            if (qty && unit) {
                                              return (
                                                <div className="text-xs text-gray-700">Quantidade: {qty.toLocaleString('pt-BR')} {unit}</div>
                                              );
                                            }
                                            if (qty) {
                                              return (
                                                <div className="text-xs text-gray-700">Quantidade: {qty.toLocaleString('pt-BR')}</div>
                                              );
                                            }
                                            return null;
                                          })()}
                                          <div className="text-xs text-gray-700">
                                            Vlr. Unit.: R$ {Number(item.unitPrice).toLocaleString('pt-BR', { 
                                              minimumFractionDigits: 2 
                                            })}
                                          </div>
                                          {(item.discountPercentage || item.discountValue) && (
                                            <div className="text-xs text-orange-600">
                                              Vlr. Desconto: {item.discountPercentage 
                                                ? `${item.discountPercentage}%`
                                                : `R$ ${Number(item.discountValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                              }
                                            </div>
                                          )}
                                          <div className="text-sm font-bold text-green-700">
                                            Vlr Final: R$ {Number(item.discountedTotalPrice || item.totalPrice).toLocaleString('pt-BR', { 
                                              minimumFractionDigits: 2 
                                            })}
                                          </div>
                                          {item.deliveryDays && (
                                            <div className="text-xs text-blue-600">Prazo: {item.deliveryDays} dias</div>
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
                              });
                            })()}
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
              <div className="flex-shrink-0 bg-white/80 border-t sticky bottom-0 z-30 -mx-6 px-6 py-3">
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={onClose}>Cancelar</Button>
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
              </div>
            </>
          )}
      </div>
    </div>
  </div>
);
}
