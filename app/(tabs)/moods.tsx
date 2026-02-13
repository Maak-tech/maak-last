/* biome-ignore-all lint/style/noNestedTernary: preserving existing UI conditional copy paths in this batch. */
/* biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: large legacy screen to be split in future refactor batches. */
import { router, useFocusEffect } from "expo-router";
import {
  ArrowLeft,
  Brain,
  ChevronRight,
  Edit,
  Plus,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
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
import { PieChart } from "react-native-chart-kit";
import { SafeAreaView } from "react-native-safe-area-context";
import FamilyDataFilter, {
  type FilterOption,
} from "@/app/components/FamilyDataFilter";
import HealthChart from "@/app/components/HealthChart";
import GradientScreen from "@/components/figma/GradientScreen";
import WavyBackground from "@/components/figma/WavyBackground";
import { useAuth } from "@/contexts/AuthContext";
import { moodService } from "@/lib/services/moodService";
import { userService } from "@/lib/services/userService";
import { logger } from "@/lib/utils/logger";
import type { Mood, MoodType, User as UserType } from "@/types";

const MOOD_OPTIONS = [
  // Positive emotions
  { value: "veryHappy", emoji: "😄", label: "veryHappy", category: "positive" },
  { value: "happy", emoji: "😊", label: "happy", category: "positive" },
  { value: "excited", emoji: "🤩", label: "excited", category: "positive" },
  { value: "content", emoji: "😌", label: "content", category: "positive" },
  { value: "grateful", emoji: "🙏", label: "grateful", category: "positive" },
  { value: "hopeful", emoji: "✨", label: "hopeful", category: "positive" },
  { value: "proud", emoji: "😎", label: "proud", category: "positive" },
  { value: "calm", emoji: "🧘", label: "calm", category: "positive" },
  { value: "peaceful", emoji: "☮️", label: "peaceful", category: "positive" },
  // Negative emotions
  { value: "sad", emoji: "😔", label: "sad", category: "negative" },
  { value: "verySad", emoji: "😢", label: "verySad", category: "negative" },
  { value: "anxious", emoji: "😰", label: "anxious", category: "negative" },
  { value: "angry", emoji: "😠", label: "angry", category: "negative" },
  {
    value: "frustrated",
    emoji: "😤",
    label: "frustrated",
    category: "negative",
  },
  {
    value: "overwhelmed",
    emoji: "😵",
    label: "overwhelmed",
    category: "negative",
  },
  { value: "hopeless", emoji: "😞", label: "hopeless", category: "negative" },
  { value: "guilty", emoji: "😟", label: "guilty", category: "negative" },
  { value: "ashamed", emoji: "😳", label: "ashamed", category: "negative" },
  { value: "lonely", emoji: "😕", label: "lonely", category: "negative" },
  { value: "irritable", emoji: "😒", label: "irritable", category: "negative" },
  { value: "restless", emoji: "😣", label: "restless", category: "negative" },
  // Neutral/Other mental states
  { value: "neutral", emoji: "😐", label: "neutral", category: "neutral" },
  { value: "confused", emoji: "😕", label: "confused", category: "neutral" },
  { value: "numb", emoji: "😑", label: "numb", category: "neutral" },
  { value: "detached", emoji: "😶", label: "detached", category: "neutral" },
  { value: "empty", emoji: "🫥", label: "empty", category: "neutral" },
  { value: "apathetic", emoji: "😐", label: "apathetic", category: "neutral" },
  { value: "tired", emoji: "😴", label: "tired", category: "neutral" },
  { value: "stressed", emoji: "😫", label: "stressed", category: "negative" },
];

export default function MoodsScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const emptyStats = {
    totalMoods: 0,
    avgIntensity: 0,
    moodDistribution: [] as { mood: string; count: number }[],
  };
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedMood, setSelectedMood] = useState<MoodType | "">("");
  const [intensity, setIntensity] = useState(1);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [moods, setMoods] = useState<Mood[]>([]);
  const [stats, setStats] = useState(emptyStats);
  const [editingMood, setEditingMood] = useState<Mood | null>(null);
  const [showActionsMenu, setShowActionsMenu] = useState<string | null>(null);
  const [familyMembers, setFamilyMembers] = useState<UserType[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<FilterOption>({
    id: "personal",
    type: "personal",
    label: "",
  });
  const [selectedTargetUser, setSelectedTargetUser] = useState<string>("");

  const isRTL = i18n.language === "ar";
  const isAdmin = user?.role === "admin";
  const hasFamily = Boolean(user?.familyId);
  const topMoodDistribution = [...stats.moodDistribution]
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);
  const distributionTotal =
    topMoodDistribution.reduce((sum, item) => sum + item.count, 0) || 1;
  const recentMoods = moods.slice(0, 6);
  const totalEntries = stats.totalMoods || moods.length;

  const moodTrendSeries = useMemo(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 6);

    const dailyData = new Map<string, number[]>();
    moods.forEach((mood) => {
      const moodDate =
        mood.timestamp instanceof Date
          ? mood.timestamp
          : new Date(mood.timestamp);
      if (moodDate < startDate || moodDate > endDate) {
        return;
      }
      const key = moodDate.toDateString();
      if (!dailyData.has(key)) {
        dailyData.set(key, []);
      }
      dailyData.get(key)?.push(mood.intensity);
    });

    const labels: string[] = [];
    const data: number[] = [];
    for (let i = 0; i < 7; i += 1) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const key = date.toDateString();
      const values = dailyData.get(key) || [];
      const avg =
        values.length > 0
          ? values.reduce((sum, value) => sum + value, 0) / values.length
          : 0;
      labels.push(
        date.toLocaleDateString(i18n.language || "en", { weekday: "short" })
      );
      data.push(avg);
    }

    return {
      labels,
      datasets: [
        {
          data,
          color: (opacity: number) => `rgba(139, 92, 246, ${opacity})`,
          strokeWidth: 3,
        },
      ],
    };
  }, [moods, i18n.language]);

  const improvementPercent = useMemo(() => {
    const now = new Date();
    const startCurrent = new Date();
    startCurrent.setDate(now.getDate() - 7);
    const startPrevious = new Date();
    startPrevious.setDate(now.getDate() - 14);

    const current = moods.filter((mood) => {
      const date =
        mood.timestamp instanceof Date
          ? mood.timestamp
          : new Date(mood.timestamp);
      return date >= startCurrent && date <= now;
    });
    const previous = moods.filter((mood) => {
      const date =
        mood.timestamp instanceof Date
          ? mood.timestamp
          : new Date(mood.timestamp);
      return date >= startPrevious && date < startCurrent;
    });

    const avg = (items: Mood[]) =>
      items.length === 0
        ? 0
        : items.reduce((sum, item) => sum + item.intensity, 0) / items.length;

    const prevAvg = avg(previous);
    if (prevAvg === 0) {
      return 0;
    }
    const currentAvg = avg(current);
    const delta = ((currentAvg - prevAvg) / prevAvg) * 100;
    return Math.max(0, Math.round(delta));
  }, [moods]);

  const moodDistributionPie = useMemo(() => {
    if (topMoodDistribution.length === 0) {
      return [];
    }
    return topMoodDistribution.map((item) => ({
      name: t(item.mood, formatMoodLabel(item.mood)),
      population: item.count,
      color: getMoodColor(item.mood),
      legendFontColor: "#6C7280",
      legendFontSize: 12,
    }));
  }, [topMoodDistribution, t]);

  const quickMoodFigmaOptions = [
    { value: "veryHappy", label: "Great", emoji: "😊", color: "#10B981" },
    { value: "happy", label: "Good", emoji: "🙂", color: "#3B82F6" },
    { value: "neutral", label: "Neutral", emoji: "😐", color: "#FBBF24" },
    { value: "sad", label: "Low", emoji: "🙁", color: "#F97316" },
    { value: "verySad", label: "Bad", emoji: "😢", color: "#EF4444" },
  ] as const;

  const loadMoods = useCallback(
    async (isRefresh = false) => {
      if (!user) {
        return;
      }

      const startTime = Date.now();
      let dataLoaded = false;
      let loadedMoodCount = 0;

      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        logger.debug(
          "Loading moods",
          {
            userId: user.id,
            filterType: selectedFilter.type,
            isAdmin,
            hasFamily: Boolean(user.familyId),
          },
          "MoodsScreen"
        );

        const shouldLoadFamilyMembers = Boolean(user.familyId) && isAdmin;
        if (shouldLoadFamilyMembers && user.familyId) {
          userService
            .getFamilyMembers(user.familyId)
            .then((members: UserType[]) => {
              setFamilyMembers(members);
            })
            .catch(() => {
              // Non-blocking: family list is only needed for filters / labels.
            });
        } else {
          setFamilyMembers([]);
        }

        // Load data based on selected filter
        // Load moods first; stats can load in the background to keep UI responsive.
        let moodsPromise: Promise<Mood[]>;
        let statsPromise: Promise<{
          totalMoods: number;
          avgIntensity: number;
          moodDistribution: { mood: string; count: number }[];
        }>;

        if (selectedFilter.type === "family" && user.familyId && isAdmin) {
          moodsPromise = moodService.getFamilyMoods(user.id, user.familyId, 50);
          statsPromise = moodService.getFamilyMoodStats(
            user.id,
            user.familyId,
            7
          );
        } else if (
          selectedFilter.type === "member" &&
          selectedFilter.memberId &&
          isAdmin
        ) {
          moodsPromise = moodService.getMemberMoods(
            selectedFilter.memberId,
            50
          );
          statsPromise = moodService.getMemberMoodStats(
            selectedFilter.memberId,
            7
          );
        } else {
          moodsPromise = moodService.getUserMoods(user.id, 50);
          statsPromise = moodService.getMoodStats(user.id, 7);
        }

        try {
          const moodsResult = await moodsPromise;
          setMoods(moodsResult);
          dataLoaded = true;
          loadedMoodCount = moodsResult.length;
        } catch (moodsError: unknown) {
          const context =
            selectedFilter.type === "family"
              ? "family"
              : selectedFilter.type === "member"
                ? "member"
                : "user";
          logger.error(
            `Failed to load ${context} moods`,
            moodsError,
            "MoodsScreen"
          );
          setMoods([]);
        }

        statsPromise
          .then((statsResult) => {
            setStats(statsResult);
          })
          .catch((statsError: unknown) => {
            logger.error(
              "Failed to load mood stats",
              statsError,
              "MoodsScreen"
            );
            setStats(emptyStats);
          });

        const durationMs = Date.now() - startTime;
        logger.info(
          "Moods loaded",
          {
            userId: user.id,
            filterType: selectedFilter.type,
            moodCount: loadedMoodCount,
            durationMs,
          },
          "MoodsScreen"
        );
      } catch (error: unknown) {
        const durationMs = Date.now() - startTime;

        // Check if it's a Firestore index error
        const isIndexError =
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "failed-precondition";

        if (isIndexError) {
          logger.warn(
            "Firestore index not ready for moods query",
            {
              userId: user.id,
              filterType: selectedFilter.type,
              durationMs,
            },
            "MoodsScreen"
          );

          // Only show alert if no data was loaded (fallback should have handled it)
          if (!dataLoaded) {
            Alert.alert(
              isRTL ? "خطأ" : "Error",
              isRTL
                ? "فهرس قاعدة البيانات غير جاهز. يرجى المحاولة مرة أخرى بعد قليل."
                : "Database index not ready. Please try again in a moment."
            );
          }
        } else {
          logger.error("Failed to load moods", error, "MoodsScreen");

          // Only show alert if no data was loaded
          if (!dataLoaded) {
            let errorMessage = isRTL
              ? "حدث خطأ في تحميل البيانات"
              : "Error loading data";

            const err = error as { message?: string };

            if (err.message) {
              if (
                err.message.includes("permission") ||
                err.message.includes("Permission")
              ) {
                errorMessage = isRTL
                  ? "ليس لديك صلاحية لعرض البيانات. يرجى التحقق من إعدادات الحساب."
                  : "You don't have permission to view data. Please check your account settings.";
              } else if (
                err.message.includes("network") ||
                err.message.includes("Network")
              ) {
                errorMessage = isRTL
                  ? "خطأ في الاتصال بالإنترنت. يرجى المحاولة مرة أخرى."
                  : "Network error. Please try again.";
              } else {
                errorMessage = isRTL
                  ? `حدث خطأ في تحميل البيانات: ${err.message}`
                  : `Error loading data: ${err.message}`;
              }
            }

            Alert.alert(isRTL ? "خطأ" : "Error", errorMessage);
          }
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user, selectedFilter, isAdmin, isRTL]
  );

  // Refresh data when tab is focused
  useFocusEffect(
    useCallback(() => {
      loadMoods();
    }, [loadMoods])
  );

  const handleFilterChange = (filter: FilterOption) => {
    setSelectedFilter(filter);
  };

  const getMemberName = (userId: string): string => {
    if (userId === user?.id) {
      return isRTL ? "أنت" : "You";
    }
    const member = familyMembers.find((m) => m.id === userId);
    if (!member) {
      return isRTL ? "عضو غير معروف" : "Unknown Member";
    }
    if (member.firstName && member.lastName) {
      return `${member.firstName} ${member.lastName}`;
    }
    if (member.firstName) {
      return member.firstName;
    }
    return isRTL ? "عضو غير معروف" : "Unknown Member";
  };

  const handleAddMood = async () => {
    if (!user) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "يرجى تسجيل الدخول" : "Please log in"
      );
      return;
    }

    if (!selectedMood) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "يرجى اختيار الحالة النفسية" : "Please select a mood"
      );
      return;
    }

    if (!user.id) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "معرف المستخدم غير موجود" : "User ID not found"
      );
      return;
    }

    try {
      setLoading(true);

      if (editingMood) {
        // Check if user can edit this mood
        const canEdit =
          editingMood.userId === user.id ||
          (isAdmin &&
            (selectedFilter.type === "family" ||
              selectedFilter.type === "member"));
        if (!canEdit) {
          Alert.alert(
            isRTL ? "غير مسموح" : "Not Permitted",
            isRTL
              ? "ليس لديك صلاحية لتعديل هذه الحالةالنفسية"
              : "You do not have permission to edit this mood"
          );
          return;
        }

        // Update existing mood
        const updateData: Partial<Mood> = {
          mood: selectedMood,
          intensity: intensity as 1 | 2 | 3 | 4 | 5,
          ...(notes && { notes }),
        };

        await moodService.updateMood(editingMood.id, updateData);
        setEditingMood(null);
      } else {
        // Add new mood
        const targetUserId = selectedTargetUser || user.id;

        if (!targetUserId) {
          throw new Error("Target user ID is required");
        }

        const moodData: Omit<Mood, "id"> = {
          userId: targetUserId,
          mood: selectedMood as MoodType,
          intensity: intensity as 1 | 2 | 3 | 4 | 5,
          timestamp: new Date(),
          activities: [],
          ...(notes && { notes }),
        };

        if (isAdmin && targetUserId !== user.id) {
          // Admin adding mood for another family member
          await moodService.addMoodForUser(moodData, targetUserId);
        } else {
          // User adding mood for themselves
          await moodService.addMood(moodData);
        }
      }

      // Reset form
      setSelectedMood("");
      setIntensity(1);
      setNotes("");
      setSelectedTargetUser("");
      setShowAddModal(false);

      // Reload moods
      await loadMoods();

      Alert.alert(
        isRTL ? "تم الحفظ" : "Saved",
        isRTL
          ? editingMood
            ? "تم تحديث الحالة بنجاح"
            : "تم تسجيل الحالة بنجاح"
          : editingMood
            ? "Mood updated successfully"
            : "Mood logged successfully"
      );
    } catch (error: unknown) {
      // Provide more specific error messages
      let errorMessage = isRTL ? "حدث خطأ في حفظ الحالة" : "Error saving mood";

      const err = error as { message?: string };

      if (err.message) {
        if (
          err.message.includes("permission") ||
          err.message.includes("Permission")
        ) {
          errorMessage = isRTL
            ? "ليس لديك صلاحية لحفظ الحالة النفسية. يرجى التحقق من إعدادات الحساب."
            : "You don't have permission to save mood. Please check your account settings.";
        } else if (
          err.message.includes("network") ||
          err.message.includes("Network")
        ) {
          errorMessage = isRTL
            ? "خطأ في الاتصال بالإنترنت. يرجى المحاولة مرة أخرى."
            : "Network error. Please try again.";
        } else if (err.message.includes("required")) {
          errorMessage = isRTL
            ? "يرجى ملء جميع الحقول المطلوبة"
            : "Please fill in all required fields";
        } else {
          errorMessage = isRTL
            ? `حدث خطأ في حفظ الحالة النفسية: ${err.message}`
            : `Error saving mood: ${err.message}`;
        }
      }

      Alert.alert(isRTL ? "خطأ" : "Error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleEditMood = (mood: Mood) => {
    // Check permissions
    const canEdit =
      mood.userId === user?.id ||
      (isAdmin &&
        (selectedFilter.type === "family" || selectedFilter.type === "member"));
    if (!canEdit) {
      Alert.alert(
        isRTL ? "غير مسموح" : "Not Permitted",
        isRTL
          ? "ليس لديك صلاحية لتعديل هذه الحالة النفسية"
          : "You do not have permission to edit this mood"
      );
      return;
    }

    setEditingMood(mood);
    setSelectedMood(mood.mood);
    setIntensity(mood.intensity);
    setNotes(mood.notes || "");
    setSelectedTargetUser(mood.userId);
    setShowAddModal(true);
    setShowActionsMenu(null);
  };

  const handleDeleteMood = (mood: Mood) => {
    // Check permissions
    const canDelete =
      mood.userId === user?.id ||
      (isAdmin &&
        (selectedFilter.type === "family" || selectedFilter.type === "member"));
    if (!canDelete) {
      Alert.alert(
        isRTL ? "غير مسموح" : "Not Permitted",
        isRTL
          ? "ليس لديك صلاحية لحذف هذه الحالة النفسية"
          : "You do not have permission to delete this mood"
      );
      return;
    }

    Alert.alert(
      isRTL ? "حذف الحالة النفسية" : "Delete Mood",
      isRTL
        ? "هل أنت متأكد من رغبتك في حذف هذه الحالة النفسية؟"
        : "Are you sure you want to delete this mood?",
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
              setLoading(true);
              await moodService.deleteMood(mood.id);
              await loadMoods();
              setShowActionsMenu(null);
              Alert.alert(
                isRTL ? "تم الحذف" : "Deleted",
                isRTL
                  ? "تم حذف الحالة النفسية بنجاح"
                  : "Mood deleted successfully"
              );
            } catch (_error) {
              // Silently handle mood delete error
              Alert.alert(
                isRTL ? "خطأ" : "Error",
                isRTL ? "حدث خطأ في حذف الحالة النفسية" : "Error deleting mood"
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const getMoodColor = (moodType: string) => {
    switch (moodType) {
      // Positive emotions - greens
      case "veryHappy":
        return "#10B981";
      case "happy":
        return "#34D399";
      case "excited":
        return "#22C55E";
      case "content":
        return "#4ADE80";
      case "grateful":
        return "#16A34A";
      case "hopeful":
        return "#84CC16";
      case "proud":
        return "#65A30D";
      case "calm":
        return "#86EFAC";
      case "peaceful":
        return "#A7F3D0";
      // Negative emotions - reds/oranges
      case "sad":
        return "#F87171";
      case "verySad":
        return "#EF4444";
      case "anxious":
        return "#F97316";
      case "angry":
        return "#DC2626";
      case "frustrated":
        return "#EA580C";
      case "overwhelmed":
        return "#F59E0B";
      case "hopeless":
        return "#B91C1C";
      case "guilty":
        return "#C2410C";
      case "ashamed":
        return "#991B1B";
      case "lonely":
        return "#FCA5A5";
      case "irritable":
        return "#FB923C";
      case "restless":
        return "#FB7185";
      case "stressed":
        return "#F97316";
      // Neutral/Other - yellows/grays
      case "neutral":
        return "#F59E0B";
      case "confused":
        return "#EAB308";
      case "numb":
        return "#94A3B8";
      case "detached":
        return "#64748B";
      case "empty":
        return "#475569";
      case "apathetic":
        return "#6B7280";
      case "tired":
        return "#A78BFA";
      default:
        return "#6B7280";
    }
  };

  const getMoodEmoji = (moodType: string) => {
    const moodOption = MOOD_OPTIONS.find((m) => m.value === moodType);
    return moodOption?.emoji || "😐";
  };

  const formatMoodLabel = (moodType: string) => {
    if (!moodType) {
      return "Mood";
    }
    return moodType
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (char) => char.toUpperCase());
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return isRTL ? "منذ أقل من ساعة" : "Less than an hour ago";
    }
    if (diffInHours < 24) {
      const hours = Math.floor(diffInHours);
      return isRTL
        ? `منذ ${hours} ساعة${hours > 1 ? "ات" : ""}`
        : `${hours} hour${hours > 1 ? "s" : ""} ago`;
    }
    const days = Math.floor(diffInHours / 24);
    return isRTL
      ? `منذ ${days} يوم${days > 1 ? "" : ""}`
      : `${days} day${days > 1 ? "s" : ""} ago`;
  };

  const renderIntensitySelector = () => (
    <View style={styles.intensityContainer}>
      <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
        {isRTL ? "الشدة" : "Intensity"} ({intensity}/5)
      </Text>
      <View style={styles.intensityButtons}>
        {[1, 2, 3, 4, 5].map((level) => (
          <TouchableOpacity
            key={level}
            onPress={() => setIntensity(level)}
            style={[
              styles.intensityButton,
              intensity >= level && styles.intensityButtonActive,
            ]}
          >
            <Text
              style={[
                styles.intensityButtonText,
                intensity >= level && styles.intensityButtonTextActive,
              ]}
            >
              {level}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.intensityLabels}>
        <Text style={[styles.intensityLabel, isRTL && styles.rtlText]}>
          {t("mild", "Mild")}
        </Text>
        <Text style={[styles.intensityLabel, isRTL && styles.rtlText]}>
          {t("veryIntense", "Very Intense")}
        </Text>
      </View>
    </View>
  );

  if (!user) {
    return (
      <SafeAreaView
        edges={["top"]}
        pointerEvents="box-none"
        style={styles.container}
      >
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>
            {t("pleaseLogInToTrackMoods", "Please log in to track moods")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <GradientScreen
      edges={["top"]}
      pointerEvents="box-none"
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.figmaMoodContent}
        refreshControl={
          <RefreshControl
            onRefresh={() => loadMoods(true)}
            refreshing={refreshing}
            tintColor="#0F766E"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.figmaMoodHeaderWrap}>
          <WavyBackground curve="home" height={240} variant="teal">
            <View style={styles.figmaMoodHeaderContent}>
              <View style={styles.figmaMoodHeaderRow}>
                <TouchableOpacity
                  onPress={() =>
                    params.returnTo === "track"
                      ? router.push("/(tabs)/track")
                      : router.back()
                  }
                  style={styles.figmaMoodBackButton}
                >
                  <ArrowLeft color="#003543" size={20} />
                </TouchableOpacity>
                <View style={styles.figmaMoodHeaderTitle}>
                  <View style={styles.figmaMoodTitleRow}>
                    <Brain color="#EB9C0C" size={20} />
                    <Text style={styles.figmaMoodTitle}>Mood Tracking</Text>
                  </View>
                  <Text style={styles.figmaMoodSubtitle}>
                    Monitor emotional wellbeing
                  </Text>
                </View>
              </View>
            </View>
          </WavyBackground>
        </View>

        <FamilyDataFilter
          currentUserId={user.id}
          familyMembers={familyMembers}
          hasFamily={hasFamily}
          isAdmin={isAdmin}
          onFilterChange={handleFilterChange}
          selectedFilter={selectedFilter}
        />

        <View style={styles.figmaMoodStatsRow}>
          <View style={styles.figmaMoodStatCard}>
            <Text style={styles.figmaMoodStatValue}>
              {stats.avgIntensity.toFixed(1)}
            </Text>
            <Text style={styles.figmaMoodStatLabel}>Avg Mood</Text>
          </View>
          <View style={styles.figmaMoodStatCard}>
            <View style={styles.figmaMoodStatTrendRow}>
              <TrendingUp color="#10B981" size={14} />
              <Text style={[styles.figmaMoodStatValue, { color: "#10B981" }]}>
                {improvementPercent}%
              </Text>
            </View>
            <Text style={styles.figmaMoodStatLabel}>Improved</Text>
          </View>
          <View style={styles.figmaMoodStatCard}>
            <Text style={styles.figmaMoodStatValue}>{totalEntries}</Text>
            <Text style={styles.figmaMoodStatLabel}>Entries</Text>
          </View>
        </View>

        <View style={styles.figmaMoodSection}>
          <View style={styles.figmaMoodSectionHeader}>
            <Text style={styles.figmaMoodSectionTitle}>Mood Trend</Text>
            <TouchableOpacity>
              <Text style={styles.figmaMoodSectionLink}>7 Days</Text>
            </TouchableOpacity>
          </View>
          <HealthChart
            data={moodTrendSeries}
            height={200}
            showGrid={true}
            showLegend={false}
            title=""
            yAxisSuffix=""
          />
        </View>

        <View style={styles.figmaMoodSection}>
          <Text style={styles.figmaMoodSectionTitle}>Mood Distribution</Text>
          <View style={styles.figmaMoodDistributionCard}>
            <View style={styles.figmaMoodDistributionChart}>
              {moodDistributionPie.length > 0 ? (
                <PieChart
                  accessor="population"
                  backgroundColor="transparent"
                  center={[0, 0]}
                  data={moodDistributionPie}
                  hasLegend={false}
                  height={140}
                  paddingLeft="0"
                  width={140}
                />
              ) : (
                <Text style={styles.figmaMoodEmptyText}>No mood data yet</Text>
              )}
            </View>
            <View style={styles.figmaMoodDistributionLegend}>
              {topMoodDistribution.map((item) => {
                const percentage = Math.round(
                  (item.count / distributionTotal) * 100
                );
                return (
                  <View
                    key={item.mood}
                    style={styles.figmaMoodDistributionLegendRow}
                  >
                    <View style={styles.figmaMoodDistributionLegendLabel}>
                      <View
                        style={[
                          styles.figmaMoodDot,
                          { backgroundColor: getMoodColor(item.mood) },
                        ]}
                      />
                      <Text style={styles.figmaMoodDistributionLegendText}>
                        {t(item.mood, formatMoodLabel(item.mood))}
                      </Text>
                    </View>
                    <Text style={styles.figmaMoodDistributionLegendValue}>
                      {percentage}%
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        <View style={styles.figmaMoodSection}>
          <Text style={styles.figmaMoodSectionTitle}>How are you feeling?</Text>
          <View style={styles.figmaMoodQuickGrid}>
            {quickMoodFigmaOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                onPress={() => {
                  setSelectedMood(option.value as MoodType);
                  setIntensity(3);
                  setSelectedTargetUser(
                    selectedFilter.type === "member" && selectedFilter.memberId
                      ? selectedFilter.memberId
                      : user.id
                  );
                  setShowActionsMenu(null);
                  setShowAddModal(true);
                }}
                style={styles.figmaMoodQuickButton}
              >
                <Text style={styles.figmaMoodQuickEmoji}>{option.emoji}</Text>
                <Text style={styles.figmaMoodQuickLabel}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.figmaMoodSection}>
          <View style={styles.figmaMoodSectionHeader}>
            <Text style={styles.figmaMoodSectionTitle}>Recent Entries</Text>
            <TouchableOpacity>
              <Text style={styles.figmaMoodSectionLink}>View All</Text>
            </TouchableOpacity>
          </View>
          {loading ? (
            <View style={styles.figmaMoodEmptyState}>
              <Text style={styles.figmaMoodEmptyText}>Loading moods...</Text>
            </View>
          ) : recentMoods.length === 0 ? (
            <View style={styles.figmaMoodEmptyState}>
              <Text style={styles.figmaMoodEmptyText}>No moods recorded</Text>
            </View>
          ) : (
            <View style={styles.figmaMoodEntryList}>
              {recentMoods.map((mood) => {
                const canManage =
                  mood.userId === user.id ||
                  (isAdmin &&
                    (selectedFilter.type === "family" ||
                      selectedFilter.type === "member"));
                const memberLabel =
                  selectedFilter.type === "personal"
                    ? ""
                    : ` - ${getMemberName(mood.userId)}`;
                const tags =
                  mood.notes
                    ?.split(",")
                    .map((tag) => tag.trim())
                    .filter(Boolean) ?? [];
                return (
                  <View key={mood.id} style={styles.figmaMoodEntryCard}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onLongPress={() =>
                        canManage
                          ? setShowActionsMenu(
                              showActionsMenu === mood.id ? null : mood.id
                            )
                          : null
                      }
                      onPress={() => handleEditMood(mood)}
                      style={styles.figmaMoodEntryRow}
                    >
                      <View
                        style={[
                          styles.figmaMoodEntryIcon,
                          { backgroundColor: `${getMoodColor(mood.mood)}15` },
                        ]}
                      >
                        <Text style={styles.figmaMoodEntryEmoji}>
                          {getMoodEmoji(mood.mood)}
                        </Text>
                      </View>
                      <View style={styles.figmaMoodEntryInfo}>
                        <View style={styles.figmaMoodEntryHeader}>
                          <Text style={styles.figmaMoodEntryTitle}>
                            {t(mood.mood, formatMoodLabel(mood.mood))}
                          </Text>
                          <Text style={styles.figmaMoodEntryTime}>
                            {formatDate(mood.timestamp) || ""}
                            {memberLabel}
                          </Text>
                        </View>
                        <View style={styles.figmaMoodEntryTags}>
                          {tags.length > 0 ? (
                            tags.slice(0, 3).map((tag) => (
                              <View
                                key={`${mood.id}-${tag}`}
                                style={styles.figmaMoodEntryTag}
                              >
                                <Text style={styles.figmaMoodEntryTagText}>
                                  {tag}
                                </Text>
                              </View>
                            ))
                          ) : (
                            <Text style={styles.figmaMoodEntryTagEmpty}>
                              No notes
                            </Text>
                          )}
                        </View>
                      </View>
                      <ChevronRight color="#6C7280" size={18} />
                    </TouchableOpacity>
                    {showActionsMenu === mood.id && (
                      <View style={styles.figmaMoodActionsMenu}>
                        <TouchableOpacity
                          onPress={() => handleEditMood(mood)}
                          style={styles.figmaMoodActionItem}
                        >
                          <Edit color="#64748B" size={16} />
                          <Text style={styles.figmaMoodActionText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeleteMood(mood)}
                          style={styles.figmaMoodActionItem}
                        >
                          <Trash2 color="#EF4444" size={16} />
                          <Text
                            style={[
                              styles.figmaMoodActionText,
                              styles.figmaMoodActionDelete,
                            ]}
                          >
                            Delete
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <TouchableOpacity
        onPress={() => {
          setSelectedTargetUser(user.id);
          setShowAddModal(true);
        }}
        style={styles.figmaMoodFab}
      >
        <Plus color="#FFFFFF" size={22} />
      </TouchableOpacity>

      {/* Add Mood Modal */}
      <Modal
        animationType="slide"
        onRequestClose={() => {
          setShowAddModal(false);
          setEditingMood(null);
          setSelectedMood("");
          setIntensity(1);
          setNotes("");
        }}
        presentationStyle="pageSheet"
        visible={showAddModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
              {editingMood
                ? isRTL
                  ? "تعديل الحالة النفسية"
                  : "Edit Mood"
                : isRTL
                  ? "إضافة حالة نفسية جديدة"
                  : "Add New Mood"}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setShowAddModal(false);
                setEditingMood(null);
                setSelectedMood("");
                setIntensity(1);
                setNotes("");
              }}
              style={styles.closeButton}
            >
              <X color="#64748B" size={24} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Target User Selector (for admins) */}
            {isAdmin && hasFamily && familyMembers.length > 0 && (
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                  {isRTL ? "إضافة الحالة النفسية لـ" : "Add mood for"}
                </Text>
                <View style={styles.memberSelectionContainer}>
                  {familyMembers.map((member) => (
                    <TouchableOpacity
                      key={member.id}
                      onPress={() => setSelectedTargetUser(member.id)}
                      style={[
                        styles.memberOption,
                        selectedTargetUser === member.id &&
                          styles.memberOptionSelected,
                      ]}
                    >
                      <View style={styles.memberInfo}>
                        <Text
                          style={[
                            styles.memberName,
                            selectedTargetUser === member.id &&
                              styles.memberNameSelected,
                            isRTL && styles.rtlText,
                          ]}
                        >
                          {member.id === user.id
                            ? isRTL
                              ? "أنت"
                              : "You"
                            : member.firstName && member.lastName
                              ? `${member.firstName} ${member.lastName}`
                              : member.firstName || "User"}
                        </Text>
                        {member.role === "admin" && (
                          <Text
                            style={[
                              styles.memberRole,
                              selectedTargetUser === member.id &&
                                styles.memberRoleSelected,
                              isRTL && styles.rtlText,
                            ]}
                          >
                            {isRTL ? "مدير" : "Admin"}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Mood Selection */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {isRTL ? "اختر الحالة النفسية" : "Select Mood"}
              </Text>

              {/* Positive Emotions */}
              <View style={styles.moodCategory}>
                <Text style={[styles.categoryLabel, isRTL && styles.rtlText]}>
                  {isRTL ? "مشاعر إيجابية" : "Positive Emotions"}
                </Text>
                <View style={styles.moodsGrid}>
                  {MOOD_OPTIONS.filter((m) => m.category === "positive").map(
                    (moodOption) => (
                      <TouchableOpacity
                        key={moodOption.value}
                        onPress={() =>
                          setSelectedMood(moodOption.value as MoodType)
                        }
                        style={[
                          styles.moodOption,
                          selectedMood === moodOption.value &&
                            styles.moodOptionSelected,
                        ]}
                      >
                        <Text style={styles.moodOptionEmoji}>
                          {moodOption.emoji}
                        </Text>
                        <Text
                          style={[
                            styles.moodOptionText,
                            selectedMood === moodOption.value &&
                              styles.moodOptionTextSelected,
                            isRTL && styles.rtlText,
                          ]}
                        >
                          {t(moodOption.label)}
                        </Text>
                      </TouchableOpacity>
                    )
                  )}
                </View>
              </View>

              {/* Negative Emotions */}
              <View style={styles.moodCategory}>
                <Text style={[styles.categoryLabel, isRTL && styles.rtlText]}>
                  {isRTL ? "مشاعر سلبية" : "Negative Emotions"}
                </Text>
                <View style={styles.moodsGrid}>
                  {MOOD_OPTIONS.filter((m) => m.category === "negative").map(
                    (moodOption) => (
                      <TouchableOpacity
                        key={moodOption.value}
                        onPress={() =>
                          setSelectedMood(moodOption.value as MoodType)
                        }
                        style={[
                          styles.moodOption,
                          selectedMood === moodOption.value &&
                            styles.moodOptionSelected,
                        ]}
                      >
                        <Text style={styles.moodOptionEmoji}>
                          {moodOption.emoji}
                        </Text>
                        <Text
                          style={[
                            styles.moodOptionText,
                            selectedMood === moodOption.value &&
                              styles.moodOptionTextSelected,
                            isRTL && styles.rtlText,
                          ]}
                        >
                          {t(moodOption.label)}
                        </Text>
                      </TouchableOpacity>
                    )
                  )}
                </View>
              </View>

              {/* Neutral/Other States */}
              <View style={styles.moodCategory}>
                <Text style={[styles.categoryLabel, isRTL && styles.rtlText]}>
                  {isRTL ? "حالات نفسية أخرى" : "Other Moods"}
                </Text>
                <View style={styles.moodsGrid}>
                  {MOOD_OPTIONS.filter((m) => m.category === "neutral").map(
                    (moodOption) => (
                      <TouchableOpacity
                        key={moodOption.value}
                        onPress={() =>
                          setSelectedMood(moodOption.value as MoodType)
                        }
                        style={[
                          styles.moodOption,
                          selectedMood === moodOption.value &&
                            styles.moodOptionSelected,
                        ]}
                      >
                        <Text style={styles.moodOptionEmoji}>
                          {moodOption.emoji}
                        </Text>
                        <Text
                          style={[
                            styles.moodOptionText,
                            selectedMood === moodOption.value &&
                              styles.moodOptionTextSelected,
                            isRTL && styles.rtlText,
                          ]}
                        >
                          {t(moodOption.label)}
                        </Text>
                      </TouchableOpacity>
                    )
                  )}
                </View>
              </View>
            </View>

            {/* Intensity */}
            {renderIntensitySelector()}

            {/* Notes */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {t("notes")} ({isRTL ? "اختياري" : "Optional"})
              </Text>
              <TextInput
                multiline
                numberOfLines={3}
                onChangeText={setNotes}
                placeholder={
                  isRTL
                    ? "أضف ملاحظات حول حالتك النفسية..."
                    : "Add notes about your mood..."
                }
                style={[
                  styles.textInput,
                  styles.textArea,
                  isRTL && styles.rtlTextInput,
                ]}
                textAlign={isRTL ? "right" : "left"}
                value={notes}
              />
            </View>

            {/* Save Button */}
            <TouchableOpacity
              disabled={loading}
              onPress={handleAddMood}
              style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            >
              <Text style={[styles.saveButtonText, isRTL && styles.rtlText]}>
                {loading
                  ? isRTL
                    ? "جاري الحفظ..."
                    : "Saving..."
                  : editingMood
                    ? isRTL
                      ? "تحديث الحالة النفسية"
                      : "Update Mood"
                    : isRTL
                      ? "حفظ الحالة النفسية"
                      : "Save Mood"}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </GradientScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  figmaMoodHeaderWrap: {
    marginHorizontal: -20,
    marginTop: -20,
    marginBottom: 12,
  },
  figmaMoodHeaderContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  figmaMoodHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  figmaMoodBackButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  figmaMoodHeaderTitle: {
    flex: 1,
  },
  figmaMoodTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  figmaMoodTitle: {
    fontSize: 22,
    fontFamily: "Inter-Bold",
    color: "#FFFFFF",
  },
  figmaMoodSubtitle: {
    fontSize: 13,
    fontFamily: "Inter-SemiBold",
    color: "rgba(0, 53, 67, 0.85)",
  },
  figmaMoodAddButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#003543",
    alignItems: "center",
    justifyContent: "center",
  },
  figmaMoodContent: {
    paddingHorizontal: 20,
    paddingBottom: 140,
  },
  figmaMoodStatsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  figmaMoodStatCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  figmaMoodStatValue: {
    fontSize: 20,
    fontFamily: "Inter-Bold",
    color: "#003543",
    marginBottom: 4,
  },
  figmaMoodStatLabel: {
    fontSize: 11,
    fontFamily: "Inter-SemiBold",
    color: "#64748B",
  },
  figmaMoodStatTrendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  figmaMoodSection: {
    marginBottom: 20,
  },
  figmaMoodSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  figmaMoodSectionTitle: {
    fontSize: 18,
    fontFamily: "Inter-Bold",
    color: "#0F172A",
  },
  figmaMoodSectionLink: {
    fontSize: 13,
    fontFamily: "Inter-SemiBold",
    color: "#003543",
  },
  figmaMoodSectionHint: {
    fontSize: 12,
    fontFamily: "Inter-SemiBold",
    color: "#0F766E",
  },
  figmaMoodDistributionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  figmaMoodDistributionChart: {
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  figmaMoodDistributionLegend: {
    flex: 1,
    gap: 10,
  },
  figmaMoodDistributionLegendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  figmaMoodDistributionLegendLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  figmaMoodDistributionLegendText: {
    fontSize: 13,
    fontFamily: "Inter-Medium",
    color: "#1A1D1F",
  },
  figmaMoodDistributionLegendValue: {
    fontSize: 13,
    fontFamily: "Inter-SemiBold",
    color: "#6C7280",
  },
  figmaMoodTrendCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  figmaMoodTrendInfo: {
    gap: 6,
  },
  figmaMoodTrendValue: {
    fontSize: 18,
    fontFamily: "Inter-Bold",
    color: "#0F766E",
  },
  figmaMoodTrendLabel: {
    fontSize: 12,
    fontFamily: "Inter-SemiBold",
    color: "#64748B",
  },
  figmaMoodDistributionList: {
    gap: 10,
  },
  figmaMoodDistributionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  figmaMoodDistributionLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    width: 110,
  },
  figmaMoodDistributionText: {
    fontSize: 12,
    fontFamily: "Inter-SemiBold",
    color: "#0F172A",
  },
  figmaMoodDistributionBar: {
    flex: 1,
    height: 8,
    backgroundColor: "#E2E8F0",
    borderRadius: 999,
    overflow: "hidden",
  },
  figmaMoodDistributionFill: {
    height: "100%",
    borderRadius: 999,
  },
  figmaMoodDistributionValue: {
    fontSize: 11,
    fontFamily: "Inter-SemiBold",
    color: "#64748B",
    width: 36,
    textAlign: "right",
  },
  figmaMoodQuickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
    columnGap: 8,
  },
  figmaMoodQuickButton: {
    width: "18%",
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  figmaMoodQuickEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  figmaMoodQuickLabel: {
    fontSize: 11,
    fontFamily: "Inter-SemiBold",
    color: "#6C7280",
  },
  figmaMoodEntryList: {
    gap: 12,
  },
  figmaMoodEntryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  figmaMoodEntryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  figmaMoodEntryIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  figmaMoodEntryEmoji: {
    fontSize: 22,
  },
  figmaMoodEntryInfo: {
    flex: 1,
  },
  figmaMoodEntryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  figmaMoodEntryTitle: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    color: "#1A1D1F",
  },
  figmaMoodEntryTime: {
    fontSize: 11,
    fontFamily: "Inter-Medium",
    color: "#6C7280",
  },
  figmaMoodEntryTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  figmaMoodEntryTag: {
    backgroundColor: "rgba(0, 53, 67, 0.1)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  figmaMoodEntryTagText: {
    fontSize: 11,
    fontFamily: "Inter-SemiBold",
    color: "#003543",
  },
  figmaMoodEntryTagEmpty: {
    fontSize: 11,
    fontFamily: "Inter-Medium",
    color: "#9CA3AF",
  },
  figmaMoodList: {
    gap: 12,
  },
  figmaMoodCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  figmaMoodCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  figmaMoodCardInfo: {
    flex: 1,
  },
  figmaMoodCardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  figmaMoodCardTitle: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    color: "#0F172A",
  },
  figmaMoodCardMeta: {
    fontSize: 11,
    fontFamily: "Inter-Medium",
    color: "#64748B",
    marginTop: 4,
  },
  figmaMoodDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  figmaMoodCardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  figmaMoodIntensityBadge: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  figmaMoodIntensityText: {
    fontSize: 12,
    fontFamily: "Inter-Bold",
    color: "#FFFFFF",
  },
  figmaMoodActionsButton: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },
  figmaMoodNotes: {
    marginTop: 10,
    fontSize: 12,
    fontFamily: "Inter-Medium",
    color: "#475569",
    lineHeight: 18,
  },
  figmaMoodActionsMenu: {
    flexDirection: "row",
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    marginTop: 12,
    paddingTop: 12,
  },
  figmaMoodActionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  figmaMoodActionText: {
    fontSize: 12,
    fontFamily: "Inter-SemiBold",
    color: "#64748B",
  },
  figmaMoodActionDelete: {
    color: "#EF4444",
  },
  figmaMoodEmptyState: {
    paddingVertical: 16,
    alignItems: "center",
  },
  figmaMoodEmptyText: {
    fontSize: 12,
    fontFamily: "Inter-Medium",
    color: "#64748B",
    textAlign: "center",
  },
  figmaMoodFab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#EB9C0C",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  title: {
    fontSize: 24,
    fontFamily: "Inter-Bold",
    color: "#1E293B",
  },
  rtlText: {
    fontFamily: "Inter-Bold",
    textAlign: "right",
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  statsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inter-SemiBold",
    color: "#1E293B",
    marginBottom: 12,
  },
  sectionTitleRTL: {
    textAlign: "right",
  },
  statsGrid: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 24,
    fontFamily: "Inter-Bold",
    color: "#2563EB",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Inter-Medium",
    color: "#64748B",
    textAlign: "center",
  },
  moodsSection: {
    marginBottom: 24,
  },
  moodCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  moodHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  moodInfo: {
    flex: 1,
  },
  moodEmojiContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  moodEmoji: {
    fontSize: 24,
  },
  moodType: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    color: "#1E293B",
  },
  moodMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  moodDate: {
    fontSize: 12,
    fontFamily: "Inter-Medium",
    color: "#64748B",
  },
  memberBadge: {
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  memberBadgeText: {
    fontSize: 10,
    fontFamily: "Inter-Medium",
    color: "#6366F1",
  },
  moodActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  intensityBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  intensityText: {
    fontSize: 12,
    fontFamily: "Inter-Bold",
    color: "#FFFFFF",
  },
  actionsButton: {
    padding: 4,
  },
  moodNotes: {
    fontSize: 14,
    fontFamily: "Inter-Regular",
    color: "#475569",
    lineHeight: 20,
  },
  actionsMenu: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    flexDirection: "row",
    gap: 16,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
  },
  actionText: {
    fontSize: 14,
    fontFamily: "Inter-Medium",
    color: "#64748B",
  },
  deleteText: {
    color: "#EF4444",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: "Inter-Medium",
    color: "#64748B",
    textAlign: "center",
  },
  loadingText: {
    fontSize: 16,
    fontFamily: "Inter-Medium",
    color: "#64748B",
  },
  errorText: {
    fontSize: 16,
    fontFamily: "Inter-Medium",
    color: "#EF4444",
    textAlign: "center",
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Inter-SemiBold",
    color: "#1E293B",
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  fieldGroup: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    color: "#1E293B",
    marginBottom: 8,
  },
  moodCategory: {
    marginBottom: 20,
  },
  categoryLabel: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    color: "#64748B",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  moodsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  moodOption: {
    flex: 1,
    minWidth: "30%",
    backgroundColor: "#F1F5F9",
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  moodOptionSelected: {
    backgroundColor: "#EBF4FF",
    borderColor: "#2563EB",
    borderWidth: 2,
  },
  moodOptionEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  moodOptionText: {
    fontSize: 14,
    fontFamily: "Inter-Medium",
    color: "#64748B",
    textAlign: "center",
  },
  moodOptionTextSelected: {
    color: "#2563EB",
    fontFamily: "Inter-SemiBold",
  },
  textInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: "Inter-Regular",
    color: "#1E293B",
  },
  rtlTextInput: {
    fontFamily: "Inter-Regular",
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  intensityContainer: {
    marginBottom: 24,
  },
  intensityButtons: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  intensityButton: {
    flex: 1,
    height: 44,
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  intensityButtonActive: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  intensityButtonText: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    color: "#64748B",
  },
  intensityButtonTextActive: {
    color: "#FFFFFF",
  },
  intensityLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  intensityLabel: {
    fontSize: 12,
    fontFamily: "Inter-Medium",
    color: "#64748B",
  },
  saveButton: {
    backgroundColor: "#2563EB",
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 24,
  },
  saveButtonDisabled: {
    backgroundColor: "#94A3B8",
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    color: "#FFFFFF",
  },
  // Member selection styles
  memberSelectionContainer: {
    gap: 8,
  },
  memberOption: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  memberOptionSelected: {
    backgroundColor: "#EBF4FF",
    borderColor: "#2563EB",
  },
  memberInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  memberName: {
    fontSize: 16,
    fontFamily: "Inter-Medium",
    color: "#1E293B",
  },
  memberNameSelected: {
    color: "#2563EB",
  },
  memberRole: {
    fontSize: 12,
    fontFamily: "Inter-Medium",
    color: "#64748B",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  memberRoleSelected: {
    color: "#2563EB",
    backgroundColor: "#EBF4FF",
  },
  // Custom header styles
  customHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "Inter-SemiBold",
    color: "#1E293B",
    textAlign: "center",
  },
});
