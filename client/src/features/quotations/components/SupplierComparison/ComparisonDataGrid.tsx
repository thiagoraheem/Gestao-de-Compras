import React, { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Package, XCircle } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { SupplierQuotationData } from './types';

interface ComparisonDataGridProps {
  receivedQuotations: SupplierQuotationData[];
  quotationItems: any[];
}

export const ComparisonDataGrid = memo(function ComparisonDataGrid({
  receivedQuotations,
  quotationItems
}: ComparisonDataGridProps) {
  // Get all unique items from all suppliers
  const uniqueQuotationItemIds = Array.from(
    new Set(
      receivedQuotations.flatMap(sq =>
        sq.items.map(item => item.quotationItemId)
      )
    )
  );

  if (uniqueQuotationItemIds.length === 0) {
    return null;
  }

  return (
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
                <th className="text-left p-3 font-medium min-w-[200px]">Item</th>
                {receivedQuotations.map((supplier) => (
                  <th key={supplier.id} className="text-center p-3 font-medium border-l min-w-[180px]">
                    {supplier.supplier.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {uniqueQuotationItemIds.map((quotationItemId) => {
                const quotationItem = quotationItems.find(qi => qi.id === quotationItemId);
                
                // Find best final price across all suppliers for this item
                const bestFinalPrice = (() => {
                  const values = receivedQuotations.map((supplier) => {
                    const it = supplier.items.find(i => i.quotationItemId === quotationItemId);
                    if (!it || it.isAvailable === false) return Infinity;
                    return Number(it.discountedTotalPrice || it.totalPrice);
                  });
                  const min = Math.min(...values);
                  return isFinite(min) ? min : null;
                })();

                return (
                  <tr key={quotationItemId} className="border-b border-border hover:bg-muted/50 transition-colors">
                    <td className="p-3 font-medium">
                      <div>
                        {quotationItem ? quotationItem.description : `Item #${quotationItemId}`}
                      </div>
                      {(quotationItem?.purchaseRequestItem?.price != null && String(quotationItem.purchaseRequestItem.price).trim() !== "") && (
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Custo Previsto: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(quotationItem.purchaseRequestItem.price))}
                        </div>
                      )}
                      {(quotationItem?.purchaseRequestItem?.partNumber && String(quotationItem.purchaseRequestItem.partNumber).trim() !== "") && (
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          PN: {quotationItem.purchaseRequestItem.partNumber}
                        </div>
                      )}
                    </td>
                    
                    {receivedQuotations.map((supplier) => {
                      const item = supplier.items.find(
                        i => i.quotationItemId === quotationItemId
                      );
                      const finalValue = item ? Number(item.discountedTotalPrice || item.totalPrice) : null;
                      const isBest = item && item.isAvailable !== false && bestFinalPrice !== null && finalValue === bestFinalPrice;
                      
                      const cellClasses = `p-3 border-l text-center transition-colors 
                        ${item && item.isAvailable === false ? 'bg-red-50 dark:bg-red-900/20' : ''} 
                        ${isBest ? 'bg-green-50 dark:bg-green-900/20 ring-1 ring-inset ring-green-300 dark:ring-green-800' : ''}`;

                      return (
                        <td key={supplier.id} className={cellClasses}>
                          {item ? (
                            item.isAvailable === false ? (
                              <div className="space-y-1">
                                <div className="flex items-center justify-center gap-1 text-red-600 dark:text-red-400">
                                  <XCircle className="h-4 w-4" />
                                  <span className="font-bold">Indisponível</span>
                                </div>
                                {item.unavailabilityReason && (
                                  <div className="text-xs text-red-600 dark:text-red-400 italic">
                                    {item.unavailabilityReason}
                                  </div>
                                )}
                                {item.brand && (
                                  <div className="text-xs text-muted-foreground">
                                    {item.brand} {item.model}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-1">
                                {isBest && (
                                  <div className="flex justify-center mb-1">
                                    <Badge variant="secondary" className="text-[10px] bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 border-green-300 dark:border-green-800">
                                      Melhor valor
                                    </Badge>
                                  </div>
                                )}
                                {(() => {
                                  const qi = quotationItems.find(q => q.id === item.quotationItemId);
                                  const requestedQty = qi?.quantity ? parseFloat(qi.quantity) : undefined;
                                  const qty = item.availableQuantity ?? requestedQty ?? (item.unitPrice ? Math.round(Number(item.discountedTotalPrice || item.totalPrice) / Number(item.unitPrice)) : undefined);
                                  const unit = item.confirmedUnit || qi?.unit;
                                  if (qty && unit) {
                                    return <div className="text-xs text-foreground">Qtd: {qty.toLocaleString('pt-BR')} {unit}</div>;
                                  }
                                  if (qty) {
                                    return <div className="text-xs text-foreground">Qtd: {qty.toLocaleString('pt-BR')}</div>;
                                  }
                                  return null;
                                })()}
                                <div className="text-xs text-foreground">
                                  Vlr. Unit.: R$ {Number(item.unitPrice).toLocaleString('pt-BR', {
                                    minimumFractionDigits: 4, maximumFractionDigits: 4
                                  })}
                                </div>
                                {(item.discountPercentage || item.discountValue) && (
                                  <div className="text-xs text-orange-600 dark:text-orange-400">
                                    Desc.: {item.discountPercentage
                                      ? `${item.discountPercentage}%`
                                      : `R$ ${Number(item.discountValue).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`
                                    }
                                  </div>
                                )}
                                <div className="text-sm font-bold text-green-700 dark:text-green-400 mt-1">
                                  Total: R$ {Number(item.discountedTotalPrice || item.totalPrice).toLocaleString('pt-BR', {
                                    minimumFractionDigits: 4, maximumFractionDigits: 4
                                  })}
                                </div>
                                {item.deliveryDays && (
                                  <div className="text-xs text-blue-600 dark:text-blue-400">Prazo: {item.deliveryDays} dias</div>
                                )}
                                {item.brand && (
                                  <div className="text-xs text-muted-foreground">
                                    {item.brand} {item.model}
                                  </div>
                                )}
                              </div>
                            )
                          ) : (
                            <span className="text-muted-foreground text-sm">Não cotado</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
});
