/**
 * Locale-aware formatting helpers for the app.
 *
 * Default locale is `en-IN` (India English) and INR currency, matching the
 * primary user base. All helpers accept an optional locale override so future
 * i18n work can pass a user-selected locale without rewriting call sites.
 */
export const DEFAULT_LOCALE = "en-IN";
export const DEFAULT_CURRENCY = "INR";

/** Format an amount as currency. Falls back gracefully on bad input. */
export function formatCurrency(
  amount: number | null | undefined,
  opts: { currency?: string; locale?: string; maximumFractionDigits?: number } = {}
) {
  const value = typeof amount === "number" && Number.isFinite(amount) ? amount : 0;
  const {
    currency = DEFAULT_CURRENCY,
    locale = DEFAULT_LOCALE,
    maximumFractionDigits = 0,
  } = opts;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits,
    }).format(value);
  } catch {
    return `₹${value}`;
  }
}

/** Format a date as a short, localized string (e.g. "28 Apr 2026"). */
export function formatDate(
  input: string | number | Date | null | undefined,
  opts: Intl.DateTimeFormatOptions & { locale?: string } = {}
) {
  if (!input) return "";
  const { locale = DEFAULT_LOCALE, ...rest } = opts;
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      ...rest,
    }).format(d);
  } catch {
    return d.toDateString();
  }
}

/** Relative time like "in 3 days" / "2 hours ago". */
export function formatRelative(
  input: string | number | Date | null | undefined,
  locale: string = DEFAULT_LOCALE
) {
  if (!input) return "";
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  const diffMs = d.getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 365 * 24 * 3600 * 1000],
    ["month", 30 * 24 * 3600 * 1000],
    ["week", 7 * 24 * 3600 * 1000],
    ["day", 24 * 3600 * 1000],
    ["hour", 3600 * 1000],
    ["minute", 60 * 1000],
  ];
  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    for (const [unit, ms] of units) {
      if (abs >= ms) return rtf.format(Math.round(diffMs / ms), unit);
    }
    return rtf.format(Math.round(diffMs / 1000), "second");
  } catch {
    return d.toLocaleString();
  }
}

/** Compact number formatting (1.2K, 3.4M) — useful for counts. */
export function formatCompact(n: number | null | undefined, locale: string = DEFAULT_LOCALE) {
  const value = typeof n === "number" && Number.isFinite(n) ? n : 0;
  try {
    return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(value);
  } catch {
    return String(value);
  }
}