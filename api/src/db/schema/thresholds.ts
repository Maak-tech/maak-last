import { pgTable, uuid, varchar, numeric, boolean, timestamp, unique, index } from 'drizzle-orm/pg-core'
import { users } from './users.js'

export const personalizedThresholds = pgTable(
  'personalized_thresholds',
  {
    id:               uuid('id').primaryKey().defaultRandom(),
    userId:           uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    metricType:       varchar('metric_type', { length: 50 }).notNull(),

    alertLow:         numeric('alert_low', { precision: 10, scale: 4 }),
    alertHigh:        numeric('alert_high', { precision: 10, scale: 4 }),
    criticalLow:      numeric('critical_low', { precision: 10, scale: 4 }),
    criticalHigh:     numeric('critical_high', { precision: 10, scale: 4 }),

    setBy:            varchar('set_by', { length: 20 }).notNull().default('user'),
    // 'user', 'care_team', 'ai_derived', 'population_default'
    setAt:            timestamp('set_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt:        timestamp('expires_at', { withTimezone: true }),

    overridesDefault: boolean('overrides_default').notNull().default(true),
    notes:            varchar('notes', { length: 500 }),
  },
  (t) => ({
    userMetricUniq: unique('uniq_thresholds_user_metric').on(t.userId, t.metricType),
    userIdx:        index('idx_thresholds_user').on(t.userId),
  }),
)
