import { router } from "expo-router";
import { ChevronDown, Plus, Trash2, X } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import TagInput from "@/app/components/TagInput";
import { Button } from "@/components/design-system";
import {
  Caption,
  Heading,
  Text as TypographyText,
} from "@/components/design-system/Typography";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { labResultService } from "@/lib/services/labResultService";
import type { LabResult, LabResultValue } from "@/types";
import { safeFormatDate } from "@/utils/dateFormat";
import { createThemedStyles, getTextStyle } from "@/utils/styles";

const COMMON_LABS: Array<{
  en: string;
  ar: string;
  testType: "blood" | "urine" | "imaging" | "other";
}> = [
  // Blood Tests
  {
    en: "Complete Blood Count (CBC)",
    ar: "فحص الدم الكامل",
    testType: "blood",
  },
  {
    en: "Basic Metabolic Panel (BMP)",
    ar: "لوحة التمثيل الغذائي الأساسية",
    testType: "blood",
  },
  {
    en: "Comprehensive Metabolic Panel (CMP)",
    ar: "لوحة التمثيل الغذائي الشاملة",
    testType: "blood",
  },
  { en: "Lipid Panel", ar: "لوحة الدهون", testType: "blood" },
  {
    en: "Liver Function Tests (LFT)",
    ar: "اختبارات وظائف الكبد",
    testType: "blood",
  },
  {
    en: "Thyroid Stimulating Hormone (TSH)",
    ar: "هرمون تحفيز الغدة الدرقية",
    testType: "blood",
  },
  {
    en: "Hemoglobin A1C (HbA1c)",
    ar: "الهيموجلوبين السكري",
    testType: "blood",
  },
  { en: "Vitamin D", ar: "فيتامين د", testType: "blood" },
  { en: "Vitamin B12", ar: "فيتامين ب12", testType: "blood" },
  { en: "Iron Studies", ar: "دراسات الحديد", testType: "blood" },
  { en: "Cholesterol Test", ar: "فحص الكوليسترول", testType: "blood" },
  { en: "Blood Glucose", ar: "سكر الدم", testType: "blood" },
  { en: "Creatinine", ar: "الكرياتينين", testType: "blood" },
  {
    en: "BUN (Blood Urea Nitrogen)",
    ar: "نيتروجين اليوريا في الدم",
    testType: "blood",
  },
  { en: "ALT (Alanine Aminotransferase)", ar: "إنزيم ALT", testType: "blood" },
  {
    en: "AST (Aspartate Aminotransferase)",
    ar: "إنزيم AST",
    testType: "blood",
  },
  {
    en: "C-Reactive Protein (CRP)",
    ar: "بروتين سي التفاعلي",
    testType: "blood",
  },
  {
    en: "Complete Blood Count with Differential",
    ar: "فحص الدم الكامل مع التفاضلي",
    testType: "blood",
  },
  { en: "Hemoglobin", ar: "الهيموجلوبين", testType: "blood" },
  { en: "Hematocrit", ar: "الهيماتوكريت", testType: "blood" },
  {
    en: "White Blood Cell Count (WBC)",
    ar: "عدد خلايا الدم البيضاء",
    testType: "blood",
  },
  { en: "Platelet Count", ar: "عدد الصفائح الدموية", testType: "blood" },
  { en: "Prothrombin Time (PT)", ar: "زمن البروثرومبين", testType: "blood" },
  {
    en: "Partial Thromboplastin Time (PTT)",
    ar: "زمن الثرومبوبلاستين الجزئي",
    testType: "blood",
  },
  {
    en: "Erythrocyte Sedimentation Rate (ESR)",
    ar: "معدل ترسيب كريات الدم الحمراء",
    testType: "blood",
  },
  { en: "Ferritin", ar: "الفيريتين", testType: "blood" },
  { en: "Folate", ar: "حمض الفوليك", testType: "blood" },
  { en: "Testosterone", ar: "التستوستيرون", testType: "blood" },
  { en: "Estrogen", ar: "الإستروجين", testType: "blood" },
  {
    en: "PSA (Prostate Specific Antigen)",
    ar: "مستضد البروستاتا النوعي",
    testType: "blood",
  },

  // Urine Tests
  { en: "Complete Urinalysis", ar: "تحليل البول الكامل", testType: "urine" },
  { en: "Urine Culture", ar: "زراعة البول", testType: "urine" },
  { en: "Urine Protein", ar: "بروتين البول", testType: "urine" },
  { en: "Urine Glucose", ar: "سكر البول", testType: "urine" },
  { en: "Urine Microalbumin", ar: "البول الدقيق", testType: "urine" },
  {
    en: "24-Hour Urine Collection",
    ar: "جمع البول لمدة 24 ساعة",
    testType: "urine",
  },
  { en: "Urine Drug Screen", ar: "فحص المخدرات في البول", testType: "urine" },
  { en: "Urine Pregnancy Test", ar: "فحص الحمل في البول", testType: "urine" },

  // Imaging Tests
  { en: "Chest X-Ray", ar: "أشعة الصدر", testType: "imaging" },
  { en: "ECG/EKG", ar: "تخطيط القلب", testType: "imaging" },
  {
    en: "Echocardiogram",
    ar: "فحص القلب بالموجات فوق الصوتية",
    testType: "imaging",
  },
  { en: "Mammogram", ar: "تصوير الثدي", testType: "imaging" },
  {
    en: "Abdominal Ultrasound",
    ar: "الموجات فوق الصوتية للبطن",
    testType: "imaging",
  },
  {
    en: "Pelvic Ultrasound",
    ar: "الموجات فوق الصوتية للحوض",
    testType: "imaging",
  },
  { en: "CT Scan - Head", ar: "التصوير المقطعي للرأس", testType: "imaging" },
  { en: "CT Scan - Chest", ar: "التصوير المقطعي للصدر", testType: "imaging" },
  { en: "CT Scan - Abdomen", ar: "التصوير المقطعي للبطن", testType: "imaging" },
  {
    en: "MRI - Head",
    ar: "التصوير بالرنين المغناطيسي للرأس",
    testType: "imaging",
  },
  {
    en: "MRI - Spine",
    ar: "التصوير بالرنين المغناطيسي للعمود الفقري",
    testType: "imaging",
  },
  {
    en: "Bone Density Scan (DEXA)",
    ar: "فحص كثافة العظام",
    testType: "imaging",
  },
  { en: "X-Ray - Extremity", ar: "أشعة الأطراف", testType: "imaging" },
  { en: "X-Ray - Spine", ar: "أشعة العمود الفقري", testType: "imaging" },

  // Other Tests
  { en: "Pap Smear", ar: "مسحة عنق الرحم", testType: "other" },
  { en: "Stool Culture", ar: "زراعة البراز", testType: "other" },
  {
    en: "Stool Occult Blood",
    ar: "فحص الدم الخفي في البراز",
    testType: "other",
  },
  { en: "Throat Culture", ar: "زراعة الحلق", testType: "other" },
  { en: "Sputum Culture", ar: "زراعة البلغم", testType: "other" },
  { en: "Skin Biopsy", ar: "خزعة الجلد", testType: "other" },
  { en: "Allergy Test", ar: "فحص الحساسية", testType: "other" },
  { en: "Pulmonary Function Test", ar: "فحص وظائف الرئة", testType: "other" },
];

