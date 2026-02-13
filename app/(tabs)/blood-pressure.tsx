import { useRouter } from "expo-router";
import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import {
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  Clock,
  Heart,
  Plus,
  TrendingDown,
  TrendingUp,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import { SafeAreaView } from "react-native-safe-area-context";
import GradientScreen from "@/components/figma/GradientScreen";
import WavyBackground from "@/components/figma/WavyBackground";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";

type BloodPressureReading = {
  id: string;
  systolic: number;
  diastolic: number;
  pulse?: number;
  note?: string;
  timestamp: Date;
  status: "normal" | "elevated" | "high" | "critical";
};

const STATUS_COLORS: Record<BloodPressureReading["status"], string> = {
  normal: "#10B981",
  elevated: "#FBBF24",
  high: "#F97316",
  critical: "#EF4444",
};

const STATUS_LABELS: Record<BloodPressureReading["status"], string> = {
  normal: "Normal",
  elevated: "Elevated",
  high: "High",
  critical: "Critical",
};

const getStatus = (systolic: number, diastolic: number) => {
  if (systolic >= 180 || diastolic >= 120) {
    return "critical";
  }
  if (systolic >= 140 || diastolic >= 90) {
    return "high";
  }
  if (systolic >= 120 || diastolic >= 80) {
    return "elevated";
  }
  return "normal";
};

const parseBloodPressure = (value: unknown) => {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    const [sys, dia] = value.split("/").map((part) => Number(part.trim()));
    if (!(Number.isNaN(sys) || Number.isNaN(dia))) {
      return { systolic: sys, diastolic: dia };
    }
  }

  if (typeof value === "object") {
    const record = value as { systolic?: number; diastolic?: number };
    if (
      typeof record.systolic === "number" &&
      typeof record.diastolic === "number"
    ) {
      return { systolic: record.systolic, diastolic: record.diastolic };
    }
  }

  return null;
};

const formatRelativeTime = (date: Date) => {
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60_000));
  if (diffMinutes < 60) {
    return diffMinutes <= 1 ? "Just now" : `${diffMinutes} min ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hours ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} days ago`;
};

