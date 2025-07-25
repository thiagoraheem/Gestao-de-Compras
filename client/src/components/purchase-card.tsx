import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  URGENCY_LABELS,
  CATEGORY_LABELS,
  PurchasePhase,
  PURCHASE_PHASES,
  PHASE_LABELS,
} from "@/lib/types";
import {
  Paperclip,
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState, useMemo } from "react";
import RequestPhase from "./request-phase";
import ApprovalA1Phase from "./approval-a1-phase";
import ApprovalA2Phase from "./approval-a2-phase";
import QuotationPhase from "./quotation-phase";
import PurchaseOrderPhase from "./purchase-order-phase";
import ReceiptPhase from "./receipt-phase";
import ConclusionPhase from "./conclusion-phase";
import { useAuth } from "@/hooks/useAuth";
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

interface PurchaseCardProps {
  request: any;
  phase: PurchasePhase;
  isDragging?: boolean;
  onCreateRFQ?: (request: any) => void;
}

export default function PurchaseCard({
  request,
  phase,
  isDragging = false,
  onCreateRFQ,
}: PurchaseCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [initialA2Action, setInitialA2Action] = useState<'approve' | 'reject' | null>(null);

  // Check if user has permission to perform receipt actions
  const canPerformReceiptActions = user?.isReceiver || user?.isAdmin;

  // Buscar anexos da solicitação
  const { data: attachments = [] } = useQuery<any[]>({
    queryKey: [`/api/purchase-requests/${request.id}/attachments`],
    enabled: !!request?.id,
  });

  const handleCardClick = () => {
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
          query.queryKey[0]?.toString().includes(`/api/quotations/`) ||
          query.queryKey[0]?.toString().includes(`/api/purchase-requests`),
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
          query.queryKey[0]?.toString().includes(`/api/quotations/`) ||
          query.queryKey[0]?.toString().includes(`/api/purchase-requests`),
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
        { method: "POST" },
      );
      return response;
    },
    onSuccess: () => {
      // Comprehensive cache invalidation
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
      queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0]?.toString().includes(`/api/quotations/`) ||
          query.queryKey[0]?.toString().includes(`/api/purchase-requests`),
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
          query.queryKey[0]?.toString().includes(`/api/purchase-requests`),
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

  const confirmReceiptMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        `/api/purchase-requests/${request.id}/confirm-receipt`,
        {
          method: "POST",
          body: {
            receivedById: user?.id,
          },
        },
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      toast({
        title: "Sucesso",
        description: "Recebimento confirmado! Item movido para Conclusão.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível confirmar o recebimento",
        variant: "destructive",
      });
    },
  });

  const reportIssueMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        `/api/purchase-requests/${request.id}/report-issue`,
        {
          method: "POST",
          body: {
            reportedById: user?.id,
          },
        },
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      toast({
        title: "Pendência Reportada",
        description:
          "Item retornado para Pedido de Compra com tag de pendência.",
        variant: "destructive",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível reportar a pendência",
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
    staleTime: 0, // No cache to avoid stale data issues
    cacheTime: 0, // No cache time
    refetchInterval: 5000, // Auto-refetch every 5 seconds
    queryFn: async () => {
      try {
        // Use apiRequest but force cache invalidation
        await queryClient.invalidateQueries({
          queryKey: [`/api/quotations/purchase-request/${request.id}`],
        });

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

  const formatCurrency = (value: any) => {
    if (!value) return null;
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(Number(value));
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

  // Check if user can approve this specific request based on cost center
  const { data: canApproveThisRequest } = useQuery({
    queryKey: [`/api/purchase-requests/${request.id}/can-approve-a1`],
    enabled: !!(user?.isApproverA1 && phase === PURCHASE_PHASES.APROVACAO_A1 && request?.id),
    staleTime: 30000, // Cache for 30 seconds to avoid excessive requests
  });

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
      phase !== PURCHASE_PHASES.APROVACAO_A2.APROVACAO_A1 &&
      phase !== PURCHASE_PHASES.APROVACAO_A2);

  return (
    <>
      <Card
        ref={setNodeRef}
        style={style}
        {...attributes}
        data-request-id={request.id}
        onClick={() => setIsEditModalOpen(true)}
        className={cn(
          "mb-2 cursor-pointer select-none",
          isDragging && "opacity-50",
          sortableIsDragging && "opacity-50",
          isFinalPhase && "bg-gray-100 text-gray-600 border-gray-300",
          !canDragCard && "cursor-not-allowed border-gray-300 bg-gray-50",
        )}
      >
        <CardContent className="p-4">
          {/* Header with drag handle and request number */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div
                {...(canDragCard ? listeners : {})}
                className={cn(
                  "p-1 rounded",
                  canDragCard
                    ? "cursor-grab active:cursor-grabbing hover:bg-gray-100"
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
                    "h-4 w-4",
                    canDragCard ? "text-gray-400" : "text-gray-300",
                  )}
                />
              </div>
              <Badge>{request.requestNumber}</Badge>
            </div>
            <div className="flex gap-1">
              {phase === "solicitacao" && !request.approvedA1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteDialog(true);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              {!isArchived && phase !== PURCHASE_PHASES.CONCLUSAO_COMPRA && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowArchiveDialog(true);
                  }}
                >
                  <Archive className="h-4 w-4" />
                </Button>
              )}
              {canEditInApprovalPhase && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditModalOpen(true);
                  }}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Title in one line */}
          <h4
            className={cn(
              "font-medium mb-2 truncate",
              isArchived ? "text-gray-700" : "text-gray-900",
            )}
            title={request.justification}
          >
            {request.justification}
          </h4>

          {/* Urgency and category info */}
          <div className="flex items-center gap-2 mb-3">
            {request.urgency && (
              <Badge
                variant={
                  request.urgency === "alta_urgencia" || request.urgency === "alto" ? "destructive" : "secondary"
                }
                className="text-xs"
              >
                {getUrgencyIcon(request.urgency)}
                {URGENCY_LABELS[request.urgency as keyof typeof URGENCY_LABELS]}
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {
                CATEGORY_LABELS[
                  request.category as keyof typeof CATEGORY_LABELS
                ]
              }
            </Badge>
            {/* Show red tag for items with pending issues returned from receipt */}
            {request.hasPendency && phase === PURCHASE_PHASES.PEDIDO_COMPRA && (
              <div
                title={
                  request.pendencyReason || "Solicitação retornou com pendência"
                }
              >
                <Badge
                  variant="destructive"
                  className="text-xs bg-red-500 text-white border-red-600 cursor-help"
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
                    <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500 text-white border border-red-600 cursor-help">
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
              "text-sm space-y-1",
              isArchived ? "text-gray-500" : "text-gray-600",
            )}
          >
            {request.totalValue && (
              <p>
                <strong>Valor:</strong> {formatCurrency(request.totalValue)}
              </p>
            )}

            {/* Show requester on all cards */}
            {request.requester && (
              <p>
                <strong>Solicitante:</strong> {request.requester.firstName}{" "}
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
                  <strong>Aprovador:</strong> {request.approverA1.firstName}{" "}
                  {request.approverA1.lastName}
                </p>
              )}

            {phase === PURCHASE_PHASES.APROVACAO_A1 && (
              <p>
                <strong>Aprovador:</strong> Pendente
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">
              {formatDate(request.createdAt)}
            </span>
            <div className="flex items-center space-x-1">
              <Paperclip className="text-gray-400 text-xs h-3 w-3" />
              <span className="text-xs text-gray-500">
                {attachments.length} anexo{attachments.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {/* Send to Approval Button for Request Phase */}
          {phase === PURCHASE_PHASES.SOLICITACAO && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <Button
                size="sm"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  sendToApprovalMutation.mutate();
                }}
                disabled={sendToApprovalMutation.isPending}
              >
                <Check className="mr-1 h-3 w-3" />
                {sendToApprovalMutation.isPending
                  ? "Enviando..."
                  : "Enviar para Aprovação"}
              </Button>
            </div>
          )}

          {/* RFQ Creation/Edit Button for Quotation Phase */}
          {phase === PURCHASE_PHASES.COTACAO &&
            user?.isBuyer &&
            onCreateRFQ && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <Button
                  size="sm"
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (request.hasQuotation) {
                      // Open edit modal for existing RFQ
                      setIsEditModalOpen(true);
                    } else {
                      // Create new RFQ
                      onCreateRFQ(request);
                    }
                  }}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  {request.hasQuotation ? "Visualizar RFQ" : "Criar RFQ"}
                </Button>
              </div>
            )}

          {/* Permission Warning for Restricted Cards */}
          {((phase === PURCHASE_PHASES.APROVACAO_A1 && !canApproveA1) ||
            (phase === PURCHASE_PHASES.APROVACAO_A2 && !canApproveA2)) && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-2 rounded-md">
                  <TriangleAlert className="h-4 w-4" />
                  <span className="text-sm">
                    {phase === PURCHASE_PHASES.APROVACAO_A1
                      ? "Permissão de Aprovação A1 necessária"
                      : "Permissão de Aprovação A2 necessária"}
                  </span>
                </div>
              </div>
            )}

          {/* Quotation Status Indicator for Cotação phase */}
          {phase === PURCHASE_PHASES.COTACAO && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div
                className={`flex items-center gap-2 p-2 rounded-md ${
                  quotationStatusError
                    ? "text-red-600 bg-red-50"
                    : quotationStatus?.isReady
                      ? "text-green-700 bg-green-50"
                      : "text-orange-600 bg-orange-50"
                }`}
              >
                {quotationStatusError ? (
                  <X className="h-4 w-4" />
                ) : quotationStatus?.isReady ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Clock className="h-4 w-4" />
                )}
                <span className="text-sm font-medium">
                  {quotationStatusError
                    ? "Nenhuma cotação criada"
                    : quotationStatus?.reason || "Carregando status..."}
                </span>
              </div>
            </div>
          )}

          {/* Phase-specific actions */}
          {phase === PURCHASE_PHASES.PEDIDO_COMPRA && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <Button
                onClick={() => handleAdvanceToReceipt(request.id)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                size="sm"
              >
                <Check className="h-4 w-4 mr-2" />
                Avançar para Recebimento
              </Button>
            </div>
          )}

          {phase === PURCHASE_PHASES.APROVACAO_A1 && canApproveA1 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              {canApproveThisRequest?.canApprove ? (
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      approveA1Mutation.mutate({ approved: true });
                    }}
                    disabled={approveA1Mutation.isPending}
                  >
                    <Check className="mr-1 h-3 w-3" />
                    Aprovar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      approveA1Mutation.mutate({
                        approved: false,
                        rejectionReason: "Reprovado via ação rápida",
                      });
                    }}
                    disabled={approveA1Mutation.isPending}
                  >
                    <X className="mr-1 h-3 w-3" />
                    Rejeitar
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-2 rounded-md">
                  <TriangleAlert className="h-4 w-4" />
                  <span className="text-sm">
                    Você não tem permissão para aprovar este centro de custo
                  </span>
                </div>
              )}
            </div>
          )}

          {phase === PURCHASE_PHASES.APROVACAO_A2 && canApproveA2 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    setInitialA2Action('approve');
                    setIsEditModalOpen(true);
                  }}
                  disabled={approveA2Mutation.isPending}
                >
                  <Check className="mr-1 h-3 w-3" />
                  Aprovar
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    setInitialA2Action('reject');
                    setIsEditModalOpen(true);
                  }}
                  disabled={approveA2Mutation.isPending}
                >
                  <X className="mr-1 h-3 w-3" />
                  Rejeitar
                </Button>
              </div>
            </div>
          )}

          {phase === PURCHASE_PHASES.RECEBIMENTO && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              {canPerformReceiptActions ? (
                <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white text-xs sm:text-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      confirmReceiptMutation.mutate();
                    }}
                    disabled={confirmReceiptMutation.isPending}
                  >
                    <Check className="mr-1 h-3 w-3 flex-shrink-0" />
                    <span className="truncate">Confirmar</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1 text-xs sm:text-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      reportIssueMutation.mutate();
                    }}
                    disabled={reportIssueMutation.isPending}
                  >
                    <X className="mr-1 h-3 w-3 flex-shrink-0" />
                    <span className="truncate">Pendência</span>
                  </Button>
                </div>
              ) : (
                <div className="text-xs text-gray-500 text-center py-2">
                  Apenas usuários com perfil "Recebedor" podem confirmar recebimentos
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      {/* Phase-specific Edit Modals */}
      {isEditModalOpen && phase === PURCHASE_PHASES.SOLICITACAO && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <RequestPhase
              request={request}
              onClose={() => setIsEditModalOpen(false)}
              className="p-6"
            />
          </div>
        </div>
      )}
      {isEditModalOpen && phase === PURCHASE_PHASES.APROVACAO_A1 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <ApprovalA1Phase
              request={request}
              onClose={() => setIsEditModalOpen(false)}
              className="p-6"
            />
          </div>
        </div>
      )}
      {isEditModalOpen && phase === PURCHASE_PHASES.APROVACAO_A2 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <ApprovalA2Phase
              request={request}
              onClose={() => {
                setIsEditModalOpen(false);
                setInitialA2Action(null);
              }}
              className="p-6"
              initialAction={initialA2Action}
            />
          </div>
        </div>
      )}
      {isEditModalOpen && phase === PURCHASE_PHASES.COTACAO && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <QuotationPhase
              request={request}
              onClose={() => setIsEditModalOpen(false)}
              className="p-6"
            />
          </div>
        </div>
      )}
      {isEditModalOpen && phase === PURCHASE_PHASES.PEDIDO_COMPRA && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <PurchaseOrderPhase
              request={request}
              onClose={() => setIsEditModalOpen(false)}
              className="p-6"
            />
          </div>
        </div>
      )}

      {isEditModalOpen && phase === PURCHASE_PHASES.RECEBIMENTO && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <ReceiptPhase
              request={request}
              onClose={() => setIsEditModalOpen(false)}
              className="p-6"
            />
          </div>
        </div>
      )}

      {isEditModalOpen && phase === PURCHASE_PHASES.CONCLUSAO_COMPRA && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-7xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <ConclusionPhase
              request={request}
              onClose={() => setIsEditModalOpen(false)}
              className="p-6"
            />
          </div>
        </div>
      )}

      {/* Default Edit Dialog for other phases */}
      {isEditModalOpen &&
        phase !== PURCHASE_PHASES.SOLICITACAO &&
        phase !== PURCHASE_PHASES.APROVACAO_A1 &&
        phase !== PURCHASE_PHASES.APROVACAO_A2 &&
        phase !== PURCHASE_PHASES.COTACAO &&
        phase !== PURCHASE_PHASES.PEDIDO_COMPRA &&
        phase !== PURCHASE_PHASES.RECEBIMENTO &&
        phase !== PURCHASE_PHASES.CONCLUSAO_COMPRA && (
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
        )}
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