/**
 * Zeina Actions Service
 *
 * This service handles all automated tasks that Zeina can perform on behalf of the user.
 * Like Siri, Zeina can understand natural language requests and execute actions.
 *
 * Supported Actions:
 * - Log symptoms (e.g., "I have a headache")
 * - Add medications
 * - Set reminders
 * - Update profile information
 * - Log vital signs
 * - Create alerts for family members
 * - Navigate to app sections
 */

import { addDoc, collection, Timestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { Symptom } from "@/types";
import { alertService } from "./alertService";
import { medicationService } from "./medicationService";
import { symptomService } from "./symptomService";

// Action result type for consistent responses
export interface ActionResult {
  success: boolean;
  action: string;
  message: string;
  data?: any;
  speakableResponse: string; // What Zeina should say to the user
}

// Symptom mapping for natural language to symptom types
export const SYMPTOM_TYPE_MAP: Record<string, string> = {
  // Head
  headache: "headache",
  "head pain": "headache",
  migraine: "headache",
  "head hurts": "headache",

  // Fever/Temperature
  fever: "fever",
  "feeling hot": "fever",
  chills: "fever",
  temperature: "fever",

  // Respiratory
  cough: "cough",
  coughing: "cough",
  "sore throat": "soreThroat",
  "throat pain": "soreThroat",
  "runny nose": "runnyNose",
  congestion: "congestion",
  "stuffy nose": "congestion",
  "shortness of breath": "shortnessOfBreath",
  "breathing difficulty": "shortnessOfBreath",
  "can't breathe": "shortnessOfBreath",

  // Digestive
  nausea: "nausea",
  "feel sick": "nausea",
  vomiting: "vomiting",
  "throwing up": "vomiting",
  diarrhea: "diarrhea",
  "stomach pain": "stomachPain",
  "stomach ache": "stomachPain",
  "tummy ache": "stomachPain",
  constipation: "constipation",
  bloating: "bloating",

  // Pain
  "back pain": "backPain",
  "chest pain": "chestPain",
  "muscle pain": "musclePain",
  "joint pain": "jointPain",
  "body aches": "bodyAches",
  fatigue: "fatigue",
  tiredness: "fatigue",
  exhaustion: "fatigue",
  weakness: "weakness",

  // Mental/Emotional
  anxiety: "anxiety",
  anxious: "anxiety",
  stressed: "anxiety",
  depression: "depression",
  "feeling down": "depression",
  sad: "depression",
  insomnia: "insomnia",
  "can't sleep": "insomnia",
  "sleep problems": "insomnia",

  // Skin
  rash: "rash",
  itching: "itchiness",
  itchiness: "itchiness",
  swelling: "swelling",

  // Other
  dizziness: "dizziness",
  dizzy: "dizziness",
  "feeling faint": "dizziness",
  "loss of appetite": "lossOfAppetite",
  "not hungry": "lossOfAppetite",
};

// Body part mapping
export const BODY_PART_MAP: Record<string, string> = {
  head: "Head",
  neck: "Neck",
  chest: "Chest",
  stomach: "Stomach",
  abdomen: "Abdomen",
  back: "Back",
  "lower back": "Lower Back",
  "upper back": "Upper Back",
  arm: "Arm",
  arms: "Arms",
  leg: "Leg",
  legs: "Legs",
  knee: "Knee",
  knees: "Knees",
  foot: "Foot",
  feet: "Feet",
  hand: "Hand",
  hands: "Hands",
  throat: "Throat",
  ear: "Ear",
  ears: "Ears",
  eye: "Eye",
  eyes: "Eyes",
};

class ZeinaActionsService {
  /**
   * Log a symptom for the current user
   */
  async logSymptom(
    symptomName: string,
    severity?: number,
    notes?: string,
    bodyPart?: string,
    duration?: string,
    isArabic = false
  ): Promise<ActionResult> {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        return {
          success: false,
          action: "log_symptom",
          message: "User not authenticated",
          speakableResponse: isArabic
            ? "عذراً، لم أتمكن من تسجيل هذا العرض. تحتاج إلى تسجيل الدخول أولاً."
            : "I'm sorry, but I couldn't log that symptom. You need to be logged in first.",
        };
      }

      // Normalize symptom name to type
      const normalizedName = symptomName.toLowerCase().trim();
      const symptomType =
        SYMPTOM_TYPE_MAP[normalizedName] || this.toSymptomType(normalizedName);

      // Normalize body part
      const normalizedBodyPart = bodyPart
        ? BODY_PART_MAP[bodyPart.toLowerCase()] || bodyPart
        : this.inferBodyPart(symptomType);

      // Map severity from 1-10 to 1-5 scale
      const mappedSeverity = severity
        ? (Math.max(1, Math.min(5, Math.ceil(severity / 2))) as
            | 1
            | 2
            | 3
            | 4
            | 5)
        : (3 as 1 | 2 | 3 | 4 | 5); // Default to moderate (3/5)

      // Create symptom data (matching the Symptom interface)
      const symptomData: Omit<Symptom, "id"> = {
        userId,
        type: symptomType,
        severity: mappedSeverity,
        description:
          notes ||
          `${this.capitalizeFirstLetter(symptomName)}${normalizedBodyPart ? ` - Location: ${normalizedBodyPart}` : ""}${duration ? ` - Duration: ${duration}` : ""}`,
        location: normalizedBodyPart,
        timestamp: new Date(),
      };

      // Save to Firestore
      const symptomId = await symptomService.addSymptom(symptomData);

      const severityText = this.getSeverityText(symptomData.severity, isArabic);
      const symptomAdvice = this.getSymptomAdvice(
        symptomType,
        symptomData.severity * 2,
        isArabic
      );

      return {
        success: true,
        action: "log_symptom",
        message: `Symptom "${symptomName}" logged successfully`,
        data: {
          id: symptomId,
          ...symptomData,
        },
        speakableResponse: isArabic
          ? `تم تسجيل ${symptomName}${severityText}. ${symptomAdvice}`
          : `I've logged your ${symptomName}${severityText}. ${symptomAdvice}`,
      };
    } catch (error) {
      return {
        success: false,
        action: "log_symptom",
        message: `Failed to log symptom: ${error instanceof Error ? error.message : "Unknown error"}`,
        speakableResponse:
          "I'm sorry, I couldn't log that symptom right now. Please try again later.",
      };
    }
  }

  /**
   * Add a new medication for the current user
   */
  async addMedication(
    name: string,
    dosage: string,
    frequency: string,
    notes?: string
  ): Promise<ActionResult> {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        return {
          success: false,
          action: "add_medication",
          message: "User not authenticated",
          speakableResponse:
            "I couldn't add that medication. You need to be logged in first.",
        };
      }

      const medicationData = {
        userId,
        name,
        dosage,
        frequency,
        startDate: new Date(),
        notes: notes || "",
        isActive: true,
        reminders: [],
      };

      const medicationId =
        await medicationService.addMedication(medicationData);

      return {
        success: true,
        action: "add_medication",
        message: `Medication "${name}" added successfully`,
        data: {
          id: medicationId,
          ...medicationData,
        },
        speakableResponse: `I've added ${name} to your medications. You're taking ${dosage}, ${frequency}. Would you like me to set up a reminder for this medication?`,
      };
    } catch (error) {
      return {
        success: false,
        action: "add_medication",
        message: `Failed to add medication: ${error instanceof Error ? error.message : "Unknown error"}`,
        speakableResponse:
          "I'm sorry, I couldn't add that medication right now. Please try again later.",
      };
    }
  }

  /**
   * Create an alert for family members
   */
  async alertFamily(
    alertType:
      | "check_in"
      | "symptom_alert"
      | "medication_reminder"
      | "emergency",
    message: string
  ): Promise<ActionResult> {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        return {
          success: false,
          action: "alert_family",
          message: "User not authenticated",
          speakableResponse:
            "I couldn't send that alert. You need to be logged in first.",
        };
      }

      // Map alert types to EmergencyAlert types
      const mappedType: "fall" | "emergency" | "medication" | "vitals" =
        alertType === "emergency"
          ? "emergency"
          : alertType === "medication_reminder"
            ? "medication"
            : "vitals"; // check_in and symptom_alert map to vitals

      // Map severity: emergency -> critical, others -> low
      const severity: "low" | "medium" | "high" | "critical" =
        alertType === "emergency" ? "critical" : "low";

      // Create alert using alert service
      const alertId = await alertService.createAlert({
        userId,
        type: mappedType,
        message,
        severity,
        timestamp: new Date(),
        resolved: false,
      });

      const alertTypeText = {
        check_in: "check-in",
        symptom_alert: "symptom alert",
        medication_reminder: "medication reminder",
        emergency: "emergency alert",
      }[alertType];

      return {
        success: true,
        action: "alert_family",
        message: `${alertTypeText} sent to family members`,
        data: { alertId },
        speakableResponse: `I've sent a ${alertTypeText} to your family members. They'll be notified shortly.`,
      };
    } catch (error) {
      return {
        success: false,
        action: "alert_family",
        message: `Failed to alert family: ${error instanceof Error ? error.message : "Unknown error"}`,
        speakableResponse:
          "I'm sorry, I couldn't send that alert right now. Please try again later.",
      };
    }
  }

  /**
   * Log a vital sign measurement
   */
  async logVitalSign(
    vitalType: string,
    value: number,
    unit?: string,
    metadata?: Record<string, any>,
    isArabic = false
  ): Promise<ActionResult> {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        return {
          success: false,
          action: "log_vital",
          message: "User not authenticated",
          speakableResponse: isArabic
            ? "لم أتمكن من تسجيل هذا القياس. تحتاج إلى تسجيل الدخول أولاً."
            : "I couldn't log that vital sign. You need to be logged in first.",
        };
      }

      const displayUnit = unit || this.getVitalUnit(vitalType);

      // Save vital to Firestore directly
      const vitalData: any = {
        userId,
        type: vitalType,
        value,
        unit: displayUnit,
        timestamp: Timestamp.fromDate(new Date()),
        source: "zeina_voice",
      };

      if (metadata) {
        vitalData.metadata = metadata;
      }

      await addDoc(collection(db, "vitals"), vitalData);

      const vitalName = this.getVitalName(vitalType, isArabic);
      const vitalAdvice = this.getVitalAdvice(vitalType, value, isArabic);

      return {
        success: true,
        action: "log_vital",
        message: `${vitalName} logged: ${value} ${displayUnit}`,
        data: { vitalType, value, unit: displayUnit },
        speakableResponse: isArabic
          ? `تم تسجيل ${vitalName} عند ${value} ${displayUnit}. ${vitalAdvice}`
          : `I've recorded your ${vitalName} at ${value} ${displayUnit}. ${vitalAdvice}`,
      };
    } catch (error) {
      return {
        success: false,
        action: "log_vital",
        message: `Failed to log vital sign: ${error instanceof Error ? error.message : "Unknown error"}`,
        speakableResponse:
          "I'm sorry, I couldn't log that vital sign right now. Please try again later.",
      };
    }
  }

  /**
   * Set a medication reminder
   */
  async setMedicationReminder(
    medicationName: string,
    time: string,
    recurring = true
  ): Promise<ActionResult> {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        return {
          success: false,
          action: "set_reminder",
          message: "User not authenticated",
          speakableResponse:
            "I couldn't set that reminder. You need to be logged in first.",
        };
      }

      // Find the medication
      const medications = await medicationService.getUserMedications(userId);
      const medication = medications.find((m) =>
        m.name.toLowerCase().includes(medicationName.toLowerCase())
      );

      if (!medication) {
        return {
          success: false,
          action: "set_reminder",
          message: `Medication "${medicationName}" not found`,
          speakableResponse: `I couldn't find a medication called ${medicationName} in your list. Would you like me to add it first?`,
        };
      }

      // Update medication with new reminder (reminders is an array of MedicationReminder objects)
      const currentReminders = medication.reminders || [];
      const reminderExists = currentReminders.some((r) => r.time === time);

      if (!reminderExists) {
        // Create a new reminder object
        const newReminder = {
          id: `reminder_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          time,
          taken: false,
        };
        currentReminders.push(newReminder);
        await medicationService.updateMedication(medication.id, {
          reminders: currentReminders,
        });
      }

      const recurringText = recurring ? "daily" : "one-time";

      return {
        success: true,
        action: "set_reminder",
        message: `Reminder set for ${medicationName} at ${time}`,
        data: { medicationName, time, recurring },
        speakableResponse: `I've set a ${recurringText} reminder for ${medicationName} at ${time}. I'll make sure you don't miss it.`,
      };
    } catch (error) {
      return {
        success: false,
        action: "set_reminder",
        message: `Failed to set reminder: ${error instanceof Error ? error.message : "Unknown error"}`,
        speakableResponse:
          "I'm sorry, I couldn't set that reminder right now. Please try again later.",
      };
    }
  }

  /**
   * Request a check-in from the user
   */
  async requestCheckIn(reason?: string): Promise<ActionResult> {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        return {
          success: false,
          action: "request_check_in",
          message: "User not authenticated",
          speakableResponse:
            "I couldn't process that request. You need to be logged in first.",
        };
      }

      await alertService.createAlert({
        userId,
        type: "vitals", // check_in maps to vitals type
        message: reason || "Zeina requested a health check-in",
        severity: "low", // info maps to low severity
        timestamp: new Date(),
        resolved: false,
      });

      return {
        success: true,
        action: "request_check_in",
        message: "Check-in requested",
        speakableResponse: reason
          ? `I've noted your check-in request. ${reason}`
          : "I've logged your check-in. How are you feeling right now?",
      };
    } catch (error) {
      return {
        success: false,
        action: "request_check_in",
        message: `Failed to request check-in: ${error instanceof Error ? error.message : "Unknown error"}`,
        speakableResponse: "I'm sorry, I couldn't process that right now.",
      };
    }
  }

  /**
   * Log a mood entry for the user
   */
  async logMood(
    moodType: string,
    intensity?: number,
    notes?: string,
    activities?: string[]
  ): Promise<ActionResult> {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        return {
          success: false,
          action: "log_mood",
          message: "User not authenticated",
          speakableResponse:
            "I couldn't log your mood. You need to be logged in first.",
        };
      }

      // Map natural language to mood types
      const normalizedMood = this.normalizeMoodType(moodType);
      const mappedIntensity = intensity
        ? (Math.max(1, Math.min(5, Math.ceil(intensity / 2))) as
            | 1
            | 2
            | 3
            | 4
            | 5)
        : (3 as 1 | 2 | 3 | 4 | 5);

      // Save mood to Firestore
      const moodData = {
        userId,
        mood: normalizedMood,
        intensity: mappedIntensity,
        notes: notes || "",
        activities: activities || [],
        timestamp: Timestamp.fromDate(new Date()),
      };

      await addDoc(collection(db, "moods"), moodData);

      const moodFeedback = this.getMoodFeedback(
        normalizedMood,
        mappedIntensity
      );

      return {
        success: true,
        action: "log_mood",
        message: `Mood logged: ${normalizedMood}`,
        data: moodData,
        speakableResponse: `I've logged that you're feeling ${this.getMoodDescription(normalizedMood)}. ${moodFeedback}`,
      };
    } catch (error) {
      return {
        success: false,
        action: "log_mood",
        message: `Failed to log mood: ${error instanceof Error ? error.message : "Unknown error"}`,
        speakableResponse:
          "I'm sorry, I couldn't log your mood right now. Please try again later.",
      };
    }
  }

  /**
   * Get navigation instructions for app sections
   */
  getNavigationTarget(target: string): ActionResult {
    const navigationMap: Record<
      string,
      { screen: string; description: string }
    > = {
      medications: { screen: "medications", description: "your medications" },
      meds: { screen: "medications", description: "your medications" },
      symptoms: { screen: "symptoms", description: "your symptoms" },
      family: { screen: "family", description: "your family" },
      profile: { screen: "profile", description: "your profile" },
      settings: { screen: "profile", description: "your settings" },
      dashboard: { screen: "dashboard", description: "your dashboard" },
      home: { screen: "dashboard", description: "your home screen" },
      vitals: { screen: "dashboard", description: "your vital signs" },
      calendar: { screen: "events", description: "your health calendar" },
      events: { screen: "events", description: "your events" },
      appointments: { screen: "events", description: "your appointments" },
      allergies: { screen: "profile", description: "your allergies" },
      history: { screen: "profile", description: "your medical history" },
    };

    const normalizedTarget = target.toLowerCase().trim();
    const nav = navigationMap[normalizedTarget];

    if (nav) {
      return {
        success: true,
        action: "navigate",
        message: `Navigate to ${nav.screen}`,
        data: { screen: nav.screen },
        speakableResponse: `I'll take you to ${nav.description}. Just swipe to that tab or I can tell you more about what's there.`,
      };
    }

    return {
      success: false,
      action: "navigate",
      message: "Unknown navigation target",
      speakableResponse: `I'm not sure where to take you. You can ask me to go to medications, symptoms, family, profile, or your dashboard.`,
    };
  }

  /**
   * Mark a medication as taken
   */
  async markMedicationTaken(
    medicationName: string,
    reminderId?: string
  ): Promise<ActionResult> {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        return {
          success: false,
          action: "mark_medication_taken",
          message: "User not authenticated",
          speakableResponse:
            "I couldn't update your medication. You need to be logged in first.",
        };
      }

      // Find the medication
      const medications = await medicationService.getUserMedications(userId);
      const medication = medications.find((m) =>
        m.name.toLowerCase().includes(medicationName.toLowerCase())
      );

      if (!medication) {
        return {
          success: false,
          action: "mark_medication_taken",
          message: `Medication "${medicationName}" not found`,
          speakableResponse: `I couldn't find a medication called ${medicationName} in your list. Would you like me to add it?`,
        };
      }

      // Find today's reminder to mark
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      // Find the closest reminder
      let closestReminder = medication.reminders?.[0];
      let smallestDiff = Number.POSITIVE_INFINITY;

      for (const reminder of medication.reminders || []) {
        const [hourStr, minuteStr] = reminder.time.split(":");
        const reminderHour = Number.parseInt(hourStr);
        const reminderMinute = Number.parseInt(minuteStr);
        const diff = Math.abs(
          reminderHour * 60 +
            reminderMinute -
            (currentHour * 60 + currentMinute)
        );
        if (diff < smallestDiff) {
          smallestDiff = diff;
          closestReminder = reminder;
        }
      }

      if (closestReminder && !closestReminder.taken) {
        await medicationService.markMedicationTaken(
          medication.id,
          closestReminder.id
        );

        return {
          success: true,
          action: "mark_medication_taken",
          message: `Marked ${medicationName} as taken`,
          data: { medicationId: medication.id, reminderId: closestReminder.id },
          speakableResponse: `Great! I've marked your ${medicationName} as taken. Keep up the good work with your medication schedule!`,
        };
      }

      return {
        success: true,
        action: "mark_medication_taken",
        message: `${medicationName} was already marked as taken`,
        speakableResponse: `It looks like you've already taken your ${medicationName} today. Is there something else I can help you with?`,
      };
    } catch (error) {
      return {
        success: false,
        action: "mark_medication_taken",
        message: `Failed to mark medication as taken: ${error instanceof Error ? error.message : "Unknown error"}`,
        speakableResponse:
          "I'm sorry, I couldn't update your medication status right now. Please try again later.",
      };
    }
  }

  // ===== Additional Helper Methods =====

  private normalizeMoodType(mood: string): string {
    const moodMap: Record<string, string> = {
      // Happy variants
      happy: "happy",
      good: "happy",
      great: "veryHappy",
      amazing: "veryHappy",
      wonderful: "veryHappy",
      fantastic: "veryHappy",
      excellent: "veryHappy",
      okay: "content",
      fine: "content",
      alright: "content",

      // Negative variants
      sad: "sad",
      down: "sad",
      unhappy: "sad",
      depressed: "depression",
      "very sad": "verySad",
      terrible: "verySad",
      awful: "verySad",
      anxious: "anxious",
      worried: "anxious",
      nervous: "anxious",
      stressed: "stressed",
      overwhelmed: "overwhelmed",
      angry: "angry",
      mad: "angry",
      frustrated: "frustrated",
      irritable: "irritable",
      tired: "tired",
      exhausted: "tired",

      // Neutral
      neutral: "neutral",
      meh: "neutral",
      "so-so": "neutral",

      // Positive
      calm: "calm",
      peaceful: "peaceful",
      relaxed: "peaceful",
      grateful: "grateful",
      hopeful: "hopeful",
      excited: "excited",
    };

    const normalizedInput = mood.toLowerCase().trim();
    return moodMap[normalizedInput] || mood;
  }

  private getMoodDescription(mood: string): string {
    const descriptions: Record<string, string> = {
      veryHappy: "really happy",
      happy: "happy",
      content: "content",
      neutral: "neutral",
      sad: "sad",
      verySad: "very sad",
      anxious: "anxious",
      stressed: "stressed",
      tired: "tired",
      calm: "calm",
      peaceful: "peaceful",
      grateful: "grateful",
      excited: "excited",
      frustrated: "frustrated",
      angry: "angry",
      overwhelmed: "overwhelmed",
      depression: "down",
    };
    return descriptions[mood] || mood;
  }

  private getMoodFeedback(mood: string, intensity: number): string {
    const positiveMoods = [
      "veryHappy",
      "happy",
      "content",
      "calm",
      "peaceful",
      "grateful",
      "excited",
      "hopeful",
    ];
    const negativeMoods = [
      "sad",
      "verySad",
      "anxious",
      "stressed",
      "tired",
      "frustrated",
      "angry",
      "overwhelmed",
      "depression",
    ];

    if (positiveMoods.includes(mood)) {
      return "That's wonderful to hear! I'm glad you're doing well.";
    }

    if (negativeMoods.includes(mood)) {
      if (intensity >= 4) {
        return "I'm here for you. Would you like to talk about what's going on, or should I notify a family member?";
      }
      return "I'm sorry to hear that. Remember, it's okay to not feel your best sometimes. Is there anything I can help you with?";
    }

    return "Thanks for sharing. I'll keep track of how you're feeling over time.";
  }

  /**
   * Add an allergy to the user's profile
   */
  async addAllergy(
    allergen: string,
    reaction?: string,
    severity?: "mild" | "moderate" | "severe" | "life-threatening",
    allergyType?: "medication" | "food" | "environmental" | "other"
  ): Promise<ActionResult> {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        return {
          success: false,
          action: "add_allergy",
          message: "User not authenticated",
          speakableResponse:
            "I couldn't add that allergy. You need to be logged in first.",
        };
      }

      const { allergyService } = await import("./allergyService");

      // Map severity: "life-threatening" -> "severe-life-threatening" to match Allergy type
      const mappedSeverity:
        | "mild"
        | "moderate"
        | "severe"
        | "severe-life-threatening" =
        severity === "life-threatening"
          ? "severe-life-threatening"
          : ((severity || "moderate") as "mild" | "moderate" | "severe");

      const allergyData = {
        userId,
        name: this.capitalizeFirstLetter(allergen),
        reaction: reaction || "",
        severity: mappedSeverity,
        type: allergyType || this.inferAllergyType(allergen),
        timestamp: new Date(),
        discoveredDate: new Date(),
      };

      const allergyId = await allergyService.addAllergy(allergyData);

      const severityText = severity ? ` as ${severity}` : "";

      return {
        success: true,
        action: "add_allergy",
        message: `Allergy to "${allergen}" added successfully`,
        data: { id: allergyId, ...allergyData },
        speakableResponse: `I've added your ${allergen} allergy${severityText} to your profile. ${this.getAllergyAdvice(allergen, severity)}`,
      };
    } catch (error) {
      return {
        success: false,
        action: "add_allergy",
        message: `Failed to add allergy: ${error instanceof Error ? error.message : "Unknown error"}`,
        speakableResponse:
          "I'm sorry, I couldn't add that allergy right now. Please try again later.",
      };
    }
  }

  /**
   * Add a medical condition to the user's medical history
   */
  async addMedicalHistory(
    condition: string,
    diagnosisDate?: string,
    status?: "active" | "resolved" | "managed" | "in_remission",
    notes?: string
  ): Promise<ActionResult> {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        return {
          success: false,
          action: "add_medical_history",
          message: "User not authenticated",
          speakableResponse:
            "I couldn't add that to your medical history. You need to be logged in first.",
        };
      }

      const { medicalHistoryService } = await import("./medicalHistoryService");

      const historyData = {
        condition: this.capitalizeFirstLetter(condition),
        diagnosedDate: diagnosisDate
          ? this.parseDateString(diagnosisDate)
          : new Date(),
        notes: notes || "",
        severity: this.inferConditionSeverity(condition) as
          | "mild"
          | "moderate"
          | "severe",
        isFamily: false, // Default to false for user's own medical history
      };

      const historyId = await medicalHistoryService.addMedicalHistory(
        userId,
        historyData
      );

      const statusText =
        status && status !== "active" ? ` as ${status.replace("_", " ")}` : "";

      return {
        success: true,
        action: "add_medical_history",
        message: `Medical history "${condition}" added successfully`,
        data: { id: historyId, ...historyData },
        speakableResponse: `I've added ${condition}${statusText} to your medical history. ${this.getMedicalHistoryAdvice(condition)}`,
      };
    } catch (error) {
      return {
        success: false,
        action: "add_medical_history",
        message: `Failed to add medical history: ${error instanceof Error ? error.message : "Unknown error"}`,
        speakableResponse:
          "I'm sorry, I couldn't add that to your medical history right now. Please try again later.",
      };
    }
  }

  private inferAllergyType(
    allergen: string
  ): "medication" | "food" | "environmental" | "other" {
    const lowerAllergen = allergen.toLowerCase();

    const medications = [
      "penicillin",
      "aspirin",
      "ibuprofen",
      "sulfa",
      "codeine",
      "morphine",
      "amoxicillin",
      "antibiotic",
    ];
    const foods = [
      "peanut",
      "shellfish",
      "dairy",
      "milk",
      "egg",
      "wheat",
      "soy",
      "fish",
      "tree nut",
      "gluten",
      "lactose",
    ];
    const environmental = [
      "dust",
      "pollen",
      "mold",
      "pet",
      "cat",
      "dog",
      "grass",
      "ragweed",
      "bee",
      "wasp",
    ];

    if (medications.some((m) => lowerAllergen.includes(m))) return "medication";
    if (foods.some((f) => lowerAllergen.includes(f))) return "food";
    if (environmental.some((e) => lowerAllergen.includes(e)))
      return "environmental";
    return "other";
  }

  private getAllergyAdvice(allergen: string, severity?: string): string {
    if (severity === "severe" || severity === "life-threatening") {
      return "This is important - make sure your family and doctors know about this allergy. Do you have an EpiPen if needed?";
    }
    if (this.inferAllergyType(allergen) === "medication") {
      return "I'll make sure to flag this when you add new medications.";
    }
    return "I'll keep this in your records for reference.";
  }

  private inferConditionSeverity(condition: string): string {
    const lowerCondition = condition.toLowerCase();
    const severeConditions = [
      "cancer",
      "heart disease",
      "stroke",
      "kidney failure",
      "liver failure",
    ];
    const moderateConditions = [
      "diabetes",
      "hypertension",
      "asthma",
      "arthritis",
      "copd",
    ];

    if (severeConditions.some((c) => lowerCondition.includes(c)))
      return "severe";
    if (moderateConditions.some((c) => lowerCondition.includes(c)))
      return "moderate";
    return "mild";
  }

  private getMedicalHistoryAdvice(condition: string): string {
    const lowerCondition = condition.toLowerCase();

    if (lowerCondition.includes("diabetes")) {
      return "I'll help you track your blood sugar levels regularly.";
    }
    if (
      lowerCondition.includes("hypertension") ||
      lowerCondition.includes("blood pressure")
    ) {
      return "Regular blood pressure monitoring is important. Let me know when you check it.";
    }
    if (lowerCondition.includes("heart")) {
      return "Heart health is important. I'll help you track your vitals.";
    }
    return "I'll keep this in your medical records.";
  }

  private parseDateString(dateStr: string): Date {
    const lowerDate = dateStr.toLowerCase();
    const now = new Date();

    if (lowerDate.includes("year")) {
      const match = lowerDate.match(/(\d+)/);
      if (match) {
        const years = Number.parseInt(match[1]);
        return new Date(
          now.getFullYear() - years,
          now.getMonth(),
          now.getDate()
        );
      }
    }
    if (lowerDate.includes("month")) {
      const match = lowerDate.match(/(\d+)/);
      if (match) {
        const months = Number.parseInt(match[1]);
        return new Date(
          now.getFullYear(),
          now.getMonth() - months,
          now.getDate()
        );
      }
    }
    if (lowerDate.includes("last year")) {
      return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    }
    if (lowerDate.includes("yesterday")) {
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    const yearMatch = lowerDate.match(/^(\d{4})$/);
    if (yearMatch) {
      return new Date(Number.parseInt(yearMatch[1]), 0, 1);
    }

    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? now : parsed;
  }

  // =========== Helper Methods ===========

  private toSymptomType(name: string): string {
    // Convert natural language to camelCase type
    return name
      .toLowerCase()
      .split(" ")
      .map((word, index) =>
        index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
      )
      .join("");
  }

  private capitalizeFirstLetter(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  private inferBodyPart(symptomType: string): string {
    const bodyPartInference: Record<string, string> = {
      headache: "Head",
      migraine: "Head",
      soreThroat: "Throat",
      runnyNose: "Nose",
      congestion: "Nose",
      stomachPain: "Stomach",
      backPain: "Back",
      chestPain: "Chest",
      jointPain: "Joints",
      musclePain: "Muscles",
    };
    return bodyPartInference[symptomType] || "";
  }

  private getSeverityText(severity: number, isArabic = false): string {
    if (isArabic) {
      if (severity <= 1) return " كـخفيف جداً";
      if (severity <= 2) return " كـخفيف";
      if (severity <= 3) return " كـمتوسط";
      if (severity <= 4) return " كـشديد";
      return " كـشديد جداً";
    }
    if (severity <= 1) return " as very mild";
    if (severity <= 2) return " as mild";
    if (severity <= 3) return " as moderate";
    if (severity <= 4) return " as significant";
    return " as severe";
  }

  private getSymptomAdvice(
    symptomType: string,
    severity: number,
    isArabic = false
  ): string {
    if (severity >= 8) {
      return isArabic
        ? "يبدو هذا شديداً جداً. هل تريد مني تنبيه عائلتك أو تقديم معلومات الاتصال للطوارئ؟"
        : "This seems quite severe. Would you like me to alert your family or provide emergency contact information?";
    }

    const adviceMap: Record<string, { en: string; ar: string }> = {
      headache: {
        en: "Make sure to stay hydrated and rest. Let me know if it gets worse.",
        ar: "تأكد من شرب الماء والراحة. أخبرني إذا ساء الأمر.",
      },
      fever: {
        en: "Please monitor your temperature. I recommend staying hydrated and resting.",
        ar: "يرجى مراقبة درجة حرارتك. أنصح بشرب السوائل والراحة.",
      },
      cough: {
        en: "Try to rest your voice and stay hydrated. I'll keep track of this for you.",
        ar: "حاول إراحة صوتك وشرب السوائل. سأتابع هذا لك.",
      },
      nausea: {
        en: "I recommend resting and avoiding heavy foods for now.",
        ar: "أنصح بالراحة وتجنب الأطعمة الثقيلة الآن.",
      },
      fatigue: {
        en: "Make sure you're getting enough rest. I'll note this for your records.",
        ar: "تأكد من حصولك على راحة كافية. سأدون هذا في سجلاتك.",
      },
      anxiety: {
        en: "Remember to take deep breaths. Would you like me to guide you through a breathing exercise?",
        ar: "تذكر أن تأخذ نفساً عميقاً. هل تريد مني إرشادك في تمرين التنفس؟",
      },
      insomnia: {
        en: "I'll track this pattern. Consistent sleep difficulties should be discussed with your doctor.",
        ar: "سأتابع هذا النمط. يجب مناقشة صعوبات النوم المستمرة مع طبيبك.",
      },
      dizziness: {
        en: "Please sit down and stay safe. If this persists, you should seek medical attention.",
        ar: "يرجى الجلوس والبقاء بأمان. إذا استمر هذا، يجب طلب الرعاية الطبية.",
      },
      chestPain: {
        en: "Chest pain can be serious. If you're experiencing severe pain, please seek immediate medical attention.",
        ar: "آلام الصدر قد تكون خطيرة. إذا كنت تعاني من ألم شديد، يرجى طلب الرعاية الطبية فوراً.",
      },
    };

    const advice = adviceMap[symptomType];
    if (advice) {
      return isArabic ? advice.ar : advice.en;
    }
    return isArabic
      ? "سأستمر في متابعة هذا لك. أخبرني إذا تغير شيء."
      : "I'll keep tracking this for you. Let me know if anything changes.";
  }

  private getVitalUnit(vitalType: string): string {
    const units: Record<string, string> = {
      heartRate: "bpm",
      bloodPressure: "mmHg",
      temperature: "°F",
      oxygenSaturation: "%",
      weight: "lbs",
      bloodGlucose: "mg/dL",
      steps: "steps",
    };
    return units[vitalType] || "";
  }

  private getVitalName(vitalType: string, isArabic = false): string {
    const names: Record<string, { en: string; ar: string }> = {
      heartRate: { en: "heart rate", ar: "معدل نبضات القلب" },
      bloodPressure: { en: "blood pressure", ar: "ضغط الدم" },
      temperature: { en: "temperature", ar: "درجة الحرارة" },
      oxygenSaturation: { en: "oxygen level", ar: "مستوى الأكسجين" },
      weight: { en: "weight", ar: "الوزن" },
      bloodGlucose: { en: "blood sugar", ar: "سكر الدم" },
      steps: { en: "step count", ar: "عدد الخطوات" },
    };
    const name = names[vitalType];
    if (name) {
      return isArabic ? name.ar : name.en;
    }
    return vitalType;
  }

  private getVitalAdvice(
    vitalType: string,
    value: number,
    isArabic = false
  ): string {
    switch (vitalType) {
      case "heartRate":
        if (value < 60) {
          return isArabic
            ? "معدل نبضات قلبك منخفض قليلاً. هل تشعر بأنك بخير؟"
            : "Your heart rate is a bit low. Are you feeling okay?";
        }
        if (value > 100) {
          return isArabic
            ? "معدل نبضات قلبك مرتفع. حاول الراحة والهدوء."
            : "Your heart rate is elevated. Try to rest and stay calm.";
        }
        return isArabic
          ? "معدل نبضات قلبك جيد."
          : "Your heart rate looks good.";
      case "bloodGlucose":
        if (value < 70) {
          return isArabic
            ? "سكر الدم منخفض. قد ترغب في تناول وجبة خفيفة."
            : "Your blood sugar is low. You might want to have a small snack.";
        }
        if (value > 180) {
          return isArabic
            ? "سكر الدم مرتفع. يرجى المراقبة عن كثب واتباع خطة الرعاية."
            : "Your blood sugar is high. Please monitor closely and follow your care plan.";
        }
        return isArabic
          ? "مستوى سكر الدم في النطاق الطبيعي."
          : "Your blood sugar level is in a normal range.";
      case "oxygenSaturation":
        if (value < 95) {
          return isArabic
            ? "مستوى الأكسجين منخفض قليلاً. إذا شعرت بضيق في التنفس، يرجى طلب الرعاية الطبية."
            : "Your oxygen level is a bit low. If you feel short of breath, please seek medical attention.";
        }
        return isArabic
          ? "مستوى الأكسجين جيد."
          : "Your oxygen level looks good.";
      default:
        return isArabic
          ? "تم تسجيل هذا القياس لك."
          : "I've recorded this measurement for you.";
    }
  }
}

export const zeinaActionsService = new ZeinaActionsService();
export default zeinaActionsService;
