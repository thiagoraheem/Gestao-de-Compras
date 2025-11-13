import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Truck, BarChart3, Clock, CheckCircle, Percent, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/currency";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { DateInput } from "@/components/ui/date-input";

interface Supplier {
  id: number;
  name: string;
}

interface SupplierMetrics {
  totalSent: number;
  responded: number;
  wins: number;
  responseRate: number;
  winRate: number;
  avgResponseTimeHours: number | null;
  totalQuotedValue: number;
  averageTicket: number;
  averageDiscountRate: number;
  availabilityRate: number;
  averageDeliveryDays: number | null;
  monthlyActivity: { month: string; count: number }[];
  score: number;
  recommendationIndex: string;
}

interface SupplierReportResponse {
  supplier: any;
  metrics: SupplierMetrics;
  quotations: Array<{
    id: number;
    quotationId: number;
    quotationNumber: string;
    purchaseRequestId: number;
    status: string;
    sentAt: string | null;
    receivedAt: string | null;
    subtotalValue: string | null;
    finalValue: string | null;
    totalValue: string | null;
    includesFreight: boolean | null;
    freightValue: string | null;
    discountType: string | null;
    discountValue: string | null;
    isChosen: boolean | null;
    createdAt: string;
    adjustedTotal: number;
  }>;
}

const toPercent = (value: number) => `${(value * 100).toFixed(0)}%`;

