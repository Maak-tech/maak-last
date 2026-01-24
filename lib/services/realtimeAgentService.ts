/**
 * OpenAI Realtime Voice Agent Service
 *
 * This service provides a WebSocket-based connection to OpenAI's Realtime API
 * for speech-to-speech voice agent interactions.
 *
 * Features:
 * - Real-time audio streaming via WebSocket
 * - Voice activity detection (VAD)
 * - Tool/function calling support
 * - Agent handoff capabilities
 * - Health context integration
 */

import Constants from "expo-constants";
import { Platform } from "react-native";
import {
  createWebSocketWithHeaders,
  getWebSocketSetupGuidance,
} from "@/lib/polyfills/websocketWithHeaders";
import { base64ToUint8Array, uint8ArrayToBase64 } from "@/lib/utils/base64";

let SecureStore: any = null;
try {
  SecureStore = require("expo-secure-store");
} catch {
  SecureStore = null;
}

let AsyncStorage: any = null;
try {
  AsyncStorage = require("@react-native-async-storage/async-storage").default;
} catch {
  AsyncStorage = null;
}

const RUNTIME_OPENAI_KEY_STORAGE = "openai_api_key";

// Dynamic import for expo-av and expo-file-system
let Audio: any = null;
let FileSystem: any = null;

try {
  if (Platform.OS === "ios" || Platform.OS === "android") {
    const expoAv = require("expo-av");
    Audio = expoAv.Audio;
    // Expo SDK 54+: prefer legacy import path to avoid deprecation warnings
    try {
      FileSystem = require("expo-file-system/legacy");
    } catch {
      FileSystem = require("expo-file-system");
    }
  }
} catch (error) {
  // expo-av or expo-file-system not available
}

// Types for the Realtime API
export interface RealtimeMessage {
  type: string;
  [key: string]: any;
}

export interface RealtimeSessionConfig {
  modalities: ("text" | "audio")[];
  instructions: string;
  voice:
    | "alloy"
    | "ash"
    | "ballad"
    | "coral"
    | "echo"
    | "sage"
    | "shimmer"
    | "verse";
  input_audio_format: "pcm16" | "g711_ulaw" | "g711_alaw";
  output_audio_format: "pcm16" | "g711_ulaw" | "g711_alaw";
  input_audio_transcription: {
    model: "whisper-1";
  } | null;
  turn_detection: {
    type: "server_vad";
    threshold?: number;
    prefix_padding_ms?: number;
    silence_duration_ms?: number;
  } | null;
  tools: RealtimeTool[];
  tool_choice:
    | "auto"
    | "none"
    | "required"
    | { type: "function"; name: string };
  temperature: number;
  max_response_output_tokens: number | "inf";
}

