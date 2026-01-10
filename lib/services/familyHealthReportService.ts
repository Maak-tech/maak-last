import type {
  User,
  Symptom,
  Medication,
  Mood,
  Allergy,
  MedicalHistory,
  LabResult,
} from "@/types";
import { userService } from "./userService";
import { symptomService } from "./symptomService";
import { medicationService } from "./medicationService";
import { moodService } from "./moodService";
import { allergyService } from "./allergyService";
import { medicalHistoryService } from "./medicalHistoryService";
import { labResultService } from "./labResultService";
import { healthScoreService } from "./healthScoreService";
import { sharedMedicationScheduleService } from "./sharedMedicationScheduleService";

export interface ReportPrivacySettings {
  includeSymptoms: boolean;
  includeMedications: boolean;
  includeMoods: boolean;
  includeAllergies: boolean;
  includeMedicalHistory: boolean;
  includeLabResults: boolean;
  includeVitals: boolean;
  includeComplianceData: boolean;
}

export interface FamilyMemberReport {
  member: User;
  healthScore: number;
  symptoms: {
    total: number;
    recent: Symptom[];
    topSymptoms: Array<{ type: string; count: number }>;
  };
  medications: {
    active: number;
    total: number;
    complianceRate?: number;
    list: Medication[];
  };
  moods: {
    recent: Mood[];
    averageIntensity: number;
    mostCommon: string;
  };
  allergies: Allergy[];
  medicalHistory: MedicalHistory[];
  labResults: LabResult[];
  trends: {
    symptomTrend: "improving" | "stable" | "worsening";
    medicationCompliance: "good" | "fair" | "poor";
  };
}

export interface FamilyHealthReport {
  generatedAt: Date;
  period: {
    startDate: Date;
    endDate: Date;
  };
  familyId: string;
  members: FamilyMemberReport[];
  summary: {
    totalMembers: number;
    averageHealthScore: number;
    totalActiveMedications: number;
    totalSymptoms: number;
    commonConditions: Array<{ condition: string; count: number }>;
    alerts: Array<{ member: string; type: string; message: string }>;
  };
}

class FamilyHealthReportService {
  /**
   * Generate comprehensive family health report
   */
  async generateFamilyReport(
    familyId: string,
    startDate: Date,
    endDate: Date,
    privacySettings: Partial<ReportPrivacySettings> = {}
  ): Promise<FamilyHealthReport> {
    try {
      // Get all family members
      const members = await userService.getFamilyMembers(familyId);

      // Default privacy settings (include everything)
      const settings: ReportPrivacySettings = {
        includeSymptoms: true,
        includeMedications: true,
        includeMoods: true,
        includeAllergies: true,
        includeMedicalHistory: true,
        includeLabResults: true,
        includeVitals: true,
        includeComplianceData: true,
        ...privacySettings,
      };

      // Generate report for each member
      const memberReports = await Promise.all(
        members.map((member) =>
          this.generateMemberReport(member, startDate, endDate, settings)
        )
      );

      // Calculate family summary
      const summary = this.calculateFamilySummary(memberReports, settings);

      return {
        generatedAt: new Date(),
        period: { startDate, endDate },
        familyId,
        members: memberReports,
        summary,
      };
    } catch (error) {
      throw new Error("Failed to generate family health report");
    }
  }

