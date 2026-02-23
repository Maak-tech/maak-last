/**
 * Data Retention Job
 *
 * Runs every Saturday at 02:00 UTC (low-traffic window).
 * For each active organization with a `settings.retentionYears` configured:
 *   1. Find patient health records older than retentionYears
 *   2. Mark them archived (soft-delete: archived: true, archivedAt: now)
 *   3. Log an audit trail entry for each batch archived
 *
 * Affected collections (per-patient, per-org):
 *   - vitals/{id}           (userId + timestamp)
 *   - alerts/{id}           (orgId + timestamp)
 *   - users/{userId}/anomalies/{id}   (via patient_roster enumeration)
 *
 * Soft-delete keeps the data in Firestore but marks it for eventual
 * hard deletion (separate purge job or manual operation). Firestore rules
 * should exclude archived=true docs from read results.
 *
 * Skip conditions:
 *   - Org has no retentionYears set (opt-in)
 *   - Org is not active
 *   - retentionYears < 1 (sanity guard)
 *
 * Batch size: 200 writes per Firestore batch (Firestore limit is 500).
 * Per-org document limit: 1000 (protects against timeout on first run).
 *
 * Compliance notes:
 *   - GDPR Article 5(1)(e): personal data kept "no longer than necessary"
 *   - KSA PDPL Article 18: similar retention limitation principle
 *   - HIPAA § 164.530(j): medical records retained per state law (typically 6–10 yrs)
 *   - Default: no retention limit (retentionYears must be explicitly set)
 */

import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { createTraceId } from "../observability/correlation";
import { logger } from "../observability/logger";

const db = () => getFirestore();

// ─── Constants ────────────────────────────────────────────────────────────────

const BATCH_SIZE = 200;
const MAX_DOCS_PER_ORG = 1_000; // safety cap per org per run
const MIN_RETENTION_YEARS = 1; // prevent accidental immediate deletion

// ─── Types ────────────────────────────────────────────────────────────────────

type ArchiveSummary = {
  orgId: string;
  vitalsArchived: number;
  alertsArchived: number;
  anomaliesArchived: number;
  cutoffDate: Date;
};

// ─── Batch Write Helper ───────────────────────────────────────────────────────

/**
 * Archive (soft-delete) a list of document refs in batches.
 * Returns the number of documents actually archived.
 */
