/**
 * Patient Detail Screen (Provider / Coordinator View)
 *
 * Clinical overview of a single enrolled patient — risk summary, recent
 * anomalies, active medications, open tasks, and quick task creation.
 *
 * Route: /(settings)/org/patient-detail?orgId=<orgId>&userId=<userId>&patientName=<name>
 */

import { useLocalSearchParams, useNavigation } from "expo-router";
import { api } from "@/lib/apiClient";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronLeft,
  Clock,
  GitBranch,
  Pill,
  Plus,
  RefreshCw,
  Zap,
} from "lucide-react-native";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  TextInput,
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
import { carePathwayService } from "@/lib/services/carePathwayService";
import {
  type PatientHealthSnapshot,
  populationHealthService,
} from "@/lib/services/populationHealthService";
import { taskService } from "@/lib/services/taskService";
import type { PathwayDefinition, Task, TaskPriority, TaskType } from "@/types";
import { getTextStyle } from "@/utils/styles";

// ─── Types ────────────────────────────────────────────────────────────────────

type AnomalyRow = {
  id: string;
  vitalType: string;
  severity: "critical" | "warning";
  message: string;
  timestamp: Date;
};

type MedRow = {
  id: string;
  name: string;
  dosage?: string;
  frequency?: string;
};

type AgentActionEntry = {
  type: string;
  timestamp: Date;
  reasoning: string;
  outcome: string;
  taskId?: string;
};

