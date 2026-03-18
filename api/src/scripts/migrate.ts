/**
 * Firestore → Neon Migration Script
 *
 * Migrates all health data from Firebase Firestore to Neon PostgreSQL.
 * Run once during Infra-C. Safe to re-run (all inserts use ON CONFLICT DO NOTHING).
 *
 * Usage:
 *   FIREBASE_SERVICE_ACCOUNT_PATH=./service-account.json \
 *   DATABASE_URL=postgres://... \
 *   bun run src/scripts/migrate.ts
 *
 * Optional env vars:
 *   MIGRATE_COLLECTION=users   — migrate only one collection (for testing)
 *   MIGRATE_BATCH_SIZE=500     — Firestore read batch size (default 500)
 *   DRY_RUN=true               — log what would be migrated without writing
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import crypto from "node:crypto";
import * as schema from "../db/schema.js";

// ── Setup ─────────────────────────────────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is required");

const SERVICE_ACCOUNT_PATH =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? "./service-account.json";

const BATCH_SIZE = Number(process.env.MIGRATE_BATCH_SIZE ?? 500);
const DRY_RUN = process.env.DRY_RUN === "true";
const ONLY_COLLECTION = process.env.MIGRATE_COLLECTION;

if (!getApps().length) {
  const serviceAccount = await import(SERVICE_ACCOUNT_PATH, { assert: { type: "json" } });
  initializeApp({ credential: cert(serviceAccount.default) });
}

const firestoreDb = getFirestore();
const pgClient = postgres(DATABASE_URL, { max: 5 });
const db = drizzle(pgClient, { schema });

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert Firestore Timestamp or Date to JS Date */
function toDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === "string") {
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === "object" && "_seconds" in (val as object)) {
    return new Timestamp(
      (val as { _seconds: number })._seconds,
      (val as { _nanoseconds: number })._nanoseconds ?? 0
    ).toDate();
  }
  return null;
}

/** Batch-read an entire Firestore collection, calling `onBatch` for each page */
async function readCollection(
  collectionPath: string,
  onBatch: (docs: FirebaseFirestore.QueryDocumentSnapshot[]) => Promise<void>
): Promise<number> {
  let total = 0;
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  while (true) {
    let q: FirebaseFirestore.Query = firestoreDb
      .collection(collectionPath)
      .orderBy("__name__")
      .limit(BATCH_SIZE);
    if (lastDoc) q = q.startAfter(lastDoc);

    const snap = await q.get();
    if (snap.empty) break;

    await onBatch(snap.docs);
    total += snap.docs.length;
    lastDoc = snap.docs[snap.docs.length - 1];
    console.log(`  [${collectionPath}] read ${total} so far…`);

    if (snap.docs.length < BATCH_SIZE) break;
  }

  return total;
}

/** Log + conditionally skip the write */
function maybeInsert<T>(table: string, records: T[]): T[] {
  if (DRY_RUN) {
    console.log(`  [DRY_RUN] Would insert ${records.length} rows into ${table}`);
    return [];
  }
  return records;
}

// ── Per-collection migrators ──────────────────────────────────────────────────

async function migrateUsers(): Promise<number> {
  console.log("\n── Migrating users ──");
  let count = 0;

  await readCollection("users", async (docs) => {
    const rows = docs.map((doc) => {
      const d = doc.data();
      const firstName: string = d.firstName || (d.name?.split(" ")[0]) || "User";
      const lastName: string = d.lastName || (d.name?.split(" ").slice(1).join(" ")) || "";
      const emergencyContacts = Array.isArray(d.preferences?.emergencyContacts)
        ? d.preferences.emergencyContacts : [];
      const firstContact = emergencyContacts[0];

      return {
        id: doc.id,
        email: d.email ?? `migrated-${doc.id}@nuralix.internal`,
        name: `${firstName} ${lastName}`.trim(),
        phone: d.phoneNumber ?? null,
        gender: d.gender ?? null,
        language: d.preferences?.language ?? "en",
        familyId: d.familyId ?? null,
        avatarUrl: d.avatar ?? null,
        emergencyContactName: firstContact?.name ?? null,
        emergencyContactPhone: firstContact?.phone ?? null,
        createdAt: toDate(d.createdAt) ?? new Date(),
        updatedAt: new Date(),
      };
    });

    const toWrite = maybeInsert("users", rows);
    if (toWrite.length) {
      await db.insert(schema.users).values(toWrite).onConflictDoNothing();
      count += toWrite.length;
    }
  });

  return count;
}

