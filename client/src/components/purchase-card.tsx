import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { URGENCY_LABELS, CATEGORY_LABELS, PurchasePhase, PURCHASE_PHASES, PHASE_LABELS } from "@/lib/types";
import { Paperclip, Clock, TriangleAlert, AlertCircle, Check, X, Archive, Edit, GripVertical, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import RequestPhase from "./request-phase";
import ApprovalA1Phase from "./approval-a1-phase";
import ApprovalA2Phase from "./approval-a2-phase";
import QuotationPhase from "./quotation-phase";
import { useAuth } from "@/hooks/useAuth";
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

interface PurchaseCardProps {
  request: any;
  phase: PurchasePhase;
  isDragging?: boolean;
}

export default function PurchaseCard({ request, phase, isDragging = false }: PurchaseCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);

  const handleCardClick = () => {
    setIsEditModalOpen(true);
  };

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: sortableIsDragging,
  } = useSortable({
    id: `request-${request.id}`
  });

  const approveA1Mutation = useMutation({
    mutationFn: async (data: { approved: boolean; rejectionReason?: string }) => {
      const response = await apiRequest("POST", `/api/purchase-requests/${request.id}/approve-a1`, {
        ...data,
        approverId: user?.id || 1,
      });
      return response;
    },
    onSuccess: (response: any) => {
      queryClient.setQueryData(["/api/purchase-requests"], (oldData: any[]) => {
        if (!Array.isArray(oldData)) return oldData;
        return oldData.map(item =>
          item.id === request.id ? response : item
        );
      });

      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });

      toast({
        title: "Sucesso",
        description: response.approvedA1
          ? "Solicitação aprovada com sucesso!"
          : "Solicitação reprovada e movida para Arquivado",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao processar aprovação",
        variant: "destructive",
      });
    },
  });

  const approveA2Mutation = useMutation({
    mutationFn: async (data: { approved: boolean; rejectionReason?: string }) => {
      const response = await apiRequest("POST", `/api/purchase-requests/${request.id}/approve-a2`, {
        ...data,
        approverId: user?.id || 1,
      });
      return response;
    },
    onSuccess: (response: any) => {
      queryClient.setQueryData(["/api/purchase-requests"], (oldData: any[]) => {
        if (!Array.isArray(oldData)) return oldData;
        return oldData.map(item =>
          item.id === request.id ? response : item
        );
      });

      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });

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
      await apiRequest("DELETE", `/api/purchase-requests/${request.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
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
      const response = await apiRequest("POST", `/api/purchase-requests/${request.id}/archive`);
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

  const archiveDirectMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/purchase-requests/${request.id}/archive-direct`);
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

  const getUrgencyIcon = (urgency: string) => {
    switch (urgency) {
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
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(Number(value));
  };

  const formatDate = (date: any) => {
    if (!date) return null;
    return formatDistanceToNow(new Date(date), { 
      addSuffix: true, 
      locale: ptBR 
    });
  };

  const isArchived = phase === PURCHASE_PHASES.ARQUIVADO;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging || sortableIsDragging ? 0.5 : 1,
  };

  // Check user permissions for showing certain actions
  const canApproveA1 = user?.isApproverA1 || false;
  const canApproveA2 = user?.isApproverA2 || false;
  const canEditInApprovalPhase = (phase === PURCHASE_PHASES.APROVACAO_A1 && canApproveA1) || 
                                (phase === PURCHASE_PHASES.APROVACAO_A2 && canApproveA2) ||
                                (phase !== PURCHASE_PHASES.APROVACAO_A1 && phase !== PURCHASE_PHASES.APROVACAO_A2);

  return (
    <>
      <Card
        ref={setNodeRef}
        style={style}
        {...attributes}
        className={cn(
          "mb-2 cursor-pointer select-none",
          isDragging && "opacity-50",
          sortableIsDragging && "opacity-50"
        )}
      >
        <CardContent className="p-4">
          {/* Header with drag handle and request number */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div
                {...listeners}
                className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded"
                title="Arrastar para mover"
              >
                <GripVertical className="h-4 w-4 text-gray-400" />
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
          <h4 className={cn(
            "font-medium mb-2 truncate",
            isArchived ? "text-gray-700" : "text-gray-900"
          )} title={request.justification}>
            {request.justification}
          </h4>

          {/* Urgency and category info */}
          <div className="flex items-center gap-2 mb-3">
            {request.urgency && (
              <Badge variant={request.urgency === "alto" ? "destructive" : "secondary"} className="text-xs">
                {getUrgencyIcon(request.urgency)}
                {URGENCY_LABELS[request.urgency as keyof typeof URGENCY_LABELS]}
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {CATEGORY_LABELS[request.category as keyof typeof CATEGORY_LABELS]}
            </Badge>
          </div>

          {/* Additional info */}
          <div className={cn(
            "text-sm space-y-1",
            isArchived ? "text-gray-500" : "text-gray-600"
          )}>
            {request.totalValue && (
              <p><strong>Valor:</strong> {formatCurrency(request.totalValue)}</p>
            )}
            {phase === PURCHASE_PHASES.APROVACAO_A1 && (
              <p><strong>Aprovador:</strong> Pendente</p>
            )}
            {phase === PURCHASE_PHASES.COTACAO && request.buyerId && (
              <p><strong>Comprador:</strong> Atribuído</p>
            )}
            {phase === PURCHASE_PHASES.RECEBIMENTO && request.receivedById && (
              <p><strong>Recebido por:</strong> Usuário</p>
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
                {Math.floor(Math.random() * 3) + 1} anexos
              </span>
            </div>
          </div>

          {/* Phase-specific actions */}
          {phase === PURCHASE_PHASES.APROVACAO_A1 && canApproveA1 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
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
                      rejectionReason: "Reprovado via ação rápida"
                    });
                  }}
                  disabled={approveA1Mutation.isPending}
                >
                  <X className="mr-1 h-3 w-3" />
                  Rejeitar
                </Button>
              </div>
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
                    approveA2Mutation.mutate({ approved: true });
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
                    approveA2Mutation.mutate({
                      approved: false,
                      rejectionReason: "Reprovado via ação rápida"
                    });
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
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  archiveMutation.mutate();
                }}
                disabled={archiveMutation.isPending}
              >
                <Archive className="mr-1 h-3 w-3" />
                Arquivar
              </Button>
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
              onClose={() => setIsEditModalOpen(false)}
              className="p-6"
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

      {/* Default Edit Dialog for other phases */}
      {isEditModalOpen && phase !== PURCHASE_PHASES.SOLICITACAO && phase !== PURCHASE_PHASES.APROVACAO_A1 && phase !== PURCHASE_PHASES.COTACAO && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setIsEditModalOpen(false)}>
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Editar Solicitação</h3>
            <p className="text-sm text-gray-600 mb-4">
              <strong>Número:</strong> {request.requestNumber}
            </p>
            <p className="text-sm text-gray-600 mb-4">
              <strong>Fase Atual:</strong> {PHASE_LABELS[phase]}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
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
              Tem certeza que deseja excluir esta requisição? Esta ação não pode ser desfeita.
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
            <AlertDialogAction
              onClick={() => archiveDirectMutation.mutate()}
            >
              Arquivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
