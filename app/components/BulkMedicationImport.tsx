import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ReactElement } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { medicationService } from "@/lib/services/medicationService";
import {
  bulkMedicationImportService,
  type ParsedMedication,
} from "@/lib/services/bulkMedicationImportService";
import { Button, Card } from "@/components/design-system";
import { Heading, Text, Caption } from "@/components/design-system/Typography";

interface BulkMedicationImportProps {
  visible: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export default function BulkMedicationImport({
  visible,
  onClose,
  onImportComplete,
}: BulkMedicationImportProps) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isRTL = i18n.language === "ar";

  const [csvText, setCsvText] = useState("");
  const [parsedMedications, setParsedMedications] = useState<
    ParsedMedication[]
  >([]);
  const [importResult, setImportResult] = useState<{
    success: number;
    failed: number;
    errors: Array<{ row: number; medication: string; error: string }>;
  } | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [step, setStep] = useState<"input" | "preview" | "result">("input");

  const styles = getStyles(theme, isRTL);

  const handleParseCSV = async () => {
    if (!csvText.trim()) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "يرجى إدخال بيانات CSV" : "Please enter CSV data"
      );
      return;
    }

    setIsParsing(true);
    try {
      const result = await bulkMedicationImportService.importFromCSV(
        csvText,
        user?.id || ""
      );

      if (result.medications.length === 0) {
        Alert.alert(
          isRTL ? "لا توجد بيانات" : "No Data",
          isRTL
            ? "لم يتم العثور على أدوية صالحة في البيانات"
            : "No valid medications found in the data"
        );
        setIsParsing(false);
        return;
      }

      setParsedMedications(result.medications);
      setImportResult({
        success: result.imported,
        failed: result.failed,
        errors: result.errors,
      });
      setStep("preview");
    } catch (error) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL
          ? "حدث خطأ في تحليل البيانات"
          : "Error parsing CSV data"
      );
    } finally {
      setIsParsing(false);
    }
  };

  const handleImport = async () => {
    if (!user || parsedMedications.length === 0) return;

    setIsImporting(true);
    try {
      // Map ParsedMedication to Omit<Medication, "id"> by adding userId
      const medicationsWithUserId = parsedMedications.map((med) => ({
        ...med,
        userId: user.id,
      }));
      
      const result = await medicationService.bulkAddMedications(
        medicationsWithUserId,
        user.id
      );

      // Note: Notifications will be scheduled when medications are viewed/edited
      // Individual medication reminders are handled by the medication service

      Alert.alert(
        isRTL ? "تم الاستيراد" : "Import Complete",
        isRTL
          ? `تم استيراد ${result.success} دواء بنجاح${
              result.failed > 0 ? `\nفشل استيراد ${result.failed} دواء` : ""
            }`
          : `Successfully imported ${result.success} medication(s)${
              result.failed > 0 ? `\nFailed to import ${result.failed}` : ""
            }`,
        [
          {
            text: isRTL ? "موافق" : "OK",
            onPress: () => {
              resetAndClose();
              onImportComplete();
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "حدث خطأ في استيراد الأدوية" : "Error importing medications"
      );
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const template = bulkMedicationImportService.generateCSVTemplate();
      const fileName = "medication_import_template.csv";
      const documentDir = (FileSystem as any).documentDirectory || "";
      const fileUri = `${documentDir}${fileName}`;

      await FileSystem.writeAsStringAsync(fileUri, template);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert(
          isRTL ? "تم الحفظ" : "Saved",
          isRTL
            ? `تم حفظ القالب في: ${fileUri}`
            : `Template saved to: ${fileUri}`
        );
      }
    } catch (error) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "حدث خطأ في حفظ القالب" : "Error saving template"
      );
    }
  };

  const resetAndClose = () => {
    setCsvText("");
    setParsedMedications([]);
    setImportResult(null);
    setStep("input");
    onClose();
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(isRTL ? "ar-SA" : "en-US");
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={resetAndClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={resetAndClose} style={styles.closeButton}>
            <Ionicons
              name={isRTL ? "arrow-forward" : "arrow-back"}
              size={24}
              color={theme.colors.text.primary}
            />
          </TouchableOpacity>
          <Heading style={styles.title}>
            {isRTL ? "استيراد الأدوية" : "Bulk Import Medications"}
          </Heading>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {step === "input" && (
            <View>
              <Card style={styles.card} onPress={undefined} contentStyle={undefined}>
                <Text style={styles.sectionTitle}>
                  {isRTL ? "إرشادات الاستيراد" : "Import Instructions"}
                </Text>
                <Caption style={styles.instruction} numberOfLines={undefined}>
                  {isRTL
                    ? "1. قم بتنزيل القالب أدناه"
                    : "1. Download the template below"}
                </Caption>
                <Caption style={styles.instruction} numberOfLines={undefined}>
                  {isRTL
                    ? "2. املأ البيانات (الاسم، الجرعة، التكرار، تاريخ البدء)"
                    : "2. Fill in the data (Name, Dosage, Frequency, Start Date)"}
                </Caption>
                <Caption style={styles.instruction} numberOfLines={undefined}>
                  {isRTL
                    ? "3. الصق محتوى CSV في المربع أدناه"
                    : "3. Paste CSV content in the box below"}
                </Caption>
                <Caption style={styles.instruction} numberOfLines={undefined}>
                  {isRTL
                    ? "4. اضغط على 'تحليل' للمعاينة"
                    : "4. Click 'Parse' to preview"}
                </Caption>

                <Button
                  title={isRTL ? "تنزيل القالب" : "Download Template"}
                  onPress={handleDownloadTemplate}
                  style={styles.templateButton}
                  variant="outline"
                  icon={<Ionicons name="download" size={20} color={theme.colors.primary.main} />}
                  textStyle={styles.buttonText}
                />
              </Card>

              <Card style={styles.card} onPress={undefined} contentStyle={undefined}>
                <Text style={styles.sectionTitle}>
                  {isRTL ? "بيانات CSV" : "CSV Data"}
                </Text>
                <TextInput
                  style={styles.textInput}
                  value={csvText}
                  onChangeText={setCsvText}
                  placeholder={
                    isRTL
                      ? "الصق بيانات CSV هنا..."
                      : "Paste CSV data here..."
                  }
                  placeholderTextColor={theme.colors.text.secondary}
                  multiline
                  textAlignVertical="top"
                />
                <Button
                  title={isParsing ? "" : isRTL ? "تحليل" : "Parse"}
                  onPress={handleParseCSV}
                  style={styles.parseButton}
                  disabled={isParsing || !csvText.trim()}
                  loading={isParsing}
                  textStyle={styles.buttonText}
                />
              </Card>
            </View>
          )}

          {step === "preview" && (
            <View>
              <Card style={styles.card} onPress={undefined} contentStyle={undefined}>
                <Text style={styles.sectionTitle}>
                  {isRTL ? "معاينة الأدوية" : "Preview Medications"}
                </Text>
                {importResult && importResult.failed > 0 && (
                  <View style={styles.errorSummary}>
                    <Text style={styles.errorText}>
                      {isRTL
                        ? `تحذير: ${importResult.failed} صف فشل في التحليل`
                        : `Warning: ${importResult.failed} row(s) failed to parse`}
                    </Text>
                  </View>
                )}

                <Text style={styles.previewCount}>
                  {isRTL
                    ? `${parsedMedications.length} دواء جاهز للاستيراد`
                    : `${parsedMedications.length} medication(s) ready to import`}
                </Text>
              </Card>

              {parsedMedications.map((med, index) => (
                <Card key={index} style={styles.medicationCard} onPress={undefined} contentStyle={undefined}>
                  <View style={styles.medicationHeader}>
                    <Text style={styles.medicationName}>{med.name}</Text>
                    <Text style={styles.medicationDosage}>{med.dosage}</Text>
                  </View>
                  <View style={styles.medicationDetails}>
                    <Text style={styles.detailText}>
                      {isRTL ? "التكرار:" : "Frequency:"} {med.frequency}
                    </Text>
                    <Text style={styles.detailText}>
                      {isRTL ? "تاريخ البدء:" : "Start Date:"}{" "}
                      {formatDate(med.startDate)}
                    </Text>
                    {med.endDate && (
                      <Text style={styles.detailText}>
                        {isRTL ? "تاريخ الانتهاء:" : "End Date:"}{" "}
                        {formatDate(med.endDate)}
                      </Text>
                    )}
                    <Text style={styles.detailText}>
                      {isRTL ? "التذكيرات:" : "Reminders:"}{" "}
                      {med.reminders.map((r) => r.time).join(", ")}
                    </Text>
                    {med.notes && (
                      <Text style={styles.detailText}>
                        {isRTL ? "ملاحظات:" : "Notes:"} {med.notes}
                      </Text>
                    )}
                  </View>
                </Card>
              ))}

              <View style={styles.actionButtons}>
                <Button
                  title={isRTL ? "رجوع" : "Back"}
                  onPress={() => setStep("input")}
                  style={styles.backButton}
                  variant="outline"
                  textStyle={styles.buttonText}
                />
                <Button
                  title={isImporting ? "" : isRTL ? "استيراد" : "Import"}
                  onPress={handleImport}
                  style={styles.importButton}
                  disabled={isImporting}
                  loading={isImporting}
                  textStyle={styles.buttonText}
                />
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const getStyles = (theme: any, isRTL: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background.primary,
    },
    header: {
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: theme.spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: typeof theme.colors.border === "string" ? theme.colors.border : (theme.colors.border?.light || "#E2E8F0"),
    },
    closeButton: {
      padding: theme.spacing.sm,
    },
    title: {
      flex: 1,
      textAlign: "center",
    },
    placeholder: {
      width: 40,
    },
    content: {
      flex: 1,
      padding: theme.spacing.lg,
    },
    card: {
      marginBottom: theme.spacing.base,
    },
    sectionTitle: {
      ...theme.typography.heading,
      marginBottom: theme.spacing.base,
      color: theme.colors.text.primary,
    },
    instruction: {
      marginBottom: theme.spacing.sm,
      color: theme.colors.text.secondary,
    },
    templateButton: {
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      justifyContent: "center",
      marginTop: theme.spacing.base,
      gap: theme.spacing.sm,
    },
    textInput: {
      borderWidth: 1,
      borderColor: typeof theme.colors.border === "string" ? theme.colors.border : (theme.colors.border?.light || "#E2E8F0"),
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.base,
      minHeight: 200,
      color: theme.colors.text.primary,
      backgroundColor: theme.colors.background.secondary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: 14,
    },
    parseButton: {
      marginTop: theme.spacing.base,
    },
    buttonText: {
      color: theme.colors.background.primary,
      ...theme.typography.button,
    },
    errorSummary: {
      backgroundColor: (typeof theme.colors.error === "object" && theme.colors.error?.light) 
        ? theme.colors.error.light + "20" 
        : (theme.colors.accent?.error ? theme.colors.accent.error + "20" : "#FEE2E2"),
      padding: theme.spacing.base,
      borderRadius: theme.borderRadius.md,
      marginBottom: theme.spacing.base,
    },
    errorText: {
      color: (typeof theme.colors.error === "object" && theme.colors.error?.main) 
        ? theme.colors.error.main 
        : (theme.colors.accent?.error || "#EF4444"),
      ...theme.typography.caption,
    },
    previewCount: {
      ...theme.typography.body,
      color: theme.colors.text.secondary,
      marginTop: theme.spacing.sm,
    },
    medicationCard: {
      marginBottom: theme.spacing.base,
    },
    medicationHeader: {
      flexDirection: isRTL ? "row-reverse" : "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing.sm,
    },
    medicationName: {
      ...theme.typography.heading,
      fontSize: 18,
      color: theme.colors.text.primary,
    },
    medicationDosage: {
      ...theme.typography.body,
      color: theme.colors.primary.main,
      fontWeight: "600",
    },
    medicationDetails: {
      gap: theme.spacing.xs,
    },
    detailText: {
      ...theme.typography.body,
      color: theme.colors.text.secondary,
    },
    actionButtons: {
      flexDirection: isRTL ? "row-reverse" : "row",
      gap: theme.spacing.base,
      marginTop: theme.spacing.lg,
    },
    backButton: {
      flex: 1,
    },
    importButton: {
      flex: 1,
    },
  });
