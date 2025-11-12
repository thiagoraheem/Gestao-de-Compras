import RequestList from "@/components/request-list";
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
import { useEffect, useState } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export default function ListPage() {
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [selectedUrgency, setSelectedUrgency] = useState<string>("all");
  const [selectedRequester, setSelectedRequester] = useState<string>("all");
  const [selectedSupplier, setSelectedSupplier] = useState<string>("all");
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [location, setLocation] = useLocation();

  const currentDate = new Date();
  const [dateFilter, setDateFilter] = useState<{ startDate: string; endDate: string }>({
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
    const search = urlParams.get("search");
    if (search) {
      setSearchFilter(decodeURIComponent(search));
    } else {
      setSearchFilter("");
    }
  }, [location]);

  useEffect(() => {
    const handleGlobalSearch = (event: any) => {
      const { searchTerm } = event.detail;
      setSearchFilter(searchTerm || "");
    };
    window.addEventListener("globalSearchApplied", handleGlobalSearch);
    return () => window.removeEventListener("globalSearchApplied", handleGlobalSearch);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 md:px-6 py-3 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Lista de Solicitações</h1>
            <p className="text-xs text-gray-500 mt-0.5">Visualização compacta e elegante das solicitações de compra</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setLocation("/kanban")}>Kanban</Button>
            <Button size="sm" className="bg-primary text-primary-foreground">Lista</Button>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
            <SelectTrigger className="w-44 h-8 text-sm">
              <SelectValue placeholder="Departamentos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Departamentos</SelectItem>
              {Array.isArray(departments) && departments.map((dept: any) => (
                <SelectItem key={dept.id} value={dept.id.toString()}>{dept.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedUrgency} onValueChange={setSelectedUrgency}>
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

          <Select value={selectedRequester} onValueChange={setSelectedRequester}>
            <SelectTrigger className="w-44 h-8 text-sm">
              <SelectValue placeholder="Solicitantes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Solicitantes</SelectItem>
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
            <SelectTrigger className="w-44 h-8 text-sm">
              <SelectValue placeholder="Fornecedores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Fornecedores</SelectItem>
              {Array.isArray(suppliers) && suppliers
                .sort((a: any, b: any) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
                .map((supplier: any) => (
                  <SelectItem key={supplier.id} value={supplier.id.toString()}>{supplier.name}</SelectItem>
                ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Label htmlFor="startDateDesktop" className="text-xs text-gray-600 whitespace-nowrap font-medium">Período:</Label>
            <Input id="startDateDesktop" type="date" value={dateFilter.startDate} onChange={(e) => setDateFilter((prev) => ({ ...prev, startDate: e.target.value }))} className="w-36 h-8 text-xs" />
            <span className="text-gray-500 text-xs whitespace-nowrap">até</span>
            <Input id="endDateDesktop" type="date" value={dateFilter.endDate} onChange={(e) => setDateFilter((prev) => ({ ...prev, endDate: e.target.value }))} className="w-36 h-8 text-xs" />
          </div>
        </div>

        {searchFilter && (
          <div className="mt-3 px-4 py-2 bg-blue-50 border border-blue-200 rounded-md flex items-center justify-between">
            <span className="text-sm text-blue-700 font-medium">🔍 Filtrado por: "{searchFilter}"</span>
            <button onClick={() => { setSearchFilter(""); setLocation("/list"); }} className="text-blue-600 hover:text-blue-800 text-sm font-medium underline" data-testid="button-clear-search-filter">Limpar filtro</button>
          </div>
        )}
      </div>

      <div className="flex-1 bg-gray-50 overflow-hidden">
        <RequestList
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

