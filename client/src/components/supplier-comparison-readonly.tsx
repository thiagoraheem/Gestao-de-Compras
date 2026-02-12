import { useQuery } from "@tanstack/react-query";
import { DollarSign, Clock, Building2, Package, X, AlertCircle, CheckCircle, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogTitle, DialogClose } from "@/components/ui/dialog";

interface SupplierComparisonReadonlyProps {
  quotationId: number;
  onClose: () => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
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

export default function SupplierComparisonReadonly({ quotationId, onClose, isOpen = true, onOpenChange }: SupplierComparisonReadonlyProps) {
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
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-background rounded-lg p-8 border border-border">
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5 animate-spin text-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
            </svg>
            <p className="text-base font-medium text-foreground">Carregando dados das cotações...</p>
          </div>
        </div>
      </div>
    );
  }

  const receivedQuotations = suppliersData.filter(sq => sq.status === 'received');
  const noResponseQuotations = suppliersData.filter(sq => sq.status === 'no_response');
  const chosenSupplier = suppliersData.find(sq => sq.isChosen);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto p-0 sm:rounded-lg" aria-describedby="supplier-comparison-readonly-desc">
        <div className="flex-shrink-0 bg-background border-b border-border sticky top-0 z-30 px-6 py-3 rounded-t-lg">
          <div className="flex justify-between items-center">
            <DialogTitle className="text-base font-semibold">Comparação de Fornecedores</DialogTitle>
            <DialogClose asChild>
              <Button variant="ghost" size="icon" onClick={onClose} className="p-2" aria-label="Fechar">
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </div>
          <p id="supplier-comparison-readonly-desc" className="sr-only">Visualização somente leitura das cotações por fornecedor</p>
        </div>
        <div className="px-6 pt-0 pb-2">

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
                <Alert className="mb-6 border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/20">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-300" />
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
                      ? 'ring-2 ring-green-500 dark:ring-green-400 bg-green-50 dark:bg-green-900/20'
                      : 'border-gray-200 dark:border-slate-700'
                      }`}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-5 w-5" />
                          {supplierData.supplier.name}
                        </div>
                        {supplierData.isChosen && (
                          <Badge variant="default" className="bg-green-600 text-white dark:bg-green-500">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Selecionado
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Valor Total */}
                        <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-green-600 dark:text-green-300" />
                            <span className="text-sm font-medium">Valor Total</span>
                          </div>
                          <span className="text-lg font-bold text-green-600 dark:text-green-300">
                            {(() => {
                              // Calcular valor total dinamicamente para garantir consistência com o desconto e frete
                              const subtotal = supplierData.items.reduce((sum, item) => sum + (Number(item.discountedTotalPrice) || Number(item.totalPrice) || 0), 0);
                              
                              let discountAmount = 0;
                              if (supplierData.discountType === 'percentage' && supplierData.discountValue) {
                                discountAmount = (subtotal * Number(supplierData.discountValue)) / 100;
                              } else if (supplierData.discountType === 'fixed' && supplierData.discountValue) {
                                discountAmount = Number(supplierData.discountValue);
                              }
                              
                              const freight = supplierData.includesFreight ? Number(supplierData.freightValue || 0) : 0;
                              const finalValue = Math.max(0, subtotal - discountAmount) + freight;
                              
                              return `R$ ${finalValue.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
                            })()}
                          </span>
                        </div>

                        {/* Prazo de Entrega */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                            <span className="text-sm font-medium">Prazo</span>
                          </div>
                          <span className="text-sm">{supplierData.deliveryDays} dias</span>
                        </div>

                        {/* Condições de Pagamento */}
                        <div>
                          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Pagamento:</span>
                          <p className="text-sm mt-1 text-slate-700 dark:text-slate-300">{supplierData.paymentTerms}</p>
                        </div>

                        {/* Período de Garantia */}
                        <div>
                          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Período de Garantia:</span>
                          <p className="text-sm mt-1 text-slate-700 dark:text-slate-300">{supplierData.warrantyPeriod || supplierData.warranty || "Não informado"}</p>
                        </div>

                        {/* Desconto da Proposta */}
                        {(supplierData.discountType && supplierData.discountType !== 'none' && supplierData.discountValue) && (
                          <div>
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Desconto da Proposta:</span>
                            <p className="text-sm mt-1 text-green-600 dark:text-green-300 font-medium">
                              {supplierData.discountType === 'percentage'
                                ? `${supplierData.discountValue}%`
                                : `R$ ${Number(supplierData.discountValue).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`
                              }
                            </p>
                          </div>
                        )}

                        {/* Frete */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                            <span className="text-sm font-medium">Frete</span>
                          </div>
                          <div className="text-sm">
                            {supplierData.includesFreight ? (
                              <span className="text-blue-600 dark:text-blue-300 font-medium">
                                R$ {Number(supplierData.freightValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                              </span>
                            ) : (
                              <span className="text-slate-500 dark:text-slate-400">Não incluso</span>
                            )}
                          </div>
                        </div>

                        {/* Itens */}
                        <div>
                          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Itens:</span>
                          <div className="mt-2 space-y-2">
                            {supplierData.items.slice(0, 3).map((item) => (
                              <div key={item.id} className="text-xs p-2 bg-slate-100 dark:bg-slate-800 rounded">
                                <div className="flex justify-between">
                                  <span className="font-medium">
                                    {(() => {
                                      const quotationItem = quotationItems.find(qi => qi.id === item.quotationItemId);
                                      return quotationItem ? quotationItem.description : `Item #${item.quotationItemId}`;
                                    })()}
                                  </span>
                                  <span>R$ {Number(item.unitPrice).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</span>
                                </div>
                                {item.brand && (
                                  <div className="text-xs text-slate-500 dark:text-slate-400">{item.brand} {item.model}</div>
                                )}
                              </div>
                            ))}
                            {supplierData.items.length > 3 && (
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                +{supplierData.items.length - 3} itens adicionais
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Observações */}
                        {supplierData.observations && (
                          <div>
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Observações:</span>
                            <p className="text-xs mt-1 text-slate-500 dark:text-slate-400">{supplierData.observations}</p>
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
                            <th key={supplier.id} className={`text-center p-3 font-medium border-l ${supplier.isChosen ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : ''
                              }`}>
                              {supplier.supplier.name}
                              {supplier.isChosen && (
                                <div className="text-xs text-green-600 dark:text-green-300 mt-1">
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
                          <tr key={quotationItemId} className="border-b hover:bg-slate-100 dark:hover:bg-slate-800">
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
                                  <td key={supplier.id} className={`p-3 border-l text-center ${supplier.isChosen ? 'bg-green-50 dark:bg-green-900/20' : ''
                                    } ${isBest ? 'bg-green-50 dark:bg-green-900/25 ring-2 ring-green-300 dark:ring-green-500' : ''}`}>
                                    {item ? (
                                      <div className="space-y-1">
                                        {isBest && (
                                          <div className="flex justify-center">
                                            <Badge variant="secondary" className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700">Melhor valor</Badge>
                                          </div>
                                        )}
                                        {(() => {
                                          const qi = quotationItems.find(q => q.id === item.quotationItemId);
                                          const requestedQty = qi?.quantity;
                                          const qty = item.availableQuantity ?? requestedQty ?? (item.unitPrice ? Math.round(Number(item.discountedTotalPrice || item.totalPrice) / Number(item.unitPrice)) : undefined);
                                          const unit = item.confirmedUnit || qi?.unit;
                                          if (qty && unit) {
                                            return (
                                              <div className="text-xs text-slate-700 dark:text-slate-300">Quantidade: {qty.toLocaleString('pt-BR')} {unit}</div>
                                            );
                                          }
                                          if (qty) {
                                            return (
                                              <div className="text-xs text-slate-700 dark:text-slate-300">Quantidade: {qty.toLocaleString('pt-BR')}</div>
                                            );
                                          }
                                          return null;
                                        })()}
                                        <div className="text-xs text-slate-700 dark:text-slate-300">
                                          Vlr. Unit.: R$ {Number(item.unitPrice).toLocaleString('pt-BR', {
                                            minimumFractionDigits: 4,
                                            maximumFractionDigits: 4
                                          })}
                                        </div>
                                        {(item.discountPercentage || item.discountValue) && (
                                          <div className="text-xs text-orange-600">
                                            Vlr. Desconto: {item.discountPercentage
                                              ? `${item.discountPercentage}%`
                                              : `R$ ${Number(item.discountValue).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`
                                            }
                                          </div>
                                        )}
                                        <div className="text-sm font-bold text-green-700 dark:text-green-300">
                                          Vlr Final: R$ {Number(item.discountedTotalPrice || item.totalPrice).toLocaleString('pt-BR', {
                                            minimumFractionDigits: 4,
                                            maximumFractionDigits: 4
                                          })}
                                        </div>
                                        {item.deliveryDays && (
                                          <div className="text-xs text-blue-600 dark:text-blue-300">Prazo: {item.deliveryDays} dias</div>
                                        )}
                                        {item.brand && (
                                          <div className="text-xs text-slate-500 dark:text-slate-400">
                                            {item.brand} {item.model}
                                          </div>
                                        )}
                                        {item.observations && (
                                          <div className="text-xs text-slate-500 dark:text-slate-400 italic">
                                            {item.observations}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-slate-500 dark:text-slate-400 text-sm">Não cotado</span>
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

              {/* Fechar - movido para rodapé fixo */}
            </>
          )}
        </div>
        <div className="flex-shrink-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800 sticky bottom-0 z-30 px-6 py-3">
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>Fechar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
