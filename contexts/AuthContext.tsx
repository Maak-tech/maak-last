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

  // Helper function to create/get user document from Firestore
  const getUserDocument = async (
    firebaseUser: FirebaseUser
  ): Promise<User | null> => {
    try {
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        return {
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          name: userData.name || firebaseUser.displayName || 'User',
          avatar: userData.avatar,
          familyId: userData.familyId,
          role: userData.role || 'admin',
          createdAt: userData.createdAt?.toDate() || new Date(),
          onboardingCompleted: userData.onboardingCompleted || false,
          preferences: userData.preferences || {
            language: 'en',
            notifications: true,
            emergencyContacts: [],
          },
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting user document:', error);
      return null;
    }
  };

  // Helper function to create user document in Firestore
  const createUserDocument = async (
    firebaseUser: FirebaseUser,
    name: string
  ): Promise<User> => {
    const userData: Omit<User, 'id'> = {
      email: firebaseUser.email || '',
      name,
      role: 'admin',
      createdAt: new Date(),
      onboardingCompleted: false,
      preferences: {
        language: 'en',
        notifications: true,
        emergencyContacts: [],
      },
    };

    try {
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      await setDoc(userDocRef, userData);

      return {
        id: firebaseUser.uid,
        ...userData,
      };
    } catch (error) {
      console.error('Error creating user document:', error);
      throw new Error('Failed to create user profile');
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log(
        '🔥 Auth state changed:',
        firebaseUser ? 'User logged in' : 'User logged out'
      );
      try {
        if (firebaseUser) {
          console.log('📧 User email:', firebaseUser.email);
          console.log('🆔 User ID:', firebaseUser.uid);

          // User is signed in - ensure user document exists
          console.log('🔄 Ensuring user document exists...');
          const userData = await userService.ensureUserDocument(
            firebaseUser.uid,
            firebaseUser.email || '',
            firebaseUser.displayName || 'User'
          );

          console.log(
            '✅ User data found/created:',
            userData.name,
            'Onboarding:',
            userData.onboardingCompleted,
            'FamilyId:',
            userData.familyId
          );
          console.log(
            '🔄 AuthContext: Setting user state via onAuthStateChanged'
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
          }, 3000); // Wait 3 seconds to ensure auth is fully ready

          // Check for pending family code after authentication
          console.log('🔍 Checking for pending family code...');
          const familyCodeProcessed = await processPendingFamilyCode(
            firebaseUser.uid
          );
          console.log('📋 Family code processing result:', familyCodeProcessed);

          // Only ensure user has family if no family code was successfully processed
          if (!familyCodeProcessed) {
            console.log(
              '🏠 No family code processed, ensuring user has default family...'
            );
            await ensureUserHasFamily(firebaseUser.uid);
          } else {
            console.log(
              '✅ Family code was processed successfully, skipping default family creation'
            );
          }

          console.log('🎯 Auth state change processing completed');
        } else {
          // User is signed out
          console.log('🚪 User signed out');
          setUser(null);
        }
      } catch (error) {
        console.error('❌ Auth state change error:', error);
        console.error('Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          code: (error as any)?.code,
          stack: error instanceof Error ? error.stack : undefined,
        });
        setUser(null);
      } finally {
        console.log('🏁 Setting loading to false');
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  // Helper function to process pending family codes
  const processPendingFamilyCode = async (userId: string) => {
    try {
      const familyData = await api.get<Record<string, unknown> | null>(
        `/api/family/${familyId}`
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
        const familyId = await userService.createFamily(
          userId,
          `${currentUser?.name}'s Family` || 'My Family'
        );

        console.log('✅ Default family created successfully:', familyId);

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
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      // Ensure user document exists - onAuthStateChanged will handle setting the user state
      await userService.ensureUserDocument(
        userCredential.user.uid,
        userCredential.user.email || '',
        userCredential.user.displayName || 'User'
      );

      console.log(
        '✅ SignIn successful - onAuthStateChanged will handle user state'
      );
    } catch (error: any) {
      console.error('Sign in error:', error);
      let errorMessage = 'Failed to sign in. Please try again.';

      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      } else if (error.code === 'auth/too-many-requests') {
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

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      console.log('✅ Firebase account created, creating user document...');

      // Create user document - onAuthStateChanged will handle setting the user state
      await userService.ensureUserDocument(
        userCredential.user.uid,
        userCredential.user.email || '',
        name
      );

      console.log(
        '✅ User document created, onAuthStateChanged will handle the rest'
      );

      // Don't manually set user - let onAuthStateChanged handle it
      // The onAuthStateChanged listener will:
      // 1. Get the user document
      // 2. Process any pending family codes
      // 3. Create a default family if needed
      // 4. Set the user state
      // 5. Set loading to false
    } catch (error: any) {
      console.error('Sign up error:', error);
      let errorMessage = 'Failed to create account. Please try again.';

      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'An account with this email already exists.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password should be at least 6 characters.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      }

      setLoading(false); // Only set loading to false on error
      throw new Error(errorMessage);
    }
    // Don't set loading to false here - onAuthStateChanged will handle it
  };

  const logout = async () => {
    try {
      await api.patch(`/api/user/profile`, userData).catch(() => {});
      setUser({ ...user, ...userData });
    } catch {
      throw new Error("Failed to update user. Please try again.");
    }
  };

  const updateUser = async (userData: Partial<User>) => {
    if (!user) return;

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: "nuralix://reset-password",
    });
    if (error) throw new Error(mapAuthError(error, "resetPassword"));
  }, []);

      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
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
