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

import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  PathwayDefinition,
  PathwayEnrollment,
  PathwayEnrollmentStatus,
  PathwayStep,
  PathwayStepAction,
} from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDate(v: unknown): Date {
  if (v instanceof Date) return v;
  if (v && typeof (v as { toDate?: () => Date }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate();
  }
  return new Date();
}

function mapDefinition(id: string, data: Record<string, unknown>): PathwayDefinition {
  return {
    id,
    orgId: data.orgId as string,
    name: data.name as string,
    description: data.description as string | undefined,
    triggerCondition: data.triggerCondition as string,
    isActive: data.isActive as boolean,
    steps: (data.steps as PathwayStep[]) ?? [],
    createdAt: toDate(data.createdAt),
    createdBy: data.createdBy as string,
  };
}

function mapEnrollment(id: string, data: Record<string, unknown>): PathwayEnrollment {
  return {
    id,
    orgId: data.orgId as string,
    patientId: data.patientId as string,
    pathwayId: data.pathwayId as string,
    status: data.status as PathwayEnrollmentStatus,
    currentStepId: data.currentStepId as string,
    enrolledAt: toDate(data.enrolledAt),
    nextStepAt: toDate(data.nextStepAt),
    completedAt: data.completedAt ? toDate(data.completedAt) : undefined,
    cancelledReason: data.cancelledReason as string | undefined,
  };
}

/** Parse delay string to milliseconds: "0m" → 0, "2h" → 7200000, "1d" → 86400000 */
export function parseDelayMs(delay: string): number {
  const match = delay.match(/^(\d+)(m|h|d|w)$/);
  if (!match) return 0;
  const n = parseInt(match[1], 10);
  switch (match[2]) {
    case "m": return n * 60 * 1000;
    case "h": return n * 60 * 60 * 1000;
    case "d": return n * 24 * 60 * 60 * 1000;
    case "w": return n * 7 * 24 * 60 * 60 * 1000;
    default: return 0;
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

class CarePathwayService {
  private definitionsCol(orgId: string) {
    return collection(db, "organizations", orgId, "pathways");
  }

  private enrollmentsCol() {
    return collection(db, "pathway_enrollments");
  }

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

    const ref = await addDoc(this.definitionsCol(params.orgId), {
      orgId: params.orgId,
      name: params.name,
      description: params.description ?? null,
      triggerCondition: params.triggerCondition,
      isActive: true,
      steps,
      createdBy: params.createdBy,
      createdAt: serverTimestamp(),
    });

    return {
      id: ref.id,
      orgId: params.orgId,
      name: params.name,
      description: params.description,
      triggerCondition: params.triggerCondition,
      isActive: true,
      steps,
      createdAt: new Date(),
      createdBy: params.createdBy,
    };
  }

  /**
   * List all pathway definitions for an org.
   */
  async listPathways(orgId: string): Promise<PathwayDefinition[]> {
    const snap = await getDocs(
      query(this.definitionsCol(orgId), orderBy("createdAt", "desc"))
    );
    return snap.docs.map((d) => mapDefinition(d.id, d.data()));
  }

  /**
   * List active pathways for a given trigger condition.
   */
  async getPathwaysForTrigger(
    orgId: string,
    triggerCondition: string
  ): Promise<PathwayDefinition[]> {
    const snap = await getDocs(
      query(
        this.definitionsCol(orgId),
        where("triggerCondition", "==", triggerCondition),
        where("isActive", "==", true)
      )
    );
    return snap.docs.map((d) => mapDefinition(d.id, d.data()));
  }

  /**
   * Activate or deactivate a pathway.
   */
  async setPathwayActive(
    orgId: string,
    pathwayId: string,
    isActive: boolean
  ): Promise<void> {
    await updateDoc(doc(this.definitionsCol(orgId), pathwayId), { isActive });
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

    const ref = await addDoc(this.enrollmentsCol(), {
      orgId: params.orgId,
      patientId: params.patientId,
      pathwayId: params.pathwayId,
      status: "active",
      currentStepId: firstStep.id,
      enrolledAt: serverTimestamp(),
      nextStepAt,
      completedAt: null,
      cancelledReason: null,
    });

    return {
      id: ref.id,
      orgId: params.orgId,
      patientId: params.patientId,
      pathwayId: params.pathwayId,
      status: "active",
      currentStepId: firstStep.id,
      enrolledAt: new Date(),
      nextStepAt,
    };
  }

  /**
   * List active enrollments for an org (used by the pathway engine).
   */
  async listActiveEnrollments(
    orgId: string,
    maxResults = 200
  ): Promise<PathwayEnrollment[]> {
    const snap = await getDocs(
      query(
        this.enrollmentsCol(),
        where("orgId", "==", orgId),
        where("status", "==", "active"),
        orderBy("nextStepAt", "asc"),
        limit(maxResults)
      )
    );
    return snap.docs.map((d) => mapEnrollment(d.id, d.data()));
  }

  /**
   * List enrollments for a specific patient.
   */
  async listPatientEnrollments(
    patientId: string,
    orgId: string
  ): Promise<PathwayEnrollment[]> {
    const snap = await getDocs(
      query(
        this.enrollmentsCol(),
        where("patientId", "==", patientId),
        where("orgId", "==", orgId),
        orderBy("enrolledAt", "desc")
      )
    );
    return snap.docs.map((d) => mapEnrollment(d.id, d.data()));
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
    await updateDoc(doc(this.enrollmentsCol(), enrollmentId), {
      currentStepId: nextStep.id,
      nextStepAt,
    });
  }

  /**
   * Mark an enrollment as completed.
   */
  async completeEnrollment(enrollmentId: string): Promise<void> {
    await updateDoc(doc(this.enrollmentsCol(), enrollmentId), {
      status: "completed",
      completedAt: serverTimestamp(),
    });
  }

  /**
   * Cancel an enrollment with a reason.
   */
  async cancelEnrollment(
    enrollmentId: string,
    reason: string
  ): Promise<void> {
    await updateDoc(doc(this.enrollmentsCol(), enrollmentId), {
      status: "cancelled",
      cancelledReason: reason,
    });
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
          { delay: "0m", action: "push_patient", actionParams: { message: "Welcome home! Please check in daily with your health readings." } },
          { delay: "1d", action: "create_task", actionParams: { title: "Day 1 vital check-in", priority: "high" } },
          { delay: "7d", action: "notify_provider", actionParams: { message: "1-week post-discharge follow-up due" } },
          { delay: "30d", action: "create_task", actionParams: { title: "30-day outcome assessment", priority: "normal" } },
        ],
      },
      {
        name: "Medication Adherence",
        description: "Escalating response to missed medications",
        triggerCondition: "medication_missed",
        steps: [
          { delay: "0m", action: "push_patient", actionParams: { message: "Reminder: You have a medication due. Please take it now." } },
          { delay: "2h", action: "push_patient", actionParams: { message: "Gentle reminder about your missed medication." } },
          { delay: "24h", action: "create_task", actionParams: { title: "Follow up on missed medication", priority: "high" } },
          { delay: "48h", action: "notify_provider", actionParams: { message: "Patient has missed medication for 2+ days" } },
        ],
      },
      {
        name: "High Risk Engagement",
        description: "Proactive outreach for patients with elevated risk scores",
        triggerCondition: "risk_escalated",
        steps: [
          { delay: "0m", action: "create_task", actionParams: { title: "Risk escalation review", priority: "urgent" } },
          { delay: "1h", action: "push_patient", actionParams: { message: "Your care team has been notified and will reach out soon." } },
          { delay: "24h", action: "notify_provider", actionParams: { message: "24h check: risk status still elevated" } },
          { delay: "7d", action: "create_task", actionParams: { title: "Weekly risk reassessment", priority: "high" } },
        ],
      },
    ];
  }
}

export const carePathwayService = new CarePathwayService();
