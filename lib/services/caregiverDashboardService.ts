import type { EmergencyAlert, User } from "@/types";
import { safeFormatTime } from "@/utils/dateFormat";
import { alertService } from "./alertService";
import { emergencySmsService } from "./emergencySmsService";
import { healthScoreService } from "./healthScoreService";
import { medicationService } from "./medicationService";
import { sharedMedicationScheduleService } from "./sharedMedicationScheduleService";
import { symptomService } from "./symptomService";
import { userService } from "./userService";

export type CaregiverDashboardData = {
  member: User;
  healthScore: number;
  recentAlerts: EmergencyAlert[];
  medicationCompliance: {
    rate: number;
    missedDoses: number;
    nextDose?: Date;
  };
  recentSymptoms: Array<{
    type: string;
    severity: number;
    timestamp: Date;
  }>;
  fallDetectionStatus: {
    enabled: boolean;
    lastFall?: Date;
    fallCount: number;
  };
  emergencyContacts: Array<{
    name: string;
    phone: string;
  }>;
  needsAttention: boolean;
  attentionReasons: string[];
};

export type CaregiverOverview = {
  totalMembers: number;
  membersNeedingAttention: number;
  totalActiveAlerts: number;
  averageHealthScore: number;
  members: CaregiverDashboardData[];
};

class CaregiverDashboardService {
  /**
   * Get caregiver dashboard data for all family members
   */
  async getCaregiverOverview(
    caregiverId: string,
    familyId: string
  ): Promise<CaregiverOverview> {
    try {
      // Verify caregiver is admin or caregiver
      const caregiver = await userService.getUser(caregiverId);
      if (
        !caregiver ||
        (caregiver.role !== "admin" && caregiver.role !== "caregiver") ||
        caregiver.familyId !== familyId
      ) {
        throw new Error("Permission denied");
      }

      // Get all family members
      const members = await userService.getFamilyMembers(familyId);

      // Get dashboard data for each member. Use partial results so one failing
      // member does not blank the entire family dashboard.
      const memberResults = await Promise.allSettled(
        members.map((member) => this.getMemberDashboardData(member, familyId))
      );
      const memberData = memberResults.map((result, index) => {
        if (result.status === "fulfilled") {
          return result.value;
        }

        const member = members[index];
        return {
          member,
          healthScore: 100,
          recentAlerts: [],
          medicationCompliance: {
            rate: 100,
            missedDoses: 0,
          },
          recentSymptoms: [],
          fallDetectionStatus: {
            enabled: true,
            fallCount: 0,
          },
          emergencyContacts: member.preferences?.emergencyContacts || [],
          needsAttention: false,
          attentionReasons: [],
        } satisfies CaregiverDashboardData;
      });

      // Calculate overview statistics
      const membersNeedingAttention = memberData.filter(
        (m) => m.needsAttention
      ).length;
      const totalActiveAlerts = memberData.reduce(
        (sum, m) => sum + m.recentAlerts.filter((a) => !a.resolved).length,
        0
      );
      const averageHealthScore =
        memberData.length > 0
          ? memberData.reduce((sum, m) => sum + m.healthScore, 0) /
            memberData.length
          : 0;

      return {
        totalMembers: members.length,
        membersNeedingAttention,
        totalActiveAlerts,
        averageHealthScore: Math.round(averageHealthScore * 10) / 10,
        members: memberData,
      };
    } catch (_error) {
      throw new Error("Failed to get caregiver overview");
    }
  }