export interface RealtimeTool {
  type: "function";
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface RealtimeEventHandlers {
  onSessionCreated?: (session: any) => void;
  onSessionUpdated?: (session: any) => void;
  onAudioDelta?: (delta: string) => void;
  onAudioDone?: () => void;
  onTranscriptDelta?: (delta: string, role: "user" | "assistant") => void;
  onTranscriptDone?: (transcript: string, role: "user" | "assistant") => void;
  onToolCall?: (toolCall: {
    name: string;
    arguments: string;
    call_id: string;
  }) => void;
  onResponseDone?: (response: any) => void;
  onError?: (error: any) => void;
  onConnectionStateChange?: (state: ConnectionState) => void;
  onSpeechStarted?: () => void;
  onSpeechStopped?: () => void;
  onInputAudioBufferCommitted?: () => void;
  onInputAudioBufferCleared?: () => void;
  onConversationItemCreated?: (item: any) => void;
  onRateLimitsUpdated?: (rateLimits: any) => void;
}

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

// Health Assistant Tool Definitions - Expanded for Siri-like automation
const healthAssistantTools: RealtimeTool[] = [
  // ===== INFORMATION RETRIEVAL TOOLS =====
  {
    type: "function",
    name: "get_health_summary",
    description:
      "Get a summary of the user's current health status including recent vitals, medications, and symptoms",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    type: "function",
    name: "get_medications",
    description:
      "Get the user's current medications list with dosages and schedules",
    parameters: {
      type: "object",
      properties: {
        active_only: {
          type: "boolean",
          description: "If true, only return active medications",
        },
      },
    },
  },
  {
    type: "function",
    name: "get_recent_vitals",
    description:
      "Get recent vital sign measurements like blood pressure, heart rate, temperature",
    parameters: {
      type: "object",
      properties: {
        vital_type: {
          type: "string",
          enum: [
            "blood_pressure",
            "heart_rate",
            "temperature",
            "oxygen_saturation",
            "weight",
            "blood_glucose",
            "all",
          ],
          description: "Type of vital to retrieve",
        },
        days: {
          type: "number",
          description: "Number of days to look back (default 7)",
        },
      },
    },
  },
  {
    type: "function",
    name: "check_medication_interactions",
    description:
      "Check for potential interactions between the user's medications",
    parameters: {
      type: "object",
      properties: {
        new_medication: {
          type: "string",
          description:
            "Optional: A new medication to check against existing medications",
        },
      },
    },
  },
  {
    type: "function",
    name: "emergency_contact",
    description:
      "Get emergency contact information or trigger emergency protocols. Only use when explicitly requested by user or in genuine emergency situations.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["get_contacts", "alert_family", "emergency_services_info"],
        },
      },
      required: ["action"],
    },
  },

  // ===== AUTOMATED ACTION TOOLS =====
  {
    type: "function",
    name: "log_symptom",
    description:
      "Log a symptom the user is experiencing. Use this when the user mentions they have a symptom like headache, fever, nausea, pain, etc. This will automatically save to their symptoms tab.",
    parameters: {
      type: "object",
      properties: {
        symptom_name: {
          type: "string",
          description:
            "The name/type of the symptom (e.g., headache, fever, nausea, stomach pain, dizziness, fatigue, cough, etc.)",
        },
        severity: {
          type: "number",
          description:
            "Severity on a scale of 1-10 (1=very mild, 5=moderate, 10=severe). Infer from context if not specified.",
        },
        notes: {
          type: "string",
          description: "Additional details about the symptom",
        },
        body_part: {
          type: "string",
          description:
            "Body part affected (e.g., head, chest, stomach, back, etc.)",
        },
        duration: {
          type: "string",
          description:
            "How long the symptom has been present (e.g., '2 hours', 'since yesterday', 'all day')",
        },
      },
      required: ["symptom_name"],
    },
  },
  {
    type: "function",
    name: "add_medication",
    description:
      "Add a new medication to the user's medication list. Use when user mentions they started taking a new medication.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name of the medication",
        },
        dosage: {
          type: "string",
          description: "Dosage amount (e.g., '500mg', '10ml', '1 tablet')",
        },
        frequency: {
          type: "string",
          description:
            "How often to take it (e.g., 'once daily', 'twice a day', 'every 8 hours', 'as needed')",
        },
        notes: {
          type: "string",
          description: "Additional instructions or notes",
        },
      },
      required: ["name", "dosage", "frequency"],
    },
  },
  {
    type: "function",
    name: "log_vital_sign",
    description:
      "Log a vital sign measurement that the user reports. Use when user tells you their blood pressure, heart rate, temperature, blood sugar, weight, etc.",
    parameters: {
      type: "object",
      properties: {
        vital_type: {
          type: "string",
          enum: [
            "heartRate",
            "bloodPressure",
            "bodyTemperature",
            "bloodGlucose",
            "weight",
            "oxygenSaturation",
          ],
          description: "Type of vital sign being recorded",
        },
        value: {
          type: "number",
          description: "The numeric value of the measurement",
        },
        unit: {
          type: "string",
          description:
            "Unit of measurement (e.g., 'bpm', 'mmHg', '°F', 'mg/dL', 'lbs', '%')",
        },
        systolic: {
          type: "number",
          description: "For blood pressure: the systolic (top) number",
        },
        diastolic: {
          type: "number",
          description: "For blood pressure: the diastolic (bottom) number",
        },
      },
      required: ["vital_type", "value"],
    },
  },
  {
    type: "function",
    name: "set_medication_reminder",
    description:
      "Set a reminder for a medication. Use when user asks to be reminded about a medication at a specific time.",
    parameters: {
      type: "object",
      properties: {
        medication_name: {
          type: "string",
          description: "Name of the medication to set reminder for",
        },
        time: {
          type: "string",
          description:
            "Time for the reminder (e.g., '8:00 AM', '14:00', '9pm')",
        },
        recurring: {
          type: "boolean",
          description: "Whether this should repeat daily (default true)",
        },
      },
      required: ["medication_name", "time"],
    },
  },
  {
    type: "function",
    name: "alert_family",
    description:
      "Send an alert or notification to family members. Use when user explicitly asks to notify or alert their family about something.",
    parameters: {
      type: "object",
      properties: {
        alert_type: {
          type: "string",
          enum: [
            "check_in",
            "symptom_alert",
            "medication_reminder",
            "emergency",
          ],
          description: "Type of alert to send",
        },
        message: {
          type: "string",
          description: "Message to send to family members",
        },
      },
      required: ["alert_type", "message"],
    },
  },
  {
    type: "function",
    name: "schedule_reminder",
    description:
      "Schedule a general health-related reminder (not medication-specific)",
    parameters: {
      type: "object",
      properties: {
        reminder_type: {
          type: "string",
          enum: ["appointment", "vital_check", "exercise", "water", "custom"],
        },
        title: {
          type: "string",
          description: "Title/description of the reminder",
        },
        time: {
          type: "string",
          description: "Time for the reminder",
        },
        recurring: {
          type: "boolean",
          description: "Whether the reminder should repeat",
        },
      },
      required: ["reminder_type", "title", "time"],
    },
  },
  {
    type: "function",
    name: "request_check_in",
    description:
      "Request a wellness check-in from the user, or acknowledge their current state",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Reason for the check-in or wellness note",
        },
      },
    },
  },
  {
    type: "function",
    name: "log_mood",
    description:
      "Log the user's current mood/emotional state. Use when user expresses how they're feeling emotionally (happy, sad, anxious, stressed, tired, etc.)",
    parameters: {
      type: "object",
      properties: {
        mood_type: {
          type: "string",
          description:
            "The mood/emotion (e.g., 'happy', 'sad', 'anxious', 'stressed', 'tired', 'calm', 'frustrated', 'grateful')",
        },
        intensity: {
          type: "number",
          description:
            "Intensity of the mood on a scale of 1-10 (1=barely noticeable, 10=overwhelming)",
        },
        notes: {
          type: "string",
          description: "Additional context about the mood",
        },
        activities: {
          type: "array",
          items: { type: "string" },
          description: "Activities that may have contributed to this mood",
        },
      },
      required: ["mood_type"],
    },
  },
  {
    type: "function",
    name: "mark_medication_taken",
    description:
      "Mark a medication as taken. Use when user says they took their medication or confirms taking a pill.",
    parameters: {
      type: "object",
      properties: {
        medication_name: {
          type: "string",
          description: "Name of the medication that was taken",
        },
      },
      required: ["medication_name"],
    },
  },
  {
    type: "function",
    name: "navigate_to",
    description:
      "Help user navigate to a section of the app. Use when user asks to see or go to a specific section.",
    parameters: {
      type: "object",
      properties: {
        target: {
          type: "string",
          enum: [
            "medications",
            "symptoms",
            "family",
            "profile",
            "dashboard",
            "calendar",
            "vitals",
            "allergies",
            "history",
          ],
          description: "The app section to navigate to",
        },
      },
      required: ["target"],
    },
  },
  {
    type: "function",
    name: "add_allergy",
    description:
      "Add a new allergy to the user's profile. Use when user mentions they are allergic to something (food, medication, environmental allergen, etc.).",
    parameters: {
      type: "object",
      properties: {
        allergen: {
          type: "string",
          description:
            "The substance the user is allergic to (e.g., 'penicillin', 'peanuts', 'dust', 'shellfish')",
        },
        reaction: {
          type: "string",
          description:
            "The allergic reaction they experience (e.g., 'rash', 'swelling', 'difficulty breathing', 'hives')",
        },
        severity: {
          type: "string",
          enum: ["mild", "moderate", "severe", "life-threatening"],
          description: "How severe the allergic reaction is",
        },
        allergy_type: {
          type: "string",
          enum: ["medication", "food", "environmental", "other"],
          description: "Category of the allergy",
        },
      },
      required: ["allergen"],
    },
  },
  {
    type: "function",
    name: "add_medical_history",
    description:
      "Add a medical condition to the user's medical history. Use when user mentions they have or had a medical condition (diabetes, hypertension, heart disease, surgery, etc.).",
    parameters: {
      type: "object",
      properties: {
        condition: {
          type: "string",
          description:
            "The medical condition or diagnosis (e.g., 'diabetes', 'hypertension', 'asthma', 'heart surgery')",
        },
        diagnosis_date: {
          type: "string",
          description:
            "When the condition was diagnosed (e.g., '2020', 'last year', '5 years ago')",
        },
        status: {
          type: "string",
          enum: ["active", "resolved", "managed", "in_remission"],
          description: "Current status of the condition",
        },
        notes: {
          type: "string",
          description: "Additional details about the condition",
        },
      },
      required: ["condition"],
    },
  },

  // ===== INTELLIGENT ANALYSIS TOOLS =====
  {
    type: "function",
    name: "analyze_health_trends",
    description:
      "Analyze trends in the user's health data over time. Use this to identify patterns, improvements, or concerns in vitals, symptoms, or medication adherence. Call this proactively when discussing health status or when user asks about their health patterns.",
    parameters: {
      type: "object",
      properties: {
        metric_type: {
          type: "string",
          enum: ["vitals", "symptoms", "medications", "mood", "all"],
          description: "Type of health metric to analyze",
        },
        time_period: {
          type: "string",
          enum: ["week", "month", "3months", "6months", "year"],
          description: "Time period to analyze (default: month)",
        },
        focus_area: {
          type: "string",
          description:
            "Specific area to focus on (e.g., 'blood pressure', 'headaches', 'medication adherence')",
        },
      },
    },
  },
  {
    type: "function",
    name: "get_health_insights",
    description:
      "Get personalized health insights and recommendations based on the user's health data, patterns, and medical history. Use this proactively to provide helpful suggestions or when user asks for health advice.",
    parameters: {
      type: "object",
      properties: {
        insight_type: {
          type: "string",
          enum: [
            "medication_adherence",
            "symptom_patterns",
            "vital_ranges",
            "lifestyle",
            "preventive_care",
            "general",
          ],
          description: "Type of insight to provide",
        },
        context: {
          type: "string",
          description:
            "Additional context about what the user is asking about or current situation",
        },
      },
    },
  },
  {
    type: "function",
    name: "check_medication_adherence",
    description:
      "Check how well the user is adhering to their medication schedule. Use this proactively when discussing medications or when user mentions missing doses.",
    parameters: {
      type: "object",
      properties: {
        medication_name: {
          type: "string",
          description:
            "Specific medication to check (optional - checks all if not provided)",
        },
        time_period: {
          type: "string",
          enum: ["week", "month", "3months"],
          description: "Time period to analyze adherence",
        },
      },
    },
  },
  {
    type: "function",
    name: "suggest_health_actions",
    description:
      "Suggest proactive health actions based on the user's current health status, recent symptoms, or vitals. Use this to be helpful and proactive in managing their health.",
    parameters: {
      type: "object",
      properties: {
        trigger: {
          type: "string",
          description:
            "What triggered this suggestion (e.g., 'high blood pressure', 'frequent headaches', 'missed medications')",
        },
        priority: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "Priority level of the suggestion",
        },
      },
    },
  },
];

