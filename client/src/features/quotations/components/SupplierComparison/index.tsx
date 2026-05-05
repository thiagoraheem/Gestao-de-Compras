import { useState } from "react";
import { CheckCircle, DollarSign, Clock, Building2, AlertCircle, Truck, ChevronDown, X, Package, Download } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Alert, AlertDescription } from "@/shared/ui/alert";
import { Textarea } from "@/shared/ui/textarea";
import { Label } from "@/shared/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/shared/ui/dialog";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/shared/ui/collapsible";
import { Slider } from "@/shared/ui/slider";

import { useSupplierComparison } from "./useSupplierComparison";
import { useRecommendedSupplier } from "./useRecommendedSupplier";
import { ComparisonDataGrid } from "./ComparisonDataGrid";

interface SupplierComparisonProps {
  quotationId: number;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
  onComplete: () => void;
}

export default function SupplierComparison({ quotationId, isOpen, onOpenChange, onClose, onComplete }: SupplierComparisonProps) {
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [observations, setObservations] = useState("");
  const [createNewRequestForUnavailable, setCreateNewRequestForUnavailable] = useState(false);
  const [unavailableItemsOption, setUnavailableItemsOption] = useState<'none' | 'with-rfq' | 'without-rfq'>('none');
  const [selectedItems, setSelectedItems] = useState<{ [key: number]: boolean }>({});
  const [nonSelectedItemsOption, setNonSelectedItemsOption] = useState<'none' | 'separate-quotation' | 'info-only'>('none');
  const [showItemSelection, setShowItemSelection] = useState(false);
  const [showRecommendedDetails, setShowRecommendedDetails] = useState(false);
  const [weights, setWeights] = useState({ price: 60, delivery: 20, discount: 10, freight: 5, payment: 5 });
  const [paramsOpen, setParamsOpen] = useState(false);

  const {
    suppliersData,
    quotationItems,
    isLoading,
    selectSupplierMutation
  } = useSupplierComparison({
    quotationId,
    onComplete,
    createNewRequestForUnavailable,
    hasUnavailableItems: false // Will be updated dynamically below
  });

  const { receivedQuotations, noResponseQuotations, recommendedSupplier } = useRecommendedSupplier({
    suppliersData,
    weights
  });

  // Detectar itens indisponíveis apenas do fornecedor selecionado
  const selectedSupplierData = selectedSupplierId
    ? suppliersData.find(s => s.supplier.id === selectedSupplierId)
    : null;

  const unavailableItems = selectedSupplierData
    ? selectedSupplierData.items.filter(item => item.isAvailable === false)
    : [];

  const hasUnavailableItems = unavailableItems.length > 0 && selectedSupplierId !== null;

  const handleExportExcel = async () => {
    try {
      const XLSX = await import("xlsx");

      const rows = quotationItems.map((item: any) => {
        const rowData: any = {
          'Item': item.description,
          'Quantidade': item.quantity,
          'Unidade': item.unit || 'UN'
        };

        receivedQuotations.forEach(q => {
          const supplierItem = q.items.find((i: any) => i.quotationItemId === item.id);
          if (supplierItem && supplierItem.isAvailable !== false) {
             rowData[`${q.supplier.name} - Vlr. Unit. (R$)`] = Number(supplierItem.unitPrice);
             rowData[`${q.supplier.name} - Total (R$)`] = Number(supplierItem.totalPrice);
          } else {
             rowData[`${q.supplier.name} - Vlr. Unit. (R$)`] = 'Indisponível';
             rowData[`${q.supplier.name} - Total (R$)`] = '-';
          }
        });
        return rowData;
      });

      const totalsRow: any = {
        'Item': 'TOTAL GERAL',
        'Quantidade': '',
        'Unidade': ''
      };

      receivedQuotations.forEach(q => {
        totalsRow[`${q.supplier.name} - Vlr. Unit. (R$)`] = '';
        totalsRow[`${q.supplier.name} - Total (R$)`] = q.totalValue ? Number(q.totalValue) : '-';
      });

      rows.push(totalsRow);

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Comparação");

      const wscols = [
        {wch: 50}, // Item
        {wch: 15}, // Qtd
        {wch: 15}, // Unid
      ];
      receivedQuotations.forEach(() => {
        wscols.push({wch: 25});
        wscols.push({wch: 25});
      });
      worksheet['!cols'] = wscols;

      XLSX.writeFile(workbook, `Comparacao_Fornecedores_${quotationId}.xlsx`);
    } catch (error) {
      console.error("Erro ao exportar para Excel:", error);
    }
  };

  const handleSelectSupplier = () => {
    if (!selectedSupplierId || !selectedSupplierData) return;

    const unavailableItemsData = hasUnavailableItems
      ? unavailableItems.map(item => ({
        quotationItemId: item.quotationItemId,
        reason: item.unavailabilityReason || "Item indisponível"
      }))
      : undefined;

    const selectedItemsData = showItemSelection
      ? Object.entries(selectedItems)
        .filter(([_, isSelected]) => isSelected)
        .map(([itemId, _]) => ({ quotationItemId: parseInt(itemId) }))
      : undefined;

    const nonSelectedItemsData = showItemSelection
      ? Object.entries(selectedItems)
        .filter(([_, isSelected]) => !isSelected)
        .map(([itemId, _]) => ({ quotationItemId: parseInt(itemId) }))
      : undefined;

    selectSupplierMutation.mutate({
      selectedSupplierId,
      totalValue: selectedSupplierData.totalValue,
      observations,
      createNewRequest: hasUnavailableItems && unavailableItemsOption !== 'none',
      unavailableItems: unavailableItemsData,
      unavailableItemsOption,
      selectedItems: selectedItemsData,
      nonSelectedItemsOption: showItemSelection ? nonSelectedItemsOption : 'none',
      nonSelectedItems: nonSelectedItemsData,
    });
  };

  const handleToggleItemSelection = () => {
    if (!showItemSelection && selectedSupplierData) {
      const availableItems = selectedSupplierData.items.filter(item => item.isAvailable !== false);
      const initialSelection: { [key: number]: boolean } = {};
      availableItems.forEach(item => {
        initialSelection[item.quotationItemId] = true;
      });
      setSelectedItems(initialSelection);
    }
    setShowItemSelection(!showItemSelection);
  };

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-5xl p-0">
          <div className="p-10 flex items-center justify-center">
            <DialogTitle className="sr-only">Carregando comparação</DialogTitle>
            <div className="flex items-center gap-3">
              <svg className="h-5 w-5 animate-spin text-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
              </svg>
              <p className="text-base font-medium text-foreground">Carregando dados das cotações...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto p-0 sm:rounded-lg" aria-describedby="supplier-comparison-desc">
        <div className="flex-shrink-0 bg-background border-b border-border sticky top-0 z-30 px-6 py-3 rounded-t-lg">
          <div className="flex justify-between items-center">
            <DialogTitle className="text-base font-semibold">Comparação de Fornecedores</DialogTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={isLoading || receivedQuotations.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Exportar Excel
              </Button>
              <DialogClose asChild>
                <Button variant="ghost" size="icon" onClick={onClose} className="p-2" aria-label="Fechar">
                  <X className="h-4 w-4" />
                </Button>
              </DialogClose>
            </div>
          </div>
          <p id="supplier-comparison-desc" className="sr-only">Comparativo de cotações por fornecedor com seleção e confirmação</p>
        </div>
        
        <div className="px-6 pt-4 pb-2">
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
                    <br />A comparação será feita apenas com os fornecedores que responderam.
                  </AlertDescription>
                </Alert>
              )}

              {/* Parametrização de Pesos (colapsável) */}
              <Collapsible open={paramsOpen} onOpenChange={setParamsOpen}>
                <Card className="mb-6 transition-colors duration-200">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <span>Parâmetros de Recomendação</span>
                        <span className="text-xs text-muted-foreground">(opcional)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setWeights({ price: 60, delivery: 20, discount: 10, freight: 5, payment: 5 })}>Restaurar padrão</Button>
                        <CollapsibleTrigger className="flex items-center gap-1 text-xs px-2 py-1 border rounded hover:bg-muted">
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
                      <div className="mt-3 text-xs text-muted-foreground">Os pesos são normalizados automaticamente para a recomendação.</div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>

              {/* Grid de Fornecedores */}
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-6">
                {receivedQuotations.map((supplierData) => (
                  <Card
                    key={supplierData.id}
                    className={`cursor-pointer transition-all ${selectedSupplierId === supplierData.supplier.id
                        ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20'
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
                          {recommendedSupplier?.supplier.id === supplierData.supplier.id && (
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
                        <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium">Valor Total</span>
                          </div>
                          <span className="text-lg font-bold text-green-600">
                            R$ {supplierData.totalValue?.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium">Prazo</span>
                          </div>
                          <span className="text-sm">{supplierData.deliveryDays} dias</span>
                        </div>

                        <div>
                          <span className="text-sm font-medium text-muted-foreground">Pagamento:</span>
                          <p className="text-sm mt-1">{supplierData.paymentTerms}</p>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium">Frete</span>
                          </div>
                          <div className="text-sm">
                            {supplierData.includesFreight ? (
                              <span className="text-blue-600 font-medium">
                                R$ {Number(supplierData.freightValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Não incluso</span>
                            )}
                          </div>
                        </div>

                        <div className="flex justify-between items-center mt-4">
                          <Badge variant="outline" className="text-xs">
                            Recebido em {new Date(supplierData.receivedAt).toLocaleDateString('pt-BR')}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Data Grid Section extracted for extreme length */}
              <ComparisonDataGrid 
                receivedQuotations={receivedQuotations} 
                quotationItems={quotationItems} 
              />

              {/* Observações da Decisão */}
              <Card className="mb-6 transition-colors duration-200">
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

              {/* Seleção de Itens */}
              {selectedSupplierId && selectedSupplierData && (
                <Card className="mb-6 transition-colors duration-200">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                       <Package className="h-5 w-5" />
                       Seleção de Itens
                    </CardTitle>
                    <Button 
                      variant="outline" 
                      onClick={handleToggleItemSelection}
                    >
                      {showItemSelection ? "Seleção Completa" : "Seleção Individual"}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {!showItemSelection ? (
                      <p className="text-sm text-muted-foreground">
                        Todos os itens disponíveis do fornecedor selecionado serão incluídos na compra. Clique em "Seleção Individual" para escolher itens específicos.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        <p className="text-sm text-muted-foreground mb-4">
                          Selecione quais itens deseja incluir no pedido para este fornecedor.
                        </p>
                        
                        <div className="border rounded-md divide-y">
                          {selectedSupplierData.items.filter((item: any) => item.isAvailable !== false).map((item: any) => {
                            const qItem = quotationItems.find((qi: any) => qi.id === item.quotationItemId);
                            return (
                              <div key={item.id} className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                <label className="flex items-center gap-3 cursor-pointer flex-1">
                                  <input 
                                    type="checkbox" 
                                    className="h-4 w-4 rounded border-gray-300"
                                    checked={!!selectedItems[item.quotationItemId]}
                                    onChange={(e) => {
                                      setSelectedItems(prev => ({
                                        ...prev,
                                        [item.quotationItemId]: e.target.checked
                                      }));
                                    }}
                                  />
                                  <div>
                                    <p className="font-medium text-sm">{qItem?.description || item.description || "Item não identificado"}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {item.quantity} {qItem?.unit || 'UN'} x R$ {Number(item.unitPrice).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                                    </p>
                                  </div>
                                </label>
                                <div className="font-semibold text-sm cursor-default">
                                  R$ {Number(item.totalPrice).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        
                        {/* Ações para itens não selecionados */}
                        {Object.values(selectedItems).some(v => !v) && (
                          <div className="mt-6 pt-4 border-t">
                            <h4 className="font-medium mb-3">Ações para itens não selecionados:</h4>
                            <div className="space-y-2">
                              <label className="flex items-start gap-2 cursor-pointer">
                                <input 
                                  type="radio" 
                                  name="nonSelectedAction" 
                                  value="none"
                                  className="mt-1"
                                  checked={nonSelectedItemsOption === 'none'}
                                  onChange={() => setNonSelectedItemsOption('none')}
                                />
                                <span className="text-sm">Não fazer nada (os itens serão ignorados)</span>
                              </label>
                              <label className="flex items-start gap-2 cursor-pointer">
                                <input 
                                  type="radio" 
                                  name="nonSelectedAction" 
                                  value="separate-quotation"
                                  className="mt-1"
                                  checked={nonSelectedItemsOption === 'separate-quotation'}
                                  onChange={() => setNonSelectedItemsOption('separate-quotation')}
                                />
                                <span className="text-sm">Criar nova cotação imediatamente para os itens não selecionados</span>
                              </label>
                              <label className="flex items-start gap-2 cursor-pointer">
                                <input 
                                  type="radio" 
                                  name="nonSelectedAction" 
                                  value="info-only"
                                  className="mt-1"
                                  checked={nonSelectedItemsOption === 'info-only'}
                                  onChange={() => setNonSelectedItemsOption('info-only')}
                                />
                                <span className="text-sm">Manter na cotação atual como pendentes (serão resolvidos depois)</span>
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Opções para itens indisponíveis */}
              {selectedSupplierId && hasUnavailableItems && (
                <Card className="mb-6 border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-900 transition-colors duration-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-orange-800 dark:text-orange-200">
                      <AlertCircle className="h-5 w-5" />
                      Itens Indisponíveis Encontrados
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                      <div className="space-y-3">
                        <p className="font-medium text-foreground">Escolha uma opção para os itens indisponíveis:</p>

                        <div className="space-y-2">
                          <label className="flex items-start space-x-3 cursor-pointer group">
                            <input
                              type="radio"
                              name="unavailableOption"
                              value="none"
                              checked={unavailableItemsOption === 'none'}
                              onChange={(e) => setUnavailableItemsOption(e.target.value as any)}
                              className="mt-1"
                            />
                            <div>
                              <span className="font-medium text-foreground group-hover:text-primary transition-colors">Não realizar nenhuma ação</span>
                            </div>
                          </label>

                          <label className="flex items-start space-x-3 cursor-pointer group">
                            <input
                              type="radio"
                              name="unavailableOption"
                              value="with-rfq"
                              checked={unavailableItemsOption === 'with-rfq'}
                              onChange={(e) => setUnavailableItemsOption(e.target.value as any)}
                              className="mt-1"
                            />
                            <div>
                              <span className="font-medium text-foreground group-hover:text-primary transition-colors">Criar solicitação aprovada A1 com RFQ gerada</span>
                            </div>
                          </label>
                        </div>
                      </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex-shrink-0 bg-background/80 backdrop-blur-sm border-t sticky bottom-0 z-30 -mx-6 px-6 py-3 mt-8">
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
      </DialogContent>
    </Dialog>
  );
}
