import { useState } from "react";
import { useCompanies, EmpresaERP } from "./hooks/useCompanies";
import { Plus } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { Alert, AlertDescription } from "@/shared/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/shared/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Company, InsertCompany } from "@shared/schema";

import { CompanyList } from "./components/CompanyList";
import { CompanyFormModal } from "./components/CompanyFormModal";

export function CompaniesManagement() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  
  const [formData, setFormData] = useState<InsertCompany>({
    name: "", tradingName: "", cnpj: "", address: "", phone: "", email: "", active: true, idCompanyERP: null,
  });

  const [openCombobox, setOpenCombobox] = useState(false);
  const [pendingERPCompany, setPendingERPCompany] = useState<EmpresaERP | null>(null);
  const [isOverwriteDialogOpen, setIsOverwriteDialogOpen] = useState(false);

  const { toast } = useToast();
  const { erpCompanies, allCompanies, isLoading, error, createMutation, updateMutation, deleteMutation } = useCompanies();

  const companies = showInactive ? allCompanies : allCompanies?.filter((company: Company) => company.active);

  const resetForm = () => {
    setFormData({ name: "", tradingName: "", cnpj: "", address: "", phone: "", email: "", active: true, idCompanyERP: null });
    setPendingERPCompany(null);
  };

  const handleSelectERPCompany = (company: EmpresaERP | null) => {
    if (!company) {
      setFormData(prev => ({ ...prev, idCompanyERP: null }));
      setOpenCombobox(false);
      return;
    }
    const hasData = formData.name || formData.tradingName || formData.cnpj || formData.address;
    if (hasData) {
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
      return toast({ title: "Erro de validação", description: "O campo 'Empresa no ERP' é obrigatório.", variant: "destructive", });
    }
    createMutation.mutate(formData, {
      onSuccess: () => {
        setIsCreateModalOpen(false); resetForm(); toast({ title: "Sucesso", description: "Empresa criada com sucesso!" });
      },
      onError: (err: any) => toast({ title: "Erro", description: err.message || "Erro ao criar empresa", variant: "destructive" })
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany) return;
    if (!formData.idCompanyERP) {
      return toast({ title: "Erro de validação", description: "O campo 'Empresa no ERP' é obrigatório.", variant: "destructive", });
    }
    updateMutation.mutate({ id: editingCompany.id, data: formData }, {
      onSuccess: () => {
        setIsEditModalOpen(false); setEditingCompany(null); resetForm(); toast({ title: "Sucesso", description: "Empresa atualizada com sucesso!" });
      },
      onError: (err: any) => toast({ title: "Erro", description: err.message || "Erro ao atualizar empresa", variant: "destructive" })
    });
  };

  const handleEdit = (company: Company) => {
    setEditingCompany(company);
    setFormData({
      name: company.name, tradingName: company.tradingName || "", cnpj: company.cnpj, address: company.address || "",
      phone: company.phone || "", email: company.email || "", active: company.active, idCompanyERP: company.idCompanyERP || null,
    });
    setIsEditModalOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza de que deseja desativar esta empresa?")) {
      deleteMutation.mutate(id, {
        onSuccess: () => toast({ title: "Sucesso", description: "Empresa desativada com sucesso!" }),
        onError: (err: any) => toast({ title: "Erro", description: err.message || "Erro ao desativar empresa", variant: "destructive" })
      });
    }
  };

  const handleActivate = (id: number) => {
    if (confirm("Tem certeza de que deseja ativar esta empresa?")) {
      updateMutation.mutate({ id, data: { active: true } }, {
        onSuccess: () => toast({ title: "Sucesso", description: "Empresa ativada com sucesso!" }),
      });
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
            <strong>Erro ao carregar empresas:</strong> {error instanceof Error ? error.message : "Sem permissão."}
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
            <Label htmlFor="showInactive" className="text-sm">Mostrar inativas</Label>
          </div>
          <Button onClick={() => { resetForm(); setIsCreateModalOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Nova Empresa
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <CompanyList 
          companies={companies || []}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onActivate={handleActivate}
          isUpdatePending={updateMutation.isPending}
          isDeletePending={deleteMutation.isPending}
        />
      </div>

      <CompanyFormModal
        isOpen={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        title="Nova Empresa"
        submitLabel="Criar"
        isPending={createMutation.isPending}
        formData={formData}
        setFormData={setFormData}
        editingCompany={null}
        erpCompanies={erpCompanies}
        openCombobox={openCombobox}
        setOpenCombobox={setOpenCombobox}
        handleSelectERPCompany={handleSelectERPCompany}
        onSubmit={handleCreateSubmit}
        onCancel={() => setIsCreateModalOpen(false)}
      />

      {editingCompany && (
        <CompanyFormModal
          isOpen={isEditModalOpen}
          onOpenChange={setIsEditModalOpen}
          title="Editar Empresa"
          submitLabel="Atualizar"
          isPending={updateMutation.isPending}
          formData={formData}
          setFormData={setFormData}
          editingCompany={editingCompany}
          erpCompanies={erpCompanies}
          openCombobox={openCombobox}
          setOpenCombobox={setOpenCombobox}
          handleSelectERPCompany={handleSelectERPCompany}
          onSubmit={handleEditSubmit}
          onCancel={() => setIsEditModalOpen(false)}
        />
      )}

      <AlertDialog open={isOverwriteDialogOpen} onOpenChange={setIsOverwriteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sobrescrever dados?</AlertDialogTitle>
            <AlertDialogDescription>
              Os dados da empresa selecionada no ERP (Razão Social, Nome Fantasia, CNPJ, Endereço, etc.) substituirão os dados atuais do formulário. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setPendingERPCompany(null); setIsOverwriteDialogOpen(false); }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => { 
                if (pendingERPCompany) applyERPData(pendingERPCompany); 
                setPendingERPCompany(null); setIsOverwriteDialogOpen(false); 
              }}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default CompaniesManagement;
