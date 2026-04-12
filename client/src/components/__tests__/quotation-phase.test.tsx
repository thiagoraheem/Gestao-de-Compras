import React from "react";
import { render, screen } from "@testing-library/react";
import QuotationPhase from "../quotation-phase";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

declare const jest: any;
declare const describe: any;
declare const test: any;
declare const expect: any;
declare const beforeEach: any;

jest.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, name: "Test User", isBuyer: true } }),
}));

jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock("wouter", () => ({
  useLocation: () => ["/", jest.fn()],
}));

jest.mock("@/components/ui/dialog", () => {
  const React = require("react");
  const Wrap = ({ children }: any) => React.createElement("div", null, children);
  return {
    Dialog: Wrap,
    DialogContent: Wrap,
    DialogHeader: Wrap,
    DialogTitle: Wrap,
    DialogDescription: Wrap,
    DialogTrigger: Wrap,
    DialogFooter: Wrap,
    DialogClose: Wrap,
  };
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const renderComponent = (props: any) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <QuotationPhase {...props} />
    </QueryClientProvider>
  );
};

describe("QuotationPhase - Badges de Item", () => {
  beforeEach(() => {
    queryClient.clear();
  });

  test("deve exibir os badges de Valor Custo e Part Number quando os dados estiverem presentes", async () => {
    const mockQuotation = { id: 1, quotationNumber: "COT-123", status: "sent", quotationDeadline: "2026-02-01T00:00:00.000Z" };
    const mockItems = [
      {
        id: 1,
        itemCode: "E01214",
        description: "MARTELETE 5KG",
        quantity: "1",
        unit: "UN",
        purchaseRequestItem: {
          price: "150.50",
          partNumber: "PN-12345",
        }
      },
    ];

    queryClient.setQueryData(["/api/quotations/purchase-request/1"], mockQuotation);
    queryClient.setQueryData(["/api/quotations/1/items"], mockItems);
    queryClient.setQueryData(["/api/quotations/1/supplier-quotations"], []);

    renderComponent({
      request: { id: 1, requestNumber: "REQ-001", createdAt: "2026-01-01T00:00:00.000Z" },
      open: true,
      onOpenChange: jest.fn(),
    });

    const priceBadge = await screen.findByText(/Valor Custo: R\$ 150,50/i);
    expect(priceBadge).toBeInTheDocument();

    const partNumberBadge = await screen.findByText(/Part Number: PN-12345/i);
    expect(partNumberBadge).toBeInTheDocument();
  });

  test("não deve exibir os badges quando os dados estiverem ausentes", async () => {
    const mockQuotation = { id: 1, quotationNumber: "COT-123", status: "sent", quotationDeadline: "2026-02-01T00:00:00.000Z" };
    const mockItems = [
      {
        id: 1,
        itemCode: "E01214",
        description: "MARTELETE 5KG",
        quantity: "1",
        unit: "UN",
        purchaseRequestItem: {
          price: null,
          partNumber: "",
        }
      },
    ];

    queryClient.setQueryData(["/api/quotations/purchase-request/1"], mockQuotation);
    queryClient.setQueryData(["/api/quotations/1/items"], mockItems);
    queryClient.setQueryData(["/api/quotations/1/supplier-quotations"], []);

    renderComponent({
      request: { id: 1, requestNumber: "REQ-001", createdAt: "2026-01-01T00:00:00.000Z" },
      open: true,
      onOpenChange: jest.fn(),
    });

    // Aguardar o carregamento da lista verificando a descrição
    await screen.findByText(/MARTELETE 5KG/i);

    const priceBadge = screen.queryByText(/Valor Custo:/i);
    expect(priceBadge).not.toBeInTheDocument();

    const partNumberBadge = screen.queryByText(/Part Number:/i);
    expect(partNumberBadge).not.toBeInTheDocument();
  });
});
