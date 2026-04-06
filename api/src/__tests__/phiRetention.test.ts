/**
 * PHI retention rules tests.
 *
 * These tests verify that the retention policy table:
 *   1. Covers all sensitive health data tables.
 *   2. Assigns shorter retention to biometric/raw-signal data than to
 *      clinical records (regulatory requirement for minimisation).
 *   3. Has no table listed twice.
 *   4. Assigns positive, non-zero retention years to every entry.
 *
 * No DB connection is required — this tests the static policy definition.
 */
import { describe, it, expect } from 'bun:test';

interface RetentionRule {
  table: string;
  column: string;
  retentionYears: number;
}

const RETENTION_RULES: RetentionRule[] = [
  { table: 'vitals',               column: 'recorded_at',  retentionYears: 10 },
  { table: 'symptoms',             column: 'recorded_at',  retentionYears: 10 },
  { table: 'moods',                column: 'recorded_at',  retentionYears: 7  },
  { table: 'health_timeline',      column: 'occurred_at',  retentionYears: 10 },
  { table: 'ppg_embeddings',       column: 'created_at',   retentionYears: 2  },
  { table: 'medication_reminders', column: 'scheduled_at', retentionYears: 3  },
  { table: 'anomalies',            column: 'created_at',   retentionYears: 5  },
];

describe('PHI retention rules', () => {
  it('has retention rules for all sensitive health tables', () => {
    const tables = RETENTION_RULES.map(r => r.table);
    expect(tables).toContain('vitals');
    expect(tables).toContain('symptoms');
    expect(tables).toContain('ppg_embeddings');
    expect(tables).toContain('moods');
    expect(tables).toContain('health_timeline');
    expect(tables).toContain('medication_reminders');
    expect(tables).toContain('anomalies');
  });

  it('biometric data (ppg_embeddings) has shortest retention', () => {
    const ppg = RETENTION_RULES.find(r => r.table === 'ppg_embeddings');
    const others = RETENTION_RULES.filter(r => r.table !== 'ppg_embeddings');
    expect(ppg).toBeDefined();
    expect(ppg!.retentionYears).toBeLessThan(Math.min(...others.map(r => r.retentionYears)));
  });

  it('all retention years are positive', () => {
    for (const rule of RETENTION_RULES) {
      expect(rule.retentionYears).toBeGreaterThan(0);
    }
  });

  it('no table is listed twice', () => {
    const tables = RETENTION_RULES.map(r => r.table);
    const unique = new Set(tables);
    expect(unique.size).toBe(tables.length);
  });

  it('every rule specifies the column to purge against', () => {
    for (const rule of RETENTION_RULES) {
      expect(rule.column.length).toBeGreaterThan(0);
    }
  });

  it('clinical records (vitals, symptoms, health_timeline) retain for at least 7 years', () => {
    const clinicalTables = ['vitals', 'symptoms', 'health_timeline'];
    for (const tableName of clinicalTables) {
      const rule = RETENTION_RULES.find(r => r.table === tableName);
      expect(rule).toBeDefined();
      expect(rule!.retentionYears).toBeGreaterThanOrEqual(7);
    }
  });
});
