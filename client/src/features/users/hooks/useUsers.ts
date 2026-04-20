import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryKeys } from "@/shared/lib/query-keys";

// Exposing the same interfaces used in users.tsx
export function useUsers() {
  const queryClient = useQueryClient();

  const { data: users = [], isLoading: isLoadingUsers } = useQuery<any[]>({
    queryKey: queryKeys.users.legacy,
  });

  const { data: departments = [], isLoading: isLoadingDepartments } = useQuery<any[]>({
    queryKey: queryKeys.departments.legacy,
  });

  const { data: costCenters = [], isLoading: isLoadingCostCenters } = useQuery<any[]>({
    queryKey: queryKeys.costCenters.legacy,
  });

  const isLoading = isLoadingUsers || isLoadingDepartments || isLoadingCostCenters;

  const createUserMutation = useMutation({
    mutationFn: async ({ data, editingUser, selectedCostCenters }: { data: any, editingUser: any, selectedCostCenters: number[] }) => {
      const endpoint = editingUser 
        ? `/api/users/${editingUser.id}`
        : "/api/users";
      const method = editingUser ? "PUT" : "POST";
      const response = await apiRequest(endpoint, {
        method,
        body: {
          ...data,
          costCenterIds: selectedCostCenters
        }
      });
      return response;
    },
    onMutate: async ({ data, editingUser, selectedCostCenters }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.users.legacy });
      const previousUsers = queryClient.getQueryData(queryKeys.users.legacy);
      
      if (!editingUser) {
        queryClient.setQueryData(queryKeys.users.legacy, (old: any[]) => {
          if (!Array.isArray(old)) return old;
          const optimisticUser = {
            id: Date.now(),
            ...data,
            department: data.departmentId ? departments.find((d: any) => d.id === data.departmentId) : null,
            costCenters: selectedCostCenters.map(id => costCenters.find((cc: any) => cc.id === id)).filter(Boolean)
          };
          return [...old, optimisticUser];
        });
      } else {
        queryClient.setQueryData(queryKeys.users.legacy, (old: any[]) => {
          if (!Array.isArray(old)) return old;
          return old.map(user => 
            user.id === editingUser.id 
              ? { 
                  ...user, 
                  ...data,
                  department: data.departmentId ? departments.find((d: any) => d.id === data.departmentId) : null,
                  costCenters: selectedCostCenters.map(id => costCenters.find((cc: any) => cc.id === id)).filter(Boolean)
                }
              : user
          );
        });
      }
      return { previousUsers };
    },
    onError: (err: any, variables, context) => {
      if (context?.previousUsers) {
        queryClient.setQueryData(queryKeys.users.legacy, context.previousUsers);
      }
      throw err;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.legacy });
      queryClient.invalidateQueries({ queryKey: queryKeys.costCenters.legacy });
      queryClient.invalidateQueries({ queryKey: queryKeys.departments.legacy });
      
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          !!(query.queryKey[0]?.toString().includes(`/api/users/`) &&
          query.queryKey[0]?.toString().includes(`/cost-centers`))
      });
      
      queryClient.refetchQueries({ queryKey: queryKeys.users.legacy });
      queryClient.refetchQueries({ queryKey: queryKeys.costCenters.legacy });
      queryClient.refetchQueries({ queryKey: queryKeys.departments.legacy });
    },
  });

  const checkDeleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest(`/api/users/${userId}/can-delete`, { method: "GET" });
      return response;
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest(`/api/users/${userId}`, { method: "DELETE" });
      return response;
    },
    onMutate: async (userId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.users.legacy });
      const previousUsers = queryClient.getQueryData(queryKeys.users.legacy);
      
      queryClient.setQueryData(queryKeys.users.legacy, (old: any[]) => {
        if (!Array.isArray(old)) return old;
        return old.filter(user => user.id !== userId);
      });
      return { previousUsers };
    },
    onError: (err, variables, context) => {
      if (context?.previousUsers) {
        queryClient.setQueryData(queryKeys.users.legacy, context.previousUsers);
      }
      throw err;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.legacy });
      queryClient.invalidateQueries({ queryKey: queryKeys.costCenters.legacy });
      queryClient.invalidateQueries({ queryKey: queryKeys.departments.legacy });
      queryClient.refetchQueries({ queryKey: queryKeys.users.legacy });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest(`/api/users/${userId}/reset-password`, { method: "POST" });
      return response;
    }
  });

  const setPasswordMutation = useMutation({
    mutationFn: async (data: { userId: number; password: string }) => {
      const response = await apiRequest(`/api/users/${data.userId}/set-password`, {
        method: "POST",
        body: { password: data.password },
      });
      return response;
    }
  });

  return {
    users,
    departments,
    costCenters,
    isLoading,
    createUserMutation,
    checkDeleteUserMutation,
    deleteUserMutation,
    resetPasswordMutation,
    setPasswordMutation
  };
}
