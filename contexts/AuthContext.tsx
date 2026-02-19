/* biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: Auth lifecycle and migration flows are intentionally centralized. */
/* biome-ignore-all lint/style/useBlockStatements: Existing terse guard style kept for readability in this legacy provider. */
/* biome-ignore-all lint/suspicious/noExplicitAny: Legacy error handling paths still use dynamic error payloads. */
/* biome-ignore-all lint/suspicious/noEvolvingTypes: Existing auth state transitions rely on gradual narrowing in a few places. */
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
import { auth, db, isFirebaseReady } from "@/lib/firebase";
import { familyInviteService } from "@/lib/services/familyInviteService";
import { fcmService } from "@/lib/services/fcmService";
import { revenueCatService } from "@/lib/services/revenueCatService";
import { userService } from "@/lib/services/userService";
import { logger } from "@/lib/utils/logger";
import type { AvatarType, EmergencyContact, User } from "@/types";

const normalizeEmergencyContacts = (
  rawContacts: unknown
): EmergencyContact[] => {
  if (!Array.isArray(rawContacts)) {
    return [];
  }

  const contacts: EmergencyContact[] = [];

  for (const [index, contact] of rawContacts.entries()) {
    if (typeof contact === "string" && contact.trim()) {
      contacts.push({
        id: `legacy-${index}`,
        name: "Emergency Contact",
        phone: contact.trim(),
      });
      continue;
    }

    if (contact && typeof contact === "object") {
      const name =
        typeof (contact as { name?: string }).name === "string"
          ? ((contact as { name?: string }).name?.trim() ?? "")
          : "";
      const phone =
        typeof (contact as { phone?: string }).phone === "string"
          ? ((contact as { phone?: string }).phone?.trim() ?? "")
          : "";
      const id =
        typeof (contact as { id?: string }).id === "string"
          ? ((contact as { id?: string }).id?.trim() ?? "")
          : "";

      if (name && phone) {
        contacts.push({
          id: id || `normalized-${index}`,
          name,
          phone,
        });
      }
    }
  }

  return contacts;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    avatarType?: AvatarType,
    gender?: "male" | "female" | "other"
  ) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<void>;
  changePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
  const _getUserDocument = async (
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
          email: firebaseUser.email || userData.email || undefined,
          phoneNumber:
            firebaseUser.phoneNumber || userData.phoneNumber || undefined,
          firstName: firstName || "User",
          lastName: lastName || "",
          avatar: userData.avatar,
          avatarType: userData.avatarType,
          familyId: userData.familyId,
          role: userData.role || "member",
          createdAt: userData.createdAt?.toDate() || new Date(),
          onboardingCompleted: userData.onboardingCompleted,
          dashboardTourCompleted: userData.dashboardTourCompleted,
          isPremium: userData.isPremium,
          preferences: {
            language: userData.preferences?.language || "en",
            notifications:
              userData.preferences?.notifications !== undefined
                ? userData.preferences.notifications
                : true,
            emergencyContacts: normalizeEmergencyContacts(
              userData.preferences?.emergencyContacts
            ),
          },
        };
      }
      return null;
    } catch (_error) {
      return null;
    }
  };

  // Helper function to create user document in Firestore
  const _createUserDocument = async (
    firebaseUser: FirebaseUser,
    firstName: string,
    lastName: string
  ): Promise<User> => {
    const userData: Omit<User, "id"> = {
      ...(firebaseUser.email && { email: firebaseUser.email }),
      ...(firebaseUser.phoneNumber && {
        phoneNumber: firebaseUser.phoneNumber,
      }),
      firstName,
      lastName,
      role: "member",
      createdAt: new Date(),
      onboardingCompleted: false,
      dashboardTourCompleted: false,
      isPremium: false,
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
    } catch (_error) {
      throw new Error("Failed to create user profile");
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: Auth subscription intentionally uses provider-scoped methods without re-subscribing on each render.
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
          } catch (_getUserError) {
            // Silently handle getUser error - will create new user document
          }

          // Only parse displayName if user doesn't exist yet
          // Otherwise use existing firstName/lastName to avoid overwriting
          let firstName = "User";
          let lastName = "";

          if (existingUser?.firstName) {
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
            firebaseUser.email || undefined,
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

          // Sync RevenueCat user ID with Firebase auth user
          // setUserId will wait for initialization to complete if it's in progress
          try {
            await revenueCatService.setUserId(firebaseUser.uid);
          } catch (_error) {
            // Silently fail - RevenueCat sync is not critical for app functionality
            logger.error(
              "Failed to sync RevenueCat user ID",
              _error,
              "AuthContext"
            );
          }

          // Initialize FCM in background (don't block on this)
          setTimeout(() => {
            if (isMounted) {
              if (!isFirebaseReady()) {
                logger.info(
                  "Skipping FCM init: Firebase not ready",
                  { userId: userData.id },
                  "AuthContext"
                );
                return;
              }
              fcmService.initializeFCM(userData.id).catch((_error) => {
                logger.warn("FCM initialization failed", _error, "AuthContext");
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
            } catch (_error) {
              // Try to ensure family exists even if code processing failed
              if (isMounted) {
                try {
                  await ensureUserHasFamily(firebaseUser.uid, isMounted);
                } catch (_familyError) {
                  // Silently handle family setup errors
                }
              }
            }
          }
        } else if (isMounted) {
          setUser(null);
          // Log out from RevenueCat when user signs out
          // logOut will wait for initialization if it's in progress to ensure proper cleanup
          try {
            await revenueCatService.logOut();
          } catch (_error) {
            // Silently fail - RevenueCat logout is not critical
            logger.error(
              "Failed to log out from RevenueCat",
              _error,
              "AuthContext"
            );
          }
        }
      } catch (_error: any) {
        // Handle auth state change errors
        // Don't log out the user unless it's a critical authentication error
        // RevenueCat and other non-critical errors shouldn't cause logout
        const isCriticalError =
          _error?.code?.startsWith("auth/") ||
          _error?.message?.includes("auth") ||
          _error?.message?.includes("permission-denied") ||
          _error?.message?.includes("unauthenticated");

        if (isCriticalError) {
          // Critical auth error - user should be logged out
          logger.error(
            "Critical auth error in onAuthStateChanged",
            _error,
            "AuthContext"
          );
          if (isMounted) {
            setUser(null);
          }
        } else {
          // Non-critical error (e.g., RevenueCat, FCM, etc.) - log but don't logout
          logger.error(
            "Non-critical error in onAuthStateChanged",
            _error,
            "AuthContext"
          );
          // User remains logged in even if RevenueCat or other services fail
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

  const hasActiveFamilyMembership = async (
    userId: string,
    familyId: string | null | undefined
  ): Promise<boolean> => {
    if (!familyId) {
      return false;
    }

    try {
      const familyDoc = await getDoc(doc(db, "families", familyId));
      if (!familyDoc.exists()) {
        await userService.updateUser(userId, {
          familyId: undefined,
          role: "admin",
        });
        return false;
      }

      const familyData = familyDoc.data();
      const status = familyData.status ?? "active";
      const members: string[] = familyData.members ?? [];
      const hasMembers = members.length > 0;
      const isMember = members.includes(userId);
      const isActive = status !== "inactive";
      const hasActiveFamily = isActive && (!hasMembers || isMember);

      if (!hasActiveFamily) {
        await userService.updateUser(userId, {
          familyId: undefined,
          role: "admin",
        });
      }

      return hasActiveFamily;
    } catch (_error) {
      logger.error("Failed to check family membership", _error, "AuthContext");
      // Be conservative: return false when unable to verify membership
      // This prevents users from proceeding with family operations when verification fails
      return false;
    }
  };

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
        // Check if user already has an active family before processing code
        const currentUser = await userService.getUser(userId);
        const hasActiveFamily = await hasActiveFamilyMembership(
          userId,
          currentUser?.familyId
        );

        if (hasActiveFamily) {
          // User already has a family - show message but don't consume the code
          await AsyncStorage.default.removeItem("pendingFamilyCode");
          setTimeout(() => {
            Alert.alert(
              "Already in a Family",
              "You are already a member of a family. Please leave your current family first if you want to join a different one."
            );
          }, 2000);
          return false;
        }

        try {
          // biome-ignore lint/correctness/useHookAtTopLevel: This is a service method, not a React hook.
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

          // Code failed - show error message and don't create default family
          await AsyncStorage.default.removeItem("pendingFamilyCode");
          setTimeout(() => {
            Alert.alert(
              "Family Code Issue",
              result.message +
                " Please try using the code manually in the Family tab."
            );
          }, 2000);
          // Return false so ensureUserHasFamily can create a default family if needed
          return false;
        } catch (_error: any) {
          await AsyncStorage.default
            .removeItem("pendingFamilyCode")
            .catch(() => {
              // Ignore cleanup errors
            });

          const errorMessage =
            _error?.message ||
            "There was an issue processing your family invitation.";

          setTimeout(() => {
            Alert.alert(
              "Family Code Error",
              errorMessage +
                " Please try using the code manually in the Family tab."
            );
          }, 2000);
          // Return false so ensureUserHasFamily can create a default family if needed
          return false;
        }
      }

      return false;
    } catch (_error: any) {
      return false;
    }
  };

  const ensureUserHasFamily = async (userId: string, isMounted: boolean) => {
    try {
      const currentUser = await userService.getUser(userId);

      if (!currentUser) {
        return;
      }

      const hasActiveFamily = await hasActiveFamilyMembership(
        userId,
        currentUser.familyId
      );

      if (!hasActiveFamily) {
        const fullName =
          currentUser.firstName && currentUser.lastName
            ? `${currentUser.firstName} ${currentUser.lastName}`
            : currentUser.firstName || "User";
        const familyName = fullName ? `${fullName}'s Family` : "My Family";
        await userService.createFamily(userId, familyName);

        if (!isMounted) return;

        const updatedUser = await userService.getUser(userId);
        if (updatedUser && isMounted) {
          setUser(updatedUser);
        }
      }
    } catch (_error: any) {
      // Failed to ensure user has family - not critical
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
        userCredential.user.email || undefined,
        firstName,
        lastName
      );

      // Don't set loading to false here - onAuthStateChanged will handle it
      // This ensures the user state is fully set before navigation occurs
    } catch (_error: any) {
      // Only set loading to false on error - successful sign-in will be handled by onAuthStateChanged
      setLoading(false);

      let errorMessage = "Failed to sign in. Please try again.";

      if (_error.code === "auth/user-not-found") {
        errorMessage = "No account found with this email.";
      } else if (_error.code === "auth/wrong-password") {
        errorMessage = "Incorrect password.";
      } else if (_error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address.";
      } else if (_error.code === "auth/too-many-requests") {
        errorMessage = "Too many failed attempts. Please try again later.";
      }

      throw new Error(errorMessage);
    }
  };

  // biome-ignore lint/nursery/useMaxParams: Explicit auth args retained for compatibility with existing call sites.
  const signUp = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    avatarType?: AvatarType,
    gender?: "male" | "female" | "other"
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
          userCredential.user.email || undefined,
          firstName,
          lastName,
          avatarType,
          gender
        );
      } catch (docError: any) {
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
        } catch (_signOutError) {
          // Failed to sign out after document creation error
        }

        setLoading(false);
        throw new Error(docErrorMessage);
      }
    } catch (_error: any) {
      let errorMessage = "Failed to create account. Please try again.";

      if (_error.code === "auth/email-already-in-use") {
        errorMessage = "An account with this email already exists.";
      } else if (_error.code === "auth/weak-password") {
        errorMessage = "Password should be at least 6 characters.";
      } else if (_error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address.";
      } else if (_error.code === "auth/network-request-failed") {
        errorMessage = "Network _error. Please check your internet connection.";
      } else if (_error.message) {
        errorMessage = _error.message;
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
      } catch (_error) {
        // Silently fail
      }

      // Log out from RevenueCat
      // logOut will wait for initialization if it's in progress to ensure proper cleanup
      try {
        await revenueCatService.logOut();
      } catch (_error) {
        // Silently fail - RevenueCat logout is not critical
        logger.error(
          "Failed to log out from RevenueCat",
          _error,
          "AuthContext"
        );
      }

      await signOut(auth);
      setUser(null);
      setLoading(false);
    } catch (_error) {
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
    } catch (_error) {
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
    } catch (_error: any) {
      let errorMessage = "Failed to change password. Please try again.";

      // Handle specific Firebase Auth error codes
      if (
        _error.code === "auth/wrong-password" ||
        _error.code === "auth/invalid-credential" ||
        _error.code === "auth/invalid-login-credentials"
      ) {
        errorMessage =
          "Current password is incorrect. Please check and try again.";
      } else if (_error.code === "auth/user-mismatch") {
        errorMessage =
          "Authentication _error. Please sign out and sign in again.";
      } else if (_error.code === "auth/weak-password") {
        errorMessage = "New password should be at least 6 characters.";
      } else if (_error.code === "auth/requires-recent-login") {
        errorMessage =
          "For security reasons, please sign out and sign in again before changing your password.";
      } else if (_error.code === "auth/network-request-failed") {
        errorMessage =
          "Network _error. Please check your internet connection and try again.";
      } else if (_error.code === "auth/too-many-requests") {
        errorMessage = "Too many failed attempts. Please try again later.";
      } else if (_error.code === "auth/user-not-found") {
        errorMessage =
          "User account not found. Please sign out and sign in again.";
      } else if (_error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address. Please contact support.";
      } else if (_error.message) {
        errorMessage = _error.message;
      }

      throw new Error(errorMessage);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (_error: any) {
      let errorMessage =
        "Failed to send password reset email. Please try again.";

      // Handle specific Firebase Auth error codes
      if (_error.code === "auth/user-not-found") {
        errorMessage = "No account found with this email address.";
      } else if (_error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address.";
      } else if (_error.code === "auth/network-request-failed") {
        errorMessage =
          "Network _error. Please check your internet connection and try again.";
      } else if (_error.code === "auth/too-many-requests") {
        errorMessage = "Too many requests. Please try again later.";
      } else if (_error.message) {
        errorMessage = _error.message;
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
