import { Badge } from "@/components/ui/badge";
import { PHASE_COLORS, PurchasePhase, PURCHASE_PHASES } from "@/lib/types";
import PurchaseCard from "./purchase-card";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

interface KanbanColumnProps {
  phase: PurchasePhase;
  title: string;
  requests: any[];
  onCreateRFQ?: (request: any) => void;
}

export default function KanbanColumn({ phase, title, requests, onCreateRFQ }: KanbanColumnProps) {
  const phaseColor = PHASE_COLORS[phase];
  const { setNodeRef, isOver } = useDroppable({
    id: phase,
  });
  
  // Criar IDs consistentes para os itens
  const itemIds = requests.map((req) => `request-${req.id}`);
  
  // Check if this is a final phase
  const isFinalPhase = phase === PURCHASE_PHASES.ARQUIVADO || phase === PURCHASE_PHASES.CONCLUSAO_COMPRA;

  return (
    <div className="flex-shrink-0 w-80">
      <div className={`rounded-lg shadow-md h-full flex flex-col ${isFinalPhase ? 'bg-gray-50' : 'bg-white'}`}>
        <div className={`p-4 border-b ${isFinalPhase ? 'border-gray-300 bg-gray-100' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <h3 className={`font-semibold flex items-center ${isFinalPhase ? 'text-gray-600' : 'text-gray-900'}`}>
              <div 
                className="w-3 h-3 rounded-full mr-2"
                style={{ backgroundColor: isFinalPhase ? '#9CA3AF' : phaseColor }}
              />
              {title}
            </h3>
            <Badge variant="secondary" className={`text-xs ${isFinalPhase ? 'bg-gray-300 text-gray-700' : ''}`}>
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
                onCreateRFQ={onCreateRFQ}
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
