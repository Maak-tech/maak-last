import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logger } from "@/lib/utils/logger";
import { observabilityEmitter } from "./eventEmitter";
import type { EscalationPolicy, EscalationLevel } from "./types";

interface ActiveEscalation {
  id?: string;
  alertId: string;
  alertType: string;
  userId: string;
  familyId?: string;
  policyId: string;
  currentLevel: number;
  maxLevel: number;
  status: "active" | "acknowledged" | "resolved" | "expired";
  createdAt: Date;
  lastEscalatedAt: Date;
  nextEscalationAt?: Date;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedBy?: string;
  resolvedAt?: Date;
  notificationsSent: string[];
}

const ESCALATIONS_COLLECTION = "escalations";

const DEFAULT_ESCALATION_POLICIES: EscalationPolicy[] = [
  {
    id: "critical_vital",
    name: "Critical Vital Signs",
    alertTypes: ["vital_critical", "fall_detected", "emergency_button"],
    levels: [
      {
        level: 1,
        delayMinutes: 0,
        notifyRoles: ["caregiver"],
        action: "notify",
        message: "Critical health alert for your family member. Please check on them immediately.",
      },
      {
        level: 2,
        delayMinutes: 5,
        notifyRoles: ["caregiver", "secondary_contact"],
        action: "call",
        message: "URGENT: No response to critical alert. Please contact your family member immediately.",
      },
      {
        level: 3,
        delayMinutes: 10,
        notifyRoles: ["emergency"],
        action: "seek_care_guidance",
        message: "Emergency escalation: No response after 10 minutes. Consider calling emergency services.",
      },
    ],
  },
  {
    id: "abnormal_vital",
    name: "Abnormal Vital Signs",
    alertTypes: ["vital_error", "vital_warn"],
    levels: [
      {
        level: 1,
        delayMinutes: 0,
        notifyRoles: ["caregiver"],
        action: "notify",
        message: "Health alert: Abnormal vital signs detected. Please check when convenient.",
      },
      {
        level: 2,
        delayMinutes: 30,
        notifyRoles: ["caregiver"],
        action: "notify",
        message: "Reminder: Health alert still requires attention.",
      },
    ],
  },
  {
    id: "medication_missed",
    name: "Missed Medication",
    alertTypes: ["medication_missed", "medication_overdue"],
    levels: [
      {
        level: 1,
        delayMinutes: 0,
        notifyRoles: ["caregiver"],
        action: "notify",
        message: "Medication reminder was missed by your family member.",
      },
      {
        level: 2,
        delayMinutes: 60,
        notifyRoles: ["caregiver"],
        action: "notify",
        message: "Medication still not taken. Please remind your family member.",
      },
    ],
  },
];

class EscalationService {
  private policies: EscalationPolicy[] = DEFAULT_ESCALATION_POLICIES;

  getPolicies(): EscalationPolicy[] {
    return this.policies;
  }

  getPolicyForAlertType(alertType: string): EscalationPolicy | undefined {
    return this.policies.find((p) => p.alertTypes.includes(alertType));
  }

