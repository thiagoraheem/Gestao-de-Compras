import { useState } from "react";
import { useDepartments } from "./hooks/useDepartments";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Plus, Building } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AdminRoute from "@/components/AdminRoute";

import { departmentSchema, costCenterSchema, DepartmentFormData, CostCenterFormData } from "./schemas/department.schema";
import { DepartmentList, CostCenterList } from "./components/DepartmentLists";
import { DepartmentFormModal, CostCenterFormModal } from "./components/DepartmentModals";

export function DepartmentsManagement() {
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [isCostCenterModalOpen, setIsCostCenterModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<any>(null);
  const [editingCostCenter, setEditingCostCenter] = useState<any>(null);
  
  const { toast } = useToast();
  
  const {
    departments,
    isDeptLoading,
    costCenters,
    isCostCenterLoading,
    createDepartmentMutation,
    updateDepartmentMutation,
    createCostCenterMutation,
    deleteDepartmentMutation,
    deleteCostCenterMutation,
    checkDepartmentCanBeDeleted,
    checkCostCenterCanBeDeleted
  } = useDepartments();

  const deptForm = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentSchema),
    defaultValues: { name: "", description: "" },
  });

  const costCenterForm = useForm<CostCenterFormData>({
    resolver: zodResolver(costCenterSchema),
    defaultValues: { code: "", name: "", departmentId: undefined as any, description: "" },
  });

  const handleDeleteDepartment = async (department: any) => {
    const result = await checkDepartmentCanBeDeleted(department.id);
    if (!result.canDelete) {
      toast({ title: "Não é possível excluir", description: result.reason, variant: "destructive" });
      return;
    }
    deleteDepartmentMutation.mutate(department.id, {
      onSuccess: () => toast({ title: "Sucesso", description: "Departamento excluído com sucesso" }),
      onError: (err: any) => toast({ title: "Erro", description: err.message || "Erro ao excluir departamento", variant: "destructive" })
    });
  };

  const handleDeleteCostCenter = async (costCenter: any) => {
    const result = await checkCostCenterCanBeDeleted(costCenter.id);
    if (!result.canDelete) {
      toast({ title: "Não é possível excluir", description: result.reason, variant: "destructive" });
      return;
    }
    deleteCostCenterMutation.mutate(costCenter.id, {
      onSuccess: () => toast({ title: "Sucesso", description: "Centro de custo excluído com sucesso" }),
      onError: (err: any) => toast({ title: "Erro", description: err.message || "Erro ao excluir centro de custo", variant: "destructive" })
    });
  };

  const onSubmitDepartment = (data: DepartmentFormData) => {
    if (editingDepartment) {
      updateDepartmentMutation.mutate({ id: editingDepartment.id, data }, {
        onSuccess: () => {
          setIsDeptModalOpen(false); setEditingDepartment(null); deptForm.reset();
          toast({ title: "Sucesso", description: "Departamento atualizado com sucesso" });
        },
        onError: () => toast({ title: "Erro", description: "Falha ao salvar departamento", variant: "destructive" })
      });
    } else {
      createDepartmentMutation.mutate(data, {
        onSuccess: () => {
          setIsDeptModalOpen(false); setEditingDepartment(null); deptForm.reset();
          toast({ title: "Sucesso", description: "Departamento criado com sucesso" });
        },
        onError: () => toast({ title: "Erro", description: "Falha ao salvar departamento", variant: "destructive" })
      });
    }
  };

  const onSubmitCostCenter = (data: CostCenterFormData) => {
    if (!data.departmentId || data.departmentId <= 0) {
      toast({ title: "Erro", description: "Selecione um departamento válido", variant: "destructive" });
      return;
    }
    createCostCenterMutation.mutate({ data, editingCostCenter }, {
      onSuccess: () => {
        setIsCostCenterModalOpen(false); setEditingCostCenter(null); costCenterForm.reset();
        toast({ title: "Sucesso", description: editingCostCenter ? "Centro de custo atualizado com sucesso" : "Centro de custo criado com sucesso" });
      },
      onError: (err: any) => toast({ title: "Erro", description: err.message || "Falha ao salvar centro de custo", variant: "destructive" })
    });
  };

  const handleEditDepartment = (department: any) => {
    setEditingDepartment(department);
    deptForm.reset({ name: department.name || "", description: department.description || "" });
    setIsDeptModalOpen(true);
  };

  const handleEditCostCenter = (costCenter: any) => {
    setEditingCostCenter(costCenter);
    costCenterForm.reset({
      code: costCenter.code || "", name: costCenter.name || "", 
      departmentId: costCenter.departmentId || 0, description: costCenter.description || ""
    });
    setIsCostCenterModalOpen(true);
  };

  const handleCloseDeptModal = () => {
    setIsDeptModalOpen(false); setEditingDepartment(null); deptForm.reset();
  };

  const handleCloseCostCenterModal = () => {
    setIsCostCenterModalOpen(false); setEditingCostCenter(null); 
    costCenterForm.reset({ code: "", name: "", departmentId: undefined as any, description: "" });
    costCenterForm.clearErrors();
  };

  return (
    <AdminRoute>
      <div className="h-full overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6 space-y-6 bg-background">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <Building className="mr-2 h-5 w-5" />
                  Departamentos
                </CardTitle>
                <Button onClick={() => setIsDeptModalOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Novo Departamento
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <DepartmentList 
                departments={departments}
                isLoading={isDeptLoading}
                onEdit={handleEditDepartment}
                onDelete={handleDeleteDepartment}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Centros de Custo</CardTitle>
                <Button onClick={() => setIsCostCenterModalOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Novo Centro de Custo
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <CostCenterList 
                costCenters={costCenters}
                departments={departments}
                isLoading={isCostCenterLoading}
                onEdit={handleEditCostCenter}
                onDelete={handleDeleteCostCenter}
              />
            </CardContent>
          </Card>

          <DepartmentFormModal 
            isOpen={isDeptModalOpen}
            onClose={handleCloseDeptModal}
            isEditing={!!editingDepartment}
            form={deptForm}
            onSubmit={onSubmitDepartment}
            isPending={editingDepartment ? updateDepartmentMutation.isPending : createDepartmentMutation.isPending}
          />

          <CostCenterFormModal 
            isOpen={isCostCenterModalOpen}
            onClose={handleCloseCostCenterModal}
            isEditing={!!editingCostCenter}
            form={costCenterForm}
            departments={departments}
            onSubmit={onSubmitCostCenter}
            isPending={createCostCenterMutation.isPending}
          />
        </div>
      </div>
    </AdminRoute>
  );
}

export default DepartmentsManagement;
