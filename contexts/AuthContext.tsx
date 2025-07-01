import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
} from 'react';
import { Platform, Alert } from 'react-native';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { userService } from '@/lib/services/userService';
import { familyInviteService } from '@/lib/services/familyInviteService';
import { User } from '@/types';

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
      console.log('🔍 Starting processPendingFamilyCode for user:', userId);
      const AsyncStorage = await import(
        '@react-native-async-storage/async-storage'
      );

      // Add debugging to see all AsyncStorage keys
      try {
        const allKeys = await AsyncStorage.default.getAllKeys();
        console.log('🗂️ All AsyncStorage keys:', allKeys);
      } catch (error) {
        console.log('⚠️ Could not get AsyncStorage keys:', error);
      }

      const pendingCode = await AsyncStorage.default.getItem(
        'pendingFamilyCode'
      );
      console.log(
        '🔍 Retrieved pending family code from storage:',
        pendingCode
      );

      if (pendingCode) {
        console.log('📱 Found pending family code:', pendingCode);

        try {
          console.log('🔄 Attempting to use invitation code...');
          const result = await familyInviteService.useInvitationCode(
            pendingCode,
            userId
          );
          console.log('📋 Invitation code result:', result);

          if (result.success && result.familyId) {
            console.log(
              '✅ Invitation code valid, joining family:',
              result.familyId
            );

            // Join the family (this will handle leaving previous family properly)
            console.log('🔄 Starting family join process...');
            await userService.joinFamily(userId, result.familyId);
            console.log('✅ Family join process completed');

            // Clear the pending code
            console.log('🧹 Clearing pending family code from storage');
            await AsyncStorage.default.removeItem('pendingFamilyCode');

            // Refresh the user data to reflect the new family
            console.log('🔄 Refreshing user data...');
            const updatedUser = await userService.getUser(userId);
            console.log('📋 Updated user data:', {
              userId: updatedUser?.id,
              familyId: updatedUser?.familyId,
              name: updatedUser?.name,
            });
            if (updatedUser) {
              setUser(updatedUser);
              console.log('✅ User state updated in context');
            }

            // Show success message
            setTimeout(() => {
              Alert.alert(
                'Welcome to the Family!',
                result.message +
                  ' You can now see your family members in the Family tab.'
              );
            }, 2000);

            console.log('✅ Successfully joined family via pending code');
            return true; // Return true to indicate successful processing
          } else {
            console.log('❌ Failed to use family code:', result.message);
            // Clear the invalid code
            await AsyncStorage.default.removeItem('pendingFamilyCode');

            setTimeout(() => {
              Alert.alert(
                'Family Code Issue',
                result.message +
                  ' A default family has been created for you instead.'
              );
            }, 2000);
          }
        } catch (error) {
          console.error('❌ Error processing family code:', error);
          console.error('Error details:', {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: (error as any)?.code,
            stack: error instanceof Error ? error.stack : undefined,
          });

          setTimeout(() => {
            Alert.alert(
              'Family Code Error',
              'There was an issue processing your family invitation. A default family has been created for you. Please try using the code manually in the Family tab.'
            );
          }, 2000);
        }
      } else {
        console.log('📝 No pending family code found');
      }

      // Return false to indicate no family code was processed
      console.log('📝 Returning false - no successful invitation processing');
      return false; // Return false to indicate no successful processing
    } catch (error) {
      console.error('❌ Error in processPendingFamilyCode:', error);
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
      console.log('🚪 Starting logout process...');
      setLoading(true);

      // Clear any pending family codes from AsyncStorage
      try {
        const AsyncStorage = await import(
          '@react-native-async-storage/async-storage'
        );
        await AsyncStorage.default.removeItem('pendingFamilyCode');
        console.log('🧹 Cleared AsyncStorage');
      } catch (error) {
        console.log('Could not clear AsyncStorage on logout:', error);
      }

      // Sign out from Firebase
      await signOut(auth);
      console.log('🔥 Firebase signOut completed');

      // Set user to null immediately after successful signOut
      setUser(null);
      setLoading(false);

      console.log('✅ Logout completed successfully');
    } catch (error) {
      console.error('❌ Logout error:', error);
      // Force logout even if Firebase signOut fails to ensure user is logged out from the app
      setUser(null);
      setLoading(false);
      console.log('🔄 Forced logout due to error');
    }
  };

  const updateUser = async (userData: Partial<User>) => {
    if (!user) return;

    try {
      const userDocRef = doc(db, 'users', user.id);
      await updateDoc(userDocRef, userData);

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
