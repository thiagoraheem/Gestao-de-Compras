import { SectionCard } from './SectionCard';
import type { NFEData } from '@/types/nfe';
import { Package, Calculator, FileText, CreditCard } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';

interface Props {
  data: NFEData;
}

export function NFESummary({ data }: Props) {
  const t = data.totais;
  return (
    <SectionCard title="Resumo">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-lg border p-4 bg-slate-950/30">
          <div className="flex items-center gap-2 text-sm font-medium"><Package className="h-4 w-4"/> Total de Itens</div>
          <div className="mt-1 text-xl">{data.itens.length}</div>
        </div>
        <div className="rounded-lg border p-4 bg-slate-950/30">
          <div className="flex items-center gap-2 text-sm font-medium"><Calculator className="h-4 w-4"/> Valor dos Produtos</div>
          <div className="mt-1 text-xl">{formatCurrency(t.valorProdutos)}</div>
        </div>
        <div className="rounded-lg border p-4 bg-slate-950/30">
          <div className="flex items-center gap-2 text-sm font-medium"><FileText className="h-4 w-4"/> Valor da Nota</div>
          <div className="mt-1 text-xl">{formatCurrency(t.valorNota)}</div>
        </div>
        <div className="rounded-lg border p-4 bg-slate-950/30">
          <div className="flex items-center gap-2 text-sm font-medium"><CreditCard className="h-4 w-4"/> Forma de Pagamento</div>
          <div className="mt-1 text-xl">{data.pagamento.formaPagamento}</div>
        </div>
      </div>
    </SectionCard>
  );
}
