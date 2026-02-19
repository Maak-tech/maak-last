import AsyncStorage from "@react-native-async-storage/async-storage";
import type React from "react";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Theme } from "@/constants/theme";
import i18n from "@/lib/i18n";

type ThemeMode = "light" | "dark" | "system";

type ThemeType = typeof Theme.light | typeof Theme.dark;

type ThemeContextType = {
  theme: ThemeType;
  themeMode: ThemeMode;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

type ThemeProviderProps = {
  children: ReactNode;
};

const THEME_STORAGE_KEY = "@maak_theme_mode";

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // Dark mode is disabled. Keep light mode only.
  const [themeMode, setThemeModeState] = useState<ThemeMode>("light");
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language || "en");

  const isDark = false;

  // Listen for language changes
  useEffect(() => {
    const updateLanguage = () => {
      setCurrentLanguage(i18n.language || "en");
    };
    updateLanguage();
    i18n.on("languageChanged", updateLanguage);
    return () => {
      i18n.off("languageChanged", updateLanguage);
    };
  }, []);

  // Use Arabic fonts when language is Arabic so Arabic text renders correctly (not as ?)
  const theme = useMemo(() => {
    const base = Theme.light;
    if (currentLanguage !== "ar") {
      return base;
    }
    return {
      ...base,
      typography: {
        ...base.typography,
        fontFamily: {
          ...base.typography.fontFamily,
          regular: base.typography.fontFamily.arabic,
          medium: base.typography.fontFamily.arabic,
          semiBold: "NotoSansArabic-SemiBold",
          bold: base.typography.fontFamily.arabicBold,
        },
      },
    };
  }, [currentLanguage]);

  // Load saved theme preference on mount
  useEffect(() => {
    const loadThemeMode = async () => {
      try {
        setThemeModeState("light");
        await AsyncStorage.setItem(THEME_STORAGE_KEY, "light");
      } catch (_error) {
        // Silently handle error, but ensure we have a valid state
        setThemeModeState("light");
      } finally {
        setIsLoaded(true);
      }
    };

    loadThemeMode();
  }, []);

  // Save theme preference
  const setThemeMode = async (_mode: ThemeMode) => {
    try {
      setThemeModeState("light");
      await AsyncStorage.setItem(THEME_STORAGE_KEY, "light");
    } catch (_error) {
      // Silently handle error
    }
  };

  // Toggle between light and dark (ignoring system)
  const toggleTheme = () => {
    setThemeMode("light");
  };

  // Don't render until theme is loaded
  if (!isLoaded) {
    return null;
  }

  const value: ThemeContextType = {
    theme,
    themeMode,
    isDark,
    setThemeMode,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export default ThemeProvider;
