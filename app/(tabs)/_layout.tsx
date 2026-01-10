import { Tabs } from "expo-router";
import { Activity, Home, Sparkles, User, Users } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/ThemeContext";

export default function TabLayout() {
  const { t } = useTranslation();
  const { theme } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary.main,
        tabBarInactiveTintColor: theme.colors.text.secondary,
        tabBarStyle: {
          backgroundColor: theme.colors.background.secondary,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border.light,
          height: 80,
          paddingBottom: 20,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontFamily: "Geist-Medium",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("home"),
          tabBarIcon: ({ size, color }: { size?: number; color: string }) => (
            <Home color={color} size={size || 24} />
          ),
        }}
      />
      <Tabs.Screen
        name="track"
        options={{
          title: t("track"),
          tabBarIcon: ({ size, color }: { size?: number; color: string }) => (
            <Activity color={color} size={size || 24} />
          ),
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
          href: null, // Access via track tab
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="moods"
        options={{
          href: null, // Access via track tab
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="allergies"
        options={{
          href: null, // Access via track tab
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="medications"
        options={{
          href: null, // Access via symptoms/track tab
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
          href: null, // Access via track tab
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          href: null, // Access via track tab or dashboard
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="timeline"
        options={{
          href: null, // Access via track tab or dashboard
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="lab-results"
        options={{
          href: null, // Access via track tab or profile
          headerShown: false,
        }}
      />
    </Tabs>
  );
}
