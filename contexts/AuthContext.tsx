import {
  type ConfirmationResult,
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  type User as FirebaseUser,
  onAuthStateChanged,
  RecaptchaVerifier,
  type RecaptchaVerifier as RecaptchaVerifierType,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signOut,
  updatePassword,
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import type React from "react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Alert, Platform } from "react-native";
import { auth, db, getFirebaseConfig } from "@/lib/firebase";
import { familyInviteService } from "@/lib/services/familyInviteService";
import { fcmService } from "@/lib/services/fcmService";
import { revenueCatService } from "@/lib/services/revenueCatService";
import { userService } from "@/lib/services/userService";
import { logger } from "@/lib/utils/logger";
import type { AvatarType, User } from "@/types";

// Import React Native Firebase for native phone auth
let rnFirebaseAuth:
  | typeof import("@react-native-firebase/auth").default
  | null = null;
let rnFirebaseApp: any = null;
const getRnFirebaseApps = () => {
  if (!rnFirebaseApp) return [];
  if (typeof rnFirebaseApp.apps === "function") {
    return rnFirebaseApp.apps();
  }
  return rnFirebaseApp.apps ?? [];
};

const ensureRnFirebaseInitialized = () => {
  if (!rnFirebaseApp) return false;

  // First, check if apps already exist
  const apps = getRnFirebaseApps();
  if (Array.isArray(apps) && apps.length > 0) {
    return true;
  }

  // Try to get the default app - this will succeed if already initialized
  // React Native Firebase auto-initializes from native config files
  try {
    rnFirebaseApp.app();
    return true;
  } catch (getAppError: any) {
    // App doesn't exist, try to initialize it manually as fallback
    // But only if the error indicates it's truly not initialized
    if (
      getAppError?.code === "app/no-app" ||
      getAppError?.message?.includes("No Firebase App") ||
      getAppError?.message?.includes("has not been initialized")
    ) {
      try {
        const config = getFirebaseConfig();
        // Construct databaseURL from projectId (required by React Native Firebase)
        // Format: https://{projectId}-default-rtdb.firebaseio.com
        const databaseURL = config.projectId
          ? `https://${config.projectId}-default-rtdb.firebaseio.com`
          : undefined;
        rnFirebaseApp.initializeApp({
          apiKey: config.apiKey,
          appId: config.appId,
          projectId: config.projectId,
          messagingSenderId: config.messagingSenderId,
          storageBucket: config.storageBucket,
          databaseURL,
        });
        return true;
      } catch (initError: any) {
        // If initialization fails because app is already configured, that's fine
        // This can happen during hot reload or if native config initialized it
        if (
          initError?.code === "app/unknown" ||
          initError?.message?.includes("already been configured") ||
          initError?.message?.includes("already initialized") ||
          initError?.message?.includes(
            "Default app has already been configured"
          )
        ) {
          // App was already initialized (likely by native config), verify we can access it
          try {
            rnFirebaseApp.app();
            return true;
          } catch {
            // Can't access app even though it says it's configured
            return false;
          }
        }
        // Other initialization errors - return false
        return false;
      }
    }
    // For other errors when getting app, assume it might not be initialized
    return false;
  }
};
if (Platform.OS !== "web") {
  try {
    // Import React Native Firebase app module first to ensure initialization
    rnFirebaseApp = require("@react-native-firebase/app").default;
    // Then import auth module
    rnFirebaseAuth = require("@react-native-firebase/auth").default;

    // React Native Firebase auto-initializes from native config files
    // (GoogleService-Info.plist for iOS, google-services.json for Android)
    // We don't need to initialize it here - it will be initialized automatically
    // The ensureRnFirebaseInitialized() function will be called lazily when needed
    // (e.g., when using phone authentication)
  } catch (e) {
    // React Native Firebase not available, will fall back to web SDK
    logger.info(
      "React Native Firebase auth not available, using web SDK",
      {},
      "AuthContext"
    );
  }
}

// Type for React Native Firebase confirmation result
interface RNFirebaseConfirmationResult {
  confirm: (code: string) => Promise<any>;
}

// Combined confirmation result type
type PhoneConfirmationResult =
  | ConfirmationResult
  | RNFirebaseConfirmationResult;

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithPhone: (phoneNumber: string) => Promise<PhoneConfirmationResult>;
  verifyPhoneCode: (
    confirmationResult: PhoneConfirmationResult,
    code: string,
    firstName: string,
    lastName: string,
    avatarType?: AvatarType
  ) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    avatarType?: AvatarType
  ) => Promise<void>;
  signUpWithPhone: (
    phoneNumber: string,
    firstName: string,
    lastName: string,
    avatarType?: AvatarType
  ) => Promise<PhoneConfirmationResult>;
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
  // Store reCAPTCHA verifier for web phone auth
  const recaptchaVerifierRef = useRef<RecaptchaVerifierType | null>(null);

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
          isPremium: userData.isPremium,
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
      ...(firebaseUser.email && { email: firebaseUser.email }),
      ...(firebaseUser.phoneNumber && {
        phoneNumber: firebaseUser.phoneNumber,
      }),
      firstName,
      lastName,
      role: "member",
      createdAt: new Date(),
      onboardingCompleted: false,
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
          } catch (error) {
            // Silently fail - RevenueCat sync is not critical for app functionality
            logger.error(
              "Failed to sync RevenueCat user ID",
              error,
              "AuthContext"
            );
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
          // Log out from RevenueCat when user signs out
          // logOut will wait for initialization if it's in progress to ensure proper cleanup
          try {
            await revenueCatService.logOut();
          } catch (error) {
            // Silently fail - RevenueCat logout is not critical
            logger.error(
              "Failed to log out from RevenueCat",
              error,
              "AuthContext"
            );
          }
        }
      } catch (error: any) {
        // Handle auth state change errors
        // Don't log out the user unless it's a critical authentication error
        // RevenueCat and other non-critical errors shouldn't cause logout
        const isCriticalError =
          error?.code?.startsWith("auth/") ||
          error?.message?.includes("auth") ||
          error?.message?.includes("permission-denied") ||
          error?.message?.includes("unauthenticated");

        if (isCriticalError) {
          // Critical auth error - user should be logged out
          logger.error(
            "Critical auth error in onAuthStateChanged",
            error,
            "AuthContext"
          );
          if (isMounted) {
            setUser(null);
          }
        } else {
          // Non-critical error (e.g., RevenueCat, FCM, etc.) - log but don't logout
          logger.error(
            "Non-critical error in onAuthStateChanged",
            error,
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
        await userService.updateUser(userId, { familyId: null, role: "admin" });
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
        await userService.updateUser(userId, { familyId: null, role: "admin" });
      }

      return hasActiveFamily;
    } catch (error) {
      logger.error("Failed to check family membership", error, "AuthContext");
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
        } catch (error: any) {
          await AsyncStorage.default
            .removeItem("pendingFamilyCode")
            .catch(() => {
              // Ignore cleanup errors
            });

          const errorMessage =
            error?.message ||
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
    } catch (error: any) {
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
    } catch (error: any) {
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
    } catch (error: any) {
      // Only set loading to false on error - successful sign-in will be handled by onAuthStateChanged
      setLoading(false);

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
          userCredential.user.email || undefined,
          firstName,
          lastName,
          avatarType
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
        } catch (signOutError) {
          // Failed to sign out after document creation error
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

  const signUpWithPhone = async (
    phoneNumber: string,
    firstName: string,
    lastName: string,
    avatarType?: AvatarType
  ): Promise<PhoneConfirmationResult> => {
    setLoading(true);
    try {
      // Ensure Firebase is initialized before proceeding
      try {
        const { getApp, getApps } = await import("firebase/app");
        const apps = getApps();
        if (apps.length === 0) {
          // Firebase not initialized - this should not happen if firebase.ts is imported correctly
          logger.error("Firebase app not initialized", {}, "AuthContext");
          throw new Error(
            "Firebase is not initialized. Please restart the app and try again."
          );
        }
        // Verify auth is available
        if (!auth) {
          throw new Error("Firebase Auth is not available");
        }
      } catch (initError: any) {
        logger.error(
          "Firebase initialization check failed",
          { error: initError?.message || initError },
          "AuthContext"
        );
        throw new Error(
          initError?.message ||
            "Firebase is not initialized. Please restart the app and try again."
        );
      }

      // Clean and validate phone number
      const cleanedPhone = phoneNumber.trim().replace(/[\s\-()]/g, "");

      // Format phone number to E.164 format if needed
      let formattedPhone: string;
      if (cleanedPhone.startsWith("+")) {
        formattedPhone = cleanedPhone;
      } else if (cleanedPhone.startsWith("00")) {
        // Convert 00 prefix to +
        formattedPhone = "+" + cleanedPhone.substring(2);
      } else if (cleanedPhone.startsWith("0")) {
        // If starts with 0, might need country code - but we'll try with +
        formattedPhone = "+" + cleanedPhone;
      } else {
        formattedPhone = "+" + cleanedPhone;
      }

      // Basic validation - E.164 format should be + followed by 1-15 digits
      const e164Regex = /^\+[1-9]\d{1,14}$/;
      if (!e164Regex.test(formattedPhone)) {
        setLoading(false);
        logger.error(
          "Invalid phone number format",
          { phoneNumber, formattedPhone },
          "AuthContext"
        );
        throw new Error(
          "Invalid phone number format. Please enter your phone number with country code (e.g., +1234567890)"
        );
      }

      // Store user data temporarily for after verification
      const AsyncStorage = await import(
        "@react-native-async-storage/async-storage"
      );
      await AsyncStorage.default.setItem(
        "pendingPhoneSignup",
        JSON.stringify({
          firstName,
          lastName,
          avatarType,
          phoneNumber: formattedPhone,
        })
      );

      logger.info(
        "Sending verification code",
        { formattedPhone, platform: Platform.OS },
        "AuthContext"
      );

      // Use React Native Firebase on native platforms, web SDK on web
      if (Platform.OS !== "web" && rnFirebaseAuth) {
        // Ensure React Native Firebase is initialized
        try {
          if (!ensureRnFirebaseInitialized()) {
            logger.error(
              "React Native Firebase app not ready",
              {},
              "AuthContext"
            );
            throw new Error(
              "Firebase is not initialized. Please ensure GoogleService-Info.plist (iOS) or google-services.json (Android) is properly configured and restart the app."
            );
          }

          // Use React Native Firebase for native phone auth
          const confirmation =
            await rnFirebaseAuth().signInWithPhoneNumber(formattedPhone);
          logger.info(
            "Verification code sent successfully via RN Firebase",
            { formattedPhone },
            "AuthContext"
          );
          setLoading(false);
          return confirmation;
        } catch (rnError: any) {
          // Check if error is about Firebase not being initialized
          if (
            rnError?.message?.includes("No Firebase App") ||
            rnError?.message?.includes("initializeApp") ||
            rnError?.code === "app/no-app"
          ) {
            logger.error(
              "React Native Firebase not initialized",
              { error: rnError?.message || rnError, code: rnError?.code },
              "AuthContext"
            );
            throw new Error(
              "Firebase is not initialized. Please ensure GoogleService-Info.plist (iOS) or google-services.json (Android) is properly configured and restart the app."
            );
          }
          throw rnError;
        }
      }
      if (Platform.OS === "web") {
        // Use web SDK for web platform - requires reCAPTCHA verifier
        // Create reCAPTCHA verifier if it doesn't exist
        if (!recaptchaVerifierRef.current) {
          if (typeof document === "undefined") {
            throw new Error(
              "reCAPTCHA verifier cannot be created - document is not available"
            );
          }

          try {
            // Create invisible reCAPTCHA verifier
            recaptchaVerifierRef.current = new RecaptchaVerifier(
              auth,
              "recaptcha-container",
              {
                size: "invisible",
                callback: () => {
                  // reCAPTCHA solved, will proceed automatically
                },
                "expired-callback": () => {
                  // reCAPTCHA expired, user needs to retry
                  recaptchaVerifierRef.current = null;
                },
              }
            );
          } catch (error: any) {
            // If container doesn't exist, create it dynamically
            if (typeof document !== "undefined") {
              let container = document.getElementById("recaptcha-container");
              if (!container) {
                container = document.createElement("div");
                container.id = "recaptcha-container";
                container.style.display = "none";
                document.body.appendChild(container);
              }
              recaptchaVerifierRef.current = new RecaptchaVerifier(
                auth,
                "recaptcha-container",
                {
                  size: "invisible",
                  callback: () => {
                    // reCAPTCHA solved
                  },
                  "expired-callback": () => {
                    recaptchaVerifierRef.current = null;
                  },
                }
              );
            } else {
              throw new Error(
                "reCAPTCHA verifier cannot be created in this environment"
              );
            }
          }
        }

        // Ensure verifier was created successfully before proceeding
        if (!recaptchaVerifierRef.current) {
          throw new Error(
            "Failed to create reCAPTCHA verifier. Please refresh the page and try again."
          );
        }

        const confirmationResult = await signInWithPhoneNumber(
          auth,
          formattedPhone,
          recaptchaVerifierRef.current
        );
        logger.info(
          "Verification code sent successfully via web SDK",
          { formattedPhone },
          "AuthContext"
        );
        setLoading(false);
        return confirmationResult;
      }
      // Fallback: native platform but RN Firebase not available
      // Check if we're in Expo Go
      let isExpoGo = false;
      try {
        const Constants = await import("expo-constants");
        isExpoGo = Constants.default.appOwnership === "expo";
      } catch {
        // Could not determine, assume not Expo Go
      }

      if (isExpoGo) {
        throw new Error(
          "Phone authentication is not available in Expo Go. Please use a development build (run 'eas build --profile development' or 'expo run:android'/'expo run:ios')."
        );
      }
      throw new Error(
        "Phone authentication requires React Native Firebase. Please ensure @react-native-firebase/auth is properly installed and rebuild the app."
      );
    } catch (error: any) {
      setLoading(false);

      // Log the full error for debugging
      logger.error(
        "Phone signup error",
        {
          error: error.message || error,
          code: error.code,
          phoneNumber,
        },
        "AuthContext"
      );

      let errorMessage = "Failed to send verification code. Please try again.";

      // Check for the specific reCAPTCHA/verify error
      if (
        error.message?.includes("verify") ||
        error.message?.includes("undefined") ||
        error.message?.includes("cannot read property")
      ) {
        if (Platform.OS === "web") {
          errorMessage =
            "reCAPTCHA verification failed. Please refresh the page and try again.";
        } else {
          errorMessage =
            "Phone authentication requires React Native Firebase. Please rebuild the app with EAS Build or ensure @react-native-firebase/auth is properly installed.";
        }
      } else if (error.code === "auth/invalid-phone-number") {
        errorMessage =
          "Invalid phone number format. Please include country code (e.g., +1234567890).";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage = "Too many requests. Please try again later.";
      } else if (error.code === "auth/quota-exceeded") {
        errorMessage = "SMS quota exceeded. Please try again later.";
      } else if (error.code === "auth/missing-phone-number") {
        errorMessage = "Phone number is required.";
      } else if (error.code === "auth/captcha-check-failed") {
        errorMessage = "reCAPTCHA verification failed. Please try again.";
      } else if (error.code === "auth/app-not-authorized") {
        errorMessage =
          "Phone authentication is not enabled for this app. Please contact support.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      throw new Error(errorMessage);
    }
  };

  const verifyPhoneCode = async (
    confirmationResult: PhoneConfirmationResult,
    code: string,
    firstName: string,
    lastName: string,
    avatarType?: AvatarType
  ) => {
    setLoading(true);
    try {
      // Both web SDK and RN Firebase have a confirm method
      const result = await confirmationResult.confirm(code);

      // RN Firebase returns the user directly, web SDK returns UserCredential
      const user = result?.user || result;
      const userId = user?.uid;
      const userPhoneNumber = user?.phoneNumber;

      if (!userId) {
        throw new Error("Failed to get user after verification");
      }

      // Get stored phone number or use from user
      const AsyncStorage = await import(
        "@react-native-async-storage/async-storage"
      );
      const pendingDataStr =
        await AsyncStorage.default.getItem("pendingPhoneSignup");
      let phoneNumber = userPhoneNumber || "";

      if (pendingDataStr) {
        const pendingData = JSON.parse(pendingDataStr);
        phoneNumber = pendingData.phoneNumber || phoneNumber;
        await AsyncStorage.default.removeItem("pendingPhoneSignup");
      }

      // Ensure user document is created
      try {
        await userService.ensureUserDocument(
          userId,
          "", // No email for phone auth
          firstName,
          lastName,
          avatarType
        );

        // Update user document with phone number
        const userDocRef = doc(db, "users", userId);
        await updateDoc(userDocRef, {
          phoneNumber,
        });
      } catch (docError: any) {
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

        // If document creation fails, try to sign out
        try {
          if (Platform.OS !== "web" && rnFirebaseAuth) {
            await rnFirebaseAuth().signOut();
          } else {
            await signOut(auth);
          }
        } catch (signOutError) {
          // Failed to sign out after document creation error
        }

        setLoading(false);
        throw new Error(docErrorMessage);
      }
    } catch (error: any) {
      setLoading(false);
      let errorMessage = "Failed to verify code. Please try again.";

      if (error.code === "auth/invalid-verification-code") {
        errorMessage = "Invalid verification code.";
      } else if (error.code === "auth/code-expired") {
        errorMessage = "Verification code expired. Please request a new one.";
      } else if (error.code === "auth/session-expired") {
        errorMessage = "Session expired. Please start again.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      throw new Error(errorMessage);
    }
    // Don't set loading to false here - onAuthStateChanged will handle it
  };

  const signInWithPhone = async (
    phoneNumber: string
  ): Promise<PhoneConfirmationResult> => {
    setLoading(true);
    try {
      // Format phone number to E.164 format if needed
      const cleanedPhone = phoneNumber.trim().replace(/[\s\-()]/g, "");
      let formattedPhone: string;
      if (cleanedPhone.startsWith("+")) {
        formattedPhone = cleanedPhone;
      } else if (cleanedPhone.startsWith("00")) {
        formattedPhone = "+" + cleanedPhone.substring(2);
      } else {
        formattedPhone = "+" + cleanedPhone;
      }

      logger.info(
        "Sending verification code for login",
        { formattedPhone, platform: Platform.OS },
        "AuthContext"
      );

      // Use React Native Firebase on native platforms, web SDK on web
      if (Platform.OS !== "web" && rnFirebaseAuth) {
        if (!ensureRnFirebaseInitialized()) {
          logger.error(
            "React Native Firebase app not ready",
            {},
            "AuthContext"
          );
          throw new Error(
            "Firebase is not initialized. Please ensure GoogleService-Info.plist (iOS) or google-services.json (Android) is properly configured and restart the app."
          );
        }
        // Use React Native Firebase for native phone auth
        const confirmation =
          await rnFirebaseAuth().signInWithPhoneNumber(formattedPhone);
        logger.info(
          "Verification code sent successfully via RN Firebase",
          { formattedPhone },
          "AuthContext"
        );
        setLoading(false);
        return confirmation;
      }
      if (Platform.OS === "web") {
        // Use web SDK for web platform - requires reCAPTCHA verifier
        // Create reCAPTCHA verifier if it doesn't exist
        if (!recaptchaVerifierRef.current) {
          if (typeof document === "undefined") {
            throw new Error(
              "reCAPTCHA verifier cannot be created - document is not available"
            );
          }

          try {
            // Create invisible reCAPTCHA verifier
            recaptchaVerifierRef.current = new RecaptchaVerifier(
              auth,
              "recaptcha-container",
              {
                size: "invisible",
                callback: () => {
                  // reCAPTCHA solved, will proceed automatically
                },
                "expired-callback": () => {
                  // reCAPTCHA expired, user needs to retry
                  recaptchaVerifierRef.current = null;
                },
              }
            );
          } catch (error: any) {
            // If container doesn't exist, create it dynamically
            if (typeof document !== "undefined") {
              let container = document.getElementById("recaptcha-container");
              if (!container) {
                container = document.createElement("div");
                container.id = "recaptcha-container";
                container.style.display = "none";
                document.body.appendChild(container);
              }
              recaptchaVerifierRef.current = new RecaptchaVerifier(
                auth,
                "recaptcha-container",
                {
                  size: "invisible",
                  callback: () => {
                    // reCAPTCHA solved
                  },
                  "expired-callback": () => {
                    recaptchaVerifierRef.current = null;
                  },
                }
              );
            } else {
              throw new Error(
                "reCAPTCHA verifier cannot be created in this environment"
              );
            }
          }
        }

        // Ensure verifier was created successfully before proceeding
        if (!recaptchaVerifierRef.current) {
          throw new Error(
            "Failed to create reCAPTCHA verifier. Please refresh the page and try again."
          );
        }

        const confirmationResult = await signInWithPhoneNumber(
          auth,
          formattedPhone,
          recaptchaVerifierRef.current
        );
        logger.info(
          "Verification code sent successfully via web SDK",
          { formattedPhone },
          "AuthContext"
        );
        setLoading(false);
        return confirmationResult;
      }
      // Fallback: native platform but RN Firebase not available
      // Check if we're in Expo Go
      let isExpoGo = false;
      try {
        const Constants = await import("expo-constants");
        isExpoGo = Constants.default.appOwnership === "expo";
      } catch {
        // Could not determine, assume not Expo Go
      }

      if (isExpoGo) {
        throw new Error(
          "Phone authentication is not available in Expo Go. Please use a development build (run 'eas build --profile development' or 'expo run:android'/'expo run:ios')."
        );
      }
      throw new Error(
        "Phone authentication requires React Native Firebase. Please ensure @react-native-firebase/auth is properly installed and rebuild the app."
      );
    } catch (error: any) {
      setLoading(false);
      let errorMessage = "Failed to send verification code. Please try again.";

      // Check for the specific reCAPTCHA/verify error
      if (
        error.message?.includes("verify") ||
        error.message?.includes("undefined") ||
        error.message?.includes("cannot read property")
      ) {
        if (Platform.OS === "web") {
          errorMessage =
            "reCAPTCHA verification failed. Please refresh the page and try again.";
        } else {
          errorMessage =
            "Phone authentication requires React Native Firebase. Please rebuild the app with EAS Build or ensure @react-native-firebase/auth is properly installed.";
        }
      } else if (error.code === "auth/invalid-phone-number") {
        errorMessage = "Invalid phone number format.";
      } else if (error.code === "auth/user-not-found") {
        errorMessage = "No account found with this phone number.";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage = "Too many requests. Please try again later.";
      } else if (error.code === "auth/quota-exceeded") {
        errorMessage = "SMS quota exceeded. Please try again later.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      throw new Error(errorMessage);
    }
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

      // Log out from RevenueCat
      // logOut will wait for initialization if it's in progress to ensure proper cleanup
      try {
        await revenueCatService.logOut();
      } catch (error) {
        // Silently fail - RevenueCat logout is not critical
        logger.error("Failed to log out from RevenueCat", error, "AuthContext");
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
    signInWithPhone,
    verifyPhoneCode,
    signUp,
    signUpWithPhone,
    logout,
    updateUser,
    changePassword,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
