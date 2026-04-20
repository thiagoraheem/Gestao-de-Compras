import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { Button } from "@/shared/ui/button";
import type { DeliveryLocation } from "@shared/schema";
import type { DeliveryLocationFormData } from "../schemas/delivery-location.schema";

interface DeliveryLocationFormModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  submitLabel: string;
  isPending: boolean;
  formData: Omit<DeliveryLocationFormData, "active">;
  setFormData: React.Dispatch<React.SetStateAction<Omit<DeliveryLocationFormData, "active">>>;
  editingLocation?: DeliveryLocation | null;
  onEditingLocationChange?: (location: DeliveryLocation) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export function DeliveryLocationFormModal({
  isOpen,
  onOpenChange,
  title,
  submitLabel,
  isPending,
  formData,
  setFormData,
  editingLocation,
  onEditingLocationChange,
  onSubmit,
  onCancel,
}: DeliveryLocationFormModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor={`${title}-name`}>Nome *</Label>
            <Input
              id={`${title}-name`}
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>
          <div>
            <Label htmlFor={`${title}-address`}>Endereço *</Label>
            <Input
              id={`${title}-address`}
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              required
            />
          </div>
          <div>
            <Label htmlFor={`${title}-contactPerson`}>Pessoa de Contato</Label>
            <Input
              id={`${title}-contactPerson`}
              value={formData.contactPerson || ""}
              onChange={(e) => setFormData(prev => ({ ...prev, contactPerson: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor={`${title}-phone`}>Telefone</Label>
            <Input
              id={`${title}-phone`}
              value={formData.phone || ""}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor={`${title}-email`}>Email</Label>
            <Input
              id={`${title}-email`}
              type="email"
              value={formData.email || ""}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor={`${title}-observations`}>Observações</Label>
            <Textarea
              id={`${title}-observations`}
              value={formData.observations || ""}
              onChange={(e) => setFormData(prev => ({ ...prev, observations: e.target.value }))}
            />
          </div>

          {/* Active toggle — only shown in edit mode */}
          {editingLocation !== undefined && onEditingLocationChange && (
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id={`${title}-active`}
                checked={editingLocation?.active || false}
                onChange={(e) => {
                  if (editingLocation) {
                    onEditingLocationChange({ ...editingLocation, active: e.target.checked });
                  }
                }}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor={`${title}-active`} className="text-sm">Local ativo</Label>
            </div>
          )}

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : submitLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
