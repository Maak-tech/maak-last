<<<<<<< Updated upstream
import { auth, db } from '../firebase';
import { doc, getDoc, collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
=======
/* biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: This module intentionally centralizes rich context aggregation and prompt composition for the AI assistant workflow. */
/* biome-ignore-all lint/style/noNestedTernary: Prompt template sections use nested conditional string assembly to preserve concise multilingual rendering logic. */
import { safeFormatDate } from "@/utils/dateFormat";
import { api } from "../apiClient";
import type { VirtualHealthIdentity } from "../../types/vhi";
import { correlationDiscoveryService } from "./correlationDiscoveryService";
import {
  healthInsightsService,
  type PatternInsight,
  type WeeklySummary,
} from "./healthInsightsService";
>>>>>>> Stashed changes

export interface HealthContext {
  profile: {
    name: string;
    age: number;
    gender: string;
    bloodType: string;
    height: string;
    weight: string;
    emergencyContact: string;
    phone?: string;
    email?: string;
  };
  medicalHistory: {
    conditions: Array<{
      condition: string;
      diagnosedDate?: string;
      status?: string;
      notes?: string;
    }>;
    allergies: string[];
    surgeries: string[];
    familyHistory: Array<{
      condition: string;
      relationship?: string;
      notes?: string;
    }>;
  };
  medications: Array<{
    name: string;
    dosage: string;
    frequency: string;
    startDate: string;
    endDate?: string;
    notes?: string;
    isActive: boolean;
    reminders?: string[];
  }>;
  symptoms: Array<{
    name: string;
    severity: string;
    date: string;
    bodyPart?: string;
    duration?: string;
    notes?: string;
  }>;
  familyMembers: Array<{
    id: string;
    name: string;
    relationship: string;
    age?: number;
    conditions?: string[];
    email?: string;
    phone?: string;
    healthStatus?: string;
  }>;
  recentAlerts: Array<{
    type: string;
    timestamp: Date;
    details: string;
    severity?: string;
  }>;
  vitalSigns: {
    heartRate?: number;
    bloodPressure?: string;
    temperature?: number;
    oxygenLevel?: number;
    glucoseLevel?: number;
    weight?: number;
    lastUpdated?: Date;
  };
}

class HealthContextService {
<<<<<<< Updated upstream
  async getUserHealthContext(userId?: string): Promise<HealthContext> {
    const uid = userId || auth.currentUser?.uid;
=======
  private _contextCache = new Map<string, { context: HealthContext; timestamp: number }>();
  private readonly CONTEXT_CACHE_TTL = 300_000; // 5 minutes

  invalidateCache(userId: string) {
    this._contextCache.delete(userId);
  }

  async getUserHealthContext(
    userId?: string,
    options?: { includeFamilyInsights?: boolean; language?: string }
  ): Promise<HealthContext> {
    const uid = userId;
>>>>>>> Stashed changes
    if (!uid) {
      throw new Error('No user ID provided');
    }

    console.log('Fetching comprehensive health context for user:', uid);

<<<<<<< Updated upstream
=======
    // Fetch user profile first (needed for familyId + gender)
    const userRaw = await api.get<Record<string, unknown>>("/api/user/profile").catch(() => null);
    const userData = userRaw ?? {};

    // Prepare date for symptoms query
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const isArabic = options?.language?.startsWith("ar") ?? false;

    // Parallelize independent REST queries for better performance
    const results = await Promise.allSettled([
      // Medications
      api.get<Record<string, unknown>[]>("/api/health/medications"),
      // Symptoms — last 90 days, most recent 50
      api.get<Record<string, unknown>[]>(
        `/api/health/symptoms?from=${ninetyDaysAgo.toISOString()}&limit=50`
      ),
      // Medical history
      api.get<Record<string, unknown>[]>("/api/health/medical-history"),
      // Alerts
      api.get<Record<string, unknown>[]>("/api/alerts?limit=20"),
      // Family members (only if user has a family)
      userData.familyId
        ? api.get<Record<string, unknown>[]>(`/api/family/${userData.familyId}/members`)
        : Promise.resolve([]),
      // Vitals — larger window for daily aggregation
      api.get<Record<string, unknown>[]>("/api/health/vitals?limit=100"),
      healthInsightsService.getWeeklySummary(uid, undefined, isArabic),
      healthInsightsService.getAllInsights(uid, isArabic),
      // Top correlation discoveries for Nora context
      correlationDiscoveryService
        .getTopDiscoveries(uid, 5)
        .catch(() => []),
      // Personalised baseline deviations — fire-and-forget, 30 s timeout
      (async () => {
        try {
          const { userBaselineService } = await import("./userBaselineService");
          const baseline = await userBaselineService.getBaseline(uid);
          return await userBaselineService.detectDeviations(
            uid,
            baseline,
            isArabic
          );
        } catch {
          return [];
        }
      })(),
      // Period tracking (only for female users)
      userData.gender === "female"
        ? Promise.all([
            api.get<Record<string, unknown>[]>("/api/health/period-entries?limit=12"),
            // Cycle info computed client-side from period entries (no separate Firestore doc)
            (async () => {
              try {
                const { periodService } = await import("./periodService");
                return await periodService.getCycleInfo(uid);
              } catch {
                return null;
              }
            })(),
          ])
        : Promise.resolve([null, null]),
      // Lab results — last 6 months, summarised for Nora context
      (async () => {
        try {
          const { labResultService } = await import("./labResultService");
          const sixMonthsAgo = new Date();
          sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
          const allResults = await labResultService.getUserLabResults(uid, 20);
          return allResults.filter((r) => r.testDate >= sixMonthsAgo);
        } catch {
          return [];
        }
      })(),
      // Symptom pattern recognition — detect clusters in recent symptom history
      (async () => {
        try {
          const { symptomPatternRecognitionService } = await import(
            "./symptomPatternRecognitionService"
          );
          const { symptomService } = await import("./symptomService");
          const recentSymptoms = await symptomService.getUserSymptoms(uid, 100);
          if (recentSymptoms.length < 3) return null;
          return await symptomPatternRecognitionService.analyzeSymptomPatterns(
            uid,
            recentSymptoms,
            undefined,
            undefined,
            options?.language?.startsWith("ar") ?? false
          );
        } catch {
          return null;
        }
      })(),
      // Risk assessment — ML-powered health risk profile
      (async () => {
        try {
          const { riskAssessmentService } = await import(
            "./riskAssessmentService"
          );
          return await riskAssessmentService.generateRiskAssessment(
            uid,
            options?.language?.startsWith("ar") ?? false
          );
        } catch {
          return null;
        }
      })(),
    ]);

    const [
      medicationsSnapshot,
      symptomsSnapshot,
      historySnapshot,
      alertsSnapshot,
      familySnapshot,
      vitalsSnapshot,
      insightsMetricsSummary,
      userDetailedInsightsResult,
      topDiscoveriesResult,
      baselineDeviationsResult,
      periodDataResult,
      labResultsResult,
      symptomPatternsResult,
      riskAssessmentResult,
    ] = results;

    // Process medications
    let medications: HealthContext["medications"] = [];
    if (medicationsSnapshot.status === "fulfilled") {
      const medicationsWithSort = (medicationsSnapshot.value ?? []).map(
        (med) => {
          const startDateObj = med.startDate
            ? new Date(med.startDate as string)
            : new Date(0);
          return {
            name: (med.name as string) || "Unknown medication",
            dosage: (med.dosage as string) || "",
            frequency: (med.frequency as string) || "",
            startDate: safeFormatDate(startDateObj) || "",
            endDate: med.endDate
              ? safeFormatDate(new Date(med.endDate as string)) || ""
              : "",
            notes: (med.notes as string) || "",
            isActive: med.isActive !== false,
            reminders: (med.reminders as MedicationReminder[]) || [],
            _startDate: startDateObj,
          };
        }
      );
      medicationsWithSort.sort(
        (a, b) => b._startDate.getTime() - a._startDate.getTime()
      );
      medications = medicationsWithSort.map(({ _startDate, ...med }) => med);
    }

    // Process symptoms
    let symptoms: HealthContext["symptoms"] = [];
    if (symptomsSnapshot.status === "fulfilled") {
      symptoms = (symptomsSnapshot.value ?? []).map((sym) => {
        const severityNum = typeof sym.severity === "number" ? sym.severity : 0;
        const severityLabel =
          severityNum >= 4 ? "severe" : severityNum >= 3 ? "moderate" : "mild";
        return {
          id: sym.id as string,
          name: (sym.type as string) || (sym.name as string) || "Unknown symptom",
          severity: severityLabel,
          date:
            safeFormatDate(
              sym.recordedAt ? new Date(sym.recordedAt as string) : undefined
            ) ||
            (sym.date as string) ||
            "",
          bodyPart:
            (sym.location as string) || (sym.bodyPart as string) || "",
          duration: sym.duration ? String(sym.duration) : "",
          notes: (sym.notes as string) || (sym.description as string) || "",
        };
      });
    }

    // Process medical history
    const medicalHistoryData: HealthContext["medicalHistory"]["conditions"] =
      [];
    const familyMedicalHistory: HealthContext["medicalHistory"]["familyHistory"] =
      [];
    if (historySnapshot.status === "fulfilled") {
      for (const item of (historySnapshot.value ?? [])) {
        const entry = {
          condition: (item.condition as string) || "",
          diagnosedDate: item.diagnosedDate
            ? safeFormatDate(new Date(item.diagnosedDate as string)) || ""
            : "",
          status: (item.severity as string) || "ongoing",
          notes: (item.notes as string) || "",
          relationship: (item.relation as string) || (item.relationship as string) || "",
        };

        if (item.isFamily) {
          familyMedicalHistory.push(entry);
        } else {
          medicalHistoryData.push(entry);
        }
      }
    }

    // Process alerts
    let recentAlerts: HealthContext["recentAlerts"] = [];
    if (alertsSnapshot.status === "fulfilled") {
      recentAlerts = (alertsSnapshot.value ?? []).map((alert) => ({
        id: alert.id as string,
        type: (alert.type as string) || "general",
        timestamp: alert.createdAt
          ? new Date(alert.createdAt as string)
          : new Date(),
        details:
          (alert.body as string) || (alert.title as string) || "",
        severity: (alert.severity as string) || "info",
      }));
    }

    const familyList: Record<string, unknown>[] =
      familySnapshot.status === "fulfilled"
        ? (familySnapshot.value ?? []).filter(
            (member) => (member.id as string) !== uid
          )
        : [];

    // Process family members
    const familyMembers: HealthContext["familyMembers"] = familyList.map(
      (memberData) => ({
        id: memberData.id as string,
        name:
          (memberData.name as string) ||
          (memberData.displayName as string) ||
          "Family Member",
        relationship:
          (memberData.relationship as string) ||
          (memberData.relation as string) ||
          (memberData.role as string) ||
          "Family Member",
        age: memberData.age as number | undefined,
        conditions: (memberData.conditions as string[]) || [],
        email: memberData.email as string | undefined,
        phone:
          (memberData.phone as string) ||
          (memberData.emergencyPhone as string) ||
          undefined,
        healthStatus: "Good",
        recentSymptoms: [],
      })
    );

    // Process user-level 30-day detailed insights (for Nora)
    const userDetailedInsights: PatternInsight[] =
      userDetailedInsightsResult?.status === "fulfilled"
        ? userDetailedInsightsResult.value.slice(0, 10)
        : [];

    // Process top correlation discoveries
    const topDiscoveries: HealthContext["topDiscoveries"] =
      topDiscoveriesResult?.status === "fulfilled" &&
      Array.isArray(topDiscoveriesResult.value)
        ? topDiscoveriesResult.value.map((d) => ({
            title: d.title,
            titleAr: d.titleAr,
            description: d.description,
            descriptionAr: d.descriptionAr,
            recommendation: d.recommendation,
            recommendationAr: d.recommendationAr,
            category: d.category,
            confidence: d.confidence,
            strength: d.strength,
          }))
        : [];

    // Process personalised baseline deviations for Nora awareness
    const baselineDeviations: HealthContext["baselineDeviations"] =
      baselineDeviationsResult?.status === "fulfilled" &&
      Array.isArray(baselineDeviationsResult.value)
        ? baselineDeviationsResult.value
            .filter((d) => d.severity !== "mild") // Only notable changes
            .slice(0, 5)
            .map((d) => ({
              dimension: d.dimension,
              metric: d.metric,
              insight: d.insight,
              insightAr: d.insightAr,
              severity: d.severity,
              direction: d.direction,
              recommendation: d.recommendation,
              recommendationAr: d.recommendationAr,
            }))
        : [];

    // Process lab results — surface flagged values for Nora context
    const labResults: HealthContext["labResults"] =
      labResultsResult?.status === "fulfilled" &&
      Array.isArray(labResultsResult.value)
        ? labResultsResult.value
            .slice(0, 10) // Cap to last 10 tests
            .map((r) => {
              const flagged = r.results.filter(
                (v) => v.status && v.status !== "normal"
              );
              const normalCount = r.results.length - flagged.length;
              return {
                testName: r.testName,
                testDate: safeFormatDate(r.testDate) || "",
                flaggedValues: flagged.map((v) => ({
                  name: v.name,
                  value: String(v.value),
                  unit: v.unit,
                  referenceRange: v.referenceRange,
                  status: v.status,
                })),
                normalCount,
              };
            })
            .filter((r) => r.flaggedValues.length > 0 || r.normalCount > 0)
        : [];

    // Process symptom pattern recognition results
    const symptomPatterns: HealthContext["symptomPatterns"] =
      symptomPatternsResult?.status === "fulfilled" &&
      symptomPatternsResult.value !== null
        ? symptomPatternsResult.value.patterns
            .filter((p) => p.confidence >= 40)
            .slice(0, 5)
            .map((p) => ({
              name: p.name,
              confidence: p.confidence,
              severity: p.severity,
              duration: p.duration,
              matchedSymptoms: p.symptoms,
              triggers: p.triggers,
              description: p.description,
            }))
        : [];

    // Process risk assessment results
    const riskAssessment: HealthContext["riskAssessment"] =
      riskAssessmentResult?.status === "fulfilled" &&
      riskAssessmentResult.value !== null
        ? {
            riskLevel: riskAssessmentResult.value.riskLevel,
            overallRiskScore: Math.round(
              riskAssessmentResult.value.overallRiskScore
            ),
            topRiskFactors: riskAssessmentResult.value.riskFactors
              .sort((a, b) => b.impact - a.impact)
              .slice(0, 5)
              .map((f) => ({
                name: f.name,
                category: f.category,
                riskLevel: f.riskLevel,
                modifiable: f.modifiable,
              })),
            topConditionRisks: riskAssessmentResult.value.conditionRisks
              .slice(0, 3)
              .map((c) => ({
                condition: c.condition,
                riskLevel: c.riskLevel,
              })),
          }
        : undefined;

    // Process user-level health insights metrics
    let insightsMetrics: HealthContext["insightsMetrics"] = null;
    if (insightsMetricsSummary.status === "fulfilled") {
      const weeklySummary = insightsMetricsSummary.value;
      insightsMetrics = {
        weekStart: weeklySummary.weekStart,
        weekEnd: weeklySummary.weekEnd,
        symptomCount: weeklySummary.symptoms.total,
        symptomAverageSeverity: weeklySummary.symptoms.averageSeverity,
        symptomTrend: weeklySummary.symptoms.trend,
        medicationCompliance: weeklySummary.medications.compliance,
        missedDoses: weeklySummary.medications.missedDoses,
        moodAverageIntensity: weeklySummary.moods.averageIntensity,
        moodTrend: weeklySummary.moods.trend,
        topInsights: weeklySummary.insights.slice(0, 5).map((insight) => ({
          type: insight.type,
          title: insight.title,
          description: insight.description,
          confidence: insight.confidence,
          recommendation: insight.recommendation,
        })),
      };
    }

    // Process family insights for admin users only
    const familyInsights: HealthContext["familyInsights"] = [];
    if (
      options?.includeFamilyInsights &&
      userData.familyId &&
      userData.role === "admin" &&
      familyList.length > 0
    ) {
      const insightsResults = await Promise.allSettled(
        familyList.map(async (memberData) => {
          const memberId = memberData.id as string;
          const [summary, allInsights] = await Promise.all([
            healthInsightsService.getWeeklySummary(
              memberId,
              undefined,
              isArabic
            ),
            healthInsightsService.getAllInsights(memberId, isArabic),
          ]);

          return {
            memberId,
            name:
              (memberData.name as string) ||
              (memberData.displayName as string) ||
              "Family Member",
            relationship:
              (memberData.relationship as string) ||
              (memberData.relation as string) ||
              (memberData.role as string) ||
              "Family Member",
            summary,
            insights: allInsights.slice(0, 5),
          };
        })
      );

      for (const result of insightsResults) {
        if (result.status === "fulfilled") {
          familyInsights.push(result.value);
        }
      }
    }

    // Process vitals from vitals collection
    const latestVitals: HealthContext["vitalSigns"] = {
      heartRate: userData.lastHeartRate as number | undefined,
      bloodPressure: userData.lastBloodPressure as string | undefined,
      temperature: userData.lastTemperature as number | undefined,
      oxygenLevel: userData.lastOxygenLevel as number | undefined,
      glucoseLevel: userData.lastGlucoseLevel as number | undefined,
      weight: userData.lastWeight as number | undefined,
      lastUpdated: userData.vitalsLastUpdated
        ? new Date(userData.vitalsLastUpdated as string)
        : undefined,
    };

    if (
      vitalsSnapshot.status === "fulfilled" &&
      (vitalsSnapshot.value ?? []).length > 0
    ) {
      // Get today's date range for aggregating daily totals
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Metrics that should use latest value (not summed)
      const _latestValueMetrics = [
        "heartRate",
        "restingHeartRate",
        "bloodPressure",
        "respiratoryRate",
        "bodyTemperature",
        "oxygenSaturation",
        "bloodGlucose",
        "weight",
        "height",
      ];

      // Metrics that should be summed for daily totals
      const _sumMetrics = [
        "steps",
        "activeEnergy",
        "basalEnergy",
        "distanceWalkingRunning",
        "sleepHours",
        "waterIntake",
      ];

      // Group vitals by type
      const vitalsByType: Record<
        string,
        Array<{
          value: number;
          timestamp: Date;
          metadata?: { systolic?: number; diastolic?: number } | unknown;
        }>
      > = {};

      for (const vital of (vitalsSnapshot.value ?? [])) {
        const vitalType = vital.type as string;
        const timestamp = vital.recordedAt
          ? new Date(vital.recordedAt as string)
          : new Date();

        if (!vitalsByType[vitalType]) {
          vitalsByType[vitalType] = [];
        }
        vitalsByType[vitalType].push({
          value: vital.value as number,
          timestamp,
          metadata: vital.metadata as
            | { systolic?: number; diastolic?: number }
            | unknown,
        });
      }

      // Helper to get latest value for a metric type
      const getLatestValue = (type: string) => {
        const samples = vitalsByType[type];
        if (!samples || samples.length === 0) {
          return null;
        }
        // Sort by timestamp descending and get the latest
        const sorted = [...samples].sort(
          (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
        );
        return sorted[0];
      };

      // Helper to get sum for today's samples
      const getTodaySum = (type: string) => {
        const samples = vitalsByType[type];
        if (!samples || samples.length === 0) {
          return null;
        }
        // Filter samples from today and sum them
        const todaySamples = samples.filter(
          (s) => s.timestamp >= today && s.timestamp < tomorrow
        );
        if (todaySamples.length === 0) {
          return null;
        }
        const sum = todaySamples.reduce((acc, s) => acc + s.value, 0);
        // Return the latest timestamp from today's samples
        const latestTimestamp = todaySamples.reduce(
          (latest, s) => (s.timestamp > latest ? s.timestamp : latest),
          todaySamples[0].timestamp
        );
        return { sum, timestamp: latestTimestamp };
      };

      // Helper to update lastUpdated timestamp
      const updateTimestamp = (timestamp: Date) => {
        if (!latestVitals.lastUpdated || timestamp > latestVitals.lastUpdated) {
          latestVitals.lastUpdated = timestamp;
        }
      };

      // Process latest value metrics
      const heartRate = getLatestValue("heartRate");
      if (heartRate) {
        latestVitals.heartRate = heartRate.value;
        updateTimestamp(heartRate.timestamp);
      }

      const restingHeartRate = getLatestValue("restingHeartRate");
      if (restingHeartRate) {
        latestVitals.restingHeartRate = restingHeartRate.value;
        updateTimestamp(restingHeartRate.timestamp);
      }

      const walkingHeartRateAverage = getLatestValue("walkingHeartRateAverage");
      if (walkingHeartRateAverage) {
        latestVitals.walkingHeartRateAverage = walkingHeartRateAverage.value;
        updateTimestamp(walkingHeartRateAverage.timestamp);
      }

      const heartRateVariability = getLatestValue("heartRateVariability");
      if (heartRateVariability) {
        latestVitals.heartRateVariability = heartRateVariability.value;
        updateTimestamp(heartRateVariability.timestamp);
      }

      const bloodPressure = getLatestValue("bloodPressure");
      if (bloodPressure) {
        if (
          typeof bloodPressure.metadata === "object" &&
          bloodPressure.metadata !== null &&
          "systolic" in bloodPressure.metadata &&
          "diastolic" in bloodPressure.metadata
        ) {
          const pressureData = bloodPressure.metadata as {
            systolic: number;
            diastolic: number;
          };
          latestVitals.bloodPressure = `${pressureData.systolic}/${pressureData.diastolic}`;
        } else {
          latestVitals.bloodPressure = `${bloodPressure.value}`;
        }
        updateTimestamp(bloodPressure.timestamp);
      }

      const respiratoryRate = getLatestValue("respiratoryRate");
      if (respiratoryRate) {
        latestVitals.respiratoryRate = respiratoryRate.value;
        updateTimestamp(respiratoryRate.timestamp);
      }

      const bodyTemperature = getLatestValue("bodyTemperature");
      if (bodyTemperature) {
        latestVitals.temperature = bodyTemperature.value;
        updateTimestamp(bodyTemperature.timestamp);
      }

      const oxygenSaturation = getLatestValue("oxygenSaturation");
      if (oxygenSaturation) {
        latestVitals.oxygenLevel = oxygenSaturation.value;
        updateTimestamp(oxygenSaturation.timestamp);
      }

      const bloodGlucose = getLatestValue("bloodGlucose");
      if (bloodGlucose) {
        latestVitals.glucoseLevel = bloodGlucose.value;
        updateTimestamp(bloodGlucose.timestamp);
      }

      const weight = getLatestValue("weight");
      if (weight) {
        latestVitals.weight = weight.value;
        updateTimestamp(weight.timestamp);
      }

      const height = getLatestValue("height");
      if (height) {
        latestVitals.height = height.value;
        updateTimestamp(height.timestamp);
      }

      const bodyFatPercentage = getLatestValue("bodyFatPercentage");
      if (bodyFatPercentage) {
        latestVitals.bodyFatPercentage = bodyFatPercentage.value;
        updateTimestamp(bodyFatPercentage.timestamp);
      }

      // Process sum metrics (daily totals)
      const stepsSum = getTodaySum("steps");
      if (stepsSum) {
        latestVitals.steps = stepsSum.sum;
        updateTimestamp(stepsSum.timestamp);
      }

      const sleepHoursSum = getTodaySum("sleepHours");
      if (sleepHoursSum) {
        latestVitals.sleepHours = sleepHoursSum.sum;
        updateTimestamp(sleepHoursSum.timestamp);
      }

      const activeEnergySum = getTodaySum("activeEnergy");
      if (activeEnergySum) {
        latestVitals.activeEnergy = activeEnergySum.sum;
        updateTimestamp(activeEnergySum.timestamp);
      }

      const distanceSum = getTodaySum("distanceWalkingRunning");
      if (distanceSum) {
        latestVitals.distanceWalkingRunning = distanceSum.sum;
        updateTimestamp(distanceSum.timestamp);
      }

      const waterIntakeSum = getTodaySum("waterIntake");
      if (waterIntakeSum) {
        latestVitals.waterIntake = waterIntakeSum.sum;
        updateTimestamp(waterIntakeSum.timestamp);
      }
    }

    // Process period tracking data (only for female users)
    let periodTracking: HealthContext["periodTracking"] | undefined;
    if (
      userData.gender === "female" &&
      periodDataResult.status === "fulfilled"
    ) {
      const [periodEntriesRaw, cycleInfoRaw] = periodDataResult.value as [
        Record<string, unknown>[] | null,
        {
          averageCycleLength?: number;
          averagePeriodLength?: number;
          lastPeriodStart?: Date;
          nextPeriodPredicted?: Date;
          ovulationPredicted?: Date;
        } | null,
      ];

      const recentEntries: NonNullable<
        HealthContext["periodTracking"]
      >["recentEntries"] = (periodEntriesRaw ?? []).map((entry) => ({
        startDate: entry.startDate
          ? new Date(entry.startDate as string)
          : new Date(),
        endDate: entry.endDate
          ? new Date(entry.endDate as string)
          : undefined,
        flowIntensity: entry.flowIntensity as "medium" | "light" | "heavy" | undefined,
        symptoms: (entry.symptoms as string[]) || [],
        notes: entry.notes as string | undefined,
      }));

      let cycleInfo:
        | NonNullable<HealthContext["periodTracking"]>["cycleInfo"]
        | undefined;
      if (cycleInfoRaw) {
        cycleInfo = {
          averageCycleLength: cycleInfoRaw.averageCycleLength,
          averagePeriodLength: cycleInfoRaw.averagePeriodLength,
          lastPeriodStart: cycleInfoRaw.lastPeriodStart,
          nextPeriodPredicted: cycleInfoRaw.nextPeriodPredicted,
          ovulationPredicted: cycleInfoRaw.ovulationPredicted,
        };
      }

      if ((recentEntries?.length ?? 0) > 0 || cycleInfo) {
        periodTracking = {
          cycleInfo,
          recentEntries,
        };
      }
    }

    // Fetch VHI from new API (best-effort — does not block context assembly)
    let vhiSummary: string | null = null;
>>>>>>> Stashed changes
    try {
      // Fetch user profile
      const userDoc = await getDoc(doc(db, 'users', uid));
      const userData = userDoc.data() || {};
      console.log('User data found:', {
        hasName: !!userData.name,
        hasFamilyId: !!userData.familyId,
        familyId: userData.familyId
      });

      // Fetch ALL medications (both active and inactive for context)
      let medications = [];
      try {
        const medicationsQuery = query(
          collection(db, 'medications'),
          where('userId', '==', uid),
          orderBy('startDate', 'desc')
        );
        const medicationsSnapshot = await getDocs(medicationsQuery);
        medications = medicationsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || 'Unknown medication',
            dosage: data.dosage || '',
            frequency: data.frequency || '',
            startDate: data.startDate?.toDate?.()?.toLocaleDateString() || '',
            endDate: data.endDate?.toDate?.()?.toLocaleDateString() || '',
            notes: data.notes || '',
            isActive: data.isActive !== false, // Default to true if not specified
            reminders: data.reminders || [],
          };
        });
        console.log(`Found ${medications.length} medications`);
      } catch (error) {
        console.log('Error fetching medications:', error);
      }

      // Fetch ALL symptoms (extended time range)
      let symptoms = [];
      try {
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        
        const symptomsQuery = query(
          collection(db, 'symptoms'),
          where('userId', '==', uid),
          where('timestamp', '>=', ninetyDaysAgo),
          orderBy('timestamp', 'desc'),
          limit(50)
        );
        const symptomsSnapshot = await getDocs(symptomsQuery);
        symptoms = symptomsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || data.symptom || 'Unknown symptom',
            severity: data.severity || 'moderate',
            date: data.timestamp?.toDate?.()?.toLocaleDateString() || data.date || '',
            bodyPart: data.bodyPart || data.location || '',
            duration: data.duration || '',
            notes: data.notes || data.description || '',
          };
        });
        console.log(`Found ${symptoms.length} symptoms`);
      } catch (error) {
        console.log('Error fetching symptoms:', error);
      }

      // Fetch medical history
      let medicalHistoryData = [];
      let familyMedicalHistory = [];
      try {
        const historyQuery = query(
          collection(db, 'medicalHistory'),
          where('userId', '==', uid),
          orderBy('diagnosedDate', 'desc')
        );
        const historySnapshot = await getDocs(historyQuery);
        
        historySnapshot.docs.forEach(doc => {
          const data = doc.data();
          const entry = {
            condition: data.condition || data.name || '',
            diagnosedDate: data.diagnosedDate?.toDate?.()?.toLocaleDateString() || '',
            status: data.status || 'ongoing',
            notes: data.notes || '',
            relationship: data.relationship || '',
          };
          
          if (data.isFamily) {
            familyMedicalHistory.push(entry);
          } else {
            medicalHistoryData.push(entry);
          }
        });
        console.log(`Found ${medicalHistoryData.length} medical history entries and ${familyMedicalHistory.length} family history entries`);
      } catch (error) {
        console.log('Error fetching medical history:', error);
      }

      // Fetch family members
      let familyMembers = [];
      try {
        if (userData.familyId) {
          const familyQuery = query(
            collection(db, 'users'),
            where('familyId', '==', userData.familyId)
          );
          const familySnapshot = await getDocs(familyQuery);
          
          for (const familyDoc of familySnapshot.docs) {
            if (familyDoc.id !== uid) {
              const memberData = familyDoc.data();
              
              // Fetch recent symptoms for family member
              let memberSymptoms = [];
              try {
                const memberSymptomsQuery = query(
                  collection(db, 'symptoms'),
                  where('userId', '==', familyDoc.id),
                  orderBy('timestamp', 'desc'),
                  limit(5)
                );
                const memberSymptomsSnapshot = await getDocs(memberSymptomsQuery);
                memberSymptoms = memberSymptomsSnapshot.docs.map(doc => doc.data().name || doc.data().symptom);
              } catch (e) {
                // Silently fail for family member symptoms
              }
              
              familyMembers.push({
                id: familyDoc.id,
                name: memberData.name || memberData.displayName || 'Family Member',
                relationship: memberData.relationship || memberData.relation || memberData.role || 'Family Member',
                age: memberData.age,
                conditions: memberData.conditions || [],
                email: memberData.email,
                phone: memberData.phone || memberData.emergencyPhone,
                healthStatus: memberSymptoms.length > 0 ? 'Has recent symptoms' : 'Good',
                recentSymptoms: memberSymptoms,
              });
            }
          }
        }
        console.log(`Found ${familyMembers.length} family members`);
      } catch (error) {
        console.log('Error fetching family members:', error);
      }

      // Fetch recent alerts
      let recentAlerts = [];
      try {
        const alertsQuery = query(
          collection(db, 'alerts'),
          where('userId', '==', uid),
          orderBy('timestamp', 'desc'),
          limit(20)
        );
        const alertsSnapshot = await getDocs(alertsQuery);
        recentAlerts = alertsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            type: data.type || 'general',
            timestamp: data.timestamp?.toDate() || new Date(),
            details: data.message || data.details || '',
            severity: data.severity || 'info',
          };
        });
        console.log(`Found ${recentAlerts.length} alerts`);
      } catch (error) {
        console.log('Error fetching alerts:', error);
      }

      // Construct comprehensive health context
      const healthContext: HealthContext = {
        profile: {
          name: userData.displayName || userData.name || 'User',
          age: userData.age || 0,
          gender: userData.gender || 'Not specified',
          bloodType: userData.bloodType || 'Unknown',
          height: userData.height || 'Not specified',
          weight: userData.weight || 'Not specified',
          emergencyContact: userData.emergencyContact || userData.emergencyPhone || 'Not set',
          phone: userData.phone,
          email: userData.email || auth.currentUser?.email || '',
        },
        medicalHistory: {
          conditions: medicalHistoryData,
          allergies: userData.allergies || [],
          surgeries: userData.surgeries || [],
          familyHistory: familyMedicalHistory,
        },
        medications: medications,
        symptoms: symptoms,
        familyMembers: familyMembers,
        recentAlerts: recentAlerts,
        vitalSigns: {
          heartRate: userData.lastHeartRate,
          bloodPressure: userData.lastBloodPressure,
          temperature: userData.lastTemperature,
          oxygenLevel: userData.lastOxygenLevel,
          glucoseLevel: userData.lastGlucoseLevel,
          weight: userData.lastWeight,
          lastUpdated: userData.vitalsLastUpdated?.toDate(),
        },
      };

      console.log('Health context built successfully:', {
        profileComplete: !!healthContext.profile.name,
        medicationsCount: medications.length,
        activeMedications: medications.filter(m => m.isActive).length,
        symptomsCount: symptoms.length,
        conditionsCount: medicalHistoryData.length,
        familyHistoryCount: familyMedicalHistory.length,
        familyMembersCount: familyMembers.length,
        alertsCount: recentAlerts.length,
      });

      return healthContext;
    } catch (error) {
      console.error('Error fetching health context:', error);
      throw error;
    }