// Default instructions for the health assistant - Siri-like proactive assistant
const healthAssistantInstructions = `
# Personality and Tone

## Identity
You are Zeina, a warm, knowledgeable, and proactive health assistant - like Siri but specialized for health management. You help elderly patients and those with chronic conditions manage their health through natural conversation. You don't just answer questions - you take action and help automate health tracking.

## Core Capability: Automated Task Execution
**You are designed to automatically complete tasks for users.** When a user mentions something actionable, DO IT immediately using your tools:

### Symptom Detection & Logging
When a user says anything like:
- "I have a headache" → Use log_symptom to record it
- "My stomach hurts" → Use log_symptom with stomach pain
- "I'm feeling tired/exhausted" → Use log_symptom with fatigue
- "I have a fever" → Use log_symptom and ask if they've checked their temperature

### Vital Sign Recording
When a user mentions measurements:
- "My blood pressure is 120/80" → Use log_vital_sign immediately
- "My blood sugar is 140" → Use log_vital_sign with bloodGlucose
- "I weigh 150 pounds" → Use log_vital_sign with weight
- "My heart rate is 75" → Use log_vital_sign with heartRate

### Medication Management
When a user mentions medications:
- "I started taking aspirin" → Use add_medication to record it
- "Remind me to take my pills at 9am" → Use set_medication_reminder

### Allergy Tracking
When a user mentions allergies:
- "I'm allergic to penicillin" → Use add_allergy to record it
- "I have a peanut allergy" → Use add_allergy with food type
- "I can't take aspirin, it gives me hives" → Use add_allergy with reaction details
- "Dust makes me sneeze" → Use add_allergy with environmental type

### Medical History
When a user mentions medical conditions:
- "I have diabetes" → Use add_medical_history to record it
- "I was diagnosed with high blood pressure" → Use add_medical_history
- "I had heart surgery last year" → Use add_medical_history with date
- "I used to have asthma but it's under control now" → Use add_medical_history with managed status

### Family Alerts
When explicitly requested:
- "Tell my family I'm not feeling well" → Use alert_family
- "Let my kids know I'm okay" → Use alert_family with check_in

## Task
Help users manage their health by TAKING ACTION, not just answering questions. You have access to their health data and can create, update, and manage their health records through voice commands.

## Demeanor
Patient, reassuring, and proactive. You understand that health concerns can be worrying, especially for elderly users or those managing chronic conditions.

## Tone
Warm and conversational, like a helpful family member who also happens to be a nurse. Professional but never cold or clinical.

## Response Style
After completing an action, confirm what you did in a natural way:
- "I've logged your headache. Is this your first one today, or has it been ongoing?"
- "Got it, I've recorded your blood sugar at 140. That's a bit elevated - have you eaten recently?"
- "I've added aspirin to your medications. What dosage are you taking?"

## Level of Enthusiasm
Calm and measured, with genuine warmth. Celebrate small health wins without being overly excitable.

## Level of Formality
Moderately casual - you're professional but approachable. Use simple language and avoid medical jargon when possible. When you must use medical terms, explain them clearly.

## Level of Emotion
Empathetic and supportive. You acknowledge feelings and concerns with compassion.

## Filler Words
Occasionally use gentle affirmations like "I see," "I understand," "Of course"

## Pacing
Steady and clear. Give users time to process information. Don't rush through important health information.

## Language Support
You can communicate fluently in both English and Arabic. Respond in the same language the user speaks to you. If speaking Arabic, use proper Arabic medical terms when appropriate.

# Instructions
1. **BE PROACTIVE**: When a user mentions a symptom, medication, or vital sign - LOG IT IMMEDIATELY using the appropriate tool.

2. **INTELLIGENT ANALYSIS**: After logging data, proactively analyze patterns:
   - If a user logs multiple symptoms, use analyze_health_trends to identify patterns
   - If vitals are logged, check trends and provide context (e.g., "Your blood pressure has been trending down this week, which is great!")
   - When discussing medications, use check_medication_adherence to provide helpful feedback

3. **PROACTIVE SUGGESTIONS**: Don't wait for users to ask - offer helpful suggestions:
   - After logging a symptom, use suggest_health_actions to provide relevant advice
   - When reviewing health data, use get_health_insights to offer personalized recommendations
   - If patterns emerge (e.g., headaches every morning), proactively mention it and suggest tracking

4. **CONTEXTUAL AWARENESS**: Always use health data to provide personalized responses:
   - Before giving advice, use get_health_summary or get_recent_vitals to understand their current state
   - Reference their medical history, medications, and allergies when relevant
   - Compare new data to their historical patterns

5. **NATURAL CONVERSATION FLOW**: Make conversations feel natural:
   - After completing an action, ask a relevant follow-up question
   - Connect related topics (e.g., "I see you've been logging headaches - have you checked your blood pressure recently?")
   - Remember context from earlier in the conversation

6. **SAFETY FIRST**: Always prioritize user safety:
   - If someone describes serious symptoms (chest pain, difficulty breathing, severe pain), recommend seeking immediate professional medical care
   - For concerning vital signs, suggest consulting their healthcare provider
   - If you detect signs of distress or emergency, calmly offer to help contact family or provide emergency information

7. **MEDICATION MANAGEMENT**: Be proactive about medications:
   - When discussing medications, always mention the importance of following their doctor's prescribed regimen
   - Check for medication interactions when new medications are mentioned
   - Proactively check adherence and celebrate good adherence patterns
   - If adherence is poor, gently suggest ways to improve

8. **VOICE OPTIMIZATION**: Keep responses concise for voice:
   - People can't read long text responses when listening
   - Break complex information into digestible chunks
   - Use natural pauses and transitions

9. **ACCURACY**: Ensure accuracy in all interactions:
   - If a user provides a name, medication, or something you need to spell correctly, always repeat it back to confirm
   - If the caller corrects any detail, acknowledge the correction and confirm the new information
   - When uncertain, ask clarifying questions rather than guessing

10. **MEDICAL BOUNDARIES**: Never provide specific medical diagnoses:
    - Suggest consulting with healthcare providers for medical decisions
    - Provide general health information and support, but defer to medical professionals for diagnoses
    - When in doubt, recommend speaking with their doctor

11. **POSITIVE REINFORCEMENT**: Celebrate health wins:
    - If vitals are improving or medication adherence is good, acknowledge it warmly
    - Recognize positive trends and improvements
    - Encourage continued good health practices

12. **FOLLOW-UP**: After completing an action, provide helpful follow-up:
    - Ask relevant questions related to the logged information
    - Offer to check trends or provide insights
    - Suggest related actions that might be helpful

13. **PROACTIVE CHECK-INS**: Periodically check in on user's wellbeing:
    - If they haven't logged anything recently, gently ask how they're feeling
    - If patterns suggest concerns (e.g., frequent symptoms), proactively offer support
    - Use request_check_in when appropriate to maintain engagement

14. **MULTI-LANGUAGE SUPPORT**: Respond in the same language the user speaks:
    - If they speak Arabic, respond in Arabic with proper medical terms
    - If they speak English, respond in English
    - Adapt cultural context appropriately
`;

