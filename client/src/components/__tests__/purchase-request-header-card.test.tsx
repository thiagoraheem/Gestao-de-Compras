import React from "react";
import PurchaseRequestHeaderCard from "@/features/requests/components/purchase-request-header-card";
import { render, screen } from "@testing-library/react";

// Mocking dependencies if necessary
// Assuming we are using a setup where we can render components or at least inspect their output
// The existing test file seems to use a custom or manual inspection approach: 
// "const element: any = PurchaseRequestHeaderCard(...)"
// This suggests it's testing the function directly, not using React Testing Library's render.
// I will adapt to the existing style found in the file.

declare const describe: any;
declare const test: any;
declare const expect: any;

describe("PurchaseRequestHeaderCard", () => {
  test("aplica classes de tema diferentes para contextos físico e fiscal", () => {
    const physicalElement: any = PurchaseRequestHeaderCard({
      context: "physical",
    } as any);

    const fiscalElement: any = PurchaseRequestHeaderCard({
      context: "fiscal",
    } as any);

    expect(physicalElement.props.className).toContain("border-slate-200");
    expect(fiscalElement.props.className).toContain("border-indigo-200");
  });

  test("usa valores padrão quando dados não são fornecidos", () => {
    const element: any = PurchaseRequestHeaderCard({} as any);

    const cardContent = element.props.children;
    const sections = Array.isArray(cardContent.props.children)
      ? cardContent.props.children
      : [cardContent.props.children];

    // Assuming sections order based on component definition:
    // 0: Request/Order Number
    // 1: Requester
    // 2: Justification
    // 3: Supplier
    // 4: Order Date
    // 5: Total Value
    // 6: Status
    // 7: Creation Date

    const requesterSection = sections[1];
    const justificationSection = sections[2];
    const supplierSection = sections[3];
    const dateSection = sections[4];
    const totalSection = sections[5];
    const statusSection = sections[6];
    const creationDateSection = sections[7];

    // Check defaults
    expect(requesterSection.props.children[1].props.children).toBe("N/A");
    expect(justificationSection.props.children[0].props.children).toBe("Justificativa");
    expect(justificationSection.props.children[1].props.children).toBe("N/A");
    expect(supplierSection.props.children[1].props.children).toBe("Não definido");
    expect(dateSection.props.children[1].props.children).toBe("N/A");
    expect(totalSection.props.children[1].props.children).toBe("R$ 0,00");
    expect(statusSection.props.children[1].props.children).toBe("—");
    
    // Check new Creation Date field default
    expect(creationDateSection.props.children[0].props.children).toBe("Data de Criação");
    expect(creationDateSection.props.children[1].props.children).toBe("N/A");
  });

  test("renderiza data de criação e justificativa corretamente quando fornecidas", () => {
    const creationDate = "12/02/2026 14:30";
    const justification = "Manutenção preventiva";
    const element: any = PurchaseRequestHeaderCard({
      creationDate: creationDate,
      justification: justification,
    } as any);

    const cardContent = element.props.children;
    const sections = Array.isArray(cardContent.props.children)
      ? cardContent.props.children
      : [cardContent.props.children];

    const justificationSection = sections[2];
    const creationDateSection = sections[7];

    expect(justificationSection.props.children[0].props.children).toBe("Justificativa");
    expect(justificationSection.props.children[1].props.children).toBe(justification);
    expect(creationDateSection.props.children[0].props.children).toBe("Data de Criação");
    expect(creationDateSection.props.children[1].props.children).toBe(creationDate);
  });
});
