/**
 * Autonomous Health Agent Cycle
 *
 * Runs every 15 minutes. For each active patient enrolled in an org:
 *
 *   SENSE   — Gather signals: new anomalies, missed meds, vital sync gaps
 *   REASON  — Assess severity delta vs. last cycle, compute triage level
 *   DECIDE  — Determine action: none / nudge patient / create task / escalate
 *   ACT     — Execute: write task to Firestore, fire webhook, send push
 *   VERIFY  — Update agent state with outcomes; schedule next cycle
 *
 * Patient is skipped if:
 *   - Agent already ran within the last 12 minutes (debounce)
 *   - Patient has no active consent for the org
 *   - Org is not active
 *
 * Tasks created here have source = "agent" and are picked up by the
 * coordinator task queue in the org dashboard.
 */

import {
  FieldValue,
  getFirestore,
  Timestamp,
} from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { createTraceId } from "../observability/correlation";
import { logger } from "../observability/logger";
import { sendPushNotificationInternal } from "../services/notifications";

const db = () => getFirestore();

// ─── Constants ────────────────────────────────────────────────────────────────

const CYCLE_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const DEBOUNCE_MS = 12 * 60 * 1000; // skip if ran within 12 min
const MAX_PATIENTS_PER_CYCLE = 500; // safety cap per run
const ANOMALY_LOOKBACK_MS = 20 * 60 * 1000; // 20 min — just past one cycle
const MED_LOOKBACK_HOURS = 8; // missed-med lookback window
const VITAL_STALE_HOURS = 24; // hours before "no recent sync" alert

// Risk thresholds that drive triage decisions
const SCORE_ESCALATE = 75; // → alert provider + create urgent task
const SCORE_TASK = 45; // → create normal task for coordinator
// Nudge (push-only) fires on single warning anomaly or first missed med (no score gate)

// ─── Types ────────────────────────────────────────────────────────────────────

type PatientSignals = {
  userId: string;
  orgId: string;
  newAnomalies: { id: string; severity: string; vitalType: string }[];
  missedMedCount: number;
  vitalStaleSince: Date | null; // null if synced recently
  riskScore: number; // from patient_roster
};

type TriageLevel = "none" | "nudge" | "task" | "escalate";

type AgentDecision = {
  level: TriageLevel;
  reasoning: string;
  taskTitle?: string;
  taskPriority?: "urgent" | "high" | "normal" | "low";
  nudgeMessage?: string;
};

// ─── SENSE ────────────────────────────────────────────────────────────────────

async function sensePatient(
  orgId: string,
  userId: string,
  lastCycleAt: Date
): Promise<PatientSignals> {
  const sinceNew = lastCycleAt.getTime() < Date.now() - ANOMALY_LOOKBACK_MS
    ? lastCycleAt
    : new Date(Date.now() - ANOMALY_LOOKBACK_MS);

  const medLookback = new Date(Date.now() - MED_LOOKBACK_HOURS * 60 * 60 * 1000);
  const vitalCutoff = new Date(Date.now() - VITAL_STALE_HOURS * 60 * 60 * 1000);

  const [anomalySnap, missedMedSnap, recentVitalSnap, rosterSnap] =
    await Promise.all([
      // New anomalies since last cycle
      db()
        .collection("users")
        .doc(userId)
        .collection("anomalies")
        .where("detectedAt", ">=", Timestamp.fromDate(sinceNew))
        .get(),

      // Medications with missed doses recently
      db()
        .collection("medications")
        .where("userId", "==", userId)
        .where("status", "==", "active")
        .where("lastMissedAt", ">=", Timestamp.fromDate(medLookback))
        .get(),

      // Most recent vital to check staleness
      db()
        .collection("vitals")
        .where("userId", "==", userId)
        .orderBy("timestamp", "desc")
        .limit(1)
        .get(),

      // Risk score from roster
      db()
        .collection("patient_roster")
        .doc(`${orgId}_${userId}`)
        .get(),
    ]);

  const newAnomalies = anomalySnap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      severity: (data.severity as string) ?? "warning",
      vitalType: (data.vitalType as string) ?? "unknown",
    };
  });

  const missedMedCount = missedMedSnap.size;

  let vitalStaleSince: Date | null = null;
  if (recentVitalSnap.empty) {
    vitalStaleSince = new Date(0); // no vitals ever
  } else {
    const lastTs = recentVitalSnap.docs[0].data().timestamp;
    const lastVital: Date =
      lastTs && typeof lastTs.toDate === "function"
        ? lastTs.toDate()
        : new Date(lastTs as string);
    if (lastVital < vitalCutoff) {
      vitalStaleSince = lastVital;
    }
  }

  const riskScore = (rosterSnap.data()?.riskScore as number) ?? 0;

  return { userId, orgId, newAnomalies, missedMedCount, vitalStaleSince, riskScore };
}

// ─── REASON ───────────────────────────────────────────────────────────────────

