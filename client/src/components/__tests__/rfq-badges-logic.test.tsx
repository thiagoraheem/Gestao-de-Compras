import { getBadges } from "../rfq-badges-logic";

declare const describe: any;
declare const test: any;
declare const expect: any;

describe("RFQ Badges Logic", () => {
  test("deve retornar array vazio se nenhum dado for passado", () => {
    const badges = getBadges(null, "", "");
    expect(badges.length).toBe(0);
  });

  test("deve exibir badge Original e Código se purchaseRequestItemCode for passado", () => {
    const badges = getBadges(null, "", "E0123");
    expect(badges.length).toBe(2);
    
    // Badge 0: Original
    expect(badges[0].props.children).toBe("Original");
    // Badge 1: Código
    expect(badges[1].props.children).toBe("E0123");
  });

  test("deve exibir badge Valor Custo quando price for válido", () => {
    const badges = getBadges({ price: 150.50 }, "", "");
    expect(badges.length).toBe(1);
    
    // Badge 0: Valor Custo
    // Verificamos o texto, o número formatado depende do Intl (pode conter espaços em diferentes ambientes), 
    // mas contém o número
    expect(badges[0].props.children.join("")).toContain("Valor Custo:");
    expect(badges[0].props.children.join("")).toContain("150,50");
  });

  test("não deve exibir badge Valor Custo quando price for null ou vazio", () => {
    let badges = getBadges({ price: null }, "", "");
    expect(badges.length).toBe(0);

    badges = getBadges({ price: "" }, "", "");
    expect(badges.length).toBe(0);
  });

  test("deve exibir badge Part Number quando partNumber for válido", () => {
    const badges = getBadges({ partNumber: "PN-12345" }, "", "");
    expect(badges.length).toBe(1);
    
    // Badge 0: Part Number
    expect(badges[0].props.children.join("")).toBe("Part Number: PN-12345");
  });

  test("não deve exibir badge Part Number quando partNumber for null ou vazio", () => {
    let badges = getBadges({ partNumber: null }, "", "");
    expect(badges.length).toBe(0);

    badges = getBadges({ partNumber: "   " }, "", "");
    expect(badges.length).toBe(0);
  });

  test("deve exibir todos os badges combinados", () => {
    const prItem = { price: 150.5, partNumber: "PN-99" };
    const badges = getBadges(prItem, "WATCH-CODE", "PR-CODE");
    
    expect(badges.length).toBe(4);
    expect(badges[0].props.children).toBe("Original");
    expect(badges[1].props.children).toBe("WATCH-CODE");
    expect(badges[2].props.children.join("")).toContain("Valor Custo:");
    expect(badges[3].props.children.join("")).toBe("Part Number: PN-99");
  });
});
