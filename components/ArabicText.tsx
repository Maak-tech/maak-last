import { StyleSheet, Text, type TextProps } from "react-native";

export function ArabicText(props: TextProps) {
  const { style, ...rest } = props;

  return <Text {...rest} style={[styles.arabicFont, style]} />;
}

const styles = StyleSheet.create({
  arabicFont: {
    fontFamily: "NotoSansArabic-Regular",
  },
});
