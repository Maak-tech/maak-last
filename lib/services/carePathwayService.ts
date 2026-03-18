/**
 * Care Pathway Service
 *
 * Manages protocol-driven care pathways — sequences of timed clinical actions
 * triggered by patient events (discharge, risk escalation, missed medication, etc.)
 *
 * Pathway examples:
 *   Post-discharge:  Day 0 → vital check-in push → Day 7 → report → Day 30 → survey
 *   Diabetes mgmt:  HbA1c > 8 → enroll glucose monitoring → daily reminders → refer
 *   Med adherence:  Missed dose → push → 2h → re-check → missed again → task
 *
 * This service handles definition management and enrollment CRUD.
 * The pathwayEngine Cloud Function processes step execution on a schedule.
 */

import { api } from "@/lib/apiClient";
import type {
  PathwayDefinition,
  PathwayEnrollment,
  PathwayEnrollmentStatus,
  PathwayStep,
  PathwayStepAction,
} from "@/types";

/** Parse delay string to milliseconds: "0m" → 0, "2h" → 7200000, "1d" → 86400000 */
export function parseDelayMs(delay: string): number {
  const match = delay.match(/^(\d+)(m|h|d|w)$/);
  if (!match) return 0;
  const n = Number.parseInt(match[1], 10);
  switch (match[2]) {
    case "m":
      return n * 60 * 1000;
    case "h":
      return n * 60 * 60 * 1000;
    case "d":
      return n * 24 * 60 * 60 * 1000;
    case "w":
      return n * 7 * 24 * 60 * 60 * 1000;
    default:
      return 0;
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

class CarePathwayService {
  // ─── Pathway Definitions ───────────────────────────────────────────────────

  /**
   * Create a new pathway definition for an organization.
   */
  async createPathway(params: {
    orgId: string;
    createdBy: string;
    name: string;
    description?: string;
    triggerCondition: string;
    steps: Omit<PathwayStep, "id">[];
  }): Promise<PathwayDefinition> {
    const steps: PathwayStep[] = params.steps.map((s, i) => ({
      ...s,
      id: `step_${i + 1}`,
    }));

    const result = await api.post<PathwayDefinition>(
      `/api/org/${params.orgId}/pathways`,
      {
        orgId: params.orgId,
        name: params.name,
        description: params.description ?? null,
        triggerCondition: params.triggerCondition,
        isActive: true,
        steps,
        createdBy: params.createdBy,
        createdAt: new Date().toISOString(),
      }
    );

    return result;
  }

  /**
   * List all pathway definitions for an org.
   */
  async listPathways(orgId: string): Promise<PathwayDefinition[]> {
    try {
      const result = await api.get<{ data?: PathwayDefinition[] }>(
        `/api/org/${orgId}/pathways`
      );
      return result?.data ?? [];
    } catch {
      return [];
    }
  }

  /**
   * List active pathways for a given trigger condition.
   */
  async getPathwaysForTrigger(
    orgId: string,
    triggerCondition: string
  ): Promise<PathwayDefinition[]> {
    try {
      const result = await api.get<{ data?: PathwayDefinition[] }>(
        `/api/org/${orgId}/pathways?triggerCondition=${encodeURIComponent(triggerCondition)}&isActive=true`
      );
      return result?.data ?? [];
    } catch {
      return [];
    }
  }

  /**
   * Activate or deactivate a pathway.
   */
  async setPathwayActive(
    orgId: string,
    pathwayId: string,
    isActive: boolean
  ): Promise<void> {
    try {
      await api.patch(`/api/org/${orgId}/pathways/${pathwayId}`, { isActive });
    } catch {
    }
  }

  // ─── Enrollments ───────────────────────────────────────────────────────────

  /**
   * Enroll a patient into a care pathway.
   * The first step is scheduled at now + step[0].delay.
   */
  async enrollPatient(params: {
    orgId: string;
    patientId: string;
    pathwayId: string;
    pathway: PathwayDefinition;
  }): Promise<PathwayEnrollment | null> {
    if (params.pathway.steps.length === 0) return null;

    const firstStep = params.pathway.steps[0];
    const nextStepAt = new Date(Date.now() + parseDelayMs(firstStep.delay));

    try {
      const result = await api.post<PathwayEnrollment>(
        "/api/org/pathway-enrollments",
        {
          orgId: params.orgId,
          patientId: params.patientId,
          pathwayId: params.pathwayId,
          status: "active",
          currentStepId: firstStep.id,
          enrolledAt: new Date().toISOString(),
          nextStepAt: nextStepAt.toISOString(),
        }
      );
      return result;
    } catch {
      return null;
    }
  }

  /**
   * List active enrollments for an org (used by the pathway engine).
   */
  async listActiveEnrollments(
    orgId: string,
    maxResults = 200
  ): Promise<PathwayEnrollment[]> {
    try {
      const result = await api.get<{ data?: PathwayEnrollment[] }>(
        `/api/org/pathway-enrollments?orgId=${orgId}&status=active&limit=${maxResults}`
      );
      return result?.data ?? [];
    } catch {
      return [];
    }
  }

  /**
   * List enrollments for a specific patient.
   */
  async listPatientEnrollments(
    patientId: string,
    orgId: string
  ): Promise<PathwayEnrollment[]> {
    try {
      const result = await api.get<{ data?: PathwayEnrollment[] }>(
        `/api/org/pathway-enrollments?patientId=${patientId}&orgId=${orgId}`
      );
      return result?.data ?? [];
    } catch {
      return [];
    }
  }

  /**
   * Advance an enrollment to the next step.
   * Call this after the current step has been executed successfully.
   */
  async advanceToNextStep(
    enrollmentId: string,
    nextStep: PathwayStep
  ): Promise<void> {
    const nextStepAt = new Date(Date.now() + parseDelayMs(nextStep.delay));
    try {
      await api.patch(`/api/org/pathway-enrollments/${enrollmentId}`, {
        currentStepId: nextStep.id,
        nextStepAt: nextStepAt.toISOString(),
      });
    } catch {
    }
  }

  /**
   * Mark an enrollment as completed.
   */
  async completeEnrollment(enrollmentId: string): Promise<void> {
    try {
      await api.patch(`/api/org/pathway-enrollments/${enrollmentId}`, {
        status: "completed",
        completedAt: new Date().toISOString(),
      });
    } catch {
    }
  }

  /**
   * Cancel an enrollment with a reason.
   */
  async cancelEnrollment(enrollmentId: string, reason: string): Promise<void> {
    try {
      await api.patch(`/api/org/pathway-enrollments/${enrollmentId}`, {
        status: "cancelled",
        cancelledReason: reason,
      });
    } catch {
    }
  }

  // ─── Seed Templates ────────────────────────────────────────────────────────

  /**
   * Returns a set of standard pathway templates an org can import.
   * Templates are not persisted — org must call createPathway with the steps.
   */
  getBuiltInTemplates(): Array<{
    name: string;
    description: string;
    triggerCondition: string;
    steps: Array<{
      delay: string;
      action: PathwayStepAction;
      actionParams: Record<string, unknown>;
    }>;
  }> {
    return [
      {
        name: "Post-Discharge Monitoring",
        description:
          "30-day monitoring protocol for recently discharged patients",
        triggerCondition: "discharge",
        steps: [
          {
            delay: "0m",
            action: "push_patient",
            actionParams: {
              message:
                "Welcome home! Please check in daily with your health readings.",
            },
          },
          {
            delay: "1d",
            action: "create_task",
            actionParams: { title: "Day 1 vital check-in", priority: "high" },
          },
          {
            delay: "7d",
            action: "notify_provider",
            actionParams: { message: "1-week post-discharge follow-up due" },
          },
          {
            delay: "30d",
            action: "create_task",
            actionParams: {
              title: "30-day outcome assessment",
              priority: "normal",
            },
          },
        ],
      },
      {
        name: "Medication Adherence",
        description: "Escalating response to missed medications",
        triggerCondition: "medication_missed",
        steps: [
          {
            delay: "0m",
            action: "push_patient",
            actionParams: {
              message:
                "Reminder: You have a medication due. Please take it now.",
            },
          },
          {
            delay: "2h",
            action: "push_patient",
            actionParams: {
              message: "Gentle reminder about your missed medication.",
            },
          },
          {
            delay: "24h",
            action: "create_task",
            actionParams: {
              title: "Follow up on missed medication",
              priority: "high",
            },
          },
          {
            delay: "48h",
            action: "notify_provider",
            actionParams: {
              message: "Patient has missed medication for 2+ days",
            },
          },
        ],
      },
      {
        name: "High Risk Engagement",
        description:
          "Proactive outreach for patients with elevated risk scores",
        triggerCondition: "risk_escalated",
        steps: [
          {
            delay: "0m",
            action: "create_task",
            actionParams: {
              title: "Risk escalation review",
              priority: "urgent",
            },
          },
          {
            delay: "1h",
            action: "push_patient",
            actionParams: {
              message:
                "Your care team has been notified and will reach out soon.",
            },
          },
          {
            delay: "24h",
            action: "notify_provider",
            actionParams: { message: "24h check: risk status still elevated" },
          },
          {
            delay: "7d",
            action: "create_task",
            actionParams: {
              title: "Weekly risk reassessment",
              priority: "high",
            },
          },
        ],
      },
    ];
  }
}

export const carePathwayService = new CarePathwayService();
