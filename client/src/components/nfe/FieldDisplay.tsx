import { Label } from '@/components/ui/label';

interface FieldDisplayProps {
  label: string;
  value?: string | number;
}

export function FieldDisplay({ label, value }: FieldDisplayProps) {
  return (
    <div>
      <Label>{label}</Label>
      <p className="mt-1 text-sm">{value ?? ''}</p>
    </div>
  );
}
