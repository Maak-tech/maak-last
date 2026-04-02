/**
 * Observability barrel — re-exports all public services and types
 * from the observability layer.
 *
 * Import from "@/lib/observability" to get:
 *   - healthTimelineService  (structured health timeline events)
 *   - observabilityEmitter   (internal telemetry / event emitter)
 *   - aiInstrumenter         (LLM / AI call instrumentation)
 *   - All shared types
 */

// Services
export { healthTimelineService } from "./healthTimeline";
export { observabilityEmitter } from "./eventEmitter";
export { familyDashboard } from "./familyDashboard";
export { healthAnalytics } from "./healthAnalytics";
export { escalationService } from "./escalationService";

// AI instrumentation shim — wraps openai call telemetry
export { aiInstrumenter } from "./aiInstrumenter";

// Types
export type {
  HealthEvent,
  ObservabilityEvent,
  ObservabilityDomain,
  EventSeverity,
  EventStatus,
  AlertEvent,
  AlertAuditEntry,
  PlatformMetric,
  EscalationLevel,
  EscalationPolicy,
  EscalationPolicyLevel,
} from "./types";

export type {
  HealthTimelineEvent,
  TimelineEventType,
} from "./healthTimeline";

export type {
  HealthScore,
  RiskAssessment,
} from "./healthAnalytics";

export type {
  FamilyMemberSummary,
  FamilyHealthDashboard,
} from "./familyDashboard";

export type {
  PersonalizedBaseline,
  AnomalyDetection,
  VitalCorrelation,
  RiskFactor,
} from "./healthAnalytics";
