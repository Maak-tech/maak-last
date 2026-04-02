import { StyleSheet } from "react-native";

/**
 * Creates themed styles for the PPGVitalMonitor component.
 * Accepts the app theme object and returns a StyleSheet.
 */
export function createPPGStyles(theme: {
  colors: {
    primary: { main: string };
    background: { primary: string };
    text: { primary: string; secondary: string };
  };
  borderRadius?: { lg?: number };
}) {
  const primary = theme.colors.primary.main;
  const bg = theme.colors.background.primary;
  const textPrimary = theme.colors.text.primary;
  const textSecondary = theme.colors.text.secondary;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: bg,
    },
    cameraView: {
      flex: 1,
      borderRadius: 16,
      overflow: "hidden",
    },
    overlayTop: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      padding: 16,
      alignItems: "center",
    },
    waveformContainer: {
      height: 80,
      backgroundColor: `${primary}15`,
      borderRadius: 12,
      marginVertical: 8,
      overflow: "hidden",
    },
    statusText: {
      color: textPrimary,
      fontSize: 14,
      fontWeight: "600",
      textAlign: "center",
    },
    statusSubText: {
      color: textSecondary,
      fontSize: 12,
      textAlign: "center",
      marginTop: 4,
    },
    metricRow: {
      flexDirection: "row",
      justifyContent: "space-around",
      paddingVertical: 12,
    },
    metricCard: {
      alignItems: "center",
      gap: 4,
    },
    metricValue: {
      color: primary,
      fontSize: 28,
      fontWeight: "800",
    },
    metricLabel: {
      color: textSecondary,
      fontSize: 12,
    },
    actionButton: {
      backgroundColor: primary,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 8,
    },
    actionButtonText: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "700",
    },
    fingerPrompt: {
      position: "absolute",
      inset: 0,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.5)",
    },
    fingerPromptText: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "600",
      textAlign: "center",
      paddingHorizontal: 32,
    },
  });
}
