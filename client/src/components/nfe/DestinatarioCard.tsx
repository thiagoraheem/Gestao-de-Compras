import type { Empresa } from '@/types/nfe';
import { SectionCard } from './SectionCard';
import { FieldDisplay } from './FieldDisplay';

interface Props {
  data: Empresa;
}

export function DestinatarioCard({ data }: Props) {
  return (
    <SectionCard title="Destinatário">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FieldDisplay label="CNPJ" value={data.cnpj} />
        <FieldDisplay label="Razão Social" value={data.razaoSocial} />
        <FieldDisplay label="E-mail" value={data.email} />
        <FieldDisplay label="Inscrição Estadual" value={data.inscricaoEstadual} />
        <FieldDisplay label="Telefone" value={data.telefone} />
        <FieldDisplay label="Logradouro" value={data.endereco.logradouro} />
        <FieldDisplay label="Bairro" value={data.endereco.bairro} />
        <FieldDisplay label="Cidade/UF" value={`${data.endereco.cidade}/${data.endereco.uf}`} />
        <FieldDisplay label="Número" value={data.endereco.numero} />
        <FieldDisplay label="CEP" value={data.endereco.cep} />
        <FieldDisplay label="País" value={data.endereco.pais} />
      </div>
    </SectionCard>
  );
}
