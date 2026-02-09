import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logger } from "@/lib/utils/logger";
import type { VitalReading } from "./rulesEngine";

const getLocalizedText = (key: string, isArabic: boolean): string => {
  const texts: Record<string, { en: string; ar: string }> = {
    elevatedHeartRate: {
      en: "Elevated resting heart rate",
      ar: "ارتفاع معدل ضربات القلب أثناء الراحة",
    },
    lowHeartRate: {
      en: "Low resting heart rate",
      ar: "انخفاض معدل ضربات القلب أثناء الراحة",
    },
    elevatedBloodPressure: {
      en: "Elevated blood pressure",
      ar: "ارتفاع ضغط الدم",
    },
    lowBloodPressure: {
      en: "Low blood pressure",
      ar: "انخفاض ضغط الدم",
    },
    lowOxygenSaturation: {
      en: "Below-normal oxygen saturation",
      ar: "انخفاض نسبة الأكسجين في الدم",
    },
    highGlucoseVariability: {
      en: "High blood glucose variability",
      ar: "تقلب كبير في مستوى السكر في الدم",
    },
    seekImmediateMedical: {
      en: "Seek immediate medical attention",
      ar: "اطلب الرعاية الطبية الفورية",
    },
    contactProviderUrgently: {
      en: "Contact your healthcare provider urgently",
      ar: "اتصل بمقدم الرعاية الصحية على الفور",
    },
    scheduleConsultation: {
      en: "Schedule a consultation with your healthcare provider soon",
      ar: "حدد موعدًا للاستشارة مع مقدم الرعاية الصحية قريبًا",
    },
    monitorVitalsFrequently: {
      en: "Monitor your vitals more frequently",
      ar: "راقب علاماتك الحيوية بشكل متكرر",
    },
    avoidCaffeineActivity: {
      en: "Avoid caffeine and strenuous activity",
      ar: "تجنب الكافيين والنشاط الشاق",
    },
    practiceDeepBreathing: {
      en: "Practice deep breathing exercises",
      ar: "مارس تمارين التنفس العميق",
    },
    reduceSodiumIntake: {
      en: "Reduce sodium intake",
      ar: "قلل من تناول الصوديوم",
    },
    takeBPAtRest: {
      en: "Take blood pressure readings at rest",
      ar: "قس ضغط الدم أثناء الراحة",
    },
    checkMealTiming: {
      en: "Check your meal timing and carbohydrate intake",
      ar: "تحقق من توقيت وجباتك وكمية الكربوهيدرات",
    },
    monitorGlucose: {
      en: "Monitor blood glucose before and after meals",
      ar: "راقب مستوى السكر في الدم قبل وبعد الوجبات",
    },
    ensureVentilation: {
      en: "Ensure good ventilation in your environment",
      ar: "تأكد من التهوية الجيدة في بيئتك",
    },
    pursedLipBreathing: {
      en: "Practice pursed-lip breathing",
      ar: "مارس تقنية التنفس بالشفاه المزمومة",
    },
    insufficientData: {
      en: "Insufficient data for trend analysis",
      ar: "بيانات غير كافية لتحليل الاتجاه",
    },
    stableReadings: {
      en: "Stable readings",
      ar: "قراءات مستقرة",
    },
    rapidlyIncreasing: {
      en: "Rapidly increasing",
      ar: "يزداد بسرعة",
    },
    rapidlyDecreasing: {
      en: "Rapidly decreasing",
      ar: "يتناقص بسرعة",
    },
    significantlyIncreasing: {
      en: "Significantly increasing",
      ar: "يزداد بشكل ملحوظ",
    },
    significantlyDecreasing: {
      en: "Significantly decreasing",
      ar: "يتناقص بشكل ملحوظ",
    },
    slightlyIncreasing: {
      en: "Slightly increasing",
      ar: "يزداد قليلاً",
    },
    slightlyDecreasing: {
      en: "Slightly decreasing",
      ar: "يتناقص قليلاً",
    },
    anomaly: {
      en: "anomaly",
      ar: "شذوذ",
    },
    trend: {
      en: "trend",
      ar: "اتجاه",
    },
    abnormalReading: {
      en: "Abnormal reading detected",
      ar: "تم اكتشاف قراءة غير طبيعية",
    },
    changePercent: {
      en: "change",
      ar: "تغيير",
    },
  };
  return texts[key]?.[isArabic ? "ar" : "en"] || texts[key]?.en || key;
};

