import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export type ReceiptKanbanRow = {
  id: number;
  receiptNumber: string;
  status: string;
  receiptPhase: string;
  receiptType: string;
  documentNumber?: string | null;
  documentSeries?: string | null;
  approvedAt?: string | Date | null;
  approvedByName?: string | null;
  totalAmount?: string | number | null;
  createdAt?: string | Date;
  purchaseRequestId?: number | null;
  supplier?: { id: number; name: string; cnpj?: string | null } | null;
  request?: { id: number; requestNumber: string; currentPhase: string; procurementStatus?: string } | null;
};

function formatDateTime(date: any) {
  if (!date) return null;
  try {
    return format(new Date(date), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return null;
  }
}

export default function ReceiptKanbanCard({
  receipt,
  onOpen,
}: {
  receipt: ReceiptKanbanRow;
  onOpen?: (receipt: ReceiptKanbanRow) => void;
}) {
  const nf = receipt.documentNumber || receipt.receiptNumber;
  const approvedAt = formatDateTime(receipt.approvedAt);

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3 shadow-sm cursor-pointer select-none hover:bg-accent/30 transition-colors",
      )}
      onClick={() => onOpen?.(receipt)}
      data-receipt-id={receipt.id}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-sm truncate">
            {receipt.request?.requestNumber ? `${receipt.request.requestNumber} — ${receipt.receiptNumber}` : receipt.receiptNumber}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {receipt.supplier?.name || "Fornecedor não informado"}
          </div>
        </div>
        <Badge variant="secondary" className="text-[10px]">
          {receipt.status}
        </Badge>
      </div>

      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
        <div className="truncate">NF/Recibo: {nf}{receipt.documentSeries ? ` / ${receipt.documentSeries}` : ""}</div>
        {approvedAt && <div className="truncate">Fiscal finalizada: {approvedAt}</div>}
        {receipt.approvedByName && <div className="truncate">Responsável: {receipt.approvedByName}</div>}
      </div>
    </div>
  );
}
