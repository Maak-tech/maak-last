/**
 * Family invitation acceptance screen.
 * Accessible via deep link: nuralix://join?code=XXXX or https://app.maak.health/join?code=XXXX
 * Also reachable from within the app when the user taps a "Join family" button.
 *
 * API flow:
 *   1. GET /api/family/invitations/code/:code  — look up invitation details (family name, inviter)
 *   2. POST /api/family/invitations/code/:code/use — claim the code and join the family
 */
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Users } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { api } from '@/lib/apiClient';

interface InvitationDetails {
  familyId: string;
  invitedUserName?: string;
  invitedBy?: string;
  inviteCode: string;
  status?: string;
  expiresAt?: string;
}

export default function JoinFamilyScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();

  // The code may come from the deep link query param or be typed manually
  const [code, setCode] = useState(params.code ?? '');
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // When a code is provided via deep link, auto-look it up
  useEffect(() => {
    if (params.code) {
      lookupInvitation(params.code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.code]);

  async function lookupInvitation(inviteCode: string) {
    const trimmed = inviteCode.trim().toUpperCase();
    if (!trimmed) return;

    setLookupLoading(true);
    setErrorMessage(null);
    setInvitation(null);

    try {
      const result = await api.get<InvitationDetails | null>(
        `/api/family/invitations/code/${encodeURIComponent(trimmed)}`
      );

      if (!result) {
        setErrorMessage('Invitation not found. Please check the code and try again.');
        return;
      }

      if (result.status === 'used') {
        setErrorMessage('This invitation has already been used.');
        return;
      }

      if (
        result.status === 'expired' ||
        (result.expiresAt && new Date(result.expiresAt) < new Date())
      ) {
        setErrorMessage('This invitation has expired. Please ask the family admin to send a new one.');
        return;
      }

      setInvitation(result);
    } catch {
      setErrorMessage('Could not look up the invitation. Please check the code and try again.');
    } finally {
      setLookupLoading(false);
    }
  }

  async function handleJoin() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;

    setJoinLoading(true);
    setErrorMessage(null);

    try {
      const result = await api.post<{ ok: boolean; familyId?: string; message?: string }>(
        `/api/family/invitations/code/${encodeURIComponent(trimmed)}/use`,
        {}
      );

      if (!result.ok) {
        setErrorMessage(result.message ?? 'Could not accept the invitation. Please try again.');
        return;
      }

      Alert.alert(
        'Welcome to the family!',
        'You have successfully joined the family group.',
        [
          {
            text: 'View Family',
            onPress: () => router.replace('/(tabs)'),
          },
        ]
      );
    } catch {
      setErrorMessage('Could not accept the invitation. The code may be expired or already used.');
    } finally {
      setJoinLoading(false);
    }
  }

  const hasDeepLinkCode = Boolean(params.code);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background.primary }]}
    >
      <Stack.Screen options={{ title: 'Join Family', headerShown: true }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          {/* Icon */}
          <View style={[styles.iconCircle, { backgroundColor: theme.colors.primary.main + '20' }]}>
            <Users size={40} color={theme.colors.primary.main} />
          </View>

          <Text style={[styles.title, { color: theme.colors.text.primary }]}>
            Join a Family Group
          </Text>

          {/* If invitation loaded successfully, show family info */}
          {invitation ? (
            <View style={[styles.inviteCard, { backgroundColor: theme.colors.background.secondary }]}>
              <Text style={[styles.inviteHeading, { color: theme.colors.text.primary }]}>
                You have been invited!
              </Text>
              {invitation.invitedUserName ? (
                <Text style={[styles.inviteDetail, { color: theme.colors.text.secondary }]}>
                  Hi {invitation.invitedUserName}, you have been invited to join a family group on Nuralix.
                </Text>
              ) : (
                <Text style={[styles.inviteDetail, { color: theme.colors.text.secondary }]}>
                  You have been invited to join a family group on Nuralix.
                </Text>
              )}
              <Text style={[styles.codeLabel, { color: theme.colors.text.secondary }]}>
                Invite code: <Text style={{ fontWeight: '700' }}>{invitation.inviteCode}</Text>
              </Text>
            </View>
          ) : (
            <>
              <Text style={[styles.description, { color: theme.colors.text.secondary }]}>
                {hasDeepLinkCode
                  ? 'Looking up your invitation…'
                  : 'Enter the invite code you received to join a family group.'}
              </Text>

              {/* Manual code input — shown when no deep-link code */}
              {!hasDeepLinkCode && (
                <TextInput
                  style={[
                    styles.input,
                    {
                      borderColor: errorMessage ? '#DC2626' : theme.colors.neutral[200],
                      color: theme.colors.text.primary,
                      backgroundColor: theme.colors.background.secondary,
                    },
                  ]}
                  value={code}
                  onChangeText={(v) => {
                    setCode(v);
                    setErrorMessage(null);
                  }}
                  placeholder="Enter invite code (e.g. ABC123)"
                  placeholderTextColor={theme.colors.text.secondary}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="go"
                  onSubmitEditing={() => lookupInvitation(code)}
                />
              )}
            </>
          )}

          {/* Error message */}
          {errorMessage && (
            <Text style={styles.errorText}>{errorMessage}</Text>
          )}

          {/* Action button */}
          {invitation ? (
            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: theme.colors.primary.main },
                joinLoading && styles.disabled,
              ]}
              onPress={handleJoin}
              disabled={joinLoading}
            >
              {joinLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Join Family</Text>
              )}
            </TouchableOpacity>
          ) : (
            !hasDeepLinkCode && (
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  { backgroundColor: theme.colors.primary.main },
                  (!code.trim() || lookupLoading) && styles.disabled,
                ]}
                onPress={() => lookupInvitation(code)}
                disabled={!code.trim() || lookupLoading}
              >
                {lookupLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Look Up Invitation</Text>
                )}
              </TouchableOpacity>
            )
          )}

          {/* Loading state for deep-link auto-lookup */}
          {hasDeepLinkCode && lookupLoading && (
            <ActivityIndicator
              size="large"
              color={theme.colors.primary.main}
              style={styles.centeredLoader}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1 },
  content: { flex: 1, padding: 24, alignItems: 'center' },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    marginTop: 16,
  },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  description: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 24 },
  inviteCard: {
    width: '100%',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
  },
  inviteHeading: { fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  inviteDetail: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 10 },
  codeLabel: { fontSize: 13, textAlign: 'center' },
  input: {
    width: '100%',
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 14,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 3,
    textAlign: 'center',
    marginBottom: 8,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  primaryButton: {
    width: '100%',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.4 },
  centeredLoader: { marginTop: 32 },
});
