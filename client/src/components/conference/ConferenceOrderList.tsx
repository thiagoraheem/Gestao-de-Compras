import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ConferenceOrderCard from "./ConferenceOrderCard";
import { Search, FilterX } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ConferenceOrderListProps {
  requests: any[];
  onSelect: (request: any) => void;
}

export default function ConferenceOrderList({ requests, onSelect }: ConferenceOrderListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");

  // Extract unique suppliers for filter
  const suppliers = Array.from(new Set(requests.map(r => r.chosenSupplier?.name).filter(Boolean))).sort();

  const filteredRequests = requests.filter(r => {
    const matchesSearch = 
      r.requestNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.justification?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.chosenSupplier?.name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesUrgency = urgencyFilter === "all" || r.urgency === urgencyFilter;
    
    const matchesSupplier = supplierFilter === "all" || r.chosenSupplier?.name === supplierFilter;

    return matchesSearch && matchesUrgency && matchesSupplier;
  });

  const clearFilters = () => {
    setSearchTerm("");
    setUrgencyFilter("all");
    setSupplierFilter("all");
  };

  const hasActiveFilters = searchTerm || urgencyFilter !== "all" || supplierFilter !== "all";

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-center bg-card p-4 rounded-lg border shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por número, fornecedor..."
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
      </div>

      {filteredRequests.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Nenhum pedido encontrado com os filtros selecionados.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredRequests.map(request => (
            <ConferenceOrderCard 
              key={request.id} 
              request={request} 
              onSelect={onSelect} 
            />
          ))}
        </div>
      )}
    </div>
  );
}
