/**
 * Blood Pressure Manual Entry Component
 * Allows users to manually enter blood pressure readings
 * and export to HealthKit
 */

import { Droplet, X } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
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
  const { theme } = useTheme();
  const { user } = useAuth();
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [saving, setSaving] = useState(false);
  const [exportToHealthKit, setExportToHealthKit] = useState(false);

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
    },
    infoText: {
      ...getTextStyle(theme, "caption", "regular", theme.colors.text.secondary),
      lineHeight: 20,
    },
    checkboxContainer: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      marginBottom: theme.spacing.lg,
      padding: theme.spacing.md,
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.md,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: theme.colors.primary.main,
      marginEnd: theme.spacing.md,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    checkboxChecked: {
      backgroundColor: theme.colors.primary.main,
    },
    checkboxLabel: {
      ...getTextStyle(theme, "body", "regular", theme.colors.text.primary),
      flex: 1,
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
      Alert.alert("Invalid Input", "Please enter both systolic and diastolic values.");
      return false;
    }

    if (isNaN(sys) || isNaN(dia)) {
      Alert.alert("Invalid Input", "Please enter valid numbers.");
      return false;
    }

    if (sys < 50 || sys > 250) {
      Alert.alert(
        "Invalid Input",
        "Systolic pressure should be between 50 and 250 mmHg."
      );
      return false;
    }

    if (dia < 30 || dia > 150) {
      Alert.alert(
        "Invalid Input",
        "Diastolic pressure should be between 30 and 150 mmHg."
      );
      return false;
    }

    if (sys <= dia) {
      Alert.alert(
        "Invalid Input",
        "Systolic pressure must be greater than diastolic pressure."
      );
      return false;
    }

    return true;
  };

  const saveToHealthKit = async (sys: number, dia: number): Promise<boolean> => {
    if (!exportToHealthKit || Platform.OS !== "ios") {
      return false;
    }

    try {
      // Dynamic import to avoid issues if HealthKit is not available
      const {
        saveCorrelationSample,
        isHealthDataAvailable,
        requestAuthorization,
      } = await import("@kingstinct/react-native-healthkit");

      if (!isHealthDataAvailable()) {
        console.log("HealthKit not available");
        return false;
      }

      const now = new Date();

      // Blood pressure in HealthKit is stored as a correlation sample
      // with systolic and diastolic as separate quantity samples
      // Write permissions are requested automatically when saving
      await saveCorrelationSample(
        "HKCorrelationTypeIdentifierBloodPressure",
        [
          {
            quantityType: "HKQuantityTypeIdentifierBloodPressureSystolic",
            quantity: sys,
            unit: "mmHg",
            startDate: now,
            endDate: now,
          },
          {
            quantityType: "HKQuantityTypeIdentifierBloodPressureDiastolic",
            quantity: dia,
            unit: "mmHg",
            startDate: now,
            endDate: now,
          },
        ],
        now,
        now
      );

      return true;
    } catch (error: any) {
      console.error("Failed to save to HealthKit:", error);
      const errorMessage = error?.message || String(error);
      
      // Check if it's a permission error
      if (
        errorMessage.includes("authorization denied") ||
        errorMessage.includes("not authorized") ||
        errorMessage.includes("insufficient permissions") ||
        errorMessage.includes("missing or insufficient permissions") ||
        error?.code === 5
      ) {
        Alert.alert(
          "Permission Denied",
          "Please grant write permissions for blood pressure in Settings > Privacy & Security > Health > [App Name] > Blood Pressure."
        );
      } else {
        Alert.alert(
          "Export Failed",
          "Failed to export blood pressure to HealthKit. Please try again or check your settings."
        );
      }
      return false;
    }
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
      Alert.alert("Error", "Please log in to save blood pressure readings.");
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

      // Export to HealthKit if requested
      if (exportToHealthKit) {
        const healthKitSuccess = await saveToHealthKit(sys, dia);
        if (!healthKitSuccess) {
          Alert.alert(
            "Saved Locally",
            "Blood pressure saved to your health records. HealthKit export failed or is not available."
          );
        } else {
          Alert.alert("Success", "Blood pressure saved and exported to HealthKit!");
        }
      } else {
        Alert.alert("Success", "Blood pressure saved to your health records!");
      }

      // Reset form
      setSystolic("");
      setDiastolic("");
      setExportToHealthKit(false);

      onSave?.();
      onClose();
    } catch (error: any) {
      console.error("Failed to save blood pressure:", error);
      Alert.alert(
        "Error",
        error?.message || "Failed to save blood pressure. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      setSystolic("");
      setDiastolic("");
      setExportToHealthKit(false);
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
            <Text style={styles.title as StyleProp<TextStyle>}>
              Blood Pressure Entry
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
              <Text style={styles.label as (StyleProp<TextStyle>)}>Blood Pressure</Text>
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
                  <Text style={styles.inputLabel as (StyleProp<TextStyle>)}>Systolic</Text>
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
                  <Text style={styles.inputLabel as (StyleProp<TextStyle>)}>Diastolic</Text>
                </View>
              </View>
            </View>

            <View style={styles.infoCard as ViewStyle}>
              <Text style={styles.infoText as (StyleProp<TextStyle>)}>
                Normal blood pressure is typically below 120/80 mmHg. High blood pressure
                (hypertension) is 130/80 mmHg or higher.
              </Text>
            </View>

            {Platform.OS === "ios" && (
              <TouchableOpacity
                style={styles.checkboxContainer as ViewStyle}
                onPress={() => setExportToHealthKit(!exportToHealthKit)}
                disabled={saving}
              >
                <View
                  style={[
                    styles.checkbox as ViewStyle,
                    exportToHealthKit && (styles.checkboxChecked as ViewStyle),
                  ]}
                >
                  {exportToHealthKit && (
                    <Text style={{ color: theme.colors.neutral.white, fontSize: 16 }}>✓</Text>
                  )}
                </View>
                <Text style={styles.checkboxLabel as (StyleProp<TextStyle>)}>
                  Export to HealthKit
                </Text>
              </TouchableOpacity>
            )}

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
                  <Text style={styles.buttonText as (StyleProp<TextStyle>)}>Saving...</Text>
                </>
              ) : (
                <>
                  <Droplet color={theme.colors.neutral.white} size={20} />
                  <Text style={styles.buttonText as (StyleProp<TextStyle>)}>Save</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

