import { User } from "lucide-react-native";
import type React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { getTextStyle } from "@/utils/styles";
import type { AvatarType } from "@/types";

interface AvatarProps {
  source?: string | { uri: string };
  name?: string;
  avatarType?: AvatarType;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  onPress?: () => void;
  showBadge?: boolean;
  badgeColor?: string;
  style?: any;
}

export const Avatar: React.FC<AvatarProps> = ({
  source,
  name,
  avatarType,
  size = "md",
  onPress,
  showBadge = false,
  badgeColor,
  style,
}) => {
  const { theme } = useTheme();

  const sizes = {
    xs: { width: 24, height: 24, iconSize: 12, fontSize: 10 },
    sm: { width: 32, height: 32, iconSize: 16, fontSize: 12 },
    md: { width: 48, height: 48, iconSize: 20, fontSize: 16 },
    lg: { width: 64, height: 64, iconSize: 24, fontSize: 20 },
    xl: { width: 80, height: 80, iconSize: 32, fontSize: 24 },
  };

  const currentSize = sizes[size];

  const getAvatarEmoji = (type?: AvatarType): string => {
    switch (type) {
      case "man":
        return "👨🏻"; // Man with light skin tone
      case "woman":
        return "👩🏻"; // Woman with light skin tone
      case "boy":
        return "👦🏻"; // Boy with light skin tone
      case "girl":
        return "👧🏻"; // Girl with light skin tone
      case "grandma":
        return "👵🏻"; // Grandma with light skin tone
      case "grandpa":
        return "👴🏻"; // Grandpa with light skin tone
      default:
        return "";
    }
  };

  const getInitials = (name?: string): string => {
    if (!name) return "?";
    // Get the first letter of the name (handles both single and multiple words)
    const firstLetter = name.trim()[0]?.toUpperCase() || "?";
    return firstLetter;
  };

  const avatarStyle = {
    width: currentSize.width,
    height: currentSize.height,
    borderRadius: currentSize.width / 2,
    backgroundColor: avatarType ? "transparent" : theme.colors.primary.main,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    overflow: "visible" as const,
  };

  const renderContent = () => {
    if (source) {
      return (
        <Image
          resizeMode="cover"
          source={typeof source === "string" ? { uri: source } : source}
          style={{
            width: currentSize.width,
            height: currentSize.height,
            borderRadius: currentSize.width / 2,
          }}
        />
      );
    }

    if (avatarType) {
      const emoji = getAvatarEmoji(avatarType);
      if (emoji) {
        return (
          <Text
            style={{
              fontSize: currentSize.width * 0.8,
              textAlign: "center",
              includeFontPadding: false,
            }}
          >
            {emoji}
          </Text>
        );
      }
    }

    if (name) {
      return (
        <Text
          style={[
            getTextStyle(theme, "body", "bold", theme.colors.neutral.white),
            { fontSize: currentSize.fontSize },
          ]}
        >
          {getInitials(name)}
        </Text>
      );
    }

    return (
      <User color={theme.colors.neutral.white} size={currentSize.iconSize} />
    );
  };

  const avatar = (
    <View style={[avatarStyle, style]}>
      {renderContent()}
      {showBadge && (
        <View
          style={[
            styles.badge,
            {
              backgroundColor: badgeColor || theme.colors.accent.success,
              width: currentSize.width * 0.3,
              height: currentSize.width * 0.3,
              borderRadius: (currentSize.width * 0.3) / 2,
              borderWidth: 2,
              borderColor: theme.colors.background.primary,
            },
          ]}
        />
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
        {avatar}
      </TouchableOpacity>
    );
  }

  return avatar;
};

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    bottom: 0,
    right: 0,
  },
});

export default Avatar;
