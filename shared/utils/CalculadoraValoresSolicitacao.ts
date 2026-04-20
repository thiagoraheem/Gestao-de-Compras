export interface ItemCalculo {
  valorOriginal: number;
  descontoItem: number;
}

export interface PropostaDesconto {
  tipo?: "percentage" | "fixed" | "none" | null;
  valor?: number | null;
}

export interface ResultadoCalculoSolicitacao {
  valorItens: number;
  desconto: number;
  subTotal: number;
  descontoProposta: number;
  valorFinal: number;
}

export class CalculadoraValoresSolicitacao {
  /**
   * Calcula os totais de uma solicitação de compra seguindo as regras contábeis do negócio.
   * Respeita a ordem de abatimento: primeiro descontos dos itens -> então desconto global.
   */
  static calcularTotais(
    itens: ItemCalculo[],
    descontoGlobal: PropostaDesconto = {}
  ): ResultadoCalculoSolicitacao {
    // Valor Itens = Σ(valor original de cada item)
    const valorItens = itens.reduce((acc, item) => {
      const val = isNaN(item.valorOriginal) ? 0 : item.valorOriginal;
      return acc + Math.max(0, val);
    }, 0);

    // Desconto = Σ(desconto de cada item)
    const descontoItens = itens.reduce((acc, item) => {
      const desc = isNaN(item.descontoItem) ? 0 : item.descontoItem;
      // Impede descontos negativos e limita ao valor do item
      return acc + Math.min(Math.max(0, desc), Math.max(0, item.valorOriginal));
    }, 0);

    // SubTotal = Valor Itens - Desconto
    const subTotal = Math.max(0, valorItens - descontoItens);

    // Desconto Proposta = desconto global informado
    let descontoProposta = 0;
    const descValor = isNaN(descontoGlobal.valor || 0) ? 0 : Number(descontoGlobal.valor);

    if (descontoGlobal.tipo === "percentage" && descValor > 0) {
      descontoProposta = subTotal * (descValor / 100);
    } else if (descontoGlobal.tipo === "fixed" && descValor > 0) {
      descontoProposta = descValor;
    }

    // Limitamos o desconto global ao valor do subtotal
    descontoProposta = Math.min(Math.max(0, descontoProposta), subTotal);

    // Valor Final = SubTotal - Desconto Proposta
    const valorFinal = Math.max(0, subTotal - descontoProposta);

    return {
      valorItens,
      desconto: descontoItens,
      subTotal,
      descontoProposta,
      valorFinal
    };
  }
}
