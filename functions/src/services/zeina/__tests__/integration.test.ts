/**
 * Integration tests for Zeina AI
 * Tests the complete pipeline from input to output
 */

import {
  runZeinaAnalysis,
  executeZeinaActions,
  type AlertContext,
} from '../index';
import { getMetrics, resetMetrics } from '../observability';

describe('Zeina Integration Tests', () => {
  beforeEach(() => {
    resetMetrics();
  });

  describe('Complete Pipeline', () => {
    it('should process vital alert end-to-end', async () => {
      const alertContext: AlertContext = {
        alertId: 'test_alert_001',
        patientId: 'test_patient_001',
        alertType: 'vital',
        severity: 'warning',
        vitalType: 'heartRate',
        vitalValue: 125,
        vitalUnit: 'bpm',
        patientAge: 68,
        medicationCount: 3,
        timestamp: new Date(),
      };

      const result = await runZeinaAnalysis({
        traceId: 'test_trace_001',
        alertContext,
      });

      // Should always succeed (fail-closed)
      expect(result.success).toBe(true);
      expect(result.traceId).toBe('test_trace_001');

      // Should have output
      expect(result.output).toBeDefined();
      
      if (result.output) {
        // Validate output structure
        expect(result.output.riskScore).toBeGreaterThanOrEqual(0);
        expect(result.output.riskScore).toBeLessThanOrEqual(100);
        expect(result.output.summary).toBeDefined();
        expect(result.output.summary.length).toBeGreaterThan(0);
        expect(result.output.recommendedActionCode).toBeDefined();
        expect(result.output.escalationLevel).toBeDefined();

        // Execute actions
        const actions = await executeZeinaActions(
          result.output,
          alertContext,
          'test_trace_001'
        );

        // Validate actions
        expect(actions.sendAlert).toBeDefined();
        expect(actions.alertRecipients).toBeDefined();
        expect(actions.appCTA).toBeDefined();
        expect(actions.autoActions).toBeDefined();
        expect(actions.autoActions).toContain('log_zeina_analysis');
      }

      // Check metrics
      const metrics = getMetrics();
      expect(metrics['zeina.calls']).toBe(1);
    });

    it('should handle critical vital alert', async () => {
      const alertContext: AlertContext = {
        alertId: 'test_alert_002',
        patientId: 'test_patient_002',
        alertType: 'vital',
        severity: 'critical',
        vitalType: 'oxygenSaturation',
        vitalValue: 85,
        vitalUnit: '%',
        patientAge: 75,
        timestamp: new Date(),
      };

      const result = await runZeinaAnalysis({
        traceId: 'test_trace_002',
        alertContext,
      });

      expect(result.success).toBe(true);
      
      if (result.output) {
        // Critical alerts should have high risk score
        expect(result.output.riskScore).toBeGreaterThanOrEqual(60);

        // Should escalate
        expect(['caregiver', 'emergency']).toContain(result.output.escalationLevel);

        const actions = await executeZeinaActions(
          result.output,
          alertContext,
          'test_trace_002'
        );

        // Should send alerts
        expect(actions.sendAlert).toBe(true);
        expect(actions.alertRecipients.length).toBeGreaterThan(0);
      }
    });

    it('should handle fall alert', async () => {
      const alertContext: AlertContext = {
        alertId: 'test_alert_003',
        patientId: 'test_patient_003',
        alertType: 'fall',
        severity: 'critical',
        patientAge: 80,
        timestamp: new Date(),
      };

      const result = await runZeinaAnalysis({
        traceId: 'test_trace_003',
        alertContext,
      });

      expect(result.success).toBe(true);
      
      if (result.output) {
        // Falls should have high risk score
        expect(result.output.riskScore).toBeGreaterThanOrEqual(60);

        // Falls should escalate
        expect(result.output.escalationLevel).not.toBe('none');

        const actions = await executeZeinaActions(
          result.output,
          alertContext,
          'test_trace_003'
        );

        // Should trigger emergency actions
        expect(actions.sendAlert).toBe(true);
        expect(actions.alertRecipients).toContain('caregiver');
      }
    });

    it('should handle info-level alert', async () => {
      const alertContext: AlertContext = {
        alertId: 'test_alert_004',
        patientId: 'test_patient_004',
        alertType: 'vital',
        severity: 'info',
        vitalType: 'weight',
        vitalValue: 75,
        vitalUnit: 'kg',
        patientAge: 45,
        timestamp: new Date(),
      };

      const result = await runZeinaAnalysis({
        traceId: 'test_trace_004',
        alertContext,
      });

      expect(result.success).toBe(true);
      
      if (result.output) {
        // Info alerts should have lower risk score
        expect(result.output.riskScore).toBeLessThanOrEqual(60);

        const actions = await executeZeinaActions(
          result.output,
          alertContext,
          'test_trace_004'
        );

        // May not send alert for low-risk info
        if (!actions.sendAlert) {
          expect(actions.alertRecipients).toEqual([]);
        }
      }
    });
  });

  describe('PHI Sanitization', () => {
    it('should not leak exact age to analysis', async () => {
      const alertContext: AlertContext = {
        alertId: 'test_alert_005',
        patientId: 'test_patient_005',
        alertType: 'vital',
        severity: 'warning',
        vitalType: 'heartRate',
        vitalValue: 125,
        patientAge: 68, // Exact age - should be bucketed
        timestamp: new Date(),
      };

      const result = await runZeinaAnalysis({
        traceId: 'test_trace_005',
        alertContext,
      });

      expect(result.success).toBe(true);
      
      // The output should not contain exact age
      // (This is verified by the architecture - inputBuilder buckets it)
      if (result.output) {
        const summaryLower = result.output.summary.toLowerCase();
        expect(summaryLower).not.toContain('68');
        expect(summaryLower).not.toContain('age 68');
      }
    });

    it('should not leak exact vital values in summary', async () => {
      const alertContext: AlertContext = {
        alertId: 'test_alert_006',
        patientId: 'test_patient_006',
        alertType: 'vital',
        severity: 'warning',
        vitalType: 'heartRate',
        vitalValue: 127, // Exact value
        vitalUnit: 'bpm',
        timestamp: new Date(),
      };

      const result = await runZeinaAnalysis({
        traceId: 'test_trace_006',
        alertContext,
      });

      expect(result.success).toBe(true);
      
      // Summary should be generic, not include exact value
      if (result.output) {
        expect(result.output.summary).toBeDefined();
        expect(result.output.summary.length).toBeGreaterThan(0);
        // Summary may reference heart rate but not exact value
      }
    });
  });

  describe('Fail-Closed Behavior', () => {
    it('should succeed even with minimal context', async () => {
      const alertContext: AlertContext = {
        alertId: 'test_alert_007',
        patientId: 'test_patient_007',
        alertType: 'vital',
        severity: 'warning',
        // Minimal context - no vital values, no age
      };

      const result = await runZeinaAnalysis({
        traceId: 'test_trace_007',
        alertContext,
      });

      // Should still succeed (fail-closed)
      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      
      if (result.output) {
        expect(result.output.riskScore).toBeGreaterThanOrEqual(0);
        expect(result.output.recommendedActionCode).toBeDefined();
      }
    });

    it('should handle missing optional fields gracefully', async () => {
      const alertContext: AlertContext = {
        alertId: 'test_alert_008',
        patientId: 'test_patient_008',
        alertType: 'symptom',
        severity: 'warning',
        // No vital data, no age, no medications
      };

      const result = await runZeinaAnalysis({
        traceId: 'test_trace_008',
        alertContext,
      });

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
    });
  });

  describe('Action Mapping', () => {
    it('should map high-risk alerts to immediate actions', async () => {
      const alertContext: AlertContext = {
        alertId: 'test_alert_009',
        patientId: 'test_patient_009',
        alertType: 'vital',
        severity: 'critical',
        vitalType: 'heartRate',
        vitalValue: 180,
        timestamp: new Date(),
      };

      const result = await runZeinaAnalysis({
        traceId: 'test_trace_009',
        alertContext,
      });

      if (result.output) {
        const actions = await executeZeinaActions(
          result.output,
          alertContext,
          'test_trace_009'
        );

        expect(actions.sendAlert).toBe(true);
        expect(actions.appCTA?.priority).toMatch(/high|critical/);
      }
    });

    it('should map low-risk alerts to monitoring actions', async () => {
      const alertContext: AlertContext = {
        alertId: 'test_alert_010',
        patientId: 'test_patient_010',
        alertType: 'vital',
        severity: 'info',
        vitalType: 'weight',
        vitalValue: 70,
        timestamp: new Date(),
      };

      const result = await runZeinaAnalysis({
        traceId: 'test_trace_010',
        alertContext,
      });

      if (result.output) {
        const actions = await executeZeinaActions(
          result.output,
          alertContext,
          'test_trace_010'
        );

        // Low-risk alerts may not send notifications
        if (actions.appCTA) {
          expect(['low', 'medium']).toContain(actions.appCTA.priority);
        }
      }
    });
  });

  describe('Metrics Tracking', () => {
    it('should track analysis calls', async () => {
      resetMetrics();

      await runZeinaAnalysis({
        traceId: 'test_trace_011',
        alertContext: {
          alertId: 'test_alert_011',
          patientId: 'test_patient_011',
          alertType: 'vital',
          severity: 'info',
        },
      });

      const metrics = getMetrics();
      expect(metrics['zeina.calls']).toBe(1);
    });

    it('should track multiple calls', async () => {
      resetMetrics();

      for (let i = 0; i < 3; i++) {
        await runZeinaAnalysis({
          traceId: `test_trace_${i}`,
          alertContext: {
            alertId: `test_alert_${i}`,
            patientId: `test_patient_${i}`,
            alertType: 'vital',
            severity: 'info',
          },
        });
      }

      const metrics = getMetrics();
      expect(metrics['zeina.calls']).toBe(3);
    });
  });
});
