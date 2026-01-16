import { logger } from "@/lib/utils/logger";
import { observabilityEmitter } from "./eventEmitter";
import { healthAnalytics, type PersonalizedBaseline } from "./healthAnalytics";
import type { HealthThreshold, EventSeverity } from "./types";

const getLocalizedRulesText = (key: string, isArabic: boolean): string => {
  const texts: Record<string, { en: string; ar: string }> = {
    seekImmediateMedical: {
      en: "Seek immediate medical attention. This reading is extremely unusual for you.",
      ar: "اطلب الرعاية الطبية الفورية. هذه القراءة غير عادية للغاية بالنسبة لك.",
    },
    contactProviderSoon: {
      en: "Contact your healthcare provider soon. This reading is significantly outside your normal range.",
      ar: "اتصل بمقدم الرعاية الصحية قريبًا. هذه القراءة خارج نطاقك الطبيعي بشكل ملحوظ.",
    },
    monitorClosely: {
      en: "This reading is outside your normal range. Monitor closely and consult healthcare provider if it persists.",
      ar: "هذه القراءة خارج نطاقك الطبيعي. راقب عن كثب واستشر مقدم الرعاية الصحية إذا استمرت.",
    },
    unusualForBaseline: {
      en: "is unusual for your personal baseline",
      ar: "غير عادي بالنسبة لمستواك الأساسي الشخصي",
    },
    seekImmediateEmergency: {
      en: "Seek immediate medical attention. Contact emergency services if symptoms are severe.",
      ar: "اطلب الرعاية الطبية الفورية. اتصل بخدمات الطوارئ إذا كانت الأعراض شديدة.",
    },
    contactProviderMonitor: {
      en: "Contact your healthcare provider soon. Monitor for worsening symptoms.",
      ar: "اتصل بمقدم الرعاية الصحية قريبًا. راقب أي تفاقم في الأعراض.",
    },
    isBelow: {
      en: "is below",
      ar: "أقل من",
    },
    isAbove: {
      en: "is above",
      ar: "أعلى من",
    },
    normalRange: {
      en: "normal range",
      ar: "النطاق الطبيعي",
    },
    rapidlyIncreasing: {
      en: "is rapidly increasing",
      ar: "يزداد بسرعة",
    },
    rapidlyDecreasing: {
      en: "is rapidly decreasing",
      ar: "يتناقص بسرعة",
    },
    monitorAndContact: {
      en: "Monitor closely. Contact caregiver if trend continues.",
      ar: "راقب عن كثب. اتصل بمقدم الرعاية إذا استمر الاتجاه.",
    },
    restCalmHydrate: {
      en: "Rest and stay calm. Stay hydrated. If symptoms persist, consult a doctor.",
      ar: "استرح وابقَ هادئًا. ابقَ رطبًا. إذا استمرت الأعراض، استشر طبيبًا.",
    },
    sitRestBreathing: {
      en: "Sit down and rest. Practice deep breathing. Avoid caffeine.",
      ar: "اجلس واسترح. مارس التنفس العميق. تجنب الكافيين.",
    },
    sitUprightBreathe: {
      en: "Sit upright or stand. Take deep breaths. If below 90%, seek medical attention.",
      ar: "اجلس منتصبًا أو قف. خذ أنفاسًا عميقة. إذا كانت أقل من 90%، اطلب الرعاية الطبية.",
    },
    highOxygenOk: {
      en: "No action needed - high oxygen levels are typically not concerning.",
      ar: "لا حاجة لأي إجراء - مستويات الأكسجين العالية عادة ليست مقلقة.",
    },
    consumeSugar: {
      en: "Consume fast-acting sugar (juice, glucose tablets). Recheck in 15 minutes.",
      ar: "تناول سكرًا سريع المفعول (عصير، أقراص جلوكوز). أعد الفحص بعد 15 دقيقة.",
    },
    drinkWaterMeds: {
      en: "Drink water. Check for missed medications. Contact healthcare provider if very high.",
      ar: "اشرب الماء. تحقق من الأدوية الفائتة. اتصل بمقدم الرعاية الصحية إذا كانت القراءة مرتفعة جدًا.",
    },
    warmUpGradually: {
      en: "Warm up gradually. Drink warm fluids. Seek help if severely cold.",
      ar: "سخّن جسمك تدريجيًا. اشرب سوائل دافئة. اطلب المساعدة إذا كنت باردًا جدًا.",
    },
    restHydrateFever: {
      en: "Rest, stay hydrated. Take fever-reducing medication if appropriate.",
      ar: "استرح، ابقَ رطبًا. تناول أدوية خافضة للحرارة إذا كان ذلك مناسبًا.",
    },
    monitorConsultProvider: {
      en: "Monitor and consult healthcare provider if abnormal readings persist.",
      ar: "راقب واستشر مقدم الرعاية الصحية إذا استمرت القراءات غير الطبيعية.",
    },
  };
  return texts[key]?.[isArabic ? "ar" : "en"] || texts[key]?.en || key;
};

