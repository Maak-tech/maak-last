import { I18nManager, StyleSheet } from "react-native";
import i18n from "@/lib/i18n";

const FONT_MAP: Record<string, string> = {
  "Inter-Regular": "NotoSansArabic-Regular",
  "Inter-Medium": "NotoSansArabic-Regular",
  "Inter-SemiBold": "NotoSansArabic-SemiBold",
  "Inter-Bold": "NotoSansArabic-Bold",
};

const shouldUseArabicFont = (): boolean =>
  i18n.language === "ar" || I18nManager.isRTL;

const originalCreate = StyleSheet.create.bind(StyleSheet);

const remapFontFamily = (value: unknown): unknown => {
  if (!value || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(remapFontFamily);
  }

  const styleObj = value as Record<string, unknown>;
  const next: Record<string, unknown> = { ...styleObj };
  const fontFamily = styleObj.fontFamily;
  if (typeof fontFamily === "string" && FONT_MAP[fontFamily]) {
    next.fontFamily = FONT_MAP[fontFamily];
  }

  for (const key of Object.keys(next)) {
    const nested = next[key];
    if (nested && typeof nested === "object") {
      next[key] = remapFontFamily(nested);
    }
  }
  return next;
};

if (
  !(StyleSheet as unknown as { __maakArabicPatch?: boolean }).__maakArabicPatch
) {
  (StyleSheet as unknown as { __maakArabicPatch?: boolean }).__maakArabicPatch =
    true;

  StyleSheet.create = ((styles: any) => {
    if (!shouldUseArabicFont()) {
      return originalCreate(styles as any);
    }
    return originalCreate(remapFontFamily(styles) as any);
  }) as any;
}
