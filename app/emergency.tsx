/**
 * Emergency Information Screen
 *
 * This screen is intentionally auth-free. It reads purely from SecureStore
 * and must be accessible by first responders without unlocking the app.
 *
 * Design principles:
 *  - High-contrast red/orange palette for bright outdoor visibility
 *  - Large fonts throughout (minimum 16px body, 20px headers)
 *  - Minimal cognitive load — only the most critical data is shown
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle, Phone, Pill, RefreshCw, Shield, XCircle } from 'lucide-react-native';
import {
  emergencyCacheService,
  type EmergencyCache,
} from '@/lib/services/emergencyCacheService';

// ---------------------------------------------------------------------------
// Colours — fixed, high-contrast. NOT theme-dependent (works in any mode).
// ---------------------------------------------------------------------------
const C = {
  red: '#CC0000',
  redLight: '#FF3333',
  redBg: '#FFF0F0',
  redBorder: '#FFCCCC',
  orange: '#E05000',
  orangeBg: '#FFF5EE',
  orangeBorder: '#FFD6B0',
  amber: '#B35C00',
  amberBg: '#FFFBEB',
  amberBorder: '#FFE4A0',
  green: '#155724',
  greenBg: '#D4EDDA',
  white: '#FFFFFF',
  offWhite: '#F8F8F8',
  darkText: '#1A1A1A',
  mutedText: '#555555',
  borderLight: '#E0E0E0',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function hoursAgo(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}

function formatHoursAgo(iso: string): string {
  const h = hoursAgo(iso);
  if (h < 1) return 'just now';
  if (h < 2) return '1 hour ago';
  if (h < 24) return `${Math.floor(h)} hours ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? '1 day ago' : `${d} days ago`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View style={styles.sectionHeader}>
      {icon}
      <Text style={styles.sectionTitle}>{label}</Text>
    </View>
  );
}

function AllergyRow({ substance, severity, notes }: { substance: string; severity: string; notes?: string }) {
  const isLifeThreatening =
    severity.toLowerCase().includes('life') || severity.toLowerCase() === 'critical';
  const badgeStyle = isLifeThreatening ? styles.badgeDanger : styles.badgeWarning;
  const badgeText = isLifeThreatening ? styles.badgeDangerText : styles.badgeWarningText;

  return (
    <View style={styles.row}>
      <View style={styles.rowContent}>
        <Text style={styles.rowPrimary}>{substance}</Text>
        {notes ? <Text style={styles.rowSecondary}>{notes}</Text> : null}
      </View>
      <View style={badgeStyle}>
        <Text style={badgeText}>{severity}</Text>
      </View>
    </View>
  );
}

function MedicationRow({
  name,
  dosage,
  frequency,
}: {
  name: string;
  dosage: string;
  frequency: string;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowContent}>
        <Text style={styles.rowPrimary}>{name}</Text>
        <Text style={styles.rowSecondary}>
          {dosage}
          {frequency ? ` · ${frequency}` : ''}
        </Text>
      </View>
    </View>
  );
}

function ContactRow({
  name,
  phone,
  relation,
  isPrimary,
}: {
  name: string;
  phone: string;
  relation: string;
  isPrimary: boolean;
}) {
  const handleCall = () => {
    const dialUrl = `tel:${phone.replace(/\s+/g, '')}`;
    Linking.openURL(dialUrl).catch(() => {
      // Silently fail — device may not support tel: links (e.g. tablet without SIM)
    });
  };

  return (
    <View style={styles.contactRow}>
      <View style={styles.rowContent}>
        <View style={styles.contactNameRow}>
          <Text style={styles.rowPrimary}>{name}</Text>
          {isPrimary && (
            <View style={styles.primaryBadge}>
              <Text style={styles.primaryBadgeText}>PRIMARY</Text>
            </View>
          )}
        </View>
        <Text style={styles.rowSecondary}>
          {relation} · {phone}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.callButton}
        onPress={handleCall}
        activeOpacity={0.75}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`Call ${name}`}
        accessibilityHint="Double tap to open the phone dialer"
      >
        <Phone size={16} color={C.white} />
        <Text style={styles.callButtonText}>CALL</Text>
      </TouchableOpacity>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export default function EmergencyScreen() {
  const [cache, setCache] = useState<EmergencyCache | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Load cached data on mount
  useEffect(() => {
    emergencyCacheService
      .getEmergencyCache()
      .then(setCache)
      .catch(() => setCache(null))
      .finally(() => setLoading(false));
  }, []);

  const handleRefresh = useCallback(async () => {
    // Refresh is only reachable if cache already exists (meaning the user is
    // signed in and has previously synced). Re-read cache after sync.
    if (syncing) return;
    setSyncing(true);
    try {
      // We don't have the user object here, so we re-read the current cache
      // to extract userId and pass it as a minimal user object.
      const current = await emergencyCacheService.getEmergencyCache();
      if (current) {
        await emergencyCacheService.syncEmergencyCache({
          id: current.userId,
          name: current.name,
          bloodType: current.bloodType,
          dateOfBirth: current.dateOfBirth,
          emergencyContacts: current.emergencyContacts,
        });
      }
      const refreshed = await emergencyCacheService.getEmergencyCache();
      setCache(refreshed);
    } catch {
      // Silently ignore — user stays on stale data
    } finally {
      setSyncing(false);
    }
  }, [syncing]);

  // ------------------------------------------------------------------
  // Loading state
  // ------------------------------------------------------------------
  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={C.red} />
        </View>
      </SafeAreaView>
    );
  }

  // ------------------------------------------------------------------
  // No cache: prompt user to set up emergency access
  // ------------------------------------------------------------------
  if (!cache) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.noCacheContainer}
          showsVerticalScrollIndicator={false}
        >
          <XCircle size={80} color={C.red} />
          <Text style={styles.noCacheTitle}>No Emergency Data</Text>
          <Text style={styles.noCacheBody}>
            Set up emergency access in the Nuralix app by signing in and navigating to your profile.
            Your medical information will then be available here without an internet connection.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ------------------------------------------------------------------
  // Cache exists: show data
  // ------------------------------------------------------------------
  const isStale = hoursAgo(cache.cachedAt) > 24;
  const hasAllergies = cache.allergies.length > 0;
  const activeMeds = cache.medications.filter((m) => m.isActive !== false);
  const hasContacts = cache.emergencyContacts.length > 0;
  // Sort contacts: primary first
  const sortedContacts = [...cache.emergencyContacts].sort((a, b) =>
    a.isPrimary === b.isPrimary ? 0 : a.isPrimary ? -1 : 1
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Stale-data warning banner ── */}
        <View
          accessibilityLiveRegion="polite"
          accessibilityLabel={isStale ? 'Warning: Health data may be outdated' : undefined}
        >
          {isStale && (
            <View style={styles.staleBanner}>
              <AlertTriangle size={18} color={C.amber} />
              <Text style={styles.staleBannerText}>
                Data may be outdated — open Nuralix to refresh
              </Text>
            </View>
          )}
        </View>

        {/* ── Header card ── */}
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View style={styles.emergencyIconCircle}>
              <Shield size={28} color={C.white} />
            </View>
            <View style={styles.headerTextBlock}>
              <Text style={styles.emergencyLabel}>EMERGENCY INFORMATION</Text>
              <Text style={styles.patientName}>{cache.name || 'Unknown Patient'}</Text>
              {cache.bloodType ? (
                <Text style={styles.bloodType}>Blood Type: {cache.bloodType}</Text>
              ) : null}
              {cache.dateOfBirth ? (
                <Text style={styles.subInfo}>
                  DOB:{' '}
                  {new Date(cache.dateOfBirth).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Text>
              ) : null}
            </View>
            {/* Refresh button — only shown when cache exists */}
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={handleRefresh}
              disabled={syncing}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Refresh emergency data"
              accessibilityHint="Double tap to sync the latest health data from the server"
            >
              {syncing ? (
                <ActivityIndicator size="small" color={C.red} />
              ) : (
                <RefreshCw size={20} color={C.red} />
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.lastUpdated}>
            Last updated: {formatHoursAgo(cache.cachedAt)}
          </Text>
        </View>

        {/* ── Allergies ── */}
        <View style={styles.section}>
          <SectionHeader
            icon={<AlertTriangle size={22} color={C.orange} />}
            label="ALLERGIES"
          />
          {hasAllergies ? (
            cache.allergies.map((a, i) => (
              <AllergyRow
                key={`allergy-${i}`}
                substance={a.substance}
                severity={a.severity}
                notes={a.notes}
              />
            ))
          ) : (
            <Text style={styles.emptyText}>No known allergies recorded</Text>
          )}
        </View>

        {/* ── Medications ── */}
        <View style={styles.section}>
          <SectionHeader
            icon={<Pill size={22} color={C.orange} />}
            label="CURRENT MEDICATIONS"
          />
          {activeMeds.length > 0 ? (
            activeMeds.map((m, i) => (
              <MedicationRow
                key={`med-${i}`}
                name={m.name}
                dosage={m.dosage}
                frequency={m.frequency}
              />
            ))
          ) : (
            <Text style={styles.emptyText}>No active medications recorded</Text>
          )}
        </View>

        {/* ── Emergency Contacts ── */}
        <View style={[styles.section, styles.lastSection]}>
          <SectionHeader
            icon={<Phone size={22} color={C.orange} />}
            label="EMERGENCY CONTACTS"
          />
          {hasContacts ? (
            sortedContacts.map((c, i) => (
              <ContactRow
                key={`contact-${i}`}
                name={c.name}
                phone={c.phone}
                relation={c.relation}
                isPrimary={c.isPrimary}
              />
            ))
          ) : (
            <Text style={styles.emptyText}>No emergency contacts recorded</Text>
          )}
        </View>

        {/* ── Footer ── */}
        <Text style={styles.footer}>
          Powered by Nuralix — emergency data stored securely on this device
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: C.offWhite,
  },
  centerFill: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // No-cache state
  noCacheContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 24,
  },
  noCacheTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: C.red,
    textAlign: 'center',
  },
  noCacheBody: {
    fontSize: 18,
    lineHeight: 26,
    color: C.darkText,
    textAlign: 'center',
  },

  // Scroll content
  scrollContent: {
    padding: 16,
    gap: 12,
  },

  // Stale banner
  staleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.amberBg,
    borderWidth: 1,
    borderColor: C.amberBorder,
    borderRadius: 10,
    padding: 12,
  },
  staleBannerText: {
    flex: 1,
    fontSize: 15,
    color: C.amber,
    fontWeight: '600',
  },

  // Header card
  headerCard: {
    backgroundColor: C.white,
    borderRadius: 14,
    padding: 16,
    borderWidth: 2,
    borderColor: C.red,
    ...Platform.select({
      ios: {
        shadowColor: C.red,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
      },
      android: { elevation: 4 },
    }),
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  emergencyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.red,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  headerTextBlock: {
    flex: 1,
  },
  emergencyLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: C.red,
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  patientName: {
    fontSize: 24,
    fontWeight: '800',
    color: C.darkText,
    marginBottom: 2,
  },
  bloodType: {
    fontSize: 17,
    fontWeight: '700',
    color: C.red,
    marginBottom: 2,
  },
  subInfo: {
    fontSize: 15,
    color: C.mutedText,
  },
  lastUpdated: {
    fontSize: 13,
    color: C.mutedText,
    marginTop: 10,
  },
  refreshButton: {
    padding: 8,
    flexShrink: 0,
  },

  // Sections
  section: {
    backgroundColor: C.white,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.borderLight,
    gap: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },
  lastSection: {
    marginBottom: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: C.orange,
    letterSpacing: 0.5,
  },
  emptyText: {
    fontSize: 16,
    color: C.mutedText,
    fontStyle: 'italic',
    paddingVertical: 4,
  },

  // Rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
    gap: 10,
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  rowPrimary: {
    fontSize: 17,
    fontWeight: '700',
    color: C.darkText,
  },
  rowSecondary: {
    fontSize: 15,
    color: C.mutedText,
  },

  // Allergy badges
  badgeDanger: {
    backgroundColor: C.redBg,
    borderWidth: 1,
    borderColor: C.redBorder,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 0,
  },
  badgeDangerText: {
    fontSize: 13,
    fontWeight: '700',
    color: C.red,
  },
  badgeWarning: {
    backgroundColor: C.orangeBg,
    borderWidth: 1,
    borderColor: C.orangeBorder,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 0,
  },
  badgeWarningText: {
    fontSize: 13,
    fontWeight: '700',
    color: C.orange,
  },

  // Contact rows
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
    gap: 10,
  },
  contactNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  primaryBadge: {
    backgroundColor: C.greenBg,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  primaryBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: C.green,
    letterSpacing: 0.5,
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.red,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexShrink: 0,
    minWidth: 70,
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: C.red,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: { elevation: 3 },
    }),
  },
  callButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: C.white,
    letterSpacing: 0.5,
  },

  // Footer
  footer: {
    fontSize: 13,
    color: C.mutedText,
    textAlign: 'center',
    paddingVertical: 8,
    paddingBottom: 16,
  },
});
