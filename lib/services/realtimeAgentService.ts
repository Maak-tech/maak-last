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

// Types for the Realtime API
export interface RealtimeMessage {
  type: string;
  [key: string]: any;
}

export interface RealtimeSessionConfig {
  modalities: ("text" | "audio")[];
  instructions: string;
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
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

// Health Assistant Tool Definitions
const healthAssistantTools: RealtimeTool[] = [
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
    name: "log_symptom",
    description: "Log a symptom the user is experiencing",
    parameters: {
      type: "object",
      properties: {
        symptom_name: {
          type: "string",
          description: "The name of the symptom",
        },
        severity: {
          type: "number",
          description: "Severity on a scale of 1-10",
        },
        notes: {
          type: "string",
          description: "Additional notes about the symptom",
        },
      },
      required: ["symptom_name"],
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
          enum: ["blood_pressure", "heart_rate", "temperature", "oxygen_saturation", "weight", "all"],
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
    name: "schedule_reminder",
    description: "Schedule a medication or health-related reminder",
    parameters: {
      type: "object",
      properties: {
        reminder_type: {
          type: "string",
          enum: ["medication", "appointment", "vital_check", "exercise", "custom"],
        },
        title: {
          type: "string",
          description: "Title of the reminder",
        },
        time: {
          type: "string",
          description: "Time for the reminder in ISO 8601 format",
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
];

// Default instructions for the health assistant
const healthAssistantInstructions = `
# Personality and Tone

## Identity
You are Zeina, a warm, knowledgeable, and compassionate health assistant specializing in elderly care and chronic health management. You have years of experience helping patients understand their health conditions, medications, and daily wellness routines. You speak with the wisdom of a trusted family nurse while maintaining professional medical knowledge.

## Task
Help users manage their health by answering questions about their medications, symptoms, vital signs, and overall wellness. You have access to their health data through specialized tools and can provide personalized guidance.

## Demeanor
Patient, reassuring, and caring. You understand that health concerns can be worrying, especially for elderly users or those managing chronic conditions.

## Tone
Warm and conversational, like talking to a trusted healthcare friend. Professional but never cold or clinical.

## Level of Enthusiasm
Calm and measured, with genuine warmth. You celebrate small health wins without being overly excitable.

## Level of Formality
Moderately casual - you're professional but approachable. Use simple language and avoid medical jargon when possible. When you must use medical terms, explain them clearly.

## Level of Emotion
Empathetic and supportive. You acknowledge feelings and concerns with compassion.

## Filler Words
Occasionally use gentle affirmations like "I see," "I understand," "Of course"

## Pacing
Steady and clear. Give users time to process information. Don't rush through important health information.

## Language Support
You can communicate fluently in both English and Arabic. Respond in the same language the user speaks to you.

# Instructions
- Always prioritize user safety. If someone describes serious symptoms, recommend seeking professional medical care.
- Use the available health tools to access the user's specific health data before giving personalized advice.
- When discussing medications, always mention the importance of following their doctor's prescribed regimen.
- Be proactive about checking for medication interactions when discussing medications.
- If you detect signs of distress or emergency, calmly offer to help contact family or provide emergency information.
- Keep responses concise for voice - people can't read long text responses when listening.
- If a user provides a name, medication, or something you need to spell correctly, always repeat it back to confirm.
- If the caller corrects any detail, acknowledge the correction and confirm the new information.
- Never provide specific medical diagnoses. Suggest consulting with healthcare providers for medical decisions.
- Celebrate health wins! If vitals are improving or medication adherence is good, acknowledge it warmly.
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
        console.warn("Zeina API key not configured. Please set OPENAI_API_KEY in your .env file.");
      }
    } catch (error) {
      console.error("Failed to load API key:", error);
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
      console.log("Already connected to Realtime API");
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

        this.ws = new WebSocket(wsUrl, {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "OpenAI-Beta": "realtime=v1",
          },
        } as any);

        this.ws.onopen = () => {
          console.log("Connected to OpenAI Realtime API");
          this.setConnectionState("connected");
          this.reconnectAttempts = 0;

          // Configure the session
          this.configureSession(customInstructions);
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          console.error("WebSocket error:", error);
          this.eventHandlers.onError?.(error);
          this.setConnectionState("error");
          reject(error);
        };

        this.ws.onclose = (event) => {
          console.log("WebSocket closed:", event.code, event.reason);
          this.setConnectionState("disconnected");

          // Attempt reconnection if it wasn't intentional
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => this.connect(customInstructions), 2000 * this.reconnectAttempts);
          }
        };

        // Timeout for connection
        setTimeout(() => {
          if (this.connectionState === "connecting") {
            this.ws?.close();
            reject(new Error("Connection timeout"));
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
      voice: "nova", // Warm, professional female voice
      input_audio_format: "pcm16",
      output_audio_format: "pcm16",
      input_audio_transcription: {
        model: "whisper-1",
      },
      turn_detection: {
        type: "server_vad",
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 500,
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
      console.error("WebSocket not connected");
      return;
    }

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Send audio data to the API
   */
  sendAudioData(audioBase64: string) {
    this.sendMessage({
      type: "input_audio_buffer.append",
      audio: audioBase64,
    });
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
          break;

        case "response.audio.done":
          this.eventHandlers.onAudioDone?.();
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
          console.error("Realtime API error:", message.error);
          this.eventHandlers.onError?.(message.error);
          break;

        default:
          // Log unhandled message types for debugging
          if (__DEV__) {
            console.log("Unhandled message type:", message.type);
          }
      }
    } catch (error) {
      console.error("Failed to parse message:", error);
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
   * Update connection state and notify handlers
   */
  private setConnectionState(state: ConnectionState) {
    this.connectionState = state;
    this.eventHandlers.onConnectionStateChange?.(state);
  }

  /**
   * Disconnect from the Realtime API
   */
  disconnect() {
    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }
    this.setConnectionState("disconnected");
    this.audioBuffer = [];
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
