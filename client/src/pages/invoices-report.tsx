import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  FileText,
  Search,
  Filter as FilterIcon,
  Download,
  Loader2,
  Calendar as CalendarIcon
} from "lucide-react";
import { NFEViewer } from "@/components/nfe/NFEViewer";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// Types
interface Receipt {
  id: number;
  receiptNumber: string;
  documentNumber: string;
  documentSeries: string;
  documentKey: string;
  documentIssueDate: string;
  documentEntryDate: string;
  totalAmount: string;
  status: string;
  receiptType: string;
  createdAt: string;
  supplierName: string;
  supplierCnpj: string;
}

interface ReceiptItem {
  id: number;
  description: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
  ncm: string;
  cfop: string;
  quantityReceived: string;
}

// Helper to format currency
const formatCurrency = (value: string | number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
};

// Helper to format date
const formatDate = (dateStr: string) => {
  if (!dateStr) return "-";
  return format(new Date(dateStr), "dd/MM/yyyy");
};

// Status Badge Component
const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    rascunho: "bg-gray-500",
    nf_pendente: "bg-yellow-500",
    nf_confirmada: "bg-blue-500",
    validado_compras: "bg-indigo-500",
    enviado_locador: "bg-purple-500",
    integrado_locador: "bg-green-500",
    erro_integracao: "bg-red-500",
    recebimento_confirmado: "bg-green-600",
  };

  const labels: Record<string, string> = {
    rascunho: "Rascunho",
    nf_pendente: "Pendente",
    nf_confirmada: "Confirmada",
    validado_compras: "Validado",
    enviado_locador: "Enviado ERP",
    integrado_locador: "Integrado",
    erro_integracao: "Erro Integração",
    recebimento_confirmado: "Recebido",
  };

  return (
    <Badge className={cn(styles[status] || "bg-gray-500")}>
      {labels[status] || status}
    </Badge>
  );
};

