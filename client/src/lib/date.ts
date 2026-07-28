import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Parses a date string (e.g. "YYYY-MM-DD" or ISO date) or Date object into a local Date object.
 * Prevents the ECMAScript UTC midnight parsing bug where new Date("YYYY-MM-DD") subtracts 1 day in negative UTC timezones.
 */
export function parseLocalDate(dateInput?: string | Date | null): Date | null {
  if (!dateInput) return null;
  if (dateInput instanceof Date) return isNaN(dateInput.getTime()) ? null : dateInput;

  const str = String(dateInput).trim();
  if (!str) return null;

  // Pure YYYY-MM-DD date string or YYYY-MM-DDT00:00:00 midnight strings
  const dateOnlyRegex = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s]00:00:00(?:\.000)?(?:Z|[+-]00:00)?)?$/;
  const match = str.match(dateOnlyRegex) || (!str.includes("T") && str.match(/^(\d{4})-(\d{2})-(\d{2})/));
  
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    const d = new Date(year, month - 1, day);
    return isNaN(d.getTime()) ? null : d;
  }

  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Formats a date string (YYYY-MM-DD or ISO) or Date object into a localized formatted string (default: dd/MM/yyyy).
 * Guarantees that date-only strings match the exact calendar date without 1-day timezone rollback.
 */
export function formatLocalDate(
  dateInput?: string | Date | null,
  formatStr: string = "dd/MM/yyyy",
  options?: Parameters<typeof format>[2]
): string {
  if (!dateInput) return "";
  const date = parseLocalDate(dateInput);
  if (!date) return "";
  return format(date, formatStr, { locale: ptBR, ...options });
}