export default function SuppliersReportPage() {
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("none");
  const [periodType, setPeriodType] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });
  const sortedSuppliers = useMemo(() => {
    return suppliers.slice().sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
  }, [suppliers]);

  const { data: report, isLoading, refetch } = useQuery<SupplierReportResponse | null>({
    queryKey: [
      selectedSupplierId !== "none"
        ? `/api/reports/suppliers?supplierId=${selectedSupplierId}` +
          (periodType === "range" && startDate && endDate
            ? `&startDate=${startDate}&endDate=${endDate}`
            : "")
        : "",
    ],
    enabled: selectedSupplierId !== "none",
    queryFn: async ({ queryKey }) => {
      if (!queryKey[0]) return null;
      const url = String(queryKey[0]);
      return apiRequest(url);
    },
    staleTime: 30000,
    gcTime: 300000,
  });

  const monthlyChartData = useMemo(() => {
    return (report?.metrics.monthlyActivity || [])
      .slice()
      .reverse()
      .map((m) => ({ name: m.month, value: m.count }));
  }, [report]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Relatório de Fornecedores</h1>
          <p className="text-gray-600 mt-1">Selecione um fornecedor para visualizar seu desempenho nas cotações</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => refetch()} variant="outline" size="sm" disabled={selectedSupplierId === "none"}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            Fornecedor
          </CardTitle>
          <CardDescription>
            Escolha o fornecedor para gerar o extrato completo das cotações, indicadores e score
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Fornecedor</Label>
              <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um fornecedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione</SelectItem>
                  {sortedSuppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Período</Label>
              <Select value={periodType} onValueChange={setPeriodType}>
                <SelectTrigger>
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo o histórico</SelectItem>
                  <SelectItem value="range">Período específico</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {report && (
              <div className="space-y-2">
                <Label>Score</Label>
                <div className="flex items-center gap-3">
                  <Badge className="bg-blue-100 text-blue-800">{report.metrics.recommendationIndex}</Badge>
                  <span className="text-2xl font-semibold">{Math.round(report.metrics.score)}</span>
                </div>
              </div>
            )}
          </div>
          {periodType === "range" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <Label>Data inicial</Label>
                <DateInput value={startDate} onChange={setStartDate} placeholder="DD/MM/AAAA" />
              </div>
              <div className="space-y-2">
                <Label>Data final</Label>
                <DateInput value={endDate} onChange={setEndDate} placeholder="DD/MM/AAAA" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedSupplierId !== "none" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Indicadores de Desempenho
              </CardTitle>
              <CardDescription>
                Métricas chave para análise de desempenho do fornecedor no processo de cotação
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-6">
                  <RefreshCw className="w-6 h-6 animate-spin" />
                </div>
              ) : report ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-gray-500">Cotações Enviadas</p>
                    <p className="text-2xl font-semibold">{report.metrics.totalSent}</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-gray-500">Cotações Respondidas</p>
                    <p className="text-2xl font-semibold">{report.metrics.responded}</p>
                    <p className="text-xs text-gray-500">Taxa: {toPercent(report.metrics.responseRate)}</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-gray-500">Vitórias</p>
                    <p className="text-2xl font-semibold">{report.metrics.wins}</p>
                    <p className="text-xs text-gray-500">Taxa: {toPercent(report.metrics.winRate)}</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-gray-500 flex items-center gap-2"><Clock className="w-4 h-4" />Tempo Médio de Resposta</p>
                    <p className="text-2xl font-semibold">{report.metrics.avgResponseTimeHours ? `${report.metrics.avgResponseTimeHours.toFixed(1)} h` : "N/A"}</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-gray-500 flex items-center gap-2"><DollarSign className="w-4 h-4" />Valor Total Cotado</p>
                    <p className="text-2xl font-semibold">{formatCurrency(report.metrics.totalQuotedValue)}</p>
                    <p className="text-xs text-gray-500">Ticket médio: {formatCurrency(report.metrics.averageTicket)}</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-gray-500 flex items-center gap-2"><Percent className="w-4 h-4" />Desconto Médio</p>
                    <p className="text-2xl font-semibold">{toPercent(report.metrics.averageDiscountRate)}</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-gray-500">Disponibilidade dos Itens</p>
                    <p className="text-2xl font-semibold">{toPercent(report.metrics.availabilityRate)}</p>
                    <p className="text-xs text-gray-500">Prazo médio: {report.metrics.averageDeliveryDays ? `${report.metrics.averageDeliveryDays.toFixed(0)} dias` : "N/A"}</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-gray-500 flex items-center gap-2"><CheckCircle className="w-4 h-4" />Índice Recomendido</p>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-green-100 text-green-800">{report.metrics.recommendationIndex}</Badge>
                      <span className="text-2xl font-semibold">{Math.round(report.metrics.score)}</span>
                    </div>
                  </div>
                  <div className="rounded-lg border p-4 col-span-1 md:col-span-2 lg:col-span-3">
                    <p className="text-sm text-gray-500 mb-2">Atividade Mensal</p>
                    <ChartContainer
                      config={{ activity: { label: "Cotações" } }}
                      className="w-full h-64"
                    >
                      <BarChart data={monthlyChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Bar dataKey="value" fill="#3b82f6" />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <ChartLegend content={<ChartLegendContent />} />
                      </BarChart>
                    </ChartContainer>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">Selecione um fornecedor para visualizar os indicadores</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Extrato de Cotações</CardTitle>
              <CardDescription>
                Todas as cotações realizadas com o fornecedor selecionado
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-6">
                  <RefreshCw className="w-6 h-6 animate-spin" />
                </div>
              ) : report && report.quotations.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>RFQ</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Enviado</TableHead>
                        <TableHead>Recebido</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Escolhido</TableHead>
                        <TableHead>Desconto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.quotations.map((q) => {
                        const subtotal = q.subtotalValue ? parseFloat(q.subtotalValue) : null;
                        const final = q.finalValue ? parseFloat(q.finalValue) : null;
                        const discountRate = subtotal && final && subtotal > 0 && final <= subtotal
                          ? (subtotal - final) / subtotal
                          : null;
                        return (
                          <TableRow key={q.id}>
                            <TableCell className="font-medium">{q.quotationNumber || q.quotationId}</TableCell>
                            <TableCell>
                              <Badge className={q.status === 'received' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                                {q.status || '—'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {q.sentAt ? format(new Date(q.sentAt), "dd/MM/yyyy HH:mm", { locale: ptBR }) : '—'}
                            </TableCell>
                            <TableCell>
                              {q.receivedAt ? format(new Date(q.receivedAt), "dd/MM/yyyy HH:mm", { locale: ptBR }) : '—'}
                            </TableCell>
                            <TableCell>{formatCurrency(q.adjustedTotal)}</TableCell>
                            <TableCell>
                              <Badge className={q.isChosen ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}>
                                {q.isChosen ? 'Sim' : 'Não'}
                              </Badge>
                            </TableCell>
                            <TableCell>{discountRate !== null ? toPercent(discountRate) : '—'}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">Nenhuma cotação encontrada para este fornecedor.</div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