async function migrateFamilies(): Promise<number> {
  console.log("\n── Migrating families ──");
  let count = 0;

  await readCollection("families", async (docs) => {
    const familyRows: typeof schema.families.$inferInsert[] = [];
    const memberRows: typeof schema.familyMembers.$inferInsert[] = [];

    for (const doc of docs) {
      const d = doc.data();
      familyRows.push({
        id: doc.id,
        name: d.name ?? "My Family",
        createdBy: d.createdBy ?? (d.members?.[0] ?? "unknown"),
        createdAt: toDate(d.createdAt) ?? new Date(),
      });

      // Members array in Firestore families doc
      const members: string[] = d.members ?? [];
      const adminId: string | null = d.adminId ?? d.createdBy ?? null;
      for (const userId of members) {
        memberRows.push({
          id: crypto.randomUUID(),
          familyId: doc.id,
          userId,
          role: userId === adminId ? "admin" : "member",
          joinedAt: toDate(d.createdAt) ?? new Date(),
        });
      }
    }

    const familiesToWrite = maybeInsert("families", familyRows);
    const membersToWrite = maybeInsert("family_members", memberRows);

    if (familiesToWrite.length) {
      await db.insert(schema.families).values(familiesToWrite).onConflictDoNothing();
      count += familiesToWrite.length;
    }
    if (membersToWrite.length) {
      await db.insert(schema.familyMembers).values(membersToWrite).onConflictDoNothing();
    }
  });

  return count;
}

async function migrateVitals(): Promise<number> {
  console.log("\n── Migrating vitals ──");
  let count = 0;

  await readCollection("vitals", async (docs) => {
    const rows = docs
      .map((doc) => {
        const d = doc.data();
        const recordedAt = toDate(d.recordedAt ?? d.timestamp ?? d.createdAt);
        if (!recordedAt || !d.userId || !d.type) return null;

        return {
          id: doc.id,
          userId: d.userId,
          type: d.type,
          value: d.value != null ? String(d.value) : null,
          valueSecondary: d.valueSecondary != null ? String(d.valueSecondary) : null,
          unit: d.unit ?? null,
          source: d.source ?? "manual",
          recordedAt,
          metadata: d.metadata ?? null,
          createdAt: toDate(d.createdAt) ?? recordedAt,
        };
      })
      .filter(Boolean) as typeof schema.vitals.$inferInsert[];

    const toWrite = maybeInsert("vitals", rows);
    if (toWrite.length) {
      await db.insert(schema.vitals).values(toWrite).onConflictDoNothing();
      count += toWrite.length;
    }
  });

  return count;
}

async function migrateSymptoms(): Promise<number> {
  console.log("\n── Migrating symptoms ──");
  let count = 0;

  await readCollection("symptoms", async (docs) => {
    const rows = docs
      .map((doc) => {
        const d = doc.data();
        const recordedAt = toDate(d.recordedAt ?? d.timestamp ?? d.createdAt);
        if (!recordedAt || !d.userId || !d.type) return null;

        return {
          id: doc.id,
          userId: d.userId,
          type: d.type,
          severity: d.severity ?? null,
          location: d.location ?? null,
          notes: d.notes ?? null,
          recordedAt,
          createdAt: toDate(d.createdAt) ?? recordedAt,
        };
      })
      .filter(Boolean) as typeof schema.symptoms.$inferInsert[];

    const toWrite = maybeInsert("symptoms", rows);
    if (toWrite.length) {
      await db.insert(schema.symptoms).values(toWrite).onConflictDoNothing();
      count += toWrite.length;
    }
  });

  return count;
}

