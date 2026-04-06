/**
 * AI & Privacy screen
 *
 * Lets users review and manage their consent for AI-powered health insights
 * (Nora chat, VHI trend analysis). Consent is persisted via aiConsentService.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import { ArrowLeft, Brain, ShieldCheck, ShieldOff } from 'lucide-react-native';
import aiConsentService, { type AIConsent } from '../../lib/services/aiConsentService';

export default function AiDataSharingScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [consent, setConsent] = useState<AIConsent | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const loadConsent = useCallback(async () => {
    try {
      const c = await aiConsentService.getConsent();
      setConsent(c);
    } catch (err: unknown) {
      console.error('[AiDataSharing] Failed to load consent:', err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConsent();
  }, [loadConsent]);

  const handleToggle = async (value: boolean) => {
    if (toggling) return;
    setToggling(true);
    try {
      await aiConsentService.setConsent(value);
      const updated = await aiConsentService.getConsent();
      setConsent(updated);
    } catch (err: unknown) {
      console.error('[AiDataSharing] Failed to set consent:', err instanceof Error ? err.message : String(err));
      Alert.alert('Error', 'Could not update your preference. Please try again.');
    } finally {
      setToggling(false);
    }
  };

  const handleRevoke = () => {
    Alert.alert(
      'Revoke AI Data Sharing?',
      'Are you sure? Nora will no longer be able to give you personalized health insights.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            setToggling(true);
            try {
              await aiConsentService.revokeConsent();
              const updated = await aiConsentService.getConsent();
              setConsent(updated);
            } catch (err: unknown) {
              console.error('[AiDataSharing] Failed to revoke consent:', err instanceof Error ? err.message : String(err));
              Alert.alert('Error', 'Could not revoke consent. Please try again.');
            } finally {
              setToggling(false);
            }
          },
        },
      ]
    );
  };

  const formattedDate = consent?.consentedAt
    ? new Date(consent.consentedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('aiDataSharing.title', 'AI & Privacy')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

          {/* Hero card */}
          <View style={styles.heroCard}>
            <View style={styles.heroIcon}>
              <Brain size={40} color="#2563EB" />
            </View>
            <Text style={styles.heroTitle}>Nora AI Data Sharing</Text>
            <Text style={styles.heroDescription}>
              Control whether Nora can use your personal health data to give you
              tailored insights and recommendations.
            </Text>
          </View>

          {/* Consent toggle card */}
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleLabelGroup}>
                <Text style={styles.toggleLabel}>Enable AI Personalization</Text>
                <Text style={styles.toggleSublabel}>
                  Allow Nora to reference your health trends and risk scores
                </Text>
              </View>
              <Switch
                value={consent?.consented === true}
                onValueChange={handleToggle}
                disabled={toggling}
                trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
                thumbColor={consent?.consented ? '#2563EB' : '#94A3B8'}
              />
            </View>

            {consent?.consented && formattedDate && (
              <View style={styles.consentDateRow}>
                <ShieldCheck size={14} color="#16A34A" />
                <Text style={styles.consentDateText}>
                  Consent given on {formattedDate}
                </Text>
              </View>
            )}
          </View>

          {/* What IS shared */}
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <ShieldCheck size={18} color="#2563EB" />
              <Text style={styles.sectionTitle}>What Is Shared with Nora</Text>
            </View>
            <Text style={styles.sectionIntro}>
              When AI personalization is enabled, the following data is sent to
              OpenAI GPT-4o to generate Nora's responses:
            </Text>
            {[
              'Health data trends (e.g., "your blood pressure has been rising over 3 weeks") — not raw values',
              'VHI risk level and contributing factors (e.g., "moderate risk due to low medication adherence")',
              'Conversation history within the current session',
            ].map((item, i) => (
              <View key={i} style={styles.bulletRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))}
            <View style={styles.divider} />
            <Text style={styles.processorNote}>
              OpenAI processes this data according to their{' '}
              <Text style={styles.link}>privacy policy</Text>. We are working to
              enable{' '}
              <Text style={styles.emphasisText}>Zero Data Retention (ZDR)</Text>{' '}
              through an Enterprise Business Associate Agreement (BAA) with
              OpenAI, which would prevent OpenAI from storing or training on
              your data.
            </Text>
          </View>

          {/* What is NOT shared */}
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <ShieldOff size={18} color="#DC2626" />
              <Text style={styles.sectionTitle}>What Is Never Shared</Text>
            </View>
            {[
              'Exact lab values or raw test results',
              'Raw vitals numbers (e.g., exact blood pressure readings)',
              'Medication names or doses',
              'Your name or contact information',
            ].map((item, i) => (
              <View key={i} style={styles.bulletRow}>
                <Text style={styles.bulletNever}>✕</Text>
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))}
          </View>

          {/* Impact of revoking */}
          {!consent?.consented && (
            <View style={[styles.card, styles.infoCard]}>
              <Text style={styles.infoTitle}>AI Personalization is Off</Text>
              <Text style={styles.infoText}>
                Without consent, Nora can still answer general health questions
                but cannot reference your personal health data, risk scores, or
                trends.
              </Text>
            </View>
          )}

          {/* Revoke button */}
          {consent?.consented && (
            <View style={styles.revokeSection}>
              <Text style={styles.revokeWarning}>
                Without consent, Nora can still answer general health questions
                but cannot reference your personal health data, risk scores, or
                trends.
              </Text>
              <TouchableOpacity
                style={[styles.revokeButton, toggling && styles.revokeButtonDisabled]}
                onPress={handleRevoke}
                disabled={toggling}
              >
                {toggling ? (
                  <ActivityIndicator size="small" color="#DC2626" />
                ) : (
                  <Text style={styles.revokeButtonText}>Revoke AI Data Sharing</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  heroCard: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#FFFFFF',
    marginTop: 20,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EBF4FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 22,
    fontFamily: 'Inter-Bold',
    color: '#1E293B',
    marginBottom: 8,
    textAlign: 'center',
  },
  heroDescription: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLabelGroup: {
    flex: 1,
    marginRight: 12,
  },
  toggleLabel: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
    marginBottom: 2,
  },
  toggleSublabel: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
  },
  consentDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  consentDateText: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#16A34A',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
  },
  sectionIntro: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 20,
    marginBottom: 12,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  bullet: {
    fontSize: 16,
    color: '#2563EB',
    lineHeight: 20,
    marginTop: 1,
  },
  bulletNever: {
    fontSize: 13,
    color: '#DC2626',
    lineHeight: 20,
    fontFamily: 'Inter-Bold',
    marginTop: 1,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 12,
  },
  processorNote: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
    lineHeight: 19,
  },
  link: {
    color: '#2563EB',
    textDecorationLine: 'underline',
  },
  emphasisText: {
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
  },
  infoCard: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  infoTitle: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#0369A1',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#0C4A6E',
    lineHeight: 20,
  },
  revokeSection: {
    marginBottom: 8,
  },
  revokeWarning: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
    lineHeight: 19,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  revokeButton: {
    borderWidth: 1.5,
    borderColor: '#DC2626',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#FFF1F2',
  },
  revokeButtonDisabled: {
    opacity: 0.5,
  },
  revokeButtonText: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#DC2626',
  },
  bottomSpacer: {
    height: 32,
  },
});
