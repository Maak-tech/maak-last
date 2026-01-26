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
        if (!isActive) return;
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
  }, [screenHeight, screenWidth, targetRef, visible]);

  const styles = useMemo(
    () =>
      createThemedStyles((theme) => ({
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
          borderColor: theme.colors.primary.main,
          borderRadius: theme.borderRadius.lg,
          backgroundColor: "rgba(255, 255, 255, 0.08)",
        },
        tooltip: {
          position: "absolute" as const,
          maxWidth: Math.min(screenWidth - theme.spacing.lg * 2, 320),
          backgroundColor: theme.colors.background.primary,
          borderRadius: theme.borderRadius.lg,
          padding: theme.spacing.lg,
          ...theme.shadows.lg,
        },
        title: {
          ...getTextStyle(
            theme,
            "subheading",
            "bold",
            theme.colors.text.primary
          ),
          marginBottom: theme.spacing.xs,
        },
        body: {
          ...getTextStyle(
            theme,
            "body",
            "regular",
            theme.colors.text.secondary
          ),
          marginBottom: theme.spacing.lg,
        },
        actions: {
          flexDirection: "row" as const,
          justifyContent: "flex-end" as const,
          gap: theme.spacing.sm,
        },
        button: {
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.borderRadius.md,
          borderWidth: 1,
          borderColor: theme.colors.border.light,
          backgroundColor: theme.colors.background.secondary,
        },
        buttonPrimary: {
          borderColor: theme.colors.primary.main,
          backgroundColor: theme.colors.primary.main,
        },
        buttonText: {
          ...getTextStyle(theme, "caption", "bold", theme.colors.text.primary),
        },
        buttonTextPrimary: {
          color: theme.colors.neutral.white,
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
          borderBottomColor: theme.colors.background.primary,
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
          borderTopColor: theme.colors.background.primary,
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
  const tooltipTop = targetLayout
    ? placeBelow
      ? targetLayout.y + targetLayout.height + arrowSize + 8
      : Math.max(padding, targetLayout.y - arrowSize - 8 - tooltipHeight)
    : (screenHeight - tooltipHeight) / 2;

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
        {highlightStyle && (
          <View
            pointerEvents="none"
            style={[styles.highlight, highlightStyle] as ViewStyle}
          />
        )}
        {targetLayout && (
          <View
            pointerEvents="none"
            style={
              [
                placeBelow ? styles.arrowUp : styles.arrowDown,
                {
                  left: arrowLeft,
                  top: placeBelow
                    ? tooltipTop - arrowSize
                    : tooltipTop + tooltipHeight,
                },
              ] as ViewStyle
            }
          />
        )}
        <View
          onLayout={(event) =>
            setTooltipLayout({
              width: event.nativeEvent.layout.width,
              height: event.nativeEvent.layout.height,
            })
          }
          style={
            [
              styles.tooltip,
              { left: tooltipLeft, top: tooltipTop },
            ] as ViewStyle
          }
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
            {primaryActionLabel && onPrimaryAction && (
              <Pressable
                onPress={() => {
                  onPrimaryAction();
                  onClose();
                }}
                style={[styles.button, styles.buttonPrimary] as ViewStyle}
              >
                <Text style={[styles.buttonText, styles.buttonTextPrimary]}>
                  {primaryActionLabel}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
