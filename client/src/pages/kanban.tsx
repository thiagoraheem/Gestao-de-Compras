import KanbanBoard from "@/components/kanban-board";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function KanbanPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Board Header - estilo Pipefy */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Processo de Compras</h1>
            <p className="text-sm text-gray-500 mt-1">Gerencie suas solicitações de compra através do workflow Kanban</p>
          </div>
          <div className="flex items-center space-x-3">
            {/* Filtros */}
            <Select>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Todos os Departamentos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Departamentos</SelectItem>
                <SelectItem value="ti">TI</SelectItem>
                <SelectItem value="financeiro">Financeiro</SelectItem>
                <SelectItem value="rh">RH</SelectItem>
                <SelectItem value="marketing">Marketing</SelectItem>
              </SelectContent>
            </Select>
            
            <Select>
              <SelectTrigger className="w-48">
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
        </div>
      </div>

      {/* Kanban Board Full Width */}
      <div className="flex-1 bg-gray-50 overflow-hidden">
        <KanbanBoard />
      </div>
    </div>
  );
}