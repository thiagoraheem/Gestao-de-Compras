import { SectionCard } from './SectionCard';

interface Props {
  info?: string;
}

export function InfoAdicionaisCard({ info }: Props) {
  return (
    <SectionCard title="Informações Adicionais">
      <div className="text-sm whitespace-pre-wrap">{info || ''}</div>
    </SectionCard>
  );
}
