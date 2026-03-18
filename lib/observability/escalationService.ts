/* biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: Escalation flow intentionally centralizes multi-level policy logic. */
/* biome-ignore-all lint/style/noNestedTernary: Existing notification priority mapping is kept compact in this legacy module. */
/* biome-ignore-all lint/style/noNonNullAssertion: Legacy escalation records guarantee identifiers post-persistence. */
/* biome-ignore-all lint/style/useBlockStatements: Guard clauses are intentionally compact for readability in orchestration code. */
/* biome-ignore-all lint/nursery/noShadow: Firestore doc symbol collisions are benign in scoped callbacks. */
import { api } from "@/lib/apiClient";
import { pushNotificationService } from "@/lib/services/pushNotificationService";
import { userService } from "@/lib/services/userService";
import { logger } from "@/lib/utils/logger";
import { observabilityEmitter } from "./eventEmitter";
import type { EscalationLevel, EscalationPolicy } from "./types";

type ActiveEscalation = {
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
};

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
        message:
          "Critical health alert for your family member. Please check on them immediately.",
      },
      {
        level: 2,
        delayMinutes: 5,
        notifyRoles: ["caregiver", "secondary_contact"],
        action: "call",
        message:
          "URGENT: No response to critical alert. Please contact your family member immediately.",
      },
      {
        level: 3,
        delayMinutes: 10,
        notifyRoles: ["emergency"],
        action: "seek_care_guidance",
        message:
          "Emergency escalation: No response after 10 minutes. Consider calling emergency services.",
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
        message:
          "Health alert: Abnormal vital signs detected. Please check when convenient.",
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
        message:
          "Medication still not taken. Please remind your family member.",
      },
    ],
  },
];

class EscalationService {
  private readonly policies: EscalationPolicy[] = DEFAULT_ESCALATION_POLICIES;

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
      logger.info(
        `No escalation policy found for alert type: ${alertType}`,
        {},
        "EscalationService"
      );
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
      const created = await api.post<{ id: string }>("/api/health/escalations", {
        ...escalation,
        createdAt: escalation.createdAt.toISOString(),
        lastEscalatedAt: escalation.lastEscalatedAt.toISOString(),
        nextEscalationAt: escalation.nextEscalationAt
          ? escalation.nextEscalationAt.toISOString()
          : null,
      });

      const newId = created?.id ?? null;
      if (!newId) {
        return null;
      }

      await this.executeEscalationLevel(newId, escalation, policy.levels[0]);

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

