import {
  collection,
  limit as firestoreLimit,
  getDocs,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  Allergy,
  CalendarEvent,
  EmergencyAlert,
  MedicalHistory,
  Medication,
  Mood,
  Symptom,
} from "@/types";
import { alertService } from "./alertService";
import { allergyService } from "./allergyService";
import { calendarService } from "./calendarService";
import healthContextService from "./healthContextService";
import {
  healthInsightsService,
  type PatternInsight,
} from "./healthInsightsService";
import { healthScoreService } from "./healthScoreService";
import { medicalHistoryService } from "./medicalHistoryService";
import { medicationRefillService } from "./medicationRefillService";
import { medicationService } from "./medicationService";
import { moodService } from "./moodService";
import { sharedMedicationScheduleService } from "./sharedMedicationScheduleService";
import { symptomService } from "./symptomService";

export interface HealthSuggestion {
  id: string;
  type:
    | "medication"
    | "symptom"
    | "lifestyle"
    | "appointment"
    | "compliance"
    | "wellness"
    | "preventive";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  action?: {
    label: string;
    route?: string;
    action?: () => void;
  };
  icon?: string;
  category: string;
  timestamp: Date;
  dismissed?: boolean;
}

// Localization helper for suggestions
const getLocalizedSuggestionText = (
  key: string,
  isArabic: boolean,
  params?: Record<string, string | number>
): {
  title: string;
  description: string;
  actionLabel?: string;
  category: string;
} => {
  const texts: Record<
    string,
    {
      en: {
        title: string;
        description: string;
        actionLabel?: string;
        category: string;
      };
      ar: {
        title: string;
        description: string;
        actionLabel?: string;
        category: string;
      };
    }
  > = {
    lowCompliance: {
      en: {
        title: "Low Medication Compliance",
        description: `You're missing ${params?.count || 0} medication dose${(params?.count || 0) === 1 ? "" : "s"}. Consistent medication adherence is important for your health.`,
        actionLabel: "View Schedule",
        category: "Medication",
      },
      ar: {
        title: "انخفاض الالتزام بالدواء",
        description: `أنت تفتقد ${params?.count || 0} جرعة${(params?.count || 0) === 1 ? "" : " أدوية"}. الالتزام المستمر بتناول الأدوية مهم لصحتك.`,
        actionLabel: "عرض الجدول",
        category: "الأدوية",
      },
    },
    missedDoses: {
      en: {
        title: "Missed Medication Doses",
        description: `You have ${params?.count || 0} missed dose${(params?.count || 0) === 1 ? "" : "s"} this week. Consider setting additional reminders.`,
        actionLabel: "Manage Medications",
        category: "Medication",
      },
      ar: {
        title: "جرعات دواء فائتة",
        description: `لديك ${params?.count || 0} جرعة${(params?.count || 0) === 1 ? "" : " فائتة"} هذا الأسبوع. فكر في إضافة تذكيرات إضافية.`,
        actionLabel: "إدارة الأدوية",
        category: "الأدوية",
      },
    },
    refillMedication: {
      en: {
        title: `Refill ${params?.medicationName || "Medication"}`,
        description: String(
          params?.message || "Time to refill your medication."
        ),
        actionLabel: "View Medications",
        category: "Medication",
      },
      ar: {
        title: `إعادة تعبئة ${params?.medicationName || "الدواء"}`,
        description: String(params?.message || "حان وقت إعادة تعبئة دوائك."),
        actionLabel: "عرض الأدوية",
        category: "الأدوية",
      },
    },
    frequentSymptom: {
      en: {
        title: `Frequent ${params?.symptomType || ""} Symptoms`,
        description: `You've recorded ${params?.symptomType || ""} ${params?.count || 0} times recently. Consider discussing this pattern with your healthcare provider.`,
        actionLabel: "View Symptoms",
        category: "Symptoms",
      },
      ar: {
        title: `أعراض صحية ${params?.symptomType || ""} متكررة`,
        description: `سجلت ${params?.symptomType || ""} ${params?.count || 0} مرات مؤخراً. فكر في مناقشة هذا النمط مع مقدم الرعاية الصحية.`,
        actionLabel: "عرض الأعراض الصحية",
        category: "الأعراض الصحية",
      },
    },
    highSeveritySymptoms: {
      en: {
        title: "High Severity Symptoms",
        description: `You've recorded ${params?.count || 0} high-severity symptom${(params?.count || 0) === 1 ? "" : "s"}. Consider seeking medical attention.`,
        actionLabel: "View Symptoms",
        category: "Symptoms",
      },
      ar: {
        title: "أعراض صحية شديدة الخطورة",
        description: `سجلت ${params?.count || 0} عرض${(params?.count || 0) === 1 ? "" : " شديد الخطورة"}. فكر في طلب الرعاية الطبية.`,
        actionLabel: "عرض الأعراض الصحية",
        category: "الأعراض الصحية",
      },
    },
    moodPattern: {
      en: {
        title: "Mood Pattern Detected",
        description:
          "You've been experiencing more negative moods recently. Consider activities that help improve your mood or speak with a healthcare provider.",
        actionLabel: "View Moods",
        category: "Wellness",
      },
      ar: {
        title: "تم اكتشاف نمط المزاج النفسي",
        description:
          "كنت تعاني من مزاج سلبي أكثر مؤخراً. فكر في الأنشطة التي تساعد على تحسين مزاجك أو التحدث مع مقدم الرعاية الصحية.",
        actionLabel: "عرض المزاج النفسي",
        category: "العافية",
      },
    },
    lowMoodIntensity: {
      en: {
        title: "Low Mood Intensity",
        description:
          "Your mood intensity has been low. Consider activities that boost your energy and mood.",
        actionLabel: "Track Mood",
        category: "Wellness",
      },
      ar: {
        title: "انخفاض شدة المزاج النفسي",
        description:
          "كانت شدة مزاجك منخفضة. فكر في الأنشطة التي تعزز طاقتك ومزاجك.",
        actionLabel: "تتبع المزاج النفسي",
        category: "العافية",
      },
    },
    lowHealthScore: {
      en: {
        title: "Low Health Score",
        description: `Your health score is ${params?.score || 0}. Focus on improving your symptoms and medication adherence to boost your score.`,
        actionLabel: "View Dashboard",
        category: "Health",
      },
      ar: {
        title: "نتيجة صحية منخفضة",
        description: `نتيجتك الصحية ${params?.score || 0}. ركز على تحسين أعراضك والالتزام بالأدوية لرفع نتيجتك.`,
        actionLabel: "عرض لوحة التحكم",
        category: "الصحة",
      },
    },
    improveHealthScore: {
      en: {
        title: "Improve Health Score",
        description: `Your health score is ${params?.score || 0}. Small improvements in symptom management and lifestyle can help increase it.`,
        actionLabel: "View Insights",
        category: "Health",
      },
      ar: {
        title: "تحسين النتيجة الصحية",
        description: `نتيجتك الصحية ${params?.score || 0}. التحسينات الصغيرة في إدارة الأعراض ونمط الحياة يمكن أن تساعد في زيادتها.`,
        actionLabel: "عرض الملاحظات الصحية",
        category: "الصحة",
      },
    },
    trackMood: {
      en: {
        title: "Track Your Mood",
        description:
          "Tracking your mood can help identify patterns and improve your overall wellness.",
        actionLabel: "Track Mood",
        category: "Lifestyle",
      },
      ar: {
        title: "تتبع مزاجك النفسي",
        description:
          "تتبع مزاجك يمكن أن يساعد في تحديد الأنماط وتحسين صحتك العامة.",
        actionLabel: "تتبع المزاج النفسي",
        category: "نمط الحياة",
      },
    },
    stressManagement: {
      en: {
        title: "Stress Management",
        description:
          "You've been experiencing stress-related symptoms. Consider stress management techniques like meditation, exercise, or relaxation.",
        actionLabel: "View Resources",
        category: "Lifestyle",
      },
      ar: {
        title: "إدارة التوتر",
        description:
          "كنت تعاني من أعراض مرتبطة بالتوتر. فكر في تقنيات إدارة التوتر مثل التأمل أو التمارين أو الاسترخاء.",
        actionLabel: "عرض الموارد الصحية",
        category: "نمط الحياة",
      },
    },
    annualCheckup: {
      en: {
        title: "Annual Health Checkup",
        description:
          "Consider scheduling your annual health checkup to stay on top of your preventive care.",
        actionLabel: "Schedule Appointment",
        category: "Preventive Care",
      },
      ar: {
        title: "الفحص الصحي السنوي",
        description:
          "فكر في تسجيل موعد لفحصك الصحي السنوي للبقاء على اطلاع على الرعاية الوقائية.",
        actionLabel: "تسجيل موعد",
        category: "الرعاية الوقائية",
      },
    },
    recurringSymptomPattern: {
      en: {
        title: "Recurring Symptom Pattern",
        description: `You've reported ${params?.symptomType || ""} ${params?.count || 0} times in the last month. Consider tracking what triggers this symptom.`,
        actionLabel: "View Symptom History",
        category: "Symptoms",
      },
      ar: {
        title: "نمط أعراض متكرر",
        description: `سجلت ${params?.symptomType || ""} ${params?.count || 0} مرات في الشهر الماضي. فكر في تتبع ما يسبب هذا العرض.`,
        actionLabel: "عرض تاريخ الأعراض الصحية",
        category: "الأعراض الصحية",
      },
    },
    moodSupport: {
      en: {
        title: "Mood Support",
        description:
          "Your recent mood entries suggest you might benefit from additional support. Consider activities that boost your mood.",
        actionLabel: "View Mood History",
        category: "Wellness",
      },
      ar: {
        title: "دعم الحالة النفسية",
        description:
          "تشير إدخالات مزاجك الأخيرة إلى أنك قد تستفيد من دعم إضافي. فكر في الأنشطة التي تعزز مزاجك.",
        actionLabel: "عرض تاريخ الحالة النفسية",
        category: "العافية",
      },
    },
    medicationEffectivenessReview: {
      en: {
        title: "Medication Effectiveness Review",
        description:
          "We notice some patterns in your symptoms that may relate to your medication schedule. Consider reviewing with your healthcare provider.",
        actionLabel: "Discuss with Provider",
        category: "Medication",
      },
      ar: {
        title: "مراجعة فعالية الدواء",
        description:
          "لاحظنا بعض الأنماط في أعراضك الصحية التي قد تتعلق بجدول أدويتك. فكر في المراجعة مع مقدم الرعاية الصحية.",
        actionLabel: "ناقش مع مقدم الرعاية",
        category: "الأدوية",
      },
    },
    flareUpWarning: {
      en: {
        title: "Potential Symptom Flare-Up",
        description: `Based on your symptom patterns, there may be an increased risk of ${params?.symptomType || ""} flare-up in the next few days.`,
        actionLabel: "Take Preventive Measures",
        category: "Preventive Care",
      },
      ar: {
        title: "احتمال تفاقم الأعراض الصحية",
        description: `بناءً على أنماط أعراضك الصحية، قد يكون هناك خطر متزايد لتفاقم ${params?.symptomType || ""} في الأيام القادمة.`,
        actionLabel: "اتخذ تدابير وقائية",
        category: "الرعاية الوقائية",
      },
    },
    medicationAdjustment: {
      en: {
        title: "Medication Adjustment Needed",
        description:
          "Your symptom patterns suggest your current medication regimen may need adjustment. Consider consulting your healthcare provider.",
        actionLabel: "Consult Provider",
        category: "Medication",
      },
      ar: {
        title: "تعديل الدواء مطلوب",
        description:
          "تشير أنماط أعراضك الصحية إلى أن نظام الأدوية الحالي قد يحتاج إلى تعديل. فكر في استشارة مقدم الرعاية الصحية.",
        actionLabel: "استشر مقدم الرعاية",
        category: "الأدوية",
      },
    },
    winterWellness: {
      en: {
        title: "Winter Wellness",
        description:
          "Cold weather can affect your symptoms. Stay warm and maintain your vitamin D levels.",
        actionLabel: "Winter Health Tips",
        category: "Preventive Care",
      },
      ar: {
        title: "صحة الشتاء",
        description:
          "الطقس البارد يمكن أن يؤثر على أعراضك. حافظ على دفئك ومستويات فيتامين د.",
        actionLabel: "نصائح صحة الشتاء",
        category: "الرعاية الوقائية",
      },
    },
    springAllergies: {
      en: {
        title: "Spring Allergies",
        description:
          "Pollen season may increase allergy symptoms. Consider allergy management strategies.",
        actionLabel: "Allergy Management",
        category: "Preventive Care",
      },
      ar: {
        title: "حساسية الربيع",
        description:
          "موسم حبوب اللقاح قد يزيد من أعراض الحساسية. فكر في استراتيجيات إدارة الحساسية.",
        actionLabel: "إدارة الحساسية",
        category: "الرعاية الوقائية",
      },
    },
    summerHydration: {
      en: {
        title: "Summer Hydration",
        description:
          "Hot weather increases the need for hydration. Monitor your fluid intake carefully.",
        actionLabel: "Hydration Tips",
        category: "Preventive Care",
      },
      ar: {
        title: "ترطيب الصيف",
        description:
          "الطقس الحار يزيد من الحاجة للترطيب. راقب استهلاك السوائل بعناية.",
        actionLabel: "نصائح الترطيب",
        category: "الرعاية الوقائية",
      },
    },
    fallTransition: {
      en: {
        title: "Fall Transition",
        description:
          "Seasonal changes can affect sleep and energy levels. Maintain consistent routines.",
        actionLabel: "Seasonal Adjustment",
        category: "Preventive Care",
      },
      ar: {
        title: "انتقال الخريف",
        description:
          "التغيرات الموسمية يمكن أن تؤثر على النوم ومستويات الطاقة. حافظ على روتين ثابت.",
        actionLabel: "التكيف الموسمي",
        category: "الرعاية الوقائية",
      },
    },
    activityFatigue: {
      en: {
        title: "Gentle Activity",
        description:
          "You've reported fatigue several times this week. Consider gentle activities like short walks or light stretching.",
        actionLabel: "Activity Suggestions",
        category: "Lifestyle",
      },
      ar: {
        title: "نشاط خفيف",
        description:
          "سجلت الإرهاق عدة مرات هذا الأسبوع. فكر في الأنشطة الخفيفة مثل المشي القصير أو التمدد الخفيف.",
        actionLabel: "اقتراحات النشاط",
        category: "نمط الحياة",
      },
    },
    nutritionSupport: {
      en: {
        title: "Nutrition Support",
        description:
          "You've mentioned digestive or appetite issues. Consider speaking with a nutritionist for dietary adjustments.",
        actionLabel: "Nutrition Advice",
        category: "Lifestyle",
      },
      ar: {
        title: "دعم التغذية",
        description:
          "ذكرت مشاكل في الهضم أو الشهية. فكر في التحدث مع أخصائي تغذية لتعديلات غذائية.",
        actionLabel: "نصائح التغذية",
        category: "نمط الحياة",
      },
    },
    stressRelief: {
      en: {
        title: "Stress Management",
        description:
          "Consider stress reduction techniques like meditation, deep breathing, or gentle exercise.",
        actionLabel: "Stress Relief Tips",
        category: "Wellness",
      },
      ar: {
        title: "إدارة التوتر",
        description:
          "فكر في تقنيات تخفيف التوتر مثل التأمل أو التنفس العميق أو التمارين الخفيفة.",
        actionLabel: "نصائح تخفيف التوتر",
        category: "العافية",
      },
    },
    socialConnection: {
      en: {
        title: "Social Connection",
        description:
          "Social connections are important for mental health. Consider reaching out to friends or family.",
        actionLabel: "Connection Tips",
        category: "Wellness",
      },
      ar: {
        title: "التواصل الاجتماعي",
        description:
          "الروابط الاجتماعية مهمة للصحة النفسية. فكر في التواصل مع الأصدقاء أو العائلة.",
        actionLabel: "نصائح التواصل",
        category: "العافية",
      },
    },
    upcomingAppointment: {
      en: {
        title: "Upcoming Appointment",
        description: `You have an appointment "${params?.eventTitle || ""}" coming up ${params?.timeFrame || "soon"}. Make sure to prepare any questions for your healthcare provider.`,
        actionLabel: "View Calendar",
        category: "Appointments",
      },
      ar: {
        title: "موعد قادم",
        description: `لديك موعد "${params?.eventTitle || ""}" قادم ${params?.timeFrame || "قريباً"}. تأكد من تحضير أي أسئلة لمقدم الرعاية الصحية.`,
        actionLabel: "عرض التقويم",
        category: "المواعيد",
      },
    },
    unresolvedAlert: {
      en: {
        title: "Unresolved Health Alert",
        description: `You have ${Number(params?.count) || 1} unresolved health alert${(Number(params?.count) || 1) > 1 ? "s" : ""} that need attention.`,
        actionLabel: "View Alerts",
        category: "Alerts",
      },
      ar: {
        title: "تنبيه صحي غير محلول",
        description: `لديك ${Number(params?.count) || 1} تنبيه${(Number(params?.count) || 1) > 1 ? "ات" : ""} صحية تحتاج إلى اهتمام.`,
        actionLabel: "عرض التنبيهات",
        category: "التنبيهات",
      },
    },
    vitalTrend: {
      en: {
        title: "Vital Signs Trend",
        description: `Your ${params?.vitalType || "vital signs"} have been ${params?.trend || "changing"}. ${params?.advice || "Consider monitoring more closely."}`,
        actionLabel: "View Vitals",
        category: "Vitals",
      },
      ar: {
        title: "اتجاه العلامات الحيوية",
        description: `${params?.vitalType || "علاماتك الحيوية"} كانت ${params?.trend || "تتغير"}. ${params?.advice || "فكر في المراقبة عن كثب."}`,
        actionLabel: "عرض العلامات الحيوية",
        category: "العلامات الحيوية",
      },
    },
    allergyMedicationWarning: {
      en: {
        title: "Allergy Alert",
        description: `Remember you have an allergy to ${params?.allergen || "a substance"}. Always verify new medications with your healthcare provider.`,
        actionLabel: "View Allergies",
        category: "Safety",
      },
      ar: {
        title: "تنبيه حساسية",
        description: `تذكر أن لديك حساسية من ${params?.allergen || "مادة"}. تحقق دائماً من الأدوية الجديدة مع مقدم الرعاية الصحية.`,
        actionLabel: "عرض الحساسية",
        category: "السلامة",
      },
    },
    conditionManagement: {
      en: {
        title: "Condition Management",
        description: `For your ${params?.condition || "health condition"}, consider ${params?.advice || "regular monitoring and following your care plan"}.`,
        actionLabel: "View History",
        category: "Medical History",
      },
      ar: {
        title: "إدارة الحالة",
        description: `لحالتك ${params?.condition || "الصحية"}، فكر في ${params?.advice || "المراقبة المنتظمة واتباع خطة الرعاية"}.`,
        actionLabel: "عرض التاريخ",
        category: "التاريخ الطبي",
      },
    },
    highSeverityAlert: {
      en: {
        title: "High Priority Alert",
        description: `You have a ${params?.alertType || "health"} alert that requires immediate attention: ${params?.message || "Please review."}`,
        actionLabel: "View Alert",
        category: "Urgent",
      },
      ar: {
        title: "تنبيه عالي الأولوية",
        description: `لديك تنبيه ${params?.alertType || "صحي"} يتطلب اهتماماً فورياً: ${params?.message || "يرجى المراجعة."}`,
        actionLabel: "عرض التنبيه",
        category: "عاجل",
      },
    },
    fallDetectionAlert: {
      en: {
        title: "Fall Detection Alert",
        description:
          "A fall has been detected. Immediate attention may be required.",
        actionLabel: "View Alert",
        category: "Urgent",
      },
      ar: {
        title: "تنبيه اكتشاف السقوط",
        description: "تم اكتشاف سقوط. قد يكون الاهتمام الفوري مطلوباً.",
        actionLabel: "عرض التنبيه",
        category: "عاجل",
      },
    },
  };

  const locale = isArabic ? "ar" : "en";
  return (
    texts[key]?.[locale] ||
    texts[key]?.en || { title: key, description: "", category: "General" }
  );
};

