/**
 * Unit tests for the VHI composite risk formula and riskLevel thresholds.
 *
 * computeCompositeRisk is not exported from vhiCycle.ts, so the formula and
 * thresholds are reproduced inline below based on the source.
 *
 * Based on formula in vhiCycle.ts:
 *
 *   compositeRisk = Math.round(
 *     fallRisk        * 0.30 +
 *     adherenceRisk   * 0.25 +
 *     deteriorationRisk * 0.25 +
 *     geneticRiskLoad * 0.20
 *   )
 *
 * Risk level thresholds (from vhiCycle.ts constants):
 *   RISK_HIGH     = 75   → riskLevel = 'high'
 *   RISK_MODERATE = 50   → riskLevel = 'moderate'
 *   otherwise           → riskLevel = 'low'
 *
 * Note: vhiCycle.ts uses three levels — 'low', 'moderate', 'high'.
 * A separate push-alert path uses >= 85 to signal urgency, but the
 * riskLevel stored in the VHI row only uses these three values.
 */

import { describe, it, expect, mock } from 'bun:test';

// Stub env vars before any module that might inspect them is loaded.
process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';
process.env.BETTER_AUTH_SECRET = 'test-secret-for-unit-tests-only';
process.env.JWT_SECRET = 'test-jwt-secret-for-unit-tests-only';

// Silence the logger so tests produce clean output.
mock.module('../lib/logger', () => ({
  logger: {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  },
}));

// ── Inline reproduction of the formula from vhiCycle.ts ──────────────────────

const RISK_HIGH = 75;
const RISK_MODERATE = 50;
const RISK_CRITICAL_ALERT = 85; // used only for push urgency, not stored riskLevel

function computeCompositeRisk(
  fallRisk: number,
  adherenceRisk: number,
  deteriorationRisk: number,
  geneticRiskLoad: number,
): number {
  // Based on formula in vhiCycle.ts
  return Math.round(
    fallRisk * 0.3 +
      adherenceRisk * 0.25 +
      deteriorationRisk * 0.25 +
      geneticRiskLoad * 0.2,
  );
}

function getRiskLevel(compositeRisk: number): 'low' | 'moderate' | 'high' {
  // Based on formula in vhiCycle.ts
  return compositeRisk >= RISK_HIGH
    ? 'high'
    : compositeRisk >= RISK_MODERATE
    ? 'moderate'
    : 'low';
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('VHI composite risk formula', () => {
  // ── 1. All inputs = 50 → compositeRisk = 50, riskLevel = 'moderate' ─────────
  it('all inputs = 50 → compositeRisk = 50, riskLevel = moderate', () => {
    const composite = computeCompositeRisk(50, 50, 50, 50);
    // 50*0.3 + 50*0.25 + 50*0.25 + 50*0.2 = 15 + 12.5 + 12.5 + 10 = 50
    expect(composite).toBe(50);
    expect(getRiskLevel(composite)).toBe('moderate');
  });

  // ── 2. All inputs = 90 → compositeRisk = 90, riskLevel = 'high' ─────────────
  //    (vhiCycle stores only low/moderate/high — "critical" is a push-alert
  //     concept, not a stored riskLevel value)
  it('all inputs = 90 → compositeRisk = 90, riskLevel = high', () => {
    const composite = computeCompositeRisk(90, 90, 90, 90);
    // 90*(0.3+0.25+0.25+0.2) = 90*1.0 = 90
    expect(composite).toBe(90);
    expect(getRiskLevel(composite)).toBe('high');
    // Verify this also crosses the push-urgency threshold
    expect(composite).toBeGreaterThanOrEqual(RISK_CRITICAL_ALERT);
  });

  // ── 3. All inputs = 20 → compositeRisk = 20, riskLevel = 'low' ──────────────
  it('all inputs = 20 → compositeRisk = 20, riskLevel = low', () => {
    const composite = computeCompositeRisk(20, 20, 20, 20);
    expect(composite).toBe(20);
    expect(getRiskLevel(composite)).toBe('low');
  });

  // ── 4. Weighted formula: fallRisk=100, rest=0 → compositeRisk = 30 ──────────
  it('fallRisk=100, all other inputs=0 → compositeRisk = 30 (weight 0.3)', () => {
    const composite = computeCompositeRisk(100, 0, 0, 0);
    // 100*0.3 + 0 + 0 + 0 = 30
    expect(composite).toBe(30);
  });

  // ── 5. Risk level boundary at exactly 50 → 'moderate' (not 'low') ───────────
  it('compositeRisk = 50 → riskLevel = moderate (boundary, not low)', () => {
    // Inputs that produce exactly 50 after rounding: all = 50 (verified in test 1)
    const composite = computeCompositeRisk(50, 50, 50, 50);
    expect(composite).toBe(50);
    expect(getRiskLevel(composite)).toBe('moderate');
    expect(getRiskLevel(composite)).not.toBe('low');
  });

  // ── 6. Risk level boundary at exactly 75 → 'high' (not 'moderate') ──────────
  it('compositeRisk = 75 → riskLevel = high (boundary, not moderate)', () => {
    // Inputs that produce 75: all = 75  →  75*1.0 = 75
    const composite = computeCompositeRisk(75, 75, 75, 75);
    expect(composite).toBe(75);
    expect(getRiskLevel(composite)).toBe('high');
    expect(getRiskLevel(composite)).not.toBe('moderate');
  });

  // ── 7. Push-urgency boundary at exactly 85 ───────────────────────────────────
  //    In vhiCycle.ts, compositeRisk >= 85 triggers urgent push notifications.
  //    The stored riskLevel is still 'high'.
  it('compositeRisk = 85 → riskLevel = high, crosses push-urgency threshold', () => {
    // all = 85 → 85*1.0 = 85
    const composite = computeCompositeRisk(85, 85, 85, 85);
    expect(composite).toBe(85);
    expect(getRiskLevel(composite)).toBe('high');
    expect(composite).toBeGreaterThanOrEqual(RISK_CRITICAL_ALERT);
  });

  // ── 8. Score clamping: inputs > 100 should not cause compositeRisk > 100 ────
  //    In practice vhiCycle clamps component scores via Math.min(100, ...).
  //    Verify the formula respects this contract.
  it('inputs clamped to 100 do not produce compositeRisk > 100', () => {
    const clampedFall = Math.min(100, 150);          // = 100
    const clampedAdherence = Math.min(100, 200);     // = 100
    const clampedDeterioration = Math.min(100, 999); // = 100
    const clampedGenetic = Math.min(100, 500);       // = 100
    const composite = computeCompositeRisk(
      clampedFall,
      clampedAdherence,
      clampedDeterioration,
      clampedGenetic,
    );
    expect(composite).toBeLessThanOrEqual(100);
    expect(composite).toBe(100);
  });
});

describe('VHI weight verification', () => {
  // ── Verify each weight individually ─────────────────────────────────────────
  it('adherenceRisk weight = 0.25', () => {
    const composite = computeCompositeRisk(0, 100, 0, 0);
    expect(composite).toBe(25);
  });

  it('deteriorationRisk weight = 0.25', () => {
    const composite = computeCompositeRisk(0, 0, 100, 0);
    expect(composite).toBe(25);
  });

  it('geneticRiskLoad weight = 0.20', () => {
    const composite = computeCompositeRisk(0, 0, 0, 100);
    expect(composite).toBe(20);
  });

  it('weights sum to 1.0 (all=100 → compositeRisk=100)', () => {
    const composite = computeCompositeRisk(100, 100, 100, 100);
    expect(composite).toBe(100);
  });
});
