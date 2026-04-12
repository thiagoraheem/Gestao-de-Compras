import React, { useMemo, useState } from "react";
import { DndContext, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { RECEIPT_PHASES, RECEIPT_PHASE_LABELS, ReceiptPhase } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import FiscalConferencePhase from "@/components/fiscal-conference-phase";
import { ReceiptProvider } from "@/components/receipt/ReceiptContext";
import ReceiptPhysicalPanel from "@/components/receipt/ReceiptPhysicalPanel";
import { Badge } from "@/components/ui/badge";

export type ReceiptBoardRow = {
  id: number;
  receiptNumber: string;
  status: string;
  receiptPhase: ReceiptPhase;
  receiptType: "produto" | "servico" | "avulso";
  documentNumber?: string | null;
  documentSeries?: string | null;
  totalAmount?: string | number | null;
  createdAt?: string | Date;
  purchaseOrderId?: number | null;
  purchaseRequestId?: number | null;
  supplier?: { id: number; name: string; cnpj?: string | null } | null;
  request?: { id: number; requestNumber: string; currentPhase: string; procurementStatus?: string } | null;
};

function ReceiptColumn({ phase, receipts, onOpen }: { phase: ReceiptPhase; receipts: ReceiptBoardRow[]; onOpen: (r: ReceiptBoardRow) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: phase });
  const ids = receipts.map(r => `receipt-${r.id}`);

  return (
    <div className="flex-shrink-0 w-80">
      <Card className={cn("h-full flex flex-col", isOver && "ring-2 ring-primary")}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{RECEIPT_PHASE_LABELS[phase]}</CardTitle>
            <Badge variant="secondary">{receipts.length}</Badge>
          </div>
        </CardHeader>
        <CardContent ref={setNodeRef as any} className="flex-1 overflow-y-auto space-y-3">
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            {receipts.map(r => (
              <ReceiptCard key={r.id} receipt={r} onOpen={onOpen} />
            ))}
          </SortableContext>
        </CardContent>
      </Card>
    </div>
  );
}

function ReceiptCard({ receipt, onOpen }: { receipt: ReceiptBoardRow; onOpen: (r: ReceiptBoardRow) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `receipt-${receipt.id}` });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(receipt)}
      className={cn(
        "rounded-lg border bg-card p-3 shadow-sm cursor-pointer select-none",
        isDragging && "opacity-50",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold text-sm truncate">{receipt.receiptNumber}</div>
        <Badge variant={receipt.receiptPhase === RECEIPT_PHASES.CONF_FISCAL ? "default" : receipt.receiptPhase === RECEIPT_PHASES.CONCLUIDO ? "outline" : "secondary"}>
          {receipt.status}
        </Badge>
      </div>
      <div className="mt-2 text-xs text-muted-foreground space-y-1">
        <div className="truncate">Solicitação: {receipt.request?.requestNumber || "-"}</div>
        <div className="truncate">Fornecedor: {receipt.supplier?.name || "-"}</div>
        <div className="truncate">NF: {receipt.documentNumber || "-"}{receipt.documentSeries ? ` / ${receipt.documentSeries}` : ""}</div>
      </div>
    </div>
  );
}

