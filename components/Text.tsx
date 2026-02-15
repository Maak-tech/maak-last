/**
 * Arabic-aware Text component. Use this instead of react-native's Text
 * so Arabic displays correctly (NotoSansArabic) instead of question marks.
 */
import React from "react";
import {
  Text as RNText,
  StyleSheet,
  type TextProps,
  type TextStyle,
} from "react-native";
import i18n from "@/lib/i18n";

const ARABIC_FONTS: Record<string, string> = {
  "Inter-Regular": "NotoSansArabic-Regular",
  "Inter-Medium": "NotoSansArabic-Regular",
  "Inter-SemiBold": "NotoSansArabic-SemiBold",
  "Inter-Bold": "NotoSansArabic-Bold",
};

function getArabicFont(style: TextStyle | TextStyle[] | undefined): string {
  if (!style) return "NotoSansArabic-Regular";
  const flat = StyleSheet.flatten(style);
  if (!flat?.fontFamily) return "NotoSansArabic-Regular";
  return ARABIC_FONTS[flat.fontFamily] ?? "NotoSansArabic-Regular";
}

export const Text = React.forwardRef<
  React.ElementRef<typeof RNText>,
  TextProps
>((props, ref) => {
  const { style, ...rest } = props;
  const isArabic = i18n.language === "ar";

  if (!isArabic) {
    return <RNText ref={ref} style={style} {...rest} />;
  }

  const arabicFont = getArabicFont(style);
  const mergedStyle = [style, { fontFamily: arabicFont }];
  return <RNText ref={ref} style={mergedStyle} {...rest} />;
});

Text.displayName = "Text";