// Expanded Row Component (Items)
const ReceiptItemsList = ({ receiptId }: { receiptId: number }) => {
  const { data: items, isLoading } = useQuery<ReceiptItem[]>({
    queryKey: ["receipt-items", receiptId],
    queryFn: async () => {
      const res = await fetch(`/api/recebimentos/${receiptId}/items`);
      if (!res.ok) throw new Error("Failed to fetch items");
      return res.json();
    },
  });

  if (isLoading) return <div className="p-4 flex justify-center"><Loader2 className="animate-spin h-5 w-5" /></div>;
  if (!items || items.length === 0) return <div className="p-4 text-muted-foreground text-center">Nenhum item encontrado.</div>;

  return (
    <div className="bg-muted/30 p-4 rounded-md mx-4 mb-4 border border-muted">
      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
        <FileText className="h-4 w-4" /> Itens da Nota
      </h4>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[100px]">Código/NCM</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead className="text-right">Qtd</TableHead>
            <TableHead className="text-center">Un</TableHead>
            <TableHead className="text-right">Vl. Unit.</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-center">CFOP</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id} className="hover:bg-muted/50">
              <TableCell className="text-xs">{item.ncm || "-"}</TableCell>
              <TableCell className="font-medium text-xs">{item.description}</TableCell>
              <TableCell className="text-right text-xs">{Number(item.quantity).toLocaleString('pt-BR')}</TableCell>
              <TableCell className="text-center text-xs">{item.unit}</TableCell>
              <TableCell className="text-right text-xs">{formatCurrency(item.unitPrice)}</TableCell>
              <TableCell className="text-right text-xs font-semibold">{formatCurrency(item.totalPrice)}</TableCell>
              <TableCell className="text-center text-xs">{item.cfop || "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

// Visualizer Dialog
const ReceiptVisualizer = ({ receipt, open, onOpenChange }: { receipt: Receipt | null, open: boolean, onOpenChange: (open: boolean) => void }) => {
  const { data: xmlData, isLoading } = useQuery({
    queryKey: ["receipt-xml-preview", receipt?.id],
    queryFn: async () => {
      if (!receipt) return null;
      // First try to check if there is an XML associated by calling parse-existing
      const res = await fetch(`/api/recebimentos/parse-existing/${receipt.id}`, { method: 'POST' });
      if (!res.ok) {
         // If no XML, we return null to show manual view
         return null; 
      }
      const data = await res.json();
      return { xmlRaw: data.receipt?.xmlContent || data.xmlRaw, preview: data.preview };
    },
    enabled: !!receipt && open,
    retry: false
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Visualização da Nota Fiscal - {receipt?.documentNumber}</DialogTitle>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
        ) : xmlData && xmlData.xmlRaw ? (
          <NFEViewer xmlString={xmlData.xmlRaw} />
        ) : (
          <div className="p-4 space-y-4">
             <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-md text-yellow-800 text-sm mb-4">
               Nota fiscal sem XML importado ou incluída manualmente.
             </div>
             {/* Fallback view for manual entries */}
             <div className="grid grid-cols-2 gap-4">
               <Card>
                 <CardHeader className="pb-2"><CardTitle className="text-sm">Dados da Nota</CardTitle></CardHeader>
                 <CardContent className="text-sm space-y-1">
                    <p><span className="font-semibold">Número:</span> {receipt?.documentNumber}</p>
                    <p><span className="font-semibold">Série:</span> {receipt?.documentSeries}</p>
                    <p><span className="font-semibold">Emissão:</span> {formatDate(receipt?.documentIssueDate || "")}</p>
                    <p><span className="font-semibold">Valor Total:</span> {formatCurrency(receipt?.totalAmount || 0)}</p>
                 </CardContent>
               </Card>
               <Card>
                 <CardHeader className="pb-2"><CardTitle className="text-sm">Fornecedor</CardTitle></CardHeader>
                 <CardContent className="text-sm space-y-1">
                    <p><span className="font-semibold">Nome:</span> {receipt?.supplierName}</p>
                    <p><span className="font-semibold">CNPJ:</span> {receipt?.supplierCnpj}</p>
                 </CardContent>
               </Card>
             </div>
             {receipt && <ReceiptItemsList receiptId={receipt.id} />}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default function InvoicesReportPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [page, setPage] = useState(1);
  
  useEffect(() => {
    if (user && !(user.isBuyer || user.isManager || user.isAdmin || user.isCEO)) {
      setLocation("/");
    }
  }, [user, setLocation]);

  const [filters, setFilters] = useState({
    number: "",
    series: "",
    supplierName: "",
    startDate: "",
    endDate: "",
  });
  const [expandedRows, setExpandedRows] = useState<number[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [isVisualizerOpen, setIsVisualizerOpen] = useState(false);
  const [isFiltersCollapsed, setIsFiltersCollapsed] = useState(false);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["invoices-search", page, filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
        ...filters
      });
      const res = await fetch(`/api/receipts/search?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch invoices");
      return res.json();
    },
    keepPreviousData: true,
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1); // Reset to first page on filter change
  };

  const toggleRowExpansion = (id: number) => {
    setExpandedRows(prev => 
      prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
    );
  };

  const handleVisualize = (receipt: Receipt) => {
    setSelectedReceipt(receipt);
    setIsVisualizerOpen(true);
  };

  const handleExport = () => {
    // Basic CSV export of current view
    if (!data?.data) return;
    
    const headers = ["Número", "Série", "Fornecedor", "CNPJ", "Emissão", "Entrada", "Valor Total", "Status"];
    const csvContent = [
      headers.join(","),
      ...data.data.map((r: Receipt) => [
        r.documentNumber,
        r.documentSeries,
        `"${r.supplierName}"`,
        r.supplierCnpj,
        formatDate(r.documentIssueDate),
        formatDate(r.documentEntryDate),
        r.totalAmount,
        r.status
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `notas_fiscais_${format(new Date(), "yyyyMMdd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Consulta de Notas Fiscais</h1>
          <p className="text-muted-foreground">Gerencie e visualize todas as notas fiscais registradas no sistema.</p>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" /> Exportar Lista
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3 cursor-pointer" onClick={() => setIsFiltersCollapsed(!isFiltersCollapsed)}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <FilterIcon className="h-5 w-5" /> Filtros
            </CardTitle>
            <ChevronDown className={cn("h-5 w-5 transition-transform", isFiltersCollapsed && "transform rotate-180")} />
          </div>
        </CardHeader>
        {!isFiltersCollapsed && (
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Número da Nota</label>
                <Input 
                  placeholder="Ex: 12345" 
                  value={filters.number}
                  onChange={(e) => handleFilterChange("number", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Fornecedor</label>
                <Input 
                  placeholder="Nome ou parte do nome" 
                  value={filters.supplierName}
                  onChange={(e) => handleFilterChange("supplierName", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Data Inicial (Emissão)</label>
                <Input 
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange("startDate", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Data Final (Emissão)</label>
                <Input 
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange("endDate", e.target.value)}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button 
                variant="ghost" 
                onClick={() => {
                  setFilters({ number: "", series: "", supplierName: "", startDate: "", endDate: "" });
                  setPage(1);
                }}
              >
                Limpar Filtros
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Número / Série</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Emissão</TableHead>
                <TableHead>Entrada</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    <div className="flex justify-center items-center gap-2">
                      <Loader2 className="animate-spin h-5 w-5" /> Carregando...
                    </div>
                  </TableCell>
                </TableRow>
              ) : data?.data?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    Nenhuma nota fiscal encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                data?.data?.map((receipt: Receipt) => (
                  <>
                    <TableRow key={receipt.id} className={cn("group", expandedRows.includes(receipt.id) ? "bg-muted/50" : "")}>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => toggleRowExpansion(receipt.id)}
                        >
                          {expandedRows.includes(receipt.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={receipt.status} />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{receipt.documentNumber}</div>
                        <div className="text-xs text-muted-foreground">Série: {receipt.documentSeries}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium truncate max-w-[200px]" title={receipt.supplierName}>{receipt.supplierName}</div>
                        <div className="text-xs text-muted-foreground">{receipt.supplierCnpj}</div>
                      </TableCell>
                      <TableCell>{formatDate(receipt.documentIssueDate)}</TableCell>
                      <TableCell>{formatDate(receipt.documentEntryDate)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(receipt.totalAmount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleVisualize(receipt)}
                        >
                          <Eye className="h-4 w-4 mr-2" /> Visualizar
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expandedRows.includes(receipt.id) && (
                      <TableRow className="bg-muted/10 hover:bg-muted/10">
                        <TableCell colSpan={8} className="p-0">
                          <div className="py-2">
                             <ReceiptItemsList receiptId={receipt.id} />
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
        
        {/* Pagination */}
        {data?.pagination && (
          <div className="flex items-center justify-between px-4 py-4 border-t">
            <div className="text-sm text-muted-foreground">
              Mostrando {((page - 1) * data.pagination.limit) + 1} a {Math.min(page * data.pagination.limit, data.pagination.total)} de {data.pagination.total} resultados
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Anterior
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
                disabled={page >= data.pagination.totalPages}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </Card>

      <ReceiptVisualizer 
        receipt={selectedReceipt} 
        open={isVisualizerOpen} 
        onOpenChange={setIsVisualizerOpen} 
      />
    </div>
  );
}