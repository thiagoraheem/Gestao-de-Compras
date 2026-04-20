import { useToast } from "@/hooks/use-toast";
import type { ReportFilters } from "./usePurchaseRequestsReport";

interface ExportReportParams {
  activeFilters: ReportFilters | null;
  searchTerm: string;
}

export function useExportReport() {
  const { toast } = useToast();

  const exportToCSV = async ({ activeFilters, searchTerm }: ExportReportParams) => {
    if (!activeFilters) {
      toast({
        title: "Erro",
        description: "Não é possível exportar sem filtros ativos.",
        variant: "destructive",
      });
      return;
    }

    try {
      const params = new URLSearchParams();
      Object.entries(activeFilters).forEach(([key, value]) => {
        if (value && value !== "all") params.append(key, value);
      });
      if (searchTerm) params.append("search", searchTerm);

      const url = `/api/reports/purchase-requests/export?${params.toString()}`;
      
      // Criar window.open ou <a> para baixar o arquivo como attachment
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", ""); // O backend define o filename no cabeçalho
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Exportação Iniciada",
        description: "O download do CSV começará em instantes.",
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Erro na Exportação",
        description: "Não foi possível gerar o arquivo CSV.",
        variant: "destructive",
      });
    }
  };

  return { exportToCSV };
}