class ProactiveHealthSuggestionsService {
  /**
   * Generate proactive health suggestions for a user
   */
  async generateSuggestions(
    userId: string,
    isArabic = false
  ): Promise<HealthSuggestion[]> {
    const suggestions: HealthSuggestion[] = [];

    try {
      // Load user data including trends, alerts, and events
      const [
        medications,
        symptoms,
        moods,
        healthContext,
        alerts,
        upcomingEvents,
        allergies,
        medicalHistory,
        vitals,
      ] = await Promise.all([
        medicationService.getUserMedications(userId),
        symptomService.getUserSymptoms(userId, 30),
        moodService.getUserMoods(userId, 30),
        healthContextService.getUserHealthContext(userId),
        alertService
          .getUserAlerts(userId, 20)
          .catch(() => [] as EmergencyAlert[]),
        calendarService
          .getUpcomingEvents(userId, 7)
          .catch(() => [] as CalendarEvent[]),
        allergyService
          .getUserAllergies(userId, 100)
          .catch(() => [] as Allergy[]),
        medicalHistoryService
          .getUserMedicalHistory(userId)
          .catch(() => [] as MedicalHistory[]),
        this.getRecentVitals(userId).catch(() => []),
      ]);

      const activeMedications = medications.filter((m) => m.isActive);

      // 1. Medication compliance suggestions
      const complianceSuggestions = await this.getComplianceSuggestions(
        userId,
        activeMedications,
        isArabic
      );
      suggestions.push(...complianceSuggestions);

      // 2. Medication refill suggestions
      const refillSuggestions = await this.getRefillSuggestions(
        activeMedications,
        isArabic
      );
      suggestions.push(...refillSuggestions);

      // 3. Symptom pattern suggestions
      const symptomSuggestions = await this.getSymptomPatternSuggestions(
        symptoms,
        isArabic
      );
      suggestions.push(...symptomSuggestions);

      // 4. Mood-based suggestions
      const moodSuggestions = await this.getMoodSuggestions(moods, isArabic);
      suggestions.push(...moodSuggestions);

      // 5. Health score suggestions
      const healthScoreSuggestions = await this.getHealthScoreSuggestions(
        symptoms,
        activeMedications,
        isArabic
      );
      suggestions.push(...healthScoreSuggestions);

      // 6. Lifestyle suggestions
      const lifestyleSuggestions = await this.getLifestyleSuggestions(
        healthContext,
        symptoms,
        moods,
        isArabic
      );
      suggestions.push(...lifestyleSuggestions);

      // 7. Preventive care suggestions
      const preventiveSuggestions = await this.getPreventiveSuggestions(
        healthContext,
        isArabic
      );
      suggestions.push(...preventiveSuggestions);

      // 8. Trend analysis suggestions
      const trendSuggestions = await this.getTrendAnalysisSuggestions(
        symptoms,
        moods,
        activeMedications,
        isArabic
      );
      suggestions.push(...trendSuggestions);

      // 9. Predictive health suggestions
      const predictiveSuggestions = await this.getPredictiveHealthSuggestions(
        symptoms,
        healthContext,
        isArabic
      );
      suggestions.push(...predictiveSuggestions);

      // 10. Personalized wellness suggestions
      const wellnessSuggestions = await this.getPersonalizedWellnessSuggestions(
        healthContext,
        symptoms,
        moods,
        isArabic
      );
      suggestions.push(...wellnessSuggestions);

      // 11. Alert-based suggestions (from logged alerts)
      const alertSuggestions = await this.getAlertBasedSuggestions(
        alerts,
        isArabic
      );
      suggestions.push(...alertSuggestions);

      // 12. Upcoming event suggestions (appointments, checkups)
      const eventSuggestions = await this.getEventBasedSuggestions(
        upcomingEvents,
        isArabic
      );
      suggestions.push(...eventSuggestions);

      // 13. Vital trends suggestions
      const vitalSuggestions = await this.getVitalTrendSuggestions(
        vitals,
        isArabic
      );
      suggestions.push(...vitalSuggestions);

      // 14. Allergy-aware suggestions
      const allergySuggestions = await this.getAllergyAwareSuggestions(
        allergies,
        activeMedications,
        isArabic
      );
      suggestions.push(...allergySuggestions);

      // 15. Medical history-based suggestions
      const historySuggestions = await this.getMedicalHistorySuggestions(
        medicalHistory,
        symptoms,
        isArabic
      );
      suggestions.push(...historySuggestions);

      // Sort by priority (high first)
      suggestions.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

      return suggestions.slice(0, 15); // Return top 15 suggestions
    } catch (error) {
      return [];
    }
  }

