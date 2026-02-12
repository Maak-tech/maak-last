/* biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: legacy alert-card UI handlers retained in this pass. */
import { AlertTriangle, CheckCircle, Clock } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { alertService } from "@/lib/services/alertService";
import { userService } from "@/lib/services/userService";
import { logger } from "@/lib/utils/logger";
import type { EmergencyAlert, User } from "@/types";
import { safeFormatDate } from "@/utils/dateFormat";

type AlertsCardProps = {
  familyMembers?: User[];
  refreshTrigger?: number;
};

export default function AlertsCard({
  familyMembers: providedFamilyMembers,
  refreshTrigger,
}: AlertsCardProps) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<User[]>([]);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [resolvingAlertIds, setResolvingAlertIds] = useState<Set<string>>(
    new Set()
  );
  const alertsLoadInFlightRef = useRef(false);
  const resolvingAlertIdsRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(true);

  const isRTL = i18n.language === "ar";
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    []
  );

  const loadAlerts = useCallback(
    async (forceRefresh = false) => {
      if (!user?.familyId) {
        return;
      }
      if (!forceRefresh && alertsLoadInFlightRef.current) {
        return;
      }

      const startTime = Date.now();

      try {
        alertsLoadInFlightRef.current = true;
        setLoading(true);

        logger.debug(
          "Loading family emergency alerts",
          {
            userId: user.id,
            familyId: user.familyId,
            refreshTrigger,
          },
          "AlertsCard"
        );

        const members =
          providedFamilyMembers && providedFamilyMembers.length > 0
            ? providedFamilyMembers
            : await userService.getFamilyMembers(user.familyId);
        if (!mountedRef.current) {
          return;
        }
        setFamilyMembers(members);

        const userIds = Array.from(
          new Set([user.id, ...members.map((member) => member.id)])
        );
        const alertsTimeoutPromise = new Promise<EmergencyAlert[]>(
          (resolve) => {
            setTimeout(() => resolve([]), 12_000);
          }
        );
        const familyAlerts = await Promise.race([
          alertService.getFamilyAlerts(userIds, 10, forceRefresh),
          alertsTimeoutPromise,
        ]);
        if (!mountedRef.current) {
          return;
        }
        setAlerts(familyAlerts);

        const durationMs = Date.now() - startTime;
        logger.info(
          "Family emergency alerts loaded",
          {
            userId: user.id,
            familyId: user.familyId,
            memberCount: members.length,
            alertCount: familyAlerts.length,
            durationMs,
          },
          "AlertsCard"
        );
      } catch (error) {
        const durationMs = Date.now() - startTime;

        // Check if it's an index error
        const isIndexError =
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "failed-precondition";

        if (isIndexError) {
          logger.warn(
            "Firestore index not ready for alerts query",
            {
              userId: user.id,
              familyId: user.familyId,
              durationMs,
            },
            "AlertsCard"
          );
        } else {
          logger.error("Failed to load family alerts", error, "AlertsCard");
        }
      } finally {
        alertsLoadInFlightRef.current = false;
        setLoading(false);
      }
    },
    [user?.familyId, user?.id, refreshTrigger, providedFamilyMembers]
  );

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const handleRespond = async (alertId: string) => {
    if (!user?.id) {
      return;
    }

    const startTime = Date.now();

    try {
      setRespondingTo(alertId);

      logger.info(
        "User responding to emergency alert",
        {
          alertId,
          userId: user.id,
          role: user.role,
        },
        "AlertsCard"
      );

      await alertService.addResponder(alertId, user.id);

      const durationMs = Date.now() - startTime;
      logger.info(
        "Emergency alert response recorded",
        {
          alertId,
          userId: user.id,
          durationMs,
        },
        "AlertsCard"
      );

      Alert.alert(
        isRTL ? "تم التجاوب" : "Response Recorded",
        isRTL
          ? "تم تسجيل استجابتك للتنبيه. تواصل مع المريض للتأكد من سلامته."
          : "Your response has been recorded. Please contact the patient to ensure they are safe.",
        [{ text: isRTL ? "موافق" : "OK" }]
      );

      await loadAlerts(true);
    } catch (error) {
      logger.error("Failed to record alert response", error, "AlertsCard");

      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL
          ? "فشل في تسجيل استجابتك للتنبيه"
          : "Failed to record your response to the alert",
        [{ text: isRTL ? "موافق" : "OK" }],
        { cancelable: true }
      );
    } finally {
      setRespondingTo(null);
    }
  };

  const handleResolve = async (alertId: string) => {
    if (!user?.id) {
      return;
    }
    if (resolvingAlertIdsRef.current.has(alertId)) {
      return;
    }

    const startTime = Date.now();

    try {
      resolvingAlertIdsRef.current.add(alertId);
      setResolvingAlertIds((prev) => {
        const next = new Set(prev);
        next.add(alertId);
        return next;
      });
      logger.info(
        "User resolving emergency alert",
        {
          alertId,
          userId: user.id,
          role: user.role,
        },
        "AlertsCard"
      );

      await alertService.resolveAlert(alertId, user.id);
      await loadAlerts(true);

      const durationMs = Date.now() - startTime;
      logger.info(
        "Emergency alert resolved successfully",
        {
          alertId,
          userId: user.id,
          durationMs,
        },
        "AlertsCard"
      );

      Alert.alert(
        isRTL ? "تم الحل" : "Resolved",
        isRTL ? "تم حل التنبيه بنجاح" : "Alert resolved successfully",
        [{ text: isRTL ? "موافق" : "OK" }]
      );
    } catch (error: unknown) {
      logger.error("Failed to resolve emergency alert", error, "AlertsCard");

      const errorMessage =
        error instanceof Error
          ? error.message
          : t("failedToResolveAlert", "Failed to resolve alert");

      // Check for specific error types
      let displayMessage = errorMessage;
      if (
        errorMessage.includes("permission-denied") ||
        errorMessage.includes("permission")
      ) {
        displayMessage = isRTL
          ? "ليس لديك الصلاحية لحل هذا التنبيه"
          : "You don't have permission to resolve this alert";
      } else if (
        errorMessage.includes("does not exist") ||
        errorMessage.includes("not found")
      ) {
        displayMessage = isRTL ? "التنبيه غير موجود" : "Alert not found";
      }

      Alert.alert(t("error", "Error"), displayMessage, [
        { text: t("ok", "OK") },
      ]);
    } finally {
      resolvingAlertIdsRef.current.delete(alertId);
      setResolvingAlertIds((prev) => {
        if (!prev.has(alertId)) {
          return prev;
        }
        const next = new Set(prev);
        next.delete(alertId);
        return next;
      });
    }
  };

  const getMemberName = (userId: string): string => {
    const member = familyMembers.find((m) => m.id === userId);
    if (!member) {
      return t("unknownMember", "Unknown Member");
    }
    if (member.firstName && member.lastName) {
      return `${member.firstName} ${member.lastName}`;
    }
    if (member.firstName) {
      return member.firstName;
    }
    return t("unknownMember", "Unknown Member");
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "fall":
        return <AlertTriangle color="#EF4444" size={24} />;
      case "medication":
        return <Clock color="#F59E0B" size={24} />;
      case "emergency":
        return <AlertTriangle color="#DC2626" size={24} />;
      default:
        return <AlertTriangle color="#6B7280" size={24} />;
    }
  };

  const getAlertColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "#DC2626";
      case "high":
        return "#EF4444";
      case "medium":
        return "#F59E0B";
      case "low":
        return "#10B981";
      default:
        return "#6B7280";
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60_000);
    const hours = Math.floor(diff / 3_600_000);

    if (minutes < 1) {
      return isRTL ? "الآن" : "now";
    }
    if (minutes < 60) {
      return isRTL ? `منذ ${minutes}د` : `${minutes}m ago`;
    }
    if (hours < 24) {
      return isRTL ? `منذ ${hours}س` : `${hours}h ago`;
    }
    return safeFormatDate(timestamp);
  };

  const renderAlert = ({ item }: { item: EmergencyAlert }) => {
    const memberName = getMemberName(item.userId);
    const isResponding = respondingTo === item.id;
    const hasResponded = item.responders?.includes(user?.id || "");

    return (
      <View
        style={[
          styles.alertCard,
          { borderStartColor: getAlertColor(item.severity) },
        ]}
      >
        <View style={styles.alertHeader}>
          <View style={styles.alertIcon}>{getAlertIcon(item.type)}</View>
          <View style={styles.alertInfo}>
            <Text style={[styles.alertTitle, isRTL && styles.rtlText]}>
              {item.type === "fall" && (isRTL ? "تنبيه سقوط" : "Fall Alert")}
              {item.type === "medication" &&
                (isRTL ? "تنبيه الدواء" : "Medication Alert")}
              {item.type === "emergency" &&
                (isRTL ? "تنبيه طوارئ" : "Emergency Alert")}
            </Text>
            <Text style={[styles.alertMember, isRTL && styles.rtlText]}>
              {memberName}
            </Text>
          </View>
          <Text style={[styles.alertTime, isRTL && styles.rtlText]}>
            {formatTimestamp(item.timestamp)}
          </Text>
        </View>

        <Text style={[styles.alertMessage, isRTL && styles.rtlText]}>
          {item.message}
        </Text>

        {item.responders && item.responders.length > 0 && (
          <View style={styles.respondersSection}>
            <Text style={[styles.respondersLabel, isRTL && styles.rtlText]}>
              {isRTL ? "المستجبون للتنبيه:" : "Responders to the alert:"}
            </Text>
            <Text style={[styles.respondersText, isRTL && styles.rtlText]}>
              {item.responders.map((id) => getMemberName(id)).join(", ")}
            </Text>
          </View>
        )}

        <View style={styles.alertActions}>
          {!hasResponded && (
            <TouchableOpacity
              disabled={isResponding}
              onPress={() => handleRespond(item.id)}
              style={[styles.actionButton, styles.respondButton]}
            >
              {isResponding ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <CheckCircle color="#FFFFFF" size={16} />
              )}
              <Text style={[styles.actionButtonText, isRTL && styles.rtlText]}>
                {isRTL ? "استجابة" : "Respond"}
              </Text>
            </TouchableOpacity>
          )}

          {/*
            Disable resolve button while the request is in flight to avoid
            duplicate resolve calls and repeated success alerts.
          */}
          {(() => {
            const isResolving = resolvingAlertIds.has(item.id);
            return (
              <TouchableOpacity
                activeOpacity={0.7}
                disabled={isResolving}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                onPress={() => handleResolve(item.id)}
                style={[
                  styles.actionButton,
                  styles.resolveButton,
                  isResolving && styles.resolveButtonDisabled,
                ]}
              >
                {isResolving ? (
                  <ActivityIndicator color="#10B981" size="small" />
                ) : (
                  <CheckCircle color="#10B981" size={16} />
                )}
                <Text
                  style={[
                    styles.actionButtonTextSecondary,
                    isRTL && styles.rtlText,
                    isResolving && styles.resolveButtonTextDisabled,
                  ]}
                >
                  {isRTL ? "حل التنبيه الصحي" : "Resolve the alert"}
                </Text>
              </TouchableOpacity>
            );
          })()}
        </View>
      </View>
    );
  };

  if (!user?.familyId) {
    return null; // Don't show alerts if user is not in a family
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.title, isRTL && styles.rtlText]}>
            {isRTL ? "التنبيهات الصحية الفعالة" : "Active Alerts"}
          </Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#2563EB" size="large" />
        </View>
      </View>
    );
  }

  if (alerts.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.title, isRTL && styles.rtlText]}>
            {isRTL ? "التنبيهات الصحية الفعالة" : "Active Alerts"}
          </Text>
        </View>
        <View style={styles.emptyContainer}>
          <CheckCircle color="#10B981" size={48} />
          <Text style={[styles.emptyText, isRTL && styles.rtlText]}>
            {isRTL ? "لا توجد تنبيهات صحية فعالة" : "No active alerts"}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, isRTL && styles.rtlText]}>
          {isRTL ? "التنبيهات الصحية الفعالة" : "Active Alerts"}
        </Text>
        <View style={styles.alertBadge}>
          <Text style={styles.alertBadgeText}>{alerts.length}</Text>
        </View>
      </View>

      <View style={styles.alertsList}>
        {alerts.map((item) => (
          <View key={item.id}>{renderAlert({ item })}</View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
  },
  alertBadge: {
    backgroundColor: "#EF4444",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: "center",
  },
  alertBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  loadingContainer: {
    padding: 32,
    alignItems: "center",
  },
  emptyContainer: {
    padding: 32,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 8,
  },
  alertsList: {
    padding: 16,
  },
  alertCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderStartWidth: 4,
  },
  alertHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  alertIcon: {
    marginEnd: 12,
  },
  alertInfo: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 2,
  },
  alertMember: {
    fontSize: 14,
    color: "#6B7280",
  },
  alertTime: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  alertMessage: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 20,
    marginBottom: 12,
  },
  respondersSection: {
    marginBottom: 12,
  },
  respondersLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 4,
  },
  respondersText: {
    fontSize: 12,
    color: "#4B5563",
  },
  alertActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
  },
  respondButton: {
    backgroundColor: "#2563EB",
  },
  resolveButton: {
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  resolveButtonDisabled: {
    backgroundColor: "#E5E7EB",
    borderColor: "#E5E7EB",
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  actionButtonTextSecondary: {
    fontSize: 14,
    fontWeight: "600",
    color: "#10B981",
  },
  resolveButtonTextDisabled: {
    color: "#6B7280",
  },
  rtlText: {
    textAlign: "right",
  },
});
