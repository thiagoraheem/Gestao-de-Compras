import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryKeys } from "@/shared/lib/query-keys";
import { InsertCompany } from "@shared/schema";

export interface EmpresaERP {
  idCompany: number;
  companyName: string | null;
  companyTrading: string | null;
  cnpj: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
}

export function useCompanies() {
  const queryClient = useQueryClient();

  const { data: erpCompanies, isLoading: isLoadingERP } = useQuery({
    queryKey: ["/api/integration/locador/combos/empresas"],
    queryFn: async () => {
      const response = await apiRequest("/api/integration/locador/combos/empresas");
      return response as EmpresaERP[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: allCompanies, isLoading, error } = useQuery({
    queryKey: queryKeys.companies.legacy,
    queryFn: async () => {
      const response = await apiRequest("/api/companies");
      return response;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertCompany) => apiRequest("/api/companies", { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.legacy });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InsertCompany> }) =>
      apiRequest(`/api/companies/${id}`, { method: "PUT", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.legacy });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/companies/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.legacy });
    }
  });

  return {
    erpCompanies,
    isLoadingERP,
    allCompanies,
    isLoading,
    error,
    createMutation,
    updateMutation,
    deleteMutation
  };
}