<<<<<<< Updated upstream
=======

    // Construct comprehensive health context
    const healthContext: HealthContext = {
      profile: {
        name: (userData.displayName as string | undefined) || (userData.name as string | undefined) || "User",
        age: (userData.age as number | undefined) || 0,
        gender: (userData.gender as string | undefined) || "Not specified",
        bloodType: (userData.bloodType as string | undefined) || "Unknown",
        height: ((userData.height as string | number | undefined) ?? "Not specified").toString(),
        weight: ((userData.weight as string | number | undefined) ?? "Not specified").toString(),
        emergencyContact:
          (userData.emergencyContact as string | undefined) || (userData.emergencyPhone as string | undefined) || "Not set",
        phone: userData.phone as string | undefined,
        email: (userData.email as string | undefined) || "",
      },
      medicalHistory: {
        conditions: medicalHistoryData,
        allergies: (userData.allergies as string[] | undefined) ?? [],
        surgeries: (userData.surgeries as string[] | undefined) ?? [],
        familyHistory: familyMedicalHistory,
      },
      medications,
      symptoms,
      familyMembers,
      familyInsights,
      insightsMetrics,
      userDetailedInsights,
      topDiscoveries,
      baselineDeviations,
      labResults,
      symptomPatterns,
      riskAssessment,
      recentAlerts,
      vitalSigns: latestVitals,
      periodTracking,
      vhiSummary,
    };

    this._contextCache.set(uid, { context: healthContext, timestamp: Date.now() });
    return healthContext;
