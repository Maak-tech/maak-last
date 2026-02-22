/* biome-ignore-all lint/style/noExportedImports: i18n instance is configured in-module before export. */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { I18nManager, Platform } from "react-native";
import enTranslations from "@/locales/en.json";
import arTranslations from "@/locales/ar.json";

const resources = {
  en: { translation: enTranslations },
  ar: { translation: arTranslations },
};

// Helper function to set RTL layout direction
const setRTL = (isRTL: boolean) => {
  // Avoid runtime layout-direction mutations on iOS because they can destabilize
  // UIKit trait propagation in production/TestFlight builds.
  if (Platform.OS !== "android") {
    return;
  }

  try {
    // Android supports runtime RTL mutation.
    I18nManager.allowRTL(true);
    if (I18nManager.isRTL !== isRTL) {
      I18nManager.forceRTL(isRTL);
    }
  } catch {
    // Silently handle environments where RTL toggling isn't supported
  }
};

// Initialize i18n with proper configuration for react-i18next
const initI18n = async () => {
  // Get initial language from storage or default to English
  let initialLang = "en";
  try {
    const AsyncStorage = await import(
      "@react-native-async-storage/async-storage"
    );
    const savedLanguage = await AsyncStorage.default.getItem("app_language");
    if (savedLanguage) {
      initialLang = savedLanguage;
    }
  } catch {
    // Use default
  }

  const isRTL = initialLang === "ar";
  setRTL(isRTL);

  return i18n
    .use(initReactI18next) // Pass the i18n instance to react-i18next
    .init({
      compatibilityJSON: "v3", // Fix Intl.PluralRules compatibility
      resources,
      lng: initialLang,
      fallbackLng: "en",

      interpolation: {
        escapeValue: false, // React already does escaping
      },

      // React Native specific options
      react: {
        useSuspense: false, // Disable suspense for React Native
      },

      // Cache configuration for React Native
      cache: {
        enabled: false, // Disable caching for now to avoid issues
      },
    });
};

// Initialize i18n
initI18n()
  .then(() => {
    // Override changeLanguage to also update RTL direction after initialization
    if (i18n.changeLanguage) {
      const originalChangeLanguage = i18n.changeLanguage.bind(i18n);
      i18n.changeLanguage = async (lng?: string) => {
        const newLang = lng || i18n.language;
        const isRTL = newLang === "ar";
        setRTL(isRTL);

        // Save language preference
        try {
          const AsyncStorage = await import(
            "@react-native-async-storage/async-storage"
          );
          await AsyncStorage.default.setItem("app_language", newLang);
        } catch {
          // Silently handle error
        }

        return originalChangeLanguage(lng);
      };
    }
  })
  .catch(() => {
    // Silently handle error
  });

export default i18n;
