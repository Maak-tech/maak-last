import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { User } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getTextStyle } from '@/utils/styles';

interface AvatarProps {
  source?: string | { uri: string };
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  onPress?: () => void;
  showBadge?: boolean;
  badgeColor?: string;
  style?: any;
}

export const Avatar: React.FC<AvatarProps> = ({
  source,
  name,
  size = 'md',
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

  const getInitials = (name?: string): string => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const avatarStyle = {
    width: currentSize.width,
    height: currentSize.height,
    borderRadius: currentSize.width / 2,
    backgroundColor: theme.colors.primary.main,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    overflow: 'hidden' as const,
  };

  const renderContent = () => {
    if (source) {
      return (
        <Image
          source={typeof source === 'string' ? { uri: source } : source}
          style={{
            width: currentSize.width,
            height: currentSize.height,
            borderRadius: currentSize.width / 2,
          }}
          resizeMode="cover"
        />
      );
    }

    if (name) {
      return (
        <Text
          style={[
            getTextStyle(theme, 'body', 'bold', theme.colors.neutral.white),
            { fontSize: currentSize.fontSize }
          ]}
        >
          {getInitials(name)}
        </Text>
      );
    }

    return (
      <User 
        size={currentSize.iconSize} 
        color={theme.colors.neutral.white} 
      />
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
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        {avatar}
      </TouchableOpacity>
    );
  }

  return avatar;
};

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
});

export default Avatar;