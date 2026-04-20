const fs = require('fs');
const path = require('path');

const departmentsPath = path.join(__dirname, '../client/src/pages/departments.tsx');
const companiesPath = path.join(__dirname, '../client/src/pages/companies.tsx');

let deptContent = fs.readFileSync(departmentsPath, 'utf8');

// DEPARTMENTS
deptContent = deptContent.replace(
  'import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";',
  'import { useDepartments } from "@/features/departments/hooks/useDepartments";'
);

const queriesDeptRegex = /const queryClient = useQueryClient\(\);\s*const \{\s*data:\s*departments[^}]+\};/s;
deptContent = deptContent.replace(queriesDeptRegex, `  const {
    departments,
    isDeptLoading,
    costCenters,
    isCostCenterLoading,
    createDepartmentMutation,
    createCostCenterMutation,
    deleteDepartmentMutation,
    deleteCostCenterMutation,
    checkDepartmentCanBeDeleted,
    checkCostCenterCanBeDeleted
  } = useDepartments();`);

const mutationsDeptRegex = /const createDepartmentMutation = useMutation\(\{.*?(?=const checkDepartmentCanBeDeleted = async)/s;
deptContent = deptContent.replace(mutationsDeptRegex, '');

const checkFn1Regex = /const checkDepartmentCanBeDeleted = async.*?};/s;
deptContent = deptContent.replace(checkFn1Regex, '');

const checkFn2Regex = /const checkCostCenterCanBeDeleted = async.*?};/s;
deptContent = deptContent.replace(checkFn2Regex, '');

deptContent = deptContent.replace(
  /createDepartmentMutation\.mutate\(data\);/,
  `createDepartmentMutation.mutate({ data, editingDepartment }, {
      onSuccess: () => {
        setIsDeptModalOpen(false);
        setEditingDepartment(null);
        deptForm.reset();
        toast({
          title: "Sucesso",
          description: editingDepartment ? "Departamento atualizado com sucesso" : "Departamento criado com sucesso",
        });
      },
      onError: () => {
        toast({ title: "Erro", description: "Falha ao salvar departamento", variant: "destructive" });
      }
    });`
);

deptContent = deptContent.replace(
  /createCostCenterMutation\.mutate\(data\);/,
  `createCostCenterMutation.mutate({ data, editingCostCenter }, {
      onSuccess: () => {
        setIsCostCenterModalOpen(false);
        setEditingCostCenter(null);
        costCenterForm.reset();
        toast({
          title: "Sucesso",
          description: editingCostCenter ? "Centro de custo atualizado com sucesso" : "Centro de custo criado com sucesso",
        });
      },
      onError: (err) => {
        toast({ title: "Erro", description: err.message || "Falha ao salvar centro de custo", variant: "destructive" });
      }
    });`
);

deptContent = deptContent.replace(
  /deleteDepartmentMutation\.mutate\(department\.id\);/,
  `deleteDepartmentMutation.mutate(department.id, {
      onSuccess: () => toast({ title: "Sucesso", description: "Departamento excluído com sucesso" }),
      onError: (err) => toast({ title: "Erro", description: err.message || "Erro ao excluir", variant: "destructive" })
    });`
);

deptContent = deptContent.replace(
  /deleteCostCenterMutation\.mutate\(costCenter\.id\);/,
  `deleteCostCenterMutation.mutate(costCenter.id, {
      onSuccess: () => toast({ title: "Sucesso", description: "Centro de custo excluído com sucesso" }),
      onError: (err) => toast({ title: "Erro", description: err.message || "Erro ao excluir", variant: "destructive" })
    });`
);

fs.writeFileSync(departmentsPath, deptContent, 'utf8');

// COMPANIES
let compContent = fs.readFileSync(companiesPath, 'utf8');

compContent = compContent.replace(
  'import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";',
  'import { useCompanies } from "@/features/companies/hooks/useCompanies";'
);

const queriesCompRegex = /const queryClient = useQueryClient\(\);\s*const \{\s*data:\s*erpCompanies[^}]+\};/s;
compContent = compContent.replace(queriesCompRegex, `  const {
    erpCompanies,
    isLoadingERP,
    allCompanies,
    isLoading,
    error,
    createMutation,
    updateMutation,
    deleteMutation
  } = useCompanies();`);

const mutationsCompRegex = /const createMutation = useMutation\(\{.*?(?=const resetForm =)/s;
compContent = compContent.replace(mutationsCompRegex, '');

compContent = compContent.replace(
  /createMutation\.mutate\(formData\);/,
  `createMutation.mutate(formData, {
      onSuccess: () => {
        setIsCreateModalOpen(false);
        resetForm();
        toast({ title: "Sucesso", description: "Empresa criada com sucesso!" });
      },
      onError: (error) => toast({ title: "Erro", description: error.message || "Erro ao criar empresa", variant: "destructive" })
    });`
);

compContent = compContent.replace(
  /updateMutation\.mutate\(\{ id: editingCompany\.id, data: formData \}\);/,
  `updateMutation.mutate({ id: editingCompany.id, data: formData }, {
      onSuccess: () => {
        setIsEditModalOpen(false);
        setEditingCompany(null);
        resetForm();
        toast({ title: "Sucesso", description: "Empresa atualizada com sucesso!" });
      },
      onError: (error) => toast({ title: "Erro", description: error.message || "Erro ao atualizar empresa", variant: "destructive" })
    });`
);

compContent = compContent.replace(
  /deleteMutation\.mutate\(id\);/,
  `deleteMutation.mutate(id, {
      onSuccess: () => toast({ title: "Sucesso", description: "Empresa desativada com sucesso!" }),
      onError: (error) => toast({ title: "Erro", description: error.message || "Erro ao desativar empresa", variant: "destructive" })
    });`
);

compContent = compContent.replace(
  /updateMutation\.mutate\(\{ id, data: \{ active: true \} \}\);/,
  `updateMutation.mutate({ id, data: { active: true } }, {
      onSuccess: () => toast({ title: "Sucesso", description: "Empresa ativada com sucesso!" }),
      onError: (error) => toast({ title: "Erro", description: error.message || "Erro ao ativar empresa", variant: "destructive" })
    });`
);

fs.writeFileSync(companiesPath, compContent, 'utf8');
console.log("Hooks injected in pages successfully!");
