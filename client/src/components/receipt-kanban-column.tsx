import { Badge } from "@/components/ui/badge";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import ReceiptKanbanCard, { ReceiptKanbanRow } from "./receipt-kanban-card";

export default function ReceiptKanbanColumn({
  phaseId,
  title,
  receipts,
  onOpenReceipt,
  canDeleteGhost,
  onDeleteGhost,
}: {
  phaseId: string;
  title: string;
  receipts: ReceiptKanbanRow[];
  onOpenReceipt?: (r: ReceiptKanbanRow) => void;
  canDeleteGhost?: boolean;
  onDeleteGhost?: (r: ReceiptKanbanRow) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: phaseId });
  const itemIds = receipts.map((r) => `receipt-${r.id}`);

  return (
    <div className="flex-shrink-0 w-full md:w-80">
      <div className={"rounded-lg shadow-md h-full flex flex-col bg-card border border-border"}>
        <div className={"p-3 border-b border-border bg-card"}>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center text-sm md:text-base lg:text-sm text-foreground">
              <div className="w-2 h-2 md:w-3 md:h-3 lg:w-2 lg:h-2 rounded-full mr-1 md:mr-2 lg:mr-1 bg-primary" />
              {title}
            </h3>
            <Badge variant="secondary" className={"text-xs"}>
              {receipts.length}
            </Badge>
          </div>
        </div>
        <div
          ref={setNodeRef}
          className={`flex-1 p-2 md:p-3 lg:p-2 overflow-y-auto space-y-1 md:space-y-2 lg:space-y-1 transition-colors ${isOver ? "bg-accent/50" : ""}`}
        >
          <SortableContext id={phaseId} items={itemIds} strategy={verticalListSortingStrategy}>
            {receipts.map((r) => (
              <ReceiptKanbanCard
                key={`receipt-${r.id}`}
                receipt={r}
                onOpen={onOpenReceipt}
                canDeleteGhost={canDeleteGhost}
                onDeleteGhost={onDeleteGhost}
              />
            ))}
          </SortableContext>
          {receipts.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-4 md:py-6 lg:py-4">
              Nenhum recebimento nesta fase
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
