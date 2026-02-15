/**
 * Runtime patch for React Native Text to support Arabic fonts.
 * This patches Text.render to automatically use NotoSansArabic when language is Arabic.
 */

import type { TextProps, TextStyle } from "react-native";
import { StyleSheet, Text } from "react-native";
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

// Store the original render method
const OriginalTextRender = (Text as any).render;

// Patch Text.render to inject Arabic font when needed
(Text as any).render = function (props: TextProps, ref: any) {
  const isArabic = i18n.language === "ar";

  if (!isArabic) {
    return OriginalTextRender.call(this, props, ref);
  }

  // When Arabic, inject the appropriate font
  const arabicFont = getArabicFont(props.style);
  const patchedProps = {
    ...props,
    style: [props.style, { fontFamily: arabicFont }],
  };

  return OriginalTextRender.call(this, patchedProps, ref);
};
