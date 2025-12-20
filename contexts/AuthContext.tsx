import {
  createUserWithEmailAndPassword,
  type User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import type React from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { Alert } from "react-native";
import { auth, db } from "@/lib/firebase";
import { familyInviteService } from "@/lib/services/familyInviteService";
import { fcmService } from "@/lib/services/fcmService";
import { userService } from "@/lib/services/userService";
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
        return {
          id: firebaseUser.uid,
          email: firebaseUser.email || "",
          name: userData.name || firebaseUser.displayName || "User",
          avatar: userData.avatar,
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
      console.error("Error getting user document:", error);
      return null;
    }
  };

  // Helper function to create user document in Firestore
  const createUserDocument = async (
    firebaseUser: FirebaseUser,
    name: string
  ): Promise<User> => {
    const userData: Omit<User, "id"> = {
      email: firebaseUser.email || "",
      name,
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
      console.error("Error creating user document:", error);
      throw new Error("Failed to create user profile");
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const userData = await userService.ensureUserDocument(
            firebaseUser.uid,
            firebaseUser.email || "",
            firebaseUser.displayName || "User"
          );
          setUser(userData);

          setTimeout(() => {
            fcmService.initializeFCM(userData.id).catch(() => {
              // Silently fail - will use local notifications
            });
          }, 3000);

          const familyCodeProcessed = await processPendingFamilyCode(
            firebaseUser.uid
          );

          if (!familyCodeProcessed) {
            await ensureUserHasFamily(firebaseUser.uid);
          }
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error("Auth state change error:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const processPendingFamilyCode = async (userId: string) => {
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

            const updatedUser = await userService.getUser(userId);
            if (updatedUser) {
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
        } catch (error) {
          console.error("Error processing family code:", error);
          setTimeout(() => {
            Alert.alert(
              "Family Code Error",
              "There was an issue processing your family invitation. A default family has been created for you. Please try using the code manually in the Family tab."
            );
          }, 2000);
        }
      }

      return false;
    } catch (error) {
      console.error("Error in processPendingFamilyCode:", error);
      return false;
    }
  };

  const ensureUserHasFamily = async (userId: string) => {
    try {
      const currentUser = await userService.getUser(userId);

      if (!currentUser?.familyId) {
        await userService.createFamily(
          userId,
          `${currentUser?.name}'s Family` || "My Family"
        );

        const updatedUser = await userService.getUser(userId);
        if (updatedUser) {
          setUser(updatedUser);
        }
      }
    } catch (error) {
      console.error("Error ensuring user has family:", error);
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

      await userService.ensureUserDocument(
        userCredential.user.uid,
        userCredential.user.email || "",
        userCredential.user.displayName || "User"
      );
    } catch (error: any) {
      console.error("Sign in error:", error);
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

  const signUp = async (email: string, password: string, name: string) => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      await userService.ensureUserDocument(
        userCredential.user.uid,
        userCredential.user.email || "",
        name
      );
    } catch (error: any) {
      console.error("Sign up error:", error);
      let errorMessage = "Failed to create account. Please try again.";

      if (error.code === "auth/email-already-in-use") {
        errorMessage = "An account with this email already exists.";
      } else if (error.code === "auth/weak-password") {
        errorMessage = "Password should be at least 6 characters.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address.";
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
      console.error("Logout error:", error);
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
      console.error("Update user error:", error);
      throw new Error("Failed to update user. Please try again.");
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
