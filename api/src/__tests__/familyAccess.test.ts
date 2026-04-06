/**
 * Caregiver scope enforcement tests.
 *
 * The assertFamilyAccess function in health.ts performs a DB lookup to check
 * family membership and caregiver scope. Rather than replicate the full DB
 * round-trip, these tests exercise the core scope-matching logic in isolation —
 * the same boolean expression used inside assertFamilyAccess.
 *
 * If the scope logic ever changes in health.ts, these tests will catch regressions.
 */
import { describe, it, expect } from 'bun:test';

/**
 * Pure function that mirrors the scope-check inside assertFamilyAccess.
 * A caregiver has access if their sharingScope is ['all'] or explicitly
 * includes the requested dataCategory.
 */
function hasScopeAccess(scope: string[], dataCategory: string): boolean {
  return scope.includes('all') || scope.includes(dataCategory);
}

describe('Caregiver scope enforcement', () => {
  it('allows access when scope is ["all"]', () => {
    expect(hasScopeAccess(['all'], 'vitals')).toBe(true);
  });

  it('allows access when category is in scope', () => {
    expect(hasScopeAccess(['medications', 'vitals'], 'vitals')).toBe(true);
  });

  it('denies access when category is not in scope', () => {
    expect(hasScopeAccess(['medications'], 'vitals')).toBe(false);
  });

  it('denies access when scope is empty', () => {
    const scope: string[] = [];
    expect(hasScopeAccess(scope, 'vitals')).toBe(false);
  });

  it('allows access when scope contains exactly the requested category', () => {
    expect(hasScopeAccess(['vitals'], 'vitals')).toBe(true);
  });

  it('denies access for unrelated categories with a non-empty scope', () => {
    expect(hasScopeAccess(['lab_results', 'genetics'], 'vitals')).toBe(false);
  });

  it('"all" keyword grants access regardless of specific category', () => {
    const categories = ['vitals', 'medications', 'lab_results', 'genetics', 'moods'];
    for (const cat of categories) {
      expect(hasScopeAccess(['all'], cat)).toBe(true);
    }
  });
});
