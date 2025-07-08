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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Reportar Pendência
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
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

        <DialogFooter>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}