/* biome-ignore-all lint/style/noNestedTernary: preserving existing conditional timeline UI structure in this batch. */
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileText,
  Filter,
  Pill,
  Plus,
  Smile,
  TestTube,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextStyle,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import GradientScreen from "@/components/figma/GradientScreen";
import WavyBackground from "@/components/figma/WavyBackground";
import { useAuth } from "@/contexts/AuthContext";
import {
  type TimelineEvent,
  timelineService,
} from "@/lib/services/timelineService";
import {
  safeFormatDate,
  safeFormatDateTime,
  safeFormatTime,
} from "@/utils/dateFormat";

type ViewMode = "day" | "week" | "month" | "year";
type FilterType = TimelineEvent["type"] | "all";

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: screen coordinates timeline loading, grouping, and modal presentation.
export default function TimelineScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const timelineRouter = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const isRTL = i18n.language === "ar";

  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedFilter, setSelectedFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(
    null
  );
  const [showEventModal, setShowEventModal] = useState(false);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "transparent",
    },
    headerWrap: {
      marginBottom: -40,
    },
    headerContent: {
      paddingHorizontal: 24,
      paddingTop: 160,
      paddingBottom: 16,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: "rgba(0, 53, 67, 0.15)",
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
      color: "#003543",
    },
    headerSubtitle: {
      fontSize: 13,
      fontFamily: "Inter-SemiBold",
      color: "rgba(0, 53, 67, 0.85)",
    },
    searchContainer: {
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: 20,
      marginTop: 24,
      marginBottom: 12,
    },
    searchInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: "#E2E8F0",
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: "#FFFFFF",
      fontSize: 12,
      fontFamily: "Inter-SemiBold",
      color: "#0F172A",
    },
    filterButton: {
      width: 44,
      height: 44,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: "#E2E8F0",
      backgroundColor: "#FFFFFF",
      alignItems: "center",
      justifyContent: "center",
    },
    viewModeSelector: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      paddingHorizontal: 20,
      marginBottom: 12,
    },
    viewModeButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: "#E2E8F0",
      backgroundColor: "rgba(255, 255, 255, 0.9)",
    },
    viewModeButtonActive: {
      backgroundColor: "#003543",
      borderColor: "#003543",
    },
    viewModeButtonText: {
      fontSize: 12,
      fontFamily: "Inter-SemiBold",
      color: "#0F172A",
    },
    viewModeButtonTextActive: {
      color: "#FFFFFF",
    },
    dateNavigation: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      marginBottom: 12,
    },
    dateNavButton: {
      width: 36,
      height: 36,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "#E2E8F0",
      backgroundColor: "#FFFFFF",
      alignItems: "center",
      justifyContent: "center",
    },
    dateText: {
      flex: 1,
      textAlign: "center",
      fontSize: 13,
      fontFamily: "Inter-SemiBold",
      color: "#0F172A",
    },
    timelineContainer: {
      paddingHorizontal: 20,
      paddingBottom: 140,
    },
    timelineDateGroup: {
      marginBottom: 20,
    },
    dateHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    dateHeaderText: {
      fontSize: 14,
      fontFamily: "Inter-Bold",
      color: "#0F172A",
    },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: "#E2E8F0",
    },
    badgeText: {
      fontSize: 11,
      fontFamily: "Inter-SemiBold",
      color: "#0F172A",
    },
    timelineLine: {
      width: 2,
      backgroundColor: "#E2E8F0",
      alignSelf: "stretch",
      marginLeft: 14,
    },
    eventItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: 16,
    },
    eventDot: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 3,
      borderColor: "#F8FAFC",
      justifyContent: "center",
      alignItems: "center",
    },
    eventContent: {
      flex: 1,
    },
    eventCard: {
      backgroundColor: "#FFFFFF",
      borderRadius: 16,
      padding: 14,
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
    eventHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 10,
    },
    eventTitle: {
      fontSize: 14,
      fontFamily: "Inter-Bold",
      color: "#0F172A",
      flex: 1,
    },
    eventTime: {
      fontSize: 11,
      fontFamily: "Inter-SemiBold",
      color: "#64748B",
    },
    eventDescription: {
      fontSize: 12,
      fontFamily: "Inter-SemiBold",
      color: "#475569",
      marginTop: 6,
    },
    eventTypeChip: {
      alignSelf: "flex-start",
      marginTop: 6,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: "#E2E8F0",
    },
    eventTypeText: {
      fontSize: 11,
      fontFamily: "Inter-SemiBold",
      color: "#0F172A",
    },
    filterModal: {
      backgroundColor: "#FFFFFF",
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      maxHeight: "80%",
    },
    filterOption: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: "#E2E8F0",
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    emptyText: {
      fontSize: 13,
      fontFamily: "Inter-SemiBold",
      color: "#64748B",
      textAlign: "center",
      marginTop: 8,
    },
    rtlText: {
      textAlign: "right",
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: "#E2E8F0",
    },
    modalContent: {
      padding: 20,
    },
    modalTitle: {
      fontSize: 16,
      fontFamily: "Inter-Bold",
      color: "#0F172A",
    },
    modalClose: {
      fontSize: 14,
      fontFamily: "Inter-SemiBold",
      color: "#0F766E",
    },
    modalLabel: {
      fontSize: 12,
      fontFamily: "Inter-SemiBold",
      color: "#64748B",
      marginBottom: 4,
    },
    modalValue: {
      fontSize: 13,
      fontFamily: "Inter-SemiBold",
      color: "#0F172A",
    },
    fab: {
      position: "absolute" as const,
      right: 20,
      bottom: 100,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: "#D48A00",
      alignItems: "center" as const,
      justifyContent: "center" as const,
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.18,
      shadowRadius: 12,
      elevation: 6,
    },
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: applyFilters is declared later in the component; adding it here would cause a TDZ access.
  const loadTimeline = useCallback(
    async (isRefresh = false) => {
      if (!user) {
        return;
      }

      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        let timelineEvents: TimelineEvent[] = [];

        switch (viewMode) {
          case "day":
            timelineEvents = await timelineService.getEventsForDay(
              user.id,
              currentDate
            );
            break;
          case "week": {
            const weekStart = new Date(currentDate);
            weekStart.setDate(weekStart.getDate() - weekStart.getDay());
            timelineEvents = await timelineService.getEventsForWeek(
              user.id,
              weekStart
            );
            break;
          }
          case "month": {
            const monthStart = new Date(
              currentDate.getFullYear(),
              currentDate.getMonth(),
              1
            );
            timelineEvents = await timelineService.getEventsForMonth(
              user.id,
              monthStart
            );
            break;
          }
          case "year": {
            const yearStart = new Date(currentDate.getFullYear(), 0, 1);
            const yearEnd = new Date(
              currentDate.getFullYear(),
              11,
              31,
              23,
              59,
              59
            );
            timelineEvents = await timelineService.getHealthTimeline(
              user.id,
              yearStart,
              yearEnd
            );
            break;
          }
          default:
            break;
        }

        setEvents(timelineEvents);
        applyFilters(timelineEvents);
      } catch (_error) {
        // Handle error silently
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user, viewMode, currentDate]
  );

  const applyFilters = useCallback(
    (eventsToFilter: TimelineEvent[]) => {
      let filtered = [...eventsToFilter];

      // Filter by type
      if (selectedFilter !== "all") {
        filtered = timelineService.filterByType(filtered, [selectedFilter]);
      }

      // Filter by search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(
          (event) =>
            event.title.toLowerCase().includes(query) ||
            event.description?.toLowerCase().includes(query)
        );
      }

      setFilteredEvents(filtered);
    },
    [selectedFilter, searchQuery]
  );

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  useEffect(() => {
    applyFilters(events);
  }, [events, applyFilters]);

  const navigateDate = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate);
    switch (viewMode) {
      case "day":
        newDate.setDate(newDate.getDate() + (direction === "next" ? 1 : -1));
        break;
      case "week":
        newDate.setDate(newDate.getDate() + (direction === "next" ? 7 : -7));
        break;
      case "month":
        newDate.setMonth(newDate.getMonth() + (direction === "next" ? 1 : -1));
        break;
      case "year":
        newDate.setFullYear(
          newDate.getFullYear() + (direction === "next" ? 1 : -1)
        );
        break;
      default:
        break;
    }
    setCurrentDate(newDate);
  };

  const formatDateRange = () => {
    switch (viewMode) {
      case "day":
        return safeFormatDate(
          currentDate,
          isRTL ? "ar-u-ca-gregory" : "en-US",
          {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          }
        );
      case "week": {
        const weekStart = new Date(currentDate);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        return `${safeFormatDate(
          weekStart,
          isRTL ? "ar-u-ca-gregory" : "en-US",
          {
            month: "short",
            day: "numeric",
          }
        )} - ${safeFormatDate(weekEnd, isRTL ? "ar-u-ca-gregory" : "en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}`;
      }
      case "month":
        return safeFormatDate(
          currentDate,
          isRTL ? "ar-u-ca-gregory" : "en-US",
          {
            month: "long",
            year: "numeric",
          }
        );
      case "year":
        return currentDate.getFullYear().toString();
      default:
        return "";
    }
  };

  const getEventIcon = (type: TimelineEvent["type"]) => {
    const icons: Record<TimelineEvent["type"], typeof Activity> = {
      symptom: Activity,
      medication: Pill,
      mood: Smile,
      allergy: AlertTriangle,
      vital: Activity,
      labResult: TestTube,
      calendar: Calendar,
      medicalHistory: FileText,
    };
    return icons[type] || Activity;
  };

  const getEventTypeLabel = (type: TimelineEvent["type"]) => {
    const labels: Record<TimelineEvent["type"], { en: string; ar: string }> = {
      symptom: { en: "Symptom", ar: "أعراض صحية" },
      medication: { en: "Medication", ar: "دواء" },
      mood: { en: "Mood", ar: "حالة نفسية" },
      allergy: { en: "Allergy", ar: "حساسية" },
      vital: { en: "Vital", ar: "مؤشر حيوي" },
      labResult: { en: "Lab Result", ar: "نتيجة مختبر" },
      calendar: { en: "Event", ar: "حدث صحي" },
      medicalHistory: { en: "Medical History", ar: "تاريخ طبي" },
    };
    return isRTL ? labels[type].ar : labels[type].en;
  };

  const groupedEvents = timelineService.groupByDate(filteredEvents);
  const sortedDates = Array.from(groupedEvents.keys()).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  const filterOptions: Array<{ value: FilterType; label: string }> = [
    { value: "all", label: isRTL ? "الكل" : "All" },
    { value: "symptom", label: isRTL ? "أعراض صحية" : "Symptoms" },
    { value: "medication", label: isRTL ? "أدوية" : "Medications" },
    { value: "mood", label: isRTL ? "حالة نفسية" : "Moods" },
    { value: "allergy", label: isRTL ? "حساسية" : "Allergies" },
    { value: "labResult", label: isRTL ? "نتائج مختبر" : "Lab Results" },
    { value: "calendar", label: isRTL ? "أحداث صحية" : "Events" },
    { value: "medicalHistory", label: isRTL ? "تاريخ طبي" : "Medical History" },
  ];

  if (!user) {
    return (
      <GradientScreen
        edges={["top"]}
        pointerEvents="box-none"
        style={styles.container as ViewStyle}
      >
        <View style={styles.emptyContainer as ViewStyle}>
          <Text style={[styles.emptyText, isRTL && styles.rtlText]}>
            {isRTL ? "يجب تسجيل الدخول" : "Please log in"}
          </Text>
        </View>
      </GradientScreen>
    );
  }

  return (
    <GradientScreen
      edges={["top"]}
      pointerEvents="box-none"
      style={styles.container as ViewStyle}
    >
      <View style={styles.headerWrap as ViewStyle}>
        <WavyBackground
          contentPosition="top"
          curve="home"
          height={240}
          variant="teal"
        >
          <View style={styles.headerContent as ViewStyle}>
            <View
              style={[
                styles.headerRow,
                isRTL && { flexDirection: "row-reverse" as const },
              ]}
            >
              <TouchableOpacity
                onPress={() =>
                  params.returnTo === "track"
                    ? timelineRouter.push("/(tabs)/track")
                    : timelineRouter.back()
                }
                style={styles.backButton as ViewStyle}
              >
                <ArrowLeft
                  color="#003543"
                  size={20}
                  style={
                    isRTL ? { transform: [{ rotate: "180deg" }] } : undefined
                  }
                />
              </TouchableOpacity>
              <View style={styles.headerTitleWrap as ViewStyle}>
                <View
                  style={[
                    styles.headerTitleRow,
                    isRTL && { flexDirection: "row-reverse" as const },
                  ]}
                >
                  <Calendar color="#EB9C0C" size={20} />
                  <Text style={styles.headerTitle as TextStyle}>
                    {isRTL ? "السجل الزمني الصحي" : "Health Timeline"}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.headerSubtitle as TextStyle,
                    isRTL && styles.rtlText,
                  ]}
                >
                  Track health events
                </Text>
              </View>
            </View>
          </View>
        </WavyBackground>
      </View>

      {/* Search */}
      <View
        style={[
          styles.searchContainer as ViewStyle,
          isRTL && { flexDirection: "row-reverse" as const },
        ]}
      >
        <TextInput
          onChangeText={setSearchQuery}
          placeholder={isRTL ? "بحث..." : "Search..."}
          placeholderTextColor="#94A3B8"
          style={[
            styles.searchInput as TextStyle,
            isRTL && (styles.rtlText as TextStyle),
          ]}
          value={searchQuery}
        />
        <TouchableOpacity
          onPress={() => setShowFilters(true)}
          style={styles.filterButton as ViewStyle}
        >
          <Filter color="#003543" size={20} />
        </TouchableOpacity>
      </View>

      {/* View Mode Selector */}
      <View
        style={[
          styles.viewModeSelector as ViewStyle,
          isRTL && { flexDirection: "row-reverse" as const },
        ]}
      >
        {/* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: compact map for mode-specific chips and labels. */}
        {(["day", "week", "month", "year"] as ViewMode[]).map((mode) => (
          <TouchableOpacity
            key={mode}
            onPress={() => setViewMode(mode)}
            style={[
              styles.viewModeButton as ViewStyle,
              viewMode === mode && (styles.viewModeButtonActive as ViewStyle),
            ]}
          >
            <Text
              style={[
                styles.viewModeButtonText as TextStyle,
                viewMode === mode &&
                  (styles.viewModeButtonTextActive as TextStyle),
              ]}
            >
              {isRTL
                ? mode === "day"
                  ? "يوم"
                  : mode === "week"
                    ? "أسبوع"
                    : mode === "month"
                      ? "شهر"
                      : "سنة"
                : mode.charAt(0).toUpperCase() + mode.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Date Navigation */}
      <View
        style={[
          styles.dateNavigation as ViewStyle,
          isRTL && { flexDirection: "row-reverse" as const },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigateDate("prev")}
          style={styles.dateNavButton as ViewStyle}
        >
          <ChevronLeft color="#003543" size={20} />
        </TouchableOpacity>
        <Text
          style={[
            styles.dateText as TextStyle,
            isRTL && (styles.rtlText as TextStyle),
          ]}
        >
          {formatDateRange()}
        </Text>
        <TouchableOpacity
          onPress={() => navigateDate("next")}
          style={styles.dateNavButton as ViewStyle}
        >
          <ChevronRight color="#003543" size={20} />
        </TouchableOpacity>
      </View>

      {/* Timeline */}
      {loading ? (
        <View style={styles.emptyContainer as ViewStyle}>
          <ActivityIndicator color="#0F766E" size="large" />
        </View>
      ) : filteredEvents.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer as ViewStyle}
          refreshControl={
            <RefreshControl
              onRefresh={() => loadTimeline(true)}
              refreshing={refreshing}
              tintColor="#0F766E"
            />
          }
        >
          <FileText color="#94A3B8" size={64} />
          <Text
            style={[
              styles.emptyText as TextStyle,
              isRTL && (styles.rtlText as TextStyle),
            ]}
          >
            {isRTL
              ? "لا توجد أحداث صحية في هذا الفترة"
              : "No events in this period"}
          </Text>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.timelineContainer as ViewStyle}
          refreshControl={
            <RefreshControl
              onRefresh={() => loadTimeline(true)}
              refreshing={refreshing}
              tintColor="#0F766E"
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {sortedDates.map((dateKey, _dateIndex) => {
            const dateEvents = groupedEvents.get(dateKey) || [];
            const date = new Date(dateKey);

            return (
              <View key={dateKey} style={styles.timelineDateGroup as ViewStyle}>
                <View
                  style={[
                    styles.dateHeader as ViewStyle,
                    isRTL && { flexDirection: "row-reverse" as const },
                  ]}
                >
                  <Text
                    style={[
                      styles.dateHeaderText as TextStyle,
                      isRTL && (styles.rtlText as TextStyle),
                    ]}
                  >
                    {safeFormatDate(date, isRTL ? "ar-u-ca-gregory" : "en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </Text>
                  <View style={styles.badge as ViewStyle}>
                    <Text style={styles.badgeText as TextStyle}>
                      {dateEvents.length}
                    </Text>
                  </View>
                </View>

                {dateEvents.map((event, eventIndex) => {
                  const IconComponent = getEventIcon(event.type);
                  const isLast = eventIndex === dateEvents.length - 1;

                  return (
                    <View
                      key={event.id}
                      style={[
                        styles.eventItem as ViewStyle,
                        isRTL && { flexDirection: "row-reverse" as const },
                      ]}
                    >
                      <View style={{ alignItems: "center" }}>
                        <View
                          style={[
                            styles.eventDot as ViewStyle,
                            {
                              backgroundColor: event.color,
                              marginRight: isRTL ? 0 : 12,
                              marginLeft: isRTL ? 12 : 0,
                            },
                          ]}
                        >
                          <IconComponent color="#FFFFFF" size={18} />
                        </View>
                        {!isLast && (
                          <View
                            style={[
                              styles.timelineLine as ViewStyle,
                              {
                                marginRight: isRTL ? 12 : 0,
                                marginLeft: isRTL ? 0 : 12,
                              },
                            ]}
                          />
                        )}
                      </View>
                      <View
                        style={[
                          styles.eventContent as ViewStyle,
                          isRTL ? { marginRight: 12 } : { marginLeft: 12 },
                        ]}
                      >
                        <TouchableOpacity
                          activeOpacity={0.9}
                          onPress={() => {
                            setSelectedEvent(event);
                            setShowEventModal(true);
                          }}
                          style={styles.eventCard as ViewStyle}
                        >
                          <View style={styles.eventHeader as ViewStyle}>
                            <View style={{ flex: 1 }}>
                              <Text
                                style={[
                                  styles.eventTitle as TextStyle,
                                  isRTL && (styles.rtlText as TextStyle),
                                ]}
                              >
                                {t(event.title, event.title)}
                              </Text>
                              <View style={styles.eventTypeChip as ViewStyle}>
                                <Text style={styles.eventTypeText as TextStyle}>
                                  {getEventTypeLabel(event.type)}
                                </Text>
                              </View>
                            </View>
                            <Text style={styles.eventTime as TextStyle}>
                              {safeFormatTime(
                                event.timestamp,
                                isRTL ? "ar" : "en-US",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )}
                            </Text>
                          </View>
                          {event.description ? (
                            <Text
                              style={[
                                styles.eventDescription as TextStyle,
                                isRTL && (styles.rtlText as TextStyle),
                              ]}
                            >
                              {event.description}
                            </Text>
                          ) : null}
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
      )}

      <TouchableOpacity
        onPress={() => timelineRouter.push("/(tabs)/track")}
        style={styles.fab as ViewStyle}
      >
        <Plus color="#FFFFFF" size={22} />
      </TouchableOpacity>

      <Modal
        animationType="slide"
        onRequestClose={() => setShowFilters(false)}
        transparent={true}
        visible={showFilters}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            justifyContent: "flex-end",
          }}
        >
          <View style={styles.filterModal as ViewStyle}>
            <View
              style={[
                styles.modalHeader as ViewStyle,
                isRTL && { flexDirection: "row-reverse" as const },
              ]}
            >
              <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
                {isRTL ? "تصفية الأحداث الصحية" : "Filter"}
              </Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <Text style={styles.modalClose as TextStyle}>
                  {isRTL ? "إغلاق" : "Close"}
                </Text>
              </TouchableOpacity>
            </View>
            {filterOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                onPress={() => {
                  setSelectedFilter(option.value);
                  setShowFilters(false);
                }}
                style={[
                  styles.filterOption as ViewStyle,
                  isRTL && { flexDirection: "row-reverse" as const },
                ]}
              >
                <Text style={[styles.modalValue, isRTL && styles.rtlText]}>
                  {option.label}
                </Text>
                {selectedFilter === option.value && (
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: "#0F766E",
                      borderWidth: 4,
                      borderColor: "#FFFFFF",
                    }}
                  />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        onRequestClose={() => {
          setShowEventModal(false);
          setSelectedEvent(null);
        }}
        presentationStyle="pageSheet"
        visible={showEventModal && !!selectedEvent}
      >
        <SafeAreaView style={styles.container as ViewStyle}>
          <View
            style={[
              styles.modalHeader as ViewStyle,
              isRTL && { flexDirection: "row-reverse" as const },
            ]}
          >
            <Text
              style={[
                styles.modalTitle as TextStyle,
                isRTL && (styles.rtlText as TextStyle),
              ]}
            >
              {selectedEvent?.title}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setShowEventModal(false);
                setSelectedEvent(null);
              }}
            >
              <Text style={styles.modalClose as TextStyle}>
                {isRTL ? "إغلاق" : "Close"}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent as ViewStyle}>
            {selectedEvent ? (
              <>
                <View style={{ marginBottom: 16 }}>
                  <View style={styles.eventTypeChip as ViewStyle}>
                    <Text style={styles.eventTypeText as TextStyle}>
                      {getEventTypeLabel(selectedEvent.type)}
                    </Text>
                  </View>
                </View>
                <View style={{ marginBottom: 16 }}>
                  <Text
                    style={[
                      styles.modalLabel as TextStyle,
                      isRTL && (styles.rtlText as TextStyle),
                    ]}
                  >
                    {isRTL ? "التاريخ والوقت" : "Date & Time"}
                  </Text>
                  <Text
                    style={[
                      styles.modalValue as TextStyle,
                      isRTL && (styles.rtlText as TextStyle),
                    ]}
                  >
                    {safeFormatDateTime(
                      selectedEvent.timestamp,
                      isRTL ? "ar" : "en-US"
                    )}
                  </Text>
                </View>
                {selectedEvent.description ? (
                  <View style={{ marginBottom: 16 }}>
                    <Text
                      style={[
                        styles.modalLabel as TextStyle,
                        isRTL && (styles.rtlText as TextStyle),
                      ]}
                    >
                      {isRTL ? "الوصف الصحي" : "Description"}
                    </Text>
                    <Text
                      style={[
                        styles.modalValue as TextStyle,
                        isRTL && (styles.rtlText as TextStyle),
                      ]}
                    >
                      {selectedEvent.description}
                    </Text>
                  </View>
                ) : null}
              </>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </GradientScreen>
  );
}
