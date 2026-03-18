import { api } from "@/lib/apiClient";
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
      const raw = await api.get<Record<string, unknown>[]>(
        `/api/health/scores?userId=${encodeURIComponent(userId)}&limit=1`
      );
      if (!raw || raw.length === 0) {
        return null;
      }
      const data = raw[0];
      return {
        ...(data as unknown as HealthScore),
        timestamp: data.timestamp ? new Date(data.timestamp as string) : new Date(),
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
      // No REST endpoint for risk assessments yet; return null
      return null;
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
      const raw = await api.get<Record<string, unknown>[]>(
        `/api/health/alerts?userId=${encodeURIComponent(userId)}&resolved=false`
      );
      return (raw ?? []).length;
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
      const raw = await api.get<Record<string, unknown>[]>(
        `/api/health/alerts?userId=${encodeURIComponent(userId)}&resolved=false&priority=critical,high`
      );
      return (raw ?? []).length;
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
      const raw = await api.get<Record<string, unknown>[]>(
        "/api/health/vitals?limit=20"
      );

      for (const v of raw ?? []) {
        const vType = v.type as string;
        const ts = v.recordedAt ? new Date(v.recordedAt as string) : new Date();
        if (!lastVitals[vType]) {
          lastVitals[vType] = {
            value: v.value as number,
            unit: (v.unit as string) ?? "",
            timestamp: ts,
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
    // No REST endpoint for health score history yet; return empty array
    return [];
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
