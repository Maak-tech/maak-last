import AsyncStorage from "@react-native-async-storage/async-storage";
import type React from "react";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { Theme } from "@/constants/theme";

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

  const isDark = false;
  const theme = Theme.light;

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
