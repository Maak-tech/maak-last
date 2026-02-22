/* biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: Risk scoring algorithms combine multiple weighted health signals. */
/* biome-ignore-all lint/style/noNestedTernary: Risk-level branching uses compact conditionals. */
import type { Medication, Mood, Symptom } from "@/types";
import { coerceToDate } from "@/utils/dateCoercion";
import type { VitalSample } from "./healthPatternDetectionService";
import { getVitalDisplayName } from "./healthPatternDetectionService";
import type { PatternInsight } from "./healthPatternDetectionService";

// ─── Math helpers ─────────────────────────────────────────────────────────────

export function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

export function getMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function getStdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = getMean(values);
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

// ─── Medication compliance ────────────────────────────────────────────────────

export function calculateMedicationCompliance(
  medications: Medication[],
  start: Date,
  end: Date
): { compliance: number; missedDoses: number } {
  const activeMedications = medications.filter((med) => med.isActive);
  if (activeMedications.length === 0) {
    return { compliance: 100, missedDoses: 0 };
  }

  const millisPerDay = 24 * 60 * 60 * 1000;
  let expectedDoses = 0;
  let takenDoses = 0;

  for (const medication of activeMedications) {
    const reminders = Array.isArray(medication.reminders)
      ? medication.reminders
      : [];
    const reminderCount = reminders.length;
    if (reminderCount === 0) continue;

    const medStart = medication.startDate ?? start;
    const medEnd = medication.endDate ?? end;
    const overlapStart = medStart > start ? medStart : start;
    const overlapEnd = medEnd < end ? medEnd : end;
    const daysInRange = Math.ceil(
      (overlapEnd.getTime() - overlapStart.getTime()) / millisPerDay
    );
    if (daysInRange <= 0) continue;

    expectedDoses += daysInRange * reminderCount;

    for (const reminder of reminders) {
      if (!(reminder.taken && reminder.takenAt)) continue;
      const takenAt = coerceToDate(reminder.takenAt);
      if (!takenAt) continue;
      if (takenAt >= overlapStart && takenAt < overlapEnd) {
        takenDoses += 1;
      }
    }
  }

  if (expectedDoses === 0) return { compliance: 100, missedDoses: 0 };

  const compliance = (takenDoses / expectedDoses) * 100;
  const missedDoses = Math.max(0, expectedDoses - takenDoses);
  return { compliance: Math.round(compliance), missedDoses };
}

// ─── Risk scoring ─────────────────────────────────────────────────────────────

export function scoreSymptomBurden(
  symptoms: Symptom[],
  start: Date,
  end: Date
): number {
  const inWindow = symptoms.filter(
    (symptom) => symptom.timestamp >= start && symptom.timestamp < end
  );
  if (inWindow.length === 0) return 0;

  const daySpan = Math.max(
    1,
    Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  );
  const averageSeverity =
    inWindow.reduce((sum, symptom) => sum + symptom.severity, 0) /
    inWindow.length;

  const frequencyScore = clamp((inWindow.length / daySpan) * 18, 0, 60);
  const severityScore = clamp((averageSeverity / 5) * 40, 0, 40);
  return Math.round(clamp(frequencyScore + severityScore, 0, 100));
}

export function scoreMoodRisk(
  moods: Mood[],
  start: Date,
  end: Date
): number {
  const inWindow = moods.filter(
    (mood) => mood.timestamp >= start && mood.timestamp < end
  );
  if (inWindow.length === 0) return 0;

  const negativeMoods = new Set<Mood["mood"]>([
    "sad",
    "anxious",
    "stressed",
    "tired",
    "overwhelmed",
    "angry",
    "confused",
    "empty",
  ]);

  const negativeRatio =
    inWindow.filter((mood) => negativeMoods.has(mood.mood)).length /
    inWindow.length;
  const lowIntensityRatio =
    inWindow.filter((mood) => mood.intensity <= 2).length / inWindow.length;

  return Math.round(clamp(negativeRatio * 70 + lowIntensityRatio * 30, 0, 100));
}

