import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface EditableFieldProps {
  label: string;
  value?: string | number;
  onChange?: (value: string) => void;
}

export function EditableField({ label, value, onChange }: EditableFieldProps) {
  return (
    <div>
      <Label>{label}</Label>
      <Input className="mt-1" value={String(value ?? '')} onChange={(e) => onChange?.(e.target.value)} />
    </div>
  );
}
