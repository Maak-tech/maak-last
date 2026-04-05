/**
 * AnomalyDashboardSection
 *
 * Shows real-time vital anomaly alerts on the home dashboard.
 * Subscribes to RealtimeHealthContext for live anomaly events and also
 * polls the anomaly history API on mount to surface any active (unacknowledged)
 * anomalies from the last 24 hours.
 *
 * When `onlyWhenActive` is true the section renders nothing if there are zero
 * unacknowledged anomalies — keeping the dashboard clean for healthy users.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AlertTriangle, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useRealtimeHealthContext } from '@/contexts/RealtimeHealthContext';
import type { VitalAnomaly } from '@/types/discoveries';
import { api } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { anomalyDetectionService } from '@/lib/services/anomalyDetectionService';

interface AnomalyDashboardSectionProps {
  onlyWhenActive?: boolean;
}

const SEVERITY_COLOR = {
  critical: '#DC2626',
  warning: '#D97706',
} as const;

const SEVERITY_BG = {
  critical: '#FEF2F2',
  warning: '#FFFBEB',
} as const;

export default function AnomalyDashboardSection({ onlyWhenActive = false }: AnomalyDashboardSectionProps) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { anomalyDetectedEvent } = useRealtimeHealthContext();

  const [anomalies, setAnomalies] = useState<VitalAnomaly[]>([]);
  const isRTL = i18n.language === 'ar';

  // ── Load recent unacknowledged anomalies on mount ──────────────────────────
  const loadRecent = useCallback(async () => {
    if (!user?.id) return;
    try {
      const since = new Date();
      since.setHours(since.getHours() - 24);
      const raw = await api.get<VitalAnomaly[]>(
        `/api/health/anomalies?from=${since.toISOString()}&limit=10`
      ).catch((err) => { console.warn('[AnomalyDashboardSection] Failed to fetch anomaly history:', err); return [] as VitalAnomaly[]; });
      const active = (Array.isArray(raw) ? raw : []).filter(
        (a) => !a.isAcknowledged && !a.acknowledged
      );
      setAnomalies(active);
    } catch (err: unknown) {
      console.warn('[AnomalyDashboardSection] Failed to load recent anomalies:', err);
    }
  }, [user?.id]);

  useEffect(() => { loadRecent(); }, [loadRecent]);

  // ── React to real-time anomaly events ─────────────────────────────────────
  useEffect(() => {
    if (!anomalyDetectedEvent?.data) return;
    const incoming = anomalyDetectedEvent.data;
    setAnomalies((prev) => {
      // Avoid duplicates
      if (prev.some((a) => a.id === incoming.id)) return prev;
      return [incoming, ...prev].slice(0, 10);
    });
  }, [anomalyDetectedEvent]);

  const handleDismiss = useCallback(async (anomalyId: string) => {
    setAnomalies((prev) => prev.filter((a) => a.id !== anomalyId));
    if (user?.id) {
      await anomalyDetectionService.acknowledgeAnomaly(user.id, anomalyId).catch((err) => {
        console.warn('[AnomalyDashboardSection] Failed to acknowledge anomaly:', err);
      });
    }
  }, [user?.id]);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (onlyWhenActive && anomalies.length === 0) return null;
  if (anomalies.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, isRTL && styles.rtl]}>
        {isRTL ? 'تنبيهات المؤشرات الحيوية' : 'Vital Sign Alerts'}
      </Text>

      {anomalies.map((anomaly) => {
        const sev = anomaly.severity ?? 'warning';
        const color = SEVERITY_COLOR[sev] ?? SEVERITY_COLOR.warning;
        const bg    = SEVERITY_BG[sev]  ?? SEVERITY_BG.warning;
        const label = anomaly.vitalType ?? anomaly.type ?? 'vital';
        const message = isRTL
          ? (anomaly.recommendationAr ?? anomaly.recommendation ?? (isRTL ? 'تم اكتشاف قراءة غير طبيعية' : 'Abnormal reading detected'))
          : (anomaly.recommendation ?? 'Abnormal reading detected');

        return (
          <View key={anomaly.id} style={[styles.card, { backgroundColor: bg, borderLeftColor: color }]}>
            <AlertTriangle size={16} color={color} style={styles.icon} />
            <View style={styles.content}>
              <Text style={[styles.label, { color }, isRTL && styles.rtl]}>
                {label.replace(/_/g, ' ').toUpperCase()}
                {anomaly.value != null ? `  ${anomaly.value} ${anomaly.unit ?? ''}` : ''}
              </Text>
              <Text style={[styles.message, isRTL && styles.rtl]}>{message}</Text>
            </View>
            <TouchableOpacity onPress={() => handleDismiss(anomaly.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={14} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    borderRadius: 10,
    borderLeftWidth: 3,
    marginBottom: 6,
  },
  icon: {
    marginTop: 1,
    marginRight: 8,
  },
  content: {
    flex: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  message: {
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 17,
  },
  rtl: {
    textAlign: 'right',
  },
});
