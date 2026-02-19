/* biome-ignore-all lint/style/noNestedTernary: preserving existing UI conditional copy paths in this batch. */
/* biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: large legacy screen to be split in future refactor batches. */
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  Calendar,
  Droplet,
  Edit,
  Flower2,
  Plus,
  Trash2,
  X,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import GradientScreen from "@/components/figma/GradientScreen";
import WavyBackground from "@/components/figma/WavyBackground";
import { Colors, Shadows } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { periodService } from "@/lib/services/periodService";
import { logger } from "@/lib/utils/logger";
import type { PeriodEntry } from "@/types";
import { safeFormatDate } from "@/utils/dateFormat";

const FLOW_INTENSITY_OPTIONS = [
  { value: "light", label: "Light", emoji: "💧", color: Colors.accent.success },
  {
    value: "medium",
    label: "Medium",
    emoji: "💧💧",
    color: Colors.accent.warning,
  },
  {
    value: "heavy",
    label: "Heavy",
    emoji: "💧💧💧",
    color: Colors.accent.error,
  },
];

const PERIOD_SYMPTOMS = [
  "cramps",
  "bloating",
  "headache",
  "moodSwings",
  "fatigue",
  "backPain",
  "breastTenderness",
  "nausea",
  "acne",
  "insomnia",
];

