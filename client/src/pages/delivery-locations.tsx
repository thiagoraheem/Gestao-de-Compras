import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Edit, Trash2, MapPin, Phone, Mail, User, FileText } from "lucide-react";
import type { DeliveryLocation, InsertDeliveryLocation } from "../../../shared/schema";

export default function DeliveryLocationsPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<DeliveryLocation | null>(null);
  const [formData, setFormData] = useState<Omit<InsertDeliveryLocation, 'isActive'>>({
    name: "",
    address: "",
    contactPerson: "",
    phone: "",
    email: "",
    observations: ""
  });

  const queryClient = useQueryClient();

  // Fetch delivery locations
  const { data: deliveryLocations = [], isLoading } = useQuery({
    queryKey: ["/api/delivery-locations"],
    staleTime: 0
  });

  // Create delivery location mutation
  const createMutation = useMutation({
    mutationFn: (data: Omit<InsertDeliveryLocation, 'isActive'>) => 
      apiRequest("/api/delivery-locations", { method: "POST", body: data }),
    onSuccess: () => {
      toast({ title: "Sucesso", description: "Local de entrega criado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/delivery-locations"] });
      setIsCreateModalOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Erro", description: "Erro ao criar local de entrega", variant: "destructive" });
    }
  });

  // Update delivery location mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InsertDeliveryLocation> }) =>
      apiRequest(`/api/delivery-locations/${id}`, { method: "PUT", body: data }),
    onSuccess: () => {
      toast({ title: "Sucesso", description: "Local de entrega atualizado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/delivery-locations"] });
      setEditingLocation(null);
      resetForm();
    },
    onError: () => {
      toast({ title: "Erro", description: "Erro ao atualizar local de entrega", variant: "destructive" });
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
    onError: () => {
      toast({ title: "Erro", description: "Erro ao desativar local de entrega", variant: "destructive" });
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

  const handleSubmit = (e: React.FormEvent) => {
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
      updateMutation.mutate({ id: editingLocation.id, data: formData });
    } else {
      createMutation.mutate(formData);
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
  };

  const handleCloseModal = () => {
    setEditingLocation(null);
    setIsCreateModalOpen(false);
    resetForm();
  };

  const handleDelete = (location: DeliveryLocation) => {
    if (window.confirm(`Tem certeza que deseja desativar o local "${location.name}"?`)) {
      deleteMutation.mutate(location.id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Carregando locais de entrega...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Locais de Entrega</h1>
          <p className="text-muted-foreground">
            Gerencie os locais de entrega para cotações e pedidos
          </p>
        </div>
        
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Local
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Novo Local de Entrega</DialogTitle>
              <DialogDescription>
                Adicione um novo local de entrega para cotações e pedidos
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="name">Nome do Local *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Matriz, Filial São Paulo, etc."
                    required
                  />
                </div>
                
                <div className="col-span-2">
                  <Label htmlFor="address">Endereço Completo *</Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Rua, número, complemento, bairro, cidade, CEP"
                    required
                    rows={3}
                  />
                </div>
                
                <div>
                  <Label htmlFor="contactPerson">Responsável</Label>
                  <Input
                    id="contactPerson"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    placeholder="Nome do responsável"
                  />
                </div>
                
                <div>
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(11) 99999-9999"
                  />
                </div>
                
                <div className="col-span-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contato@empresa.com"
                  />
                </div>
                
                <div className="col-span-2">
                  <Label htmlFor="observations">Observações</Label>
                  <Textarea
                    id="observations"
                    value={formData.observations}
                    onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                    placeholder="Informações adicionais, horários de funcionamento, etc."
                    rows={2}
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseModal}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Criando..." : "Criar Local"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Modal */}
      <Dialog open={!!editingLocation} onOpenChange={() => setEditingLocation(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Local de Entrega</DialogTitle>
            <DialogDescription>
              Altere as informações do local de entrega
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="edit-name">Nome do Local *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Matriz, Filial São Paulo, etc."
                  required
                />
              </div>
              
              <div className="col-span-2">
                <Label htmlFor="edit-address">Endereço Completo *</Label>
                <Textarea
                  id="edit-address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Rua, número, complemento, bairro, cidade, CEP"
                  required
                  rows={3}
                />
              </div>
              
              <div>
                <Label htmlFor="edit-contactPerson">Responsável</Label>
                <Input
                  id="edit-contactPerson"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  placeholder="Nome do responsável"
                />
              </div>
              
              <div>
                <Label htmlFor="edit-phone">Telefone</Label>
                <Input
                  id="edit-phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(11) 99999-9999"
                />
              </div>
              
              <div className="col-span-2">
                <Label htmlFor="edit-email">E-mail</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="contato@empresa.com"
                />
              </div>
              
              <div className="col-span-2">
                <Label htmlFor="edit-observations">Observações</Label>
                <Textarea
                  id="edit-observations"
                  value={formData.observations}
                  onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                  placeholder="Informações adicionais, horários de funcionamento, etc."
                  rows={2}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseModal}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delivery Locations Table */}
      <Card>
        <CardHeader>
          <CardTitle>Locais Cadastrados</CardTitle>
          <CardDescription>
            {deliveryLocations.length} {deliveryLocations.length === 1 ? 'local cadastrado' : 'locais cadastrados'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {deliveryLocations.length === 0 ? (
            <div className="text-center py-8">
              <MapPin className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">Nenhum local cadastrado</h3>
              <p className="mt-1 text-sm text-gray-500">
                Comece criando um novo local de entrega.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Endereço</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveryLocations.map((location: DeliveryLocation) => (
                    <TableRow key={location.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center">
                          <MapPin className="mr-2 h-4 w-4 text-gray-400" />
                          {location.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs truncate" title={location.address}>
                          {location.address}
                        </div>
                      </TableCell>
                      <TableCell>
                        {location.contactPerson && (
                          <div className="flex items-center">
                            <User className="mr-2 h-4 w-4 text-gray-400" />
                            {location.contactPerson}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {location.phone && (
                            <div className="flex items-center text-sm">
                              <Phone className="mr-2 h-3 w-3 text-gray-400" />
                              {location.phone}
                            </div>
                          )}
                          {location.email && (
                            <div className="flex items-center text-sm">
                              <Mail className="mr-2 h-3 w-3 text-gray-400" />
                              {location.email}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={location.isActive ? "default" : "secondary"}>
                          {location.isActive ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(location)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {location.isActive && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(location)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}