function ReceiptDialog({ open, onOpenChange, receipt }: { open: boolean; onOpenChange: (v: boolean) => void; receipt: ReceiptBoardRow | null }) {
  const requestId = receipt?.request?.id || receipt?.purchaseRequestId || null;
  const receiptId = receipt?.id || null;

  const { data: request, isLoading } = useQuery<any>({
    queryKey: requestId ? [`/api/purchase-requests/${requestId}`] : ["_no_request_"],
    enabled: !!requestId && !!receiptId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Recebimento</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : !requestId || !receiptId || !request ? (
            <div className="text-sm text-muted-foreground">Dados insuficientes para abrir o recebimento.</div>
          ) : receipt?.receiptPhase === RECEIPT_PHASES.RECEBIMENTO_FISICO ? (
            <ReceiptProvider request={request} onClose={() => onOpenChange(false)} mode="physical" receiptId={receiptId}>
              <ReceiptPhysicalPanel />
            </ReceiptProvider>
          ) : (
            <FiscalConferencePhase request={request} onClose={() => onOpenChange(false)} mode="fiscal" initialReceiptId={receiptId} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ReceiptsBoard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<ReceiptBoardRow | null>(null);
  const [open, setOpen] = useState(false);

  const { data, isLoading, isError, error } = useQuery<ReceiptBoardRow[]>({
    queryKey: ["receipts-board"],
    queryFn: async () => {
      return apiRequest("/api/receipts/board");
    },
  });

  const rows = Array.isArray(data) ? data : [];

  const grouped = useMemo(() => {
    const acc: Record<string, ReceiptBoardRow[]> = {
      [RECEIPT_PHASES.RECEBIMENTO_FISICO]: [],
      [RECEIPT_PHASES.CONF_FISCAL]: [],
      [RECEIPT_PHASES.CONCLUIDO]: [],
      [RECEIPT_PHASES.CANCELADO]: [],
    };
    for (const r of rows) {
      const p = (r.receiptPhase as ReceiptPhase) || RECEIPT_PHASES.RECEBIMENTO_FISICO;
      if (!acc[p]) acc[p] = [];
      acc[p].push(r);
    }
    return acc;
  }, [rows]);

  const updatePhaseMutation = useMutation({
    mutationFn: async ({ id, newPhase }: { id: number; newPhase: ReceiptPhase }) => {
      return apiRequest(`/api/receipts/${id}/update-phase`, { method: "PATCH", body: { newPhase } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receipts-board"] });
      toast({ title: "Sucesso", description: "Fase do recebimento atualizada." });
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e?.message || "Falha ao atualizar fase", variant: "destructive" });
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (!activeId.startsWith("receipt-")) return;
    const id = Number(activeId.replace("receipt-", ""));
    if (!Number.isFinite(id)) return;

    const targetPhase = Object.values(RECEIPT_PHASES).includes(overId as any) ? (overId as ReceiptPhase) : null;
    if (!targetPhase) return;

    const current = rows.find(r => r.id === id);
    if (!current) return;
    if (current.receiptPhase === targetPhase) return;

    updatePhaseMutation.mutate({ id, newPhase: targetPhase });
  };

  const openReceipt = (r: ReceiptBoardRow) => {
    setSelected(r);
    setOpen(true);
  };

  if (isLoading) {
    return (
      <div className="h-full overflow-x-auto px-6 py-4">
        <div className="flex space-x-6" style={{ minWidth: "max-content", height: "100%" }}>
          {Object.values(RECEIPT_PHASES).slice(0, 3).map((phase) => (
            <div key={phase} className="flex-shrink-0 w-80">
              <Card className="h-full flex flex-col">
                <CardHeader className="pb-3"><Skeleton className="h-5 w-40" /></CardHeader>
                <CardContent className="flex-1 space-y-3">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    const message = (error as any)?.message || "Falha ao carregar recebimentos.";
    const disabledByFlag = message.includes("feature flag") || message.includes("Funcionalidade indisponível");
    return (
      <div className="p-6">
        <Card>
          <CardHeader><CardTitle>Recebimentos</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">{message}</div>
            {disabledByFlag && (
              <div className="text-sm text-muted-foreground">
                Habilite o modo desacoplado no backend e recarregue a página.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const columns: ReceiptPhase[] = [RECEIPT_PHASES.RECEBIMENTO_FISICO, RECEIPT_PHASES.CONF_FISCAL, RECEIPT_PHASES.CONCLUIDO];

  return (
    <div className="h-full overflow-x-auto px-6 py-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold">Recebimentos</h1>
          <p className="text-sm text-muted-foreground">Gerencie os cards de recebimento por fase.</p>
        </div>
        <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["receipts-board"] })}>Atualizar</Button>
      </div>

      <DndContext onDragEnd={handleDragEnd}>
        <div className="flex space-x-6" style={{ minWidth: "max-content", height: "calc(100% - 64px)" }}>
          {columns.map((phase) => (
            <ReceiptColumn key={phase} phase={phase} receipts={grouped[phase] || []} onOpen={openReceipt} />
          ))}
        </div>
      </DndContext>

      <ReceiptDialog open={open} onOpenChange={setOpen} receipt={selected} />
    </div>
  );
}
