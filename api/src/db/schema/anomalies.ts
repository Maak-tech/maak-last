import { pgTable, uuid, varchar, numeric, boolean, timestamp, index } from 'drizzle-orm/pg-core'
import { users } from './users.js'
import { sql } from 'drizzle-orm'

export const anomalyEvents = pgTable(
  'anomaly_events',
  {
    id:               uuid('id').primaryKey().defaultRandom(),
    userId:           uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    metricType:       varchar('metric_type', { length: 50 }).notNull(),
    readingId:        uuid('reading_id'),  // FK to vitals or device_readings — optional
    observedValue:    numeric('observed_value', { precision: 12, scale: 4 }).notNull(),
    baselineMean:     numeric('baseline_mean', { precision: 12, scale: 4 }).notNull(),
    baselineStdDev:   numeric('baseline_std_dev', { precision: 12, scale: 4 }).notNull(),
    zScore:           numeric('z_score', { precision: 6, scale: 3 }).notNull(),
    anomalyClass:     varchar('anomaly_class', { length: 50 }).notNull(),
    // 'spike', 'drop', 'sustained_elevation', 'sustained_depression'
    requiresReview:   boolean('requires_review').notNull().default(false),
    detectedAt:       timestamp('detected_at', { withTimezone: true }).notNull().defaultNow(),
    dismissed:        boolean('dismissed').notNull().default(false),
    dismissedAt:      timestamp('dismissed_at', { withTimezone: true }),
    escalationId:     uuid('escalation_id'),
  },
  (t) => ({
    userTimeIdx:    index('idx_anomalies_user_detected').on(t.userId, t.detectedAt),
    reviewIdx:      index('idx_anomalies_requires_review').on(t.requiresReview, t.dismissed).where(sql`requires_review = true AND dismissed = false`),
  }),
)
