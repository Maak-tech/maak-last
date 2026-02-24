/**
 * Medication Intelligence Service
 *
 * Drug-drug interaction checking (static dataset), refill predictions, and
 * effectiveness correlation insights (vitals vs compliance days).
 * Premium Individual+ feature.
 */

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
import type { Medication } from "@/types";

export type InteractionSeverity = "major" | "moderate" | "minor";

export type InteractionWarning = {
  drug1: string;
  drug2: string;
  severity: InteractionSeverity;
  description: string;
  descriptionAr: string;
  recommendation: string;
  recommendationAr: string;
};

export type RefillPrediction = {
  medicationId: string;
  name: string;
  daysRemaining: number;
  refillBy: Date;
  isUrgent: boolean; // <= 7 days
};

export type EffectivenessInsight = {
  medicationId: string;
  medicationName: string;
  metric: string;
  metricAr: string;
  takenAvg: number;
  missedAvg: number;
  insight: string;
  insightAr: string;
};

// ─── Static interaction dataset ───────────────────────────────────────────────
// Covers MENA region common medications + global top drugs.
// severity: major = avoid, moderate = monitor, minor = be aware.
const DRUG_INTERACTIONS: Array<{
  drug1: string;
  drug2: string;
  severity: InteractionSeverity;
  description: string;
  descriptionAr: string;
  recommendation: string;
  recommendationAr: string;
}> = [
  {
    drug1: "aspirin",
    drug2: "ibuprofen",
    severity: "moderate",
    description:
      "Taking aspirin and ibuprofen together may reduce the effectiveness of aspirin and increase risk of gastrointestinal bleeding.",
    descriptionAr:
      "تناول الأسبرين والإيبوبروفين معاً قد يقلل من فعالية الأسبرين ويزيد من خطر النزيف المعدي.",
    recommendation:
      "Take ibuprofen at least 8 hours after or 30 minutes before aspirin. Consult your doctor.",
    recommendationAr:
      "تناول الإيبوبروفين بعد الأسبرين بـ 8 ساعات على الأقل. استشر طبيبك.",
  },
  {
    drug1: "warfarin",
    drug2: "aspirin",
    severity: "major",
    description:
      "Combining warfarin with aspirin significantly increases the risk of serious bleeding.",
    descriptionAr:
      "دمج الوارفارين مع الأسبرين يزيد بشكل كبير من خطر النزيف الخطير.",
    recommendation:
      "Avoid this combination unless specifically prescribed. Monitor for bleeding signs.",
    recommendationAr: "تجنب هذا المزيج ما لم يصفه طبيبك. راقب علامات النزيف.",
  },
  {
    drug1: "metformin",
    drug2: "ibuprofen",
    severity: "moderate",
    description:
      "NSAIDs like ibuprofen can affect kidney function and may reduce metformin clearance.",
    descriptionAr:
      "مضادات الالتهاب كالإيبوبروفين يمكن أن تؤثر على وظائف الكلى وتقلل من إفراز الميتفورمين.",
    recommendation:
      "Use paracetamol instead of ibuprofen when possible. Monitor kidney function.",
    recommendationAr: "استخدم الباراسيتامول بدلاً من الإيبوبروفين إن أمكن.",
  },
  {
    drug1: "atorvastatin",
    drug2: "erythromycin",
    severity: "major",
    description:
      "Erythromycin inhibits atorvastatin metabolism, significantly increasing statin levels and risk of muscle damage (rhabdomyolysis).",
    descriptionAr:
      "الإريثروميسين يثبط استقلاب أتورفاستاتين، مما يزيد مستويات الستاتين وخطر تلف العضلات.",
    recommendation:
      "Avoid this combination. Use a different antibiotic or statin.",
    recommendationAr: "تجنب هذا المزيج. استخدم مضاد حيوي أو ستاتين مختلف.",
  },
  {
    drug1: "lisinopril",
    drug2: "potassium",
    severity: "moderate",
    description:
      "ACE inhibitors like lisinopril can raise potassium levels. Potassium supplements increase the risk of hyperkalemia.",
    descriptionAr:
      "مثبطات ACE مثل ليسينوبريل يمكن أن ترفع مستويات البوتاسيوم. مكملات البوتاسيوم تزيد خطر ارتفاعه.",
    recommendation:
      "Monitor potassium levels regularly. Discuss supplementation with your doctor.",
    recommendationAr:
      "راقب مستويات البوتاسيوم بانتظام. ناقش المكملات مع طبيبك.",
  },
  {
    drug1: "simvastatin",
    drug2: "erythromycin",
    severity: "major",
    description:
      "Erythromycin inhibits simvastatin metabolism, increasing risk of severe muscle damage.",
    descriptionAr:
      "الإريثروميسين يثبط استقلاب سيمفاستاتين مما يزيد خطر تلف العضلات الشديد.",
    recommendation:
      "Avoid concurrent use. Switch to a statin unaffected by CYP3A4 inhibitors.",
    recommendationAr:
      "تجنب الاستخدام المتزامن. انتقل إلى ستاتين غير متأثر بمثبطات CYP3A4.",
  },
  {
    drug1: "metoprolol",
    drug2: "verapamil",
    severity: "major",
    description:
      "Combining metoprolol and verapamil can cause severe bradycardia and heart block.",
    descriptionAr:
      "دمج ميتوبرولول مع فيراباميل يمكن أن يسبب بطء شديد في القلب وحصار قلبي.",
    recommendation: "Avoid this combination. Consult your cardiologist.",
    recommendationAr: "تجنب هذا المزيج. استشر طبيب القلب.",
  },
  {
    drug1: "fluoxetine",
    drug2: "tramadol",
    severity: "major",
    description:
      "Combining SSRIs like fluoxetine with tramadol increases the risk of serotonin syndrome.",
    descriptionAr:
      "دمج مثبطات استرداد السيروتونين مثل فلوكستين مع ترامادول يزيد خطر متلازمة السيروتونين.",
    recommendation: "Avoid this combination. Use an alternative pain reliever.",
    recommendationAr: "تجنب هذا المزيج. استخدم مسكن ألم بديل.",
  },
  {
    drug1: "ciprofloxacin",
    drug2: "antacid",
    severity: "moderate",
    description:
      "Antacids containing aluminium or magnesium can significantly reduce absorption of ciprofloxacin.",
    descriptionAr:
      "مضادات الحموضة التي تحتوي على الألومنيوم أو المغنيسيوم يمكن أن تقلل امتصاص سيبروفلوكساسين.",
    recommendation:
      "Take ciprofloxacin 2 hours before or 6 hours after antacids.",
    recommendationAr:
      "تناول سيبروفلوكساسين قبل 2 ساعة أو بعد 6 ساعات من مضادات الحموضة.",
  },
  {
    drug1: "amlodipine",
    drug2: "simvastatin",
    severity: "moderate",
    description:
      "Amlodipine can increase simvastatin levels, raising the risk of muscle side effects.",
    descriptionAr:
      "أملوديبين يمكن أن يرفع مستويات سيمفاستاتين مما يزيد خطر آثار جانبية عضلية.",
    recommendation:
      "Limit simvastatin to 20mg daily when taken with amlodipine.",
    recommendationAr:
      "حدد سيمفاستاتين بـ 20 ملغ يومياً عند تناوله مع أملوديبين.",
  },
  {
    drug1: "paracetamol",
    drug2: "alcohol",
    severity: "major",
    description:
      "Regular alcohol consumption combined with paracetamol significantly increases risk of liver damage.",
    descriptionAr:
      "استهلاك الكحول مع الباراسيتامول يزيد بشكل كبير من خطر تلف الكبد.",
    recommendation:
      "Limit alcohol use when taking paracetamol. Do not exceed recommended doses.",
    recommendationAr:
      "قلل استهلاك الكحول عند تناول الباراسيتامول. لا تتجاوز الجرعات الموصى بها.",
  },
  {
    drug1: "warfarin",
    drug2: "ibuprofen",
    severity: "major",
    description:
      "NSAIDs like ibuprofen increase bleeding risk when combined with warfarin.",
    descriptionAr:
      "مضادات الالتهاب كالإيبوبروفين تزيد خطر النزيف مع الوارفارين.",
    recommendation:
      "Use paracetamol for pain relief instead. Monitor INR closely.",
    recommendationAr: "استخدم الباراسيتامول لتخفيف الألم. راقب INR عن كثب.",
  },
  {
    drug1: "lisinopril",
    drug2: "ibuprofen",
    severity: "moderate",
    description:
      "NSAIDs can reduce the blood pressure-lowering effect of ACE inhibitors and worsen kidney function.",
    descriptionAr:
      "مضادات الالتهاب يمكن أن تقلل من تأثير مثبطات ACE على ضغط الدم وتضعف وظائف الكلى.",
    recommendation:
      "Use paracetamol instead. Monitor blood pressure and kidney function.",
    recommendationAr:
      "استخدم الباراسيتامول بدلاً منه. راقب ضغط الدم ووظائف الكلى.",
  },
  {
    drug1: "omeprazole",
    drug2: "clopidogrel",
    severity: "moderate",
    description:
      "Omeprazole can reduce the antiplatelet effect of clopidogrel by inhibiting its activation.",
    descriptionAr:
      "أوميبرازول يمكن أن يقلل من التأثير المضاد للصفائح لكلوبيدوجريل.",
    recommendation:
      "Consider switching to pantoprazole, which has less interaction.",
    recommendationAr: "فكر في التحول إلى بانتوبرازول الذي له تفاعل أقل.",
  },
  {
    drug1: "metformin",
    drug2: "alcohol",
    severity: "moderate",
    description:
      "Alcohol increases the risk of lactic acidosis in patients taking metformin.",
    descriptionAr: "الكحول يزيد خطر الحماض اللبني لدى مرضى الميتفورمين.",
    recommendation: "Avoid excessive alcohol consumption while on metformin.",
    recommendationAr: "تجنب الإفراط في تناول الكحول أثناء تناول الميتفورمين.",
  },
  {
    drug1: "sertraline",
    drug2: "tramadol",
    severity: "major",
    description:
      "SSRIs combined with tramadol significantly increase the risk of serotonin syndrome.",
    descriptionAr:
      "مثبطات استرداد السيروتونين مع ترامادول تزيد بشكل كبير من خطر متلازمة السيروتونين.",
    recommendation:
      "Avoid concurrent use. Consult your doctor for alternative pain management.",
    recommendationAr: "تجنب الاستخدام المتزامن. استشر طبيبك لإدارة الألم.",
  },
  {
    drug1: "amoxicillin",
    drug2: "warfarin",
    severity: "moderate",
    description:
      "Amoxicillin can enhance the anticoagulant effect of warfarin, increasing bleeding risk.",
    descriptionAr:
      "الأموكسيسيلين يمكن أن يعزز تأثير الوارفارين المضاد للتخثر، مما يزيد خطر النزيف.",
    recommendation: "Monitor INR closely during amoxicillin treatment.",
    recommendationAr: "راقب INR عن كثب أثناء علاج الأموكسيسيلين.",
  },
  {
    drug1: "digoxin",
    drug2: "amiodarone",
    severity: "major",
    description:
      "Amiodarone inhibits digoxin clearance, causing dangerously elevated digoxin levels.",
    descriptionAr:
      "أميودارون يثبط إفراز ديجوكسين مما يسبب ارتفاعاً خطيراً في مستوياته.",
    recommendation:
      "Reduce digoxin dose by 50% when starting amiodarone. Monitor levels.",
    recommendationAr:
      "قلل جرعة ديجوكسين بنسبة 50% عند بدء أميودارون. راقب المستويات.",
  },
  {
    drug1: "levothyroxine",
    drug2: "calcium",
    severity: "moderate",
    description:
      "Calcium supplements can significantly reduce absorption of levothyroxine if taken together.",
    descriptionAr:
      "مكملات الكالسيوم يمكن أن تقلل امتصاص ليفوثيروكسين بشكل كبير إذا تُناولا معاً.",
    recommendation:
      "Take levothyroxine at least 4 hours apart from calcium supplements.",
    recommendationAr:
      "تناول ليفوثيروكسين بفارق 4 ساعات على الأقل عن مكملات الكالسيوم.",
  },
  {
    drug1: "furosemide",
    drug2: "ibuprofen",
    severity: "moderate",
    description:
      "NSAIDs reduce the diuretic effect of furosemide and may worsen kidney function and fluid retention.",
    descriptionAr:
      "مضادات الالتهاب تقلل التأثير المدر للبول لفيوروسيميد وقد تضعف وظائف الكلى.",
    recommendation:
      "Use paracetamol for pain. Monitor blood pressure and kidney function.",
    recommendationAr: "استخدم الباراسيتامول. راقب ضغط الدم ووظائف الكلى.",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse frequency string to doses per day */
function parseDosesPerDay(frequency: string): number {
  const f = frequency.toLowerCase();
  if (f.includes("once") || f.includes("daily") || f === "1") return 1;
  if (f.includes("twice") || f.includes("2") || f.includes("bid")) return 2;
  if (f.includes("three") || f.includes("3") || f.includes("tid")) return 3;
  if (f.includes("four") || f.includes("4") || f.includes("qid")) return 4;
  if (f.includes("every 8") || f.includes("8 hour")) return 3;
  if (f.includes("every 12") || f.includes("12 hour")) return 2;
  if (f.includes("every 6") || f.includes("6 hour")) return 4;
  if (f.includes("weekly") || f.includes("week")) return 1 / 7;
  return 1;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Check for drug-drug interactions among active medications */
export function checkInteractions(
  medications: Medication[]
): InteractionWarning[] {
  const activeMeds = medications.filter((m) => m.isActive);
  const warnings: InteractionWarning[] = [];

  for (let i = 0; i < activeMeds.length; i++) {
    for (let j = i + 1; j < activeMeds.length; j++) {
      const med1 = activeMeds[i].name.toLowerCase().trim();
      const med2 = activeMeds[j].name.toLowerCase().trim();

      for (const interaction of DRUG_INTERACTIONS) {
        const d1 = interaction.drug1.toLowerCase();
        const d2 = interaction.drug2.toLowerCase();

        const matches =
          (med1.includes(d1) && med2.includes(d2)) ||
          (med1.includes(d2) && med2.includes(d1));

        if (matches) {
          warnings.push({
            drug1: activeMeds[i].name,
            drug2: activeMeds[j].name,
            severity: interaction.severity,
            description: interaction.description,
            descriptionAr: interaction.descriptionAr,
            recommendation: interaction.recommendation,
            recommendationAr: interaction.recommendationAr,
          });
        }
      }
    }
  }

  // Sort by severity: major first
  const order: Record<InteractionSeverity, number> = {
    major: 0,
    moderate: 1,
    minor: 2,
  };
  return warnings.sort((a, b) => order[a.severity] - order[b.severity]);
}

/** Predict medication refill dates based on quantity + frequency */
export function predictRefills(medications: Medication[]): RefillPrediction[] {
  const predictions: RefillPrediction[] = [];
  const activeMeds = medications.filter((m) => m.isActive);

  for (const med of activeMeds) {
    if (!med.quantity || med.quantity <= 0) continue;

    const dosesPerDay = parseDosesPerDay(med.frequency ?? "once");
    if (dosesPerDay <= 0) continue;

    const daysRemaining = Math.floor(med.quantity / dosesPerDay);
    const refillBy = new Date();
    refillBy.setDate(refillBy.getDate() + daysRemaining);

    predictions.push({
      medicationId: med.id,
      name: med.name,
      daysRemaining,
      refillBy,
      isUrgent: daysRemaining <= 7,
    });
  }

  return predictions.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

/** Correlate medication compliance days with vital readings */
export async function getEffectivenessInsights(
  userId: string,
  medicationId: string,
  medicationName: string
): Promise<EffectivenessInsight | null> {
  try {
    const nameLower = medicationName.toLowerCase();

    // Map medication to relevant vital type
    let vitalType: string | null = null;
    let metric = "";
    let metricAr = "";

    if (
      nameLower.includes("metformin") ||
      nameLower.includes("insulin") ||
      nameLower.includes("glipizide") ||
      nameLower.includes("glyburide")
    ) {
      vitalType = "bloodGlucose";
      metric = "blood glucose";
      metricAr = "سكر الدم";
    } else if (
      nameLower.includes("lisinopril") ||
      nameLower.includes("amlodipine") ||
      nameLower.includes("losartan") ||
      nameLower.includes("atenolol") ||
      nameLower.includes("metoprolol") ||
      nameLower.includes("ramipril")
    ) {
      vitalType = "bloodPressureSystolic";
      metric = "blood pressure";
      metricAr = "ضغط الدم";
    } else if (
      nameLower.includes("statin") ||
      nameLower.includes("atorvastatin") ||
      nameLower.includes("simvastatin") ||
      nameLower.includes("rosuvastatin")
    ) {
      vitalType = "heartRate";
      metric = "heart rate";
      metricAr = "معدل ضربات القلب";
    }

    if (!vitalType) return null;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const vitalsRef = collection(db, "vitals");
    const vitalsSnap = await getDocs(
      query(
        vitalsRef,
        where("userId", "==", userId),
        where("type", "==", vitalType),
        where("timestamp", ">=", Timestamp.fromDate(cutoff)),
        orderBy("timestamp", "asc"),
        limit(100)
      )
    );

    if (vitalsSnap.empty) return null;

    // Get medication reminders to find taken dates
    const medRef = collection(db, "users", userId, "medications");
    const medSnap = await getDocs(medRef);
    const med = medSnap.docs.find((d) => d.id === medicationId);
    if (!med) return null;

    const medData = med.data() as Medication;
    const takenDates = new Set<string>();

    for (const reminder of medData.reminders ?? []) {
      if (reminder.taken && reminder.takenAt) {
        const d =
          reminder.takenAt instanceof Timestamp
            ? reminder.takenAt.toDate()
            : new Date(reminder.takenAt as unknown as string);
        takenDates.add(d.toDateString());
      }
    }

    const takenValues: number[] = [];
    const missedValues: number[] = [];

    for (const v of vitalsSnap.docs) {
      const data = v.data();
      const ts =
        data.timestamp instanceof Timestamp
          ? data.timestamp.toDate()
          : new Date(data.timestamp);
      const val = Number(data.value);
      if (Number.isNaN(val)) continue;

      if (takenDates.has(ts.toDateString())) {
        takenValues.push(val);
      } else {
        missedValues.push(val);
      }
    }

    if (takenValues.length < 3 || missedValues.length < 3) return null;

    const takenAvg =
      takenValues.reduce((a, b) => a + b, 0) / takenValues.length;
    const missedAvg =
      missedValues.reduce((a, b) => a + b, 0) / missedValues.length;
    const diff = Math.abs(takenAvg - missedAvg);
    const pctDiff = (diff / (Math.abs(missedAvg) || 1)) * 100;

    if (pctDiff < 3) return null; // Not significant

    const better =
      vitalType === "bloodGlucose" || vitalType === "bloodPressureSystolic"
        ? takenAvg < missedAvg
        : takenAvg > missedAvg;

    const insight = better
      ? `Your ${metric} is ${pctDiff.toFixed(0)}% better on days you take ${medicationName}. Consistency matters!`
      : `Your ${metric} is higher on days you take ${medicationName}. Discuss with your doctor.`;
    const insightAr = better
      ? `${metricAr} أفضل بنسبة ${pctDiff.toFixed(0)}% في الأيام التي تتناول فيها ${medicationName}. الانتظام مهم!`
      : `${metricAr} أعلى في أيام تناول ${medicationName}. ناقش ذلك مع طبيبك.`;

    return {
      medicationId,
      medicationName,
      metric,
      metricAr,
      takenAvg: Math.round(takenAvg * 10) / 10,
      missedAvg: Math.round(missedAvg * 10) / 10,
      insight,
      insightAr,
    };
  } catch {
    return null;
  }
}

export const medicationIntelligenceService = {
  checkInteractions,
  predictRefills,
  getEffectivenessInsights,
};
