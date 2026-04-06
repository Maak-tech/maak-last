/**
 * Wearable Staleness Detection — runs every 4 hours via Railway cron.
 *
 * Problem: a connected wearable (Fitbit, Oura, Garmin, HealthKit, etc.) may
 * silently stop syncing without the user noticing — battery died, app
 * permission revoked, account disconnected. The VHI then uses stale data or
 * falls back to "insufficient data", making risk scores unreliable.
 *
 * This job:
 *   1. Finds users with at least one active wearable integration.
 *   2. For each wearable source, checks the newest vital row with that source
 *      in the last 72 hours.
 *   3. If the newest reading is older than the staleness threshold:
 *        - Pushes a gentle "your [device] hasn't synced" notification.
 *        - Creates a low-severity alert so the VHI can reference it.
 *        - Skips if a staleness alert was already sent in the last 24 h
 *          (prevents notification fatigue).
 *   4. If a previously-stale source has resumed syncing, marks its alert
 *      as resolved automatically.
 *
 * Staleness thresholds (configurable via env):
 *   - healthkit / health_connect : 6 h (phone in pocket, should sync often)
 *   - fitbit / oura / garmin     : 24 h (sync on charge, once/day is normal)
 *   - withings / dexcom          : 12 h (scale/CGM, expected at least twice/day)
 *   - manual                     : not checked (user-initiated, no expectation)
 */

import { db } from "../db";
import { and, desc, eq, gte, inArray, lt, ne, sql } from "drizzle-orm";
import {
  users,
  vitals,
  connectedIntegrations,
  alerts,
  pushTokens,
} from "../db/schema";
import { pushToUser } from "../lib/push";

// ── Advisory lock key ─────────────────────────────────────────────────────────
const ADVISORY_LOCK_KEY = 7_777_002;

// ── Staleness thresholds by source (milliseconds) ────────────────────────────
const STALENESS_MS: Record<string, number> = {
  healthkit: 6 * 60 * 60 * 1000,       // 6 h
  health_connect: 6 * 60 * 60 * 1000,  // 6 h
  fitbit: 24 * 60 * 60 * 1000,         // 24 h
  oura: 24 * 60 * 60 * 1000,           // 24 h
  garmin: 24 * 60 * 60 * 1000,         // 24 h
  withings: 12 * 60 * 60 * 1000,       // 12 h
  dexcom: 12 * 60 * 60 * 1000,         // 12 h
};

// Cooldown: do not re-notify within this window (24 h)
const NOTIFICATION_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// Lookback window: if no vitals in this period, data is definitely stale
const LOOKBACK_MS = 72 * 60 * 60 * 1000;

// ── Entry point ───────────────────────────────────────────────────────────────

async function runWearableStaleness(): Promise<void> {
  const [lockRow] = await db.execute<{ acquired: boolean }>(
    sql`SELECT pg_try_advisory_lock(${ADVISORY_LOCK_KEY}) AS acquired`
  );
  if (!lockRow?.acquired) {
    console.log("[wearableStaleness] Another instance is running — skipping.");
    return;
  }

  try {
    await processAll();
  } finally {
    await db.execute(sql`SELECT pg_advisory_unlock(${ADVISORY_LOCK_KEY})`);
  }
}

