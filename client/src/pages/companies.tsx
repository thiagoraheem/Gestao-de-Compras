import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Building, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Company, InsertCompany } from "@shared/schema";
import { CNPJInput } from "@/components/cnpj-input";
import { LogoUpload } from "@/components/logo-upload";

export default function Companies() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [formData, setFormData] = useState<InsertCompany>({
    name: "",
    tradingName: "",
    cnpj: "",
    address: "",
    phone: "",
    email: "",
    active: true,
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: allCompanies, isLoading, error } = useQuery({
    queryKey: ["/api/companies"],
    queryFn: async () => {
      const response = await apiRequest("/api/companies");
      return await response.json();
    },
  });

  // Filter companies based on active status
  const companies = showInactive 
    ? allCompanies 
    : allCompanies?.filter((company: Company) => company.active);

  const createMutation = useMutation({
    mutationFn: (data: InsertCompany) => apiRequest("/api/companies", { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setIsCreateModalOpen(false);
      resetForm();
      toast({
        title: "Sucesso",
        description: "Empresa criada com sucesso!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar empresa",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InsertCompany> }) =>
      apiRequest(`/api/companies/${id}`, { method: "PUT", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setIsEditModalOpen(false);
      setEditingCompany(null);
      resetForm();
      toast({
        title: "Sucesso",
        description: "Empresa atualizada com sucesso!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar empresa",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/companies/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({
        title: "Sucesso",
        description: "Empresa desativada com sucesso!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao desativar empresa",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      tradingName: "",
      cnpj: "",
      address: "",
      phone: "",
      email: "",
      active: true,
    });
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCompany) {
      updateMutation.mutate({ id: editingCompany.id, data: formData });
    }
  };

  const handleEdit = (company: Company) => {
    setEditingCompany(company);
    setFormData({
      name: company.name,
      tradingName: company.tradingName || "",
      cnpj: company.cnpj,
      address: company.address || "",
      phone: company.phone || "",
      email: company.email || "",
      active: company.active,
    });
    setIsEditModalOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza de que deseja desativar esta empresa?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleActivate = (id: number) => {
    if (confirm("Tem certeza de que deseja ativar esta empresa?")) {
      updateMutation.mutate({ id, data: { active: true } });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Empresas</h1>
            <p className="text-gray-600">Gerencie as empresas do sistema</p>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Erro ao carregar empresas
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>
                  {error instanceof Error ? error.message : "Você não tem permissão para acessar esta funcionalidade. Apenas administradores podem gerenciar empresas."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Empresas</h1>
          <p className="text-gray-600">Gerencie as empresas do sistema</p>
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
              Mostrar empresas inativas
            </Label>
          </div>
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Empresa
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Nova Empresa</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Razão Social</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="tradingName">Nome Fantasia</Label>
                <Input
                  id="tradingName"
                  value={formData.tradingName}
                  onChange={(e) => setFormData({ ...formData, tradingName: e.target.value })}
                />
              </div>
              <CNPJInput
                value={formData.cnpj}
                onChange={(value) => setFormData({ ...formData, cnpj: value })}
                required
              />
              <div>
                <Label htmlFor="address">Endereço</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
        {companies && companies.length === 0 ? (
          <div className="col-span-full text-center py-8">
            <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Nenhuma empresa cadastrada</p>
          </div>
        ) : (
          companies?.map((company: Company) => (
          <Card key={company.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {company.logoUrl ? (
                    <img 
                      src={company.logoUrl} 
                      alt={`Logo ${company.name}`}
                      className="h-8 w-8 object-contain rounded"
                    />
                  ) : (
                    <Building className="h-5 w-5 text-blue-600" />
                  )}
                  <div>
                    <CardTitle className="text-lg">{company.name}</CardTitle>
                    {company.tradingName && (
                      <p className="text-sm text-gray-500">{company.tradingName}</p>
                    )}
                  </div>
                </div>
                <Badge variant={company.active ? "default" : "secondary"}>
                  {company.active ? "Ativa" : "Inativa"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">CNPJ:</span> {company.cnpj}
                </div>
                {company.address && (
                  <div>
                    <span className="font-medium">Endereço:</span> {company.address}
                  </div>
                )}
                {company.phone && (
                  <div>
                    <span className="font-medium">Telefone:</span> {company.phone}
                  </div>
                )}
                {company.email && (
                  <div>
                    <span className="font-medium">Email:</span> {company.email}
                  </div>
                )}
              </div>
              <div className="flex space-x-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(company)}
                  disabled={updateMutation.isPending}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Editar
                </Button>
                {company.active ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(company.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Desativar
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleActivate(company.id)}
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
            <DialogTitle>Editar Empresa</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Razão Social</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-tradingName">Nome Fantasia</Label>
              <Input
                id="edit-tradingName"
                value={formData.tradingName}
                onChange={(e) => setFormData({ ...formData, tradingName: e.target.value })}
              />
            </div>
            <CNPJInput
              value={formData.cnpj}
              onChange={(value) => setFormData({ ...formData, cnpj: value })}
              required
            />
            <div>
              <Label htmlFor="edit-address">Endereço</Label>
              <Input
                id="edit-address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-phone">Telefone</Label>
              <Input
                id="edit-phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            {editingCompany && (
              <LogoUpload
                companyId={editingCompany.id}
                currentLogoUrl={editingCompany.logoUrl}
                onUploadSuccess={(logoUrl) => {
                  // Atualizar o estado local e invalidar o cache
                  queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
                  toast({
                    title: "Sucesso",
                    description: "Logo atualizado com sucesso!",
                  });
                }}
              />
            )}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-active"
                checked={formData.active || false}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
              />
              <Label htmlFor="edit-active" className="text-sm">
                Empresa ativa
              </Label>
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Atualizando..." : "Atualizar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}