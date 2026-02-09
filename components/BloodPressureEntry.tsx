/**
 * Blood Pressure Manual Entry Component
 * Allows users to manually enter blood pressure readings
 */

import { addDoc, collection, Timestamp } from "firebase/firestore";
import { Droplet, X } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
  type StyleProp,
  Text,
  TextInput,
  type TextStyle,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { auth, db } from "@/lib/firebase";
import { createThemedStyles, getTextStyle } from "@/utils/styles";

type BloodPressureEntryProps = {
  visible: boolean;
  onClose: () => void;
  onSave?: () => void;
};

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

  const styles = createThemedStyles((themeTokens) => ({
    modal: {
      flex: 1,
      backgroundColor: themeTokens.colors.background.primary,
    },
    container: {
      flex: 1,
      padding: themeTokens.spacing.lg,
    },
    header: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      marginBottom: themeTokens.spacing.xl,
      paddingTop: themeTokens.spacing.lg,
    },
    title: {
      ...getTextStyle(
        themeTokens,
        "heading",
        "bold",
        themeTokens.colors.text.primary
      ),
      fontSize: 28,
    },
    closeButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: themeTokens.colors.background.secondary,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    content: {
      flex: 1,
    },
    formGroup: {
      marginBottom: themeTokens.spacing.xl,
    },
    label: {
      ...getTextStyle(
        themeTokens,
        "subheading",
        "semibold",
        themeTokens.colors.text.primary
      ),
      marginBottom: themeTokens.spacing.sm,
    },
    inputContainer: {
      flexDirection: "row" as const,
      gap: themeTokens.spacing.md,
    },
    inputWrapper: {
      flex: 1,
    },
    input: {
      backgroundColor: themeTokens.colors.background.secondary,
      borderRadius: themeTokens.borderRadius.md,
      padding: themeTokens.spacing.md,
      ...getTextStyle(
        themeTokens,
        "heading",
        "bold",
        themeTokens.colors.text.primary
      ),
      fontSize: 24,
      textAlign: "center" as const,
      borderWidth: 2,
      borderColor: themeTokens.colors.border.light,
    },
    inputFocused: {
      borderColor: themeTokens.colors.primary.main,
    },
    inputLabel: {
      ...getTextStyle(
        themeTokens,
        "caption",
        "medium",
        themeTokens.colors.text.secondary
      ),
      textAlign: "center" as const,
      marginTop: themeTokens.spacing.xs,
    },
    infoCard: {
      backgroundColor: themeTokens.colors.secondary[50],
      borderRadius: themeTokens.borderRadius.md,
      padding: themeTokens.spacing.md,
      marginBottom: themeTokens.spacing.lg,
      borderLeftWidth: 4,
      borderLeftColor: themeTokens.colors.secondary.main,
      borderRightWidth: 0,
      borderRightColor: "transparent",
    },
    infoText: {
      ...getTextStyle(
        themeTokens,
        "caption",
        "regular",
        themeTokens.colors.text.secondary
      ),
      lineHeight: 20,
    },
    button: {
      backgroundColor: themeTokens.colors.primary.main,
      borderRadius: themeTokens.borderRadius.lg,
      padding: themeTokens.spacing.md,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      flexDirection: "row" as const,
      gap: themeTokens.spacing.sm,
      ...themeTokens.shadows.md,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonText: {
      ...getTextStyle(
        themeTokens,
        "button",
        "bold",
        themeTokens.colors.neutral.white
      ),
    },
    errorText: {
      ...getTextStyle(
        themeTokens,
        "body",
        "medium",
        themeTokens.colors.accent.error
      ),
      marginTop: themeTokens.spacing.sm,
      textAlign: "center" as const,
    },
  }))(theme);

  const validateInput = (): boolean => {
    const sys = Number.parseInt(systolic, 10);
    const dia = Number.parseInt(diastolic, 10);

    if (!(systolic && diastolic)) {
      Alert.alert(t("invalidInput"), t("pleaseEnterBothValues"));
      return false;
    }

    if (Number.isNaN(sys) || Number.isNaN(dia)) {
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

    const sys = Number.parseInt(systolic, 10);
    const dia = Number.parseInt(diastolic, 10);

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

      Alert.alert(
        t("bloodPressureSaved"),
        t("bloodPressureSavedLocallyMessage")
      );

      // Reset form
      setSystolic("");
      setDiastolic("");

      onSave?.();
      onClose();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : undefined;
      Alert.alert(t("error"), message || t("failedToSaveBloodPressure"));
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
      animationType="slide"
      onRequestClose={handleClose}
      transparent={false}
      visible={visible === true}
    >
      <SafeAreaView style={styles.modal as ViewStyle}>
        <View style={styles.container as ViewStyle}>
          <View style={styles.header as ViewStyle}>
            <Text
              style={[
                styles.title as StyleProp<TextStyle>,
                isRTL && { textAlign: "right" },
              ]}
            >
              {t("bloodPressureEntry")}
            </Text>
            <TouchableOpacity
              disabled={saving}
              onPress={handleClose}
              style={styles.closeButton as ViewStyle}
            >
              <X color={theme.colors.text.primary} size={20} />
            </TouchableOpacity>
          </View>

          <View style={styles.content as ViewStyle}>
            <View style={styles.formGroup as ViewStyle}>
              <Text
                style={[
                  styles.label as StyleProp<TextStyle>,
                  isRTL && { textAlign: "right" },
                ]}
              >
                {t("bloodPressure")}
              </Text>
              <View style={styles.inputContainer as ViewStyle}>
                <View style={styles.inputWrapper as ViewStyle}>
                  <TextInput
                    editable={!saving}
                    keyboardType="number-pad"
                    maxLength={3}
                    onChangeText={setSystolic}
                    placeholder="120"
                    style={styles.input as StyleProp<TextStyle>}
                    value={systolic}
                  />
                  <Text
                    style={[
                      styles.inputLabel as StyleProp<TextStyle>,
                      isRTL && { textAlign: "right" },
                    ]}
                  >
                    {t("systolic")}
                  </Text>
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
                      ...getTextStyle(
                        theme,
                        "heading",
                        "bold",
                        theme.colors.text.secondary
                      ),
                      fontSize: 24,
                    }}
                  >
                    /
                  </Text>
                </View>
                <View style={styles.inputWrapper as ViewStyle}>
                  <TextInput
                    editable={!saving}
                    keyboardType="number-pad"
                    maxLength={3}
                    onChangeText={setDiastolic}
                    placeholder="80"
                    style={styles.input as StyleProp<TextStyle>}
                    value={diastolic}
                  />
                  <Text
                    style={[
                      styles.inputLabel as StyleProp<TextStyle>,
                      isRTL && { textAlign: "right" },
                    ]}
                  >
                    {t("diastolic")}
                  </Text>
                </View>
              </View>
            </View>

            <View
              style={[
                styles.infoCard as ViewStyle,
                isRTL && {
                  borderLeftWidth: 0,
                  borderRightWidth: 4,
                  borderRightColor: theme.colors.secondary.main,
                },
              ]}
            >
              <Text
                style={[
                  styles.infoText as StyleProp<TextStyle>,
                  isRTL && { textAlign: "right" },
                ]}
              >
                {t("normalBloodPressureInfo")}
              </Text>
            </View>

            <TouchableOpacity
              disabled={saving}
              onPress={handleSave}
              style={[
                styles.button as ViewStyle,
                saving && (styles.buttonDisabled as ViewStyle),
              ]}
            >
              {saving ? (
                <>
                  <ActivityIndicator
                    color={theme.colors.neutral.white}
                    size="small"
                  />
                  <Text style={styles.buttonText as StyleProp<TextStyle>}>
                    {t("saving")}
                  </Text>
                </>
              ) : (
                <>
                  <Droplet color={theme.colors.neutral.white} size={20} />
                  <Text style={styles.buttonText as StyleProp<TextStyle>}>
                    {t("save")}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
