import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
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
  RefreshCw
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateInput } from "@/components/ui/date-input";

interface PurchaseRequest {
  id: number;
  requestNumber: string;
  description: string;
  requestDate: string;
  requesterName: string;
  departmentName: string;
  phase: string;
  totalValue: number;
  urgency: string;
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
  estimatedPrice: number;
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
  "Aguardando Aprovação A1": "bg-yellow-100 text-yellow-800",
  "Aguardando Aprovação A2": "bg-orange-100 text-orange-800",
  "Aprovado - Aguardando Cotação": "bg-blue-100 text-blue-800",
  "Em Cotação": "bg-purple-100 text-purple-800",
  "Cotação Recebida": "bg-indigo-100 text-indigo-800",
  "Pedido Gerado": "bg-green-100 text-green-800",
  "Concluído": "bg-emerald-100 text-emerald-800",
  "Rejeitado": "bg-red-100 text-red-800"
};

const urgencyColors = {
  "Baixa": "bg-gray-100 text-gray-800",
  "Média": "bg-yellow-100 text-yellow-800",
  "Alta": "bg-orange-100 text-orange-800",
  "Crítica": "bg-red-100 text-red-800"
};

export default function PurchaseRequestsReport() {
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    departmentId: "all",
    requesterId: "all",
    phase: "all",
    urgency: "all"
  });
  
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch purchase requests with filters
  const { data: requests = [], isLoading, refetch } = useQuery({
    queryKey: ["purchase-requests-report", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== "all") params.append(key, value);
      });
      if (searchTerm) params.append("search", searchTerm);
      
      return apiRequest(`/api/reports/purchase-requests?${params}`);
    }
  });

  // Fetch departments for filter
  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => apiRequest("/api/departments")
  });

  // Fetch users for filter
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiRequest("/api/users")
  });

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
    const csvContent = [
      // Header
      [
        "Número",
        "Descrição", 
        "Data",
        "Solicitante",
        "Departamento",
        "Fase",
        "Valor Total",
        "Urgência"
      ].join(","),
      // Data rows
      ...requests.map((request: PurchaseRequest) => [
        request.requestNumber,
        `"${request.description}"`,
        format(new Date(request.requestDate), "dd/MM/yyyy"),
        request.requesterName,
        request.departmentName,
        request.phase,
        request.totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
        request.urgency
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio-solicitacoes-${format(new Date(), "yyyy-MM-dd")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearFilters = () => {
    setFilters({
      startDate: "",
      endDate: "",
      departmentId: "all",
      requesterId: "all",
      phase: "all",
      urgency: "all"
    });
    setSearchTerm("");
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Relatório de Solicitações de Compra</h1>
          <p className="text-gray-600 mt-1">Visualize e analise todas as solicitações de compra do sistema</p>
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
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
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
                onChange={(value) => setFilters(prev => ({ ...prev, startDate: value }))}
                placeholder="DD/MM/AAAA"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">Data Final</Label>
              <DateInput
                value={filters.endDate}
                onChange={(value) => setFilters(prev => ({ ...prev, endDate: value }))}
                placeholder="DD/MM/AAAA"
              />
            </div>

            {/* Department Filter */}
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Select
                value={filters.departmentId}
                onValueChange={(value) => setFilters(prev => ({ ...prev, departmentId: value }))}
              >
                <SelectTrigger>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-gray-400" />
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
                onValueChange={(value) => setFilters(prev => ({ ...prev, requesterId: value }))}
              >
                <SelectTrigger>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
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

            {/* Phase Filter */}
            <div className="space-y-2">
              <Label>Fase</Label>
              <Select
                value={filters.phase}
                onValueChange={(value) => setFilters(prev => ({ ...prev, phase: value }))}
              >
                <SelectTrigger>
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-400" />
                    <SelectValue placeholder="Todas as fases" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as fases</SelectItem>
                  <SelectItem value="Aguardando Aprovação A1">Aguardando Aprovação A1</SelectItem>
                  <SelectItem value="Aguardando Aprovação A2">Aguardando Aprovação A2</SelectItem>
                  <SelectItem value="Aprovado - Aguardando Cotação">Aprovado - Aguardando Cotação</SelectItem>
                  <SelectItem value="Em Cotação">Em Cotação</SelectItem>
                  <SelectItem value="Cotação Recebida">Cotação Recebida</SelectItem>
                  <SelectItem value="Pedido Gerado">Pedido Gerado</SelectItem>
                  <SelectItem value="Concluído">Concluído</SelectItem>
                  <SelectItem value="Rejeitado">Rejeitado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Urgency Filter */}
            <div className="space-y-2">
              <Label>Urgência</Label>
              <Select
                value={filters.urgency}
                onValueChange={(value) => setFilters(prev => ({ ...prev, urgency: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas as urgências" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as urgências</SelectItem>
                  <SelectItem value="Baixa">Baixa</SelectItem>
                  <SelectItem value="Média">Média</SelectItem>
                  <SelectItem value="Alta">Alta</SelectItem>
                  <SelectItem value="Crítica">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Clear Filters Button */}
            <div className="flex items-end">
              <Button onClick={clearFilters} variant="outline" className="w-full">
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
            {isLoading ? "Carregando..." : `${requests.length} solicitação(ões) encontrada(s)`}
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
                    <TableHead>Fase</TableHead>
                    <TableHead>Valor Total</TableHead>
                    <TableHead>Urgência</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request: PurchaseRequest) => (
                    <>
                      <TableRow key={request.id} className="cursor-pointer hover:bg-gray-50">
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
                        <TableCell className="font-medium">{request.requestNumber}</TableCell>
                        <TableCell className="max-w-xs truncate">{request.description}</TableCell>
                        <TableCell>
                          {format(new Date(request.requestDate), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>{request.requesterName}</TableCell>
                        <TableCell>{request.departmentName}</TableCell>
                        <TableCell>
                          <Badge className={phaseColors[request.phase as keyof typeof phaseColors] || "bg-gray-100 text-gray-800"}>
                            {request.phase}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {request.totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </TableCell>
                        <TableCell>
                          <Badge className={urgencyColors[request.urgency as keyof typeof urgencyColors] || "bg-gray-100 text-gray-800"}>
                            {request.urgency}
                          </Badge>
                        </TableCell>
                      </TableRow>
                      
                      {/* Expanded Row Content */}
                      {expandedRows.has(request.id) && (
                        <TableRow>
                          <TableCell colSpan={9} className="bg-gray-50 p-6">
                            <div className="space-y-6">
                              {/* Items */}
                              <div>
                                <h4 className="font-semibold mb-3 flex items-center gap-2">
                                  <FileText className="w-4 h-4" />
                                  Itens da Solicitação
                                </h4>
                                <div className="bg-white rounded-lg border">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Descrição</TableHead>
                                        <TableHead>Quantidade</TableHead>
                                        <TableHead>Unidade</TableHead>
                                        <TableHead>Preço Estimado</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {request.items?.map((item) => (
                                        <TableRow key={item.id}>
                                          <TableCell>{item.description}</TableCell>
                                          <TableCell>{item.quantity}</TableCell>
                                          <TableCell>{item.unit}</TableCell>
                                          <TableCell>
                                            {item.estimatedPrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>

                              {/* Approvals */}
                              {request.approvals && request.approvals.length > 0 && (
                                <div>
                                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                                    <Eye className="w-4 h-4" />
                                    Aprovações
                                  </h4>
                                  <div className="bg-white rounded-lg border">
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
                                            <TableCell>{approval.level}</TableCell>
                                            <TableCell>
                                              <Badge className={approval.status === "Aprovado" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                                                {approval.status}
                                              </Badge>
                                            </TableCell>
                                            <TableCell>{approval.approverName}</TableCell>
                                            <TableCell>
                                              {format(new Date(approval.approvalDate), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                            </TableCell>
                                            <TableCell>{approval.comments || "-"}</TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                </div>
                              )}

                              {/* Quotations */}
                              {request.quotations && request.quotations.length > 0 && (
                                <div>
                                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                                    <FileText className="w-4 h-4" />
                                    Cotações
                                  </h4>
                                  <div className="bg-white rounded-lg border">
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
                                        {request.quotations.map((quotation) => (
                                          <TableRow key={quotation.id}>
                                            <TableCell>{quotation.supplierName}</TableCell>
                                            <TableCell>
                                              {quotation.totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                            </TableCell>
                                            <TableCell>
                                              <Badge className={quotation.status === "Enviada" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                                                {quotation.status}
                                              </Badge>
                                            </TableCell>
                                            <TableCell>
                                              {format(new Date(quotation.submissionDate), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                </div>
                              )}

                              {/* Purchase Orders */}
                              {request.purchaseOrders && request.purchaseOrders.length > 0 && (
                                <div>
                                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                                    <FileText className="w-4 h-4" />
                                    Pedidos de Compra
                                  </h4>
                                  <div className="bg-white rounded-lg border">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Número do Pedido</TableHead>
                                          <TableHead>Fornecedor</TableHead>
                                          <TableHead>Valor Total</TableHead>
                                          <TableHead>Status</TableHead>
                                          <TableHead>Data do Pedido</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {request.purchaseOrders.map((order) => (
                                          <TableRow key={order.id}>
                                            <TableCell className="font-medium">{order.orderNumber}</TableCell>
                                            <TableCell>{order.supplierName}</TableCell>
                                            <TableCell>
                                              {order.totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                            </TableCell>
                                            <TableCell>
                                              <Badge className={order.status === "Enviado" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                                                {order.status}
                                              </Badge>
                                            </TableCell>
                                            <TableCell>
                                              {format(new Date(order.orderDate), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
              
              {requests.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Nenhuma solicitação encontrada com os filtros aplicados.</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}