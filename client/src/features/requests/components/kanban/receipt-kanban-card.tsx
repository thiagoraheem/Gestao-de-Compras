import { Card, CardContent } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Package, Calendar, DollarSign, FileText, Trash2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RECEIPT_PHASE_LABELS, RECEIPT_PHASE_COLORS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/shared/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/tooltip";

interface ReceiptKanbanCardProps {
  receipt: any;
  onClick?: () => void;
}

export function ReceiptKanbanCard({ receipt, onClick }: ReceiptKanbanCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const phaseColor = RECEIPT_PHASE_COLORS[receipt.receiptPhase as keyof typeof RECEIPT_PHASE_COLORS] || 'gray';
  
  const isOrphan = !receipt.purchaseRequestId && !receipt.purchaseOrderNumber;
  const canDelete = user?.isAdmin || user?.isBuyer;

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest(`/api/receipts/${receipt.id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts/board"] });
      toast({
        title: "Sucesso",
        description: "Recebimento excluído com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir recebimento",
        variant: "destructive",
      });
    },
  });

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Tem certeza que deseja excluir permanentemente este recebimento órfão?")) {
      deleteMutation.mutate();
    }
  };
  
  return (
    <Card 
      className={cn(
        "cursor-pointer hover:shadow-md transition-shadow border-l-4",
        isOrphan && "ring-1 ring-destructive/30 bg-destructive/5"
      )}
      style={{ borderLeftColor: isOrphan ? 'var(--destructive)' : phaseColor }}
      onClick={onClick}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex justify-between items-start gap-2">
          <div className="flex flex-col gap-1">
            <Badge variant={isOrphan ? "destructive" : "outline"} className="text-[10px] font-mono">
              {receipt.receiptNumber}
            </Badge>
            {isOrphan && (
              <Badge variant="destructive" className="text-[8px] h-3 px-1 animate-pulse">
                ÓRFÃO
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase font-bold">
              <FileText className="w-3 h-3" />
              {receipt.requestNumber || 'S/ SOL'}
            </div>
            
            {isOrphan && canDelete && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={handleDelete}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Excluir recebimento órfão</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold line-clamp-2 leading-tight">
            {receipt.supplierName || "Fornecedor não informado"}
          </h4>
          <p className="text-[11px] text-muted-foreground line-clamp-1 italic">
            {receipt.justification || "Sem justificativa"}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-1 text-[10px]">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Calendar className="w-3 h-3" />
            {receipt.createdAt ? format(new Date(receipt.createdAt), "dd/MM/yy", { locale: ptBR }) : '-'}
          </div>
          <div className="flex items-center gap-1 font-medium justify-end">
            <DollarSign className="w-3 h-3" />
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(receipt.totalAmount || 0))}
          </div>
        </div>

        {receipt.purchaseOrderNumber && (
          <div className="flex items-center gap-1 text-[10px] bg-secondary/50 px-1.5 py-0.5 rounded w-fit">
            <Package className="w-3 h-3 text-primary" />
            <span className="font-medium">{receipt.purchaseOrderNumber}</span>
          </div>
        )}

        <div className="pt-1 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-1">
             <div className="h-1.5 flex-1 bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all" 
                  style={{ width: `${Math.min(100, Number(receipt.receivingPercent || 0))}%` }} 
                />
             </div>
             <span className="text-[9px] text-muted-foreground whitespace-nowrap">
                {Math.round(Number(receipt.receivingPercent || 0))}%
             </span>
          </div>
          
          <Badge variant="secondary" className="text-[9px] h-4 px-1 leading-none uppercase">
            {RECEIPT_PHASE_LABELS[receipt.receiptPhase as keyof typeof RECEIPT_PHASE_LABELS] || receipt.receiptPhase}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
