
/**
 * Server-side utility for robust number parsing.
 * Ensures that values received from frontend are correctly interpreted regardless of format (BRL or Intl).
 */

export class NumberParser {
  /**
   * Parses a value into a float with specified precision.
   * Handles string formats from BRL locale ("1.000,50") and International ("1000.50").
   * 
   * Strategy:
   * 1. If number, return it.
   * 2. If string:
   *    a. Remove non-numeric characters (currency symbols, spaces), preserving digits, dots, commas, minus.
   *    b. Detect format based on separators:
   *       - Both dot and comma: 
   *         - If dot comes last ("1,234.56"), treat as US/Intl (remove commas).
   *         - If comma comes last ("1.234,56"), treat as BRL (remove dots, replace comma with dot).
   *       - Only comma: Treat as BRL Decimal separator (replace with dot).
   *       - Only dot:
   *         - If matches strict thousands pattern (e.g. "1.000" or "1.000.000"), treat as Integer (remove dots).
   *         - Otherwise treat as Decimal separator (US/Intl).
   * 
   * @param value Input value
   * @param precision Decimal places to round to (default 4)
   */
  static parse(value: any, precision: number = 4): number {
    if (value === null || value === undefined || value === "") {
      return 0;
    }

    if (typeof value === 'number') {
      return Number(value.toFixed(precision));
    }

    if (typeof value === 'string') {
      // Remove currency symbols (R$, $), spaces, etc. Keep digits, dots, commas, minus.
      let clean = value.replace(/[^\d.,-]/g, '');
      
      if (!clean || clean === '-' || clean === '.' || clean === ',') return 0;

      const hasDot = clean.includes('.');
      const hasComma = clean.includes(',');

      if (hasDot && hasComma) {
        const lastDot = clean.lastIndexOf('.');
        const lastComma = clean.lastIndexOf(',');

        if (lastDot > lastComma) {
          // US Format: 1,234.56
          // Remove commas
          clean = clean.replace(/,/g, '');
        } else {
          // BRL Format: 1.234,56
          // Remove dots, replace comma with dot
          clean = clean.replace(/\./g, '').replace(',', '.');
        }
      } else if (hasComma) {
        // Only comma: 1234,56 or 1,234 (BRL Decimal)
        // We assume comma is decimal separator in this context
        clean = clean.replace(/,/g, '.');
      } else if (hasDot) {
        // Only dot: 1234.56 or 1.234
        // Check if it looks like strict thousands: 1.000 or 1.000.000 (groups of 3 digits)
        if (/^-?\d{1,3}(\.\d{3})+$/.test(clean)) {
           // Treat as thousands separator -> Remove dots
           clean = clean.replace(/\./g, '');
        }
        // Else leave as is (US decimal)
      }

      const parsed = parseFloat(clean);
      return isNaN(parsed) ? 0 : Number(parsed.toFixed(precision));
    }

    return 0;
  }
}
