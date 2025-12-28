/**
 * RTL-aware spacing utilities
 * Use these helpers to create spacing that automatically flips for RTL languages
 */

import { StyleSheet, ViewStyle, TextStyle } from "react-native";

/**
 * Creates RTL-aware margin styles
 * @param isRTL - Whether the current language is RTL (Arabic)
 * @param marginStart - Margin on the start side (left in LTR, right in RTL)
 * @param marginEnd - Margin on the end side (right in LTR, left in RTL)
 */
export const getRTLMargin = (
  isRTL: boolean,
  marginStart?: number,
  marginEnd?: number
): ViewStyle => {
  if (isRTL) {
    return {
      marginStart: marginEnd,
      marginEnd: marginStart,
    };
  }
  return {
    marginStart,
    marginEnd,
  };
};

/**
 * Creates RTL-aware padding styles
 * @param isRTL - Whether the current language is RTL (Arabic)
 * @param paddingStart - Padding on the start side (left in LTR, right in RTL)
 * @param paddingEnd - Padding on the end side (right in LTR, left in RTL)
 */
export const getRTLPadding = (
  isRTL: boolean,
  paddingStart?: number,
  paddingEnd?: number
): ViewStyle => {
  if (isRTL) {
    return {
      paddingStart: paddingEnd,
      paddingEnd: paddingStart,
    };
  }
  return {
    paddingStart,
    paddingEnd,
  };
};

/**
 * Creates RTL-aware flex direction
 * @param isRTL - Whether the current language is RTL (Arabic)
 * @param baseDirection - Base flex direction ("row" or "row-reverse")
 */
export const getRTLFlexDirection = (
  isRTL: boolean,
  baseDirection: "row" | "row-reverse" = "row"
): ViewStyle => {
  if (isRTL && baseDirection === "row") {
    return { flexDirection: "row-reverse" };
  }
  if (isRTL && baseDirection === "row-reverse") {
    return { flexDirection: "row" };
  }
  return { flexDirection: baseDirection };
};

/**
 * Creates RTL-aware text alignment
 * @param isRTL - Whether the current language is RTL (Arabic)
 * @param baseAlign - Base text alignment ("left" or "right")
 */
export const getRTLTextAlign = (
  isRTL: boolean,
  baseAlign: "left" | "right" | "center" = "left"
): TextStyle => {
  if (isRTL && baseAlign === "left") {
    return { textAlign: "right" };
  }
  if (isRTL && baseAlign === "right") {
    return { textAlign: "left" };
  }
  return { textAlign: baseAlign };
};