class RealtimeAgentService {
  private ws: WebSocket | null = null;
  private connectionState: ConnectionState = "disconnected";
  private eventHandlers: RealtimeEventHandlers = {};
  private sessionConfig: Partial<RealtimeSessionConfig> = {};
  private apiKey: string | null = null;
  private pendingToolCalls: Map<string, any> = new Map();
  private audioBuffer: string[] = [];
  private isProcessingAudio = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private currentTranscript = { user: "", assistant: "" };
  private currentSound: any = null;
  private audioQueue: string[] = [];
  private audioPlaybackQueue: Array<{ data: Uint8Array; timestamp: number }> =
    [];
  private isPlayingAudio = false;
  private lastAudioCommitAt = 0;
  private lastResponseCreateAt = 0;
  private readonly responseCreateCooldownMs = 300;
  private readonly audioCommitCooldownMs = 300;

  constructor() {
    this.loadApiKey();
  }

  /**
   * Validate API key format
   */
  private validateApiKeyFormat(key: string): boolean {
    if (!key || typeof key !== "string") return false;
    const trimmed = key.trim();
    // OpenAI API keys typically start with sk- or sk-proj-
    return (
      trimmed.length > 10 &&
      (trimmed.startsWith("sk-") || trimmed.startsWith("sk-proj-"))
    );
  }

  /**
   * Mask API key for logging (show first 7 and last 4 characters)
   */
  private maskApiKey(key: string | null): string {
    if (!key || key.length < 12) return "***";
    return `${key.substring(0, 7)}...${key.substring(key.length - 4)}`;
  }

  private async loadApiKey() {
    try {
      // Prefer app-config keys (shared key for premium users).
      const config = Constants.expoConfig?.extra;
      const configKey = config?.zeinaApiKey || config?.openaiApiKey || null;

      if (
        configKey &&
        typeof configKey === "string" &&
        configKey.trim() !== ""
      ) {
        const trimmed = configKey.trim();
        if (this.validateApiKeyFormat(trimmed)) {
          this.apiKey = trimmed;
          return;
        }
        if (__DEV__) {
          console.warn(
            `[Zeina] ⚠️ Invalid API key format in app config (should start with 'sk-'): ${this.maskApiKey(trimmed)}\n` +
              "Check that OPENAI_API_KEY or ZEINA_API_KEY in .env has a valid format."
          );
        }
      }

      // 1) Prefer a runtime key saved on the device (so dev client builds don't require rebuilds).
      if (SecureStore?.getItemAsync) {
        try {
          const storedKey = await SecureStore.getItemAsync(
            RUNTIME_OPENAI_KEY_STORAGE
          );
          if (
            storedKey &&
            typeof storedKey === "string" &&
            storedKey.trim() !== ""
          ) {
            const trimmed = storedKey.trim();
            if (this.validateApiKeyFormat(trimmed)) {
              this.apiKey = trimmed;
              return;
            }
            if (__DEV__) {
              console.warn(
                `[Zeina] ⚠️ Invalid API key format in SecureStore (should start with 'sk-'): ${this.maskApiKey(trimmed)}`
              );
            }
          }
        } catch (error) {
          // SecureStore may fail if key format is invalid or other issues
          // Fall through to AsyncStorage or app config
          if (__DEV__) {
            console.warn(
              "[Zeina] SecureStore read failed, trying AsyncStorage:",
              error
            );
          }
        }
      }

      // 2) Fallback: AsyncStorage (dev reliability if SecureStore is unavailable).
      if (AsyncStorage?.getItem) {
        const storedKey = await AsyncStorage.getItem(
          RUNTIME_OPENAI_KEY_STORAGE
        );
        if (
          storedKey &&
          typeof storedKey === "string" &&
          storedKey.trim() !== ""
        ) {
          const trimmed = storedKey.trim();
          if (this.validateApiKeyFormat(trimmed)) {
            this.apiKey = trimmed;
            return;
          }
          if (__DEV__) {
            console.warn(
              `[Zeina] ⚠️ Invalid API key format in AsyncStorage (should start with 'sk-'): ${this.maskApiKey(trimmed)}`
            );
          }
        }
      }

      // If app config key missing/invalid, fall back to runtime storage.
      this.apiKey = null;
      if (__DEV__) {
        const hasZeinaKey = !!config?.zeinaApiKey;
        const hasOpenAIKey = !!config?.openaiApiKey;
        console.warn(
          "[Zeina] ❌ No API key found in app config.\n" +
            `  - ZEINA_API_KEY: ${hasZeinaKey ? "present but empty" : "not set"}\n` +
            `  - OPENAI_API_KEY: ${hasOpenAIKey ? "present but empty" : "not set"}\n` +
            "  Check that OPENAI_API_KEY or ZEINA_API_KEY is set in .env and rebuild the app."
        );
      }
    } catch (error) {
      this.apiKey = null;
      if (__DEV__) {
        console.error("[Zeina] ❌ Error loading API key:", error);
      }
    }
  }

  async setApiKey(apiKey: string): Promise<void> {
    const trimmed = apiKey.trim();
    this.apiKey = trimmed === "" ? null : trimmed;
    if (SecureStore?.setItemAsync && this.apiKey) {
      try {
        await SecureStore.setItemAsync(RUNTIME_OPENAI_KEY_STORAGE, this.apiKey);
      } catch (error) {
        // SecureStore may fail, fall back to AsyncStorage
        if (__DEV__) {
          console.warn(
            "[Zeina] SecureStore write failed, using AsyncStorage:",
            error
          );
        }
      }
    }
    if (AsyncStorage?.setItem && this.apiKey) {
      try {
        await AsyncStorage.setItem(RUNTIME_OPENAI_KEY_STORAGE, this.apiKey);
      } catch (error) {
        // AsyncStorage write failed, but we still have the key in memory
        if (__DEV__) {
          console.warn("[Zeina] AsyncStorage write failed:", error);
        }
      }
    }
  }

