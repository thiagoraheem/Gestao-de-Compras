import { useState, useEffect, lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  LayoutGrid, 
  Rows3, 
  Search, 
  FilterX, 
  Clock, 
  CheckCircle2, 
  ShoppingCart, 
  DollarSign,
  Users,
  AlertTriangle,
  ArrowUpDown,
  FileText,
  Download,
  Building,
  Edit
} from "lucide-react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { URGENCY_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

// Lazy load the Quotation Phase component
const QuotationPhase = lazy(() => import("@/components/quotation-phase"));

export default function QuotationManagementPage() {
  // State
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");
  const [searchTerm, setSearchTerm] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  
  // Sorting state
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

  // Modal state
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Load view mode from local storage
  useEffect(() => {
    const savedViewMode = localStorage.getItem("quotationViewMode");
    if (savedViewMode === "cards" || savedViewMode === "list") {
      setViewMode(savedViewMode);
    }
  }, []);

  // Persist view mode
  const handleViewModeChange = (mode: "cards" | "list") => {
    setViewMode(mode);
    localStorage.setItem("quotationViewMode", mode);
  };

  // Data Fetching
  const { data: dashboardData, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/quotations/dashboard"],
    refetchInterval: 30000, // Real-time update every 30s
  });

  const { data: departments } = useQuery<any[]>({
    queryKey: ["/api/departments"],
  });

  const { data: suppliers } = useQuery<any[]>({
    queryKey: ["/api/suppliers"],
  });

  // Extract data
  const requests = dashboardData?.requests || [];
  const kpis = dashboardData?.kpis || {
    avgResponseTime: 0,
    responseRate: 0,
    conversionRate: 0,
    totalOpenValue: 0,
    avgSuppliers: 0
  };

  // Filter Logic
  const filteredRequests = requests.filter((r: any) => {
    const matchesSearch = 
      r.requestNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.justification?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.requesterName?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesUrgency = urgencyFilter === "all" || r.urgency === urgencyFilter;
    
    // Check if any supplier quotation matches the supplier filter
    // Or if filtered by department (using cost center mapping)
    const matchesDepartment = departmentFilter === "all" || r.departmentName === departmentFilter || r.costCenterId?.toString() === departmentFilter;
    
    // Supplier filter is tricky because we might not have supplier data directly on the request object 
    // in the way filters expect if no supplier is chosen yet.
    // Ideally we check if ANY supplier has been invited or responded.
    // For now, let's skip complex supplier filtering unless we fetch invited suppliers list.
    // Assuming simple filtering if implemented later.
    
    return matchesSearch && matchesUrgency && matchesDepartment;
  });

  // Sorting Logic
  const sortedRequests = [...filteredRequests].sort((a: any, b: any) => {
    if (!sortConfig) return 0;
    
    let aValue: any;
    let bValue: any;

    switch (sortConfig.key) {
      case 'requestNumber':
        aValue = a.requestNumber;
        bValue = b.requestNumber;
        break;
      case 'createdAt':
        aValue = new Date(a.createdAt).getTime();
        bValue = new Date(b.createdAt).getTime();
        break;
      case 'urgency':
        // Custom urgency sort
        const urgencyOrder = { 'alta_urgencia': 3, 'alto': 2, 'medio': 1, 'baixo': 0 };
        aValue = urgencyOrder[a.urgency as keyof typeof urgencyOrder] || 0;
        bValue = urgencyOrder[b.urgency as keyof typeof urgencyOrder] || 0;
        break;
      case 'quotationDeadline':
        aValue = a.quotationDeadline ? new Date(a.quotationDeadline).getTime() : 0;
        bValue = b.quotationDeadline ? new Date(b.quotationDeadline).getTime() : 0;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  const handleSort = (key: string) => {
    setSortConfig(current => {
      if (current?.key === key) {
        return current.direction === "asc" 
          ? { key, direction: "desc" } 
          : null;
      }
      return { key, direction: "asc" };
    });
  };

  const handleProcessQuotation = (request: any) => {
    setSelectedRequest(request);
    setModalOpen(true);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setUrgencyFilter("all");
    setSupplierFilter("all");
    setDepartmentFilter("all");
  };

  const hasActiveFilters = searchTerm || urgencyFilter !== "all" || supplierFilter !== "all" || departmentFilter !== "all";

  const handleExport = () => {
    if (sortedRequests.length === 0) return;

    const headers = ["Solicitação", "Data", "Solicitante", "Departamento", "Prioridade", "Fornecedores", "Respostas", "Prazo"];
    const csvContent = [
      headers.join(","),
      ...sortedRequests.map((r: any) => [
        r.requestNumber,
        format(new Date(r.createdAt), "dd/MM/yyyy"),
        `"${r.requesterName}"`,
        `"${r.departmentName}"`,
        URGENCY_LABELS[r.urgency as keyof typeof URGENCY_LABELS] || r.urgency,
        r.supplierCount,
        r.responseCount,
        r.quotationDeadline ? format(new Date(r.quotationDeadline), "dd/MM/yyyy") : ""
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `cotacoes_${format(new Date(), "yyyy-MM-dd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Formatter helpers
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatPercentage = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 }).format(value / 100);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="container mx-auto py-8 space-y-8">
        {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestão de Cotações</h1>
          <p className="text-muted-foreground">
            Painel de controle para compradores e analistas de suprimentos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            Atualizar
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={sortedRequests.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
        </div>
      </div>

      {/* KPI Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio Resposta</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.avgResponseTime.toFixed(1)}h</div>
            <p className="text-xs text-muted-foreground">por cotação enviada</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Resposta</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercentage(kpis.responseRate)}</div>
            <p className="text-xs text-muted-foreground">de fornecedores convidados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversão em Pedidos</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercentage(kpis.conversionRate)}</div>
            <p className="text-xs text-muted-foreground">das cotações iniciadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Volume em Aberto</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(kpis.totalOpenValue)}</div>
            <p className="text-xs text-muted-foreground">estimativa total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Média Fornecedores</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.avgSuppliers.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">por processo</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters & View Toggle */}
      <div className="flex flex-col md:flex-row gap-4 items-center bg-card p-4 rounded-lg border shadow-sm">
        <div className="flex-1 relative w-full md:w-auto">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por número, solicitante ou justificativa..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
          <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
            <SelectTrigger className="w-[180px]">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                <SelectValue placeholder="Prioridade" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Prioridades</SelectItem>
              {Object.entries(URGENCY_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-[180px]">
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4" />
                <SelectValue placeholder="Departamento" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Deptos</SelectItem>
              {departments?.map((dept: any) => (
                <SelectItem key={dept.id} value={dept.name}>{dept.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center border rounded-md overflow-hidden">
          <Button
            variant={viewMode === "cards" ? "default" : "ghost"}
            size="icon"
            onClick={() => handleViewModeChange("cards")}
            className="rounded-none h-9 w-9"
            title="Visualização em Cards"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <div className="w-[1px] h-full bg-border" />
          <Button
            variant={viewMode === "list" ? "default" : "ghost"}
            size="icon"
            onClick={() => handleViewModeChange("list")}
            className="rounded-none h-9 w-9"
            title="Visualização em Lista"
          >
            <Rows3 className="h-4 w-4" />
          </Button>
        </div>

        {hasActiveFilters && (
          <Button 
            variant="ghost" 
            size="icon"
            onClick={clearFilters}
            title="Limpar filtros"
            className="text-muted-foreground hover:text-foreground"
          >
            <FilterX className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Content Area */}
      {viewMode === "cards" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {sortedRequests.map((request: any) => (
            <Card key={request.id} className="flex flex-col h-full hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <Badge variant="outline" className="mb-2">
                    #{request.requestNumber}
                  </Badge>
                  <Badge className={cn(
                    request.urgency === 'alta_urgencia' ? "bg-red-500 hover:bg-red-600" :
                    request.urgency === 'alto' ? "bg-orange-500 hover:bg-orange-600" :
                    request.urgency === 'medio' ? "bg-yellow-500 hover:bg-yellow-600" :
                    "bg-green-500 hover:bg-green-600"
                  )}>
                    {URGENCY_LABELS[request.urgency as keyof typeof URGENCY_LABELS]}
                  </Badge>
                </div>
                <CardTitle className="text-base line-clamp-1" title={request.justification}>
                  {request.justification || "Sem justificativa"}
                </CardTitle>
                <CardDescription className="flex items-center gap-1 text-xs">
                  <Clock className="h-3 w-3" />
                  {format(new Date(request.createdAt), "dd/MM/yyyy HH:mm")}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col gap-4 text-sm">
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>
                    <span className="font-semibold block text-foreground">Solicitante:</span>
                    {request.requesterName}
                  </div>
                  <div>
                    <span className="font-semibold block text-foreground">Depto:</span>
                    {request.departmentName}
                  </div>
                </div>

                <div className="mt-auto pt-4 border-t flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {/* Avatars placeholder or supplier icons */}
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold border-2 border-background">
                        {request.supplierCount}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">Fornecedores</span>
                  </div>
                  <Button size="sm" onClick={() => handleProcessQuotation(request)}>
                    Gerenciar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="w-[100px] cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('requestNumber')}
                >
                  Número <ArrowUpDown className="ml-1 h-3 w-3 inline" />
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('createdAt')}
                >
                  Data <ArrowUpDown className="ml-1 h-3 w-3 inline" />
                </TableHead>
                <TableHead>Solicitante</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('urgency')}
                >
                  Prioridade <ArrowUpDown className="ml-1 h-3 w-3 inline" />
                </TableHead>
                <TableHead>Status Fornecedores</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRequests.map((request: any) => (
                <TableRow key={request.id}>
                  <TableCell className="font-medium">#{request.requestNumber}</TableCell>
                  <TableCell>{format(new Date(request.createdAt), "dd/MM/yyyy")}</TableCell>
                  <TableCell>{request.requesterName}</TableCell>
                  <TableCell>{request.departmentName}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(
                      request.urgency === 'alta_urgencia' ? "text-red-500 border-red-200 bg-red-50" :
                      request.urgency === 'alto' ? "text-orange-500 border-orange-200 bg-orange-50" :
                      request.urgency === 'medio' ? "text-yellow-500 border-yellow-200 bg-yellow-50" :
                      "text-green-500 border-green-200 bg-green-50"
                    )}>
                      {URGENCY_LABELS[request.urgency as keyof typeof URGENCY_LABELS]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {request.supplierCount} convidados
                      </Badge>
                      {request.responseCount > 0 && (
                        <Badge variant="default" className="text-xs bg-green-600 hover:bg-green-700">
                          {request.responseCount} respostas
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => handleProcessQuotation(request)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Gerenciar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Empty State */}
      {sortedRequests.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground border-2 border-dashed rounded-lg">
          <FileText className="h-12 w-12 mb-4 opacity-20" />
          <h3 className="text-lg font-medium">Nenhuma cotação encontrada</h3>
          <p className="max-w-sm mt-2">
            Não existem solicitações na fase de cotação correspondentes aos filtros selecionados.
          </p>
          {hasActiveFilters && (
            <Button variant="link" onClick={clearFilters} className="mt-4">
              Limpar todos os filtros
            </Button>
          )}
        </div>
      )}

      {/* Management Modal */}
      {selectedRequest && (
        <Suspense fallback={<div className="h-full flex items-center justify-center">Carregando...</div>}>
          <QuotationPhase 
            request={selectedRequest} 
            open={modalOpen} 
            onOpenChange={setModalOpen} 
          />
        </Suspense>
      )}
      </div>
    </div>
  );
}