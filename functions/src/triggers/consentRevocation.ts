/**
 * Consent Revocation Trigger
 *
 * Fires whenever a document in `consents/{userId}/organizations/{orgId}`
 * transitions from `isActive: true` → `isActive: false`.
 *
 * On revocation:
 *   1. Archive the patient_roster entry for this org (status → "revoked")
 *   2. Write an append-only HIPAA audit trail entry
 *   3. Queue a confirmation email to the patient (if they have an email)
 *
 * This enforces the data governance requirement that consent revocation
 * immediately restricts org access at the data layer, not just the app layer.
 *
 * The Firestore security rules already gate PHI reads on active consent;
 * this trigger ensures the operational database reflects revocation too.
 */

import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { createTraceId } from "../observability/correlation";
import { logger } from "../observability/logger";

const db = () => getFirestore();

// ─── HTML Email ───────────────────────────────────────────────────────────────

function buildRevocationConfirmationHtml(params: {
  patientFirstName: string;
  orgName: string;
  revokedAt: Date;
}): { subject: string; html: string } {
  const { patientFirstName, orgName, revokedAt } = params;

  const dateStr = revokedAt.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });

  const subject = `Your data access consent for ${orgName} has been revoked`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px">
    <div style="background:#FFF;border-radius:16px;padding:28px;box-shadow:0 1px 3px rgba(0,0,0,0.08)">

      <!-- Header -->
      <div style="margin-bottom:20px">
        <h1 style="margin:0;font-size:18px;font-weight:800;color:#111827">Data Access Consent Revoked</h1>
        <p style="margin:6px 0 0;font-size:13px;color:#9CA3AF">Maak Health · Privacy Confirmation</p>
      </div>

      <p style="font-size:16px;color:#111827;margin:0 0 16px">Hi ${patientFirstName},</p>

      <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 20px">
        This email confirms that you have successfully revoked <strong>${orgName}</strong>'s
        access to your personal health data.
      </p>

      <!-- Details Card -->
      <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:18px;margin:0 0 20px">
        <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#15803D">What happened</p>
        <ul style="margin:0;padding-left:20px;font-size:13px;color:#374151;line-height:1.8">
          <li>Your consent record has been marked as revoked</li>
          <li>${orgName} can no longer read your health data through Maak</li>
          <li>Your enrollment in their patient roster has been archived</li>
          <li>This change took effect on <strong>${dateStr}</strong></li>
        </ul>
      </div>

      <!-- What's retained -->
      <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;padding:18px;margin:0 0 20px">
        <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#92400E">What we retain (legal requirement)</p>
        <p style="margin:0;font-size:13px;color:#374151;line-height:1.6">
          Consent history is preserved for regulatory compliance but marked inactive.
          ${orgName} cannot access your data while consent is revoked.
          If you wish to delete all your data, use the <strong>Delete Account</strong>
          option in your Maak profile settings.
        </p>
      </div>

      <p style="font-size:14px;color:#374151;line-height:1.6;margin:0">
        If you did not intend to revoke consent, you can re-grant it from
        your privacy settings in the Maak app at any time.
      </p>

    </div>

    <div style="margin-top:20px;text-align:center;font-size:12px;color:#9CA3AF">
      <p>Maak Health · Privacy & Data Control</p>
      <p>© ${new Date().getFullYear()} Maak Health. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

  return { subject, html };
}

// ─── Trigger ──────────────────────────────────────────────────────────────────

/**
 * Fires on every update to a consent document.
 * Only acts when the document transitions to isActive: false.
 */
export const onConsentRevoked = onDocumentUpdated(
  {
    document: "consents/{userId}/organizations/{orgId}",
    timeoutSeconds: 30,
    memory: "128MiB",
  },
  async (event) => {
    const traceId = createTraceId();
    const { userId, orgId } = event.params;

    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!(before && after)) return;

    // Only process active → revoked transitions
    const wasActive = before.isActive === true;
    const isNowRevoked = after.isActive === false;

    if (!(wasActive && isNowRevoked)) return;

    logger.info("onConsentRevoked: consent revoked", {
      traceId,
      userId,
      orgId,
      fn: "onConsentRevoked",
    });

    const revokedAt =
      after.revokedAt &&
      typeof (after.revokedAt as { toDate?: () => Date }).toDate === "function"
        ? (after.revokedAt as { toDate: () => Date }).toDate()
        : new Date();

    // Run all side-effects in parallel; individual failures are logged but don't abort others
    await Promise.allSettled([
      archiveRosterEntry(userId, orgId, traceId),
      writeAuditEntry(
        userId,
        orgId,
        after.revokedBy as string | undefined,
        revokedAt,
        traceId
      ),
      sendRevocationEmail(userId, orgId, revokedAt, traceId),
    ]);

    logger.info("onConsentRevoked: side-effects complete", {
      traceId,
      userId,
      orgId,
      fn: "onConsentRevoked",
    });
  }
);