>>>>>>> Stashed changes
  }

  generateSystemPrompt(context: HealthContext): string {
    const activeMedications = context.medications.filter(m => m.isActive);
    const inactiveMedications = context.medications.filter(m => !m.isActive);
    
    const prompt = `You are a helpful AI health assistant with access to the user's comprehensive health profile. 
    
PATIENT PROFILE:
- Name: ${context.profile.name}
- Age: ${context.profile.age > 0 ? `${context.profile.age} years old` : 'Not specified'}
- Gender: ${context.profile.gender}
- Blood Type: ${context.profile.bloodType}
- Height: ${context.profile.height}
- Weight: ${context.profile.weight}
- Emergency Contact: ${context.profile.emergencyContact}

MEDICAL HISTORY:
Current Conditions: ${context.medicalHistory.conditions.length > 0 ? 
  context.medicalHistory.conditions.map(c => 
    `\n  • ${c.condition}${c.diagnosedDate ? ` (diagnosed: ${c.diagnosedDate})` : ''}${c.status ? ` - ${c.status}` : ''}${c.notes ? ` - ${c.notes}` : ''}`
  ).join('') : '\n  • No chronic conditions reported'}

Allergies: ${context.medicalHistory.allergies.length > 0 ? 
  context.medicalHistory.allergies.map(a => `\n  • ${a}`).join('') : '\n  • No known allergies'}

Previous Surgeries: ${context.medicalHistory.surgeries.length > 0 ? 
  context.medicalHistory.surgeries.map(s => `\n  • ${s}`).join('') : '\n  • No previous surgeries'}

Family Medical History: ${context.medicalHistory.familyHistory.length > 0 ?
  context.medicalHistory.familyHistory.map(f => 
    `\n  • ${f.condition}${f.relationship ? ` (${f.relationship})` : ''}`
  ).join('') : '\n  • No family history recorded'}

CURRENT MEDICATIONS:
${activeMedications.length > 0 ? activeMedications.map(med => 
  `• ${med.name}: ${med.dosage}, ${med.frequency}
  Started: ${med.startDate}${med.endDate ? `, Ends: ${med.endDate}` : ' (ongoing)'}
  ${med.reminders.length > 0 ? `Reminders: ${med.reminders.join(', ')}` : ''}
  ${med.notes ? `Notes: ${med.notes}` : ''}`
).join('\n') : '• No current medications'}

${inactiveMedications.length > 0 ? `\nPAST MEDICATIONS:\n${inactiveMedications.slice(0, 5).map(med => 
  `• ${med.name}: ${med.dosage} (discontinued)`
).join('\n')}` : ''}

RECENT SYMPTOMS (Last 90 days):
${context.symptoms.length > 0 ? context.symptoms.slice(0, 10).map(symptom => 
  `• ${symptom.date}: ${symptom.name} (Severity: ${symptom.severity})
  ${symptom.bodyPart ? `Location: ${symptom.bodyPart}` : ''}
  ${symptom.duration ? `Duration: ${symptom.duration}` : ''}
  ${symptom.notes ? `Notes: ${symptom.notes}` : ''}`
).join('\n') : '• No recent symptoms reported'}

FAMILY MEMBERS:
${context.familyMembers.length > 0 ? context.familyMembers.map(member => 
  `• ${member.name} (${member.relationship}${member.age ? `, ${member.age} years old` : ''})
  ${member.conditions && member.conditions.length > 0 ? `Conditions: ${member.conditions.join(', ')}` : ''}
  ${member.healthStatus ? `Status: ${member.healthStatus}` : ''}`
).join('\n') : '• No family members connected yet. Family members can be added through the Family tab.'}

${context.recentAlerts.length > 0 ? `\nRECENT HEALTH ALERTS:\n${context.recentAlerts.slice(0, 5).map(alert => 
  `• ${alert.timestamp.toLocaleDateString()}: ${alert.type} - ${alert.details}`
).join('\n')}` : ''}

${context.vitalSigns.lastUpdated ? `
RECENT VITAL SIGNS (${context.vitalSigns.lastUpdated.toLocaleDateString()}):
• Heart Rate: ${context.vitalSigns.heartRate || 'Not recorded'} bpm
• Blood Pressure: ${context.vitalSigns.bloodPressure || 'Not recorded'}
• Temperature: ${context.vitalSigns.temperature || 'Not recorded'}°F
• Oxygen Level: ${context.vitalSigns.oxygenLevel || 'Not recorded'}%
${context.vitalSigns.glucoseLevel ? `• Glucose: ${context.vitalSigns.glucoseLevel} mg/dL` : ''}
${context.vitalSigns.weight ? `• Weight: ${context.vitalSigns.weight}` : ''}
` : ''}

INSTRUCTIONS FOR YOUR RESPONSES:
1. Provide personalized health insights based on the complete medical profile
2. Consider all medications when discussing drug interactions or new treatments
3. Be aware of all allergies and conditions when giving advice
4. Reference recent symptoms to identify patterns or concerns
5. Consider family medical history for hereditary condition risks
6. Always remind users to consult healthcare professionals for medical decisions
7. Be empathetic and supportive while being informative
8. Provide practical, actionable advice when appropriate
9. If you notice concerning patterns in symptoms or vital signs, gently suggest medical consultation

Remember: You are an AI assistant providing information and support, not a replacement for professional medical advice. Always encourage users to seek professional medical help for serious concerns.`;

    return prompt;
  }

  async getContextualPrompt(userId?: string): Promise<string> {
    const context = await this.getUserHealthContext(userId);
    return this.generateSystemPrompt(context);
  }
}

export default new HealthContextService();