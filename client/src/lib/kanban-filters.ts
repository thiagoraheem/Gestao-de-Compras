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

function matchesPurchaseOrderFilter(input: {
  requestNumber?: string | null;
  purchaseOrderNumber?: string | null;
  receiptNumber?: string | null;
}, rawFilter: string) {
  const filter = rawFilter.toLowerCase().trim();
  if (!filter) return true;

  const requestNumber = input.requestNumber?.toLowerCase() || "";
  const purchaseOrderNumber = input.purchaseOrderNumber?.toLowerCase() || "";
  const receiptNumber = input.receiptNumber?.toLowerCase() || "";

  const hasTextMatch =
    requestNumber.includes(filter) ||
    purchaseOrderNumber.includes(filter) ||
    receiptNumber.includes(filter);

  const numbers = filter.replace(/[^\d]/g, "");
  const hasLetters = /[a-z]/i.test(filter);
  const hasNumberMatch =
    Boolean(numbers) &&
    !hasLetters &&
    (
      requestNumber.replace(/[^\d]/g, "").includes(numbers) ||
      purchaseOrderNumber.replace(/[^\d]/g, "").includes(numbers) ||
      receiptNumber.replace(/[^\d]/g, "").includes(numbers)
    );

  return hasTextMatch || hasNumberMatch;
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
      passesFilters =
        passesFilters &&
        matchesPurchaseOrderFilter(
          {
            requestNumber: request.requestNumber,
            purchaseOrderNumber: request.purchaseOrder?.orderNumber,
          },
          filters.purchaseOrder,
        );
    }

    return passesFilters;
  });
}

export function filterReceipts(receipts: any[], filters: KanbanFilters): any[] {
  if (!Array.isArray(receipts)) return [];

  return receipts.filter((receipt: any) => {
    let passesFilters = true;

    if (filters.supplier !== "all") {
      passesFilters = passesFilters && receipt.supplier?.id?.toString() === filters.supplier;
    }

    if (filters.urgency !== "all") {
      passesFilters = passesFilters && receipt.request?.urgency === filters.urgency;
    }

    if (filters.purchaseOrder && filters.purchaseOrder.trim()) {
      passesFilters =
        passesFilters &&
        matchesPurchaseOrderFilter(
          {
            requestNumber: receipt.request?.requestNumber,
            purchaseOrderNumber: receipt.purchaseOrderNumber,
            receiptNumber: receipt.receiptNumber,
          },
          filters.purchaseOrder,
        );
    }

    return passesFilters;
  });
}
