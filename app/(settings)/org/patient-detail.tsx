/**
 * Patient Detail Screen (Provider / Coordinator View)
 *
 * Clinical overview of a single enrolled patient — risk summary, recent
 * anomalies, active medications, open tasks, and quick task creation.
 *
 * Route: /(settings)/org/patient-detail?orgId=<orgId>&userId=<userId>&patientName=<name>
 */

import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { useLocalSearchParams, useNavigation } from "expo-router";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  Clock,
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
import { db } from "@/lib/firebase";
import {
  populationHealthService,
  type PatientHealthSnapshot,
} from "@/lib/services/populationHealthService";
import { taskService } from "@/lib/services/taskService";
import type { Task, TaskPriority, TaskType } from "@/types";
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

const TASK_PRIORITIES: Array<{ key: TaskPriority; label: string; color: string }> = [
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

  const handleClose = () => { reset(); onClose(); };

  const handleCreate = async () => {
    const taskTitle = title.trim() || (TASK_TYPES.find((t) => t.key === type)?.label ?? type);
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
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to create task.");
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
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={{ flex: 1, backgroundColor: theme.colors.background.primary, padding: 24, paddingTop: 48 }}>
        <TypographyText style={getTextStyle(theme, "heading", "bold", theme.colors.text.primary)}>
          Create Task
        </TypographyText>
        <Caption style={{ color: theme.colors.text.secondary, marginTop: 4, marginBottom: 20 }}>
          Assigned to care coordinator queue.
        </Caption>

        {/* Task type */}
        <Caption style={{ color: theme.colors.text.secondary, marginBottom: 8 }}>TYPE</Caption>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {TASK_TYPES.map((t) => (
              <TouchableOpacity
                key={t.key}
                onPress={() => setType(t.key)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 20,
                  backgroundColor: type === t.key ? "#6366F1" : theme.colors.background.secondary,
                }}
              >
                <Caption style={{ color: type === t.key ? "#FFF" : theme.colors.text.secondary, fontWeight: type === t.key ? "600" : "400" }}>
                  {t.label}
                </Caption>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Priority */}
        <Caption style={{ color: theme.colors.text.secondary, marginBottom: 8 }}>PRIORITY</Caption>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
          {TASK_PRIORITIES.map((p) => (
            <TouchableOpacity
              key={p.key}
              onPress={() => setPriority(p.key)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 20,
                backgroundColor: priority === p.key ? p.color + "20" : theme.colors.background.secondary,
                borderWidth: priority === p.key ? 1.5 : 0,
                borderColor: p.color,
              }}
            >
              <Caption style={{ color: priority === p.key ? p.color : theme.colors.text.secondary, fontWeight: priority === p.key ? "600" : "400" }}>
                {p.label}
              </Caption>
            </TouchableOpacity>
          ))}
        </View>

        {/* Title */}
        <Caption style={{ color: theme.colors.text.secondary, marginBottom: 6 }}>TITLE</Caption>
        <TextInput
          style={inputStyle}
          placeholder={TASK_TYPES.find((t) => t.key === type)?.label ?? "Task title"}
          placeholderTextColor={theme.colors.text.secondary}
          value={title}
          onChangeText={setTitle}
        />

        {/* Description */}
        <Caption style={{ color: theme.colors.text.secondary, marginBottom: 6 }}>NOTES (optional)</Caption>
        <TextInput
          style={[inputStyle, { height: 80, textAlignVertical: "top" }]}
          placeholder="Additional context for the coordinator..."
          placeholderTextColor={theme.colors.text.secondary}
          value={description}
          onChangeText={setDescription}
          multiline
        />

        <TouchableOpacity
          onPress={handleCreate}
          disabled={saving}
          style={{ backgroundColor: "#6366F1", borderRadius: 12, padding: 16, alignItems: "center", marginTop: 8, opacity: saving ? 0.6 : 1 }}
        >
          {saving ? <ActivityIndicator color="#FFF" /> : (
            <TypographyText style={{ color: "#FFF", fontWeight: "600", fontSize: 16 }}>Create Task</TypographyText>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={handleClose} style={{ alignItems: "center", padding: 14 }}>
          <Caption style={{ color: theme.colors.text.secondary }}>Cancel</Caption>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ label, theme }: { label: string; theme: ReturnType<typeof useTheme>["theme"] }) {
  return (
    <TypographyText
      style={[
        getTextStyle(theme, "caption", "semibold", theme.colors.text.secondary),
        { textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8, marginTop: 20 },
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
  const params = useLocalSearchParams<{ orgId: string; userId: string; patientName?: string }>();
  const orgId = params.orgId ?? "";
  const userId = params.userId ?? "";
  const patientName = params.patientName ?? userId.slice(0, 8).toUpperCase();
  const isRTL = i18n.language === "ar";

  const [snapshot, setSnapshot] = useState<PatientHealthSnapshot | null>(null);
  const [anomalies, setAnomalies] = useState<AnomalyRow[]>([]);
  const [medications, setMedications] = useState<MedRow[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const isMountedRef = useRef(true);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const load = useCallback(async (isRefresh = false) => {
    if (!userId || !orgId) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);

    try {
      const [snap, anomalySnap, medSnap, taskList] = await Promise.allSettled([
        populationHealthService.getPatientSnapshot(userId),

        // Recent anomalies (7 days)
        getDocs(query(
          collection(db, "users", userId, "anomalies"),
          where("timestamp", ">=", Timestamp.fromDate(sevenDaysAgo)),
          orderBy("timestamp", "desc"),
          limit(20)
        )),

        // Active medications
        getDocs(query(
          collection(db, "medications"),
          where("userId", "==", userId),
          where("isActive", "==", true),
          limit(20)
        )),

        // Open/in-progress tasks for this patient
        taskService.listOrgTasks(orgId, { patientId: userId, status: "open", maxResults: 20 }),
      ]);

      if (!isMountedRef.current) return;

      if (snap.status === "fulfilled") setSnapshot(snap.value);

      if (anomalySnap.status === "fulfilled") {
        setAnomalies(
          anomalySnap.value.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              vitalType: data.vitalType as string ?? "vital",
              severity: data.severity as "critical" | "warning",
              message: data.message as string ?? "",
              timestamp: toDate(data.timestamp),
            };
          })
        );
      }

      if (medSnap.status === "fulfilled") {
        setMedications(
          medSnap.value.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              name: data.name as string ?? "Unknown",
              dosage: data.dosage as string | undefined,
              frequency: data.frequency as string | undefined,
            };
          })
        );
      }

      if (taskList.status === "fulfilled") setTasks(taskList.value);
    } catch {
      // partial failures handled by Promise.allSettled above
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [userId, orgId]);

  useEffect(() => { load(false); }, [load]);

  const handleCompleteTask = useCallback(async (task: Task) => {
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
  }, [user?.id]);

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
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ChevronLeft size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <TypographyText style={getTextStyle(theme, "heading", "bold", theme.colors.text.primary)}>
            {patientName}
          </TypographyText>
          <Caption style={{ color: theme.colors.text.secondary }}>Patient Overview</Caption>
        </View>
        <TouchableOpacity onPress={() => load(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <RefreshCw size={18} color={theme.colors.text.secondary} style={refreshing ? { opacity: 0.4 } : undefined} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        {loading ? (
          <ActivityIndicator color={theme.colors.text.primary} style={{ marginTop: 48 }} />
        ) : (
          <>
            {/* Risk Summary Card */}
            {snapshot && (
              <View style={{ backgroundColor: riskBg, borderRadius: 16, padding: 18, marginBottom: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <TypographyText style={{ color: riskColor, fontSize: 32, fontWeight: "800" }}>
                    {snapshot.riskScore}
                  </TypographyText>
                  <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: riskColor + "20", borderWidth: 1.5, borderColor: riskColor }}>
                    <Caption style={{ color: riskColor, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>
                      {snapshot.riskLevel}
                    </Caption>
                  </View>
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <AlertTriangle size={14} color={riskColor} />
                    <Caption style={{ color: riskColor }}>
                      {snapshot.recentAnomalies.total} anomal{snapshot.recentAnomalies.total !== 1 ? "ies" : "y"}
                    </Caption>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Pill size={14} color={snapshot.missedMedicationsToday > 0 ? "#F97316" : "#10B981"} />
                    <Caption style={{ color: snapshot.missedMedicationsToday > 0 ? "#F97316" : "#10B981" }}>
                      {snapshot.missedMedicationsToday > 0
                        ? `${snapshot.missedMedicationsToday} missed today`
                        : "Meds on track"}
                    </Caption>
                  </View>
                  {snapshot.lastVitalSyncAt && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Clock size={14} color={theme.colors.text.secondary} />
                      <Caption style={{ color: theme.colors.text.secondary }}>
                        Synced {relativeTime(snapshot.lastVitalSyncAt)}
                      </Caption>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Tasks */}
            <SectionHeader label={`Open Tasks (${tasks.length})`} theme={theme} />
            {tasks.length === 0 ? (
              <View style={{ backgroundColor: theme.colors.background.secondary, borderRadius: 10, padding: 14, alignItems: "center" }}>
                <CheckCircle2 size={22} color={theme.colors.text.secondary} />
                <Caption style={{ color: theme.colors.text.secondary, marginTop: 6 }}>No open tasks</Caption>
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
                      <TypographyText style={{ color: theme.colors.text.primary, fontSize: 14, fontWeight: "600" }}>
                        {task.title}
                      </TypographyText>
                      <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                        <Caption style={{ color: pc?.color ?? theme.colors.text.secondary }}>{task.priority}</Caption>
                        {task.source === "agent" && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                            <Zap size={10} color="#6366F1" />
                            <Caption style={{ color: "#6366F1" }}>AI</Caption>
                          </View>
                        )}
                        <Caption style={{ color: theme.colors.text.secondary }}>{relativeTime(task.createdAt)}</Caption>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleCompleteTask(task)}
                      style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: "#ECFDF5" }}
                    >
                      <Caption style={{ color: "#059669", fontWeight: "600" }}>Done</Caption>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}

            {/* Recent Anomalies */}
            <SectionHeader label={`Recent Anomalies (7d)`} theme={theme} />
            {anomalies.length === 0 ? (
              <View style={{ backgroundColor: theme.colors.background.secondary, borderRadius: 10, padding: 14, alignItems: "center" }}>
                <Activity size={22} color={theme.colors.text.secondary} />
                <Caption style={{ color: theme.colors.text.secondary, marginTop: 6 }}>No anomalies detected</Caption>
              </View>
            ) : (
              anomalies.slice(0, 10).map((a) => (
                <View
                  key={a.id}
                  style={{
                    backgroundColor: a.severity === "critical" ? "#FEF2F2" : "#FFFBEB",
                    borderRadius: 10,
                    padding: 12,
                    marginBottom: 8,
                    borderLeftWidth: 3,
                    borderLeftColor: a.severity === "critical" ? "#EF4444" : "#F59E0B",
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Caption style={{ color: a.severity === "critical" ? "#EF4444" : "#D97706", fontWeight: "700", textTransform: "uppercase" }}>
                      {a.vitalType.replace(/_/g, " ")}
                    </Caption>
                    <Caption style={{ color: theme.colors.text.secondary }}>{relativeTime(a.timestamp)}</Caption>
                  </View>
                  {a.message ? (
                    <Caption style={{ color: theme.colors.text.primary, marginTop: 3 }}>{a.message}</Caption>
                  ) : null}
                </View>
              ))
            )}

            {/* Active Medications */}
            <SectionHeader label={`Active Medications (${medications.length})`} theme={theme} />
            {medications.length === 0 ? (
              <View style={{ backgroundColor: theme.colors.background.secondary, borderRadius: 10, padding: 14, alignItems: "center" }}>
                <Pill size={22} color={theme.colors.text.secondary} />
                <Caption style={{ color: theme.colors.text.secondary, marginTop: 6 }}>No active medications</Caption>
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
                  <Pill size={16} color="#6366F1" />
                  <View style={{ flex: 1 }}>
                    <TypographyText style={{ color: theme.colors.text.primary, fontSize: 14, fontWeight: "600" }}>
                      {med.name}
                    </TypographyText>
                    {(med.dosage || med.frequency) ? (
                      <Caption style={{ color: theme.colors.text.secondary }}>
                        {[med.dosage, med.frequency].filter(Boolean).join(" · ")}
                      </Caption>
                    ) : null}
                  </View>
                </View>
              ))
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
          <Plus size={18} color="#FFF" />
          <TypographyText style={{ color: "#FFF", fontWeight: "600", fontSize: 15 }}>
            Create Task
          </TypographyText>
        </TouchableOpacity>
      )}

      <CreateTaskModal
        visible={showCreateTask}
        orgId={orgId}
        patientId={userId}
        createdBy={user?.id ?? ""}
        theme={theme}
        onClose={() => setShowCreateTask(false)}
        onCreated={(t) => setTasks((prev) => [t, ...prev])}
      />
    </WavyBackground>
  );
}
