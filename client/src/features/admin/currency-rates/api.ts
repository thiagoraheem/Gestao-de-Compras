import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type {
  CurrencyRate,
  CurrencyRateFilters,
  CreateCurrencyRatePayload,
  UpdateCurrencyRatePayload,
} from "./types";
import type { CurrencyCode } from "../../../../../shared/utils/currency-utils";

const BASE_ENDPOINT = "/api/currency-rates";

export function useCurrencyRates(filters: CurrencyRateFilters = {}) {
  const queryKey = [BASE_ENDPOINT, filters];

  const buildUrl = () => {
    const params = new URLSearchParams();
    if (filters.currencyCode) params.append("currencyCode", filters.currencyCode);
    if (filters.fromDate) params.append("fromDate", filters.fromDate);
    if (filters.toDate) params.append("toDate", filters.toDate);
    const qs = params.toString();
    return qs ? `${BASE_ENDPOINT}?${qs}` : BASE_ENDPOINT;
  };

  return useQuery<CurrencyRate[]>({
    queryKey,
    queryFn: () => apiRequest(buildUrl()),
  });
}

export function useLatestRate(code?: CurrencyCode) {
  return useQuery<CurrencyRate | null>({
    queryKey: [`${BASE_ENDPOINT}/latest`, code],
    queryFn: () => apiRequest(`${BASE_ENDPOINT}/latest?code=${code}`),
    enabled: !!code,
  });
}

export function useTodayRate(code?: CurrencyCode) {
  return useQuery<CurrencyRate | null>({
    queryKey: [`${BASE_ENDPOINT}/today`, code],
    queryFn: () => apiRequest(`${BASE_ENDPOINT}/today?code=${code}`),
    enabled: !!code,
  });
}

export function useCreateCurrencyRate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation<CurrencyRate, Error, CreateCurrencyRatePayload, { previous?: CurrencyRate[] }>({
    mutationFn: async (payload) => {
      return apiRequest(BASE_ENDPOINT, { method: "POST", body: payload });
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: [BASE_ENDPOINT] });
      const previous = queryClient.getQueryData<CurrencyRate[]>([BASE_ENDPOINT, {}]);

      const optimisticRate: CurrencyRate = {
        id: Date.now(),
        currencyCode: payload.currencyCode,
        rateDate: payload.rateDate,
        rateValue: payload.rateValue,
        observations: payload.observations ?? null,
        createdBy: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdByUser: null,
      };

      if (previous) {
        queryClient.setQueryData<CurrencyRate[]>([BASE_ENDPOINT, {}], [optimisticRate, ...previous]);
      }

      return { previous };
    },
    onError: (err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData([BASE_ENDPOINT, {}], context.previous);
      }
      toast({
        title: "Erro",
        description: err.message || "Falha ao criar cotação de moeda.",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BASE_ENDPOINT] });
      queryClient.refetchQueries({ queryKey: [BASE_ENDPOINT] });
      toast({
        title: "Sucesso",
        description: "Cotação de moeda criada com sucesso.",
      });
    },
  });
}

export function useUpdateCurrencyRate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation<
    CurrencyRate,
    Error,
    { id: number; payload: UpdateCurrencyRatePayload },
    { previous?: CurrencyRate[] }
  >({
    mutationFn: async ({ id, payload }) => {
      return apiRequest(`${BASE_ENDPOINT}/${id}`, { method: "PUT", body: payload });
    },
    onMutate: async ({ id, payload }) => {
      await queryClient.cancelQueries({ queryKey: [BASE_ENDPOINT] });
      const previous = queryClient.getQueryData<CurrencyRate[]>([BASE_ENDPOINT, {}]);

      if (previous) {
        queryClient.setQueryData<CurrencyRate[]>(
          [BASE_ENDPOINT, {}],
          previous.map((rate) =>
            rate.id === id ? { ...rate, ...payload, updatedAt: new Date().toISOString() } : rate
          )
        );
      }

      return { previous };
    },
    onError: (err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData([BASE_ENDPOINT, {}], context.previous);
      }
      toast({
        title: "Erro",
        description: err.message || "Falha ao atualizar cotação de moeda.",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BASE_ENDPOINT] });
      queryClient.refetchQueries({ queryKey: [BASE_ENDPOINT] });
      toast({
        title: "Sucesso",
        description: "Cotação de moeda atualizada com sucesso.",
      });
    },
  });
}

export function useDeleteCurrencyRate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation<void, Error, number, { previous?: CurrencyRate[] }>({
    mutationFn: async (id) => {
      return apiRequest(`${BASE_ENDPOINT}/${id}`, { method: "DELETE" });
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: [BASE_ENDPOINT] });
      const previous = queryClient.getQueryData<CurrencyRate[]>([BASE_ENDPOINT, {}]);

      if (previous) {
        queryClient.setQueryData<CurrencyRate[]>(
          [BASE_ENDPOINT, {}],
          previous.filter((rate) => rate.id !== id)
        );
      }

      return { previous };
    },
    onError: (err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData([BASE_ENDPOINT, {}], context.previous);
      }
      toast({
        title: "Erro",
        description: err.message || "Falha ao excluir cotação de moeda.",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BASE_ENDPOINT] });
      queryClient.refetchQueries({ queryKey: [BASE_ENDPOINT] });
      toast({
        title: "Sucesso",
        description: "Cotação de moeda excluída com sucesso.",
      });
    },
  });
}
