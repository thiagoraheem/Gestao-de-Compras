import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PURCHASE_PHASES, PHASE_LABELS, RECEIPT_PHASES, RECEIPT_PHASE_LABELS, type PurchasePhase, type ReceiptPhase } from "@/lib/types";
import KanbanColumn from "./kanban-column";
import ReceiptKanbanColumn from "./receipt-kanban-column";
import ReceiptKanbanCard, { type ReceiptKanbanRow } from "./receipt-kanban-card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  closestCorners,
} from "@dnd-kit/core";
import { useState, useEffect, useMemo, lazy, Suspense } from "react";
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
import { filterRequests } from "@/lib/kanban-filters";
import { ReceiptProvider } from "@/components/receipt/ReceiptContext";
import ReceiptPhysicalPanel from "@/components/receipt/ReceiptPhysicalPanel";

const RFQCreation = lazy(() => import("./rfq-creation"));
const PurchaseOrderPhase = lazy(() => import("./purchase-order-phase"));
const FiscalConferencePhase = lazy(() => import("./fiscal-conference-phase"));
const RequestPhase = lazy(() => import("./request-phase"));
const ApprovalA1Phase = lazy(() => import("./approval-a1-phase"));
const ApprovalA2Phase = lazy(() => import("./approval-a2-phase"));
const QuotationPhase = lazy(() => import("./quotation-phase"));
const RequestView = lazy(() => import("./request-view"));

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
  const [activeReceipt, setActiveReceipt] = useState<ReceiptKanbanRow | null>(null);
  const [showRFQCreation, setShowRFQCreation] = useState(false);
  const [selectedRequestForRFQ, setSelectedRequestForRFQ] = useState<any>(null);
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalPhase, setModalPhase] = useState<PurchasePhase | null>(null);
  const [lockDialogClose, setLockDialogClose] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptKanbanRow | null>(null);

  const phaseIcons: Record<PurchasePhase, any> = {
    [PURCHASE_PHASES.SOLICITACAO]: FileText,
    [PURCHASE_PHASES.APROVACAO_A1]: CheckCircle,
    [PURCHASE_PHASES.COTACAO]: FileText,
    [PURCHASE_PHASES.APROVACAO_A2]: CheckCircle2,
    [PURCHASE_PHASES.PEDIDO_COMPRA]: ShoppingCart,
    [PURCHASE_PHASES.PEDIDO_CONCLUIDO]: CheckCircle,
    [PURCHASE_PHASES.RECEBIMENTO]: Truck,
    [PURCHASE_PHASES.CONF_FISCAL]: ClipboardCheck,
    [PURCHASE_PHASES.CONCLUSAO_COMPRA]: Package,
    [PURCHASE_PHASES.ARQUIVADO]: Archive,
  };

  const { data: purchaseRequests = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/purchase-requests"],
    refetchInterval: false, // Disable automatic refetching
    refetchOnWindowFocus: false, // Disable refetch on window focus
    refetchOnMount: "always", // Always refetch when component mounts
    staleTime: 1000 * 60 * 1, // 1 minute stale time
    enabled: !!user, // Only fetch when user is authenticated
  });

  const { data: receiptsBoard = [] } = useQuery<ReceiptKanbanRow[]>({
    queryKey: ["receipts-board-kanban"],
    queryFn: async () => {
      return apiRequest("/api/receipts/board");
    },
    enabled: !!user,
    staleTime: 1000 * 30,
  });

  const receiptRequestId = (selectedReceipt as any)?.request?.id || (selectedReceipt as any)?.purchaseRequestId || null;
  const { data: receiptRequest } = useQuery<any>({
    queryKey: receiptRequestId ? [`/api/purchase-requests/${receiptRequestId}`] : ["_no_receipt_request_"],
    enabled: isReceiptModalOpen && !!receiptRequestId,
  });

  const handleOpenRequest = (request: any, phase: PurchasePhase) => {
    setActiveRequest(request);
    setModalPhase(phase);
    setIsModalOpen(true);
  };

  const handleOpenReceipt = (receipt: ReceiptKanbanRow) => {
    setSelectedReceipt(receipt);
    setIsReceiptModalOpen(true);
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
      const total = acquisitionPhases.length + receiptPhases.length;
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
      queryClient.invalidateQueries({ queryKey: ["receipts-board-kanban"] });
      queryClient.invalidateQueries({ queryKey: ["receipts-board"] });
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

  const updateReceiptPhaseMutation = useMutation({
    mutationFn: async ({ id, newPhase }: { id: number; newPhase: string }) => {
      await apiRequest(`/api/receipts/${id}/update-phase`, {
        method: "PATCH",
        body: { newPhase },
      });
    },
    onMutate: async ({ id, newPhase }) => {
      await queryClient.cancelQueries({ queryKey: ["receipts-board-kanban"] });
      const previous = queryClient.getQueryData(["receipts-board-kanban"]);
      queryClient.setQueryData(["receipts-board-kanban"], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((r: any) => (r.id === id ? { ...r, receiptPhase: newPhase } : r));
      });
      return { previous };
    },
    onError: (error, _vars, context: any) => {
      if (context?.previous) queryClient.setQueryData(["receipts-board-kanban"], context.previous);
      toast({
        title: "Movimento Bloqueado",
        description: (error as any)?.message || "Falha ao mover recebimento",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receipts-board-kanban"] });
      queryClient.invalidateQueries({ queryKey: ["receipts-board"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
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

    if (phase === "pedido_compra" && targetPhase === "pedido_concluido") {
      return user?.isBuyer || user?.isAdmin || user?.isManager;
    }

    return true;
  };

  const canUserDragReceipt = (phase: string, targetPhase: string) => {
    if (phase === RECEIPT_PHASES.RECEBIMENTO_FISICO && targetPhase === RECEIPT_PHASES.CONF_FISCAL) {
      return user?.isReceiver || user?.isAdmin || user?.isManager;
    }
    if (user?.isAdmin) return true;
    return false;
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

  const acquisitionPhases: PurchasePhase[] = [
    PURCHASE_PHASES.SOLICITACAO,
    PURCHASE_PHASES.APROVACAO_A1,
    PURCHASE_PHASES.COTACAO,
    PURCHASE_PHASES.APROVACAO_A2,
    PURCHASE_PHASES.PEDIDO_COMPRA,
    PURCHASE_PHASES.PEDIDO_CONCLUIDO,
    PURCHASE_PHASES.ARQUIVADO,
  ];

  const receiptPhases: ReceiptPhase[] = [
    RECEIPT_PHASES.RECEBIMENTO_FISICO,
    RECEIPT_PHASES.CONF_FISCAL,
    RECEIPT_PHASES.CONCLUIDO,
  ];

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);

    const id = String(active.id);
    if (id.startsWith("receipt-")) {
      const receiptId = Number(id.split("-")[1]);
      const receipt = Array.isArray(receiptsBoard) ? receiptsBoard.find((r: any) => r.id === receiptId) : undefined;
      setActiveReceipt(receipt || null);
      setActiveRequest(null);
      return;
    }

    const request = Array.isArray(purchaseRequests)
      ? purchaseRequests.find((req: any) => `request-${req.id}` === active.id)
      : undefined;

    setActiveRequest(request);
    setActiveReceipt(null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      setActiveId(null);
      setActiveRequest(null);
      setActiveReceipt(null);
      return;
    }

    const activeStr = String(active.id);
    const targetId = String((over as any)?.data?.current?.sortable?.containerId || over.id);

    if (activeStr.startsWith("receipt-")) {
      const receiptId = Number(activeStr.split("-")[1]);
      if (!Number.isFinite(receiptId)) {
        toast({ title: "Erro", description: "ID do recebimento inválido", variant: "destructive" });
        setActiveId(null);
        setActiveReceipt(null);
        return;
      }

      const receipt = Array.isArray(receiptsBoard) ? receiptsBoard.find((r: any) => r.id === receiptId) : undefined;
      if (!receipt) {
        toast({ title: "Erro", description: "Recebimento não encontrado", variant: "destructive" });
        setActiveId(null);
        setActiveReceipt(null);
        return;
      }

      let newPhase = targetId;
      if (!receiptPhases.includes(newPhase as any) && newPhase.startsWith("receipt-")) {
        const overReceiptId = Number(newPhase.split("-")[1]);
        const overReceipt = Array.isArray(receiptsBoard) ? receiptsBoard.find((r: any) => r.id === overReceiptId) : undefined;
        if (overReceipt?.receiptPhase) newPhase = String(overReceipt.receiptPhase);
      }

      if (!receiptPhases.includes(newPhase as any)) {
        toast({ title: "Movimentação inválida", description: "Recebimentos só podem ser movidos dentro do Fluxo 2.", variant: "destructive" });
        setActiveId(null);
        setActiveReceipt(null);
        return;
      }

      const cur = String((receipt as any).receiptPhase || RECEIPT_PHASES.RECEBIMENTO_FISICO);
      if (!canUserDragReceipt(cur, newPhase)) {
        toast({ title: "Acesso negado", description: "Você não possui permissão para mover recebimentos entre estas fases.", variant: "destructive" });
        setActiveId(null);
        setActiveReceipt(null);
        return;
      }

      updateReceiptPhaseMutation.mutate({ id: receiptId, newPhase });
      setActiveId(null);
      setActiveReceipt(null);
      return;
    }

    const requestId = activeStr.includes("-") ? Number(activeStr.split("-")[1]) : Number(activeStr);
    if (!Number.isFinite(requestId)) {
      debug.error("❌ Invalid request ID", { activeId: active.id, requestId });
      toast({ title: "Erro", description: "ID do pedido inválido", variant: "destructive" });
      setActiveId(null);
      setActiveRequest(null);
      return;
    }

    const request = Array.isArray(purchaseRequests) ? purchaseRequests.find((req: any) => req.id === requestId) : undefined;
    if (!request) {
      toast({ title: "Erro", description: "Solicitação não encontrada", variant: "destructive" });
      setActiveId(null);
      setActiveRequest(null);
      return;
    }

    let newPhase = targetId;
    if (!Object.values(PURCHASE_PHASES).includes(newPhase as any) && newPhase.startsWith("request-")) {
      const overRequestId = Number(newPhase.split("-")[1]);
      const overRequest = Array.isArray(purchaseRequests) ? purchaseRequests.find((req: any) => req.id === overRequestId) : undefined;
      if (overRequest?.currentPhase) newPhase = String(overRequest.currentPhase);
    }

    if (receiptPhases.includes(newPhase as any)) {
      toast({ title: "Movimentação inválida", description: "Fluxo de Recebimento é independente. Conclua o Fluxo 1 para gerar um card de recebimento.", variant: "destructive" });
      setActiveId(null);
      setActiveRequest(null);
      return;
    }

    if (!acquisitionPhases.includes(newPhase as any)) {
      toast({ title: "Erro", description: "Fase inválida", variant: "destructive" });
      setActiveId(null);
      setActiveRequest(null);
      return;
    }

    const currentPhase = ["recebimento", "conf_fiscal", "conclusao_compra"].includes(request.currentPhase)
      ? PURCHASE_PHASES.PEDIDO_CONCLUIDO
      : request.currentPhase;

    if (!canUserDragCard(currentPhase, newPhase)) {
      toast({
        title: "Acesso Negado",
        description: `Você não possui permissão para mover cards da fase ${PHASE_LABELS[currentPhase as keyof typeof PHASE_LABELS]} para ${PHASE_LABELS[newPhase as keyof typeof PHASE_LABELS]}`,
        variant: "destructive",
      });
      setActiveId(null);
      setActiveRequest(null);
      return;
    }

    if (currentPhase === "cotacao" && newPhase === "aprovacao_a2") {
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
      } catch {
        toast({
          title: "Erro de Validação",
          description: "Erro ao verificar status da cotação. Tente novamente.",
          variant: "destructive",
        });
        setActiveId(null);
        setActiveRequest(null);
        return;
      }
    }

    moveRequestMutation.mutate({ id: requestId, newPhase });

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

  const requestsByPhase = filteredRequests.reduce((acc: any, request: any) => {
    let phase = request.currentPhase || PURCHASE_PHASES.SOLICITACAO;
    if (["recebimento", "conf_fiscal", "conclusao_compra"].includes(phase)) {
      phase = PURCHASE_PHASES.PEDIDO_CONCLUIDO;
    }
    if (!acquisitionPhases.includes(phase as any)) {
      phase = PURCHASE_PHASES.SOLICITACAO;
    }
    if (!acc[phase]) acc[phase] = [];
    acc[phase].push(request);
    return acc;
  }, {});

  // Apply sorting to each phase
  Object.keys(requestsByPhase).forEach((phase) => {
    requestsByPhase[phase] = sortRequestsByPriority(requestsByPhase[phase]);
  });

  const receiptsByPhase = useMemo(() => {
    const acc: Record<string, ReceiptKanbanRow[]> = {};
    for (const r of Array.isArray(receiptsBoard) ? receiptsBoard : []) {
      const phase = (r as any).receiptPhase || RECEIPT_PHASES.RECEBIMENTO_FISICO;
      if (!receiptPhases.includes(phase as any)) continue;
      if (!acc[phase]) acc[phase] = [];
      acc[phase].push(r);
    }
    return acc;
  }, [receiptsBoard]);

  const handleCreateRFQ = (request: any) => {
    setSelectedRequestForRFQ(request);
    setShowRFQCreation(true);
  };

  const receiptIcons: Record<string, any> = {
    [RECEIPT_PHASES.RECEBIMENTO_FISICO]: Truck,
    [RECEIPT_PHASES.CONF_FISCAL]: ClipboardCheck,
    [RECEIPT_PHASES.CONCLUIDO]: Package,
  };

  const allColumns = useMemo(() => {
    const cols: Array<{ kind: "request" | "receipt"; id: string; title: string; count: number; Icon: any }> = [];
    for (const p of acquisitionPhases) {
      cols.push({
        kind: "request",
        id: p,
        title: PHASE_LABELS[p],
        count: (requestsByPhase[p] || []).length,
        Icon: phaseIcons[p],
      });
    }
    for (const p of receiptPhases) {
      cols.push({
        kind: "receipt",
        id: p,
        title: p === RECEIPT_PHASES.CONCLUIDO ? "Conclusão" : RECEIPT_PHASE_LABELS[p],
        count: (receiptsByPhase[p] || []).length,
        Icon: receiptIcons[p],
      });
    }
    return cols;
  }, [requestsByPhase, receiptsByPhase]);

  // Render loading skeleton if data is loading
  if (isLoading) {
    return (
      <div className="h-full overflow-x-auto px-6 py-4">
        <div
          className="flex space-x-6"
          style={{ minWidth: "max-content", height: "100%" }}
        >
          {allColumns.map((col) => (
            <div key={`${col.kind}-${col.id}`} className="flex-shrink-0 w-80">
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
            {allColumns.map((col) => (
              <div
                key={`${col.kind}-${col.id}`}
                className="w-full flex-shrink-0 snap-start p-4"
              >
                {col.kind === "request" ? (
                  <KanbanColumn
                    phase={col.id as PurchasePhase}
                    title={col.title}
                    requests={requestsByPhase[col.id] || []}
                    onCreateRFQ={handleCreateRFQ}
                    highlightedRequestIds={highlightedRequestIds}
                    onOpenRequest={handleOpenRequest}
                  />
                ) : (
                  <ReceiptKanbanColumn
                    phaseId={col.id}
                    title={col.title}
                    receipts={receiptsByPhase[col.id] || []}
                    onOpenReceipt={handleOpenReceipt}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="fixed md:hidden bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t border-border px-3 py-2 w-full">
            <nav className="flex items-center justify-between gap-2" aria-label="Navegação Kanban">
              {allColumns.map((col, index) => {
                const Icon = col.Icon;
                const count = col.count;
                const isActive = index === currentPhaseIndex;
                return (
                  <button
                    key={`${col.kind}-${col.id}`}
                    type="button"
                    className={`relative flex-1 flex items-center justify-center rounded-md px-2 py-2 transition-colors ${
                      isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                    aria-label={`Ir para ${col.title}`}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => {
                      const container = document.getElementById('kanban-mobile-container');
                      if (container) {
                        const columnWidth = container.scrollWidth / (allColumns.length || 1);
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
            {allColumns.map((col) =>
              col.kind === "request" ? (
                <KanbanColumn
                  key={`${col.kind}-${col.id}`}
                  phase={col.id as PurchasePhase}
                  title={col.title}
                  requests={requestsByPhase[col.id] || []}
                  onCreateRFQ={handleCreateRFQ}
                  highlightedRequestIds={highlightedRequestIds}
                  onOpenRequest={handleOpenRequest}
                />
              ) : (
                <ReceiptKanbanColumn
                  key={`${col.kind}-${col.id}`}
                  phaseId={col.id}
                  title={col.title}
                  receipts={receiptsByPhase[col.id] || []}
                  onOpenReceipt={handleOpenReceipt}
                />
              ),
            )}
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
          {activeReceipt && (
            <div className="rotate-3 transform">
              <ReceiptKanbanCard receipt={activeReceipt} />
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
                  {modalPhase === PURCHASE_PHASES.PEDIDO_CONCLUIDO && `Pedido concluído - Solicitação #${activeRequest?.requestNumber}`}
                  {modalPhase === PURCHASE_PHASES.ARQUIVADO && `Detalhes da Solicitação - #${activeRequest?.requestNumber}`}
                </DialogTitle>
              </div>
            </div>
            <p id="kanban-phase-desc" className="sr-only">
              {modalPhase === PURCHASE_PHASES.PEDIDO_COMPRA && "Tela de Pedido de Compra da solicitação selecionada"}
              {modalPhase === PURCHASE_PHASES.PEDIDO_CONCLUIDO && "Tela de Pedido concluído aguardando início do recebimento físico"}
              {modalPhase === PURCHASE_PHASES.ARQUIVADO && "Tela de detalhes da solicitação arquivada"}
            </p>
            <div className="px-6 pt-0 pb-2">
              <Suspense fallback={<div className="p-4 text-center">Carregando...</div>}>
                {modalPhase === PURCHASE_PHASES.PEDIDO_COMPRA && activeRequest && (
                  <PurchaseOrderPhase request={activeRequest} onClose={() => setIsModalOpen(false)} onPreviewOpen={() => setLockDialogClose(true)} onPreviewClose={() => setLockDialogClose(false)} />
                )}
                {modalPhase === PURCHASE_PHASES.PEDIDO_CONCLUIDO && activeRequest && (
                  <PurchaseOrderPhase request={activeRequest} onClose={() => setIsModalOpen(false)} onPreviewOpen={() => setLockDialogClose(true)} onPreviewClose={() => setLockDialogClose(false)} />
                )}
                {modalPhase === PURCHASE_PHASES.ARQUIVADO && activeRequest && (
                  <RequestView request={activeRequest} onClose={() => setIsModalOpen(false)} />
                )}
              </Suspense>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={isReceiptModalOpen}
          onOpenChange={(open) => {
            setIsReceiptModalOpen(open);
            if (!open) setSelectedReceipt(null);
          }}
        >
          <DialogContent className="sm:max-w-6xl h-[90vh] overflow-y-auto p-0 sm:rounded-lg">
            <div className="flex-shrink-0 bg-card border-b border-border sticky top-0 z-30 px-6 py-3 rounded-t-lg">
              <div className="flex justify-between items-center">
                <DialogTitle className="text-base font-semibold">
                  {selectedReceipt?.request?.requestNumber ? `Recebimento - ${selectedReceipt.request.requestNumber}` : "Recebimento"}
                </DialogTitle>
              </div>
            </div>
            <div className="px-6 pt-3 pb-4">
              {!selectedReceipt || !receiptRequest ? (
                <div className="p-4 text-center">Carregando...</div>
              ) : String((selectedReceipt as any).receiptPhase) === RECEIPT_PHASES.RECEBIMENTO_FISICO ? (
                <ReceiptProvider request={receiptRequest} onClose={() => setIsReceiptModalOpen(false)} mode="physical" receiptId={selectedReceipt.id}>
                  <ReceiptPhysicalPanel />
                </ReceiptProvider>
              ) : (
                <FiscalConferencePhase request={receiptRequest} onClose={() => setIsReceiptModalOpen(false)} mode="fiscal" initialReceiptId={selectedReceipt.id} />
              )}
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
