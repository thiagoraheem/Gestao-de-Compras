import KanbanBoard from "@/components/kanban-board";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { useLocation } from "wouter";

export default function KanbanPage() {
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [selectedUrgency, setSelectedUrgency] = useState<string>("all");
  const [, setLocation] = useLocation();
  
  // Date filter state - default to current month
  const currentDate = new Date();
  const [dateFilter, setDateFilter] = useState<{
    startDate: string;
    endDate: string;
  }>({
    startDate: format(startOfMonth(currentDate), "yyyy-MM-dd"),
    endDate: format(endOfMonth(currentDate), "yyyy-MM-dd")
  });

  const { data: departments } = useQuery({
    queryKey: ["/api/departments"],
  });

  // Check for URL parameters to auto-open specific requests
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const requestId = urlParams.get('request');
    const phase = urlParams.get('phase');
    
    if (requestId) {
      // Give the board a moment to load then trigger the request modal
      setTimeout(() => {
        const event = new CustomEvent('openRequestFromUrl', { 
          detail: { 
            requestId: parseInt(requestId), 
            phase: phase || 'solicitacao' 
          } 
        });
        window.dispatchEvent(event);
      }, 500);
    }
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Board Header - estilo Pipefy */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 md:px-6 py-3 shadow-sm">
        {/* Mobile Layout */}
        <div className="flex flex-col space-y-3 md:hidden">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Processo de Compras</h1>
            <p className="text-xs text-gray-500 mt-0.5">Gerencie suas solicitações através do workflow Kanban</p>
          </div>
          <div className="flex flex-col space-y-1.5">
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger className="w-full h-8 text-sm">
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
              <SelectTrigger className="w-full h-8 text-sm">
                <SelectValue placeholder="Todas as Urgências" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Urgências</SelectItem>
                <SelectItem value="alto">Alta</SelectItem>
                <SelectItem value="medio">Média</SelectItem>
                <SelectItem value="baixo">Baixa</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Date Filter for Archived Items */}
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <Label htmlFor="startDate" className="text-xs text-gray-600">Data Inicial</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={dateFilter.startDate}
                  onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))}
                  className="text-xs h-8"
                />
              </div>
              <div>
                <Label htmlFor="endDate" className="text-xs text-gray-600">Data Final</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={dateFilter.endDate}
                  onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))}
                  className="text-xs h-8"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden md:block">
          {/* Title Section */}
          <div className="mb-3">
            <h1 className="text-xl font-semibold text-gray-900">Processo de Compras</h1>
            <p className="text-xs text-gray-500 mt-0.5">Gerencie suas solicitações de compra através do workflow Kanban</p>
          </div>
          
          {/* Filters Section */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger className="w-44 h-8 text-sm">
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
                <SelectTrigger className="w-36 h-8 text-sm">
                  <SelectValue placeholder="Todas as Urgências" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Urgências</SelectItem>
                  <SelectItem value="alto">Alta</SelectItem>
                  <SelectItem value="medio">Média</SelectItem>
                  <SelectItem value="baixo">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Date Filter for Archived Items */}
            <div className="flex items-center gap-1.5">
              <Label htmlFor="startDateDesktop" className="text-xs text-gray-600 whitespace-nowrap font-medium">Período:</Label>
              <Input
                id="startDateDesktop"
                type="date"
                value={dateFilter.startDate}
                onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-32 h-8 text-sm"
              />
              <span className="text-gray-500 text-xs">até</span>
              <Input
                id="endDateDesktop"
                type="date"
                value={dateFilter.endDate}
                onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))}
                className="w-32 h-8 text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Kanban Board Full Width */}
      <div className="flex-1 bg-gray-50 overflow-hidden">
        <KanbanBoard 
          departmentFilter={selectedDepartment}
          urgencyFilter={selectedUrgency}
          dateFilter={dateFilter}
        />
      </div>
    </div>
  );
}