import { Badge } from "@/shared/ui/badge";
import { RECEIPT_PHASE_COLORS, ReceiptPhase, RECEIPT_PHASES } from "@/lib/types";
import { ReceiptKanbanCard } from "./receipt-kanban-card";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

interface ReceiptKanbanColumnProps {
  phase: ReceiptPhase;
  title: string;
  receipts: any[];
  onOpenReceipt?: (receipt: any) => void;
}

export default function ReceiptKanbanColumn({
  phase,
  title,
  receipts: receiptsData,
  onOpenReceipt
}: ReceiptKanbanColumnProps) {
  const phaseColor = RECEIPT_PHASE_COLORS[phase as keyof typeof RECEIPT_PHASE_COLORS] || 'gray';
  
  // Use a unique ID for the droppable area to distinguish Flow 1 from Flow 2
  const columnId = `receipt-column-${phase}`;
  
  const { setNodeRef, isOver } = useDroppable({
    id: columnId,
    data: {
        type: 'receipt-column',
        phase: phase
    }
  });

  // Unique IDs for sortable items
  const itemIds = receiptsData.map((rec) => `receipt-${rec.id}`);

  const isFinalPhase = phase === RECEIPT_PHASES.CONCLUIDO || phase === RECEIPT_PHASES.CANCELADO;

  return (
    <div className="flex-shrink-0 w-full md:w-80 h-full border-l-2 border-dashed border-muted pl-4">
      <div className={"rounded-lg shadow-md h-full flex flex-col bg-card/60 border border-border"}>
        <div className={"p-3 border-b border-border bg-card"}>
          <div className="flex items-center justify-between">
            <h3 className={`font-semibold flex items-center text-sm md:text-base lg:text-sm ${isFinalPhase ? 'text-muted-foreground' : 'text-foreground'}`}>
              <div
                className={`w-2 h-2 md:w-3 md:h-3 lg:w-2 lg:h-2 rounded-full mr-1 md:mr-2 lg:mr-1`}
                style={{ backgroundColor: phaseColor }}
              />
              {title}
            </h3>
            <Badge variant="secondary" className={"text-xs"}>
              {receiptsData.length}
            </Badge>
          </div>
        </div>
        <div
          ref={setNodeRef}
          className={`flex-1 p-2 md:p-3 lg:p-2 overflow-y-auto space-y-1 md:space-y-2 lg:space-y-1 transition-colors ${isOver ? "bg-accent/50" : ""}`}
        >
          <SortableContext
            id={columnId}
            items={itemIds}
            strategy={verticalListSortingStrategy}
          >
            {receiptsData.map((receipt) => (
              <ReceiptKanbanCard
                key={`receipt-${receipt.id}`}
                receipt={receipt}
                onClick={() => onOpenReceipt?.(receipt)}
              />
            ))}
          </SortableContext>
          {receiptsData.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-4 md:py-6 lg:py-4 italic border-2 border-dashed border-muted rounded-lg m-2">
              Nenhum item nesta etapa
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
