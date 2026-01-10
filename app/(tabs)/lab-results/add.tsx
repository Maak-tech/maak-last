import { router } from "expo-router";
import { Plus, Trash2, X } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { labResultService } from "@/lib/services/labResultService";
import type { LabResult, LabResultValue } from "@/types";
import { createThemedStyles, getTextStyle } from "@/utils/styles";
import { Button } from "@/components/design-system";
import { Caption, Heading, Text as TypographyText } from "@/components/design-system/Typography";
import TagInput from "@/app/components/TagInput";

export default function AddLabResultScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isRTL = i18n.language === "ar";

  const [testName, setTestName] = useState("");
  const [testType, setTestType] = useState<LabResult["testType"]>("blood");
  const [testDate, setTestDate] = useState(new Date());
  const [facility, setFacility] = useState("");
  const [orderedBy, setOrderedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [results, setResults] = useState<LabResultValue[]>([
    { name: "", value: "", unit: "", referenceRange: "" },
  ]);
  const [saving, setSaving] = useState(false);

  const styles = createThemedStyles((theme) => ({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background.primary,
    },
    header: {
      flexDirection: isRTL ? "row-reverse" : "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: theme.spacing.base,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.light,
    },
    content: {
      padding: theme.spacing.base,
    },
    fieldContainer: {
      marginBottom: theme.spacing.base,
    },
    label: getTextStyle(theme, "body", "semibold", theme.colors.text.primary),
    input: {
      ...getTextStyle(theme, "body", "regular", theme.colors.text.primary),
      borderWidth: 1,
      borderColor: theme.colors.border.medium,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.base,
      backgroundColor: theme.colors.background.secondary,
    } as any,
    textArea: {
      ...getTextStyle(theme, "body", "regular", theme.colors.text.primary),
      borderWidth: 1,
      borderColor: theme.colors.border.medium,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.base,
      backgroundColor: theme.colors.background.secondary,
      minHeight: 100,
      textAlignVertical: "top",
    } as any,
    typeSelector: {
      flexDirection: isRTL ? "row-reverse" : "row",
      gap: theme.spacing.xs,
      flexWrap: "wrap",
    },
    typeButton: {
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.full,
      borderWidth: 1,
      borderColor: theme.colors.border.medium,
      backgroundColor: theme.colors.background.secondary,
    },
    typeButtonActive: {
      backgroundColor: theme.colors.primary.main,
      borderColor: theme.colors.primary.main,
    },
    typeButtonText: {
      ...getTextStyle(theme, "caption", "medium", theme.colors.text.secondary),
      fontSize: 12,
    },
    typeButtonTextActive: {
      color: theme.colors.neutral.white,
    },
    resultItem: {
      borderWidth: 1,
      borderColor: theme.colors.border.medium,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.base,
      marginBottom: theme.spacing.base,
      backgroundColor: theme.colors.background.secondary,
    },
    resultItemHeader: {
      flexDirection: isRTL ? "row-reverse" : "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing.sm,
    },
    resultItemRow: {
      flexDirection: isRTL ? "row-reverse" : "row",
      gap: theme.spacing.xs,
      marginBottom: theme.spacing.xs,
    },
    resultInput: {
      flex: 1,
      ...getTextStyle(theme, "body", "regular", theme.colors.text.primary),
      borderWidth: 1,
      borderColor: theme.colors.border.medium,
      borderRadius: theme.borderRadius.sm,
      padding: theme.spacing.sm,
      backgroundColor: theme.colors.background.primary,
    } as any,
    deleteButton: {
      padding: theme.spacing.xs,
    },
    addResultButton: {
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      justifyContent: "center",
      padding: theme.spacing.base,
      borderWidth: 1,
      borderColor: theme.colors.border.medium,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.background.secondary,
      marginBottom: theme.spacing.base,
    },
    actions: {
      flexDirection: isRTL ? "row-reverse" : "row",
      gap: theme.spacing.base,
      padding: theme.spacing.base,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border.light,
    },
    rtlText: {
      textAlign: isRTL ? "right" : "left",
    },
  }))(theme) as any;

  const testTypes: Array<{ value: LabResult["testType"]; label: string }> = [
    { value: "blood", label: isRTL ? "فحص الدم" : "Blood" },
    { value: "urine", label: isRTL ? "فحص البول" : "Urine" },
    { value: "imaging", label: isRTL ? "التصوير" : "Imaging" },
    { value: "other", label: isRTL ? "أخرى" : "Other" },
  ];

  const handleAddResult = () => {
    setResults([
      ...results,
      { name: "", value: "", unit: "", referenceRange: "" },
    ]);
  };

  const handleRemoveResult = (index: number) => {
    if (results.length > 1) {
      setResults(results.filter((_, i) => i !== index));
    }
  };

  const handleUpdateResult = (
    index: number,
    field: keyof LabResultValue,
    value: string | number
  ) => {
    const updated = [...results];
    updated[index] = { ...updated[index], [field]: value };
    setResults(updated);
  };

  const handleSave = async () => {
    if (!user) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "يجب تسجيل الدخول" : "You must be logged in"
      );
      return;
    }

    if (!testName.trim()) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "يرجى إدخال اسم الاختبار" : "Please enter test name"
      );
      return;
    }

    const validResults = results.filter(
      (r) => r.name.trim() && (r.value || r.value === 0)
    );

    if (validResults.length === 0) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "يرجى إدخال نتيجة واحدة على الأقل" : "Please enter at least one result"
      );
      return;
    }

    setSaving(true);
    try {
      // Analyze results and set status
      const analyzedResults = validResults.map((result) => {
        const numericValue =
          typeof result.value === "string"
            ? parseFloat(result.value)
            : result.value;

        const status = labResultService.analyzeResultValue(
          result,
          typeof numericValue === "number" && !isNaN(numericValue)
            ? numericValue
            : undefined
        );

        return {
          ...result,
          value: typeof numericValue === "number" && !isNaN(numericValue)
            ? numericValue
            : result.value,
          status,
        };
      });

      await labResultService.addLabResult(user.id, {
        userId: user.id,
        testName: testName.trim(),
        testType,
        testDate,
        facility: facility.trim() || undefined,
        orderedBy: orderedBy.trim() || undefined,
        notes: notes.trim() || undefined,
        results: analyzedResults,
        tags: tags.length > 0 ? tags : undefined,
      });

      Alert.alert(
        isRTL ? "نجح" : "Success",
        isRTL ? "تم إضافة نتيجة المختبر بنجاح" : "Lab result added successfully",
        [
          {
            text: isRTL ? "حسناً" : "OK",
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error: any) {
      console.error("Error adding lab result:", error);
      const errorMessage = error?.message || "Unknown error";
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL 
          ? `فشل إضافة نتيجة المختبر: ${errorMessage}`
          : `Failed to add lab result: ${errorMessage}`
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Heading level={5} style={[styles.label, { marginBottom: 0 }, isRTL && styles.rtlText]}>
          {isRTL ? "إضافة نتيجة مختبر" : "Add Lab Result"}
        </Heading>
        <TouchableOpacity onPress={() => router.back()}>
          <X size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Test Name */}
        <View style={styles.fieldContainer}>
          <TypographyText style={[styles.label, { marginBottom: theme.spacing.xs }, isRTL && styles.rtlText]}>
            {isRTL ? "اسم الاختبار" : "Test Name"} *
          </TypographyText>
          <TextInput
            style={[styles.input, isRTL && styles.rtlText]}
            value={testName}
            onChangeText={setTestName}
            placeholder={isRTL ? "مثال: فحص الدم الكامل" : "e.g., Complete Blood Count"}
            placeholderTextColor={theme.colors.text.secondary}
          />
        </View>

        {/* Test Type */}
        <View style={styles.fieldContainer}>
          <TypographyText style={[styles.label, { marginBottom: theme.spacing.xs }, isRTL && styles.rtlText]}>
            {isRTL ? "نوع الاختبار" : "Test Type"} *
          </TypographyText>
          <View style={styles.typeSelector}>
            {testTypes.map((type) => (
              <TouchableOpacity
                key={type.value}
                onPress={() => setTestType(type.value)}
                style={[
                  styles.typeButton,
                  testType === type.value && styles.typeButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    testType === type.value && styles.typeButtonTextActive,
                  ]}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Test Date */}
        <View style={styles.fieldContainer}>
          <TypographyText style={[styles.label, { marginBottom: theme.spacing.xs }, isRTL && styles.rtlText]}>
            {isRTL ? "تاريخ الاختبار" : "Test Date"} *
          </TypographyText>
          <TextInput
            style={[styles.input, isRTL && styles.rtlText]}
            value={testDate.toLocaleDateString()}
            editable={false}
            placeholder={isRTL ? "تاريخ الاختبار" : "Test Date"}
            placeholderTextColor={theme.colors.text.secondary}
          />
          <Caption style={[styles.rtlText, { marginTop: 4 }]} numberOfLines={2}>
            {isRTL
              ? "سيتم استخدام تاريخ اليوم. يمكنك التعديل لاحقاً."
              : "Using today's date. You can edit later."}
          </Caption>
        </View>

        {/* Facility */}
        <View style={styles.fieldContainer}>
          <TypographyText style={[styles.label, { marginBottom: theme.spacing.xs }, isRTL && styles.rtlText]}>
            {isRTL ? "المنشأة" : "Facility"} ({isRTL ? "اختياري" : "Optional"})
          </TypographyText>
          <TextInput
            style={[styles.input, isRTL && styles.rtlText]}
            value={facility}
            onChangeText={setFacility}
            placeholder={isRTL ? "اسم المختبر أو المستشفى" : "Lab or hospital name"}
            placeholderTextColor={theme.colors.text.secondary}
          />
        </View>

        {/* Ordered By */}
        <View style={styles.fieldContainer}>
          <TypographyText style={[styles.label, { marginBottom: theme.spacing.xs }, isRTL && styles.rtlText]}>
            {isRTL ? "طلب من" : "Ordered By"} ({isRTL ? "اختياري" : "Optional"})
          </TypographyText>
          <TextInput
            style={[styles.input, isRTL && styles.rtlText]}
            value={orderedBy}
            onChangeText={setOrderedBy}
            placeholder={isRTL ? "اسم الطبيب" : "Doctor name"}
            placeholderTextColor={theme.colors.text.secondary}
          />
        </View>

        {/* Results */}
        <View style={styles.fieldContainer}>
          <TypographyText style={[styles.label, { marginBottom: theme.spacing.xs }, isRTL && styles.rtlText]}>
            {isRTL ? "النتائج" : "Results"} *
          </TypographyText>
          {results.map((result, index) => (
            <View key={index} style={styles.resultItem}>
              <View style={styles.resultItemHeader}>
                <TypographyText weight="semibold" style={[styles.label, { marginBottom: 0 }]}>
                  {isRTL ? `نتيجة ${index + 1}` : `Result ${index + 1}`}
                </TypographyText>
                {results.length > 1 && (
                  <TouchableOpacity
                    onPress={() => handleRemoveResult(index)}
                    style={styles.deleteButton}
                  >
                    <Trash2 size={20} color={theme.colors.accent.error} />
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.resultItemRow}>
                <TextInput
                  style={[styles.resultInput, isRTL && styles.rtlText]}
                  placeholder={isRTL ? "اسم القيمة" : "Value name"}
                  placeholderTextColor={theme.colors.text.secondary}
                  value={result.name}
                  onChangeText={(text) => handleUpdateResult(index, "name", text)}
                />
              </View>
              <View style={styles.resultItemRow}>
                <TextInput
                  style={[styles.resultInput, { flex: 2 }, isRTL && styles.rtlText]}
                  placeholder={isRTL ? "القيمة" : "Value"}
                  placeholderTextColor={theme.colors.text.secondary}
                  value={String(result.value)}
                  onChangeText={(text) => {
                    const num = parseFloat(text);
                    handleUpdateResult(
                      index,
                      "value",
                      !isNaN(num) ? num : text
                    );
                  }}
                  keyboardType="decimal-pad"
                />
                <TextInput
                  style={[styles.resultInput, { flex: 1 }, isRTL && styles.rtlText]}
                  placeholder={isRTL ? "الوحدة" : "Unit"}
                  placeholderTextColor={theme.colors.text.secondary}
                  value={result.unit}
                  onChangeText={(text) => handleUpdateResult(index, "unit", text)}
                />
              </View>
              <View style={styles.resultItemRow}>
                <TextInput
                  style={[styles.resultInput, isRTL && styles.rtlText]}
                  placeholder={isRTL ? "النطاق المرجعي (مثال: 70-100)" : "Reference range (e.g., 70-100)"}
                  placeholderTextColor={theme.colors.text.secondary}
                  value={result.referenceRange}
                  onChangeText={(text) =>
                    handleUpdateResult(index, "referenceRange", text)
                  }
                />
              </View>
            </View>
          ))}
          <TouchableOpacity
            onPress={handleAddResult}
            style={styles.addResultButton}
          >
            <Plus size={20} color={theme.colors.primary.main} />
            <TypographyText style={[{ marginLeft: theme.spacing.xs }]}>
              {isRTL ? "إضافة نتيجة أخرى" : "Add Another Result"}
            </TypographyText>
          </TouchableOpacity>
        </View>

        {/* Tags */}
        <View style={styles.fieldContainer}>
          <TypographyText style={[styles.label, { marginBottom: theme.spacing.xs }, isRTL && styles.rtlText]}>
            {isRTL ? "العلامات" : "Tags"} ({isRTL ? "اختياري" : "Optional"})
          </TypographyText>
          <TagInput
            tags={tags}
            onChangeTags={setTags}
            placeholder={
              isRTL
                ? "أضف علامات للتنظيم"
                : "Add tags for organization"
            }
            maxTags={10}
            showSuggestions={true}
          />
        </View>

        {/* Notes */}
        <View style={styles.fieldContainer}>
          <TypographyText style={[styles.label, { marginBottom: theme.spacing.xs }, isRTL && styles.rtlText]}>
            {isRTL ? "ملاحظات" : "Notes"} ({isRTL ? "اختياري" : "Optional"})
          </TypographyText>
          <TextInput
            style={[styles.textArea, isRTL && styles.rtlText]}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            placeholder={isRTL ? "أضف ملاحظات إضافية..." : "Add additional notes..."}
            placeholderTextColor={theme.colors.text.secondary}
          />
        </View>
      </ScrollView>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          variant="outline"
          title={isRTL ? "إلغاء" : "Cancel"}
          onPress={() => router.back()}
          style={{ flex: 1 }}
          textStyle={{}}
          disabled={saving}
        />
        <Button
          variant="primary"
          title={isRTL ? "حفظ" : "Save"}
          onPress={handleSave}
          style={{ flex: 1 }}
          textStyle={{}}
          disabled={saving}
        />
      </View>
    </SafeAreaView>
  );
}
