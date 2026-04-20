import { Download } from "lucide-react";
import { Button } from "@/shared/ui/button";

import { usePurchaseRequestsReport } from "./usePurchaseRequestsReport";
import { useExportReport } from "./useExportReport";
import { ReportFilters } from "./ReportFilters";
import { ReportTable } from "./ReportTable";

export default function PurchaseRequestsReport() {
  const {
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
  } = usePurchaseRequestsReport();

  const { exportToCSV } = useExportReport();

  return (
    <div className="h-full overflow-y-auto">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Relatório de Solicitações de Compra
            </h1>
            <p className="text-muted-foreground mt-1">
              Visualize e analise todas as solicitações de compra do sistema
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => exportToCSV({ activeFilters, searchTerm })} variant="outline" size="sm" disabled={requests.length === 0}>
              <Download className="w-4 h-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </div>

        {/* Filters */}
        <ReportFilters 
          filters={filters}
          setFilters={setFilters}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          includeArchivedInSum={includeArchivedInSum}
          setIncludeArchivedInSum={setIncludeArchivedInSum}
          isSearchEnabled={isSearchEnabled}
          isLoading={isLoading}
          isRefetching={isRefetching}
          handleSearch={handleSearch}
          clearFilters={clearFilters}
          departments={departments}
          users={users}
          uniqueSuppliers={uniqueSuppliers}
        />

        {/* Results */}
        <ReportTable 
          isLoading={isLoading}
          isRefetching={isRefetching}
          activeFilters={activeFilters}
          totalItems={totalItems}
          requests={requests}
          visibleRequests={visibleRequests}
          expandedRows={expandedRows}
          toggleRowExpansion={toggleRowExpansion}
          totals={totals}
          pageTotals={pageTotals}
          page={page}
          totalPages={totalPages}
          setPage={setPage}
        />
      </div>
    </div>
  );
}
