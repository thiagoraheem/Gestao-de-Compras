import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PURCHASE_PHASES, PHASE_LABELS } from "@/lib/types";
import KanbanColumn from "./kanban-column";
import { Skeleton } from "@/components/ui/skeleton";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCorners } from "@dnd-kit/core";
import { useState } from "react";
import PurchaseCard from "./purchase-card";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function KanbanBoard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeRequest, setActiveRequest] = useState<any>(null);

  const { data: purchaseRequests, isLoading } = useQuery({
    queryKey: ["/api/purchase-requests"],
  });

  const moveRequestMutation = useMutation({
    mutationFn: async ({ id, newPhase }: { id: number; newPhase: string }) => {
      await apiRequest("PATCH", `/api/purchase-requests/${id}/update-phase`, {
        newPhase,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      toast({
        title: "Sucesso",
        description: "Item movido com sucesso!",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao mover item",
        variant: "destructive",
      });
    },
  });

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    
    // Find the active request for overlay
    const request = Array.isArray(purchaseRequests) 
      ? purchaseRequests.find((req: any) => `request-${req.id}` === active.id)
      : undefined;
    setActiveRequest(request);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const requestId = active.id.toString().includes('-')
        ? parseInt(active.id.toString().split('-')[1])
        : parseInt(active.id.toString());

      if (isNaN(requestId)) {
        toast({
          title: "Erro",
          description: "ID do pedido inválido",
          variant: "destructive",
        });
        return;
      }

      const newPhase = over.id.toString();

      // Verificar se o destino é uma fase válida
      const validPhases = ['solicitacao', 'aprovacao_a1', 'cotacao', 'aprovacao_a2', 'pedido_compra', 'recebimento', 'arquivado'];
      if (!validPhases.includes(newPhase)) {
        toast({
          title: "Erro",
          description: "Fase inválida",
          variant: "destructive",
        });
        return;
      }

      moveRequestMutation.mutate({ id: requestId, newPhase });
    }

    setActiveId(null);
    setActiveRequest(null);
  };

  if (isLoading) {
    return (
      <div className="h-full overflow-x-auto px-6 py-4">
        <div className="flex space-x-6" style={{ minWidth: "max-content", height: "calc(100vh - 200px)" }}>
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
  const requestsByPhase = Array.isArray(purchaseRequests) 
    ? purchaseRequests.reduce((acc: any, request: any) => {
        const phase = request.currentPhase || PURCHASE_PHASES.SOLICITACAO;
        if (!acc[phase]) acc[phase] = [];
        acc[phase].push(request);
        return acc;
      }, {})
    : {};

  return (
    <DndContext
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-full overflow-x-auto px-6 py-4">
        <div className="flex space-x-6" style={{ minWidth: "max-content", height: "calc(100vh - 200px)" }}>
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
      
      <DragOverlay>
        {activeRequest && (
          <div className="rotate-6 transform">
            <PurchaseCard 
              request={activeRequest} 
              phase={activeRequest.currentPhase}
              isDragging={true}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