const getLocalizedVitalName = (type: string, isArabic: boolean): string => {
  const names: Record<string, { en: string; ar: string }> = {
    heart_rate: { en: "Heart Rate", ar: "معدل ضربات القلب" },
    blood_oxygen: { en: "Blood Oxygen", ar: "أكسجين الدم" },
    systolic_bp: { en: "Systolic Blood Pressure", ar: "ضغط الدم الانقباضي" },
    diastolic_bp: { en: "Diastolic Blood Pressure", ar: "ضغط الدم الانبساطي" },
    temperature: { en: "Body Temperature", ar: "درجة حرارة الجسم" },
    blood_glucose: { en: "Blood Glucose", ar: "سكر الدم" },
    respiratory_rate: { en: "Respiratory Rate", ar: "معدل التنفس" },
  };
  const name = names[type];
  if (name) {
    return isArabic ? name.ar : name.en;
  }
  return type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
};

export interface VitalReading {
  type: string;
  value: number;
  unit: string;
  timestamp: Date;
  userId: string;
}

export interface RuleEvaluation {
  triggered: boolean;
  severity: EventSeverity;
  thresholdBreached?: string;
  message?: string;
  recommendedAction?: string;
  isPersonalizedAnomaly?: boolean;
  zScore?: number;
}

const DEFAULT_THRESHOLDS: HealthThreshold[] = [
  { vitalType: "heart_rate", min: 50, max: 100, unit: "bpm", severity: "warn" },
  { vitalType: "heart_rate", min: 40, max: 120, unit: "bpm", severity: "error" },
  { vitalType: "heart_rate", min: 30, max: 150, unit: "bpm", severity: "critical" },
  { vitalType: "blood_oxygen", min: 95, max: 100, unit: "%", severity: "warn" },
  { vitalType: "blood_oxygen", min: 90, max: 100, unit: "%", severity: "error" },
  { vitalType: "blood_oxygen", min: 85, max: 100, unit: "%", severity: "critical" },
  { vitalType: "systolic_bp", min: 90, max: 140, unit: "mmHg", severity: "warn" },
  { vitalType: "systolic_bp", min: 80, max: 180, unit: "mmHg", severity: "error" },
  { vitalType: "systolic_bp", min: 70, max: 200, unit: "mmHg", severity: "critical" },
  { vitalType: "diastolic_bp", min: 60, max: 90, unit: "mmHg", severity: "warn" },
  { vitalType: "diastolic_bp", min: 50, max: 110, unit: "mmHg", severity: "error" },
  { vitalType: "diastolic_bp", min: 40, max: 130, unit: "mmHg", severity: "critical" },
  { vitalType: "temperature", min: 36.1, max: 37.2, unit: "°C", severity: "warn" },
  { vitalType: "temperature", min: 35.0, max: 38.5, unit: "°C", severity: "error" },
  { vitalType: "temperature", min: 34.0, max: 40.0, unit: "°C", severity: "critical" },
  { vitalType: "blood_glucose", min: 70, max: 140, unit: "mg/dL", severity: "warn" },
  { vitalType: "blood_glucose", min: 55, max: 200, unit: "mg/dL", severity: "error" },
  { vitalType: "blood_glucose", min: 40, max: 300, unit: "mg/dL", severity: "critical" },
  { vitalType: "respiratory_rate", min: 12, max: 20, unit: "breaths/min", severity: "warn" },
  { vitalType: "respiratory_rate", min: 8, max: 30, unit: "breaths/min", severity: "error" },
];

class HealthRulesEngine {
  private thresholds: HealthThreshold[] = DEFAULT_THRESHOLDS;
  private recentReadings: Map<string, VitalReading[]> = new Map();
  private maxReadingsPerUser = 100;
  private baselineCache: Map<string, PersonalizedBaseline> = new Map();
  private baselineCacheExpiry: Map<string, number> = new Map();
  private CACHE_TTL_MS = 5 * 60 * 1000;

  setThresholds(thresholds: HealthThreshold[]): void {
    this.thresholds = thresholds;
  }

  addThreshold(threshold: HealthThreshold): void {
    this.thresholds.push(threshold);
  }

