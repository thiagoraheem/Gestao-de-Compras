import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Filter,
  Search,
  Calendar,
  User,
  Building2,
  FileText,
  Eye,
  RefreshCw,
  Truck,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateInput } from "@/components/ui/date-input";
import { formatCurrency } from "@/lib/currency";

interface PurchaseRequest {
  id: number;
  requestNumber: string;
  description: string;
  requestDate: string;
  requesterName: string;
  departmentName: string;
  supplierName: string;
  phase: string;
  totalValue: number;
  originalValue: number | null;
  discount: number | null;
  urgency: string;
  approverA1Name: string;
  approverA2Name: string;
  items: PurchaseRequestItem[];
  approvals: Approval[];
  quotations: Quotation[];
  purchaseOrders: PurchaseOrder[];
}

interface PurchaseRequestItem {
  id: number;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number | null;
  totalPrice: number | null;
}

interface Approval {
  id: number;
  level: string;
  status: string;
  approverName: string;
  approvalDate: string;
  comments?: string;
}

interface Quotation {
  id: number;
  supplierName: string;
  totalValue: number;
  status: string;
  submissionDate: string;
}

interface PurchaseOrder {
  id: number;
  orderNumber: string;
  supplierName: string;
  totalValue: number;
  status: string;
  orderDate: string;
}

interface Department {
  id: number;
  name: string;
}

interface User {
  id: number;
  firstName: string;
  lastName: string;
}

const phaseColors = {
  "Aguardando Aprovação A1": "bg-yellow-500/15 text-yellow-700 dark:bg-yellow-400/20 dark:text-yellow-200",
  "Aguardando Aprovação A2": "bg-orange-500/15 text-orange-700 dark:bg-orange-400/20 dark:text-orange-200",
  "Aprovado - Aguardando Cotação": "bg-blue-500/15 text-blue-700 dark:bg-blue-400/20 dark:text-blue-200",
  "Em Cotação": "bg-purple-500/15 text-purple-700 dark:bg-purple-400/20 dark:text-purple-200",
  "Cotação Recebida": "bg-indigo-500/15 text-indigo-700 dark:bg-indigo-400/20 dark:text-indigo-200",
  "Pedido Gerado": "bg-green-500/15 text-green-700 dark:bg-green-400/20 dark:text-green-200",
  Concluído: "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-200",
  Rejeitado: "bg-red-500/15 text-red-700 dark:bg-red-400/20 dark:text-red-200",
};

const urgencyColors = {
  baixa: "bg-muted text-muted-foreground",
  medio: "bg-yellow-500/15 text-yellow-700 dark:bg-yellow-400/20 dark:text-yellow-200",
  alto: "bg-orange-500/15 text-orange-700 dark:bg-orange-400/20 dark:text-orange-200",
  alta_urgencia: "bg-red-500/15 text-red-700 dark:bg-red-400/20 dark:text-red-200",
};

const urgencyLabels = {
  baixa: "Baixa",
  medio: "Média",
  alto: "Alta",
  alta_urgencia: "Crítica",
};

