// Note: expo-speech is available in Expo SDK
// For speech recognition (speech-to-text), we'll use OpenAI Whisper API
// In production, you might want to use:
// - @react-native-voice/voice for speech-to-text
// - Or integrate with cloud services like Google Cloud Speech-to-Text, Azure Speech, or OpenAI Whisper

// Since expo-speech might not be installed, we'll create a wrapper that handles both cases
let Speech: any = null;

try {
  // Try to import expo-speech if available
  Speech = require("expo-speech");
} catch (error) {
  // expo-speech not available, will use fallback
}

import { Platform } from "react-native";
import * as FileSystem from "expo-file-system";
import Constants from "expo-constants";
import * as Device from "expo-device";
import openaiService from "./openaiService";

// Dynamic import for expo-av with proper error handling
// Type declaration for Audio namespace
type RecordingInstance = {
  stopAndUnloadAsync: () => Promise<void>;
  getStatusAsync: () => Promise<any>;
  setOnRecordingStatusUpdate: (callback: (status: any) => void) => void;
  prepareToRecordAsync: (options?: any) => Promise<void>;
  startAsync: () => Promise<void>;
  getURI: () => string | null;
};

type AudioNamespace = {
  Recording: {
    createAsync: (options?: any) => Promise<{ recording: RecordingInstance }>;
  };
  requestPermissionsAsync: () => Promise<{ status: string }>;
  getPermissionsAsync: () => Promise<{ status: string }>;
  setAudioModeAsync: (options: any) => Promise<void>;
  INTERRUPTION_MODE_IOS_DO_NOT_MIX: number;
  INTERRUPTION_MODE_ANDROID_DO_NOT_MIX: number;
  RecordingOptionsPresets: {
    HIGH_QUALITY: any;
  };
  [key: string]: any;
};

let Audio: AudioNamespace | null = null;
try {
  // Only load expo-av on native platforms (iOS/Android)
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    // Use require instead of import to avoid TypeScript module resolution issues
    const expoAv = require("expo-av");
    Audio = expoAv.Audio;
  } else {
    // expo-av not available on web platform
  }
} catch (error) {
  // expo-av not available: ${error}
}

export interface VoiceConfig {
  language: string;
  pitch?: number;
  rate?: number;
  volume?: number;
  voiceId?: string;
}

type AvailableVoice = {
  identifier: string;
  name: string;
  language: string;
  quality?: string;
};

export interface SpeechRecognitionResult {
  text: string;
  confidence?: number;
}

class VoiceService {
  private isSpeaking = false;
  private currentSpeechId: string | null = null;
  private isListening = false;
  private recognitionCallbacks: Array<(result: SpeechRecognitionResult) => void> = [];
  private recognitionErrorCallbacks: Array<(error: Error) => void> = [];
  private recording: RecordingInstance | null = null;

  async getAvailableVoices(): Promise<AvailableVoice[]> {
    try {
      if (!Speech?.getAvailableVoicesAsync) return [];
      const voices = await Speech.getAvailableVoicesAsync();
      if (!Array.isArray(voices)) return [];
      return voices as AvailableVoice[];
    } catch {
      return [];
    }
  }

  async getPreferredVoiceId(language: string): Promise<string | undefined> {
    const voices = await this.getAvailableVoices();
    if (voices.length === 0) return undefined;

    const langPrefix = language.split("-")[0];
    const candidates = voices.filter((v) => v.language?.startsWith(language) || v.language?.startsWith(langPrefix));
    if (candidates.length === 0) return undefined;

    const femaleHints = ["female", "woman", "zira", "samantha", "victoria", "karen", "tessa", "ava", "siri"];

    const score = (v: AvailableVoice): number => {
      const name = (v.name || "").toLowerCase();
      const quality = (v.quality || "").toLowerCase();
      let s = 0;
      if (quality.includes("enhanced")) s += 20;
      if (quality.includes("premium")) s += 15;
      if (quality.includes("default")) s += 5;
      if (femaleHints.some((h) => name.includes(h))) s += 10;
      if (name.includes("male")) s -= 10;
      return s;
    };

    candidates.sort((a, b) => score(b) - score(a));
    return candidates[0]?.identifier;
  }

