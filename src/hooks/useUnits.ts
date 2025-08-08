import { useState, useCallback, useMemo } from 'react';

// Unidades padrão do sistema
export const DEFAULT_UNITS = [
  { value: 'UN', label: 'Unidade' },
  { value: 'KG', label: 'Kg' },
  { value: 'M', label: 'Metro' },
  { value: 'M2', label: 'Metro²' },
  { value: 'M3', label: 'Metro³' },
  { value: 'L', label: 'Litro' },
  { value: 'CJ', label: 'Conjunto' },
  { value: 'PC', label: 'Peça' },
  { value: 'CX', label: 'Caixa' },
  { value: 'PCT', label: 'Pacote' },
  { value: 'RS', label: 'Resma' },
  { value: 'SC', label: 'Saco' },
  { value: 'SV', label: 'Serviço' },
  { value: 'H', label: 'Hora' },
  { value: 'PR', label: 'Par' },
  { value: 'MIL', label: 'Milheiro' },
];

// Mapeamento de unidades do ERP para unidades padronizadas
export const ERP_UNIT_MAPPING: Record<string, string> = {
  // Variações de Unidade
  'UNI': 'UN',
  'UNID': 'UN',
  'UNIDADE': 'UN',
  'UNIT': 'UN',
  
  // Variações de Peça
  'PECA': 'PC',
  'PÇ': 'PC',
  'PCS': 'PC',
  'PIECE': 'PC',
  
  // Variações de Metro
  'METRO': 'M',
  'MTS': 'M',
  'METROS': 'M',
  
  // Variações de Quilograma
  'QUILOGRAMA': 'KG',
  'KILO': 'KG',
  'QUILOS': 'KG',
  'KILOGRAMA': 'KG',
  
  // Variações de Litro
  'LITRO': 'L',
  'LITROS': 'L',
  'LT': 'L',
  'LTS': 'L',
  
  // Variações de Caixa
  'CAIXA': 'CX',
  'CAIXAS': 'CX',
  'BOX': 'CX',
  
  // Variações de Pacote
  'PACOTE': 'PCT',
  'PACOTES': 'PCT',
  'PACK': 'PCT',
  
  // Variações de Resma
  'RESMA': 'RS',
  'RESMAS': 'RS',
  
  // Variações de Saco
  'SACO': 'SC',
  'SACOS': 'SC',
  
  // Variações de Serviço
  'SERVICO': 'SV',
  'SERVIÇOS': 'SV',
  'SERVICE': 'SV',
  
  // Variações de Hora
  'HORA': 'H',
  'HORAS': 'H',
  'HR': 'H',
  'HRS': 'H',
  
  // Variações de Par
  'PAR': 'PR',
  'PARES': 'PR',
  'PAIR': 'PR',
  
  // Variações de Milheiro
  'MILHEIRO': 'MIL',
  'MILHEIROS': 'MIL',
  'THOUSAND': 'MIL',
};

export function useUnits() {
  const [customUnits, setCustomUnits] = useState<Array<{ value: string; label: string }>>([]);

  // Combina unidades padrão com unidades customizadas
  const allUnits = useMemo(() => {
    const combined = [...DEFAULT_UNITS, ...customUnits];
    // Remove duplicatas baseado no value
    const unique = combined.filter((unit, index, self) => 
      index === self.findIndex(u => u.value === unit.value)
    );
    return unique.sort((a, b) => a.label.localeCompare(b.label));
  }, [customUnits]);

  // Adiciona uma unidade se ela não existir
  const addUnitIfNotExists = useCallback((unitValue: string, unitLabel?: string) => {
    if (!unitValue || unitValue.trim() === '') return unitValue;

    const normalizedValue = unitValue.trim().toUpperCase();
    const normalizedLabel = unitLabel?.trim() || normalizedValue;

    // Verifica se já existe nas unidades padrão (case-insensitive)
    const existsInDefault = DEFAULT_UNITS.some(unit => 
      unit.value.toUpperCase() === normalizedValue || 
      unit.label.toUpperCase() === normalizedLabel.toUpperCase()
    );

    if (existsInDefault) return normalizedValue;

    // Verifica se existe no mapeamento do ERP
    const mappedUnit = ERP_UNIT_MAPPING[normalizedValue];
    if (mappedUnit) return mappedUnit;

    // Verifica se já existe nas unidades customizadas (case-insensitive)
    const existsInCustom = customUnits.some(unit => 
      unit.value.toUpperCase() === normalizedValue || 
      unit.label.toUpperCase() === normalizedLabel.toUpperCase()
    );

    if (!existsInCustom) {
      setCustomUnits(prev => [...prev, { value: normalizedValue, label: normalizedLabel }]);
    }

    return normalizedValue;
  }, [customUnits]);

  // Processa unidades vindas do ERP
  const processERPUnit = useCallback((erpUnit: string) => {
    if (!erpUnit || erpUnit.trim() === '') return '';

    const normalizedUnit = erpUnit.trim().toUpperCase();
    
    // Verifica se existe mapeamento direto
    const mappedUnit = ERP_UNIT_MAPPING[normalizedUnit];
    if (mappedUnit) return mappedUnit;

    // Se não existe mapeamento, adiciona como unidade customizada
    return addUnitIfNotExists(normalizedUnit, erpUnit.trim());
  }, [addUnitIfNotExists]);

  // Verifica se uma unidade existe
  const unitExists = useCallback((unitValue: string) => {
    if (!unitValue) return false;
    const normalizedValue = unitValue.trim().toUpperCase();
    return allUnits.some(unit => unit.value.toUpperCase() === normalizedValue);
  }, [allUnits]);

  // Obtém o label de uma unidade
  const getUnitLabel = useCallback((unitValue: string) => {
    if (!unitValue) return '';
    const normalizedValue = unitValue.trim().toUpperCase();
    const unit = allUnits.find(unit => unit.value.toUpperCase() === normalizedValue);
    return unit?.label || unitValue;
  }, [allUnits]);

  return {
    units: allUnits,
    addUnitIfNotExists,
    processERPUnit,
    unitExists,
    getUnitLabel,
    customUnits,
    setCustomUnits,
  };
}