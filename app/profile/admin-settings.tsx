import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Bell,
  Building2,
  ChevronRight,
  CreditCard,
  Shield,
  Users,
  Webhook,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { api } from "@/lib/apiClient";

interface OrgInfo {
  id: string;
  name: string;
  type: string;
  memberCount: number;
  plan: string;
}

export default function AdminSettingsScreen() {
  const { i18n } = useTranslation();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const isRTL = i18n.language === "ar";

  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const bg = isDark ? theme.colors.background.primary : "#F8FAFC";
  const card = isDark ? "#1E293B" : "#FFFFFF";
  const border = isDark ? "#334155" : "#E2E8F0";

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get<OrgInfo>("/api/org/me");
        setOrg(data);
      } catch (err: unknown) {
        // Expected when user has no org membership
        console.debug('[admin-settings] No org found or fetch failed:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleCreateOrg = () => {
    router.push({ pathname: '/(settings)/create-org' });
  };

  const sections = [
    {
      title: isRTL ? "إدارة المنظمة" : "Organisation Management",
      items: [
        {
          icon: Users,
          iconColor: "#3B82F6",
          label: isRTL ? "إدارة الأعضاء" : "Manage Members",
          sub: isRTL ? "دعوة الأعضاء وإدارة الأدوار" : "Invite members and manage roles",
          onPress: () => router.push({ pathname: '/(settings)/org/members' }),
        },
        {
          icon: Shield,
          iconColor: "#10B981",
          label: isRTL ? "الأدوار والصلاحيات" : "Roles & Permissions",
          sub: isRTL ? "تحديد صلاحيات كل دور" : "Define permissions for each role",
          onPress: () => router.push({ pathname: '/(settings)/org/roles' }),
        },
        {
          icon: Building2,
          iconColor: "#8B5CF6",
          label: isRTL ? "إعدادات المنظمة" : "Organisation Settings",
          sub: isRTL ? "الاسم، النوع، معلومات الاتصال" : "Name, type, contact information",
          onPress: () => router.push({ pathname: '/(settings)/org/settings' }),
        },
      ],
    },
    {
      title: isRTL ? "الاشتراك والفوترة" : "Subscription & Billing",
      items: [
        {
          icon: CreditCard,
          iconColor: "#F59E0B",
          label: isRTL ? "خطة الاشتراك" : "Subscription Plan",
          sub: org ? `${org.plan} — ${org.memberCount} ${isRTL ? "أعضاء" : "members"}` : (isRTL ? "عرض الخطة الحالية" : "View current plan"),
          onPress: () => router.push({ pathname: '/(settings)/subscription' }),
        },
      ],
    },
    {
      title: isRTL ? "التكاملات والمطورون" : "Integrations & Developers",
      items: [
        {
          icon: Webhook,
          iconColor: "#06B6D4",
          label: isRTL ? "مفاتيح API والـ Webhooks" : "API Keys & Webhooks",
          sub: isRTL ? "إدارة مفاتيح الوصول للمطورين" : "Manage developer access keys",
          onPress: () => router.push({ pathname: '/(settings)/org/api-keys' }),
        },
        {
          icon: Bell,
          iconColor: "#EF4444",
          label: isRTL ? "إعدادات الإشعارات" : "Notification Settings",
          sub: isRTL ? "تخصيص تنبيهات المنظمة" : "Customise organisation alerts",
          onPress: () => router.push({ pathname: '/(settings)/notifications' }),
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: card, borderBottomColor: border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ArrowLeft
            color={theme.colors.text.primary}
            size={22}
            style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text.primary }]}>
          {isRTL ? "إعدادات المسؤول" : "Admin Settings"}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary.main} size="large" />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Org banner */}
          {org ? (
            <View style={[styles.orgBanner, { backgroundColor: `${theme.colors.primary.main}10`, borderColor: `${theme.colors.primary.main}30` }]}>
              <View style={[styles.orgIconWrap, { backgroundColor: `${theme.colors.primary.main}20` }]}>
                <Building2 color={theme.colors.primary.main} size={24} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.orgName, { color: theme.colors.text.primary }]}>{org.name}</Text>
                <Text style={[styles.orgMeta, { color: theme.colors.text.secondary }]}>
                  {org.type} · {org.memberCount} {isRTL ? "أعضاء" : "members"}
                </Text>
              </View>
            </View>
          ) : (
            <View style={[styles.noOrgCard, { backgroundColor: card, borderColor: border }]}>
              <Building2 color={theme.colors.text.secondary} size={40} />
              <Text style={[styles.noOrgTitle, { color: theme.colors.text.primary }]}>
                {isRTL ? "لا توجد منظمة مرتبطة" : "No organisation linked"}
              </Text>
              <Text style={[styles.noOrgDesc, { color: theme.colors.text.secondary }]}>
                {isRTL
                  ? "أنشئ منظمة لإدارة الأعضاء والمرضى والفريق الطبي"
                  : "Create an organisation to manage members, patients, and medical teams"}
              </Text>
              <TouchableOpacity
                onPress={handleCreateOrg}
                style={[styles.createOrgBtn, { backgroundColor: theme.colors.primary.main }]}
              >
                <Text style={styles.createOrgBtnText}>
                  {isRTL ? "إنشاء منظمة" : "Create Organisation"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Settings sections */}
          {org && sections.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text.secondary }]}>
                {section.title}
              </Text>
              <View style={[styles.sectionCard, { backgroundColor: card, borderColor: border }]}>
                {section.items.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <TouchableOpacity
                      key={item.label}
                      onPress={item.onPress}
                      style={[
                        styles.menuItem,
                        idx < section.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: border },
                      ]}
                    >
                      <View style={[styles.menuIcon, { backgroundColor: `${item.iconColor}15` }]}>
                        <Icon color={item.iconColor} size={20} />
                      </View>
                      <View style={styles.menuText}>
                        <Text style={[styles.menuLabel, { color: theme.colors.text.primary }]}>
                          {item.label}
                        </Text>
                        {item.sub && (
                          <Text style={[styles.menuSub, { color: theme.colors.text.secondary }]}>
                            {item.sub}
                          </Text>
                        )}
                      </View>
                      <ChevronRight
                        color={theme.colors.text.secondary}
                        size={18}
                        style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 18, fontWeight: "600", flex: 1, textAlign: "center" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80 },
  orgBanner: {
    flexDirection: "row",
    alignItems: "center",
    margin: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
  },
  orgIconWrap: { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center" },
  orgName: { fontSize: 16, fontWeight: "700" },
  orgMeta: { fontSize: 13, marginTop: 2 },
  noOrgCard: {
    margin: 16,
    padding: 28,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    gap: 12,
  },
  noOrgTitle: { fontSize: 17, fontWeight: "700", textAlign: "center" },
  noOrgDesc: { fontSize: 14, textAlign: "center", lineHeight: 20, paddingHorizontal: 8 },
  createOrgBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  createOrgBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  section: { paddingHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, paddingHorizontal: 4 },
  sectionCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  menuItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 14 },
  menuIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  menuText: { flex: 1 },
  menuLabel: { fontSize: 15, fontWeight: "600" },
  menuSub: { fontSize: 13, marginTop: 2 },
});