  /**
   * Speak text using text-to-speech
   */
  async speak(
    text: string,
    config: Partial<VoiceConfig> = {}
  ): Promise<void> {
    try {
      if (!Speech) {
        // Fallback: Show alert if speech is not available
        throw new Error("Text-to-speech not available. Please install expo-speech.");
      }

      // Stop any ongoing speech
      await this.stop();

      const defaultConfig: VoiceConfig = {
        language: config.language || "en-US",
        // Less robotic + more feminine by default
        pitch: config.pitch ?? 1.15,
        rate: config.rate ?? 1.0,
        volume: config.volume ?? 1.0,
        voiceId: config.voiceId,
      };

      const voiceId = defaultConfig.voiceId ?? (await this.getPreferredVoiceId(defaultConfig.language));

      return new Promise((resolve, reject) => {
        this.isSpeaking = true;
        this.currentSpeechId = Date.now().toString();

        Speech.speak(text, {
          language: defaultConfig.language,
          ...(voiceId ? { voice: voiceId } : {}),
          pitch: defaultConfig.pitch,
          rate: defaultConfig.rate,
          volume: defaultConfig.volume,
          onStart: () => {
            this.isSpeaking = true;
          },
          onDone: () => {
            this.isSpeaking = false;
            this.currentSpeechId = null;
            resolve();
          },
          onStopped: () => {
            this.isSpeaking = false;
            this.currentSpeechId = null;
            resolve();
          },
          onError: (error: any) => {
            this.isSpeaking = false;
            this.currentSpeechId = null;
            reject(error);
          },
        });
      });
    } catch (error) {
      throw new Error("Failed to speak text");
    }
  }

  /**
   * Stop current speech
   */
  async stop(): Promise<void> {
    try {
      if (this.isSpeaking && Speech) {
        Speech.stop();
        this.isSpeaking = false;
        this.currentSpeechId = null;
      }
    } catch (error) {
      // Silently handle error
    }
  }

  /**
   * Check if currently speaking
   */
  isCurrentlySpeaking(): boolean {
    return this.isSpeaking;
  }

  /**
   * Get available languages (simplified - would need actual TTS engine support)
   */
  getAvailableLanguages(): Array<{ code: string; name: string }> {
    return [
      { code: "en-US", name: "English (US)" },
      { code: "en-GB", name: "English (UK)" },
      { code: "ar-SA", name: "Arabic (Saudi Arabia)" },
      { code: "ar-EG", name: "Arabic (Egypt)" },
      { code: "fr-FR", name: "French" },
      { code: "es-ES", name: "Spanish" },
      { code: "de-DE", name: "German" },
      { code: "it-IT", name: "Italian" },
      { code: "pt-BR", name: "Portuguese (Brazil)" },
      { code: "ru-RU", name: "Russian" },
      { code: "ja-JP", name: "Japanese" },
      { code: "ko-KR", name: "Korean" },
      { code: "zh-CN", name: "Chinese (Simplified)" },
    ];
  }