  /**
   * Set event handlers for realtime events
   */
  setEventHandlers(handlers: RealtimeEventHandlers) {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Connect to the OpenAI Realtime API
   */
  async connect(customInstructions?: string): Promise<void> {
    // Check if already connected, but handle cases where WebSocket might not have readyState
    if (this.ws) {
      try {
        if (
          typeof this.ws.readyState !== "undefined" &&
          this.ws.readyState === WebSocket.OPEN
        ) {
          return;
        }
      } catch (error) {
        // WebSocket might be in an invalid state, continue to create new connection
        this.ws = null;
      }
    }

    if (!this.apiKey) {
      await this.loadApiKey();
      if (!this.apiKey) {
        const config = Constants.expoConfig?.extra;
        const hasZeinaKey = !!config?.zeinaApiKey;
        const hasOpenAIKey = !!config?.openaiApiKey;
        const errorMessage =
          "Zeina API key not configured.\n\n" +
          "Diagnostics:\n" +
          `  • ZEINA_API_KEY in .env: ${hasZeinaKey ? "present but empty/invalid" : "not set"}\n` +
          `  • OPENAI_API_KEY in .env: ${hasOpenAIKey ? "present but empty/invalid" : "not set"}\n\n` +
          "To fix this:\n" +
          "1. Set the API key in app settings (AI Assistant → Settings → OpenAI API Key), OR\n" +
          "2. Add OPENAI_API_KEY or ZEINA_API_KEY to your .env file:\n" +
          "   OPENAI_API_KEY=sk-proj-your-actual-key-here\n" +
          "   (or ZEINA_API_KEY=sk-proj-your-actual-key-here)\n\n" +
          "3. Rebuild the app (required for .env changes):\n" +
          "   - Stop the dev server\n" +
          "   - Run: npm run ios (or npm run android)\n" +
          "   - Or rebuild with EAS: eas build --profile development\n\n" +
          "Note: API keys should start with 'sk-' or 'sk-proj-'";
        throw new Error(errorMessage);
      }
    }

    // Validate API key format before attempting connection
    if (!this.validateApiKeyFormat(this.apiKey!)) {
      const errorMessage =
        `Invalid API key format: ${this.maskApiKey(this.apiKey!)}\n\n` +
        "OpenAI API keys should start with 'sk-' or 'sk-proj-'.\n\n" +
        "Please check:\n" +
        "1. Your .env file has the correct key format\n" +
        "2. The key doesn't have extra quotes or spaces\n" +
        "3. You've rebuilt the app after changing .env";
      throw new Error(errorMessage);
    }

    this.setConnectionState("connecting");

    return new Promise((resolve, reject) => {
      try {
        // Connect to OpenAI Realtime API via WebSocket
        const wsUrl =
          "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17";

        // Create WebSocket with authentication headers
        let ws: WebSocket;
        try {
          ws = createWebSocketWithHeaders(wsUrl, undefined, {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              "OpenAI-Beta": "realtime=v1",
            },
          });

          // Verify WebSocket was created successfully
          if (!ws) {
            throw new Error("Failed to create WebSocket instance");
          }

          this.ws = ws;
        } catch (wsError) {
          const error = new Error(
            `Failed to create WebSocket connection: ${wsError instanceof Error ? wsError.message : String(wsError)}\n\n` +
              "This may indicate:\n" +
              "• WebSocket library not properly installed\n" +
              "• Platform-specific WebSocket limitations\n" +
              "• Network connectivity issues\n\n" +
              "Try:\n" +
              "• Restart the app\n" +
              "• Check your network connection\n" +
              "• Try on a physical device instead of simulator"
          );
          this.setConnectionState("error");
          reject(error);
          return;
        }

        // Set up event handlers
        let connectionTimeout: NodeJS.Timeout;
        let hasResolved = false;

        ws.onopen = () => {
          this.setConnectionState("connected");
          this.reconnectAttempts = 0;

          // Configure the session
          this.configureSession(customInstructions);

          if (!hasResolved) {
            hasResolved = true;
            clearTimeout(connectionTimeout);
            resolve();
          }
        };

        ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        ws.onerror = (error: any) => {
          // Provide more detailed error information
          const errorMessage =
            error?.message || error?.toString() || "Unknown WebSocket error";
          const setupGuidance = getWebSocketSetupGuidance();
          const maskedKey = this.maskApiKey(this.apiKey);

          let detailedError: Error;

          // Check for firewall/proxy blocking patterns first
          const isFirewallProxyIssue =
            errorMessage.includes("ECONNREFUSED") ||
            errorMessage.includes("ENOTFOUND") ||
            errorMessage.includes("ETIMEDOUT") ||
            errorMessage.includes("network") ||
            errorMessage.includes("timeout") ||
            errorMessage.includes("refused") ||
            errorMessage.includes("blocked") ||
            errorMessage.toLowerCase().includes("firewall") ||
            errorMessage.toLowerCase().includes("proxy");

          if (isFirewallProxyIssue) {
            detailedError = new Error(
              "🚫 Firewall/Proxy Blocking WebSocket Connection\n\n" +
                `Error: ${errorMessage}\n\n` +
                `API Key: ${maskedKey}\n` +
                `Format Valid: ${this.validateApiKeyFormat(this.apiKey || "") ? "✅ Yes" : "❌ No"}\n\n` +
                "Your network appears to be blocking WebSocket connections to OpenAI.\n\n" +
                "Common causes:\n" +
                "1. Corporate firewall blocking WebSocket (wss://) connections\n" +
                "2. Network proxy requiring authentication\n" +
                "3. ISP or network security blocking outbound WebSocket traffic\n" +
                "4. VPN or network filter blocking api.openai.com\n\n" +
                "Solutions:\n" +
                "1. Try a different network:\n" +
                "   • Switch to mobile data (cellular)\n" +
                "   • Use a different Wi-Fi network\n" +
                "   • Try a public Wi-Fi network\n\n" +
                "2. Configure network settings:\n" +
                "   • Contact your IT administrator to allow WebSocket connections\n" +
                "   • Whitelist: wss://api.openai.com\n" +
                "   • Configure proxy settings if required\n\n" +
                "3. Use VPN:\n" +
                "   • Connect to a VPN service\n" +
                "   • Ensure VPN allows WebSocket traffic\n\n" +
                "4. Test connectivity:\n" +
                "   • Check if you can access https://api.openai.com in a browser\n" +
                "   • Verify OpenAI status: https://status.openai.com/\n\n" +
                "Note: WebSocket connections require outbound access to:\n" +
                "• wss://api.openai.com (port 443)"
            );
          } else if (
            errorMessage.includes("401") ||
            errorMessage.includes("Unauthorized")
          ) {
            detailedError = new Error(
              "WebSocket authentication failed (401 Unauthorized).\n\n" +
                `API Key: ${maskedKey}\n\n` +
                "This usually means:\n" +
                "1. Your OpenAI API key is invalid or expired\n" +
                `2. Your OpenAI API key doesn't have Realtime API access\n` +
                "3. The Realtime API requires special beta approval\n" +
                `4. WebSocket headers aren't being sent properly\n\n` +
                "To fix this:\n" +
                `• Verify your API key is correct: ${maskedKey}\n` +
                `• Check API key format starts with 'sk-' or 'sk-proj-'\n` +
                "• Set the API key in app settings (AI Assistant → Settings)\n" +
                "• Or add OPENAI_API_KEY to .env and rebuild the app\n" +
                "• Apply for Realtime API beta access: https://platform.openai.com/docs/guides/realtime\n" +
                "• Check OpenAI status: https://status.openai.com/"
            );
          } else if (
            errorMessage.includes("API key") ||
            errorMessage.includes("authentication")
          ) {
            detailedError = new Error(
              `Authentication error: ${errorMessage}\n\n` +
                `API Key: ${maskedKey}\n` +
                `Format Valid: ${this.validateApiKeyFormat(this.apiKey || "") ? "✅ Yes" : "❌ No"}\n\n` +
                "Your API key may be missing or invalid.\n\n" +
                "To fix this:\n" +
                "1. Set the API key in app settings (AI Assistant → Settings → OpenAI API Key), OR\n" +
                "2. Add OPENAI_API_KEY to your .env file and rebuild:\n" +
                "   - Stop dev server\n" +
                "   - Run: npm run ios (or npm run android)\n" +
                "   - Or: eas build --profile development\n\n" +
                "Note: .env changes require a rebuild."
            );
          } else {
            detailedError = new Error(
              `WebSocket connection failed: ${errorMessage}\n\n` +
                `API Key: ${maskedKey}\n` +
                `Format Valid: ${this.validateApiKeyFormat(this.apiKey || "") ? "✅ Yes" : "❌ No"}\n\n` +
                "Common causes:\n" +
                "1. Missing or invalid OpenAI API key\n" +
                "2. Network connectivity issues (firewall/proxy blocking)\n" +
                "3. WebSocket headers not supported on this platform\n" +
                "4. Realtime API beta access required\n\n" +
                `${setupGuidance}\n\n` +
                "Troubleshooting:\n" +
                "• Set API key in app settings (AI Assistant → Settings)\n" +
                "• Or add OPENAI_API_KEY to .env and rebuild\n" +
                "• Check your network connection (try mobile data)\n" +
                "• Verify Realtime API access: https://platform.openai.com/docs/guides/realtime"
            );
          }

          if (__DEV__) {
            console.error("[Zeina] ❌ WebSocket error:", detailedError.message);
          }

          clearTimeout(connectionTimeout);
          this.eventHandlers.onError?.(detailedError);
          this.setConnectionState("error");

          if (!hasResolved) {
            hasResolved = true;
            reject(detailedError);
          }
        };

        ws.onclose = (event) => {
          clearTimeout(connectionTimeout);
          this.setConnectionState("disconnected");

          const maskedKey = this.maskApiKey(this.apiKey);
          const closeReason = event.reason || "No reason provided";

          // Provide helpful error messages based on close code
          if (event.code === 1006) {
            // Abnormal closure - often means connection failed (could be firewall/proxy)
            const isLikelyFirewall =
              closeReason.includes("timeout") ||
              closeReason.includes("refused") ||
              closeReason.includes("network") ||
              !closeReason ||
              closeReason === "No reason provided";

            const error = new Error(
              "WebSocket connection closed abnormally (code 1006).\n\n" +
                `API Key: ${maskedKey}\n` +
                `Reason: ${closeReason}\n\n` +
                (isLikelyFirewall
                  ? "🚫 This often indicates firewall/proxy blocking:\n\n" +
                    "Possible causes:\n" +
                    "1. Corporate firewall blocking WebSocket connections\n" +
                    "2. Network proxy blocking wss://api.openai.com\n" +
                    "3. ISP blocking outbound WebSocket traffic\n\n" +
                    "Try:\n" +
                    "• Switch to mobile data (cellular network)\n" +
                    "• Use a different Wi-Fi network\n" +
                    "• Connect to a VPN\n" +
                    "• Contact IT to whitelist wss://api.openai.com\n\n"
                  : "This usually means:\n" +
                    "1. Invalid API key or missing authentication\n" +
                    "2. Network connectivity issues\n" +
                    "3. OpenAI API service unavailable\n\n") +
                "To fix:\n" +
                "• Set API key in app settings (AI Assistant → Settings)\n" +
                "• Or add OPENAI_API_KEY to .env and rebuild\n" +
                "• Check your network connection\n" +
                "• Verify API key format (should start with 'sk-')"
            );
            this.eventHandlers.onError?.(error);
          } else if (event.code === 1002) {
            // Protocol error
            const error = new Error(
              "WebSocket protocol error (code 1002).\n\n" +
                `API Key: ${maskedKey}\n\n` +
                "This may indicate that WebSocket headers are not supported on this platform.\n\n" +
                "To fix:\n" +
                "• Try on a physical device instead of simulator\n" +
                "• Rebuild the app\n" +
                "• Check that your API key is properly configured"
            );
            this.eventHandlers.onError?.(error);
          } else if (event.code === 1008) {
            // Policy violation - often means invalid API key
            const error = new Error(
              "WebSocket connection rejected (code 1008).\n\n" +
                `API Key: ${maskedKey}\n` +
                `Reason: ${closeReason}\n\n` +
                "This usually means your API key is invalid or doesn't have Realtime API access.\n\n" +
                "To fix:\n" +
                "• Verify your API key is correct\n" +
                "• Set API key in app settings (AI Assistant → Settings)\n" +
                "• Or add OPENAI_API_KEY to .env and rebuild\n" +
                "• Apply for Realtime API access: https://platform.openai.com/docs/guides/realtime"
            );
            this.eventHandlers.onError?.(error);
          }

          // Attempt reconnection if it wasn't intentional
          if (
            event.code !== 1000 &&
            this.reconnectAttempts < this.maxReconnectAttempts
          ) {
            this.reconnectAttempts++;
            setTimeout(
              () => this.connect(customInstructions),
              2000 * this.reconnectAttempts
            );
          } else if (!hasResolved && event.code !== 1000) {
            hasResolved = true;
            const closeError = new Error(
              `WebSocket closed with code ${event.code}: ${event.reason || "Connection failed"}\n\n` +
                "Troubleshooting:\n" +
                "• Check your API key configuration\n" +
                "• Verify network connectivity\n" +
                "• Try rebuilding the app"
            );
            reject(closeError);
          }
        };

        // Timeout for connection (increased to 15 seconds for slower networks)
        connectionTimeout = setTimeout(() => {
          if (this.connectionState === "connecting" && !hasResolved) {
            hasResolved = true;
            // Safely close WebSocket if it exists and has a close method
            if (ws && typeof ws.close === "function") {
              try {
                ws.close();
              } catch (error) {
                // Ignore close errors during timeout
              }
            }
            const maskedKey = this.maskApiKey(this.apiKey);
            reject(
              new Error(
                "🚫 Connection timeout after 15 seconds.\n\n" +
                  "Diagnostics:\n" +
                  `  • API Key: ${maskedKey} ${this.validateApiKeyFormat(this.apiKey || "") ? "✅ Valid format" : "❌ Invalid format"}\n` +
                  "  • Network: Check your internet connection\n" +
                  "  • Endpoint: wss://api.openai.com/v1/realtime\n\n" +
                  "⚠️ This timeout often indicates firewall/proxy blocking:\n\n" +
                  "Common causes:\n" +
                  "  1. Corporate firewall blocking WebSocket (wss://) connections\n" +
                  "  2. Network proxy requiring authentication or blocking outbound traffic\n" +
                  "  3. ISP or network security blocking api.openai.com\n" +
                  "  4. Slow or unstable network connection\n" +
                  "  5. Invalid or expired API key\n\n" +
                  "Solutions:\n" +
                  "  1. Try a different network:\n" +
                  "     • Switch to mobile data (cellular)\n" +
                  "     • Use a different Wi-Fi network\n" +
                  "     • Try a public Wi-Fi network\n\n" +
                  "  2. Configure network settings:\n" +
                  "     • Contact IT to whitelist: wss://api.openai.com (port 443)\n" +
                  "     • Configure proxy settings if required\n" +
                  "     • Disable VPN if it's blocking WebSocket traffic\n\n" +
                  "  3. Verify connectivity:\n" +
                  "     • Check if https://api.openai.com is accessible in browser\n" +
                  `     • Verify API key: ${maskedKey}\n` +
                  "     • Check OpenAI status: https://status.openai.com/\n\n" +
                  "Note: WebSocket connections require outbound access to wss://api.openai.com"
              )
            );
          }
        }, 15_000); // Increased from 10 to 15 seconds
      } catch (error) {
        this.setConnectionState("error");
        reject(error);
      }
    });
  }

