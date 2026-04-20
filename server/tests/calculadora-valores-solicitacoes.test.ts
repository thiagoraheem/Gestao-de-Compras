import { CalculadoraValoresSolicitacao, ItemCalculo } from "../../shared/utils/CalculadoraValoresSolicitacao";

describe("CalculadoraValoresSolicitacao", () => {
  it("deve calcular corretamente sem descontos", () => {
    const itens: ItemCalculo[] = [
      { valorOriginal: 100, descontoItem: 0 },
      { valorOriginal: 50, descontoItem: 0 }
    ];

    const result = CalculadoraValoresSolicitacao.calcularTotais(itens);

    expect(result.valorItens).toBe(150);
    expect(result.desconto).toBe(0);
    expect(result.subTotal).toBe(150);
    expect(result.descontoProposta).toBe(0);
    expect(result.valorFinal).toBe(150);
  });

  it("deve calcular corretamente com descontos nos itens sem desconto global", () => {
    const itens: ItemCalculo[] = [
      { valorOriginal: 100, descontoItem: 20 },
      { valorOriginal: 50, descontoItem: 10 }
    ];

    const result = CalculadoraValoresSolicitacao.calcularTotais(itens);

    expect(result.valorItens).toBe(150);
    expect(result.desconto).toBe(30);
    expect(result.subTotal).toBe(120);
    expect(result.descontoProposta).toBe(0);
    expect(result.valorFinal).toBe(120);
  });

  it("deve calcular corretamente com desconto global em porcentagem", () => {
    const itens: ItemCalculo[] = [
      { valorOriginal: 200, descontoItem: 0 },
    ];

    const result = CalculadoraValoresSolicitacao.calcularTotais(itens, { tipo: "percentage", valor: 10 });

    expect(result.valorItens).toBe(200);
    expect(result.desconto).toBe(0);
    expect(result.subTotal).toBe(200);
    expect(result.descontoProposta).toBe(20);
    expect(result.valorFinal).toBe(180);
  });

  it("deve calcular corretamente com desconto global em valor fixo", () => {
    const itens: ItemCalculo[] = [
      { valorOriginal: 200, descontoItem: 50 },
    ];

    const result = CalculadoraValoresSolicitacao.calcularTotais(itens, { tipo: "fixed", valor: 30 });

    expect(result.valorItens).toBe(200);
    expect(result.desconto).toBe(50);
    expect(result.subTotal).toBe(150);
    expect(result.descontoProposta).toBe(30);
    expect(result.valorFinal).toBe(120);
  });

  it("não deve permitir descontos negativos ou valores originais negativos", () => {
    const itens: ItemCalculo[] = [
      { valorOriginal: -100, descontoItem: -20 },
      { valorOriginal: 100, descontoItem: -10 }
    ];

    const result = CalculadoraValoresSolicitacao.calcularTotais(itens, { tipo: "fixed", valor: -50 });

    // O item negativo virou 0, então valor original é 0 + 100 = 100.
    // Desconto negativo vira 0, então desconto = 0 + 0 = 0.
    // Subtotal = 100
    // Desconto global nagativo tratado como 0 (mas dependendo da implementação Math.max segura)
    expect(result.valorItens).toBe(100);
    expect(result.desconto).toBe(0);
    expect(result.subTotal).toBe(100);
    expect(result.descontoProposta).toBe(0); // Tratado o número negativo
    expect(result.valorFinal).toBe(100);
  });

  it("não deve permitir que o desconto de um item seja maior que seu valor original", () => {
    const itens: ItemCalculo[] = [
      { valorOriginal: 50, descontoItem: 100 },
    ];

    const result = CalculadoraValoresSolicitacao.calcularTotais(itens);

    expect(result.valorItens).toBe(50);
    expect(result.desconto).toBe(50); // Desconto capado no valorOriginal
    expect(result.subTotal).toBe(0);
    expect(result.valorFinal).toBe(0);
  });

  it("não deve permitir que o desconto global (proposta) seja maior que o subtotal", () => {
    const itens: ItemCalculo[] = [
      { valorOriginal: 100, descontoItem: 20 },
    ];

    const result = CalculadoraValoresSolicitacao.calcularTotais(itens, { tipo: "fixed", valor: 200 });

    expect(result.valorItens).toBe(100);
    expect(result.desconto).toBe(20);
    expect(result.subTotal).toBe(80);
    expect(result.descontoProposta).toBe(80); // Capado a 80
    expect(result.valorFinal).toBe(0);
  });
});
