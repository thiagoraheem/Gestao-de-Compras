import React from "react";
import PurchaseRequestHeaderCard from "../purchase-request-header-card";
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
    // 2: Supplier
    // 3: Order Date
    // 4: Total Value
    // 5: Status
    // 6: Creation Date (New)

    const requesterSection = sections[1];
    const supplierSection = sections[2];
    const dateSection = sections[3];
    const totalSection = sections[4];
    const statusSection = sections[5];
    const creationDateSection = sections[6];

    // Check defaults
    expect(requesterSection.props.children[1].props.children).toBe("N/A");
    expect(supplierSection.props.children[1].props.children).toBe("Não definido");
    expect(dateSection.props.children[1].props.children).toBe("N/A");
    expect(totalSection.props.children[1].props.children).toBe("R$ 0,00");
    expect(statusSection.props.children[1].props.children).toBe("—");
    
    // Check new Creation Date field default
    expect(creationDateSection.props.children[0].props.children).toBe("Data de Criação");
    expect(creationDateSection.props.children[1].props.children).toBe("N/A");
  });

  test("renderiza data de criação corretamente quando fornecida", () => {
    const creationDate = "12/02/2026 14:30";
    const element: any = PurchaseRequestHeaderCard({
      creationDate: creationDate,
    } as any);

    const cardContent = element.props.children;
    const sections = Array.isArray(cardContent.props.children)
      ? cardContent.props.children
      : [cardContent.props.children];

    const creationDateSection = sections[6];

    expect(creationDateSection.props.children[0].props.children).toBe("Data de Criação");
    expect(creationDateSection.props.children[1].props.children).toBe(creationDate);
  });
});
