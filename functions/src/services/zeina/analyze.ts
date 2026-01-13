/**
 * Zeina AI Analysis Core
 * Provides intelligent analysis of patient alerts with risk scoring and recommendations
 * 
 * Current Implementation: Deterministic rule-based analysis (stub)
 * Future: Can be replaced with OpenAI GPT integration
 */

import { logger } from '../../observability/logger';
import type { AlertSeverity, VitalType } from '../../db/firestore';
import type { VitalsSummary } from '../../modules/vitals/recentSummary';

/**
 * Alert information for analysis
 */
export interface AlertInfo {
  type: 'vital' | 'symptom' | 'fall' | 'trend' | 'medication';
  severity: AlertSeverity;
  title: string;
  body: string;
  data: {
    vitalType?: VitalType | string;
    value?: number;
    unit?: string;
    direction?: 'low' | 'high';
    symptomType?: string;
    symptomSeverity?: number;
    trendType?: string;
    [key: string]: any;
  };
}

/**
 * Analysis input parameters
 */
export interface ZeinaAnalysisInput {
  patientId: string;
  alert: AlertInfo;
  recentVitalsSummary?: VitalsSummary;
  patientContext?: {
    age?: number;
    gender?: string;
    medicalHistory?: string[];
    medications?: string[];
  };
  traceId?: string;
}

/**
 * Risk score (0-100)
 * 0-30: Low risk
 * 31-60: Moderate risk
 * 61-85: High risk
 * 86-100: Critical risk
 */
export type RiskScore = number;

/**
 * Recommended actions
 */
export interface RecommendedAction {
  priority: 'immediate' | 'high' | 'moderate' | 'low';
  action: string;
  rationale?: string;
}

/**
 * Zeina analysis result
 */
export interface ZeinaAnalysisResult {
  riskScore: RiskScore;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  summary: string;
  recommendedActions: RecommendedAction[];
  analysisMetadata: {
    analysisType: 'deterministic' | 'ai';
    version: string;
    timestamp: Date;
  };
}

/**
 * Calculate risk score based on alert severity and type
 */
function calculateBaseRiskScore(alert: AlertInfo): number {
  let score = 0;

  // Base score from severity
  switch (alert.severity) {
    case 'critical':
      score = 80;
      break;
    case 'warning':
      score = 50;
      break;
    case 'info':
      score = 20;
      break;
    default:
      score = 30;
  }

  // Adjust based on alert type
  switch (alert.type) {
    case 'fall':
      score += 15; // Falls are always serious
      break;
    case 'vital':
      // Check if vital is critical (heart rate, oxygen)
      if (alert.data.vitalType === 'heartRate' || 
          alert.data.vitalType === 'oxygenSaturation') {
        score += 10;
      }
      break;
    case 'symptom':
      // High severity symptoms are concerning
      if (alert.data.symptomSeverity && alert.data.symptomSeverity >= 8) {
        score += 15;
      }
      break;
    case 'trend':
      score += 5; // Trends indicate ongoing issues
      break;
  }

  // Cap at 100
  return Math.min(score, 100);
}

/**
 * Adjust risk score based on vitals trends
 */
function adjustRiskScoreWithVitals(baseScore: number, vitals?: VitalsSummary): number {
  if (!vitals) {
    return baseScore;
  }

  let adjustment = 0;

  // Multiple increasing trends = higher risk
  const increasingTrends = Object.values(vitals).filter(
    v => v && typeof v === 'object' && v.trend === 'increasing'
  ).length;

  if (increasingTrends >= 2) {
    adjustment += 10;
  }

  // Critical vital values
  if (vitals.heartRate && (vitals.heartRate.current > 150 || vitals.heartRate.current < 40)) {
    adjustment += 15;
  }

  if (vitals.oxygenSaturation && vitals.oxygenSaturation.current < 90) {
    adjustment += 20;
  }

  if (vitals.bodyTemperature && vitals.bodyTemperature.current > 39) {
    adjustment += 10;
  }

  // Cap at 100
  return Math.min(baseScore + adjustment, 100);
}

/**
 * Determine risk level from score
 */
function getRiskLevel(score: number): 'low' | 'moderate' | 'high' | 'critical' {
  if (score >= 86) return 'critical';
  if (score >= 61) return 'high';
  if (score >= 31) return 'moderate';
  return 'low';
}

/**
 * Generate summary text
 */
function generateSummary(alert: AlertInfo, riskScore: number, vitals?: VitalsSummary): string {
  const riskLevel = getRiskLevel(riskScore);
  
  let summary = `${riskLevel.toUpperCase()} RISK: `;

  switch (alert.type) {
    case 'vital':
      summary += `${alert.data.vitalType} ${alert.data.direction} threshold detected (${alert.data.value} ${alert.data.unit}).`;
      if (vitals) {
        const vitalKey = alert.data.vitalType as string;
        const vitalData = vitals[vitalKey];
        if (vitalData?.trend) {
          summary += ` Recent trend: ${vitalData.trend}.`;
        }
      }
      break;

    case 'fall':
      summary += `Potential fall detected. Immediate attention required.`;
      break;

    case 'symptom':
      summary += `Patient reported ${alert.data.symptomType}`;
      if (alert.data.symptomSeverity) {
        summary += ` with severity ${alert.data.symptomSeverity}/10`;
      }
      summary += `.`;
      break;

    case 'trend':
      summary += `Concerning trend identified in ${alert.data.trendType}.`;
      break;

    case 'medication':
      summary += `Medication-related alert.`;
      break;

    default:
      summary += alert.body;
  }

  return summary;
}

