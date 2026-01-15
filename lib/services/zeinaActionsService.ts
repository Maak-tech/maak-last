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
import { symptomService } from "./symptomService";
import { medicationService } from "./medicationService";
import { alertService } from "./alertService";
import type { Symptom } from "@/types";

// Action result type for consistent responses
export interface ActionResult {
  success: boolean;
  action: string;
  message: string;
  data?: any;
  speakableResponse: string; // What Zeina should say to the user
}

// Symptom mapping for natural language to symptom types
const SYMPTOM_TYPE_MAP: Record<string, string> = {
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
const BODY_PART_MAP: Record<string, string> = {
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
    duration?: string
  ): Promise<ActionResult> {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        return {
          success: false,
          action: "log_symptom",
          message: "User not authenticated",
          speakableResponse: "I'm sorry, but I couldn't log that symptom. You need to be logged in first.",
        };
      }

      // Normalize symptom name to type
      const normalizedName = symptomName.toLowerCase().trim();
      const symptomType = SYMPTOM_TYPE_MAP[normalizedName] || this.toSymptomType(normalizedName);
      
      // Normalize body part
      const normalizedBodyPart = bodyPart 
        ? BODY_PART_MAP[bodyPart.toLowerCase()] || bodyPart 
        : this.inferBodyPart(symptomType);

      // Map severity from 1-10 to 1-5 scale
      const mappedSeverity = severity 
        ? Math.max(1, Math.min(5, Math.ceil(severity / 2))) as 1 | 2 | 3 | 4 | 5
        : 3 as 1 | 2 | 3 | 4 | 5; // Default to moderate (3/5)

      // Create symptom data (matching the Symptom interface)
      const symptomData: Omit<Symptom, "id"> = {
        userId,
        type: symptomType,
        severity: mappedSeverity,
        description: notes || `${this.capitalizeFirstLetter(symptomName)}${normalizedBodyPart ? ` - Location: ${normalizedBodyPart}` : ""}${duration ? ` - Duration: ${duration}` : ""}`,
        location: normalizedBodyPart,
        timestamp: new Date(),
      };

      // Save to Firestore
      const symptomId = await symptomService.addSymptom(symptomData);

      const severityText = this.getSeverityText(symptomData.severity);
      
      return {
        success: true,
        action: "log_symptom",
        message: `Symptom "${symptomName}" logged successfully`,
        data: {
          id: symptomId,
          ...symptomData,
        },
        speakableResponse: `I've logged your ${symptomName}${severityText}. ${this.getSymptomAdvice(symptomType, symptomData.severity * 2)}`, // Convert back to 1-10 for advice
      };
    } catch (error) {
      console.error("Error logging symptom:", error);
      return {
        success: false,
        action: "log_symptom",
        message: `Failed to log symptom: ${error instanceof Error ? error.message : "Unknown error"}`,
        speakableResponse: "I'm sorry, I couldn't log that symptom right now. Please try again later.",
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
          speakableResponse: "I couldn't add that medication. You need to be logged in first.",
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

      const medicationId = await medicationService.addMedication(medicationData);

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
      console.error("Error adding medication:", error);
      return {
        success: false,
        action: "add_medication",
        message: `Failed to add medication: ${error instanceof Error ? error.message : "Unknown error"}`,
        speakableResponse: "I'm sorry, I couldn't add that medication right now. Please try again later.",
      };
    }
  }

  /**
   * Create an alert for family members
   */
  async alertFamily(
    alertType: "check_in" | "symptom_alert" | "medication_reminder" | "emergency",
    message: string
  ): Promise<ActionResult> {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        return {
          success: false,
          action: "alert_family",
          message: "User not authenticated",
          speakableResponse: "I couldn't send that alert. You need to be logged in first.",
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
        isRead: false,
        notifyFamily: true,
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
      console.error("Error alerting family:", error);
      return {
        success: false,
        action: "alert_family",
        message: `Failed to alert family: ${error instanceof Error ? error.message : "Unknown error"}`,
        speakableResponse: "I'm sorry, I couldn't send that alert right now. Please try again later.",
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
    metadata?: Record<string, any>
  ): Promise<ActionResult> {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        return {
          success: false,
          action: "log_vital",
          message: "User not authenticated",
          speakableResponse: "I couldn't log that vital sign. You need to be logged in first.",
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

      const vitalName = this.getVitalName(vitalType);

      return {
        success: true,
        action: "log_vital",
        message: `${vitalName} logged: ${value} ${displayUnit}`,
        data: { vitalType, value, unit: displayUnit },
        speakableResponse: `I've recorded your ${vitalName} at ${value} ${displayUnit}. ${this.getVitalAdvice(vitalType, value)}`,
      };
    } catch (error) {
      console.error("Error logging vital:", error);
      return {
        success: false,
        action: "log_vital",
        message: `Failed to log vital sign: ${error instanceof Error ? error.message : "Unknown error"}`,
        speakableResponse: "I'm sorry, I couldn't log that vital sign right now. Please try again later.",
      };
    }
  }

  /**
   * Set a medication reminder
   */
  async setMedicationReminder(
    medicationName: string,
    time: string,
    recurring: boolean = true
  ): Promise<ActionResult> {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        return {
          success: false,
          action: "set_reminder",
          message: "User not authenticated",
          speakableResponse: "I couldn't set that reminder. You need to be logged in first.",
        };
      }

      // Find the medication
      const medications = await medicationService.getUserMedications(userId);
      const medication = medications.find(
        (m) => m.name.toLowerCase().includes(medicationName.toLowerCase())
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
          time: time,
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
      console.error("Error setting reminder:", error);
      return {
        success: false,
        action: "set_reminder",
        message: `Failed to set reminder: ${error instanceof Error ? error.message : "Unknown error"}`,
        speakableResponse: "I'm sorry, I couldn't set that reminder right now. Please try again later.",
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
          speakableResponse: "I couldn't process that request. You need to be logged in first.",
        };
      }

      await alertService.createAlert({
        userId,
        type: "vitals", // check_in maps to vitals type
        message: reason || "Zeina requested a health check-in",
        severity: "low", // info maps to low severity
        timestamp: new Date(),
        isRead: false,
        notifyFamily: false,
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
      console.error("Error requesting check-in:", error);
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
          speakableResponse: "I couldn't log your mood. You need to be logged in first.",
        };
      }

      // Map natural language to mood types
      const normalizedMood = this.normalizeMoodType(moodType);
      const mappedIntensity = intensity 
        ? Math.max(1, Math.min(5, Math.ceil(intensity / 2))) as 1 | 2 | 3 | 4 | 5
        : 3 as 1 | 2 | 3 | 4 | 5;

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

      const moodFeedback = this.getMoodFeedback(normalizedMood, mappedIntensity);

      return {
        success: true,
        action: "log_mood",
        message: `Mood logged: ${normalizedMood}`,
        data: moodData,
        speakableResponse: `I've logged that you're feeling ${this.getMoodDescription(normalizedMood)}. ${moodFeedback}`,
      };
    } catch (error) {
      console.error("Error logging mood:", error);
      return {
        success: false,
        action: "log_mood",
        message: `Failed to log mood: ${error instanceof Error ? error.message : "Unknown error"}`,
        speakableResponse: "I'm sorry, I couldn't log your mood right now. Please try again later.",
      };
    }
  }

  /**
   * Get navigation instructions for app sections
   */
  getNavigationTarget(target: string): ActionResult {
    const navigationMap: Record<string, { screen: string; description: string }> = {
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
          speakableResponse: "I couldn't update your medication. You need to be logged in first.",
        };
      }

      // Find the medication
      const medications = await medicationService.getUserMedications(userId);
      const medication = medications.find(
        (m) => m.name.toLowerCase().includes(medicationName.toLowerCase())
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
      let smallestDiff = Infinity;
      
      for (const reminder of medication.reminders || []) {
        const [hourStr, minuteStr] = reminder.time.split(":");
        const reminderHour = parseInt(hourStr);
        const reminderMinute = parseInt(minuteStr);
        const diff = Math.abs((reminderHour * 60 + reminderMinute) - (currentHour * 60 + currentMinute));
        if (diff < smallestDiff) {
          smallestDiff = diff;
          closestReminder = reminder;
        }
      }

      if (closestReminder && !closestReminder.taken) {
        await medicationService.markMedicationTaken(medication.id, closestReminder.id);
        
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
      console.error("Error marking medication taken:", error);
      return {
        success: false,
        action: "mark_medication_taken",
        message: `Failed to mark medication as taken: ${error instanceof Error ? error.message : "Unknown error"}`,
        speakableResponse: "I'm sorry, I couldn't update your medication status right now. Please try again later.",
      };
    }
  }

  // ===== Additional Helper Methods =====

  private normalizeMoodType(mood: string): string {
    const moodMap: Record<string, string> = {
      // Happy variants
      "happy": "happy",
      "good": "happy",
      "great": "veryHappy",
      "amazing": "veryHappy",
      "wonderful": "veryHappy",
      "fantastic": "veryHappy",
      "excellent": "veryHappy",
      "okay": "content",
      "fine": "content",
      "alright": "content",
      
      // Negative variants
      "sad": "sad",
      "down": "sad",
      "unhappy": "sad",
      "depressed": "depression",
      "very sad": "verySad",
      "terrible": "verySad",
      "awful": "verySad",
      "anxious": "anxious",
      "worried": "anxious",
      "nervous": "anxious",
      "stressed": "stressed",
      "overwhelmed": "overwhelmed",
      "angry": "angry",
      "mad": "angry",
      "frustrated": "frustrated",
      "irritable": "irritable",
      "tired": "tired",
      "exhausted": "tired",
      
      // Neutral
      "neutral": "neutral",
      "meh": "neutral",
      "so-so": "neutral",
      
      // Positive
      "calm": "calm",
      "peaceful": "peaceful",
      "relaxed": "peaceful",
      "grateful": "grateful",
      "hopeful": "hopeful",
      "excited": "excited",
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
    const positiveMoods = ["veryHappy", "happy", "content", "calm", "peaceful", "grateful", "excited", "hopeful"];
    const negativeMoods = ["sad", "verySad", "anxious", "stressed", "tired", "frustrated", "angry", "overwhelmed", "depression"];

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

  private getSeverityText(severity: number): string {
    // Severity is on 1-5 scale
    if (severity <= 1) return " as very mild";
    if (severity <= 2) return " as mild";
    if (severity <= 3) return " as moderate";
    if (severity <= 4) return " as significant";
    return " as severe";
  }

  private getSymptomAdvice(symptomType: string, severity: number): string {
    if (severity >= 8) {
      return "This seems quite severe. Would you like me to alert your family or provide emergency contact information?";
    }

    const adviceMap: Record<string, string> = {
      headache: "Make sure to stay hydrated and rest. Let me know if it gets worse.",
      fever: "Please monitor your temperature. I recommend staying hydrated and resting.",
      cough: "Try to rest your voice and stay hydrated. I'll keep track of this for you.",
      nausea: "I recommend resting and avoiding heavy foods for now.",
      fatigue: "Make sure you're getting enough rest. I'll note this for your records.",
      anxiety: "Remember to take deep breaths. Would you like me to guide you through a breathing exercise?",
      insomnia: "I'll track this pattern. Consistent sleep difficulties should be discussed with your doctor.",
      dizziness: "Please sit down and stay safe. If this persists, you should seek medical attention.",
      chestPain: "Chest pain can be serious. If you're experiencing severe pain, please seek immediate medical attention.",
    };

    return adviceMap[symptomType] || "I'll keep tracking this for you. Let me know if anything changes.";
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

  private getVitalName(vitalType: string): string {
    const names: Record<string, string> = {
      heartRate: "heart rate",
      bloodPressure: "blood pressure",
      temperature: "temperature",
      oxygenSaturation: "oxygen level",
      weight: "weight",
      bloodGlucose: "blood sugar",
      steps: "step count",
    };
    return names[vitalType] || vitalType;
  }

  private getVitalAdvice(vitalType: string, value: number): string {
    // Provide contextual advice based on vital type and value
    switch (vitalType) {
      case "heartRate":
        if (value < 60) return "Your heart rate is a bit low. Are you feeling okay?";
        if (value > 100) return "Your heart rate is elevated. Try to rest and stay calm.";
        return "Your heart rate looks good.";
      case "bloodGlucose":
        if (value < 70) return "Your blood sugar is low. You might want to have a small snack.";
        if (value > 180) return "Your blood sugar is high. Please monitor closely and follow your care plan.";
        return "Your blood sugar level is in a normal range.";
      case "oxygenSaturation":
        if (value < 95) return "Your oxygen level is a bit low. If you feel short of breath, please seek medical attention.";
        return "Your oxygen level looks good.";
      default:
        return "I've recorded this measurement for you.";
    }
  }
}

export const zeinaActionsService = new ZeinaActionsService();
export default zeinaActionsService;
