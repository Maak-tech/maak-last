/**
 * Safe date formatting utilities.
 * All functions return a fallback string on invalid input rather than throwing.
 */

type DateInput = Date | string | number | null | undefined;

function toDate(input: DateInput): Date | null {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Format a date value with locale and options.
 * Returns "—" on invalid input.
 */
export function safeFormatDate(
  input: DateInput,
  locale: string = "en-US",
  options: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" }
): string {
  const d = toDate(input);
  if (!d) return "—";
  try {
    return new Intl.DateTimeFormat(locale, options).format(d);
  } catch {
    return d.toLocaleDateString();
  }
}

/**
 * Format a time value with locale and options.
 * Returns null on invalid input so callers can conditionally render.
 */
export function safeFormatTime(
  input: DateInput,
  locale: string = "en-US",
  options: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" }
): string | null {
  const d = toDate(input);
  if (!d) return null;
  try {
    return new Intl.DateTimeFormat(locale, options).format(d);
  } catch {
    return d.toLocaleTimeString();
  }
}

/**
 * Format a date + time value.
 * Returns "—" on invalid input.
 */
export function safeFormatDateTime(
  input: DateInput,
  locale: string = "en-US",
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }
): string {
  const d = toDate(input);
  if (!d) return "—";
  try {
    return new Intl.DateTimeFormat(locale, options).format(d);
  } catch {
    return d.toLocaleString();
  }
}

/**
 * Format a number with locale-aware separators.
 * Returns the raw string on error.
 */
export function safeFormatNumber(
  value: number | null | undefined,
  locale: string = "en-US",
  options?: Intl.NumberFormatOptions
): string {
  if (value === null || value === undefined || isNaN(value)) return "—";
  try {
    return new Intl.NumberFormat(locale, options).format(value);
  } catch {
    return String(value);
  }
}
