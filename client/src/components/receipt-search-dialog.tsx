import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Search, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

interface ReceiptSearchDialogProps {
  onSelect: (receiptId: number) => void;
  trigger?: React.ReactNode;
}

export function ReceiptSearchDialog({ onSelect, trigger }: ReceiptSearchDialogProps) {
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState({
    number: "",
    series: "",
    cnpj: "",
    accessKey: "",
  });
  const [hasSearched, setHasSearched] = useState(false);

  const searchMutation = useMutation({
    mutationFn: async (searchFilters: typeof filters) => {
      const params = new URLSearchParams();
      if (searchFilters.number) params.append("number", searchFilters.number);
      if (searchFilters.series) params.append("series", searchFilters.series);
      if (searchFilters.cnpj) params.append("cnpj", searchFilters.cnpj);
      if (searchFilters.accessKey) params.append("accessKey", searchFilters.accessKey);
      
      const res = await apiRequest(`/api/receipts/search?${params.toString()}`);
      return res;
    },
  });

  const [errors, setErrors] = useState({
    cnpj: "",
    accessKey: "",
  });

  const validate = () => {
    const newErrors = { cnpj: "", accessKey: "" };
    let isValid = true;

    if (filters.cnpj) {
      const cleanCnpj = filters.cnpj.replace(/\D/g, "");
      if (cleanCnpj.length !== 14) {
        newErrors.cnpj = "CNPJ deve conter 14 dígitos";
        isValid = false;
      }
    }

    if (filters.accessKey) {
      const cleanKey = filters.accessKey.replace(/\D/g, "");
      if (cleanKey.length !== 44) {
        newErrors.accessKey = "Chave de Acesso deve conter 44 dígitos";
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSearch = () => {
    if (!validate()) return;
    setHasSearched(true);
    searchMutation.mutate(filters);
  };

  const handleSelect = (id: number) => {
    if (confirm("Deseja utilizar os dados desta nota fiscal para preencher o formulário?")) {
      onSelect(id);
      setOpen(false);
    }
  };

  const results = searchMutation.data || [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <Search className="h-4 w-4" />
            Buscar Nota Existente
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buscar Nota Fiscal Existente</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-4">
          <div className="space-y-2">
            <Label>Número</Label>
            <Input 
              placeholder="Ex: 12345" 
              value={filters.number}
              onChange={(e) => setFilters(prev => ({ ...prev, number: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Série</Label>
            <Input 
              placeholder="Ex: 1" 
              value={filters.series}
              onChange={(e) => setFilters(prev => ({ ...prev, series: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>CNPJ Emitente</Label>
            <Input 
              placeholder="Apenas números" 
              value={filters.cnpj}
              onChange={(e) => setFilters(prev => ({ ...prev, cnpj: e.target.value }))}
              className={errors.cnpj ? "border-red-500" : ""}
            />
            {errors.cnpj && <span className="text-xs text-red-500">{errors.cnpj}</span>}
          </div>
          <div className="space-y-2">
            <Label>Chave de Acesso</Label>
            <Input 
              placeholder="44 dígitos" 
              value={filters.accessKey}
              onChange={(e) => setFilters(prev => ({ ...prev, accessKey: e.target.value }))}
              className={errors.accessKey ? "border-red-500" : ""}
            />
            {errors.accessKey && <span className="text-xs text-red-500">{errors.accessKey}</span>}
          </div>
        </div>

        <div className="flex justify-end mb-4">
          <Button onClick={handleSearch} disabled={searchMutation.isPending}>
            {searchMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
            Pesquisar
          </Button>
        </div>

        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número/Série</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Data Emissão</TableHead>
                <TableHead>Valor Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {searchMutation.isPending ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : results.length > 0 ? (
                results.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      {r.documentNumber}
                      {r.documentSeries ? ` / ${r.documentSeries}` : ""}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{r.supplierName || "Desconhecido"}</span>
                        <span className="text-xs text-muted-foreground">{r.supplierCnpj}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {r.documentIssueDate ? format(new Date(r.documentIssueDate), "dd/MM/yyyy") : "-"}
                    </TableCell>
                    <TableCell>
                      {r.totalAmount ? 
                        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(r.totalAmount)) 
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs px-2 py-1 rounded-full bg-secondary">
                        {r.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" onClick={() => handleSelect(r.id)}>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Usar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {hasSearched ? "Nenhuma nota fiscal encontrada com os filtros informados." : "Utilize os filtros acima para buscar."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
