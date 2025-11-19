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

export default function KanbanPage() {
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [selectedUrgency, setSelectedUrgency] = useState<string>("all");
  const [selectedRequester, setSelectedRequester] = useState<string>("all");
  const [selectedSupplier, setSelectedSupplier] = useState<string>("all");
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [location, setLocation] = useLocation();

  // Date filter state - default to current month
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
    staleTime: 1000 * 60 * 5, // 5 minutes - departments don't change frequently
    refetchOnWindowFocus: false,
  });

  const { data: users } = useQuery({
    queryKey: ["/api/users"],
    staleTime: 1000 * 60 * 5, // 5 minutes - users don't change frequently
    refetchOnWindowFocus: false,
  });

  const { data: suppliers } = useQuery({
    queryKey: ["/api/suppliers"],
    staleTime: 1000 * 60 * 5, // 5 minutes - suppliers don't change frequently
    refetchOnWindowFocus: false,
  });

  // Check for URL parameters to auto-open specific requests and apply search filters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const requestId = urlParams.get("request");
    const phase = urlParams.get("phase");
    const search = urlParams.get("search");

    // Apply search filter from URL
    if (search) {
      setSearchFilter(decodeURIComponent(search));
    } else {
      setSearchFilter("");
    }

    if (requestId) {
      // Give the board a moment to load then trigger the request modal
      setTimeout(() => {
        const event = new CustomEvent("openRequestFromUrl", {
          detail: {
            requestId: parseInt(requestId),
            phase: phase || "solicitacao",
          },
        });
        window.dispatchEvent(event);
      }, 500);
    }
  }, [location]); // React to URL location changes

  // Listen for global search events
  useEffect(() => {
    const handleGlobalSearch = (event: any) => {
      const { searchTerm } = event.detail;
      setSearchFilter(searchTerm || "");
    };

    window.addEventListener("globalSearchApplied", handleGlobalSearch);

    return () => {
      window.removeEventListener("globalSearchApplied", handleGlobalSearch);
    };
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Board Header - estilo Pipefy */}
      <div className="flex-shrink-0 bg-background border-b border-border px-4 md:px-6 py-3 shadow-sm">
        {/* Mobile Layout */}
        <div className="flex flex-col space-y-3 md:hidden">
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
          <div className="flex flex-col space-y-1.5">
            <Select
              value={selectedDepartment}
              onValueChange={setSelectedDepartment}
            >
              <SelectTrigger className="w-full h-8 text-sm">
                <SelectValue placeholder="Todos os Departamentos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Departamentos</SelectItem>
                {Array.isArray(departments) &&
                  departments.map((dept: any) => (
                    <SelectItem key={dept.id} value={dept.id.toString()}>
                      {dept.name}
                    </SelectItem>
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
                {Array.isArray(users) &&
                  users
                    .sort((a: any, b: any) => {
                      const nameA = a.firstName && a.lastName
                        ? `${a.firstName} ${a.lastName}`
                        : a.username;
                      const nameB = b.firstName && b.lastName
                        ? `${b.firstName} ${b.lastName}`
                        : b.username;
                      return nameA.localeCompare(nameB, 'pt-BR', { sensitivity: 'base' });
                    })
                    .map((user: any) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.firstName && user.lastName
                          ? `${user.firstName} ${user.lastName}`
                          : user.username}
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
                {Array.isArray(suppliers) &&
                  suppliers
                    .sort((a: any, b: any) =>
                      a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
                    )
                    .map((supplier: any) => (
                      <SelectItem key={supplier.id} value={supplier.id.toString()}>
                        {supplier.name}
                      </SelectItem>
                    ))}
              </SelectContent>
            </Select>

            {/* Date Filter for Archived Items */}
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <Label htmlFor="startDate" className="text-xs text-muted-foreground">
                  Data Inicial
                </Label>
                <Input
                  id="startDate"
                  type="date"
                  value={dateFilter.startDate}
                  onChange={(e) =>
                    setDateFilter((prev) => ({
                      ...prev,
                      startDate: e.target.value,
                    }))
                  }
                  className="text-xs h-8"
                />
              </div>
              <div>
                <Label htmlFor="endDate" className="text-xs text-muted-foreground">
                  Data Final
                </Label>
                <Input
                  id="endDate"
                  type="date"
                  value={dateFilter.endDate}
                  onChange={(e) =>
                    setDateFilter((prev) => ({
                      ...prev,
                      endDate: e.target.value,
                    }))
                  }
                  className="text-xs h-8"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden md:block">
          {/* Title Section */}
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-foreground">Processo de Compras</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Gerencie suas solicitações de compra através do workflow Kanban</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" className="bg-primary text-primary-foreground">Kanban</Button>
              <Button variant="outline" size="sm" onClick={() => setLocation("/list")}>Lista</Button>
            </div>
          </div>

          {/* Filters Section */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Select
                value={selectedDepartment}
                onValueChange={setSelectedDepartment}
              >
                <SelectTrigger className="w-44 h-8 text-sm">
                  <SelectValue placeholder="Departamentos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Departamentos</SelectItem>
                  {Array.isArray(departments) &&
                    departments.map((dept: any) => (
                      <SelectItem key={dept.id} value={dept.id.toString()}>
                        {dept.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              <Select
                value={selectedUrgency}
                onValueChange={setSelectedUrgency}
              >
                <SelectTrigger className="w-36 h-8 text-sm">
                  <SelectValue placeholder="Urgências" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Urgências</SelectItem>
                  <SelectItem value="alta_urgencia">Alta Urgência</SelectItem>
                  <SelectItem value="alto">Alta</SelectItem>
                  <SelectItem value="medio">Média</SelectItem>
                  <SelectItem value="baixo">Baixa</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={selectedRequester}
                onValueChange={setSelectedRequester}
              >
                <SelectTrigger className="w-44 h-8 text-sm">
                  <SelectValue placeholder="Solicitantes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Solicitantes</SelectItem>
                  {Array.isArray(users) &&
                    users
                      .sort((a: any, b: any) => {
                        const nameA = a.firstName && a.lastName
                          ? `${a.firstName} ${a.lastName}`
                          : a.username;
                        const nameB = b.firstName && b.lastName
                          ? `${b.firstName} ${b.lastName}`
                          : b.username;
                        return nameA.localeCompare(nameB, 'pt-BR', { sensitivity: 'base' });
                      })
                      .map((user: any) => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          {user.firstName && user.lastName
                            ? `${user.firstName} ${user.lastName}`
                            : user.username}
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>

              <Select
                value={selectedSupplier}
                onValueChange={setSelectedSupplier}
              >
                <SelectTrigger className="w-44 h-8 text-sm">
                  <SelectValue placeholder="Fornecedores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Fornecedores</SelectItem>
                  {Array.isArray(suppliers) &&
                    suppliers
                      .sort((a: any, b: any) =>
                        a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
                      )
                      .map((supplier: any) => (
                        <SelectItem key={supplier.id} value={supplier.id.toString()}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Filter for Archived Items */}
            <div className="flex items-center gap-2">
              <Label
                htmlFor="startDateDesktop"
                className="text-xs text-muted-foreground whitespace-nowrap font-medium"
              >
                Período:
              </Label>
              <Input
                id="startDateDesktop"
                type="date"
                value={dateFilter.startDate}
                onChange={(e) =>
                  setDateFilter((prev) => ({
                    ...prev,
                    startDate: e.target.value,
                  }))
                }
                className="w-36 h-8 text-xs"
              />
              <span className="text-muted-foreground text-xs whitespace-nowrap">
                até
              </span>
              <Input
                id="endDateDesktop"
                type="date"
                value={dateFilter.endDate}
                onChange={(e) =>
                  setDateFilter((prev) => ({
                    ...prev,
                    endDate: e.target.value,
                  }))
                }
                className="w-36 h-8 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Search Filter Indicator */}
        {searchFilter && (
          <div className="mt-3 px-4 py-2 bg-blue-50 border border-blue-200 rounded-md flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-blue-700 font-medium">
                🔍 Filtrado por: "{searchFilter}"
              </span>
            </div>
            <button
              onClick={() => {
                setSearchFilter("");
                setLocation("/");
              }}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium underline"
              data-testid="button-clear-search-filter"
            >
              Limpar filtro
            </button>
          </div>
        )}
      </div>

      {/* Kanban Board Full Width */}
      <div className="flex-1 bg-muted/40 dark:bg-background overflow-hidden">
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