export function scoreSleepRisk(vitals: VitalSample[]): number {
  const sleepReadings = vitals
    .filter((vital) => vital.type === "sleepHours")
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 7);

  if (sleepReadings.length < 3) return 0;

  const averageSleep = getMean(sleepReadings.map((r) => r.value));
  if (averageSleep >= 7) return 0;

  return Math.round(clamp(((7 - averageSleep) / 3) * 100, 0, 100));
}

export function getVitalAnomalySignals(vitals: VitalSample[]): Array<{
  type: string;
  zScore: number;
  latest: number;
  baseline: number;
  unit?: string;
}> {
  const byType: Record<string, VitalSample[]> = {};
  for (const vital of vitals) {
    if (!byType[vital.type]) byType[vital.type] = [];
    byType[vital.type].push(vital);
  }

  const anomalies: Array<{
    type: string;
    zScore: number;
    latest: number;
    baseline: number;
    unit?: string;
  }> = [];

  for (const [type, readings] of Object.entries(byType)) {
    if (readings.length < 5) continue;

    const ordered = [...readings].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );
    const values = ordered.map((r) => r.value);
    const baseline = getMean(values);
    const stdDev = getStdDev(values);
    if (stdDev <= 0.01) continue;

    const latest = ordered[ordered.length - 1];
    const zScore = Math.abs((latest.value - baseline) / stdDev);
    if (zScore < 1.8) continue;

    anomalies.push({ type, zScore, latest: latest.value, baseline, unit: latest.unit });
  }

  return anomalies.sort((a, b) => b.zScore - a.zScore);
}

// ─── Predictive model ─────────────────────────────────────────────────────────

