import React, { useMemo } from "react";
import { ReceiptItems } from "./ReceiptItems";
import { useReceipt } from "./ReceiptContext";
import { useReceiptActions } from "./useReceiptActions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ReceiptPhysicalPanel({ className }: { className?: string }) {
  const { itemsWithPrices, receivedQuantities, canPerformReceiptActions, onClose } = useReceipt();
  const { confirmPhysicalMutation } = useReceiptActions();

  const hasAnyQty = useMemo(() => Object.values(receivedQuantities).some(v => Number(v) > 0), [receivedQuantities]);
  const hasExcess = useMemo(() => {
    return Array.isArray(itemsWithPrices) && itemsWithPrices.some((it: any) => {
      const prev = Number(it.quantityReceived || 0);
      const current = Number(receivedQuantities[it.id] || 0);
      const max = Number(it.quantity || 0);
      return (prev + current) > max;
    });
  }, [itemsWithPrices, receivedQuantities]);

  const canConfirm = !!canPerformReceiptActions && hasAnyQty && !hasExcess;

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="flex-1 overflow-y-auto pr-1">
        <ReceiptItems />
      </div>
      <div className="border-t bg-background/95 backdrop-blur px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          {hasExcess ? "Corrija as quantidades excedentes para prosseguir." : ""}
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={() => confirmPhysicalMutation.mutate()} disabled={!canConfirm || confirmPhysicalMutation.isPending} className="bg-green-600 hover:bg-green-700">
            Confirmar Recebimento
          </Button>
        </div>
      </div>
    </div>
  );
}

