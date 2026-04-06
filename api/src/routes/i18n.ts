/**
 * i18n routes — serve server-managed translations to mobile clients.
 *
 * GET /api/v1/i18n/:locale/:namespace
 *   Returns a flat key→value map for all translations in the given locale and
 *   namespace.  No authentication required — translations are not PHI.
 *
 * Example:
 *   GET /api/v1/i18n/ar/alerts
 *   → { locale: 'ar', namespace: 'alerts', translations: { 'alert.fall_detected': '...' }, count: 5 }
 */

import { Elysia } from "elysia";
import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { i18nContent } from "../db/schema.js";

export const i18nRoutes = new Elysia()
  .get("/i18n/:locale/:namespace", async ({ params, set }) => {
    const { locale, namespace } = params;

    // Basic validation — only allow known locales and namespaces to avoid
    // open-ended DB scans on attacker-controlled input.
    const SUPPORTED_LOCALES = new Set(["en", "ar", "fr", "ur"]);
    const SUPPORTED_NAMESPACES = new Set(["alerts", "medications", "vitals", "nora", "common"]);

    if (!SUPPORTED_LOCALES.has(locale)) {
      set.status = 400;
      return { error: `Unsupported locale '${locale}'. Supported: ${[...SUPPORTED_LOCALES].join(", ")}` };
    }
    if (!SUPPORTED_NAMESPACES.has(namespace)) {
      set.status = 400;
      return { error: `Unsupported namespace '${namespace}'. Supported: ${[...SUPPORTED_NAMESPACES].join(", ")}` };
    }

    const rows = await db
      .select({
        contentKey: i18nContent.contentKey,
        value: i18nContent.value,
      })
      .from(i18nContent)
      .where(
        and(
          eq(i18nContent.locale, locale),
          eq(i18nContent.namespace, namespace)
        )
      );

    const translations = Object.fromEntries(rows.map((r) => [r.contentKey, r.value]));

    return { locale, namespace, translations, count: rows.length };
  });
