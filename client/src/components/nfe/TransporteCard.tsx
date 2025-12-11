import type { TransporteNFE } from '@/types/nfe';
import { SectionCard } from './SectionCard';
import { FieldDisplay } from './FieldDisplay';

interface Props {
  data: TransporteNFE;
}

export function TransporteCard({ data }: Props) {
  return (
    <SectionCard title="Transporte">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-4">
          <FieldDisplay label="Modalidade do Frete" value={data.modalidadeFrete} />
          {data.transportadora && (
            <>
              <FieldDisplay label="CNPJ Transportadora" value={data.transportadora.cnpj} />
              <FieldDisplay label="Transportadora" value={data.transportadora.razaoSocial} />
              <FieldDisplay label="IE" value={data.transportadora.inscricaoEstadual} />
              <FieldDisplay label="Endereço" value={data.transportadora.endereco} />
              <FieldDisplay label="Cidade/UF" value={`${data.transportadora.cidade}/${data.transportadora.uf}`} />
            </>
          )}
        </div>
        <div className="space-y-4">
          {data.volumes && (
            <>
              <FieldDisplay label="Quantidade de Volumes" value={data.volumes.quantidade} />
              <FieldDisplay label="Espécie" value={data.volumes.especie} />
            </>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
