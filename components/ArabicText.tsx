import { Text, type TextProps } from "react-native";

interface ArabicTextProps extends TextProps {}

export function ArabicText({ style, children, ...props }: ArabicTextProps) {
  return (
    <Text
      {...props}
      accessibilityLanguage="ar"
      style={[{ fontFamily: "NotoSansArabic-Regular", textAlign: "right", writingDirection: "rtl" }, style]}
    >
      {children}
    </Text>
  );
}