  async startEscalation(
    alertId: string,
    alertType: string,
    userId: string,
    familyId?: string
  ): Promise<string | null> {
    const policy = this.getPolicyForAlertType(alertType);
    if (!policy) {
      logger.info(`No escalation policy found for alert type: ${alertType}`, {}, "EscalationService");
      return null;
    }

    const escalation: Omit<ActiveEscalation, "id"> = {
      alertId,
      alertType,
      userId,
      familyId,
      policyId: policy.id,
      currentLevel: 1,
      maxLevel: policy.levels.length,
      status: "active",
      createdAt: new Date(),
      lastEscalatedAt: new Date(),
      nextEscalationAt: this.calculateNextEscalation(policy, 1),
      notificationsSent: [],
    };

    try {
      const docRef = await addDoc(collection(db, ESCALATIONS_COLLECTION), {
        ...escalation,
        createdAt: Timestamp.fromDate(escalation.createdAt),
        lastEscalatedAt: Timestamp.fromDate(escalation.lastEscalatedAt),
        nextEscalationAt: escalation.nextEscalationAt 
          ? Timestamp.fromDate(escalation.nextEscalationAt)
          : null,
      });

      await this.executeEscalationLevel(docRef.id, escalation, policy.levels[0]);

      await observabilityEmitter.emitAlertEvent(
        "escalation_started",
        alertId,
        alertType,
        `Escalation started for ${alertType}`,
        {
          userId,
          familyId,
          escalationLevel: 1,
          severity: "warn",
          status: "pending",
          metadata: { policyId: policy.id },
        }
      );

      await observabilityEmitter.recordAlertAudit(
        alertId,
        "created",
        "active",
        { actorType: "system", notes: `Escalation policy ${policy.id} applied` }
      );

      return docRef.id;
    } catch (error) {
      logger.error("Failed to start escalation", { alertId, error }, "EscalationService");
      return null;
    }
  }

  async acknowledgeEscalation(
    escalationId: string,
    acknowledgedBy: string
  ): Promise<boolean> {
    try {
      const escalationRef = doc(db, ESCALATIONS_COLLECTION, escalationId);
      const escalationDoc = await getDoc(escalationRef);

      if (!escalationDoc.exists()) {
        return false;
      }

      const data = escalationDoc.data() as ActiveEscalation;

      await updateDoc(escalationRef, {
        status: "acknowledged",
        acknowledgedBy,
        acknowledgedAt: Timestamp.now(),
        nextEscalationAt: null,
      });

      await observabilityEmitter.emitAlertEvent(
        "escalation_acknowledged",
        data.alertId,
        data.alertType,
        `Escalation acknowledged by ${acknowledgedBy}`,
        {
          userId: data.userId,
          familyId: data.familyId,
          escalationLevel: data.currentLevel,
          acknowledgedBy,
          severity: "info",
          status: "success",
        }
      );

      await observabilityEmitter.recordAlertAudit(
        data.alertId,
        "acknowledged",
        "acknowledged",
        {
          actorId: acknowledgedBy,
          actorType: "user",
          previousState: "active",
        }
      );

      return true;
    } catch (error) {
      logger.error("Failed to acknowledge escalation", { escalationId, error }, "EscalationService");
      return false;
    }
  }

  async resolveEscalation(
    escalationId: string,
    resolvedBy: string,
    notes?: string
  ): Promise<boolean> {
    try {
      const escalationRef = doc(db, ESCALATIONS_COLLECTION, escalationId);
      const escalationDoc = await getDoc(escalationRef);

      if (!escalationDoc.exists()) {
        return false;
      }

      const data = escalationDoc.data() as ActiveEscalation;

      await updateDoc(escalationRef, {
        status: "resolved",
        resolvedBy,
        resolvedAt: Timestamp.now(),
        nextEscalationAt: null,
      });

      await observabilityEmitter.emitAlertEvent(
        "escalation_resolved",
        data.alertId,
        data.alertType,
        `Escalation resolved by ${resolvedBy}`,
        {
          userId: data.userId,
          familyId: data.familyId,
          escalationLevel: data.currentLevel,
          resolvedBy,
          severity: "info",
          status: "success",
        }
      );

      await observabilityEmitter.recordAlertAudit(
        data.alertId,
        "resolved",
        "resolved",
        {
          actorId: resolvedBy,
          actorType: "user",
          previousState: data.status,
          notes,
        }
      );

      return true;
    } catch (error) {
      logger.error("Failed to resolve escalation", { escalationId, error }, "EscalationService");
      return false;
    }
  }

