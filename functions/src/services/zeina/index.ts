/**
 * Zeina AI Analysis Service (Barrel Export)
 * Re-exports all Zeina functionality from modular files
 */

// Export analyze module
export {
  analyze,
  type AlertInfo,
  type ZeinaAnalysisInput,
  type ZeinaAnalysisResult,
  type RiskScore,
  type RecommendedAction,
} from './analyze';

// Export store module
export { enrichAlertWithAnalysis } from './store';

// Export vitals summary (note: this should eventually move to modules/vitals/)
export { getRecentVitalsSummary, type VitalsSummary } from '../../modules/vitals/recentSummary';