export default function PurchaseRequestsReport() {
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    departmentId: "all",
    requesterId: "all",
    supplierId: "all",
    phase: "all",
    urgency: "all",
  });

  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch purchase requests with filters
  const {
    data: requests = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["purchase-requests-report", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== "all") params.append(key, value);
      });
      if (searchTerm) params.append("search", searchTerm);

      return apiRequest(`/api/reports/purchase-requests?${params}`);
    },
    staleTime: 30000, // Cache for 30 seconds
    gcTime: 300000, // Keep in cache for 5 minutes
  });

  // Fetch departments for filter
  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => apiRequest("/api/departments"),
  });

  // Fetch users for filter
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiRequest("/api/users"),
  });

  // Get unique suppliers from requests for filter
  const uniqueSuppliers = useMemo(() => {
    const suppliers = new Set<string>();
    requests.forEach((request: PurchaseRequest) => {
      if (request.supplierName && request.supplierName !== "N/A") {
        suppliers.add(request.supplierName);
      }
    });
    return Array.from(suppliers).sort();
  }, [requests]);

  // Calculate totals for filtered requests
  const totals = useMemo(() => {
    return requests.reduce(
      (acc: any, request: PurchaseRequest) => {
        acc.originalValue += request.originalValue || 0;
        acc.discount += request.discount || 0;
        acc.totalValue += request.totalValue || 0;
        return acc;
      },
      { originalValue: 0, discount: 0, totalValue: 0 }
    );
  }, [requests]);

  const toggleRowExpansion = (requestId: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(requestId)) {
      newExpanded.delete(requestId);
    } else {
      newExpanded.add(requestId);
    }
    setExpandedRows(newExpanded);
  };

  const exportToCSV = () => {
    // Function to safely escape CSV fields and handle line breaks
    const escapeCsvField = (field: string | number | null): string => {
      if (field === null || field === undefined) return "N/A";
      
      let stringField = String(field);
      
      // Replace line breaks with spaces to prevent CSV corruption
      stringField = stringField.replace(/[\r\n]+/g, ' ');
      
      // Replace multiple spaces with single space and trim
      stringField = stringField.replace(/\s+/g, ' ').trim();
      
      // If field contains semicolon, quotes, or was originally multiline, wrap in quotes
      if (stringField.includes(';') || stringField.includes('"') || String(field).includes('\n')) {
        // Escape existing quotes by doubling them
        stringField = stringField.replace(/"/g, '""');
        return `"${stringField}"`;
      }
      
      return stringField;
    };

    // Function to format currency values for CSV
    const formatCurrencyForCSV = (value: number | null): string => {
      if (!value || value === 0) return "R$ 0,00";
      return value.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    };

    const csvRows = [
      // Header with proper encoding
      [
        "Número",
        "Descrição", 
        "Data",
        "Solicitante",
        "Departamento",
        "Fornecedor",
        "Fase",
        "Valor Original",
        "Desconto",
        "Valor Total",
        "Urgência"
      ].join(";")
    ];

    // Data rows with proper escaping and encoding
    requests.forEach((request: PurchaseRequest) => {
      const row = [
        escapeCsvField(request.requestNumber),
        escapeCsvField(request.description),
        escapeCsvField(format(new Date(request.requestDate), "dd/MM/yyyy")),
        escapeCsvField(request.requesterName),
        escapeCsvField(request.departmentName),
        escapeCsvField(request.supplierName || "N/A"),
        escapeCsvField(request.phase),
        escapeCsvField(formatCurrencyForCSV(request.originalValue)),
        escapeCsvField(formatCurrencyForCSV(request.discount)),
        escapeCsvField(formatCurrencyForCSV(request.totalValue)),
        escapeCsvField(urgencyLabels[request.urgency as keyof typeof urgencyLabels] || request.urgency)
      ].join(";");
      
      csvRows.push(row);
    });

    // Add totals row
    csvRows.push([
      "TOTAL",
      "",
      "",
      "",
      "",
      "",
      "",
      escapeCsvField(formatCurrencyForCSV(totals.originalValue)),
      escapeCsvField(formatCurrencyForCSV(totals.discount)),
      escapeCsvField(formatCurrencyForCSV(totals.totalValue)),
      ""
    ].join(";"));

    const csvContent = csvRows.join("\n");

    // Create blob with UTF-8 BOM for proper encoding in Excel
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { 
      type: "text/csv;charset=utf-8;" 
    });
    
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `relatorio-solicitacoes-${format(new Date(), "yyyy-MM-dd")}_${Date.now()}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setFilters({
      startDate: "",
      endDate: "",
      departmentId: "all",
      requesterId: "all",
      supplierId: "all",
      phase: "all",
      urgency: "all",
    });
    setSearchTerm("");
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Relatório de Solicitações de Compra
          </h1>
          <p className="text-muted-foreground mt-1">
            Visualize e analise todas as solicitações de compra do sistema
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
          <Button onClick={exportToCSV} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtros
          </CardTitle>
          <CardDescription>
            Use os filtros abaixo para refinar os resultados do relatório
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* Search */}
            <div className="space-y-2">
              <Label htmlFor="search">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Número, descrição..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Date Range */}
            <div className="space-y-2">
              <Label htmlFor="startDate">Data Inicial</Label>
              <DateInput
                value={filters.startDate}
                onChange={(value) =>
                  setFilters((prev) => ({ ...prev, startDate: value }))
                }
                placeholder="DD/MM/AAAA"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">Data Final</Label>
              <DateInput
                value={filters.endDate}
                onChange={(value) =>
                  setFilters((prev) => ({ ...prev, endDate: value }))
                }
                placeholder="DD/MM/AAAA"
              />
            </div>

            {/* Department Filter */}
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Select
                value={filters.departmentId}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, departmentId: value }))
                }
              >
                <SelectTrigger>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <SelectValue placeholder="Todos os departamentos" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os departamentos</SelectItem>
                  {departments.map((dept: Department) => (
                    <SelectItem key={dept.id} value={dept.id.toString()}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Requester Filter */}
            <div className="space-y-2">
              <Label>Solicitante</Label>
              <Select
                value={filters.requesterId}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, requesterId: value }))
                }
              >
                <SelectTrigger>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <SelectValue placeholder="Todos os solicitantes" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os solicitantes</SelectItem>
                  {users.map((user: User) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.firstName} {user.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Supplier Filter */}
            <div className="space-y-2">
              <Label>Fornecedor</Label>
              <Select
                value={filters.supplierId}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, supplierId: value }))
                }
              >
                <SelectTrigger>
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-muted-foreground" />
                    <SelectValue placeholder="Todos os fornecedores" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os fornecedores</SelectItem>
                  {uniqueSuppliers.map((supplier) => (
                    <SelectItem key={supplier} value={supplier}>
                      {supplier}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Phase Filter */}
            <div className="space-y-2">
              <Label>Fase</Label>
              <Select
                value={filters.phase}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, phase: value }))
                }
              >
                <SelectTrigger>
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <SelectValue placeholder="Todas as fases" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as fases</SelectItem>
                  <SelectItem value="solicitacao">Solicitação</SelectItem>
                  <SelectItem value="aprovacao_a1">Aprovação A1</SelectItem>
                  <SelectItem value="cotacao">Cotação</SelectItem>
                  <SelectItem value="aprovacao_a2">Aprovação A2</SelectItem>
                  <SelectItem value="pedido_compra">
                    Pedido de Compra
                  </SelectItem>
                  <SelectItem value="conclusao_compra">Conclusão</SelectItem>
                  <SelectItem value="recebimento">Recebimento</SelectItem>
                  <SelectItem value="arquivado">Arquivado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Urgency Filter */}
            <div className="space-y-2">
              <Label>Urgência</Label>
              <Select
                value={filters.urgency}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, urgency: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas as urgências" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as urgências</SelectItem>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="medio">Média</SelectItem>
                  <SelectItem value="alto">Alta</SelectItem>
                  <SelectItem value="alta_urgencia">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Clear Filters Button */}
            <div className="flex items-end">
              <Button
                onClick={clearFilters}
                variant="outline"
                className="w-full"
              >
                Limpar Filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle>Resultados</CardTitle>
          <CardDescription>
            {isLoading
              ? "Carregando..."
              : `${requests.length} solicitação(ões) encontrada(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Número</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Solicitante</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Fase</TableHead>
                    <TableHead>Valor Original</TableHead>
                    <TableHead>Desconto</TableHead>
                    <TableHead>Valor Total</TableHead>
                    <TableHead>Urgência</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request: PurchaseRequest) => (
                    <React.Fragment key={request.id}>
                      <TableRow
                        className="cursor-pointer hover:bg-accent hover:text-accent-foreground"
                      >
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleRowExpansion(request.id)}
                          >
                            {expandedRows.has(request.id) ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="font-medium">
                          {request.requestNumber}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {request.description}
                        </TableCell>
                        <TableCell>
                          {format(new Date(request.requestDate), "dd/MM/yyyy", {
                            locale: ptBR,
                          })}
                        </TableCell>
                        <TableCell>{request.requesterName}</TableCell>
                        <TableCell>{request.departmentName}</TableCell>
                        <TableCell>{request.supplierName}</TableCell>
                        <TableCell>
                          <Badge
                            className={
                              phaseColors[
                                request.phase as keyof typeof phaseColors
                              ] || "bg-gray-100 text-gray-800"
                            }
                          >
                            {request.phase}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {request.originalValue ? formatCurrency(request.originalValue) : "N/A"}
                        </TableCell>
                        <TableCell>
                          {request.discount ? formatCurrency(request.discount) : "N/A"}
                        </TableCell>
                        <TableCell>
                          {formatCurrency(request.totalValue)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              urgencyColors[
                                request.urgency as keyof typeof urgencyColors
                              ] || "bg-gray-100 text-gray-800"
                            }
                          >
                            {urgencyLabels[request.urgency as keyof typeof urgencyLabels] || request.urgency}
                          </Badge>
                        </TableCell>
                      </TableRow>

                      {/* Expanded Row Content */}
                      {expandedRows.has(request.id) && (
                        <TableRow>
                          <TableCell colSpan={12} className="bg-muted p-6">
                            <div className="space-y-6">
                              {/* Approval Information */}
                              <div>
                                <h4 className="font-semibold mb-3 flex items-center gap-2">
                                  <User className="w-4 h-4" />
                                  Aprovação
                                </h4>
                                <div className="bg-card rounded-lg border border-border p-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <p className="text-sm font-medium text-muted-foreground mb-1">
                                        Aprovador A1
                                      </p>
                                      <p className="text-sm font-semibold">
                                        {request.approverA1Name}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium text-muted-foreground mb-1">
                                        Aprovador A2
                                      </p>
                                      <p className="text-sm font-semibold">
                                        {request.approverA2Name}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Items */}
                              <div>
                                <h4 className="font-semibold mb-3 flex items-center gap-2">
                                  <FileText className="w-4 h-4" />
                                  Itens da Solicitação
                                </h4>
                                <div className="bg-card rounded-lg border border-border">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Descrição</TableHead>
                                        <TableHead>Quantidade</TableHead>
                                        <TableHead>Unidade</TableHead>
                                        <TableHead>Valor do Item</TableHead>
                                        <TableHead>Valor Total</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {request.items?.map((item) => (
                                        <TableRow key={item.id}>
                                          <TableCell>
                                            {item.description}
                                          </TableCell>
                                          <TableCell>{item.quantity}</TableCell>
                                          <TableCell>{item.unit}</TableCell>
                                          <TableCell>
                                            {item.unitPrice ? formatCurrency(item.unitPrice) : "N/A"}
                                          </TableCell>
                                          <TableCell>
                                            {item.totalPrice ? formatCurrency(item.totalPrice) : "N/A"}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>

                              {/* Approvals */}
                              {request.approvals &&
                                request.approvals.length > 0 && (
                                  <div>
                                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                                      <Eye className="w-4 h-4" />
                                      Aprovações
                                    </h4>
                                    <div className="bg-card rounded-lg border border-border">
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead>Nível</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Aprovador</TableHead>
                                            <TableHead>Data</TableHead>
                                            <TableHead>Comentários</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {request.approvals.map((approval) => (
                                            <TableRow key={approval.id}>
                                              <TableCell>
                                                {approval.level}
                                              </TableCell>
                                              <TableCell>
                                                <Badge
                                                  className={
                                                    approval.status ===
                                                    "Aprovado"
                                                      ? "bg-green-500/15 text-green-700 dark:bg-green-400/20 dark:text-green-200"
                                                      : "bg-red-500/15 text-red-700 dark:bg-red-400/20 dark:text-red-200"
                                                  }
                                                >
                                                  {approval.status}
                                                </Badge>
                                              </TableCell>
                                              <TableCell>
                                                {approval.approverName}
                                              </TableCell>
                                              <TableCell>
                                                {format(
                                                  new Date(
                                                    approval.approvalDate,
                                                  ),
                                                  "dd/MM/yyyy HH:mm",
                                                  { locale: ptBR },
                                                )}
                                              </TableCell>
                                              <TableCell>
                                                {approval.comments || "-"}
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </div>
                                )}

                              {/* Quotations */}
                              {request.quotations &&
                                request.quotations.length > 0 && (
                                  <div>
                                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                                      <FileText className="w-4 h-4" />
                                      Cotações
                                    </h4>
                                    <div className="bg-card rounded-lg border border-border">
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead>Fornecedor</TableHead>
                                            <TableHead>Valor Total</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Data de Envio</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {request.quotations.map(
                                            (quotation) => (
                                              <TableRow key={quotation.id}>
                                                <TableCell>
                                                  {quotation.supplierName}
                                                </TableCell>
                                                <TableCell>
                                                  {formatCurrency(
                                                    quotation.totalValue,
                                                  )}
                                                </TableCell>
                                                <TableCell>
                                                <Badge
                                                    className={
                                                      quotation.status ===
                                                      "Enviada"
                                                        ? "bg-green-500/15 text-green-700 dark:bg-green-400/20 dark:text-green-200"
                                                        : "bg-yellow-500/15 text-yellow-700 dark:bg-yellow-400/20 dark:text-yellow-200"
                                                    }
                                                  >
                                                    {quotation.status}
                                                  </Badge>
                                                </TableCell>
                                                <TableCell>
                                                  {format(
                                                    new Date(
                                                      quotation.submissionDate,
                                                    ),
                                                    "dd/MM/yyyy HH:mm",
                                                    { locale: ptBR },
                                                  )}
                                                </TableCell>
                                              </TableRow>
                                            ),
                                          )}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </div>
                                )}

                              {/* Purchase Orders */}
                              {request.purchaseOrders &&
                                request.purchaseOrders.length > 0 && (
                                  <div>
                                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                                      <FileText className="w-4 h-4" />
                                      Pedidos de Compra
                                    </h4>
                                    <div className="bg-card rounded-lg border border-border">
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead>
                                              Número do Pedido
                                            </TableHead>
                                            <TableHead>Fornecedor</TableHead>
                                            <TableHead>Valor Total</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>
                                              Data do Pedido
                                            </TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {request.purchaseOrders.map(
                                            (order) => (
                                              <TableRow key={order.id}>
                                                <TableCell className="font-medium">
                                                  {order.orderNumber}
                                                </TableCell>
                                                <TableCell>
                                                  {order.supplierName}
                                                </TableCell>
                                                <TableCell>
                                                  {formatCurrency(
                                                    order.totalValue,
                                                  )}
                                                </TableCell>
                                                <TableCell>
                                                <Badge
                                                    className={
                                                      order.status === "Enviado"
                                                        ? "bg-green-500/15 text-green-700 dark:bg-green-400/20 dark:text-green-200"
                                                        : "bg-yellow-500/15 text-yellow-700 dark:bg-yellow-400/20 dark:text-yellow-200"
                                                    }
                                                  >
                                                    {order.status}
                                                  </Badge>
                                                </TableCell>
                                                <TableCell>
                                                  {format(
                                                    new Date(order.orderDate),
                                                    "dd/MM/yyyy HH:mm",
                                                    { locale: ptBR },
                                                  )}
                                                </TableCell>
                                              </TableRow>
                                            ),
                                          )}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </div>
                                )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}

                  {/* Totals Row */}
                  {requests.length > 0 && (
                    <TableRow className="bg-muted font-semibold border-t border-border">
                      <TableCell></TableCell>
                      <TableCell className="font-bold">TOTAL</TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell className="font-bold">
                        {formatCurrency(totals.originalValue)}
                      </TableCell>
                      <TableCell className="font-bold">
                        {formatCurrency(totals.discount)}
                      </TableCell>
                      <TableCell className="font-bold">
                        {formatCurrency(totals.totalValue)}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {requests.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground/60" />
                  <p>
                    Nenhuma solicitação encontrada com os filtros aplicados.
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
