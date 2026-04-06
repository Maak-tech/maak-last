/**
 * Account deletion screen — GDPR Article 17 right to erasure.
 * Requires typing "DELETE" to confirm. Shows 30-day grace period notice.
 * Calls DELETE /api/user/me on confirmation.
 */
import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TextInput,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { AlertTriangle } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { api } from '@/lib/apiClient';

const DELETED_ITEMS = [
  'All vital signs and health metrics',
  'Medication history and schedules',
  'Symptom logs and health notes',
  'Lab results and documents',
  'Family connections and shared data',
  'Notifications and alert history',
  'Account settings and preferences',
];

export default function DeleteAccountScreen() {
  const { theme } = useTheme();
  const { logout } = useAuth();
  const router = useRouter();
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);

  const isConfirmed = confirmText.trim() === 'DELETE';

  async function handleDeleteAccount() {
    if (!isConfirmed) return;

    Alert.alert(
      'Final Confirmation',
      'Are you absolutely sure? This action cannot be undone. All your health data will be permanently deleted after a 30-day grace period.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Delete My Account',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await api.delete('/api/user/me');
              await logout();
              // logout() will navigate away via AuthContext
            } catch {
              Alert.alert(
                'Deletion failed',
                'We could not delete your account at this time. Please try again or contact support.'
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background.primary }]}
    >
      <Stack.Screen
        options={{ title: 'Delete Account', headerBackTitle: 'Back', headerShown: true }}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Warning header */}
        <View style={[styles.warningBox, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
          <AlertTriangle size={28} color="#DC2626" style={styles.warningIcon} />
          <Text style={styles.warningTitle}>This cannot be undone</Text>
          <Text style={styles.warningText}>
            This will permanently delete all your health data. You will have a 30-day grace period
            during which you can contact support to cancel the deletion.
          </Text>
        </View>

        {/* What gets deleted */}
        <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
          The following will be permanently deleted:
        </Text>
        <View style={[styles.listBox, { backgroundColor: theme.colors.background.secondary }]}>
          {DELETED_ITEMS.map((item) => (
            <View key={item} style={styles.listRow}>
              <Text style={[styles.bullet, { color: '#DC2626' }]}>•</Text>
              <Text style={[styles.listItem, { color: theme.colors.text.secondary }]}>{item}</Text>
            </View>
          ))}
        </View>

        {/* Confirmation input */}
        <Text style={[styles.confirmLabel, { color: theme.colors.text.primary }]}>
          Type <Text style={styles.confirmWord}>DELETE</Text> to confirm:
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              borderColor: isConfirmed ? '#DC2626' : theme.colors.neutral[200],
              color: theme.colors.text.primary,
              backgroundColor: theme.colors.background.secondary,
            },
          ]}
          value={confirmText}
          onChangeText={setConfirmText}
          placeholder="Type DELETE here"
          placeholderTextColor={theme.colors.text.secondary}
          autoCapitalize="characters"
          autoCorrect={false}
        />

        {/* Delete button */}
        <TouchableOpacity
          style={[
            styles.deleteButton,
            { opacity: isConfirmed && !loading ? 1 : 0.4 },
          ]}
          onPress={handleDeleteAccount}
          disabled={!isConfirmed || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.deleteButtonText}>Delete My Account Permanently</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.cancelButton, { borderColor: theme.colors.neutral[200] }]}
          onPress={() => router.back()}
          disabled={loading}
        >
          <Text style={[styles.cancelButtonText, { color: theme.colors.text.secondary }]}>
            Cancel
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingBottom: 48 },
  warningBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  warningIcon: { marginBottom: 10 },
  warningTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#DC2626',
    marginBottom: 8,
    textAlign: 'center',
  },
  warningText: {
    fontSize: 14,
    color: '#7F1D1D',
    lineHeight: 20,
    textAlign: 'center',
  },
  sectionTitle: { fontSize: 15, fontWeight: '600', marginBottom: 12 },
  listBox: { borderRadius: 10, padding: 16, marginBottom: 24 },
  listRow: { flexDirection: 'row', marginBottom: 6 },
  bullet: { fontSize: 16, marginRight: 8, lineHeight: 20 },
  listItem: { fontSize: 14, lineHeight: 20, flex: 1 },
  confirmLabel: { fontSize: 15, marginBottom: 10 },
  confirmWord: { fontWeight: '700', color: '#DC2626' },
  input: {
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 24,
  },
  deleteButton: {
    backgroundColor: '#DC2626',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  deleteButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelButton: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: { fontSize: 16, fontWeight: '500' },
});
