import { Tabs } from "expo-router";
import {
  Activity,
  Home,
  MessageCircle,
  User,
  Users,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import BottomNavBar from "@/components/figma/BottomNavBar";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { arabicText } from "@/lib/arabicText";

export default function TabLayout() {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const { user } = useAuth();

  // Use hardcoded Arabic if language is Arabic
  const isArabic = i18n.language === "ar";
  const getText = (key: string) => {
    if (isArabic && key in arabicText) {
      return arabicText[key as keyof typeof arabicText];
    }
    return t(key);
  };

  // User role logic
  const isAdmin = user?.role === "admin";
  const _isRegularUser = !isAdmin;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary.main,
        tabBarInactiveTintColor: theme.colors.text.secondary,
        tabBarHideOnKeyboard: true,
      }}
      tabBar={(props) => <BottomNavBar {...props} />}
    >
      {/* Home tab for all users */}
      <Tabs.Screen
        name="index"
        options={{
          title: getText("home"),
          tabBarIcon: ({ size, color }: { size?: number; color: string }) => (
            <Home color={color} size={size || 24} />
          ),
        }}
      />

      {/* Track tab only for admin users */}
      <Tabs.Screen
        name="track"
        options={{
          title: getText("track"),
          tabBarIcon: ({ size, color }: { size?: number; color: string }) => (
            <Activity color={color} size={size || 24} />
          ),
          href: isAdmin ? undefined : null, // Only show for admins
        }}
      />

      <Tabs.Screen
        name="zeina"
        options={{
          title: getText("zeina"),
          tabBarIcon: ({ size, color }: { size?: number; color: string }) => (
            <MessageCircle color={color} size={size || 24} />
          ),
        }}
      />
      <Tabs.Screen
        name="family"
        options={{
          title: getText("family"),
          tabBarIcon: ({ size, color }: { size?: number; color: string }) => (
            <Users color={color} size={size || 24} />
          ),
          href: isAdmin ? undefined : null, // Only visible to admin users
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: getText("profile"),
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
        name="blood-pressure"
        options={{
          href: null, // Access via track tab
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
