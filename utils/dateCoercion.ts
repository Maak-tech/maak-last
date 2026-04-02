/**
 * Coerces various date representations to a JavaScript Date object.
 * Returns null if the input cannot be converted to a valid date.
 */
export function coerceToDate(
  input: Date | string | number | { toDate?: () => Date } | null | undefined
): Date | null {
  if (!input) return null;

  // Already a Date
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input;
  }

  // Firestore Timestamp-like object with .toDate()
  if (typeof input === "object" && "toDate" in input && typeof input.toDate === "function") {
    try {
      const d = input.toDate();
      return isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  }

  // String or number
  const d = new Date(input as string | number);
  return isNaN(d.getTime()) ? null : d;
}
