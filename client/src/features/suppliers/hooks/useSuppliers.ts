import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SupplierFormData } from "../schemas/supplier.schema";

export function useSuppliers(editingSupplier: any) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: suppliers = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/suppliers"],
  });

  const createSupplierMutation = useMutation({
    mutationFn: async (data: SupplierFormData) => {
      if (editingSupplier) {
        return await apiRequest(`/api/suppliers/${editingSupplier.id}`, {
          method: "PUT",
          body: data,
        });
      } else {
        return await apiRequest("/api/suppliers", {
          method: "POST",
          body: data,
        });
      }
    },
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ["/api/suppliers"] });
      const previousSuppliers = queryClient.getQueryData(["/api/suppliers"]);
      
      if (!editingSupplier) {
        queryClient.setQueryData(["/api/suppliers"], (old: any[]) => {
          if (!Array.isArray(old)) return old;
          const optimisticSupplier = {
            id: Date.now(),
            ...data,
            createdAt: new Date().toISOString()
          };
          return [...old, optimisticSupplier];
        });
      } else {
        queryClient.setQueryData(["/api/suppliers"], (old: any[]) => {
          if (!Array.isArray(old)) return old;
          return old.map(supplier => 
            supplier.id === editingSupplier.id ? { ...supplier, ...data } : supplier
          );
        });
      }
      return { previousSuppliers };
    },
    onError: (err: any, variables, context) => {
      if (context?.previousSuppliers) {
        queryClient.setQueryData(["/api/suppliers"], context.previousSuppliers);
      }
      let errorMessage = "Falha ao salvar fornecedor";
      if (err?.message) {
        errorMessage = err.message;
      } else if (err?.response?.data?.message) {
        errorMessage = err.response.data.message;
      }
      toast({ title: "Erro", description: errorMessage, variant: "destructive" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      queryClient.refetchQueries({ queryKey: ["/api/suppliers"] });
      toast({
        title: "Sucesso",
        description: editingSupplier ? "Fornecedor atualizado com sucesso" : "Fornecedor criado com sucesso",
      });
    },
  });

  return {
    suppliers,
    isLoading,
    createSupplierMutation
  };
}
