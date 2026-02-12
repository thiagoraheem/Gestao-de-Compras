import type { PagamentoNFE } from '@/types/nfe';
import { SectionCard } from './SectionCard';
import { FieldDisplay } from './FieldDisplay';
import { formatCurrency } from '@/lib/currency';

interface Props {
  data: PagamentoNFE;
}

export function PagamentoCard({ data }: Props) {
  return (
    <SectionCard title="Pagamento">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FieldDisplay label="Indicador" value={data.indicador} />
        <FieldDisplay label="Forma de Pagamento" value={data.formaPagamento} />
        <FieldDisplay label="Valor" value={formatCurrency(data.valor)} />
      </div>
    </SectionCard>
  );
}
