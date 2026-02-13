import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import {
  Activity,
  Home,
  MessageCircle,
  User,
  Users,
} from "lucide-react-native";
import type React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type TabConfig = {
  key: string;
  label: string;
  icon: (color: string, size: number) => React.ReactNode;
};

const TAB_GRADIENT = ["#003543", "#004552", "#00667A"];

const getTabConfig = (t: (key: string, defaultValue?: string) => string) => ({
  index: {
    key: "index",
    label: t("home", "Home"),
    icon: (color: string, size: number) => <Home color={color} size={size} />,
  },
  track: {
    key: "track",
    label: t("track", "Track"),
    icon: (color: string, size: number) => (
      <Activity color={color} size={size} />
    ),
  },
  zeina: {
    key: "zeina",
    label: t("zeina", "Zeina"),
    icon: (color: string, size: number) => (
      <MessageCircle color={color} size={size} />
    ),
  },
  family: {
    key: "family",
    label: t("family", "Family"),
    icon: (color: string, size: number) => <Users color={color} size={size} />,
  },
  profile: {
    key: "profile",
    label: t("profile", "Profile"),
    icon: (color: string, size: number) => <User color={color} size={size} />,
  },
});

export default function BottomNavBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const config = getTabConfig(t);

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom }]}>
      <BlurView intensity={30} style={StyleSheet.absoluteFill} tint="light" />
      <View style={styles.container}>
        {state.routes.map((route, index) => {
          const options = descriptors[route.key]?.options;
          if (
            options?.tabBarStyle?.display === "none" ||
            options?.href === null
          ) {
            return null;
          }

          const tab = config[route.name as keyof typeof config];
          if (!tab) {
            return null;
          }

          const isFocused = state.index === index;
          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!(isFocused || event.defaultPrevented)) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: "tabLongPress",
              target: route.key,
            });
          };

          return (
            <TouchableOpacity
              accessibilityLabel={options?.tabBarAccessibilityLabel}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              activeOpacity={0.8}
              key={route.key}
              onLongPress={onLongPress}
              onPress={onPress}
              style={styles.tabButton}
              testID={options?.tabBarButtonTestID}
            >
              {isFocused && (
                <>
                  <LinearGradient
                    colors={TAB_GRADIENT}
                    end={{ x: 1, y: 1 }}
                    start={{ x: 0, y: 0 }}
                    style={styles.activeBackground}
                  />
                  <View style={styles.activeDot} />
                </>
              )}

              <View style={styles.tabContent}>
                {tab.icon(isFocused ? "#FFFFFF" : "#9CA3AF", 22)}
                <Text
                  style={[styles.tabLabel, isFocused && styles.tabLabelActive]}
                >
                  {tab.label}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  container: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  tabButton: {
    minWidth: 60,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  tabContent: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  tabLabel: {
    fontSize: 11,
    color: "#9CA3AF",
    fontWeight: "600",
  },
  tabLabelActive: {
    color: "#FFFFFF",
  },
  activeBackground: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
  },
  activeDot: {
    position: "absolute",
    top: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#EB9C0C",
  },
});