  async evaluateVitalWithPersonalization(reading: VitalReading, isArabic = false): Promise<RuleEvaluation> {
    const baseResult = this.evaluateVital(reading, isArabic);
    
    const cacheKey = `${reading.userId}_${reading.type}`;
    let baseline = this.baselineCache.get(cacheKey);
    const cacheTime = this.baselineCacheExpiry.get(cacheKey) || 0;
    
    if (!baseline || Date.now() > cacheTime) {
      baseline = await healthAnalytics.getPersonalizedBaseline(reading.userId, reading.type) || undefined;
      if (baseline) {
        this.baselineCache.set(cacheKey, baseline);
        this.baselineCacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL_MS);
      }
    }

    if (baseline) {
      const anomaly = healthAnalytics.detectAnomaly(reading, baseline);
      
      if (anomaly.isAnomaly && !baseResult.triggered) {
        const absZScore = Math.abs(anomaly.zScore);
        let severity: EventSeverity;
        let recommendedAction: string;
        
        if (absZScore > 5) {
          severity = "critical";
          recommendedAction = getLocalizedRulesText("seekImmediateMedical", isArabic);
        } else if (absZScore > 4) {
          severity = "error";
          recommendedAction = getLocalizedRulesText("contactProviderSoon", isArabic);
        } else {
          severity = "warn";
          recommendedAction = getLocalizedRulesText("monitorClosely", isArabic);
        }
        
        const unusualText = getLocalizedRulesText("unusualForBaseline", isArabic);
        return {
          triggered: true,
          severity,
          thresholdBreached: `${reading.type}_personalized_anomaly`,
          message: anomaly.message || `${this.formatVitalName(reading.type, isArabic)} ${unusualText}`,
          recommendedAction,
          isPersonalizedAnomaly: true,
          zScore: anomaly.zScore,
        };
      }
      
      if (baseResult.triggered) {
        return {
          ...baseResult,
          isPersonalizedAnomaly: anomaly.isAnomaly,
          zScore: anomaly.zScore,
        };
      }
    }

