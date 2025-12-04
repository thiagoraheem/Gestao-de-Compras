import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Edit, Trash2, MapPin, Phone, Mail, User, FileText, CheckCircle } from "lucide-react";
import type { DeliveryLocation, InsertDeliveryLocation } from "../../../shared/schema";

export default function DeliveryLocationsPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<DeliveryLocation | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [formData, setFormData] = useState<Omit<InsertDeliveryLocation, 'active'>>({
    name: "",
    address: "",
    contactPerson: "",
    phone: "",
    email: "",
    observations: ""
  });

  const queryClient = useQueryClient();

  // Fetch delivery locations
  const { data: allDeliveryLocations = [], isLoading, error } = useQuery<DeliveryLocation[]>({
    queryKey: ["/api/delivery-locations"],
    staleTime: 0
  });

  // Filter delivery locations based on active status
  const deliveryLocations: DeliveryLocation[] = showInactive 
    ? allDeliveryLocations 
    : allDeliveryLocations.filter((location: DeliveryLocation) => location.active);

  // Create delivery location mutation
  const createMutation = useMutation({
    mutationFn: (data: Omit<InsertDeliveryLocation, 'active'>) => 
      apiRequest("/api/delivery-locations", { method: "POST", body: data }),
    onSuccess: () => {
      toast({ title: "Sucesso", description: "Local de entrega criado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/delivery-locations"] });
      setIsCreateModalOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro", 
        description: error.message || "Erro ao criar local de entrega", 
        variant: "destructive" 
      });
    }
  });

  // Update delivery location mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InsertDeliveryLocation> }) =>
      apiRequest(`/api/delivery-locations/${id}`, { method: "PUT", body: data }),
    onSuccess: () => {
      toast({ title: "Sucesso", description: "Local de entrega atualizado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/delivery-locations"] });
      setIsEditModalOpen(false);
      setEditingLocation(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro", 
        description: error.message || "Erro ao atualizar local de entrega", 
        variant: "destructive" 
      });
    }
  });

  // Deactivate delivery location mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest(`/api/delivery-locations/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Sucesso", description: "Local de entrega desativado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/delivery-locations"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro", 
        description: error.message || "Erro ao desativar local de entrega", 
        variant: "destructive" 
      });
    }
  });

  const resetForm = () => {
    setFormData({
      name: "",
      address: "",
      contactPerson: "",
      phone: "",
      email: "",
      observations: ""
    });
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.address.trim()) {
      toast({ 
        title: "Erro", 
        description: "Nome e endereço são obrigatórios", 
        variant: "destructive" 
      });
      return;
    }

    createMutation.mutate(formData);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.address.trim()) {
      toast({ 
        title: "Erro", 
        description: "Nome e endereço são obrigatórios", 
        variant: "destructive" 
      });
      return;
    }

    if (editingLocation) {
      updateMutation.mutate({ 
        id: editingLocation.id, 
        data: { ...formData, active: editingLocation.active }
      });
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
      observations: location.observations || ""
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
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Locais de Entrega</h1>
            <p className="text-muted-foreground">Gerencie os locais de entrega do sistema</p>
          </div>
        </div>
        <Alert variant="destructive">
          <AlertDescription>
            <strong>Erro ao carregar locais de entrega:</strong> {error instanceof Error ? error.message : "Você não tem permissão para acessar esta funcionalidade. Apenas administradores podem gerenciar locais de entrega."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 bg-background">
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
            <Label htmlFor="showInactive" className="text-sm">
              Mostrar locais inativos
            </Label>
          </div>
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Local
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Novo Local de Entrega</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="address">Endereço</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="contactPerson">Pessoa de Contato</Label>
                  <Input
                    id="contactPerson"
                    value={formData.contactPerson || ""}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={formData.phone || ""}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email || ""}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="observations">Observações</Label>
                  <Textarea
                    id="observations"
                    value={formData.observations || ""}
                    onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Criando..." : "Criar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {deliveryLocations && deliveryLocations.length === 0 ? (
          <div className="col-span-full text-center py-8">
            <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhum local de entrega cadastrado</p>
          </div>
        ) : (
          deliveryLocations?.map((location: DeliveryLocation) => (
          <Card key={location.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <MapPin className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-lg">{location.name}</CardTitle>
                  </div>
                </div>
                <Badge variant={location.active ? "default" : "secondary"}>
                  {location.active ? "Ativo" : "Inativo"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Endereço:</span> {location.address}
                </div>
                {location.contactPerson && (
                  <div className="flex items-center space-x-1">
                    <User className="h-3 w-3" />
                    <span className="font-medium">Contato:</span> {location.contactPerson}
                  </div>
                )}
                {location.phone && (
                  <div className="flex items-center space-x-1">
                    <Phone className="h-3 w-3" />
                    <span className="font-medium">Telefone:</span> {location.phone}
                  </div>
                )}
                {location.email && (
                  <div className="flex items-center space-x-1">
                    <Mail className="h-3 w-3" />
                    <span className="font-medium">Email:</span> {location.email}
                  </div>
                )}
                {location.observations && (
                  <div className="flex items-start space-x-1">
                    <FileText className="h-3 w-3 mt-0.5" />
                    <div>
                      <span className="font-medium">Observações:</span>
                      <p className="text-muted-foreground mt-1">{location.observations}</p>
                    </div>
                  </div>
                )}
              </div>
                <div className="flex space-x-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(location)}
                    disabled={updateMutation.isPending}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                  {location.active ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(location.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Desativar
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleActivate(location.id)}
                      disabled={updateMutation.isPending}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Ativar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Local de Entrega</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Nome</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-address">Endereço</Label>
              <Input
                id="edit-address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-contactPerson">Pessoa de Contato</Label>
              <Input
                id="edit-contactPerson"
                value={formData.contactPerson || ""}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-phone">Telefone</Label>
              <Input
                id="edit-phone"
                value={formData.phone || ""}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email || ""}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-observations">Observações</Label>
              <Textarea
                id="edit-observations"
                value={formData.observations || ""}
                onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-active"
                checked={editingLocation?.active || false}
                onChange={(e) => {
                  if (editingLocation) {
                    setEditingLocation({ ...editingLocation, active: e.target.checked });
                  }
                }}
              />
              <Label htmlFor="edit-active" className="text-sm">
                Local ativo
              </Label>
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