async function migrateMoods(): Promise<number> {
  console.log("\n── Migrating moods ──");
  let count = 0;

  await readCollection("moods", async (docs) => {
    const rows = docs
      .map((doc) => {
        const d = doc.data();
        const recordedAt = toDate(d.recordedAt ?? d.timestamp ?? d.createdAt);
        if (!recordedAt || !d.userId) return null;

        return {
          id: doc.id,
          userId: d.userId,
          score: d.score ?? d.mood ?? null,
          label: d.label ?? d.emotion ?? null,
          notes: d.notes ?? null,
          recordedAt,
          createdAt: toDate(d.createdAt) ?? recordedAt,
        };
      })
      .filter(Boolean) as unknown as typeof schema.moods.$inferInsert[];

    const toWrite = maybeInsert("moods", rows);
    if (toWrite.length) {
      await db.insert(schema.moods).values(toWrite).onConflictDoNothing();
      count += toWrite.length;
    }
  });

  return count;
}

async function migrateMedications(): Promise<number> {
  console.log("\n── Migrating medications ──");
  let count = 0;

  await readCollection("medications", async (docs) => {
    const rows = docs
      .map((doc) => {
        const d = doc.data();
        if (!d.userId || !d.name) return null;

        return {
          id: doc.id,
          userId: d.userId,
          name: d.name,
          dosage: d.dosage ?? null,
          frequency: d.frequency ?? null,
          isActive: d.isActive ?? d.active ?? true,
          startDate: toDate(d.startDate),
          endDate: toDate(d.endDate),
          instructions: d.instructions ?? null,
          createdAt: toDate(d.createdAt) ?? new Date(),
        };
      })
      .filter(Boolean) as typeof schema.medications.$inferInsert[];

    const toWrite = maybeInsert("medications", rows);
    if (toWrite.length) {
      await db.insert(schema.medications).values(toWrite).onConflictDoNothing();
      count += toWrite.length;
    }
  });

  // Migrate medication reminders (subcollection or top-level)
  let remindersCount = 0;
  try {
    await readCollection("medication_reminders", async (docs) => {
      const rows = docs
        .map((doc) => {
          const d = doc.data();
          const scheduledAt = toDate(d.scheduledAt ?? d.dueAt);
          if (!scheduledAt || !d.userId || !d.medicationId) return null;

          return {
            id: doc.id,
            medicationId: d.medicationId,
            userId: d.userId,
            scheduledAt,
            status: d.status ?? "pending",
            takenAt: toDate(d.takenAt),
          };
        })
        .filter(Boolean) as typeof schema.medicationReminders.$inferInsert[];

      const toWrite = maybeInsert("medication_reminders", rows);
      if (toWrite.length) {
        await db.insert(schema.medicationReminders).values(toWrite).onConflictDoNothing();
        remindersCount += toWrite.length;
      }
    });
  } catch {
    console.log("  [medications] No top-level medication_reminders collection");
  }

  console.log(`  Migrated ${remindersCount} reminders`);
  return count;
}

async function migrateLabResults(): Promise<number> {
  console.log("\n── Migrating lab results ──");
  let count = 0;

  await readCollection("lab_results", async (docs) => {
    const rows = docs
      .map((doc) => {
        const d = doc.data();
        if (!d.userId || !(d.testName ?? d.name)) return null;

        // Firestore may store individual result OR a panel with a results array
        const resultsArray = Array.isArray(d.results) ? d.results : [
          {
            name: d.testName ?? d.name ?? "Result",
            value: d.value != null ? String(d.value) : "—",
            unit: d.unit ?? undefined,
            referenceRange: d.referenceRange ?? d.normalRange ?? undefined,
            flag: d.flag ?? (d.isAbnormal ? "high" : "normal"),
          },
        ];

        return {
          id: doc.id,
          userId: d.userId,
          testName: d.testName ?? d.name ?? "Lab Result",
          testType: d.testType ?? d.type ?? null,
          testDate: toDate(d.testDate ?? d.resultDate ?? d.date ?? d.createdAt) ?? new Date(),
          orderedBy: d.orderedBy ?? d.doctorName ?? null,
          facility: d.facility ?? d.labName ?? d.lab ?? null,
          results: resultsArray,
          notes: d.notes ?? null,
          attachmentKey: d.attachmentKey ?? d.attachmentUrl ?? null,
          tags: d.tags ?? null,
          createdAt: toDate(d.createdAt) ?? new Date(),
        };
      })
      .filter(Boolean) as typeof schema.labResults.$inferInsert[];

    const toWrite = maybeInsert("lab_results", rows);
    if (toWrite.length) {
      await db.insert(schema.labResults).values(toWrite).onConflictDoNothing();
      count += toWrite.length;
    }
  });

  return count;
}