/**
 * Generate recommended actions
 */
function generateRecommendedActions(
  alert: AlertInfo, 
  riskScore: number, 
  vitals?: VitalsSummary
): RecommendedAction[] {
  const actions: RecommendedAction[] = [];
  const riskLevel = getRiskLevel(riskScore);

  // Immediate actions for critical risk
  if (riskLevel === 'critical' || alert.severity === 'critical') {
    actions.push({
      priority: 'immediate',
      action: 'Contact patient immediately to assess condition',
      rationale: 'Critical alert requires immediate response',
    });

    if (alert.type === 'fall') {
      actions.push({
        priority: 'immediate',
        action: 'Check for injuries and ensure patient safety',
        rationale: 'Falls can result in serious injuries',
      });
    }

    if (alert.type === 'vital') {
      if (alert.data.vitalType === 'heartRate' || alert.data.vitalType === 'oxygenSaturation') {
        actions.push({
          priority: 'immediate',
          action: 'Consider calling emergency services if unable to reach patient',
          rationale: 'Critical vital signs may indicate medical emergency',
        });
      }
    }
  }

  // High priority actions
  if (riskLevel === 'high' || riskLevel === 'critical') {
    actions.push({
      priority: 'high',
      action: 'Review recent vital trends and medication compliance',
      rationale: 'Identify potential causes of alert',
    });

    if (alert.type === 'vital') {
      actions.push({
        priority: 'high',
        action: `Schedule follow-up measurement of ${alert.data.vitalType}`,
        rationale: 'Verify reading and monitor for improvement',
      });
    }

    if (vitals && Object.keys(vitals).length > 0) {
      const concerningVitals = Object.entries(vitals)
        .filter(([_, v]) => v && typeof v === 'object' && v.trend === 'increasing')
        .map(([key]) => key);

      if (concerningVitals.length > 0) {
        actions.push({
          priority: 'high',
          action: `Monitor increasing trends in: ${concerningVitals.join(', ')}`,
          rationale: 'Multiple increasing trends may indicate deteriorating condition',
        });
      }
    }
  }

  // Moderate priority actions
  if (riskLevel === 'moderate' || riskLevel === 'high') {
    actions.push({
      priority: 'moderate',
      action: 'Document alert in patient care log',
      rationale: 'Maintain comprehensive health record',
    });

    if (alert.type === 'symptom') {
      actions.push({
        priority: 'moderate',
        action: 'Ask patient about symptom progression and any other symptoms',
        rationale: 'Gather complete symptom picture',
      });
    }

    actions.push({
      priority: 'moderate',
      action: 'Assess need for medical consultation',
      rationale: 'Determine if professional medical review is needed',
    });
  }

  // Low priority actions (always include)
  actions.push({
    priority: 'low',
    action: 'Update family members on patient status',
    rationale: 'Keep care team informed',
  });

  if (vitals) {
    actions.push({
      priority: 'low',
      action: 'Continue regular vital monitoring schedule',
      rationale: 'Maintain baseline health tracking',
    });
  }

  return actions;
}

/**
 * Analyze patient alert with AI-powered risk assessment
 * 
 * Current Implementation: Deterministic rule-based analysis
 * Future Enhancement: Replace with OpenAI GPT API integration
 * 
 * @param input - Analysis input parameters
 * @returns Analysis result with risk score, summary, and recommendations
 */
export async function analyze(input: ZeinaAnalysisInput): Promise<ZeinaAnalysisResult> {
  const traceId = input.traceId || Math.random().toString(36).substring(2, 15);

  logger.info('Zeina analysis started', {
    traceId,
    patientId: input.patientId,
    alertType: input.alert.type,
    alertSeverity: input.alert.severity,
    fn: 'zeina.analyze',
  });

  try {
    // Calculate base risk score from alert
    const baseRiskScore = calculateBaseRiskScore(input.alert);

    // Adjust risk score with vitals trends
    const riskScore = adjustRiskScoreWithVitals(baseRiskScore, input.recentVitalsSummary);

    // Determine risk level
    const riskLevel = getRiskLevel(riskScore);

    // Generate summary
    const summary = generateSummary(input.alert, riskScore, input.recentVitalsSummary);

    // Generate recommended actions
    const recommendedActions = generateRecommendedActions(
      input.alert, 
      riskScore, 
      input.recentVitalsSummary
    );

    logger.info('Zeina analysis completed', {
      traceId,
      patientId: input.patientId,
      riskScore,
      riskLevel,
      actionCount: recommendedActions.length,
      fn: 'zeina.analyze',
    });

    return {
      riskScore,
      riskLevel,
      summary,
      recommendedActions,
      analysisMetadata: {
        analysisType: 'deterministic',
        version: '1.0.0',
        timestamp: new Date(),
      },
    };

  } catch (error) {
    logger.error('Zeina analysis failed', error as Error, {
      traceId,
      patientId: input.patientId,
      fn: 'zeina.analyze',
    });

    // Return safe fallback result
    return {
      riskScore: 50,
      riskLevel: 'moderate',
      summary: 'Unable to complete detailed analysis. Please review alert manually.',
      recommendedActions: [
        {
          priority: 'high',
          action: 'Review alert details and patient history',
          rationale: 'Automated analysis unavailable',
        },
      ],
      analysisMetadata: {
        analysisType: 'deterministic',
        version: '1.0.0',
        timestamp: new Date(),
      },
    };
  }
}
