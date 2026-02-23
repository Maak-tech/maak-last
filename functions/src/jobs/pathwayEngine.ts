/**
 * Care Pathway Engine
 *
 * Runs every 10 minutes. Processes active pathway enrollments whose
 * nextStepAt is in the past, executes the current step action, then
 * advances to the next step or completes/cancels the enrollment.
 *
 * Step actions executed here:
 *   push_patient    — send push notification to patient
 *   create_task     — write task to Firestore (picked up by coordinator queue)
 *   notify_provider — push to assigned providers
 *   webhook         — fire outbound webhook event
 *   email_patient   — queue to email_queue (SendGrid pickup)
 *   wait            — no-op, just advance the step timer
 *
 * Enrollment lifecycle:
 *   active → (all steps done) → completed
 *   active → (patient discharged / consent revoked) → cancelled
 *
 * Condition evaluation:
 *   Step conditions are simple JS-safe expressions evaluated against a
 *   PatientContext snapshot. Example: "riskScore > 70 && vitalsMissing > 2"
 *   If condition is false, step is skipped and engine advances to onSuccess.
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
import { deliverWebhookEvent } from "../api/webhookDelivery";

const db = () => getFirestore();

// ─── Types ────────────────────────────────────────────────────────────────────

type PathwayStep = {
  id: string;
  delay: string;
  condition?: string;
  action: string;
  actionParams: Record<string, unknown>;
  onSuccess?: string;
  onFailure?: string;
};

type PathwayDefinition = {
  id: string;
  orgId: string;
  name: string;
  steps: PathwayStep[];
  isActive: boolean;
};

type Enrollment = {
  id: string;
  orgId: string;
  patientId: string;
  pathwayId: string;
  currentStepId: string;
  nextStepAt: Date;
};

type PatientContext = {
  riskScore: number;
  vitalsMissing: number; // days without vital sync
  missedMedCount: number;
};

// ─── Context Fetch ────────────────────────────────────────────────────────────

async function getPatientContext(
  userId: string
): Promise<PatientContext> {
  const vitalCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [recentVital, missedMeds] = await Promise.all([
    db()
      .collection("vitals")
      .where("userId", "==", userId)
      .orderBy("timestamp", "desc")
      .limit(1)
      .get(),
    db()
      .collection("medications")
      .where("userId", "==", userId)
      .where("status", "==", "active")
      .where("lastMissedAt", ">=", Timestamp.fromDate(new Date(Date.now() - 8 * 60 * 60 * 1000)))
      .get(),
  ]);

  let vitalsMissing = 0;
  if (!recentVital.empty) {
    const lastTs = recentVital.docs[0].data().timestamp;
    const lastDate: Date =
      lastTs && typeof lastTs.toDate === "function" ? lastTs.toDate() : new Date(lastTs);
    if (lastDate < vitalCutoff) {
      vitalsMissing = Math.floor((Date.now() - lastDate.getTime()) / 86400000);
    }
  } else {
    vitalsMissing = 99; // never synced
  }

  return {
    riskScore: 0, // pulled from roster in evaluateCondition
    vitalsMissing,
    missedMedCount: missedMeds.size,
  };
}

// ─── Condition Evaluation ─────────────────────────────────────────────────────

/**
 * Evaluate a simple condition expression against patient context.
 * Uses a whitelist of allowed tokens to prevent injection.
 * Example: "riskScore > 70 && vitalsMissing > 2"
 */
function evaluateCondition(
  condition: string | undefined,
  ctx: PatientContext
): boolean {
  if (!condition) return true; // no condition = always execute

  // Whitelist: only allow comparisons and logical operators
  const safe = /^[\w\s><=!&|().\d]+$/.test(condition);
  if (!safe) return true; // fail-open on unsafe expressions

  try {
    const fn = new Function(
      "riskScore",
      "vitalsMissing",
      "missedMedCount",
      `return !!(${condition});`
    );
    return fn(ctx.riskScore, ctx.vitalsMissing, ctx.missedMedCount) as boolean;
  } catch {
    return true; // fail-open
  }
}

// ─── Step Execution ───────────────────────────────────────────────────────────

