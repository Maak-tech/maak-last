/* biome-ignore-all lint/style/noNestedTernary: preserving existing UI conditional copy paths in this batch. */
/* biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: large legacy screen to be split in future refactor batches. */
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  cancelScheduledNotificationAsync,
  getPermissionsAsync,
  requestPermissionsAsync,
  SchedulableTriggerInputTypes,
  scheduleNotificationAsync,
} from "expo-notifications";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Droplet,
  Edit,
  Pill,
  Plus,
  Trash2,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import HealthChart from "@/app/components/HealthChart";
import GradientScreen from "@/components/figma/GradientScreen";
import WavyBackground from "@/components/figma/WavyBackground";
import { Colors, Shadows } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import type { TimeSeriesData } from "@/lib/services/chartsService";
import { cycleDailyService } from "@/lib/services/cycleDailyService";
import { periodService } from "@/lib/services/periodService";
import { symptomService } from "@/lib/services/symptomService";
import { logger } from "@/lib/utils/logger";
import type {
  CycleDailyEntry,
  PeriodCycle,
  PeriodEntry,
  Symptom,
} from "@/types";
import { safeFormatDate } from "@/utils/dateFormat";

const BIRTH_CONTROL_REMINDER_ID_KEY = "birth_control_reminder_id";
const BIRTH_CONTROL_REMINDER_TIME_KEY = "birth_control_reminder_time";

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

const DAILY_FLOW_VALUES = ["none", "light", "medium", "heavy"] as const;
const DISCHARGE_VALUES = [
  "none",
  "dry",
  "sticky",
  "creamy",
  "eggWhite",
  "watery",
  "other",
] as const;
const BIRTH_CONTROL_METHOD_VALUES = [
  "none",
  "pill",
  "patch",
  "ring",
  "iud",
  "implant",
  "injection",
  "other",
] as const;