  /**
   * Generate report for a single family member
   */
  private async generateMemberReport(
    member: User,
    startDate: Date,
    endDate: Date,
    settings: ReportPrivacySettings
  ): Promise<FamilyMemberReport> {
    const [
      symptoms,
      medications,
      moods,
      allergies,
      medicalHistory,
      labResults,
    ] = await Promise.all([
      settings.includeSymptoms
        ? symptomService.getUserSymptoms(member.id, 1000)
        : Promise.resolve([]),
      settings.includeMedications
        ? medicationService.getUserMedications(member.id)
        : Promise.resolve([]),
      settings.includeMoods
        ? moodService.getUserMoods(member.id, 1000)
        : Promise.resolve([]),
      settings.includeAllergies
        ? allergyService.getUserAllergies(member.id, 1000)
        : Promise.resolve([]),
      settings.includeMedicalHistory
        ? medicalHistoryService.getUserMedicalHistory(member.id)
        : Promise.resolve([]),
      settings.includeLabResults
        ? labResultService.getUserLabResults(member.id)
        : Promise.resolve([]),
    ]);

    // Filter by date range
    const filteredSymptoms = symptoms.filter(
      (s) =>
        s.timestamp >= startDate &&
        s.timestamp <= endDate &&
        s.timestamp instanceof Date
          ? s.timestamp
          : new Date(s.timestamp) >= startDate &&
            new Date(s.timestamp) <= endDate
    );

    const filteredMoods = moods.filter(
      (m) =>
        m.timestamp >= startDate &&
        m.timestamp <= endDate &&
        m.timestamp instanceof Date
          ? m.timestamp
          : new Date(m.timestamp) >= startDate &&
            new Date(m.timestamp) <= endDate
    );

    // Calculate health score
    const healthScoreResult = healthScoreService.calculateHealthScoreFromData(
      filteredSymptoms,
      medications.filter((m) => m.isActive)
    );
    const healthScore = healthScoreResult.score;

    // Get top symptoms
    const symptomCounts = new Map<string, number>();
    filteredSymptoms.forEach((symptom) => {
      const count = symptomCounts.get(symptom.type) || 0;
      symptomCounts.set(symptom.type, count + 1);
    });
    const topSymptoms = Array.from(symptomCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Get medication compliance
    let complianceRate: number | undefined;
    if (settings.includeComplianceData && settings.includeMedications) {
      const scheduleEntries =
        await sharedMedicationScheduleService.getMemberMedicationSchedule(
          member.id,
          member.familyId || ""
        );
      if (scheduleEntries.length > 0) {
        const totalCompliance = scheduleEntries.reduce(
          (sum, entry) => sum + (entry.complianceRate || 0),
          0
        );
        complianceRate = Math.round(totalCompliance / scheduleEntries.length);
      }
    }

    // Calculate mood statistics
    const moodIntensities = filteredMoods.map((m) => m.intensity);
    const averageIntensity =
      moodIntensities.length > 0
        ? moodIntensities.reduce((a, b) => a + b, 0) / moodIntensities.length
        : 0;

    const moodCounts = new Map<string, number>();
    filteredMoods.forEach((mood) => {
      const count = moodCounts.get(mood.mood) || 0;
      moodCounts.set(mood.mood, count + 1);
    });
    const mostCommonMood =
      Array.from(moodCounts.entries())
        .sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

    // Determine trends
    const symptomTrend = this.calculateSymptomTrend(filteredSymptoms);
    const medicationCompliance = complianceRate
      ? complianceRate >= 90
        ? "good"
        : complianceRate >= 70
          ? "fair"
          : "poor"
      : "fair";

    return {
      member,
      healthScore,
      symptoms: {
        total: filteredSymptoms.length,
        recent: filteredSymptoms.slice(0, 10),
        topSymptoms,
      },
      medications: {
        active: medications.filter((m) => m.isActive).length,
        total: medications.length,
        complianceRate,
        list: settings.includeMedications ? medications : [],
      },
      moods: {
        recent: filteredMoods.slice(0, 10),
        averageIntensity: Math.round(averageIntensity * 10) / 10,
        mostCommon: mostCommonMood,
      },
      allergies: settings.includeAllergies ? allergies : [],
      medicalHistory: settings.includeMedicalHistory ? medicalHistory : [],
      labResults: settings.includeLabResults ? labResults : [],
      trends: {
        symptomTrend,
        medicationCompliance: medicationCompliance as "good" | "fair" | "poor",
      },
    };
  }

  /**
   * Calculate family summary statistics
   */
  private calculateFamilySummary(
    memberReports: FamilyMemberReport[],
    settings: ReportPrivacySettings
  ): FamilyHealthReport["summary"] {
    const totalMembers = memberReports.length;
    const averageHealthScore =
      memberReports.reduce((sum, report) => sum + report.healthScore, 0) /
      totalMembers;

    const totalActiveMedications = memberReports.reduce(
      (sum, report) => sum + report.medications.active,
      0
    );

    const totalSymptoms = memberReports.reduce(
      (sum, report) => sum + report.symptoms.total,
      0
    );

    // Find common conditions
    const conditionCounts = new Map<string, number>();
    memberReports.forEach((report) => {
      report.medicalHistory.forEach((history) => {
        const count = conditionCounts.get(history.condition) || 0;
        conditionCounts.set(history.condition, count + 1);
      });
    });
    const commonConditions = Array.from(conditionCounts.entries())
      .map(([condition, count]) => ({ condition, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Generate alerts
    const alerts: Array<{ member: string; type: string; message: string }> = [];
    memberReports.forEach((report) => {
      const memberName = `${report.member.firstName} ${report.member.lastName}`;

      // Low health score alert
      if (report.healthScore < 60) {
        alerts.push({
          member: memberName,
          type: "health_score",
          message: `Low health score: ${report.healthScore}`,
        });
      }

      // Poor medication compliance
      if (
        report.medications.complianceRate !== undefined &&
        report.medications.complianceRate < 70
      ) {
        alerts.push({
          member: memberName,
          type: "compliance",
          message: `Medication compliance: ${report.medications.complianceRate}%`,
        });
      }

      // Worsening symptoms
      if (report.trends.symptomTrend === "worsening") {
        alerts.push({
          member: memberName,
          type: "symptoms",
          message: "Symptoms are worsening",
        });
      }
    });

    return {
      totalMembers,
      averageHealthScore: Math.round(averageHealthScore * 10) / 10,
      totalActiveMedications,
      totalSymptoms,
      commonConditions,
      alerts,
    };
  }

  /**
   * Calculate symptom trend
   */
  private calculateSymptomTrend(symptoms: Symptom[]): "improving" | "stable" | "worsening" {
    if (symptoms.length < 2) return "stable";

    // Split symptoms into two halves
    const midpoint = Math.floor(symptoms.length / 2);
    const firstHalf = symptoms.slice(0, midpoint);
    const secondHalf = symptoms.slice(midpoint);

    const firstHalfAvg =
      firstHalf.reduce((sum, s) => sum + s.severity, 0) / firstHalf.length;
    const secondHalfAvg =
      secondHalf.reduce((sum, s) => sum + s.severity, 0) / secondHalf.length;

    const difference = secondHalfAvg - firstHalfAvg;

    if (difference < -0.5) return "improving";
    if (difference > 0.5) return "worsening";
    return "stable";
  }

  /**
   * Export report as JSON
   */
  async exportReportAsJSON(report: FamilyHealthReport): Promise<string> {
    return JSON.stringify(report, null, 2);
  }

  /**
   * Format report as text summary
   */
  formatReportAsText(report: FamilyHealthReport, isRTL: boolean = false): string {
    const lines: string[] = [];

    lines.push(
      isRTL ? "تقرير الصحة العائلية" : "Family Health Report"
    );
    lines.push("=".repeat(50));
    lines.push("");

    lines.push(
      isRTL
        ? `تاريخ الإنشاء: ${report.generatedAt.toLocaleDateString("ar")}`
        : `Generated: ${report.generatedAt.toLocaleDateString("en-US")}`
    );
    lines.push(
      isRTL
        ? `الفترة: ${report.period.startDate.toLocaleDateString("ar")} - ${report.period.endDate.toLocaleDateString("ar")}`
        : `Period: ${report.period.startDate.toLocaleDateString("en-US")} - ${report.period.endDate.toLocaleDateString("en-US")}`
    );
    lines.push("");

    // Summary
    lines.push(isRTL ? "الملخص" : "Summary");
    lines.push("-".repeat(50));
    lines.push(
      isRTL
        ? `إجمالي الأعضاء: ${report.summary.totalMembers}`
        : `Total Members: ${report.summary.totalMembers}`
    );
    lines.push(
      isRTL
        ? `متوسط النقاط الصحية: ${report.summary.averageHealthScore}`
        : `Average Health Score: ${report.summary.averageHealthScore}`
    );
    lines.push(
      isRTL
        ? `إجمالي الأدوية النشطة: ${report.summary.totalActiveMedications}`
        : `Total Active Medications: ${report.summary.totalActiveMedications}`
    );
    lines.push(
      isRTL
        ? `إجمالي الأعراض: ${report.summary.totalSymptoms}`
        : `Total Symptoms: ${report.summary.totalSymptoms}`
    );
    lines.push("");

    // Alerts
    if (report.summary.alerts.length > 0) {
      lines.push(isRTL ? "التنبيهات" : "Alerts");
      lines.push("-".repeat(50));
      report.summary.alerts.forEach((alert) => {
        lines.push(`${alert.member}: ${alert.message}`);
      });
      lines.push("");
    }

    // Member details
    lines.push(isRTL ? "تفاصيل الأعضاء" : "Member Details");
    lines.push("-".repeat(50));
    report.members.forEach((memberReport) => {
      const memberName = `${memberReport.member.firstName} ${memberReport.member.lastName}`;
      lines.push("");
      lines.push(memberName);
      lines.push(
        isRTL
          ? `  النقاط الصحية: ${memberReport.healthScore}`
          : `  Health Score: ${memberReport.healthScore}`
      );
      lines.push(
        isRTL
          ? `  الأعراض: ${memberReport.symptoms.total}`
          : `  Symptoms: ${memberReport.symptoms.total}`
      );
      lines.push(
        isRTL
          ? `  الأدوية النشطة: ${memberReport.medications.active}`
          : `  Active Medications: ${memberReport.medications.active}`
      );
      if (memberReport.medications.complianceRate !== undefined) {
        lines.push(
          isRTL
            ? `  الامتثال للأدوية: ${memberReport.medications.complianceRate}%`
            : `  Medication Compliance: ${memberReport.medications.complianceRate}%`
        );
      }
    });

    return lines.join("\n");
  }
}

export const familyHealthReportService = new FamilyHealthReportService();
