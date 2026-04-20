import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryKeys } from "@/shared/lib/query-keys";

export function useDepartments() {
  const queryClient = useQueryClient();

  const { data: departments = [], isLoading: isDeptLoading } = useQuery<any[]>({
    queryKey: queryKeys.departments.legacy,
  });

  const { data: costCenters = [], isLoading: isCostCenterLoading } = useQuery<any[]>({
    queryKey: queryKeys.costCenters.legacy,
  });

  const createDepartmentMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("/api/departments", { method: "POST", body: data });
      return response;
    },
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.departments.legacy });
      const previousDepartments = queryClient.getQueryData(queryKeys.departments.legacy);
      
      queryClient.setQueryData(queryKeys.departments.legacy, (old: any[]) => {
        if (!Array.isArray(old)) return old;
        const optimisticDept = {
          id: Date.now(),
          ...data,
          createdAt: new Date().toISOString()
        };
        return [...old, optimisticDept];
      });
      return { previousDepartments };
    },
    onError: (err, variables, context) => {
      if (context?.previousDepartments) {
        queryClient.setQueryData(queryKeys.departments.legacy, context.previousDepartments);
      }
      throw err;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.departments.legacy });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.legacy });
      queryClient.invalidateQueries({ queryKey: queryKeys.costCenters.legacy });
      queryClient.refetchQueries({ queryKey: queryKeys.departments.legacy });
      queryClient.refetchQueries({ queryKey: queryKeys.users.legacy });
    },
  });

  const updateDepartmentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: any }) => {
      const response = await apiRequest(`/api/departments/${id}`, { method: "PUT", body: data });
      return response;
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.departments.legacy });
      const previousDepartments = queryClient.getQueryData(queryKeys.departments.legacy);
      
      queryClient.setQueryData(queryKeys.departments.legacy, (old: any[]) => {
        if (!Array.isArray(old)) return old;
        return old.map(d => d.id === id ? { ...d, ...data } : d);
      });
      return { previousDepartments };
    },
    onError: (err, variables, context) => {
      if (context?.previousDepartments) {
        queryClient.setQueryData(queryKeys.departments.legacy, context.previousDepartments);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.departments.legacy });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.legacy });
      queryClient.invalidateQueries({ queryKey: queryKeys.costCenters.legacy });
      queryClient.refetchQueries({ queryKey: queryKeys.departments.legacy });
      queryClient.refetchQueries({ queryKey: queryKeys.users.legacy });
    },
  });

  const createCostCenterMutation = useMutation({
    mutationFn: async ({ data, editingCostCenter }: { data: any, editingCostCenter?: any }) => {
      const endpoint = editingCostCenter 
        ? `/api/cost-centers/${editingCostCenter.id}`
        : "/api/cost-centers";
      const method = editingCostCenter ? "PUT" : "POST";
      const response = await apiRequest(endpoint, { method, body: data });
      return response;
    },
    onMutate: async ({ data }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.costCenters.legacy });
      const previousCostCenters = queryClient.getQueryData(queryKeys.costCenters.legacy);
      
      queryClient.setQueryData(queryKeys.costCenters.legacy, (old: any[]) => {
        if (!Array.isArray(old)) return old;
        const optimisticCC = {
          id: Date.now(),
          ...data,
          department: departments.find((d: any) => d.id === data.departmentId),
          createdAt: new Date().toISOString()
        };
        return [...old, optimisticCC];
      });
      return { previousCostCenters };
    },
    onError: (err, variables, context) => {
      if (context?.previousCostCenters) {
        queryClient.setQueryData(queryKeys.costCenters.legacy, context.previousCostCenters);
      }
      throw err;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.costCenters.legacy });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.legacy });
      queryClient.invalidateQueries({ queryKey: queryKeys.departments.legacy });
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          !!(query.queryKey[0]?.toString().includes(`/api/users/`) &&
          query.queryKey[0]?.toString().includes(`/cost-centers`))
      });
      queryClient.refetchQueries({ queryKey: queryKeys.costCenters.legacy });
      queryClient.refetchQueries({ queryKey: queryKeys.users.legacy });
    },
  });

  const deleteDepartmentMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest(`/api/departments/${id}`, { method: "DELETE" });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.departments.legacy });
      queryClient.invalidateQueries({ queryKey: queryKeys.costCenters.legacy });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.legacy });
    }
  });

  const deleteCostCenterMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest(`/api/cost-centers/${id}`, { method: "DELETE" });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.costCenters.legacy });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.legacy });
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          !!(query.queryKey[0]?.toString().includes(`/api/users/`) &&
          query.queryKey[0]?.toString().includes(`/cost-centers`))
      });
    }
  });

  const checkDepartmentCanBeDeleted = async (id: number) => {
    try {
      const response = await apiRequest(`/api/departments/${id}/can-delete`, { method: "GET" });
      return response as { canDelete: boolean; reason?: string };
    } catch (error) {
      return { canDelete: false, reason: "Erro ao verificar se departamento pode ser excluído" };
    }
  };

  const checkCostCenterCanBeDeleted = async (id: number) => {
    try {
      const response = await apiRequest(`/api/cost-centers/${id}/can-delete`, { method: "GET" });
      return response as { canDelete: boolean; reason?: string };
    } catch (error) {
      return { canDelete: false, reason: "Erro ao verificar se centro de custo pode ser excluído" };
    }
  };

  return {
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
  };
}
