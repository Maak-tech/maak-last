/**
 * Unit tests for applyNoraGuardrails.
 *
 * These tests run fully offline — no DB, no LLM, no network.
 * The guardrail logic is pure synchronous so no mocking is required beyond
 * silencing the logger.
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

import { applyNoraGuardrails } from '../lib/noraGuardrails';

describe('applyNoraGuardrails', () => {
  // ── 1. Emergency symptom in English ─────────────────────────────────────
  it('returns isEmergency: true when user message contains "chest pain"', () => {
    const result = applyNoraGuardrails(
      'Your heart rate looks normal.',
      'I have chest pain and shortness of breath.',
      'en',
    );

    expect(result.isEmergency).toBe(true);
    expect(result.safe).toBe(false);
    expect(result.flaggedPatterns).toContain('emergency_symptom');
    // Must include an emergency contact number
    expect(result.output).toMatch(/911|999|112/);
  });

  // ── 2. Emergency symptom in Arabic ──────────────────────────────────────
  it('returns Arabic emergency message when locale is "ar"', () => {
    const result = applyNoraGuardrails(
      'معدل ضربات قلبك طبيعي.',
      'أشعر بألم في الصدر وصعوبة في التنفس.',
      'ar',
    );

    expect(result.isEmergency).toBe(true);
    expect(result.safe).toBe(false);
    // The Arabic emergency response string from the source contains "طوارئ"
    expect(result.output).toMatch(/طوارئ/);
  });

  // ── 3. Diagnosis claim in LLM response ──────────────────────────────────
  it('flags a diagnosis claim in the LLM response', () => {
    const result = applyNoraGuardrails(
      'Based on your glucose readings, you have diabetes and should monitor daily.',
      'What do my glucose readings mean?',
      'en',
    );

    expect(result.safe).toBe(false);
    expect(result.isEmergency).toBe(false);
    expect(result.flaggedPatterns.length).toBeGreaterThan(0);
    // Output should still contain the original text (with disclaimer appended)
    expect(result.output).toContain('you have diabetes');
    // A disclaimer must be appended
    expect(result.output).toMatch(/not medical advice/i);
  });

  // ── 4. Medication recommendation in LLM response ────────────────────────
  it('flags a medication recommendation in the LLM response', () => {
    const result = applyNoraGuardrails(
      'You should take ibuprofen 400 mg twice a day for the pain.',
      'My knee hurts, what should I do?',
      'en',
    );

    expect(result.safe).toBe(false);
    expect(result.flaggedPatterns.length).toBeGreaterThan(0);
    expect(result.output).toMatch(/not medical advice/i);
  });

  // ── 5. Safe general response ─────────────────────────────────────────────
  it('passes through a safe, non-clinical response unchanged', () => {
    const safeResponse = 'Great job staying active! Keep up the good work.';
    const result = applyNoraGuardrails(
      safeResponse,
      'How am I doing this week?',
      'en',
    );

    expect(result.safe).toBe(true);
    expect(result.isEmergency).toBe(false);
    expect(result.flaggedPatterns).toHaveLength(0);
    expect(result.output).toBe(safeResponse);
  });

  // ── 6. Empty response ────────────────────────────────────────────────────
  it('handles an empty LLM response without throwing', () => {
    expect(() => {
      const result = applyNoraGuardrails('', 'Hello', 'en');
      expect(result).toBeDefined();
      // Empty response has no clinical claims → should be safe
      expect(result.isEmergency).toBe(false);
    }).not.toThrow();
  });

  // ── 7. Emergency detection is driven by the USER message, not the response
  it('ignores emergency keywords that appear only in the LLM response', () => {
    // The LLM mentions "chest pain" in its response text but the user's message is benign
    const result = applyNoraGuardrails(
      'If you ever experience chest pain, call emergency services.',
      'Give me general health tips.',
      'en',
    );

    // Should NOT trigger emergency — only user message is scanned for emergency patterns
    expect(result.isEmergency).toBe(false);
  });
});
