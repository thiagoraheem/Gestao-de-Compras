import PurchaseRequestHeaderCard from "../purchase-request-header-card";

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

    const requesterSection = sections[1];
    const supplierSection = sections[2];
    const dateSection = sections[3];
    const totalSection = sections[4];
    const statusSection = sections[5];

    const getText = (section: any) => {
      const paragraphs = Array.isArray(section.props.children)
        ? section.props.children
        : [section.props.children];
      const valueParagraph = paragraphs[1];
      return Array.isArray(valueParagraph.props.children)
        ? valueParagraph.props.children.join("")
        : valueParagraph.props.children;
    };

    expect(getText(requesterSection)).toBe("N/A");
    expect(getText(supplierSection)).toBe("Não definido");
    expect(getText(dateSection)).toBe("N/A");
    expect(getText(totalSection)).toBe("R$ 0,00");
    expect(getText(statusSection)).toBe("—");
  });
});
