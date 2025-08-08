import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUnits } from '@/hooks/useUnits';

interface UnitSelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function UnitSelect({
  value,
  onValueChange,
  placeholder = "Selecione...",
  disabled = false,
  className,
}: UnitSelectProps) {
  const { units } = useUnits();

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {units.map((unit) => (
          <SelectItem key={unit.value} value={unit.value}>
            {unit.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}