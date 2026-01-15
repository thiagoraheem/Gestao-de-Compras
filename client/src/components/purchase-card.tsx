import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  URGENCY_LABELS,
  CATEGORY_LABELS,
  PurchasePhase,
  PURCHASE_PHASES,
  PHASE_LABELS,
  ReceiptMode,
} from "@/lib/types";
import { formatCurrency } from "@/lib/currency";
import {
  Clock,
  TriangleAlert,
  AlertCircle,
  Check,
  X,
  Archive,
  Edit,
  GripVertical,
  Trash2,
  Plus,
  Info,
  Eye,
  Download,
  FileText,
  Printer,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState, useMemo, useRef, useEffect, lazy, Suspense } from "react";
import { useAuth } from "@/hooks/useAuth";

const RequestPhase = lazy(() => import("./request-phase"));
const ApprovalA1Phase = lazy(() => import("./approval-a1-phase"));
const ApprovalA2Phase = lazy(() => import("./approval-a2-phase"));
const QuotationPhase = lazy(() => import("./quotation-phase"));
const PurchaseOrderPhase = lazy(() => import("./purchase-order-phase"));
const ReceiptPhase = lazy(() => import("./receipt-phase"));
const ConclusionPhase = lazy(() => import("./conclusion-phase"));
const RequestView = lazy(() => import("./request-view"));

import type { ReceiptPhaseHandle } from "./receipt-phase";
import type { ConclusionPhaseHandle } from "./conclusion-phase";

import { useQuery } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useApprovalType } from "@/hooks/useApprovalType";

interface ApprovalRules {
  requiresDualApproval: boolean;
  approvalStatus: string;
  firstApprover: {
    approverId: number;
    isCEO: boolean;
    firstName: string;
    lastName: string;
  } | null;
}
import { ApprovalTypeBadge, ApprovalProgressBadge } from "@/components/ApprovalTypeBadge";
import { ApprovalTimeline } from "@/components/ApprovalTimeline";
import { Dialog, DialogContent, DialogTitle, DialogClose } from "@/components/ui/dialog";

interface PurchaseCardProps {
  request: any;
  phase: PurchasePhase;
  isDragging?: boolean;
  onCreateRFQ?: (request: any) => void;
  isSearchHighlighted?: boolean;
  onOpenRequest?: (request: any, phase: PurchasePhase, mode?: ReceiptMode) => void;
}

