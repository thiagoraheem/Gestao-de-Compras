import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, DollarSign, Clock, Building2, Package, X, AlertCircle } from "lucide-react";

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
}

export default function SupplierComparison({ quotationId, onClose, onComplete }: SupplierComparisonProps) {
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [observations, setObservations] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: suppliersData = [], isLoading } = useQuery<SupplierQuotationData[]>({
    queryKey: [`/api/quotations/${quotationId}/supplier-comparison`],
  });

  // Fetch quotation items to get descriptions
  const { data: quotationItems = [] } = useQuery({
    queryKey: [`/api/quotations/${quotationId}/items`],
    enabled: !!quotationId,
  });

  const selectSupplierMutation = useMutation({
    mutationFn: async (data: { selectedSupplierId: number; totalValue: number; observations: string }) => {
      return apiRequest(`/api/quotations/${quotationId}/select-supplier`, { method: "POST", body: data });
    },
    onSuccess: () => {
      toast({
        title: "Fornecedor selecionado",
        description: "O fornecedor foi selecionado com sucesso e a solicitação avançou para Aprovação A2.",
      });
      // Invalidate all related queries to ensure UI updates immediately
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      queryClient.invalidateQueries({ queryKey: [`/api/quotations/${quotationId}/supplier-comparison`] });
      queryClient.invalidateQueries({ queryKey: [`/api/quotations/${quotationId}/supplier-quotations`] });
      queryClient.invalidateQueries({ predicate: (query) => 
        query.queryKey[0] && typeof query.queryKey[0] === 'string' &&
        (query.queryKey[0].includes('quotations') || query.queryKey[0].includes('purchase-requests'))
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

    selectSupplierMutation.mutate({
      selectedSupplierId,
      totalValue: selectedSupplier.totalValue,
      observations,
    });
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

                        {/* Itens */}
                        <div>
                          <span className="text-sm font-medium text-gray-600">Itens:</span>
                          <div className="mt-2 space-y-2">
                            {supplierData.items.slice(0, 3).map((item) => (
                              <div key={item.id} className="text-xs p-2 bg-gray-50 rounded">
                                <div className="flex justify-between">
                                  <span className="font-medium">
                                    {(() => {
                                      const quotationItem = quotationItems.find(qi => qi.id === item.quotationItemId);
                                      return quotationItem ? quotationItem.description : `Item #${item.quotationItemId}`;
                                    })()}
                                  </span>
                                  <span>R$ {Number(item.unitPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                                {item.brand && (
                                  <div className="text-xs text-gray-500">{item.brand} {item.model}</div>
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
                                <td key={supplier.id} className="p-3 border-l text-center">
                                  {item ? (
                                    <div className="space-y-1">
                                      <div className="font-bold text-green-600">
                                        R$ {Number(item.unitPrice).toLocaleString('pt-BR', { 
                                          minimumFractionDigits: 2 
                                        })}
                                      </div>
                                      <div className="text-sm text-gray-600">
                                        Total: R$ {Number(item.totalPrice).toLocaleString('pt-BR', { 
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