// ─── Side-Effect Helpers ──────────────────────────────────────────────────────

/**
 * Archive the patient_roster entry so the org dashboard removes them.
 * The record is kept for compliance history; only the status changes.
 */
async function archiveRosterEntry(
  userId: string,
  orgId: string,
  traceId: string
): Promise<void> {
  try {
    const rosterId = `${orgId}_${userId}`;
    const rosterRef = db().collection("patient_roster").doc(rosterId);
    const snap = await rosterRef.get();

    if (!snap.exists) {
      // Try query as fallback (roster doc may have a different ID)
      const q = await db()
        .collection("patient_roster")
        .where("orgId", "==", orgId)
        .where("userId", "==", userId)
        .limit(1)
        .get();

      if (!q.empty) {
        await q.docs[0].ref.update({
          status: "revoked",
          revokedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      return;
    }

    await rosterRef.update({
      status: "revoked",
      revokedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info("onConsentRevoked: roster archived", {
      traceId,
      userId,
      orgId,
      fn: "archiveRosterEntry",
    });
  } catch (err) {
    logger.error("onConsentRevoked: failed to archive roster", err as Error, {
      traceId,
      userId,
      orgId,
      fn: "archiveRosterEntry",
    });
  }
}

/**
 * Append an immutable audit trail entry for HIPAA compliance.
 */
async function writeAuditEntry(
  userId: string,
  orgId: string,
  revokedBy: string | undefined,
  revokedAt: Date,
  traceId: string
): Promise<void> {
  try {
    await db()
      .collection("audit_trail")
      .add({
        action: "consent_revoked",
        actorId: revokedBy ?? userId,
        actorType: revokedBy === userId ? "patient" : "system",
        actorOrgId: orgId,
        resourceType: "consent",
        resourceId: `${userId}_${orgId}`,
        patientUserId: userId,
        orgId,
        outcome: "success",
        details: { revokedAt: revokedAt.toISOString() },
        timestamp: FieldValue.serverTimestamp(),
        traceId,
      });

    logger.info("onConsentRevoked: audit entry written", {
      traceId,
      userId,
      orgId,
      fn: "writeAuditEntry",
    });
  } catch (err) {
    logger.error(
      "onConsentRevoked: failed to write audit entry",
      err as Error,
      {
        traceId,
        userId,
        orgId,
        fn: "writeAuditEntry",
      }
    );
  }
}

/**
 * Queue a confirmation email to the patient (if they have an email address).
 */
async function sendRevocationEmail(
  userId: string,
  orgId: string,
  revokedAt: Date,
  traceId: string
): Promise<void> {
  try {
    // Resolve patient and org names in parallel
    const [userSnap, orgSnap] = await Promise.all([
      db().collection("users").doc(userId).get(),
      db().collection("organizations").doc(orgId).get(),
    ]);

    if (!userSnap.exists) return;

    const userData = userSnap.data()!;
    const email = userData.email as string | undefined;
    if (!email) return; // No email, skip silently

    const displayName =
      (userData.displayName as string) ?? (userData.name as string) ?? "there";
    const firstName = displayName.split(" ")[0];

    const orgName = orgSnap.exists
      ? ((orgSnap.data()!.name as string) ?? orgId)
      : orgId;

    const { subject, html } = buildRevocationConfirmationHtml({
      patientFirstName: firstName,
      orgName,
      revokedAt,
    });

    await db()
      .collection("email_queue")
      .add({
        to: [email],
        subject,
        bodyHtml: html,
        channel: "consent_revocation",
        orgId,
        patientUserId: userId,
        status: "pending",
        attempts: 0,
        sentAt: null,
        error: null,
        createdAt: FieldValue.serverTimestamp(),
      });

    logger.info("onConsentRevoked: confirmation email queued", {
      traceId,
      userId,
      orgId,
      fn: "sendRevocationEmail",
    });
  } catch (err) {
    logger.error(
      "onConsentRevoked: failed to queue confirmation email",
      err as Error,
      { traceId, userId, orgId, fn: "sendRevocationEmail" }
    );
  }
}
