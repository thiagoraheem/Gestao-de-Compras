import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PURCHASE_PHASES, PHASE_LABELS, type PurchasePhase, type ReceiptMode } from "@/lib/types";
import KanbanColumn from "./kanban-column";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  closestCorners,
} from "@dnd-kit/core";
import { useState, useEffect, useMemo } from "react";
import PurchaseCard from "./purchase-card";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import debug from "@/lib/debug";
import { Button } from "@/components/ui/button";
import { Plus, FileText, CheckCircle, CheckCircle2, ShoppingCart, Package, Truck, Archive, ClipboardCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import RFQCreation from "./rfq-creation";
import PurchaseOrderPhase from "./purchase-order-phase";
import ReceiptPhase from "./receipt-phase";
import FiscalConferencePhase from "./fiscal-conference-phase";
import RequestPhase from "./request-phase";
import ApprovalA1Phase from "./approval-a1-phase";
import ApprovalA2Phase from "./approval-a2-phase";
import QuotationPhase from "./quotation-phase";
import ConclusionPhase from "./conclusion-phase";
import RequestView from "./request-view";

interface KanbanBoardProps {
  departmentFilter?: string;
  urgencyFilter?: string;
  requesterFilter?: string;
  supplierFilter?: string;
  searchFilter?: string;
  dateFilter?: {
    startDate: string;
    endDate: string;
  };
}

export default function KanbanBoard({
  departmentFilter = "all",
  urgencyFilter = "all",
  requesterFilter = "all",
  supplierFilter = "all",
  searchFilter = "",
  dateFilter,
}: KanbanBoardProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeRequest, setActiveRequest] = useState<any>(null);
  const [showRFQCreation, setShowRFQCreation] = useState(false);
  const [selectedRequestForRFQ, setSelectedRequestForRFQ] = useState<any>(null);
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalPhase, setModalPhase] = useState<PurchasePhase | null>(null);
  const [lockDialogClose, setLockDialogClose] = useState(false);
  const [modalMode, setModalMode] = useState<'view' | 'physical' | 'fiscal' | undefined>(undefined);

  const phaseIcons: Record<PurchasePhase, any> = {
    [PURCHASE_PHASES.SOLICITACAO]: FileText,
    [PURCHASE_PHASES.APROVACAO_A1]: CheckCircle,
    [PURCHASE_PHASES.COTACAO]: FileText,
    [PURCHASE_PHASES.APROVACAO_A2]: CheckCircle2,
    [PURCHASE_PHASES.PEDIDO_COMPRA]: ShoppingCart,
    [PURCHASE_PHASES.RECEBIMENTO]: Truck,
    [PURCHASE_PHASES.CONF_FISCAL]: ClipboardCheck,
    [PURCHASE_PHASES.CONCLUSAO_COMPRA]: Package,
    [PURCHASE_PHASES.ARQUIVADO]: Archive,
  };

  const { data: purchaseRequests = [], isLoading } = useQuery({
    queryKey: ["/api/purchase-requests"],
    refetchInterval: false, // Disable automatic refetching
    refetchOnWindowFocus: false, // Disable refetch on window focus
    refetchOnMount: "always", // Always refetch when component mounts
    staleTime: 1000 * 60 * 1, // 1 minute stale time
    enabled: !!user, // Only fetch when user is authenticated
  });

  const handleOpenRequest = (request: any, phase: PurchasePhase, mode?: ReceiptMode) => {
    setActiveRequest(request);
    setModalPhase(phase);
    setModalMode(mode);
    setIsModalOpen(true);
  };

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

  useEffect(() => {
    const container = document.getElementById('kanban-mobile-container');
    if (!container) return;
    const handleScroll = () => {
      const scrollLeft = container.scrollLeft;
      const total = Object.values(PURCHASE_PHASES).length;
      const columnWidth = container.scrollWidth / (total || 1);
      const idx = Math.round(scrollLeft / (columnWidth || 1));
      setCurrentPhaseIndex(idx);
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const container = document.getElementById('kanban-desktop-container');
    if (!container) return;
    const handleScroll = () => {
      const children = Array.from(container.querySelectorAll('[data-kanban-phase]')) as HTMLElement[];
      const scrollLeft = container.scrollLeft;
      let idx = 0;
      let accWidth = 0;
      for (let i = 0; i < children.length; i++) {
        accWidth += children[i].offsetWidth + parseInt(getComputedStyle(children[i]).marginRight || '0');
        if (accWidth > scrollLeft) { idx = i; break; }
      }
      setCurrentPhaseIndex(idx);
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const moveRequestMutation = useMutation({
    mutationFn: async ({ id, newPhase }: { id: number; newPhase: string }) => {
      await apiRequest(`/api/purchase-requests/${id}/update-phase`, {
        method: "PATCH",
        body: { newPhase },
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
          !!(query.queryKey[0]?.toString().includes(`/api/quotations/`) ||
            query.queryKey[0]?.toString().includes(`/api/purchase-requests`)),
      });

      // Force immediate refetch for absolute certainty
      queryClient.refetchQueries({ queryKey: ["/api/purchase-requests"] });

      toast({
        title: "Sucesso",
        description: "Item movido com sucesso!",
      });
    },
  });

  // Calculate which requests should be highlighted based on search filter
  const highlightedRequestIds = useMemo(() => {
    const ids = new Set<number>();

    if (searchFilter && searchFilter.trim()) {
      const query = searchFilter.toLowerCase().trim();

      // Find all requests that match the search filter
      const allRequests = Array.isArray(purchaseRequests) ? purchaseRequests : [];
      allRequests.forEach((request: any) => {
        const searchFields = [
          request.requestNumber?.toLowerCase(),
          request.title?.toLowerCase(),
          request.description?.toLowerCase(),
          request.justification?.toLowerCase(),
          // Requester search
          request.requester?.firstName?.toLowerCase(),
          request.requester?.lastName?.toLowerCase(),
          request.requester?.username?.toLowerCase(),
          // Department search
          request.department?.name?.toLowerCase(),
          // Supplier search
          request.chosenSupplier?.name?.toLowerCase(),
          request.chosenSupplier?.cnpj?.toLowerCase(),
          // Items search
          ...(request.items || []).map((item: any) =>
            `${item.description} ${item.technicalSpecification} ${item.model} ${item.brand}`.toLowerCase()
          ),
        ].filter(Boolean);

        const matchesSearch = searchFields.some(field =>
          field && field.includes(query)
        );

        // Also check for request number patterns (R123, SOL-2025-045, etc)
        const numbers = query.replace(/[^\d]/g, "");
        const matchesRequestNumber = numbers &&
          request.requestNumber?.replace(/[^\d]/g, "").includes(numbers);

        if (matchesSearch || matchesRequestNumber) {
          ids.add(request.id);
        }
      });
    }

    return ids;
  }, [searchFilter, purchaseRequests]);

  // Auto-open the first matching card when search is performed
  useEffect(() => {
    if (searchFilter && searchFilter.trim() && highlightedRequestIds.size > 0 && Array.isArray(purchaseRequests)) {
      // Get the first highlighted request ID
      const firstHighlightedId = Array.from(highlightedRequestIds)[0];

      // Find the corresponding request
      const firstHighlightedRequest = purchaseRequests.find((req: any) => req.id === firstHighlightedId);

      if (firstHighlightedRequest) {
        // Trigger opening the card in its current phase
        setTimeout(() => {
          const cardElement = document.querySelector(
            `[data-request-id="${firstHighlightedId}"]`
          );
          if (cardElement) {
            (cardElement as HTMLElement).click();
          }
        }, 100); // Small delay to ensure the DOM is updated with highlights
      }
    }
  }, [searchFilter, highlightedRequestIds, purchaseRequests]);

  // Permission check function
  const canUserDragCard = (phase: string, targetPhase?: string) => {
    // If targetPhase is not provided, we're checking if the card can be dragged at all
    if (!targetPhase) {
      // Allow dragging from any phase - the target validation will happen in handleDragEnd
      return true;
    }

    // Special permission: Admin/Manager can move from "arquivado" to "aprovacao_a1"
    if (phase === "arquivado" && targetPhase === "aprovacao_a1") {
      return user?.isAdmin || user?.isManager;
    }

    // Allow moving from Aprovação A1 back to Solicitação (for corrections)
    if (phase === "aprovacao_a1" && targetPhase === "solicitacao") {
      return true;
    }

    // Buyer-specific rule: allow moving from Aprovação A2 back to Cotação
    if (phase === "aprovacao_a2" && targetPhase === "cotacao") {
      return (
        user?.isApproverA2 ||
        user?.isBuyer ||
        user?.isAdmin ||
        user?.isManager
      );
    }

    // Allow approvers to move from Aprovação A2 back to earlier phases (for corrections)
    if (
      phase === "aprovacao_a2" &&
      (targetPhase === "solicitacao" || targetPhase === "aprovacao_a1")
    ) {
      return user?.isApproverA2 || user?.isAdmin || user?.isManager;
    }

    // Allow moving from any phase to solicitacao (return to start)
    if (targetPhase === "solicitacao") {
      return true;
    }

    // Normal permission checks for moving OUT of approval phases
    if (
      phase === "aprovacao_a1" &&
      targetPhase !== "solicitacao" &&
      !user?.isApproverA1
    ) {
      return false;
    }
    if (
      phase === "aprovacao_a2" &&
      targetPhase !== "solicitacao" &&
      !user?.isApproverA2
    ) {
      return false;
    }

    // Permission check for moving OUT of Pedido de Compra back to Cotação/Aprovação A2
    if (
      phase === "pedido_compra" &&
      (targetPhase === "cotacao" || targetPhase === "aprovacao_a2")
    ) {
      return user?.isBuyer || user?.isAdmin;
    }

    // Permission check for moving OUT of Recebimento phase
    if (
      phase === "recebimento" &&
      targetPhase !== "solicitacao"
    ) {
       // Target Conf. Fiscal: Allow Admin, Manager, Buyer or Receiver
       if (targetPhase === "conf_fiscal") {
          return user?.isAdmin || user?.isManager || user?.isBuyer || user?.isReceiver;
       }
       // Other targets: existing logic (Receiver only?)
       return user?.isReceiver;
    }

    return true;
  };

  // Function to check if quotation is ready for A2 approval
  const isQuotationReadyForA2 = async (requestId: number): Promise<boolean> => {
    try {
      const quotation = await apiRequest(
        `/api/quotations/purchase-request/${requestId}`,
      );
      if (!quotation) return false;

      const supplierQuotations = await apiRequest(
        `/api/quotations/${quotation.id}/supplier-quotations`,
      );
      if (!supplierQuotations || supplierQuotations.length === 0) return false;

      return supplierQuotations.some((sq: any) => sq.isChosen);
    } catch (error) {
      debug.error(
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

    // Store request for later permission check in handleDragEnd
    // We'll check permissions with target phase in handleDragEnd

    setActiveRequest(request);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    // Drag end processing

    if (over && active.id !== over.id) {
      const requestId = active.id.toString().includes("-")
        ? parseInt(active.id.toString().split("-")[1])
        : parseInt(active.id.toString());

      // Processing drag end

      if (isNaN(requestId)) {
        debug.error("❌ Invalid request ID", { activeId: active.id, requestId });
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

      let newPhase = (
        // Quando sobre um item dentro da coluna, usar o containerId (fase da coluna)
        (over as any)?.data?.current?.sortable?.containerId ||
        // Quando sobre a própria coluna, over.id já é a fase
        over.id.toString()
      );

      // Fallback robusto: se cair sobre um card (ex.: "request-123") e containerId não estiver disponível,
      // inferir a fase pela própria posição do card alvo
      if (!Object.values(PURCHASE_PHASES).includes(newPhase as any) && newPhase.startsWith('request-')) {
        const overRequestId = parseInt(newPhase.split('-')[1]);
        const overRequest = Array.isArray(purchaseRequests)
          ? purchaseRequests.find((req: any) => req.id === overRequestId)
          : undefined;
        if (overRequest?.currentPhase) {
          newPhase = overRequest.currentPhase;
        }
      }

      // Check permissions before allowing the move
      if (!canUserDragCard(request.currentPhase, newPhase)) {
        toast({
          title: "Acesso Negado",
          description: `Você não possui permissão para mover cards da fase ${PHASE_LABELS[request.currentPhase as keyof typeof PHASE_LABELS]} para ${PHASE_LABELS[newPhase as keyof typeof PHASE_LABELS]}`,
          variant: "destructive",
        });
        setActiveId(null);
        setActiveRequest(null);
        return;
      }

      // Check if moving from "Recebimento Físico" to "Conf. Fiscal" - validate physical receipt completion
      if (request.currentPhase === PURCHASE_PHASES.RECEBIMENTO && newPhase === PURCHASE_PHASES.CONF_FISCAL) {
        if (!request.physicalReceiptAt) {
          toast({
            title: "Recebimento Físico Pendente",
            description: "Para avançar para Conferência Fiscal, é necessário confirmar o recebimento físico dos itens.",
            variant: "destructive",
          });
          setActiveId(null);
          setActiveRequest(null);
          return;
        }
      }

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

      // Verificar se o destino é uma fase válida (usa enum centralizado)
      const validPhases = Object.values(PURCHASE_PHASES);
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
    } else {
      // Drag cancelled - no valid target or same position
    }

    setActiveId(null);
    setActiveRequest(null);
  };

  // Filter requests based on department, urgency, requester, supplier, and date
  // NOTE: Search filter is NOT applied here - it's handled separately via highlighting
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

      // Requester filter - filter by requester user
      if (requesterFilter !== "all") {
        passesFilters =
          passesFilters &&
          request.requester?.id?.toString() === requesterFilter;
      }

      // Supplier filter - filter by chosen supplier
      if (supplierFilter !== "all") {
        passesFilters =
          passesFilters &&
          request.chosenSupplier?.id?.toString() === supplierFilter;
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

      // Search filter is handled separately via highlighting - don't filter out cards here

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

  // Render loading skeleton if data is loading
  if (isLoading) {
    return (
      <div className="h-full overflow-x-auto px-6 py-4">
        <div
          className="flex space-x-6"
          style={{ minWidth: "max-content", height: "100%" }}
        >
          {Object.values(PURCHASE_PHASES).map((phase) => (
            <div key={phase} className="flex-shrink-0 w-80">
              <div className="bg-card rounded-lg shadow-md h-full flex flex-col">
                <div className="p-4 border-b border-border">
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

  return (
    <>
      <DndContext
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="md:hidden h-full flex flex-col">
          <div
            id="kanban-mobile-container"
            className="flex-1 flex overflow-x-auto snap-x snap-mandatory pb-20"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            {Object.values(PURCHASE_PHASES).map((phase) => (
              <div
                key={phase}
                className="w-full flex-shrink-0 snap-start p-4"
              >
                <KanbanColumn
                  phase={phase}
                  title={PHASE_LABELS[phase]}
                  requests={requestsByPhase[phase] || []}
                  onCreateRFQ={handleCreateRFQ}
                  highlightedRequestIds={highlightedRequestIds}
                  onOpenRequest={handleOpenRequest}
                />
              </div>
            ))}
          </div>
          <div className="fixed md:hidden bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t border-border px-3 py-2 w-full">
            <nav className="flex items-center justify-between gap-2" aria-label="Navegação Kanban">
              {Object.values(PURCHASE_PHASES).map((phase, index) => {
                const Icon = phaseIcons[phase as PurchasePhase];
                const count = (requestsByPhase[phase] || []).length;
                const isActive = index === currentPhaseIndex;
                return (
                  <button
                    key={phase}
                    type="button"
                    className={`relative flex-1 flex items-center justify-center rounded-md px-2 py-2 transition-colors ${
                      isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                    aria-label={`Ir para ${PHASE_LABELS[phase]}`}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => {
                      const container = document.getElementById('kanban-mobile-container');
                      if (container) {
                        const columnWidth = container.scrollWidth / Object.values(PURCHASE_PHASES).length;
                        container.scrollTo({ left: columnWidth * index, behavior: 'smooth' });
                      }
                    }}
                  >
                    <Icon className="h-5 w-5" />
                    {count > 0 && (
                      <Badge variant={isActive ? 'default' : 'secondary'} className="absolute -top-1 -right-1 text-[10px] px-1.5 py-0">
                        {count}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="hidden md:block h-full overflow-x-auto overflow-y-auto px-4 md:px-6 py-4 kanban-scroll">
          <div
            className="flex space-x-4 md:space-x-6"
            style={{ minWidth: 'max-content', height: '100%' }}
          >
            {Object.values(PURCHASE_PHASES).map((phase) => (
              <KanbanColumn
                key={phase}
                phase={phase}
                title={PHASE_LABELS[phase]}
                requests={requestsByPhase[phase] || []}
                onCreateRFQ={handleCreateRFQ}
                highlightedRequestIds={highlightedRequestIds}
                onOpenRequest={handleOpenRequest}
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

        <RFQCreation
          purchaseRequest={selectedRequestForRFQ}
          existingQuotation={null}
          isOpen={showRFQCreation && !!selectedRequestForRFQ}
          onOpenChange={(open) => {
            setShowRFQCreation(open);
            if (!open) setSelectedRequestForRFQ(null);
          }}
          onComplete={() => {
            setShowRFQCreation(false);
            setSelectedRequestForRFQ(null);
            queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
            queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
            queryClient.invalidateQueries({
              predicate: (query) =>
                !!(query.queryKey[0]?.toString().includes(`/api/quotations/`) ||
                  query.queryKey[0]?.toString().includes(`/api/purchase-requests`))
            });
          }}
        />
        {/* Central Modal for request phases */}
        <Dialog 
          open={isModalOpen && (
            modalPhase === PURCHASE_PHASES.PEDIDO_COMPRA || 
            modalPhase === PURCHASE_PHASES.RECEBIMENTO ||
            modalPhase === PURCHASE_PHASES.CONF_FISCAL ||
            modalPhase === PURCHASE_PHASES.CONCLUSAO_COMPRA ||
            modalPhase === PURCHASE_PHASES.ARQUIVADO
          )} 
          onOpenChange={(open) => { if (!open && lockDialogClose) return; setIsModalOpen(open);} }
        >
          <DialogContent
            className="sm:max-w-6xl max-h-[90vh] overflow-y-auto p-0 sm:rounded-lg"
            aria-describedby="kanban-phase-desc"
            onInteractOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
            onPointerDownOutside={(e) => e.preventDefault()}
            onFocusOutside={(e) => e.preventDefault()}
          >
            <div className="flex-shrink-0 bg-card border-b border-border sticky top-0 z-30 px-6 py-3 rounded-t-lg">
              <div className="flex justify-between items-center">
                <DialogTitle className="text-base font-semibold">
                  {modalPhase === PURCHASE_PHASES.PEDIDO_COMPRA && `Pedido de Compra - Solicitação #${activeRequest?.requestNumber}`}
                  {modalPhase === PURCHASE_PHASES.RECEBIMENTO && `Recebimento Físico - Solicitação #${activeRequest?.requestNumber}`}
                  {modalPhase === PURCHASE_PHASES.CONF_FISCAL && `Conferência Fiscal - Solicitação #${activeRequest?.requestNumber}`}
                  {modalPhase === PURCHASE_PHASES.CONCLUSAO_COMPRA && `Conclusão da Compra - Solicitação #${activeRequest?.requestNumber}`}
                  {modalPhase === PURCHASE_PHASES.ARQUIVADO && `Detalhes da Solicitação - #${activeRequest?.requestNumber}`}
                </DialogTitle>
              </div>
            </div>
            <p id="kanban-phase-desc" className="sr-only">
              {modalPhase === PURCHASE_PHASES.PEDIDO_COMPRA && "Tela de Pedido de Compra da solicitação selecionada"}
              {modalPhase === PURCHASE_PHASES.RECEBIMENTO && "Tela de Recebimento Físico para conferência de itens"}
              {modalPhase === PURCHASE_PHASES.CONF_FISCAL && "Tela de Conferência Fiscal para validação de notas"}
              {modalPhase === PURCHASE_PHASES.CONCLUSAO_COMPRA && "Tela de Conclusão da Compra com resumo final"}
              {modalPhase === PURCHASE_PHASES.ARQUIVADO && "Tela de detalhes da solicitação arquivada"}
            </p>
            <div className="px-6 pt-0 pb-2">
              {modalPhase === PURCHASE_PHASES.PEDIDO_COMPRA && activeRequest && (
                <PurchaseOrderPhase request={activeRequest} onClose={() => setIsModalOpen(false)} onPreviewOpen={() => setLockDialogClose(true)} onPreviewClose={() => setLockDialogClose(false)} />
              )}
              {modalPhase === PURCHASE_PHASES.RECEBIMENTO && activeRequest && (
                <ReceiptPhase 
                  request={activeRequest} 
                  onClose={() => setIsModalOpen(false)} 
                  onPreviewOpen={() => setLockDialogClose(true)} 
                  onPreviewClose={() => setLockDialogClose(false)}
                  mode={modalMode || 'physical'}
                  hideTabsByDefault
                />
              )}
              {modalPhase === PURCHASE_PHASES.CONF_FISCAL && activeRequest && (
                <FiscalConferencePhase 
                  request={activeRequest} 
                  onClose={() => setIsModalOpen(false)} 
                  onPreviewOpen={() => setLockDialogClose(true)} 
                  onPreviewClose={() => setLockDialogClose(false)}
                  mode={modalMode}
                />
              )}
              {modalPhase === PURCHASE_PHASES.CONCLUSAO_COMPRA && activeRequest && (
                <ConclusionPhase request={activeRequest} onClose={() => setIsModalOpen(false)} />
              )}
              {modalPhase === PURCHASE_PHASES.ARQUIVADO && activeRequest && (
                <RequestView request={activeRequest} onClose={() => setIsModalOpen(false)} />
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Independent Modals for phases that handle their own dialogs */}
        {modalPhase === PURCHASE_PHASES.SOLICITACAO && activeRequest && (
          <RequestPhase
            request={activeRequest}
            open={isModalOpen}
            onOpenChange={(open) => setIsModalOpen(open)}
          />
        )}
        {modalPhase === PURCHASE_PHASES.APROVACAO_A1 && activeRequest && (
          <ApprovalA1Phase
            request={activeRequest}
            open={isModalOpen}
            onOpenChange={(open) => setIsModalOpen(open)}
          />
        )}
        {modalPhase === PURCHASE_PHASES.APROVACAO_A2 && activeRequest && (
          <ApprovalA2Phase
            request={activeRequest}
            open={isModalOpen}
            onOpenChange={(open) => setIsModalOpen(open)}
          />
        )}
        {modalPhase === PURCHASE_PHASES.COTACAO && activeRequest && (
          <QuotationPhase
            request={activeRequest}
            open={isModalOpen}
            onOpenChange={(open) => setIsModalOpen(open)}
          />
        )}
      </DndContext>
    </>
  );
}
