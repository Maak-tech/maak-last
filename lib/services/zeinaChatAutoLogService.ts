import {
  BODY_PART_MAP,
  SYMPTOM_TYPE_MAP,
  zeinaActionsService,
} from "./zeinaActionsService";
import { auth } from "@/lib/firebase";
import { calendarService } from "./calendarService";

type ExtractedVital = {
  type:
    | "heartRate"
    | "bloodPressure"
    | "temperature"
    | "oxygenSaturation"
    | "weight"
    | "bloodGlucose"
    | "steps";
  value: number;
  unit?: string;
  metadata?: Record<string, number | string>;
};

type ExtractionResult = {
  symptoms: string[];
  vitals: ExtractedVital[];
  allergies: string[];
  medicalHistory: string[];
  events: ExtractedEvent[];
  isArabic: boolean;
};

const ARABIC_CHAR_REGEX = /[\u0600-\u06FF]/;
const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

type ExtractedEvent = {
  title: string;
  type: "appointment" | "lab_result" | "vaccination" | "reminder" | "other";
  startDate: Date;
  endDate?: Date;
  allDay: boolean;
  description?: string;
  location?: string;
};

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toNumber = (value: string): number | null => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseSeverity = (text: string): number | undefined => {
  if (/\b(very severe|extreme|excruciating|unbearable)\b/.test(text)) return 5;
  if (/\b(severe|intense|strong)\b/.test(text)) return 4;
  if (/\b(moderate|medium)\b/.test(text)) return 3;
  if (/\b(mild|slight|light)\b/.test(text)) return 2;
  if (/\b(tiny|barely|minor)\b/.test(text)) return 1;
  return;
};

const parseConditionSeverity = (
  text: string
): "active" | "resolved" | "managed" | "in_remission" | undefined => {
  if (/\b(resolved|cleared)\b/.test(text)) return "resolved";
  if (/\b(in remission|remission)\b/.test(text)) return "in_remission";
  if (/\b(managed|under control|stable)\b/.test(text)) return "managed";
  return;
};

const parseAllergySeverity = (
  text: string
): "mild" | "moderate" | "severe" | "life-threatening" | undefined => {
  if (/\b(life[- ]?threatening|anaphylaxis)\b/.test(text)) {
    return "life-threatening";
  }
  if (/\b(severe)\b/.test(text)) return "severe";
  if (/\b(moderate|medium)\b/.test(text)) return "moderate";
  if (/\b(mild|light)\b/.test(text)) return "mild";
  return;
};

const extractSymptoms = (text: string): string[] => {
  const matches = new Map<string, string>();

  for (const [phrase, symptomType] of Object.entries(SYMPTOM_TYPE_MAP)) {
    const pattern = new RegExp(`\\b${escapeRegExp(phrase)}\\b`, "i");
    if (pattern.test(text) && !matches.has(symptomType)) {
      matches.set(symptomType, phrase);
    }
  }

  return Array.from(matches.values());
};

const extractAllergies = (text: string): string[] => {
  const results: string[] = [];
  const patterns = [
    /allergic to ([^.;]+)/i,
    /allergy to ([^.;]+)/i,
    /allergies to ([^.;]+)/i,
    /allergy[:-]\s*([^.;]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const items = match[1]
        .split(/,| and /i)
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
      results.push(...items);
    }
  }

  return Array.from(new Set(results));
};

const MEDICAL_HISTORY_KEYWORDS = [
  "diabetes",
  "hypertension",
  "high blood pressure",
  "asthma",
  "copd",
  "cancer",
  "heart disease",
  "coronary artery disease",
  "heart failure",
  "stroke",
  "kidney disease",
  "chronic kidney disease",
  "liver disease",
  "thyroid disease",
  "hypothyroidism",
  "hyperthyroidism",
  "arthritis",
  "osteoporosis",
  "sleep apnea",
  "epilepsy",
  "seizure disorder",
];