function reasonAndDecide(signals: PatientSignals): AgentDecision {
  const criticalAnomalies = signals.newAnomalies.filter(
    (a) => a.severity === "critical"
  );
  const warningAnomalies = signals.newAnomalies.filter(
    (a) => a.severity === "warning"
  );

  // Escalation path: critical anomaly or very high risk score
  if (criticalAnomalies.length > 0 || signals.riskScore >= SCORE_ESCALATE) {
    const reasons: string[] = [];
    if (criticalAnomalies.length > 0) {
      reasons.push(
        `${criticalAnomalies.length} critical vital anomal${criticalAnomalies.length === 1 ? "y" : "ies"}`
      );
    }
    if (signals.riskScore >= SCORE_ESCALATE) {
      reasons.push(`risk score ${signals.riskScore}`);
    }
    if (signals.missedMedCount > 0) {
      reasons.push(`${signals.missedMedCount} missed medication${signals.missedMedCount > 1 ? "s" : ""}`);
    }

    return {
      level: "escalate",
      reasoning: reasons.join("; "),
      taskTitle: `Critical review needed — ${reasons[0]}`,
      taskPriority: "urgent",
    };
  }

  // Task path: warning anomalies, missed meds, stale vitals, elevated risk
  const taskReasons: string[] = [];
  if (warningAnomalies.length >= 2) {
    taskReasons.push(`${warningAnomalies.length} warning anomalies`);
  }
  if (signals.missedMedCount >= 2) {
    taskReasons.push(`${signals.missedMedCount} missed medications`);
  }
  if (signals.vitalStaleSince !== null) {
    taskReasons.push("no recent vital sync");
  }
  if (signals.riskScore >= SCORE_TASK) {
    taskReasons.push(`risk score ${signals.riskScore}`);
  }

  if (taskReasons.length > 0) {
    const priority = signals.riskScore >= 60 || signals.missedMedCount >= 3
      ? "high"
      : "normal";

    return {
      level: "task",
      reasoning: taskReasons.join("; "),
      taskTitle: `Follow-up required — ${taskReasons[0]}`,
      taskPriority: priority,
    };
  }

  // Nudge path: mild single warning or first missed med
  if (warningAnomalies.length === 1 || signals.missedMedCount === 1) {
    const reason = warningAnomalies.length === 1
      ? `${warningAnomalies[0].vitalType} anomaly detected`
      : "medication was missed";

    return {
      level: "nudge",
      reasoning: reason,
      nudgeMessage: `Your health monitor noticed something. Tap to review your recent readings.`,
    };
  }

  return { level: "none", reasoning: "no actionable signals" };
}

// ─── ACT ──────────────────────────────────────────────────────────────────────

async function act(
  signals: PatientSignals,
  decision: AgentDecision,
  traceId: string
): Promise<{ taskId?: string }> {
  const { userId, orgId } = signals;
  let taskId: string | undefined;

  if (decision.level === "none") return {};

  // ── Patient nudge (push notification) ────────────────────────────────────
  if (decision.level === "nudge" && decision.nudgeMessage) {
    sendPushNotificationInternal({
      traceId,
      userIds: [userId],
      notification: {
        title: "Health Update",
        body: decision.nudgeMessage,
        priority: "normal",
        data: {
          type: "agent_nudge",
          orgId,
        },
      },
      notificationType: "general",
      requireAuth: false,
    }).catch(() => {}); // fire-and-forget
  }

  // ── Create task (task + escalate) ────────────────────────────────────────
  if (decision.level === "task" || decision.level === "escalate") {
    const taskData = {
      orgId,
      patientId: userId,
      assignedBy: "agent",
      type: "follow_up" as const,
      priority: decision.taskPriority ?? "normal",
      source: "agent" as const,
      status: "open" as const,
      title: decision.taskTitle ?? "Agent follow-up",
      description: `Automated agent detected: ${decision.reasoning}`,
      context: {
        reasonForTask: decision.reasoning,
        riskScore: signals.riskScore,
        relatedAnomalyId: signals.newAnomalies[0]?.id,
      },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      completedAt: null,
      completedBy: null,
      assignedTo: null,
      dueAt: null,
    };

    const taskRef = await db().collection("tasks").add(taskData);
    taskId = taskRef.id;

    logger.info("Agent created task", {
      traceId,
      orgId,
      userId,
      taskId,
      priority: decision.taskPriority,
      level: decision.level,
      fn: "agentCycle.act",
    });
  }

  // ── Push alert to org (escalation only) ──────────────────────────────────
  if (decision.level === "escalate") {
    // Find assigned providers for this patient from the org roster
    const rosterSnap = await db()
      .collection("patient_roster")
      .doc(`${orgId}_${userId}`)
      .get();

    const assignedProviders =
      (rosterSnap.data()?.assignedProviders as string[]) ?? [];

    if (assignedProviders.length > 0) {
      sendPushNotificationInternal({
        traceId,
        userIds: assignedProviders,
        notification: {
          title: "Patient Alert — Urgent Review",
          body: `Your patient needs urgent attention: ${decision.reasoning}`,
          priority: "high",
          data: {
            type: "agent_escalation",
            orgId,
            patientId: userId,
            taskId: taskId ?? "",
          },
        },
        notificationType: "general",
        requireAuth: false,
      }).catch(() => {});
    }
  }

  return { taskId };
}

