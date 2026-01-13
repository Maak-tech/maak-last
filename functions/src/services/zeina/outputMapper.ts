/**
 * Output Mapper: AI → Deterministic Actions
 * 
 * Converts validated ZeinaOutput into concrete backend actions:
 * - Alert routing (who gets notified)
 * - App CTAs (what user should do)
 * - Automated actions (system-level triggers)
 * 
 * This mapping is DETERMINISTIC and AUDITABLE
 */

import { logger } from '../../observability/logger';
import type {
  ZeinaOutput,
  BackendActions,
} from './types';
import {
  RecommendedActionCode,
  EscalationLevel,
} from './types';

/**
 * Map RecommendedActionCode to app CTA
 */
function mapActionCodeToCTA(actionCode: RecommendedActionCode): {
  action: string;
  label: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
} {
  const mapping: Record<RecommendedActionCode, { action: string; label: string; priority: 'low' | 'medium' | 'high' | 'critical' }> = {
    [RecommendedActionCode.MONITOR]: {
      action: 'view_alert',
      label: 'View Details',
      priority: 'low',
    },
    [RecommendedActionCode.CHECK_VITALS]: {
      action: 'record_vitals',
      label: 'Check Vitals',
      priority: 'medium',
    },
    [RecommendedActionCode.RECHECK_IN_1H]: {
      action: 'schedule_recheck',
      label: 'Recheck in 1 Hour',
      priority: 'medium',
    },
    [RecommendedActionCode.RECHECK_IN_24H]: {
      action: 'schedule_recheck',
      label: 'Recheck Tomorrow',
      priority: 'low',
    },
    [RecommendedActionCode.CONTACT_PATIENT]: {
      action: 'call_patient',
      label: 'Contact Patient',
      priority: 'high',
    },
    [RecommendedActionCode.UPDATE_FAMILY]: {
      action: 'notify_family',
      label: 'Update Family',
      priority: 'medium',
    },
    [RecommendedActionCode.NOTIFY_CAREGIVER]: {
      action: 'notify_caregiver',
      label: 'Notify Caregiver',
      priority: 'high',
    },
    [RecommendedActionCode.REVIEW_MEDICATIONS]: {
      action: 'view_medications',
      label: 'Review Medications',
      priority: 'medium',
    },
    [RecommendedActionCode.REVIEW_HISTORY]: {
      action: 'view_history',
      label: 'Review History',
      priority: 'medium',
    },
    [RecommendedActionCode.ASSESS_SYMPTOMS]: {
      action: 'log_symptoms',
      label: 'Assess Symptoms',
      priority: 'medium',
    },
    [RecommendedActionCode.SCHEDULE_CONSULTATION]: {
      action: 'schedule_doctor',
      label: 'Schedule Consultation',
      priority: 'high',
    },
    [RecommendedActionCode.CONSIDER_EMERGENCY]: {
      action: 'emergency_info',
      label: 'Emergency Guidance',
      priority: 'critical',
    },
    [RecommendedActionCode.IMMEDIATE_ATTENTION]: {
      action: 'call_emergency',
      label: 'Immediate Attention',
      priority: 'critical',
    },
  };

  return mapping[actionCode] || mapping[RecommendedActionCode.MONITOR];
}

/**
 * Map EscalationLevel to alert recipients
 */
function mapEscalationToRecipients(
  escalationLevel: EscalationLevel
): ('caregiver' | 'family' | 'emergency')[] {
  switch (escalationLevel) {
    case EscalationLevel.EMERGENCY:
      return ['caregiver', 'family', 'emergency'];
    case EscalationLevel.CAREGIVER:
      return ['caregiver', 'family'];
    case EscalationLevel.NONE:
    default:
      return [];
  }
}

/**
 * Map RecommendedActionCode to automated system actions
 */
function mapActionCodeToAutoActions(actionCode: RecommendedActionCode): string[] {
  const actions: string[] = [];

  // Actions that trigger automated system behavior
  switch (actionCode) {
    case RecommendedActionCode.RECHECK_IN_1H:
      actions.push('schedule_followup_1h');
      break;
    case RecommendedActionCode.RECHECK_IN_24H:
      actions.push('schedule_followup_24h');
      break;
    case RecommendedActionCode.NOTIFY_CAREGIVER:
      actions.push('send_caregiver_notification');
      break;
    case RecommendedActionCode.UPDATE_FAMILY:
      actions.push('send_family_notification');
      break;
    case RecommendedActionCode.IMMEDIATE_ATTENTION:
      actions.push('escalate_to_emergency');
      actions.push('log_critical_event');
      break;
    case RecommendedActionCode.CONSIDER_EMERGENCY:
      actions.push('log_high_risk_event');
      break;
  }

  // Always log the analysis
  actions.push('log_zeina_analysis');

  return actions;
}

/**
 * Map ZeinaOutput to deterministic backend actions
 * 
 * This is the ONLY place where AI output becomes concrete system behavior
 * All mappings are deterministic and auditable
 * 
 * @param output - Validated ZeinaOutput
 * @param traceId - Trace ID for logging
 * @returns BackendActions to execute
 */
export function mapToBackendActions(
  output: ZeinaOutput,
  traceId: string
): BackendActions {
  logger.info('Mapping ZeinaOutput to backend actions', {
    traceId,
    riskScore: output.riskScore,
    escalationLevel: output.escalationLevel,
    actionCode: output.recommendedActionCode,
    fn: 'zeina.outputMapper.mapToBackendActions',
  });

  // Determine if alert should be sent
  const sendAlert = output.escalationLevel !== EscalationLevel.NONE || output.riskScore >= 50;

  // Map escalation level to recipients
  const alertRecipients = mapEscalationToRecipients(output.escalationLevel);

  // Map action code to app CTA
  const appCTA = mapActionCodeToCTA(output.recommendedActionCode);

  // Map action code to automated actions
  const autoActions = mapActionCodeToAutoActions(output.recommendedActionCode);

  const actions: BackendActions = {
    sendAlert,
    alertRecipients,
    appCTA,
    autoActions,
  };

  logger.debug('Backend actions mapped', {
    traceId,
    sendAlert,
    recipientCount: alertRecipients.length,
    autoActionCount: autoActions.length,
    fn: 'zeina.outputMapper.mapToBackendActions',
  });

  return actions;
}

/**
 * Format ZeinaOutput for storage/audit log
 * Returns only the fields that should be persisted
 */
export function formatForAudit(
  output: ZeinaOutput,
  traceId: string,
  alertId: string
): Record<string, any> {
  return {
    alertId,
    traceId,
    riskScore: output.riskScore,
    summary: output.summary,
    recommendedActionCode: output.recommendedActionCode,
    escalationLevel: output.escalationLevel,
    analysisType: output.metadata.analysisType,
    model: output.metadata.model,
    timestamp: output.metadata.timestamp.toISOString(),
    version: output.metadata.version,
  };
}