const extractMedicalHistory = (text: string): string[] => {
  const results: string[] = [];
  const patterns = [
    /diagnosed with ([^.;]+)/i,
    /history of ([^.;]+)/i,
    /medical history of ([^.;]+)/i,
    /chronic ([^.;]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const items = match[1]
        .split(/,| and /i)
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
      results.push(...items);
    }
  }

  for (const keyword of MEDICAL_HISTORY_KEYWORDS) {
    if (text.includes(keyword)) {
      results.push(keyword);
    }
  }

  const symptomTerms = new Set(Object.keys(SYMPTOM_TYPE_MAP));
  return Array.from(new Set(results)).filter((item) => {
    const normalized = item.toLowerCase();
    if (symptomTerms.has(normalized)) {
      return false;
    }
    return normalized.length > 2;
  });
};

const parseDateParts = (text: string): Date | null => {
  const lower = text.toLowerCase();
  const now = new Date();

  const adjustToWeekday = (targetIndex: number, offsetDays: number) => {
    const date = new Date(now);
    const currentIndex = date.getDay();
    let diff = targetIndex - currentIndex;
    if (diff <= 0) {
      diff += 7;
    }
    diff += offsetDays;
    date.setDate(date.getDate() + diff);
    return date;
  };

  if (/\btoday\b/.test(lower)) {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (/\btomorrow\b/.test(lower)) {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  }
  if (/\bday after tomorrow\b/.test(lower)) {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);
  }
  if (/\bthis weekend\b/.test(lower)) {
    return adjustToWeekday(6, 0);
  }
  if (/\bnext weekend\b/.test(lower)) {
    return adjustToWeekday(6, 7);
  }

  const weekdayMatch = lower.match(
    new RegExp(`\\b(next|this)?\\s*(${WEEKDAYS.join("|")})\\b`)
  );
  if (weekdayMatch) {
    const modifier = weekdayMatch[1];
    const weekday = weekdayMatch[2];
    const targetIndex = WEEKDAYS.indexOf(weekday);
    const offsetDays = modifier === "next" ? 7 : 0;
    return adjustToWeekday(targetIndex, offsetDays);
  }

  const inMatch = lower.match(
    /\bin\s+(\d+)\s+(day|days|week|weeks|month|months)\b/
  );
  if (inMatch) {
    const count = Number.parseInt(inMatch[1], 10);
    const unit = inMatch[2];
    const date = new Date(now);
    if (unit.startsWith("day")) {
      date.setDate(date.getDate() + count);
      return date;
    }
    if (unit.startsWith("week")) {
      date.setDate(date.getDate() + count * 7);
      return date;
    }
    if (unit.startsWith("month")) {
      date.setMonth(date.getMonth() + count);
      return date;
    }
  }

  if (/\bnext week\b/.test(lower)) {
    const date = new Date(now);
    date.setDate(date.getDate() + 7);
    return date;
  }
  if (/\bnext month\b/.test(lower)) {
    const date = new Date(now);
    date.setMonth(date.getMonth() + 1);
    return date;
  }
  if (/\bnext year\b/.test(lower)) {
    const date = new Date(now);
    date.setFullYear(date.getFullYear() + 1);
    return date;
  }
  if (/\bthis week\b/.test(lower)) {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (/\bthis month\b/.test(lower)) {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  const isoMatch = lower.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (isoMatch) {
    const year = Number.parseInt(isoMatch[1], 10);
    const month = Number.parseInt(isoMatch[2], 10) - 1;
    const day = Number.parseInt(isoMatch[3], 10);
    return new Date(year, month, day);
  }

  const slashMatch = lower.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (slashMatch) {
    const month = Number.parseInt(slashMatch[1], 10) - 1;
    const day = Number.parseInt(slashMatch[2], 10);
    const year = slashMatch[3]
      ? Number.parseInt(
          slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3],
          10
        )
      : now.getFullYear();
    return new Date(year, month, day);
  }

  const monthMatch = lower.match(
    new RegExp(`\\b(${MONTHS.join("|")})\\s+(\\d{1,2})\\b`)
  );
  if (monthMatch) {
    const monthIndex = MONTHS.indexOf(monthMatch[1]);
    const day = Number.parseInt(monthMatch[2], 10);
    const year = now.getFullYear();
    return new Date(year, monthIndex, day);
  }

  return null;
};

const parseTimeParts = (
  text: string
): { hours: number; minutes: number } | null => {
  const lower = text.toLowerCase();
  if (/\b(morning)\b/.test(lower)) {
    return { hours: 9, minutes: 0 };
  }
  if (/\b(afternoon)\b/.test(lower)) {
    return { hours: 15, minutes: 0 };
  }
  if (/\b(evening)\b/.test(lower)) {
    return { hours: 18, minutes: 0 };
  }
  if (/\b(night)\b/.test(lower)) {
    return { hours: 20, minutes: 0 };
  }
  const ampmMatch = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (ampmMatch) {
    let hours = Number.parseInt(ampmMatch[1], 10);
    const minutes = ampmMatch[2] ? Number.parseInt(ampmMatch[2], 10) : 0;
    const meridiem = ampmMatch[3];
    if (meridiem === "pm" && hours < 12) hours += 12;
    if (meridiem === "am" && hours === 12) hours = 0;
    return { hours, minutes };
  }

  const timeMatch = lower.match(/\b(\d{1,2}):(\d{2})\b/);
  if (timeMatch) {
    const hours = Number.parseInt(timeMatch[1], 10);
    const minutes = Number.parseInt(timeMatch[2], 10);
    return { hours, minutes };
  }

  return null;
};

const extractEvents = (text: string): ExtractedEvent[] => {
  const lower = text.toLowerCase();
  const keywords = [
    "appointment",
    "doctor",
    "checkup",
    "follow up",
    "follow-up",
    "visit",
    "lab",
    "blood test",
    "test results",
    "vaccine",
    "vaccination",
    "shot",
    "imaging",
    "scan",
    "surgery",
    "procedure",
  ];

  if (!keywords.some((keyword) => lower.includes(keyword))) {
    return [];
  }

  const date = parseDateParts(lower);
  if (!date) {
    return [];
  }

  const time = parseTimeParts(lower);
  const startDate = new Date(date);
  let allDay = true;

  if (time) {
    startDate.setHours(time.hours, time.minutes, 0, 0);
    allDay = false;
  } else {
    startDate.setHours(9, 0, 0, 0);
  }

  let type: ExtractedEvent["type"] = "other";
  if (/(vaccine|vaccination|shot)\b/.test(lower)) {
    type = "vaccination";
  } else if (/(lab|blood test|test results)\b/.test(lower)) {
    type = "lab_result";
  } else if (
    /(appointment|doctor|checkup|follow up|follow-up|visit)\b/.test(lower)
  ) {
    type = "appointment";
  }

  const title =
    type === "vaccination"
      ? "Vaccination"
      : type === "lab_result"
        ? "Lab Result"
        : type === "appointment"
          ? "Appointment"
          : "Health Event";

  return [
    {
      title,
      type,
      startDate,
      allDay,
    },
  ];
};

const extractBloodPressure = (text: string): ExtractedVital | null => {
  const hasContext = /\b(blood pressure|bp|b\.p\.)\b/.test(text);
  if (!hasContext) return null;

  const match = text.match(/(\d{2,3})\s*(?:\/|over)\s*(\d{2,3})/);
  if (!match) return null;

  const systolic = toNumber(match[1]);
  const diastolic = toNumber(match[2]);
  if (!(systolic && diastolic)) return null;

  return {
    type: "bloodPressure",
    value: systolic,
    unit: "mmHg",
    metadata: {
      systolic,
      diastolic,
    },
  };
};

const extractHeartRate = (text: string): ExtractedVital | null => {
  const bpmMatch = text.match(/(\d{2,3})\s*(?:bpm|beats per minute)\b/);
  if (bpmMatch) {
    const value = toNumber(bpmMatch[1]);
    if (!value) return null;
    return { type: "heartRate", value, unit: "bpm" };
  }

  const hrMatch = text.match(/\b(heart rate|pulse)\b[^0-9]{0,10}(\d{2,3})/);
  if (hrMatch) {
    const value = toNumber(hrMatch[2]);
    if (!value) return null;
    return { type: "heartRate", value, unit: "bpm" };
  }

  return null;
};

const extractTemperature = (text: string): ExtractedVital | null => {
  const tempMatch = text.match(
    /(\d{2,3}(?:\.\d+)?)\s*(°?\s?[fc]|fahrenheit|celsius)\b/i
  );
  if (tempMatch) {
    const value = toNumber(tempMatch[1]);
    if (!value) return null;
    const unitRaw = tempMatch[2].toLowerCase();
    const unit = unitRaw.includes("c") ? "°C" : "°F";
    return { type: "temperature", value, unit };
  }

  const contextMatch = text.match(
    /\b(temp|temperature|fever)\b[^0-9]{0,10}(\d{2,3}(?:\.\d+)?)/
  );
  if (contextMatch) {
    const value = toNumber(contextMatch[2]);
    if (!value) return null;
    const unit = value <= 45 ? "°C" : "°F";
    return { type: "temperature", value, unit };
  }

  return null;
};

const extractOxygen = (text: string): ExtractedVital | null => {
  const hasContext = /\b(oxygen|spo2|o2|saturation|sat|sats)\b/.test(text);
  if (!hasContext) return null;

  const match = text.match(/(\d{2,3})\s*%/);
  const value = match ? toNumber(match[1]) : null;
  if (!value) return null;

  return { type: "oxygenSaturation", value, unit: "%" };
};

const extractBloodGlucose = (text: string): ExtractedVital | null => {
  const hasContext = /\b(blood sugar|glucose)\b/.test(text);
  if (!hasContext) return null;

  const match = text.match(/\b(\d{2,3})\b/);
  const value = match ? toNumber(match[1]) : null;
  if (!value) return null;

  const unit = /\b(mg\/?dl|mg\/dl)\b/.test(text) ? "mg/dL" : "mg/dL";
  return { type: "bloodGlucose", value, unit };
};

const extractWeight = (text: string): ExtractedVital | null => {
  const match = text.match(
    /\b(\d{2,3}(?:\.\d+)?)\s*(kg|kgs|kilograms|lb|lbs|pounds)\b/
  );
  if (match) {
    const value = toNumber(match[1]);
    if (!value) return null;
    const unitRaw = match[2].toLowerCase();
    const unit = unitRaw.startsWith("k") ? "kg" : "lbs";
    return { type: "weight", value, unit };
  }

  const contextMatch = text.match(
    /\b(weight|weigh)\b[^0-9]{0,10}(\d{2,3}(?:\.\d+)?)/
  );
  if (contextMatch) {
    const value = toNumber(contextMatch[2]);
    if (!value) return null;
    return { type: "weight", value, unit: "lbs" };
  }

  return null;
};

const extractSteps = (text: string): ExtractedVital | null => {
  const match = text.match(/\b(\d{3,6})\s*steps\b/);
  const value = match ? toNumber(match[1]) : null;
  if (!value) return null;

  return { type: "steps", value, unit: "steps" };
};

const extractVitals = (text: string): ExtractedVital[] => {
  const vitals: Array<ExtractedVital | null> = [
    extractBloodPressure(text),
    extractHeartRate(text),
    extractTemperature(text),
    extractOxygen(text),
    extractBloodGlucose(text),
    extractWeight(text),
    extractSteps(text),
  ];

  const deduped = new Map<string, ExtractedVital>();
  for (const vital of vitals) {
    if (vital) {
      deduped.set(vital.type, vital);
    }
  }

  return Array.from(deduped.values());
};

const extractBodyPart = (text: string): string | undefined => {
  for (const [phrase, mapped] of Object.entries(BODY_PART_MAP)) {
    const pattern = new RegExp(`\\b${escapeRegExp(phrase)}\\b`, "i");
    if (pattern.test(text)) {
      return mapped;
    }
  }
  return;
};

const extractHealthSignals = (text: string): ExtractionResult => {
  const normalized = text.toLowerCase();
  const isArabic = ARABIC_CHAR_REGEX.test(text);

  return {
    symptoms: extractSymptoms(normalized),
    vitals: extractVitals(normalized),
    allergies: extractAllergies(text),
    medicalHistory: extractMedicalHistory(text),
    events: extractEvents(text),
    isArabic,
  };
};

export const autoLogHealthSignalsFromText = async (
  text: string
): Promise<{
  symptomsLogged: number;
  vitalsLogged: number;
  allergiesLogged: number;
  medicalHistoryLogged: number;
  eventsLogged: number;
}> => {
  const extraction = extractHealthSignals(text);
  if (
    extraction.symptoms.length === 0 &&
    extraction.vitals.length === 0 &&
    extraction.allergies.length === 0 &&
    extraction.medicalHistory.length === 0 &&
    extraction.events.length === 0
  ) {
    return {
      symptomsLogged: 0,
      vitalsLogged: 0,
      allergiesLogged: 0,
      medicalHistoryLogged: 0,
      eventsLogged: 0,
    };
  }

  const severity = parseSeverity(extraction.isArabic ? "" : text.toLowerCase());
  const bodyPart = extractBodyPart(text.toLowerCase());

  const symptomResults = await Promise.all(
    extraction.symptoms.map((symptom) =>
      zeinaActionsService.logSymptom(
        symptom,
        severity,
        undefined,
        bodyPart,
        undefined,
        extraction.isArabic
      )
    )
  );

  const vitalResults = await Promise.all(
    extraction.vitals.map((vital) =>
      zeinaActionsService.logVitalSign(
        vital.type,
        vital.value,
        vital.unit,
        vital.metadata,
        extraction.isArabic
      )
    )
  );

  const allergySeverity = parseAllergySeverity(text.toLowerCase());
  const allergyResults = await Promise.all(
    extraction.allergies.map((allergen) =>
      zeinaActionsService.addAllergy(
        allergen,
        undefined,
        allergySeverity,
        undefined
      )
    )
  );

  const conditionSeverity = parseConditionSeverity(text.toLowerCase());
  const medicalHistoryResults = await Promise.all(
    extraction.medicalHistory.map((condition) =>
      zeinaActionsService.addMedicalHistory(
        condition,
        undefined,
        conditionSeverity,
        undefined
      )
    )
  );

  let eventsLogged = 0;
  if (extraction.events.length > 0) {
    const userId = auth.currentUser?.uid;
    if (userId) {
      const eventResults = await Promise.all(
        extraction.events.map((event) =>
          calendarService.addEvent(userId, {
            title: event.title,
            type: event.type,
            startDate: event.startDate,
            endDate: event.endDate,
            allDay: event.allDay,
            description: event.description,
            location: event.location,
          })
        )
      );
      eventsLogged = eventResults.length;
    }
  }

  const symptomsLogged = symptomResults.filter(
    (result) => result.success
  ).length;
  const vitalsLogged = vitalResults.filter((result) => result.success).length;
  const allergiesLogged = allergyResults.filter(
    (result) => result.success
  ).length;
  const medicalHistoryLogged = medicalHistoryResults.filter(
    (result) => result.success
  ).length;

  return {
    symptomsLogged,
    vitalsLogged,
    allergiesLogged,
    medicalHistoryLogged,
    eventsLogged,
  };
};
