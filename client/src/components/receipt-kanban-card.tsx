import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/currency";
import { CATEGORY_LABELS, URGENCY_LABELS } from "@/lib/types";
import { AlertCircle, Clock, GripVertical, Trash2 } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";

export type ReceiptKanbanRow = {
  id: number;
  receiptNumber: string;
  status: string;
  receiptPhase: string;
  receiptType: string;
  documentNumber?: string | null;
  documentSeries?: string | null;
  documentIssueDate?: string | Date | null;
  documentEntryDate?: string | Date | null;
  receivedAt?: string | Date | null;
  approvedAt?: string | Date | null;
  approvedByName?: string | null;
  totalAmount?: string | number | null;
  createdAt?: string | Date;
  purchaseRequestId?: number | null;
  purchaseOrderNumber?: string | null;
  receivingPercent?: number | null;
  requestFound?: boolean | null;
  supplier?: { id: number; name: string; cnpj?: string | null } | null;
  request?: {
    id: number;
    requestNumber: string;
    currentPhase: string;
    procurementStatus?: string;
    justification?: string | null;
    urgency?: string | null;
    category?: string | null;
    totalValue?: string | number | null;
    createdAt?: string | Date | null;
    requesterName?: string | null;
  } | null;
};

function getUrgencyIcon(urgency: string) {
  if (urgency === "alta_urgencia" || urgency === "alto") return <AlertCircle className="mr-1 h-3 w-3" />;
  return <Clock className="mr-1 h-3 w-3" />;
}

function formatRelative(date: any) {
  if (!date) return null;
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR });
  } catch {
    return null;
  }
}

function formatDateOnly(date: any) {
  if (!date) return null;
  try {
    return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return null;
  }
}

export default function ReceiptKanbanCard({
  receipt,
  onOpen,
  canDeleteGhost,
  onDeleteGhost,
}: {
  receipt: ReceiptKanbanRow;
  onOpen?: (receipt: ReceiptKanbanRow) => void;
  canDeleteGhost?: boolean;
  onDeleteGhost?: (receipt: ReceiptKanbanRow) => void;
}) {
  const sortableId = `receipt-${receipt.id}`;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sortableId });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const requestNumber = receipt.request?.requestNumber || "";
  const poNumber = receipt.purchaseOrderNumber || "";
  const titleNumber = [requestNumber, poNumber].filter(Boolean).join(" - ");
  const justification = receipt.request?.justification || "";
  const supplierName = receipt.supplier?.name || "Fornecedor não informado";
  const createdLabel = formatRelative(receipt.request?.createdAt || receipt.createdAt);
  const receivingPercent = typeof receipt.receivingPercent === "number" ? receipt.receivingPercent : 0;
  const entryDate = formatDateOnly(receipt.documentEntryDate || receipt.receivedAt || receipt.createdAt);
  const nfNumber = receipt.documentNumber || null;
  const requestFound = receipt.requestFound === true || Boolean(receipt.request?.requestNumber);
  const isGhost = !requestFound;

  return (
    <Card
      ref={setNodeRef}
      style={style as any}
      {...attributes}
      data-receipt-id={receipt.id}
      onClick={() => onOpen?.(receipt)}
      className={cn(
        "mb-2 cursor-pointer select-none rounded-lg shadow-sm border-border",
        isDragging && "opacity-50",
      )}
    >
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center justify-between mb-2 md:mb-2 lg:mb-1">
          <div className="flex items-center gap-1 md:gap-1 lg:gap-1">
            <div
              {...listeners}
              className={cn("p-0.5 rounded cursor-grab active:cursor-grabbing hover:bg-muted")}
              title="Arrastar para mover"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="h-3 w-3 md:h-4 md:w-4 lg:h-3 lg:w-3 text-muted-foreground" />
            </div>
            <div className="">
              <Badge className="font-mono text-sm bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 font-semibold px-2 py-1 rounded hover:bg-orange-200 dark:hover:bg-orange-900/70 border-none">
                {isGhost ? "Solicitação não encontrada" : (titleNumber || requestNumber || receipt.receiptNumber)}
              </Badge>
              <Badge variant="outline" className="font-mono text-xs px-2 py-1">
                {receipt.receiptNumber}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isGhost && canDeleteGhost && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteGhost?.(receipt);
                }}
                title="Excluir recebimento fantasma"
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            )}
            <Badge variant={isGhost ? "destructive" : "secondary"} className="text-xs">
              {isGhost ? "atenção" : receipt.status}
            </Badge>
          </div>
        </div>

        <h4 className="font-semibold text-slate-800 dark:text-slate-100" title={justification}>
          {justification || "—"}
        </h4>

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {receipt.request?.urgency && (
            <Badge
              className={cn(
                "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border-none",
                (receipt.request.urgency === "alta_urgencia" || receipt.request.urgency === "alto")
                  ? "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/50"
                  : "text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/50",
              )}
            >
              {getUrgencyIcon(receipt.request.urgency)}
              {URGENCY_LABELS[receipt.request.urgency as keyof typeof URGENCY_LABELS] || receipt.request.urgency}
            </Badge>
          )}
          {receipt.request?.category && (
            <Badge variant="outline" className="text-xs px-1.5 py-0.5">
              {CATEGORY_LABELS[receipt.request.category as keyof typeof CATEGORY_LABELS] || receipt.request.category}
            </Badge>
          )}
        </div>

        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1 border-t border-border pt-2 mt-2">
          {receipt.request?.totalValue && (
            <p>
              <span className="font-medium text-slate-700 dark:text-slate-300">Valor:</span>{" "}
              {formatCurrency(receipt.request.totalValue)}
            </p>
          )}
          {receipt.request?.requesterName && (
            <p>
              <span className="font-medium text-slate-700 dark:text-slate-300">Solicitante:</span> {receipt.request.requesterName}
            </p>
          )}
          <p className="text-xs md:text-xs lg:text-xs">
            <span className="font-medium text-slate-700 dark:text-slate-300">Fornecedor:</span> {supplierName}
          </p>
          <p className="text-xs md:text-xs lg:text-xs">
            <span className="font-medium text-slate-700 dark:text-slate-300">Recebimento:</span> {receipt.receiptNumber}
          </p>

          {receipt.receiptPhase === "conf_fiscal" && (
            <>
              <p className="text-xs md:text-xs lg:text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300">Documento:</span>{" "}
                {nfNumber || "-"}
                {receipt.documentSeries ? ` / ${receipt.documentSeries}` : ""}
              </p>
              {entryDate && (
                <p className="text-xs md:text-xs lg:text-xs">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Entrada:</span> {entryDate}
                </p>
              )}
              {receipt.totalAmount && (
                <p className="text-xs md:text-xs lg:text-xs">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Valor documento:</span>{" "}
                  {formatCurrency(receipt.totalAmount)}
                </p>
              )}
            </>
          )}

          <div className="pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-700 dark:text-slate-300">Recebido:</span>
              <span className="text-muted-foreground">{Math.min(100, Math.max(0, receivingPercent))}%</span>
            </div>
            <Progress value={Math.min(100, Math.max(0, receivingPercent))} className="h-2 mt-1" />
          </div>
        </div>

        {createdLabel && <div className="text-xs text-muted-foreground">{createdLabel}</div>}
      </CardContent>
    </Card>
  );
}
