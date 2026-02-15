import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logger } from "@/lib/utils/logger";
import type { HealthScore, RiskAssessment } from "./healthAnalytics";
import {
  type HealthTimelineEvent,
  healthTimelineService,
} from "./healthTimeline";

export type FamilyMemberSummary = {
  userId: string;
  displayName: string;
  lastActivity: Date | null;
  healthScore: number | null;
  healthTrend: "improving" | "stable" | "declining" | null;
  riskLevel: "low" | "moderate" | "high" | "critical" | null;
  activeAlerts: number;
  recentEvents: HealthTimelineEvent[];
  lastVitals: Record<string, { value: number; unit: string; timestamp: Date }>;
};

export type FamilyHealthDashboard = {
  familyId: string;
  generatedAt: Date;
  members: FamilyMemberSummary[];
  totalActiveAlerts: number;
  criticalAlerts: number;
  recentFamilyEvents: HealthTimelineEvent[];
  aggregateMetrics: {
    averageHealthScore: number;
    membersAtRisk: number;
    membersImproving: number;
    membersDeclining: number;
  };
};

const HEALTH_SCORES_COLLECTION = "health_scores";
const RISK_ASSESSMENTS_COLLECTION = "risk_assessments";
const ALERTS_COLLECTION = "emergency_alerts";

class FamilyDashboardService {
  async generateFamilyDashboard(
    familyId: string,
    memberIds: string[],
    memberNames: Record<string, string>
  ): Promise<FamilyHealthDashboard> {
    const members: FamilyMemberSummary[] = [];
    let totalActiveAlerts = 0;
    let totalCriticalAlerts = 0;
    let totalHealthScore = 0;
    let validScoreCount = 0;
    let membersAtRisk = 0;
    let membersImproving = 0;
    let membersDeclining = 0;

    for (const userId of memberIds) {
      const summary = await this.getMemberSummary(
        userId,
        memberNames[userId] || "Family Member"
      );
      members.push(summary);

      totalActiveAlerts += summary.activeAlerts;
      const criticalCount = await this.getCriticalAlertCount(userId);
      totalCriticalAlerts += criticalCount;

      if (summary.riskLevel === "critical" || summary.riskLevel === "high") {
        membersAtRisk += 1;
      }

      if (summary.healthScore !== null) {
        totalHealthScore += summary.healthScore;
        validScoreCount += 1;
      }

      if (summary.healthTrend === "improving") {
        membersImproving += 1;
      }
      if (summary.healthTrend === "declining") {
        membersDeclining += 1;
      }
    }

    const recentFamilyEvents = await healthTimelineService.getEventsForFamily(
      memberIds,
      {
        limitCount: 20,
      }
    );

    return {
      familyId,
      generatedAt: new Date(),
      members,
      totalActiveAlerts,
      criticalAlerts: totalCriticalAlerts,
      recentFamilyEvents,
      aggregateMetrics: {
        averageHealthScore:
          validScoreCount > 0
            ? Math.round(totalHealthScore / validScoreCount)
            : 0,
        membersAtRisk,
        membersImproving,
        membersDeclining,
      },
    };
  }

  private async getMemberSummary(
    userId: string,
    displayName: string
  ): Promise<FamilyMemberSummary> {
    const [
      healthScore,
      riskAssessment,
      activeAlerts,
      recentEvents,
      lastVitals,
    ] = await Promise.all([
      this.getLatestHealthScore(userId),
      this.getLatestRiskAssessment(userId),
      this.getActiveAlertCount(userId),
      healthTimelineService.getEventsForUser(userId, { limitCount: 5 }),
      this.getLastVitals(userId),
    ]);

    return {
      userId,
      displayName,
      lastActivity: recentEvents.length > 0 ? recentEvents[0].timestamp : null,
      healthScore: healthScore?.overallScore ?? null,
      healthTrend: healthScore?.trend ?? null,
      riskLevel: riskAssessment?.overallRisk ?? null,
      activeAlerts,
      recentEvents,
      lastVitals,
    };
  }

