/**
 * Health Data Export screen.
 * Lets users download all their PHI as a JSON file (GDPR Article 20 right to portability).
 * Calls GET /api/user/export — returns a JSON blob.
 */
import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useTheme } from '@/contexts/ThemeContext';
import { api } from '@/lib/apiClient';

export default function ExportDataScreen() {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const data = await api.get('/api/user/export');
      const json = JSON.stringify(data, null, 2);
      const fileUri = FileSystem.documentDirectory + 'nuralix-health-export.json';
      await FileSystem.writeAsStringAsync(fileUri, json, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: 'Save your health data',
        UTI: 'public.json',
      });
    } catch {
      Alert.alert('Export failed', 'Could not export your data. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background.primary }]}
    >
      <Stack.Screen options={{ title: 'Export My Data', headerBackTitle: 'Back', headerShown: true }} />
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.colors.text.primary }]}>
          Download Your Health Data
        </Text>
        <Text style={[styles.description, { color: theme.colors.text.secondary }]}>
          Export all your health data as a JSON file. This includes your vitals, medications,
          symptoms, lab results, and more. You can import this into other health apps.
        </Text>
        <Text style={[styles.note, { color: theme.colors.text.secondary }]}>
          Your data export may take a moment to prepare. Under GDPR Article 20 you have
          the right to receive your personal data in a portable format.
        </Text>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.colors.primary.main }]}
          onPress={handleExport}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Export All My Data</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: 24 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  description: { fontSize: 15, lineHeight: 22, marginBottom: 16 },
  note: { fontSize: 13, fontStyle: 'italic', marginBottom: 32 },
  button: { borderRadius: 12, padding: 16, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