async function migrateAllergies(): Promise<number> {
  console.log("\n── Migrating allergies ──");
  let count = 0;

  await readCollection("allergies", async (docs) => {
    const rows = docs
      .map((doc) => {
        const d = doc.data();
        if (!d.userId || !d.allergen) return null;

        return {
          id: doc.id,
          userId: d.userId,
          substance: d.allergen ?? d.substance ?? d.name,
          reaction: d.reaction ?? d.symptoms ?? null,
          severity: d.severity ?? null,
          diagnosedDate: toDate(d.diagnosedAt ?? d.diagnosedDate ?? d.date),
          notes: d.notes ?? null,
          createdAt: toDate(d.createdAt) ?? new Date(),
        };
      })
      .filter(Boolean) as typeof schema.allergies.$inferInsert[];

    const toWrite = maybeInsert("allergies", rows);
    if (toWrite.length) {
      await db.insert(schema.allergies).values(toWrite).onConflictDoNothing();
      count += toWrite.length;
    }
  });

  return count;
}

async function migrateMedicalHistory(): Promise<number> {
  console.log("\n── Migrating medical history ──");
  let count = 0;

  // Firestore collection may be "medical_history" or within user docs
  const collections = ["medical_history", "medicalHistory"];
  for (const collName of collections) {
    try {
      await readCollection(collName, async (docs) => {
        const rows = docs
          .map((doc) => {
            const d = doc.data();
            if (!d.userId || !d.condition) return null;

            return {
              id: doc.id,
              userId: d.userId,
              condition: d.condition ?? d.diagnosis ?? d.name,
              diagnosedDate: toDate(d.diagnosedAt ?? d.diagnosedDate ?? d.date),
              severity: d.severity ?? null,
              notes: d.notes ?? null,
              isFamily: d.isFamily ?? false,
              relation: d.relation ?? null,
              tags: d.tags ?? null,
              createdAt: toDate(d.createdAt) ?? new Date(),
            };
          })
          .filter(Boolean) as typeof schema.medicalHistory.$inferInsert[];

        const toWrite = maybeInsert(collName, rows);
        if (toWrite.length) {
          await db.insert(schema.medicalHistory).values(toWrite).onConflictDoNothing();
          count += toWrite.length;
        }
      });
      if (count > 0) break; // found the collection
    } catch {
      // Try next name
    }
  }

  return count;
}

async function migrateAlerts(): Promise<number> {
  console.log("\n── Migrating alerts ──");
  let count = 0;

  // Firestore may use "alerts" or "emergency_alerts"
  const collections = ["alerts", "emergency_alerts"];
  for (const collName of collections) {
    try {
      await readCollection(collName, async (docs) => {
        const rows = docs
          .map((doc) => {
            const d = doc.data();
            if (!d.userId) return null;

            return {
              id: doc.id,
              userId: d.userId,
              familyId: d.familyId ?? null,
              type: d.alertType ?? d.type ?? "general",
              severity: d.severity ?? "medium",
              title: d.title ?? d.message ?? "Alert",
              body: d.body ?? d.message ?? d.description ?? null,
              isAcknowledged: d.isAcknowledged ?? d.acknowledged ?? d.isRead ?? false,
              acknowledgedBy: d.acknowledgedBy ?? null,
              acknowledgedAt: toDate(d.acknowledgedAt),
              resolvedAt: toDate(d.resolvedAt),
              metadata: d.data ?? d.metadata ?? null,
              createdAt: toDate(d.createdAt ?? d.timestamp) ?? new Date(),
            };
          })
          .filter(Boolean) as typeof schema.alerts.$inferInsert[];

        const toWrite = maybeInsert(collName, rows);
        if (toWrite.length) {
          await db.insert(schema.alerts).values(toWrite).onConflictDoNothing();
          count += toWrite.length;
        }
      });
      if (count > 0) break;
    } catch {
      // Try next name
    }
  }

  return count;
}