  async processEscalations(): Promise<void> {
    try {
      const now = new Date();
      const q = query(
        collection(db, ESCALATIONS_COLLECTION),
        where("status", "==", "active"),
        where("nextEscalationAt", "<=", Timestamp.fromDate(now))
      );

      const querySnapshot = await getDocs(q);

      for (const docSnapshot of querySnapshot.docs) {
        const escalation = {
          id: docSnapshot.id,
          ...docSnapshot.data(),
          createdAt: docSnapshot.data().createdAt.toDate(),
          lastEscalatedAt: docSnapshot.data().lastEscalatedAt.toDate(),
          nextEscalationAt: docSnapshot.data().nextEscalationAt?.toDate(),
        } as ActiveEscalation;

        await this.escalateToNextLevel(escalation);
      }
    } catch (error) {
      logger.error("Failed to process escalations", { error }, "EscalationService");
    }
  }

  private async escalateToNextLevel(escalation: ActiveEscalation): Promise<void> {
    const policy = this.policies.find((p) => p.id === escalation.policyId);
    if (!policy) return;

    const nextLevel = escalation.currentLevel + 1;

    if (nextLevel > policy.levels.length) {
      await updateDoc(doc(db, ESCALATIONS_COLLECTION, escalation.id!), {
        status: "expired",
        nextEscalationAt: null,
      });

      await observabilityEmitter.recordAlertAudit(
        escalation.alertId,
        "expired",
        "expired",
        { actorType: "system", notes: "Maximum escalation level reached" }
      );
      return;
    }

    const levelConfig = policy.levels[nextLevel - 1];
    const nextEscalationAt = this.calculateNextEscalation(policy, nextLevel);

    await updateDoc(doc(db, ESCALATIONS_COLLECTION, escalation.id!), {
      currentLevel: nextLevel,
      lastEscalatedAt: Timestamp.now(),
      nextEscalationAt: nextEscalationAt ? Timestamp.fromDate(nextEscalationAt) : null,
    });

    await this.executeEscalationLevel(escalation.id!, escalation, levelConfig);

    await observabilityEmitter.emitAlertEvent(
      "escalation_level_increased",
      escalation.alertId,
      escalation.alertType,
      `Escalated to level ${nextLevel}`,
      {
        userId: escalation.userId,
        familyId: escalation.familyId,
        escalationLevel: nextLevel,
        severity: nextLevel >= policy.levels.length ? "critical" : "error",
        status: "pending",
      }
    );

    await observabilityEmitter.recordAlertAudit(
      escalation.alertId,
      "escalated",
      `level_${nextLevel}`,
      {
        actorType: "system",
        previousState: `level_${escalation.currentLevel}`,
        notes: levelConfig.message,
      }
    );
  }

  private async executeEscalationLevel(
    escalationId: string,
    escalation: ActiveEscalation,
    level: EscalationLevel
  ): Promise<void> {
    logger.info(
      `Executing escalation level ${level.level}`,
      {
        escalationId,
        alertId: escalation.alertId,
        action: level.action,
        notifyRoles: level.notifyRoles,
      },
      "EscalationService"
    );
  }

  private calculateNextEscalation(
    policy: EscalationPolicy,
    currentLevel: number
  ): Date | undefined {
    if (currentLevel >= policy.levels.length) {
      return undefined;
    }

    const nextLevel = policy.levels[currentLevel];
    if (!nextLevel) return undefined;

    const nextTime = new Date();
    nextTime.setMinutes(nextTime.getMinutes() + nextLevel.delayMinutes);
    return nextTime;
  }

  async getActiveEscalationsForFamily(familyId: string): Promise<ActiveEscalation[]> {
    try {
      const q = query(
        collection(db, ESCALATIONS_COLLECTION),
        where("familyId", "==", familyId),
        where("status", "==", "active")
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        lastEscalatedAt: doc.data().lastEscalatedAt.toDate(),
        nextEscalationAt: doc.data().nextEscalationAt?.toDate(),
      })) as ActiveEscalation[];
    } catch (error) {
      logger.error("Failed to get active escalations", { familyId, error }, "EscalationService");
      return [];
    }
  }
}

export const escalationService = new EscalationService();
