import type {
  Allergy,
  LabResult,
  MedicalHistory,
  Medication,
  Mood,
  Symptom,
  User,
} from "@/types";
import { allergyService } from "./allergyService";
import { healthScoreService } from "./healthScoreService";
import { labResultService } from "./labResultService";
import { medicalHistoryService } from "./medicalHistoryService";
import { medicationService } from "./medicationService";
import { moodService } from "./moodService";
import { sharedMedicationScheduleService } from "./sharedMedicationScheduleService";
import { symptomService } from "./symptomService";
import { userService } from "./userService";

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
    const filteredSymptoms = symptoms.filter((s) =>
      s.timestamp >= startDate &&
      s.timestamp <= endDate &&
      s.timestamp instanceof Date
        ? s.timestamp
        : new Date(s.timestamp) >= startDate && new Date(s.timestamp) <= endDate
    );

    const filteredMoods = moods.filter((m) =>
      m.timestamp >= startDate &&
      m.timestamp <= endDate &&
      m.timestamp instanceof Date
        ? m.timestamp
        : new Date(m.timestamp) >= startDate && new Date(m.timestamp) <= endDate
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
      Array.from(moodCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      "N/A";

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
  private calculateSymptomTrend(
    symptoms: Symptom[]
  ): "improving" | "stable" | "worsening" {
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
    try {
      // Custom replacer function to handle Date objects and other non-serializable values
      const replacer = (key: string, value: any): any => {
        // Handle Date objects
        if (value instanceof Date) {
          return value.toISOString();
        }

        // Handle Firestore Timestamp objects
        if (
          value &&
          typeof value === "object" &&
          "toDate" in value &&
          typeof value.toDate === "function"
        ) {
          try {
            return value.toDate().toISOString();
          } catch {
            return null;
          }
        }

        // Handle undefined values
        if (value === undefined) {
          return null;
        }

        return value;
      };

      return JSON.stringify(report, replacer, 2);
    } catch (error) {
      console.error("Error exporting report as JSON:", error);
      throw new Error(
        `Failed to export report: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Format report as HTML for PDF generation
   */
  formatReportAsHTML(report: FamilyHealthReport, isRTL = false): string {
    // Helper function to safely format dates
    const formatDate = (date: Date | string | any): string => {
      try {
        let dateObj: Date;
        if (date instanceof Date) {
          dateObj = date;
        } else if (typeof date === "string") {
          dateObj = new Date(date);
        } else if (
          date &&
          typeof date === "object" &&
          "toDate" in date &&
          typeof date.toDate === "function"
        ) {
          dateObj = date.toDate();
        } else {
          return date?.toString() || "N/A";
        }
        return dateObj.toLocaleDateString(isRTL ? "ar" : "en-US");
      } catch {
        return date?.toString() || "N/A";
      }
    };

    // Helper function to get health score color
    const getHealthScoreColor = (score: number): string => {
      if (score >= 80) return "#10B981"; // Green
      if (score >= 60) return "#F59E0B"; // Orange/Yellow
      return "#EF4444"; // Red
    };

    const direction = isRTL ? "rtl" : "ltr";
    const textAlign = isRTL ? "right" : "left";

    let html = `
      <!DOCTYPE html>
      <html dir="${direction}" lang="${isRTL ? "ar" : "en"}">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            padding: 40px;
            color: #1E293B;
            background: #FFFFFF;
            line-height: 1.6;
          }
          .header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 3px solid #1E3A8A;
          }
          .header h1 {
            font-size: 32px;
            color: #1E3A8A;
            margin-bottom: 10px;
            font-weight: bold;
          }
          .header-info {
            color: #64748B;
            font-size: 14px;
            margin-top: 10px;
          }
          .section {
            margin-bottom: 30px;
          }
          .section-title {
            font-size: 24px;
            color: #1E3A8A;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #E2E8F0;
            font-weight: bold;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin-bottom: 20px;
          }
          .summary-card {
            background: #F8FAFC;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #E2E8F0;
          }
          .summary-label {
            font-size: 14px;
            color: #64748B;
            margin-bottom: 8px;
          }
          .summary-value {
            font-size: 28px;
            font-weight: bold;
            color: #1E293B;
          }
          .health-score {
            color: ${getHealthScoreColor(report.summary.averageHealthScore)};
          }
          .alert-card {
            background: #FEE2E2;
            border: 2px solid #EF4444;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 10px;
          }
          .alert-member {
            font-weight: bold;
            color: #1E293B;
            margin-bottom: 5px;
          }
          .alert-message {
            color: #64748B;
            font-size: 14px;
          }
          .member-card {
            background: #FFFFFF;
            border: 1px solid #E2E8F0;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .member-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            flex-direction: ${isRTL ? "row-reverse" : "row"};
          }
          .member-name {
            font-size: 20px;
            font-weight: bold;
            color: #1E293B;
          }
          .member-score {
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: bold;
          }
          .member-info {
            margin-top: 15px;
          }
          .member-info-item {
            color: #64748B;
            font-size: 14px;
            margin-bottom: 8px;
          }
          .trend {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 10px;
            flex-direction: ${isRTL ? "row-reverse" : "row"};
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #E2E8F0;
            text-align: center;
            color: #64748B;
            font-size: 12px;
          }
          @media print {
            body {
              padding: 20px;
            }
            .section {
              page-break-inside: avoid;
            }
            .member-card {
              page-break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${isRTL ? "تقرير الصحة العائلية" : "Family Health Report"}</h1>
          <div class="header-info">
            <div>${isRTL ? "تاريخ الإنشاء" : "Generated"}: ${formatDate(report.generatedAt)}</div>
            <div>${isRTL ? "الفترة" : "Period"}: ${formatDate(report.period.startDate)} - ${formatDate(report.period.endDate)}</div>
          </div>
        </div>

        <div class="section">
          <h2 class="section-title">${isRTL ? "الملخص" : "Summary"}</h2>
          <div class="summary-grid">
            <div class="summary-card">
              <div class="summary-label">${isRTL ? "إجمالي الأعضاء" : "Total Members"}</div>
              <div class="summary-value">${report.summary.totalMembers}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">${isRTL ? "متوسط النقاط الصحية" : "Average Health Score"}</div>
              <div class="summary-value health-score">${report.summary.averageHealthScore}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">${isRTL ? "الأدوية النشطة" : "Active Medications"}</div>
              <div class="summary-value">${report.summary.totalActiveMedications}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">${isRTL ? "إجمالي الأعراض" : "Total Symptoms"}</div>
              <div class="summary-value">${report.summary.totalSymptoms}</div>
            </div>
          </div>
        </div>
    `;

    // Alerts section
    if (report.summary.alerts.length > 0) {
      html += `
        <div class="section">
          <h2 class="section-title">${isRTL ? "التنبيهات" : "Alerts"}</h2>
      `;
      report.summary.alerts.forEach((alert) => {
        html += `
          <div class="alert-card">
            <div class="alert-member">${alert.member}</div>
            <div class="alert-message">${alert.message}</div>
          </div>
        `;
      });
      html += "</div>";
    }

    // Member details
    html += `
      <div class="section">
        <h2 class="section-title">${isRTL ? "تفاصيل أفراد العائلة" : "Member Details"}</h2>
    `;

    report.members.forEach((memberReport) => {
      const scoreColor = getHealthScoreColor(memberReport.healthScore);
      html += `
        <div class="member-card">
          <div class="member-header">
            <div class="member-name">${memberReport.member.firstName} ${memberReport.member.lastName}</div>
            <div class="member-score" style="background: ${scoreColor}20; border-color: ${scoreColor}; color: ${scoreColor};">
              ${isRTL ? "النقاط" : "Score"}: ${memberReport.healthScore}
            </div>
          </div>
          <div class="member-info">
            <div class="member-info-item">${isRTL ? "الأعراض" : "Symptoms"}: ${memberReport.symptoms.total}</div>
            <div class="member-info-item">${isRTL ? "الأدوية الفعالة" : "Active Medications"}: ${memberReport.medications.active}</div>
            ${
              memberReport.medications.complianceRate !== undefined
                ? `
              <div class="member-info-item">${isRTL ? "الالتزام بالأدوية" : "Compliance"}: ${memberReport.medications.complianceRate}%</div>
            `
                : ""
            }
            <div class="trend">
              <span>${isRTL ? "اتجاه الأعراض الصحية" : "Symptom Trend"}: ${
                isRTL
                  ? memberReport.trends.symptomTrend === "improving"
                    ? "يتحسن"
                    : memberReport.trends.symptomTrend === "worsening"
                      ? "يتدهور"
                      : "مستقر"
                  : memberReport.trends.symptomTrend
              }</span>
            </div>
          </div>
        </div>
      `;
    });

    html += `
        </div>
        <div class="footer">
          ${isRTL ? "تم إنشاء هذا التقرير تلقائياً بواسطة تطبيق Maak" : "This report was automatically generated by Maak Health App"}
        </div>
      </body>
      </html>
    `;

    return html;
  }

  /**
   * Format report as text summary
   */
  formatReportAsText(report: FamilyHealthReport, isRTL = false): string {
    const lines: string[] = [];

    // Helper function to safely format dates
    const formatDate = (date: Date | string | any): string => {
      try {
        let dateObj: Date;
        if (date instanceof Date) {
          dateObj = date;
        } else if (typeof date === "string") {
          dateObj = new Date(date);
        } else if (
          date &&
          typeof date === "object" &&
          "toDate" in date &&
          typeof date.toDate === "function"
        ) {
          dateObj = date.toDate();
        } else {
          return date?.toString() || "N/A";
        }
        return dateObj.toLocaleDateString(isRTL ? "ar" : "en-US");
      } catch {
        return date?.toString() || "N/A";
      }
    };

    lines.push(isRTL ? "تقرير الصحة العائلية" : "Family Health Report");
    lines.push("=".repeat(50));
    lines.push("");

    lines.push(
      isRTL
        ? `تاريخ الإنشاء: ${formatDate(report.generatedAt)}`
        : `Generated: ${formatDate(report.generatedAt)}`
    );
    lines.push(
      isRTL
        ? `الفترة: ${formatDate(report.period.startDate)} - ${formatDate(report.period.endDate)}`
        : `Period: ${formatDate(report.period.startDate)} - ${formatDate(report.period.endDate)}`
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
