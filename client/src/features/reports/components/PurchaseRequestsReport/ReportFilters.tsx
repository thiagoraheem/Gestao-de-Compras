import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/shared/ui/select";
import { Checkbox } from "@/shared/ui/checkbox";
import { DateInput } from "@/shared/ui/date-input";
import { ItemSearchInput } from "@/shared/components/item-search-input";
import { Filter, Search, Building2, User, Truck, FileText, RefreshCw } from "lucide-react";
import type { Department, User as UserType } from "./types";
import type { ReportFilters as FiltersType } from "./usePurchaseRequestsReport";

interface ReportFiltersProps {
  filters: FiltersType;
  setFilters: React.Dispatch<React.SetStateAction<FiltersType>>;
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  includeArchivedInSum: boolean;
  setIncludeArchivedInSum: React.Dispatch<React.SetStateAction<boolean>>;
  isSearchEnabled: boolean;
  isLoading: boolean;
  isRefetching: boolean;
  handleSearch: () => void;
  clearFilters: () => void;
  departments: Department[];
  users: UserType[];
  uniqueSuppliers: string[];
}

export function ReportFilters({
  filters,
  setFilters,
  searchTerm,
  setSearchTerm,
  includeArchivedInSum,
  setIncludeArchivedInSum,
  isSearchEnabled,
  isLoading,
  isRefetching,
  handleSearch,
  clearFilters,
  departments,
  users,
  uniqueSuppliers
}: ReportFiltersProps) {
  return (
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

          <div className="space-y-2">
            <Label>Item</Label>
            <ItemSearchInput
              value={filters.itemDescription}
              onChange={(value) =>
                setFilters((prev) => ({ ...prev, itemDescription: value }))
              }
            />
          </div>

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
                {users.map((user: UserType) => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {user.firstName} {user.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
                <SelectItem value="pedido_compra">Pedido de Compra</SelectItem>
                <SelectItem value="conclusao_compra">Conclusão</SelectItem>
                <SelectItem value="recebimento">Recebimento</SelectItem>
                <SelectItem value="arquivado">Arquivado</SelectItem>
              </SelectContent>
            </Select>
          </div>

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

          <div className="space-y-2">
            <Label htmlFor="include-archived">Considerar Arquivados na somatória</Label>
            <div className="flex items-center gap-2 py-2">
              <Checkbox
                id="include-archived"
                checked={includeArchivedInSum}
                onCheckedChange={(v) => setIncludeArchivedInSum(Boolean(v))}
              />
            </div>
          </div>

          <div className="flex items-end">
            <Button
              onClick={clearFilters}
              variant="outline"
              className="w-full"
            >
              Limpar Filtros
            </Button>
          </div>
          
          <div className="flex items-end md:col-span-2 lg:col-span-3 xl:col-span-4 justify-end mt-4">
            <div className="flex gap-2 w-full md:w-auto">
              {!isSearchEnabled && (
                <p className="text-sm text-muted-foreground self-center mr-4 hidden md:block">
                  Selecione pelo menos um filtro
                </p>
              )}
              <Button 
                onClick={handleSearch} 
                className="w-full md:w-auto min-w-[150px]"
                disabled={!isSearchEnabled || isLoading || isRefetching}
              >
                {(isLoading || isRefetching) ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Search className="w-4 h-4 mr-2" />
                )}
                Consultar
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
