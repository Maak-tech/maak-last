import { Tabs } from "expo-router";
import { Activity, Home, Sparkles, User, Users } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";

export default function TabLayout() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { user } = useAuth();

  // User role logic
  const isAdmin = user?.role === "admin";
  const isRegularUser = !isAdmin;

  // Debug logging
  console.log('User role:', user?.role, 'isAdmin:', isAdmin, 'isRegularUser:', isRegularUser);

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
