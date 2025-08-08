import { useState, useCallback, useMemo } from 'react';

// Unidades pré-definidas do sistema
const DEFAULT_UNITS = [
  { value: "UN", label: "UN - Unidade" },
  { value: "PC", label: "PC - Peça" },
  { value: "MT", label: "MT - Metro" },
  { value: "KG", label: "KG - Quilograma" },
  { value: "LT", label: "LT - Litro" },
  { value: "M2", label: "M² - Metro Quadrado" },
  { value: "M3", label: "M³- Metro Cúbico" },
  { value: "CX", label: "CX - Caixa" },
  { value: "PCT", label: "PCT - Pacote" },
];

// Mapeamento de unidades do ERP para unidades padronizadas
const ERP_UNIT_MAPPING: Record<string, string> = {
  // Variações de "Unidade"
  "Unidade": "UN",
  "UNI": "UN",
  "UNID": "UN",
  "UNIDADE": "UN",
  
  // Variações de "Peça"
  "Peça": "PC",
  "PECA": "PC",
  "PÇ": "PC",
  
  // Variações de "Metro"
  "Metro": "MT",
  "METRO": "MT",
  "M": "MT",
  
  // Variações de "Quilograma"
  "Quilograma": "KG",
  "QUILOGRAMA": "KG",
  "Kg": "KG",
  "KILO": "KG",
  
  // Variações de "Litro"
  "Litro": "LT",
  "LITRO": "LT",
  "L": "LT",
  
  // Variações de "Caixa"
  "Caixa": "CX",
  "CAIXA": "CX",
  
  // Variações de "Pacote"
  "Pacote": "PCT",
  "PACOTE": "PCT",
  "Resma": "PCT", // Resma pode ser tratada como pacote
  "RESMA": "PCT",
  
  // Outras unidades comuns
  "Saco": "UN", // Saco pode ser tratado como unidade
  "SACO": "UN",
  "Serviço": "UN", // Serviço como unidade
  "SERVICO": "UN",
  "Hora": "UN", // Hora como unidade
  "HORA": "UN",
  "Par": "UN", // Par como unidade
  "PAR": "UN",
  "Milheiro": "UN", // Milheiro como unidade especial
  "MILHEIRO": "UN",
};

interface Unit {
  value: string;
  label: string;
}

export function useUnits() {
  const [customUnits, setCustomUnits] = useState<Unit[]>([]);

  // Combina unidades padrão com unidades customizadas
  const allUnits = useMemo(() => {
    const combined = [...DEFAULT_UNITS];
    
    // Adiciona unidades customizadas que não existem nas padrão
    customUnits.forEach(customUnit => {
      if (!combined.find(unit => unit.value === customUnit.value)) {
        combined.push(customUnit);
      }
    });
    
    // Ordena alfabeticamente
    return combined.sort((a, b) => a.label.localeCompare(b.label));
  }, [customUnits]);

  // Adiciona uma nova unidade se ela não existir
  const addUnitIfNotExists = useCallback((unitValue: string, unitLabel?: string) => {
    if (!unitValue) return unitValue;

    const trimmedUnit = unitValue.trim();
    if (!trimmedUnit) return "UN";

    // Verifica se a unidade já existe nas padrão (case-insensitive)
    const existsInDefault = DEFAULT_UNITS.find(unit => 
      unit.value.toLowerCase() === trimmedUnit.toLowerCase()
    );
    
    if (existsInDefault) {
      return existsInDefault.value;
    }

    // Verifica se existe mapeamento para uma unidade padrão (case-insensitive)
    const mappedUnit = Object.keys(ERP_UNIT_MAPPING).find(key => 
      key.toLowerCase() === trimmedUnit.toLowerCase()
    );
    
    if (mappedUnit) {
      return ERP_UNIT_MAPPING[mappedUnit];
    }

    // Verifica se já existe nas unidades customizadas (case-insensitive)
    const existsInCustom = customUnits.find(unit => 
      unit.value.toLowerCase() === trimmedUnit.toLowerCase()
    );
    
    if (existsInCustom) {
      return existsInCustom.value;
    }

    // Cria uma nova unidade customizada
    const newUnit: Unit = {
      value: trimmedUnit.toUpperCase(),
      label: unitLabel || `${trimmedUnit.toUpperCase()} - ${trimmedUnit}`
    };

    setCustomUnits(prev => [...prev, newUnit]);
    return newUnit.value;
  }, [customUnits]);

  // Processa unidade vinda do ERP
  const processERPUnit = useCallback((erpUnit: string) => {
    if (!erpUnit) return "UN"; // Fallback para unidade padrão
    
    return addUnitIfNotExists(erpUnit);
  }, [addUnitIfNotExists]);

  // Verifica se uma unidade existe
  const unitExists = useCallback((unitValue: string) => {
    return allUnits.some(unit => unit.value === unitValue);
  }, [allUnits]);

  // Obtém o label de uma unidade
  const getUnitLabel = useCallback((unitValue: string) => {
    const unit = allUnits.find(u => u.value === unitValue);
    return unit?.label || unitValue;
  }, [allUnits]);

  return {
    allUnits,
    addUnitIfNotExists,
    processERPUnit,
    unitExists,
    getUnitLabel,
    defaultUnits: DEFAULT_UNITS,
    customUnits,
  };
}