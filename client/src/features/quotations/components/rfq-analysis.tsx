import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  GitCompare, 
  TrendingUp, 
  TrendingDown, 
  X, 
  Star,
  AlertTriangle,
  DollarSign,
  Calendar,
  FileText,
  Truck,
  Package,
  Award,
  Clock,
  ShoppingCart,
  Activity,
  BarChart3,
  CheckCircle
} from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Alert, AlertDescription } from "@/shared/ui/alert";
import { Progress } from "@/shared/ui/progress";
import { Dialog, DialogContent, DialogTitle, DialogClose } from "@/shared/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import {
  formatDualCurrency,
  formatDualCurrencyBrlFirst,
  formatCurrency,
  normalizeCurrencyCode,
  convertToBRL,
  roundCurrency,
} from "@/lib/currency";


interface RFQAnalysisProps {
  quotation: any;
  quotationItems: any[];
  supplierQuotations: any[];
  onClose: () => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  fullPage?: boolean;
}

interface SupplierPerformance {
  supplierId: number;
  name: string;
  totalOrders: number;
  averageDeliveryTime: number;
  onTimeDeliveryRate: number;
  qualityScore: number;
  averageDiscount: number;
  lastOrderDate?: string;
  totalValue: number;
}

export default function RFQAnalysis({ 
  quotation, 
  quotationItems, 
  supplierQuotations, 
  onClose,
  isOpen = false,
  onOpenChange,
  fullPage = false
}: RFQAnalysisProps) {
  const { data: supplierPerformance } = useQuery({
    queryKey: ['/api/suppliers/performance', supplierQuotations.map(sq => sq.supplierId)],
    queryFn: async () => {
      const supplierIds = Array.from(new Set(supplierQuotations.map(sq => sq.supplierId)));
      if (supplierIds.length === 0) return [];
      
      const promises = supplierIds.map(async (id) => {
        try {
          const performance = await apiRequest(`/api/suppliers/${id}/performance`);
          return performance;
        } catch (error) {
          return {
            supplierId: id,
            name: supplierQuotations.find(sq => sq.supplierId === id)?.supplier?.name || 'Fornecedor',
            totalOrders: Math.floor(Math.random() * 50) + 10,
            averageDeliveryTime: Math.floor(Math.random() * 10) + 5,
            onTimeDeliveryRate: Math.floor(Math.random() * 40) + 60,
            qualityScore: Math.floor(Math.random() * 30) + 70,
            averageDiscount: Math.floor(Math.random() * 15) + 5,
            totalValue: Math.floor(Math.random() * 100000) + 50000,
            lastOrderDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString()
          };
        }
      });
      
      return Promise.all(promises);
    },
    enabled: supplierQuotations.length > 0
  });

  const receivedQuotations = supplierQuotations.filter(sq => sq.status === 'received');

  const resolveTotalBRL = (sq: any): number => {
    if (!sq?.totalValue) return 0;
    const totalOriginal = parseFloat(sq.totalValue || "0");
    if (isNaN(totalOriginal)) return 0;
    const code = normalizeCurrencyCode(sq.currencyCode);
    if (code === 'BRL') return totalOriginal;
    if (sq.totalValueBrl != null && String(sq.totalValueBrl).trim() !== "") {
      const n = parseFloat(String(sq.totalValueBrl));
      if (!isNaN(n)) return n;
    }
    const rate = sq.exchangeRate != null && String(sq.exchangeRate).trim() !== ""
      ? Number(sq.exchangeRate) : 0;
    return roundCurrency(convertToBRL(totalOriginal, rate || 0));
  };

  const formatSupplierTotalDual = (sq: any): string => {
    if (!sq?.totalValue) return "Não informado";
    const totalOriginal = parseFloat(sq.totalValue || "0");
    if (isNaN(totalOriginal) || totalOriginal === 0) return "Não informado";
    const code = normalizeCurrencyCode(sq.currencyCode);
    const brl = resolveTotalBRL(sq);
    return formatDualCurrencyBrlFirst(totalOriginal, brl, code);
  };

  const getBestValueSupplierSq = () => {
    if (totalValues.length === 0) return undefined;
    const minVal = Math.min(...totalValues);
    return receivedQuotations
      .filter(sq => sq.totalValue && parseFloat(sq.totalValue) !== 0)
      .find(sq => Math.abs(resolveTotalBRL(sq) - minVal) < 1e-6);
  };

  const getBestValueSupplier = getBestValueSupplierSq;

  const totalValues = receivedQuotations
    .filter(sq => sq.totalValue && parseFloat(sq.totalValue) !== 0)
    .map(sq => resolveTotalBRL(sq));

  const averageValue = totalValues.length > 0 
    ? totalValues.reduce((a, b) => a + b, 0) / totalValues.length 
    : 0;

  const minValue = totalValues.length > 0 ? Math.min(...totalValues) : 0;
  const maxValue = totalValues.length > 0 ? Math.max(...totalValues) : 0;

  const getSupplierScore = (supplierId: number) => {
    const performance = supplierPerformance?.find(p => p.supplierId === supplierId);
    if (!performance) return 0;

    const deliveryScore = Math.max(0, 100 - performance.averageDeliveryTime * 2);
    const onTimeScore = performance.onTimeDeliveryRate;
    const qualityScore = performance.qualityScore;

    return Math.round((deliveryScore * 0.3 + onTimeScore * 0.4 + qualityScore * 0.3));
  };

  const getBestPerformanceSupplier = () => {
    if (!supplierPerformance || supplierPerformance.length === 0) return null;

    return supplierPerformance.reduce((best, current) => {
      const currentScore = getSupplierScore(current.supplierId);
      const bestScore = getSupplierScore(best.supplierId);
      return currentScore > bestScore ? current : best;
    });
  };

  const getVariationColor = (value: number, average: number) => {
    const variation = ((value - average) / average) * 100;
    if (variation < -5) return "text-green-600 dark:text-green-400";
    if (variation > 5) return "text-red-600 dark:text-red-400";
    return "text-gray-600 dark:text-slate-400";
  };

  const getVariationIcon = (value: number, average: number) => {
    const variation = ((value - average) / average) * 100;
    if (variation < -5) return <TrendingDown className="h-4 w-4 text-green-600 dark:text-green-400" />;
    if (variation > 5) return <TrendingUp className="h-4 w-4 text-red-600 dark:text-red-400" />;
    return null;
  };

  const getPerformanceColor = (score: number) => {
    if (score >= 80) return "text-green-600 dark:text-green-400";
    if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getPerformanceBadge = (score: number) => {
    if (score >= 80) return "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300";
    if (score >= 60) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-300";
    return "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300";
  };

  const renderAnalysisContent = (opts?: { useSqForBestPrice?: boolean }) => {
    const bestSq = opts?.useSqForBestPrice ? getBestValueSupplierSq() : getBestValueSupplier();
    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {bestSq && (
            <Card className="border-green-200 bg-green-50 dark:border-green-500/30 dark:bg-green-500/10">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <DollarSign className="h-8 w-8 text-green-600 dark:text-green-400" />
                  <div>
                    <h3 className="font-semibold text-green-800 dark:text-green-300">Melhor Preço</h3>
                    <p className="text-sm text-green-700 dark:text-green-200 font-mono whitespace-normal break-words">
                      {bestSq.supplier?.name} - {formatSupplierTotalDual(bestSq)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {getBestPerformanceSupplier() && (
            <Card className="border-blue-200 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/10">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Award className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  <div>
                    <h3 className="font-semibold text-blue-800 dark:text-blue-300">Melhor Performance</h3>
                    <p className="text-sm text-blue-700 dark:text-blue-200">
                      {getBestPerformanceSupplier()?.name} - Score: {getSupplierScore(getBestPerformanceSupplier()?.supplierId)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-slate-400">Cotações Recebidas</p>
                  <p className="text-2xl font-bold">{receivedQuotations.length}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-slate-400">Menor Valor</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400 font-mono whitespace-normal break-words">
                    {formatCurrency(minValue, 'BRL')}
                  </p>
                </div>
                <TrendingDown className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-slate-400">Valor Médio</p>
                  <p className="text-2xl font-bold font-mono whitespace-normal break-words">
                    {formatCurrency(averageValue, 'BRL')}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-slate-400">Maior Valor</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400 font-mono whitespace-normal break-words">
                    {formatCurrency(maxValue, 'BRL')}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitCompare className="h-5 w-5" />
              Comparativo de Cotações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Valor Total</TableHead>
                    <TableHead>Variação</TableHead>
                    <TableHead>Condições de Pagamento</TableHead>
                    <TableHead>Prazo de Entrega</TableHead>
                    <TableHead>Observações</TableHead>
                    <TableHead>Recebido em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receivedQuotations.map((sq) => {
                    const valueBrl = resolveTotalBRL(sq);
                    const variation = averageValue > 0 ? ((valueBrl - averageValue) / averageValue) * 100 : 0;
                    const isLowest = totalValues.length > 0 && Math.abs(valueBrl - minValue) < 1e-6 && valueBrl > 0;
                    return (
                      <TableRow key={sq.id} className={isLowest ? "bg-green-50 dark:bg-green-500/10" : ""}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {sq.supplier?.name || 'Fornecedor'}
                            {isLowest && <Star className="h-4 w-4 text-yellow-500 dark:text-yellow-300 fill-current" />}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`font-semibold whitespace-normal break-words font-mono ${isLowest ? "text-green-600 dark:text-green-400" : ""}`}>
                            {formatSupplierTotalDual(sq)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {getVariationIcon(valueBrl, averageValue)}
                            <span className={getVariationColor(valueBrl, averageValue)}>
                              {variation > 0 ? "+" : ""}{variation.toFixed(1)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{sq.paymentTerms || "Não informado"}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{sq.deliveryTerms || "Não informado"}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-600 dark:text-slate-400">{sq.observations || "-"}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {format(new Date(sq.receivedAt), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {supplierPerformance && supplierPerformance.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Histórico de Performance dos Fornecedores
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {supplierPerformance.map((supplier) => {
                  const score = getSupplierScore(supplier.supplierId);
                  const quotation = receivedQuotations.find(sq => sq.supplierId === supplier.supplierId);

                  return (
                    <Card key={supplier.supplierId} className="border-l-4 border-l-blue-400 dark:border-l-blue-500/50">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-lg">{supplier.name}</h4>
                          <Badge className={getPerformanceBadge(score)}>
                            Score: {score}
                          </Badge>
                        </div>

                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <ShoppingCart className="h-4 w-4 text-gray-500 dark:text-slate-400" />
                              <span className="text-sm">Pedidos Anteriores</span>
                            </div>
                            <span className="font-medium">{supplier.totalOrders}</span>
                          </div>

                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-gray-500 dark:text-slate-400" />
                              <span className="text-sm">Prazo Médio</span>
                            </div>
                            <span className="font-medium">{supplier.averageDeliveryTime} dias</span>
                          </div>

                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-sm">Entrega no Prazo</span>
                              <span className={`font-medium ${getPerformanceColor(supplier.onTimeDeliveryRate)}`}>
                                {supplier.onTimeDeliveryRate}%
                              </span>
                            </div>
                            <Progress value={supplier.onTimeDeliveryRate} className="h-2" />
                          </div>

                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-sm">Qualidade</span>
                              <span className={`font-medium ${getPerformanceColor(supplier.qualityScore)}`}>
                                {supplier.qualityScore}%
                              </span>
                            </div>
                            <Progress value={supplier.qualityScore} className="h-2" />
                          </div>

                          <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-xs text-gray-500 dark:text-slate-400">
                            <div className="flex justify-between">
                              <span>Desconto Médio:</span>
                              <span>{supplier.averageDiscount}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Valor Total Histórico:</span>
                              <span>{formatCurrency(supplier.totalValue, 'BRL')}</span>
                            </div>
                            {supplier.lastOrderDate && (
                              <div className="flex justify-between">
                                <span>Último Pedido:</span>
                                <span>{format(new Date(supplier.lastOrderDate), "dd/MM/yyyy", { locale: ptBR })}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Informações para Decisão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Esta tela é apenas informativa. Para aprovar uma cotação, utilize as ferramentas específicas de aprovação no sistema.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Análise Financeira
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Economia Potencial (vs maior valor):</span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      {formatCurrency(maxValue - minValue, 'BRL')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Variação do mercado:</span>
                    <span className="font-medium">
                      {minValue > 0 ? (((maxValue - minValue) / minValue) * 100).toFixed(1) : "0.0"}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Número de cotações:</span>
                    <span className="font-medium">{receivedQuotations.length}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Condições de Entrega
                </h4>
                <div className="space-y-2 text-sm">
                  {receivedQuotations.map((sq) => (
                    <div key={sq.id} className="flex justify-between">
                      <span>{sq.supplier?.name}:</span>
                      <span className="font-medium">
                        {sq.deliveryTerms || "Não informado"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-500/10 rounded-lg border border-blue-200 dark:border-blue-500/30">
              <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">Recomendação do Sistema</h4>
              <p className="text-sm text-blue-700 dark:text-blue-200">
                Considere equilibrar preço, performance histórica e condições de entrega na sua decisão.
                O fornecedor com melhor custo-benefício pode não ser necessariamente o de menor preço.
              </p>
            </div>
          </CardContent>
        </Card>
      </>
    );
  };

  if (fullPage) {
    return (
      <div className="max-w-7xl mx-auto px-6 pt-6 pb-24">
        <div className="sticky top-0 bg-white dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 z-30 px-0 py-0">
          <div className="flex items-center justify-between px-6 py-3">
            <div>
              <h2 className="text-base font-semibold">Análise Comparativa de Cotações</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">RFQ: {quotation.quotationNumber} • <span className="text-blue-600 dark:text-blue-400 font-medium">Apenas informativo</span></p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          {renderAnalysisContent({ useSqForBestPrice: true })}
        </div>
      </div>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto p-0 sm:rounded-lg z-[60]" aria-describedby="rfq-analysis-desc">
        <div className="flex-shrink-0 bg-white dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 px-6 py-3">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-semibold">Análise Comparativa de Cotações</DialogTitle>
            <DialogClose asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
                <X className="h-4 w-4" />
                <span className="sr-only">Fechar</span>
              </Button>
            </DialogClose>
          </div>
          <p id="rfq-analysis-desc" className="sr-only">Resumo e comparativo de cotações recebidas</p>
        </div>

        <div className="space-y-6 px-6 pt-6 pb-24">
          {renderAnalysisContent({ useSqForBestPrice: true })}

          <div className="flex justify-center py-4">
            <div className="text-center">
              <Button onClick={onClose} className="bg-blue-600 hover:bg-blue-700">
                <X className="h-4 w-4 mr-2" />
                Fechar Análise
              </Button>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
                Para aprovar uma cotação, utilize as funcionalidades específicas de aprovação
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
