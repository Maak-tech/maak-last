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

import { Platform } from "react-native";
import Constants from "expo-constants";
import { createWebSocketWithHeaders, getWebSocketSetupGuidance } from "@/lib/polyfills/websocketWithHeaders";

// Dynamic import for expo-av and expo-file-system
let Audio: any = null;
let FileSystem: any = null;

try {
  if (Platform.OS === "ios" || Platform.OS === "android") {
    const expoAv = require("expo-av");
    Audio = expoAv.Audio;
    FileSystem = require("expo-file-system");
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
  voice: "alloy" | "ash" | "ballad" | "coral" | "echo" | "sage" | "shimmer" | "verse";
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
  tool_choice: "auto" | "none" | "required" | { type: "function"; name: string };
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
  onToolCall?: (toolCall: { name: string; arguments: string; call_id: string }) => void;
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

export type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

// Health Assistant Tool Definitions - Expanded for Siri-like automation
const healthAssistantTools: RealtimeTool[] = [
  // ===== INFORMATION RETRIEVAL TOOLS =====
  {
    type: "function",
    name: "get_health_summary",
    description: "Get a summary of the user's current health status including recent vitals, medications, and symptoms",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    type: "function",
    name: "get_medications",
    description: "Get the user's current medications list with dosages and schedules",
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
    description: "Get recent vital sign measurements like blood pressure, heart rate, temperature",
    parameters: {
      type: "object",
      properties: {
        vital_type: {
          type: "string",
          enum: ["blood_pressure", "heart_rate", "temperature", "oxygen_saturation", "weight", "blood_glucose", "all"],
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
    description: "Check for potential interactions between the user's medications",
    parameters: {
      type: "object",
      properties: {
        new_medication: {
          type: "string",
          description: "Optional: A new medication to check against existing medications",
        },
      },
    },
  },
  {
    type: "function",
    name: "emergency_contact",
    description: "Get emergency contact information or trigger emergency protocols. Only use when explicitly requested by user or in genuine emergency situations.",
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
    description: "Log a symptom the user is experiencing. Use this when the user mentions they have a symptom like headache, fever, nausea, pain, etc. This will automatically save to their symptoms tab.",
    parameters: {
      type: "object",
      properties: {
        symptom_name: {
          type: "string",
          description: "The name/type of the symptom (e.g., headache, fever, nausea, stomach pain, dizziness, fatigue, cough, etc.)",
        },
        severity: {
          type: "number",
          description: "Severity on a scale of 1-10 (1=very mild, 5=moderate, 10=severe). Infer from context if not specified.",
        },
        notes: {
          type: "string",
          description: "Additional details about the symptom",
        },
        body_part: {
          type: "string",
          description: "Body part affected (e.g., head, chest, stomach, back, etc.)",
        },
        duration: {
          type: "string",
          description: "How long the symptom has been present (e.g., '2 hours', 'since yesterday', 'all day')",
        },
      },
      required: ["symptom_name"],
    },
  },
  {
    type: "function",
    name: "add_medication",
    description: "Add a new medication to the user's medication list. Use when user mentions they started taking a new medication.",
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
          description: "How often to take it (e.g., 'once daily', 'twice a day', 'every 8 hours', 'as needed')",
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
    description: "Log a vital sign measurement that the user reports. Use when user tells you their blood pressure, heart rate, temperature, blood sugar, weight, etc.",
    parameters: {
      type: "object",
      properties: {
        vital_type: {
          type: "string",
          enum: ["heartRate", "bloodPressure", "bodyTemperature", "bloodGlucose", "weight", "oxygenSaturation"],
          description: "Type of vital sign being recorded",
        },
        value: {
          type: "number",
          description: "The numeric value of the measurement",
        },
        unit: {
          type: "string",
          description: "Unit of measurement (e.g., 'bpm', 'mmHg', '°F', 'mg/dL', 'lbs', '%')",
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
    description: "Set a reminder for a medication. Use when user asks to be reminded about a medication at a specific time.",
    parameters: {
      type: "object",
      properties: {
        medication_name: {
          type: "string",
          description: "Name of the medication to set reminder for",
        },
        time: {
          type: "string",
          description: "Time for the reminder (e.g., '8:00 AM', '14:00', '9pm')",
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
    description: "Send an alert or notification to family members. Use when user explicitly asks to notify or alert their family about something.",
    parameters: {
      type: "object",
      properties: {
        alert_type: {
          type: "string",
          enum: ["check_in", "symptom_alert", "medication_reminder", "emergency"],
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
    description: "Schedule a general health-related reminder (not medication-specific)",
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
    description: "Request a wellness check-in from the user, or acknowledge their current state",
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
    description: "Log the user's current mood/emotional state. Use when user expresses how they're feeling emotionally (happy, sad, anxious, stressed, tired, etc.)",
    parameters: {
      type: "object",
      properties: {
        mood_type: {
          type: "string",
          description: "The mood/emotion (e.g., 'happy', 'sad', 'anxious', 'stressed', 'tired', 'calm', 'frustrated', 'grateful')",
        },
        intensity: {
          type: "number",
          description: "Intensity of the mood on a scale of 1-10 (1=barely noticeable, 10=overwhelming)",
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
    description: "Mark a medication as taken. Use when user says they took their medication or confirms taking a pill.",
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
    description: "Help user navigate to a section of the app. Use when user asks to see or go to a specific section.",
    parameters: {
      type: "object",
      properties: {
        target: {
          type: "string",
          enum: ["medications", "symptoms", "family", "profile", "dashboard", "calendar", "vitals", "allergies", "history"],
          description: "The app section to navigate to",
        },
      },
      required: ["target"],
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
2. Always prioritize user safety. If someone describes serious symptoms, recommend seeking professional medical care.
3. Use the available health tools to access the user's specific health data before giving personalized advice.
4. When discussing medications, always mention the importance of following their doctor's prescribed regimen.
5. Be proactive about checking for medication interactions when discussing medications.
6. If you detect signs of distress or emergency, calmly offer to help contact family or provide emergency information.
7. Keep responses concise for voice - people can't read long text responses when listening.
8. If a user provides a name, medication, or something you need to spell correctly, always repeat it back to confirm.
9. If the caller corrects any detail, acknowledge the correction and confirm the new information.
10. Never provide specific medical diagnoses. Suggest consulting with healthcare providers for medical decisions.
11. Celebrate health wins! If vitals are improving or medication adherence is good, acknowledge it warmly.
12. After completing an action, provide helpful follow-up questions or suggestions related to the logged information.
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
  private audioPlaybackQueue: Array<{ data: Uint8Array; timestamp: number }> = [];
  private isPlayingAudio = false;

  constructor() {
    this.loadApiKey();
  }

  private async loadApiKey() {
    try {
      const config = Constants.expoConfig?.extra;
      
      // Use zeinaApiKey first (for Zeina voice agent), then fall back to openaiApiKey
      const key = config?.zeinaApiKey || config?.openaiApiKey || null;
      
      // Validate the key is not empty
      if (key && typeof key === 'string' && key.trim() !== '') {
        this.apiKey = key.trim();
      } else {
        this.apiKey = null;
      }
    } catch (error) {
      this.apiKey = null;
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
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    if (!this.apiKey) {
      await this.loadApiKey();
      if (!this.apiKey) {
        throw new Error("Zeina API key not configured. Please set OPENAI_API_KEY in your .env file.");
      }
    }

    this.setConnectionState("connecting");

    return new Promise((resolve, reject) => {
      try {
        // Connect to OpenAI Realtime API via WebSocket
        const wsUrl = `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`;

        // Create WebSocket with authentication headers
        const ws = createWebSocketWithHeaders(wsUrl, undefined, {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "OpenAI-Beta": "realtime=v1",
          },
        });

        this.ws = ws;

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
          const errorMessage = error?.message || error?.toString() || "Unknown WebSocket error";
          const setupGuidance = getWebSocketSetupGuidance();
          const detailedError = new Error(
            `WebSocket connection failed: ${errorMessage}.\n\n` +
            `Common causes:\n` +
            `1. Missing or invalid OpenAI API key\n` +
            `2. Network connectivity issues\n` +
            `3. WebSocket headers not supported on this platform\n\n` +
            `${setupGuidance}\n\n` +
            `Please ensure OPENAI_API_KEY is set in your .env file.`
          );
          
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

          // Provide helpful error messages based on close code
          if (event.code === 1006) {
            // Abnormal closure - often means connection failed
            const error = new Error(
              "WebSocket connection closed abnormally. This usually means: " +
              "1) Invalid API key or missing authentication, " +
              "2) Network connectivity issues, or " +
              "3) OpenAI API service unavailable. " +
              `Close code: ${event.code}, Reason: ${event.reason || "No reason provided"}`
            );
            this.eventHandlers.onError?.(error);
          } else if (event.code === 1002) {
            // Protocol error
            const error = new Error(
              "WebSocket protocol error. This may indicate that WebSocket headers are not supported on this platform. " +
              "Consider using a WebSocket library that supports custom headers for React Native."
            );
            this.eventHandlers.onError?.(error);
          }

          // Attempt reconnection if it wasn't intentional
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => this.connect(customInstructions), 2000 * this.reconnectAttempts);
          } else if (!hasResolved && event.code !== 1000) {
            hasResolved = true;
            reject(new Error(`WebSocket closed with code ${event.code}: ${event.reason || "Connection failed"}`));
          }
        };

        // Timeout for connection
        connectionTimeout = setTimeout(() => {
          if (this.connectionState === "connecting" && !hasResolved) {
            hasResolved = true;
            ws?.close();
            reject(new Error("Connection timeout after 10 seconds. Please check your network connection and API key."));
          }
        }, 10000);
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
    if (this.ws?.readyState !== WebSocket.OPEN) {
      return;
    }

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Send audio data to the API
   * Accepts base64 encoded WAV or raw PCM16 data
   */
  sendAudioData(audioBase64: string) {
    try {
      // Decode base64 to check if it's WAV format
      const binaryString = atob(audioBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Check for WAV header (RIFF)
      const isWav = bytes[0] === 0x52 && bytes[1] === 0x49 && 
                    bytes[2] === 0x46 && bytes[3] === 0x46;
      
      let pcmData: string;
      if (isWav) {
        // Extract PCM data from WAV (skip 44-byte header)
        const pcmBytes = bytes.slice(44);
        pcmData = this.arrayBufferToBase64(pcmBytes.buffer.slice(pcmBytes.byteOffset, pcmBytes.byteOffset + pcmBytes.length));
      } else {
        // Assume it's already raw PCM or other format
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
    this.sendMessage({
      type: "input_audio_buffer.commit",
    });
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
            text: text,
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
        output: output,
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
          this.eventHandlers.onTranscriptDone?.(this.currentTranscript.assistant, "assistant");
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
    } catch (error) {
    }
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
    if (!Audio || !FileSystem || Platform.OS === "web") {
      // On web, we'd need Web Audio API - for now, just queue it
      this.audioQueue.push(base64Audio);
      return;
    }

    try {
      // Decode base64 to binary
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Queue the audio data
      this.audioPlaybackQueue.push({
        data: bytes,
        timestamp: Date.now(),
      });

      // Start playing if not already playing
      if (!this.isPlayingAudio) {
        this.processAudioQueue();
      }
    } catch (error) {
    }
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
      const maxChunkSize = 48000; // ~1 second of audio at 24kHz

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
      const wavData = this.pcm16ToWav(combinedData, 24000, 1); // 24kHz, mono

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
  private pcm16ToWav(pcmData: Uint8Array, sampleRate: number, channels: number): Uint8Array {
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
   * Convert ArrayBuffer to base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
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
      } catch (error) {
      }
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
      this.ws.close(1000, "Client disconnect");
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
    return this.ws?.readyState === WebSocket.OPEN;
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
