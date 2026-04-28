import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PURCHASE_PHASES, PHASE_LABELS, type PurchasePhase, type ReceiptMode, RECEIPT_PHASES, RECEIPT_PHASE_LABELS } from "@/lib/types";
import KanbanColumn from "@/features/requests/components/kanban/kanban-column";
import ReceiptKanbanColumn from "@/features/requests/components/kanban/receipt-kanban-column";
import { Skeleton } from "@/shared/ui/skeleton";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  closestCorners,
} from "@dnd-kit/core";
import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import PurchaseCard from "@/features/requests/components/kanban/purchase-card";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import debug from "@/lib/debug";
import { Button } from "@/shared/ui/button";
import { Plus, FileText, CheckCircle, CheckCircle2, ShoppingCart, Package, Truck, Archive, ClipboardCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { Card, CardContent } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { filterRequests, filterReceipts } from "@/lib/kanban-filters";

const RFQCreation = lazy(() => import("@/features/quotations/components/rfq-creation"));
const PurchaseOrderPhase = lazy(() => import("@/features/requests/components/purchase-order-phase"));
const ReceiptPhase = lazy(() => import("@/features/receipts/components/receipt-phase"));
const FiscalConferencePhase = lazy(() => import("@/features/receipts/components/fiscal-conference-phase"));
const RequestPhase = lazy(() => import("@/features/requests/components/request-phase"));
const ApprovalA1Phase = lazy(() => import("@/features/approvals/components/approval-a1-phase"));
const ApprovalA2Phase = lazy(() => import("@/features/approvals/components/approval-a2-phase"));
const QuotationPhase = lazy(() => import("@/features/quotations/components/quotation-phase"));
const ConclusionPhase = lazy(() => import("@/features/requests/components/ConclusionPhase"));
const RequestView = lazy(() => import("@/features/requests/components/request-view"));

interface KanbanBoardProps {
  departmentFilter?: string;
  urgencyFilter?: string;
  requesterFilter?: string;
  supplierFilter?: string;
  purchaseOrderFilter?: string;
  searchFilter?: string;
  dateFilter?: {
    startDate: string;
    endDate: string;
  };
  targetRequestId?: number;
}

export default function KanbanBoard({
  departmentFilter = "all",
  urgencyFilter = "all",
  requesterFilter = "all",
  supplierFilter = "all",
  purchaseOrderFilter = "",
  searchFilter = "",
  dateFilter,
  targetRequestId,
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
  const [returnToReceiptDialog, setReturnToReceiptDialog] = useState<{ isOpen: boolean; requestId: number | null }>({ isOpen: false, requestId: null });

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
    [PURCHASE_PHASES.PEDIDO_CONCLUIDO]: CheckCircle2,
  };

  const { data: purchaseRequests = [], isLoading: isLoadingRequests } = useQuery<any[]>({
    queryKey: ["/api/purchase-requests"],
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnMount: "always",
    staleTime: 1000 * 60 * 1,
    enabled: !!user,
  });

  const { data: receiptsBoard = [], isLoading: isLoadingReceipts } = useQuery<any[]>({
    queryKey: ["/api/receipts/board"],
    refetchInterval: 10000, // Refresh receipts every 10s
    enabled: !!user,
  });

  const isLoading = isLoadingRequests || isLoadingReceipts;

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      toast({
        title: "Sucesso",
        description: "Fase da solicitação atualizada",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar fase",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const moveReceiptMutation = useMutation({
    mutationFn: async ({ id, newPhase }: { id: number; newPhase: string }) => {
      await apiRequest(`/api/receipts/${id}/update-phase`, {
        method: "PATCH",
        body: { newPhase },
      });
    },
    onMutate: async ({ id, newPhase }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/receipts/board"] });
      const previous = queryClient.getQueryData(["/api/receipts/board"]);
      queryClient.setQueryData(["/api/receipts/board"], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((r: any) => r.id === id ? { ...r, receiptPhase: newPhase } : r);
      });
      return { previous };
    },
    onError: (error, vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/receipts/board"], context.previous);
      }
      toast({
        title: "Erro ao mover recebimento",
        description: error instanceof Error ? error.message : "Falha na transição de fase",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts/board"] });
      toast({ title: "Sucesso", description: "Fase do recebimento atualizada" });
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
          // Purchase Order search
          request.purchaseOrder?.orderNumber?.toLowerCase(),
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
        
        const matchesOrderNumber = numbers &&
          request.purchaseOrder?.orderNumber?.replace(/[^\d]/g, "").includes(numbers);

        if (matchesSearch || matchesRequestNumber || matchesOrderNumber) {
          ids.add(request.id);
        }
      });
    }

    return ids;
  }, [searchFilter, purchaseRequests]);

  // Auto-open target request
  useEffect(() => {
    if (targetRequestId && Array.isArray(purchaseRequests) && purchaseRequests.length > 0) {
      // Check if this request is already open
      if (isModalOpen && activeRequest?.id === targetRequestId) {
        return;
      }

      const request = purchaseRequests.find((req: any) => req.id === targetRequestId);
      
      if (request) {
        // Use a small timeout to ensure UI stability
        const timer = setTimeout(() => {
            handleOpenRequest(request, request.currentPhase);
        }, 300);
        return () => clearTimeout(timer);
      }
    }
  }, [targetRequestId, purchaseRequests]);

  // Auto-open the first matching card when search is performed
  useEffect(() => {
    // DO NOT auto-open if a specific target request ID is provided
    // This prevents opening the wrong card when the search term matches multiple requests
    if (targetRequestId) {
      return;
    }

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
  }, [searchFilter, highlightedRequestIds, purchaseRequests, targetRequestId]);

  // Permission check function
  const canUserDragCard = (phase: string, targetPhase?: string) => {
    // If targetPhase is not provided, we're checking if the card can be dragged at all
    if (!targetPhase) {
      return true;
    }

    // Define phase order — arquivado is NOT in this list (it's terminal via button only)
    const phaseOrder = [
      "solicitacao",
      "aprovacao_a1",
      "cotacao",
      "aprovacao_a2",
      "pedido_compra",
      "pedido_concluido",
      "recebimento",
      "conf_fiscal",
      "conclusao_compra",
    ];
    const currentIdx = phaseOrder.indexOf(phase);
    const targetIdx = phaseOrder.indexOf(targetPhase);
    const isBackwardMove = currentIdx > targetIdx && targetIdx >= 0;

    // Compradores, Admins e Gerentes podem retornar cards para fases anteriores
    if (isBackwardMove && (user?.isBuyer || user?.isAdmin || user?.isManager)) {
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

    const activeIdStr = active.id.toString();
    if (activeIdStr.startsWith('receipt-')) {
      const receiptId = parseInt(activeIdStr.split('-')[1]);
      const receipt = receiptsBoard.find((r: any) => r.id === receiptId);
      if (receipt) {
         setActiveRequest({ ...receipt, isReceipt: true });
      }
    } else {
      const requestId = activeIdStr.includes("-") 
        ? parseInt(activeIdStr.split("-")[1])
        : parseInt(activeIdStr);
        
      const request = Array.isArray(purchaseRequests)
        ? purchaseRequests.find((req: any) => req.id === requestId)
        : undefined;
      setActiveRequest(request);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) {
      setActiveId(null);
      setActiveRequest(null);
      return;
    }

    const activeIdStr = active.id.toString();
    const isReceipt = activeIdStr.startsWith('receipt-');
    const entityId = parseInt(activeIdStr.split('-')[1]);

    if (isNaN(entityId)) {
      setActiveId(null);
      setActiveRequest(null);
      return;
    }

    // Resolve target phase and type
    let targetIdStr = over.id.toString();
    
    // Get target phase from column or card
    let targetPhase = targetIdStr;
    let targetFlow = 'request';

    if (targetIdStr.startsWith('receipt-column-')) {
        targetPhase = targetIdStr.replace('receipt-column-', '');
        targetFlow = 'receipt';
    } else if (targetIdStr.startsWith('receipt-')) {
        const targetRecId = parseInt(targetIdStr.split('-')[1]);
        const targetRec = receiptsBoard?.find((r: any) => r.id === targetRecId);
        targetPhase = targetRec?.receiptPhase;
        targetFlow = 'receipt';
    } else if (targetIdStr.startsWith('request-')) {
        const targetReqId = parseInt(targetIdStr.split('-')[1]);
        const targetReq = purchaseRequests.find((r: any) => r.id === targetReqId);
        targetPhase = targetReq?.currentPhase;
        targetFlow = 'request';
    }

    // Cross-flow protection
    if (isReceipt && targetFlow !== 'receipt') {
        toast({ title: "Movimento inválido", description: "Recebimentos só podem ser movidos dentro de seu próprio fluxo.", variant: "destructive" });
        setActiveId(null);
        return;
    }
    if (!isReceipt && (targetFlow === 'receipt' || targetIdStr.startsWith('receipt-column-'))) {
         toast({ title: "Movimento inválido", description: "Solicitações só podem ser movidas para colunas de aquisição.", variant: "destructive" });
         setActiveId(null);
         return;
    }

    if (isReceipt) {
        if (targetPhase && entityId) {
            moveReceiptMutation.mutate({ id: entityId, newPhase: targetPhase });
        }
    } else {
        // Logic for requests (Flow 1)
        const request = purchaseRequests.find((req: any) => req.id === entityId);
        if (!request) return;

        // Permission and validation checks
        if (!canUserDragCard(request.currentPhase, targetPhase)) {
            toast({
              title: "Acesso Negado",
              description: `Você não possui permissão para esta transição.`,
              variant: "destructive",
            });
            return;
        }

        // Special: Cotação -> Aprovação A2
        if (request.currentPhase === "cotacao" && targetPhase === "aprovacao_a2") {
            const ready = await isQuotationReadyForA2(entityId);
            if (!ready) {
                toast({ title: "Cotação Incompleta", description: "Selecione um fornecedor vencedor antes de avançar.", variant: "destructive" });
                return;
            }
        }

        moveRequestMutation.mutate({ id: entityId, newPhase: targetPhase });
    }

    setActiveId(null);
    setActiveRequest(null);
  };

  // Filter requests based on department, urgency, requester, supplier, and date
  // NOTE: Search filter is NOT applied here - it's handled separately via highlighting
  const filteredRequests = useMemo(() => {
    return filterRequests(purchaseRequests, {
      department: departmentFilter,
      urgency: urgencyFilter,
      requester: requesterFilter,
      supplier: supplierFilter,
      date: dateFilter,
      purchaseOrder: purchaseOrderFilter,
    });
  }, [
    purchaseRequests,
    departmentFilter,
    urgencyFilter,
    requesterFilter,
    supplierFilter,
    dateFilter,
    purchaseOrderFilter,
  ]);

  // Group filtered requests by phase
  const requestsByPhase = filteredRequests.reduce((acc: any, request: any) => {
    let phase = request.currentPhase || PURCHASE_PHASES.SOLICITACAO;
    
    // Map legacy receiving phases to the Handoff column for Flow 1 visibility
    if (['recebimento', 'conf_fiscal', 'conclusao_compra'].includes(phase)) {
      phase = PURCHASE_PHASES.PEDIDO_CONCLUIDO;
    }
    
    if (!acc[phase]) acc[phase] = [];
    acc[phase].push(request);
    return acc;
  }, {});

  // Filter receipts
  const filteredReceipts = useMemo(() => {
    return filterReceipts(receiptsBoard || [], {
      department: departmentFilter || 'all',
      urgency: urgencyFilter || 'all',
      requester: requesterFilter || 'all',
      supplier: supplierFilter || 'all',
      date: dateFilter,
      purchaseOrder: purchaseOrderFilter,
      search: searchFilter
    });
  }, [
    receiptsBoard,
    departmentFilter,
    urgencyFilter,
    requesterFilter,
    supplierFilter,
    dateFilter,
    purchaseOrderFilter,
    searchFilter
  ]);

  // Group receipts by phase
  const receiptsByPhase = filteredReceipts.reduce((acc: any, receipt: any) => {
    const phase = receipt.receiptPhase;
    if (!acc[phase]) acc[phase] = [];
    acc[phase].push(receipt);
    return acc;
  }, {});

  // Sort function: First by urgency, then by date
  const sortRequestsByPriority = (requests: any[]) => {
    const urgencyOrder = { alta_urgencia: 0, alto: 1, medio: 2, baixo: 3 };
    return [...requests].sort((a, b) => {
      const urgencyA = urgencyOrder[a.urgency as keyof typeof urgencyOrder] ?? 99;
      const urgencyB = urgencyOrder[b.urgency as keyof typeof urgencyOrder] ?? 99;
      if (urgencyA !== urgencyB) return urgencyA - urgencyB;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  };

  // Apply sorting
  Object.keys(requestsByPhase).forEach((phase) => {
    requestsByPhase[phase] = sortRequestsByPriority(requestsByPhase[phase]);
  });

  const handleCreateRFQ = (request: any) => {
    setSelectedRequestForRFQ(request);
    setShowRFQCreation(true);
  };

  const returnToReceiptMutation = useMutation({
    mutationFn: async (requestId: number) => {
      await apiRequest(`/api/requests/${requestId}/return-to-receipt`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      toast({
        title: "Sucesso",
        description: "Solicitação retornada para Recebimento Físico.",
      });
      setReturnToReceiptDialog({ isOpen: false, requestId: null });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao retornar solicitação",
        variant: "destructive",
      });
      setReturnToReceiptDialog({ isOpen: false, requestId: null });
    },
  });

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
      <AlertDialog open={returnToReceiptDialog.isOpen} onOpenChange={(open) => !open && setReturnToReceiptDialog({ isOpen: false, requestId: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Retorno de Fase</AlertDialogTitle>
            <AlertDialogDescription>
              Esta operação irá excluir permanentemente o processo de recebimento deste pedido e removerá todas as informações de nota fiscal cadastradas. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (returnToReceiptDialog.requestId) {
                  returnToReceiptMutation.mutate(returnToReceiptDialog.requestId);
                }
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

        <div className="hidden md:block h-full overflow-x-auto overflow-y-auto px-4 md:px-6 py-4 kanban-scroll" id="kanban-desktop-container">
          <div
            className="flex space-x-4 md:space-x-6"
            style={{ minWidth: 'max-content', height: '100%' }}
          >
            {/* Fluxo 1: Aquisição */}
            <div className="flex space-x-4 md:space-x-6">
              {Object.values(PURCHASE_PHASES).filter(p => !['recebimento', 'conf_fiscal', 'conclusao_compra'].includes(p)).map((phase) => (
                <KanbanColumn
                  key={phase}
                  phase={phase as any}
                  title={PHASE_LABELS[phase as keyof typeof PHASE_LABELS]}
                  requests={requestsByPhase[phase] || []}
                  onCreateRFQ={handleCreateRFQ}
                  highlightedRequestIds={highlightedRequestIds}
                  onOpenRequest={handleOpenRequest}
                />
              ))}
            </div>

            {/* Fluxo 2: Recebimentos Independente */}
            <div className="flex space-x-4 md:space-x-6">
               {Object.values(RECEIPT_PHASES).filter(p => p !== 'cancelado').map((phase) => (
                 <ReceiptKanbanColumn
                   key={phase}
                   phase={phase as any}
                   title={RECEIPT_PHASE_LABELS[phase as keyof typeof RECEIPT_PHASE_LABELS]}
                   receipts={receiptsByPhase[phase] || []}
                   onOpenReceipt={(receipt) => {
                      // Adapt activeRequest to look like a PR enough for current modals
                      setActiveRequest({ 
                        id: receipt.purchaseRequestId, 
                        requestNumber: receipt.requestNumber,
                        currentPhase: phase === RECEIPT_PHASES.CONCLUIDO ? PURCHASE_PHASES.CONCLUSAO_COMPRA : PURCHASE_PHASES.RECEBIMENTO 
                      });
                      
                      if (phase === RECEIPT_PHASES.CONCLUIDO) {
                        setModalPhase(PURCHASE_PHASES.CONCLUSAO_COMPRA);
                        setModalMode(undefined);
                      } else {
                        setModalPhase(phase === RECEIPT_PHASES.RECEBIMENTO_FISICO ? 'recebimento' : 'conf_fiscal' as any);
                        setModalMode(phase === RECEIPT_PHASES.RECEBIMENTO_FISICO ? 'physical' : 'fiscal');
                      }
                      setIsModalOpen(true);
                   }}
                 />
               ))}
            </div>
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

        <Suspense fallback={null}>
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
        </Suspense>
        {/* Central Modal for request phases */}
        <Dialog 
          open={isModalOpen && (
            modalPhase === PURCHASE_PHASES.PEDIDO_COMPRA || 
            modalPhase === PURCHASE_PHASES.RECEBIMENTO ||
            modalPhase === PURCHASE_PHASES.CONF_FISCAL ||
            modalPhase === PURCHASE_PHASES.CONCLUSAO_COMPRA ||
            modalPhase === PURCHASE_PHASES.PEDIDO_CONCLUIDO ||
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
                  {(modalPhase === PURCHASE_PHASES.CONCLUSAO_COMPRA || modalPhase === PURCHASE_PHASES.PEDIDO_CONCLUIDO) && `Conclusão da Compra - Solicitação #${activeRequest?.requestNumber}`}
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
              <Suspense fallback={<div className="p-4 text-center">Carregando...</div>}>
                {modalPhase === PURCHASE_PHASES.PEDIDO_COMPRA && activeRequest && (
                  <PurchaseOrderPhase request={activeRequest} onClose={() => setIsModalOpen(false)} onPreviewOpen={() => setLockDialogClose(true)} onPreviewClose={() => setLockDialogClose(false)} />
                )}
                {modalPhase === PURCHASE_PHASES.RECEBIMENTO && activeRequest && (
                  <ReceiptPhase 
                    request={activeRequest} 
                    onClose={() => setIsModalOpen(false)} 
                    onPreviewOpen={() => setLockDialogClose(true)} 
                    onPreviewClose={() => setLockDialogClose(false)}
                    mode={(modalMode === 'view' || modalMode === 'physical') ? modalMode : 'physical'}
                    hideTabsByDefault
                    compactHeader
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
                {(modalPhase === PURCHASE_PHASES.CONCLUSAO_COMPRA || modalPhase === PURCHASE_PHASES.PEDIDO_CONCLUIDO) && activeRequest && (
                  <ConclusionPhase request={activeRequest} onClose={() => setIsModalOpen(false)} />
                )}
                {modalPhase === PURCHASE_PHASES.ARQUIVADO && activeRequest && (
                  <RequestView request={activeRequest} onClose={() => setIsModalOpen(false)} />
                )}
              </Suspense>
            </div>
          </DialogContent>
        </Dialog>

        {/* Independent Modals for phases that handle their own dialogs */}
        <Suspense fallback={null}>
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
        </Suspense>
      </DndContext>
    </>
  );
}
