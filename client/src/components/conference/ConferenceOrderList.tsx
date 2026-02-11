import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ConferenceOrderCard from "./ConferenceOrderCard";
import { Search, FilterX, LayoutGrid, Rows3, ArrowUpDown, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { URGENCY_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ConferenceOrderListProps {
  requests: any[];
  onSelect: (request: any) => void;
}

export default function ConferenceOrderList({ requests, onSelect }: ConferenceOrderListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

  // Extract unique suppliers for filter
  const suppliers = Array.from(new Set(requests.map(r => r.chosenSupplier?.name).filter(Boolean))).sort();

  // Extract unique categories for filter
  const categories = Array.from(new Set(requests.map(r => r.category).filter(Boolean))).sort();

  const filteredRequests = requests.filter(r => {
    const matchesSearch = 
      r.requestNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.justification?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.chosenSupplier?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.purchaseOrder?.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesUrgency = urgencyFilter === "all" || r.urgency === urgencyFilter;
    
    const matchesSupplier = supplierFilter === "all" || r.chosenSupplier?.name === supplierFilter;

    const matchesCategory = categoryFilter === "all" || r.category === categoryFilter;

    return matchesSearch && matchesUrgency && matchesSupplier && matchesCategory;
  });

  const sortedRequests = [...filteredRequests].sort((a, b) => {
    if (!sortConfig) return 0;
    
    let aValue: any;
    let bValue: any;

    switch (sortConfig.key) {
      case 'purchaseOrder.orderNumber':
        aValue = a.purchaseOrder?.orderNumber || '';
        bValue = b.purchaseOrder?.orderNumber || '';
        break;
      case 'purchaseOrder.totalValue':
        aValue = Number(a.purchaseOrder?.totalValue || 0);
        bValue = Number(b.purchaseOrder?.totalValue || 0);
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

  const clearFilters = () => {
    setSearchTerm("");
    setUrgencyFilter("all");
    setSupplierFilter("all");
    setCategoryFilter("all");
  };

  const hasActiveFilters = searchTerm || urgencyFilter !== "all" || supplierFilter !== "all" || categoryFilter !== "all";

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-center bg-card p-4 rounded-lg border shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por número, fornecedor, pedido..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Prioridades</SelectItem>
            <SelectItem value="alta_urgencia">Alta Urgência</SelectItem>
            <SelectItem value="alto">Alta</SelectItem>
            <SelectItem value="medio">Média</SelectItem>
            <SelectItem value="baixo">Baixa</SelectItem>
          </SelectContent>
        </Select>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="Tipo de Solicitação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Tipos</SelectItem>
            {categories.map((c: any) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={supplierFilter} onValueChange={setSupplierFilter}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="Fornecedor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Fornecedores</SelectItem>
            {suppliers.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" size="icon" onClick={clearFilters} title="Limpar filtros">
            <FilterX className="h-4 w-4" />
          </Button>
        )}

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={viewMode === "cards" ? "default" : "outline"}
            size="icon"
            onClick={() => setViewMode("cards")}
            title="Visualização em cards"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={viewMode === "list" ? "default" : "outline"}
            size="icon"
            onClick={() => setViewMode("list")}
            title="Visualização em lista"
          >
            <Rows3 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {sortedRequests.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Nenhum pedido encontrado com os filtros selecionados.
        </div>
      ) : (
        <>
          {viewMode === "cards" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {sortedRequests.map(request => (
                <ConferenceOrderCard 
                  key={request.id} 
                  request={request} 
                  onSelect={onSelect} 
                />
              ))}
            </div>
          ) : (
            <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[125px]">Solicitação</TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('purchaseOrder.orderNumber')}
                    >
                      <div className="flex items-center gap-2">
                        Pedido
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead className="hidden md:table-cell">Descrição</TableHead>
                    <TableHead 
                      className="text-right cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('purchaseOrder.totalValue')}
                    >
                      <div className="flex items-center justify-end gap-2">
                        Valor
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </TableHead>
                    <TableHead className="w-[140px]">Prioridade</TableHead>
                    <TableHead className="w-[140px]">Itens</TableHead>
                    <TableHead className="w-[170px]">Entrega Ideal</TableHead>
                    <TableHead className="w-[140px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRequests.map(request => {
                    const isUrgent = request.urgency === "alta_urgencia" || request.urgency === "alto";
                    const deliveryDate = request.idealDeliveryDate ? new Date(request.idealDeliveryDate) : null;
                    const isLate = deliveryDate && deliveryDate < new Date() && deliveryDate.toDateString() !== new Date().toDateString();
                    return (
                      <TableRow
                        key={request.id}
                        className="cursor-pointer"
                        onClick={() => onSelect(request)}
                      >
                        <TableCell className="font-medium">
                          {request.requestNumber}
                        </TableCell>
                        <TableCell>
                          {request.purchaseOrder?.orderNumber ? (
                            <span className="font-medium">{request.purchaseOrder.orderNumber}</span>
                          ) : (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-amber-600 italic cursor-help flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    Pendente
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Pedido pendente</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[260px] truncate">
                            {request.chosenSupplier?.name || "Fornecedor não definido"}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="max-w-[260px] truncate text-muted-foreground">
                            {request.justification || "Sem descrição"}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {request.purchaseOrder?.totalValue ? (
                             new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(request.purchaseOrder.totalValue))
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={isUrgent ? "destructive" : "secondary"}
                          >
                            {(URGENCY_LABELS as any)[request.urgency] || request.urgency}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {request.items?.length || 0} itens
                        </TableCell>
                        <TableCell>
                          <span className={cn(isLate && "text-red-600 font-medium")}>
                            {request.idealDeliveryDate
                              ? new Date(request.idealDeliveryDate).toLocaleDateString("pt-BR")
                              : "Não informada"}
                            {isLate && " (Atrasado)"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelect(request);
                            }}
                          >
                            Conferir
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
