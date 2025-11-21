import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  TrendingUp,
  DollarSign,
  Clock,
  CheckCircle,
  FileText,
  Users,
  Building,
  Calendar,
  Download,
  RefreshCw,
  Zap,
  Target,
} from "lucide-react";
import { useState, useEffect } from "react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/currency";
import debug from "@/lib/debug";
import { DateInput } from "@/components/ui/date-input";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

interface DashboardData {
  totalActiveRequests: number;
  totalProcessingValue: number;
  averageApprovalTime: number;
  approvalRate: number;
  requestsByDepartment: { name: string; value: number }[];
  monthlyTrend: { month: string; requests: number }[];
  urgencyDistribution: { name: string; value: number }[];
  phaseConversion: { name: string; value: number }[];
  topDepartments: { name: string; totalValue: number; requestCount: number }[];
  topSuppliers: { name: string; requestCount: number; totalValue: number }[];
  delayedRequests: {
    id: number;
    requestNumber: string;
    phase: string;
    daysDelayed: number;
  }[];
  costCenterSummary: {
    name: string;
    totalValue: number;
    requestCount: number;
  }[];
  // New procurement KPIs
  costSavings: number;
  valueSaved: number;
  spendUnderManagement: number;
  contractCompliance: number;
  slaCompliance: number;
  averagePurchaseOrderValue: number;
  supplierPerformance: {
    onTimeDelivery: number;
    qualityScore: number;
    responseTime: number;
  };
  budgetAnalysis: {
    plannedBudget: number;
    actualSpend: number;
    variance: number;
    utilizationRate: number;
  };
  riskAnalysis: {
    highRiskSuppliers: number;
    criticalItems: number;
    singleSourceItems: number;
    riskScore: string;
  };
  procurementEfficiency: {
    avgProcessingTime: number;
    automationRate: number;
    digitalAdoption: number;
  };
}

