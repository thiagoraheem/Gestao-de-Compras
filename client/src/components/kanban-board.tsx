import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PURCHASE_PHASES, PHASE_LABELS } from "@/lib/types";
import KanbanColumn from "./kanban-column";
import { Skeleton } from "@/components/ui/skeleton";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCorners } from "@dnd-kit/core";
import { useState } from "react";
import PurchaseCard from "./purchase-card";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import RFQCreation from "./rfq-creation";

export default function KanbanBoard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeRequest, setActiveRequest] = useState<any>(null);
  const [showRFQModal, setShowRFQModal] = useState(false);
  const [selectedRequestForRFQ, setSelectedRequestForRFQ] = useState<any>(null);
  const [showRFQCreation, setShowRFQCreation] = useState(false);

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

  // Get approved requests that don't have RFQs for the shortcut button
  const approvedRequests = Array.isArray(purchaseRequests) 
    ? purchaseRequests.filter(request => 
        request.currentPhase === PURCHASE_PHASES.COTACAO && 
        request.approvedA1 && 
        !request.hasQuotation
      )
    : [];

  const handleCreateRFQ = (request: any) => {
    setSelectedRequestForRFQ(request);
    setShowRFQModal(false);
    setShowRFQCreation(true);
  };

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
      
      {/* RFQ Shortcut Button for Buyers */}
      {user?.isBuyer && approvedRequests.length > 0 && (
        <Button
          className="fixed bottom-20 right-6 rounded-full w-14 h-14 shadow-lg bg-purple-600 hover:bg-purple-700 z-50"
          onClick={() => setShowRFQModal(true)}
          title="Criar RFQ para solicitação aprovada"
        >
          <Plus className="h-6 w-6" />
        </Button>
      )}

      {/* RFQ Selection Modal */}
      <Dialog open={showRFQModal} onOpenChange={setShowRFQModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Selecionar Solicitação para RFQ</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {approvedRequests.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                Nenhuma solicitação aprovada disponível para RFQ
              </p>
            ) : (
              approvedRequests.map((request) => (
                <Card key={request.id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge>{request.requestNumber}</Badge>
                          <Badge variant="outline">{request.category}</Badge>
                        </div>
                        <h4 className="font-medium mb-1">{request.justification}</h4>
                        <p className="text-sm text-gray-600">
                          <strong>Solicitante:</strong> {request.requester?.firstName} {request.requester?.lastName}
                        </p>
                        {request.totalValue && (
                          <p className="text-sm text-gray-600">
                            <strong>Valor:</strong> {new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            }).format(Number(request.totalValue))}
                          </p>
                        )}
                      </div>
                      <Button
                        onClick={() => handleCreateRFQ(request)}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        Criar RFQ
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* RFQ Creation Modal */}
      {showRFQCreation && selectedRequestForRFQ && (
        <RFQCreation
          purchaseRequest={selectedRequestForRFQ}
          onClose={() => {
            setShowRFQCreation(false);
            setSelectedRequestForRFQ(null);
          }}
          onComplete={() => {
            setShowRFQCreation(false);
            setSelectedRequestForRFQ(null);
            queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
          }}
        />
      )}
    </DndContext>
  );
}
