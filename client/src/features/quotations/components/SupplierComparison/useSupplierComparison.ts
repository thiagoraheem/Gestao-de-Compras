import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SupplierQuotationData } from "./types";

interface UseSupplierComparisonProps {
  quotationId: number;
  onComplete?: () => void;
  createNewRequestForUnavailable: boolean;
  hasUnavailableItems: boolean;
}

export function useSupplierComparison({
  quotationId,
  onComplete,
  createNewRequestForUnavailable,
  hasUnavailableItems
}: UseSupplierComparisonProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: suppliersData = [], isLoading } = useQuery<SupplierQuotationData[]>({
    queryKey: [`/api/quotations/${quotationId}/supplier-comparison`],
  });

  const { data: quotationItems = [] } = useQuery<any[]>({
    queryKey: [`/api/quotations/${quotationId}/items`],
    enabled: !!quotationId,
  });

  const selectSupplierMutation = useMutation({
    mutationFn: async (data: {
      selectedSupplierId: number;
      totalValue: number;
      observations: string;
      createNewRequest?: boolean;
      unavailableItems?: any[];
      unavailableItemsOption?: string;
      selectedItems?: any[];
      nonSelectedItemsOption?: string;
      nonSelectedItems?: any[];
    }) => {
      return apiRequest(`/api/quotations/${quotationId}/select-supplier`, { method: "POST", body: data });
    },
    onSuccess: (response: any) => {
      let description = "O fornecedor foi selecionado com sucesso e a solicitação avançou para Aprovação A2.";

      if (createNewRequestForUnavailable && hasUnavailableItems) {
        description += " Uma nova solicitação foi criada automaticamente para os itens indisponíveis.";
      }

      if (response.nonSelectedRequestId && response.nonSelectedItemsCount > 0) {
        description += ` Uma nova solicitação foi criada com os ${response.nonSelectedItemsCount} itens não selecionados na fase de Cotação.`;
      }

      toast({
        title: "Fornecedor selecionado",
        description,
      });

      // Invalidate all related queries to ensure UI updates immediately
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      queryClient.invalidateQueries({ queryKey: [`/api/quotations/${quotationId}/supplier-comparison`] });
      queryClient.invalidateQueries({ queryKey: [`/api/quotations/${quotationId}/supplier-quotations`] });
      queryClient.invalidateQueries({
        predicate: (query) =>
          !!(query.queryKey[0] && typeof query.queryKey[0] === 'string' &&
            (query.queryKey[0].includes('quotations') || query.queryKey[0].includes('purchase-requests')))
      });

      if (onComplete) {
        onComplete();
      }
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível selecionar o fornecedor.",
        variant: "destructive",
      });
    },
  });

  return {
    suppliersData,
    quotationItems,
    isLoading,
    selectSupplierMutation,
  };
}