  /**
   * Get dashboard data for a specific member
   */
  async getMemberDashboardData(
    member: User,
    familyId: string
  ): Promise<CaregiverDashboardData> {
    try {
      // Get recent alerts
      const alerts = await alertService.getActiveAlerts(member.id);
      const recentAlerts = alerts.slice(0, 5);

      // Get medication compliance
      const scheduleEntries =
        await sharedMedicationScheduleService.getMemberMedicationSchedule(
          member.id,
          familyId
        );
      const complianceRate =
        scheduleEntries.length > 0
          ? Math.round(
              scheduleEntries.reduce(
                (sum, entry) => sum + (entry.complianceRate || 0),
                0
              ) / scheduleEntries.length
            )
          : 100;
      const missedDoses = scheduleEntries.reduce(
        (sum, entry) => sum + (entry.missedDoses || 0),
        0
      );
      const nextDose = scheduleEntries.find(
        (entry) => entry.nextDose
      )?.nextDose;

      // Get recent symptoms
      const symptoms = await symptomService.getUserSymptoms(member.id, 10);
      const recentSymptoms = symptoms.map((s) => ({
        type: s.type,
        severity: s.severity,
        timestamp:
          s.timestamp instanceof Date ? s.timestamp : new Date(s.timestamp),
      }));

      // Get health score
      const medications = await medicationService.getUserMedications(member.id);
      const healthScoreResult = healthScoreService.calculateHealthScoreFromData(
        symptoms,
        medications.filter((m) => m.isActive)
      );
      const healthScore = healthScoreResult.score;

      // Get fall detection status (simplified - would need to check actual fall detection state)
      const fallAlerts = recentAlerts.filter((a) => a.type === "fall");
      const fallDetectionStatus = {
        enabled: true, // Would need to check actual state
        lastFall: fallAlerts.length > 0 ? fallAlerts[0].timestamp : undefined,
        fallCount: fallAlerts.length,
      };

      // Determine if member needs attention
      const attentionReasons: string[] = [];
      if (healthScore < 60) {
        attentionReasons.push("Low health score");
      }
      if (complianceRate < 70) {
        attentionReasons.push("Poor medication compliance");
      }
      if (missedDoses > 0) {
        attentionReasons.push("Missed medication doses");
      }
      if (recentAlerts.some((a) => !a.resolved && a.severity === "critical")) {
        attentionReasons.push("Critical alerts");
      }
      if (fallAlerts.length > 0) {
        attentionReasons.push("Recent falls detected");
      }

      const needsAttention = attentionReasons.length > 0;

      return {
        member,
        healthScore,
        recentAlerts,
        medicationCompliance: {
          rate: complianceRate,
          missedDoses,
          nextDose,
        },
        recentSymptoms,
        fallDetectionStatus,
        emergencyContacts: member.preferences?.emergencyContacts || [],
        needsAttention,
        attentionReasons,
      };
    } catch (_error) {
      throw new Error("Failed to get member dashboard data");
    }
  }

  /**
   * Get simplified dashboard for elderly user
   */
  async getElderlyUserDashboard(userId: string): Promise<{
    nextMedication?: {
      name: string;
      time: string;
      dosage: string;
    };
    healthScore: number;
    hasAlerts: boolean;
    emergencyContacts: Array<{ name: string; phone: string }>;
  }> {
    try {
      const user = await userService.getUser(userId);
      if (!user?.familyId) {
        throw new Error("User not found or not in family");
      }

      // Get next medication
      const scheduleEntries =
        await sharedMedicationScheduleService.getMemberMedicationSchedule(
          userId,
          user.familyId
        );
      const nextEntry = scheduleEntries.find((entry) => entry.nextDose);
      const nextMedication = nextEntry
        ? {
            name: nextEntry.medication.name,
            time: safeFormatTime(nextEntry.nextDose, "en-US", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            dosage: nextEntry.medication.dosage,
          }
        : undefined;

      // Get health score
      const symptoms = await symptomService.getUserSymptoms(userId, 10);
      const medications = await medicationService.getUserMedications(userId);
      const healthScoreResult = healthScoreService.calculateHealthScoreFromData(
        symptoms,
        medications.filter((m) => m.isActive)
      );

      // Check for alerts
      const alerts = await alertService.getActiveAlerts(userId);
      const hasAlerts = alerts.some((a) => !a.resolved);

      return {
        nextMedication,
        healthScore: healthScoreResult.score,
        hasAlerts,
        emergencyContacts: user.preferences?.emergencyContacts || [],
      };
    } catch (_error) {
      throw new Error("Failed to get elderly user dashboard");
    }
  }

  /**
   * Send emergency alert to caregivers
   */
  async sendEmergencyAlert(
    userId: string,
    type: "medical" | "fall" | "other",
    message: string
  ): Promise<void> {
    try {
      const user = await userService.getUser(userId);
      if (!user?.familyId) {
        throw new Error("User not found or not in family");
      }

      // Create alert
      const mappedType = type === "fall" ? "fall" : "emergency";
      const alertId = await alertService.createAlert({
        userId,
        type: mappedType,
        severity: "critical",
        message,
        timestamp: new Date(),
        resolved: false,
      });

      // Notify caregivers (admins)
      const { pushNotificationService } = await import(
        "./pushNotificationService"
      );
      const familyMembers = await userService.getFamilyMembers(user.familyId);
      const admins = familyMembers.filter(
        (m) => m.role === "admin" && m.id !== userId
      );

      await Promise.all(
        admins.map((admin) =>
          pushNotificationService.sendToUser(admin.id, {
            title: "🚨 Emergency Alert",
            body: `${user.firstName} ${user.lastName}: ${message}`,
            data: {
              type: "emergency_alert",
              alertId,
              userId,
              severity: "critical",
            },
            priority: "high",
            sound: "default",
          })
        )
      );

      await emergencySmsService.sendEmergencySms({
        userId,
        alertType: "sos",
        message: `Emergency SOS from ${user.firstName} ${user.lastName}: ${message}`,
      });
    } catch (_error) {
      throw new Error("Failed to send emergency alert");
    }
  }
}

export const caregiverDashboardService = new CaregiverDashboardService();
