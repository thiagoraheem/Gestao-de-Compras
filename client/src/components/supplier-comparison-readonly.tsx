import { useQuery } from "@tanstack/react-query";
import { DollarSign, Clock, Building2, Package, X, AlertCircle, CheckCircle, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SupplierComparisonReadonlyProps {
  quotationId: number;
  onClose: () => void;
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
  discountPercentage?: number;
  discountValue?: number;
  discountedTotalPrice?: number;
  isAvailable?: boolean;
  unavailabilityReason?: string;
  availableQuantity?: number;
  confirmedUnit?: string;
}

interface QuotationItem {
  id: number;
  description: string;
  quantity: number;
  unit: string;
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
  isChosen?: boolean;
  includesFreight?: boolean;
  freightValue?: number;
  discountType?: 'percentage' | 'fixed' | 'none';
  discountValue?: number;
}

export default function SupplierComparisonReadonly({ quotationId, onClose }: SupplierComparisonReadonlyProps) {
  const { data: suppliersData = [], isLoading } = useQuery<SupplierQuotationData[]>({
    queryKey: [`/api/quotations/${quotationId}/supplier-comparison`],
  });

  // Fetch quotation items to get descriptions
  const { data: quotationItems = [] } = useQuery<QuotationItem[]>({
    queryKey: [`/api/quotations/${quotationId}/items`],
    enabled: !!quotationId,
  });

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
  const chosenSupplier = suppliersData.find(sq => sq.isChosen);

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
              {chosenSupplier && (
                <Alert className="mb-6 border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription>
                    <strong>Fornecedor Selecionado:</strong> {chosenSupplier.supplier.name} foi escolhido como fornecedor vencedor.
                  </AlertDescription>
                </Alert>
              )}

              {noResponseQuotations.length > 0 && (
                <Alert className="mb-6">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Fornecedores que não responderam:</strong> {noResponseQuotations.map(sq => sq.supplier.name).join(", ")}
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-6">
                {receivedQuotations.map((supplierData) => (
                  <Card
                    key={supplierData.id}
                    className={`${supplierData.isChosen
                      ? 'ring-2 ring-green-500 bg-green-50'
                      : 'border-gray-200'
                      }`}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-5 w-5" />
                          {supplierData.supplier.name}
                        </div>
                        {supplierData.isChosen && (
                          <Badge variant="default" className="bg-green-600">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Selecionado
                          </Badge>
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
                            <th key={supplier.id} className={`text-center p-3 font-medium border-l ${supplier.isChosen ? 'bg-green-50 text-green-700' : ''
                              }`}>
                              {supplier.supplier.name}
                              {supplier.isChosen && (
                                <div className="text-xs text-green-600 mt-1">
                                  <CheckCircle className="h-3 w-3 inline mr-1" />
                                  Selecionado
                                </div>
                              )}
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
                                  if (!it) return Infinity;
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
                                const isBest = item && bestFinalPrice !== null && finalValue === bestFinalPrice;
                                return (
                                  <td key={supplier.id} className={`p-3 border-l text-center ${supplier.isChosen ? 'bg-green-50' : ''
                                    } ${isBest ? 'bg-green-50 ring-2 ring-green-300' : ''}`}>
                                    {item ? (
                                      <div className="space-y-1">
                                        {isBest && (
                                          <div className="flex justify-center">
                                            <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-800 border-green-300">Melhor valor</Badge>
                                          </div>
                                        )}
                                        {(() => {
                                          const qi = quotationItems.find(q => q.id === item.quotationItemId);
                                          const requestedQty = qi?.quantity;
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

              {/* Fechar */}
              <div className="flex justify-end gap-4">
                <Button onClick={onClose} className="bg-blue-600 hover:bg-blue-700">
                  Fechar
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