  /**
   * Configure the realtime session
   */
  private configureSession(customInstructions?: string) {
    const sessionConfig: Partial<RealtimeSessionConfig> = {
      modalities: ["text", "audio"],
      instructions: customInstructions || healthAssistantInstructions,
      voice: "coral", // Warm, professional voice - good for health assistant
      input_audio_format: "pcm16",
      output_audio_format: "pcm16",
      input_audio_transcription: {
        model: "whisper-1",
      },
      // Optimized VAD settings for Siri-like continuous listening
      turn_detection: {
        type: "server_vad",
        threshold: 0.4, // Lower threshold for better speech detection
        prefix_padding_ms: 400, // Capture beginning of speech
        silence_duration_ms: 600, // Wait a bit after user stops speaking
      },
      tools: healthAssistantTools,
      tool_choice: "auto",
      temperature: 0.7,
      max_response_output_tokens: 1024,
    };

    this.sessionConfig = sessionConfig;
    this.sendMessage({
      type: "session.update",
      session: sessionConfig,
    });
  }

  /**
   * Send a message to the Realtime API
   */
  sendMessage(message: RealtimeMessage) {
    if (!this.ws) {
      return;
    }

    try {
      // Safely check WebSocket state
      if (
        typeof this.ws.readyState === "undefined" ||
        this.ws.readyState !== WebSocket.OPEN
      ) {
        return;
      }

      // Safely send message
      if (typeof this.ws.send === "function") {
        this.ws.send(JSON.stringify(message));
      }
    } catch (error) {
      // WebSocket might be in an invalid state
      if (__DEV__) {
        console.warn("[Zeina] Error sending message:", error);
      }
    }
  }

