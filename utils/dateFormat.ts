type DateInput = Date | string | number | null | undefined;
type LocaleInput = string | string[] | undefined;

type DateTimeFormatOptions = {
  year?: "numeric" | "2-digit";
  month?: "numeric" | "2-digit" | "short" | "long" | "narrow";
  day?: "numeric" | "2-digit";
  hour?: "numeric" | "2-digit";
  minute?: "numeric" | "2-digit";
  second?: "numeric" | "2-digit";
  weekday?: "short" | "long" | "narrow";
  hour12?: boolean;
  timeZone?: string;
};

type NumberFormatOptions = {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  minimumIntegerDigits?: number;
  useGrouping?: boolean;
};

const hasIntlDateTimeFormat = () =>
  typeof Intl !== "undefined" && typeof Intl.DateTimeFormat === "function";

const hasIntlNumberFormat = () =>
  typeof Intl !== "undefined" && typeof Intl.NumberFormat === "function";

const toValidDate = (input: DateInput): Date | null => {
  if (!input) {
    return null;
  }
  const date = input instanceof Date ? input : new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const safeFormatDate = (
  input: DateInput,
  locale?: LocaleInput,
  options?: DateTimeFormatOptions
): string => {
  const date = toValidDate(input);
  if (!date) {
    return "";
  }

  try {
    if (hasIntlDateTimeFormat()) {
      return new Intl.DateTimeFormat(locale, options).format(date);
    }
  } catch {
    // Fall back to toLocaleDateString below.
  }

  try {
    return date.toLocaleDateString(locale, options);
  } catch {
    // Fall back to a non-localized string.
  }

  return date.toISOString().slice(0, 10);
};

export const safeFormatTime = (
  input: DateInput,
  locale?: LocaleInput,
  options?: DateTimeFormatOptions
): string => {
  const date = toValidDate(input);
  if (!date) {
    return "";
  }

  try {
    if (hasIntlDateTimeFormat()) {
      return new Intl.DateTimeFormat(locale, options).format(date);
    }
  } catch {
    // Fall back to toLocaleTimeString below.
  }

  try {
    return date.toLocaleTimeString(locale, options);
  } catch {
    // Fall back to a non-localized string.
  }

  return date.toISOString().slice(11, 19);
};

export const safeFormatDateTime = (
  input: DateInput,
  locale?: LocaleInput,
  options?: DateTimeFormatOptions
): string => {
  const date = toValidDate(input);
  if (!date) {
    return "";
  }

  try {
    if (hasIntlDateTimeFormat()) {
      return new Intl.DateTimeFormat(locale, options).format(date);
    }
  } catch {
    // Fall back to toLocaleString below.
  }

  try {
    return date.toLocaleString(locale, options);
  } catch {
    // Fall back to a non-localized string.
  }

  return date.toISOString();
};

export const safeFormatNumber = (
  input: number | string | null | undefined,
  locale?: LocaleInput,
  options?: NumberFormatOptions
): string => {
  if (input === null || input === undefined || input === "") {
    return "";
  }
  const value = typeof input === "number" ? input : Number(input);
  if (Number.isNaN(value)) {
    return String(input);
  }

  try {
    if (hasIntlNumberFormat()) {
      return new Intl.NumberFormat(locale, options).format(value);
    }
  } catch {
    // Fall back to toLocaleString below.
  }

  try {
    return value.toLocaleString(locale, options);
  } catch {
    // Fall back to a non-localized string.
  }

  return String(value);
};