export default function WomensHealthScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const isRTL = i18n.language === "ar";

  const [periodEntries, setPeriodEntries] = useState<PeriodEntry[]>([]);
  const [cycleInfo, setCycleInfo] = useState<{
    averageCycleLength?: number;
    averagePeriodLength?: number;
    nextPeriodPredicted?: Date;
    ovulationPredicted?: Date;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PeriodEntry | null>(null);
  const [formData, setFormData] = useState({
    startDate: new Date(),
    endDate: undefined as Date | undefined,
    flowIntensity: "medium" as "light" | "medium" | "heavy",
    symptoms: [] as string[],
    notes: "",
  });

  const loadData = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      const [entries, cycle] = await Promise.all([
        periodService.getUserPeriodEntries(user.id),
        periodService.getCycleInfo(user.id),
      ]);

      setPeriodEntries(entries);
      setCycleInfo(cycle);
    } catch (error) {
      logger.error("Failed to load period data", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleAddPeriod = useCallback(() => {
    setFormData({
      startDate: new Date(),
      endDate: undefined,
      flowIntensity: "medium",
      symptoms: [],
      notes: "",
    });
    setEditingEntry(null);
    setShowAddModal(true);
  }, []);

  const handleEditPeriod = useCallback((entry: PeriodEntry) => {
    setFormData({
      startDate: entry.startDate,
      endDate: entry.endDate,
      flowIntensity: entry.flowIntensity || "medium",
      symptoms: entry.symptoms || [],
      notes: entry.notes || "",
    });
    setEditingEntry(entry);
    setShowAddModal(true);
  }, []);

  const handleDeletePeriod = useCallback(
    (entryId: string) => {
      Alert.alert(
        isRTL ? "حذف السجل" : "Delete Entry",
        isRTL
          ? "هل أنت متأكد من حذف هذا السجل؟"
          : "Are you sure you want to delete this entry?",
        [
          {
            text: isRTL ? "إلغاء" : "Cancel",
            style: "cancel",
          },
          {
            text: isRTL ? "حذف" : "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                await periodService.deletePeriodEntry(entryId);
                await loadData();
              } catch (_error) {
                Alert.alert(
                  isRTL ? "خطأ" : "Error",
                  isRTL ? "فشل حذف السجل" : "Failed to delete entry"
                );
              }
            },
          },
        ]
      );
    },
    [isRTL, loadData]
  );

  const handleSavePeriod = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    try {
      if (editingEntry) {
        await periodService.updatePeriodEntry(editingEntry.id, formData);
      } else {
        await periodService.addPeriodEntry({
          userId: user.id,
          ...formData,
        });
      }

      setShowAddModal(false);
      await loadData();
    } catch (_error) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "فشل حفظ السجل" : "Failed to save entry"
      );
    }
  }, [user?.id, editingEntry, formData, isRTL, loadData]);

  const toggleSymptom = useCallback((symptom: string) => {
    setFormData((prev) => ({
      ...prev,
      symptoms: prev.symptoms.includes(symptom)
        ? prev.symptoms.filter((s) => s !== symptom)
        : [...prev.symptoms, symptom],
    }));
  }, []);

  const formatDate = useCallback(
    (date: Date) =>
      safeFormatDate(date, isRTL ? "ar-u-ca-gregory" : "en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    [isRTL]
  );

  const getDaysUntilNextPeriod = useCallback(() => {
    if (!cycleInfo?.nextPeriodPredicted) {
      return null;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const predictedDate = new Date(cycleInfo.nextPeriodPredicted);
    predictedDate.setHours(0, 0, 0, 0);

    const diffTime = predictedDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  }, [cycleInfo]);

  const getPredictionStatus = useCallback(() => {
    const daysUntil = getDaysUntilNextPeriod();
    if (daysUntil === null) {
      return null;
    }

    if (daysUntil < 0) {
      return {
        type: "overdue",
        color: Colors.accent.error,
        label: isRTL ? "متأخرة" : "Overdue",
      };
    }
    if (daysUntil === 0) {
      return {
        type: "today",
        color: Colors.accent.warning,
        label: isRTL ? "اليوم" : "Today",
      };
    }
    if (daysUntil <= 3) {
      return {
        type: "soon",
        color: Colors.accent.warning,
        label: isRTL ? "قريباً" : "Soon",
      };
    }
    return {
      type: "upcoming",
      color: Colors.accent.success,
      label: isRTL ? "قادمة" : "Upcoming",
    };
  }, [getDaysUntilNextPeriod, isRTL]);

  return (
    <GradientScreen
      edges={["top"]}
      pointerEvents="box-none"
      style={styles.container}
    >
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <WavyBackground curve="home" height={200} variant="teal">
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => {
                if (params.returnTo) {
                  if (params.returnTo === "track") {
                    router.push("/(tabs)/track");
                  } else {
                    router.back();
                  }
                } else {
                  router.back();
                }
              }}
              style={styles.backButton}
            >
              <ArrowLeft color="#FFFFFF" size={24} />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Flower2 color="#FFFFFF" size={24} />
              <Text style={styles.headerTitle}>
                {isRTL ? "صحة المرأة" : "Women's Health"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleAddPeriod}
              style={styles.addButton}
            >
              <Plus color="#FFFFFF" size={24} />
            </TouchableOpacity>
          </View>
        </WavyBackground>

        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              onRefresh={handleRefresh}
              refreshing={refreshing}
              tintColor={Colors.primary.main}
            />
          }
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={Colors.primary.main} size="large" />
              <Text style={styles.loadingText}>
                {isRTL ? "جاري التحميل..." : "Loading..."}
              </Text>
            </View>
          ) : (
            <>
              {/* Next Period Prediction Card - Prominent */}
              {!cycleInfo?.nextPeriodPredicted && periodEntries.length === 0 ? (
                <View style={styles.predictionCard}>
                  <View style={styles.predictionHeader}>
                    <View style={styles.predictionIconContainer}>
                      <Calendar color={Colors.text.inverse} size={28} />
                    </View>
                    <View style={styles.predictionTitleContainer}>
                      <Text style={styles.predictionTitle}>
                        {isRTL ? "ابدأ التتبع" : "Start Tracking"}
                      </Text>
                      <Text style={styles.predictionSubtitle}>
                        {isRTL
                          ? "أضف أول سجل لدورتك الشهرية للحصول على توقعات دقيقة"
                          : "Add your first period entry to get accurate predictions"}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={handleAddPeriod}
                    style={styles.predictionButton}
                  >
                    <Plus color={Colors.primary.main} size={20} />
                    <Text style={styles.predictionButtonText}>
                      {isRTL ? "إضافة سجل" : "Add Entry"}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {/* Next Period Prediction Card - Prominent */}
              {cycleInfo?.nextPeriodPredicted ? (
                <View style={styles.predictionCard}>
                  <View style={styles.predictionHeader}>
                    <View style={styles.predictionIconContainer}>
                      <Calendar color={Colors.primary.main} size={28} />
                    </View>
                    <View style={styles.predictionTitleContainer}>
                      <Text style={styles.predictionTitle}>
                        {isRTL
                          ? "الدورة القادمة المتوقعة"
                          : "Next Period Prediction"}
                      </Text>
                      <Text style={styles.predictionSubtitle}>
                        {isRTL
                          ? "بناءً على بياناتك السابقة"
                          : "Based on your cycle history"}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.predictionContent}>
                    <View style={styles.predictionDateContainer}>
                      <View style={styles.predictionDateInfo}>
                        <Text style={styles.predictionDate}>
                          {formatDate(cycleInfo.nextPeriodPredicted)}
                        </Text>
                        {getPredictionStatus() ? (
                          <View
                            style={[
                              styles.statusBadge,
                              {
                                backgroundColor: `${getPredictionStatus()?.color}20`,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusBadgeText,
                                { color: getPredictionStatus()?.color },
                              ]}
                            >
                              {getPredictionStatus()?.label}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      {getDaysUntilNextPeriod() !== null ? (
                        <View
                          style={[
                            styles.countdownContainer,
                            {
                              backgroundColor:
                                getPredictionStatus()?.type === "overdue"
                                  ? Colors.accent.error
                                  : getPredictionStatus()?.type === "today" ||
                                      getPredictionStatus()?.type === "soon"
                                    ? Colors.accent.warning
                                    : Colors.accent.success,
                            },
                          ]}
                        >
                          <Text style={styles.countdownNumber}>
                            {Math.abs(getDaysUntilNextPeriod() || 0)}
                          </Text>
                          <Text style={styles.countdownLabel}>
                            {getDaysUntilNextPeriod() === 0
                              ? isRTL
                                ? "اليوم"
                                : "today"
                              : getDaysUntilNextPeriod() === 1
                                ? isRTL
                                  ? "يوم"
                                  : "day"
                                : getDaysUntilNextPeriod() === -1
                                  ? isRTL
                                    ? "يوم متأخر"
                                    : "day late"
                                  : (getDaysUntilNextPeriod() ?? 0) < 0
                                    ? isRTL
                                      ? "أيام متأخرة"
                                      : "days late"
                                    : isRTL
                                      ? "أيام"
                                      : "days"}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    {cycleInfo.ovulationPredicted ? (
                      <View style={styles.ovulationInfo}>
                        <Text style={styles.ovulationLabel}>
                          {isRTL ? "الإباضة المتوقعة" : "Predicted Ovulation"}
                        </Text>
                        <Text style={styles.ovulationDate}>
                          {formatDate(cycleInfo.ovulationPredicted)}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              ) : null}

              {/* Cycle Info Card */}
              {cycleInfo ? (
                <View style={styles.infoCard}>
                  <View style={styles.infoCardHeader}>
                    <View style={styles.infoIconContainer}>
                      <Calendar color={Colors.primary.main} size={24} />
                    </View>
                    <Text style={styles.infoCardTitle}>
                      {isRTL ? "معلومات الدورة" : "Cycle Information"}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>
                      {isRTL ? "متوسط طول الدورة" : "Average Cycle Length"}
                    </Text>
                    <View style={styles.infoValueContainer}>
                      <Text style={styles.infoValue}>
                        {cycleInfo.averageCycleLength || 28}
                      </Text>
                      <Text style={styles.infoUnit}>
                        {" "}
                        {isRTL ? "يوم" : "days"}
                      </Text>
                    </View>
                  </View>
                  {typeof cycleInfo.averagePeriodLength === "number" ? (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>
                        {isRTL ? "متوسط مدة الدورة" : "Average Period Length"}
                      </Text>
                      <View style={styles.infoValueContainer}>
                        <Text style={styles.infoValue}>
                          {cycleInfo.averagePeriodLength}
                        </Text>
                        <Text style={styles.infoUnit}>
                          {" "}
                          {isRTL ? "يوم" : "days"}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {/* Period Entries */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {isRTL ? "سجلات الدورة الشهرية" : "Period History"}
                </Text>
                {periodEntries.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <View style={styles.emptyIconContainer}>
                      <Droplet color={Colors.neutral[400]} size={48} />
                    </View>
                    <Text style={styles.emptyText}>
                      {isRTL
                        ? "لا توجد سجلات حتى الآن"
                        : "No period entries yet"}
                    </Text>
                    <Text style={styles.emptySubtext}>
                      {isRTL
                        ? "ابدأ بتسجيل دورتك الشهرية"
                        : "Start tracking your period"}
                    </Text>
                    <TouchableOpacity
                      onPress={handleAddPeriod}
                      style={styles.emptyButton}
                    >
                      <Plus color={Colors.primary.main} size={20} />
                      <Text style={styles.emptyButtonText}>
                        {isRTL ? "إضافة سجل" : "Add Entry"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  periodEntries.map((entry) => (
                    <View key={entry.id} style={styles.entryCard}>
                      <View style={styles.entryHeader}>
                        <View style={styles.entryDateContainer}>
                          <View style={styles.entryIconContainer}>
                            <Calendar color={Colors.primary.main} size={20} />
                          </View>
                          <View>
                            <Text style={styles.entryDate}>
                              {formatDate(entry.startDate)}
                            </Text>
                            {entry.endDate ? (
                              <Text style={styles.entryDateEnd}>
                                {formatDate(entry.endDate)}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                        <View style={styles.entryActions}>
                          <TouchableOpacity
                            onPress={() => handleEditPeriod(entry)}
                            style={styles.actionButton}
                          >
                            <Edit color={Colors.neutral[600]} size={18} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleDeletePeriod(entry.id)}
                            style={styles.actionButton}
                          >
                            <Trash2 color={Colors.accent.error} size={18} />
                          </TouchableOpacity>
                        </View>
                      </View>
                      {entry.flowIntensity ? (
                        <View style={styles.entryDetail}>
                          <Text style={styles.entryLabel}>
                            {isRTL ? "الشدة" : "Flow"}
                          </Text>
                          <View style={styles.flowBadge}>
                            <Text style={styles.flowEmoji}>
                              {FLOW_INTENSITY_OPTIONS.find(
                                (f) => f.value === entry.flowIntensity
                              )?.emoji || ""}
                            </Text>
                            <Text
                              style={[
                                styles.flowText,
                                {
                                  color:
                                    FLOW_INTENSITY_OPTIONS.find(
                                      (f) => f.value === entry.flowIntensity
                                    )?.color || Colors.neutral[600],
                                },
                              ]}
                            >
                              {FLOW_INTENSITY_OPTIONS.find(
                                (f) => f.value === entry.flowIntensity
                              )?.label || entry.flowIntensity}
                            </Text>
                          </View>
                        </View>
                      ) : null}
                      {entry.symptoms && entry.symptoms.length > 0 ? (
                        <View style={styles.entryDetail}>
                          <Text style={styles.entryLabel}>
                            {isRTL ? "الأعراض" : "Symptoms"}
                          </Text>
                          <View style={styles.symptomsContainer}>
                            {entry.symptoms.map((symptom) => (
                              <View key={symptom} style={styles.symptomTag}>
                                <Text style={styles.symptomTagText}>
                                  {t(symptom, symptom)}
                                </Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      ) : null}
                      {entry.notes ? (
                        <View style={styles.entryDetail}>
                          <Text style={styles.entryNotes}>{entry.notes}</Text>
                        </View>
                      ) : null}
                    </View>
                  ))
                )}
              </View>
            </>
          )}
        </ScrollView>

        {/* Add/Edit Modal */}
        <Modal
          animationType="slide"
          onRequestClose={() => setShowAddModal(false)}
          transparent
          visible={showAddModal}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingEntry
                    ? isRTL
                      ? "تعديل السجل"
                      : "Edit Entry"
                    : isRTL
                      ? "إضافة سجل جديد"
                      : "Add Period Entry"}
                </Text>
                <TouchableOpacity
                  onPress={() => setShowAddModal(false)}
                  style={styles.closeButton}
                >
                  <X color={Colors.neutral[600]} size={24} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>
                    {isRTL ? "تاريخ البداية" : "Start Date"}
                  </Text>
                  <View style={styles.dateInputContainer}>
                    <Text style={styles.dateInputText}>
                      {formatDate(formData.startDate)}
                    </Text>
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>
                    {isRTL ? "شدة التدفق" : "Flow Intensity"}
                  </Text>
                  <View style={styles.flowOptions}>
                    {FLOW_INTENSITY_OPTIONS.map((option) => (
                      <TouchableOpacity
                        key={option.value}
                        onPress={() =>
                          setFormData((prev) => ({
                            ...prev,
                            flowIntensity: option.value as
                              | "light"
                              | "medium"
                              | "heavy",
                          }))
                        }
                        style={[
                          styles.flowOption,
                          formData.flowIntensity === option.value &&
                            styles.flowOptionSelected,
                        ]}
                      >
                        <Text style={styles.flowEmojiLarge}>
                          {option.emoji}
                        </Text>
                        <Text
                          style={[
                            styles.flowLabel,
                            formData.flowIntensity === option.value &&
                              styles.flowLabelSelected,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>
                    {isRTL ? "الأعراض" : "Symptoms"}
                  </Text>
                  <View style={styles.symptomsGrid}>
                    {PERIOD_SYMPTOMS.map((symptom) => (
                      <TouchableOpacity
                        key={symptom}
                        onPress={() => toggleSymptom(symptom)}
                        style={[
                          styles.symptomChip,
                          formData.symptoms.includes(symptom) &&
                            styles.symptomChipSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.symptomText,
                            formData.symptoms.includes(symptom) &&
                              styles.symptomTextSelected,
                          ]}
                        >
                          {t(symptom, symptom)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>
                    {isRTL ? "ملاحظات" : "Notes"}
                  </Text>
                  <TextInput
                    multiline
                    numberOfLines={4}
                    onChangeText={(text) =>
                      setFormData((prev) => ({ ...prev, notes: text }))
                    }
                    placeholder={isRTL ? "أضف ملاحظات..." : "Add notes..."}
                    placeholderTextColor={Colors.neutral[400]}
                    style={[styles.formInput, styles.textArea]}
                    value={formData.notes}
                  />
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  onPress={() => setShowAddModal(false)}
                  style={styles.cancelButton}
                >
                  <Text style={styles.cancelButtonText}>
                    {isRTL ? "إلغاء" : "Cancel"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSavePeriod}
                  style={styles.saveButton}
                >
                  <Text style={styles.saveButtonText}>
                    {isRTL ? "حفظ" : "Save"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </GradientScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: "Inter-Bold",
    color: "#FFFFFF",
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  loadingContainer: {
    padding: 40,
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: "Inter-Medium",
    color: Colors.text.secondary,
  },
  predictionCard: {
    backgroundColor: Colors.primary.main,
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    ...Shadows.lg,
  },
  predictionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    gap: 16,
  },
  predictionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  predictionTitleContainer: {
    flex: 1,
  },
  predictionTitle: {
    fontSize: 20,
    fontFamily: "Inter-Bold",
    color: Colors.text.inverse,
    marginBottom: 4,
  },
  predictionSubtitle: {
    fontSize: 14,
    fontFamily: "Inter-Regular",
    color: "rgba(255, 255, 255, 0.8)",
  },
  predictionContent: {
    gap: 16,
  },
  predictionDateContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 16,
    gap: 12,
  },
  predictionDateInfo: {
    flex: 1,
    gap: 8,
  },
  predictionDate: {
    fontSize: 18,
    fontFamily: "Inter-SemiBold",
    color: Colors.text.inverse,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontFamily: "Inter-SemiBold",
  },
  countdownContainer: {
    alignItems: "center",
    backgroundColor: Colors.secondary.main,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 80,
  },
  countdownNumber: {
    fontSize: 24,
    fontFamily: "Inter-Bold",
    color: Colors.text.inverse,
    lineHeight: 28,
  },
  countdownLabel: {
    fontSize: 11,
    fontFamily: "Inter-Medium",
    color: Colors.text.inverse,
    opacity: 0.9,
  },
  ovulationInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
  },
  ovulationLabel: {
    fontSize: 14,
    fontFamily: "Inter-Medium",
    color: "rgba(255, 255, 255, 0.9)",
  },
  ovulationDate: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    color: Colors.text.inverse,
  },
  predictionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: Colors.text.inverse,
    borderRadius: 12,
    marginTop: 8,
  },
  predictionButtonText: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    color: Colors.primary.main,
  },
  infoCard: {
    backgroundColor: Colors.background.secondary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    ...Shadows.md,
  },
  infoCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    gap: 12,
  },
  infoIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary[50],
    alignItems: "center",
    justifyContent: "center",
  },
  infoCardTitle: {
    fontSize: 18,
    fontFamily: "Inter-Bold",
    color: Colors.text.primary,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  infoLabel: {
    fontSize: 14,
    fontFamily: "Inter-Medium",
    color: Colors.text.secondary,
    flex: 1,
  },
  infoValueContainer: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  infoValue: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    color: Colors.text.primary,
  },
  infoUnit: {
    fontSize: 14,
    fontFamily: "Inter-Regular",
    color: Colors.text.secondary,
  },
  infoSubtext: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: Colors.text.tertiary,
  },
  section: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: "Inter-Bold",
    color: Colors.text.primary,
    marginBottom: 16,
  },
  emptyContainer: {
    alignItems: "center",
    padding: 48,
    backgroundColor: Colors.background.secondary,
    borderRadius: 16,
    ...Shadows.sm,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.neutral[100],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 18,
    fontFamily: "Inter-SemiBold",
    color: Colors.text.primary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: "Inter-Regular",
    color: Colors.text.secondary,
    marginBottom: 24,
    textAlign: "center",
  },
  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary.main,
    backgroundColor: Colors.primary[50],
  },
  emptyButtonText: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    color: Colors.primary.main,
  },
  entryCard: {
    backgroundColor: Colors.background.secondary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    ...Shadows.sm,
  },
  entryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  entryDateContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  entryIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary[50],
    alignItems: "center",
    justifyContent: "center",
  },
  entryDate: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    color: Colors.text.primary,
  },
  entryDateEnd: {
    fontSize: 14,
    fontFamily: "Inter-Regular",
    color: Colors.text.secondary,
    marginTop: 2,
  },
  entryActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
  entryDetail: {
    marginTop: 12,
  },
  entryLabel: {
    fontSize: 12,
    fontFamily: "Inter-Medium",
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  flowBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.neutral[100],
  },
  flowEmoji: {
    fontSize: 16,
  },
  flowText: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
  },
  symptomsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  symptomTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.secondary[50],
  },
  symptomTagText: {
    fontSize: 12,
    fontFamily: "Inter-Medium",
    color: Colors.secondary.dark,
  },
  entryNotes: {
    fontSize: 14,
    fontFamily: "Inter-Regular",
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Colors.background.secondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Inter-Bold",
    color: Colors.text.primary,
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 24,
  },
  formLabel: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    color: Colors.text.primary,
    marginBottom: 8,
  },
  dateInputContainer: {
    borderWidth: 1,
    borderColor: Colors.border.light,
    borderRadius: 12,
    padding: 16,
    backgroundColor: Colors.background.secondary,
  },
  dateInputText: {
    fontSize: 16,
    fontFamily: "Inter-Regular",
    color: Colors.text.primary,
  },
  flowOptions: {
    flexDirection: "row",
    gap: 12,
  },
  flowOption: {
    flex: 1,
    alignItems: "center",
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.border.light,
    backgroundColor: Colors.neutral[50],
  },
  flowOptionSelected: {
    borderColor: Colors.primary.main,
    backgroundColor: Colors.primary[50],
  },
  flowEmojiLarge: {
    fontSize: 40,
    marginBottom: 8,
  },
  flowLabel: {
    fontSize: 14,
    fontFamily: "Inter-Medium",
    color: Colors.text.secondary,
  },
  flowLabelSelected: {
    color: Colors.primary.main,
    fontFamily: "Inter-SemiBold",
  },
  symptomsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  symptomChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border.light,
    backgroundColor: Colors.background.secondary,
  },
  symptomChipSelected: {
    borderColor: Colors.primary.main,
    backgroundColor: Colors.primary[50],
  },
  symptomText: {
    fontSize: 14,
    fontFamily: "Inter-Medium",
    color: Colors.text.secondary,
  },
  symptomTextSelected: {
    color: Colors.primary.main,
    fontFamily: "Inter-SemiBold",
  },
  formInput: {
    borderWidth: 1,
    borderColor: Colors.border.light,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontFamily: "Inter-Regular",
    color: Colors.text.primary,
    backgroundColor: Colors.background.secondary,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  modalFooter: {
    flexDirection: "row",
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border.light,
    alignItems: "center",
    backgroundColor: Colors.background.secondary,
  },
  cancelButtonText: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    color: Colors.text.secondary,
  },
  saveButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: Colors.primary.main,
    alignItems: "center",
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    color: Colors.text.inverse,
  },
});