export default function PurchaseCard({
  request,
  phase,
  isDragging = false,
  onCreateRFQ,
  isSearchHighlighted = false,
  onOpenRequest,
}: PurchaseCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [initialA2Action, setInitialA2Action] = useState<'approve' | 'reject' | null>(null);
  const receiptRef = useRef<ReceiptPhaseHandle | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [receiptMode, setReceiptMode] = useState<'view' | 'physical'>('view');

  

  // Get approval type for A2 phase
  const { data: approvalType } = useApprovalType(request.totalValue);

  // Check if user has permission to perform receipt actions
  const canPerformReceiptActions = user?.isReceiver || user?.isAdmin;
  const conclusionRef = useRef<ConclusionPhaseHandle | null>(null);



  const handleCardClick = () => {
    if (onOpenRequest) {
      onOpenRequest(request, phase);
      return;
    }
    setReceiptMode('view');
    setIsEditModalOpen(true);
  };

  // Check if user can drag this card
  const canDrag = useMemo(() => {
    // Always allow dragging - permission check will be done in kanban-board
    // based on source and target phases
    return true;
  }, [phase, user]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: sortableIsDragging,
  } = useSortable({
    id: `request-${request.id}`,
    disabled: !canDrag,
  });

  const approveA1Mutation = useMutation({
    mutationFn: async (data: {
      approved: boolean;
      rejectionReason?: string;
    }) => {
      const response = await apiRequest(
        `/api/purchase-requests/${request.id}/approve-a1`,
        {
          method: "POST",
          body: {
            ...data,
            approverId: user?.id || 1,
          },
        },
      );
      return response;
    },
    onSuccess: (response, variables) => {
      queryClient.setQueryData(["/api/purchase-requests"], (oldData: any[]) => {
        if (!Array.isArray(oldData)) return oldData;
        return oldData.map((item) =>
          item.id === request.id ? response : item,
        );
      });

      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });

      toast({
        title: "Sucesso",
        description: variables.approved
          ? "Solicitação aprovada e movida para Cotação!"
          : "Solicitação reprovada e movida para Arquivado",
      });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "Falha ao processar aprovação";
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const approveA2Mutation = useMutation({
    mutationFn: async (data: {
      approved: boolean;
      rejectionReason?: string;
    }) => {
      const response = await apiRequest(
        `/api/purchase-requests/${request.id}/approve-a2`,
        {
          method: "POST",
          body: {
            ...data,
            approverId: user?.id || 1,
          },
        },
      );
      return response;
    },
    onSuccess: (response: any) => {
      queryClient.setQueryData(["/api/purchase-requests"], (oldData: any[]) => {
        if (!Array.isArray(oldData)) return oldData;
        return oldData.map((item) =>
          item.id === request.id ? response : item,
        );
      });

      // Comprehensive cache invalidation
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
      queryClient.invalidateQueries({
        predicate: (query) =>
          !!(query.queryKey[0]?.toString().includes(`/api/quotations/`) ||
            query.queryKey[0]?.toString().includes(`/api/purchase-requests`)),
      });

      toast({
        title: "Sucesso",
        description: response.approvedA2
          ? "Solicitação aprovada e movida para Pedido de Compra!"
          : "Solicitação reprovada e movida para Arquivado",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao processar aprovação A2",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest(`/api/purchase-requests/${request.id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      // Comprehensive cache invalidation
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
      queryClient.invalidateQueries({
        predicate: (query) =>
          !!(query.queryKey[0]?.toString().includes(`/api/quotations/`) ||
            query.queryKey[0]?.toString().includes(`/api/purchase-requests`)),
      });
      toast({
        title: "Sucesso",
        description: "Requisição excluída com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível excluir a requisição",
        variant: "destructive",
      });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        `/api/purchase-requests/${request.id}/archive`,
        { method: "PATCH" }
      );
      return response;
    },
    onSuccess: () => {
      // Comprehensive cache invalidation
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
      queryClient.invalidateQueries({
        predicate: (query) =>
          !!(query.queryKey[0]?.toString().includes(`/api/quotations/`) ||
            query.queryKey[0]?.toString().includes(`/api/purchase-requests`)),
      });
      toast({
        title: "Sucesso",
        description: "Requisição arquivada com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível arquivar a requisição",
        variant: "destructive",
      });
    },
  });

  const archiveDirectMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        `/api/purchase-requests/${request.id}/archive-direct`,
        { method: "POST" },
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      toast({
        title: "Sucesso",
        description: "Requisição arquivada com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível arquivar a requisição",
        variant: "destructive",
      });
    },
  });

  const sendToApprovalMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        `/api/purchase-requests/${request.id}/send-to-approval`,
        { method: "POST" },
      );
      return response;
    },
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/purchase-requests"] });

      // Snapshot the previous value
      const previousRequests = queryClient.getQueryData([
        "/api/purchase-requests",
      ]);

      // Optimistically update the request phase
      queryClient.setQueryData(["/api/purchase-requests"], (old: any[]) => {
        if (!Array.isArray(old)) return old;
        return old.map((item) =>
          item.id === request.id
            ? {
              ...item,
              currentPhase: "aprovacao_a1",
              updatedAt: new Date().toISOString(),
            }
            : item,
        );
      });

      return { previousRequests };
    },
    onSuccess: () => {
      // Comprehensive cache invalidation
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      queryClient.invalidateQueries({
        predicate: (query) =>
          !!(query.queryKey[0]?.toString().includes(`/api/purchase-requests`)),
      });

      // Force refetch to ensure we have the latest data
      queryClient.refetchQueries({ queryKey: ["/api/purchase-requests"] });

      toast({
        title: "Sucesso",
        description: "Solicitação enviada para aprovação A1",
      });
    },
    onError: (err, variables, context) => {
      // Roll back on error
      if (context?.previousRequests) {
        queryClient.setQueryData(
          ["/api/purchase-requests"],
          context.previousRequests,
        );
      }

      toast({
        title: "Erro",
        description: "Não foi possível enviar para aprovação",
        variant: "destructive",
      });
    },
  });





  const advanceToReceiptMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        `/api/purchase-requests/${request.id}/advance-to-receipt`,
        { method: "POST" },
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      toast({
        title: "Sucesso",
        description: "Solicitação movida para recebimento com sucesso!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Falha ao avançar para recebimento",
        variant: "destructive",
      });
    },
  });

  const handleAdvanceToReceipt = (requestId: number) => {
    // Show confirmation dialog
    if (
      window.confirm(
        "Confirma o avanço desta solicitação para a fase de Recebimento?",
      )
    ) {
      advanceToReceiptMutation.mutate();
    }
  };

  // Function to check if quotation is ready for A2 (for visual feedback)
  const { data: quotationStatus, isError: quotationStatusError } = useQuery({
    queryKey: [`quotation-status`, request.id], // Use correct query key format
    enabled: phase === PURCHASE_PHASES.COTACAO,
    retry: 2,
    staleTime: 60000,
    gcTime: 120000,
    refetchInterval: false,
    queryFn: async () => {
      try {
        const quotation = await apiRequest(
          `/api/quotations/purchase-request/${request.id}`,
        );

        // If no quotation exists (null response)
        if (!quotation) {
          return { isReady: false, reason: "Nenhuma cotação criada" };
        }

        // Ensure quotation has an ID
        if (!quotation.id) {
          return { isReady: false, reason: "RFQ criado - Verificando dados" };
        }

        // If quotation exists, try to get supplier quotations
        try {
          const supplierQuotations = await apiRequest(
            `/api/quotations/${quotation.id}/supplier-quotations`,
          );

          // If no supplier quotations exist, RFQ is created but awaiting supplier responses
          if (!supplierQuotations || supplierQuotations.length === 0) {
            return {
              isReady: false,
              reason: "RFQ criado - Aguardando cotações",
            };
          }

          // Check if any supplier quotations have been received
          const receivedQuotations = supplierQuotations.filter(
            (sq: any) => sq.status === "received",
          );
          const noResponseQuotations = supplierQuotations.filter(
            (sq: any) => sq.status === "no_response",
          );

          // Allow comparison if at least one supplier has responded (even if others haven't)
          if (
            receivedQuotations.length === 0 &&
            noResponseQuotations.length === 0
          ) {
            return {
              isReady: false,
              reason: "Aguardando respostas dos fornecedores",
            };
          } else if (
            receivedQuotations.length === 0 &&
            noResponseQuotations.length > 0
          ) {
            return {
              isReady: false,
              reason: "Nenhum fornecedor respondeu ainda",
            };
          }

          // Check if a supplier has been chosen
          const hasChosenSupplier = supplierQuotations.some(
            (sq: any) => sq.isChosen,
          );
          if (!hasChosenSupplier) {
            return {
              isReady: false,
              reason: "Aguardando seleção de fornecedor",
            };
          }

          return { isReady: true, reason: "Pronto para Aprovação A2" };
        } catch (supplierError) {
          // If we can't get supplier quotations but quotation exists,
          // it means RFQ is created but no suppliers assigned yet
          return {
            isReady: false,
            reason: "RFQ criado - Configurando fornecedores",
          };
        }
      } catch (error) {
        // Return a safe default instead of throwing
        // This is normal for requests that don't have quotations yet
        return { isReady: false, reason: "Nenhuma cotação criada" };
      }
    },
  });

  const getUrgencyIcon = (urgency: string) => {
    switch (urgency) {
      case "alta_urgencia":
        return <TriangleAlert className="mr-1 h-3 w-3" />;
      case "alto":
        return <TriangleAlert className="mr-1 h-3 w-3" />;
      case "medio":
        return <AlertCircle className="mr-1 h-3 w-3" />;
      default:
        return <Clock className="mr-1 h-3 w-3" />;
    }
  };

  const getUrgencyClass = (urgency: string) => {
    switch (urgency) {
      case "alto":
        return "urgency-high";
      case "medio":
        return "urgency-medium";
      default:
        return "urgency-low";
    }
  };



  const formatDate = (date: any) => {
    if (!date) return null;
    return formatDistanceToNow(new Date(date), {
      addSuffix: true,
      locale: ptBR,
    });
  };

  const isArchived = phase === PURCHASE_PHASES.ARQUIVADO;
  const isFinalPhase =
    phase === PURCHASE_PHASES.ARQUIVADO ||
    phase === PURCHASE_PHASES.CONCLUSAO_COMPRA;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging || sortableIsDragging ? 0.5 : canDrag ? 1 : 0.7,
  };

  // Check user permissions for showing certain actions
  const canApproveA1 = user?.isApproverA1 || false;
  const canApproveA2 = user?.isApproverA2 || false;

  // Get approval rules and status for A2 phase
  // Get approval rules and status for A2 phase
  const { data: approvalRules } = useQuery<ApprovalRules>({
    queryKey: [`/api/approval-rules/${request.id}`],
    enabled: !!(phase === PURCHASE_PHASES.APROVACAO_A2 && request?.id),
    staleTime: 30000, // Cache for 30 seconds
  });

  // Check if user can approve this specific request based on cost center
  const { data: canApproveThisRequest } = useQuery({
    queryKey: [`/api/purchase-requests/${request.id}/can-approve-a1`],
    enabled: !!(user?.isApproverA1 && phase === PURCHASE_PHASES.APROVACAO_A1 && request?.id),
    staleTime: 30000, // Cache for 30 seconds to avoid excessive requests
  });

  // Determine if current user can approve A2 based on approval rules
  const canUserApproveA2 = useMemo(() => {
    if (!canApproveA2 || phase !== PURCHASE_PHASES.APROVACAO_A2 || !approvalRules) {
      return false;
    }

    const { requiresDualApproval, approvalStatus, firstApprover } = approvalRules;

    // For single approval, any A2 approver can approve
    if (!requiresDualApproval) {
      return true;
    }

    // For dual approval, check the current status
    if (approvalStatus === "awaiting_first") {
      // First approval - any director or CEO can approve
      return user?.isDirector || user?.isCEO;
    } else if (approvalStatus === "awaiting_final") {
      // Final approval - must be different from first approver
      if (firstApprover && firstApprover.approverId === user?.id) {
        return false; // Same user cannot provide both approvals
      }

      // If first approver was not CEO, final approval must be from CEO
      if (firstApprover && !firstApprover.isCEO && !user?.isCEO) {
        return false;
      }

      return user?.isDirector || user?.isCEO;
    }

    return false;
  }, [canApproveA2, phase, approvalRules, user]);

  // Check if user can drag this card
  const canDragCard = useMemo(() => {
    return (canDrag && phase === PURCHASE_PHASES.SOLICITACAO) || // Always allow dragging from request phase
      phase === PURCHASE_PHASES.COTACAO || // Always allow dragging from quotation phase
      phase === PURCHASE_PHASES.APROVACAO_A1 || // Allow dragging from A1 (permission check happens in kanban-board)
      phase === PURCHASE_PHASES.APROVACAO_A2 || // Allow dragging from A2 (permission check happens in kanban-board)
      phase === PURCHASE_PHASES.PEDIDO_COMPRA || // Allow dragging from purchase order phase
      phase === PURCHASE_PHASES.RECEBIMENTO;
  }, [canDrag, phase]); // Allow dragging from receipt phase

  const canEditInApprovalPhase =
    phase === PURCHASE_PHASES.ARQUIVADO || // Always allow viewing history in archived phase
    (phase === PURCHASE_PHASES.APROVACAO_A1 && canApproveA1) ||
    (phase === PURCHASE_PHASES.APROVACAO_A2 && canApproveA2) ||
    (phase !== PURCHASE_PHASES.APROVACAO_A1 &&
      phase !== PURCHASE_PHASES.APROVACAO_A2);

  return (
    <>
      <Card
        ref={setNodeRef}
        style={style}
        {...attributes}
        data-request-id={request.id}
        onClick={handleCardClick}
        className={cn(
          "mb-2 cursor-pointer select-none rounded-lg shadow-sm border-border",
          isDragging && "opacity-50",
          sortableIsDragging && "opacity-50",
          isFinalPhase && "bg-muted text-muted-foreground",
          !canDragCard && "cursor-not-allowed",
          isSearchHighlighted && "ring-2 ring-blue-500 ring-offset-2 bg-blue-500/10 border-blue-500/30 shadow-lg",
        )
        }
      >
        <CardContent className="p-3 space-y-3">
          {/* Header with drag handle and request number */}
          <div className="flex items-center justify-between mb-2 md:mb-2 lg:mb-1">
            <div className="flex items-center gap-1 md:gap-1 lg:gap-1">
              <div
                {...(canDragCard ? listeners : {})}
                className={cn(
                  "p-0.5 rounded",
                  canDragCard
                    ? "cursor-grab active:cursor-grabbing hover:bg-muted"
                    : "cursor-not-allowed opacity-50",
                )}
                title={
                  canDragCard
                    ? "Arrastar para mover"
                    : "Você não tem permissão para mover este card"
                }
              >
                <GripVertical
                  className={cn(
                    "h-3 w-3 md:h-4 md:w-4 lg:h-3 lg:w-3",
                    canDragCard ? "text-muted-foreground" : "text-muted-foreground/50",
                  )}
                />
              </div>
              <Badge className="font-mono text-sm bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 font-semibold px-2 py-1 rounded hover:bg-orange-200 dark:hover:bg-orange-900/70 border-none">
                {request.requestNumber}{request.purchaseOrder?.orderNumber ? ` - ${request.purchaseOrder.orderNumber}` : ''}
              </Badge>
            </div>
            <div className="flex gap-0.5">
              {phase === "solicitacao" && !request.approvedA1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 md:h-6 md:w-6 lg:h-5 lg:w-5"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteDialog(true);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
              {!isArchived && phase !== PURCHASE_PHASES.CONCLUSAO_COMPRA && (user?.isAdmin || user?.isBuyer) && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 md:h-6 md:w-6 lg:h-5 lg:w-5"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowArchiveDialog(true);
                  }}
                >
                  <Archive className="h-3 w-3" />
                </Button>
              )}
              {canEditInApprovalPhase && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 md:h-6 md:w-6 lg:h-5 lg:w-5"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenRequest ? onOpenRequest(request, phase) : setIsEditModalOpen(true);
                  }}
                >
                  <Edit className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          {/* Title */}
          <h4
            className={cn(
              "font-semibold text-slate-800 dark:text-slate-100",
              isArchived && "text-muted-foreground",
            )}
            title={request.justification}
          >
            {request.justification}
          </h4>

          {/* Urgency and category info */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {request.urgency && (
              <Badge
                className={cn(
                  "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border-none",
                  (request.urgency === "alta_urgencia" || request.urgency === "alto")
                    ? "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/50"
                    : "text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/50"
                )}
              >
                {getUrgencyIcon(request.urgency)}
                {URGENCY_LABELS[request.urgency as keyof typeof URGENCY_LABELS]}
              </Badge>
            )}
            <Badge variant="outline" className="text-xs px-1.5 py-0.5">
              {
                CATEGORY_LABELS[
                request.category as keyof typeof CATEGORY_LABELS
                ]
              }
            </Badge>
            {/* Show approval type badge for A2 phase */}
            {phase === PURCHASE_PHASES.APROVACAO_A2 && approvalType && (
              <ApprovalTypeBadge approvalType={approvalType} />
            )}
            {/* Show approval progress for A2 phase */}
            {phase === PURCHASE_PHASES.APROVACAO_A2 && request.approvalProgress && (
              <ApprovalProgressBadge
                approvalType={approvalType || 'single'}
                currentStep={request.approvalProgress.currentStep}
                totalSteps={request.approvalProgress.totalSteps}
              />
            )}
            {/* Show red tag for items with pending issues returned from receipt */}
            {request.hasPendency && phase === PURCHASE_PHASES.PEDIDO_COMPRA && (
              <div
                title={
                  request.pendencyReason || "Solicitação retornou com pendência"
                }
              >
                <Badge
                  variant="destructive"
                  className="text-xs px-1.5 py-0.5 bg-red-500 text-white border-red-600 cursor-help"
                >
                  <AlertCircle className="mr-1 h-3 w-3" />
                  Pendência
                </Badge>
              </div>
            )}
            {/* Show red tag for items rejected from A2 and returned to quotation */}
            {request.approvedA2 === false &&
              request.rejectionActionA2 === "recotacao" &&
              phase === PURCHASE_PHASES.COTACAO && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <div className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-500 text-white border border-red-600 cursor-help">
                        <X className="mr-1 h-3 w-3" />
                        Nec.Cotação
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{request.rejectionReasonA2 || "Reprovada em Aprovação A2 - necessária nova cotação"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
          </div>

          {/* Additional info */}
          <div
            className={cn(
              "text-sm text-slate-600 dark:text-slate-400 space-y-1 border-t border-border pt-2 mt-2",
              isArchived && "text-slate-500",
            )}
          >
            {request.totalValue && (
              <p>
                <span className="font-medium text-slate-700 dark:text-slate-300">Valor:</span> {formatCurrency(request.totalValue)}
              </p>
            )}

            {/* Show requester on all cards */}
            {request.requester && (
              <p>
                <span className="font-medium text-slate-700 dark:text-slate-300">Solicitante:</span> {request.requester.firstName}{" "}
                {request.requester.lastName}
              </p>
            )}

            {/* Show approver from cotacao phase onwards */}
            {(phase === PURCHASE_PHASES.COTACAO ||
              phase === PURCHASE_PHASES.APROVACAO_A2 ||
              phase === PURCHASE_PHASES.PEDIDO_COMPRA ||
              phase === PURCHASE_PHASES.RECEBIMENTO ||
              phase === PURCHASE_PHASES.CONCLUSAO_COMPRA) &&
              request.approverA1 && (
                <p>
                  <span className="font-medium text-slate-700 dark:text-slate-300">Aprovador:</span> {request.approverA1.firstName}{" "}
                  {request.approverA1.lastName}
                </p>
              )}

            {/* Show chosen supplier for specific phases */}
            {(phase === PURCHASE_PHASES.APROVACAO_A2 ||
              phase === PURCHASE_PHASES.PEDIDO_COMPRA ||
              phase === PURCHASE_PHASES.RECEBIMENTO ||
              phase === PURCHASE_PHASES.CONCLUSAO_COMPRA) &&
              request.chosenSupplier && (
                <p className="text-xs md:text-xs lg:text-xs">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Fornecedor:</span> {request.chosenSupplier.name}
                </p>
              )}

            {phase === PURCHASE_PHASES.APROVACAO_A1 && (
              <p className="text-xs md:text-xs lg:text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300">Aprovador:</span> Pendente
              </p>
            )}
          </div>

          {/* Approval Timeline for A2 phase */}
          {phase === PURCHASE_PHASES.APROVACAO_A2 && request.approvalProgress && (
            <div className="mt-2 md:mt-2 lg:mt-1">
              <ApprovalTimeline
                steps={request.approvalProgress.steps || []}
                currentStep={request.approvalProgress.currentStep}
                totalSteps={request.approvalProgress.totalSteps}
                approvalType={approvalType || 'single'}
                compact={true}
              />
            </div>
          )}

          {/* Footer with Date and Actions */}
          <div className="border-t border-border pt-3 mt-3 flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500 dark:text-slate-500">
              {formatDate(request.createdAt)}
            </p>

            {/* Actions Container */}
            <div className="flex items-center gap-2">
              {/* Send to Approval Button for Request Phase */}
              {phase === PURCHASE_PHASES.SOLICITACAO && (
                <Button
                  size="sm"
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-orange-500 rounded-md hover:bg-orange-600 h-auto"
                  onClick={(e) => {
                    e.stopPropagation();
                    sendToApprovalMutation.mutate();
                  }}
                  disabled={sendToApprovalMutation.isPending}
                >
                  <Check className="mr-1 h-3 w-3" />
                  {sendToApprovalMutation.isPending ? "Avançando..." : "Avançar"}
                </Button>
              )}

              {/* RFQ Creation/Edit Button for Quotation Phase */}
              {phase === PURCHASE_PHASES.COTACAO && user?.isBuyer && onCreateRFQ && (
                <Button
                  size="sm"
                  className={
                    `px-3 py-1.5 text-xs font-semibold text-white rounded-md h-auto ` +
                    (request.hasQuotation
                      ? `bg-orange-500 hover:bg-orange-600`
                      : `bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600`)
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    if (request.hasQuotation) {
                      onOpenRequest ? onOpenRequest(request, phase) : setIsEditModalOpen(true);
                    } else {
                      onCreateRFQ(request);
                    }
                  }}
                >
                  {request.hasQuotation ? (
                    <Eye className="mr-1 h-3 w-3" />
                  ) : (
                    <Plus className="mr-1 h-3 w-3" />
                  )}
                  {request.hasQuotation ? "Ver RFQ" : "Criar RFQ"}
                </Button>
              )}

              {/* Approval A1 Actions */}
              {phase === PURCHASE_PHASES.APROVACAO_A1 && canApproveA1 && (
                (canApproveThisRequest as any)?.canApprove ? (
                  <>
                    <button
                      className="px-3 py-1.5 text-xs font-semibold text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/40 rounded-md hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        approveA1Mutation.mutate({
                          approved: false,
                          rejectionReason: "Reprovado via ação rápida",
                        });
                      }}
                      disabled={approveA1Mutation.isPending}
                    >
                      Rejeitar
                    </button>
                    <button
                      className="px-3 py-1.5 text-xs font-semibold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/40 rounded-md hover:bg-green-200 dark:hover:bg-green-900/60 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        approveA1Mutation.mutate({ approved: true });
                      }}
                      disabled={approveA1Mutation.isPending}
                    >
                      Aprovar
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                    Sem permissão
                  </span>
                )
              )}

              {/* Approval A2 Actions */}
              {phase === PURCHASE_PHASES.APROVACAO_A2 && canApproveA2 && (
                canUserApproveA2 ? (
                  <>
                    <button
                      className="px-3 py-1.5 text-xs font-semibold text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/40 rounded-md hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInitialA2Action('reject');
                        onOpenRequest ? onOpenRequest(request, phase) : setIsEditModalOpen(true);
                      }}
                      disabled={approveA2Mutation.isPending}
                    >
                      Rejeitar
                    </button>
                    <button
                      className="px-3 py-1.5 text-xs font-semibold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/40 rounded-md hover:bg-green-200 dark:hover:bg-green-900/60 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInitialA2Action('approve');
                        onOpenRequest ? onOpenRequest(request, phase) : setIsEditModalOpen(true);
                      }}
                      disabled={approveA2Mutation.isPending}
                    >
                      Aprovar
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                    Aguardando
                  </span>
                )
              )}

              {/* Receipt Actions */}
              {phase === PURCHASE_PHASES.RECEBIMENTO && canPerformReceiptActions && (
                <>

                  
                  {/* Physical Receipt Button */}
                  <button
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      setReceiptMode('physical');
                      if (onOpenRequest) {
                        onOpenRequest(request, PURCHASE_PHASES.RECEBIMENTO, 'physical');
                      } else {
                        setIsEditModalOpen(true);
                      }
                    }}
                    disabled={!!request.physicalReceiptAt}
                  >
                    {request.physicalReceiptAt ? "Físico OK" : "Confirmar"}
                  </button>
                </>
              )}

              {/* Purchase Order Actions */}
              {phase === PURCHASE_PHASES.PEDIDO_COMPRA && (
                <Button
                  size="sm"
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 h-auto"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAdvanceToReceipt(request.id);
                  }}
                >
                  <Check className="h-3 w-3 mr-1" />
                  Recebimento
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card >
      {/* Phase-specific Edit Modals */}
      {
        phase === PURCHASE_PHASES.SOLICITACAO && (
          <Suspense fallback={<div className="p-4 text-center">Carregando...</div>}>
            <RequestPhase
              request={request}
              open={isEditModalOpen}
              onOpenChange={(open) => setIsEditModalOpen(open)}
            />
          </Suspense>
        )
      }
      {
        phase === PURCHASE_PHASES.APROVACAO_A1 && (
          <Suspense fallback={<div className="p-4 text-center">Carregando...</div>}>
            <ApprovalA1Phase
              request={request}
              open={isEditModalOpen}
              onOpenChange={(open) => setIsEditModalOpen(open)}
            />
          </Suspense>
        )
      }
      {
        phase === PURCHASE_PHASES.APROVACAO_A2 && (
          <Suspense fallback={<div className="p-4 text-center">Carregando...</div>}>
            <ApprovalA2Phase
              request={request}
              open={isEditModalOpen}
              onOpenChange={(open) => {
                setIsEditModalOpen(open);
                if (!open) setInitialA2Action(null);
              }}
              initialAction={initialA2Action}
            />
          </Suspense>
        )
      }
      {
        phase === PURCHASE_PHASES.COTACAO && (
          <Suspense fallback={<div className="p-4 text-center">Carregando...</div>}>
            <QuotationPhase
              request={request}
              open={isEditModalOpen}
              onOpenChange={(open) => setIsEditModalOpen(open)}
            />
          </Suspense>
        )
      }
      {
        isEditModalOpen && !onOpenRequest && phase === PURCHASE_PHASES.PEDIDO_COMPRA && (
          <Dialog open={isEditModalOpen} onOpenChange={(open) => { if (!open && isPreviewOpen) return; setIsEditModalOpen(open); try { if (open) { sessionStorage.setItem('kanban_modal_open_request', String(request.id)); } else { const v = sessionStorage.getItem('kanban_modal_open_request'); if (v === String(request.id)) sessionStorage.removeItem('kanban_modal_open_request'); } } catch {} }}>
            <DialogContent 
              className="sm:max-w-6xl max-h-[90vh] overflow-y-auto p-0 sm:rounded-lg" 
              aria-describedby="purchase-order-phase-desc"
              onInteractOutside={(e) => e.preventDefault()}
              onEscapeKeyDown={(e) => e.preventDefault()}
              onPointerDownOutside={(e) => e.preventDefault()}
              onFocusOutside={(e) => e.preventDefault()}
            >
              <div className="flex-shrink-0 bg-background border-b border-border sticky top-0 z-30 px-6 py-3 rounded-t-lg">
                <div className="flex justify-between items-center">
                  <DialogTitle className="text-base font-semibold flex items-center gap-2">
                    Pedido de Compra - {request.requestNumber}{request.purchaseOrder?.orderNumber ? ` - ${request.purchaseOrder.orderNumber}` : ''}
                  </DialogTitle>
                  <div className="flex items-center gap-2">
                    {request.urgency && (
                      <Badge variant={request.urgency === "alto" ? "destructive" : "secondary"}>
                        {URGENCY_LABELS[request.urgency as keyof typeof URGENCY_LABELS] || request.urgency}
                      </Badge>
                    )}
                    
                    <DialogClose asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <X className="h-4 w-4" />
                        <span className="sr-only">Fechar</span>
                      </Button>
                    </DialogClose>
                  </div>
                </div>
                <p id="purchase-order-phase-desc" className="sr-only">Tela de pedido de compra da solicitação</p>
              </div>
              <div className="px-6 pt-0 pb-2">
                <Suspense fallback={<div className="p-4 text-center">Carregando...</div>}>
                  <PurchaseOrderPhase
                    request={request}
                    onClose={() => setIsEditModalOpen(false)}
                    onPreviewOpen={() => setIsPreviewOpen(true)}
                    onPreviewClose={() => setIsPreviewOpen(false)}
                  />
                </Suspense>
              </div>
            </DialogContent>
          </Dialog>
        )
      }

      {
        isEditModalOpen && !onOpenRequest && phase === PURCHASE_PHASES.RECEBIMENTO && (
          <Dialog open={isEditModalOpen} onOpenChange={(open) => { if (!open && isPreviewOpen) return; setIsEditModalOpen(open); try { if (open) { sessionStorage.setItem('kanban_modal_open_request', String(request.id)); } else { const v = sessionStorage.getItem('kanban_modal_open_request'); if (v === String(request.id)) sessionStorage.removeItem('kanban_modal_open_request'); } } catch {} }}>
            <DialogContent 
              className="sm:max-w-6xl max-h-[90vh] overflow-y-auto p-0 sm:rounded-lg" 
              aria-describedby="receipt-phase-desc"
              onInteractOutside={(e) => e.preventDefault()}
              onEscapeKeyDown={(e) => e.preventDefault()}
              onPointerDownOutside={(e) => e.preventDefault()}
              onFocusOutside={(e) => e.preventDefault()}
            >
              <div className="flex-shrink-0 bg-background border-b border-border sticky top-0 z-30 px-6 py-3 rounded-t-lg">
                <div className="flex justify-between items-center">
                  <DialogTitle className="text-base font-semibold">Recebimento de Material - Solicitação #{request.requestNumber}</DialogTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setIsPreviewOpen(true); try { sessionStorage.setItem('kanban_modal_open_request', String(request.id)); } catch {} receiptRef.current?.previewPDF(); }}
                      size="sm"
                      variant="outline"
                      className="border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Visualizar PDF
                    </Button>
                    <Button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); receiptRef.current?.downloadPDF(); }}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Baixar PDF
                    </Button>
                    <DialogClose asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <X className="h-4 w-4" />
                        <span className="sr-only">Fechar</span>
                      </Button>
                    </DialogClose>
                  </div>
                </div>
                <p id="receipt-phase-desc" className="sr-only">Tela de recebimento de material da solicitação</p>
              </div>
              <div className="px-6 pt-0 pb-2">
                <Suspense fallback={<div className="p-4 text-center">Carregando...</div>}>
                  <ReceiptPhase
                    request={request}
                    onClose={() => setIsEditModalOpen(false)}
                    ref={receiptRef}
                    onPreviewOpen={() => setIsPreviewOpen(true)}
                    onPreviewClose={() => setIsPreviewOpen(false)}
                    mode={receiptMode}
                    compactHeader
                  />
                </Suspense>
              </div>
            </DialogContent>
          </Dialog>
        )
      }

      {
        isEditModalOpen && !onOpenRequest && phase === PURCHASE_PHASES.CONCLUSAO_COMPRA && (
          <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
            <DialogContent hideClose className="sm:max-w-5xl max-h-[90vh] overflow-y-auto p-0 sm:rounded-lg" aria-describedby="conclusion-phase-desc">
              <div className="flex justify-between items-center px-6 py-3 border-b bg-card text-card-foreground">
                <DialogTitle className="text-base font-semibold">Conclusão da Compra - Solicitação #{request.requestNumber}</DialogTitle>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={(e) => { e.stopPropagation(); conclusionRef.current?.downloadPurchaseOrderPDF(); }}
                    size="sm"
                    variant="outline"
                    className="border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    PDF Pedido de Compra
                  </Button>
                  <Button onClick={(e) => { e.stopPropagation(); conclusionRef.current?.exportPDF(); }} size="sm" variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Exportar PDF
                  </Button>
                  <Button onClick={(e) => { e.stopPropagation(); conclusionRef.current?.printSummary(); }} size="sm" variant="outline">
                    <Printer className="w-4 h-4 mr-2" />
                    Imprimir
                  </Button>
                  <Button onClick={(e) => { e.stopPropagation(); conclusionRef.current?.sendEmail(); }} size="sm" variant="outline">
                    <Mail className="w-4 h-4 mr-2" />
                    Enviar E-mail
                  </Button>
                  <Button onClick={(e) => { e.stopPropagation(); conclusionRef.current?.openArchiveDialog(); }} size="sm" variant="outline">
                    <Archive className="w-4 h-4 mr-2" />
                    Arquivar
                  </Button>
                  <DialogClose asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <X className="h-4 w-4" />
                      <span className="sr-only">Fechar</span>
                    </Button>
                  </DialogClose>
                </div>
              </div>
              <p id="conclusion-phase-desc" className="sr-only">Tela de conclusão de compra da solicitação</p>
              <div className="px-6 pt-0 pb-2">
                <Suspense fallback={<div className="p-4 text-center">Carregando...</div>}>
                  <ConclusionPhase
                    request={request}
                    onClose={() => setIsEditModalOpen(false)}
                    ref={conclusionRef}
                  />
                </Suspense>
              </div>
            </DialogContent>
          </Dialog>
        )
      }

      {/* Request View for Archived Phase */}
      {
        isEditModalOpen && phase === PURCHASE_PHASES.ARQUIVADO && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setIsEditModalOpen(false)}
          >
            <div
              className="bg-white rounded-lg max-w-6xl max-h-[90vh] overflow-y-auto w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <Suspense fallback={<div className="p-4 text-center">Carregando...</div>}>
                <RequestView
                  request={request}
                  onClose={() => setIsEditModalOpen(false)}
                />
              </Suspense>
            </div>
          </div>
        )
      }

      {/* Default Edit Dialog for other phases */}
      {
        isEditModalOpen &&
        phase !== PURCHASE_PHASES.SOLICITACAO &&
        phase !== PURCHASE_PHASES.APROVACAO_A1 &&
        phase !== PURCHASE_PHASES.APROVACAO_A2 &&
        phase !== PURCHASE_PHASES.COTACAO &&
        phase !== PURCHASE_PHASES.PEDIDO_COMPRA &&
        phase !== PURCHASE_PHASES.RECEBIMENTO &&
        phase !== PURCHASE_PHASES.CONCLUSAO_COMPRA &&
        phase !== PURCHASE_PHASES.ARQUIVADO && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setIsEditModalOpen(false)}
          >
            <div
              className="bg-white p-6 rounded-lg max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-4">Editar Solicitação</h3>
              <p className="text-sm text-gray-600 mb-4">
                <strong>Número:</strong> {request.requestNumber}
              </p>
              <p className="text-sm text-gray-600 mb-4">
                <strong>Fase Atual:</strong> {PHASE_LABELS[phase]}
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Fechar
                </Button>
                <Button onClick={() => setIsEditModalOpen(false)}>
                  Salvar
                </Button>
              </div>
            </div>
          </div>
        )
      }
      {/* Diálogo de confirmação para excluir */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Requisição</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta requisição? Esta ação não pode
              ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate()}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Diálogo de confirmação para arquivar */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar Requisição</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja arquivar esta requisição?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => archiveDirectMutation.mutate()}>
              Arquivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
