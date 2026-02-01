import { Tabs } from "expo-router";
import { Activity, Home, Sparkles, User, Users } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

export default function TabLayout() {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  // User role logic
  const isAdmin = user?.role === "admin";

  // NativeWind semantic colors resolved from CSS variables
  // These match the values in global.css
  const tabBarColors = isDark
    ? {
        // Dark mode - matching global.css .dark values
        background: "#25211c", // surface-secondary dark
        border: "#3d3630", // border-default dark
        inactive: "#b8a99a", // on-surface-secondary dark
        active: "#3B82F6", // primary.light - better contrast on dark background
      }
    : {
        // Light mode - matching global.css :root values
        background: "#ffffff", // surface-secondary light
        border: "#e8e4dd", // border-default light
        inactive: "#6b5d47", // on-surface-secondary light
        active: "#1E3A8A", // primary.main - good contrast on light background
      };

  // Calculate tab bar height accounting for safe area insets on mobile
  const basePaddingBottom = Platform.OS === "web" ? 20 : 8;
  const paddingBottom =
    basePaddingBottom + (Platform.OS !== "web" ? insets.bottom : 0);
  const tabBarHeight = Platform.OS === "web" ? 80 : 60 + paddingBottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tabBarColors.active,
        tabBarInactiveTintColor: tabBarColors.inactive,
        tabBarStyle: {
          backgroundColor: tabBarColors.background,
          borderTopWidth: 1,
          borderTopColor: tabBarColors.border,
          height: tabBarHeight,
          paddingBottom,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontFamily: "Geist-Medium",
        },
      }}
    >
      {/* Home tab for all users */}
      <Tabs.Screen
        name="index"
        options={{
          title: t("home"),
          tabBarIcon: ({ size, color }: { size?: number; color: string }) => (
            <Home color={color} size={size || 24} />
          ),
        }}
      />

      {/* Track tab only for admin users */}
      <Tabs.Screen
        name="track"
        options={{
          title: t("track"),
          tabBarIcon: ({ size, color }: { size?: number; color: string }) => (
            <Activity color={color} size={size || 24} />
          ),
          href: isAdmin ? undefined : null, // Only show for admins
        }}
      />

      <Tabs.Screen
        name="zeina"
        options={{
          title: t("zeina"),
          tabBarIcon: ({ size, color }: { size?: number; color: string }) => (
            <Sparkles color={color} size={size || 24} />
          ),
        }}
      />
      <Tabs.Screen
        name="family"
        options={{
          title: t("family"),
          tabBarIcon: ({ size, color }: { size?: number; color: string }) => (
            <Users color={color} size={size || 24} />
          ),
          href: isAdmin ? undefined : null, // Only visible to admin users
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("profile"),
          tabBarIcon: ({ size, color }: { size?: number; color: string }) => (
            <User color={color} size={size || 24} />
          ),
        }}
      />
      <Tabs.Screen
        name="symptoms"
        options={{
          href: null, // Access via profile tab for regular users
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="moods"
        options={{
          href: null, // Access via profile tab for regular users
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="allergies"
        options={{
          href: null, // Access via profile tab for regular users
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="medications"
        options={{
          href: null, // Access via profile tab for regular users
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="resources"
        options={{
          href: null, // Access via profile tab
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="vitals"
        options={{
          href: null, // Access via profile tab for regular users
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          href: null, // Access via track tab for admins, profile for regular users
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="timeline"
        options={{
          href: null, // Access via profile tab for regular users
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="lab-results"
        options={{
          href: null, // Access via profile tab for regular users
          headerShown: false,
        }}
      />
    </Tabs>
  );
}
