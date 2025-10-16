import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUnits } from '@/hooks/useUnits';

interface UnitSelectProps {
  value: string;
  onChange?: (value: string) => void;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function UnitSelect({ 
  value, 
  onChange,
  onValueChange, 
  placeholder = "Selecione a unidade...",
  className,
  disabled = false
}: UnitSelectProps) {
  const { allUnits } = useUnits();

  const handleValueChange = React.useCallback((newValue: string) => {
    if (onChange) {
      onChange(newValue);
    }
    if (onValueChange) {
      onValueChange(newValue);
    }
  }, [onChange, onValueChange]);

  return (
    <Select 
      value={value} 
      onValueChange={handleValueChange}
      disabled={disabled}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allUnits.map((unit) => (
          <SelectItem key={unit.value} value={unit.value}>
            {unit.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}