type AgentState = {
  lastCycleAt: Date | null;
  nextCycleAt: Date | null;
  openActionsCount: number;
  agentNotes: string;
  actionHistory: AgentActionEntry[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const RISK_COLORS = {
  critical: "#EF4444",
  high: "#F97316",
  elevated: "#F59E0B",
  normal: "#10B981",
};

const RISK_BG = {
  critical: "#FEF2F2",
  high: "#FFF7ED",
  elevated: "#FFFBEB",
  normal: "#ECFDF5",
};

const TASK_TYPES: Array<{ key: TaskType; label: string }> = [
  { key: "follow_up", label: "Follow Up" },
  { key: "medication_review", label: "Med Review" },
  { key: "vital_check", label: "Vital Check" },
  { key: "call_patient", label: "Call Patient" },
  { key: "care_plan_update", label: "Care Plan Update" },
];

const TASK_PRIORITIES: Array<{
  key: TaskPriority;
  label: string;
  color: string;
}> = [
  { key: "urgent", label: "Urgent", color: "#EF4444" },
  { key: "high", label: "High", color: "#F97316" },
  { key: "normal", label: "Normal", color: "#6366F1" },
  { key: "low", label: "Low", color: "#64748B" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDate(v: unknown): Date {
  if (v instanceof Date) return v;
  if (v && typeof (v as { toDate?: () => Date }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate();
  }
  return new Date();
}

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// ─── Create Task Modal ─────────────────────────────────────────────────────────

function CreateTaskModal({
  visible,
  orgId,
  patientId,
  createdBy,
  theme,
  onClose,
  onCreated,
}: {
  visible: boolean;
  orgId: string;
  patientId: string;
  createdBy: string;
  theme: ReturnType<typeof useTheme>["theme"];
  onClose: () => void;
  onCreated: (task: Task) => void;
}) {
  const [type, setType] = useState<TaskType>("follow_up");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setType("follow_up");
    setPriority("normal");
    setTitle("");
    setDescription("");
    setSaving(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleCreate = async () => {
    const taskTitle =
      title.trim() || (TASK_TYPES.find((t) => t.key === type)?.label ?? type);
    setSaving(true);
    try {
      const task = await taskService.createTask({
        orgId,
        patientId,
        assignedBy: createdBy,
        type,
        priority,
        title: taskTitle,
        description: description.trim() || undefined,
        source: "manual",
      });
      onCreated(task);
      handleClose();
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to create task."
      );
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    backgroundColor: theme.colors.background.primary,
    borderRadius: 10,
    padding: 12,
    color: theme.colors.text.primary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: theme.colors.background.secondary,
    marginBottom: 12,
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={handleClose}
      presentationStyle="pageSheet"
      visible={visible}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.background.primary,
          padding: 24,
          paddingTop: 48,
        }}
      >
        <TypographyText
          style={getTextStyle(
            theme,
            "heading",
            "bold",
            theme.colors.text.primary
          )}
        >
          Create Task
        </TypographyText>
        <Caption
          style={{
            color: theme.colors.text.secondary,
            marginTop: 4,
            marginBottom: 20,
          }}
        >
          Assigned to care coordinator queue.
        </Caption>

        {/* Task type */}
        <Caption
          style={{ color: theme.colors.text.secondary, marginBottom: 8 }}
        >
          TYPE
        </Caption>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 16 }}
        >
          <View style={{ flexDirection: "row", gap: 8 }}>
            {TASK_TYPES.map((t) => (
              <TouchableOpacity
                key={t.key}
                onPress={() => setType(t.key)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 20,
                  backgroundColor:
                    type === t.key
                      ? "#6366F1"
                      : theme.colors.background.secondary,
                }}
              >
                <Caption
                  style={{
                    color:
                      type === t.key ? "#FFF" : theme.colors.text.secondary,
                    fontWeight: type === t.key ? "600" : "400",
                  }}
                >
                  {t.label}
                </Caption>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Priority */}
        <Caption
          style={{ color: theme.colors.text.secondary, marginBottom: 8 }}
        >
          PRIORITY
        </Caption>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
          {TASK_PRIORITIES.map((p) => (
            <TouchableOpacity
              key={p.key}
              onPress={() => setPriority(p.key)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 20,
                backgroundColor:
                  priority === p.key
                    ? p.color + "20"
                    : theme.colors.background.secondary,
                borderWidth: priority === p.key ? 1.5 : 0,
                borderColor: p.color,
              }}
            >
              <Caption
                style={{
                  color:
                    priority === p.key ? p.color : theme.colors.text.secondary,
                  fontWeight: priority === p.key ? "600" : "400",
                }}
              >
                {p.label}
              </Caption>
            </TouchableOpacity>
          ))}
        </View>

        {/* Title */}
        <Caption
          style={{ color: theme.colors.text.secondary, marginBottom: 6 }}
        >
          TITLE
        </Caption>
        <TextInput
          onChangeText={setTitle}
          placeholder={
            TASK_TYPES.find((t) => t.key === type)?.label ?? "Task title"
          }
          placeholderTextColor={theme.colors.text.secondary}
          style={inputStyle}
          value={title}
        />

        {/* Description */}
        <Caption
          style={{ color: theme.colors.text.secondary, marginBottom: 6 }}
        >
          NOTES (optional)
        </Caption>
        <TextInput
          multiline
          onChangeText={setDescription}
          placeholder="Additional context for the coordinator..."
          placeholderTextColor={theme.colors.text.secondary}
          style={[inputStyle, { height: 80, textAlignVertical: "top" }]}
          value={description}
        />

        <TouchableOpacity
          disabled={saving}
          onPress={handleCreate}
          style={{
            backgroundColor: "#6366F1",
            borderRadius: 12,
            padding: 16,
            alignItems: "center",
            marginTop: 8,
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <TypographyText
              style={{ color: "#FFF", fontWeight: "600", fontSize: 16 }}
            >
              Create Task
            </TypographyText>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleClose}
          style={{ alignItems: "center", padding: 14 }}
        >
          <Caption style={{ color: theme.colors.text.secondary }}>
            Cancel
          </Caption>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({
  label,
  theme,
}: {
  label: string;
  theme: ReturnType<typeof useTheme>["theme"];
}) {
  return (
    <TypographyText
      style={[
        getTextStyle(theme, "caption", "semibold", theme.colors.text.secondary),
        {
          textTransform: "uppercase",
          letterSpacing: 0.8,
          marginBottom: 8,
          marginTop: 20,
        },
      ]}
    >
      {label}
    </TypographyText>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PatientDetailScreen() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{
    orgId: string;
    userId: string;
    patientName?: string;
  }>();
  const orgId = params.orgId ?? "";
  const userId = params.userId ?? "";
  const patientName = params.patientName ?? userId.slice(0, 8).toUpperCase();
  const isRTL = i18n.language === "ar";

  const [snapshot, setSnapshot] = useState<PatientHealthSnapshot | null>(null);
  const [anomalies, setAnomalies] = useState<AnomalyRow[]>([]);
  const [medications, setMedications] = useState<MedRow[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [pathways, setPathways] = useState<PathwayDefinition[]>([]);
  const [agentState, setAgentState] = useState<AgentState | null>(null);
  const [enrollingPathwayId, setEnrollingPathwayId] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const isMountedRef = useRef(true);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!(userId && orgId)) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const results = await Promise.allSettled([
          populationHealthService.getPatientSnapshot(userId),
          api
            .get<Record<string, unknown>[]>(
              `/api/health/anomalies?userId=${userId}&limit=50`
            )
            .catch(() => []),
          api
            .get<Record<string, unknown>[]>(
              `/api/health/medications?userId=${userId}&limit=100`
            )
            .catch(() => []),
          taskService.listOrgTasks(orgId, {
            patientId: userId,
            status: "open",
            maxResults: 20,
          }),
          carePathwayService.listPathways(orgId),
          api
            .get<Record<string, unknown>>(
              `/api/org/patient-agent-state/${orgId}/${userId}`
            )
            .catch(() => null),
        ] as const);

        if (!isMountedRef.current) return;

        const [snap, anomalyRes, medRes, taskList, pathwayList, agentRes] =
          results;

        if (snap.status === "fulfilled") setSnapshot(snap.value);

        if (anomalyRes.status === "fulfilled") {
          setAnomalies(
            (anomalyRes.value ?? []).map((d) => ({
              id: (d.id as string) ?? "",
              vitalType: (d.vitalType as string) ?? "vital",
              severity: d.severity as "critical" | "warning",
              message: (d.message as string) ?? "",
              timestamp: toDate(d.timestamp),
            }))
          );
        }

        if (medRes.status === "fulfilled") {
          setMedications(
            (medRes.value ?? []).map((d) => ({
              id: (d.id as string) ?? "",
              name: (d.name as string) ?? "Unknown",
              dosage: d.dosage as string | undefined,
              frequency: d.frequency as string | undefined,
            }))
          );
        }

        if (taskList.status === "fulfilled") setTasks(taskList.value);
        if (pathwayList.status === "fulfilled") {
          setPathways(pathwayList.value.filter((p) => p.isActive));
        }
        if (agentRes.status === "fulfilled" && agentRes.value != null) {
          const d = agentRes.value;
          const rawHistory = (d.actionHistory as unknown[]) ?? [];
          setAgentState({
            lastCycleAt: d.lastCycleAt ? toDate(d.lastCycleAt) : null,
            nextCycleAt: d.nextCycleAt ? toDate(d.nextCycleAt) : null,
            openActionsCount: (d.openActionsCount as number) ?? 0,
            agentNotes: (d.agentNotes as string) ?? "",
            actionHistory: rawHistory
              .slice(-5) // show last 5 actions
              .reverse()
              .map((entry) => {
                const e = entry as Record<string, unknown>;
                return {
                  type: (e.type as string) ?? "unknown",
                  timestamp: toDate(e.timestamp),
                  reasoning: (e.reasoning as string) ?? "",
                  outcome: (e.outcome as string) ?? "success",
                  taskId: e.taskId as string | undefined,
                };
              }),
          });
        }
      } catch {
        // partial failures handled by Promise.allSettled above
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [userId, orgId]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const handleCompleteTask = useCallback(
    async (task: Task) => {
      if (!user?.id) return;
      Alert.alert("Complete Task", `Mark "${task.title}" as done?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Complete",
          onPress: async () => {
            try {
              await taskService.updateStatus(task.id, "completed", user.id);
              setTasks((prev) => prev.filter((t) => t.id !== task.id));
            } catch {
              Alert.alert("Error", "Failed to complete task.");
            }
          },
        },
      ]);
    },
    [user?.id]
  );

  const handleEnrollPathway = useCallback(
    async (pathway: PathwayDefinition) => {
      if (!user?.id) return;
      Alert.alert(
        "Enroll in Pathway",
        `Enroll ${patientName} in "${pathway.name}"? The first step will begin immediately.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Enroll",
            onPress: async () => {
              setEnrollingPathwayId(pathway.id);
              try {
                await carePathwayService.enrollPatient({
                  orgId,
                  patientId: userId,
                  pathwayId: pathway.id,
                  pathway,
                });
                Alert.alert(
                  "Enrolled",
                  `${patientName} is now on the "${pathway.name}" pathway.`
                );
              } catch (err) {
                Alert.alert(
                  "Error",
                  err instanceof Error ? err.message : "Failed to enroll."
                );
              } finally {
                setEnrollingPathwayId(null);
              }
            },
          },
        ]
      );
    },
    [orgId, userId, patientName, user?.id]
  );

  const riskColor = snapshot ? RISK_COLORS[snapshot.riskLevel] : "#6B7280";
  const riskBg = snapshot ? RISK_BG[snapshot.riskLevel] : "#F9FAFB";

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <WavyBackground>
      {/* Header */}
      <View
        style={{
          flexDirection: isRTL ? "row-reverse" : "row",
          alignItems: "center",
          paddingTop: 56,
          paddingHorizontal: 20,
          paddingBottom: 12,
          gap: 12,
        }}
      >
        <TouchableOpacity
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={() => navigation.goBack()}
        >
          <ChevronLeft color={theme.colors.text.primary} size={24} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <TypographyText
            style={getTextStyle(
              theme,
              "heading",
              "bold",
              theme.colors.text.primary
            )}
          >
            {patientName}
          </TypographyText>
          <Caption style={{ color: theme.colors.text.secondary }}>
            Patient Overview
          </Caption>
        </View>
        <TouchableOpacity
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={() => load(true)}
        >
          <RefreshCw
            color={theme.colors.text.secondary}
            size={18}
            style={refreshing ? { opacity: 0.4 } : undefined}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 80 }}
        refreshControl={
          <RefreshControl
            onRefresh={() => load(true)}
            refreshing={refreshing}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator
            color={theme.colors.text.primary}
            style={{ marginTop: 48 }}
          />
        ) : (
          <>
            {/* Risk Summary Card */}
            {snapshot && (
              <View
                style={{
                  backgroundColor: riskBg,
                  borderRadius: 16,
                  padding: 18,
                  marginBottom: 4,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 12,
                  }}
                >
                  <TypographyText
                    style={{
                      color: riskColor,
                      fontSize: 32,
                      fontWeight: "800",
                    }}
                  >
                    {snapshot.riskScore}
                  </TypographyText>
                  <View
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 20,
                      backgroundColor: riskColor + "20",
                      borderWidth: 1.5,
                      borderColor: riskColor,
                    }}
                  >
                    <Caption
                      style={{
                        color: riskColor,
                        fontWeight: "700",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      {snapshot.riskLevel}
                    </Caption>
                  </View>
                </View>
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <AlertTriangle color={riskColor} size={14} />
                    <Caption style={{ color: riskColor }}>
                      {snapshot.recentAnomalies.total} anomal
                      {snapshot.recentAnomalies.total !== 1 ? "ies" : "y"}
                    </Caption>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Pill
                      color={
                        snapshot.missedMedicationsToday > 0
                          ? "#F97316"
                          : "#10B981"
                      }
                      size={14}
                    />
                    <Caption
                      style={{
                        color:
                          snapshot.missedMedicationsToday > 0
                            ? "#F97316"
                            : "#10B981",
                      }}
                    >
                      {snapshot.missedMedicationsToday > 0
                        ? `${snapshot.missedMedicationsToday} missed today`
                        : "Meds on track"}
                    </Caption>
                  </View>
                  {snapshot.lastVitalSyncAt && (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Clock color={theme.colors.text.secondary} size={14} />
                      <Caption style={{ color: theme.colors.text.secondary }}>
                        Synced {relativeTime(snapshot.lastVitalSyncAt)}
                      </Caption>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Tasks */}
            <SectionHeader
              label={`Open Tasks (${tasks.length})`}
              theme={theme}
            />
            {tasks.length === 0 ? (
              <View
                style={{
                  backgroundColor: theme.colors.background.secondary,
                  borderRadius: 10,
                  padding: 14,
                  alignItems: "center",
                }}
              >
                <CheckCircle2 color={theme.colors.text.secondary} size={22} />
                <Caption
                  style={{ color: theme.colors.text.secondary, marginTop: 6 }}
                >
                  No open tasks
                </Caption>
              </View>
            ) : (
              tasks.map((task) => {
                const pc = TASK_PRIORITIES.find((p) => p.key === task.priority);
                return (
                  <View
                    key={task.id}
                    style={{
                      backgroundColor: theme.colors.background.secondary,
                      borderRadius: 10,
                      padding: 12,
                      marginBottom: 8,
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: 10,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <TypographyText
                        style={{
                          color: theme.colors.text.primary,
                          fontSize: 14,
                          fontWeight: "600",
                        }}
                      >
                        {task.title}
                      </TypographyText>
                      <View
                        style={{ flexDirection: "row", gap: 8, marginTop: 4 }}
                      >
                        <Caption
                          style={{
                            color: pc?.color ?? theme.colors.text.secondary,
                          }}
                        >
                          {task.priority}
                        </Caption>
                        {task.source === "agent" && (
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 3,
                            }}
                          >
                            <Zap color="#6366F1" size={10} />
                            <Caption style={{ color: "#6366F1" }}>AI</Caption>
                          </View>
                        )}
                        <Caption style={{ color: theme.colors.text.secondary }}>
                          {relativeTime(task.createdAt)}
                        </Caption>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleCompleteTask(task)}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 8,
                        backgroundColor: "#ECFDF5",
                      }}
                    >
                      <Caption style={{ color: "#059669", fontWeight: "600" }}>
                        Done
                      </Caption>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}

            {/* Recent Anomalies */}
            <SectionHeader label={"Recent Anomalies (7d)"} theme={theme} />
            {anomalies.length === 0 ? (
              <View
                style={{
                  backgroundColor: theme.colors.background.secondary,
                  borderRadius: 10,
                  padding: 14,
                  alignItems: "center",
                }}
              >
                <Activity color={theme.colors.text.secondary} size={22} />
                <Caption
                  style={{ color: theme.colors.text.secondary, marginTop: 6 }}
                >
                  No anomalies detected
                </Caption>
              </View>
            ) : (
              anomalies.slice(0, 10).map((a) => (
                <View
                  key={a.id}
                  style={{
                    backgroundColor:
                      a.severity === "critical" ? "#FEF2F2" : "#FFFBEB",
                    borderRadius: 10,
                    padding: 12,
                    marginBottom: 8,
                    borderLeftWidth: 3,
                    borderLeftColor:
                      a.severity === "critical" ? "#EF4444" : "#F59E0B",
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Caption
                      style={{
                        color:
                          a.severity === "critical" ? "#EF4444" : "#D97706",
                        fontWeight: "700",
                        textTransform: "uppercase",
                      }}
                    >
                      {a.vitalType.replace(/_/g, " ")}
                    </Caption>
                    <Caption style={{ color: theme.colors.text.secondary }}>
                      {relativeTime(a.timestamp)}
                    </Caption>
                  </View>
                  {a.message ? (
                    <Caption
                      style={{ color: theme.colors.text.primary, marginTop: 3 }}
                    >
                      {a.message}
                    </Caption>
                  ) : null}
                </View>
              ))
            )}

            {/* Active Medications */}
            <SectionHeader
              label={`Active Medications (${medications.length})`}
              theme={theme}
            />
            {medications.length === 0 ? (
              <View
                style={{
                  backgroundColor: theme.colors.background.secondary,
                  borderRadius: 10,
                  padding: 14,
                  alignItems: "center",
                }}
              >
                <Pill color={theme.colors.text.secondary} size={22} />
                <Caption
                  style={{ color: theme.colors.text.secondary, marginTop: 6 }}
                >
                  No active medications
                </Caption>
              </View>
            ) : (
              medications.map((med) => (
                <View
                  key={med.id}
                  style={{
                    backgroundColor: theme.colors.background.secondary,
                    borderRadius: 10,
                    padding: 12,
                    marginBottom: 8,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <Pill color="#6366F1" size={16} />
                  <View style={{ flex: 1 }}>
                    <TypographyText
                      style={{
                        color: theme.colors.text.primary,
                        fontSize: 14,
                        fontWeight: "600",
                      }}
                    >
                      {med.name}
                    </TypographyText>
                    {med.dosage || med.frequency ? (
                      <Caption style={{ color: theme.colors.text.secondary }}>
                        {[med.dosage, med.frequency]
                          .filter(Boolean)
                          .join(" · ")}
                      </Caption>
                    ) : null}
                  </View>
                </View>
              ))
            )}

            {/* AI Agent Activity */}
            {agentState && (
              <>
                <SectionHeader label="AI Agent Activity" theme={theme} />
                {/* Last cycle summary */}
                <View
                  style={{
                    backgroundColor: "#F5F3FF",
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 8,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <Bot color="#6366F1" size={16} />
                    <TypographyText
                      style={{
                        color: "#4F46E5",
                        fontSize: 13,
                        fontWeight: "700",
                      }}
                    >
                      Autonomous Monitor
                    </TypographyText>
                    <View style={{ flex: 1 }} />
                    <View
                      style={{
                        backgroundColor: "#E0E7FF",
                        borderRadius: 8,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                      }}
                    >
                      <Caption style={{ color: "#4F46E5", fontWeight: "600" }}>
                        {agentState.openActionsCount} open
                      </Caption>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", gap: 16 }}>
                    {agentState.lastCycleAt && (
                      <View>
                        <Caption style={{ color: "#6B7280" }}>
                          Last cycle
                        </Caption>
                        <Caption
                          style={{ color: "#374151", fontWeight: "600" }}
                        >
                          {relativeTime(agentState.lastCycleAt)}
                        </Caption>
                      </View>
                    )}
                    {agentState.nextCycleAt && (
                      <View>
                        <Caption style={{ color: "#6B7280" }}>
                          Next cycle
                        </Caption>
                        <Caption
                          style={{ color: "#374151", fontWeight: "600" }}
                        >
                          {relativeTime(agentState.nextCycleAt)}
                        </Caption>
                      </View>
                    )}
                  </View>
                </View>

                {/* Action history */}
                {agentState.actionHistory.map((entry, i) => {
                  const actionColors: Record<string, string> = {
                    escalation_triggered: "#EF4444",
                    task_created: "#F97316",
                    patient_nudge: "#6366F1",
                    no_action: "#10B981",
                  };
                  const actionLabels: Record<string, string> = {
                    escalation_triggered: "Escalated",
                    task_created: "Task Created",
                    patient_nudge: "Nudged Patient",
                    no_action: "No Action",
                  };
                  const color = actionColors[entry.type] ?? "#6B7280";
                  const label =
                    actionLabels[entry.type] ?? entry.type.replace(/_/g, " ");

                  return (
                    <View
                      key={i}
                      style={{
                        backgroundColor: theme.colors.background.secondary,
                        borderRadius: 10,
                        padding: 11,
                        marginBottom: 6,
                        borderLeftWidth: 3,
                        borderLeftColor: color,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <Caption
                          style={{
                            color,
                            fontWeight: "700",
                            textTransform: "uppercase",
                            letterSpacing: 0.3,
                          }}
                        >
                          {label}
                        </Caption>
                        <Caption style={{ color: theme.colors.text.secondary }}>
                          {relativeTime(entry.timestamp)}
                        </Caption>
                      </View>
                      {entry.reasoning ? (
                        <Caption
                          style={{
                            color: theme.colors.text.secondary,
                            marginTop: 3,
                          }}
                        >
                          {entry.reasoning}
                        </Caption>
                      ) : null}
                    </View>
                  );
                })}
              </>
            )}

            {/* Care Pathways */}
            {pathways.length > 0 && (
              <>
                <SectionHeader label="Enroll in Care Pathway" theme={theme} />
                {pathways.map((p) => (
                  <View
                    key={p.id}
                    style={{
                      backgroundColor: theme.colors.background.secondary,
                      borderRadius: 10,
                      padding: 12,
                      marginBottom: 8,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <GitBranch color="#6366F1" size={16} />
                    <View style={{ flex: 1 }}>
                      <TypographyText
                        style={{
                          color: theme.colors.text.primary,
                          fontSize: 14,
                          fontWeight: "600",
                        }}
                      >
                        {p.name}
                      </TypographyText>
                      <Caption style={{ color: theme.colors.text.secondary }}>
                        {p.steps.length} steps · {p.triggerCondition}
                      </Caption>
                    </View>
                    <TouchableOpacity
                      disabled={enrollingPathwayId === p.id}
                      onPress={() => handleEnrollPathway(p)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 8,
                        backgroundColor: "#EEF2FF",
                        opacity: enrollingPathwayId === p.id ? 0.5 : 1,
                      }}
                    >
                      {enrollingPathwayId === p.id ? (
                        <ActivityIndicator color="#6366F1" size="small" />
                      ) : (
                        <Caption
                          style={{ color: "#6366F1", fontWeight: "600" }}
                        >
                          Enroll
                        </Caption>
                      )}
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* FAB — Create Task */}
      {!loading && (
        <TouchableOpacity
          onPress={() => setShowCreateTask(true)}
          style={{
            position: "absolute",
            right: 24,
            bottom: 32,
            backgroundColor: "#6366F1",
            borderRadius: 28,
            paddingHorizontal: 20,
            paddingVertical: 14,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            shadowColor: "#6366F1",
            shadowOpacity: 0.4,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 8,
          }}
        >
          <Plus color="#FFF" size={18} />
          <TypographyText
            style={{ color: "#FFF", fontWeight: "600", fontSize: 15 }}
          >
            Create Task
          </TypographyText>
        </TouchableOpacity>
      )}

      <CreateTaskModal
        createdBy={user?.id ?? ""}
        onClose={() => setShowCreateTask(false)}
        onCreated={(t) => setTasks((prev) => [t, ...prev])}
        orgId={orgId}
        patientId={userId}
        theme={theme}
        visible={showCreateTask}
      />
    </WavyBackground>
  );
}
