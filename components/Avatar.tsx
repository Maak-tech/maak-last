import { User } from "lucide-react-native";
import type React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import type { AvatarType } from "@/types";
import { getTextStyle } from "@/utils/styles";

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

  // Extract width/height from style prop if provided, otherwise use size-based dimensions
  const styleWidth = (style as any)?.width;
  const styleHeight = (style as any)?.height;
  const effectiveWidth = styleWidth ?? currentSize.width;
  const effectiveHeight = styleHeight ?? currentSize.height;
  const effectiveBorderRadius = Math.min(effectiveWidth, effectiveHeight) / 2;

  const getAvatarUrl = (type?: AvatarType): string => {
    // Use DiceBear Notionists API for premium vector avatars
    // Notionists style provides high-quality, scalable vector avatars with modern, professional appearance
    // IMPORTANT: Using PNG format for React Native Image component compatibility
    // React Native's Image component only supports: png, jpg, jpeg, bmp, gif, webp, psd
    // SVG URLs are NOT supported natively by React Native Image component
    const baseUrl = "https://api.dicebear.com/7.x/notionists/png";
    
    // Create consistent seeds for each avatar type
    // The seed parameter ensures the same avatar is generated each time
    const avatarSeeds: Record<string, string> = {
      man: "professional-male-adult-business",
      woman: "professional-female-adult-business",
      boy: "young-male-student",
      girl: "young-female-student",
      grandma: "elderly-female-grandmother",
      grandpa: "elderly-male-grandfather"
    };

    if (!type || !avatarSeeds[type]) {
      return "";
    }

    const seed = avatarSeeds[type];
    // Premium vector avatars with enhanced styling options
    // Using neutral, professional background colors and enhanced features
    return `${baseUrl}?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf&radius=50`;
  };

  const getInitials = (name?: string): string => {
    if (!name) return "?";
    // Get the first letter of the name (handles both single and multiple words)
    const firstLetter = name.trim()[0]?.toUpperCase() || "?";
    return firstLetter;
  };

  const avatarStyle = {
    width: effectiveWidth,
    height: effectiveHeight,
    borderRadius: effectiveBorderRadius,
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
            width: effectiveWidth,
            height: effectiveHeight,
            borderRadius: effectiveBorderRadius,
          }}
        />
      );
    }

    if (avatarType) {
      const avatarUrl = getAvatarUrl(avatarType);
      if (avatarUrl) {
        return (
          <Image
            resizeMode="cover"
            source={{ uri: avatarUrl }}
            style={{
              width: effectiveWidth,
              height: effectiveHeight,
              borderRadius: effectiveBorderRadius,
            }}
          />
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
              width: effectiveWidth * 0.3,
              height: effectiveWidth * 0.3,
              borderRadius: (effectiveWidth * 0.3) / 2,
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
