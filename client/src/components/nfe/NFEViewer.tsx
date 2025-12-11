import { useMemo } from 'react';
import { parseNFEXml } from '@/utils/nfeParser';
import { SectionCard } from './SectionCard';
import { NFEHeader } from './NFEHeader';
import { EmitenteCard } from './EmitenteCard';
import { DestinatarioCard } from './DestinatarioCard';
import { ItemsTable } from './ItemsTable';
import { TotaisCard } from './TotaisCard';
import { TransporteCard } from './TransporteCard';
import { PagamentoCard } from './PagamentoCard';
import { InfoAdicionaisCard } from './InfoAdicionaisCard';

interface Props {
  xmlString: string;
  fileName?: string;
  onReimportXML?: () => void;
  onValidate?: () => void;
  onExport?: () => void;
  onSave?: () => void;
}

export function NFEViewer({ xmlString, fileName, onReimportXML, onValidate, onExport, onSave }: Props) {
  const data = useMemo(() => parseNFEXml(xmlString), [xmlString]);
  if (!data) return <div className="text-sm text-muted-foreground">XML inválido</div>;
  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <button
          className="px-3 py-1.5 rounded border text-sm"
          onClick={() => {
            const rows = [['Item','Código','Descrição','Qtd','Un','Unitário','Total']].concat(
              data.itens.map(it => [String(it.numero), it.codigo, it.descricao, String(it.quantidade), it.unidade, String(it.valorUnitario), String(it.valorTotal)])
            );
            const csv = rows.map(r => r.map(v => '"' + String(v).replace(/"/g,'""') + '"').join(',')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `nfe_${data.numero}_${data.serie}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }}
        >Exportar Excel (CSV)</button>
        <button
          className="px-3 py-1.5 rounded border text-sm"
          onClick={() => window.print()}
        >Imprimir</button>
      </div>
      <NFEHeader data={data} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <EmitenteCard data={data.emitente} />
        <DestinatarioCard data={data.destinatario} />
      </div>
      <SectionCard title="Itens">
        <ItemsTable items={data.itens} />
      </SectionCard>
      <TotaisCard data={data.totais} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TransporteCard data={data.transporte} />
        <PagamentoCard data={data.pagamento} />
      </div>
      <InfoAdicionaisCard info={data.informacoesAdicionais} />
    </div>
  );
}
