import KanbanBoard from "@/components/kanban-board";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

export default function KanbanPage() {
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [selectedUrgency, setSelectedUrgency] = useState<string>("all");

  const { data: departments } = useQuery({
    queryKey: ["/api/departments"],
  });

  return (
    <div className="flex flex-col min-h-screen">
      {/* Board Header - estilo Pipefy */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 md:px-6 py-4 shadow-sm">
        {/* Mobile Layout */}
        <div className="flex flex-col space-y-4 md:hidden">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Processo de Compras</h1>
            <p className="text-sm text-gray-500 mt-1">Gerencie suas solicitações através do workflow Kanban</p>
          </div>
          <div className="flex flex-col space-y-2">
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Todos os Departamentos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Departamentos</SelectItem>
                {Array.isArray(departments) && departments.map((dept: any) => (
                  <SelectItem key={dept.id} value={dept.id.toString()}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={selectedUrgency} onValueChange={setSelectedUrgency}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Todas as Urgências" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Urgências</SelectItem>
                <SelectItem value="Alto">Alta</SelectItem>
                <SelectItem value="Médio">Média</SelectItem>
                <SelectItem value="Baixo">Baixa</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden md:flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Processo de Compras</h1>
            <p className="text-sm text-gray-500 mt-1">Gerencie suas solicitações de compra através do workflow Kanban</p>
          </div>
          <div className="flex items-center space-x-3">
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Todos os Departamentos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Departamentos</SelectItem>
                {Array.isArray(departments) && departments.map((dept: any) => (
                  <SelectItem key={dept.id} value={dept.id.toString()}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={selectedUrgency} onValueChange={setSelectedUrgency}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Todas as Urgências" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Urgências</SelectItem>
                <SelectItem value="Alto">Alta</SelectItem>
                <SelectItem value="Médio">Média</SelectItem>
                <SelectItem value="Baixo">Baixa</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Kanban Board Full Width */}
      <div className="flex-1 bg-gray-50 overflow-hidden">
        <KanbanBoard 
          departmentFilter={selectedDepartment}
          urgencyFilter={selectedUrgency}
        />
      </div>
    </div>
  );
}