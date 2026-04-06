/**
 * Feature flag evaluation tests.
 *
 * The DB is mocked so no live Neon connection is needed.
 * Tests verify the default-false behavior and flag evaluation logic.
 */
import { describe, it, expect, mock } from 'bun:test';

// Stub required env vars before DB module is imported.
process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';
process.env.BETTER_AUTH_SECRET = 'test-secret-for-unit-tests-only';
process.env.JWT_SECRET = 'test-jwt-secret-for-unit-tests-only';

// Mock the DB module — getSession and flag lookups return nothing by default.
mock.module('../db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [],
        }),
      }),
    }),
  },
}));

import { isEnabled, evaluateFlags } from '../lib/featureFlags';

describe('Feature flags', () => {
  it('returns false for unknown flag', async () => {
    // DB mock returns [] (flag not found), so isEnabled must return false.
    const result = await isEnabled('nonexistent_flag_xyz', { userId: 'user123' });
    expect(result).toBe(false);
  });

  it('returns false when called without context', async () => {
    const result = await isEnabled('nonexistent_flag_xyz');
    expect(result).toBe(false);
  });

  it('evaluateFlags returns a map with false for all unknown flags', async () => {
    const result = await evaluateFlags(['flag_a', 'flag_b'], { userId: 'user123' });
    expect(result).toEqual({ flag_a: false, flag_b: false });
  });

  it('evaluateFlags returns empty object for empty input', async () => {
    const result = await evaluateFlags([], { userId: 'user123' });
    expect(result).toEqual({});
  });
});