export function generatePredictiveInsights(
  symptoms: Symptom[],
  medications: Medication[],
  moods: Mood[],
  vitals: VitalSample[],
  start: Date,
  end: Date,
  isArabic = false
): PatternInsight[] {
  const insights: PatternInsight[] = [];

  const symptomRisk = scoreSymptomBurden(symptoms, start, end);
  const moodRisk = scoreMoodRisk(moods, start, end);
  const sleepRisk = scoreSleepRisk(vitals);
  const { compliance, missedDoses } = calculateMedicationCompliance(medications, start, end);
  const medicationRisk = clamp(
    100 - compliance + Math.min(20, missedDoses * 2),
    0,
    100
  );
  const anomalies = getVitalAnomalySignals(vitals);
  const anomalyRisk =
    anomalies.length > 0
      ? clamp(
          getMean(anomalies.map((s) => s.zScore)) * 32 +
            Math.min(20, anomalies.length * 6),
          0,
          100
        )
      : 0;

  const riskScore = Math.round(
    clamp(
      symptomRisk * 0.34 +
        medicationRisk * 0.22 +
        moodRisk * 0.18 +
        anomalyRisk * 0.16 +
        sleepRisk * 0.1,
      0,
      100
    )
  );

  const evidencePoints =
    symptoms.filter((s) => s.timestamp >= start && s.timestamp < end).length +
    moods.filter((m) => m.timestamp >= start && m.timestamp < end).length +
    vitals.length +
    medications.length * 2;
  const confidence = Math.round(clamp(55 + Math.min(35, evidencePoints / 3), 55, 92));

  const riskLevel =
    riskScore >= 67 ? "high" : riskScore >= 40 ? "moderate" : "low";
  const drivers = [
    {
      label: isArabic ? "عبء الأعراض" : "Symptom burden",
      contribution: symptomRisk * 0.34,
    },
    {
      label: isArabic ? "الالتزام الدوائي" : "Medication adherence",
      contribution: medicationRisk * 0.22,
    },
    {
      label: isArabic ? "المزاج" : "Mood pattern",
      contribution: moodRisk * 0.18,
    },
    {
      label: isArabic ? "شذوذ القياسات الحيوية" : "Vital anomalies",
      contribution: anomalyRisk * 0.16,
    },
    {
      label: isArabic ? "النوم" : "Sleep stability",
      contribution: sleepRisk * 0.1,
    },
  ]
    .filter((d) => d.contribution > 4)
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 3);

  if (evidencePoints >= 8) {
    const title = isArabic
      ? "تقدير المخاطر الصحية (نموذج تنبؤي)"
      : "Predictive Health Risk (ML Model)";
    const driverSummary =
      drivers.length > 0
        ? drivers.map((d) => d.label).join(isArabic ? "، " : ", ")
        : isArabic
          ? "عوامل عامة"
          : "general factors";
    const description = isArabic
      ? `يشير النموذج التنبؤي إلى مستوى خطر ${riskLevel === "high" ? "مرتفع" : riskLevel === "moderate" ? "متوسط" : "منخفض"} بنتيجة ${riskScore}/100. أهم العوامل الحالية: ${driverSummary}.`
      : `The predictive model estimates a ${riskLevel} short-term risk with a score of ${riskScore}/100. Top drivers: ${driverSummary}.`;
    const recommendation =
      riskLevel === "high"
        ? isArabic
          ? "يُنصح بمراجعة المؤشرات الحيوية والأعراض خلال 24 ساعة، وتواصل مع مقدم الرعاية إذا استمر الاتجاه."
          : "Review vitals and symptoms within 24 hours and contact a clinician if this trend continues."
        : riskLevel === "moderate"
          ? isArabic
            ? "استمر في المتابعة اليومية مع التركيز على الالتزام الدوائي والنوم."
            : "Continue daily tracking with focus on medication adherence and sleep regularity."
          : isArabic
            ? "استمر على نفس النمط الصحي الحالي مع الاستمرار في المتابعة."
            : "Maintain current habits and continue routine monitoring.";

    insights.push({
      type: "ml",
      title,
      description,
      confidence,
      actionable: riskLevel !== "low",
      recommendation,
      data: {
        riskScore,
        riskLevel,
        features: { symptomRisk, medicationRisk, moodRisk, anomalyRisk, sleepRisk },
        topDrivers: drivers,
      },
    });
  }

  for (const anomaly of anomalies.slice(0, 2)) {
    if (anomaly.zScore < 2.2) continue;

    const vitalName = getVitalDisplayName(anomaly.type, isArabic);
    const unit = anomaly.unit || "";
    const title = isArabic
      ? `نمط غير معتاد في ${vitalName}`
      : `Anomalous ${vitalName} Pattern`;
    const description = isArabic
      ? `آخر قراءة ${anomaly.latest.toFixed(1)}${unit ? ` ${unit}` : ""} مقارنة بمتوسط ${anomaly.baseline.toFixed(1)}${unit ? ` ${unit}` : ""} (انحراف z=${anomaly.zScore.toFixed(1)}).`
      : `Latest reading is ${anomaly.latest.toFixed(1)}${unit ? ` ${unit}` : ""} versus baseline ${anomaly.baseline.toFixed(1)}${unit ? ` ${unit}` : ""} (z-score ${anomaly.zScore.toFixed(1)}).`;

    insights.push({
      type: "ml",
      title,
      description,
      confidence: Math.round(clamp(60 + anomaly.zScore * 12, 60, 95)),
      actionable: true,
      recommendation: isArabic
        ? "أعد القياس في ظروف مشابهة وراقب استمرار النمط قبل اتخاذ قرار علاجي."
        : "Recheck under similar conditions and monitor whether the pattern persists before making care changes.",
      data: {
        anomalyType: anomaly.type,
        zScore: Number(anomaly.zScore.toFixed(2)),
        latest: Number(anomaly.latest.toFixed(2)),
        baseline: Number(anomaly.baseline.toFixed(2)),
      },
    });
  }

  return insights;
}

// ─── Insight ranking ──────────────────────────────────────────────────────────

export function rankInsights(insights: PatternInsight[]): PatternInsight[] {
  const typeWeights: Record<PatternInsight["type"], number> = {
    ml: 18,
    trend: 12,
    correlation: 8,
    recommendation: 6,
    temporal: 4,
  };

  return [...insights].sort((left, right) => {
    const leftScore =
      left.confidence + (left.actionable ? 6 : 0) + typeWeights[left.type];
    const rightScore =
      right.confidence + (right.actionable ? 6 : 0) + typeWeights[right.type];
    return rightScore - leftScore;
  });
}