async function migratePushTokens(): Promise<number> {
  console.log("\n── Migrating push tokens ──");
  let count = 0;

  // Push tokens may be stored in a sub-map in user docs or in a top-level collection
  const collections = ["push_tokens", "pushTokens", "fcm_tokens"];
  for (const collName of collections) {
    try {
      await readCollection(collName, async (docs) => {
        const rows = docs
          .map((doc) => {
            const d = doc.data();
            if (!d.userId || !d.token) return null;

            return {
              id: doc.id,
              userId: d.userId,
              token: d.token,
              platform: d.platform ?? null,
              isActive: d.isActive ?? true,
              updatedAt: toDate(d.updatedAt ?? d.createdAt) ?? new Date(),
            };
          })
          .filter(Boolean) as typeof schema.pushTokens.$inferInsert[];

        const toWrite = maybeInsert(collName, rows);
        if (toWrite.length) {
          await db.insert(schema.pushTokens).values(toWrite).onConflictDoNothing();
          count += toWrite.length;
        }
      });
      if (count > 0) break;
    } catch {
      // Try next name
    }
  }

  return count;
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

const ALL_MIGRATORS: Record<string, () => Promise<number>> = {
  users: migrateUsers,
  families: migrateFamilies,
  vitals: migrateVitals,
  symptoms: migrateSymptoms,
  moods: migrateMoods,
  medications: migrateMedications,
  lab_results: migrateLabResults,
  allergies: migrateAllergies,
  medical_history: migrateMedicalHistory,
  alerts: migrateAlerts,
  push_tokens: migratePushTokens,
};

async function runMigration() {
  console.log("══════════════════════════════════════════");
  console.log("  Firestore → Neon Migration");
  console.log(`  Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log(`  Batch size: ${BATCH_SIZE}`);
  console.log(`  Target: ${DATABASE_URL?.slice(0, 30)}…`);
  console.log("══════════════════════════════════════════");

  const migrators = ONLY_COLLECTION
    ? { [ONLY_COLLECTION]: ALL_MIGRATORS[ONLY_COLLECTION] }
    : ALL_MIGRATORS;

  if (ONLY_COLLECTION && !ALL_MIGRATORS[ONLY_COLLECTION]) {
    console.error(`Unknown collection: ${ONLY_COLLECTION}`);
    console.error(`Available: ${Object.keys(ALL_MIGRATORS).join(", ")}`);
    process.exit(1);
  }

  const results: Record<string, number> = {};
  const errors: Record<string, string> = {};

  for (const [name, migrator] of Object.entries(migrators)) {
    try {
      results[name] = await migrator();
      console.log(`  ✓ ${name}: ${results[name]} rows`);
    } catch (err: any) {
      errors[name] = err?.message ?? String(err);
      console.error(`  ✗ ${name}: ${errors[name]}`);
    }
  }

  console.log("\n══════════════════════════════════════════");
  console.log("  Migration Summary");
  console.log("══════════════════════════════════════════");
  for (const [name, count] of Object.entries(results)) {
    console.log(`  ${name.padEnd(20)} ${count.toLocaleString()} rows`);
  }
  if (Object.keys(errors).length > 0) {
    console.log("\n  FAILURES:");
    for (const [name, msg] of Object.entries(errors)) {
      console.log(`  ✗ ${name}: ${msg}`);
    }
    process.exit(1);
  }

  console.log("\n  Migration complete.");
}

runMigration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal migration error:", err);
    process.exit(1);
  })
  .finally(() => pgClient.end());