export type PersonalizedBaseline = {
  userId: string;
  vitalType: string;
  mean: number;
  standardDeviation: number;
  min: number;
  max: number;
  sampleCount: number;
  lastUpdated: Date;
  percentiles: {
    p5: number;
    p25: number;
    p50: number;
    p75: number;
    p95: number;
  };
};

export type HealthScore = {
  userId: string;
  timestamp: Date;
  overallScore: number;
  components: {
    cardiovascular: number;
    respiratory: number;
    metabolic: number;
    activity: number;
  };
  trend: "improving" | "stable" | "declining";
  riskFactors: string[];
};

export type AnomalyDetection = {
  isAnomaly: boolean;
  zScore: number;
  deviationFromBaseline: number;
  confidence: number;
  message?: string;
};

export type VitalCorrelation = {
  vitalType1: string;
  vitalType2: string;
  correlationCoefficient: number;
  strength: "strong" | "moderate" | "weak" | "none";
  direction: "positive" | "negative" | "none";
  sampleSize: number;
};

export type RiskAssessment = {
  userId: string;
  timestamp: Date;
  overallRisk: "low" | "moderate" | "high" | "critical";
  riskScore: number;
  factors: RiskFactor[];
  recommendations: string[];
};

export type RiskFactor = {
  name: string;
  contribution: number;
  severity: "low" | "moderate" | "high";
  description: string;
};

const BASELINES_COLLECTION = "patient_baselines";
const HEALTH_SCORES_COLLECTION = "health_scores";
const RISK_ASSESSMENTS_COLLECTION = "risk_assessments";

class HealthAnalyticsService {
  private readonly alertCooldowns: Map<string, Date> = new Map();
  private readonly alertCounts: Map<string, number> = new Map();

  async getPersonalizedBaseline(
    userId: string,
    vitalType: string
  ): Promise<PersonalizedBaseline | null> {
    try {
      const docRef = doc(db, BASELINES_COLLECTION, `${userId}_${vitalType}`);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      const data = docSnap.data();
      return {
        ...data,
        lastUpdated: data.lastUpdated.toDate(),
      } as PersonalizedBaseline;
    } catch (error) {
      logger.error(
        "Failed to get baseline",
        { userId, vitalType, error },
        "HealthAnalytics"
      );
      return null;
    }
  }

  async updateBaseline(
    userId: string,
    vitalType: string,
    readings: VitalReading[]
  ): Promise<PersonalizedBaseline | null> {
    if (readings.length < 10) {
      return null;
    }

    try {
      const values = readings.map((r) => r.value).sort((a, b) => a - b);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const squaredDiffs = values.map((v) => (v - mean) ** 2);
      const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
      const standardDeviation = Math.sqrt(variance);

      const baseline: PersonalizedBaseline = {
        userId,
        vitalType,
        mean,
        standardDeviation,
        min: values[0] ?? 0,
        max: values.at(-1) ?? 0,
        sampleCount: values.length,
        lastUpdated: new Date(),
        percentiles: {
          p5: this.percentile(values, 5),
          p25: this.percentile(values, 25),
          p50: this.percentile(values, 50),
          p75: this.percentile(values, 75),
          p95: this.percentile(values, 95),
        },
      };

      await setDoc(doc(db, BASELINES_COLLECTION, `${userId}_${vitalType}`), {
        ...baseline,
        lastUpdated: Timestamp.fromDate(baseline.lastUpdated),
      });

      logger.info(
        "Updated patient baseline",
        { userId, vitalType, mean, standardDeviation },
        "HealthAnalytics"
      );
      return baseline;
    } catch (error) {
      logger.error(
        "Failed to update baseline",
        { userId, vitalType, error },
        "HealthAnalytics"
      );
      return null;
    }
  }