async function processAll(): Promise<void> {
  const now = new Date();
  const lookbackCutoff = new Date(now.getTime() - LOOKBACK_MS);

  // 1. Find all users with at least one active wearable integration
  const integrationRows = await db
    .select({
      userId: connectedIntegrations.userId,
      provider: connectedIntegrations.provider,
    })
    .from(connectedIntegrations)
    .where(eq(connectedIntegrations.isActive, true))
    .limit(1000);

  if (integrationRows.length === 0) {
    console.log("[wearableStaleness] No active integrations — nothing to do.");
    return;
  }

  // Group by userId → list of connected providers
  const providersByUser = new Map<string, string[]>();
  for (const row of integrationRows) {
    const existing = providersByUser.get(row.userId) ?? [];
    existing.push(row.provider);
    providersByUser.set(row.userId, existing);
  }

  let notifiedCount = 0;
  let resolvedCount = 0;
  let checkedCount = 0;

  for (const [userId, providers] of providersByUser) {
    for (const provider of providers) {
      // Only check sources we have thresholds for
      const thresholdMs = STALENESS_MS[provider];
      if (!thresholdMs) continue;

      checkedCount++;

      try {
        const staleAt = new Date(now.getTime() - thresholdMs);

        // 2. Find most recent vital from this source in the lookback window
        const [latestVital] = await db
          .select({ recordedAt: vitals.recordedAt })
          .from(vitals)
          .where(
            and(
              eq(vitals.userId, userId),
              eq(vitals.source, provider),
              gte(vitals.recordedAt, lookbackCutoff)
            )
          )
          .orderBy(desc(vitals.recordedAt))
          .limit(1);

        const isStale = !latestVital || latestVital.recordedAt < staleAt;

        // 3a. If NOT stale — auto-resolve any open staleness alert for this source
        if (!isStale) {
          await db
            .update(alerts)
            .set({ isAcknowledged: true, updatedAt: now })
            .where(
              and(
                eq(alerts.userId, userId),
                eq(alerts.type, "wearable_stale"),
                sql`${alerts.metadata}->>'source' = ${provider}`,
                eq(alerts.isAcknowledged, false)
              )
            );
          resolvedCount++;
          continue;
        }

        // 3b. If stale — check if we already notified recently (cooldown)
        const cooldownCutoff = new Date(now.getTime() - NOTIFICATION_COOLDOWN_MS);
        const [recentAlert] = await db
          .select({ id: alerts.id, createdAt: alerts.createdAt })
          .from(alerts)
          .where(
            and(
              eq(alerts.userId, userId),
              eq(alerts.type, "wearable_stale"),
              sql`${alerts.metadata}->>'source' = ${provider}`,
              gte(alerts.createdAt, cooldownCutoff)
            )
          )
          .limit(1);

        if (recentAlert) {
          // Already notified within cooldown — skip
          continue;
        }

        // 4. Insert staleness alert + send push
        const friendlyName = friendlyDeviceName(provider);

        await db.insert(alerts).values({
          id: crypto.randomUUID(),
          userId,
          type: "wearable_stale",
          severity: "low",
          title: `${friendlyName} hasn't synced`,
          body: `Your ${friendlyName} data hasn't updated recently. Open the app to re-sync and keep your health data current.`,
          isAcknowledged: false,
          metadata: {
            source: provider,
            lastSyncAt: latestVital?.recordedAt?.toISOString() ?? null,
            thresholdHours: thresholdMs / (60 * 60 * 1000),
          },
        });

        await pushToUser(userId, {
          title: `${friendlyName} sync needed`,
          body: `Your ${friendlyName} hasn't synced recently. Tap to reconnect and keep your health tracking accurate.`,
          data: { screen: "integrations", provider },
          priority: "default",
        });

        notifiedCount++;
      } catch (err) {
        console.error(
          `[wearableStaleness] Error for user ${userId} / provider ${provider}:`,
          err instanceof Error ? err.message : err
        );
      }
    }
  }

  console.log(
    `[wearableStaleness] Done. Checked: ${checkedCount}, Notified: ${notifiedCount}, Auto-resolved: ${resolvedCount}`
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function friendlyDeviceName(provider: string): string {
  const names: Record<string, string> = {
    healthkit: "Apple Health",
    health_connect: "Google Health Connect",
    fitbit: "Fitbit",
    oura: "Oura Ring",
    garmin: "Garmin",
    withings: "Withings",
    dexcom: "Dexcom CGM",
  };
  return names[provider] ?? provider;
}

// ── Run ───────────────────────────────────────────────────────────────────────

runWearableStaleness()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[wearableStaleness] Fatal error:", err);
    process.exit(1);
  });
