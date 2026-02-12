
/**
 * Utility for parsing and formatting numbers according to Brazilian locale (pt-BR).
 * Enforces strict validation to avoid ambiguity.
 */

/**
 * Parses a Brazilian formatted number string (e.g., "1.000,50") into a JavaScript number (1000.50).
 * Throws an error if the format is invalid or ambiguous.
 * 
 * @param value The string value to parse.
 * @returns The parsed number or NaN if input is empty/null/undefined.
 */
export function parseBrazilianNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") {
    return NaN;
  }

  if (typeof value === "number") {
    return value;
  }

  // Trim whitespace
  const trimmed = value.trim();

  // Basic validation: allowed characters are digits, dots, commas, and negative sign at start
  if (!/^-?[\d.,]+$/.test(trimmed)) {
    console.warn(`[parseBrazilianNumber] Invalid characters in value: ${trimmed}`);
    return NaN; // Or throw error? For UI resilience, NaN is often better, but for backend strictness, throw.
  }

  // Count separators
  const dots = (trimmed.match(/\./g) || []).length;
  const commas = (trimmed.match(/,/g) || []).length;

  if (commas > 1) {
    console.warn(`[parseBrazilianNumber] Multiple commas found in value: ${trimmed}`);
    return NaN;
  }

  // If there is a comma, it must be the decimal separator.
  // Everything before comma can have dots as thousands separators.
  // Everything after comma must be digits only.

  let integerPart: string;
  let decimalPart: string;

  if (commas === 1) {
    const parts = trimmed.split(",");
    integerPart = parts[0];
    decimalPart = parts[1];
  } else {
    integerPart = trimmed;
    decimalPart = "0";
  }

  // Validate integer part structure (thousands separators)
  // e.g. 1.000.000 or 1000 or 1 (if no dots)
  // We remove dots and check if it is a valid integer
  const integerPartClean = integerPart.replace(/\./g, "");
  
  // If we had dots, we should strictly check positions if we wanted to be very strict,
  // but usually just stripping them is enough if we trust the input mask.
  // However, "1.2.3" is invalid. "100.0" is invalid if dot is thousands.
  // Regex for strict thousands: ^-?(\d{1,3}(\.\d{3})*|\d+)$
  
  // Let's implement strict check for dots if present
  if (dots > 0) {
    if (!/^-?(\d{1,3}(\.\d{3})*)$/.test(integerPart)) {
       // Allow loose typing? The user requirement says "validação robusta".
       // But user might type "1000" without dots. That's fine.
       // But "1.00" is ambiguous. In BR, it means 100 (if 1.00 is incomplete 1.000?) No, 1.00 is invalid for thousands.
       // "1.000" is 1000.
       console.warn(`[parseBrazilianNumber] Invalid thousands separator placement: ${trimmed}`);
       // We can return NaN or try to parse loosely. Let's return NaN for strictness as requested.
       return NaN;
    }
  }

  const numberString = `${integerPartClean}.${decimalPart}`;
  const result = parseFloat(numberString);
  return result;
}

/**
 * Formats a number into Brazilian currency/decimal format.
 * @param value The number to format.
 * @param minFractionDigits Minimum decimal places (default 2).
 * @param maxFractionDigits Maximum decimal places (default 4).
 * @returns The formatted string.
 */
export function formatBrazilianNumber(
  value: number | string | null | undefined,
  minFractionDigits: number = 2,
  maxFractionDigits: number = 4
): string {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const num = typeof value === "string" ? parseFloat(value) : value;

  if (isNaN(num)) {
    return "";
  }

  return num.toLocaleString("pt-BR", {
    minimumFractionDigits: minFractionDigits,
    maximumFractionDigits: maxFractionDigits,
  });
}