  private percentile(sortedValues: number[], p: number): number {
    const index = (p / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    if (upper >= sortedValues.length) {
      return sortedValues.at(-1) ?? 0;
    }
    if (lower < 0) {
      return sortedValues[0];
    }

    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  detectAnomaly(
    reading: VitalReading,
    baseline: PersonalizedBaseline | null,
    defaultThreshold = 2.5
  ): AnomalyDetection {
    if (!baseline || baseline.standardDeviation === 0) {
      return {
        isAnomaly: false,
        zScore: 0,
        deviationFromBaseline: 0,
        confidence: 0,
      };
    }

    const zScore = (reading.value - baseline.mean) / baseline.standardDeviation;
    const absZScore = Math.abs(zScore);
    const deviationFromBaseline =
      ((reading.value - baseline.mean) / baseline.mean) * 100;

    const confidence = Math.min(baseline.sampleCount / 100, 1);
    const adjustedThreshold = defaultThreshold * (2 - confidence);

    const isAnomaly = absZScore > adjustedThreshold;

    let message: string | undefined;
    if (isAnomaly) {
      const direction = zScore > 0 ? "higher" : "lower";
      message = `${reading.type} is ${Math.abs(deviationFromBaseline).toFixed(1)}% ${direction} than your personal baseline`;
    }

    return {
      isAnomaly,
      zScore,
      deviationFromBaseline,
      confidence,
      message,
    };
  }

  async calculateHealthScore(
    userId: string,
    recentVitals: Map<string, VitalReading[]>,
    isArabic = false
  ): Promise<HealthScore> {
    const now = new Date();

    const cardiovascular = this.calculateComponentScore(recentVitals, [
      "heart_rate",
      "systolic_bp",
      "diastolic_bp",
    ]);

    const respiratory = this.calculateComponentScore(recentVitals, [
      "blood_oxygen",
      "respiratory_rate",
    ]);

    const metabolic = this.calculateComponentScore(recentVitals, [
      "blood_glucose",
      "temperature",
    ]);

    const activity = this.calculateComponentScore(recentVitals, [
      "steps",
      "active_minutes",
      "sleep_hours",
    ]);

    const weights = {
      cardiovascular: 0.35,
      respiratory: 0.25,
      metabolic: 0.25,
      activity: 0.15,
    };

    const rawScore =
      cardiovascular * weights.cardiovascular +
      respiratory * weights.respiratory +
      metabolic * weights.metabolic +
      activity * weights.activity;

    const overallScore = Math.max(0, Math.min(100, Math.round(rawScore)));

    const riskFactors = this.identifyRiskFactors(recentVitals, isArabic);
    const trend = await this.calculateScoreTrend(userId, overallScore);

    const healthScore: HealthScore = {
      userId,
      timestamp: now,
      overallScore,
      components: {
        cardiovascular,
        respiratory,
        metabolic,
        activity,
      },
      trend,
      riskFactors,
    };

    try {
      await addDoc(collection(db, HEALTH_SCORES_COLLECTION), {
        ...healthScore,
        timestamp: Timestamp.fromDate(now),
      });
    } catch (error) {
      logger.error(
        "Failed to save health score",
        { userId, error },
        "HealthAnalytics"
      );
    }

    return healthScore;
  }

  private calculateComponentScore(
    vitals: Map<string, VitalReading[]>,
    vitalTypes: string[]
  ): number {
    let totalScore = 0;
    let validCount = 0;

    for (const vitalType of vitalTypes) {
      const readings = vitals.get(vitalType);
      if (!readings || readings.length === 0) {
        continue;
      }

      const latestReading = readings.at(-1);
      if (!latestReading) {
        continue;
      }
      const score = this.scoreVitalReading(latestReading);
      totalScore += score;
      validCount += 1;
    }

    if (validCount === 0) {
      return 75;
    }
    return Math.round(totalScore / validCount);
  }

  private scoreVitalReading(reading: VitalReading): number {
    const optimalRanges: Record<
      string,
      { min: number; max: number; optimal: number }
    > = {
      heart_rate: { min: 50, max: 100, optimal: 70 },
      systolic_bp: { min: 90, max: 140, optimal: 120 },
      diastolic_bp: { min: 60, max: 90, optimal: 80 },
      blood_oxygen: { min: 95, max: 100, optimal: 98 },
      respiratory_rate: { min: 12, max: 20, optimal: 16 },
      blood_glucose: { min: 70, max: 140, optimal: 100 },
      temperature: { min: 36.1, max: 37.2, optimal: 36.6 },
      steps: { min: 0, max: 15_000, optimal: 10_000 },
      active_minutes: { min: 0, max: 120, optimal: 60 },
      sleep_hours: { min: 4, max: 10, optimal: 8 },
    };

    const range = optimalRanges[reading.type];
    if (!range) {
      return 75;
    }

    if (reading.value < range.min || reading.value > range.max) {
      const deviation =
        reading.value < range.min
          ? (range.min - reading.value) / Math.max(range.min, 1)
          : (reading.value - range.max) / Math.max(range.max, 1);
      return Math.max(0, Math.min(100, 100 - Math.abs(deviation) * 50));
    }

    const distanceFromOptimal = Math.abs(reading.value - range.optimal);
    const maxDistance = Math.max(
      range.optimal - range.min,
      range.max - range.optimal
    );
    const normalizedDistance = distanceFromOptimal / maxDistance;

    return Math.round(100 - normalizedDistance * 25);
  }

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Risk factors intentionally combine multiple vital families in one scoring pass.
  private identifyRiskFactors(
    vitals: Map<string, VitalReading[]>,
    isArabic = false
  ): string[] {
    const riskFactors: string[] = [];

    const hrReadings = vitals.get("heart_rate");
    if (hrReadings && hrReadings.length > 0) {
      const avgHR =
        hrReadings.reduce((a, b) => a + b.value, 0) / hrReadings.length;
      if (avgHR > 100) {
        riskFactors.push(getLocalizedText("elevatedHeartRate", isArabic));
      }
      if (avgHR < 50) {
        riskFactors.push(getLocalizedText("lowHeartRate", isArabic));
      }
    }

    const bpReadings = vitals.get("systolic_bp");
    if (bpReadings && bpReadings.length > 0) {
      const avgBP =
        bpReadings.reduce((a, b) => a + b.value, 0) / bpReadings.length;
      if (avgBP > 140) {
        riskFactors.push(getLocalizedText("elevatedBloodPressure", isArabic));
      }
      if (avgBP < 90) {
        riskFactors.push(getLocalizedText("lowBloodPressure", isArabic));
      }
    }

    const o2Readings = vitals.get("blood_oxygen");
    if (o2Readings && o2Readings.length > 0) {
      const avgO2 =
        o2Readings.reduce((a, b) => a + b.value, 0) / o2Readings.length;
      if (avgO2 < 95) {
        riskFactors.push(getLocalizedText("lowOxygenSaturation", isArabic));
      }
    }

    const glucoseReadings = vitals.get("blood_glucose");
    if (glucoseReadings && glucoseReadings.length > 0) {
      const values = glucoseReadings.map((r) => r.value);
      const variance = this.calculateVariance(values);
      if (variance > 500) {
        riskFactors.push(getLocalizedText("highGlucoseVariability", isArabic));
      }
    }

    return riskFactors;
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return (
      values.reduce((sum, val) => sum + (val - mean) ** 2, 0) / values.length
    );
  }

  private async calculateScoreTrend(
    userId: string,
    currentScore: number
  ): Promise<"improving" | "stable" | "declining"> {
    try {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const q = query(
        collection(db, HEALTH_SCORES_COLLECTION),
        where("userId", "==", userId),
        where("timestamp", ">=", Timestamp.fromDate(weekAgo)),
        orderBy("timestamp", "desc"),
        limit(7)
      );

      const snapshot = await getDocs(q);
      if (snapshot.empty || snapshot.docs.length < 3) {
        return "stable";
      }

      const scores = snapshot.docs.map((d) => d.data().overallScore as number);
      const avgPastScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      const diff = currentScore - avgPastScore;

      if (diff > 5) {
        return "improving";
      }
      if (diff < -5) {
        return "declining";
      }
      return "stable";
    } catch (error) {
      logger.error(
        "Failed to calculate score trend",
        { userId, error },
        "HealthAnalytics"
      );
      return "stable";
    }
  }

  calculateCorrelation(
    readings1: VitalReading[],
    readings2: VitalReading[],
    vitalType1: string,
    vitalType2: string
  ): VitalCorrelation {
    const paired = this.pairReadingsByTime(readings1, readings2, 5 * 60 * 1000);

    if (paired.length < 10) {
      return {
        vitalType1,
        vitalType2,
        correlationCoefficient: 0,
        strength: "none",
        direction: "none",
        sampleSize: paired.length,
      };
    }

    const values1 = paired.map((p) => p[0]);
    const values2 = paired.map((p) => p[1]);

    const mean1 = values1.reduce((a, b) => a + b, 0) / values1.length;
    const mean2 = values2.reduce((a, b) => a + b, 0) / values2.length;

    let numerator = 0;
    let sumSq1 = 0;
    let sumSq2 = 0;

    for (let i = 0; i < values1.length; i++) {
      const diff1 = values1[i] - mean1;
      const diff2 = values2[i] - mean2;
      numerator += diff1 * diff2;
      sumSq1 += diff1 * diff1;
      sumSq2 += diff2 * diff2;
    }

    const denominator = Math.sqrt(sumSq1 * sumSq2);
    const correlationCoefficient =
      denominator === 0 ? 0 : numerator / denominator;

    const absCorr = Math.abs(correlationCoefficient);
    let strength: "strong" | "moderate" | "weak" | "none";
    if (absCorr >= 0.7) {
      strength = "strong";
    } else if (absCorr >= 0.4) {
      strength = "moderate";
    } else if (absCorr >= 0.2) {
      strength = "weak";
    } else {
      strength = "none";
    }

    let direction: "positive" | "negative" | "none";
    if (correlationCoefficient > 0.1) {
      direction = "positive";
    } else if (correlationCoefficient < -0.1) {
      direction = "negative";
    } else {
      direction = "none";
    }

    return {
      vitalType1,
      vitalType2,
      correlationCoefficient,
      strength,
      direction,
      sampleSize: paired.length,
    };
  }

  private pairReadingsByTime(
    readings1: VitalReading[],
    readings2: VitalReading[],
    maxTimeDiffMs: number
  ): [number, number][] {
    const pairs: [number, number][] = [];

    for (const r1 of readings1) {
      const closest = readings2.reduce(
        (best, r2) => {
          const diff = Math.abs(
            r1.timestamp.getTime() - r2.timestamp.getTime()
          );
          if (diff < best.diff && diff <= maxTimeDiffMs) {
            return { reading: r2, diff };
          }
          return best;
        },
        { reading: null as VitalReading | null, diff: maxTimeDiffMs + 1 }
      );

      if (closest.reading) {
        pairs.push([r1.value, closest.reading.value]);
      }
    }

    return pairs;
  }

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Risk assessment aggregates anomaly and trend signals across vitals.
  async assessRisk(
    userId: string,
    recentVitals: Map<string, VitalReading[]>,
    baselines: Map<string, PersonalizedBaseline>,
    isArabic = false
  ): Promise<RiskAssessment> {
    const factors: RiskFactor[] = [];
    let totalRiskScore = 0;

    for (const [vitalType, readings] of recentVitals) {
      if (readings.length === 0) {
        continue;
      }

      const baseline = baselines.get(vitalType);
      const latestReading = readings.at(-1);
      if (!latestReading) {
        continue;
      }

      const anomaly = this.detectAnomaly(latestReading, baseline || null);
      if (anomaly.isAnomaly) {
        let severity: "low" | "moderate" | "high" = "low";
        if (Math.abs(anomaly.zScore) > 4) {
          severity = "high";
        } else if (Math.abs(anomaly.zScore) > 3) {
          severity = "moderate";
        }
        const contribution = Math.min(Math.abs(anomaly.zScore) * 10, 30);

        const anomalyLabel = isArabic ? "شذوذ" : "anomaly";
        factors.push({
          name: `${this.formatVitalName(vitalType, isArabic)} ${anomalyLabel}`,
          contribution,
          severity,
          description:
            anomaly.message ||
            (isArabic
              ? `تم اكتشاف قراءة غير طبيعية في ${this.formatVitalName(vitalType, isArabic)}`
              : `Abnormal ${vitalType} reading detected`),
        });

        totalRiskScore += contribution;
      }

      const trend = this.calculateShortTermTrend(readings, isArabic);
      if (trend.concernLevel > 0) {
        const trendLabel = isArabic ? "اتجاه" : "trend";
        let trendSeverity: "low" | "moderate" | "high" = "low";
        if (trend.concernLevel >= 2) {
          trendSeverity = "high";
        } else if (trend.concernLevel >= 1) {
          trendSeverity = "moderate";
        }
        factors.push({
          name: `${this.formatVitalName(vitalType, isArabic)} ${trendLabel}`,
          contribution: trend.concernLevel * 10,
          severity: trendSeverity,
          description: trend.description,
        });
        totalRiskScore += trend.concernLevel * 10;
      }
    }

    const riskScore = Math.min(totalRiskScore, 100);
    let overallRisk: "low" | "moderate" | "high" | "critical";
    if (riskScore >= 70) {
      overallRisk = "critical";
    } else if (riskScore >= 50) {
      overallRisk = "high";
    } else if (riskScore >= 25) {
      overallRisk = "moderate";
    } else {
      overallRisk = "low";
    }

    const recommendations = this.generateRiskRecommendations(
      factors,
      overallRisk,
      isArabic
    );

    const assessment: RiskAssessment = {
      userId,
      timestamp: new Date(),
      overallRisk,
      riskScore,
      factors,
      recommendations,
    };

    try {
      await addDoc(collection(db, RISK_ASSESSMENTS_COLLECTION), {
        ...assessment,
        timestamp: Timestamp.fromDate(assessment.timestamp),
      });
    } catch (error) {
      logger.error(
        "Failed to save risk assessment",
        { userId, error },
        "HealthAnalytics"
      );
    }

    return assessment;
  }

  private calculateShortTermTrend(
    readings: VitalReading[],
    isArabic = false
  ): { concernLevel: number; description: string } {
    if (readings.length < 5) {
      return {
        concernLevel: 0,
        description: getLocalizedText("insufficientData", isArabic),
      };
    }

    const recentValues = readings.slice(-10).map((r) => r.value);
    const firstHalf = recentValues.slice(
      0,
      Math.floor(recentValues.length / 2)
    );
    const secondHalf = recentValues.slice(Math.floor(recentValues.length / 2));

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;

    if (Math.abs(changePercent) < 5) {
      return {
        concernLevel: 0,
        description: getLocalizedText("stableReadings", isArabic),
      };
    }

    const changeText = isArabic
      ? `(${Math.abs(changePercent).toFixed(1)}% تغيير)`
      : `(${Math.abs(changePercent).toFixed(1)}% change)`;

    if (changePercent > 0) {
      if (Math.abs(changePercent) >= 20) {
        return {
          concernLevel: 3,
          description: `${getLocalizedText("rapidlyIncreasing", isArabic)} ${changeText}`,
        };
      }
      if (Math.abs(changePercent) >= 10) {
        return {
          concernLevel: 2,
          description: `${getLocalizedText("significantlyIncreasing", isArabic)} ${changeText}`,
        };
      }
      return {
        concernLevel: 1,
        description: `${getLocalizedText("slightlyIncreasing", isArabic)} ${changeText}`,
      };
    }
    if (Math.abs(changePercent) >= 20) {
      return {
        concernLevel: 3,
        description: `${getLocalizedText("rapidlyDecreasing", isArabic)} ${changeText}`,
      };
    }
    if (Math.abs(changePercent) >= 10) {
      return {
        concernLevel: 2,
        description: `${getLocalizedText("significantlyDecreasing", isArabic)} ${changeText}`,
      };
    }
    return {
      concernLevel: 1,
      description: `${getLocalizedText("slightlyDecreasing", isArabic)} ${changeText}`,
    };
  }

  private generateRiskRecommendations(
    factors: RiskFactor[],
    overallRisk: string,
    isArabic = false
  ): string[] {
    const recommendations: string[] = [];

    if (overallRisk === "critical") {
      recommendations.push(getLocalizedText("seekImmediateMedical", isArabic));
      recommendations.push(
        getLocalizedText("contactProviderUrgently", isArabic)
      );
    } else if (overallRisk === "high") {
      recommendations.push(getLocalizedText("scheduleConsultation", isArabic));
      recommendations.push(
        getLocalizedText("monitorVitalsFrequently", isArabic)
      );
    }

    for (const factor of factors) {
      if (factor.name.includes("heart_rate") && factor.severity !== "low") {
        recommendations.push(
          getLocalizedText("avoidCaffeineActivity", isArabic)
        );
        recommendations.push(
          getLocalizedText("practiceDeepBreathing", isArabic)
        );
      }
      if (factor.name.includes("blood_pressure") && factor.severity !== "low") {
        recommendations.push(getLocalizedText("reduceSodiumIntake", isArabic));
        recommendations.push(getLocalizedText("takeBPAtRest", isArabic));
      }
      if (factor.name.includes("blood_glucose") && factor.severity !== "low") {
        recommendations.push(getLocalizedText("checkMealTiming", isArabic));
        recommendations.push(getLocalizedText("monitorGlucose", isArabic));
      }
      if (factor.name.includes("blood_oxygen") && factor.severity !== "low") {
        recommendations.push(getLocalizedText("ensureVentilation", isArabic));
        recommendations.push(getLocalizedText("pursedLipBreathing", isArabic));
      }
    }

    return [...new Set(recommendations)].slice(0, 5);
  }

  private formatVitalName(type: string, isArabic = false): string {
    const names: Record<string, { en: string; ar: string }> = {
      heart_rate: { en: "Heart Rate", ar: "معدل ضربات القلب" },
      systolic_bp: { en: "Systolic Blood Pressure", ar: "ضغط الدم الانقباضي" },
      diastolic_bp: {
        en: "Diastolic Blood Pressure",
        ar: "ضغط الدم الانبساطي",
      },
      blood_oxygen: { en: "Blood Oxygen", ar: "أكسجين الدم" },
      respiratory_rate: { en: "Respiratory Rate", ar: "معدل التنفس" },
      blood_glucose: { en: "Blood Glucose", ar: "سكر الدم" },
      temperature: { en: "Body Temperature", ar: "درجة حرارة الجسم" },
      steps: { en: "Steps", ar: "الخطوات" },
      active_minutes: { en: "Active Minutes", ar: "دقائق النشاط" },
      sleep_hours: { en: "Sleep Duration", ar: "مدة النوم" },
    };
    const name = names[type];
    if (name) {
      return isArabic ? name.ar : name.en;
    }
    return type.replace(/_/g, " ");
  }

  shouldThrottleAlert(
    userId: string,
    alertType: string,
    cooldownMinutes = 30,
    maxAlertsPerHour = 5
  ): { shouldThrottle: boolean; reason?: string } {
    const key = `${userId}_${alertType}`;
    const now = new Date();

    const lastAlert = this.alertCooldowns.get(key);
    if (lastAlert) {
      const diffMinutes = (now.getTime() - lastAlert.getTime()) / (1000 * 60);
      if (diffMinutes < cooldownMinutes) {
        return {
          shouldThrottle: true,
          reason: `Alert cooldown active (${Math.ceil(cooldownMinutes - diffMinutes)} minutes remaining)`,
        };
      }
    }

    const hourKey = `${key}_${now.getHours()}`;
    const alertCount = this.alertCounts.get(hourKey) || 0;
    if (alertCount >= maxAlertsPerHour) {
      return {
        shouldThrottle: true,
        reason: `Maximum alerts per hour reached (${maxAlertsPerHour})`,
      };
    }

    this.alertCooldowns.set(key, now);
    this.alertCounts.set(hourKey, alertCount + 1);

    return { shouldThrottle: false };
  }

  resetAlertThrottle(userId: string, alertType: string): void {
    const key = `${userId}_${alertType}`;
    this.alertCooldowns.delete(key);
  }
}

export const healthAnalytics = new HealthAnalyticsService();
