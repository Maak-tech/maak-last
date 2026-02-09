/**
 * Unit tests for Zeina output mapper
 * Tests deterministic mapping from AI output to backend actions
 */
/* biome-ignore-all lint/correctness/noUndeclaredVariables: Jest globals (describe/it/expect) are provided by test runtime. */

import { formatForAudit, mapToBackendActions } from "../outputMapper";
import {
  EscalationLevel,
  RecommendedActionCode,
  type ZeinaOutput,
} from "../types";

describe("Zeina Output Mapper", () => {
  describe("mapToBackendActions", () => {
    const createTestOutput = (
      actionCode: RecommendedActionCode,
      escalationLevel: EscalationLevel,
      riskScore = 50
    ): ZeinaOutput => ({
      riskScore,
      summary: "Test summary",
      recommendedActionCode: actionCode,
      escalationLevel,
      metadata: {
        analysisType: "ai",
        model: "gpt-4o-mini",
        timestamp: new Date(),
        version: "1.0.0",
      },
    });

    describe("Alert sending logic", () => {
      it("should send alert for emergency escalation", () => {
        const output = createTestOutput(
          RecommendedActionCode.IMMEDIATE_ATTENTION,
          EscalationLevel.EMERGENCY,
          90
        );
        const actions = mapToBackendActions(output, "trace_123");
        expect(actions.sendAlert).toBe(true);
      });

      it("should send alert for caregiver escalation", () => {
        const output = createTestOutput(
          RecommendedActionCode.NOTIFY_CAREGIVER,
          EscalationLevel.CAREGIVER,
          60
        );
        const actions = mapToBackendActions(output, "trace_123");
        expect(actions.sendAlert).toBe(true);
      });

      it("should send alert for high risk score (>=50) even with no escalation", () => {
        const output = createTestOutput(
          RecommendedActionCode.MONITOR,
          EscalationLevel.NONE,
          50
        );
        const actions = mapToBackendActions(output, "trace_123");
        expect(actions.sendAlert).toBe(true);
      });

      it("should not send alert for low risk score (<50) with no escalation", () => {
        const output = createTestOutput(
          RecommendedActionCode.MONITOR,
          EscalationLevel.NONE,
          30
        );
        const actions = mapToBackendActions(output, "trace_123");
        expect(actions.sendAlert).toBe(false);
      });
    });

    describe("Alert recipients mapping", () => {
      it("should notify all parties for emergency escalation", () => {
        const output = createTestOutput(
          RecommendedActionCode.IMMEDIATE_ATTENTION,
          EscalationLevel.EMERGENCY
        );
        const actions = mapToBackendActions(output, "trace_123");
        expect(actions.alertRecipients).toEqual([
          "caregiver",
          "family",
          "emergency",
        ]);
      });

      it("should notify caregiver and family for caregiver escalation", () => {
        const output = createTestOutput(
          RecommendedActionCode.NOTIFY_CAREGIVER,
          EscalationLevel.CAREGIVER
        );
        const actions = mapToBackendActions(output, "trace_123");
        expect(actions.alertRecipients).toEqual(["caregiver", "family"]);
      });

      it("should notify no one for no escalation", () => {
        const output = createTestOutput(
          RecommendedActionCode.MONITOR,
          EscalationLevel.NONE
        );
        const actions = mapToBackendActions(output, "trace_123");
        expect(actions.alertRecipients).toEqual([]);
      });
    });

    describe("App CTA mapping", () => {
      it("should map MONITOR to view_alert with low priority", () => {
        const output = createTestOutput(
          RecommendedActionCode.MONITOR,
          EscalationLevel.NONE
        );
        const actions = mapToBackendActions(output, "trace_123");
        expect(actions.appCTA?.action).toBe("view_alert");
        expect(actions.appCTA?.priority).toBe("low");
      });

      it("should map CHECK_VITALS to record_vitals with medium priority", () => {
        const output = createTestOutput(
          RecommendedActionCode.CHECK_VITALS,
          EscalationLevel.NONE
        );
        const actions = mapToBackendActions(output, "trace_123");
        expect(actions.appCTA?.action).toBe("record_vitals");
        expect(actions.appCTA?.priority).toBe("medium");
      });

      it("should map CONTACT_PATIENT to call_patient with high priority", () => {
        const output = createTestOutput(
          RecommendedActionCode.CONTACT_PATIENT,
          EscalationLevel.CAREGIVER
        );
        const actions = mapToBackendActions(output, "trace_123");
        expect(actions.appCTA?.action).toBe("call_patient");
        expect(actions.appCTA?.priority).toBe("high");
      });

      it("should map IMMEDIATE_ATTENTION to call_emergency with critical priority", () => {
        const output = createTestOutput(
          RecommendedActionCode.IMMEDIATE_ATTENTION,
          EscalationLevel.EMERGENCY
        );
        const actions = mapToBackendActions(output, "trace_123");
        expect(actions.appCTA?.action).toBe("call_emergency");
        expect(actions.appCTA?.priority).toBe("critical");
      });
    });

    describe("Automated actions mapping", () => {
      it("should schedule follow-up for RECHECK_IN_1H", () => {
        const output = createTestOutput(
          RecommendedActionCode.RECHECK_IN_1H,
          EscalationLevel.NONE
        );
        const actions = mapToBackendActions(output, "trace_123");
        expect(actions.autoActions).toContain("schedule_followup_1h");
      });

      it("should send notification for NOTIFY_CAREGIVER", () => {
        const output = createTestOutput(
          RecommendedActionCode.NOTIFY_CAREGIVER,
          EscalationLevel.CAREGIVER
        );
        const actions = mapToBackendActions(output, "trace_123");
        expect(actions.autoActions).toContain("send_caregiver_notification");
      });

      it("should escalate for IMMEDIATE_ATTENTION", () => {
        const output = createTestOutput(
          RecommendedActionCode.IMMEDIATE_ATTENTION,
          EscalationLevel.EMERGENCY
        );
        const actions = mapToBackendActions(output, "trace_123");
        expect(actions.autoActions).toContain("escalate_to_emergency");
        expect(actions.autoActions).toContain("log_critical_event");
      });

      it("should always include log_zeina_analysis", () => {
        const output = createTestOutput(
          RecommendedActionCode.MONITOR,
          EscalationLevel.NONE
        );
        const actions = mapToBackendActions(output, "trace_123");
        expect(actions.autoActions).toContain("log_zeina_analysis");
      });
    });
  });

  describe("formatForAudit", () => {
    it("should format ZeinaOutput for audit log", () => {
      const output: ZeinaOutput = {
        riskScore: 65,
        summary: "Test summary",
        recommendedActionCode: RecommendedActionCode.CHECK_VITALS,
        escalationLevel: EscalationLevel.CAREGIVER,
        metadata: {
          analysisType: "ai",
          model: "gpt-4o-mini",
          timestamp: new Date("2024-01-15T12:00:00Z"),
          version: "1.0.0",
        },
      };

      const auditData = formatForAudit(output, "trace_123", "alert_456");

      expect(auditData.alertId).toBe("alert_456");
      expect(auditData.traceId).toBe("trace_123");
      expect(auditData.riskScore).toBe(65);
      expect(auditData.summary).toBe("Test summary");
      expect(auditData.recommendedActionCode).toBe("CHECK_VITALS");
      expect(auditData.escalationLevel).toBe("caregiver");
      expect(auditData.analysisType).toBe("ai");
      expect(auditData.model).toBe("gpt-4o-mini");
      expect(auditData.version).toBe("1.0.0");
      expect(auditData.timestamp).toBe("2024-01-15T12:00:00.000Z");
    });

    it("should handle deterministic analysis without model", () => {
      const output: ZeinaOutput = {
        riskScore: 50,
        summary: "Test summary",
        recommendedActionCode: RecommendedActionCode.MONITOR,
        escalationLevel: EscalationLevel.NONE,
        metadata: {
          analysisType: "deterministic",
          timestamp: new Date(),
          version: "1.0.0",
        },
      };

      const auditData = formatForAudit(output, "trace_123", "alert_456");

      expect(auditData.analysisType).toBe("deterministic");
      expect(auditData.model).toBeUndefined();
    });
  });
});
