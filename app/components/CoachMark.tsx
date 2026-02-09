/* biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: Overlay measurement and placement logic is intentionally centralized for correctness. */
import { type RefObject, useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { createThemedStyles, getTextStyle } from "@/utils/styles";

type TargetLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type CoachMarkProps = {
  visible: boolean;
  targetRef: RefObject<View | null>;
  title: string;
  body: string;
  onClose: () => void;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  secondaryActionLabel?: string;
  isRTL?: boolean;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export default function CoachMark({
  visible,
  targetRef,
  title,
  body,
  onClose,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel = "Got it",
  isRTL = false,
}: CoachMarkProps) {
  const { theme } = useTheme();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [targetLayout, setTargetLayout] = useState<TargetLayout | null>(null);
  const [tooltipLayout, setTooltipLayout] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!visible) {
      setTargetLayout(null);
      return;
    }

    let isActive = true;
    const measureTarget = () => {
      targetRef.current?.measureInWindow((x, y, width, height) => {
        if (!isActive) {
          return;
        }
        setTargetLayout({ x, y, width, height });
      });
    };

    const frame = requestAnimationFrame(measureTarget);
    const timeout = setTimeout(measureTarget, 200);

    return () => {
      isActive = false;
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
    };
  }, [targetRef, visible]);

  const styles = useMemo(
    () =>
      createThemedStyles((activeTheme) => ({
        overlay: {
          ...StyleSheet.absoluteFillObject,
          justifyContent: "center",
        },
        backdrop: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: "rgba(0, 0, 0, 0.55)",
        },
        highlight: {
          position: "absolute" as const,
          borderWidth: 2,
          borderColor: activeTheme.colors.primary.main,
          borderRadius: activeTheme.borderRadius.lg,
          backgroundColor: "rgba(255, 255, 255, 0.08)",
        },
        tooltip: {
          position: "absolute" as const,
          maxWidth: Math.min(screenWidth - activeTheme.spacing.lg * 2, 320),
          backgroundColor: activeTheme.colors.background.primary,
          borderRadius: activeTheme.borderRadius.lg,
          padding: activeTheme.spacing.lg,
          ...activeTheme.shadows.lg,
        },
        title: {
          ...getTextStyle(
            activeTheme,
            "subheading",
            "bold",
            activeTheme.colors.text.primary
          ),
          marginBottom: activeTheme.spacing.xs,
        },
        body: {
          ...getTextStyle(
            activeTheme,
            "body",
            "regular",
            activeTheme.colors.text.secondary
          ),
          marginBottom: activeTheme.spacing.lg,
        },
        actions: {
          flexDirection: "row" as const,
          justifyContent: "flex-end" as const,
          gap: activeTheme.spacing.sm,
        },
        button: {
          paddingVertical: activeTheme.spacing.sm,
          paddingHorizontal: activeTheme.spacing.md,
          borderRadius: activeTheme.borderRadius.md,
          borderWidth: 1,
          borderColor: activeTheme.colors.border.light,
          backgroundColor: activeTheme.colors.background.secondary,
        },
        buttonPrimary: {
          borderColor: activeTheme.colors.primary.main,
          backgroundColor: activeTheme.colors.primary.main,
        },
        buttonText: {
          ...getTextStyle(
            activeTheme,
            "caption",
            "bold",
            activeTheme.colors.text.primary
          ),
        },
        buttonTextPrimary: {
          color: activeTheme.colors.neutral.white,
        },
        arrowUp: {
          position: "absolute" as const,
          width: 0,
          height: 0,
          borderLeftWidth: 10,
          borderRightWidth: 10,
          borderBottomWidth: 10,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderBottomColor: activeTheme.colors.background.primary,
        },
        arrowDown: {
          position: "absolute" as const,
          width: 0,
          height: 0,
          borderLeftWidth: 10,
          borderRightWidth: 10,
          borderTopWidth: 10,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderTopColor: activeTheme.colors.background.primary,
        },
      }))(theme),
    [screenWidth, theme]
  );

  if (!visible) {
    return null;
  }

  const padding = theme.spacing.lg;
  const arrowSize = 10;
  const tooltipMaxWidth = Math.min(screenWidth - padding * 2, 320);
  const tooltipHeight = tooltipLayout.height || 160;
  const targetCenterX = targetLayout
    ? targetLayout.x + targetLayout.width / 2
    : screenWidth / 2;

  const canPlaceBelow = targetLayout
    ? targetLayout.y + targetLayout.height + arrowSize + 12 + tooltipHeight <
      screenHeight - padding
    : true;

  const placeBelow = targetLayout
    ? targetLayout.y < screenHeight * 0.55 && canPlaceBelow
    : true;

  const tooltipLeft = clamp(
    targetCenterX - tooltipMaxWidth / 2,
    padding,
    screenWidth - tooltipMaxWidth - padding
  );
  let tooltipTop = (screenHeight - tooltipHeight) / 2;
  if (targetLayout) {
    if (placeBelow) {
      tooltipTop = targetLayout.y + targetLayout.height + arrowSize + 8;
    } else {
      tooltipTop = Math.max(
        padding,
        targetLayout.y - arrowSize - 8 - tooltipHeight
      );
    }
  }

  const arrowLeft = clamp(
    targetCenterX - arrowSize,
    tooltipLeft + 16,
    tooltipLeft + tooltipMaxWidth - 16 - arrowSize * 2
  );

  const highlightStyle = targetLayout
    ? ({
        left: Math.max(0, targetLayout.x - 6),
        top: Math.max(0, targetLayout.y - 6),
        width: targetLayout.width + 12,
        height: targetLayout.height + 12,
      } as ViewStyle)
    : null;

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent={true}
      visible={visible}
    >
      <View style={styles.overlay as ViewStyle}>
        <Pressable onPress={onClose} style={styles.backdrop as ViewStyle} />
        {highlightStyle ? (
          <View
            pointerEvents="none"
            style={[styles.highlight, highlightStyle]}
          />
        ) : null}
        {targetLayout ? (
          <View
            pointerEvents="none"
            style={[
              placeBelow ? styles.arrowUp : styles.arrowDown,
              {
                left: arrowLeft,
                top: placeBelow
                  ? tooltipTop - arrowSize
                  : tooltipTop + tooltipHeight,
              },
            ]}
          />
        ) : null}
        <View
          onLayout={(event) =>
            setTooltipLayout({
              width: event.nativeEvent.layout.width,
              height: event.nativeEvent.layout.height,
            })
          }
          style={[styles.tooltip, { left: tooltipLeft, top: tooltipTop }]}
        >
          <Text style={[styles.title, isRTL && { textAlign: "right" }]}>
            {title}
          </Text>
          <Text style={[styles.body, isRTL && { textAlign: "right" }]}>
            {body}
          </Text>
          <View
            style={[styles.actions, isRTL && { flexDirection: "row-reverse" }]}
          >
            <Pressable onPress={onClose} style={styles.button as ViewStyle}>
              <Text style={styles.buttonText}>{secondaryActionLabel}</Text>
            </Pressable>
            {primaryActionLabel && onPrimaryAction ? (
              <Pressable
                onPress={() => {
                  onPrimaryAction();
                  onClose();
                }}
                style={[styles.button, styles.buttonPrimary]}
              >
                <Text style={[styles.buttonText, styles.buttonTextPrimary]}>
                  {primaryActionLabel}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}
