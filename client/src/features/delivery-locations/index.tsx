import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { Alert, AlertDescription } from "@/shared/ui/alert";
import { MapPin, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { DeliveryLocation } from "@shared/schema";
import type { DeliveryLocationFormData } from "./schemas/delivery-location.schema";
import { DeliveryLocationCard } from "./components/DeliveryLocationCard";
import { DeliveryLocationFormModal } from "./components/DeliveryLocationFormModal";

const EMPTY_FORM: Omit<DeliveryLocationFormData, "active"> = {
  name: "",
  address: "",
  contactPerson: "",
  phone: "",
  email: "",
  observations: "",
};

export function DeliveryLocationsManagement() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<DeliveryLocation | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [formData, setFormData] = useState<Omit<DeliveryLocationFormData, "active">>(EMPTY_FORM);

  const queryClient = useQueryClient();

  const { data: allDeliveryLocations = [], isLoading, error } = useQuery<DeliveryLocation[]>({
    queryKey: ["/api/delivery-locations"],
    staleTime: 0,
  });

  const deliveryLocations: DeliveryLocation[] = showInactive
    ? allDeliveryLocations
    : allDeliveryLocations.filter((l) => l.active);

  const createMutation = useMutation({
    mutationFn: (data: Omit<DeliveryLocationFormData, "active">) =>
      apiRequest("/api/delivery-locations", { method: "POST", body: data }),
    onSuccess: () => {
      toast({ title: "Sucesso", description: "Local de entrega criado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/delivery-locations"] });
      setIsCreateModalOpen(false);
      setFormData(EMPTY_FORM);
    },
    onError: (error: any) =>
      toast({ title: "Erro", description: error.message || "Erro ao criar local de entrega", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<DeliveryLocation> }) =>
      apiRequest(`/api/delivery-locations/${id}`, { method: "PUT", body: data }),
    onSuccess: () => {
      toast({ title: "Sucesso", description: "Local de entrega atualizado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/delivery-locations"] });
      setIsEditModalOpen(false);
      setEditingLocation(null);
      setFormData(EMPTY_FORM);
    },
    onError: (error: any) =>
      toast({ title: "Erro", description: error.message || "Erro ao atualizar local de entrega", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/delivery-locations/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Sucesso", description: "Local de entrega desativado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/delivery-locations"] });
    },
    onError: (error: any) =>
      toast({ title: "Erro", description: error.message || "Erro ao desativar local de entrega", variant: "destructive" }),
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.address.trim()) {
      toast({ title: "Erro", description: "Nome e endereço são obrigatórios", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.address.trim()) {
      toast({ title: "Erro", description: "Nome e endereço são obrigatórios", variant: "destructive" });
      return;
    }
    if (editingLocation) {
      updateMutation.mutate({ id: editingLocation.id, data: { ...formData, active: editingLocation.active } });
    }
  };

  const handleEdit = (location: DeliveryLocation) => {
    setEditingLocation(location);
    setFormData({
      name: location.name,
      address: location.address,
      contactPerson: location.contactPerson || "",
      phone: location.phone || "",
      email: location.email || "",
      observations: location.observations || "",
    });
    setIsEditModalOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza de que deseja desativar este local de entrega?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleActivate = (id: number) => {
    if (confirm("Tem certeza de que deseja ativar este local de entrega?")) {
      updateMutation.mutate({ id, data: { active: true } });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-background">
        <Alert variant="destructive">
          <AlertDescription>
            <strong>Erro ao carregar locais de entrega:</strong>{" "}
            {error instanceof Error ? error.message : "Sem permissão para acessar esta funcionalidade."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 bg-background">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Locais de Entrega</h1>
          <p className="text-muted-foreground">Gerencie os locais de entrega do sistema</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="showInactive"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-gray-300"
            />
            <Label htmlFor="showInactive" className="text-sm">Mostrar locais inativos</Label>
          </div>
          <Button onClick={() => { setFormData(EMPTY_FORM); setIsCreateModalOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Novo Local
          </Button>
        </div>
      </div>

      {/* Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {deliveryLocations.length === 0 ? (
          <div className="col-span-full text-center py-8">
            <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhum local de entrega cadastrado</p>
          </div>
        ) : (
          deliveryLocations.map((location) => (
            <DeliveryLocationCard
              key={location.id}
              location={location}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onActivate={handleActivate}
              isUpdatePending={updateMutation.isPending}
              isDeletePending={deleteMutation.isPending}
            />
          ))
        )}
      </div>

      {/* Create Modal */}
      <DeliveryLocationFormModal
        isOpen={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        title="Novo Local de Entrega"
        submitLabel="Criar"
        isPending={createMutation.isPending}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleCreateSubmit}
        onCancel={() => setIsCreateModalOpen(false)}
      />

      {/* Edit Modal */}
      <DeliveryLocationFormModal
        isOpen={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        title="Editar Local de Entrega"
        submitLabel="Salvar"
        isPending={updateMutation.isPending}
        formData={formData}
        setFormData={setFormData}
        editingLocation={editingLocation}
        onEditingLocationChange={setEditingLocation}
        onSubmit={handleEditSubmit}
        onCancel={() => setIsEditModalOpen(false)}
      />
    </div>
  );
}

export default DeliveryLocationsManagement;
