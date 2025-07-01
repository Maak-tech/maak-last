import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Home, Activity, Pill, Users, User } from 'lucide-react-native';

export default function TabLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#64748B',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E2E8F0',
          height: 80,
          paddingBottom: 20,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontFamily: 'Inter-Medium',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('dashboard'),
          tabBarIcon: ({ size, color }) => (
            <Home size={size || 24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="symptoms"
        options={{
          title: t('symptoms'),
          tabBarIcon: ({ size, color }) => (
            <Activity size={size || 24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="medications"
        options={{
          title: t('medications'),
          tabBarIcon: ({ size, color }) => (
            <Pill size={size || 24} color={color} />
          ),
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
    </Tabs>
  );
}
