import { Card, CardContent } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Receipt, Package, Truck, Calendar, DollarSign, FileText } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RECEIPT_PHASE_LABELS, RECEIPT_PHASE_COLORS } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ReceiptKanbanCardProps {
  receipt: any;
  onClick?: () => void;
}

export function ReceiptKanbanCard({ receipt, onClick }: ReceiptKanbanCardProps) {
  const phaseColor = RECEIPT_PHASE_COLORS[receipt.receiptPhase as keyof typeof RECEIPT_PHASE_COLORS] || 'gray';
  
  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow border-l-4" 
      style={{ borderLeftColor: phaseColor }}
      onClick={onClick}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex justify-between items-start gap-2">
          <Badge variant="outline" className="text-[10px] font-mono">
            {receipt.receiptNumber}
          </Badge>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase font-bold">
            <FileText className="w-3 h-3" />
            {receipt.requestNumber || 'S/ SOL'}
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
