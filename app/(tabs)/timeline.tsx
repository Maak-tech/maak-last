import { useRouter } from "expo-router";
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
  Smile,
  TestTube,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  type StyleProp,
  Text,
  TextInput,
  type TextStyle,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import { Card } from "@/components/design-system";
import { Badge } from "@/components/design-system/AdditionalComponents";
import {
  Caption,
  Heading,
  Text as TypographyText,
} from "@/components/design-system/Typography";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  type TimelineEvent,
  timelineService,
} from "@/lib/services/timelineService";
import { createThemedStyles, getTextStyle } from "@/utils/styles";

type ViewMode = "day" | "week" | "month" | "year";
type FilterType = TimelineEvent["type"] | "all";

export default function TimelineScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const timelineRouter = useRouter();
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

  const styles = createThemedStyles((theme) => ({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background.primary,
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
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: "center",
      alignItems: "center",
    },
    backButtonRTL: {
      // RTL adjustments if needed
    },
    headerLeft: {
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      gap: theme.spacing.base,
    },
    headerTitle: {
      ...getTextStyle(theme, "heading", "bold", theme.colors.text.primary),
      fontSize: 24,
    },
    searchContainer: {
      flexDirection: isRTL ? "row-reverse" : "row",
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.sm,
      gap: theme.spacing.xs,
    },
    searchInput: {
      flex: 1,
      ...getTextStyle(theme, "body", "regular", theme.colors.text.primary),
      borderWidth: 1,
      borderColor: theme.colors.border.light,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.sm,
      backgroundColor: theme.colors.background.secondary,
    },
    filterButton: {
      padding: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border.light,
      backgroundColor: theme.colors.background.secondary,
    },
    viewModeSelector: {
      flexDirection: isRTL ? "row-reverse" : "row",
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.sm,
      gap: theme.spacing.xs,
    },
    viewModeButton: {
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.borderRadius.full,
      borderWidth: 1,
      borderColor: theme.colors.border.light,
      backgroundColor: theme.colors.background.secondary,
    },
    viewModeButtonActive: {
      backgroundColor: theme.colors.primary.main,
      borderColor: theme.colors.primary.main,
    },
    viewModeButtonText: {
      ...getTextStyle(theme, "caption", "medium", theme.colors.text.secondary),
      fontSize: 12,
    },
    viewModeButtonTextActive: {
      color: theme.colors.neutral.white,
    },
    dateNavigation: {
      flexDirection: isRTL ? "row-reverse" : "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.sm,
    },
    dateText: {
      ...getTextStyle(
        theme,
        "subheading",
        "semibold",
        theme.colors.text.primary
      ),
      flex: 1,
      textAlign: "center",
    },
    timelineContainer: {
      padding: theme.spacing.base,
    },
    timelineDateGroup: {
      marginBottom: theme.spacing.xl,
    },
    dateHeader: {
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      marginBottom: theme.spacing.base,
      paddingBottom: theme.spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.light,
    },
    dateHeaderText: {
      ...getTextStyle(theme, "subheading", "bold", theme.colors.text.primary),
      marginLeft: isRTL ? 0 : theme.spacing.sm,
      marginRight: isRTL ? theme.spacing.sm : 0,
    },
    eventCount: {
      ...getTextStyle(theme, "caption", "regular", theme.colors.text.secondary),
    },
    timelineLine: {
      width: 2,
      backgroundColor: theme.colors.border.light,
      marginLeft: isRTL ? 0 : theme.spacing.base + 15,
      marginRight: isRTL ? theme.spacing.base + 15 : 0,
      minHeight: 20,
    },
    eventItem: {
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      marginBottom: theme.spacing.base,
    },
    eventDot: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 3,
      borderColor: theme.colors.background.primary,
      marginLeft: isRTL ? 0 : theme.spacing.base,
      marginRight: isRTL ? theme.spacing.base : 0,
      justifyContent: "center",
      alignItems: "center",
    },
    eventContent: {
      flex: 1,
      marginLeft: isRTL ? 0 : theme.spacing.base,
      marginRight: isRTL ? theme.spacing.base : 0,
    },
    eventCard: {
      marginBottom: theme.spacing.sm,
    },
    eventHeader: {
      flexDirection: isRTL ? "row-reverse" : "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: theme.spacing.xs,
    },
    eventTitle: {
      ...getTextStyle(theme, "subheading", "bold", theme.colors.text.primary),
      flex: 1,
    },
    eventTime: {
      ...getTextStyle(theme, "caption", "regular", theme.colors.text.secondary),
    },
    eventDescription: {
      ...getTextStyle(theme, "body", "regular", theme.colors.text.secondary),
      marginTop: theme.spacing.xs,
    },
    filterModal: {
      backgroundColor: theme.colors.background.primary,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: theme.spacing.base,
      maxHeight: "80%",
    },
    filterOption: {
      flexDirection: isRTL ? "row-reverse" : "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: theme.spacing.base,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.light,
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
    rtlText: {
      textAlign: isRTL ? "right" : "left",
    },
  }))(theme);

  const loadTimeline = useCallback(
    async (isRefresh = false) => {
      if (!user) return;

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
        }

        setEvents(timelineEvents);
        applyFilters(timelineEvents);
      } catch (error) {
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
  }, [selectedFilter, searchQuery, events, applyFilters]);

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
    }
    setCurrentDate(newDate);
  };

  const formatDateRange = () => {
    switch (viewMode) {
      case "day":
        return currentDate.toLocaleDateString(
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
        return `${weekStart.toLocaleDateString(
          isRTL ? "ar-u-ca-gregory" : "en-US",
          {
            month: "short",
            day: "numeric",
          }
        )} - ${weekEnd.toLocaleDateString(isRTL ? "ar-u-ca-gregory" : "en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}`;
      }
      case "month":
        return currentDate.toLocaleDateString(
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
    const icons: Record<TimelineEvent["type"], any> = {
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
      <SafeAreaView style={styles.container as ViewStyle}>
        <View style={styles.emptyContainer as ViewStyle}>
          <Text style={styles.emptyText as TextStyle}>
            {isRTL ? "يجب تسجيل الدخول" : "Please log in"}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container as ViewStyle}>
      <View style={styles.header as ViewStyle}>
        <TouchableOpacity
          onPress={() => timelineRouter.back()}
          style={[
            styles.backButton as ViewStyle,
            isRTL && (styles.backButtonRTL as ViewStyle),
          ]}
        >
          <ArrowLeft
            color={theme.colors.text.primary}
            size={24}
            style={[isRTL && { transform: [{ rotate: "180deg" }] }]}
          />
        </TouchableOpacity>

        <View style={styles.headerLeft as ViewStyle}>
          <Heading
            level={4}
            style={
              [
                styles.headerTitle as TextStyle,
                isRTL && (styles.rtlText as TextStyle),
              ] as StyleProp<TextStyle>
            }
          >
            {isRTL ? "السجل الزمني الصحي" : "Health Timeline"}
          </Heading>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer as ViewStyle}>
        <TextInput
          onChangeText={setSearchQuery}
          placeholder={isRTL ? "بحث..." : "Search..."}
          placeholderTextColor={theme.colors.text.secondary}
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
          <Filter color={theme.colors.text.primary} size={20} />
        </TouchableOpacity>
      </View>

      {/* View Mode Selector */}
      <View style={styles.viewModeSelector as ViewStyle}>
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
      <View style={styles.dateNavigation as ViewStyle}>
        <TouchableOpacity onPress={() => navigateDate("prev")}>
          <ChevronLeft color={theme.colors.text.primary} size={24} />
        </TouchableOpacity>
        <Text
          style={[
            styles.dateText as TextStyle,
            isRTL && (styles.rtlText as TextStyle),
          ]}
        >
          {formatDateRange()}
        </Text>
        <TouchableOpacity onPress={() => navigateDate("next")}>
          <ChevronRight color={theme.colors.text.primary} size={24} />
        </TouchableOpacity>
      </View>

      {/* Timeline */}
      {loading ? (
        <View style={styles.emptyContainer as ViewStyle}>
          <ActivityIndicator color={theme.colors.primary.main} size="large" />
        </View>
      ) : filteredEvents.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer as ViewStyle}
          refreshControl={
            <RefreshControl
              onRefresh={() => loadTimeline(true)}
              refreshing={refreshing}
            />
          }
        >
          <FileText color={theme.colors.text.secondary} size={64} />
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
          refreshControl={
            <RefreshControl
              onRefresh={() => loadTimeline(true)}
              refreshing={refreshing}
            />
          }
          style={styles.timelineContainer as ViewStyle}
        >
          {sortedDates.map((dateKey, dateIndex) => {
            const dateEvents = groupedEvents.get(dateKey) || [];
            const date = new Date(dateKey);

            return (
              <View key={dateKey} style={styles.timelineDateGroup as ViewStyle}>
                <View style={styles.dateHeader as ViewStyle}>
                  <TypographyText
                    style={
                      [
                        styles.dateHeaderText as TextStyle,
                        isRTL && (styles.rtlText as TextStyle),
                      ] as any
                    }
                    weight="bold"
                  >
                    {date.toLocaleDateString(
                      isRTL ? "ar-u-ca-gregory" : "en-US",
                      {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      }
                    )}
                  </TypographyText>
                  <Badge size="small" style={{}} variant="outline">
                    {dateEvents.length}
                  </Badge>
                </View>

                {dateEvents.map((event, eventIndex) => {
                  const IconComponent = getEventIcon(event.type);
                  const isLast = eventIndex === dateEvents.length - 1;

                  return (
                    <View key={event.id} style={styles.eventItem as ViewStyle}>
                      <View>
                        <View
                          style={[
                            styles.eventDot as ViewStyle,
                            { backgroundColor: event.color },
                          ]}
                        >
                          <IconComponent
                            color={theme.colors.neutral.white}
                            size={18}
                          />
                        </View>
                        {!isLast && (
                          <View style={styles.timelineLine as ViewStyle} />
                        )}
                      </View>
                      <View style={styles.eventContent as ViewStyle}>
                        <Card
                          contentStyle={{}}
                          onPress={() => {
                            setSelectedEvent(event);
                            setShowEventModal(true);
                          }}
                          style={styles.eventCard as ViewStyle}
                          variant="elevated"
                        >
                          <View style={styles.eventHeader as ViewStyle}>
                            <View style={{ flex: 1 }}>
                              <TypographyText
                                style={
                                  [
                                    styles.eventTitle as TextStyle,
                                    isRTL && (styles.rtlText as TextStyle),
                                  ] as any
                                }
                                weight="bold"
                              >
                                {event.title}
                              </TypographyText>
                              <Badge
                                size="small"
                                style={{
                                  marginTop: 4,
                                  alignSelf: "flex-start",
                                }}
                                variant="outline"
                              >
                                {getEventTypeLabel(event.type)}
                              </Badge>
                            </View>
                            <Caption
                              numberOfLines={1}
                              style={styles.eventTime as TextStyle}
                            >
                              {event.timestamp.toLocaleTimeString(
                                isRTL ? "ar" : "en-US",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )}
                            </Caption>
                          </View>
                          {event.description && (
                            <TypographyText
                              style={
                                [
                                  styles.eventDescription as TextStyle,
                                  isRTL && (styles.rtlText as TextStyle),
                                ] as any
                              }
                            >
                              {event.description}
                            </TypographyText>
                          )}
                        </Card>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Filter Modal */}
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
              style={{
                flexDirection: isRTL ? "row-reverse" : "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: theme.spacing.base,
              }}
            >
              <Heading level={6} style={[styles.rtlText as TextStyle] as any}>
                {isRTL ? "تصفية الأحداث الصحية" : "Filter"}
              </Heading>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <Text
                  style={{ fontSize: 18, color: theme.colors.primary.main }}
                >
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
                style={styles.filterOption as ViewStyle}
              >
                <TypographyText style={[styles.rtlText as TextStyle] as any}>
                  {option.label}
                </TypographyText>
                {selectedFilter === option.value && (
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: theme.colors.primary.main,
                      borderWidth: 4,
                      borderColor: theme.colors.background.primary,
                    }}
                  />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Event Detail Modal */}
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
          <View style={styles.header as ViewStyle}>
            <Heading
              level={5}
              style={
                [
                  styles.headerTitle as TextStyle,
                  isRTL && (styles.rtlText as TextStyle),
                ] as any
              }
            >
              {selectedEvent?.title}
            </Heading>
            <TouchableOpacity
              onPress={() => {
                setShowEventModal(false);
                setSelectedEvent(null);
              }}
            >
              <Text style={{ fontSize: 18, color: theme.colors.primary.main }}>
                {isRTL ? "إغلاق" : "Close"}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: theme.spacing.base }}>
            {selectedEvent && (
              <>
                <View style={{ marginBottom: theme.spacing.base }}>
                  <Badge size="small" style={{}} variant="outline">
                    {getEventTypeLabel(selectedEvent.type)}
                  </Badge>
                </View>
                <View style={{ marginBottom: theme.spacing.base }}>
                  <TypographyText
                    style={[styles.rtlText as TextStyle] as any}
                    weight="semibold"
                  >
                    {isRTL ? "التاريخ والوقت" : "Date & Time"}
                  </TypographyText>
                  <Caption
                    numberOfLines={1}
                    style={[styles.rtlText as TextStyle] as any}
                  >
                    {selectedEvent.timestamp.toLocaleString(
                      isRTL ? "ar" : "en-US"
                    )}
                  </Caption>
                </View>
                {selectedEvent.description && (
                  <View style={{ marginBottom: theme.spacing.base }}>
                    <TypographyText
                      style={[styles.rtlText as TextStyle] as any}
                      weight="semibold"
                    >
                      {isRTL ? "الوصف الصحي" : "Description"}
                    </TypographyText>
                    <Caption
                      numberOfLines={10}
                      style={[styles.rtlText as TextStyle] as any}
                    >
                      {selectedEvent.description}
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
