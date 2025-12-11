import { SectionCard } from './SectionCard';
import type { NFEData } from '@/types/nfe';
import { FieldDisplay } from './FieldDisplay';
import { Badge } from '@/components/ui/badge';

interface Props {
  data: NFEData;
}

export function NFEHeader({ data }: Props) {
  const statusLabel = (data.status || '').toLowerCase().includes('autoriz') ? 'Autorizada' : (data.status || '');
  const chave = (data.chaveAcesso || '').replace(/\s+/g, '').match(/.{1,4}/g)?.join(' ') || data.chaveAcesso;
  return (
    <SectionCard title="Cabeçalho da NF-e">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="text-xl font-semibold">NF-e {data.numero}</div>
          {statusLabel && <Badge variant="outline" className="bg-green-600/20 text-green-200 border-green-500">{statusLabel}</Badge>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FieldDisplay label="Natureza da Operação" value={data.naturezaOperacao} />
          <FieldDisplay label="Série" value={data.serie} />
          <FieldDisplay label="Emissão" value={data.dataEmissao} />
          <FieldDisplay label="Entrada" value={data.dataEntrada} />
          <FieldDisplay label="Protocolo" value={data.protocolo} />
          <FieldDisplay label="Chave de Acesso" value={chave} />
        </div>
      </div>
    </SectionCard>
  );
}