      return newId;
    } catch (error) {
      logger.error(
        "Failed to start escalation",
        { alertId, error },
        "EscalationService"
      );
      return null;
    }
  }

  async acknowledgeEscalation(
    escalationId: string,
    acknowledgedBy: string
  ): Promise<boolean> {
    try {
      const raw = await api.get<Record<string, unknown>>(
        `/api/health/escalations/${escalationId}`
      );

      if (!raw) {
        return false;
      }

      const data: ActiveEscalation = {
        ...(raw as unknown as ActiveEscalation),
        createdAt: raw.createdAt ? new Date(raw.createdAt as string) : new Date(),
        lastEscalatedAt: raw.lastEscalatedAt
          ? new Date(raw.lastEscalatedAt as string)
          : new Date(),
        nextEscalationAt: raw.nextEscalationAt
          ? new Date(raw.nextEscalationAt as string)
          : undefined,
      };

      await api.patch(`/api/health/escalations/${escalationId}`, {
        status: "acknowledged",
        acknowledgedBy,
        acknowledgedAt: new Date().toISOString(),
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
      logger.error(
        "Failed to acknowledge escalation",
        { escalationId, error },
        "EscalationService"
      );
      return false;
    }
  }

  async resolveEscalation(
    alertId: string,
    resolvedBy: string,
    notes?: string
  ): Promise<boolean> {
    try {
      await api.patch("/api/health/escalations/resolve-by-alert", {
        alertId,
        resolvedBy,
        notes,
      });

      return true;
    } catch (error) {
      const errorCode =
        typeof error === "object" && error && "code" in error && error.code
          ? String(error.code)
          : undefined;
      const severity = errorCode === "permission-denied" ? "warn" : "error";
      const message =
        errorCode === "permission-denied"
          ? "Escalation resolution blocked by permissions (expected client-side)"
          : "Failed to resolve escalation";

      if (severity === "warn") {
        logger.warn(
          message,
          { alertId, error, errorCode },
          "EscalationService"
        );
      } else {
        logger.error(
          message,
          { alertId, error, errorCode },
          "EscalationService"
        );
      }
      return false;
    }
  }

  async processEscalations(): Promise<void> {
    try {
      await api.post("/api/health/escalations/process", {});
    } catch (error) {
      logger.error(
        "Failed to process escalations",
        { error },
        "EscalationService"
      );
    }
  }

  private async escalateToNextLevel(
    escalation: ActiveEscalation
  ): Promise<void> {
    const policy = this.policies.find((p) => p.id === escalation.policyId);
    if (!policy) return;

    const nextLevel = escalation.currentLevel + 1;

    if (nextLevel > policy.levels.length) {
      await api.patch(`/api/health/escalations/${escalation.id!}`, {
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

    await api.patch(`/api/health/escalations/${escalation.id!}`, {
      currentLevel: nextLevel,
      lastEscalatedAt: new Date().toISOString(),
      nextEscalationAt: nextEscalationAt ? nextEscalationAt.toISOString() : null,
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
    escalation: Omit<ActiveEscalation, "id">,
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

    try {
      if (!escalation.familyId) {
        logger.warn(
          "No familyId for escalation, cannot notify caregivers",
          { escalationId },
          "EscalationService"
        );
        return;
      }

      const familyMembers = await userService.getFamilyMembers(
        escalation.familyId
      );
      const user = await userService.getUser(escalation.userId);
      const userName = user
        ? `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
          "Family member"
        : "Family member";

      const recipientsToNotify: string[] = [];

      for (const role of level.notifyRoles) {
        if (role === "caregiver") {
          const caregivers = familyMembers.filter(
            (m) => m.role === "caregiver" || m.role === "admin"
          );
          recipientsToNotify.push(...caregivers.map((c) => c.id));
        } else if (role === "secondary_contact") {
          const secondaryContacts = familyMembers.filter(
            (m) => m.role === "member" && m.id !== escalation.userId
          );
          recipientsToNotify.push(...secondaryContacts.map((c) => c.id));
        } else if (role === "emergency") {
          recipientsToNotify.push(...familyMembers.map((m) => m.id));
        }
      }

      const uniqueRecipients = [...new Set(recipientsToNotify)].filter(
        (id) => id !== escalation.userId
      );

      const notificationTitle = this.getNotificationTitle(
        escalation.alertType,
        level.level
      );
      const notificationBody = level.message.replace("{userName}", userName);
      const sound =
        level.level >= 3
          ? ("emergency" as const)
          : level.level >= 2
            ? ("alarm" as const)
            : ("default" as const);
      const priority =
        level.level >= 2 ? ("high" as const) : ("normal" as const);

      for (const recipientId of uniqueRecipients) {
        await pushNotificationService.sendToUser(recipientId, {
          title: notificationTitle,
          body: notificationBody,
          data: {
            type: "escalation_alert",
            alertId: escalation.alertId,
            userId: escalation.userId,
            severity:
              level.level >= 3
                ? "critical"
                : level.level >= 2
                  ? "high"
                  : "medium",
            familyId: escalation.familyId,
          },
          sound,
          priority,
        });
      }

      await api.patch(`/api/health/escalations/${escalationId}`, {
        notificationsSentAppend: uniqueRecipients,
      });

      logger.info(
        `Sent escalation notifications to ${uniqueRecipients.length} recipients`,
        {
          escalationId,
          level: level.level,
          recipients: uniqueRecipients.length,
        },
        "EscalationService"
      );
    } catch (error) {
      logger.error(
        "Failed to execute escalation level",
        { escalationId, error },
        "EscalationService"
      );
    }
  }

  private getNotificationTitle(alertType: string, level: number): string {
    const urgencyPrefix =
      level >= 3 ? "🚨 EMERGENCY: " : level >= 2 ? "⚠️ URGENT: " : "📋 ";

    switch (alertType) {
      case "vital_critical":
        return `${urgencyPrefix}Critical Vital Sign Alert`;
      case "vital_error":
        return `${urgencyPrefix}Abnormal Vital Signs`;
      case "fall_detected":
        return `${urgencyPrefix}Fall Detected`;
      case "emergency_button":
        return `${urgencyPrefix}Emergency Alert`;
      case "medication_missed":
        return `${urgencyPrefix}Missed Medication`;
      default:
        return `${urgencyPrefix}Health Alert`;
    }
  }

  private calculateNextEscalation(
    policy: EscalationPolicy,
    currentLevel: number
  ): Date | undefined {
    if (currentLevel >= policy.levels.length) {
      return;
    }

    const nextLevel = policy.levels[currentLevel];
    if (!nextLevel) return;

    const nextTime = new Date();
    nextTime.setMinutes(nextTime.getMinutes() + nextLevel.delayMinutes);
    return nextTime;
  }

  async getActiveEscalationsForFamily(
    familyId: string
  ): Promise<ActiveEscalation[]> {
    try {
      const raw = await api.get<Record<string, unknown>[]>(
        `/api/health/escalations?familyId=${encodeURIComponent(familyId)}&status=active`
      );

      return (raw ?? []).map((item) => ({
        ...(item as unknown as ActiveEscalation),
        createdAt: item.createdAt ? new Date(item.createdAt as string) : new Date(),
        lastEscalatedAt: item.lastEscalatedAt
          ? new Date(item.lastEscalatedAt as string)
          : new Date(),
        nextEscalationAt: item.nextEscalationAt
          ? new Date(item.nextEscalationAt as string)
          : undefined,
      }));
    } catch (error) {
      logger.error(
        "Failed to get active escalations",
        { familyId, error },
        "EscalationService"
      );
      return [];
    }
  }
}

export const escalationService = new EscalationService();
