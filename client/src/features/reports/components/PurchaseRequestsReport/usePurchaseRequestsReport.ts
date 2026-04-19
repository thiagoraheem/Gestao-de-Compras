import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PurchaseRequest, Department, User } from "./types";

export interface ReportFilters {
  startDate: string;
  endDate: string;
  departmentId: string;
  requesterId: string;
  supplierId: string;
  phase: string;
  urgency: string;
  itemDescription: string;
}

export const initialFilters: ReportFilters = {
  startDate: "",
  endDate: "",
  departmentId: "all",
  requesterId: "all",
  supplierId: "all",
  phase: "all",
  urgency: "all",
  itemDescription: "",
};

export function usePurchaseRequestsReport() {
  const { toast } = useToast();
  
  const [filters, setFilters] = useState<ReportFilters>(initialFilters);
  const [activeFilters, setActiveFilters] = useState<ReportFilters | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [includeArchivedInSum, setIncludeArchivedInSum] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");

  const isSearchEnabled = useMemo(() => {
    const hasDate = !!filters.startDate || !!filters.endDate;
    const hasDepartment = filters.departmentId !== "all";
    const hasRequester = filters.requesterId !== "all";
    const hasSupplier = filters.supplierId !== "all";
    const hasPhase = filters.phase !== "all";
    const hasUrgency = filters.urgency !== "all";
    const hasItem = !!filters.itemDescription;
    const hasSearch = !!searchTerm;

    return hasDate || hasDepartment || hasRequester || hasSupplier || hasPhase || hasUrgency || hasItem || hasSearch;
  }, [filters, searchTerm]);

  const {
    data,
    isLoading: isDataLoading,
    isError: isDataError,
    error: dataError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["purchase-requests-report", activeFilters, page, searchTerm],
    queryFn: async () => {
      if (!activeFilters) return { data: [], total: 0 };
      
      const params = new URLSearchParams();
      Object.entries(activeFilters).forEach(([key, value]) => {
        if (value && value !== "all") params.append(key, value);
      });
      if (searchTerm) params.append("search", searchTerm);
      
      params.append("page", page.toString());
      params.append("limit", pageSize.toString());

      return apiRequest(`/api/reports/purchase-requests?${params.toString()}`);
    },
    enabled: !!activeFilters,
    staleTime: 30000, 
    gcTime: 300000,
  });

  const {
    data: summaryData,
    isLoading: isSummaryLoading,
    isError: isSummaryError,
  } = useQuery({
    queryKey: ["purchase-requests-report-summary", activeFilters, searchTerm],
    queryFn: async () => {
      if (!activeFilters) return null;
      
      const params = new URLSearchParams();
      Object.entries(activeFilters).forEach(([key, value]) => {
        if (value && value !== "all") params.append(key, value);
      });
      if (searchTerm) params.append("search", searchTerm);
      
      params.append("resumo", "true");

      const response = await apiRequest(`/api/reports/purchase-requests?${params.toString()}`);
      return response.summary;
    },
    enabled: !!activeFilters,
    staleTime: 30000, 
    gcTime: 300000,
  });

  const isLoading = isDataLoading || isSummaryLoading;
  const isError = isDataError || isSummaryError;
  const error = dataError;

  useEffect(() => {
    if (!isError) return;
    const message = (error as any)?.message || "Falha ao buscar o relatório. Tente novamente.";
    toast({
      title: "Erro",
      description: message,
      variant: "destructive",
    });
  }, [error, isError, toast]);

  const requests = data?.data || [];
  const totalItems = data?.total || 0;
  const totalPages = Math.ceil(totalItems / pageSize);

  const handleSearch = () => {
    if (!isSearchEnabled) return;
    setPage(1);
    setActiveFilters(filters);
  };

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ["departments"],
    queryFn: () => apiRequest("/api/departments"),
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: () => apiRequest("/api/users"),
  });

  const uniqueSuppliers = useMemo(() => {
    const suppliers = new Set<string>();
    requests.forEach((request: PurchaseRequest) => {
      if (request.supplierName && request.supplierName !== "N/A") {
        suppliers.add(request.supplierName);
      }
    });
    return Array.from(suppliers).sort();
  }, [requests]);

  const visibleRequests = useMemo(() => {
    if (includeArchivedInSum) return requests as PurchaseRequest[];
    return (requests as PurchaseRequest[]).filter((r) => r.phase !== "arquivado");
  }, [requests, includeArchivedInSum]);

  const pageTotals = useMemo(() => {
    return visibleRequests.reduce(
      (acc: any, request: PurchaseRequest) => {
        acc.totalValorItens += Number(request.valorItens) || 0;
        acc.totalDesconto += Number(request.desconto) || 0;
        acc.totalSubTotal += Number(request.subTotal) || 0;
        acc.totalDescontoProposta += Number(request.descontoProposta) || 0;
        acc.totalValorFinal += Number(request.valorFinal) || 0;
        return acc;
      },
      { 
         totalValorItens: 0, 
         totalDesconto: 0, 
         totalSubTotal: 0, 
         totalDescontoProposta: 0, 
         totalValorFinal: 0 
      }
    );
  }, [visibleRequests]);

  const totals = useMemo(() => {
    // We now just map to the real backend values or fallback exactly if it isn't ready
    if (summaryData) {
       return summaryData;
    }
    return pageTotals;
  }, [summaryData, pageTotals]);

  const toggleRowExpansion = (requestId: number) => {
    setExpandedRows(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(requestId)) {
        newExpanded.delete(requestId);
      } else {
        newExpanded.add(requestId);
      }
      return newExpanded;
    });
  };

  const clearFilters = () => {
    setFilters(initialFilters);
    setSearchTerm("");
  };

  return {
    filters,
    setFilters,
    activeFilters,
    page,
    setPage,
    pageSize,
    includeArchivedInSum,
    setIncludeArchivedInSum,
    expandedRows,
    toggleRowExpansion,
    searchTerm,
    setSearchTerm,
    isSearchEnabled,
    isLoading,
    isRefetching,
    requests,
    visibleRequests,
    totalItems,
    totalPages,
    totals,
    pageTotals,
    handleSearch,
    clearFilters,
    departments,
    users,
    uniqueSuppliers
  };
}
