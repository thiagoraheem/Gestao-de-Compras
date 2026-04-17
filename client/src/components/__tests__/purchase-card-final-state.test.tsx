import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import PurchaseCard from "../purchase-card";
import { PURCHASE_PHASES } from "@/lib/types";

jest.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, isAdmin: true, isManager: true } }),
}));

jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock("@/hooks/useApprovalType", () => ({
  useApprovalType: () => ({ data: "single", approvalInfo: null, configuration: null, loading: false, error: null, refetch: async () => {} }),
}));

jest.mock("@/components/ui/dialog", () => {
  const React = require("react");
  const Wrap = ({ children }: any) => React.createElement("div", null, children);
  return { Dialog: Wrap, DialogContent: Wrap, DialogTitle: Wrap, DialogClose: Wrap };
});

jest.mock("@/components/ui/alert-dialog", () => {
  const React = require("react");
  const Wrap = ({ children }: any) => React.createElement("div", null, children);
  return {
    AlertDialog: Wrap,
    AlertDialogContent: Wrap,
    AlertDialogHeader: Wrap,
    AlertDialogTitle: Wrap,
    AlertDialogDescription: Wrap,
    AlertDialogFooter: Wrap,
    AlertDialogCancel: Wrap,
    AlertDialogAction: Wrap,
  };
});

jest.mock("@/components/ui/tooltip", () => {
  const React = require("react");
  const Wrap = ({ children }: any) => React.createElement("div", null, children);
  return { Tooltip: Wrap, TooltipContent: Wrap, TooltipProvider: Wrap, TooltipTrigger: Wrap };
});

jest.mock("@/components/ui/context-menu", () => {
  const React = require("react");
  const Wrap = ({ children }: any) => React.createElement("div", null, children);
  return { ContextMenu: Wrap, ContextMenuContent: Wrap, ContextMenuItem: Wrap, ContextMenuTrigger: Wrap };
});

jest.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
}));

function createQueryClient() {
  let client!: QueryClient;
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setDefaultOptions({
    queries: {
      retry: false,
      queryFn: async ({ queryKey }: any) => {
        const cached = client.getQueryData(queryKey);
        if (cached !== undefined) return cached;
        return null;
      },
    },
  });
  return client;
}

describe("PurchaseCard final-state styling", () => {
  test("applies final-state styles for Pedido concluído", () => {
    const qc = createQueryClient();

    const { container } = render(
      <QueryClientProvider client={qc}>
        <PurchaseCard
          request={{
            id: 1,
            requestNumber: "SOL-1",
            totalValue: "100.00",
            justification: "Teste",
            urgency: "alto",
            category: "produto",
            requester: { firstName: "A", lastName: "B" },
          }}
          phase={PURCHASE_PHASES.PEDIDO_CONCLUIDO}
        />
      </QueryClientProvider>,
    );

    const el = container.querySelector('[data-request-id="1"]') as HTMLElement;
    expect(el.className).toContain("card-final-state");
  });

  test("applies orange highlight when isSearchHighlighted is true", () => {
    const qc = createQueryClient();

    const { container } = render(
      <QueryClientProvider client={qc}>
        <PurchaseCard
          request={{
            id: 1,
            requestNumber: "SOL-1",
            totalValue: "100.00",
            justification: "Teste",
            urgency: "alto",
            category: "produto",
            requester: { firstName: "A", lastName: "B" },
          }}
          phase={PURCHASE_PHASES.SOLICITACAO}
          isSearchHighlighted={true}
        />
      </QueryClientProvider>,
    );

    const el = container.querySelector('[data-request-id="1"]') as HTMLElement;
    expect(el.className).toContain("ring-orange-500");
  });
});
