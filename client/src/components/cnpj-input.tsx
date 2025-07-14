import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { validateCNPJ, applyCNPJMask } from '@/lib/cnpj-validator';

interface CNPJInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export function CNPJInput({ 
  value, 
  onChange, 
  label = "CNPJ", 
  placeholder = "00.000.000/0000-00",
  required = false,
  disabled = false,
  className = ""
}: CNPJInputProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isValid, setIsValid] = useState(true);
  const [showValidation, setShowValidation] = useState(false);

  useEffect(() => {
    setDisplayValue(applyCNPJMask(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const maskedValue = applyCNPJMask(inputValue);
    
    setDisplayValue(maskedValue);
    
    // Remove formatação para armazenar apenas números
    const cleanValue = inputValue.replace(/[^\d]/g, '');
    onChange(cleanValue);
  };

  const handleBlur = () => {
    if (value && value.length > 0) {
      setShowValidation(true);
      const valid = validateCNPJ(value);
      setIsValid(valid);
    } else {
      setShowValidation(false);
      setIsValid(true);
    }
  };

  const handleFocus = () => {
    setShowValidation(false);
  };

  return (
    <div className={className}>
      {label && (
        <Label htmlFor="cnpj-input" className="text-sm font-medium">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}
      <Input
        id="cnpj-input"
        type="text"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={18} // XX.XXX.XXX/XXXX-XX
        className={`${!isValid && showValidation ? 'border-red-500' : ''}`}
      />
      {showValidation && !isValid && (
        <p className="text-red-500 text-sm mt-1">
          CNPJ inválido
        </p>
      )}
    </div>
  );
}