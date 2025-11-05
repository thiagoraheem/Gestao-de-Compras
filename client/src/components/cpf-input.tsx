import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { validateCPF, applyCPFMask } from '@/lib/cpf-validator';

interface CPFInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export function CPFInput({ 
  value, 
  onChange, 
  label = "CPF", 
  placeholder = "000.000.000-00",
  required = false,
  disabled = false,
  className = ""
}: CPFInputProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isValid, setIsValid] = useState(true);
  const [showValidation, setShowValidation] = useState(false);

  useEffect(() => {
    setDisplayValue(applyCPFMask(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const maskedValue = applyCPFMask(inputValue);
    
    setDisplayValue(maskedValue);
    
    // Remove formatação para armazenar apenas números
    const cleanValue = inputValue.replace(/[^\d]/g, '');
    onChange(cleanValue);
  };

  const handleBlur = () => {
    if (value && value.length > 0) {
      setShowValidation(true);
      const valid = validateCPF(value);
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
        <Label htmlFor="cpf-input" className="text-sm font-medium">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}
      <Input
        id="cpf-input"
        type="text"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={14} // XXX.XXX.XXX-XX
        className={`${!isValid && showValidation ? 'border-red-500' : ''}`}
      />
      {showValidation && !isValid && (
        <p className="text-red-500 text-sm mt-1">
          CPF inválido
        </p>
      )}
    </div>
  );
}