import AsyncStorage from "@react-native-async-storage/async-storage";
import type React from "react";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { useColorScheme } from "react-native";
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
  const systemColorScheme = useColorScheme();
  // Initialize with "light" as default to prevent dark mode flash
  // Will be updated from AsyncStorage once loaded
  const [themeMode, setThemeModeState] = useState<ThemeMode>("light");
  const [isLoaded, setIsLoaded] = useState(false);

  // Determine if dark mode should be active
  const isDark =
    themeMode === "dark" ||
    (themeMode === "system" && systemColorScheme === "dark");

  // Get current theme
  const theme = isDark ? Theme.dark : Theme.light;

  // Load saved theme preference on mount
  useEffect(() => {
    const loadThemeMode = async () => {
      try {
        const savedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedMode && ["light", "dark", "system"].includes(savedMode)) {
          setThemeModeState(savedMode as ThemeMode);
        } else {
          // If no saved preference, default to "light" (not "system")
          // This ensures users who turn off dark mode stay in light mode
          setThemeModeState("light");
          await AsyncStorage.setItem(THEME_STORAGE_KEY, "light");
        }
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
  const setThemeMode = async (mode: ThemeMode) => {
    try {
      setThemeModeState(mode);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (_error) {
      // Silently handle error
    }
  };

  // Toggle between light and dark (ignoring system)
  const toggleTheme = () => {
    const newMode = isDark ? "light" : "dark";
    setThemeMode(newMode);
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
