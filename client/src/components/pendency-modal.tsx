import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";

interface PendencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isLoading?: boolean;
}

export default function PendencyModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  isLoading = false 
}: PendencyModalProps) {
  const [reason, setReason] = useState("");

  const handleSubmit = () => {
    if (reason.trim().length < 10) {
      return;
    }
    onConfirm(reason);
    setReason("");
  };

  const handleClose = () => {
    setReason("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto p-0 sm:rounded-lg">
        <div className="flex-shrink-0 bg-white dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 px-6 py-3">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Reportar Pendência
            </DialogTitle>
            <DialogClose asChild>
              <button className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400" aria-label="Fechar">
                <span className="sr-only">Fechar</span>
              </button>
            </DialogClose>
          </div>
        </div>
        
        <div className="space-y-4 px-6 pt-6 pb-24">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-800">
              <strong>Atenção:</strong> Ao reportar uma pendência, esta solicitação retornará 
              para a fase de Pedido de Compra para que as questões sejam resolvidas.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pendency-reason">
              Justificativa da Pendência <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="pendency-reason"
              placeholder="Descreva detalhadamente os motivos da pendência (mínimo 10 caracteres)..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-gray-500">
              {reason.length}/10 caracteres mínimos
            </p>
          </div>
        </div>

        <div className="flex-shrink-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800 sticky bottom-0 z-30 px-6 py-3">
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive"
              onClick={handleSubmit}
              disabled={reason.trim().length < 10 || isLoading}
            >
              {isLoading ? "Processando..." : "Reportar Pendência"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