  /**
   * Get recent vitals for trend analysis
   */
  private async getRecentVitals(userId: string): Promise<any[]> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const q = query(
        collection(db, "vitals"),
        where("userId", "==", userId),
        where("timestamp", ">=", Timestamp.fromDate(thirtyDaysAgo)),
        orderBy("timestamp", "desc"),
        firestoreLimit(100)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate?.() || new Date(),
      }));
    } catch {
      return [];
    }
  }

  /**
   * Get suggestions based on user alerts
   */
  private async getAlertBasedSuggestions(
    alerts: EmergencyAlert[],
    isArabic = false
  ): Promise<HealthSuggestion[]> {
    const suggestions: HealthSuggestion[] = [];

    // Filter unresolved alerts
    const unresolvedAlerts = alerts.filter((a) => !a.resolved);

    // High severity alerts get immediate attention
    const highSeverityAlerts = unresolvedAlerts.filter(
      (a) => a.severity === "critical" || a.severity === "high"
    );

    if (highSeverityAlerts.length > 0) {
      const alert = highSeverityAlerts[0];

      // Use specific localization for fall detection alerts
      const suggestionKey =
        alert.type === "fall" ? "fallDetectionAlert" : "highSeverityAlert";

      // Translate alert type for non-fall alerts
      let translatedAlertType = alert.type;
      if (alert.type === "fall") {
        translatedAlertType = isArabic ? "سقوط" : "fall";
      } else if (alert.type === "emergency") {
        translatedAlertType = isArabic ? "طوارئ" : "emergency";
      } else if (alert.type === "medication") {
        translatedAlertType = isArabic ? "دواء" : "medication";
      } else if (alert.type === "vitals") {
        translatedAlertType = isArabic ? "مؤشرات حيوية" : "vitals";
      }

      // Translate alert message if it's a fall detection message
      let translatedMessage = alert.message?.substring(0, 50) || "";
      if (
        alert.type === "fall" &&
        isArabic &&
        alert.message?.toLowerCase().includes("fall detected")
      ) {
        translatedMessage = "تم اكتشاف سقوط. قد يكون الاهتمام الفوري مطلوباً.";
      }

      const localizedText = getLocalizedSuggestionText(
        suggestionKey,
        isArabic,
        alert.type === "fall"
          ? undefined
          : {
              alertType: translatedAlertType,
              message: translatedMessage,
            }
      );
      suggestions.push({
        id: `alert-high-${alert.id}`,
        type: "symptom",
        priority: "high",
        title: localizedText.title,
        description: localizedText.description,
        action: {
          label: localizedText.actionLabel || "View",
          route: "/(tabs)/family",
        },
        icon: "AlertTriangle",
        category: localizedText.category,
        timestamp: new Date(),
      });
    }

    // Unresolved alerts reminder
    if (unresolvedAlerts.length > 1) {
      const localizedText = getLocalizedSuggestionText(
        "unresolvedAlert",
        isArabic,
        {
          count: unresolvedAlerts.length,
        }
      );
      suggestions.push({
        id: "alerts-unresolved",
        type: "symptom",
        priority: "medium",
        title: localizedText.title,
        description: localizedText.description,
        action: {
          label: localizedText.actionLabel || "View Alerts",
          route: "/(tabs)/family",
        },
        icon: "Bell",
        category: localizedText.category,
        timestamp: new Date(),
      });
    }

    return suggestions;
  }

  /**
   * Get suggestions based on upcoming calendar events
   */
  private async getEventBasedSuggestions(
    events: CalendarEvent[],
    isArabic = false
  ): Promise<HealthSuggestion[]> {
    const suggestions: HealthSuggestion[] = [];

    // Find health-related appointments
    const healthAppointments = events.filter(
      (e) =>
        e.type === "appointment" ||
        e.type === "medication" ||
        e.type === "vaccination"
    );

    // Upcoming appointment reminders
    for (const event of healthAppointments.slice(0, 2)) {
      const daysUntil = Math.ceil(
        (event.startDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntil >= 0 && daysUntil <= 7) {
        const timeFrame =
          daysUntil === 0
            ? "today"
            : daysUntil === 1
              ? "tomorrow"
              : `in ${daysUntil} days`;

        const localizedText = getLocalizedSuggestionText(
          "upcomingAppointment",
          isArabic,
          {
            eventTitle: event.title,
            timeFrame,
          }
        );

        suggestions.push({
          id: `event-${event.id}`,
          type: "appointment",
          priority: daysUntil <= 1 ? "high" : "medium",
          title: localizedText.title,
          description: localizedText.description,
          action: {
            label: localizedText.actionLabel || "View Calendar",
            route: "/(tabs)/events",
          },
          icon: "Calendar",
          category: localizedText.category,
          timestamp: new Date(),
        });
      }
    }

    return suggestions;
  }

  /**
   * Get suggestions based on vital sign trends
   */
  private async getVitalTrendSuggestions(
    vitals: any[],
    isArabic = false
  ): Promise<HealthSuggestion[]> {
    const suggestions: HealthSuggestion[] = [];

    if (vitals.length < 3) return suggestions;

    // Group vitals by type
    const vitalsByType: Record<string, any[]> = {};
    vitals.forEach((v) => {
      const type = v.type || "unknown";
      if (!vitalsByType[type]) vitalsByType[type] = [];
      vitalsByType[type].push(v);
    });

    // Analyze trends for each vital type
    for (const [type, readings] of Object.entries(vitalsByType)) {
      if (readings.length < 3) continue;

      const values = readings
        .map((r) => r.value)
        .filter((v) => typeof v === "number");
      if (values.length < 3) continue;

      const recentAvg = values.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
      const olderAvg = values.slice(-3).reduce((a, b) => a + b, 0) / 3;

      const percentChange = ((recentAvg - olderAvg) / olderAvg) * 100;

      if (Math.abs(percentChange) > 10) {
        const trend = percentChange > 0 ? "increasing" : "decreasing";
        const trendText = isArabic
          ? trend === "increasing"
            ? "في ازدياد"
            : "في انخفاض"
          : trend;
        const advice = this.getVitalAdvice(type, trend, recentAvg, isArabic);

        const localizedText = getLocalizedSuggestionText(
          "vitalTrend",
          isArabic,
          {
            vitalType: this.getVitalDisplayName(type, isArabic),
            trend: trendText,
            advice,
          }
        );

        suggestions.push({
          id: `vital-trend-${type}`,
          type: "symptom",
          priority: Math.abs(percentChange) > 20 ? "high" : "medium",
          title: localizedText.title,
          description: localizedText.description,
          action: {
            label: localizedText.actionLabel || "View Vitals",
            route: "/(tabs)/vitals",
          },
          icon: "Activity",
          category: localizedText.category,
          timestamp: new Date(),
        });
      }
    }

    return suggestions;
  }

  /**
   * Get allergy-aware medication suggestions
   */
  private async getAllergyAwareSuggestions(
    allergies: Allergy[],
    medications: Medication[],
    isArabic = false
  ): Promise<HealthSuggestion[]> {
    const suggestions: HealthSuggestion[] = [];

    // Severe allergies reminder (severity can be "severe" or "severe-life-threatening")
    const severeAllergies = allergies.filter(
      (a) => a.severity === "severe" || a.severity === "severe-life-threatening"
    );

    // Check if allergy name suggests medication type
    const medicationKeywords = [
      "penicillin",
      "aspirin",
      "ibuprofen",
      "sulfa",
      "codeine",
      "amoxicillin",
      "antibiotic",
    ];

    for (const allergy of severeAllergies.slice(0, 2)) {
      const isMedicationAllergy = medicationKeywords.some((keyword) =>
        allergy.name.toLowerCase().includes(keyword)
      );

      if (isMedicationAllergy) {
        const localizedText = getLocalizedSuggestionText(
          "allergyMedicationWarning",
          isArabic,
          {
            allergen: allergy.name,
          }
        );

        suggestions.push({
          id: `allergy-warning-${allergy.id}`,
          type: "medication",
          priority: "high",
          title: localizedText.title,
          description: localizedText.description,
          action: {
            label: localizedText.actionLabel || "View Allergies",
            route: "/(tabs)/allergies",
          },
          icon: "AlertCircle",
          category: localizedText.category,
          timestamp: new Date(),
        });
      }
    }

    return suggestions;
  }

  /**
   * Get suggestions based on medical history
   */
  private async getMedicalHistorySuggestions(
    history: MedicalHistory[],
    symptoms: Symptom[],
    isArabic = false
  ): Promise<HealthSuggestion[]> {
    const suggestions: HealthSuggestion[] = [];

    // All conditions from medical history (MedicalHistory doesn't have status, use all)
    const activeConditions = history;

    for (const condition of activeConditions.slice(0, 2)) {
      const conditionLower = condition.condition.toLowerCase();

      // Check for symptom correlations with conditions
      let advice = "";
      if (conditionLower.includes("diabetes")) {
        advice = "monitoring blood sugar levels regularly";
      } else if (
        conditionLower.includes("hypertension") ||
        conditionLower.includes("blood pressure")
      ) {
        advice = "checking blood pressure daily and managing stress";
      } else if (conditionLower.includes("heart")) {
        advice = "maintaining heart-healthy habits and monitoring symptoms";
      } else if (conditionLower.includes("asthma")) {
        advice = "keeping your inhaler nearby and avoiding triggers";
      } else {
        continue; // Skip if no specific advice
      }

      const localizedText = getLocalizedSuggestionText(
        "conditionManagement",
        isArabic,
        {
          condition: condition.condition,
          advice,
        }
      );

      suggestions.push({
        id: `history-${condition.id}`,
        type: "preventive",
        priority: "medium",
        title: localizedText.title,
        description: localizedText.description,
        action: {
          label: localizedText.actionLabel || "View History",
          route: "/(tabs)/profile",
        },
        icon: "FileText",
        category: localizedText.category,
        timestamp: new Date(),
      });
    }

    return suggestions;
  }

  private getVitalDisplayName(type: string, isArabic = false): string {
    if (isArabic) {
      const namesAr: Record<string, string> = {
        heartRate: "معدل ضربات القلب",
        bloodPressure: "ضغط الدم",
        bloodGlucose: "سكر الدم",
        oxygenSaturation: "مستوى الأكسجين",
        weight: "الوزن",
        temperature: "درجة الحرارة",
        distanceWalkingRunning: "المسافة (مشي/جري)",
        steps: "الخطوات",
        activeEnergy: "الطاقة النشطة",
      };
      return namesAr[type] || type;
    }
    const names: Record<string, string> = {
      heartRate: "heart rate",
      bloodPressure: "blood pressure",
      bloodGlucose: "blood sugar",
      oxygenSaturation: "oxygen level",
      weight: "weight",
      temperature: "temperature",
      distanceWalkingRunning: "distance walking/running",
      steps: "steps",
      activeEnergy: "active energy",
    };
    return names[type] || type;
  }

  private getVitalAdvice(
    type: string,
    trend: string,
    value: number,
    isArabic = false
  ): string {
    if (isArabic) {
      if (type === "bloodGlucose") {
        if (trend === "increasing" && value > 140) {
          return "فكر في مراجعة نظامك الغذائي والاستشارة مع مقدم الرعاية الصحية.";
        }
        if (trend === "decreasing" && value < 80) {
          return "راقب أعراض انخفاض سكر الدم واحتفظ بوجبات خفيفة متاحة.";
        }
      }
      if (type === "heartRate" && trend === "increasing" && value > 90) {
        return "معدل ضربات القلب المرتفع أثناء الراحة قد يشير إلى التوتر أو الجفاف.";
      }
      if (type === "bloodPressure") {
        return "يجب مناقشة تغيرات ضغط الدم مع مقدم الرعاية الصحية.";
      }
      if (type === "distanceWalkingRunning" || type === "steps") {
        return "فكر في مناقشة هذا الاتجاه مع مقدم الرعاية الصحية.";
      }
      return "فكر في مناقشة هذا الاتجاه مع مقدم الرعاية الصحية.";
    }

    if (type === "bloodGlucose") {
      if (trend === "increasing" && value > 140) {
        return "Consider reviewing your diet and consulting with your healthcare provider.";
      }
      if (trend === "decreasing" && value < 80) {
        return "Monitor for low blood sugar symptoms and have snacks available.";
      }
    }
    if (type === "heartRate" && trend === "increasing" && value > 90) {
      return "High resting heart rate may indicate stress or dehydration.";
    }
    if (type === "bloodPressure") {
      return "Blood pressure changes should be discussed with your healthcare provider.";
    }
    if (type === "distanceWalkingRunning" || type === "steps") {
      return "Consider discussing this trend with your healthcare provider.";
    }
    return "Consider discussing this trend with your healthcare provider.";
  }

  /**
   * Get medication compliance suggestions
   */
  private async getComplianceSuggestions(
    userId: string,
    medications: Medication[],
    isArabic = false
  ): Promise<HealthSuggestion[]> {
    const suggestions: HealthSuggestion[] = [];

    if (medications.length === 0) return suggestions;

    try {
      const scheduleEntries =
        await sharedMedicationScheduleService.getMemberMedicationSchedule(
          userId,
          ""
        );

      const lowCompliance = scheduleEntries.filter(
        (entry) =>
          entry.complianceRate !== undefined && entry.complianceRate < 70
      );

      if (lowCompliance.length > 0) {
        const localizedText = getLocalizedSuggestionText(
          "lowCompliance",
          isArabic,
          { count: lowCompliance.length }
        );
        suggestions.push({
          id: "compliance-low",
          type: "compliance",
          priority: "high",
          title: localizedText.title,
          description: localizedText.description,
          action: {
            label: localizedText.actionLabel || "View Schedule",
            route: "/(tabs)/family",
          },
          icon: "Pill",
          category: localizedText.category,
          timestamp: new Date(),
        });
      }

      const missedDoses = scheduleEntries.reduce(
        (sum, entry) => sum + (entry.missedDoses || 0),
        0
      );

      if (missedDoses > 0) {
        const localizedText = getLocalizedSuggestionText(
          "missedDoses",
          isArabic,
          { count: missedDoses }
        );
        suggestions.push({
          id: "missed-doses",
          type: "compliance",
          priority: missedDoses > 3 ? "high" : "medium",
          title: localizedText.title,
          description: localizedText.description,
          action: {
            label: localizedText.actionLabel || "Manage Medications",
            route: "/(tabs)/medications",
          },
          icon: "AlertTriangle",
          category: localizedText.category,
          timestamp: new Date(),
        });
      }
    } catch (error) {
      // Silently handle error
    }

    return suggestions;
  }

  /**
   * Get medication refill suggestions
   */
  private async getRefillSuggestions(
    medications: Medication[],
    isArabic = false
  ): Promise<HealthSuggestion[]> {
    const suggestions: HealthSuggestion[] = [];

    const refillSummary =
      medicationRefillService.getRefillPredictions(medications);
    const refillAlerts = refillSummary.predictions.filter(
      (p) =>
        p.urgency === "critical" ||
        p.urgency === "high" ||
        p.urgency === "medium"
    );

    refillAlerts.forEach((alert) => {
      const localizedText = getLocalizedSuggestionText(
        "refillMedication",
        isArabic,
        {
          medicationName: alert.medicationName,
          message: `Refill needed in ${alert.daysUntilRefill} day${alert.daysUntilRefill !== 1 ? "s" : ""}`,
        }
      );
      suggestions.push({
        id: `refill-${alert.medicationId}`,
        type: "medication",
        priority:
          alert.urgency === "critical" || alert.urgency === "high"
            ? "high"
            : "medium",
        title: localizedText.title,
        description: localizedText.description,
        action: {
          label: localizedText.actionLabel || "View Medications",
          route: "/(tabs)/medications",
        },
        icon: "Pill",
        category: localizedText.category,
        timestamp: new Date(),
      });
    });

    return suggestions;
  }

  /**
   * Get symptom pattern suggestions
   */
  private async getSymptomPatternSuggestions(
    symptoms: Symptom[],
    isArabic = false
  ): Promise<HealthSuggestion[]> {
    const suggestions: HealthSuggestion[] = [];

    if (symptoms.length < 3) return suggestions;

    // Check for frequent symptoms
    const symptomCounts = new Map<string, number>();
    symptoms.forEach((symptom) => {
      const count = symptomCounts.get(symptom.type) || 0;
      symptomCounts.set(symptom.type, count + 1);
    });

    const frequentSymptoms = Array.from(symptomCounts.entries())
      .filter(([_, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1]);

    if (frequentSymptoms.length > 0) {
      const [symptomType, count] = frequentSymptoms[0];
      const localizedText = getLocalizedSuggestionText(
        "frequentSymptom",
        isArabic,
        { symptomType, count }
      );
      suggestions.push({
        id: `symptom-frequent-${symptomType}`,
        type: "symptom",
        priority: count >= 5 ? "high" : "medium",
        title: localizedText.title,
        description: localizedText.description,
        action: {
          label: localizedText.actionLabel || "View Symptoms",
          route: "/(tabs)/symptoms",
        },
        icon: "Activity",
        category: localizedText.category,
        timestamp: new Date(),
      });
    }

    // Check for high severity symptoms
    const highSeveritySymptoms = symptoms.filter((s) => s.severity >= 4);
    if (highSeveritySymptoms.length > 0) {
      const localizedText = getLocalizedSuggestionText(
        "highSeveritySymptoms",
        isArabic,
        { count: highSeveritySymptoms.length }
      );
      suggestions.push({
        id: "symptom-severe",
        type: "symptom",
        priority: "high",
        title: localizedText.title,
        description: localizedText.description,
        action: {
          label: localizedText.actionLabel || "View Symptoms",
          route: "/(tabs)/symptoms",
        },
        icon: "AlertTriangle",
        category: localizedText.category,
        timestamp: new Date(),
      });
    }

    return suggestions;
  }

  /**
   * Get mood-based suggestions
   */
  private async getMoodSuggestions(
    moods: Mood[],
    isArabic = false
  ): Promise<HealthSuggestion[]> {
    const suggestions: HealthSuggestion[] = [];

    if (moods.length < 3) return suggestions;

    // Check for negative mood patterns
    const negativeMoods = moods.filter((m) =>
      ["sad", "anxious", "stressed", "tired", "empty", "apathetic"].includes(
        m.mood.toLowerCase()
      )
    );

    if (negativeMoods.length >= moods.length * 0.6) {
      const localizedText = getLocalizedSuggestionText("moodPattern", isArabic);
      suggestions.push({
        id: "mood-negative-pattern",
        type: "wellness",
        priority: "medium",
        title: localizedText.title,
        description: localizedText.description,
        action: {
          label: localizedText.actionLabel || "View Moods",
          route: "/(tabs)/moods",
        },
        icon: "Smile",
        category: localizedText.category,
        timestamp: new Date(),
      });
    }

    // Check for low mood intensity
    const averageIntensity =
      moods.reduce((sum, m) => sum + m.intensity, 0) / moods.length;
    if (averageIntensity <= 2) {
      const localizedText = getLocalizedSuggestionText(
        "lowMoodIntensity",
        isArabic
      );
      suggestions.push({
        id: "mood-low-intensity",
        type: "wellness",
        priority: "low",
        title: localizedText.title,
        description: localizedText.description,
        action: {
          label: localizedText.actionLabel || "Track Mood",
          route: "/(tabs)/moods",
        },
        icon: "Smile",
        category: localizedText.category,
        timestamp: new Date(),
      });
    }

    return suggestions;
  }

  /**
   * Get health score suggestions
   */
  private async getHealthScoreSuggestions(
    symptoms: Symptom[],
    medications: Medication[],
    isArabic = false
  ): Promise<HealthSuggestion[]> {
    const suggestions: HealthSuggestion[] = [];

    const healthScoreResult = healthScoreService.calculateHealthScoreFromData(
      symptoms,
      medications
    );

    if (healthScoreResult.score < 60) {
      const localizedText = getLocalizedSuggestionText(
        "lowHealthScore",
        isArabic,
        { score: healthScoreResult.score }
      );
      suggestions.push({
        id: "health-score-low",
        type: "wellness",
        priority: "high",
        title: localizedText.title,
        description: localizedText.description,
        action: {
          label: localizedText.actionLabel || "View Dashboard",
          route: "/health-summary",
        },
        icon: "Heart",
        category: localizedText.category,
        timestamp: new Date(),
      });
    } else if (healthScoreResult.score < 75) {
      const localizedText = getLocalizedSuggestionText(
        "improveHealthScore",
        isArabic,
        { score: healthScoreResult.score }
      );
      suggestions.push({
        id: "health-score-improve",
        type: "wellness",
        priority: "medium",
        title: localizedText.title,
        description: localizedText.description,
        action: {
          label: localizedText.actionLabel || "View Insights",
          route: "/health-summary",
        },
        icon: "TrendingUp",
        category: localizedText.category,
        timestamp: new Date(),
      });
    }

    return suggestions;
  }

  /**
   * Get lifestyle suggestions
   */
  private async getLifestyleSuggestions(
    healthContext: any,
    symptoms: Symptom[],
    moods: Mood[],
    isArabic = false
  ): Promise<HealthSuggestion[]> {
    const suggestions: HealthSuggestion[] = [];

    // Check for lack of activity tracking
    if (symptoms.length > 0 && moods.length === 0) {
      const localizedText = getLocalizedSuggestionText("trackMood", isArabic);
      suggestions.push({
        id: "track-mood",
        type: "lifestyle",
        priority: "low",
        title: localizedText.title,
        description: localizedText.description,
        action: {
          label: localizedText.actionLabel || "Track Mood",
          route: "/(tabs)/moods",
        },
        icon: "Smile",
        category: localizedText.category,
        timestamp: new Date(),
      });
    }

    // Check for stress-related symptoms
    const stressSymptoms = symptoms.filter(
      (s) =>
        s.type.toLowerCase().includes("headache") ||
        s.type.toLowerCase().includes("fatigue") ||
        s.type.toLowerCase().includes("anxiety")
    );

    if (stressSymptoms.length >= 3) {
      const localizedText = getLocalizedSuggestionText(
        "stressManagement",
        isArabic
      );
      suggestions.push({
        id: "stress-management",
        type: "lifestyle",
        priority: "medium",
        title: localizedText.title,
        description: localizedText.description,
        action: {
          label: localizedText.actionLabel || "View Resources",
          route: "/(tabs)/resources",
        },
        icon: "Activity",
        category: localizedText.category,
        timestamp: new Date(),
      });
    }

    return suggestions;
  }

  /**
   * Get preventive care suggestions
   */
  private async getPreventiveSuggestions(
    healthContext: any,
    isArabic = false
  ): Promise<HealthSuggestion[]> {
    const suggestions: HealthSuggestion[] = [];

    // Check for annual checkup reminder (simplified - would check actual last checkup date)
    const currentMonth = new Date().getMonth();
    if (currentMonth === 0 || currentMonth === 6) {
      // January or July
      const localizedText = getLocalizedSuggestionText(
        "annualCheckup",
        isArabic
      );
      suggestions.push({
        id: "annual-checkup",
        type: "appointment",
        priority: "low",
        title: localizedText.title,
        description: localizedText.description,
        action: {
          label: localizedText.actionLabel || "Schedule Appointment",
          route: "/(tabs)/calendar/add",
        },
        icon: "Calendar",
        category: localizedText.category,
        timestamp: new Date(),
      });
    }

    return suggestions;
  }

  /**
   * Get personalized health tips
   */
  async getPersonalizedTips(
    userId: string,
    isArabic = false
  ): Promise<string[]> {
    try {
      const insights = await healthInsightsService.getAllInsights(
        userId,
        isArabic
      );
      const tips: string[] = [];

      // Generate tips based on insights
      insights.forEach((pattern: PatternInsight) => {
        if (pattern.type === "temporal") {
          const tipText = isArabic
            ? `تميل أعراضك إلى ${pattern.description}. فكر في التخطيط للأنشطة وفقاً لذلك.`
            : `Your symptoms tend to ${pattern.description}. Consider planning activities accordingly.`;
          tips.push(tipText);
        }
        if (pattern.recommendation) {
          tips.push(pattern.recommendation);
        }
      });

      return tips.slice(0, 5); // Return top 5 tips
    } catch (error) {
      return [];
    }
  }

  /**
   * Get trend analysis suggestions based on symptom and medication patterns
   */
  private async getTrendAnalysisSuggestions(
    symptoms: Symptom[],
    moods: Mood[],
    medications: Medication[],
    isArabic = false
  ): Promise<HealthSuggestion[]> {
    const suggestions: HealthSuggestion[] = [];

    try {
      // Analyze symptom trends over time
      const recentSymptoms = symptoms.filter(
        (s) =>
          new Date().getTime() - s.timestamp.getTime() <
          30 * 24 * 60 * 60 * 1000 // Last 30 days
      );

      if (recentSymptoms.length > 5) {
        const symptomTypes = recentSymptoms.reduce(
          (acc, symptom) => {
            acc[symptom.type] = (acc[symptom.type] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        );

        const mostCommonSymptom = Object.entries(symptomTypes).sort(
          ([, a], [, b]) => b - a
        )[0];

        if (mostCommonSymptom && mostCommonSymptom[1] >= 3) {
          const localizedText = getLocalizedSuggestionText(
            "recurringSymptomPattern",
            isArabic,
            {
              symptomType: mostCommonSymptom[0],
              count: mostCommonSymptom[1],
            }
          );
          suggestions.push({
            id: "symptom-pattern",
            type: "wellness",
            priority: "medium",
            title: localizedText.title,
            description: localizedText.description,
            action: {
              label: localizedText.actionLabel || "View Symptom History",
              route: "/(tabs)/symptoms",
            },
            icon: "TrendingUp",
            category: localizedText.category,
            timestamp: new Date(),
          });
        }
      }

      // Analyze mood trends
      const recentMoods = moods.filter(
        (m) =>
          new Date().getTime() - m.timestamp.getTime() <
          14 * 24 * 60 * 60 * 1000 // Last 14 days
      );

      if (recentMoods.length > 3) {
        const avgMood =
          recentMoods.reduce((sum, m) => sum + m.intensity, 0) /
          recentMoods.length;

        if (avgMood < 3) {
          const localizedText = getLocalizedSuggestionText(
            "moodSupport",
            isArabic
          );
          suggestions.push({
            id: "mood-trend",
            type: "wellness",
            priority: "medium",
            title: localizedText.title,
            description: localizedText.description,
            action: {
              label: localizedText.actionLabel || "View Mood History",
              route: "/(tabs)/moods",
            },
            icon: "Smile",
            category: localizedText.category,
            timestamp: new Date(),
          });
        }
      }

      // Medication effectiveness analysis
      if (medications.length > 0 && symptoms.length > 10) {
        const symptomTrends = this.analyzeSymptomMedicationCorrelation(
          symptoms,
          medications
        );

        if (symptomTrends.length > 0) {
          const localizedText = getLocalizedSuggestionText(
            "medicationEffectivenessReview",
            isArabic
          );
          suggestions.push({
            id: "medication-effectiveness",
            type: "medication",
            priority: "high",
            title: localizedText.title,
            description: localizedText.description,
            action: {
              label: localizedText.actionLabel || "Discuss with Provider",
              route: "/ai-assistant",
            },
            icon: "Activity",
            category: localizedText.category,
            timestamp: new Date(),
          });
        }
      }
    } catch (error) {
      // Silently handle error
    }

    return suggestions;
  }

  /**
   * Get predictive health suggestions based on patterns
   */
  private async getPredictiveHealthSuggestions(
    symptoms: Symptom[],
    healthContext: any,
    isArabic = false
  ): Promise<HealthSuggestion[]> {
    const suggestions: HealthSuggestion[] = [];

    try {
      // Predict potential flare-ups based on patterns
      const flareUpPrediction = this.predictFlareUps(symptoms);

      if (flareUpPrediction.likelihood > 0.7) {
        const localizedText = getLocalizedSuggestionText(
          "flareUpWarning",
          isArabic,
          {
            symptomType: flareUpPrediction.symptomType,
          }
        );
        suggestions.push({
          id: "flare-up-warning",
          type: "preventive",
          priority: "high",
          title: localizedText.title,
          description: localizedText.description,
          action: {
            label: localizedText.actionLabel || "Take Preventive Measures",
            route: "/ai-assistant",
          },
          icon: "AlertTriangle",
          category: localizedText.category,
          timestamp: new Date(),
        });
      }

      // Predict medication needs
      const medicationPrediction = this.predictMedicationNeeds(
        symptoms,
        healthContext
      );

      if (medicationPrediction.needsAdjustment) {
        const localizedText = getLocalizedSuggestionText(
          "medicationAdjustment",
          isArabic
        );
        suggestions.push({
          id: "medication-adjustment",
          type: "medication",
          priority: "high",
          title: localizedText.title,
          description: localizedText.description,
          action: {
            label: localizedText.actionLabel || "Consult Provider",
            route: "/ai-assistant",
          },
          icon: "Pill",
          category: localizedText.category,
          timestamp: new Date(),
        });
      }

      // Seasonal health predictions
      const seasonalPrediction = this.getSeasonalHealthPrediction(isArabic);

      if (seasonalPrediction) {
        suggestions.push({
          id: "seasonal-health",
          type: "preventive",
          priority: "low",
          title: seasonalPrediction.title,
          description: seasonalPrediction.description,
          action: {
            label: seasonalPrediction.actionLabel,
            route: "/(tabs)/resources",
          },
          icon: "Calendar",
          category: seasonalPrediction.category,
          timestamp: new Date(),
        });
      }
    } catch (error) {
      // Silently handle error
    }

    return suggestions;
  }

  /**
   * Get personalized wellness suggestions
   */
  private async getPersonalizedWellnessSuggestions(
    healthContext: any,
    symptoms: Symptom[],
    moods: Mood[],
    isArabic = false
  ): Promise<HealthSuggestion[]> {
    const suggestions: HealthSuggestion[] = [];

    try {
      // Activity level analysis
      const activitySuggestion = this.analyzeActivityNeeds(
        healthContext,
        symptoms,
        isArabic
      );
      if (activitySuggestion) {
        suggestions.push(activitySuggestion);
      }

      // Sleep pattern analysis
      const sleepSuggestion = this.analyzeSleepPatterns(
        healthContext,
        isArabic
      );
      if (sleepSuggestion) {
        suggestions.push(sleepSuggestion);
      }

      // Nutrition suggestions based on symptoms
      const nutritionSuggestion = this.analyzeNutritionNeeds(
        symptoms,
        healthContext,
        isArabic
      );
      if (nutritionSuggestion) {
        suggestions.push(nutritionSuggestion);
      }

      // Stress management suggestions
      const stressSuggestion = this.analyzeStressLevels(
        moods,
        symptoms,
        isArabic
      );
      if (stressSuggestion) {
        suggestions.push(stressSuggestion);
      }

      // Social connection suggestions
      const socialSuggestion = this.analyzeSocialNeeds(moods, isArabic);
      if (socialSuggestion) {
        suggestions.push(socialSuggestion);
      }
    } catch (error) {
      // Silently handle error
    }

    return suggestions;
  }

  /**
   * Analyze symptom-medication correlations
   */
  private analyzeSymptomMedicationCorrelation(
    symptoms: Symptom[],
    medications: Medication[]
  ): string[] {
    const correlations: string[] = [];

    try {
      // Simple correlation analysis - in a real implementation this would be more sophisticated
      const symptomTypes = [...new Set(symptoms.map((s) => s.type))];

      symptomTypes.forEach((symptomType) => {
        const symptomOccurrences = symptoms.filter(
          (s) => s.type === symptomType
        );
        const medicationNames = medications.map((m) => m.name);

        // Look for patterns - this is a simplified version
        if (symptomOccurrences.length > 5) {
          correlations.push(`${symptomType} appears frequently`);
        }
      });
    } catch (error) {
      // Silently handle error
    }

    return correlations;
  }

  /**
   * Predict potential flare-ups based on symptom patterns
   */
  private predictFlareUps(symptoms: Symptom[]): {
    likelihood: number;
    symptomType: string;
  } {
    try {
      if (symptoms.length < 10) return { likelihood: 0, symptomType: "" };

      // Simple pattern recognition - look for increasing frequency or severity
      const recentSymptoms = symptoms.filter(
        (s) =>
          new Date().getTime() - s.timestamp.getTime() < 7 * 24 * 60 * 60 * 1000 // Last 7 days
      );

      const symptomTypes = recentSymptoms.reduce(
        (acc, symptom) => {
          acc[symptom.type] = (acc[symptom.type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      const mostCommon = Object.entries(symptomTypes).sort(
        ([, a], [, b]) => b - a
      )[0];

      // If a symptom appears more than 3 times in a week, consider it a potential flare-up
      const likelihood = mostCommon && mostCommon[1] >= 3 ? 0.8 : 0.2;

      return { likelihood, symptomType: mostCommon ? mostCommon[0] : "" };
    } catch (error) {
      return { likelihood: 0, symptomType: "" };
    }
  }

  /**
   * Predict medication needs based on symptom patterns
   */
  private predictMedicationNeeds(
    symptoms: Symptom[],
    healthContext: any
  ): { needsAdjustment: boolean } {
    try {
      // Simple analysis - if symptoms are increasing despite medication, suggest adjustment
      const recentSymptoms = symptoms.filter(
        (s) =>
          new Date().getTime() - s.timestamp.getTime() <
          14 * 24 * 60 * 60 * 1000 // Last 14 days
      );

      const avgSeverity =
        recentSymptoms.reduce((sum, s) => sum + s.severity, 0) /
        recentSymptoms.length;

      // If average severity is high and there are many symptoms, suggest adjustment
      const needsAdjustment = avgSeverity > 3 && recentSymptoms.length > 10;

      return { needsAdjustment };
    } catch (error) {
      return { needsAdjustment: false };
    }
  }

  /**
   * Get seasonal health predictions
   */
  private getSeasonalHealthPrediction(isArabic = false): {
    title: string;
    description: string;
    actionLabel: string;
    category: string;
  } | null {
    try {
      const month = new Date().getMonth();

      // Seasonal recommendations based on month
      if (month >= 11 || month <= 1) {
        // Winter
        const localizedText = getLocalizedSuggestionText(
          "winterWellness",
          isArabic
        );
        return {
          title: localizedText.title,
          description: localizedText.description,
          actionLabel: localizedText.actionLabel || "Winter Health Tips",
          category: localizedText.category,
        };
      }
      if (month >= 2 && month <= 4) {
        // Spring
        const localizedText = getLocalizedSuggestionText(
          "springAllergies",
          isArabic
        );
        return {
          title: localizedText.title,
          description: localizedText.description,
          actionLabel: localizedText.actionLabel || "Allergy Management",
          category: localizedText.category,
        };
      }
      if (month >= 5 && month <= 7) {
        // Summer
        const localizedText = getLocalizedSuggestionText(
          "summerHydration",
          isArabic
        );
        return {
          title: localizedText.title,
          description: localizedText.description,
          actionLabel: localizedText.actionLabel || "Hydration Tips",
          category: localizedText.category,
        };
      }
      const localizedText = getLocalizedSuggestionText(
        "fallTransition",
        isArabic
      );
      return {
        title: localizedText.title,
        description: localizedText.description,
        actionLabel: localizedText.actionLabel || "Seasonal Adjustment",
        category: localizedText.category,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Analyze activity needs based on health context and symptoms
   */
  private analyzeActivityNeeds(
    healthContext: any,
    symptoms: Symptom[],
    isArabic = false
  ): HealthSuggestion | null {
    try {
      const recentSymptoms = symptoms.filter(
        (s) =>
          new Date().getTime() - s.timestamp.getTime() < 7 * 24 * 60 * 60 * 1000
      );

      const fatigueSymptoms = recentSymptoms.filter(
        (s) => s.type === "fatigue" || s.type === "tired"
      ).length;

      if (fatigueSymptoms >= 3) {
        const localizedText = getLocalizedSuggestionText(
          "activityFatigue",
          isArabic
        );
        return {
          id: "activity-fatigue",
          type: "lifestyle",
          priority: "medium",
          title: localizedText.title,
          description: localizedText.description,
          action: {
            label: localizedText.actionLabel || "Activity Suggestions",
            route: "/ai-assistant",
          },
          icon: "Activity",
          category: localizedText.category,
          timestamp: new Date(),
        };
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Analyze sleep patterns
   */
  private analyzeSleepPatterns(
    healthContext: any,
    isArabic = false
  ): HealthSuggestion | null {
    try {
      // This would analyze actual sleep data if available
      // For now, return a general suggestion if sleep symptoms are present
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Analyze nutrition needs based on symptoms
   */
  private analyzeNutritionNeeds(
    symptoms: Symptom[],
    healthContext: any,
    isArabic = false
  ): HealthSuggestion | null {
    try {
      const nauseaSymptoms = symptoms.filter((s) => s.type === "nausea").length;
      const appetiteSymptoms = symptoms.filter(
        (s) => s.type === "lossOfAppetite"
      ).length;

      if (nauseaSymptoms >= 2 || appetiteSymptoms >= 2) {
        const localizedText = getLocalizedSuggestionText(
          "nutritionSupport",
          isArabic
        );
        return {
          id: "nutrition-support",
          type: "lifestyle",
          priority: "medium",
          title: localizedText.title,
          description: localizedText.description,
          action: {
            label: localizedText.actionLabel || "Nutrition Advice",
            route: "/ai-assistant",
          },
          icon: "Heart",
          category: localizedText.category,
          timestamp: new Date(),
        };
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Analyze stress levels and suggest management techniques
   */
  private analyzeStressLevels(
    moods: Mood[],
    symptoms: Symptom[],
    isArabic = false
  ): HealthSuggestion | null {
    try {
      const recentMoods = moods.filter(
        (m) =>
          new Date().getTime() - m.timestamp.getTime() < 7 * 24 * 60 * 60 * 1000
      );

      const lowMoods = recentMoods.filter((m) => m.intensity < 4).length;
      const anxietySymptoms = symptoms.filter(
        (s) => s.type === "anxiety"
      ).length;

      if (lowMoods >= 3 || anxietySymptoms >= 2) {
        const localizedText = getLocalizedSuggestionText(
          "stressRelief",
          isArabic
        );
        return {
          id: "stress-management",
          type: "wellness",
          priority: "medium",
          title: localizedText.title,
          description: localizedText.description,
          action: {
            label: localizedText.actionLabel || "Stress Relief Tips",
            route: "/ai-assistant",
          },
          icon: "Smile",
          category: localizedText.category,
          timestamp: new Date(),
        };
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Analyze social connection needs
   */
  private analyzeSocialNeeds(
    moods: Mood[],
    isArabic = false
  ): HealthSuggestion | null {
    try {
      const recentMoods = moods.filter(
        (m) =>
          new Date().getTime() - m.timestamp.getTime() <
          14 * 24 * 60 * 60 * 1000
      );

      const lonelyMoods = recentMoods.filter(
        (m) =>
          m.notes?.toLowerCase().includes("lonely") ||
          m.notes?.toLowerCase().includes("alone")
      ).length;

      if (lonelyMoods >= 2) {
        const localizedText = getLocalizedSuggestionText(
          "socialConnection",
          isArabic
        );
        return {
          id: "social-connection",
          type: "wellness",
          priority: "low",
          title: localizedText.title,
          description: localizedText.description,
          action: {
            label: localizedText.actionLabel || "Connection Tips",
            route: "/ai-assistant",
          },
          icon: "Users",
          category: localizedText.category,
          timestamp: new Date(),
        };
      }

      return null;
    } catch (error) {
      return null;
    }
  }
}

export const proactiveHealthSuggestionsService =
  new ProactiveHealthSuggestionsService();