    return baseResult;
  }

  evaluateVital(reading: VitalReading, isArabic = false): RuleEvaluation {
    const userKey = `${reading.userId}_${reading.type}`;
    
    if (!this.recentReadings.has(userKey)) {
      this.recentReadings.set(userKey, []);
    }
    
    const readings = this.recentReadings.get(userKey)!;
    readings.push(reading);
    
    if (readings.length > this.maxReadingsPerUser) {
      readings.shift();
    }

    const thresholdResult = this.checkThresholds(reading, isArabic);
    if (thresholdResult.triggered) {
      return thresholdResult;
    }

    const trendResult = this.checkTrends(reading, readings, isArabic);
    if (trendResult.triggered) {
      return trendResult;
    }

    return {
      triggered: false,
      severity: "info",
    };
  }

  private checkThresholds(reading: VitalReading, isArabic = false): RuleEvaluation {
    const applicableThresholds = this.thresholds
      .filter((t) => t.vitalType === reading.type)
      .sort((a, b) => {
        const severityOrder = { debug: 0, info: 1, warn: 2, error: 3, critical: 4 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      });

    for (const threshold of applicableThresholds) {
      const belowMin = threshold.min !== undefined && reading.value < threshold.min;
      const aboveMax = threshold.max !== undefined && reading.value > threshold.max;

      if (belowMin || aboveMax) {
        const direction = belowMin ? "below" : "above";
        const limit = belowMin ? threshold.min : threshold.max;
        const directionText = getLocalizedRulesText(belowMin ? "isBelow" : "isAbove", isArabic);
        const normalRangeText = getLocalizedRulesText("normalRange", isArabic);
        
        return {
          triggered: true,
          severity: threshold.severity,
          thresholdBreached: `${reading.type}_${direction}_${limit}`,
          message: `${this.formatVitalName(reading.type, isArabic)} ${directionText} ${normalRangeText} (${reading.value} ${reading.unit})`,
          recommendedAction: this.getRecommendedAction(reading.type, threshold.severity, direction, isArabic),
        };
      }
    }

    return { triggered: false, severity: "info" };
  }

  private checkTrends(reading: VitalReading, history: VitalReading[], isArabic = false): RuleEvaluation {
    if (history.length < 5) {
      return { triggered: false, severity: "info" };
    }

    const recentReadings = history.slice(-10);
    const values = recentReadings.map((r) => r.value);
    
    const trend = this.calculateTrend(values);
    
    const avgValue = values.reduce((a, b) => a + b, 0) / values.length;
    const changePercent = Math.abs((reading.value - avgValue) / avgValue) * 100;

    if (changePercent > 20 && Math.abs(trend) > 0.5) {
      const direction = trend > 0 ? "increasing" : "decreasing";
      const directionText = getLocalizedRulesText(trend > 0 ? "rapidlyIncreasing" : "rapidlyDecreasing", isArabic);
      const changeText = isArabic ? `(${changePercent.toFixed(1)}% تغيير)` : `(${changePercent.toFixed(1)}% change)`;
      
      return {
        triggered: true,
        severity: "warn",
        thresholdBreached: `${reading.type}_rapid_${direction}`,
        message: `${this.formatVitalName(reading.type, isArabic)} ${directionText} ${changeText}`,
        recommendedAction: getLocalizedRulesText("monitorAndContact", isArabic),
      };
    }

    return { triggered: false, severity: "info" };
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    const n = values.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumX2 += i * i;
    }
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  private formatVitalName(type: string, isArabic = false): string {
    return getLocalizedVitalName(type, isArabic);
  }

  private getRecommendedAction(
    vitalType: string,
    severity: EventSeverity,
    direction: string,
    isArabic = false
  ): string {
    if (severity === "critical") {
      return getLocalizedRulesText("seekImmediateEmergency", isArabic);
    }
    
    if (severity === "error") {
      return getLocalizedRulesText("contactProviderMonitor", isArabic);
    }

    const actionKeys: Record<string, Record<string, string>> = {
      heart_rate: {
        below: "restCalmHydrate",
        above: "sitRestBreathing",
      },
      blood_oxygen: {
        below: "sitUprightBreathe",
        above: "highOxygenOk",
      },
      blood_glucose: {
        below: "consumeSugar",
        above: "drinkWaterMeds",
      },
      temperature: {
        below: "warmUpGradually",
        above: "restHydrateFever",
      },
    };

    const actionKey = actionKeys[vitalType]?.[direction];
    if (actionKey) {
      return getLocalizedRulesText(actionKey, isArabic);
    }
    return getLocalizedRulesText("monitorConsultProvider", isArabic);
  }

  async processVitalAndEmit(reading: VitalReading, usePersonalization = true): Promise<RuleEvaluation> {
    const result = usePersonalization 
      ? await this.evaluateVitalWithPersonalization(reading)
      : this.evaluateVital(reading);

    if (result.triggered) {
      const isCriticalSeverity = result.severity === "critical" || result.severity === "error";
      
      if (!isCriticalSeverity) {
        const throttle = healthAnalytics.shouldThrottleAlert(
          reading.userId,
          result.thresholdBreached || reading.type,
          30,
          5
        );

        if (throttle.shouldThrottle) {
          logger.info("Alert throttled", { 
            userId: reading.userId, 
            vitalType: reading.type, 
            reason: throttle.reason 
          }, "RulesEngine");
          return { ...result, triggered: false };
        }
      }

      await observabilityEmitter.emitHealthEvent(
        "vital_threshold_breach",
        result.message || "Vital sign outside normal range",
        {
          userId: reading.userId,
          vitalType: reading.type,
          value: reading.value,
          unit: reading.unit,
          isAbnormal: true,
          thresholdBreached: result.thresholdBreached,
          severity: result.severity,
          status: "pending",
          metadata: {
            recommendedAction: result.recommendedAction,
            isPersonalizedAnomaly: result.isPersonalizedAnomaly,
            zScore: result.zScore,
          },
        }
      );
    } else {
      await observabilityEmitter.emitHealthEvent(
        "vital_recorded",
        `${this.formatVitalName(reading.type)} recorded: ${reading.value} ${reading.unit}`,
        {
          userId: reading.userId,
          vitalType: reading.type,
          value: reading.value,
          unit: reading.unit,
          isAbnormal: false,
          severity: "info",
          status: "success",
        }
      );
    }

    return result;
  }

  async updateUserBaseline(userId: string, vitalType: string): Promise<void> {
    const userKey = `${userId}_${vitalType}`;
    const readings = this.recentReadings.get(userKey);
    
    if (readings && readings.length >= 20) {
      await healthAnalytics.updateBaseline(userId, vitalType, readings);
      logger.info("Updated baseline from accumulated readings", { userId, vitalType, count: readings.length }, "RulesEngine");
    }
  }

  getRecentReadings(userId: string, vitalType: string): VitalReading[] {
    const userKey = `${userId}_${vitalType}`;
    return this.recentReadings.get(userKey) || [];
  }

  clearAlertThrottle(userId: string, alertType: string): void {
    healthAnalytics.resetAlertThrottle(userId, alertType);
  }
}

export const healthRulesEngine = new HealthRulesEngine();
