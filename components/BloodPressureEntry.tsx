/**
 * Blood Pressure Manual Entry Component
 * Allows users to manually enter blood pressure readings
 */

import { Droplet, X } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
  StyleProp,
  Text,
  TextInput,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { auth, db } from "@/lib/firebase";
import { addDoc, collection, Timestamp } from "firebase/firestore";
import { createThemedStyles, getTextStyle } from "@/utils/styles";

interface BloodPressureEntryProps {
  visible: boolean;
  onClose: () => void;
  onSave?: () => void;
}

export default function BloodPressureEntry({
  visible,
  onClose,
  onSave,
}: BloodPressureEntryProps) {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [saving, setSaving] = useState(false);
  
  const isRTL = i18n.language === "ar";

  const styles = createThemedStyles((theme) => ({
    modal: {
      flex: 1,
      backgroundColor: theme.colors.background.primary,
    },
    container: {
      flex: 1,
      padding: theme.spacing.lg,
    },
    header: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      marginBottom: theme.spacing.xl,
      paddingTop: theme.spacing.lg,
    },
    title: {
      ...getTextStyle(theme, "heading", "bold", theme.colors.text.primary),
      fontSize: 28,
    },
    closeButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.background.secondary,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    content: {
      flex: 1,
    },
    formGroup: {
      marginBottom: theme.spacing.xl,
    },
    label: {
      ...getTextStyle(theme, "subheading", "semibold", theme.colors.text.primary),
      marginBottom: theme.spacing.sm,
    },
    inputContainer: {
      flexDirection: "row" as const,
      gap: theme.spacing.md,
    },
    inputWrapper: {
      flex: 1,
    },
    input: {
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      ...getTextStyle(theme, "heading", "bold", theme.colors.text.primary),
      fontSize: 24,
      textAlign: "center" as const,
      borderWidth: 2,
      borderColor: theme.colors.border.light,
    },
    inputFocused: {
      borderColor: theme.colors.primary.main,
    },
    inputLabel: {
      ...getTextStyle(theme, "caption", "medium", theme.colors.text.secondary),
      textAlign: "center" as const,
      marginTop: theme.spacing.xs,
    },
    infoCard: {
      backgroundColor: theme.colors.secondary[50],
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.lg,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.secondary.main,
      borderRightWidth: 0,
      borderRightColor: "transparent",
    },
    infoText: {
      ...getTextStyle(theme, "caption", "regular", theme.colors.text.secondary),
      lineHeight: 20,
    },
    button: {
      backgroundColor: theme.colors.primary.main,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      flexDirection: "row" as const,
      gap: theme.spacing.sm,
      ...theme.shadows.md,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonText: {
      ...getTextStyle(theme, "button", "bold", theme.colors.neutral.white),
    },
    errorText: {
      ...getTextStyle(theme, "body", "medium", theme.colors.accent.error),
      marginTop: theme.spacing.sm,
      textAlign: "center" as const,
    },
  }))(theme);

  const validateInput = (): boolean => {
    const sys = parseInt(systolic, 10);
    const dia = parseInt(diastolic, 10);

    if (!systolic || !diastolic) {
      Alert.alert(t("invalidInput"), t("pleaseEnterBothValues"));
      return false;
    }

    if (isNaN(sys) || isNaN(dia)) {
      Alert.alert(t("invalidInput"), t("pleaseEnterValidNumbers"));
      return false;
    }

    if (sys < 50 || sys > 250) {
      Alert.alert(t("invalidInput"), t("systolicRangeError"));
      return false;
    }

    if (dia < 30 || dia > 150) {
      Alert.alert(t("invalidInput"), t("diastolicRangeError"));
      return false;
    }

    if (sys <= dia) {
      Alert.alert(t("invalidInput"), t("systolicMustBeGreater"));
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateInput()) {
      return;
    }

    const sys = parseInt(systolic, 10);
    const dia = parseInt(diastolic, 10);
    
    // Use user from useAuth hook for more reliable auth state
    const currentUserId = user?.id || auth.currentUser?.uid;

    if (!currentUserId) {
      Alert.alert(t("error"), t("pleaseLogInToSave"));
      return;
    }

    setSaving(true);

    try {
      // Save to Firestore
      const bloodPressureData = {
        userId: currentUserId,
        type: "bloodPressure",
        value: {
          systolic: sys,
          diastolic: dia,
        },
        unit: "mmHg",
        timestamp: Timestamp.now(),
        source: "manual",
      };

      await addDoc(collection(db, "vitals"), bloodPressureData);

      Alert.alert(t("bloodPressureSaved"), t("bloodPressureSavedLocallyMessage"));

      // Reset form
      setSystolic("");
      setDiastolic("");

      onSave?.();
      onClose();
    } catch (error: any) {
      console.error("Failed to save blood pressure:", error);
      Alert.alert(
        t("error"),
        error?.message || t("failedToSaveBloodPressure")
      );
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      setSystolic("");
      setDiastolic("");
      onClose();
    }
  };

  return (
    <Modal
      visible={visible === true}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.modal as ViewStyle}>
        <View style={styles.container as ViewStyle}>
          <View style={styles.header as ViewStyle}>
            <Text style={[styles.title as StyleProp<TextStyle>, isRTL && { textAlign: "right" }]}>
              {t("bloodPressureEntry")}
            </Text>
            <TouchableOpacity
              style={styles.closeButton as ViewStyle}
              onPress={handleClose}
              disabled={saving}
            >
              <X color={theme.colors.text.primary} size={20} />
            </TouchableOpacity>
          </View>

          <View style={styles.content as ViewStyle}>
            <View style={styles.formGroup as ViewStyle}>
              <Text style={[styles.label as (StyleProp<TextStyle>), isRTL && { textAlign: "right" }]}>{t("bloodPressure")}</Text>
              <View style={styles.inputContainer as ViewStyle}>
                <View style={styles.inputWrapper as ViewStyle}>
                  <TextInput
                    style={styles.input as StyleProp<TextStyle>}
                    value={systolic}
                    onChangeText={setSystolic}
                    placeholder="120"
                    keyboardType="number-pad"
                    maxLength={3}
                    editable={!saving}
                  />
                  <Text style={[styles.inputLabel as (StyleProp<TextStyle>), isRTL && { textAlign: "right" }]}>{t("systolic")}</Text>
                </View>
                <View
                  style={{
                    justifyContent: "center" as const,
                    alignItems: "center" as const,
                    paddingTop: theme.spacing.md,
                  }}
                >
                  <Text
                    style={{
                      ...getTextStyle(theme, "heading", "bold", theme.colors.text.secondary),
                      fontSize: 24,
                    }}
                  >
                    /
                  </Text>
                </View>
                <View style={styles.inputWrapper as ViewStyle}>
                  <TextInput
                    style={styles.input as StyleProp<TextStyle>}
                    value={diastolic}
                    onChangeText={setDiastolic}
                    placeholder="80"
                    keyboardType="number-pad"
                    maxLength={3}
                    editable={!saving}
                  />
                  <Text style={[styles.inputLabel as (StyleProp<TextStyle>), isRTL && { textAlign: "right" }]}>{t("diastolic")}</Text>
                </View>
              </View>
            </View>

            <View style={[
              styles.infoCard as ViewStyle,
              isRTL && {
                borderLeftWidth: 0,
                borderRightWidth: 4,
                borderRightColor: theme.colors.secondary.main,
              }
            ]}>
              <Text style={[styles.infoText as (StyleProp<TextStyle>), isRTL && { textAlign: "right" }]}>
                {t("normalBloodPressureInfo")}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.button as ViewStyle,
                saving && (styles.buttonDisabled as ViewStyle),
              ]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <>
                  <ActivityIndicator color={theme.colors.neutral.white} size="small" />
                  <Text style={styles.buttonText as (StyleProp<TextStyle>)}>{t("saving")}</Text>
                </>
              ) : (
                <>
                  <Droplet color={theme.colors.neutral.white} size={20} />
                  <Text style={styles.buttonText as (StyleProp<TextStyle>)}>{t("save")}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

