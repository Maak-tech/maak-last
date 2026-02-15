"use client";

import { useRouter } from "expo-router";
import { Pill } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Modal,
  Platform,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import { useMedicationAlarm } from "@/contexts/MedicationAlarmContext";
import { useTheme } from "@/contexts/ThemeContext";
import { subscribeToMedicationAlarm } from "@/lib/medicationAlarmEmitter";
import { medicationService } from "@/lib/services/medicationService";
import { createThemedStyles, getTextStyle } from "@/utils/styles";

const ALARM_VIBRATION_PATTERN = [0, 1000, 500, 1000, 500, 1000];

export default function MedicationAlarmModal() {
  const { t } = useTranslation();
  const { activeAlarm, showAlarm, dismissAlarm } = useMedicationAlarm();
  const { theme } = useTheme();
  const router = useRouter();
  const hasVibrated = useRef(false);

  useEffect(
    () =>
      subscribeToMedicationAlarm((alarm) => {
        showAlarm(alarm);
      }),
    [showAlarm]
  );

  useEffect(() => {
    if (activeAlarm && Platform.OS === "android" && !hasVibrated.current) {
      Vibration.vibrate(ALARM_VIBRATION_PATTERN);
      hasVibrated.current = true;
    }
    return () => {
      hasVibrated.current = false;
    };
  }, [activeAlarm]);

  const handleTaken = async () => {
    if (!(activeAlarm?.medicationId && activeAlarm?.reminderId)) {
      dismissAlarm();
      return;
    }
    try {
      await medicationService.markMedicationTaken(
        activeAlarm.medicationId,
        activeAlarm.reminderId
      );
    } catch {
      // Continue to dismiss even if mark fails
    }
    dismissAlarm();
    router.push("/(tabs)/medications");
  };

  const handleSnooze = () => {
    dismissAlarm();
    // Snooze: reminder will fire again at next scheduled time (daily)
  };

  const styles = createThemedStyles((t) => ({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.7)",
      justifyContent: "center",
      alignItems: "center",
      padding: t.spacing.xl,
    },
    card: {
      backgroundColor: t.colors.background.primary,
      borderRadius: t.borderRadius.xl,
      padding: t.spacing.xl,
      width: "100%",
      maxWidth: 340,
      alignItems: "center",
      ...t.shadows.lg,
    },
    iconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: t.colors.accent.success + "20",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: t.spacing.lg,
    },
    title: {
      ...getTextStyle(t, "heading", "bold", t.colors.text.primary),
      fontSize: 20,
      marginBottom: t.spacing.xs,
      textAlign: "center",
    },
    subtitle: {
      ...getTextStyle(t, "body", "regular", t.colors.text.secondary),
      fontSize: 14,
      marginBottom: t.spacing.lg,
      textAlign: "center",
    },
    medName: {
      ...getTextStyle(t, "subheading", "bold", t.colors.primary.main),
      fontSize: 18,
      marginBottom: t.spacing.sm,
      textAlign: "center",
    },
    button: {
      width: "100%",
      paddingVertical: t.spacing.base,
      borderRadius: t.borderRadius.lg,
      alignItems: "center",
      marginBottom: t.spacing.sm,
    },
    buttonTaken: {
      backgroundColor: t.colors.accent.success,
    },
    buttonSnooze: {
      backgroundColor: t.colors.background.secondary,
    },
    buttonText: {
      ...getTextStyle(t, "button", "bold", t.colors.neutral.white),
    },
    buttonSnoozeText: {
      ...getTextStyle(t, "button", "semibold", t.colors.text.secondary),
    },
  }))(theme);

  if (!activeAlarm) return null;

  return (
    <Modal
      animationType="fade"
      onRequestClose={handleSnooze}
      transparent
      visible={!!activeAlarm}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Pill color={theme.colors.accent.success} size={36} />
          </View>
          <Text style={styles.title}>{t("medicationAlarmTitle")}</Text>
          <Text style={styles.subtitle}>{t("medicationAlarmSubtitle")}</Text>
          <Text style={styles.medName}>
            {activeAlarm.medicationName}
            {activeAlarm.dosage ? ` (${activeAlarm.dosage})` : ""}
          </Text>
          <TouchableOpacity
            onPress={handleTaken}
            style={[styles.button, styles.buttonTaken]}
          >
            <Text style={styles.buttonText}>{t("medicationAlarmTaken")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSnooze}
            style={[styles.button, styles.buttonSnooze]}
          >
            <Text style={styles.buttonSnoozeText}>
              {t("medicationAlarmSnooze")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
