import {
  SUPPORTED_CURRENCIES,
  CurrencyCode,
  CURRENCY_SYMBOLS,
  CURRENCY_LABELS,
  toNumber,
  roundCurrency,
  convertToBRL,
  formatCurrencyIn,
  formatDualCurrency,
  normalizeCurrencyCode,
} from '../../shared/utils/currency-utils';

describe('currency-utils', () => {
  describe('toNumber', () => {
    it('deve retornar 0 para null', () => {
      expect(toNumber(null)).toBe(0);
    });

    it('deve retornar 0 para undefined', () => {
      expect(toNumber(undefined)).toBe(0);
    });

    it('deve retornar 0 para string vazia', () => {
      expect(toNumber('')).toBe(0);
    });

    it('deve converter string "100" para 100', () => {
      expect(toNumber('100')).toBe(100);
    });

    it('deve manter number 100 como 100', () => {
      expect(toNumber(100)).toBe(100);
    });

    it('deve converter string "100.50" para 100.5', () => {
      expect(toNumber('100.50')).toBeCloseTo(100.5, 5);
    });

    it('deve converter formato pt-BR "1.234,56" (milhar com ponto, decimal com vírgula)', () => {
      expect(toNumber('1.234,56')).toBeCloseTo(1234.56, 5);
    });
  });

  describe('roundCurrency', () => {
    it('deve arredondar 1.2345 para 1.23 (HALF_UP com decimais=2)', () => {
      expect(roundCurrency(1.2345, 2)).toBeCloseTo(1.23, 5);
    });

    it('deve arredondar 1.235 para 1.24 (HALF_UP com decimais=2)', () => {
      expect(roundCurrency(1.235, 2)).toBeCloseTo(1.24, 5);
    });

    it('deve arredondar valor negativo -1.235 para -1.24 (HALF_UP)', () => {
      expect(roundCurrency(-1.235, 2)).toBeCloseTo(-1.24, 5);
    });

    it('deve usar 2 decimais por padrão', () => {
      expect(roundCurrency(100.123)).toBeCloseTo(100.12, 5);
    });
  });

  describe('convertToBRL', () => {
    it('deve converter 100 * 5.3 = 530', () => {
      expect(convertToBRL(100, 5.3)).toBeCloseTo(530, 5);
    });

    it('deve retornar 0 se value for null', () => {
      expect(convertToBRL(null, 5)).toBe(0);
    });

    it('deve retornar 0 se exchangeRate for null', () => {
      expect(convertToBRL(100, null)).toBe(0);
    });

    it('deve retornar 0 se exchangeRate for undefined', () => {
      expect(convertToBRL(100, undefined)).toBe(0);
    });
  });

  describe('formatCurrencyIn', () => {
    it('deve formatar USD 1234.56 com símbolo e valor correto', () => {
      const result = formatCurrencyIn('USD', 1234.56);
      expect(typeof result).toBe('string');
      const usMention = result.includes('US$') || result.includes('$');
      const valueMention = result.includes('1,234.56') || result.includes('1.234,56') ||
                          result.includes('1234,56') || result.includes('1234.56');
      expect(usMention).toBe(true);
      expect(valueMention).toBe(true);
    });

    it('deve formatar BRL 1234.56 como "R$ 1.234,56"', () => {
      const result = formatCurrencyIn('BRL', 1234.56);
      expect(result).toContain('R$');
      expect(result).toContain('1.234,56');
    });

    it('deve assumir BRL quando code é null/undefined', () => {
      const result = formatCurrencyIn(null, 0);
      expect(result).toContain('R$');
    });
  });

  describe('formatDualCurrency', () => {
    it('deve exibir ambas moedas quando currencyCode for USD', () => {
      const result = formatDualCurrency(100, 530, 'USD');
      const hasUS = result.includes('US$') || result.includes('$');
      const hasBR = result.includes('R$');
      expect(hasUS).toBe(true);
      expect(hasBR).toBe(true);
    });

    it('deve exibir apenas BRL quando currencyCode for BRL', () => {
      const result = formatDualCurrency(100, 100, 'BRL');
      const usCount = (result.match(/US\$/g) || []).length + (result.match(/[^R]\$/g) || []).length;
      const brCount = (result.match(/R\$/g) || []).length;
      expect(brCount).toBeGreaterThanOrEqual(1);
      expect(usCount).toBe(0);
    });

    it('deve exibir apenas BRL quando currencyCode for null/undefined', () => {
      const result = formatDualCurrency(100, 100, null);
      expect(result).toContain('R$');
    });
  });

  describe('normalizeCurrencyCode', () => {
    it('deve retornar BRL para null', () => {
      expect(normalizeCurrencyCode(null)).toBe('BRL');
    });

    it('deve retornar BRL para undefined', () => {
      expect(normalizeCurrencyCode(undefined)).toBe('BRL');
    });

    it('deve converter "usd" para "USD" (uppercase)', () => {
      expect(normalizeCurrencyCode('usd')).toBe('USD');
    });

    it('deve retornar BRL para moeda desconhecida JPY', () => {
      expect(normalizeCurrencyCode('JPY')).toBe('BRL');
    });

    it('deve aceitar e retornar EUR', () => {
      expect(normalizeCurrencyCode('eur')).toBe('EUR');
    });
  });

  describe('Constantes', () => {
    it('SUPPORTED_CURRENCIES deve ter 4 moedas', () => {
      expect(SUPPORTED_CURRENCIES.length).toBe(4);
      expect(SUPPORTED_CURRENCIES).toContain('BRL');
      expect(SUPPORTED_CURRENCIES).toContain('USD');
      expect(SUPPORTED_CURRENCIES).toContain('EUR');
      expect(SUPPORTED_CURRENCIES).toContain('GBP');
    });

    it('CURRENCY_SYMBOLS deve ter símbolo correto para cada moeda', () => {
      expect(CURRENCY_SYMBOLS.BRL).toBe('R$');
      expect(CURRENCY_SYMBOLS.USD).toBe('US$');
      expect(CURRENCY_SYMBOLS.EUR).toBe('€');
      expect(CURRENCY_SYMBOLS.GBP).toBe('£');
    });

    it('CURRENCY_LABELS deve ter descrição correta', () => {
      expect(CURRENCY_LABELS.BRL).toBe('Real Brasileiro');
      expect(CURRENCY_LABELS.USD).toBe('Dólar Americano');
    });
  });
});
