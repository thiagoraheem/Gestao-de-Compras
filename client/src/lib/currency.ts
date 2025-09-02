/**
 * Centralized utility functions for currency formatting that handle null/undefined values,
 * convert string numbers to numeric types, and support localization.
 * 
 * The utility properly handles zero values by displaying them as formatted currency (e.g., 'R$ 0,00')
 * rather than treating them as missing data ('N/A'). Only null or undefined values are displayed as 'N/A'.
 */

export const formatCurrency = (value: any): string => {
  if (value === null || value === undefined) {
    return "N/A";
  }
  
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue)) {
    return "N/A";
  }
  
  // Always format valid numbers, including zero
  return numValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

export const formatCurrencyWithoutSymbol = (value: any): string => {
  if (value === null || value === undefined) {
    return "N/A";
  }
  
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue)) {
    return "N/A";
  }
  
  return numValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const parseCurrencyToNumber = (value: string | number): number => {
  if (typeof value === 'number') {
    return value;
  }
  
  if (typeof value === 'string') {
    // Remove currency symbols and convert comma to dot
    const cleanValue = value.replace(/[R$\s]/g, '').replace(',', '.');
    const numValue = parseFloat(cleanValue);
    return isNaN(numValue) ? 0 : numValue;
  }
  
  return 0;
};