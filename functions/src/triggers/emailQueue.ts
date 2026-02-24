/**
 * Email Queue Trigger
 *
 * Fires on every new document written to `email_queue/{jobId}`.
 * Sends the email via SendGrid REST API, then updates the document with
 * the delivery outcome (sent / failed) and increments attempt count.
 *
 * The client-side emailService.ts writes jobs to this collection.
 * Keeping credentials server-side provides a built-in retry queue.
 *
 * Retry policy:
 *   - On failure the document stays with status "failed" and error populated.
 *   - A separate scheduled job (or Firebase Extension) can re-queue failed
 *     jobs by resetting status to "pending", triggering this function again.
 *   - Max attempts is enforced (default 3) to prevent infinite retry loops.
 */

import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { createTraceId } from "../observability/correlation";
import { logger } from "../observability/logger";
import { SENDGRID_API_KEY, SENDGRID_FROM_EMAIL } from "../secrets";

const MAX_ATTEMPTS = 3;

// ─── SendGrid API ─────────────────────────────────────────────────────────────

interface SendGridEmail {
  to: Array<{ email: string }>;
  cc?: Array<{ email: string }>;
  from: { email: string; name: string };
  subject: string;
  content: Array<{ type: string; value: string }>;
}

/**
 * Send an email via the SendGrid REST API.
 * Uses Node 22's built-in fetch — no npm package required.
 */
async function sendViaSendGrid(params: {
  apiKey: string;
  fromEmail: string;
  to: string[];
  cc?: string[];
  subject: string;
  bodyHtml: string;
  bodyText?: string;
}): Promise<void> {
  const payload: SendGridEmail = {
    to: params.to.map((email) => ({ email })),
    from: { email: params.fromEmail, name: "Maak Health" },
    subject: params.subject,
    content: [
      { type: "text/html", value: params.bodyHtml },
      ...(params.bodyText
        ? [{ type: "text/plain", value: params.bodyText }]
        : []),
    ],
  };

  if (params.cc && params.cc.length > 0) {
    payload.cc = params.cc.map((email) => ({ email }));
  }

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "(no body)");
    throw new Error(`SendGrid ${response.status}: ${body}`);
  }
}

// ─── Trigger ──────────────────────────────────────────────────────────────────

export const processEmailQueue = onDocumentCreated(
  {
    document: "email_queue/{jobId}",
    secrets: [SENDGRID_API_KEY, SENDGRID_FROM_EMAIL],
    timeoutSeconds: 30,
    memory: "128MiB",
  },
  async (event) => {
    const traceId = createTraceId();
    const jobId = event.params.jobId;
    const data = event.data?.data();

    if (!data) {
      logger.warn("Email queue: empty document", {
        traceId,
        jobId,
        fn: "processEmailQueue",
      });
      return;
    }

    // Guard: only process pending jobs
    if (data.status !== "pending") {
      logger.debug("Email queue: skipping non-pending job", {
        traceId,
        jobId,
        status: data.status,
        fn: "processEmailQueue",
      });
      return;
    }

    const attempts: number = (data.attempts as number) ?? 0;

    if (attempts >= MAX_ATTEMPTS) {
      logger.warn("Email queue: max attempts reached, abandoning job", {
        traceId,
        jobId,
        attempts,
        fn: "processEmailQueue",
      });
      await event.data?.ref.update({
        status: "failed",
        error: `Max attempts (${MAX_ATTEMPTS}) exceeded`,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return;
    }

    const to = data.to as string[] | undefined;
    const subject = data.subject as string | undefined;
    const bodyHtml = data.bodyHtml as string | undefined;

    if (!(to?.length && subject && bodyHtml)) {
      logger.warn("Email queue: missing required fields", {
        traceId,
        jobId,
        hasTo: !!to?.length,
        hasSubject: !!subject,
        hasBodyHtml: !!bodyHtml,
        fn: "processEmailQueue",
      });
      await event.data?.ref.update({
        status: "failed",
        error: "Missing required fields: to, subject, or bodyHtml",
        updatedAt: FieldValue.serverTimestamp(),
      });
      return;
    }

    const apiKey = SENDGRID_API_KEY.value();
    const fromEmail = SENDGRID_FROM_EMAIL.value() || "noreply@maakhealth.com";

    logger.info("Email queue: sending", {
      traceId,
      jobId,
      channel: data.channel,
      recipientCount: to.length,
      subject,
      fn: "processEmailQueue",
    });

    try {
      await sendViaSendGrid({
        apiKey,
        fromEmail,
        to,
        cc: data.cc as string[] | undefined,
        subject,
        bodyHtml,
        bodyText: data.bodyText as string | undefined,
      });

      await event.data?.ref.update({
        status: "sent",
        sentAt: FieldValue.serverTimestamp(),
        attempts: attempts + 1,
        error: null,
        updatedAt: FieldValue.serverTimestamp(),
      });

      logger.info("Email queue: sent successfully", {
        traceId,
        jobId,
        channel: data.channel,
        recipientCount: to.length,
        fn: "processEmailQueue",
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";

      logger.error("Email queue: send failed", err as Error, {
        traceId,
        jobId,
        channel: data.channel,
        attempts: attempts + 1,
        fn: "processEmailQueue",
      });

      await event.data?.ref.update({
        status: "failed",
        error: errorMsg,
        attempts: attempts + 1,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  }
);

// ─── Retry Scheduler ──────────────────────────────────────────────────────────

import { onSchedule } from "firebase-functions/v2/scheduler";

/**
 * Every hour: reset failed email jobs (< MAX_ATTEMPTS) back to "pending"
 * so the processEmailQueue trigger fires again for a retry.
 */
export const retryFailedEmails = onSchedule(
  {
    schedule: "every 60 minutes",
    timeoutSeconds: 60,
    memory: "128MiB",
  },
  async () => {
    const traceId = createTraceId();
    const db = getFirestore();

    // Retry window: jobs that failed in the last 24h and haven't hit max attempts
    const cutoff = Timestamp.fromDate(
      new Date(Date.now() - 24 * 60 * 60 * 1000)
    );

    const snap = await db
      .collection("email_queue")
      .where("status", "==", "failed")
      .where("attempts", "<", MAX_ATTEMPTS)
      .where("createdAt", ">=", cutoff)
      .limit(50)
      .get();

    if (snap.empty) {
      logger.debug("retryFailedEmails: nothing to retry", {
        traceId,
        fn: "retryFailedEmails",
      });
      return;
    }

    const batch = db.batch();
    for (const doc of snap.docs) {
      batch.update(doc.ref, {
        status: "pending",
        error: null,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();

    logger.info("retryFailedEmails: re-queued jobs", {
      traceId,
      count: snap.size,
      fn: "retryFailedEmails",
    });
  }
);
