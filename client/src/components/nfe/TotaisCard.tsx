import type { TotaisNFE } from '@/types/nfe';
import { SectionCard } from './SectionCard';
import { formatCurrency } from '@/lib/currency';

interface Props {
  data: TotaisNFE;
}

export function TotaisCard({ data }: Props) {
  return (
    <SectionCard title="Totais da Nota">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div>
          <div className="font-medium">Base ICMS</div>
          <div>{formatCurrency(data.baseCalculoICMS)}</div>
        </div>
        <div>
          <div className="font-medium">Valor ICMS</div>
          <div>{formatCurrency(data.valorICMS)}</div>
        </div>
        <div>
          <div className="font-medium">Base ICMS ST</div>
          <div>{formatCurrency(data.baseCalculoST)}</div>
        </div>
        <div>
          <div className="font-medium">Valor ICMS ST</div>
          <div>{formatCurrency(data.valorST)}</div>
        </div>
        <div>
          <div className="font-medium">Valor IPI</div>
          <div>{formatCurrency(data.valorIPI)}</div>
        </div>
        <div>
          <div className="font-medium">Valor PIS</div>
          <div>{formatCurrency(data.valorPIS)}</div>
        </div>
        <div>
          <div className="font-medium">Valor COFINS</div>
          <div>{formatCurrency(data.valorCOFINS)}</div>
        </div>
        <div>
          <div className="font-medium">Valor Produtos</div>
          <div>{formatCurrency(data.valorProdutos)}</div>
        </div>
        <div>
          <div className="font-medium">Valor Frete</div>
          <div>{formatCurrency(data.valorFrete)}</div>
        </div>
        <div>
          <div className="font-medium">Valor Seguro</div>
          <div>{formatCurrency(data.valorSeguro)}</div>
        </div>
        <div>
          <div className="font-medium">Outras Despesas</div>
          <div>{formatCurrency(data.valorOutros)}</div>
        </div>
        <div>
          <div className="font-medium">Desconto</div>
          <div>{formatCurrency(data.valorDesconto)}</div>
        </div>
      </div>
      <div className="mt-6 rounded-lg border p-4 bg-slate-950/30">
        <div className="text-xs text-muted-foreground">Valor Total da Nota</div>
        <div className="text-2xl font-semibold">{formatCurrency(data.valorNota)}</div>
      </div>
    </SectionCard>
  );
}
