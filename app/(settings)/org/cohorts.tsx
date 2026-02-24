/**
 * Cohorts Management Screen
 *
 * Org admins and coordinators can view, create, and edit patient cohorts —
 * logical groupings by condition, program, or risk level used to organize
 * the patient roster and target care pathways.
 *
 * Route: /(settings)/org/cohorts?orgId=<orgId>&orgName=<orgName>
 */

import { router, useLocalSearchParams, useNavigation } from "expo-router";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Users,
  X,
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
import { organizationService } from "@/lib/services/organizationService";
import type { OrgCohort } from "@/types";
import { getTextStyle } from "@/utils/styles";

// ─── Cohort Form Modal ────────────────────────────────────────────────────────

function CohortFormModal({
  visible,
  orgId,
  createdBy,
  editing,
  theme,
  onClose,
  onSaved,
}: {
  visible: boolean;
  orgId: string;
  createdBy: string;
  editing: OrgCohort | null;
  theme: ReturnType<typeof useTheme>["theme"];
  onClose: () => void;
  onSaved: (cohort: OrgCohort) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [condition, setCondition] = useState("");
  const [program, setProgram] = useState("");
  const [saving, setSaving] = useState(false);

  // Populate fields when editing
  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setDescription(editing.description ?? "");
      setCondition(editing.condition ?? "");
      setProgram(editing.program ?? "");
    } else {
      setName("");
      setDescription("");
      setCondition("");
      setProgram("");
    }
  }, [editing, visible]);

  const handleClose = () => {
    setSaving(false);
    onClose();
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert("Required", "Please enter a cohort name.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await organizationService.updateCohort(orgId, editing.id, {
          name: trimmedName,
          description: description.trim() || undefined,
          condition: condition.trim() || undefined,
          program: program.trim() || undefined,
        });
        onSaved({
          ...editing,
          name: trimmedName,
          description: description.trim() || undefined,
          condition: condition.trim() || undefined,
          program: program.trim() || undefined,
        });
      } else {
        const cohort = await organizationService.createCohort(orgId, {
          name: trimmedName,
          description: description.trim() || undefined,
          condition: condition.trim() || undefined,
          program: program.trim() || undefined,
          createdBy,
        });
        onSaved(cohort);
      }
      handleClose();
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to save cohort."
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
        {/* Modal header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 24,
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
            {editing ? "Edit Cohort" : "New Cohort"}
          </TypographyText>
          <TouchableOpacity
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={handleClose}
          >
            <X color={theme.colors.text.secondary} size={22} />
          </TouchableOpacity>
        </View>

        <Caption
          style={{ color: theme.colors.text.secondary, marginBottom: 8 }}
        >
          NAME *
        </Caption>
        <TextInput
          autoFocus={!editing}
          onChangeText={setName}
          placeholder="e.g. Diabetes — High Risk"
          placeholderTextColor={theme.colors.text.secondary}
          style={inputStyle}
          value={name}
        />

        <Caption
          style={{ color: theme.colors.text.secondary, marginBottom: 8 }}
        >
          DESCRIPTION
        </Caption>
        <TextInput
          multiline
          onChangeText={setDescription}
          placeholder="Brief description of this patient group…"
          placeholderTextColor={theme.colors.text.secondary}
          style={[inputStyle, { height: 72, textAlignVertical: "top" }]}
          value={description}
        />

        <Caption
          style={{ color: theme.colors.text.secondary, marginBottom: 8 }}
        >
          CONDITION / DIAGNOSIS
        </Caption>
        <TextInput
          onChangeText={setCondition}
          placeholder="e.g. Type 2 Diabetes, CHF, COPD"
          placeholderTextColor={theme.colors.text.secondary}
          style={inputStyle}
          value={condition}
        />

        <Caption
          style={{ color: theme.colors.text.secondary, marginBottom: 8 }}
        >
          PROGRAM
        </Caption>
        <TextInput
          onChangeText={setProgram}
          placeholder="e.g. Post-discharge, Annual Wellness"
          placeholderTextColor={theme.colors.text.secondary}
          style={inputStyle}
          value={program}
        />

        <TouchableOpacity
          disabled={saving}
          onPress={handleSave}
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
              {editing ? "Save Changes" : "Create Cohort"}
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

// ─── Cohort Card ──────────────────────────────────────────────────────────────

function CohortCard({
  cohort,
  orgId,
  theme,
  onEdit,
}: {
  cohort: OrgCohort;
  orgId: string;
  theme: ReturnType<typeof useTheme>["theme"];
  onEdit: (cohort: OrgCohort) => void;
}) {
  return (
    <TouchableOpacity
      onPress={() =>
        router.push(
          `/(tabs)/org-dashboard?orgId=${encodeURIComponent(orgId)}&cohortId=${encodeURIComponent(cohort.id)}&cohortName=${encodeURIComponent(cohort.name)}` as never
        )
      }
      style={{
        backgroundColor: theme.colors.background.secondary,
        borderRadius: 14,
        padding: 16,
        marginBottom: 10,
      }}
    >
      {/* Top row */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <View style={{ flex: 1, marginRight: 12 }}>
          <TypographyText
            style={{
              color: theme.colors.text.primary,
              fontSize: 15,
              fontWeight: "700",
            }}
          >
            {cohort.name}
          </TypographyText>
          {cohort.description ? (
            <Caption
              numberOfLines={2}
              style={{ color: theme.colors.text.secondary, marginTop: 2 }}
            >
              {cohort.description}
            </Caption>
          ) : null}
        </View>
        <ChevronRight color={theme.colors.text.secondary} size={18} />
      </View>

      {/* Meta chips */}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 6,
          marginBottom: 10,
        }}
      >
        {cohort.condition ? (
          <View
            style={{
              backgroundColor: "#EFF6FF",
              borderRadius: 6,
              paddingHorizontal: 8,
              paddingVertical: 3,
            }}
          >
            <Caption style={{ color: "#2563EB" }}>{cohort.condition}</Caption>
          </View>
        ) : null}
        {cohort.program ? (
          <View
            style={{
              backgroundColor: "#F5F3FF",
              borderRadius: 6,
              paddingHorizontal: 8,
              paddingVertical: 3,
            }}
          >
            <Caption style={{ color: "#7C3AED" }}>{cohort.program}</Caption>
          </View>
        ) : null}
      </View>

      {/* Footer */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Users color={theme.colors.text.secondary} size={13} />
          <Caption style={{ color: theme.colors.text.secondary }}>
            {cohort.patientCount} patient{cohort.patientCount !== 1 ? "s" : ""}
          </Caption>
        </View>
        <TouchableOpacity
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          onPress={() => onEdit(cohort)}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 8,
            backgroundColor: theme.colors.background.primary,
          }}
        >
          <Caption
            style={{ color: theme.colors.text.secondary, fontWeight: "600" }}
          >
            Edit
          </Caption>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CohortsScreen() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ orgId: string; orgName?: string }>();
  const orgId = params.orgId ?? "";
  const isRTL = i18n.language === "ar";

  const [cohorts, setCohorts] = useState<OrgCohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingCohort, setEditingCohort] = useState<OrgCohort | null>(null);
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
      if (!orgId) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const data = await organizationService.getCohorts(orgId);
        // Sort by patient count desc
        data.sort((a, b) => b.patientCount - a.patientCount);
        if (isMountedRef.current) setCohorts(data);
      } catch (err) {
        if (isMountedRef.current)
          Alert.alert(
            "Error",
            err instanceof Error ? err.message : "Failed to load cohorts."
          );
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [orgId]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const handleSaved = useCallback((saved: OrgCohort) => {
    setCohorts((prev) => {
      const existing = prev.find((c) => c.id === saved.id);
      if (existing) {
        return prev.map((c) => (c.id === saved.id ? saved : c));
      }
      return [saved, ...prev];
    });
  }, []);

  const openCreate = () => {
    setEditingCohort(null);
    setShowForm(true);
  };

  const openEdit = (cohort: OrgCohort) => {
    setEditingCohort(cohort);
    setShowForm(true);
  };

  const totalPatients = cohorts.reduce((sum, c) => sum + c.patientCount, 0);

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
        <TypographyText
          style={getTextStyle(
            theme,
            "heading",
            "bold",
            theme.colors.text.primary
          )}
        >
          Patient Cohorts
        </TypographyText>
        <View style={{ flex: 1 }} />
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
        <TouchableOpacity
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={openCreate}
          style={{
            backgroundColor: "#6366F1",
            borderRadius: 20,
            paddingHorizontal: 14,
            paddingVertical: 7,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Plus color="#FFF" size={15} />
          <Caption style={{ color: "#FFF", fontWeight: "600" }}>New</Caption>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
        refreshControl={
          <RefreshControl
            onRefresh={() => load(true)}
            refreshing={refreshing}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Summary banner */}
        {!loading && cohorts.length > 0 && (
          <View
            style={{
              backgroundColor: "#EEF2FF",
              borderRadius: 12,
              padding: 14,
              marginBottom: 20,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Users color="#4F46E5" size={18} />
            <Caption style={{ color: "#3730A3", flex: 1 }}>
              {cohorts.length} cohort{cohorts.length !== 1 ? "s" : ""} ·{" "}
              {totalPatients} enrolled patient{totalPatients !== 1 ? "s" : ""}
            </Caption>
          </View>
        )}

        {loading ? (
          <ActivityIndicator
            color={theme.colors.text.primary}
            style={{ marginTop: 48 }}
          />
        ) : cohorts.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 48 }}>
            <Users color={theme.colors.text.secondary} size={40} />
            <TypographyText
              style={{
                color: theme.colors.text.secondary,
                marginTop: 12,
                textAlign: "center",
              }}
            >
              No cohorts yet.
            </TypographyText>
            <Caption
              style={{
                color: theme.colors.text.secondary,
                marginTop: 6,
                textAlign: "center",
              }}
            >
              Create your first cohort to group patients by condition or
              program.
            </Caption>
            <TouchableOpacity
              onPress={openCreate}
              style={{
                marginTop: 20,
                backgroundColor: "#6366F1",
                borderRadius: 12,
                paddingHorizontal: 24,
                paddingVertical: 12,
              }}
            >
              <TypographyText style={{ color: "#FFF", fontWeight: "600" }}>
                Create First Cohort
              </TypographyText>
            </TouchableOpacity>
          </View>
        ) : (
          cohorts.map((c) => (
            <CohortCard
              cohort={c}
              key={c.id}
              onEdit={openEdit}
              orgId={orgId}
              theme={theme}
            />
          ))
        )}

        {/* Info note */}
        {!loading && cohorts.length > 0 && (
          <View
            style={{
              backgroundColor: "#F0FDF4",
              borderRadius: 10,
              padding: 14,
              marginTop: 8,
            }}
          >
            <Caption style={{ color: "#166534" }}>
              Tap a cohort to view its patients on the monitoring dashboard.
              Cohorts can be used to target care pathways and filter the patient
              roster.
            </Caption>
          </View>
        )}
      </ScrollView>

      <CohortFormModal
        createdBy={user?.id ?? ""}
        editing={editingCohort}
        onClose={() => setShowForm(false)}
        onSaved={handleSaved}
        orgId={orgId}
        theme={theme}
        visible={showForm}
      />
    </WavyBackground>
  );
}
