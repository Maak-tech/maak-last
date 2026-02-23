import { router } from "expo-router";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  Clock,
  RefreshCw,
  Stethoscope,
  Zap,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Caption,
  Text as TypographyText,
} from "@/components/design-system/Typography";
import WavyBackground from "@/components/figma/WavyBackground";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useTasks } from "@/hooks/useTasks";
import type { Task, TaskPriority, TaskStatus } from "@/types";
import { getTextStyle } from "@/utils/styles";

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  urgent: "#EF4444",
  high: "#F97316",
  normal: "#3B82F6",
  low: "#6B7280",
};

const STATUS_FILTERS: Array<{
  key: TaskStatus | "all";
  en: string;
  ar: string;
}> = [
  { key: "all", en: "All", ar: "الكل" },
  { key: "open", en: "Open", ar: "مفتوح" },
  { key: "in_progress", en: "In Progress", ar: "جارٍ" },
  { key: "completed", en: "Done", ar: "مكتمل" },
  { key: "escalated", en: "Escalated", ar: "تصعيد" },
];

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  isRTL,
  theme,
  onComplete,
  onPress,
}: {
  task: Task;
  isRTL: boolean;
  theme: ReturnType<typeof useTheme>["theme"];
  onComplete: () => void;
  onPress: () => void;
}) {
  const isCompleted = task.status === "completed";
  const isEscalated = task.status === "escalated";
  const dotColor = PRIORITY_COLORS[task.priority] ?? "#6B7280";

  const formattedDate = (() => {
    const d = task.dueAt ?? task.createdAt;
    const diff = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return d.toLocaleDateString();
  })();

  const cardBorderColor = isEscalated
    ? "#EF4444"
    : isCompleted
      ? "#10B981"
      : dotColor;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: theme.colors.background.secondary,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: cardBorderColor,
        flexDirection: isRTL ? "row-reverse" : "row",
        alignItems: "flex-start",
        gap: 12,
      }}
    >
      {/* Source icon */}
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: isEscalated
            ? "#FEF2F2"
            : isCompleted
              ? "#F0FDF4"
              : "#EFF6FF",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {isCompleted ? (
          <CheckCircle2 size={18} color="#10B981" />
        ) : isEscalated ? (
          <AlertTriangle size={18} color="#EF4444" />
        ) : task.source === "agent" ? (
          <Zap size={18} color="#3B82F6" />
        ) : (
          <Stethoscope size={18} color="#6B7280" />
        )}
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        <TypographyText
          style={{
            fontSize: 15,
            fontWeight: "600",
            color: isCompleted
              ? theme.colors.text.secondary
              : theme.colors.text.primary,
            textDecorationLine: isCompleted ? "line-through" : "none",
            textAlign: isRTL ? "right" : "left",
          }}
        >
          {task.title}
        </TypographyText>

        {task.description ? (
          <Caption
            style={{
              marginTop: 2,
              textAlign: isRTL ? "right" : "left",
            }}
          >
            {task.description}
          </Caption>
        ) : null}

        <View
          style={{
            flexDirection: isRTL ? "row-reverse" : "row",
            gap: 8,
            marginTop: 8,
            flexWrap: "wrap",
          }}
        >
          {/* Priority badge */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              backgroundColor: `${dotColor}18`,
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 999,
            }}
          >
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: dotColor,
              }}
            />
            <Caption style={{ color: dotColor, fontWeight: "600" }}>
              {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
            </Caption>
          </View>

          {/* Time chip */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Clock size={10} color={theme.colors.text.secondary} />
            <Caption>{formattedDate}</Caption>
          </View>

          {/* Agent badge */}
          {task.source === "agent" ? (
            <View
              style={{
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 4,
                backgroundColor: "#EFF6FF",
              }}
            >
              <Caption style={{ color: "#3B82F6", fontSize: 10 }}>
                AI Agent
              </Caption>
            </View>
          ) : null}
        </View>
      </View>

      {/* Complete button */}
      {!isCompleted && !isEscalated ? (
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            onComplete();
          }}
          style={{ padding: 6 }}
        >
          <CheckCircle2 size={20} color={theme.colors.text.tertiary} />
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TasksScreen() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const isRTL = i18n.language === "ar";

  // TODO: replace with actual orgId from user's org membership
  const orgId = (user as Record<string, unknown>)?.currentOrgId as
    | string
    | undefined;

  const {
    tasks,
    urgentCount,
    loading,
    refreshing,
    error,
    statusFilter,
    setStatusFilter,
    refresh,
    completeTask,
  } = useTasks({
    orgId,
    autoLoad: true,
    initialStatus: "open",
  });

  // ─── No org state ───────────────────────────────────────────────────────────

  if (!orgId) {
    return (
      <WavyBackground>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            gap: 12,
          }}
        >
          <ClipboardList size={48} color={theme.colors.text.tertiary} />
          <TypographyText
            style={{
              color: theme.colors.text.secondary,
              textAlign: "center",
              fontSize: 15,
            }}
          >
            {isRTL ? "مطلوب عضوية في منظمة" : "Organization membership required"}
          </TypographyText>
        </View>
      </WavyBackground>
    );
  }

  const completedCount = tasks.filter((t) => t.status === "completed").length;

  return (
    <WavyBackground>
      {/* ── Header ── */}
      <View
        style={{
          flexDirection: isRTL ? "row-reverse" : "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 20,
          paddingTop: 56,
          paddingBottom: 16,
        }}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeft size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>

        <View
          style={{
            flexDirection: isRTL ? "row-reverse" : "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <TypographyText
            style={getTextStyle(theme, "heading", "bold", theme.colors.text.primary)}
          >
            {isRTL ? "قائمة المهام" : "Task Queue"}
          </TypographyText>
          {urgentCount > 0 ? (
            <View
              style={{
                backgroundColor: "#EF4444",
                borderRadius: 10,
                paddingHorizontal: 7,
                paddingVertical: 2,
              }}
            >
              <Caption style={{ color: "#fff", fontWeight: "700" }}>
                {urgentCount}
              </Caption>
            </View>
          ) : null}
        </View>

        <TouchableOpacity onPress={refresh} disabled={refreshing}>
          <RefreshCw
            size={20}
            color={theme.colors.text.secondary}
            style={{ opacity: refreshing ? 0.5 : 1 }}
          />
        </TouchableOpacity>
      </View>

      {/* ── Summary bar ── */}
      <View
        style={{
          flexDirection: isRTL ? "row-reverse" : "row",
          paddingHorizontal: 20,
          gap: 12,
          marginBottom: 12,
        }}
      >
        {[
          {
            label: isRTL ? "إجمالي" : "Total",
            value: tasks.length,
            color: theme.colors.text.secondary,
          },
          { label: isRTL ? "عاجل" : "Urgent", value: urgentCount, color: "#EF4444" },
          { label: isRTL ? "مكتمل" : "Done", value: completedCount, color: "#10B981" },
        ].map((stat) => (
          <View
            key={stat.label}
            style={{
              flex: 1,
              backgroundColor: theme.colors.background.secondary,
              borderRadius: 12,
              padding: 12,
              alignItems: "center",
            }}
          >
            <TypographyText
              style={{ fontSize: 20, fontWeight: "700", color: stat.color }}
            >
              {stat.value}
            </TypographyText>
            <Caption>{stat.label}</Caption>
          </View>
        ))}
      </View>

      {/* ── Status filter chips ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          gap: 8,
          paddingBottom: 12,
        }}
      >
        {STATUS_FILTERS.map((f) => {
          const active = statusFilter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => setStatusFilter(f.key)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 999,
                backgroundColor: active
                  ? theme.colors.primary.main
                  : theme.colors.background.secondary,
              }}
            >
              <Caption
                style={{
                  color: active ? "#fff" : theme.colors.text.secondary,
                  fontWeight: active ? "700" : "400",
                }}
              >
                {isRTL ? f.ar : f.en}
              </Caption>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Task list ── */}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
      >
        {loading ? (
          <ActivityIndicator
            style={{ marginTop: 40 }}
            color={theme.colors.primary.main}
          />
        ) : error ? (
          <View style={{ alignItems: "center", paddingTop: 40, gap: 8 }}>
            <AlertTriangle size={32} color="#F97316" />
            <Caption style={{ textAlign: "center" }}>{error}</Caption>
          </View>
        ) : tasks.length === 0 ? (
          <View style={{ alignItems: "center", paddingTop: 60, gap: 12 }}>
            <ClipboardList size={48} color={theme.colors.text.tertiary} />
            <TypographyText
              style={{ color: theme.colors.text.secondary, textAlign: "center" }}
            >
              {isRTL ? "لا توجد مهام" : "No tasks"}
            </TypographyText>
            <Caption style={{ textAlign: "center" }}>
              {isRTL
                ? "ستظهر المهام هنا عند إنشائها من قِبل العميل أو الفريق"
                : "Tasks appear here when created by the agent or care team"}
            </Caption>
          </View>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isRTL={isRTL}
              theme={theme}
              onComplete={() => completeTask(task.id, user?.id ?? "")}
              onPress={() => {
                // Detail view — future Sprint
              }}
            />
          ))
        )}
      </ScrollView>
    </WavyBackground>
  );
}
