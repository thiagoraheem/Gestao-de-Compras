import React from "react";
import { render, screen } from "@testing-library/react";
import RFQCreation from "../rfq-creation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

declare const jest: any;
declare const describe: any;
declare const test: any;
declare const expect: any;
declare const beforeEach: any;

// Mock das dependências
jest.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, name: "Test User" } }),
}));

jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock("@/hooks/useUnits", () => ({
  useUnits: () => ({ processERPUnit: (unit: string) => unit }),
}));

// Mock do QueryClient
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
      <RFQCreation {...props} />
    </QueryClientProvider>
  );
};

describe("RFQCreation - Badges de Item", () => {
  beforeEach(() => {
    queryClient.clear();
  });

  test("deve exibir os badges de Valor Custo e Part Number quando os dados estiverem presentes", async () => {
    // Preparar dados do mock para purchaseRequestItems
    const mockItems = [
      {
        id: 1,
        productCode: "E01214",
        description: "MARTELETE 5KG",
        unit: "UN",
        requestedQuantity: "1",
        price: "150.50",
        partNumber: "PN-12345",
      },
    ];

    queryClient.setQueryData(["/api/purchase-requests/1/items"], mockItems);
    queryClient.setQueryData(["/api/suppliers"], []);
    queryClient.setQueryData(["/api/delivery-locations"], []);

    renderComponent({
      isOpen: true,
      onOpenChange: jest.fn(),
      onComplete: jest.fn(),
      purchaseRequest: { id: 1 },
    });

    // Aguardar os itens carregarem e o render
    const priceBadge = await screen.findByText(/Valor Custo: R\$ 150,50/i);
    expect(priceBadge).toBeInTheDocument();

    const partNumberBadge = await screen.findByText(/Part Number: PN-12345/i);
    expect(partNumberBadge).toBeInTheDocument();
  });

  test("não deve exibir os badges quando os dados estiverem vazios ou ausentes", async () => {
    // Preparar dados do mock para purchaseRequestItems
    const mockItems = [
      {
        id: 1,
        productCode: "E01214",
        description: "MARTELETE 5KG",
        unit: "UN",
        requestedQuantity: "1",
        price: null,
        partNumber: "",
      },
    ];

    queryClient.setQueryData(["/api/purchase-requests/2/items"], mockItems);
    queryClient.setQueryData(["/api/suppliers"], []);
    queryClient.setQueryData(["/api/delivery-locations"], []);

    renderComponent({
      isOpen: true,
      onOpenChange: jest.fn(),
      onComplete: jest.fn(),
      purchaseRequest: { id: 2 },
    });

    // Aguardar renderização inicial
    await screen.findByText(/MARTELETE 5KG/i, { selector: 'input' });

    // Verificar que os badges não existem
    const priceBadge = screen.queryByText(/Valor Custo:/i);
    expect(priceBadge).not.toBeInTheDocument();

    const partNumberBadge = screen.queryByText(/Part Number:/i);
    expect(partNumberBadge).not.toBeInTheDocument();
  });
});
