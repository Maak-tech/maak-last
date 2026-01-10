// Note: expo-speech is available in Expo SDK
// For speech recognition (speech-to-text), we'll use a placeholder approach
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

export interface VoiceConfig {
  language: string;
  pitch?: number;
  rate?: number;
  volume?: number;
}

class VoiceService {
  private isSpeaking = false;
  private currentSpeechId: string | null = null;

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
   * Simple speech-to-text placeholder
   * In production, integrate with actual speech recognition service
   */
  async startListening(): Promise<void> {
    // Placeholder - would integrate with actual speech recognition
    throw new Error("Speech recognition not yet implemented. Please use text input.");
  }

  /**
   * Stop listening for speech
   */
  async stopListening(): Promise<void> {
    // Placeholder
  }
}

export const voiceService = new VoiceService();
