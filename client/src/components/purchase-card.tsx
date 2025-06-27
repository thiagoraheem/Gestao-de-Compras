import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { URGENCY_LABELS, CATEGORY_LABELS, PurchasePhase, PURCHASE_PHASES, PHASE_LABELS } from "@/lib/types";
import { Paperclip, Clock, TriangleAlert, AlertCircle, Check, X, Archive, Edit, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";

interface PurchaseCardProps {
  request: any;
  phase: PurchasePhase;
  isDragging?: boolean;
}

export default function PurchaseCard({ request, phase, isDragging = false }: PurchaseCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: sortableIsDragging,
  } = useSortable({ id: request.id.toString() });

  const approveA1Mutation = useMutation({
    mutationFn: async (data: { approved: boolean; rejectionReason?: string }) => {
      await apiRequest("POST", `/api/purchase-requests/${request.id}/approve-a1`, {
        ...data,
        approverId: 1, // TODO: Get from auth context
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      toast({
        title: "Sucesso",
        description: "Aprovação processada com sucesso",
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

  const archiveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/purchase-requests/${request.id}/archive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      toast({
        title: "Sucesso",
        description: "Item arquivado com sucesso",
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

  return (
    <Card 
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={cn(
        "hover:shadow-md transition-shadow select-none",
        isArchived && "bg-gray-50",
        sortableIsDragging && "z-10 rotate-3 shadow-lg"
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded"
              title="Arrastar para mover"
            >
              <GripVertical className="h-4 w-4 text-gray-400" />
            </div>
            <span className={cn(
              "text-sm font-medium",
              isArchived ? "text-gray-700" : "text-gray-900"
            )}>
              {request.requestNumber}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-gray-100"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditModalOpen(true);
              }}
            >
              <Edit className="h-3 w-3" />
            </Button>
            <Badge className={cn("status-badge", getUrgencyClass(request.urgency))}>
              {getUrgencyIcon(request.urgency)}
              {URGENCY_LABELS[request.urgency as keyof typeof URGENCY_LABELS]}
            </Badge>
          </div>
        </div>
        
        <h4 className={cn(
          "font-medium mb-2",
          isArchived ? "text-gray-700" : "text-gray-900"
        )}>
          {request.justification}
        </h4>
        
        <div className={cn(
          "text-sm space-y-1",
          isArchived ? "text-gray-500" : "text-gray-600"
        )}>
          <p><strong>Categoria:</strong> {CATEGORY_LABELS[request.category as keyof typeof CATEGORY_LABELS]}</p>
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
        {phase === PURCHASE_PHASES.APROVACAO_A1 && (
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
                    rejectionReason: "Necessita mais informações" 
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
      
      {/* Simple Edit Dialog */}
      {isEditModalOpen && (
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
    </Card>
  );
}
