/* biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: Auth lifecycle and migration flows are intentionally centralized. */
/* biome-ignore-all lint/suspicious/noExplicitAny: Legacy error handling paths still use dynamic error payloads. */
import type React from "react";
import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { Alert, I18nManager } from "react-native";
import { router } from "expo-router";
import { api, setUnauthorizedHandler } from "@/lib/apiClient";
import { authClient } from "@/lib/authClient";
import { fcmService } from "@/lib/services/fcmService";
import { userService } from "@/lib/services/userService";
import { logger } from "@/lib/utils/logger";
import type { User } from "@/types";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let fcmInitTimer: ReturnType<typeof setTimeout> | null = null;

    const initSession = async () => {
      try {
        const session = await authClient.getSession();
        const sessionUser = session?.data?.user;

        if (!sessionUser) {
          if (!cancelled) {
            setUser(null);
            setLoading(false);
          }
          return;
        }

        const userData = await userService.ensureUserDocument(
          sessionUser.id,
          sessionUser.email ?? '',
          (sessionUser as { name?: string }).name ?? 'User'
        );

        if (cancelled) return;

        setUser(userData);

        // Initialize FCM for push notifications (with delay to ensure auth is ready)
        fcmInitTimer = setTimeout(() => {
          if (!cancelled) {
            fcmService
              .initializeFCM(userData.id)
              .catch((error: unknown) => {
                console.warn('[AuthContext] FCM initialization error:', error instanceof Error ? error.message : String(error));
              });
          }
        }, 3000);

        // Check for pending family code; if none processed, create a default family
        const familyCodeProcessed = await processPendingFamilyCode(sessionUser.id);
        if (!familyCodeProcessed) {
          await ensureUserHasFamily(sessionUser.id);
        }
      } catch (error: unknown) {
        console.error('❌ Session init error:', error instanceof Error ? error.message : String(error));
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    initSession();
    return () => {
      cancelled = true;
      if (fcmInitTimer !== null) clearTimeout(fcmInitTimer);
    };
  }, []);

  // Helper function to process pending family codes
  const processPendingFamilyCode = async (userId: string) => {
    try {
      const currentUser = await userService.getUser(userId);
      if (!currentUser?.familyId) return false;

      const familyData = await api.get<Record<string, unknown> | null>(
        `/api/family/${currentUser.familyId}`
      ).catch((err: unknown) => {
        console.debug('[AuthContext] Family data fetch failed (may be stale familyId):', err instanceof Error ? err.message : String(err));
        return null;
      });
      if (familyData == null) {
        await userService.updateUser(userId, { familyId: undefined, role: "admin" });
        return false;
      }
      const status = (familyData.status as string | undefined) ?? "active";
      const members: string[] = (familyData.members as string[] | undefined) ?? [];
      const isMember = members.length === 0 || members.includes(userId);
      const isActive = status !== "inactive";
      const hasActiveFamily = isActive && isMember;
      if (!hasActiveFamily) await userService.updateUser(userId, { familyId: undefined, role: "admin" });
      return hasActiveFamily;
    } catch (err: unknown) {
      logger.error("Failed to check family membership", err, "AuthContext");
      return false;
    }
  };

  // Helper function to ensure user has a family (create default if needed)
  const ensureUserHasFamily = async (userId: string) => {
    try {
      const currentUser = await userService.getUser(userId);
      if (!currentUser?.familyId) {
        // Create a default family for the user
        const familyName = currentUser?.name ? `${currentUser.name}'s Family` : 'My Family';
        await userService.createFamily(
          userId,
          familyName
        );
        // Refresh user state to reflect the new family
        const updatedUser = await userService.getUser(userId);
        if (updatedUser) setUser(updatedUser);
      }
    } catch (error: unknown) {
      console.error('[AuthContext] Error ensuring user has family:', error instanceof Error ? error.message : error);
    }
  };

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const result = await authClient.signIn.email({ email, password });

      if (result.error) {
        throw new Error(result.error.message ?? 'Failed to sign in.');
      }

      const sessionUser = result.data?.user;
      if (!sessionUser) throw new Error('Failed to sign in. Please try again.');

      // Ensure user document exists and update auth state immediately
      const userData = await userService.ensureUserDocument(
        sessionUser.id,
        sessionUser.email ?? '',
        (sessionUser as { name?: string }).name ?? 'User'
      );
      setUser(userData);
      // signIn succeeded
    } catch (error: unknown) {
      console.error('Sign in error:', error instanceof Error ? error.message : String(error));
      // better-auth returns a plain message string; map common messages to user-friendly text.
      // Note: Firebase error codes (auth/user-not-found, etc.) were removed — better-auth
      // never emits them and they were dead code after the Firebase → better-auth migration.
      const raw: string = (error instanceof Error ? error.message : null) || 'Failed to sign in. Please try again.';
      let errorMessage = raw;
      if (raw.toLowerCase().includes('invalid') && raw.toLowerCase().includes('email')) {
        errorMessage = 'Invalid email address.';
      } else if (raw.toLowerCase().includes('rate') || raw.toLowerCase().includes('too many')) {
        errorMessage = 'Too many failed attempts. Please try again later.';
      }
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    setLoading(true);
    try {
      const result = await authClient.signUp.email({ email, password, name });

      if (result.error) {
        throw new Error(result.error.message ?? 'Failed to create account.');
      }

      const sessionUser = result.data?.user;
      if (!sessionUser) throw new Error('Failed to create account. Please try again.');

      // Create user document
      await userService.ensureUserDocument(
        sessionUser.id,
        sessionUser.email ?? '',
        name
      );
    } catch (error: unknown) {
      console.error('Sign up error:', error instanceof Error ? error.message : String(error));
      // better-auth returns plain message strings; map to user-friendly text.
      // Firebase error codes (auth/email-already-in-use etc.) removed — dead code post-migration.
      const raw: string = (error instanceof Error ? error.message : null) || 'Failed to create account. Please try again.';
      let errorMessage = raw;
      if (raw.toLowerCase().includes('already') || raw.toLowerCase().includes('exists')) {
        errorMessage = 'An account with this email already exists.';
      } else if (raw.toLowerCase().includes('weak') || raw.toLowerCase().includes('password')) {
        errorMessage = 'Password should be at least 8 characters.';
      } else if (raw.toLowerCase().includes('invalid') && raw.toLowerCase().includes('email')) {
        errorMessage = 'Invalid email address.';
      }
      throw new Error(errorMessage);
      // Note: do NOT call setLoading(false) here — the finally block handles it unconditionally.
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authClient.signOut();
      setUser(null);
    } catch (err: unknown) {
      console.warn('[AuthContext] signOut failed:', err instanceof Error ? err.message : String(err));
      throw new Error('Failed to sign out. Please try again.');
    }
  };

  // Register a global 401 handler so that any API call that returns 401
  // (expired session) automatically clears state, alerts the user, and redirects to login.
  useEffect(() => {
    setUnauthorizedHandler(async () => {
      // Clear user state immediately
      setUser(null);

      // Also sign out on the auth client side (best-effort)
      authClient.signOut().catch((err: unknown) => {
        console.warn('[AuthContext] signOut during 401 handler failed:', err instanceof Error ? err.message : String(err));
      });

      const isRTL = I18nManager.isRTL;
      Alert.alert(
        isRTL ? 'انتهت الجلسة' : 'Session Expired',
        isRTL
          ? 'انتهت صلاحية جلستك. يرجى تسجيل الدخول مرة أخرى.'
          : 'Your session has expired. Please sign in again.',
        [
          {
            text: isRTL ? 'حسناً' : 'Sign In',
            onPress: () => router.replace('/(auth)/login'),
          },
        ],
        { cancelable: false }
      );
    });
    // No cleanup needed — the handler is module-level and remains valid for the
    // lifetime of the AuthProvider (which wraps the entire app).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateUser = async (userData: Partial<User>) => {
    if (!user) return;
    try {
      await api.patch(`/api/user/profile`, userData).catch((err: unknown) => {
        console.warn('[AuthContext] Failed to sync profile update to API:', err instanceof Error ? err.message : String(err));
      });
      setUser({ ...user, ...userData });
    } catch (error: unknown) {
      console.error('Update user error:', error instanceof Error ? error.message : String(error));
      throw new Error('Failed to update user. Please try again.');
    }
  };

  const value = {
    user,
    loading,
    signIn,
    signUp,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
