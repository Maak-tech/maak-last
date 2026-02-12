import { Platform } from "react-native";

type ExpoClipboardModule = {
  setStringAsync?: (text: string) => Promise<boolean>;
};

type ReactNativeClipboardModule = {
  setString?: (text: string) => void;
};

const getExpoClipboard = (): ExpoClipboardModule | null => {
  try {
    const moduleRef = require("expo-clipboard") as ExpoClipboardModule;
    return moduleRef;
  } catch {
    return null;
  }
};

const getLegacyClipboard = (): ReactNativeClipboardModule | null => {
  try {
    const rn = require("react-native") as {
      Clipboard?: ReactNativeClipboardModule;
    };
    return rn.Clipboard ?? null;
  } catch {
    return null;
  }
};

export const setClipboardString = async (text: string): Promise<boolean> => {
  const expoClipboard = getExpoClipboard();
  if (expoClipboard?.setStringAsync) {
    try {
      return await expoClipboard.setStringAsync(text);
    } catch {
      // Fallback below.
    }
  }

  // Legacy RN clipboard is still present in many runtimes.
  const legacyClipboard = getLegacyClipboard();
  if (legacyClipboard?.setString) {
    legacyClipboard.setString(text);
    return true;
  }

  // Web fallback.
  if (Platform.OS === "web" && typeof navigator !== "undefined") {
    const nav = navigator as Navigator & {
      clipboard?: { writeText?: (value: string) => Promise<void> };
    };

    if (nav.clipboard?.writeText) {
      try {
        await nav.clipboard.writeText(text);
        return true;
      } catch {
        return false;
      }
    }
  }

  return false;
};