  /**
   * Check if speech synthesis is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Speech is available on web and native platforms
      return Speech !== null && (Platform.OS === "ios" || Platform.OS === "android" || Platform.OS === "web");
    } catch (error) {
      return false;
    }
  }

  /**
   * Start listening for speech and convert to text using OpenAI Whisper API
   * Note: This requires audio recording capabilities
   */
  async startListening(
    onResult?: (result: SpeechRecognitionResult) => void,
    onError?: (error: Error) => void,
    language: string = "en-US"
  ): Promise<void> {
    if (this.isListening) {
      throw new Error("Already listening for speech");
    }

    this.isListening = true;

    if (onResult) {
      this.recognitionCallbacks.push(onResult);
    }
    if (onError) {
      this.recognitionErrorCallbacks.push(onError);
    }

    try {
      // Check if Audio is available
      if (!Audio) {
        throw new Error("Audio recording not available. Please ensure expo-av is properly installed.");
      }

      // Check if running on simulator (audio recording doesn't work on simulators)
      if (!Device.isDevice) {
        throw new Error("Audio recording is not available on Simulator. Please use a physical device for voice features.");
      }

      // Request audio permissions
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        throw new Error("Microphone permission denied");
      }

      // Set audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
        playThroughEarpieceAndroid: false,
      });

      // Create and start recording
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      this.recording = recording;

      // Wait for a moment to capture some audio (you might want to make this configurable)
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Stop recording
      await recording.stopAndUnloadAsync();
      this.recording = null;

      // Get the recorded URI
      const uri = recording.getURI();
      if (!uri) {
        throw new Error("Failed to record audio");
      }

      // Transcribe the audio
      const result = await this.transcribeAudio(uri, language.split('-')[0]);

      // Call success callbacks
      this.recognitionCallbacks.forEach(callback => callback(result));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorObj = new Error(errorMessage);

      // Call error callbacks
      this.recognitionErrorCallbacks.forEach(callback => callback(errorObj));
    } finally {
      this.isListening = false;
      this.recognitionCallbacks = [];
      this.recognitionErrorCallbacks = [];
    }
  }

  /**
   * Stop listening for speech
   */
  async stopListening(): Promise<void> {
    try {
      if (this.recording) {
        await this.recording.stopAndUnloadAsync();
        this.recording = null;
      }
    } catch (error) {
      // Silently handle cleanup errors
    } finally {
      this.isListening = false;
      this.recognitionCallbacks = [];
      this.recognitionErrorCallbacks = [];
    }
  }

  /**
   * Transcribe audio file using OpenAI Whisper API
   */
  async transcribeAudio(audioUri: string, language?: string): Promise<SpeechRecognitionResult> {
    try {
      // Get OpenAI API key (try premium key first for Zeina)
      let apiKey = await openaiService.getApiKey(true);
      if (!apiKey) {
        apiKey = await openaiService.getApiKey(false);
      }
      if (!apiKey) {
        throw new Error("OpenAI API key not configured");
      }

      // Read audio file as base64
      const audioBase64 = await FileSystem.readAsStringAsync(audioUri, {
        encoding: 'base64',
      });

      // Determine audio format based on file extension or default to m4a (expo-av default)
      const fileExtension = audioUri.split('.').pop()?.toLowerCase() || 'm4a';
      const mimeType = fileExtension === 'mp3' ? 'audio/mp3' :
                      fileExtension === 'wav' ? 'audio/wav' :
                      'audio/m4a'; // Default for expo-av recordings

      // Convert base64 to blob format for API
      const audioBlob = await fetch(`data:${mimeType};base64,${audioBase64}`).then((r) => r.blob());

      // Create form data
      const formData = new FormData();
      formData.append("file", audioBlob as any, `audio.${fileExtension}`);
      formData.append("model", "whisper-1");
      if (language) {
        formData.append("language", language);
      }

      // Call OpenAI Whisper API
      const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData as any,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message || `Whisper API error: ${response.statusText}`
        );
      }

      const result = await response.json();
      return {
        text: result.text?.trim() || "",
        confidence: 1.0, // Whisper doesn't return confidence scores
      };
    } catch (error) {
      throw new Error(
        `Failed to transcribe audio: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Request microphone permissions
   */
  async requestMicrophonePermissions(): Promise<boolean> {
    try {
      if (!Audio) return false;
      const permission = await Audio.requestPermissionsAsync();
      return permission.status === 'granted';
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if microphone permissions are granted
   */
  async hasMicrophonePermissions(): Promise<boolean> {
    try {
      if (!Audio) return false;
      const permission = await Audio.getPermissionsAsync();
      return permission.status === 'granted';
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if speech recognition is available
   */
  async isRecognitionAvailable(): Promise<boolean> {
    try {
      // Speech recognition requires native platforms (expo-av)
      if (Platform.OS === 'web') {
        return false;
      }

      // Audio recording doesn't work on simulators
      if (!Device.isDevice) {
        return false;
      }

      const hasPermissions = await this.hasMicrophonePermissions();
      const hasApiKey = await openaiService.getApiKey(true) || await openaiService.getApiKey(false);
      return hasPermissions && hasApiKey !== null && hasApiKey !== undefined && Audio !== null;
    } catch {
      return false;
    }
  }

  /**
   * Get current listening status
   */
  isCurrentlyListening(): boolean {
    return this.isListening;
  }
}

export const voiceService = new VoiceService();
