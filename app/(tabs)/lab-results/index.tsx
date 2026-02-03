import { router } from "expo-router";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  TestTube,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  type StyleProp,
  Text,
  type TextStyle,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import { Button, Card } from "@/components/design-system";
import { Badge } from "@/components/design-system/AdditionalComponents";
import {
  Caption,
  Heading,
  Text as TypographyText,
} from "@/components/design-system/Typography";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { labResultService } from "@/lib/services/labResultService";
import type { LabResult } from "@/types";
import { safeFormatDate } from "@/utils/dateFormat";
import { createThemedStyles, getTextStyle } from "@/utils/styles";

export default function LabResultsScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isRTL = i18n.language === "ar";

  const [labResults, setLabResults] = useState<LabResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedResult, setSelectedResult] = useState<LabResult | null>(null);
  const [filterType, setFilterType] = useState<LabResult["testType"] | "all">(
    "all"
  );

  const styles = createThemedStyles((theme) => ({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background.primary,
    },
    content: {
      flex: 1,
    },
    header: {
      flexDirection: isRTL ? "row-reverse" : "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.base,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.light,
    },
    headerTitle: {
      ...getTextStyle(theme, "heading", "bold", theme.colors.text.primary),
      fontSize: 24,
    },
    addButton: {
      backgroundColor: theme.colors.primary.main,
      borderRadius: theme.borderRadius.full,
      width: 40,
      height: 40,
      justifyContent: "center",
      alignItems: "center",
    },
    filterContainer: {
      flexDirection: isRTL ? "row-reverse" : "row",
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.sm,
      gap: theme.spacing.xs,
    },
    filterChip: {
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.borderRadius.full,
      borderWidth: 1,
      borderColor: theme.colors.border.light,
      backgroundColor: theme.colors.background.secondary,
    },
    filterChipActive: {
      backgroundColor: theme.colors.primary.main,
      borderColor: theme.colors.primary.main,
    },
    filterChipText: {
      ...getTextStyle(theme, "caption", "medium", theme.colors.text.secondary),
      fontSize: 12,
    },
    filterChipTextActive: {
      color: theme.colors.neutral.white,
    },
    resultsList: {
      padding: theme.spacing.base,
      gap: theme.spacing.base,
    },
    resultCard: {
      marginBottom: theme.spacing.base,
    },
    resultHeader: {
      flexDirection: isRTL ? "row-reverse" : "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: theme.spacing.sm,
    },
    resultTitle: {
      ...getTextStyle(theme, "subheading", "bold", theme.colors.text.primary),
      flex: 1,
    },
    resultDate: {
      ...getTextStyle(theme, "caption", "regular", theme.colors.text.secondary),
      marginTop: 4,
    },
    resultMeta: {
      flexDirection: isRTL ? "row-reverse" : "row",
      gap: theme.spacing.xs,
      marginBottom: theme.spacing.sm,
      flexWrap: "wrap",
    },
    resultValues: {
      marginTop: theme.spacing.sm,
      gap: theme.spacing.xs,
    },
    resultValueItem: {
      flexDirection: isRTL ? "row-reverse" : "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.sm,
    },
    resultValueName: {
      ...getTextStyle(theme, "body", "medium", theme.colors.text.primary),
      flex: 1,
    },
    resultValueData: {
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    resultValueText: {
      ...getTextStyle(theme, "body", "semibold", theme.colors.text.primary),
    },
    resultValueUnit: {
      ...getTextStyle(theme, "caption", "regular", theme.colors.text.secondary),
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: theme.spacing.xl,
    },
    emptyText: {
      ...getTextStyle(theme, "body", "regular", theme.colors.text.secondary),
      textAlign: "center",
      marginTop: theme.spacing.base,
    },
    modalContainer: {
      flex: 1,
      backgroundColor: theme.colors.background.primary,
    },
    modalHeader: {
      flexDirection: isRTL ? "row-reverse" : "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: theme.spacing.base,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.light,
    },
    modalContent: {
      padding: theme.spacing.base,
    },
    rtlText: {
      textAlign: (isRTL ? "right" : "left") as TextStyle["textAlign"],
    } as TextStyle,
  }))(theme);

  const loadLabResults = useCallback(
    async (isRefresh = false) => {
      if (!user) return;

      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        let results: LabResult[];
        if (filterType === "all") {
          results = await labResultService.getUserLabResults(user.id);
        } else {
          results = await labResultService.getLabResultsByType(
            user.id,
            filterType
          );
        }

        setLabResults(results);
      } catch (error) {
        Alert.alert(
          isRTL ? "خطأ" : "Error",
          isRTL ? "فشل تحميل نتائج المختبر" : "Failed to load lab results"
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user, filterType, isRTL]
  );

  useEffect(() => {
    loadLabResults();
  }, [loadLabResults]);

  const formatDate = (date: Date) =>
    safeFormatDate(date, isRTL ? "ar-u-ca-gregory" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const getStatusColor = (status?: LabResult["results"][0]["status"]) => {
    switch (status) {
      case "high":
      case "critical":
        return theme.colors.accent.error;
      case "low":
        return theme.colors.accent.warning;
      case "abnormal":
        return theme.colors.accent.warning;
      case "normal":
        return theme.colors.accent.success;
      default:
        return theme.colors.text.secondary;
    }
  };

  const getStatusLabel = (status?: LabResult["results"][0]["status"]) => {
    if (!status) return "";
    const labels: Record<string, { en: string; ar: string }> = {
      normal: { en: "Normal", ar: "طبيعي" },
      high: { en: "High", ar: "مرتفع" },
      low: { en: "Low", ar: "منخفض" },
      abnormal: { en: "Abnormal", ar: "غير طبيعي" },
      critical: { en: "Critical", ar: "حرج" },
    };
    return isRTL ? labels[status]?.ar || status : labels[status]?.en || status;
  };

  const testTypes = [
    { value: "all" as const, label: isRTL ? "الكل" : "All" },
    { value: "blood" as const, label: isRTL ? "فحص الدم" : "Blood" },
    { value: "urine" as const, label: isRTL ? "فحص البول" : "Urine" },
    { value: "imaging" as const, label: isRTL ? "التصوير" : "Imaging" },
    { value: "other" as const, label: isRTL ? "أخرى" : "Other" },
  ];

  if (!user) {
    return (
      <SafeAreaView style={styles.container as StyleProp<ViewStyle>}>
        <View style={styles.emptyContainer as StyleProp<ViewStyle>}>
          <Text style={styles.emptyText as StyleProp<TextStyle>}>
            {isRTL ? "يجب تسجيل الدخول" : "Please log in"}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container as StyleProp<ViewStyle>}>
      <View style={styles.header as StyleProp<ViewStyle>}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[
            {
              padding: theme.spacing.xs,
              marginEnd: theme.spacing.sm,
            },
            isRTL && { marginEnd: 0, marginStart: theme.spacing.sm },
          ]}
        >
          <ChevronLeft
            color={theme.colors.text.primary}
            size={24}
            style={isRTL ? { transform: [{ rotate: "180deg" }] } : undefined}
          />
        </TouchableOpacity>
        <Heading
          level={4}
          style={[
            styles.headerTitle as TextStyle,
            isRTL ? (styles.rtlText as TextStyle) : undefined,
            { flex: 1 },
          ]}
        >
          {isRTL ? "نتائج المختبر" : "Lab Results"}
        </Heading>
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/lab-results/add")}
          style={styles.addButton as StyleProp<ViewStyle>}
        >
          <Plus color={theme.colors.neutral.white} size={24} />
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <ScrollView
        contentContainerStyle={styles.filterContainer as StyleProp<ViewStyle>}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {testTypes.map((type) => (
          <TouchableOpacity
            key={type.value}
            onPress={() => setFilterType(type.value)}
            style={[
              styles.filterChip as StyleProp<ViewStyle>,
              filterType === type.value &&
                (styles.filterChipActive as StyleProp<ViewStyle>),
            ]}
          >
            <Text
              style={[
                styles.filterChipText as StyleProp<TextStyle>,
                filterType === type.value &&
                  (styles.filterChipTextActive as StyleProp<TextStyle>),
              ]}
            >
              {type.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Results List */}
      {loading ? (
        <View style={styles.emptyContainer as StyleProp<ViewStyle>}>
          <ActivityIndicator color={theme.colors.primary.main} size="large" />
        </View>
      ) : labResults.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer as StyleProp<ViewStyle>}
          refreshControl={
            <RefreshControl
              onRefresh={() => loadLabResults(true)}
              refreshing={refreshing}
            />
          }
        >
          <TestTube color={theme.colors.text.secondary} size={64} />
          <Text
            style={[
              styles.emptyText as StyleProp<TextStyle>,
              isRTL && (styles.rtlText as StyleProp<TextStyle>),
            ]}
          >
            {isRTL ? "لا توجد نتائج مختبر مسجلة" : "No lab results recorded"}
          </Text>
          <Button
            onPress={() => router.push("/(tabs)/lab-results/add")}
            style={{ marginTop: theme.spacing.base }}
            title={isRTL ? "إضافة نتيجة مختبر" : "Add Lab Result"}
            variant="primary"
          />
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.resultsList as StyleProp<ViewStyle>}
          refreshControl={
            <RefreshControl
              onRefresh={() => loadLabResults(true)}
              refreshing={refreshing}
            />
          }
          style={styles.content as StyleProp<ViewStyle>}
        >
          {labResults.map((result) => (
            <Card
              contentStyle={undefined}
              key={result.id}
              onPress={() => {
                setSelectedResult(result);
                setShowAddModal(true);
              }}
              style={styles.resultCard as StyleProp<ViewStyle>}
              variant="elevated"
            >
              <View style={styles.resultHeader as StyleProp<ViewStyle>}>
                <View style={{ flex: 1 }}>
                  <TypographyText
                    style={[
                      styles.resultTitle as TextStyle,
                      isRTL ? (styles.rtlText as TextStyle) : undefined,
                    ]}
                    weight="bold"
                  >
                    {result.testName}
                  </TypographyText>
                  <Caption
                    numberOfLines={1}
                    style={[
                      styles.resultDate as TextStyle,
                      isRTL ? (styles.rtlText as TextStyle) : undefined,
                    ]}
                  >
                    {formatDate(result.testDate)}
                  </Caption>
                </View>
                <Badge
                  size="small"
                  style={undefined}
                  variant={
                    result.testType === "blood"
                      ? "error"
                      : result.testType === "urine"
                        ? "info"
                        : "outline"
                  }
                >
                  {result.testType}
                </Badge>
              </View>

              {result.facility && (
                <Caption
                  numberOfLines={1}
                  style={[
                    styles.resultDate as TextStyle,
                    isRTL ? (styles.rtlText as TextStyle) : undefined,
                  ]}
                >
                  {isRTL ? "المنشأة: " : "Facility: "}
                  {result.facility}
                </Caption>
              )}

              {result.results && result.results.length > 0 && (
                <View style={styles.resultValues as StyleProp<ViewStyle>}>
                  {result.results.slice(0, 3).map((value, index) => (
                    <View
                      key={index}
                      style={styles.resultValueItem as StyleProp<ViewStyle>}
                    >
                      <TypographyText
                        style={[
                          styles.resultValueName as StyleProp<TextStyle>,
                          isRTL && (styles.rtlText as StyleProp<TextStyle>),
                        ]}
                      >
                        {value.name}
                      </TypographyText>
                      <View
                        style={styles.resultValueData as StyleProp<ViewStyle>}
                      >
                        <TypographyText
                          style={[
                            styles.resultValueText as StyleProp<TextStyle>,
                            { color: getStatusColor(value.status) },
                          ]}
                        >
                          {value.value}
                        </TypographyText>
                        {value.unit && (
                          <Caption
                            numberOfLines={1}
                            style={
                              styles.resultValueUnit as StyleProp<TextStyle>
                            }
                          >
                            {value.unit}
                          </Caption>
                        )}
                        {value.status && (
                          <Badge
                            size="small"
                            style={undefined}
                            variant={
                              value.status === "normal"
                                ? "success"
                                : value.status === "high" ||
                                    value.status === "critical"
                                  ? "error"
                                  : "warning"
                            }
                          >
                            {getStatusLabel(value.status)}
                          </Badge>
                        )}
                      </View>
                    </View>
                  ))}
                  {result.results.length > 3 && (
                    <Caption
                      numberOfLines={1}
                      style={[
                        styles.resultDate as TextStyle,
                        isRTL ? (styles.rtlText as TextStyle) : undefined,
                      ]}
                    >
                      {isRTL
                        ? `+${result.results.length - 3} المزيد`
                        : `+${result.results.length - 3} more`}
                    </Caption>
                  )}
                </View>
              )}

              <View
                style={{
                  flexDirection: isRTL ? "row-reverse" : "row",
                  marginTop: theme.spacing.sm,
                }}
              >
                <ChevronRight
                  color={theme.colors.text.secondary}
                  size={16}
                  style={{
                    marginLeft: isRTL ? 0 : "auto",
                    marginRight: isRTL ? "auto" : 0,
                  }}
                />
              </View>
            </Card>
          ))}
        </ScrollView>
      )}

      {/* Detail Modal */}
      <Modal
        animationType="slide"
        onRequestClose={() => {
          setShowAddModal(false);
          setSelectedResult(null);
        }}
        presentationStyle="pageSheet"
        visible={showAddModal && !!selectedResult}
      >
        <SafeAreaView style={styles.modalContainer as StyleProp<ViewStyle>}>
          <View style={styles.modalHeader as StyleProp<ViewStyle>}>
            <Heading
              level={5}
              style={[
                styles.resultTitle as TextStyle,
                isRTL ? (styles.rtlText as TextStyle) : undefined,
              ]}
            >
              {selectedResult?.testName}
            </Heading>
            <TouchableOpacity
              onPress={() => {
                setShowAddModal(false);
                setSelectedResult(null);
              }}
            >
              <X color={theme.colors.text.primary} size={24} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent as StyleProp<ViewStyle>}>
            {selectedResult && (
              <>
                <View style={{ marginBottom: theme.spacing.base }}>
                  <Caption
                    numberOfLines={1}
                    style={[
                      styles.resultDate as TextStyle,
                      isRTL ? (styles.rtlText as TextStyle) : undefined,
                    ]}
                  >
                    {isRTL ? "التاريخ: " : "Date: "}
                    {formatDate(selectedResult.testDate)}
                  </Caption>
                  {selectedResult.facility && (
                    <Caption
                      numberOfLines={1}
                      style={[
                        styles.resultDate as TextStyle,
                        isRTL ? (styles.rtlText as TextStyle) : undefined,
                      ]}
                    >
                      {isRTL ? "المنشأة: " : "Facility: "}
                      {selectedResult.facility}
                    </Caption>
                  )}
                  {selectedResult.orderedBy && (
                    <Caption
                      numberOfLines={1}
                      style={[
                        styles.resultDate as TextStyle,
                        isRTL ? (styles.rtlText as TextStyle) : undefined,
                      ]}
                    >
                      {isRTL ? "طلب من: " : "Ordered by: "}
                      {selectedResult.orderedBy}
                    </Caption>
                  )}
                </View>

                {selectedResult.results &&
                  selectedResult.results.length > 0 && (
                    <View style={styles.resultValues as StyleProp<ViewStyle>}>
                      {selectedResult.results.map((value, index) => (
                        <View
                          key={index}
                          style={styles.resultValueItem as StyleProp<ViewStyle>}
                        >
                          <View style={{ flex: 1 }}>
                            <TypographyText
                              style={[
                                styles.resultValueName as StyleProp<TextStyle>,
                                isRTL &&
                                  (styles.rtlText as StyleProp<TextStyle>),
                              ]}
                              weight="semibold"
                            >
                              {value.name}
                            </TypographyText>
                            {value.referenceRange && (
                              <Caption
                                numberOfLines={1}
                                style={[
                                  styles.resultDate as StyleProp<TextStyle>,
                                  isRTL &&
                                    (styles.rtlText as StyleProp<TextStyle>),
                                ]}
                              >
                                {isRTL ? "النطاق المرجعي: " : "Reference: "}
                                {value.referenceRange}
                              </Caption>
                            )}
                          </View>
                          <View
                            style={
                              styles.resultValueData as StyleProp<ViewStyle>
                            }
                          >
                            <TypographyText
                              style={[
                                styles.resultValueText as StyleProp<TextStyle>,
                                { color: getStatusColor(value.status) },
                              ]}
                            >
                              {value.value}
                            </TypographyText>
                            {value.unit && (
                              <Caption
                                numberOfLines={1}
                                style={
                                  styles.resultValueUnit as StyleProp<TextStyle>
                                }
                              >
                                {value.unit}
                              </Caption>
                            )}
                            {value.status && (
                              <Badge
                                size="small"
                                style={{}}
                                variant={
                                  value.status === "normal"
                                    ? "success"
                                    : value.status === "high" ||
                                        value.status === "critical"
                                      ? "error"
                                      : "warning"
                                }
                              >
                                {getStatusLabel(value.status)}
                              </Badge>
                            )}
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                {selectedResult.notes && (
                  <View style={{ marginTop: theme.spacing.base }}>
                    <TypographyText
                      style={[
                        styles.resultValueName as StyleProp<TextStyle>,
                        isRTL && (styles.rtlText as StyleProp<TextStyle>),
                      ]}
                      weight="semibold"
                    >
                      {isRTL ? "ملاحظات" : "Notes"}
                    </TypographyText>
                    <Caption
                      numberOfLines={10}
                      style={[
                        styles.resultDate as StyleProp<TextStyle>,
                        isRTL && (styles.rtlText as StyleProp<TextStyle>),
                      ]}
                    >
                      {selectedResult.notes}
                    </Caption>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