type EditableLabResultValue = LabResultValue & { localId: string };

const createResultDraft = (): EditableLabResultValue => ({
  localId: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  name: "",
  value: "",
  unit: "",
  referenceRange: "",
});

const hasResultValue = (value: LabResultValue["value"]): boolean =>
  value === 0 || (typeof value === "string" ? value.trim().length > 0 : true);

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Unknown error";
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: screen-level form with many inputs and conditional sections.
export default function AddLabResultScreen() {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const { theme: currentTheme } = useTheme();
  const isRTL = i18n.language === "ar";

  const [testName, setTestName] = useState("");
  const [selectedCommonLab, setSelectedCommonLab] = useState<string | null>(
    null
  );
  const [showCommonLabsDropdown, setShowCommonLabsDropdown] = useState(false);
  const [testType, setTestType] = useState<LabResult["testType"]>("blood");
  const [testDate] = useState(new Date());
  const [facility, setFacility] = useState("");
  const [orderedBy, setOrderedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [results, setResults] = useState<EditableLabResultValue[]>([
    createResultDraft(),
  ]);
  const [saving, setSaving] = useState(false);

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: style map has many conditional branches.
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
    },
    textArea: {
      ...getTextStyle(theme, "body", "regular", theme.colors.text.primary),
      borderWidth: 1,
      borderColor: theme.colors.border.medium,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.base,
      backgroundColor: theme.colors.background.secondary,
      minHeight: 100,
      textAlignVertical: "top",
    },
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
    },
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
    inputContainer: {
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    inputWithDropdown: {
      flex: 1,
    },
    dropdownButton: {
      padding: theme.spacing.base,
      borderWidth: 1,
      borderColor: theme.colors.border.medium,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.background.secondary,
      justifyContent: "center",
      alignItems: "center",
    },
    dropdownModal: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0, 0, 0, 0.5)",
    },
    dropdownModalContent: {
      backgroundColor: theme.colors.background.primary,
      borderTopLeftRadius: theme.borderRadius.lg,
      borderTopRightRadius: theme.borderRadius.lg,
      maxHeight: "70%",
      paddingBottom: theme.spacing.base,
    },
    dropdownModalHeader: {
      flexDirection: isRTL ? "row-reverse" : "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: theme.spacing.base,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.light,
    },
    dropdownList: {
      padding: theme.spacing.base,
    },
    dropdownItem: {
      padding: theme.spacing.base,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.light,
    },
    dropdownItemText: {
      ...getTextStyle(theme, "body", "regular", theme.colors.text.primary),
    },
  }))(currentTheme);

  const testTypes: Array<{ value: LabResult["testType"]; label: string }> = [
    { value: "blood", label: isRTL ? "فحص الدم" : "Blood" },
    { value: "urine", label: isRTL ? "فحص البول" : "Urine" },
    { value: "imaging", label: isRTL ? "التصوير" : "Imaging" },
    { value: "other", label: isRTL ? "أخرى" : "Other" },
  ];

  // Filter common labs based on selected test type
  const filteredCommonLabs = COMMON_LABS.filter(
    (lab) => lab.testType === testType
  );

  // Clear selected lab when test type changes
  const handleTestTypeChange = (newTestType: LabResult["testType"]) => {
    setTestType(newTestType);
    if (selectedCommonLab) {
      const selectedLab = COMMON_LABS.find(
        (lab) => lab.en === selectedCommonLab
      );
      if (selectedLab && selectedLab.testType !== newTestType) {
        setSelectedCommonLab(null);
        setTestName("");
      }
    }
  };

  const handleAddResult = () => {
    setResults((prevResults) => [...prevResults, createResultDraft()]);
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
    setResults((prevResults) =>
      prevResults.map((result, resultIndex) =>
        resultIndex === index ? { ...result, [field]: value } : result
      )
    );
  };

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: save flow handles validation, normalization, and persistence.
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

    const validResults = results
      .filter((result) => result.name.trim() && hasResultValue(result.value))
      .map(({ localId: _localId, ...result }) => result);

    if (validResults.length === 0) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL
          ? "يرجى إدخال نتيجة واحدة على الأقل"
          : "Please enter at least one result"
      );
      return;
    }

    setSaving(true);
    try {
      // Analyze results and set status
      const analyzedResults = validResults.map((result) => {
        const numericValue =
          typeof result.value === "string"
            ? Number.parseFloat(result.value)
            : result.value;

        const status = labResultService.analyzeResultValue(
          result,
          typeof numericValue === "number" && !Number.isNaN(numericValue)
            ? numericValue
            : undefined
        );

        return {
          ...result,
          value:
            typeof numericValue === "number" && !Number.isNaN(numericValue)
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
        isRTL
          ? "تم إضافة نتيجة المختبر بنجاح"
          : "Lab result added successfully",
        [
          {
            text: isRTL ? "حسناً" : "OK",
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
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
        <Heading
          level={5}
          style={[styles.label, { marginBottom: 0 }, isRTL && styles.rtlText]}
        >
          {isRTL ? "إضافة نتيجة مختبر" : "Add Lab Result"}
        </Heading>
        <TouchableOpacity onPress={() => router.back()}>
          <X color={currentTheme.colors.text.primary} size={24} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Test Name */}
        <View style={styles.fieldContainer}>
          <TypographyText
            style={[
              styles.label,
              { marginBottom: currentTheme.spacing.xs },
              isRTL && styles.rtlText,
            ]}
          >
            {isRTL ? "اسم الاختبار" : "Test Name"} *
          </TypographyText>
          <View style={styles.inputContainer}>
            <TextInput
              onChangeText={(text) => {
                setTestName(text);
                // Clear selected common lab if user types custom text
                if (
                  selectedCommonLab &&
                  text !==
                    (isRTL
                      ? COMMON_LABS.find((l) => l.en === selectedCommonLab)?.ar
                      : selectedCommonLab)
                ) {
                  setSelectedCommonLab(null);
                }
              }}
              placeholder={
                isRTL ? "مثال: فحص الدم الكامل" : "e.g., Complete Blood Count"
              }
              placeholderTextColor={currentTheme.colors.text.secondary}
              style={[
                styles.input,
                styles.inputWithDropdown,
                isRTL && styles.rtlText,
              ]}
              value={testName}
            />
            <TouchableOpacity
              onPress={() => setShowCommonLabsDropdown(true)}
              style={styles.dropdownButton}
            >
              <ChevronDown color={currentTheme.colors.text.primary} size={20} />
            </TouchableOpacity>
          </View>
          <Caption numberOfLines={2} style={[styles.rtlText, { marginTop: 4 }]}>
            {isRTL
              ? "أو اختر من القائمة المنسدلة للفحوصات الشائعة"
              : "Or select from common lab tests dropdown"}
          </Caption>
        </View>

        {/* Test Type */}
        <View style={styles.fieldContainer}>
          <TypographyText
            style={[
              styles.label,
              { marginBottom: currentTheme.spacing.xs },
              isRTL && styles.rtlText,
            ]}
          >
            {isRTL ? "نوع الاختبار" : "Test Type"} *
          </TypographyText>
          <View style={styles.typeSelector}>
            {testTypes.map((type) => (
              <TouchableOpacity
                key={type.value}
                onPress={() => handleTestTypeChange(type.value)}
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
          <TypographyText
            style={[
              styles.label,
              { marginBottom: currentTheme.spacing.xs },
              isRTL && styles.rtlText,
            ]}
          >
            {isRTL ? "تاريخ الاختبار" : "Test Date"} *
          </TypographyText>
          <TextInput
            editable={false}
            placeholder={isRTL ? "تاريخ الاختبار" : "Test Date"}
            placeholderTextColor={currentTheme.colors.text.secondary}
            style={[styles.input, isRTL && styles.rtlText]}
            value={safeFormatDate(testDate)}
          />
          <Caption numberOfLines={2} style={[styles.rtlText, { marginTop: 4 }]}>
            {isRTL
              ? "سيتم استخدام تاريخ اليوم. يمكنك التعديل لاحقاً."
              : "Using today's date. You can edit later."}
          </Caption>
        </View>

        {/* Facility */}
        <View style={styles.fieldContainer}>
          <TypographyText
            style={[
              styles.label,
              { marginBottom: currentTheme.spacing.xs },
              isRTL && styles.rtlText,
            ]}
          >
            {isRTL ? "المنشأة" : "Facility"} ({isRTL ? "اختياري" : "Optional"})
          </TypographyText>
          <TextInput
            onChangeText={setFacility}
            placeholder={
              isRTL ? "اسم المختبر أو المستشفى" : "Lab or hospital name"
            }
            placeholderTextColor={currentTheme.colors.text.secondary}
            style={[styles.input, isRTL && styles.rtlText]}
            value={facility}
          />
        </View>

        {/* Ordered By */}
        <View style={styles.fieldContainer}>
          <TypographyText
            style={[
              styles.label,
              { marginBottom: currentTheme.spacing.xs },
              isRTL && styles.rtlText,
            ]}
          >
            {isRTL ? "طلب من" : "Ordered By"} ({isRTL ? "اختياري" : "Optional"})
          </TypographyText>
          <TextInput
            onChangeText={setOrderedBy}
            placeholder={isRTL ? "اسم الطبيب" : "Doctor name"}
            placeholderTextColor={currentTheme.colors.text.secondary}
            style={[styles.input, isRTL && styles.rtlText]}
            value={orderedBy}
          />
        </View>

        {/* Results */}
        <View style={styles.fieldContainer}>
          <TypographyText
            style={[
              styles.label,
              { marginBottom: currentTheme.spacing.xs },
              isRTL && styles.rtlText,
            ]}
          >
            {isRTL ? "النتائج" : "Results"} *
          </TypographyText>
          {results.map((result, index) => (
            <View key={result.localId} style={styles.resultItem}>
              <View style={styles.resultItemHeader}>
                <TypographyText
                  style={[styles.label, { marginBottom: 0 }]}
                  weight="semibold"
                >
                  {isRTL ? `نتيجة ${index + 1}` : `Result ${index + 1}`}
                </TypographyText>
                {results.length > 1 && (
                  <TouchableOpacity
                    onPress={() => handleRemoveResult(index)}
                    style={styles.deleteButton}
                  >
                    <Trash2
                      color={currentTheme.colors.accent.error}
                      size={20}
                    />
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.resultItemRow}>
                <TextInput
                  onChangeText={(text) =>
                    handleUpdateResult(index, "name", text)
                  }
                  placeholder={isRTL ? "اسم القيمة" : "Value name"}
                  placeholderTextColor={currentTheme.colors.text.secondary}
                  style={[styles.resultInput, isRTL && styles.rtlText]}
                  value={result.name}
                />
              </View>
              <View style={styles.resultItemRow}>
                <TextInput
                  keyboardType="decimal-pad"
                  onChangeText={(text) => {
                    const num = Number.parseFloat(text);
                    handleUpdateResult(
                      index,
                      "value",
                      Number.isNaN(num) ? text : num
                    );
                  }}
                  placeholder={isRTL ? "القيمة" : "Value"}
                  placeholderTextColor={currentTheme.colors.text.secondary}
                  style={[
                    styles.resultInput,
                    { flex: 2 },
                    isRTL && styles.rtlText,
                  ]}
                  value={String(result.value)}
                />
                <TextInput
                  onChangeText={(text) =>
                    handleUpdateResult(index, "unit", text)
                  }
                  placeholder={isRTL ? "الوحدة" : "Unit"}
                  placeholderTextColor={currentTheme.colors.text.secondary}
                  style={[
                    styles.resultInput,
                    { flex: 1 },
                    isRTL && styles.rtlText,
                  ]}
                  value={result.unit}
                />
              </View>
              <View style={styles.resultItemRow}>
                <TextInput
                  onChangeText={(text) =>
                    handleUpdateResult(index, "referenceRange", text)
                  }
                  placeholder={
                    isRTL
                      ? "النطاق المرجعي (مثال: 70-100)"
                      : "Reference range (e.g., 70-100)"
                  }
                  placeholderTextColor={currentTheme.colors.text.secondary}
                  style={[styles.resultInput, isRTL && styles.rtlText]}
                  value={result.referenceRange}
                />
              </View>
            </View>
          ))}
          <TouchableOpacity
            onPress={handleAddResult}
            style={styles.addResultButton}
          >
            <Plus color={currentTheme.colors.primary.main} size={20} />
            <TypographyText style={[{ marginLeft: currentTheme.spacing.xs }]}>
              {isRTL ? "إضافة نتيجة أخرى" : "Add Another Result"}
            </TypographyText>
          </TouchableOpacity>
        </View>

        {/* Tags */}
        <View style={styles.fieldContainer}>
          <TypographyText
            style={[
              styles.label,
              { marginBottom: currentTheme.spacing.xs },
              isRTL && styles.rtlText,
            ]}
          >
            {isRTL ? "العلامات" : "Tags"} ({isRTL ? "اختياري" : "Optional"})
          </TypographyText>
          <TagInput
            maxTags={10}
            onChangeTags={setTags}
            placeholder={
              isRTL ? "أضف علامات للتنظيم" : "Add tags for organization"
            }
            showSuggestions={true}
            tags={tags}
          />
        </View>

        {/* Notes */}
        <View style={styles.fieldContainer}>
          <TypographyText
            style={[
              styles.label,
              { marginBottom: currentTheme.spacing.xs },
              isRTL && styles.rtlText,
            ]}
          >
            {isRTL ? "ملاحظات" : "Notes"} ({isRTL ? "اختياري" : "Optional"})
          </TypographyText>
          <TextInput
            multiline
            numberOfLines={4}
            onChangeText={setNotes}
            placeholder={
              isRTL ? "أضف ملاحظات إضافية..." : "Add additional notes..."
            }
            placeholderTextColor={currentTheme.colors.text.secondary}
            style={[styles.textArea, isRTL && styles.rtlText]}
            value={notes}
          />
        </View>
      </ScrollView>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          disabled={saving}
          onPress={() => router.back()}
          style={{ flex: 1 }}
          textStyle={{}}
          title={isRTL ? "إلغاء" : "Cancel"}
          variant="outline"
        />
        <Button
          disabled={saving}
          onPress={handleSave}
          style={{ flex: 1 }}
          textStyle={{}}
          title={isRTL ? "حفظ" : "Save"}
          variant="primary"
        />
      </View>

      {/* Common Labs Dropdown Modal */}
      <Modal
        animationType="slide"
        onRequestClose={() => setShowCommonLabsDropdown(false)}
        transparent
        visible={showCommonLabsDropdown}
      >
        <View style={styles.dropdownModal}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setShowCommonLabsDropdown(false)}
            style={{ flex: 1 }}
          />
          <View style={styles.dropdownModalContent}>
            <View style={styles.dropdownModalHeader}>
              <View style={{ flex: 1 }}>
                <Heading
                  level={5}
                  style={[
                    styles.label,
                    { marginBottom: 0 },
                    isRTL && styles.rtlText,
                  ]}
                >
                  {isRTL ? "الفحوصات الشائعة" : "Common Lab Tests"}
                </Heading>
                <Caption
                  numberOfLines={1}
                  style={[styles.rtlText, { marginTop: 4 }]}
                >
                  {
                    testTypes.find(
                      (typeOption) => typeOption.value === testType
                    )?.label
                  }
                </Caption>
              </View>
              <TouchableOpacity
                onPress={() => setShowCommonLabsDropdown(false)}
              >
                <X color={currentTheme.colors.text.primary} size={24} />
              </TouchableOpacity>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.dropdownList}
            >
              {filteredCommonLabs.length === 0 ? (
                <View style={styles.dropdownItem}>
                  <Text
                    style={[styles.dropdownItemText, isRTL && styles.rtlText]}
                  >
                    {isRTL
                      ? "لا توجد فحوصات شائعة لهذا النوع"
                      : "No common tests for this type"}
                  </Text>
                </View>
              ) : (
                filteredCommonLabs.map((lab) => {
                  const labLabel = isRTL ? lab.ar : lab.en;
                  const isSelected = selectedCommonLab === lab.en;
                  return (
                    <TouchableOpacity
                      key={lab.en}
                      onPress={() => {
                        setSelectedCommonLab(lab.en);
                        setTestName(labLabel);
                        setShowCommonLabsDropdown(false);
                      }}
                      style={[
                        styles.dropdownItem,
                        isSelected && {
                          backgroundColor: `${currentTheme.colors.primary.main}20`,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dropdownItemText,
                          isRTL && styles.rtlText,
                          isSelected && {
                            color: currentTheme.colors.primary.main,
                            fontWeight: "600",
                          },
                        ]}
                      >
                        {labLabel}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