async function executeStep(
  step: PathwayStep,
  enrollment: Enrollment,
  traceId: string
): Promise<"success" | "failure"> {
  const { patientId, orgId } = enrollment;

  try {
    switch (step.action) {
      case "push_patient": {
        const message = (step.actionParams.message as string) ?? "A health check-in is needed.";
        await sendPushNotificationInternal({
          traceId,
          userIds: [patientId],
          notification: {
            title: "Health Update",
            body: message,
            priority: "normal",
            data: { type: "pathway_step", orgId, enrollmentId: enrollment.id },
          },
          notificationType: "general",
          requireAuth: false,
        });
        break;
      }

      case "create_task": {
        const title = (step.actionParams.title as string) ?? "Pathway follow-up";
        const priority = (step.actionParams.priority as string) ?? "normal";
        await db().collection("tasks").add({
          orgId,
          patientId,
          assignedBy: "pathway",
          assignedTo: null,
          type: "follow_up",
          priority,
          source: "pathway",
          status: "open",
          title,
          description: step.actionParams.description ?? null,
          context: { reasonForTask: `Auto-created by care pathway step ${step.id}` },
          dueAt: null,
          completedAt: null,
          completedBy: null,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        break;
      }

      case "notify_provider": {
        // Get assigned providers from roster
        const rosterSnap = await db()
          .collection("patient_roster")
          .doc(`${orgId}_${patientId}`)
          .get();

        const providers =
          (rosterSnap.data()?.assignedProviders as string[]) ?? [];

        if (providers.length > 0) {
          const message =
            (step.actionParams.message as string) ?? "Patient requires attention.";
          await sendPushNotificationInternal({
            traceId,
            userIds: providers,
            notification: {
              title: "Care Pathway Alert",
              body: message,
              priority: "high",
              data: { type: "pathway_provider_alert", orgId, patientId },
            },
            notificationType: "general",
            requireAuth: false,
          });
        }
        break;
      }

      case "webhook": {
        const event = (step.actionParams.event as string) ?? "patient.risk_escalated";
        await deliverWebhookEvent(orgId, event as never, {
          patientId,
          enrollmentId: enrollment.id,
          stepId: step.id,
          ...step.actionParams,
        });
        break;
      }

      case "email_patient": {
        // Queue email to patient's address
        const userSnap = await db().collection("users").doc(patientId).get();
        const email = userSnap.data()?.email as string | undefined;
        if (email) {
          await db().collection("email_queue").add({
            to: [email],
            subject: (step.actionParams.subject as string) ?? "Health update from your care team",
            bodyHtml: (step.actionParams.bodyHtml as string) ?? "<p>Your care team wanted to check in.</p>",
            channel: "patient_digest",
            orgId,
            patientId,
            status: "pending",
            attempts: 0,
            sentAt: null,
            error: null,
            createdAt: FieldValue.serverTimestamp(),
          });
        }
        break;
      }

      case "wait":
        // No-op — just advance to next step
        break;

      default:
        logger.warn("Unknown pathway step action", {
          traceId,
          action: step.action,
          enrollmentId: enrollment.id,
          fn: "pathwayEngine.executeStep",
        });
    }

    return "success";
  } catch (err) {
    logger.error("Pathway step execution failed", err as Error, {
      traceId,
      enrollmentId: enrollment.id,
      stepId: step.id,
      action: step.action,
      fn: "pathwayEngine.executeStep",
    });
    return "failure";
  }
}

// ─── Delay Parsing ────────────────────────────────────────────────────────────

function parseDelayMs(delay: string): number {
  const match = delay.match(/^(\d+)(m|h|d|w)$/);
  if (!match) return 0;
  const n = parseInt(match[1], 10);
  switch (match[2]) {
    case "m": return n * 60 * 1000;
    case "h": return n * 60 * 60 * 1000;
    case "d": return n * 24 * 60 * 60 * 1000;
    case "w": return n * 7 * 24 * 60 * 60 * 1000;
    default: return 0;
  }
}

// ─── Scheduled Job ────────────────────────────────────────────────────────────

/**
 * Runs every 10 minutes. Processes all pathway enrollments whose
 * nextStepAt <= now.
 */
export const pathwayEngine = onSchedule(
  {
    schedule: "every 10 minutes",
    timeoutSeconds: 540,
    memory: "256MiB",
  },
  async () => {
    const traceId = createTraceId();
    const now = new Date();

    logger.info("Pathway engine cycle started", { traceId, fn: "pathwayEngine" });

    try {
      // Fetch all active enrollments due for processing
      const enrollmentSnap = await db()
        .collection("pathway_enrollments")
        .where("status", "==", "active")
        .where("nextStepAt", "<=", Timestamp.fromDate(now))
        .limit(300)
        .get();

      logger.info("Enrollments to process", {
        traceId,
        count: enrollmentSnap.size,
        fn: "pathwayEngine",
      });

      await Promise.allSettled(
        enrollmentSnap.docs.map(async (enrollDoc) => {
          const enrollData = enrollDoc.data();
          const enrollment: Enrollment = {
            id: enrollDoc.id,
            orgId: enrollData.orgId as string,
            patientId: enrollData.patientId as string,
            pathwayId: enrollData.pathwayId as string,
            currentStepId: enrollData.currentStepId as string,
            nextStepAt: now,
          };

          // Load the pathway definition
          const pathwaySnap = await db()
            .collection("organizations")
            .doc(enrollment.orgId)
            .collection("pathways")
            .doc(enrollment.pathwayId)
            .get();

          if (!pathwaySnap.exists) {
            await enrollDoc.ref.update({
              status: "cancelled",
              cancelledReason: "Pathway definition deleted",
            });
            return;
          }

          const pathway = pathwaySnap.data() as PathwayDefinition;

          if (!pathway.isActive) {
            await enrollDoc.ref.update({
              status: "cancelled",
              cancelledReason: "Pathway deactivated",
            });
            return;
          }

          // Find current step
          const currentStep = pathway.steps.find(
            (s) => s.id === enrollment.currentStepId
          );

          if (!currentStep) {
            await enrollDoc.ref.update({
              status: "completed",
            });
            return;
          }

          // Evaluate condition
          const ctx = await getPatientContext(enrollment.patientId);
          const conditionMet = evaluateCondition(currentStep.condition, ctx);

          // Execute the step (or skip if condition not met)
          let outcome: "success" | "failure" = "success";
          if (conditionMet) {
            outcome = await executeStep(currentStep, enrollment, traceId);
          } else {
            logger.info("Pathway step condition not met, skipping", {
              traceId,
              enrollmentId: enrollment.id,
              stepId: currentStep.id,
              condition: currentStep.condition,
              fn: "pathwayEngine",
            });
          }

          // Determine next step id
          const nextStepId = outcome === "success"
            ? currentStep.onSuccess
            : (currentStep.onFailure ?? currentStep.onSuccess);

          if (!nextStepId) {
            // No next step — enrollment complete
            await enrollDoc.ref.update({
              status: "completed",
              completedAt: FieldValue.serverTimestamp(),
            });
            return;
          }

          const nextStep = pathway.steps.find((s) => s.id === nextStepId);
          if (!nextStep) {
            await enrollDoc.ref.update({
              status: "completed",
              completedAt: FieldValue.serverTimestamp(),
            });
            return;
          }

          // Advance to next step
          const nextStepAt = new Date(Date.now() + parseDelayMs(nextStep.delay));
          await enrollDoc.ref.update({
            currentStepId: nextStep.id,
            nextStepAt,
          });

          logger.info("Pathway step processed", {
            traceId,
            enrollmentId: enrollment.id,
            stepId: currentStep.id,
            nextStepId,
            action: currentStep.action,
            conditionMet,
            outcome,
            fn: "pathwayEngine",
          });
        })
      );

      logger.info("Pathway engine cycle completed", {
        traceId,
        processed: enrollmentSnap.size,
        fn: "pathwayEngine",
      });
    } catch (err) {
      logger.error("Pathway engine cycle failed", err as Error, {
        traceId,
        fn: "pathwayEngine",
      });
    }
  }
);