export default function WomensHealthScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const isRTL = i18n.language === "ar";
  const insets = useSafeAreaInsets();

  const [periodEntries, setPeriodEntries] = useState<PeriodEntry[]>([]);
  const [cycleInfo, setCycleInfo] = useState<PeriodCycle | null>(null);
  const [dailyEntries, setDailyEntries] = useState<CycleDailyEntry[]>([]);
  const [recentSymptoms, setRecentSymptoms] = useState<Symptom[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PeriodEntry | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCalendarView, setShowCalendarView] = useState(false);
  const [activeDateField, setActiveDateField] = useState<"start" | "end">(
    "start"
  );
  const [datePickerMonth, setDatePickerMonth] = useState(new Date());
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const didInitCalendarMonthRef = useRef(false);
  const [formData, setFormData] = useState({
    startDate: new Date(),
    endDate: undefined as Date | undefined,
    flowIntensity: "medium" as "light" | "medium" | "heavy",
    symptoms: [] as string[],
    notes: "",
  });

  const [showDailyModal, setShowDailyModal] = useState(false);
  const [editingDailyDate, setEditingDailyDate] = useState<Date>(new Date());
  const [pillReminderId, setPillReminderId] = useState<string | null>(null);
  const [pillReminderTime, setPillReminderTime] = useState<{
    hour: number;
    minute: number;
  }>({ hour: 21, minute: 0 });
  const [dailyFormData, setDailyFormData] = useState<{
    flowIntensity: "none" | "light" | "medium" | "heavy";
    crampsSeverity: 0 | 1 | 2 | 3;
    mood: 1 | 2 | 3 | 4 | 5 | null;
    sleepQuality: 1 | 2 | 3 | 4 | 5 | null;
    energyLevel: 1 | 2 | 3 | 4 | 5 | null;
    dischargeType:
      | "none"
      | "dry"
      | "sticky"
      | "creamy"
      | "eggWhite"
      | "watery"
      | "other";
    spotting: boolean;
    birthControlMethod:
      | "none"
      | "pill"
      | "patch"
      | "ring"
      | "iud"
      | "implant"
      | "injection"
      | "other";
    birthControlTaken: boolean;
    sideEffectsText: string;
    notes: string;
  }>({
    flowIntensity: "none",
    crampsSeverity: 0,
    mood: null,
    sleepQuality: null,
    energyLevel: null,
    dischargeType: "none",
    spotting: false,
    birthControlMethod: "none",
    birthControlTaken: false,
    sideEffectsText: "",
    notes: "",
  });

  const loadData = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      const [entries, cycle, daily, symptoms] = await Promise.all([
        periodService.getUserPeriodEntries(user.id),
        periodService.getCycleInfo(user.id),
        cycleDailyService.getUserDailyEntries(user.id, { limitCount: 90 }),
        symptomService.getUserSymptoms(user.id, 500),
      ]);

      // Heal stale cycle info (e.g., after deletes or legacy data) by recalculating when needed.
      let nextCycle = cycle;
      const shouldRecalcCycle =
        (entries.length === 0 && Boolean(cycle)) ||
        (entries.length > 0 &&
          !(cycle?.nextPeriodPredicted && cycle?.ovulationPredicted));
      if (shouldRecalcCycle) {
        try {
          await periodService.updateCycleInfo(user.id);
          nextCycle = await periodService.getCycleInfo(user.id);
        } catch {
          // Ignore cycle recalculation errors and fall back to the existing cycle doc.
        }
      }

      setPeriodEntries(entries);
      setCycleInfo(nextCycle);
      setDailyEntries(daily);
      setRecentSymptoms(symptoms);
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

  useEffect(() => {
    let didCancel = false;
    const loadReminderState = async () => {
      try {
        const [storedId, storedTime] = await Promise.all([
          AsyncStorage.getItem(BIRTH_CONTROL_REMINDER_ID_KEY),
          AsyncStorage.getItem(BIRTH_CONTROL_REMINDER_TIME_KEY),
        ]);

        if (didCancel) {
          return;
        }

        setPillReminderId(storedId);
        if (storedTime) {
          const parsed = JSON.parse(storedTime) as
            | { hour: number; minute: number }
            | undefined;
          if (parsed && typeof parsed.hour === "number") {
            setPillReminderTime({
              hour: parsed.hour,
              minute: parsed.minute ?? 0,
            });
          }
        }
      } catch {
        // ignore persisted reminder state errors
      }
    };

    loadReminderState();
    return () => {
      didCancel = true;
    };
  }, []);

  const schedulePillReminder = useCallback(
    async (time: { hour: number; minute: number }) => {
      try {
        const permissions = await getPermissionsAsync();
        if (!permissions.granted) {
          const requested = await requestPermissionsAsync();
          if (!requested.granted) {
            Alert.alert(
              isRTL ? "الإشعارات" : "Notifications",
              isRTL
                ? "يرجى تفعيل إذن الإشعارات لتلقي تذكير يومي."
                : "Please enable notifications to receive a daily reminder."
            );
            return;
          }
        }

        if (pillReminderId) {
          await cancelScheduledNotificationAsync(pillReminderId);
        }

        const id = await scheduleNotificationAsync({
          content: {
            title: isRTL ? "تذكير" : "Reminder",
            body: isRTL
              ? "لا تنسي تسجيل وسيلة منع الحمل اليوم."
              : "Don’t forget to log your birth control today.",
            sound: true,
          },
          trigger: {
            type: SchedulableTriggerInputTypes.DAILY,
            hour: time.hour,
            minute: time.minute,
          },
        });

        await AsyncStorage.setItem(BIRTH_CONTROL_REMINDER_ID_KEY, id);
        await AsyncStorage.setItem(
          BIRTH_CONTROL_REMINDER_TIME_KEY,
          JSON.stringify(time)
        );
        setPillReminderId(id);
        setPillReminderTime(time);
      } catch (error) {
        logger.error("Failed to schedule pill reminder", error);
        Alert.alert(
          isRTL ? "خطأ" : "Error",
          isRTL ? "فشل جدولة التذكير" : "Failed to schedule reminder"
        );
      }
    },
    [isRTL, pillReminderId]
  );

  const disablePillReminder = useCallback(async () => {
    try {
      if (pillReminderId) {
        await cancelScheduledNotificationAsync(pillReminderId);
      }
      await AsyncStorage.removeItem(BIRTH_CONTROL_REMINDER_ID_KEY);
      setPillReminderId(null);
    } catch (error) {
      logger.error("Failed to disable pill reminder", error);
    }
  }, [pillReminderId]);

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

  const toDateOnly = useCallback(
    (date: Date) =>
      new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12),
    []
  );

  useEffect(() => {
    if (didInitCalendarMonthRef.current) {
      return;
    }
    if (cycleInfo?.ovulationPredicted) {
      setCalendarMonth(cycleInfo.ovulationPredicted);
      didInitCalendarMonthRef.current = true;
      return;
    }
    if (cycleInfo?.nextPeriodPredicted) {
      setCalendarMonth(cycleInfo.nextPeriodPredicted);
      didInitCalendarMonthRef.current = true;
    }
  }, [cycleInfo?.nextPeriodPredicted, cycleInfo?.ovulationPredicted]);

  const openDatePicker = useCallback(
    (field: "start" | "end") => {
      setActiveDateField(field);
      const initial =
        field === "start"
          ? formData.startDate
          : (formData.endDate ?? formData.startDate);
      setDatePickerMonth(initial);
      setShowDatePicker(true);
    },
    [formData.endDate, formData.startDate]
  );

  const setDateFieldValue = useCallback(
    (nextDate: Date) => {
      const selected = toDateOnly(nextDate);
      setFormData((prev) => {
        if (activeDateField === "start") {
          const nextStart = selected;
          const nextEnd =
            prev.endDate && prev.endDate.getTime() < nextStart.getTime()
              ? undefined
              : prev.endDate;
          return { ...prev, startDate: nextStart, endDate: nextEnd };
        }

        const nextEnd =
          selected.getTime() < prev.startDate.getTime()
            ? prev.startDate
            : selected;
        return { ...prev, endDate: nextEnd };
      });
    },
    [activeDateField, toDateOnly]
  );

  const clearEndDate = useCallback(() => {
    setFormData((prev) => ({ ...prev, endDate: undefined }));
    setShowDatePicker(false);
  }, []);

  const addDays = useCallback((date: Date, deltaDays: number) => {
    const next = new Date(date);
    next.setDate(next.getDate() + deltaDays);
    return next;
  }, []);

  const dateKey = useCallback((date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, []);

  const dailyEntryByKey = useMemo(() => {
    const map = new Map<string, CycleDailyEntry>();
    for (const entry of dailyEntries) {
      map.set(dateKey(toDateOnly(entry.date)), entry);
    }
    return map;
  }, [dailyEntries, dateKey, toDateOnly]);

  const openDailyLog = useCallback(
    (date: Date) => {
      const dateOnly = toDateOnly(date);
      const key = dateKey(dateOnly);
      const existing = dailyEntryByKey.get(key);

      setEditingDailyDate(dateOnly);
      setDailyFormData({
        flowIntensity: existing?.flowIntensity ?? "none",
        crampsSeverity: existing?.crampsSeverity ?? 0,
        mood: existing?.mood ?? null,
        sleepQuality: existing?.sleepQuality ?? null,
        energyLevel: existing?.energyLevel ?? null,
        dischargeType: existing?.dischargeType ?? "none",
        spotting: Boolean(existing?.spotting),
        birthControlMethod: existing?.birthControlMethod ?? "none",
        birthControlTaken: Boolean(existing?.birthControlTaken),
        sideEffectsText: (existing?.birthControlSideEffects || []).join(", "),
        notes: existing?.notes ?? "",
      });
      setShowDailyModal(true);
    },
    [dailyEntryByKey, dateKey, toDateOnly]
  );

  const handleSaveDailyLog = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    const sideEffects = dailyFormData.sideEffectsText
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    try {
      await cycleDailyService.upsertDailyEntry(user.id, editingDailyDate, {
        flowIntensity: dailyFormData.flowIntensity,
        crampsSeverity: dailyFormData.crampsSeverity,
        mood: dailyFormData.mood ?? undefined,
        sleepQuality: dailyFormData.sleepQuality ?? undefined,
        energyLevel: dailyFormData.energyLevel ?? undefined,
        dischargeType: dailyFormData.dischargeType,
        spotting: dailyFormData.spotting,
        birthControlMethod: dailyFormData.birthControlMethod,
        birthControlTaken: dailyFormData.birthControlTaken,
        birthControlSideEffects: sideEffects,
        notes: dailyFormData.notes || undefined,
      });
      setShowDailyModal(false);
      await loadData();
    } catch (error) {
      logger.error("Failed to save daily log", error);
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "فشل حفظ السجل اليومي" : "Failed to save daily log"
      );
    }
  }, [dailyFormData, editingDailyDate, isRTL, loadData, user?.id]);

  const handleDeleteDailyLog = useCallback(
    (date: Date) => {
      if (!user?.id) {
        return;
      }
      const key = dateKey(toDateOnly(date));
      const existing = dailyEntryByKey.get(key);
      if (!existing) {
        return;
      }

      Alert.alert(
        isRTL ? "حذف السجل اليومي" : "Delete Daily Log",
        isRTL
          ? "هل أنت متأكد من حذف هذا السجل اليومي؟"
          : "Are you sure you want to delete this daily log?",
        [
          { text: isRTL ? "إلغاء" : "Cancel", style: "cancel" },
          {
            text: isRTL ? "حذف" : "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                await cycleDailyService.deleteDailyEntry(existing.id);
                await loadData();
              } catch (_error) {
                Alert.alert(
                  isRTL ? "خطأ" : "Error",
                  isRTL ? "فشل حذف السجل اليومي" : "Failed to delete daily log"
                );
              }
            },
          },
        ]
      );
    },
    [dailyEntryByKey, dateKey, isRTL, loadData, toDateOnly, user?.id]
  );

  const weekStartsOn = isRTL ? 6 : 0; // ar: Sat, en: Sun

  const weekdayLabels = useMemo(() => {
    if (isRTL) {
      return [
        { key: "sat", label: "س" },
        { key: "sun", label: "ح" },
        { key: "mon", label: "ن" },
        { key: "tue", label: "ث" },
        { key: "wed", label: "ر" },
        { key: "thu", label: "خ" },
        { key: "fri", label: "ج" },
      ] as const;
    }

    return [
      { key: "sun", label: "S" },
      { key: "mon", label: "M" },
      { key: "tue", label: "T" },
      { key: "wed", label: "W" },
      { key: "thu", label: "T" },
      { key: "fri", label: "F" },
      { key: "sat", label: "S" },
    ] as const;
  }, [isRTL]);

  const buildMonthGrid = useCallback(
    (monthDate: Date) => {
      const firstOfMonth = new Date(
        monthDate.getFullYear(),
        monthDate.getMonth(),
        1,
        12
      );
      const firstDow = firstOfMonth.getDay(); // 0..6, Sun..Sat
      const offset = (firstDow - weekStartsOn + 7) % 7;
      const gridStart = addDays(firstOfMonth, -offset);

      const days: { date: Date; inMonth: boolean }[] = [];
      for (let i = 0; i < 42; i++) {
        const day = addDays(gridStart, i);
        days.push({
          date: day,
          inMonth:
            day.getMonth() === firstOfMonth.getMonth() &&
            day.getFullYear() === firstOfMonth.getFullYear(),
        });
      }

      return { days };
    },
    [addDays, weekStartsOn]
  );

  const actualPeriodDays = useMemo(() => {
    const keys = new Set<string>();
    for (const entry of periodEntries) {
      const start = toDateOnly(entry.startDate);
      const end = toDateOnly(entry.endDate ?? entry.startDate);
      const spanDays = Math.max(
        0,
        Math.floor((end.getTime() - start.getTime()) / 86_400_000)
      );
      for (let i = 0; i <= spanDays; i++) {
        keys.add(dateKey(addDays(start, i)));
      }
    }
    return keys;
  }, [addDays, dateKey, periodEntries, toDateOnly]);

  const predictedPeriodDays = useMemo(() => {
    const keys = new Set<string>();
    if (!cycleInfo?.nextPeriodPredicted) {
      return keys;
    }
    const start = toDateOnly(cycleInfo.nextPeriodPredicted);
    const len = cycleInfo?.averagePeriodLength ?? 5;
    for (let i = 0; i < len; i++) {
      keys.add(dateKey(addDays(start, i)));
    }
    return keys;
  }, [
    addDays,
    cycleInfo?.averagePeriodLength,
    cycleInfo?.nextPeriodPredicted,
    dateKey,
    toDateOnly,
  ]);

  const fertileWindowDays = useMemo(() => {
    const keys = new Set<string>();
    if (!cycleInfo?.ovulationPredicted) {
      return keys;
    }
    const ov = toDateOnly(cycleInfo.ovulationPredicted);
    // Standard fertile window estimate: ~5 days before ovulation through 1 day after.
    for (let i = -5; i <= 1; i++) {
      keys.add(dateKey(addDays(ov, i)));
    }
    return keys;
  }, [addDays, cycleInfo?.ovulationPredicted, dateKey, toDateOnly]);

  const ovulationKey = useMemo(() => {
    if (!cycleInfo?.ovulationPredicted) {
      return null;
    }
    return dateKey(toDateOnly(cycleInfo.ovulationPredicted));
  }, [cycleInfo?.ovulationPredicted, dateKey, toDateOnly]);

  const calendarMonthLabel = useMemo(
    () =>
      safeFormatDate(calendarMonth, isRTL ? "ar-u-ca-gregory" : "en-US", {
        month: "long",
        year: "numeric",
      }),
    [calendarMonth, isRTL]
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

  const predictionConfidenceLabel = useMemo(() => {
    const value =
      typeof cycleInfo?.predictionConfidence === "number"
        ? cycleInfo.predictionConfidence
        : null;
    if (value === null) {
      return null;
    }
    if (value >= 0.75) {
      return { label: isRTL ? "ثقة عالية" : "High confidence", value };
    }
    if (value >= 0.5) {
      return { label: isRTL ? "ثقة متوسطة" : "Medium confidence", value };
    }
    return { label: isRTL ? "ثقة منخفضة" : "Low confidence", value };
  }, [cycleInfo?.predictionConfidence, isRTL]);

  const diffDays = useCallback((a: Date, b: Date) => {
    const a0 = new Date(a);
    const b0 = new Date(b);
    a0.setHours(0, 0, 0, 0);
    b0.setHours(0, 0, 0, 0);
    return Math.floor((a0.getTime() - b0.getTime()) / 86_400_000);
  }, []);

  const getOvulationAndFertileDays = useCallback(
    (cycleLengthRaw: number, periodLengthRaw: number) => {
      const cycleLength = Math.max(15, Math.round(cycleLengthRaw));
      const periodLength = Math.max(
        1,
        Math.min(15, Math.round(periodLengthRaw))
      );

      // Luteal phase length is typically ~14 days, so ovulation ≈ cycleLength - 14.
      // Avoid clamping to a fixed max (which breaks for longer cycles). Instead,
      // clamp relative to period length and cycle length.
      const minOvulationDay = Math.min(cycleLength - 1, periodLength + 1);
      const maxOvulationDay = cycleLength - 1;
      const ovulationDay = Math.max(
        minOvulationDay,
        Math.min(maxOvulationDay, cycleLength - 14)
      );

      const fertileStart = Math.max(periodLength + 1, ovulationDay - 5);
      const fertileEnd = Math.min(cycleLength - 1, ovulationDay + 1);

      return {
        ovulationDay,
        fertileStart,
        fertileEnd,
        cycleLength,
        periodLength,
      };
    },
    []
  );

  const today = useMemo(() => toDateOnly(new Date()), [toDateOnly]);

  const todayCycleContext = useMemo(() => {
    if (!periodEntries.length) {
      return null;
    }
    const dateOnly = today;
    let idx = -1;
    for (let i = 0; i < periodEntries.length; i++) {
      const start = toDateOnly(periodEntries[i].startDate);
      if (start.getTime() <= dateOnly.getTime()) {
        idx = i;
        break;
      }
    }
    if (idx === -1) {
      return null;
    }
    const entry = periodEntries[idx];
    const cycleStart = toDateOnly(entry.startDate);
    const nextMoreRecentStart =
      idx > 0 ? toDateOnly(periodEntries[idx - 1].startDate) : null;
    const cycleLength =
      nextMoreRecentStart &&
      nextMoreRecentStart.getTime() > cycleStart.getTime()
        ? diffDays(nextMoreRecentStart, cycleStart)
        : (cycleInfo?.averageCycleLength ?? 28);
    const averagePeriodLength = cycleInfo?.averagePeriodLength ?? 5;
    const computedPeriodLength = entry.endDate
      ? diffDays(toDateOnly(entry.endDate), cycleStart) + 1
      : averagePeriodLength;
    const periodLength = Math.max(1, Math.min(15, computedPeriodLength));
    const dayInCycle = diffDays(dateOnly, cycleStart) + 1;

    const {
      ovulationDay,
      fertileStart,
      fertileEnd,
      cycleLength: safeCycleLength,
    } = getOvulationAndFertileDays(cycleLength, periodLength);

    let phase: "period" | "follicular" | "fertile" | "ovulation" | "luteal" =
      "luteal";
    if (dayInCycle <= periodLength) {
      phase = "period";
    } else if (dayInCycle === ovulationDay) {
      phase = "ovulation";
    } else if (dayInCycle >= fertileStart && dayInCycle <= fertileEnd) {
      phase = "fertile";
    } else if (dayInCycle < ovulationDay) {
      phase = "follicular";
    }

    const phaseLabel = (() => {
      switch (phase) {
        case "period":
          return isRTL ? "الحيض" : "Period";
        case "follicular":
          return isRTL ? "الطور الجُريبي" : "Follicular";
        case "fertile":
          return isRTL ? "نافذة الخصوبة" : "Fertile window";
        case "ovulation":
          return isRTL ? "الإباضة" : "Ovulation";
        default:
          return isRTL ? "الطور الأصفري" : "Luteal";
      }
    })();

    const phaseColor =
      phase === "period"
        ? Colors.accent.error
        : phase === "fertile"
          ? Colors.accent.success
          : phase === "ovulation"
            ? Colors.accent.warning
            : Colors.primary.main;

    return {
      dayInCycle,
      phase,
      phaseLabel,
      phaseColor,
      cycleLength: safeCycleLength,
      periodLength,
      fertileStart,
      fertileEnd,
      ovulationDay,
    };
  }, [
    cycleInfo?.averageCycleLength,
    cycleInfo?.averagePeriodLength,
    diffDays,
    isRTL,
    periodEntries,
    today,
    toDateOnly,
    getOvulationAndFertileDays,
  ]);

  const getPhaseForDate = useCallback(
    (
      date: Date
    ):
      | "period"
      | "follicular"
      | "fertile"
      | "ovulation"
      | "luteal"
      | "unknown" => {
      if (!periodEntries.length) {
        return "unknown";
      }

      const dateOnly = toDateOnly(date);
      let idx = -1;
      for (let i = 0; i < periodEntries.length; i++) {
        const start = toDateOnly(periodEntries[i].startDate);
        if (start.getTime() <= dateOnly.getTime()) {
          idx = i;
          break;
        }
      }
      if (idx === -1) {
        return "unknown";
      }

      const entry = periodEntries[idx];
      const cycleStart = toDateOnly(entry.startDate);
      const nextMoreRecentStart =
        idx > 0 ? toDateOnly(periodEntries[idx - 1].startDate) : null;
      const cycleLength =
        nextMoreRecentStart &&
        nextMoreRecentStart.getTime() > cycleStart.getTime()
          ? diffDays(nextMoreRecentStart, cycleStart)
          : (cycleInfo?.averageCycleLength ?? 28);
      const averagePeriodLength = cycleInfo?.averagePeriodLength ?? 5;
      const computedPeriodLength = entry.endDate
        ? diffDays(toDateOnly(entry.endDate), cycleStart) + 1
        : averagePeriodLength;
      const periodLength = Math.max(1, Math.min(15, computedPeriodLength));
      const dayInCycle = diffDays(dateOnly, cycleStart) + 1;

      const { ovulationDay, fertileStart, fertileEnd } =
        getOvulationAndFertileDays(cycleLength, periodLength);

      if (dayInCycle <= periodLength) {
        return "period";
      }
      if (dayInCycle === ovulationDay) {
        return "ovulation";
      }
      if (dayInCycle >= fertileStart && dayInCycle <= fertileEnd) {
        return "fertile";
      }
      if (dayInCycle < ovulationDay) {
        return "follicular";
      }
      return "luteal";
    },
    [
      cycleInfo?.averageCycleLength,
      cycleInfo?.averagePeriodLength,
      diffDays,
      periodEntries,
      toDateOnly,
      getOvulationAndFertileDays,
    ]
  );

  const moodEnergyChart = useMemo(() => {
    const cutoff = addDays(today, -60);
    const filtered = dailyEntries
      .filter(
        (entry) =>
          entry.date &&
          toDateOnly(entry.date).getTime() >= toDateOnly(cutoff).getTime() &&
          (typeof entry.mood === "number" ||
            typeof entry.energyLevel === "number" ||
            typeof entry.sleepQuality === "number")
      )
      .slice()
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (filtered.length < 4) {
      return null;
    }

    const labels = filtered.map((entry) =>
      safeFormatDate(entry.date, isRTL ? "ar-u-ca-gregory" : "en-US", {
        month: "short",
        day: "numeric",
      })
    );

    const moodData = filtered.map((entry) => (entry.mood ? entry.mood : 0));
    const energyData = filtered.map((entry) =>
      entry.energyLevel ? entry.energyLevel : 0
    );
    const sleepData = filtered.map((entry) =>
      entry.sleepQuality ? entry.sleepQuality : 0
    );

    const phaseByIndex = filtered.map((entry) => getPhaseForDate(entry.date));

    const data: TimeSeriesData = {
      labels,
      datasets: [
        {
          data: moodData,
          color: (opacity: number) => `rgba(245, 158, 11, ${opacity})`,
          strokeWidth: 2,
        },
        {
          data: energyData,
          color: (opacity: number) => `rgba(16, 185, 129, ${opacity})`,
          strokeWidth: 2,
        },
        {
          data: sleepData,
          color: (opacity: number) => `rgba(59, 130, 246, ${opacity})`,
          strokeWidth: 2,
        },
      ],
    };
    return {
      data,
      phaseByIndex,
    };
  }, [addDays, dailyEntries, getPhaseForDate, isRTL, today, toDateOnly]);

  const symptomPhaseInsights = useMemo(() => {
    if (!(recentSymptoms.length && periodEntries.length)) {
      return [];
    }

    const phases: Exclude<ReturnType<typeof getPhaseForDate>, "unknown">[] = [
      "period",
      "follicular",
      "fertile",
      "ovulation",
      "luteal",
    ];

    const phaseLabel = (phase: (typeof phases)[number]) => {
      switch (phase) {
        case "period":
          return isRTL ? "الحيض" : "Period";
        case "follicular":
          return isRTL ? "الجُريبي" : "Follicular";
        case "fertile":
          return isRTL ? "الخصوبة" : "Fertile";
        case "ovulation":
          return isRTL ? "الإباضة" : "Ovulation";
        default:
          return isRTL ? "الأصفري" : "Luteal";
      }
    };

    const cutoffDateOnly = toDateOnly(addDays(today, -120));
    const cutoffMs = cutoffDateOnly.getTime();

    const symptomsByDayKey = new Map<string, Set<string>>();
    for (const symptom of recentSymptoms) {
      if (!symptom.timestamp) {
        continue;
      }
      const ts =
        symptom.timestamp instanceof Date
          ? symptom.timestamp
          : new Date(symptom.timestamp);
      if (Number.isNaN(ts.getTime()) || ts.getTime() < cutoffMs) {
        continue;
      }
      const key = dateKey(toDateOnly(ts));
      const type = symptom.type || "symptom";
      const existing = symptomsByDayKey.get(key);
      if (existing) {
        existing.add(type);
      } else {
        symptomsByDayKey.set(key, new Set([type]));
      }
    }

    const daysByPhase: Record<(typeof phases)[number], number> = {
      period: 0,
      follicular: 0,
      fertile: 0,
      ovulation: 0,
      luteal: 0,
    };

    const symptomDaysByType: Record<
      string,
      Record<(typeof phases)[number], number>
    > = {};
    const symptomDaysTotalByType: Record<string, number> = {};

    for (
      let cursor = new Date(cutoffDateOnly);
      cursor.getTime() <= today.getTime();
      cursor = addDays(cursor, 1)
    ) {
      const day = toDateOnly(cursor);
      const phase = getPhaseForDate(day);
      if (phase === "unknown") {
        continue;
      }

      daysByPhase[phase] += 1;

      const types = symptomsByDayKey.get(dateKey(day));
      if (!types) {
        continue;
      }
      for (const type of types) {
        if (!symptomDaysByType[type]) {
          symptomDaysByType[type] = {
            period: 0,
            follicular: 0,
            fertile: 0,
            ovulation: 0,
            luteal: 0,
          };
        }
        symptomDaysByType[type][phase] += 1;
        symptomDaysTotalByType[type] = (symptomDaysTotalByType[type] || 0) + 1;
      }
    }

    const totalDaysAllPhases = phases.reduce(
      (sum, phase) => sum + (daysByPhase[phase] || 0),
      0
    );
    if (totalDaysAllPhases < 30) {
      return [];
    }

    const insights: Array<{
      symptom: string;
      phase: (typeof phases)[number];
      lift: number;
      count: number;
      phaseDays: number;
    }> = [];

    for (const [symptomType, phaseCounts] of Object.entries(
      symptomDaysByType
    )) {
      const totalSymptomDays = symptomDaysTotalByType[symptomType] || 0;
      if (totalSymptomDays < 5) {
        continue;
      }

      const overallRate = (totalSymptomDays + 1) / (totalDaysAllPhases + 2);
      for (const phase of phases) {
        const phaseDays = daysByPhase[phase] || 0;
        if (phaseDays < 8) {
          continue;
        }
        const count = phaseCounts[phase] || 0;
        if (count < 3) {
          continue;
        }

        const phaseRate = (count + 1) / (phaseDays + 2);
        const lift = overallRate > 0 ? phaseRate / overallRate : 0;
        if (lift >= 1.5) {
          insights.push({
            symptom: symptomType,
            phase,
            lift,
            count,
            phaseDays,
          });
        }
      }
    }

    insights.sort((a, b) => b.lift - a.lift);
    return insights.slice(0, 4).map((insight) => ({
      ...insight,
      phaseLabel: phaseLabel(insight.phase),
    }));
  }, [
    addDays,
    getPhaseForDate,
    isRTL,
    periodEntries.length,
    recentSymptoms,
    today,
    toDateOnly,
    dateKey,
  ]);

  return (
    <GradientScreen
      edges={[]}
      pointerEvents="box-none"
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 40 + insets.bottom },
        ]}
        refreshControl={
          <RefreshControl
            onRefresh={handleRefresh}
            refreshing={refreshing}
            tintColor={Colors.primary.main}
          />
        }
      >
        <View
          style={[
            styles.wavyHeaderWrapper,
            isRTL && styles.wavyHeaderWrapperRTL,
          ]}
        >
          <WavyBackground
            contentPosition="top"
            curve="home"
            height={200 + insets.top}
            variant="teal"
          >
            <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
              <View
                style={[
                  styles.headerRow,
                  isRTL && { flexDirection: "row-reverse" as const },
                ]}
              >
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
                <Text
                  style={[
                    styles.headerTitle,
                    { color: "#FFFFFF" },
                    isRTL && { textAlign: "right" as const },
                    isRTL && styles.headerTitleRTL,
                  ]}
                >
                  {isRTL ? "صحة المرأة" : "Women's Health"}
                </Text>
                <TouchableOpacity
                  onPress={() => setShowCalendarView(true)}
                  style={styles.backButton}
                >
                  <Calendar color="#FFFFFF" size={22} />
                </TouchableOpacity>
              </View>
            </View>
          </WavyBackground>
        </View>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={Colors.primary.main} size="large" />
            <Text style={[styles.loadingText, isRTL && styles.rtlText]}>
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
                    <Text
                      style={[styles.predictionTitle, isRTL && styles.rtlText]}
                    >
                      {isRTL ? "ابدأ التتبع" : "Start Tracking"}
                    </Text>
                    <Text
                      style={[
                        styles.predictionSubtitle,
                        isRTL && styles.rtlText,
                      ]}
                    >
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
                  <Text
                    style={[
                      styles.predictionButtonText,
                      isRTL && styles.rtlText,
                    ]}
                  >
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
                        {cycleInfo.nextPeriodWindowStart &&
                        cycleInfo.nextPeriodWindowEnd
                          ? `${formatDate(cycleInfo.nextPeriodWindowStart)} - ${formatDate(cycleInfo.nextPeriodWindowEnd)}`
                          : formatDate(cycleInfo.nextPeriodPredicted)}
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
                      {predictionConfidenceLabel ? (
                        <View style={styles.confidenceBadge}>
                          <Text style={styles.confidenceBadgeText}>
                            {predictionConfidenceLabel.label}
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

                  {todayCycleContext ? (
                    <View style={styles.todayCard}>
                      <View
                        style={[
                          styles.todayHeaderRow,
                          isRTL && { flexDirection: "row-reverse" as const },
                        ]}
                      >
                        <Text
                          style={[styles.todayTitle, isRTL && styles.rtlText]}
                        >
                          {isRTL ? "اليوم" : "Today"}
                        </Text>
                        <View
                          style={[
                            styles.phaseBadge,
                            {
                              backgroundColor: `${todayCycleContext.phaseColor}20`,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.phaseBadgeText,
                              { color: todayCycleContext.phaseColor },
                            ]}
                          >
                            {todayCycleContext.phaseLabel}
                          </Text>
                        </View>
                      </View>
                      <Text
                        style={[styles.todaySubtitle, isRTL && styles.rtlText]}
                      >
                        {isRTL
                          ? `اليوم ${todayCycleContext.dayInCycle} من ${todayCycleContext.cycleLength}`
                          : `Day ${todayCycleContext.dayInCycle} of ${todayCycleContext.cycleLength}`}
                      </Text>

                      {dailyEntryByKey.get(dateKey(today)) ? (
                        <Text
                          style={[styles.todayHint, isRTL && styles.rtlText]}
                        >
                          {isRTL
                            ? "تم تسجيل ملاحظات اليوم. اضغطي للتعديل."
                            : "Today’s log is saved. Tap to edit."}
                        </Text>
                      ) : (
                        <Text
                          style={[styles.todayHint, isRTL && styles.rtlText]}
                        >
                          {isRTL
                            ? "سجّلي الأعراض والمزاج والنوم والطاقة اليوم."
                            : "Log symptoms, mood, sleep and energy for today."}
                        </Text>
                      )}

                      <TouchableOpacity
                        onPress={() => openDailyLog(today)}
                        style={styles.todayButton}
                      >
                        <Text
                          style={[
                            styles.todayButtonText,
                            isRTL && styles.rtlText,
                          ]}
                        >
                          {isRTL ? "تسجيل اليوم" : "Log Today"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}

                  {false ? (
                    <>
                      <View style={styles.cycleCalendarCard}>
                        <View style={styles.cycleCalendarHeader}>
                          <TouchableOpacity
                            onPress={() =>
                              setCalendarMonth(
                                (prev) =>
                                  new Date(
                                    prev.getFullYear(),
                                    prev.getMonth() - 1,
                                    1,
                                    12
                                  )
                              )
                            }
                            style={styles.cycleCalendarNavButton}
                          >
                            <ChevronLeft
                              color={Colors.text.primary}
                              size={18}
                            />
                          </TouchableOpacity>
                          <Text style={styles.cycleCalendarMonthLabel}>
                            {calendarMonthLabel}
                          </Text>
                          <TouchableOpacity
                            onPress={() =>
                              setCalendarMonth(
                                (prev) =>
                                  new Date(
                                    prev.getFullYear(),
                                    prev.getMonth() + 1,
                                    1,
                                    12
                                  )
                              )
                            }
                            style={styles.cycleCalendarNavButton}
                          >
                            <ChevronRight
                              color={Colors.text.primary}
                              size={18}
                            />
                          </TouchableOpacity>
                        </View>

                        <Text
                          style={[styles.calendarHint, isRTL && styles.rtlText]}
                        >
                          {isRTL
                            ? "اضغطي على أي يوم للتسجيل"
                            : "Tap any day to log"}
                        </Text>

                        <View style={styles.weekdayRowCompact}>
                          {weekdayLabels.map(({ key, label }) => (
                            <Text key={key} style={styles.weekdayLabelCompact}>
                              {label}
                            </Text>
                          ))}
                        </View>

                        <View style={styles.monthGridCompact}>
                          {buildMonthGrid(calendarMonth).days.map(
                            ({ date, inMonth }) => {
                              const key = dateKey(date);
                              const isActualPeriod = actualPeriodDays.has(key);
                              const isPredictedPeriod =
                                predictedPeriodDays.has(key);
                              const isFertile = fertileWindowDays.has(key);
                              const isOvulation = ovulationKey === key;
                              const hasDailyLog = dailyEntryByKey.has(key);

                              return (
                                <Pressable
                                  key={key}
                                  onPress={() => openDailyLog(date)}
                                  style={[
                                    styles.dayCellCompact,
                                    !inMonth && styles.dayCellCompactMuted,
                                    isActualPeriod &&
                                      styles.dayCellCompactPeriod,
                                    !(isActualPeriod || isPredictedPeriod) &&
                                      isOvulation &&
                                      styles.dayCellCompactOvulation,
                                    !isActualPeriod &&
                                      isPredictedPeriod &&
                                      styles.dayCellCompactPredicted,
                                    !(isActualPeriod || isPredictedPeriod) &&
                                      isFertile &&
                                      styles.dayCellCompactFertile,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.dayTextCompact,
                                      !inMonth && styles.dayTextCompactMuted,
                                    ]}
                                  >
                                    {date.getDate()}
                                  </Text>
                                  <View style={styles.dayDotsRow}>
                                    {isOvulation ? (
                                      <View
                                        style={[
                                          styles.legendDot,
                                          styles.dotOvulation,
                                        ]}
                                      />
                                    ) : null}
                                    {!isOvulation && isFertile ? (
                                      <View
                                        style={[
                                          styles.legendDot,
                                          styles.dotFertile,
                                        ]}
                                      />
                                    ) : null}
                                    {isActualPeriod ? (
                                      <View
                                        style={[
                                          styles.legendDot,
                                          styles.dotPeriod,
                                        ]}
                                      />
                                    ) : null}
                                    {!isActualPeriod && isPredictedPeriod ? (
                                      <View
                                        style={[
                                          styles.legendDot,
                                          styles.dotPredicted,
                                        ]}
                                      />
                                    ) : null}
                                    {hasDailyLog ? (
                                      <View
                                        style={[
                                          styles.legendDot,
                                          styles.dotDailyLog,
                                        ]}
                                      />
                                    ) : null}
                                  </View>
                                </Pressable>
                              );
                            }
                          )}
                        </View>

                        <View style={styles.cycleLegendRow}>
                          <View style={styles.cycleLegendItem}>
                            <View
                              style={[styles.legendDot, styles.dotPeriod]}
                            />
                            <Text style={styles.cycleLegendText}>
                              {isRTL ? "الدورة" : "Period"}
                            </Text>
                          </View>
                          <View style={styles.cycleLegendItem}>
                            <View
                              style={[styles.legendDot, styles.dotPredicted]}
                            />
                            <Text style={styles.cycleLegendText}>
                              {isRTL ? "متوقعة" : "Predicted"}
                            </Text>
                          </View>
                          <View style={styles.cycleLegendItem}>
                            <View
                              style={[styles.legendDot, styles.dotFertile]}
                            />
                            <Text style={styles.cycleLegendText}>
                              {isRTL ? "خصوبة" : "Fertile"}
                            </Text>
                          </View>
                          <View style={styles.cycleLegendItem}>
                            <View
                              style={[styles.legendDot, styles.dotOvulation]}
                            />
                            <Text style={styles.cycleLegendText}>
                              {isRTL ? "إباضة" : "Ovulation"}
                            </Text>
                          </View>
                          <View style={styles.cycleLegendItem}>
                            <View
                              style={[styles.legendDot, styles.dotDailyLog]}
                            />
                            <Text style={styles.cycleLegendText}>
                              {isRTL ? "مُسجَّل" : "Logged"}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <View style={styles.reminderCard}>
                        <View
                          style={[
                            styles.reminderHeaderRow,
                            isRTL && { flexDirection: "row-reverse" as const },
                          ]}
                        >
                          <View style={styles.reminderIconContainer}>
                            <Pill color={Colors.primary.main} size={18} />
                          </View>
                          <View style={styles.reminderTitleContainer}>
                            <Text
                              style={[
                                styles.reminderTitle,
                                isRTL && styles.rtlText,
                              ]}
                            >
                              {isRTL
                                ? "تذكير منع الحمل"
                                : "Birth Control Reminder"}
                            </Text>
                            <Text
                              style={[
                                styles.reminderSubtitle,
                                isRTL && styles.rtlText,
                              ]}
                            >
                              {isRTL
                                ? `يوميًا ${String(pillReminderTime.hour).padStart(2, "0")}:${String(pillReminderTime.minute).padStart(2, "0")}`
                                : `Daily at ${String(pillReminderTime.hour).padStart(2, "0")}:${String(pillReminderTime.minute).padStart(2, "0")}`}
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={() =>
                              pillReminderId
                                ? disablePillReminder()
                                : schedulePillReminder(pillReminderTime)
                            }
                            style={[
                              styles.reminderToggle,
                              pillReminderId
                                ? styles.reminderToggleOn
                                : styles.reminderToggleOff,
                            ]}
                          >
                            <Text style={styles.reminderToggleText}>
                              {pillReminderId
                                ? isRTL
                                  ? "مفعّل"
                                  : "On"
                                : isRTL
                                  ? "تفعيل"
                                  : "Enable"}
                            </Text>
                          </TouchableOpacity>
                        </View>

                        <View
                          style={[
                            styles.reminderTimesRow,
                            isRTL && { flexDirection: "row-reverse" as const },
                          ]}
                        >
                          {[
                            { label: "08:00", hour: 8, minute: 0 },
                            { label: "12:00", hour: 12, minute: 0 },
                            { label: "20:00", hour: 20, minute: 0 },
                            { label: "22:00", hour: 22, minute: 0 },
                          ].map((time) => {
                            const isSelected =
                              pillReminderTime.hour === time.hour &&
                              pillReminderTime.minute === time.minute;
                            return (
                              <TouchableOpacity
                                key={time.label}
                                onPress={() => {
                                  setPillReminderTime({
                                    hour: time.hour,
                                    minute: time.minute,
                                  });
                                  if (pillReminderId) {
                                    schedulePillReminder({
                                      hour: time.hour,
                                      minute: time.minute,
                                    });
                                  }
                                }}
                                style={[
                                  styles.reminderTimeChip,
                                  isSelected && styles.reminderTimeChipSelected,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.reminderTimeChipText,
                                    isSelected &&
                                      styles.reminderTimeChipTextSelected,
                                  ]}
                                >
                                  {time.label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>

                      <View style={styles.cycleCalendarCard}>
                        <View style={styles.cycleCalendarHeader}>
                          <TouchableOpacity
                            onPress={() =>
                              setCalendarMonth(
                                (prev) =>
                                  new Date(
                                    prev.getFullYear(),
                                    prev.getMonth() - 1,
                                    1,
                                    12
                                  )
                              )
                            }
                            style={styles.cycleCalendarNavButton}
                          >
                            <ChevronLeft
                              color={Colors.text.primary}
                              size={18}
                            />
                          </TouchableOpacity>
                          <Text style={styles.cycleCalendarMonthLabel}>
                            {calendarMonthLabel}
                          </Text>
                          <TouchableOpacity
                            onPress={() =>
                              setCalendarMonth(
                                (prev) =>
                                  new Date(
                                    prev.getFullYear(),
                                    prev.getMonth() + 1,
                                    1,
                                    12
                                  )
                              )
                            }
                            style={styles.cycleCalendarNavButton}
                          >
                            <ChevronRight
                              color={Colors.text.primary}
                              size={18}
                            />
                          </TouchableOpacity>
                        </View>

                        <View style={styles.weekdayRowCompact}>
                          {weekdayLabels.map(({ key, label }) => (
                            <Text key={key} style={styles.weekdayLabelCompact}>
                              {label}
                            </Text>
                          ))}
                        </View>

                        <View style={styles.monthGridCompact}>
                          {buildMonthGrid(calendarMonth).days.map(
                            ({ date, inMonth }) => {
                              const key = dateKey(date);
                              const isActualPeriod = actualPeriodDays.has(key);
                              const isPredictedPeriod =
                                predictedPeriodDays.has(key);
                              const isFertile = fertileWindowDays.has(key);
                              const isOvulation = ovulationKey === key;

                              return (
                                <View
                                  key={key}
                                  style={[
                                    styles.dayCellCompact,
                                    !inMonth && styles.dayCellCompactMuted,
                                    isActualPeriod &&
                                      styles.dayCellCompactPeriod,
                                    !(isActualPeriod || isPredictedPeriod) &&
                                      isOvulation &&
                                      styles.dayCellCompactOvulation,
                                    !isActualPeriod &&
                                      isPredictedPeriod &&
                                      styles.dayCellCompactPredicted,
                                    !(isActualPeriod || isPredictedPeriod) &&
                                      isFertile &&
                                      styles.dayCellCompactFertile,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.dayTextCompact,
                                      !inMonth && styles.dayTextCompactMuted,
                                    ]}
                                  >
                                    {date.getDate()}
                                  </Text>
                                  <View style={styles.dayDotsRow}>
                                    {isOvulation ? (
                                      <View
                                        style={[
                                          styles.legendDot,
                                          styles.dotOvulation,
                                        ]}
                                      />
                                    ) : null}
                                    {!isOvulation && isFertile ? (
                                      <View
                                        style={[
                                          styles.legendDot,
                                          styles.dotFertile,
                                        ]}
                                      />
                                    ) : null}
                                    {isActualPeriod ? (
                                      <View
                                        style={[
                                          styles.legendDot,
                                          styles.dotPeriod,
                                        ]}
                                      />
                                    ) : null}
                                    {!isActualPeriod && isPredictedPeriod ? (
                                      <View
                                        style={[
                                          styles.legendDot,
                                          styles.dotPredicted,
                                        ]}
                                      />
                                    ) : null}
                                  </View>
                                </View>
                              );
                            }
                          )}
                        </View>

                        <View style={styles.cycleLegendRow}>
                          <View style={styles.cycleLegendItem}>
                            <View
                              style={[styles.legendDot, styles.dotPeriod]}
                            />
                            <Text style={styles.cycleLegendText}>
                              {isRTL ? "الدورة" : "Period"}
                            </Text>
                          </View>
                          <View style={styles.cycleLegendItem}>
                            <View
                              style={[styles.legendDot, styles.dotPredicted]}
                            />
                            <Text style={styles.cycleLegendText}>
                              {isRTL ? "متوقعة" : "Predicted"}
                            </Text>
                          </View>
                          <View style={styles.cycleLegendItem}>
                            <View
                              style={[styles.legendDot, styles.dotFertile]}
                            />
                            <Text style={styles.cycleLegendText}>
                              {isRTL ? "خصوبة" : "Fertile"}
                            </Text>
                          </View>
                          <View style={styles.cycleLegendItem}>
                            <View
                              style={[styles.legendDot, styles.dotOvulation]}
                            />
                            <Text style={styles.cycleLegendText}>
                              {isRTL ? "إباضة" : "Ovulation"}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </>
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* Monthly Calendar (period, fertile window, ovulation) */}
            <View style={styles.infoCard}>
              <View style={styles.infoCardHeader}>
                <View style={styles.infoIconContainer}>
                  <Calendar color={Colors.primary.main} size={24} />
                </View>
                <Text style={styles.infoCardTitle}>
                  {isRTL ? "التقويم الشهري" : "Monthly Calendar"}
                </Text>
              </View>

              {cycleInfo ? null : (
                <Text style={[styles.disclaimerText, isRTL && styles.rtlText]}>
                  {isRTL
                    ? "أضيفي سجلات دورة أكثر لعرض توقعات الخصوبة والإباضة."
                    : "Add more cycle entries to see fertile & ovulation predictions."}
                </Text>
              )}

              <View style={styles.calendarHeaderRow}>
                <TouchableOpacity
                  onPress={() =>
                    setCalendarMonth(
                      (prev) =>
                        new Date(prev.getFullYear(), prev.getMonth() - 1, 1, 12)
                    )
                  }
                  style={styles.calendarNavButton}
                >
                  <ChevronLeft color={Colors.text.primary} size={20} />
                </TouchableOpacity>
                <Text style={styles.calendarMonthLabel}>
                  {safeFormatDate(
                    calendarMonth,
                    isRTL ? "ar-u-ca-gregory" : "en-US",
                    { month: "long", year: "numeric" }
                  )}
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    setCalendarMonth(
                      (prev) =>
                        new Date(prev.getFullYear(), prev.getMonth() + 1, 1, 12)
                    )
                  }
                  style={styles.calendarNavButton}
                >
                  <ChevronRight color={Colors.text.primary} size={20} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.calendarHint, isRTL && styles.rtlText]}>
                {isRTL ? "اضغطي على أي يوم للتسجيل" : "Tap any day to log"}
              </Text>

              <View style={styles.weekdayRow}>
                {weekdayLabels.map(({ key, label }) => (
                  <Text key={key} style={styles.weekdayLabel}>
                    {label}
                  </Text>
                ))}
              </View>

              <View style={styles.monthGrid}>
                {buildMonthGrid(calendarMonth).days.map(({ date, inMonth }) => {
                  const key = dateKey(date);
                  const isActualPeriod = actualPeriodDays.has(key);
                  const isPredictedPeriod = predictedPeriodDays.has(key);
                  const isFertile = fertileWindowDays.has(key);
                  const isOvulation = ovulationKey === key;
                  const hasDailyLog = dailyEntryByKey.has(key);

                  return (
                    <Pressable
                      key={key}
                      onPress={() => openDailyLog(date)}
                      style={[
                        styles.dayCell,
                        !inMonth && styles.dayCellMuted,
                        isActualPeriod && styles.dayCellPeriod,
                        !isActualPeriod &&
                          isPredictedPeriod &&
                          styles.dayCellPredicted,
                        !(isActualPeriod || isPredictedPeriod) &&
                          isFertile &&
                          styles.dayCellFertile,
                        !(isActualPeriod || isPredictedPeriod) &&
                          isOvulation &&
                          styles.dayCellOvulation,
                        hasDailyLog && styles.dayCellLogged,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          !inMonth && styles.dayTextMuted,
                          (isActualPeriod ||
                            isPredictedPeriod ||
                            isFertile ||
                            isOvulation ||
                            hasDailyLog) &&
                            styles.dayTextHighlighted,
                        ]}
                      >
                        {date.getDate()}
                      </Text>
                      <View style={styles.dayDotsRow}>
                        {isOvulation ? (
                          <View
                            style={[styles.legendDot, styles.dotOvulation]}
                          />
                        ) : null}
                        {!isOvulation && isFertile ? (
                          <View style={[styles.legendDot, styles.dotFertile]} />
                        ) : null}
                        {isActualPeriod ? (
                          <View style={[styles.legendDot, styles.dotPeriod]} />
                        ) : null}
                        {!isActualPeriod && isPredictedPeriod ? (
                          <View
                            style={[styles.legendDot, styles.dotPredicted]}
                          />
                        ) : null}
                        {hasDailyLog ? (
                          <View
                            style={[styles.legendDot, styles.dotDailyLog]}
                          />
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.cycleLegendRow}>
                <View style={styles.cycleLegendItem}>
                  <View style={[styles.legendDot, styles.dotPeriod]} />
                  <Text style={styles.cycleLegendText}>
                    {isRTL ? "الدورة" : "Period"}
                  </Text>
                </View>
                <View style={styles.cycleLegendItem}>
                  <View style={[styles.legendDot, styles.dotPredicted]} />
                  <Text style={styles.cycleLegendText}>
                    {isRTL ? "متوقعة" : "Predicted"}
                  </Text>
                </View>
                <View style={styles.cycleLegendItem}>
                  <View style={[styles.legendDot, styles.dotFertile]} />
                  <Text style={styles.cycleLegendText}>
                    {isRTL ? "خصوبة" : "Fertile"}
                  </Text>
                </View>
                <View style={styles.cycleLegendItem}>
                  <View style={[styles.legendDot, styles.dotOvulation]} />
                  <Text style={styles.cycleLegendText}>
                    {isRTL ? "إباضة" : "Ovulation"}
                  </Text>
                </View>
                <View style={styles.cycleLegendItem}>
                  <View style={[styles.legendDot, styles.dotDailyLog]} />
                  <Text style={styles.cycleLegendText}>
                    {isRTL ? "مُسجَّل" : "Logged"}
                  </Text>
                </View>
              </View>
            </View>

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

            {/* Cycle Trends (with phase overlay) */}
            {moodEnergyChart ? (
              <View style={styles.section}>
                <HealthChart
                  data={moodEnergyChart.data}
                  height={220}
                  phaseByIndex={moodEnergyChart.phaseByIndex}
                  showGrid={true}
                  title={
                    isRTL ? "المزاج والطاقة والنوم" : "Mood, Energy & Sleep"
                  }
                  yAxisSuffix=""
                />
                <Text style={[styles.chartHint, isRTL && styles.rtlText]}>
                  {isRTL
                    ? "تظليل الشريط يمثل مراحل الدورة (تقديري)."
                    : "The colored strip shows estimated cycle phases."}
                </Text>
              </View>
            ) : null}

            {/* Symptom correlations (estimated) */}
            {symptomPhaseInsights.length > 0 ? (
              <View style={styles.infoCard}>
                <View style={styles.infoCardHeader}>
                  <View style={styles.infoIconContainer}>
                    <Droplet color={Colors.primary.main} size={24} />
                  </View>
                  <Text style={styles.infoCardTitle}>
                    {isRTL ? "ارتباطات الأعراض" : "Symptom Correlations"}
                  </Text>
                </View>
                {symptomPhaseInsights.map((insight) => (
                  <View
                    key={`${insight.symptom}-${insight.phase}`}
                    style={styles.insightRow}
                  >
                    <Text style={[styles.insightText, isRTL && styles.rtlText]}>
                      {isRTL
                        ? `${insight.symptom}: أكثر في ${insight.phaseLabel}`
                        : `${insight.symptom}: more common in ${insight.phaseLabel}`}
                    </Text>
                    <View style={styles.insightBadge}>
                      <Text style={styles.insightBadgeText}>
                        {insight.count}/{insight.phaseDays}
                      </Text>
                    </View>
                  </View>
                ))}
                <Text style={[styles.disclaimerText, isRTL && styles.rtlText]}>
                  {isRTL
                    ? "هذه الارتباطات تقديرية وتعتمد على سجلاتك. ليست نصيحة طبية."
                    : "These correlations are estimated from your logs and are not medical advice."}
                </Text>
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
                    {isRTL ? "لا توجد سجلات حتى الآن" : "No period entries yet"}
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

            {/*
            <View style={styles.section}>
              <View
                style={[
                  styles.dailyLogsHeaderRow,
                  isRTL && { flexDirection: "row-reverse" as const },
                ]}
              >
                <Text style={styles.sectionTitle}>
                  {isRTL ? "السجل اليومي" : "Daily Logs"}
                </Text>
                <TouchableOpacity
                  onPress={() => openDailyLog(today)}
                  style={styles.dailyLogsAddButton}
                >
                  <Plus color={Colors.primary.main} size={18} />
                  <Text style={styles.dailyLogsAddText}>
                    {isRTL ? "اليوم" : "Today"}
                  </Text>
                </TouchableOpacity>
              </View>

              {dailyEntries.length === 0 ? (
                <View style={styles.dailyEmptyContainer}>
                  <Text style={styles.emptySubtext}>
                    {isRTL
                      ? "سجّلي المزاج والنوم والطاقة والإفرازات والبقع."
                      : "Log mood, sleep, energy, discharge and spotting."}
                  </Text>
                  <TouchableOpacity
                    onPress={() => openDailyLog(today)}
                    style={styles.emptyButton}
                  >
                    <Plus color={Colors.primary.main} size={20} />
                    <Text style={styles.emptyButtonText}>
                      {isRTL ? "تسجيل اليوم" : "Log Today"}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                dailyEntries.slice(0, 14).map((entry) => (
                  <View key={entry.id} style={styles.dailyEntryCard}>
                    <View style={styles.entryHeader}>
                      <View style={styles.entryDateContainer}>
                        <View style={styles.entryIconContainer}>
                          <Calendar color={Colors.primary.main} size={20} />
                        </View>
                        <View>
                          <Text style={styles.entryDate}>
                            {formatDate(entry.date)}
                          </Text>
                          <Text style={styles.dailyMetaText}>
                            {isRTL ? "سجل يومي" : "Daily log"}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.entryActions}>
                        <TouchableOpacity
                          onPress={() => openDailyLog(entry.date)}
                          style={styles.actionButton}
                        >
                          <Edit color={Colors.neutral[600]} size={18} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeleteDailyLog(entry.date)}
                          style={styles.actionButton}
                        >
                          <Trash2 color={Colors.accent.error} size={18} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.dailyBadgesRow}>
                      {entry.flowIntensity && entry.flowIntensity !== "none" ? (
                        <View style={styles.dailyBadge}>
                          <Text style={styles.dailyBadgeText}>
                            {isRTL ? "تدفق" : "Flow"}: {entry.flowIntensity}
                          </Text>
                        </View>
                      ) : null}
                      {typeof entry.crampsSeverity === "number" &&
                      entry.crampsSeverity > 0 ? (
                        <View style={styles.dailyBadge}>
                          <Text style={styles.dailyBadgeText}>
                            {isRTL ? "تقلصات" : "Cramps"}:{" "}
                            {entry.crampsSeverity}/3
                          </Text>
                        </View>
                      ) : null}
                      {typeof entry.mood === "number" ? (
                        <View style={styles.dailyBadge}>
                          <Text style={styles.dailyBadgeText}>
                            {isRTL ? "مزاج" : "Mood"}: {entry.mood}/5
                          </Text>
                        </View>
                      ) : null}
                      {typeof entry.sleepQuality === "number" ? (
                        <View style={styles.dailyBadge}>
                          <Text style={styles.dailyBadgeText}>
                            {isRTL ? "نوم" : "Sleep"}: {entry.sleepQuality}/5
                          </Text>
                        </View>
                      ) : null}
                      {typeof entry.energyLevel === "number" ? (
                        <View style={styles.dailyBadge}>
                          <Text style={styles.dailyBadgeText}>
                            {isRTL ? "طاقة" : "Energy"}: {entry.energyLevel}/5
                          </Text>
                        </View>
                      ) : null}
                      {entry.dischargeType && entry.dischargeType !== "none" ? (
                        <View style={styles.dailyBadge}>
                          <Text style={styles.dailyBadgeText}>
                            {isRTL ? "إفرازات" : "Discharge"}:{" "}
                            {entry.dischargeType}
                          </Text>
                        </View>
                      ) : null}
                      {entry.spotting ? (
                        <View style={styles.dailyBadge}>
                          <Text style={styles.dailyBadgeText}>
                            {isRTL ? "بقع" : "Spotting"}
                          </Text>
                        </View>
                      ) : null}
                      {entry.birthControlMethod &&
                      entry.birthControlMethod !== "none" ? (
                        <View style={styles.dailyBadge}>
                          <Text style={styles.dailyBadgeText}>
                            {isRTL ? "منع الحمل" : "Birth control"}:{" "}
                            {entry.birthControlMethod}{" "}
                            {entry.birthControlTaken ? "✓" : ""}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {entry.notes ? (
                      <View style={styles.entryDetail}>
                        <Text style={styles.entryNotes}>{entry.notes}</Text>
                      </View>
                    ) : null}
                  </View>
                ))
              )}
            </View>
            */}
          </>
        )}
      </ScrollView>

      <TouchableOpacity
        accessibilityLabel={isRTL ? "إضافة سجل" : "Add entry"}
        onPress={handleAddPeriod}
        style={[styles.fabButton, { bottom: insets.bottom + 24 }]}
      >
        <Plus color={Colors.text.inverse} size={26} />
      </TouchableOpacity>

      {/* Add/Edit Modal */}
      <Modal
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
        transparent
        visible={showAddModal}
      >
        <View style={[styles.modalOverlay, styles.calendarOverlay]}>
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
                <Pressable
                  onPress={() => openDatePicker("start")}
                  style={styles.dateInputContainer}
                >
                  <Text style={styles.dateInputText}>
                    {formatDate(formData.startDate)}
                  </Text>
                  <Calendar color={Colors.neutral[500]} size={18} />
                </Pressable>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  {isRTL ? "تاريخ النهاية" : "End Date"}
                </Text>
                <Pressable
                  onPress={() => openDatePicker("end")}
                  style={styles.dateInputContainer}
                >
                  <Text style={styles.dateInputText}>
                    {formData.endDate
                      ? formatDate(formData.endDate)
                      : isRTL
                        ? "اختياري"
                        : "Optional"}
                  </Text>
                  <Calendar color={Colors.neutral[500]} size={18} />
                </Pressable>
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
                      <Text style={styles.flowEmojiLarge}>{option.emoji}</Text>
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

      <Modal
        animationType="fade"
        onRequestClose={() => setShowCalendarView(false)}
        transparent
        visible={showCalendarView}
      >
        <View style={[styles.modalOverlay, styles.calendarOverlay]}>
          <View style={styles.calendarModalContent}>
            <View style={styles.calendarModalHeader}>
              <Text style={styles.calendarModalTitle}>
                {isRTL ? "التقويم" : "Calendar"}
              </Text>
              <TouchableOpacity
                onPress={() => setShowCalendarView(false)}
                style={styles.closeButton}
              >
                <X color={Colors.neutral[600]} size={24} />
              </TouchableOpacity>
            </View>

            <View style={styles.calendarHeaderRow}>
              <TouchableOpacity
                onPress={() =>
                  setCalendarMonth(
                    (prev) =>
                      new Date(prev.getFullYear(), prev.getMonth() - 1, 1, 12)
                  )
                }
                style={styles.calendarNavButton}
              >
                <ChevronLeft color={Colors.text.primary} size={20} />
              </TouchableOpacity>
              <Text style={styles.calendarMonthLabel}>
                {safeFormatDate(
                  calendarMonth,
                  isRTL ? "ar-u-ca-gregory" : "en-US",
                  { month: "long", year: "numeric" }
                )}
              </Text>
              <TouchableOpacity
                onPress={() =>
                  setCalendarMonth(
                    (prev) =>
                      new Date(prev.getFullYear(), prev.getMonth() + 1, 1, 12)
                  )
                }
                style={styles.calendarNavButton}
              >
                <ChevronRight color={Colors.text.primary} size={20} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.calendarHint, isRTL && styles.rtlText]}>
              {isRTL
                ? "اضغطي على أي يوم لفتح السجل اليومي"
                : "Tap any day to open the daily log"}
            </Text>

            <View style={styles.weekdayRow}>
              {weekdayLabels.map(({ key, label }) => (
                <Text key={key} style={styles.weekdayLabel}>
                  {label}
                </Text>
              ))}
            </View>

            <View style={styles.monthGrid}>
              {buildMonthGrid(calendarMonth).days.map(({ date, inMonth }) => {
                const key = dateKey(date);
                const isActualPeriod = actualPeriodDays.has(key);
                const isPredictedPeriod = predictedPeriodDays.has(key);
                const isFertile = fertileWindowDays.has(key);
                const isOvulation = ovulationKey === key;
                const hasDailyLog = dailyEntryByKey.has(key);

                return (
                  <Pressable
                    key={key}
                    onPress={() => {
                      setShowCalendarView(false);
                      requestAnimationFrame(() => openDailyLog(date));
                    }}
                    style={[
                      styles.dayCell,
                      !inMonth && styles.dayCellMuted,
                      isActualPeriod && styles.dayCellPeriod,
                      !isActualPeriod &&
                        isPredictedPeriod &&
                        styles.dayCellPredicted,
                      !(isActualPeriod || isPredictedPeriod) &&
                        isFertile &&
                        styles.dayCellFertile,
                      !(isActualPeriod || isPredictedPeriod) &&
                        isOvulation &&
                        styles.dayCellOvulation,
                      hasDailyLog && styles.dayCellLogged,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        !inMonth && styles.dayTextMuted,
                        (isActualPeriod ||
                          isPredictedPeriod ||
                          isFertile ||
                          isOvulation ||
                          hasDailyLog) &&
                          styles.dayTextHighlighted,
                      ]}
                    >
                      {date.getDate()}
                    </Text>
                    <View style={styles.dayDotsRow}>
                      {isOvulation ? (
                        <View style={[styles.legendDot, styles.dotOvulation]} />
                      ) : null}
                      {!isOvulation && isFertile ? (
                        <View style={[styles.legendDot, styles.dotFertile]} />
                      ) : null}
                      {isActualPeriod ? (
                        <View style={[styles.legendDot, styles.dotPeriod]} />
                      ) : null}
                      {!isActualPeriod && isPredictedPeriod ? (
                        <View style={[styles.legendDot, styles.dotPredicted]} />
                      ) : null}
                      {hasDailyLog ? (
                        <View style={[styles.legendDot, styles.dotDailyLog]} />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.cycleLegendRow}>
              <View style={styles.cycleLegendItem}>
                <View style={[styles.legendDot, styles.dotPeriod]} />
                <Text style={styles.cycleLegendText}>
                  {isRTL ? "الدورة" : "Period"}
                </Text>
              </View>
              <View style={styles.cycleLegendItem}>
                <View style={[styles.legendDot, styles.dotPredicted]} />
                <Text style={styles.cycleLegendText}>
                  {isRTL ? "متوقعة" : "Predicted"}
                </Text>
              </View>
              <View style={styles.cycleLegendItem}>
                <View style={[styles.legendDot, styles.dotFertile]} />
                <Text style={styles.cycleLegendText}>
                  {isRTL ? "خصوبة" : "Fertile"}
                </Text>
              </View>
              <View style={styles.cycleLegendItem}>
                <View style={[styles.legendDot, styles.dotOvulation]} />
                <Text style={styles.cycleLegendText}>
                  {isRTL ? "إباضة" : "Ovulation"}
                </Text>
              </View>
              <View style={styles.cycleLegendItem}>
                <View style={[styles.legendDot, styles.dotDailyLog]} />
                <Text style={styles.cycleLegendText}>
                  {isRTL ? "مُسجَّل" : "Logged"}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Daily Log Modal */}
      <Modal
        animationType="slide"
        onRequestClose={() => setShowDailyModal(false)}
        transparent
        visible={showDailyModal}
      >
        <View style={[styles.modalOverlay, styles.calendarOverlay]}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isRTL ? "سجل يومي" : "Daily Log"} •{" "}
                {formatDate(editingDailyDate)}
              </Text>
              <TouchableOpacity
                onPress={() => setShowDailyModal(false)}
                style={styles.closeButton}
              >
                <X color={Colors.neutral[600]} size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  {isRTL ? "التدفق" : "Flow"}
                </Text>
                <View style={styles.dailyOptionsGrid}>
                  {DAILY_FLOW_VALUES.map((value) => (
                    <TouchableOpacity
                      key={value}
                      onPress={() =>
                        setDailyFormData((prev) => ({
                          ...prev,
                          flowIntensity: value,
                        }))
                      }
                      style={[
                        styles.dailyOptionChip,
                        dailyFormData.flowIntensity === value &&
                          styles.dailyOptionChipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dailyOptionText,
                          dailyFormData.flowIntensity === value &&
                            styles.dailyOptionTextSelected,
                          isRTL && styles.rtlText,
                        ]}
                      >
                        {value === "none"
                          ? isRTL
                            ? "لا يوجد"
                            : "None"
                          : value === "light"
                            ? isRTL
                              ? "خفيف"
                              : "Light"
                            : value === "medium"
                              ? isRTL
                                ? "متوسط"
                                : "Medium"
                              : isRTL
                                ? "غزير"
                                : "Heavy"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  {isRTL ? "شدة التقلصات" : "Cramps Severity"}
                </Text>
                <View style={styles.ratingRow}>
                  {[0, 1, 2, 3].map((v) => (
                    <TouchableOpacity
                      key={String(v)}
                      onPress={() =>
                        setDailyFormData((prev) => ({
                          ...prev,
                          crampsSeverity: v as 0 | 1 | 2 | 3,
                        }))
                      }
                      style={[
                        styles.ratingChip,
                        dailyFormData.crampsSeverity === v &&
                          styles.ratingChipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.ratingChipText,
                          dailyFormData.crampsSeverity === v &&
                            styles.ratingChipTextSelected,
                        ]}
                      >
                        {v}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  {isRTL ? "المزاج" : "Mood"}
                </Text>
                <View style={styles.ratingRow}>
                  {[1, 2, 3, 4, 5].map((v) => (
                    <TouchableOpacity
                      key={`mood-${v}`}
                      onPress={() =>
                        setDailyFormData((prev) => ({
                          ...prev,
                          mood: v as 1 | 2 | 3 | 4 | 5,
                        }))
                      }
                      style={[
                        styles.ratingChip,
                        dailyFormData.mood === v && styles.ratingChipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.ratingChipText,
                          dailyFormData.mood === v &&
                            styles.ratingChipTextSelected,
                        ]}
                      >
                        {v}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    onPress={() =>
                      setDailyFormData((prev) => ({ ...prev, mood: null }))
                    }
                    style={styles.ratingClearChip}
                  >
                    <Text style={styles.ratingClearText}>
                      {isRTL ? "مسح" : "Clear"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  {isRTL ? "جودة النوم" : "Sleep Quality"}
                </Text>
                <View style={styles.ratingRow}>
                  {[1, 2, 3, 4, 5].map((v) => (
                    <TouchableOpacity
                      key={`sleep-${v}`}
                      onPress={() =>
                        setDailyFormData((prev) => ({
                          ...prev,
                          sleepQuality: v as 1 | 2 | 3 | 4 | 5,
                        }))
                      }
                      style={[
                        styles.ratingChip,
                        dailyFormData.sleepQuality === v &&
                          styles.ratingChipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.ratingChipText,
                          dailyFormData.sleepQuality === v &&
                            styles.ratingChipTextSelected,
                        ]}
                      >
                        {v}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    onPress={() =>
                      setDailyFormData((prev) => ({
                        ...prev,
                        sleepQuality: null,
                      }))
                    }
                    style={styles.ratingClearChip}
                  >
                    <Text style={styles.ratingClearText}>
                      {isRTL ? "مسح" : "Clear"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  {isRTL ? "مستوى الطاقة" : "Energy"}
                </Text>
                <View style={styles.ratingRow}>
                  {[1, 2, 3, 4, 5].map((v) => (
                    <TouchableOpacity
                      key={`energy-${v}`}
                      onPress={() =>
                        setDailyFormData((prev) => ({
                          ...prev,
                          energyLevel: v as 1 | 2 | 3 | 4 | 5,
                        }))
                      }
                      style={[
                        styles.ratingChip,
                        dailyFormData.energyLevel === v &&
                          styles.ratingChipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.ratingChipText,
                          dailyFormData.energyLevel === v &&
                            styles.ratingChipTextSelected,
                        ]}
                      >
                        {v}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    onPress={() =>
                      setDailyFormData((prev) => ({
                        ...prev,
                        energyLevel: null,
                      }))
                    }
                    style={styles.ratingClearChip}
                  >
                    <Text style={styles.ratingClearText}>
                      {isRTL ? "مسح" : "Clear"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  {isRTL ? "الإفرازات" : "Discharge"}
                </Text>
                <View style={styles.dailyOptionsGrid}>
                  {DISCHARGE_VALUES.map((value) => (
                    <TouchableOpacity
                      key={`discharge-${value}`}
                      onPress={() =>
                        setDailyFormData((prev) => ({
                          ...prev,
                          dischargeType: value,
                        }))
                      }
                      style={[
                        styles.dailyOptionChip,
                        dailyFormData.dischargeType === value &&
                          styles.dailyOptionChipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dailyOptionText,
                          dailyFormData.dischargeType === value &&
                            styles.dailyOptionTextSelected,
                          isRTL && styles.rtlText,
                        ]}
                      >
                        {value === "none"
                          ? isRTL
                            ? "لا يوجد"
                            : "None"
                          : value === "dry"
                            ? isRTL
                              ? "جاف"
                              : "Dry"
                            : value === "sticky"
                              ? isRTL
                                ? "لزج"
                                : "Sticky"
                              : value === "creamy"
                                ? isRTL
                                  ? "كريمي"
                                  : "Creamy"
                                : value === "eggWhite"
                                  ? isRTL
                                    ? "شفاف/مطاطي"
                                    : "Egg white"
                                  : value === "watery"
                                    ? isRTL
                                      ? "مائي"
                                      : "Watery"
                                    : isRTL
                                      ? "أخرى"
                                      : "Other"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  {isRTL ? "بقع/نزيف خفيف" : "Spotting"}
                </Text>
                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    onPress={() =>
                      setDailyFormData((prev) => ({
                        ...prev,
                        spotting: !prev.spotting,
                      }))
                    }
                    style={[
                      styles.toggleChip,
                      dailyFormData.spotting && styles.toggleChipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.toggleChipText,
                        dailyFormData.spotting && styles.toggleChipTextSelected,
                      ]}
                    >
                      {dailyFormData.spotting
                        ? isRTL
                          ? "نعم"
                          : "Yes"
                        : isRTL
                          ? "لا"
                          : "No"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  {isRTL ? "منع الحمل" : "Birth Control"}
                </Text>
                <View style={styles.dailyOptionsGrid}>
                  {BIRTH_CONTROL_METHOD_VALUES.map((value) => (
                    <TouchableOpacity
                      key={`bc-${value}`}
                      onPress={() =>
                        setDailyFormData((prev) => ({
                          ...prev,
                          birthControlMethod: value,
                        }))
                      }
                      style={[
                        styles.dailyOptionChip,
                        dailyFormData.birthControlMethod === value &&
                          styles.dailyOptionChipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dailyOptionText,
                          dailyFormData.birthControlMethod === value &&
                            styles.dailyOptionTextSelected,
                          isRTL && styles.rtlText,
                        ]}
                      >
                        {value === "none"
                          ? isRTL
                            ? "لا يوجد"
                            : "None"
                          : value === "pill"
                            ? isRTL
                              ? "حبوب"
                              : "Pill"
                            : value === "patch"
                              ? isRTL
                                ? "لاصقة"
                                : "Patch"
                              : value === "ring"
                                ? isRTL
                                  ? "حلقة"
                                  : "Ring"
                                : value === "iud"
                                  ? isRTL
                                    ? "لولب"
                                    : "IUD"
                                  : value === "implant"
                                    ? isRTL
                                      ? "غرسة"
                                      : "Implant"
                                    : value === "injection"
                                      ? isRTL
                                        ? "حقنة"
                                        : "Injection"
                                      : isRTL
                                        ? "أخرى"
                                        : "Other"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {dailyFormData.birthControlMethod !== "none" ? (
                  <View style={[styles.toggleRow, { marginTop: 10 }]}>
                    <TouchableOpacity
                      onPress={() =>
                        setDailyFormData((prev) => ({
                          ...prev,
                          birthControlTaken: !prev.birthControlTaken,
                        }))
                      }
                      style={[
                        styles.toggleChip,
                        dailyFormData.birthControlTaken &&
                          styles.toggleChipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.toggleChipText,
                          dailyFormData.birthControlTaken &&
                            styles.toggleChipTextSelected,
                        ]}
                      >
                        {dailyFormData.birthControlTaken
                          ? isRTL
                            ? "تم التناول"
                            : "Taken"
                          : isRTL
                            ? "لم يتم"
                            : "Not taken"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>

              {dailyFormData.birthControlMethod !== "none" ? (
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>
                    {isRTL ? "آثار جانبية" : "Side effects"}
                  </Text>
                  <TextInput
                    onChangeText={(text) =>
                      setDailyFormData((prev) => ({
                        ...prev,
                        sideEffectsText: text,
                      }))
                    }
                    placeholder={
                      isRTL ? "مثال: غثيان، صداع" : "e.g., nausea, headache"
                    }
                    placeholderTextColor={Colors.neutral[400]}
                    style={styles.formInput}
                    value={dailyFormData.sideEffectsText}
                  />
                </View>
              ) : null}

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  {isRTL ? "ملاحظات" : "Notes"}
                </Text>
                <TextInput
                  multiline
                  numberOfLines={4}
                  onChangeText={(text) =>
                    setDailyFormData((prev) => ({ ...prev, notes: text }))
                  }
                  placeholder={isRTL ? "أضف ملاحظات..." : "Add notes..."}
                  placeholderTextColor={Colors.neutral[400]}
                  style={[styles.formInput, styles.textArea]}
                  value={dailyFormData.notes}
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              {dailyEntryByKey.get(dateKey(editingDailyDate)) ? (
                <TouchableOpacity
                  onPress={() => {
                    setShowDailyModal(false);
                    handleDeleteDailyLog(editingDailyDate);
                  }}
                  style={styles.deleteButton}
                >
                  <Text style={styles.deleteButtonText}>
                    {isRTL ? "حذف" : "Delete"}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={{ flex: 1 }} />
              )}
              <TouchableOpacity
                onPress={() => setShowDailyModal(false)}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelButtonText}>
                  {isRTL ? "إلغاء" : "Cancel"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveDailyLog}
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

      <Modal
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
        transparent
        visible={showDatePicker}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.calendarModalContent}>
            <View style={styles.calendarModalHeader}>
              <Text style={styles.calendarModalTitle}>
                {activeDateField === "start"
                  ? isRTL
                    ? "تاريخ البداية"
                    : "Start date"
                  : isRTL
                    ? "تاريخ النهاية"
                    : "End date"}
              </Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker(false)}
                style={styles.closeButton}
              >
                <X color={Colors.neutral[600]} size={24} />
              </TouchableOpacity>
            </View>

            <View style={styles.calendarHeaderRow}>
              <TouchableOpacity
                onPress={() =>
                  setDatePickerMonth(
                    (prev) =>
                      new Date(prev.getFullYear(), prev.getMonth() - 1, 1, 12)
                  )
                }
                style={styles.calendarNavButton}
              >
                <ChevronLeft color={Colors.text.primary} size={20} />
              </TouchableOpacity>
              <Text style={styles.calendarMonthLabel}>
                {safeFormatDate(
                  datePickerMonth,
                  isRTL ? "ar-u-ca-gregory" : "en-US",
                  { month: "long", year: "numeric" }
                )}
              </Text>
              <TouchableOpacity
                onPress={() =>
                  setDatePickerMonth(
                    (prev) =>
                      new Date(prev.getFullYear(), prev.getMonth() + 1, 1, 12)
                  )
                }
                style={styles.calendarNavButton}
              >
                <ChevronRight color={Colors.text.primary} size={20} />
              </TouchableOpacity>
            </View>

            <View style={styles.weekdayRow}>
              {weekdayLabels.map(({ key, label }) => (
                <Text key={key} style={styles.weekdayLabel}>
                  {label}
                </Text>
              ))}
            </View>

            <View style={styles.monthGrid}>
              {buildMonthGrid(datePickerMonth).days.map(({ date, inMonth }) => {
                const key = dateKey(date);
                const selectedKey =
                  activeDateField === "start"
                    ? dateKey(formData.startDate)
                    : formData.endDate
                      ? dateKey(formData.endDate)
                      : null;
                const isSelected = selectedKey === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setDateFieldValue(date)}
                    style={[
                      styles.dayCell,
                      !inMonth && styles.dayCellMuted,
                      isSelected && styles.dayCellSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        !inMonth && styles.dayTextMuted,
                        isSelected && styles.dayTextSelected,
                      ]}
                    >
                      {date.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.calendarModalFooter}>
              {activeDateField === "end" ? (
                <TouchableOpacity
                  onPress={clearEndDate}
                  style={styles.calendarSecondaryButton}
                >
                  <Text style={styles.calendarSecondaryButtonText}>
                    {isRTL ? "إزالة" : "Clear"}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View />
              )}
              <TouchableOpacity
                onPress={() => setShowDatePicker(false)}
                style={styles.calendarPrimaryButton}
              >
                <Text style={styles.calendarPrimaryButtonText}>
                  {isRTL ? "تم" : "Done"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </GradientScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  wavyHeaderWrapper: {
    marginHorizontal: -20,
    marginTop: 0,
    marginBottom: 12,
  },
  wavyHeaderWrapperRTL: {
    marginBottom: 0,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Inter-Bold",
    color: "#FFFFFF",
    flex: 1,
  },
  headerTitleRTL: {
    fontFamily: "NotoSansArabic-Regular",
  },
  rtlText: {
    fontFamily: "NotoSansArabic-Regular",
  },
  fabButton: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.secondary.main,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    marginTop: -40,
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
  cycleCalendarCard: {
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderRadius: 16,
    padding: 14,
  },
  cycleCalendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  cycleCalendarNavButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.neutral[50],
    alignItems: "center",
    justifyContent: "center",
  },
  cycleCalendarMonthLabel: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    color: Colors.text.primary,
  },
  calendarHint: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: Colors.text.secondary,
    marginBottom: 10,
  },
  weekdayRowCompact: {
    flexDirection: "row",
    marginBottom: 6,
  },
  weekdayLabelCompact: {
    width: "14.2857%",
    textAlign: "center",
    fontSize: 11,
    fontFamily: "Inter-SemiBold",
    color: Colors.text.secondary,
  },
  monthGridCompact: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCellCompact: {
    width: "14.2857%",
    aspectRatio: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  dayCellCompactMuted: {
    opacity: 0.35,
  },
  dayCellCompactPeriod: {
    backgroundColor: "rgba(239, 68, 68, 0.14)",
  },
  dayCellCompactPredicted: {
    backgroundColor: "rgba(236, 72, 153, 0.12)",
  },
  dayCellCompactFertile: {
    backgroundColor: "rgba(234, 179, 8, 0.16)",
  },
  dayCellCompactOvulation: {
    backgroundColor: "rgba(15, 118, 110, 0.14)",
  },
  dayTextCompact: {
    fontSize: 12,
    fontFamily: "Inter-SemiBold",
    color: Colors.text.primary,
  },
  dayTextCompactMuted: {
    color: Colors.text.secondary,
  },
  dayDotsRow: {
    flexDirection: "row",
    gap: 3,
    marginTop: 4,
    minHeight: 6,
    alignItems: "center",
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotPeriod: {
    backgroundColor: "#EF4444",
  },
  dotPredicted: {
    backgroundColor: "#EC4899",
  },
  dotFertile: {
    backgroundColor: "#EAB308",
  },
  dotOvulation: {
    backgroundColor: Colors.primary.main,
  },
  dotDailyLog: {
    backgroundColor: "#14B8A6",
  },
  cycleLegendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10,
  },
  cycleLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cycleLegendText: {
    fontSize: 11,
    fontFamily: "Inter-Medium",
    color: Colors.text.secondary,
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
  calendarOverlay: {
    justifyContent: "center",
    paddingVertical: 24,
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
  calendarModalContent: {
    backgroundColor: Colors.background.secondary,
    borderRadius: 20,
    marginHorizontal: 16,
    padding: 16,
    maxHeight: "85%",
  },
  calendarModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
    marginBottom: 12,
  },
  calendarModalTitle: {
    fontSize: 16,
    fontFamily: "Inter-Bold",
    color: Colors.text.primary,
  },
  calendarHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  calendarNavButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.neutral[50],
    alignItems: "center",
    justifyContent: "center",
  },
  calendarMonthLabel: {
    fontSize: 15,
    fontFamily: "Inter-SemiBold",
    color: Colors.text.primary,
  },
  weekdayRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  weekdayLabel: {
    width: "14.2857%",
    textAlign: "center",
    fontSize: 12,
    fontFamily: "Inter-SemiBold",
    color: Colors.text.secondary,
  },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: "14.2857%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    marginBottom: 6,
  },
  dayCellMuted: {
    opacity: 0.35,
  },
  dayCellSelected: {
    backgroundColor: Colors.primary[50],
    borderWidth: 1,
    borderColor: Colors.primary.main,
  },
  dayCellPeriod: {
    backgroundColor: "rgba(239, 68, 68, 0.14)",
  },
  dayCellPredicted: {
    backgroundColor: "rgba(236, 72, 153, 0.14)",
  },
  dayCellFertile: {
    backgroundColor: "rgba(234, 179, 8, 0.14)",
  },
  dayCellOvulation: {
    backgroundColor: "rgba(20, 184, 166, 0.12)",
  },
  dayCellLogged: {
    borderWidth: 1,
    borderColor: "rgba(20, 184, 166, 0.45)",
  },
  dayText: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    color: Colors.text.primary,
  },
  dayTextMuted: {
    color: Colors.text.secondary,
  },
  dayTextSelected: {
    color: Colors.primary.main,
  },
  dayTextHighlighted: {
    color: Colors.text.primary,
  },
  calendarModalFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    gap: 12,
  },
  calendarPrimaryButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.primary.main,
    alignItems: "center",
  },
  calendarPrimaryButtonText: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    color: Colors.text.inverse,
  },
  calendarSecondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: Colors.neutral[100],
  },
  calendarSecondaryButtonText: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    color: Colors.text.primary,
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
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
  dailyOptionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  dailyOptionChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border.light,
    backgroundColor: Colors.background.secondary,
  },
  dailyOptionChipSelected: {
    borderColor: Colors.primary.main,
    backgroundColor: Colors.primary[50],
  },
  dailyOptionText: {
    fontSize: 13,
    fontFamily: "Inter-Medium",
    color: Colors.text.secondary,
  },
  dailyOptionTextSelected: {
    color: Colors.primary.main,
    fontFamily: "Inter-SemiBold",
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
  confidenceBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  confidenceBadgeText: {
    fontSize: 12,
    fontFamily: "Inter-SemiBold",
    color: Colors.text.inverse,
  },
  todayCard: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  todayHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  todayTitle: {
    fontSize: 16,
    fontFamily: "Inter-Bold",
    color: Colors.text.inverse,
  },
  todaySubtitle: {
    fontSize: 13,
    fontFamily: "Inter-Medium",
    color: "rgba(255, 255, 255, 0.9)",
  },
  todayHint: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: "rgba(255, 255, 255, 0.8)",
  },
  todayButton: {
    marginTop: 6,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: Colors.text.inverse,
  },
  todayButtonText: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    color: Colors.primary.main,
  },
  phaseBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  phaseBadgeText: {
    fontSize: 12,
    fontFamily: "Inter-SemiBold",
  },
  reminderCard: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  reminderHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  reminderIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  reminderTitleContainer: {
    flex: 1,
  },
  reminderTitle: {
    fontSize: 14,
    fontFamily: "Inter-Bold",
    color: Colors.text.inverse,
  },
  reminderSubtitle: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: "rgba(255, 255, 255, 0.85)",
    marginTop: 2,
  },
  reminderToggle: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  reminderToggleOn: {
    backgroundColor: "rgba(16, 185, 129, 0.25)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.6)",
  },
  reminderToggleOff: {
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
  },
  reminderToggleText: {
    fontSize: 12,
    fontFamily: "Inter-SemiBold",
    color: Colors.text.inverse,
  },
  reminderTimesRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  reminderTimeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  reminderTimeChipSelected: {
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    borderColor: "rgba(255, 255, 255, 0.35)",
  },
  reminderTimeChipText: {
    fontSize: 12,
    fontFamily: "Inter-SemiBold",
    color: Colors.text.inverse,
  },
  reminderTimeChipTextSelected: {
    color: Colors.text.inverse,
  },
  chartHint: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: Colors.text.secondary,
    marginTop: -6,
    paddingHorizontal: 16,
  },
  insightRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 8,
  },
  insightText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter-Medium",
    color: Colors.text.primary,
  },
  insightBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.primary[50],
    borderWidth: 1,
    borderColor: Colors.primary[100],
  },
  insightBadgeText: {
    fontSize: 12,
    fontFamily: "Inter-SemiBold",
    color: Colors.primary.main,
  },
  disclaimerText: {
    marginTop: 6,
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: Colors.text.secondary,
  },
  dailyLogsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
  },
  dailyLogsAddButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.primary[50],
    borderWidth: 1,
    borderColor: Colors.primary[100],
  },
  dailyLogsAddText: {
    fontSize: 12,
    fontFamily: "Inter-SemiBold",
    color: Colors.primary.main,
  },
  dailyEmptyContainer: {
    paddingVertical: 12,
  },
  dailyEntryCard: {
    backgroundColor: Colors.background.secondary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  dailyMetaText: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: Colors.text.secondary,
    marginTop: 2,
  },
  dailyBadgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  dailyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.neutral[50],
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  dailyBadgeText: {
    fontSize: 12,
    fontFamily: "Inter-Medium",
    color: Colors.text.secondary,
  },
  ratingRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  ratingChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: Colors.background.secondary,
    borderWidth: 1,
    borderColor: Colors.border.light,
    minWidth: 44,
    alignItems: "center",
  },
  ratingChipSelected: {
    backgroundColor: Colors.primary[50],
    borderColor: Colors.primary.main,
  },
  ratingChipText: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    color: Colors.text.secondary,
  },
  ratingChipTextSelected: {
    color: Colors.primary.main,
  },
  ratingClearChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: Colors.neutral[50],
    borderWidth: 1,
    borderColor: Colors.border.light,
    alignItems: "center",
  },
  ratingClearText: {
    fontSize: 12,
    fontFamily: "Inter-SemiBold",
    color: Colors.text.secondary,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  toggleChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: Colors.background.secondary,
    borderWidth: 1,
    borderColor: Colors.border.light,
    alignItems: "center",
  },
  toggleChipSelected: {
    backgroundColor: Colors.primary[50],
    borderColor: Colors.primary.main,
  },
  toggleChipText: {
    fontSize: 13,
    fontFamily: "Inter-SemiBold",
    color: Colors.text.secondary,
  },
  toggleChipTextSelected: {
    color: Colors.primary.main,
  },
  deleteButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.35)",
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    alignItems: "center",
  },
  deleteButtonText: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    color: Colors.accent.error,
  },
});
