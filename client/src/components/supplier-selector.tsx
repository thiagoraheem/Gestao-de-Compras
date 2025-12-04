
import { useState, useMemo } from "react";
import { Search, Check, Users, ChevronDown, ChevronUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Supplier {
  id: number;
  name: string;
  email: string;
  phone?: string;
  contact?: string;
  cnpj?: string;
  cpf?: string;
}

interface SupplierSelectorProps {
  suppliers: Supplier[];
  selectedSuppliers: number[];
  onSelectionChange: (selectedIds: number[]) => void;
}

export function SupplierSelector({ suppliers, selectedSuppliers, onSelectionChange }: SupplierSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  // Filter suppliers based on search term
  const filteredSuppliers = useMemo(() => {
    const normalize = (v: unknown) => typeof v === 'string' ? v.toLowerCase() : '';
    const term = normalize(searchTerm.trim());
    if (!term) return suppliers;
    return suppliers.filter(supplier => {
      if (!supplier) return false;
      const name = normalize((supplier as any).name);
      const email = normalize((supplier as any).email);
      const contact = normalize((supplier as any).contact);
      const phone = normalize((supplier as any).phone);
      const cnpj = normalize((supplier as any).cnpj);
      const cpf = normalize((supplier as any).cpf);
      return (
        name.includes(term) ||
        email.includes(term) ||
        contact.includes(term) ||
        phone.includes(term) ||
        cnpj.includes(term) ||
        cpf.includes(term)
      );
    });
  }, [suppliers, searchTerm]);

  // Get selected suppliers for display
  const selectedSuppliersData = useMemo(() => {
    return suppliers.filter(supplier => selectedSuppliers.includes(supplier.id));
  }, [suppliers, selectedSuppliers]);

  const handleSupplierToggle = (supplierId: number) => {
    if (selectedSuppliers.includes(supplierId)) {
      onSelectionChange(selectedSuppliers.filter(id => id !== supplierId));
    } else {
      onSelectionChange([...selectedSuppliers, supplierId]);
    }
  };

  const handleSelectAll = () => {
    const allFilteredIds = filteredSuppliers.map(s => s.id);
    const newSelection = Array.from(new Set([...selectedSuppliers, ...allFilteredIds]));
    onSelectionChange(newSelection);
  };

  const handleDeselectAll = () => {
    const filteredIds = filteredSuppliers.map(s => s.id);
    const newSelection = selectedSuppliers.filter(id => !filteredIds.includes(id));
    onSelectionChange(newSelection);
  };

  const handleClearSelection = () => {
    onSelectionChange([]);
  };

  return (
    <div className="space-y-4">
      {/* Selected Suppliers Summary */}
      <div className="flex items-center justify-between p-3 bg-card border border-border rounded-lg">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">
            {selectedSuppliers.length} fornecedor(es) selecionado(s)
          </span>
        </div>
        {selectedSuppliers.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClearSelection}
            className="text-primary hover:text-primary h-auto p-1"
          >
            Limpar seleção
          </Button>
        )}
      </div>

      {/* Selected Suppliers Tags */}
      {selectedSuppliersData.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedSuppliersData.map((supplier) => (
            <Badge
              key={supplier.id}
              variant="secondary"
              className="flex items-center gap-1 px-2 py-1"
            >
              {supplier.name}
              <button
                type="button"
                onClick={() => handleSupplierToggle(supplier.id)}
                className="ml-1 hover:bg-accent rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Search and Actions */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar fornecedores por nome, email ou contato..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Ocultar
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Expandir
              </>
            )}
          </Button>
        </div>

        {filteredSuppliers.length > 0 && (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              disabled={filteredSuppliers.every(s => selectedSuppliers.includes(s.id))}
            >
              Selecionar todos ({filteredSuppliers.length})
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDeselectAll}
              disabled={!filteredSuppliers.some(s => selectedSuppliers.includes(s.id))}
            >
              Desmarcar visíveis
            </Button>
          </div>
        )}
      </div>

      {/* Suppliers List */}
      <Collapsible open={isExpanded || searchTerm.length > 0} onOpenChange={setIsExpanded}>
        <CollapsibleContent className="space-y-2">
          {filteredSuppliers.length === 0 ? (
            <Card className="p-4 text-center text-muted-foreground bg-card border-border">
              {searchTerm ? 'Nenhum fornecedor encontrado para a busca' : 'Nenhum fornecedor cadastrado'}
            </Card>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-2 border border-border rounded-lg">
              {filteredSuppliers.map((supplier) => (
                <div
                  key={supplier.id}
                  className={`flex items-center space-x-3 p-3 hover:bg-accent hover:text-accent-foreground border-b last:border-b-0 cursor-pointer transition-colors ${
                    selectedSuppliers.includes(supplier.id) ? 'bg-primary/10 border-primary/30' : ''
                  }`}
                  onClick={() => handleSupplierToggle(supplier.id)}
                >
                  <Checkbox
                    checked={selectedSuppliers.includes(supplier.id)}
                    onCheckedChange={() => handleSupplierToggle(supplier.id)}
                    className="pointer-events-none"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm text-foreground truncate">
                        {supplier.name} ({supplier.cnpj || supplier.cpf})
                      </p>
                      {selectedSuppliers.includes(supplier.id) && (
                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{supplier.email}</p>
                    {supplier.contact && (
                      <p className="text-xs text-muted-foreground truncate">Contato: {supplier.contact}</p>
                    )}
                    {supplier.phone && (
                      <p className="text-xs text-muted-foreground truncate">Tel: {supplier.phone}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Quick Stats */}
      <div className="text-xs text-muted-foreground text-center">
        {searchTerm ? (
          <>Mostrando {filteredSuppliers.length} de {suppliers.length} fornecedores</>
        ) : (
          <>Total: {suppliers.length} fornecedores disponíveis</>
        )}
      </div>
    </div>
  );
}