export default function Dashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState("30");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dateFilterType, setDateFilterType] = useState("created");

  // Automatically update dates when period changes
  useEffect(() => {
    const today = new Date();
    const daysAgo = parseInt(selectedPeriod);
    const calculatedStartDate = subDays(today, daysAgo);

    setStartDate(format(calculatedStartDate, "yyyy-MM-dd"));
    setEndDate(format(today, "yyyy-MM-dd"));
  }, [selectedPeriod]);

  const {
    data: dashboardData,
    isLoading,
    refetch,
  } = useQuery<DashboardData>({
    queryKey: [
      `/api/dashboard?period=${selectedPeriod}&department=${selectedDepartment}&status=${selectedStatus}&startDate=${startDate}&endDate=${endDate}&dateFilterType=${dateFilterType}`,
    ],
  });

  const { data: departments } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["/api/departments"],
  });

  const handleExportPDF = async () => {
    try {
      const response = await fetch(
        `/api/dashboard/export-pdf?period=${selectedPeriod}&department=${selectedDepartment}&status=${selectedStatus}&startDate=${startDate}&endDate=${endDate}&dateFilterType=${dateFilterType}`,
        {
          method: "GET",
        },
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        a.download = `dashboard-executivo-${new Date().toISOString().split("T")[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        debug.error("Failed to export PDF");
      }
    } catch (error) {
      debug.error("Error exporting PDF:", error);
    }
  };

  const getStatusColor = (
    value: number,
    thresholds: { green: number; yellow: number },
  ) => {
    if (value >= thresholds.green) return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300";
    if (value >= thresholds.yellow) return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300";
    return "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300";
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-2">
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-8 bg-gray-200 rounded w-3/4"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Dashboard Executivo
            </h1>
            <p className="text-gray-600 mt-1">
              Visão gerencial completa do processo de compras
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-end sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
            <Button onClick={() => refetch()} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
            <Button onClick={handleExportPDF} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Exportar PDF
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger>
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="60">Últimos 60 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="180">Últimos 6 meses</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex flex-col space-y-1">
            <DateInput
              value={startDate}
              onChange={setStartDate}
              placeholder="DD/MM/AAAA"
              data-testid="input-start-date"
            />
          </div>

          <div className="flex flex-col space-y-1">
            <DateInput
              value={endDate}
              onChange={setEndDate}
              placeholder="DD/MM/AAAA"
              data-testid="input-end-date"
            />
          </div>

          <Select
            value={dateFilterType}
            onValueChange={setDateFilterType}
          >
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por Data" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created">Data de Criação</SelectItem>
              <SelectItem value="completion">Data de Conclusão</SelectItem>
              <SelectItem value="both">Ambas as Datas</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={selectedDepartment}
            onValueChange={setSelectedDepartment}
          >
            <SelectTrigger>
              <SelectValue placeholder="Departamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Departamentos</SelectItem>
              {departments?.map((dept) => (
                <SelectItem key={dept.id} value={dept.id.toString()}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Status</SelectItem>
              <SelectItem value="solicitacao">Solicitação</SelectItem>
              <SelectItem value="aprovacao_a1">Aprovação A1</SelectItem>
              <SelectItem value="cotacao">Cotação</SelectItem>
              <SelectItem value="aprovacao_a2">Aprovação A2</SelectItem>
              <SelectItem value="pedido_compra">Pedido de Compra</SelectItem>
              <SelectItem value="conclusao_compra">Conclusão</SelectItem>
              <SelectItem value="recebimento">Recebimento</SelectItem>
              <SelectItem value="arquivado">Arquivado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Solicitações Ativas
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboardData?.totalActiveRequests || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                No período selecionado
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Valor em Processamento
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(dashboardData?.totalProcessingValue || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                Valor total das solicitações ativas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Valor Economizado
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(dashboardData?.valueSaved || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                Economia através de descontos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Tempo Médio de Aprovação
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboardData?.averageApprovalTime || 0} dias
              </div>
              <Badge
                className={getStatusColor(
                  dashboardData?.averageApprovalTime || 0,
                  { green: 7, yellow: 14 },
                )}
              >
                {(dashboardData?.averageApprovalTime || 0) <= 7
                  ? "Excelente"
                  : (dashboardData?.averageApprovalTime || 0) <= 14
                    ? "Bom"
                    : "Precisa melhorar"}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Taxa de Aprovação
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboardData?.approvalRate || 0}%
              </div>
              <Badge
                className={getStatusColor(dashboardData?.approvalRate || 0, {
                  green: 85,
                  yellow: 70,
                })}
              >
                {(dashboardData?.approvalRate || 0) >= 85
                  ? "Excelente"
                  : (dashboardData?.approvalRate || 0) >= 70
                    ? "Bom"
                    : "Precisa melhorar"}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Compliance SLA
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboardData?.slaCompliance || 0}%
              </div>
              <Badge
                className={getStatusColor(dashboardData?.slaCompliance || 0, {
                  green: 85,
                  yellow: 70,
                })}
              >
                {(dashboardData?.slaCompliance || 0) >= 85
                  ? "Excelente"
                  : (dashboardData?.slaCompliance || 0) >= 70
                    ? "Bom"
                    : "Precisa melhorar"}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Gestão de Contratos
              </CardTitle>
              <Building className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboardData?.contractCompliance || 0}%
              </div>
              <p className="text-xs text-muted-foreground">
                Compras com contrato
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="trends">Tendências</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="details">Detalhes</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Solicitações por Departamento</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={dashboardData?.requestsByDepartment || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#0088FE" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Distribuição por Urgência</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={dashboardData?.urgencyDistribution || []}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) =>
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {(dashboardData?.urgencyDistribution || []).map(
                          (entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ),
                        )}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="trends" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Evolução Temporal (6 meses)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={dashboardData?.monthlyTrend || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="requests"
                        stroke="#0088FE"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Funil de Conversão por Fase</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={dashboardData?.phaseConversion || []}
                      layout="horizontal"
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={100} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#00C49F" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Procurement Efficiency Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle>Eficiência do Processo</CardTitle>
                  <CardDescription>
                    Métricas de otimização operacional
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Clock className="h-4 w-4 text-blue-500" />
                        <span className="font-medium">
                          Tempo Médio de Processamento
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">
                          {dashboardData?.procurementEfficiency
                            ?.avgProcessingTime || 0}{" "}
                          dias
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        <span className="font-medium">Taxa de Automação</span>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">
                          {dashboardData?.procurementEfficiency
                            ?.automationRate || 0}
                          %
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <FileText className="h-4 w-4 text-purple-500" />
                        <span className="font-medium">Adoção Digital</span>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">
                          {dashboardData?.procurementEfficiency
                            ?.digitalAdoption || 0}
                          %
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Supplier Performance */}
              <Card>
                <CardHeader>
                  <CardTitle>Performance de Fornecedores</CardTitle>
                  <CardDescription>
                    Métricas de qualidade e entrega
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="font-medium">Entrega no Prazo</span>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">
                          {dashboardData?.supplierPerformance?.onTimeDelivery ||
                            0}
                          %
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Users className="h-4 w-4 text-blue-500" />
                        <span className="font-medium">Score de Qualidade</span>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">
                          {dashboardData?.supplierPerformance?.qualityScore ||
                            0}
                          %
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Calendar className="h-4 w-4 text-orange-500" />
                        <span className="font-medium">Tempo de Resposta</span>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">
                          {dashboardData?.supplierPerformance?.responseTime ||
                            0}{" "}
                          dias
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Economy and Efficiency Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle>Análise de Economia e Eficiência</CardTitle>
                  <CardDescription>
                    Métricas de economia e eficiência operacional
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <DollarSign className="h-4 w-4 text-green-500" />
                        <span className="font-medium">Economia Gerada</span>
                      </div>
                      <span className="font-semibold text-green-600">
                        {formatCurrency(dashboardData?.valueSaved || 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Zap className="h-4 w-4 text-blue-500" />
                        <span className="font-medium">Taxa de Automação</span>
                      </div>
                      <Badge
                        className={getStatusColor(
                          dashboardData?.procurementEfficiency?.automationRate || 0,
                          { green: 80, yellow: 60 },
                        )}
                      >
                        {dashboardData?.procurementEfficiency?.automationRate || 0}%
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Clock className="h-4 w-4 text-orange-500" />
                        <span className="font-medium">Tempo Médio Processamento</span>
                      </div>
                      <span className="font-semibold">
                        {dashboardData?.procurementEfficiency?.avgProcessingTime || 0} dias
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Target className="h-4 w-4 text-purple-500" />
                        <span className="font-medium">Adoção Digital</span>
                      </div>
                      <Badge
                        className={getStatusColor(
                          dashboardData?.procurementEfficiency?.digitalAdoption || 0,
                          { green: 85, yellow: 70 },
                        )}
                      >
                        {dashboardData?.procurementEfficiency?.digitalAdoption || 0}%
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Risk Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle>Análise de Riscos</CardTitle>
                  <CardDescription>
                    Identificação e monitoramento de riscos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        Fornecedores de Alto Risco
                      </span>
                      <Badge variant="destructive">
                        {dashboardData?.riskAnalysis?.highRiskSuppliers || 0}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Itens Críticos</span>
                      <Badge variant="outline">
                        {dashboardData?.riskAnalysis?.criticalItems || 0}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Fonte Única</span>
                      <Badge variant="secondary">
                        {dashboardData?.riskAnalysis?.singleSourceItems || 0}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Score de Risco Geral</span>
                      <Badge
                        className={
                          dashboardData?.riskAnalysis?.riskScore === "Alto"
                            ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300"
                            : dashboardData?.riskAnalysis?.riskScore === "Médio"
                              ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300"
                              : "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                        }
                      >
                        {dashboardData?.riskAnalysis?.riskScore || "Baixo"}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="details" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Solicitações em Atraso</CardTitle>
                  <CardDescription>
                    Solicitações que ultrapassaram o SLA
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {dashboardData?.delayedRequests?.map((request) => (
                      <div
                        key={request.id}
                        className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/10 rounded-lg"
                      >
                        <div>
                          <div className="font-medium">
                            {request.requestNumber}
                          </div>
                          <div className="text-sm text-gray-600">
                            {request.phase}
                          </div>
                        </div>
                        <Badge variant="destructive">
                          {request.daysDelayed} dias de atraso
                        </Badge>
                      </div>
                    ))}
                    {(!dashboardData?.delayedRequests ||
                      dashboardData.delayedRequests.length === 0) && (
                        <div className="text-center py-8 text-gray-500">
                          Nenhuma solicitação em atraso
                        </div>
                      )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Resumo por Centro de Custo</CardTitle>
                  <CardDescription>
                    Análise de gastos por centro de custo
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {dashboardData?.costCenterSummary?.map((center) => (
                      <div
                        key={center.name}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-3">
                          <Building className="h-4 w-4 text-gray-400" />
                          <span className="font-medium">{center.name}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">
                            {formatCurrency(center.totalValue)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {center.requestCount} solicitações
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top 5 Departamentos</CardTitle>
                  <CardDescription>Por volume de compras</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {dashboardData?.topDepartments?.map((dept, index) => (
                      <div
                        key={dept.name}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-3">
                          <span className="text-sm font-medium text-gray-500">
                            #{index + 1}
                          </span>
                          <span className="font-medium">{dept.name}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">
                            {formatCurrency(dept.totalValue)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {dept.requestCount} solicitações
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Fornecedores Mais Utilizados</CardTitle>
                  <CardDescription>Por número de solicitações</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {dashboardData?.topSuppliers?.map((supplier, index) => (
                      <div
                        key={supplier.name}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-3">
                          <span className="text-sm font-medium text-gray-500">
                            #{index + 1}
                          </span>
                          <span className="font-medium">{supplier.name}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">
                            {supplier.requestCount} solicitações
                          </div>
                          <div className="text-sm text-gray-500">
                            {formatCurrency(supplier.totalValue)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
