import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { Home, Activity, Pill, Users, User, BookOpen } from 'lucide-react-native';

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
          fontFamily: 'Geist-Medium',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('home') || 'Home',
          tabBarIcon: ({ size, color }) => (
            <Home size={size || 24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="track"
        options={{
          title: t('track') || 'Track',
          tabBarIcon: ({ size, color }) => (
            <Activity size={size || 24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="symptoms"
        options={{
          href: null, // Access via track tab
        }}
      />
      <Tabs.Screen
        name="family"
        options={{
          title: t('family'),
          tabBarIcon: ({ size, color }) => (
            <Users size={size || 24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('profile'),
          tabBarIcon: ({ size, color }) => (
            <User size={size || 24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="medications"
        options={{
          href: null, // Access via symptoms/track tab
        }}
      />
      <Tabs.Screen
        name="resources"
        options={{
          href: null, // Access via profile tab
        }}
      />
      <Tabs.Screen
        name="vitals"
        options={{
          href: null, // Access via track tab
        }}
      />
    </Tabs>
  );
}
