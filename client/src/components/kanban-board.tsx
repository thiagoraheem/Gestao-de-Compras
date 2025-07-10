import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PURCHASE_PHASES, PHASE_LABELS } from "@/lib/types";
import KanbanColumn from "./kanban-column";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  closestCorners,
} from "@dnd-kit/core";
import { useState, useEffect } from "react";
import PurchaseCard from "./purchase-card";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import RFQCreation from "./rfq-creation";

interface KanbanBoardProps {
  departmentFilter?: string;
  urgencyFilter?: string;
  dateFilter?: {
    startDate: string;
    endDate: string;
  };
}

export default function KanbanBoard({
  departmentFilter = "all",
  urgencyFilter = "all",
  dateFilter,
}: KanbanBoardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeRequest, setActiveRequest] = useState<any>(null);
  const [showRFQCreation, setShowRFQCreation] = useState(false);
  const [selectedRequestForRFQ, setSelectedRequestForRFQ] = useState<any>(null);

  const { data: purchaseRequests, isLoading } = useQuery({
    queryKey: ["/api/purchase-requests"],
    refetchInterval: 20000, // More frequent refetch - every 3 seconds for kanban updates
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    staleTime: 1000, // Very short stale time - 1 second for real-time feel
  });

  // Listen for URL-based request opening
  useEffect(() => {
    const handleOpenRequestFromUrl = (event: any) => {
      const { requestId, phase } = event.detail;

      if (purchaseRequests && Array.isArray(purchaseRequests)) {
        const request = purchaseRequests.find(
          (req: any) => req.id === requestId,
        );
        if (request) {
          // Trigger the modal for the specific request based on its current phase
          const cardElement = document.querySelector(
            `[data-request-id="${requestId}"]`,
          );
          if (cardElement) {
            (cardElement as HTMLElement).click();
          }
        }
      }
    };

    window.addEventListener("openRequestFromUrl", handleOpenRequestFromUrl);

    return () => {
      window.removeEventListener(
        "openRequestFromUrl",
        handleOpenRequestFromUrl,
      );
    };
  }, [purchaseRequests]);

  const moveRequestMutation = useMutation({
    mutationFn: async ({ id, newPhase }: { id: number; newPhase: string }) => {
      await apiRequest("PATCH", `/api/purchase-requests/${id}/update-phase`, {
        newPhase,
      });
    },
    onMutate: async ({ id, newPhase }) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: ["/api/purchase-requests"] });

      // Snapshot the previous value
      const previousRequests = queryClient.getQueryData([
        "/api/purchase-requests",
      ]);

      // Optimistically update to the new value
      queryClient.setQueryData(["/api/purchase-requests"], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((request: any) =>
          request.id === id ? { ...request, currentPhase: newPhase } : request,
        );
      });

      // Return a context object with the snapshotted value
      return { previousRequests };
    },
    onError: (error, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousRequests) {
        queryClient.setQueryData(
          ["/api/purchase-requests"],
          context.previousRequests,
        );
      }

      let errorMessage = "Falha ao mover item";

      // Handle specific error messages from backend
      if (error?.message) {
        if (error.message.includes("permissão")) {
          errorMessage = error.message;
        } else if (error.message.includes("cotação")) {
          errorMessage = error.message;
        } else if (error.message.includes("fornecedor")) {
          errorMessage = error.message;
        } else if (error.message.includes("Aprovação A2")) {
          errorMessage = error.message;
        } else {
          errorMessage = error.message;
        }
      }

      toast({
        title: "Movimento Bloqueado",
        description: errorMessage,
        variant: "destructive",
      });
    },
    onSuccess: () => {
      // Comprehensive cache invalidation for all related queries
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
      // Invalidate all quotation status and related queries
      queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0]?.toString().includes(`/api/quotations/`) ||
          query.queryKey[0]?.toString().includes(`/api/purchase-requests`),
      });

      // Force immediate refetch for absolute certainty
      queryClient.refetchQueries({ queryKey: ["/api/purchase-requests"] });

      toast({
        title: "Sucesso",
        description: "Item movido com sucesso!",
      });
    },
  });

  // Permission check function
  const canUserDragCard = (phase: string) => {
    if (phase === "aprovacao_a1" && !user?.isApproverA1) {
      return false;
    }
    if (phase === "aprovacao_a2" && !user?.isApproverA2) {
      return false;
    }
    return true;
  };

  // Function to check if quotation is ready for A2 approval
  const isQuotationReadyForA2 = async (requestId: number): Promise<boolean> => {
    try {
      const quotation = await apiRequest(
        "GET",
        `/api/quotations/purchase-request/${requestId}`,
      );
      if (!quotation) return false;

      const supplierQuotations = await apiRequest(
        "GET",
        `/api/quotations/${quotation.id}/supplier-quotations`,
      );
      if (!supplierQuotations || supplierQuotations.length === 0) return false;

      return supplierQuotations.some((sq: any) => sq.isChosen);
    } catch (error) {
      console.error(
        "Error checking quotation status for request",
        requestId,
        ":",
        error,
      );
      return false;
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);

    // Find the active request for overlay
    const request = Array.isArray(purchaseRequests)
      ? purchaseRequests.find((req: any) => `request-${req.id}` === active.id)
      : undefined;

    // Check if user has permission to drag this card
    if (request && !canUserDragCard(request.currentPhase)) {
      toast({
        title: "Acesso Negado",
        description: `Você não possui permissão para mover cards da fase ${PHASE_LABELS[request.currentPhase]}`,
        variant: "destructive",
      });
      return;
    }

    setActiveRequest(request);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const requestId = active.id.toString().includes("-")
        ? parseInt(active.id.toString().split("-")[1])
        : parseInt(active.id.toString());

      if (isNaN(requestId)) {
        toast({
          title: "Erro",
          description: "ID do pedido inválido",
          variant: "destructive",
        });
        setActiveId(null);
        setActiveRequest(null);
        return;
      }

      // Find the request to check current phase
      const request = Array.isArray(purchaseRequests)
        ? purchaseRequests.find((req: any) => req.id === requestId)
        : undefined;

      if (!request) {
        toast({
          title: "Erro",
          description: "Solicitação não encontrada",
          variant: "destructive",
        });
        setActiveId(null);
        setActiveRequest(null);
        return;
      }

      // Check permissions before allowing the move
      if (!canUserDragCard(request.currentPhase)) {
        toast({
          title: "Acesso Negado",
          description: `Você não possui permissão para mover cards da fase ${PHASE_LABELS[request.currentPhase]}`,
          variant: "destructive",
        });
        setActiveId(null);
        setActiveRequest(null);
        return;
      }

      const newPhase = over.id.toString();

      // Check if moving from "Cotação" to "Aprovação A2" - validate quotation readiness
      if (request.currentPhase === "cotacao" && newPhase === "aprovacao_a2") {
        try {
          const isReady = await isQuotationReadyForA2(requestId);
          if (!isReady) {
            toast({
              title: "Cotação Incompleta",
              description:
                "Para avançar para Aprovação A2, é necessário completar a análise de cotações e selecionar um fornecedor vencedor.",
              variant: "destructive",
            });
            setActiveId(null);
            setActiveRequest(null);
            return;
          }
        } catch (error) {
          toast({
            title: "Erro de Validação",
            description:
              "Erro ao verificar status da cotação. Tente novamente.",
            variant: "destructive",
          });
          setActiveId(null);
          setActiveRequest(null);
          return;
        }
      }

      // Verificar se o destino é uma fase válida
      const validPhases = [
        "solicitacao",
        "aprovacao_a1",
        "cotacao",
        "aprovacao_a2",
        "pedido_compra",
        "recebimento",
        "arquivado",
      ];
      if (!validPhases.includes(newPhase)) {
        toast({
          title: "Erro",
          description: "Fase inválida",
          variant: "destructive",
        });
        setActiveId(null);
        setActiveRequest(null);
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
        <div
          className="flex space-x-6"
          style={{ minWidth: "max-content", height: "calc(100vh - 200px)" }}
        >
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

  // Filter requests based on department, urgency, and date
  const filteredRequests = Array.isArray(purchaseRequests)
    ? purchaseRequests.filter((request: any) => {
        let passesFilters = true;

        // Department filter - use nested department object
        if (departmentFilter !== "all") {
          passesFilters =
            passesFilters &&
            request.department?.id?.toString() === departmentFilter;
        }

        // Urgency filter - exact match
        if (urgencyFilter !== "all") {
          passesFilters = passesFilters && request.urgency === urgencyFilter;
        }

        // Date filter - apply to conclusion and archived items
        if (
          dateFilter &&
          (request.currentPhase === PURCHASE_PHASES.ARQUIVADO ||
            request.currentPhase === PURCHASE_PHASES.CONCLUSAO_COMPRA)
        ) {
          const requestDate = new Date(request.updatedAt || request.createdAt);
          const startDate = new Date(dateFilter.startDate);
          const endDate = new Date(dateFilter.endDate);
          endDate.setHours(23, 59, 59, 999); // Include the full end date

          passesFilters =
            passesFilters && requestDate >= startDate && requestDate <= endDate;
        }

        return passesFilters;
      })
    : [];

  // Sort function: First by urgency (Alto > Médio > Baixo), then by date
  const sortRequestsByPriority = (requests: any[]) => {
    const urgencyOrder = { alto: 1, medio: 2, baixo: 3 };

    return [...requests].sort((a, b) => {
      // First priority: urgency
      const urgencyA =
        urgencyOrder[a.urgency as keyof typeof urgencyOrder] || 999;
      const urgencyB =
        urgencyOrder[b.urgency as keyof typeof urgencyOrder] || 999;

      if (urgencyA !== urgencyB) {
        return urgencyA - urgencyB;
      }

      // Second priority: ideal delivery date (earlier dates first)
      const dateA = new Date(a.idealDeliveryDate);
      const dateB = new Date(b.idealDeliveryDate);

      return dateA.getTime() - dateB.getTime();
    });
  };

  // Group filtered requests by phase and sort each phase
  const requestsByPhase = filteredRequests.reduce((acc: any, request: any) => {
    const phase = request.currentPhase || PURCHASE_PHASES.SOLICITACAO;
    if (!acc[phase]) acc[phase] = [];
    acc[phase].push(request);
    return acc;
  }, {});

  // Apply sorting to each phase
  Object.keys(requestsByPhase).forEach((phase) => {
    requestsByPhase[phase] = sortRequestsByPriority(requestsByPhase[phase]);
  });

  const handleCreateRFQ = (request: any) => {
    setSelectedRequestForRFQ(request);
    setShowRFQCreation(true);
  };

  return (
    <DndContext
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-full overflow-x-auto px-4 md:px-6 py-4 kanban-scroll">
        <div
          className="flex space-x-4 md:space-x-6"
          style={{ minWidth: "max-content", height: "calc(100vh - 200px)" }}
        >
          {Object.values(PURCHASE_PHASES).map((phase) => (
            <KanbanColumn
              key={phase}
              phase={phase}
              title={PHASE_LABELS[phase]}
              requests={requestsByPhase[phase] || []}
              onCreateRFQ={handleCreateRFQ}
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
            // Comprehensive cache invalidation
            queryClient.invalidateQueries({
              queryKey: ["/api/purchase-requests"],
            });
            queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
            queryClient.invalidateQueries({
              predicate: (query) =>
                query.queryKey[0]?.toString().includes(`/api/quotations/`) ||
                query.queryKey[0]
                  ?.toString()
                  .includes(`/api/purchase-requests`),
            });
          }}
        />
      )}
    </DndContext>
  );
}