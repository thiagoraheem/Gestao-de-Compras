import { Badge } from "@/components/ui/badge";
import { PHASE_COLORS, PurchasePhase } from "@/lib/types";
import PurchaseCard from "./purchase-card";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

interface KanbanColumnProps {
  phase: PurchasePhase;
  title: string;
  requests: any[];
}

export default function KanbanColumn({ phase, title, requests }: KanbanColumnProps) {
  const phaseColor = PHASE_COLORS[phase];
  const { setNodeRef, isOver } = useDroppable({
    id: phase,
  });
  
  // Criar IDs consistentes para os itens
  const itemIds = requests.map((req) => `request-${req.id}`);

  return (
    <div className="flex-shrink-0 w-80">
      <div className="bg-white rounded-lg shadow-md h-full flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 flex items-center">
              <div 
                className="w-3 h-3 rounded-full mr-2"
                style={{ backgroundColor: phaseColor }}
              />
              {title}
            </h3>
            <Badge variant="secondary" className="text-xs">
              {requests.length}
            </Badge>
          </div>
        </div>
        <div 
          ref={setNodeRef}
          className={`flex-1 p-4 overflow-y-auto space-y-3 transition-colors ${
            isOver ? "bg-blue-50" : ""
          }`}
        >
          <SortableContext 
            items={itemIds}
            strategy={verticalListSortingStrategy}
          >
            {requests.map((request) => (
              <PurchaseCard 
                key={`request-${request.id}`}
                request={request}
                phase={phase}
              />
            ))}
          </SortableContext>
          {requests.length === 0 && (
            <div className="text-center text-gray-500 text-sm py-8">
              Nenhuma solicitação nesta fase
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