// ─── VERIFY ───────────────────────────────────────────────────────────────────

async function verify(
  orgId: string,
  userId: string,
  decision: AgentDecision,
  outcome: { taskId?: string },
  cycleStartedAt: Date
): Promise<void> {
  const stateId = `${orgId}_${userId}`;
  const now = new Date();
  const nextCycleAt = new Date(now.getTime() + CYCLE_INTERVAL_MS);

  const actionEntry = {
    type: decision.level === "none" ? "no_action" : decision.level === "nudge"
      ? "patient_nudge"
      : decision.level === "task"
        ? "task_created"
        : "escalation_triggered",
    timestamp: Timestamp.fromDate(cycleStartedAt),
    reasoning: decision.reasoning,
    outcome: "success",
    taskId: outcome.taskId ?? null,
  };

  await db()
    .collection("patient_agent_state")
    .doc(stateId)
    .set(
      {
        orgId,
        userId,
        lastCycleAt: Timestamp.fromDate(cycleStartedAt),
        nextCycleAt: Timestamp.fromDate(nextCycleAt),
        openActionsCount: outcome.taskId ? FieldValue.increment(1) : 0,
        agentNotes: `Last cycle ${now.toISOString()}: ${decision.reasoning}`,
        actionHistory: FieldValue.arrayUnion(actionEntry),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
}

// ─── Scheduled Job ─────────────────────────────────────────────────────────────

/**
 * Runs every 15 minutes.
 * Iterates all active org enrollments and runs the agent loop per patient.
 */
export const agentCycle = onSchedule(
  {
    schedule: "every 15 minutes",
    timeoutSeconds: 540, // 9 minutes max
    memory: "512MiB",
  },
  async () => {
    const traceId = createTraceId();
    const cycleStartedAt = new Date();

    logger.info("Agent cycle started", { traceId, fn: "agentCycle" });

    try {
      // Find all active patient roster entries across all orgs
      const rosterSnap = await db()
        .collection("patient_roster")
        .where("status", "==", "active")
        .limit(MAX_PATIENTS_PER_CYCLE)
        .get();

      logger.info("Agent cycle patients found", {
        traceId,
        count: rosterSnap.size,
        fn: "agentCycle",
      });

      // Load all agent states in one batch query
      const stateIds = rosterSnap.docs.map(
        (d) => `${d.data().orgId}_${d.data().userId}`
      );

      const stateSnaps = await Promise.all(
        stateIds.map((id) =>
          db().collection("patient_agent_state").doc(id).get()
        )
      );

      const stateMap = new Map(
        stateSnaps.map((s) => [s.id, s.exists ? s.data() : null])
      );

      const now = Date.now();

      // Process each patient (concurrently, capped at 20 at a time)
      const entries = rosterSnap.docs;
      const CONCURRENCY = 20;

      for (let i = 0; i < entries.length; i += CONCURRENCY) {
        const batch = entries.slice(i, i + CONCURRENCY);

        await Promise.allSettled(
          batch.map(async (rosterDoc) => {
            const roster = rosterDoc.data();
            const orgId = roster.orgId as string;
            const userId = roster.userId as string;
            const stateId = `${orgId}_${userId}`;

            // Debounce: skip if we ran too recently
            const state = stateMap.get(stateId);
            if (state?.lastCycleAt) {
              const lastCycleMs: number =
                typeof state.lastCycleAt.toDate === "function"
                  ? state.lastCycleAt.toDate().getTime()
                  : new Date(state.lastCycleAt as string).getTime();
              if (now - lastCycleMs < DEBOUNCE_MS) return;
            }

            // Verify active consent
            const consentSnap = await db()
              .collection("consents")
              .doc(userId)
              .collection("organizations")
              .doc(orgId)
              .get();

            if (!consentSnap.exists || !consentSnap.data()?.isActive) return;

            const lastCycleAt = state?.lastCycleAt
              ? typeof state.lastCycleAt.toDate === "function"
                ? state.lastCycleAt.toDate()
                : new Date(state.lastCycleAt as string)
              : new Date(now - CYCLE_INTERVAL_MS);

            // SENSE → REASON → DECIDE → ACT → VERIFY
            const signals = await sensePatient(orgId, userId, lastCycleAt);
            const decision = reasonAndDecide(signals);
            const outcome = await act(signals, decision, traceId);
            await verify(orgId, userId, decision, outcome, cycleStartedAt);

            logger.info("Agent patient cycle complete", {
              traceId,
              orgId,
              userId,
              level: decision.level,
              fn: "agentCycle",
            });
          })
        );
      }

      logger.info("Agent cycle completed", {
        traceId,
        processed: entries.length,
        fn: "agentCycle",
      });
    } catch (err) {
      logger.error("Agent cycle failed", err as Error, {
        traceId,
        fn: "agentCycle",
      });
    }
  }
);
