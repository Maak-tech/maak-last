import { Text, type TextProps } from "react-native";

interface ArabicTextProps extends TextProps {}

export function ArabicText({ style, ...props }: ArabicTextProps) {
  return (
    <Text
      style={[{ fontFamily: "NotoSansArabic-Regular", textAlign: "right", writingDirection: "rtl" }, style]}
      {...props}
    />
  );
}
