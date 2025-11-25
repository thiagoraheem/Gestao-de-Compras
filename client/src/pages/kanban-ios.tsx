import KanbanBoard from "@/components/kanban-board";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { useLocation } from "wouter";

export default function KanbanIOSPage() {
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [selectedUrgency, setSelectedUrgency] = useState<string>("all");
  const [selectedRequester, setSelectedRequester] = useState<string>("all");
  const [selectedSupplier, setSelectedSupplier] = useState<string>("all");
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [location, setLocation] = useLocation();
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const currentDate = new Date();
  const [dateFilter, setDateFilter] = useState<{
    startDate: string;
    endDate: string;
  }>({
    startDate: format(startOfMonth(currentDate), "yyyy-MM-dd"),
    endDate: format(endOfMonth(currentDate), "yyyy-MM-dd"),
  });

  const { data: departments } = useQuery({
    queryKey: ["/api/departments"],
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const { data: users } = useQuery({
    queryKey: ["/api/users"],
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const { data: suppliers } = useQuery({
    queryKey: ["/api/suppliers"],
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const requestId = urlParams.get("request");
    const phase = urlParams.get("phase");
    const search = urlParams.get("search");
    if (search) {
      setSearchFilter(decodeURIComponent(search));
    } else {
      setSearchFilter("");
    }
    if (requestId) {
      setTimeout(() => {
        const event = new CustomEvent("openRequestFromUrl", {
          detail: { requestId: parseInt(requestId), phase: phase || "solicitacao" },
        });
        window.dispatchEvent(event);
      }, 500);
    }
  }, [location]);

  useEffect(() => {
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    setIsFiltersOpen(!isMobile ? true : false);
    const handleToggle = () => {
      setIsFiltersOpen((prev) => {
        const next = !prev;
        const syncEvt = new CustomEvent("filtersStateSync", { detail: { open: next } });
        window.dispatchEvent(syncEvt);
        return next;
      });
    };
    window.addEventListener("toggleFiltersPanel", handleToggle);
    return () => window.removeEventListener("toggleFiltersPanel", handleToggle);
  }, []);

  return (
    <div className="flex flex-col min-h-[100svh]">
      <div className="flex-shrink-0 bg-background border-b border-border px-4 md:px-6 py-3 shadow-sm">
        <div className="md:hidden">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-foreground">Processo de Compras</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Gerencie suas solicitações através do workflow Kanban</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" className="bg-primary text-primary-foreground">Kanban</Button>
              <Button variant="outline" size="sm" onClick={() => setLocation("/list")}>Lista</Button>
            </div>
          </div>
          <div id="filters-panel" className={`filters-collapsible ${isFiltersOpen ? 'filters-open' : 'filters-closed'}`} aria-hidden={!isFiltersOpen}>
            <div className="flex flex-col space-y-1.5">
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger className="w-full h-8 text-sm">
                  <SelectValue placeholder="Todos os Departamentos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Departamentos</SelectItem>
                  {Array.isArray(departments) && departments.map((dept: any) => (
                    <SelectItem key={dept.id} value={dept.id.toString()}>{dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedUrgency} onValueChange={setSelectedUrgency}>
                <SelectTrigger className="w-full h-8 text-sm">
                  <SelectValue placeholder="Todas as Urgências" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Urgências</SelectItem>
                  <SelectItem value="alta_urgencia">Alta Urgência</SelectItem>
                  <SelectItem value="alto">Alta</SelectItem>
                  <SelectItem value="medio">Média</SelectItem>
                  <SelectItem value="baixo">Baixa</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedRequester} onValueChange={setSelectedRequester}>
                <SelectTrigger className="w-full h-8 text-sm">
                  <SelectValue placeholder="Todos os Solicitantes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Solicitantes</SelectItem>
                  {Array.isArray(users) && users
                    .sort((a: any, b: any) => {
                      const nameA = a.firstName && a.lastName ? `${a.firstName} ${a.lastName}` : a.username;
                      const nameB = b.firstName && b.lastName ? `${b.firstName} ${b.lastName}` : b.username;
                      return nameA.localeCompare(nameB, 'pt-BR', { sensitivity: 'base' });
                    })
                    .map((user: any) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.username}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                <SelectTrigger className="w-full h-8 text-sm">
                  <SelectValue placeholder="Todos os Fornecedores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Fornecedores</SelectItem>
                  {Array.isArray(suppliers) && suppliers
                    .sort((a: any, b: any) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
                    .map((supplier: any) => (
                      <SelectItem key={supplier.id} value={supplier.id.toString()}>{supplier.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <Label htmlFor="startDate" className="text-xs text-muted-foreground">Data Inicial</Label>
                  <Input id="startDate" type="date" value={dateFilter.startDate} onChange={(e) => setDateFilter((prev) => ({ ...prev, startDate: e.target.value }))} className="text-xs h-8" />
                </div>
                <div>
                  <Label htmlFor="endDate" className="text-xs text-muted-foreground">Data Final</Label>
                  <Input id="endDate" type="date" value={dateFilter.endDate} onChange={(e) => setDateFilter((prev) => ({ ...prev, endDate: e.target.value }))} className="text-xs h-8" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-muted/40 dark:bg-background overflow-auto">
        <KanbanBoard
          departmentFilter={selectedDepartment}
          urgencyFilter={selectedUrgency}
          requesterFilter={selectedRequester}
          supplierFilter={selectedSupplier}
          searchFilter={searchFilter}
          dateFilter={dateFilter}
        />
      </div>
    </div>
  );
}