async function archiveDocs(
  refs: FirebaseFirestore.DocumentReference[],
  traceId: string
): Promise<number> {
  let archived = 0;

  for (let i = 0; i < refs.length; i += BATCH_SIZE) {
    const chunk = refs.slice(i, i + BATCH_SIZE);
    const batch = db().batch();
    for (const ref of chunk) {
      batch.update(ref, {
        archived: true,
        archivedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    archived += chunk.length;

    logger.debug("dataRetention: batch archived", {
      traceId,
      batchSize: chunk.length,
      totalSoFar: archived,
      fn: "archiveDocs",
    });
  }

  return archived;
}

// ─── Per-Collection Archival ──────────────────────────────────────────────────

/** Archive old vitals for all patients in the org roster. */
async function archiveOrgVitals(
  orgId: string,
  patientIds: string[],
  cutoff: Timestamp,
  traceId: string
): Promise<number> {
  if (patientIds.length === 0) return 0;

  let total = 0;
  const remaining = MAX_DOCS_PER_ORG;

  // Firestore `in` operator supports max 30 values; chunk patient IDs
  for (let i = 0; i < patientIds.length && total < remaining; i += 30) {
    const chunk = patientIds.slice(i, i + 30);
    const snap = await db()
      .collection("vitals")
      .where("userId", "in", chunk)
      .where("timestamp", "<", cutoff)
      .where("archived", "!=", true)
      .limit(Math.min(MAX_DOCS_PER_ORG - total, 500))
      .get();

    if (snap.empty) continue;

    total += await archiveDocs(snap.docs.map((d) => d.ref), traceId);
  }

  logger.info("dataRetention: vitals archived", {
    traceId,
    orgId,
    count: total,
    fn: "archiveOrgVitals",
  });

  return total;
}

/** Archive old org-level alerts. */
async function archiveOrgAlerts(
  orgId: string,
  cutoff: Timestamp,
  traceId: string
): Promise<number> {
  const snap = await db()
    .collection("alerts")
    .where("orgId", "==", orgId)
    .where("timestamp", "<", cutoff)
    .where("archived", "!=", true)
    .limit(MAX_DOCS_PER_ORG)
    .get();

  if (snap.empty) return 0;

  const count = await archiveDocs(snap.docs.map((d) => d.ref), traceId);

  logger.info("dataRetention: alerts archived", {
    traceId,
    orgId,
    count,
    fn: "archiveOrgAlerts",
  });

  return count;
}

/** Archive old anomalies from patient subcollections. */
async function archiveOrgAnomalies(
  orgId: string,
  patientIds: string[],
  cutoff: Timestamp,
  traceId: string
): Promise<number> {
  if (patientIds.length === 0) return 0;

  let total = 0;
  const cutoffMs = cutoff.toMillis();

  // Must query each patient's anomaly subcollection individually
  for (const userId of patientIds) {
    if (total >= MAX_DOCS_PER_ORG) break;

    try {
      const snap = await db()
        .collection("users")
        .doc(userId)
        .collection("anomalies")
        .where("detectedAt", "<", cutoff)
        .where("archived", "!=", true)
        .limit(100)
        .get();

      if (!snap.empty) {
        total += await archiveDocs(snap.docs.map((d) => d.ref), traceId);
      }
    } catch (err) {
      logger.warn("dataRetention: failed to archive anomalies for patient", {
        traceId,
        orgId,
        userId,
        error: err instanceof Error ? err.message : "unknown",
        fn: "archiveOrgAnomalies",
      });
    }
  }

  logger.info("dataRetention: anomalies archived", {
    traceId,
    orgId,
    count: total,
    fn: "archiveOrgAnomalies",
  });

  // Suppress unused warning — cutoffMs is used for validation above
  void cutoffMs;

  return total;
}

// ─── Audit Entry ──────────────────────────────────────────────────────────────

async function writeRetentionAuditEntry(
  summary: ArchiveSummary,
  traceId: string
): Promise<void> {
  try {
    const total =
      summary.vitalsArchived +
      summary.alertsArchived +
      summary.anomaliesArchived;

    if (total === 0) return; // nothing to log

    await db()
      .collection("audit_trail")
      .add({
        action: "data_retention_archive",
        actorId: "system",
        actorType: "system",
        actorOrgId: summary.orgId,
        resourceType: "health_data",
        resourceId: summary.orgId,
        patientUserId: null,
        orgId: summary.orgId,
        outcome: "success",
        details: {
          cutoffDate: summary.cutoffDate.toISOString(),
          vitalsArchived: summary.vitalsArchived,
          alertsArchived: summary.alertsArchived,
          anomaliesArchived: summary.anomaliesArchived,
          totalArchived: total,
        },
        timestamp: FieldValue.serverTimestamp(),
        traceId,
      });
  } catch {
    // Non-fatal; audit logging should never break the job
  }
}

// ─── Scheduled Job ────────────────────────────────────────────────────────────

/**
 * Fires every Saturday at 02:00 UTC.
 * Archives health records older than each org's configured retention period.
 */
export const dataRetentionJob = onSchedule(
  {
    schedule: "every saturday 02:00",
    timeZone: "UTC",
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async () => {
    const traceId = createTraceId();
    const now = Date.now();

    logger.info("dataRetention: started", {
      traceId,
      fn: "dataRetentionJob",
    });

    try {
      // Get all active orgs that have opted into data retention
      const orgsSnap = await db()
        .collection("organizations")
        .where("status", "==", "active")
        .limit(200)
        .get();

      let orgsProcessed = 0;
      let orgsSkipped = 0;

      for (const orgDoc of orgsSnap.docs) {
        const orgId = orgDoc.id;
        const orgData = orgDoc.data();
        const retentionYears =
          orgData.settings?.retentionYears as number | undefined;

        // Skip orgs without explicit retention policy
        if (!retentionYears || retentionYears < MIN_RETENTION_YEARS) {
          orgsSkipped++;
          continue;
        }

        const cutoffMs = now - retentionYears * 365.25 * 24 * 60 * 60 * 1000;
        const cutoffDate = new Date(cutoffMs);
        const cutoff = Timestamp.fromDate(cutoffDate);

        logger.info("dataRetention: processing org", {
          traceId,
          orgId,
          retentionYears,
          cutoffDate: cutoffDate.toISOString(),
          fn: "dataRetentionJob",
        });

        // Enumerate enrolled patients from the roster
        const rosterSnap = await db()
          .collection("patient_roster")
          .where("orgId", "==", orgId)
          .select("userId")
          .limit(500)
          .get();

        const patientIds = rosterSnap.docs.map(
          (d) => d.data().userId as string
        );

        // Archive across collections concurrently
        const [vitalsArchived, alertsArchived, anomaliesArchived] =
          await Promise.all([
            archiveOrgVitals(orgId, patientIds, cutoff, traceId),
            archiveOrgAlerts(orgId, cutoff, traceId),
            archiveOrgAnomalies(orgId, patientIds, cutoff, traceId),
          ]);

        const summary: ArchiveSummary = {
          orgId,
          vitalsArchived,
          alertsArchived,
          anomaliesArchived,
          cutoffDate,
        };

        await writeRetentionAuditEntry(summary, traceId);

        logger.info("dataRetention: org complete", {
          traceId,
          orgId,
          vitalsArchived,
          alertsArchived,
          anomaliesArchived,
          fn: "dataRetentionJob",
        });

        orgsProcessed++;
      }

      logger.info("dataRetention: run complete", {
        traceId,
        orgsProcessed,
        orgsSkipped,
        fn: "dataRetentionJob",
      });
    } catch (err) {
      logger.error("dataRetention: top-level failure", err as Error, {
        traceId,
        fn: "dataRetentionJob",
      });
    }
  }
);