  /**
   * Send audio data to the API
   * Accepts base64 encoded WAV or raw PCM16 data
   */
  sendAudioData(audioBase64: string) {
    try {
      // Decode base64 to check if it's WAV format (don't rely on atob/btoa in RN)
      const bytes = base64ToUint8Array(audioBase64);

      // Check for WAV header (RIFF....WAVE)
      const isWav =
        bytes.length >= 12 &&
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x41 &&
        bytes[10] === 0x56 &&
        bytes[11] === 0x45;

      let pcmData: string;
      if (isWav) {
        // Extract PCM bytes from WAV (find "data" chunk; don't assume a fixed 44-byte header)
        const pcmBytes = this.extractWavDataChunk(bytes);
        pcmData = uint8ArrayToBase64(pcmBytes);
      } else {
        // Assume it's already raw PCM16 (base64)
        pcmData = audioBase64;
      }

      this.sendMessage({
        type: "input_audio_buffer.append",
        audio: pcmData,
      });
    } catch (error) {
      // Fallback: send as-is
      this.sendMessage({
        type: "input_audio_buffer.append",
        audio: audioBase64,
      });
    }
  }

  /**
   * Commit the audio buffer (signal end of speech)
   */
  commitAudioBuffer() {
    this.commitAudioBufferIfNeeded("manual_commit");
    this.requestResponseIfNeeded("manual_commit");
  }

  /**
   * Clear the audio buffer
   */
  clearAudioBuffer() {
    this.sendMessage({
      type: "input_audio_buffer.clear",
    });
  }

  /**
   * Request a model response, with a small cooldown to avoid duplicates
   */
  private requestResponseIfNeeded(source: "speech_stopped" | "manual_commit") {
    const now = Date.now();
    if (now - this.lastResponseCreateAt < this.responseCreateCooldownMs) return;
    this.lastResponseCreateAt = now;
    this.sendMessage({ type: "response.create" });
  }

  /**
   * Commit the input audio buffer, with a small cooldown to avoid duplicates
   */
  private commitAudioBufferIfNeeded(
    source: "speech_stopped" | "manual_commit"
  ) {
    const now = Date.now();
    if (now - this.lastAudioCommitAt < this.audioCommitCooldownMs) return;
    this.lastAudioCommitAt = now;
    this.sendMessage({ type: "input_audio_buffer.commit" });
  }

