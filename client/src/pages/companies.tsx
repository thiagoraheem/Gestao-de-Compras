import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Building, CheckCircle, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Company, InsertCompany } from "@shared/schema";
import { CNPJInput } from "@/components/cnpj-input";
import { LogoUpload } from "@/components/logo-upload";
import { cn } from "@/lib/utils";

interface EmpresaERP {
  idCompany: number;
  companyName: string | null;
  companyTrading: string | null;
  cnpj: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
}

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
    idCompanyERP: null,
  });

  // State for ERP integration
  const [openCombobox, setOpenCombobox] = useState(false);
  const [pendingERPCompany, setPendingERPCompany] = useState<EmpresaERP | null>(null);
  const [isOverwriteDialogOpen, setIsOverwriteDialogOpen] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: erpCompanies, isLoading: isLoadingERP } = useQuery({
    queryKey: ["/api/integration/locador/combos/empresas"],
    queryFn: async () => {
      return await apiRequest("/api/integration/locador/combos/empresas") as EmpresaERP[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  const { data: allCompanies, isLoading, error } = useQuery({
    queryKey: ["/api/companies"],
    queryFn: async () => {
      const response = await apiRequest("/api/companies");
      return response;
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
      idCompanyERP: null,
    });
    setPendingERPCompany(null);
  };

  const handleSelectERPCompany = (company: EmpresaERP | null) => {
    if (!company) {
      // "Nenhuma" selected
      setFormData(prev => ({ ...prev, idCompanyERP: null }));
      setOpenCombobox(false);
      return;
    }

    // Check for overwrite
    const hasData = formData.name || formData.tradingName || formData.cnpj || formData.address;
    
    if (hasData) {
      // Update the combobox selection immediately, but ask for confirmation before overwriting data
      setFormData(prev => ({ ...prev, idCompanyERP: company.idCompany }));
      setPendingERPCompany(company);
      setIsOverwriteDialogOpen(true);
    } else {
      applyERPData(company);
    }
    setOpenCombobox(false);
  };

  const applyERPData = (company: EmpresaERP) => {
    setFormData(prev => ({
      ...prev,
      name: company.companyName || prev.name,
      tradingName: company.companyTrading || prev.tradingName || "",
      cnpj: company.cnpj || prev.cnpj || "",
      address: company.address || prev.address || "",
      phone: company.phone || prev.phone || "",
      email: company.email || prev.email || "",
      idCompanyERP: company.idCompany,
    }));
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.idCompanyERP) {
      toast({
        title: "Erro de validação",
        description: "O campo 'Empresa no ERP' é obrigatório.",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(formData);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCompany) {
      if (!formData.idCompanyERP) {
        toast({
          title: "Erro de validação",
          description: "O campo 'Empresa no ERP' é obrigatório.",
          variant: "destructive",
        });
        return;
      }
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
      idCompanyERP: company.idCompanyERP || null,
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

  const CompanyForm = ({ onSubmit, submitLabel, isPending, children }: { onSubmit: (e: React.FormEvent) => void, submitLabel: string, isPending: boolean, children?: React.ReactNode }) => (
    <form onSubmit={onSubmit} className="space-y-4">
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
          value={formData.tradingName || ""}
          onChange={(e) => setFormData({ ...formData, tradingName: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <CNPJInput
            value={formData.cnpj || ""}
            onChange={(value) => setFormData({ ...formData, cnpj: value })}
            required
          />
        </div>

        <div className="space-y-2">
          <Label>Empresa ERP</Label>
          <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={openCombobox}
                className="w-full justify-between"
              >
                {formData.idCompanyERP
                  ? erpCompanies?.find((c) => c.idCompany === formData.idCompanyERP)?.companyName
                  : "Selecione o ERP"}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0">
              <Command>
                <CommandInput placeholder="Buscar empresa..." />
                <CommandList>
                  <CommandEmpty>Nenhuma empresa encontrada.</CommandEmpty>
                  <CommandGroup>
                     <CommandItem
                      value="nenhuma"
                      onSelect={() => handleSelectERPCompany(null)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          !formData.idCompanyERP ? "opacity-100" : "opacity-0"
                        )}
                      />
                      Nenhuma
                    </CommandItem>
                    {erpCompanies?.map((company) => (
                      <CommandItem
                        key={company.idCompany}
                        value={company.companyName || ""}
                        onSelect={() => handleSelectERPCompany(company)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            formData.idCompanyERP === company.idCompany ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {company.companyName}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div>
        <Label htmlFor="address">Endereço</Label>
        <Input
          id="address"
          value={formData.address || ""}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
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
      </div>

      {children}

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={() => {
          setIsCreateModalOpen(false);
          setIsEditModalOpen(false);
        }}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando..." : submitLabel}
        </Button>
      </div>
    </form>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-background">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Empresas</h1>
            <p className="text-muted-foreground">Gerencie as empresas do sistema</p>
          </div>
        </div>
        <Alert variant="destructive">
          <AlertDescription>
            <strong>Erro ao carregar empresas:</strong> {error instanceof Error ? error.message : "Você não tem permissão para acessar esta funcionalidade. Apenas administradores podem gerenciar empresas."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 bg-background">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Empresas</h1>
          <p className="text-muted-foreground">Gerencie as empresas do sistema</p>
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
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building className="h-5 w-5 text-primary" />
                Nova Empresa
              </DialogTitle>
            </DialogHeader>
            <CompanyForm
              onSubmit={handleCreateSubmit}
              submitLabel="Criar"
              isPending={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {companies && companies.length === 0 ? (
          <div className="col-span-full text-center py-8">
            <Building className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhuma empresa cadastrada</p>
          </div>
        ) : (
          companies?.map((company: Company) => (
          <Card key={company.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {company.logoBase64 ? (
                    <img 
                      src={company.logoBase64} 
                      alt={`Logo ${company.name}`}
                      className="h-8 w-8 object-contain rounded"
                    />
                  ) : (
                    <Building className="h-5 w-5 text-primary" />
                  )}
                  <div>
                    <CardTitle className="text-lg">{company.name}</CardTitle>
                    {company.tradingName && (
                      <p className="text-sm text-muted-foreground">{company.tradingName}</p>
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
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building className="h-5 w-5 text-primary" />
              Editar Empresa
            </DialogTitle>
          </DialogHeader>
          <CompanyForm
            onSubmit={handleEditSubmit}
            submitLabel="Atualizar"
            isPending={updateMutation.isPending}
          >
            {editingCompany && (
              <div className="space-y-4">
                <div className="space-y-2">
                   <LogoUpload
                    companyId={editingCompany.id}
                    currentLogoBase64={editingCompany.logoBase64 || undefined}
                    onUploadSuccess={(logoBase64) => {
                      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
                      toast({
                        title: "Sucesso",
                        description: "Logo atualizado com sucesso!",
                      });
                    }}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="edit-active"
                    checked={formData.active || false}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                  />
                  <Label htmlFor="edit-active" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Empresa ativa
                  </Label>
                </div>
              </div>
            )}
          </CompanyForm>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isOverwriteDialogOpen} onOpenChange={setIsOverwriteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sobrescrever dados?</AlertDialogTitle>
            <AlertDialogDescription>
              Os dados da empresa selecionada no ERP (Razão Social, Nome Fantasia, CNPJ, Endereço, etc.) substituirão os dados atuais do formulário. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setPendingERPCompany(null);
              setIsOverwriteDialogOpen(false);
            }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (pendingERPCompany) {
                applyERPData(pendingERPCompany);
              }
              setPendingERPCompany(null);
              setIsOverwriteDialogOpen(false);
            }}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
