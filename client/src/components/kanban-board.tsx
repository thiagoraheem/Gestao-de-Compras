import { useQuery } from "@tanstack/react-query";
import { PURCHASE_PHASES, PHASE_LABELS } from "@/lib/types";
import KanbanColumn from "./kanban-column";
import { Skeleton } from "@/components/ui/skeleton";

export default function KanbanBoard() {
  const { data: purchaseRequests, isLoading } = useQuery({
    queryKey: ["/api/purchase-requests"],
  });

  if (isLoading) {
    return (
      <div className="flex-1 overflow-x-auto kanban-scroll p-6">
        <div className="flex space-x-6 h-full" style={{ minWidth: "max-content" }}>
          {Object.values(PURCHASE_PHASES).map((phase) => (
            <div key={phase} className="flex-shrink-0 w-80">
              <div className="bg-white rounded-lg shadow-md h-full flex flex-col">
                <div className="p-4 border-b border-gray-200">
                  <Skeleton className="h-6 w-32" />
                </div>
                <div className="flex-1 p-4 space-y-3">
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Group requests by phase
  const requestsByPhase = purchaseRequests?.reduce((acc: any, request: any) => {
    const phase = request.currentPhase || PURCHASE_PHASES.SOLICITACAO;
    if (!acc[phase]) acc[phase] = [];
    acc[phase].push(request);
    return acc;
  }, {}) || {};

  return (
    <div className="flex-1 overflow-x-auto kanban-scroll p-6">
      <div className="flex space-x-6 h-full" style={{ minWidth: "max-content" }}>
        {Object.values(PURCHASE_PHASES).map((phase) => (
          <KanbanColumn
            key={phase}
            phase={phase}
            title={PHASE_LABELS[phase]}
            requests={requestsByPhase[phase] || []}
          />
        ))}
      </div>
    </div>
  );
}
