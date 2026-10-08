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
} from '../../shared/utils/currency-utils';

export type { CurrencyCode };
export {
  roundCurrency,
  convertToBRL,
  normalizeCurrencyCode,
  CURRENCY_SYMBOLS,
  CURRENCY_LABELS,
  SUPPORTED_CURRENCIES,
  sharedFormatDualCurrency as formatDualCurrency,
};

export const formatCurrency = (
  value: number | string | null | undefined,
  currencyCode?: CurrencyCode | string
): string => {
  return formatCurrencyIn(currencyCode || 'BRL', value);
};

export const formatCurrencyBR = formatCurrency;

export const formatDate = (date: Date | string | null | undefined): string => {
  if (!date) return 'Não informado';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return 'Não informado';
    return d.toLocaleDateString('pt-BR');
  } catch {
    return 'Não informado';
  }
};

export const formatDateTime = (date: Date | string | null | undefined): string => {
  if (!date) return 'Não informado';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return 'Não informado';
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Não informado';
  }
};

export const escapeCsv = (val: any): string => {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};