export default function BloodPressureScreen() {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const [readings, setReadings] = useState<BloodPressureReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [pulse, setPulse] = useState("");
  const [note, setNote] = useState("");
  const [time, setTime] = useState(() => new Date().toTimeString().slice(0, 5));

  const isRTL = i18n.language === "ar";

  const loadReadings = useCallback(async () => {
    if (!user?.id) {
      setReadings([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const readingsQuery = query(
        collection(db, "vitals"),
        where("userId", "==", user.id),
        where("type", "==", "bloodPressure"),
        orderBy("timestamp", "desc"),
        limit(30)
      );

      const snapshot = await getDocs(readingsQuery);
      const items: BloodPressureReading[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        const timestamp = data.timestamp?.toDate?.() || new Date();
        const fromMetadata = parseBloodPressure(data.metadata);
        const fromValue = parseBloodPressure(data.value);
        const parsed = fromMetadata || fromValue;

        if (!parsed) {
          return;
        }

        const pulseValue =
          typeof data.metadata?.pulse === "number"
            ? data.metadata.pulse
            : typeof data.value?.pulse === "number"
              ? data.value.pulse
              : undefined;

        items.push({
          id: doc.id,
          systolic: parsed.systolic,
          diastolic: parsed.diastolic,
          pulse: pulseValue,
          note:
            typeof data.metadata?.note === "string"
              ? data.metadata.note
              : undefined,
          timestamp,
          status: getStatus(parsed.systolic, parsed.diastolic),
        });
      });

      setReadings(items);
    } catch (_error) {
      Alert.alert("Error", "Unable to load blood pressure readings.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadReadings();
  }, [loadReadings]);

  const latestReading = readings[0];

  const averages = useMemo(() => {
    if (readings.length === 0) {
      return { systolic: 0, diastolic: 0 };
    }
    const total = readings.reduce(
      (acc, reading) => {
        acc.systolic += reading.systolic;
        acc.diastolic += reading.diastolic;
        return acc;
      },
      { systolic: 0, diastolic: 0 }
    );
    return {
      systolic: Math.round(total.systolic / readings.length),
      diastolic: Math.round(total.diastolic / readings.length),
    };
  }, [readings]);

  const trend = useMemo(() => {
    if (readings.length < 4) {
      return { direction: "stable", percent: 0 };
    }
    const recent = readings.slice(0, 3);
    const previous = readings.slice(3, 6);
    const recentAvg =
      recent.reduce((sum, item) => sum + item.systolic, 0) / recent.length;
    const previousAvg =
      previous.reduce((sum, item) => sum + item.systolic, 0) / previous.length;
    if (!previousAvg) {
      return { direction: "stable", percent: 0 };
    }
    const percent = Math.round(((previousAvg - recentAvg) / previousAvg) * 100);
    if (percent > 0) {
      return { direction: "down", percent };
    }
    if (percent < 0) {
      return { direction: "up", percent: Math.abs(percent) };
    }
    return { direction: "stable", percent: 0 };
  }, [readings]);

  const chartData = useMemo(() => {
    const points = [...readings]
      .slice(0, 7)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return {
      labels: points.map((reading) =>
        reading.timestamp.toLocaleDateString(isRTL ? "ar-EG" : "en-US", {
          weekday: "short",
        })
      ),
      datasets: [
        {
          data: points.map((reading) => reading.systolic),
          color: () => "#DC2626",
          strokeWidth: 2.5,
        },
        {
          data: points.map((reading) => reading.diastolic),
          color: () => "#3B82F6",
          strokeWidth: 2.5,
        },
      ],
    };
  }, [readings, isRTL]);

  const handleSave = async () => {
    const sys = Number(systolic);
    const dia = Number(diastolic);
    const pulseValue = pulse ? Number(pulse) : undefined;

    if (!(sys && dia) || Number.isNaN(sys) || Number.isNaN(dia)) {
      Alert.alert(
        "Invalid Input",
        "Please enter valid systolic and diastolic values."
      );
      return;
    }
    if (sys <= dia) {
      Alert.alert("Invalid Input", "Systolic must be greater than diastolic.");
      return;
    }
    if (!user?.id) {
      Alert.alert("Error", "Please log in to save readings.");
      return;
    }

    const entryDate = new Date();
    if (time) {
      const [hours, minutes] = time.split(":").map((value) => Number(value));
      if (!(Number.isNaN(hours) || Number.isNaN(minutes))) {
        entryDate.setHours(hours, minutes, 0, 0);
      }
    }

    setSaving(true);
    try {
      await addDoc(collection(db, "vitals"), {
        userId: user.id,
        type: "bloodPressure",
        value: `${sys}/${dia}`,
        unit: "mmHg",
        timestamp: Timestamp.fromDate(entryDate),
        source: "manual",
        metadata: {
          systolic: sys,
          diastolic: dia,
          pulse: pulseValue,
          note: note.trim() || undefined,
        },
      });

      setSystolic("");
      setDiastolic("");
      setPulse("");
      setNote("");
      setTime(new Date().toTimeString().slice(0, 5));
      setShowAddModal(false);
      await loadReadings();
    } catch (_error) {
      Alert.alert("Error", "Unable to save blood pressure reading.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <GradientScreen>
      <View style={styles.headerWrapper}>
        <WavyBackground height={220} variant="teal">
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => {
                if (params.returnTo === "track") {
                  router.push("/(tabs)/track");
                } else if (router.canGoBack?.()) {
                  router.back();
                } else {
                  router.push("/(tabs)/track");
                }
              }}
              style={styles.backButton}
            >
              <ArrowLeft color="#003543" size={20} />
            </TouchableOpacity>
            <View style={styles.headerTitleWrap}>
              <View style={styles.headerTitleRow}>
                <Heart color="#EB9C0C" size={22} />
                <Text style={styles.headerTitle}>Blood Pressure</Text>
              </View>
              <Text style={styles.headerSubtitle}>
                Monitor BP readings over time
              </Text>
            </View>
          </View>
        </WavyBackground>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
      >
        <View style={styles.content}>
          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color="#003543" />
            </View>
          ) : (
            <>
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardLabel}>Latest Reading</Text>
                  <Text style={styles.cardMeta}>
                    {latestReading
                      ? formatRelativeTime(latestReading.timestamp)
                      : "--"}
                  </Text>
                </View>
                {latestReading ? (
                  <View style={styles.latestRow}>
                    <View>
                      <View style={styles.latestValueRow}>
                        <Text style={styles.latestValue}>
                          {latestReading.systolic}
                        </Text>
                        <Text style={styles.latestSlash}>/</Text>
                        <Text style={styles.latestValue}>
                          {latestReading.diastolic}
                        </Text>
                      </View>
                      <Text style={styles.latestMeta}>
                        mmHg • Pulse: {latestReading.pulse ?? "--"} bpm
                      </Text>
                    </View>
                    <View>
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor: `${STATUS_COLORS[latestReading.status]}20`,
                          },
                        ]}
                      >
                        <Heart
                          color={STATUS_COLORS[latestReading.status]}
                          size={14}
                        />
                        <Text
                          style={[
                            styles.statusText,
                            { color: STATUS_COLORS[latestReading.status] },
                          ]}
                        >
                          {STATUS_LABELS[latestReading.status]}
                        </Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.emptyText}>No readings yet</Text>
                )}
              </View>

              <View style={styles.quickStats}>
                <View style={styles.quickStatCard}>
                  <Text style={styles.quickStatValue}>
                    {averages.systolic || "--"}
                  </Text>
                  <Text style={styles.quickStatLabel}>Avg Systolic</Text>
                </View>
                <View style={styles.quickStatCard}>
                  <Text style={styles.quickStatValue}>
                    {averages.diastolic || "--"}
                  </Text>
                  <Text style={styles.quickStatLabel}>Avg Diastolic</Text>
                </View>
                <View style={styles.quickStatCard}>
                  <View style={styles.trendRow}>
                    {trend.direction === "down" ? (
                      <TrendingDown color="#10B981" size={16} />
                    ) : trend.direction === "up" ? (
                      <TrendingUp color="#F97316" size={16} />
                    ) : (
                      <AlertCircle color="#6C7280" size={16} />
                    )}
                    <Text
                      style={[
                        styles.trendValue,
                        trend.direction === "down"
                          ? { color: "#10B981" }
                          : trend.direction === "up"
                            ? { color: "#F97316" }
                            : { color: "#6C7280" },
                      ]}
                    >
                      {trend.percent ? `${trend.percent}%` : "--"}
                    </Text>
                  </View>
                  <Text style={styles.quickStatLabel}>
                    {trend.direction === "down"
                      ? "Improving"
                      : trend.direction === "up"
                        ? "Rising"
                        : "Stable"}
                  </Text>
                </View>
              </View>

              <View style={styles.card}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Pressure Trend</Text>
                  <Text style={styles.sectionAction}>7 Days</Text>
                </View>
                {chartData.labels.length > 0 ? (
                  <LineChart
                    chartConfig={{
                      backgroundGradientFrom: "#FFFFFF",
                      backgroundGradientTo: "#FFFFFF",
                      color: (opacity = 1) => `rgba(30, 41, 59, ${opacity})`,
                      labelColor: (opacity = 1) =>
                        `rgba(107, 114, 128, ${opacity})`,
                      propsForDots: {
                        r: "3",
                      },
                      propsForBackgroundLines: {
                        strokeDasharray: "3 3",
                        stroke: "#E5E7EB",
                      },
                    }}
                    data={chartData}
                    height={220}
                    style={styles.chart}
                    width={Dimensions.get("window").width - 48}
                    withShadow={false}
                  />
                ) : (
                  <Text style={styles.emptyText}>No data to display</Text>
                )}
                <View style={styles.chartLegend}>
                  <Text style={styles.chartLegendText}>Normal: &lt;120/80</Text>
                  <Text style={styles.chartLegendText}>
                    Elevated: 120-129/&lt;80
                  </Text>
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Reference Ranges</Text>
                <View style={styles.referenceItem}>
                  <View style={styles.referenceLeft}>
                    <View
                      style={[
                        styles.referenceDot,
                        { backgroundColor: "#10B981" },
                      ]}
                    />
                    <Text style={styles.referenceLabel}>Normal</Text>
                  </View>
                  <Text style={styles.referenceValue}>&lt;120/80 mmHg</Text>
                </View>
                <View style={styles.referenceItem}>
                  <View style={styles.referenceLeft}>
                    <View
                      style={[
                        styles.referenceDot,
                        { backgroundColor: "#FBBF24" },
                      ]}
                    />
                    <Text style={styles.referenceLabel}>Elevated</Text>
                  </View>
                  <Text style={styles.referenceValue}>120-129/&lt;80 mmHg</Text>
                </View>
                <View style={styles.referenceItem}>
                  <View style={styles.referenceLeft}>
                    <View
                      style={[
                        styles.referenceDot,
                        { backgroundColor: "#F97316" },
                      ]}
                    />
                    <Text style={styles.referenceLabel}>High Stage 1</Text>
                  </View>
                  <Text style={styles.referenceValue}>130-139/80-89 mmHg</Text>
                </View>
                <View style={styles.referenceItem}>
                  <View style={styles.referenceLeft}>
                    <View
                      style={[
                        styles.referenceDot,
                        { backgroundColor: "#EF4444" },
                      ]}
                    />
                    <Text style={styles.referenceLabel}>High Stage 2</Text>
                  </View>
                  <Text style={styles.referenceValue}>≥140/90 mmHg</Text>
                </View>
              </View>

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent Readings</Text>
                <Text style={styles.sectionAction}>View All</Text>
              </View>
              {readings.slice(0, 5).map((reading) => (
                <View key={reading.id} style={styles.readingCard}>
                  <View style={styles.readingIcon}>
                    <Heart color={STATUS_COLORS[reading.status]} size={20} />
                  </View>
                  <View style={styles.readingContent}>
                    <View style={styles.readingHeader}>
                      <Text style={styles.readingTitle}>
                        {reading.systolic}/{reading.diastolic} mmHg
                      </Text>
                      <View
                        style={[
                          styles.statusBadgeSmall,
                          {
                            backgroundColor: `${STATUS_COLORS[reading.status]}20`,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusTextSmall,
                            { color: STATUS_COLORS[reading.status] },
                          ]}
                        >
                          {STATUS_LABELS[reading.status]}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.readingMeta}>
                      Pulse: {reading.pulse ?? "--"} bpm •{" "}
                      {reading.note || "No notes"}
                    </Text>
                    <View style={styles.readingTimeRow}>
                      <Clock color="#6C7280" size={12} />
                      <Text style={styles.readingTime}>
                        {formatRelativeTime(reading.timestamp)}
                      </Text>
                    </View>
                  </View>
                  <ChevronRight color="#6C7280" size={18} />
                </View>
              ))}
            </>
          )}
        </View>
      </ScrollView>

      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => setShowAddModal(true)}
        style={styles.fab}
      >
        <Plus color="#FFFFFF" size={22} />
      </TouchableOpacity>

      <Modal
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
        transparent
        visible={showAddModal}
      >
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Log Blood Pressure</Text>
              <TouchableOpacity
                onPress={() => setShowAddModal(false)}
                style={styles.modalClose}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalRow}>
                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>Systolic</Text>
                  <TextInput
                    keyboardType="number-pad"
                    onChangeText={setSystolic}
                    placeholder="120"
                    style={styles.modalInput}
                    value={systolic}
                  />
                  <Text style={styles.modalHint}>mmHg</Text>
                </View>
                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>Diastolic</Text>
                  <TextInput
                    keyboardType="number-pad"
                    onChangeText={setDiastolic}
                    placeholder="80"
                    style={styles.modalInput}
                    value={diastolic}
                  />
                  <Text style={styles.modalHint}>mmHg</Text>
                </View>
              </View>

              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Pulse Rate (Optional)</Text>
                <TextInput
                  keyboardType="number-pad"
                  onChangeText={setPulse}
                  placeholder="72"
                  style={styles.modalInput}
                  value={pulse}
                />
                <Text style={styles.modalHint}>bpm</Text>
              </View>

              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Time</Text>
                <TextInput
                  onChangeText={setTime}
                  placeholder="08:00"
                  style={styles.modalInput}
                  value={time}
                />
              </View>

              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Notes (Optional)</Text>
                <TextInput
                  multiline
                  onChangeText={setNote}
                  placeholder="e.g., After breakfast"
                  style={[styles.modalInput, styles.modalTextArea]}
                  value={note}
                />
              </View>

              <TouchableOpacity
                disabled={saving}
                onPress={handleSave}
                style={styles.modalSave}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSaveText}>Save Reading</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </GradientScreen>
  );
}

