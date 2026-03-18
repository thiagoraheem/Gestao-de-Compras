import { PURCHASE_PHASES } from "./types";

export interface KanbanFilters {
  department: string;
  urgency: string;
  requester: string;
  supplier: string;
  date?: {
    startDate: string;
    endDate: string;
  };
  purchaseOrder?: string;
}

export function filterRequests(requests: any[], filters: KanbanFilters): any[] {
  if (!Array.isArray(requests)) return [];

  return requests.filter((request: any) => {
    let passesFilters = true;

    // Department filter - use nested department object
    if (filters.department !== "all") {
      passesFilters =
        passesFilters &&
        request.department?.id?.toString() === filters.department;
    }

    // Urgency filter - exact match
    if (filters.urgency !== "all") {
      passesFilters = passesFilters && request.urgency === filters.urgency;
    }

    // Requester filter - filter by requester user
    if (filters.requester !== "all") {
      passesFilters =
        passesFilters &&
        request.requester?.id?.toString() === filters.requester;
    }

    // Supplier filter - filter by chosen supplier
    if (filters.supplier !== "all") {
      passesFilters =
        passesFilters &&
        request.chosenSupplier?.id?.toString() === filters.supplier;
    }

    // Date filter - apply to conclusion and archived items
    if (
      filters.date &&
      (request.currentPhase === PURCHASE_PHASES.ARQUIVADO ||
        request.currentPhase === PURCHASE_PHASES.CONCLUSAO_COMPRA)
    ) {
      const requestDate = new Date(request.updatedAt || request.createdAt);
      const startDate = new Date(filters.date.startDate);
      const endDate = new Date(filters.date.endDate);
      endDate.setHours(23, 59, 59, 999); // Include the full end date

      passesFilters =
        passesFilters && requestDate >= startDate && requestDate <= endDate;
    }

    // Purchase Order Number filter
    if (filters.purchaseOrder && filters.purchaseOrder.trim()) {
      const filter = filters.purchaseOrder.toLowerCase().trim();
      
      const hasPurchaseOrderMatch = request.purchaseOrder?.orderNumber?.toLowerCase().includes(filter);
      const hasRequestNumberMatch = request.requestNumber?.toLowerCase().includes(filter);

      passesFilters = passesFilters && (hasPurchaseOrderMatch || hasRequestNumberMatch);
    }

    return passesFilters;
  });
}
