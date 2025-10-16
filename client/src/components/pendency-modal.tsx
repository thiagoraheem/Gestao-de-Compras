import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="pb-1">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Reportar Pendência
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-2">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
            <p className="text-xs text-amber-800">
              <strong>Atenção:</strong> Ao reportar uma pendência, esta solicitação retornará 
              para a fase de Pedido de Compra para que as questões sejam resolvidas.
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="pendency-reason" className="text-xs">
              Justificativa da Pendência <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="pendency-reason"
              placeholder="Descreva detalhadamente os motivos da pendência (mínimo 10 caracteres)..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="resize-none text-xs min-h-[60px]"
            />
            <p className="text-xs text-gray-500">
              {reason.length}/10 caracteres mínimos
            </p>
          </div>
        </div>

        <DialogFooter className="pt-1 gap-2">
          <Button 
            variant="outline" 
            onClick={handleClose}
            disabled={isLoading}
            className="h-8 text-xs"
          >
            Cancelar
          </Button>
          <Button 
            variant="destructive"
            onClick={handleSubmit}
            disabled={reason.trim().length < 10 || isLoading}
            className="h-8 text-xs"
          >
            {isLoading ? "Processando..." : "Reportar Pendência"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}