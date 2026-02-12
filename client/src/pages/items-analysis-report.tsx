
import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Download,
  Filter,
  Search,
  ArrowUpDown,
  MoreHorizontal,
  Info
} from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateInput } from "@/components/ui/date-input";
import { formatCurrency } from "@/lib/currency";

interface ItemReportData {
  id: string;
  type: 'ERP' | 'DESC';
  itemCode: string | null;
  description: string;
  variationCount: number;
  totalQuantity: number;
  totalValue: number;
  orderCount: number;
  averagePrice: number;
  minPrice: number;
  maxPrice: number;
  priceVolatility: number;
  supplierCount: number;
  suppliers: { id: number; name: string }[];
  firstPurchaseDate: string;
  lastPurchaseDate: string;
}

interface ReportSummary {
  totalSpent: number;
  uniqueItems: number;
  itemsWithCode: number;
  itemsWithoutCode: number;
}

interface ApiResponse {
  summary: ReportSummary;
  items: ItemReportData[];
}

export default function ItemsAnalysisReportPage() {
  const [startDate, setStartDate] = useState<string>(format(subDays(new Date(), 365), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [searchTerm, setSearchTerm] = useState("");
  const [itemTypeFilter, setItemTypeFilter] = useState<string>("all");
  const [sortConfig, setSortConfig] = useState<{ key: keyof ItemReportData; direction: 'asc' | 'desc' }>({
    key: 'totalValue',
    direction: 'desc',
  });

  const { data, isLoading } = useQuery<ApiResponse>({
    queryKey: ["/api/reports/items-analysis", startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      
      const res = await apiRequest(`/api/reports/items-analysis?${params.toString()}`);
      return res;
    },
  });

  const filteredItems = useMemo(() => {
    if (!data?.items) return [];

    return data.items.filter((item) => {
      const matchesSearch = 
        item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.itemCode && item.itemCode.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesType = 
        itemTypeFilter === "all" || 
        (itemTypeFilter === "erp" && item.type === "ERP") ||
        (itemTypeFilter === "desc" && item.type === "DESC");

      return matchesSearch && matchesType;
    });
  }, [data, searchTerm, itemTypeFilter]);

  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredItems, sortConfig]);

  const handleSort = (key: keyof ItemReportData) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === "desc" ? "asc" : "desc",
    }));
  };

  const exportToCSV = () => {
    if (!sortedItems.length) return;

    const headers = [
      "Código ERP",
      "Descrição",
      "Tipo",
      "Qtd Total",
      "Valor Total",
      "Preço Médio",
      "Min Preço",
      "Max Preço",
      "Volatilidade %",
      "Qtd Pedidos",
      "Qtd Fornecedores",
      "Fornecedores"
    ];

    const csvContent = [
      headers.join(";"),
      ...sortedItems.map((item) => [
        item.itemCode || "",
        `"${item.description.replace(/"/g, '""')}"`,
        item.type === 'ERP' ? 'Com Código' : 'Descrição Livre',
        item.totalQuantity.toString().replace('.', ','),
        item.totalValue.toFixed(2).replace('.', ','),
        item.averagePrice.toFixed(2).replace('.', ','),
        item.minPrice.toFixed(2).replace('.', ','),
        item.maxPrice.toFixed(2).replace('.', ','),
        item.priceVolatility.toFixed(2).replace('.', ','),
        item.orderCount,
        item.supplierCount,
        `"${item.suppliers.map(s => s.name).join(', ')}"`
      ].join(";"))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `analise_itens_${format(new Date(), "yyyy-MM-dd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Análise de Itens Comprados</h1>
          <p className="text-muted-foreground">
            Visão gerencial de itens, preços e fornecedores
          </p>
        </div>
        <Button variant="outline" onClick={exportToCSV} disabled={!sortedItems.length}>
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Gasto</CardTitle>
            <span className="text-muted-foreground">💰</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data ? formatCurrency(data.summary.totalSpent) : "..."}
            </div>
            <p className="text-xs text-muted-foreground">
              no período selecionado
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Itens Únicos</CardTitle>
            <span className="text-muted-foreground">📦</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data ? data.summary.uniqueItems : "..."}
            </div>
            <p className="text-xs text-muted-foreground">
              produtos/serviços distintos
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Com Código ERP</CardTitle>
            <span className="text-muted-foreground">🏷️</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data ? data.summary.itemsWithCode : "..."}
            </div>
            <p className="text-xs text-muted-foreground">
              itens padronizados
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sem Código</CardTitle>
            <span className="text-muted-foreground">📝</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data ? data.summary.itemsWithoutCode : "..."}
            </div>
            <p className="text-xs text-muted-foreground">
              descrição livre
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4 justify-between">
            <div className="space-y-1">
              <CardTitle>Detalhes dos Itens</CardTitle>
              <p className="text-sm text-muted-foreground">
                Lista consolidada por código ou descrição
              </p>
            </div>
            <div className="flex flex-col md:flex-row gap-2">
               <div className="flex items-center gap-2">
                  <DateInput 
                    value={startDate} 
                    onChange={setStartDate} 
                    placeholder="Início"
                    className="w-[140px]"
                  />
                  <span className="text-muted-foreground">-</span>
                  <DateInput 
                    value={endDate} 
                    onChange={setEndDate} 
                    placeholder="Fim"
                    className="w-[140px]"
                  />
               </div>
               <Select value={itemTypeFilter} onValueChange={setItemTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Tipo de Item" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Tipos</SelectItem>
                  <SelectItem value="erp">Com Código ERP</SelectItem>
                  <SelectItem value="desc">Sem Código ERP</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative w-[250px]">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar item..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border max-h-[65vh] overflow-y-auto relative">
            <Table>
              <TableHeader className="sticky top-0 z-20 bg-card">
                <TableRow>
                  <TableHead className="w-[100px] cursor-pointer" onClick={() => handleSort('itemCode')}>
                    Código <ArrowUpDown className="ml-1 h-3 w-3 inline" />
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('description')}>
                    Descrição <ArrowUpDown className="ml-1 h-3 w-3 inline" />
                  </TableHead>
                  <TableHead className="text-right cursor-pointer" onClick={() => handleSort('totalQuantity')}>
                    Qtd <ArrowUpDown className="ml-1 h-3 w-3 inline" />
                  </TableHead>
                  <TableHead className="text-right cursor-pointer" onClick={() => handleSort('totalValue')}>
                    Valor Total <ArrowUpDown className="ml-1 h-3 w-3 inline" />
                  </TableHead>
                  <TableHead className="text-right cursor-pointer" onClick={() => handleSort('averagePrice')}>
                    Preço Médio <ArrowUpDown className="ml-1 h-3 w-3 inline" />
                  </TableHead>
                  <TableHead className="text-center cursor-pointer" onClick={() => handleSort('orderCount')}>
                    Pedidos <ArrowUpDown className="ml-1 h-3 w-3 inline" />
                  </TableHead>
                   <TableHead className="text-center">
                    Fornecedores
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Carregando dados...
                    </TableCell>
                  </TableRow>
                ) : sortedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Nenhum item encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.itemCode ? (
                          <Badge variant="outline">{item.itemCode}</Badge>
                        ) : (
                           <Badge variant="secondary" className="text-xs">S/ Cód</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                            <span>{item.description}</span>
                            {item.variationCount > 1 && (
                                <span className="text-xs text-muted-foreground">
                                    +{item.variationCount - 1} variações de descrição
                                </span>
                            )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{item.totalQuantity}</TableCell>
                      <TableCell className="text-right font-bold text-emerald-600">
                        {formatCurrency(item.totalValue)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.averagePrice)}
                        {item.priceVolatility > 10 && (
                            <div className="text-[10px] text-red-500 flex justify-end items-center" title={`Variação de ${(item.priceVolatility).toFixed(0)}% entre min e max`}>
                                ⚠️ Var. alta
                            </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">{item.orderCount}</TableCell>
                      <TableCell className="text-center">
                        {item.suppliers.length === 1 ? (
                            <span className="text-sm truncate max-w-[150px] inline-block" title={item.suppliers[0].name}>
                                {item.suppliers[0].name}
                            </span>
                        ) : (
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                        <Badge variant="outline" className="cursor-pointer">
                                            {item.suppliers.length}
                                        </Badge>
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80">
                                    <div className="grid gap-4">
                                        <div className="space-y-2">
                                            <h4 className="font-medium leading-none">Fornecedores</h4>
                                            <p className="text-sm text-muted-foreground">
                                                Fornecedores que venderam este item
                                            </p>
                                        </div>
                                        <div className="grid gap-2">
                                            {item.suppliers.map(sup => (
                                                <div key={sup.id} className="text-sm border-b last:border-0 pb-1">
                                                    {sup.name}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
