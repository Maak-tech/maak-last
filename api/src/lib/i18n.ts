/**
 * Server-side i18n helper for dynamic content translation.
 *
 * Translations are stored in the `i18n_content` table and fetched on demand.
 * An in-process TTL cache (5 minutes) keeps DB round-trips minimal for hot paths.
 *
 * Usage:
 *   const msg = await t('alert.heart_rate.above_threshold', 'ar', { value: 115, unit: 'bpm', threshold: 100 })
 *   // → 'معدل ضربات قلبك (115 bpm) يتجاوز الحد الآمن البالغ 100'
 *
 * Falls back to 'en' if the requested locale has no entry, then to the raw key
 * if neither exists.
 */

import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { i18nContent } from "../db/schema.js";

const CACHE_TTL_MS = 5 * 60_000; // 5 minutes

interface CacheEntry {
  value: string;
  loadedAt: number;
}

// Keyed by `${locale}:${contentKey}`
const cache = new Map<string, CacheEntry>();

/**
 * Translate a content key for a given locale.
 * Falls back to 'en' if locale not found.
 * Replaces {{placeholder}} tokens with provided values.
 */
export async function t(
  key: string,
  locale: string = "en",
  vars?: Record<string, string | number>
): Promise<string> {
  const cacheKey = `${locale}:${key}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
    return interpolate(cached.value, vars);
  }

  // Load from DB — fetch both the requested locale and 'en' in one query so we
  // can fall back without a second round-trip.
  const localesToFetch = locale === "en" ? ["en"] : [locale, "en"];
  const rows = await db
    .select({ contentKey: i18nContent.contentKey, locale: i18nContent.locale, value: i18nContent.value })
    .from(i18nContent)
    .where(
      and(
        eq(i18nContent.contentKey, key),
        inArray(i18nContent.locale, localesToFetch)
      )
    );

  const localeRow = rows.find((r) => r.locale === locale) ?? rows.find((r) => r.locale === "en");
  const value = localeRow?.value ?? key;

  // Cache the resolved value under the original locale key so subsequent
  // calls skip the DB even when falling back to English.
  cache.set(cacheKey, { value, loadedAt: Date.now() });

  return interpolate(value, vars);
}

/**
 * Fetch all translations for a namespace + locale in one query.
 * Returns a flat key→value map — suitable for bulk seeding a client-side store.
 */
export async function loadNamespace(
  namespace: string,
  locale: string
): Promise<Record<string, string>> {
  const rows = await db
    .select({ contentKey: i18nContent.contentKey, value: i18nContent.value })
    .from(i18nContent)
    .where(
      and(
        eq(i18nContent.namespace, namespace),
        eq(i18nContent.locale, locale)
      )
    );

  // Warm the per-key cache while we have the data
  const now = Date.now();
  for (const row of rows) {
    cache.set(`${locale}:${row.contentKey}`, { value: row.value, loadedAt: now });
  }

  return Object.fromEntries(rows.map((r) => [r.contentKey, r.value]));
}

/** Replace {{placeholder}} tokens with provided variable values. */
function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? `{{${k}}}`));
}
