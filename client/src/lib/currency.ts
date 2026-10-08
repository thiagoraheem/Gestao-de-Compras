import {
  formatCurrencyIn,
  formatDualCurrency as sharedFormatDualCurrency,
  CurrencyCode,
  roundCurrency,
  convertToBRL,
  normalizeCurrencyCode,
  CURRENCY_SYMBOLS,
  CURRENCY_LABELS,
  SUPPORTED_CURRENCIES,
} from '../../../shared/utils/currency-utils';

export type { CurrencyCode };
export {
  formatCurrencyIn,
  roundCurrency,
  convertToBRL,
  normalizeCurrencyCode,
  CURRENCY_SYMBOLS,
  CURRENCY_LABELS,
  SUPPORTED_CURRENCIES,
};

export const formatDualCurrency = sharedFormatDualCurrency;

export const formatDualCurrencyBrlFirst = (
  originalValue: number | string | null | undefined,
  brlValue: number | string | null | undefined,
  currencyCode?: CurrencyCode | string,
  precision: number = 2
): string => {
  const code = normalizeCurrencyCode(currencyCode);
  if (code === 'BRL') {
    return formatCurrencyIn('BRL', brlValue ?? originalValue, precision);
  }
  const brlFormatted = formatCurrencyIn('BRL', brlValue, precision);
  const originalFormatted = formatCurrencyIn(code, originalValue, precision);
  return `${brlFormatted} (${originalFormatted})`;
};

export const formatCurrency = (
  value: any,
  currencyCode?: CurrencyCode | string
): string => {
  if (value === null || value === undefined) {
    return "N/A";
  }
  
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue)) {
    return "N/A";
  }
  
  return formatCurrencyIn(currencyCode || 'BRL', numValue);
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
    const cleanValue = value.replace(/[R$\s]/g, '').replace(',', '.');
    const numValue = parseFloat(cleanValue);
    return isNaN(numValue) ? 0 : numValue;
  }
  
  return 0;
};
