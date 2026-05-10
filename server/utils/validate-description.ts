/**
 * Validates item descriptions for minimum length, empty values, and basic XSS patterns.
 * Returns true if the description is INVALID.
 *
 * Centralized from routes.ts where it was duplicated at lines ~1661 and ~1782.
 */
export function isInvalidDescription(value: string | null): boolean {
  const trimmed = (value || "").trim();
  if (!trimmed) return true;
  if (trimmed.length < 10) return true;
  if (/[<>]/.test(trimmed)) return true;
  if (/(script|onerror|onload|javascript:)/i.test(trimmed)) return true;
  return false;
}