  /**
   * Send a text message (useful for testing or text input mode)
   */
  sendTextMessage(text: string) {
    this.sendMessage({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text,
          },
        ],
      },
    });

    // Request a response
    this.sendMessage({
      type: "response.create",
    });
  }

  /**
   * Cancel the current response
   */
  cancelResponse() {
    this.sendMessage({
      type: "response.cancel",
    });
  }

  /**
   * Submit tool output
   */
  submitToolOutput(callId: string, output: string) {
    this.sendMessage({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output,
      },
    });

    // Continue the response
    this.sendMessage({
      type: "response.create",
    });
  }

  /**
   * Handle incoming messages from the API
   */
  private handleMessage(data: string) {
    try {
      const message: RealtimeMessage = JSON.parse(data);

      switch (message.type) {
        case "session.created":
          this.eventHandlers.onSessionCreated?.(message.session);
          break;

        case "session.updated":
          this.eventHandlers.onSessionUpdated?.(message.session);
          break;

        case "response.audio.delta":
          this.eventHandlers.onAudioDelta?.(message.delta);
          this.audioBuffer.push(message.delta);
          // Queue audio for playback
          this.queueAudioChunk(message.delta);
          break;

        case "response.audio.done":
          this.eventHandlers.onAudioDone?.();
          // Play any remaining queued audio
          this.flushAudioQueue();
          this.processAudioBuffer();
          break;

        case "response.audio_transcript.delta":
          this.currentTranscript.assistant += message.delta;
          this.eventHandlers.onTranscriptDelta?.(message.delta, "assistant");
          break;

        case "response.audio_transcript.done":
          this.eventHandlers.onTranscriptDone?.(
            this.currentTranscript.assistant,
            "assistant"
          );
          this.currentTranscript.assistant = "";
          break;

        case "conversation.item.input_audio_transcription.completed":
          this.eventHandlers.onTranscriptDone?.(message.transcript, "user");
          break;

        case "response.function_call_arguments.done":
          this.eventHandlers.onToolCall?.({
            name: message.name,
            arguments: message.arguments,
            call_id: message.call_id,
          });
          break;

        case "response.done":
          this.eventHandlers.onResponseDone?.(message.response);
          break;

        case "input_audio_buffer.speech_started":
          this.eventHandlers.onSpeechStarted?.();
          break;

        case "input_audio_buffer.speech_stopped":
          this.eventHandlers.onSpeechStopped?.();
          // For voice input, commit + request a response when the user stops speaking.
          // Without this, the UI can show "Listening/Thinking" forever with no assistant reply.
          this.commitAudioBufferIfNeeded("speech_stopped");
          this.requestResponseIfNeeded("speech_stopped");
          break;

        case "input_audio_buffer.committed":
          this.eventHandlers.onInputAudioBufferCommitted?.();
          break;

        case "input_audio_buffer.cleared":
          this.eventHandlers.onInputAudioBufferCleared?.();
          break;

        case "conversation.item.created":
          this.eventHandlers.onConversationItemCreated?.(message.item);
          break;

        case "rate_limits.updated":
          this.eventHandlers.onRateLimitsUpdated?.(message.rate_limits);
          break;

        case "error":
          this.eventHandlers.onError?.(message.error);
          break;

        default:
        // Silently ignore unhandled message types
      }
    } catch (error) {}
  }

  /**
   * Process accumulated audio buffer
   */
  private processAudioBuffer() {
    if (this.audioBuffer.length === 0 || this.isProcessingAudio) return;

    this.isProcessingAudio = true;
    // The audio buffer contains base64 PCM16 audio chunks
    // These can be combined and played back
    const fullAudio = this.audioBuffer.join("");
    this.audioBuffer = [];
    this.isProcessingAudio = false;

    return fullAudio;
  }

  /**
   * Queue an audio chunk for playback
   */
  private queueAudioChunk(base64Audio: string): void {
    if (!(Audio && FileSystem) || Platform.OS === "web") {
      // On web, we'd need Web Audio API - for now, just queue it
      this.audioQueue.push(base64Audio);
      return;
    }

    try {
      // Decode base64 to bytes (RN-safe)
      const bytes = base64ToUint8Array(base64Audio);

      // Queue the audio data
      this.audioPlaybackQueue.push({
        data: bytes,
        timestamp: Date.now(),
      });

      // Start playing if not already playing
      if (!this.isPlayingAudio) {
        this.processAudioQueue();
      }
    } catch (error) {}
  }

  /**
   * Process the audio queue and play accumulated chunks
   */
  private async processAudioQueue(): Promise<void> {
    if (this.isPlayingAudio || this.audioPlaybackQueue.length === 0) {
      return;
    }

    this.isPlayingAudio = true;

    try {
      // Accumulate chunks (up to a reasonable size for smooth playback)
      const chunks: Uint8Array[] = [];
      let totalLength = 0;
      const maxChunkSize = 48_000; // ~1 second of audio at 24kHz

      while (this.audioPlaybackQueue.length > 0 && totalLength < maxChunkSize) {
        const chunk = this.audioPlaybackQueue.shift();
        if (chunk) {
          chunks.push(chunk.data);
          totalLength += chunk.data.length;
        }
      }

      if (chunks.length === 0) {
        this.isPlayingAudio = false;
        return;
      }

      // Combine chunks
      const combinedData = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        combinedData.set(chunk, offset);
        offset += chunk.length;
      }

      // Convert PCM16 to WAV format
      const wavData = this.pcm16ToWav(combinedData, 24_000, 1); // 24kHz, mono

      // Create a temporary file URI
      const tempUri = `${FileSystem.cacheDirectory}zeina_audio_${Date.now()}_${Math.random().toString(36).substring(7)}.wav`;

      // Convert WAV data to base64 for writing
      const base64Wav = this.arrayBufferToBase64(wavData.buffer);

      // Set audio mode for playback (disable recording mode)
      if (Audio) {
        try {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
            staysActiveInBackground: true,
            playThroughEarpieceAndroid: false,
          });
        } catch {
          // Ignore audio mode errors
        }
      }

      // Write the base64 data - expo-file-system will handle the conversion
      // Note: We write as base64 string, but the file will be read as binary by Audio.Sound
      try {
        await FileSystem.writeAsStringAsync(tempUri, base64Wav, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } catch (error) {
        // Fallback: try writing as data URI if file write fails
        const dataUri = `data:audio/wav;base64,${base64Wav}`;
        const { sound } = await Audio.Sound.createAsync(
          { uri: dataUri },
          { shouldPlay: true, volume: 1.0 }
        );
        sound.setOnPlaybackStatusUpdate((status: any) => {
          if (status.didJustFinish) {
            sound.unloadAsync().catch(() => {});
            this.isPlayingAudio = false;
            this.processAudioQueue();
          }
        });
        this.currentSound = sound;
        return;
      }

      // Play the audio
      const { sound } = await Audio.Sound.createAsync(
        { uri: tempUri },
        { shouldPlay: true, volume: 1.0 }
      );

      // Clean up after playback and continue processing queue
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
          // Clean up temp file
          FileSystem.deleteAsync(tempUri, { idempotent: true }).catch(() => {});
          this.isPlayingAudio = false;
          // Process next chunk in queue
          this.processAudioQueue();
        }
      });

      // Store reference to stop if needed
      this.currentSound = sound;
    } catch (error) {
      this.isPlayingAudio = false;
      // Try to continue processing
      if (this.audioPlaybackQueue.length > 0) {
        setTimeout(() => this.processAudioQueue(), 100);
      }
    }
  }

  /**
   * Flush any remaining audio in the queue
   */
  private flushAudioQueue(): void {
    if (this.audioPlaybackQueue.length > 0 && !this.isPlayingAudio) {
      this.processAudioQueue();
    }
  }

  /**
   * Convert PCM16 data to WAV format
   */
  private pcm16ToWav(
    pcmData: Uint8Array,
    sampleRate: number,
    channels: number
  ): Uint8Array {
    const length = pcmData.length;
    const buffer = new ArrayBuffer(44 + length);
    const view = new DataView(buffer);

    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + length, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, 1, true); // audio format (1 = PCM)
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * channels * 2, true); // byte rate
    view.setUint16(32, channels * 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    writeString(36, "data");
    view.setUint32(40, length, true);

    // Copy PCM data
    const wavData = new Uint8Array(buffer);
    wavData.set(pcmData, 44);

    return wavData;
  }

  /**
   * Extract PCM data bytes from a WAV file, returning the "data" chunk.
   * Falls back to a 44-byte header skip if parsing fails.
   */
  private extractWavDataChunk(wavBytes: Uint8Array): Uint8Array {
    try {
      if (wavBytes.length < 44) return wavBytes;

      // WAV layout: RIFF(0..3) size(4..7) WAVE(8..11), then chunks.
      // Each chunk: 4-byte id, 4-byte little-endian size, then data.
      let offset = 12;
      while (offset + 8 <= wavBytes.length) {
        const id0 = wavBytes[offset];
        const id1 = wavBytes[offset + 1];
        const id2 = wavBytes[offset + 2];
        const id3 = wavBytes[offset + 3];
        const size =
          wavBytes[offset + 4] |
          (wavBytes[offset + 5] << 8) |
          (wavBytes[offset + 6] << 16) |
          (wavBytes[offset + 7] << 24);

        const dataStart = offset + 8;
        const dataEnd = dataStart + Math.max(0, size);

        // "data"
        if (id0 === 0x64 && id1 === 0x61 && id2 === 0x74 && id3 === 0x61) {
          if (dataStart <= wavBytes.length) {
            return wavBytes.slice(
              dataStart,
              Math.min(dataEnd, wavBytes.length)
            );
          }
          break;
        }

        // Chunks are word-aligned (pad to even)
        offset = dataEnd + (size % 2);
      }
    } catch {
      // ignore
    }

    // Typical PCM WAV header is 44 bytes; fallback to that if we can't parse.
    return wavBytes.length > 44 ? wavBytes.slice(44) : wavBytes;
  }

  /**
   * Convert ArrayBuffer to base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    return uint8ArrayToBase64(new Uint8Array(buffer));
  }

  /**
   * Stop current audio playback
   */
  async stopAudio(): Promise<void> {
    if (this.currentSound) {
      try {
        await this.currentSound.stopAsync();
        await this.currentSound.unloadAsync();
        this.currentSound = null;
      } catch (error) {}
    }
  }

  /**
   * Update connection state and notify handlers
   */
  private setConnectionState(state: ConnectionState) {
    this.connectionState = state;
    this.eventHandlers.onConnectionStateChange?.(state);
  }

  /**
   * Disconnect from the Realtime API
   */
  async disconnect() {
    // Stop any playing audio
    await this.stopAudio();

    if (this.ws) {
      // Safely close WebSocket if it has a close method
      if (typeof this.ws.close === "function") {
        try {
          // Some WebSocket implementations accept code and reason, others don't
          if (
            this.ws.readyState === WebSocket.OPEN ||
            this.ws.readyState === WebSocket.CONNECTING
          ) {
            this.ws.close(1000, "Client disconnect");
          }
        } catch (error) {
          // Ignore close errors - connection may already be closed
          if (__DEV__) {
            console.warn("[Zeina] Error closing WebSocket:", error);
          }
        }
      }
      this.ws = null;
    }
    this.setConnectionState("disconnected");
    this.audioBuffer = [];
    this.audioQueue = [];
    this.audioPlaybackQueue = [];
    this.isPlayingAudio = false;
    this.pendingToolCalls.clear();
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    if (!this.ws) {
      return false;
    }

    try {
      return (
        typeof this.ws.readyState !== "undefined" &&
        this.ws.readyState === WebSocket.OPEN
      );
    } catch (error) {
      // WebSocket might be in an invalid state
      return false;
    }
  }

  /**
   * Get health assistant tools for external use
   */
  getHealthAssistantTools(): RealtimeTool[] {
    return healthAssistantTools;
  }

  /**
   * Get default instructions
   */
  getDefaultInstructions(): string {
    return healthAssistantInstructions;
  }
}

export const realtimeAgentService = new RealtimeAgentService();
export default realtimeAgentService;
