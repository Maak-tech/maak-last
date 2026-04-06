import { pgTable, uuid, varchar, numeric, integer, boolean, timestamp, index } from 'drizzle-orm/pg-core'
import { users } from './users.js'

export const userBaselines = pgTable(
  'user_baselines',
  {
    id:              uuid('id').primaryKey().defaultRandom(),
    userId:          uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    metricType:      varchar('metric_type', { length: 50 }).notNull(),

    mean:            numeric('mean', { precision: 10, scale: 4 }).notNull(),
    stdDev:          numeric('std_dev', { precision: 10, scale: 4 }).notNull(),
    p10:             numeric('p10', { precision: 10, scale: 4 }),
    p25:             numeric('p25', { precision: 10, scale: 4 }),
    p75:             numeric('p75', { precision: 10, scale: 4 }),
    p90:             numeric('p90', { precision: 10, scale: 4 }),
    sampleCount:     integer('sample_count').notNull(),

    computedAt:      timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
    windowStartAt:   timestamp('window_start_at', { withTimezone: true }).notNull(),
    windowEndAt:     timestamp('window_end_at', { withTimezone: true }).notNull(),

    confidenceScore: numeric('confidence_score', { precision: 4, scale: 3 }).notNull().default('0'),
    isStable:        boolean('is_stable').notNull().default(false),
    recomputeReason: varchar('recompute_reason', { length: 100 }),
    // 'scheduled', 'new_medication', 'illness_resolved', 'manual_override'
  },
  (t) => ({
    userMetricIdx: index('idx_baselines_user_metric').on(t.userId, t.metricType),
  }),
)
