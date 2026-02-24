/**
 * Team Members Screen
 *
 * Org admins manage staff who can access the organization's patient data.
 * Lists active members with role badges; supports invite, role change, and deactivate.
 *
 * Route: /(settings)/org/members?orgId=<orgId>&orgName=<orgName>
 */

import { useLocalSearchParams, useNavigation } from "expo-router";
import {
  ChevronLeft,
  Mail,
  MoreVertical,
  RefreshCw,
  UserPlus,
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
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
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
import type { OrgMember, OrgRole } from "@/types";
import { getTextStyle } from "@/utils/styles";

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES: OrgRole[] = [
  "org_admin",
  "provider",
  "care_coordinator",
  "viewer",
];

const ROLE_LABELS: Record<OrgRole, string> = {
  org_admin: "Admin",
  provider: "Provider",
  care_coordinator: "Coordinator",
  viewer: "Viewer",
};

const ROLE_COLORS: Record<OrgRole, { bg: string; text: string }> = {
  org_admin: { bg: "#EEF2FF", text: "#4F46E5" },
  provider: { bg: "#EFF6FF", text: "#2563EB" },
  care_coordinator: { bg: "#ECFDF5", text: "#059669" },
  viewer: { bg: "#F1F5F9", text: "#64748B" },
};

// ─── Invite Modal ─────────────────────────────────────────────────────────────

function InviteModal({
  visible,
  orgId,
  invitedBy,
  theme,
  onClose,
  onInvited,
}: {
  visible: boolean;
  orgId: string;
  invitedBy: string;
  theme: ReturnType<typeof useTheme>["theme"];
  onClose: () => void;
  onInvited: (member: OrgMember) => void;
}) {
  const [userId, setUserId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRole>("provider");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setUserId("");
    setDisplayName("");
    setEmail("");
    setRole("provider");
    setSaving(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleInvite = async () => {
    if (!userId.trim()) {
      Alert.alert("Required", "User ID is required.");
      return;
    }
    setSaving(true);
    try {
      const member = await organizationService.addMember(orgId, {
        orgId,
        userId: userId.trim(),
        displayName: displayName.trim() || userId.trim(),
        email: email.trim() || undefined,
        role,
        invitedBy,
        isActive: true,
      });
      onInvited(member);
      handleClose();
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to add member."
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
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.background.secondary,
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
          Invite Team Member
        </TypographyText>
        <Caption
          style={{
            color: theme.colors.text.secondary,
            marginTop: 4,
            marginBottom: 24,
          }}
        >
          They must already have a Maak account.
        </Caption>

        <Caption
          style={{ color: theme.colors.text.secondary, marginBottom: 6 }}
        >
          USER ID *
        </Caption>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setUserId}
          placeholder="Firebase UID or email address"
          placeholderTextColor={theme.colors.text.secondary}
          style={inputStyle}
          value={userId}
        />

        <Caption
          style={{ color: theme.colors.text.secondary, marginBottom: 6 }}
        >
          DISPLAY NAME
        </Caption>
        <TextInput
          onChangeText={setDisplayName}
          placeholder="Dr. Jane Smith"
          placeholderTextColor={theme.colors.text.secondary}
          style={inputStyle}
          value={displayName}
        />

        <Caption
          style={{ color: theme.colors.text.secondary, marginBottom: 6 }}
        >
          EMAIL (optional)
        </Caption>
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="jane@clinic.com"
          placeholderTextColor={theme.colors.text.secondary}
          style={inputStyle}
          value={email}
        />

        <Caption
          style={{ color: theme.colors.text.secondary, marginBottom: 10 }}
        >
          ROLE
        </Caption>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 32,
          }}
        >
          {ROLES.map((r) => {
            const active = role === r;
            const colors = ROLE_COLORS[r];
            return (
              <TouchableOpacity
                key={r}
                onPress={() => setRole(r)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 20,
                  backgroundColor: active
                    ? colors.bg
                    : theme.colors.background.secondary,
                  borderWidth: active ? 1.5 : 0,
                  borderColor: active ? colors.text : "transparent",
                }}
              >
                <Caption
                  style={{
                    color: active ? colors.text : theme.colors.text.secondary,
                    fontWeight: active ? "600" : "400",
                  }}
                >
                  {ROLE_LABELS[r]}
                </Caption>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          disabled={saving}
          onPress={handleInvite}
          style={{
            backgroundColor: "#6366F1",
            borderRadius: 12,
            padding: 16,
            alignItems: "center",
            marginBottom: 12,
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <TypographyText
              style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 16 }}
            >
              Add Member
            </TypographyText>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleClose}
          style={{ alignItems: "center", padding: 12 }}
        >
          <Caption style={{ color: theme.colors.text.secondary }}>
            Cancel
          </Caption>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ─── Member Row ───────────────────────────────────────────────────────────────

function MemberRow({
  member,
  isMe,
  theme,
  onChangeRole,
  onDeactivate,
}: {
  member: OrgMember;
  isMe: boolean;
  theme: ReturnType<typeof useTheme>["theme"];
  onChangeRole: (member: OrgMember) => void;
  onDeactivate: (member: OrgMember) => void;
}) {
  const roleColors = ROLE_COLORS[member.role];

  const handleOptions = () => {
    if (isMe) return; // can't modify yourself
    const options = ["Change Role", "Remove Member", "Cancel"];
    const destructiveIndex = 1;
    const cancelIndex = 2;

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          destructiveButtonIndex: destructiveIndex,
          cancelButtonIndex: cancelIndex,
        },
        (idx) => {
          if (idx === 0) onChangeRole(member);
          if (idx === 1) onDeactivate(member);
        }
      );
    } else {
      Alert.alert(member.displayName, undefined, [
        { text: "Change Role", onPress: () => onChangeRole(member) },
        {
          text: "Remove Member",
          style: "destructive",
          onPress: () => onDeactivate(member),
        },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  };

  return (
    <View
      style={{
        backgroundColor: theme.colors.background.secondary,
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      {/* Avatar circle */}
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 21,
          backgroundColor: roleColors.bg,
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <TypographyText
          style={{ color: roleColors.text, fontSize: 16, fontWeight: "700" }}
        >
          {(member.displayName || member.userId).charAt(0).toUpperCase()}
        </TypographyText>
      </View>

      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <TypographyText
            style={{
              color: theme.colors.text.primary,
              fontSize: 15,
              fontWeight: "600",
            }}
          >
            {member.displayName || member.userId}
          </TypographyText>
          {isMe && (
            <Caption
              style={{
                color: theme.colors.text.secondary,
                backgroundColor: theme.colors.background.primary,
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 4,
              }}
            >
              you
            </Caption>
          )}
        </View>
        {member.email ? (
          <Caption style={{ color: theme.colors.text.secondary }}>
            {member.email}
          </Caption>
        ) : null}
      </View>

      {/* Role badge */}
      <View
        style={{
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 12,
          backgroundColor: roleColors.bg,
        }}
      >
        <Caption style={{ color: roleColors.text, fontWeight: "600" }}>
          {ROLE_LABELS[member.role]}
        </Caption>
      </View>

      {/* Options */}
      {!isMe && (
        <TouchableOpacity
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={handleOptions}
        >
          <MoreVertical color={theme.colors.text.secondary} size={18} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MembersScreen() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ orgId: string; orgName: string }>();
  const orgId = params.orgId ?? "";
  const isRTL = i18n.language === "ar";

  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
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
      setError(null);
      try {
        const data = await organizationService.getMembers(orgId);
        if (isMountedRef.current) setMembers(data);
      } catch (err) {
        if (isMountedRef.current)
          setError(
            err instanceof Error ? err.message : "Failed to load members"
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

  const handleChangeRole = useCallback(
    (member: OrgMember) => {
      const options = [...ROLES.map((r) => ROLE_LABELS[r]), "Cancel"];
      const cancelIndex = options.length - 1;

      if (Platform.OS === "ios") {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options,
            cancelButtonIndex: cancelIndex,
            title: `Change role for ${member.displayName}`,
          },
          async (idx) => {
            if (idx === cancelIndex) return;
            const newRole = ROLES[idx];
            if (newRole === member.role) return;
            try {
              await organizationService.updateMemberRole(
                orgId,
                member.userId,
                newRole
              );
              setMembers((prev) =>
                prev.map((m) =>
                  m.id === member.id ? { ...m, role: newRole } : m
                )
              );
            } catch {
              Alert.alert("Error", "Failed to update role.");
            }
          }
        );
      } else {
        Alert.alert(`Role for ${member.displayName}`, "Select new role:", [
          ...ROLES.map((r) => ({
            text: ROLE_LABELS[r],
            onPress: async () => {
              if (r === member.role) return;
              try {
                await organizationService.updateMemberRole(
                  orgId,
                  member.userId,
                  r
                );
                setMembers((prev) =>
                  prev.map((m) => (m.id === member.id ? { ...m, role: r } : m))
                );
              } catch {
                Alert.alert("Error", "Failed to update role.");
              }
            },
          })),
          { text: "Cancel", style: "cancel" },
        ]);
      }
    },
    [orgId]
  );

  const handleDeactivate = useCallback(
    (member: OrgMember) => {
      Alert.alert(
        "Remove Member",
        `Remove ${member.displayName} from this organization? They will lose access immediately.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              try {
                await organizationService.deactivateMember(
                  orgId,
                  member.userId
                );
                setMembers((prev) => prev.filter((m) => m.id !== member.id));
              } catch {
                Alert.alert("Error", "Failed to remove member.");
              }
            },
          },
        ]
      );
    },
    [orgId]
  );

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
          Team Members
        </TypographyText>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={() => load(true)}
          style={{ marginRight: 8 }}
        >
          <RefreshCw
            color={theme.colors.text.secondary}
            size={18}
            style={refreshing ? { opacity: 0.4 } : undefined}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setShowInvite(true)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#6366F1",
            borderRadius: 20,
            paddingHorizontal: 14,
            paddingVertical: 7,
            gap: 6,
          }}
        >
          <UserPlus color="#FFFFFF" size={15} />
          <Caption style={{ color: "#FFFFFF", fontWeight: "600" }}>
            Invite
          </Caption>
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
        {/* Error */}
        {error ? (
          <View
            style={{
              backgroundColor: "#FEE2E2",
              borderRadius: 10,
              padding: 14,
              marginBottom: 16,
            }}
          >
            <TypographyText style={{ color: "#DC2626" }}>
              {error}
            </TypographyText>
          </View>
        ) : null}

        {loading ? (
          <ActivityIndicator
            color={theme.colors.text.primary}
            style={{ marginTop: 48 }}
          />
        ) : (
          <>
            <Caption
              style={{
                color: theme.colors.text.secondary,
                marginBottom: 12,
              }}
            >
              {members.length} active member{members.length !== 1 ? "s" : ""}
            </Caption>

            {members.map((m) => (
              <MemberRow
                isMe={m.userId === user?.id}
                key={m.id}
                member={m}
                onChangeRole={handleChangeRole}
                onDeactivate={handleDeactivate}
                theme={theme}
              />
            ))}

            {members.length === 0 && !error ? (
              <View style={{ alignItems: "center", paddingVertical: 48 }}>
                <Mail color={theme.colors.text.secondary} size={36} />
                <TypographyText
                  style={{
                    color: theme.colors.text.secondary,
                    marginTop: 12,
                    textAlign: "center",
                  }}
                >
                  No team members yet. Tap Invite to add your first provider or
                  coordinator.
                </TypographyText>
              </View>
            ) : null}

            {/* Role legend */}
            <View
              style={{
                backgroundColor: "#EFF6FF",
                borderRadius: 10,
                padding: 14,
                marginTop: 24,
              }}
            >
              <Caption
                style={{ color: "#1D4ED8", fontWeight: "600", marginBottom: 6 }}
              >
                Role Permissions
              </Caption>
              {ROLES.map((r) => (
                <Caption key={r} style={{ color: "#1D4ED8", marginBottom: 2 }}>
                  {ROLE_LABELS[r]} —{" "}
                  {r === "org_admin" &&
                    "full access, manage members & settings"}
                  {r === "provider" && "view & act on assigned patient cohort"}
                  {r === "care_coordinator" &&
                    "manage tasks, pathways, and outreach"}
                  {r === "viewer" && "read-only dashboards and reports"}
                </Caption>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <InviteModal
        invitedBy={user?.id ?? ""}
        onClose={() => setShowInvite(false)}
        onInvited={(m) => setMembers((prev) => [m, ...prev])}
        orgId={orgId}
        theme={theme}
        visible={showInvite}
      />
    </WavyBackground>
  );
}