  private async getLatestHealthScore(
    userId: string
  ): Promise<HealthScore | null> {
    try {
      const q = query(
        collection(db, HEALTH_SCORES_COLLECTION),
        where("userId", "==", userId),
        orderBy("timestamp", "desc"),
        limit(1)
      );

      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        return null;
      }

      const data = snapshot.docs[0].data();
      return {
        ...data,
        timestamp: data.timestamp.toDate(),
      } as HealthScore;
    } catch (error) {
      logger.error(
        "Failed to get health score",
        { userId, error },
        "FamilyDashboard"
      );
      return null;
    }
  }

  private async getLatestRiskAssessment(
    userId: string
  ): Promise<RiskAssessment | null> {
    try {
      const q = query(
        collection(db, RISK_ASSESSMENTS_COLLECTION),
        where("userId", "==", userId),
        orderBy("timestamp", "desc"),
        limit(1)
      );

      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        return null;
      }

      const data = snapshot.docs[0].data();
      return {
        ...data,
        timestamp: data.timestamp.toDate(),
      } as RiskAssessment;
    } catch (error) {
      logger.error(
        "Failed to get risk assessment",
        { userId, error },
        "FamilyDashboard"
      );
      return null;
    }
  }

  private async getActiveAlertCount(userId: string): Promise<number> {
    try {
      const q = query(
        collection(db, ALERTS_COLLECTION),
        where("userId", "==", userId),
        where("resolved", "==", false)
      );

      const snapshot = await getDocs(q);
      return snapshot.size;
    } catch (error) {
      logger.error(
        "Failed to get active alerts",
        { userId, error },
        "FamilyDashboard"
      );
      return 0;
    }
  }

  private async getCriticalAlertCount(userId: string): Promise<number> {
    try {
      const q = query(
        collection(db, ALERTS_COLLECTION),
        where("userId", "==", userId),
        where("resolved", "==", false),
        where("priority", "in", ["critical", "high"])
      );

      const snapshot = await getDocs(q);
      return snapshot.size;
    } catch (error) {
      logger.error(
        "Failed to get critical alerts",
        { userId, error },
        "FamilyDashboard"
      );
      return 0;
    }
  }

  private async getLastVitals(
    userId: string
  ): Promise<Record<string, { value: number; unit: string; timestamp: Date }>> {
    const lastVitals: Record<
      string,
      { value: number; unit: string; timestamp: Date }
    > = {};

    try {
      // Use healthDataService to get latest vitals from Firestore vitals collection
      // This ensures we're using the actual saved metrics that match what's displayed in the app
      const vitals =
        await healthDataService.getLatestVitalsFromFirestore(userId);

      if (vitals) {
        // Map VitalSigns to the expected format, including all metrics that are saved
        if (vitals.heartRate !== undefined) {
          lastVitals.heart_rate = {
            value: vitals.heartRate,
            unit: "bpm",
            timestamp: vitals.timestamp,
          };
        }
        if (vitals.restingHeartRate !== undefined) {
          lastVitals.resting_heart_rate = {
            value: vitals.restingHeartRate,
            unit: "bpm",
            timestamp: vitals.timestamp,
          };
        }
        if (vitals.heartRateVariability !== undefined) {
          lastVitals.heart_rate_variability = {
            value: vitals.heartRateVariability,
            unit: "ms",
            timestamp: vitals.timestamp,
          };
        }
        if (vitals.bloodPressure) {
          lastVitals.systolic_bp = {
            value: vitals.bloodPressure.systolic,
            unit: "mmHg",
            timestamp: vitals.timestamp,
          };
          lastVitals.diastolic_bp = {
            value: vitals.bloodPressure.diastolic,
            unit: "mmHg",
            timestamp: vitals.timestamp,
          };
        }
        if (vitals.respiratoryRate !== undefined) {
          lastVitals.respiratory_rate = {
            value: vitals.respiratoryRate,
            unit: "bpm",
            timestamp: vitals.timestamp,
          };
        }
        if (vitals.bodyTemperature !== undefined) {
          lastVitals.temperature = {
            value: vitals.bodyTemperature,
            unit: "°C",
            timestamp: vitals.timestamp,
          };
        }
        if (vitals.oxygenSaturation !== undefined) {
          lastVitals.blood_oxygen = {
            value: vitals.oxygenSaturation,
            unit: "%",
            timestamp: vitals.timestamp,
          };
        }
        if (vitals.bloodGlucose !== undefined) {
          lastVitals.blood_glucose = {
            value: vitals.bloodGlucose,
            unit: "mg/dL",
            timestamp: vitals.timestamp,
          };
        }
        if (vitals.weight !== undefined) {
          lastVitals.weight = {
            value: vitals.weight,
            unit: "kg",
            timestamp: vitals.timestamp,
          };
        }
        if (vitals.height !== undefined) {
          lastVitals.height = {
            value: vitals.height,
            unit: "cm",
            timestamp: vitals.timestamp,
          };
        }
        if (vitals.bodyMassIndex !== undefined) {
          lastVitals.bmi = {
            value: vitals.bodyMassIndex,
            unit: "",
            timestamp: vitals.timestamp,
          };
        }
        if (vitals.steps !== undefined) {
          lastVitals.steps = {
            value: vitals.steps,
            unit: "steps",
            timestamp: vitals.timestamp,
          };
        }
        if (vitals.activeEnergy !== undefined) {
          lastVitals.active_energy = {
            value: vitals.activeEnergy,
            unit: "kcal",
            timestamp: vitals.timestamp,
          };
        }
        if (vitals.sleepHours !== undefined) {
          lastVitals.sleep_hours = {
            value: vitals.sleepHours,
            unit: "hours",
            timestamp: vitals.timestamp,
          };
        }
        if (vitals.waterIntake !== undefined) {
          lastVitals.water_intake = {
            value: vitals.waterIntake,
            unit: "ml",
            timestamp: vitals.timestamp,
          };
        }
      }
    } catch (error) {
      logger.error(
        "Failed to get last vitals",
        { userId, error },
        "FamilyDashboard"
      );
    }

    return lastVitals;
  }

  async getMemberAlertHistory(
    userId: string,
    days = 30
  ): Promise<{ date: Date; count: number; severity: string }[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const events = await healthTimelineService.getEventsForUser(userId, {
        limitCount: 200,
        startDate,
        eventTypes: ["alert_created"],
      });

      const dailyCounts: Record<
        string,
        { count: number; severities: string[] }
      > = {};

      for (const event of events) {
        const dateKey = event.timestamp.toISOString().split("T")[0];
        if (!dailyCounts[dateKey]) {
          dailyCounts[dateKey] = { count: 0, severities: [] };
        }
        dailyCounts[dateKey].count += 1;
        dailyCounts[dateKey].severities.push(event.severity);
      }

      return Object.entries(dailyCounts).map(([date, data]) => ({
        date: new Date(date),
        count: data.count,
        severity: this.getSeverityFromEvents(data.severities),
      }));
    } catch (error) {
      logger.error(
        "Failed to get alert history",
        { userId, error },
        "FamilyDashboard"
      );
      return [];
    }
  }

  async getHealthScoreHistory(
    userId: string,
    days = 30
  ): Promise<{ date: Date; score: number }[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const q = query(
        collection(db, HEALTH_SCORES_COLLECTION),
        where("userId", "==", userId),
        where("timestamp", ">=", Timestamp.fromDate(startDate)),
        orderBy("timestamp", "asc"),
        limit(days)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        date: doc.data().timestamp.toDate(),
        score: doc.data().overallScore,
      }));
    } catch (error) {
      logger.error(
        "Failed to get health score history",
        { userId, error },
        "FamilyDashboard"
      );
      return [];
    }
  }

  private getSeverityFromEvents(
    severities: string[]
  ): "critical" | "error" | "warn" | "info" {
    if (severities.includes("critical")) {
      return "critical";
    }
    if (severities.includes("error")) {
      return "error";
    }
    if (severities.includes("warn")) {
      return "warn";
    }
    return "info";
  }
}

export const familyDashboard = new FamilyDashboardService();
