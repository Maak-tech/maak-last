/**
 * Outcome Resolver Cycle — runs daily at 06:00 UTC via Railway cron.
 *
 * Closes VHI outcomes from 30 days ago: compares predicted risk trajectories
 * against actual health data to build the learning loop for risk weight calibration.
 */

import crypto from "node:crypto";
import { db } from "../db";
import { healthTimeline, vhi, alerts } from "../db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";

const OUTCOME_WINDOW_DAYS = 30;

async function runOutcomeResolverCycle() {
  console.log(`[outcomeResolver] Starting at ${new Date().toISOString()}`);

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

      // Check what actually happened in the 30 days since prediction
      const actualAlerts = await db
        .select()
        .from(alerts)
        .where(
          and(
            eq(alerts.userId, userId),
            gte(alerts.createdAt, windowStart)
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
    } catch (err) {
      console.error(
        `[outcomeResolver] Error resolving outcome for user ${event.userId}:`,
        err
      );
    }
  }

  console.log(`[outcomeResolver] Done. Resolved ${resolved} outcomes.`);
}

if (import.meta.main) {
  runOutcomeResolverCycle()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[outcomeResolver] Fatal error:", err);
      process.exit(1);
    });
}
