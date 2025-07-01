import { useState } from "react";
import KanbanBoard from "@/components/kanban-board";
import NewRequestModal from "@/components/new-request-modal";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";

export default function KanbanPage() {
  const [isNewRequestModalOpen, setIsNewRequestModalOpen] = useState(false);

  return (
    <div className="flex flex-col h-full">
      {/* Fixed Board Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Gestão de Compras</h2>
            <p className="text-sm text-gray-500">Visualização em Kanban - Workflow de Compras</p>
          </div>
          <div className="flex items-center space-x-3">
            {/* Filters */}
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
            
            <Button 
              onClick={() => setIsNewRequestModalOpen(true)}
              className="bg-primary hover:bg-primary/90"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nova Solicitação
            </Button>
          </div>
        </div>
      </div>
      
      {/* Scrollable Kanban Board Container */}
      <div className="flex-1 overflow-hidden">
        <KanbanBoard />
      </div>
      
      <NewRequestModal 
        open={isNewRequestModalOpen}
        onOpenChange={setIsNewRequestModalOpen}
      />
    </div>
  );
}
