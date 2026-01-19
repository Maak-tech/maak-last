/**
 * Unit tests for Zeina guardrails
 * Tests validation and safety constraints
 */

import {
  applySafetyConstraints,
  sanitizeToZeinaOutput,
  validateAIResponse,
  validateAlertContext,
} from "../guardrails";
import type { AlertContext, RawAIResponse } from "../types";

describe("Zeina Guardrails", () => {
  describe("validateAlertContext", () => {
    it("should validate valid alert context", () => {
      const context: AlertContext = {
        alertId: "alert_123",
        patientId: "patient_456",
        alertType: "vital",
        severity: "warning",
        vitalType: "heartRate",
        vitalValue: 120,
      };

      const result = validateAlertContext(context, "trace_123");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject missing required fields", () => {
      const context = {
        alertType: "vital",
      } as AlertContext;

      const result = validateAlertContext(context, "trace_123");
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContain("alertId is required");
      expect(result.errors).toContain("patientId is required");
    });

    it("should reject invalid alert type", () => {
      const context: AlertContext = {
        alertId: "alert_123",
        patientId: "patient_456",
        alertType: "invalid" as any,
        severity: "warning",
      };

      const result = validateAlertContext(context, "trace_123");
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("alertType"))).toBe(true);
    });

    it("should warn about unreasonable vital values", () => {
      const context: AlertContext = {
        alertId: "alert_123",
        patientId: "patient_456",
        alertType: "vital",
        severity: "warning",
        vitalValue: 999_999,
      };

      const result = validateAlertContext(context, "trace_123");
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe("validateAIResponse", () => {
    it("should validate valid AI response", () => {
      const response: RawAIResponse = {
        riskScore: 65,
        summary: "Elevated heart rate detected, monitoring recommended",
        recommendedActionCode: "CHECK_VITALS",
        escalationLevel: "caregiver",
      };

      const result = validateAIResponse(response, "trace_123");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject missing required fields", () => {
      const response: RawAIResponse = {
        riskScore: 50,
      };

      const result = validateAIResponse(response, "trace_123");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("summary is required");
      expect(result.errors).toContain("recommendedActionCode is required");
      expect(result.errors).toContain("escalationLevel is required");
    });

    it("should reject out of range risk score", () => {
      const response: RawAIResponse = {
        riskScore: 150,
        summary: "Test summary",
        recommendedActionCode: "MONITOR",
        escalationLevel: "none",
      };

      const result = validateAIResponse(response, "trace_123");
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("riskScore"))).toBe(true);
    });

    it("should reject diagnostic language in summary", () => {
      const response: RawAIResponse = {
        riskScore: 50,
        summary: "Patient has been diagnosed with hypertension",
        recommendedActionCode: "MONITOR",
        escalationLevel: "none",
      };

      const result = validateAIResponse(response, "trace_123");
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("diagnostic language"))).toBe(
        true
      );
    });

    it("should reject too long summary", () => {
      const response: RawAIResponse = {
        riskScore: 50,
        summary: "a".repeat(300),
        recommendedActionCode: "MONITOR",
        escalationLevel: "none",
      };

      const result = validateAIResponse(response, "trace_123");
      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.includes("under 200 characters"))
      ).toBe(true);
    });

    it("should reject invalid action code", () => {
      const response: RawAIResponse = {
        riskScore: 50,
        summary: "Test summary",
        recommendedActionCode: "INVALID_CODE",
        escalationLevel: "none",
      };

      const result = validateAIResponse(response, "trace_123");
      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.includes("recommendedActionCode"))
      ).toBe(true);
    });

    it("should reject invalid escalation level", () => {
      const response: RawAIResponse = {
        riskScore: 50,
        summary: "Test summary",
        recommendedActionCode: "MONITOR",
        escalationLevel: "invalid",
      };

      const result = validateAIResponse(response, "trace_123");
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("escalationLevel"))).toBe(
        true
      );
    });
  });

  describe("applySafetyConstraints", () => {
    it("should enforce minimum risk score for critical severity", () => {
      const result = applySafetyConstraints(
        30,
        "none",
        "critical",
        "trace_123"
      );
      expect(result).toBeGreaterThanOrEqual(60);
    });

    it("should enforce minimum risk score for emergency escalation", () => {
      const result = applySafetyConstraints(
        40,
        "emergency",
        "warning",
        "trace_123"
      );
      expect(result).toBeGreaterThanOrEqual(70);
    });

    it("should enforce maximum risk score for info severity", () => {
      const result = applySafetyConstraints(80, "none", "info", "trace_123");
      expect(result).toBeLessThanOrEqual(60);
    });

    it("should enforce maximum risk score for no escalation", () => {
      const result = applySafetyConstraints(70, "none", "warning", "trace_123");
      expect(result).toBeLessThanOrEqual(50);
    });

    it("should not modify risk score within valid range", () => {
      const result = applySafetyConstraints(
        50,
        "caregiver",
        "warning",
        "trace_123"
      );
      expect(result).toBe(50);
    });

    it("should cap risk score at 100", () => {
      const result = applySafetyConstraints(
        150,
        "emergency",
        "critical",
        "trace_123"
      );
      expect(result).toBeLessThanOrEqual(100);
    });

    it("should floor risk score at 0", () => {
      const result = applySafetyConstraints(-10, "none", "info", "trace_123");
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe("sanitizeToZeinaOutput", () => {
    it("should create valid ZeinaOutput from AI response", () => {
      const response: RawAIResponse = {
        riskScore: 65,
        summary: "Elevated heart rate detected",
        recommendedActionCode: "CHECK_VITALS",
        escalationLevel: "caregiver",
      };

      const context: AlertContext = {
        alertId: "alert_123",
        patientId: "patient_456",
        alertType: "vital",
        severity: "warning",
      };

      const output = sanitizeToZeinaOutput(
        response,
        context,
        "trace_123",
        "gpt-4o-mini"
      );

      expect(output.riskScore).toBe(65);
      expect(output.summary).toBe("Elevated heart rate detected");
      expect(output.recommendedActionCode).toBe("CHECK_VITALS");
      expect(output.escalationLevel).toBe("caregiver");
      expect(output.metadata.analysisType).toBe("ai");
      expect(output.metadata.model).toBe("gpt-4o-mini");
    });

    it("should truncate too long summary", () => {
      const response: RawAIResponse = {
        riskScore: 50,
        summary: "a".repeat(300),
        recommendedActionCode: "MONITOR",
        escalationLevel: "none",
      };

      const context: AlertContext = {
        alertId: "alert_123",
        patientId: "patient_456",
        alertType: "vital",
        severity: "info",
      };

      const output = sanitizeToZeinaOutput(response, context, "trace_123");
      expect(output.summary.length).toBeLessThanOrEqual(200);
      expect(output.summary).toMatch(/\.\.\.$/);
    });

    it("should apply safety constraints to risk score", () => {
      const response: RawAIResponse = {
        riskScore: 30,
        summary: "Test summary",
        recommendedActionCode: "MONITOR",
        escalationLevel: "none",
      };

      const context: AlertContext = {
        alertId: "alert_123",
        patientId: "patient_456",
        alertType: "vital",
        severity: "critical",
      };

      const output = sanitizeToZeinaOutput(response, context, "trace_123");
      expect(output.riskScore).toBeGreaterThanOrEqual(60);
    });
  });
});
