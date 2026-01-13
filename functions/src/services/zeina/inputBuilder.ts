/**
 * Input Builder: PHI → AI-safe context
 * 
 * PHI BOUNDARY ENFORCEMENT:
 * This module is the ONLY place where raw AlertContext (with PHI) is processed.
 * Output (ZeinaInput) contains ZERO PHI and is safe to send to external LLMs.
 * 
 * Transformations:
 * - Exact values → Bucketed levels (high/normal/low)
 * - Exact age → Age groups (child/adult/senior)
 * - Counts → Boolean flags
 * - IDs stripped (only used for backend correlation, never sent to AI)
 */

import { logger } from '../../observability/logger';
import type { AlertContext, ZeinaInput } from './types';

/**
 * Bucket vital values into normalized levels
 * Removes exact measurements while preserving medical relevance
 */
function bucketVitalValue(
  vitalType: string,
  value?: number
): 'very_low' | 'low' | 'normal' | 'high' | 'very_high' | undefined {
  if (value === undefined) return undefined;

  // Define normal ranges and thresholds
  const ranges: Record<string, { veryLow: number; low: number; high: number; veryHigh: number }> = {
    heartRate: { veryLow: 40, low: 50, high: 100, veryHigh: 150 },
    oxygenSaturation: { veryLow: 85, low: 90, high: 100, veryHigh: 101 }, // 101 impossible
    bodyTemperature: { veryLow: 35, low: 36, high: 38, veryHigh: 39.5 },
    respiratoryRate: { veryLow: 8, low: 12, high: 20, veryHigh: 30 },
    // Blood pressure is typically stored as systolic/diastolic, handle separately
  };

  const range = ranges[vitalType];
  if (!range) {
    // Unknown vital type, use generic bucketing
    return 'normal';
  }

  if (value < range.veryLow) return 'very_low';
  if (value < range.low) return 'low';
  if (value <= range.high) return 'normal';
  if (value <= range.veryHigh) return 'high';
  return 'very_high';
}

/**
 * Convert age to age group
 * Removes exact age while preserving clinically relevant categorization
 */
function ageToGroup(age?: number): 'child' | 'adult' | 'senior' | undefined {
  if (age === undefined) return undefined;
  if (age < 18) return 'child';
  if (age < 65) return 'adult';
  return 'senior';
}

/**
 * Build AI-safe input from raw alert context
 * CRITICAL: This function strips ALL PHI before AI processing
 * 
 * @param context - Raw alert context (may contain PHI)
 * @param traceId - Trace ID for logging (no PHI)
 * @returns ZeinaInput with NO PHI
 */
export function buildZeinaInput(context: AlertContext, traceId: string): ZeinaInput {
  logger.debug('Building AI-safe input', {
    traceId,
    alertId: context.alertId,
    alertType: context.alertType,
    fn: 'zeina.inputBuilder.buildZeinaInput',
  });

  const input: ZeinaInput = {
    alertType: context.alertType,
    severity: context.severity,
  };

  // Bucket vital information
  if (context.vitalType) {
    input.vitalType = context.vitalType;
    input.vitalLevel = bucketVitalValue(context.vitalType, context.vitalValue);
  }

  // Include trend (already categorical)
  if (context.trend) {
    input.trend = context.trend;
  }

  // Convert age to age group
  if (context.patientAge !== undefined) {
    input.ageGroup = ageToGroup(context.patientAge);
  }

  // Gender is non-identifying
  if (context.patientGender) {
    input.gender = context.patientGender;
  }

  // Convert counts to boolean flags
  input.hasMedications = (context.medicationCount ?? 0) > 0;
  input.hasConditions = (context.conditionCount ?? 0) > 0;

  // Build generic context string (no PHI)
  const contextParts: string[] = [];
  
  if (input.ageGroup) {
    contextParts.push(`${input.ageGroup} patient`);
  }
  
  if (input.hasMedications) {
    contextParts.push('on medications');
  }
  
  if (input.hasConditions) {
    contextParts.push('with known conditions');
  }

  if (contextParts.length > 0) {
    input.context = contextParts.join(', ');
  }

  logger.debug('AI-safe input built', {
    traceId,
    alertId: context.alertId,
    hasVitalLevel: !!input.vitalLevel,
    hasAgeGroup: !!input.ageGroup,
    fn: 'zeina.inputBuilder.buildZeinaInput',
  });

  // ASSERTION: At this point, input contains ZERO PHI
  // No exact values, no IDs (except for internal correlation), no names
  return input;
}

/**
 * Build LLM prompt from ZeinaInput
 * This prompt is safe to send to external AI services
 */
export function buildAnalysisPrompt(input: ZeinaInput): string {
  const parts: string[] = [];

  parts.push('Analyze the following health alert and provide a structured response.');
  parts.push('');
  parts.push('ALERT DETAILS:');
  parts.push(`- Type: ${input.alertType}`);
  parts.push(`- Severity: ${input.severity}`);

  if (input.vitalType && input.vitalLevel) {
    parts.push(`- Vital: ${input.vitalType} (${input.vitalLevel})`);
  }

  if (input.trend) {
    parts.push(`- Trend: ${input.trend}`);
  }

  if (input.context) {
    parts.push(`- Context: ${input.context}`);
  }

  parts.push('');
  parts.push('REQUIRED OUTPUT FORMAT (JSON):');
  parts.push('{');
  parts.push('  "riskScore": <number 0-100>,');
  parts.push('  "summary": "<short non-diagnostic summary>",');
  parts.push('  "recommendedActionCode": "<action code>",');
  parts.push('  "escalationLevel": "<none|caregiver|emergency>"');
  parts.push('}');
  parts.push('');
  parts.push('ACTION CODES:');
  parts.push('- MONITOR: Continue monitoring');
  parts.push('- CHECK_VITALS: Recheck vital signs');
  parts.push('- CONTACT_PATIENT: Contact patient for assessment');
  parts.push('- NOTIFY_CAREGIVER: Notify caregiver team');
  parts.push('- REVIEW_MEDICATIONS: Review medication regimen');
  parts.push('- IMMEDIATE_ATTENTION: Requires immediate attention');
  parts.push('');
  parts.push('ESCALATION LEVELS:');
  parts.push('- none: Informational only');
  parts.push('- caregiver: Notify caregiver team');
  parts.push('- emergency: Immediate medical attention needed');
  parts.push('');
  parts.push('RULES:');
  parts.push('- Summary must be non-diagnostic (no medical diagnoses)');
  parts.push('- Summary must be under 100 characters');
  parts.push('- Always include all required fields');
  parts.push('- Response must be valid JSON');

  return parts.join('\n');
}
