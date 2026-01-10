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
  console.log("expo-speech not available, voice features will be limited");
}

import { Platform } from "react-native";
import * as FileSystem from "expo-file-system";
import Constants from "expo-constants";
import openaiService from "./openaiService";

export interface VoiceConfig {
  language: string;
  pitch?: number;
  rate?: number;
  volume?: number;
}

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
        pitch: config.pitch ?? 1.0,
        rate: config.rate ?? 0.9,
        volume: config.volume ?? 1.0,
      };

      return new Promise((resolve, reject) => {
        this.isSpeaking = true;
        this.currentSpeechId = Date.now().toString();

        Speech.speak(text, {
          language: defaultConfig.language,
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
      // Check if Speech module is loaded
      return Speech !== null && (Platform.OS === "ios" || Platform.OS === "android");
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
    onError?: (error: Error) => void
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

    // Note: For full implementation, you would:
    // 1. Use expo-av or react-native-audio-recorder to record audio
    // 2. Convert audio to a format compatible with Whisper API (mp3, wav, etc.)
    // 3. Send audio file to OpenAI Whisper API
    // 4. Return transcribed text
    
    // For now, we'll provide a basic implementation that can be extended
    // with actual audio recording
    throw new Error(
      "Speech recognition requires audio recording. " +
      "Please install expo-av or react-native-audio-recorder and configure audio permissions."
    );
  }

  /**
   * Stop listening for speech
   */
  async stopListening(): Promise<void> {
    this.isListening = false;
    this.recognitionCallbacks = [];
    this.recognitionErrorCallbacks = [];
  }

  /**
   * Transcribe audio file using OpenAI Whisper API
   */
  async transcribeAudio(audioUri: string, language?: string): Promise<SpeechRecognitionResult> {
    try {
      // Get OpenAI API key
      const apiKey = await openaiService.getApiKey();
      if (!apiKey) {
        throw new Error("OpenAI API key not configured");
      }

      // Read audio file as base64
      const audioBase64 = await FileSystem.readAsStringAsync(audioUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Convert base64 to blob format for API
      const audioBlob = await fetch(`data:audio/mp3;base64,${audioBase64}`).then((r) => r.blob());

      // Create form data
      const formData = new FormData();
      formData.append("file", audioBlob as any, "audio.mp3");
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
        text: result.text || "",
        confidence: 1.0, // Whisper doesn't return confidence scores
      };
    } catch (error) {
      throw new Error(
        `Failed to transcribe audio: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Check if speech recognition is available
   */
  async isRecognitionAvailable(): Promise<boolean> {
    try {
      const apiKey = await openaiService.getApiKey();
      return apiKey !== null;
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
