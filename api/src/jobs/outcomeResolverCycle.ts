/**
 * Outcome Resolver Cycle — runs daily at 06:00 UTC via Railway cron.
 *
 * Closes VHI outcomes from 30 days ago: compares predicted risk trajectories
 * against actual health data to build the learning loop for risk weight calibration.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { db } from "../db";
import { healthTimeline, vhi, alerts } from "../db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";

const OUTCOME_WINDOW_DAYS = 30;

// ── Concurrency guard ─────────────────────────────────────────────────────────
const LOCK_FILE = path.join("/tmp", "outcome_resolver.lock");
const LOCK_STALE_MS = 4 * 60 * 60 * 1000; // 4 hours

function acquireLock(): boolean {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const stat = fs.statSync(LOCK_FILE);
      if (Date.now() - stat.mtimeMs < LOCK_STALE_MS) {
        console.warn("[outcomeResolver] Already running. Skipping.");
        return false;
      }
      // Lock exists but is stale — override it and log so the condition is
      // detectable in production logs (unlike vhiCycle and forecastCycle which both log here).
      console.warn("[outcomeResolver] Stale lock detected — overriding.");
    }
    fs.writeFileSync(LOCK_FILE, String(process.pid));
    return true;
  } catch (err: unknown) {
    console.warn("[outcomeResolver] Failed to acquire lock — proceeding without guard:", err instanceof Error ? err.message : String(err));
    return true;
  }
}

function releaseLock(): void {
  try {
    if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE);
  } catch (err: unknown) {
    console.warn("[outcomeResolver] Failed to release lock:", err instanceof Error ? err.message : String(err));
  }
}

async function runOutcomeResolverCycle() {
  if (!acquireLock()) return;
  console.log(`[outcomeResolver] Starting at ${new Date().toISOString()}`);
  try {

  const windowStart = new Date(
    Date.now() - OUTCOME_WINDOW_DAYS * 24 * 60 * 60 * 1000
  );
  const windowEnd = new Date(
    Date.now() - (OUTCOME_WINDOW_DAYS - 1) * 24 * 60 * 60 * 1000
  );

  // Find VHI cycle events from exactly 30 days ago to evaluate outcomes
  const pastEvents = await db
    .select()
    .from(healthTimeline)
    .where(
      and(
        gte(healthTimeline.occurredAt, windowStart),
        lte(healthTimeline.occurredAt, windowEnd),
        eq(healthTimeline.source, "vhi_cycle")
      )
    );

  console.log(
    `[outcomeResolver] Evaluating ${pastEvents.length} historical VHI snapshots`
  );

  let resolved = 0;
  for (const event of pastEvents) {
    try {
      const userId = event.userId;
      const meta = event.metadata as {
        compositeRisk?: number;
        overallScore?: number;
      } | null;
      if (!meta?.compositeRisk) continue;

      // Check what actually happened in the 30 days since prediction.
      // Lower bound: event.occurredAt (not windowStart — see prior fix).
      // Upper bound: event.occurredAt + OUTCOME_WINDOW_DAYS — without this, alerts
      // from today (when the resolver runs) would be counted in the outcome window,
      // inflating hadFall/hadCritical and corrupting the learning loop.
      const outcomeWindowEnd = new Date(
        new Date(event.occurredAt).getTime() + OUTCOME_WINDOW_DAYS * 24 * 60 * 60 * 1000
      );
      const actualAlerts = await db
        .select()
        .from(alerts)
        .where(
          and(
            eq(alerts.userId, userId),
            gte(alerts.createdAt, new Date(event.occurredAt)),
            lte(alerts.createdAt, outcomeWindowEnd)
          )
        );

      const hadFall = actualAlerts.some((a) => a.type === "fall_detected");
      const hadCritical = actualAlerts.some((a) => a.severity === "critical");

      // Log outcome for future causal calibration (DoWhy/EconML Phase 12)
      await db.insert(healthTimeline).values({
        id: crypto.randomUUID(),
        userId,
        occurredAt: new Date(),
        source: "outcome_resolved",
        domain: "twin",
        metadata: {
          predictedCompositeRisk: meta.compositeRisk,
          actualFall: hadFall,
          actualCriticalEvent: hadCritical,
          windowDays: OUTCOME_WINDOW_DAYS,
          resolvedAt: new Date().toISOString(),
        },
      });

      resolved++;
    } catch (err: unknown) {
      console.error(
        `[outcomeResolver] Error resolving outcome for user ${event.userId.slice(0, 8)}…:`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

    console.log(`[outcomeResolver] Done. Resolved ${resolved} outcomes.`);
  } finally {
    // Always release the lock — a DB error on the outer pastEvents query must not
    // hold the lock for the full 4-hour LOCK_STALE_MS window.
    releaseLock();
  }
}

if (import.meta.main) {
  runOutcomeResolverCycle()
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      console.error("[outcomeResolver] Fatal error:", err instanceof Error ? err.message : String(err));
      releaseLock();
      process.exit(1);
    });
}
