import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

// ── Job Heartbeats ─────────────────────────────────────────────────────────────
//
// Each cron job upserts a row here on every successful run.
// The /health endpoint (and external monitors like Better Uptime) can query
// this table to detect jobs that have stopped firing.
//
// Expected interval is stored so a monitoring tool can compute "last seen X
// minutes ago vs expected every Y minutes" without hardcoding schedules.
export const jobHeartbeats = pgTable("job_heartbeats", {
  // Stable job identifier — matches the name in railway.json
  jobName: text("job_name").primaryKey(),
  lastRunAt: timestamp("last_run_at").notNull(),
  // How often the job is expected to run (seconds). Allows automated staleness checks.
  expectedIntervalSeconds: integer("expected_interval_seconds").notNull(),
  // Optional: last known exit status ('ok' | 'error') and error message
  status: text("status").notNull().default("ok"), // 'ok' | 'error'
  errorMessage: text("error_message"),
  // Total successful runs since the row was first inserted
  runCount: integer("run_count").notNull().default(1),
});

// ── Job Locks ──────────────────────────────────────────────────────────────────
// Distributed locking for cron jobs that may run on multiple Railway instances.
// Uses an atomic INSERT + PK conflict instead of pg_try_advisory_lock, which is
// session-scoped and therefore does not work with the Neon HTTP driver.
export const jobLocks = pgTable('job_locks', {
  jobName: text('job_name').primaryKey(),
  lockedAt: timestamp('locked_at').notNull().defaultNow(),
  lockedUntil: timestamp('locked_until').notNull(),
  instanceId: text('instance_id').notNull(),
});

// ── Audit Trail ────────────────────────────────────────────────────────────────

export const auditTrail = pgTable(
  "audit_trail",
  {
    id: text("id").primaryKey(),
    userId: text("user_id"),
    actorId: text("actor_id"), // who performed the action
    actorType: text("actor_type"), // 'user' | 'caregiver' | 'org_member' | 'system' | 'api_key'
    action: text("action").notNull(),
    resourceType: text("resource_type"),
    resourceId: text("resource_id"),
    metadata: jsonb("metadata"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [
    index("audit_user_idx").on(t.userId),
    index("audit_actor_idx").on(t.actorId),
    index("audit_user_created_at_idx").on(t.userId, t.createdAt),
  ]
);