const styles = StyleSheet.create({
  headerWrapper: {
    flexShrink: 0,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 140,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: "Inter-Bold",
    color: "#FFFFFF",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#003543",
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
    gap: 20,
  },
  loading: {
    paddingVertical: 40,
    alignItems: "center",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 12,
    fontFamily: "Inter-Medium",
    color: "#6C7280",
  },
  cardMeta: {
    fontSize: 12,
    color: "#6C7280",
  },
  latestRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  latestValueRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
  },
  latestValue: {
    fontSize: 34,
    fontFamily: "Inter-Bold",
    color: "#003543",
  },
  latestSlash: {
    fontSize: 22,
    fontFamily: "Inter-Bold",
    color: "#003543",
    marginBottom: 6,
  },
  latestMeta: {
    fontSize: 12,
    color: "#6C7280",
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 12,
    fontFamily: "Inter-Medium",
  },
  emptyText: {
    fontSize: 13,
    color: "#6C7280",
  },
  quickStats: {
    flexDirection: "row",
    gap: 12,
  },
  quickStatCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  quickStatValue: {
    fontSize: 20,
    fontFamily: "Inter-Bold",
    color: "#003543",
    marginBottom: 4,
  },
  quickStatLabel: {
    fontSize: 11,
    color: "#6C7280",
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  trendValue: {
    fontSize: 18,
    fontFamily: "Inter-Bold",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    color: "#1A1D1F",
  },
  sectionAction: {
    fontSize: 12,
    color: "#003543",
    fontFamily: "Inter-Medium",
  },
  chart: {
    marginTop: 12,
    borderRadius: 16,
  },
  chartLegend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginTop: 10,
  },
  chartLegendText: {
    fontSize: 11,
    color: "#6C7280",
  },
  referenceItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  referenceLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  referenceDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  referenceLabel: {
    fontSize: 13,
    fontFamily: "Inter-Medium",
    color: "#1A1D1F",
  },
  referenceValue: {
    fontSize: 12,
    color: "#6C7280",
  },
  readingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  readingIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  readingContent: {
    flex: 1,
  },
  readingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  readingTitle: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    color: "#1A1D1F",
  },
  statusBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusTextSmall: {
    fontSize: 10,
    fontFamily: "Inter-Medium",
  },
  readingMeta: {
    fontSize: 12,
    color: "#6C7280",
    marginBottom: 4,
  },
  readingTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  readingTime: {
    fontSize: 11,
    color: "#6C7280",
  },
  fab: {
    position: "absolute",
    bottom: 32,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#D48A00",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Inter-Bold",
    color: "#1A1D1F",
  },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseText: {
    fontSize: 16,
    color: "#1A1D1F",
  },
  modalRow: {
    flexDirection: "row",
    gap: 12,
  },
  modalField: {
    flex: 1,
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 13,
    fontFamily: "Inter-Medium",
    color: "#1A1D1F",
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: "Inter-Regular",
    backgroundColor: "#FFFFFF",
  },
  modalTextArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  modalHint: {
    fontSize: 11,
    color: "#6C7280",
    marginTop: 6,
  },
  modalSave: {
    backgroundColor: "#003543",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  modalSaveText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
  },
});
