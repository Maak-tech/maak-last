/* biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: Auth lifecycle and migration flows are intentionally centralized. */
/* biome-ignore-all lint/suspicious/noExplicitAny: Legacy error handling paths still use dynamic error payloads. */
import type React from "react";
import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { Alert } from "react-native";
import { api } from "@/lib/apiClient";
import { authClient } from "@/lib/authClient";
import { familyInviteService } from "@/lib/services/familyInviteService";
import { fcmService } from "@/lib/services/fcmService";
import { revenueCatService } from "@/lib/services/revenueCatService";
import { userService } from "@/lib/services/userService";
import { logger } from "@/lib/utils/logger";
import type { AvatarType, EmergencyContact, User } from "@/types";

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

  // Debug user state changes
  useEffect(() => {
    console.log(
      '🎯 AuthContext: User state changed to:',
      user ? `${user.name} (${user.id})` : 'null'
    );
  }, [user]);

  useEffect(() => {
    let cancelled = false;

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

        console.log('🔥 Session found:', sessionUser.email);

        const userData = await userService.ensureUserDocument(
          sessionUser.id,
          sessionUser.email ?? '',
          (sessionUser as any).name ?? 'User'
        );

        if (cancelled) return;

        console.log(
          '✅ User data found/created:',
          userData.name,
          'Onboarding:',
          userData.onboardingCompleted,
          'FamilyId:',
          userData.familyId
        );
        setUser(userData);

        // Initialize FCM for push notifications (with delay to ensure auth is ready)
        console.log('📱 Scheduling FCM initialization for user:', userData.id);
        setTimeout(() => {
          console.log('📱 Now initializing FCM for user:', userData.id);
          fcmService
            .initializeFCM(userData.id)
            .then((success) => {
              if (success) {
                console.log('✅ FCM initialized successfully');
              } else {
                console.log(
                  '⚠️ FCM initialization failed - will use local notifications'
                );
              }
            })
            .catch((error) => {
              console.log('❌ FCM initialization error:', error);
            });
        }, 3000);

        // Check for pending family code after authentication
        console.log('🔍 Checking for pending family code...');
        const familyCodeProcessed = await processPendingFamilyCode(
          sessionUser.id
        );
        console.log('📋 Family code processing result:', familyCodeProcessed);

        // Only ensure user has family if no family code was successfully processed
        if (!familyCodeProcessed) {
          console.log(
            '🏠 No family code processed, ensuring user has default family...'
          );
          await ensureUserHasFamily(sessionUser.id);
        } else {
          console.log(
            '✅ Family code was processed successfully, skipping default family creation'
          );
        }

        console.log('🎯 Session init processing completed');
      } catch (error) {
        console.error('❌ Session init error:', error);
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    initSession();
    return () => { cancelled = true; };
  }, []);

  // Helper function to process pending family codes
  const processPendingFamilyCode = async (userId: string) => {
    try {
      const currentUser = await userService.getUser(userId);
      if (!currentUser?.familyId) return false;

      const familyData = await api.get<Record<string, unknown> | null>(
        `/api/family/${currentUser.familyId}`
      ).catch(() => null);
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
    } catch (_err) {
      logger.error("Failed to check family membership", _err, "AuthContext");
      return false;
    }
  };

  // Helper function to ensure user has a family (create default if needed)
  const ensureUserHasFamily = async (userId: string) => {
    try {
      console.log('🏠 Starting ensureUserHasFamily for user:', userId);
      const currentUser = await userService.getUser(userId);
      console.log('📋 Current user in ensureUserHasFamily:', {
        userId,
        familyId: currentUser?.familyId,
        name: currentUser?.name,
      });

      if (!currentUser?.familyId) {
        console.log('👨‍👩‍👧‍👦 Creating default family for user:', userId);

        // Create a default family for the user
        const newFamilyId = await userService.createFamily(
          userId,
          `${currentUser?.name}'s Family` || 'My Family'
        );

        console.log('✅ Default family created successfully:', newFamilyId);

        // Update the user state to reflect the new family
        console.log(
          '🔄 Refreshing user state after default family creation...'
        );
        const updatedUser = await userService.getUser(userId);
        console.log('📋 Updated user after default family creation:', {
          userId: updatedUser?.id,
          familyId: updatedUser?.familyId,
          name: updatedUser?.name,
        });
        if (updatedUser) {
          setUser(updatedUser);
          console.log('✅ User state updated after default family creation');
        }
      } else {
        console.log('ℹ️ User already has family:', currentUser.familyId);
      }
    } catch (error) {
      console.error('❌ Error ensuring user has family:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        code: (error as any)?.code,
        stack: error instanceof Error ? error.stack : undefined,
      });
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

      // Ensure user document exists
      await userService.ensureUserDocument(
        sessionUser.id,
        sessionUser.email ?? '',
        (sessionUser as any).name ?? 'User'
      );

      console.log('✅ SignIn successful');
    } catch (error: any) {
      console.error('Sign in error:', error);
      let errorMessage = error.message || 'Failed to sign in. Please try again.';

      if (error.code === 'auth/user-not-found' || errorMessage.includes('user-not-found')) {
        errorMessage = 'No account found with this email.';
      } else if (error.code === 'auth/wrong-password' || errorMessage.includes('wrong-password')) {
        errorMessage = 'Incorrect password.';
      } else if (error.code === 'auth/invalid-email' || errorMessage.includes('invalid-email')) {
        errorMessage = 'Invalid email address.';
      } else if (error.code === 'auth/too-many-requests' || errorMessage.includes('too-many-requests')) {
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
      console.log('🔄 Starting signup process for:', email);

      const result = await authClient.signUp.email({ email, password, name });

      if (result.error) {
        throw new Error(result.error.message ?? 'Failed to create account.');
      }

      const sessionUser = result.data?.user;
      if (!sessionUser) throw new Error('Failed to create account. Please try again.');

      console.log('✅ Account created, creating user document...');

      // Create user document
      await userService.ensureUserDocument(
        sessionUser.id,
        sessionUser.email ?? '',
        name
      );

      console.log('✅ User document created');
    } catch (error: any) {
      console.error('Sign up error:', error);
      let errorMessage = error.message || 'Failed to create account. Please try again.';

      if (error.code === 'auth/email-already-in-use' || errorMessage.includes('already')) {
        errorMessage = 'An account with this email already exists.';
      } else if (error.code === 'auth/weak-password' || errorMessage.includes('weak-password')) {
        errorMessage = 'Password should be at least 6 characters.';
      } else if (error.code === 'auth/invalid-email' || errorMessage.includes('invalid-email')) {
        errorMessage = 'Invalid email address.';
      }

      setLoading(false);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authClient.signOut();
      setUser(null);
    } catch (err) {
      console.warn('[AuthContext] signOut failed:', err);
      throw new Error('Failed to sign out. Please try again.');
    }
  };

  const updateUser = async (userData: Partial<User>) => {
    if (!user) return;
    try {
      await api.patch(`/api/user/profile`, userData).catch(() => {});
      setUser({ ...user, ...userData });
    } catch (error) {
      console.error('Update user error:', error);
      throw new Error('Failed to update user. Please try again.');
    }
  };

  // Temporarily remove useMemo to ensure re-renders
  console.log(
    '🔥 AuthContext: Creating context value with user:',
    user ? `${user.name} (${user.id})` : 'null',
    'loading:',
    loading
  );

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
