export const SUPPORTED_CURRENCIES = ['BRL', 'USD', 'EUR', 'GBP'] as const;

export type CurrencyCode = typeof SUPPORTED_CURRENCIES[number];

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  BRL: 'R$',
  USD: 'US$',
  EUR: '€',
  GBP: '£',
};

export const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  BRL: 'Real Brasileiro',
  USD: 'Dólar Americano',
  EUR: 'Euro',
  GBP: 'Libra Esterlina',
};

function toNumber(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : val;
  }
  if (typeof val === 'string') {
    let s = val.replace(/[R$\s€£]/g, '');
    if (s === '') return 0;
    const hasComma = s.includes(',');
    const hasDot = s.includes('.');
    if (hasComma && hasDot) {
      const lastComma = s.lastIndexOf(',');
      const lastDot = s.lastIndexOf('.');
      if (lastComma > lastDot) {
        s = s.replace(/\./g, '').replace(',', '.');
      } else {
        s = s.replace(/,/g, '');
      }
    } else if (hasComma) {
      s = s.replace(',', '.');
    }
    const num = parseFloat(s);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

export { toNumber };

export function roundCurrency(
  value: number | string | null | undefined,
  decimals = 2
): number {
  const num = toNumber(value);
  const factor = Math.pow(10, decimals);
  if (num >= 0) {
    return Math.round(num * factor) / factor;
  }
  return -Math.round(Math.abs(num) * factor) / factor;
}

export function convertToBRL(
  value: number | string | null | undefined,
  exchangeRate: number | string | null | undefined
): number {
  if (value === null || value === undefined) return 0;
  if (exchangeRate === null || exchangeRate === undefined) return 0;
  const numValue = toNumber(value);
  const numRate = toNumber(exchangeRate);
  if (numRate === 0) return 0;
  return roundCurrency(numValue * numRate, 2);
}

export function normalizeCurrencyCode(
  code: string | null | undefined
): CurrencyCode {
  if (!code) return 'BRL';
  const upper = code.toUpperCase().trim();
  if (SUPPORTED_CURRENCIES.includes(upper as CurrencyCode)) {
    return upper as CurrencyCode;
  }
  return 'BRL';
}

export function formatCurrencyIn(
  code: CurrencyCode | string | null | undefined,
  value: number | string | null | undefined,
  decimals?: number
): string {
  const currencyCode = normalizeCurrencyCode(code);
  const num = toNumber(value);
  const maximumFractionDigits = decimals !== undefined ? decimals : 2;
  const minimumFractionDigits = decimals !== undefined ? decimals : 2;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(num);
}

export function formatDualCurrency(
  originalValue: number | string | null | undefined,
  brlValue: number | string | null | undefined,
  currencyCode: CurrencyCode | string | null | undefined,
  precision: number = 2
): string {
  const code = normalizeCurrencyCode(currencyCode);
  if (code === 'BRL') {
    return formatCurrencyIn('BRL', brlValue ?? originalValue, precision);
  }
  const originalFormatted = formatCurrencyIn(code, originalValue, precision);
  const brlFormatted = formatCurrencyIn('BRL', brlValue, precision);
  return `${originalFormatted}  (${brlFormatted})`;
}
