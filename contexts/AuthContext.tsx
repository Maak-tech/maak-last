import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  type User as FirebaseUser,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import type React from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { Alert } from "react-native";
import { auth, db } from "@/lib/firebase";
import { familyInviteService } from "@/lib/services/familyInviteService";
import { fcmService } from "@/lib/services/fcmService";
import { userService } from "@/lib/services/userService";
import type { AvatarType, User } from "@/types";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    avatarType?: AvatarType
  ) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<void>;
  changePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Helper function to create/get user document from Firestore
  const getUserDocument = async (
    firebaseUser: FirebaseUser
  ): Promise<User | null> => {
    try {
      const userDocRef = doc(db, "users", firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        // Handle migration from old name field to firstName/lastName
        let firstName = userData.firstName;
        let lastName = userData.lastName;
        if (!(firstName || lastName) && userData.name) {
          // Migrate old name field
          const nameParts = (userData.name as string).split(" ");
          firstName = nameParts[0] || "User";
          lastName = nameParts.slice(1).join(" ") || "";
        }
        if (!firstName) firstName = "User";
        if (!lastName) lastName = "";

        return {
          id: firebaseUser.uid,
          email: firebaseUser.email || "",
          firstName: firstName || "User",
          lastName: lastName || "",
          avatar: userData.avatar,
          avatarType: userData.avatarType,
          familyId: userData.familyId,
          role: userData.role || "admin",
          createdAt: userData.createdAt?.toDate() || new Date(),
          onboardingCompleted: userData.onboardingCompleted,
          preferences: userData.preferences || {
            language: "en",
            notifications: true,
            emergencyContacts: [],
          },
        };
      }
      return null;
    } catch (error) {
      return null;
    }
  };

  // Helper function to create user document in Firestore
  const createUserDocument = async (
    firebaseUser: FirebaseUser,
    firstName: string,
    lastName: string
  ): Promise<User> => {
    const userData: Omit<User, "id"> = {
      email: firebaseUser.email || "",
      firstName,
      lastName,
      role: "admin",
      createdAt: new Date(),
      onboardingCompleted: false,
      preferences: {
        language: "en",
        notifications: true,
        emergencyContacts: [],
      },
    };

    try {
      const userDocRef = doc(db, "users", firebaseUser.uid);
      await setDoc(userDocRef, userData);

      return {
        id: firebaseUser.uid,
        ...userData,
      };
    } catch (error) {
      throw new Error("Failed to create user profile");
    }
  };

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Prevent processing if component unmounted
      if (!isMounted) return;

      try {
        if (firebaseUser) {
          // Check if user document already exists first
          let existingUser = null;
          try {
            existingUser = await userService.getUser(firebaseUser.uid);
          } catch (getUserError) {
            // Silently handle getUser error - will create new user document
          }

          // Only parse displayName if user doesn't exist yet
          // Otherwise use existing firstName/lastName to avoid overwriting
          let firstName = "User";
          let lastName = "";

          if (existingUser && existingUser.firstName) {
            // User exists with proper firstName/lastName, use those
            firstName = existingUser.firstName;
            lastName = existingUser.lastName || "";
          } else {
            // New user - parse displayName or use defaults
            const displayName = firebaseUser.displayName || "User";
            const nameParts = displayName.split(" ");
            firstName = nameParts[0] || "User";
            lastName = nameParts.slice(1).join(" ") || "";
          }

          if (!isMounted) return;

          const userData = await userService.ensureUserDocument(
            firebaseUser.uid,
            firebaseUser.email || "",
            firstName,
            lastName
          );

          if (!isMounted) return;

          if (!userData) {
            if (isMounted) {
              setUser(null);
              setLoading(false);
            }
            return;
          }

          if (isMounted) {
            setUser(userData);
          }

          // Initialize FCM in background (don't block on this)
          setTimeout(() => {
            if (isMounted) {
              fcmService.initializeFCM(userData.id).catch((error) => {
                // Silently fail - will use local notifications
              });
            }
          }, 3000);

          // DISABLED: Pre-warming HealthKit causes RCTModuleMethod errors at app startup
          // HealthKit will be loaded on-demand when user navigates to vitals screen
          // This ensures the native bridge is fully ready before loading the module

          // Process family code and ensure family exists (don't block on errors)
          if (isMounted) {
            try {
              const familyCodeProcessed = await processPendingFamilyCode(
                firebaseUser.uid,
                isMounted
              );

              if (!isMounted) return;

              if (!familyCodeProcessed) {
                await ensureUserHasFamily(firebaseUser.uid, isMounted);
              }
            } catch (error) {
              // Try to ensure family exists even if code processing failed
              if (isMounted) {
                try {
                  await ensureUserHasFamily(firebaseUser.uid, isMounted);
                } catch (familyError) {
                  // Silently handle family setup errors
                }
              }
            }
          }
        } else if (isMounted) {
          setUser(null);
        }
      } catch (error: any) {
        // Silently handle auth state change errors
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const processPendingFamilyCode = async (
    userId: string,
    isMounted: boolean
  ) => {
    try {
      const AsyncStorage = await import(
        "@react-native-async-storage/async-storage"
      );
      const pendingCode =
        await AsyncStorage.default.getItem("pendingFamilyCode");

      if (pendingCode) {
        try {
          const result = await familyInviteService.useInvitationCode(
            pendingCode,
            userId
          );

          if (result.success && result.familyId) {
            await userService.joinFamily(userId, result.familyId);
            await AsyncStorage.default.removeItem("pendingFamilyCode");

            if (!isMounted) return false;

            const updatedUser = await userService.getUser(userId);
            if (updatedUser && isMounted) {
              setUser(updatedUser);
            }

            setTimeout(() => {
              Alert.alert(
                "Welcome to the Family!",
                result.message +
                  " You can now see your family members in the Family tab."
              );
            }, 2000);

            return true;
          }

          await AsyncStorage.default.removeItem("pendingFamilyCode");
          setTimeout(() => {
            Alert.alert(
              "Family Code Issue",
              result.message +
                " A default family has been created for you instead."
            );
          }, 2000);
        } catch (error: any) {
          console.warn("Family code processing error:", error);
          await AsyncStorage.default
            .removeItem("pendingFamilyCode")
            .catch(() => {
              // Ignore cleanup errors
            });
          setTimeout(() => {
            Alert.alert(
              "Family Code Error",
              "There was an issue processing your family invitation. A default family has been created for you. Please try using the code manually in the Family tab."
            );
          }, 2000);
        }
      }

      return false;
    } catch (error: any) {
      console.warn("Failed to process pending family code:", error);
      return false;
    }
  };

  const ensureUserHasFamily = async (userId: string, isMounted: boolean) => {
    try {
      const currentUser = await userService.getUser(userId);

      if (!currentUser) {
        console.warn("Cannot ensure family: user not found");
        return;
      }

      if (!currentUser.familyId) {
        const fullName =
          currentUser.firstName && currentUser.lastName
            ? `${currentUser.firstName} ${currentUser.lastName}`
            : currentUser.firstName || "User";
        await userService.createFamily(
          userId,
          `${fullName}'s Family` || "My Family"
        );

        if (!isMounted) return;

        const updatedUser = await userService.getUser(userId);
        if (updatedUser && isMounted) {
          setUser(updatedUser);
        }
      }
    } catch (error: any) {
      console.warn("Failed to ensure user has family:", error);
      // Don't throw - this is not critical for user creation
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

      // Parse displayName into firstName and lastName
      const displayName = userCredential.user.displayName || "User";
      const nameParts = displayName.split(" ");
      const firstName = nameParts[0] || "User";
      const lastName = nameParts.slice(1).join(" ") || "";

      await userService.ensureUserDocument(
        userCredential.user.uid,
        userCredential.user.email || "",
        firstName,
        lastName
      );
    } catch (error: any) {
      // Silently handle error
      let errorMessage = "Failed to sign in. Please try again.";

      if (error.code === "auth/user-not-found") {
        errorMessage = "No account found with this email.";
      } else if (error.code === "auth/wrong-password") {
        errorMessage = "Incorrect password.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address.";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage = "Too many failed attempts. Please try again later.";
      }

      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    avatarType?: AvatarType
  ) => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      // Ensure user document is created with proper error handling
      try {
        await userService.ensureUserDocument(
          userCredential.user.uid,
          userCredential.user.email || "",
          firstName,
          lastName,
          avatarType
        );
      } catch (docError: any) {
        console.error("Failed to create user document:", docError);

        // Provide more specific error messages
        let docErrorMessage =
          "Failed to create user profile. Please try again.";
        if (docError?.code === "permission-denied") {
          docErrorMessage =
            "Permission denied. Please check your Firestore security rules.";
        } else if (docError?.code === "unavailable") {
          docErrorMessage =
            "Database unavailable. Please check your internet connection.";
        } else if (docError?.message) {
          docErrorMessage = docError.message;
        }

        // If document creation fails, try to delete the auth user to prevent orphaned accounts
        try {
          await signOut(auth);
        } catch (signOutError) {
          console.error(
            "Failed to sign out after document creation error:",
            signOutError
          );
        }

        setLoading(false);
        throw new Error(docErrorMessage);
      }
    } catch (error: any) {
      let errorMessage = "Failed to create account. Please try again.";

      if (error.code === "auth/email-already-in-use") {
        errorMessage = "An account with this email already exists.";
      } else if (error.code === "auth/weak-password") {
        errorMessage = "Password should be at least 6 characters.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address.";
      } else if (error.code === "auth/network-request-failed") {
        errorMessage = "Network error. Please check your internet connection.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      setLoading(false); // Only set loading to false on error
      throw new Error(errorMessage);
    }
    // Don't set loading to false here - onAuthStateChanged will handle it
  };

  const logout = async () => {
    try {
      setLoading(true);

      try {
        const AsyncStorage = await import(
          "@react-native-async-storage/async-storage"
        );
        await AsyncStorage.default.removeItem("pendingFamilyCode");
      } catch (error) {
        // Silently fail
      }

      await signOut(auth);
      setUser(null);
      setLoading(false);
    } catch (error) {
      setUser(null);
      setLoading(false);
    }
  };

  const updateUser = async (userData: Partial<User>) => {
    if (!user) return;

    try {
      const userDocRef = doc(db, "users", user.id);
      await updateDoc(userDocRef, userData);

      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
    } catch (error) {
      throw new Error("Failed to update user. Please try again.");
    }
  };

  const changePassword = async (
    currentPassword: string,
    newPassword: string
  ) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("No user is currently signed in.");
    }

    if (!currentUser.email) {
      throw new Error(
        "Cannot change password: User account does not have an email address."
      );
    }

    // Check if user is signed in with email/password provider
    // Firebase uses "password" as providerId for email/password accounts
    const providerData = currentUser.providerData;
    const hasEmailProvider = providerData.some(
      (provider) =>
        provider.providerId === "password" || provider.providerId === "firebase"
    );

    if (!hasEmailProvider && providerData.length > 0) {
      throw new Error(
        "Password change is only available for email/password accounts."
      );
    }

    try {
      // Validate new password before attempting reauthentication
      if (newPassword.length < 6) {
        throw new Error("New password must be at least 6 characters long.");
      }

      // Reauthenticate user with current password
      // This is required by Firebase for security
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        currentPassword
      );

      // Reauthenticate - this may throw if password is wrong or user needs recent login
      await reauthenticateWithCredential(currentUser, credential);

      // Update password after successful reauthentication
      await updatePassword(currentUser, newPassword);
    } catch (error: any) {
      let errorMessage = "Failed to change password. Please try again.";

      // Handle specific Firebase Auth error codes
      if (
        error.code === "auth/wrong-password" ||
        error.code === "auth/invalid-credential" ||
        error.code === "auth/invalid-login-credentials"
      ) {
        errorMessage =
          "Current password is incorrect. Please check and try again.";
      } else if (error.code === "auth/user-mismatch") {
        errorMessage =
          "Authentication error. Please sign out and sign in again.";
      } else if (error.code === "auth/weak-password") {
        errorMessage = "New password should be at least 6 characters.";
      } else if (error.code === "auth/requires-recent-login") {
        errorMessage =
          "For security reasons, please sign out and sign in again before changing your password.";
      } else if (error.code === "auth/network-request-failed") {
        errorMessage =
          "Network error. Please check your internet connection and try again.";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage = "Too many failed attempts. Please try again later.";
      } else if (error.code === "auth/user-not-found") {
        errorMessage =
          "User account not found. Please sign out and sign in again.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address. Please contact support.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      throw new Error(errorMessage);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      let errorMessage =
        "Failed to send password reset email. Please try again.";

      // Handle specific Firebase Auth error codes
      if (error.code === "auth/user-not-found") {
        errorMessage = "No account found with this email address.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address.";
      } else if (error.code === "auth/network-request-failed") {
        errorMessage =
          "Network error. Please check your internet connection and try again.";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage = "Too many requests. Please try again later.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      throw new Error(errorMessage);
    }
  };

  const value = {
    user,
    loading,
    signIn,
    signUp,
    logout,
    updateUser,
    changePassword,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
