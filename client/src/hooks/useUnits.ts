import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { UnitOfMeasure } from '@shared/schema';

// Unidades pré-definidas do sistema (fallback inicial)
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
  { value: "CM", label: "CM - Centímetro" },
  { value: "PAR", label: "PAR - Par" },
  { value: "KIT", label: "KIT - Kit" },
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
  "Resma": "PCT",
  "RESMA": "PCT",
  
  // Outras unidades comuns
  "Saco": "UN",
  "SACO": "UN",
  "Serviço": "UN",
  "SERVICO": "UN",
  "Hora": "UN",
  "HORA": "UN",
  "Par": "PAR",
  "PAR": "PAR",
  "Milheiro": "UN",
  "MILHEIRO": "UN",
};

export interface UnitOption {
  value: string;
  label: string;
}

export function useUnits() {
  const [customUnits, setCustomUnits] = useState<UnitOption[]>([]);
  
  // Fetch units from backend database
  const { data: dbUnits = [], isLoading } = useQuery<UnitOfMeasure[]>({
    queryKey: ['/api/units-of-measure'],
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  const customUnitsRef = useRef<UnitOption[]>(customUnits);
  useEffect(() => {
    customUnitsRef.current = customUnits;
  }, [customUnits]);

  // Combina unidades do banco de dados (ou padrão) com unidades customizadas
  const allUnits = useMemo(() => {
    let baseUnits: UnitOption[] = [];

    if (Array.isArray(dbUnits) && dbUnits.length > 0) {
      baseUnits = dbUnits
        .filter(u => u.active)
        .map(u => ({
          value: u.code,
          label: u.description.toUpperCase() === u.code.toUpperCase()
            ? u.code
            : `${u.code} - ${u.description}`,
        }));
    } else {
      baseUnits = [...DEFAULT_UNITS];
    }
    
    // Adiciona unidades customizadas que não existem nas padrão/banco
    const combined = [...baseUnits];
    customUnits.forEach(customUnit => {
      if (!combined.find(unit => unit.value.toUpperCase() === customUnit.value.toUpperCase())) {
        combined.push(customUnit);
      }
    });
    
    // Ordena alfabeticamente pelo código/label
    return combined.sort((a, b) => a.value.localeCompare(b.value));
  }, [dbUnits, customUnits]);

  // Adiciona uma nova unidade se ela não existir
  const addUnitIfNotExists = useCallback((unitValue: string, unitLabel?: string) => {
    if (!unitValue) return unitValue;

    const trimmedUnit = unitValue.trim();
    if (!trimmedUnit) return "UN";

    // Verifica se existe no allUnits atual
    const exists = allUnits.find(unit => 
      unit.value.toLowerCase() === trimmedUnit.toLowerCase()
    );
    
    if (exists) {
      return exists.value;
    }

    // Verifica se existe mapeamento para uma unidade padrão (case-insensitive)
    const mappedUnit = Object.keys(ERP_UNIT_MAPPING).find(key => 
      key.toLowerCase() === trimmedUnit.toLowerCase()
    );
    
    if (mappedUnit) {
      return ERP_UNIT_MAPPING[mappedUnit];
    }

    // Verifica se já existe nas unidades customizadas (case-insensitive)
    const existsInCustom = customUnitsRef.current.find(unit => 
      unit.value.toLowerCase() === trimmedUnit.toLowerCase()
    );
    
    if (existsInCustom) {
      return existsInCustom.value;
    }

    // Cria uma nova unidade customizada
    const newUnit: UnitOption = {
      value: trimmedUnit.toUpperCase(),
      label: unitLabel || `${trimmedUnit.toUpperCase()} - ${trimmedUnit}`
    };

    setCustomUnits(prev => {
      if (prev.find(u => u.value === newUnit.value)) return prev;
      return [...prev, newUnit];
    });
    
    return newUnit.value;
  }, [allUnits]);

  // Processa unidade vinda do ERP
  const processERPUnit = useCallback((erpUnit: string) => {
    if (!erpUnit) return "UN";
    return addUnitIfNotExists(erpUnit);
  }, [addUnitIfNotExists]);

  // Verifica se uma unidade existe
  const unitExists = useCallback((unitValue: string) => {
    return allUnits.some(unit => unit.value.toUpperCase() === unitValue.toUpperCase());
  }, [allUnits]);

  // Obtém o label de uma unidade
  const getUnitLabel = useCallback((unitValue: string) => {
    const unit = allUnits.find(u => u.value.toUpperCase() === unitValue.toUpperCase());
    return unit?.label || unitValue;
  }, [allUnits]);

  return {
    allUnits,
    isLoading,
    addUnitIfNotExists,
    processERPUnit,
    unitExists,
    getUnitLabel,
    defaultUnits: DEFAULT_UNITS,
    customUnits,
    dbUnits,
  };
}