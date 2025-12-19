import { addDoc, collection, deleteDoc, getDocs } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { userService } from "./userService";

export const firebaseValidation = {
  // Check if user is properly authenticated and has permissions
  async validateUserSetup(): Promise<{
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      // Check auth state
      const currentUser = auth.currentUser;
      if (!currentUser) {
        issues.push("User is not authenticated");
        recommendations.push("Please sign in to your account");
        return { isValid: false, issues, recommendations };
      }

      console.log("✅ User is authenticated:", currentUser.email);

      // Check if user document exists in Firestore
      try {
        const userDoc = await userService.getUser(currentUser.uid);
        if (userDoc) {
          console.log("✅ User document exists");
        } else {
          console.log("🔧 User document missing, creating it...");
          await userService.ensureUserDocument(
            currentUser.uid,
            currentUser.email || "",
            currentUser.displayName || "User"
          );
          console.log("✅ User document created successfully");
        }
      } catch (error) {
        issues.push("Cannot access user document in Firestore");
        recommendations.push(
          "Check Firestore security rules for users collection"
        );
        console.error("User document check failed:", error);
      }

      // Test symptoms collection permissions
      try {
        console.log("🧪 Testing symptoms collection permissions...");
        const testSymptom = {
          userId: currentUser.uid,
          type: "test",
          severity: 1 as const,
          timestamp: new Date(),
          description: "Firebase validation test",
        };

        const docRef = await addDoc(collection(db, "symptoms"), testSymptom);
        console.log("✅ Can write to symptoms collection");

        // Clean up test document
        await deleteDoc(docRef);
        console.log("✅ Can delete from symptoms collection");
      } catch (error: any) {
        issues.push(`Cannot write to symptoms collection: ${error.message}`);
        recommendations.push(
          "Check Firestore security rules for symptoms collection"
        );
        console.error("Symptoms collection test failed:", error);
      }

      // Test medications collection permissions
      try {
        console.log("🧪 Testing medications collection permissions...");
        const testMedication = {
          userId: currentUser.uid,
          name: "Test Medication",
          dosage: "10mg",
          frequency: "Daily",
          startDate: new Date(),
          reminders: [],
          isActive: true,
        };

        const docRef = await addDoc(
          collection(db, "medications"),
          testMedication
        );
        console.log("✅ Can write to medications collection");

        // Clean up test document
        await deleteDoc(docRef);
        console.log("✅ Can delete from medications collection");
      } catch (error: any) {
        issues.push(`Cannot write to medications collection: ${error.message}`);
        recommendations.push(
          "Check Firestore security rules for medications collection"
        );
        console.error("Medications collection test failed:", error);
      }

      // Test reading from collections
      try {
        console.log("🧪 Testing read permissions...");

        // Try to read symptoms
        const symptomsQuery = collection(db, "symptoms");
        await getDocs(symptomsQuery);
        console.log("✅ Can read from symptoms collection");

        // Try to read medications
        const medicationsQuery = collection(db, "medications");
        await getDocs(medicationsQuery);
        console.log("✅ Can read from medications collection");
      } catch (error: any) {
        issues.push(`Cannot read from collections: ${error.message}`);
        recommendations.push(
          "Check Firestore security rules for read permissions"
        );
        console.error("Read permissions test failed:", error);
      }
    } catch (error) {
      issues.push(`Validation failed: ${error}`);
      recommendations.push(
        "Check Firebase configuration and network connection"
      );
      console.error("Firebase validation error:", error);
    }

    const isValid = issues.length === 0;

    if (isValid) {
      console.log("🎉 Firebase setup validation passed!");
    } else {
      console.warn("⚠️ Firebase setup has issues:", issues);
      console.log("💡 Recommendations:", recommendations);
    }

    return { isValid, issues, recommendations };
  },

  // Quick fix for common permission issues
  async quickFix(): Promise<{ success: boolean; message: string }> {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        return {
          success: false,
          message: "No user is currently signed in",
        };
      }

      // Ensure user document exists
      await userService.ensureUserDocument(
        currentUser.uid,
        currentUser.email || "",
        currentUser.displayName || "User"
      );

      return {
        success: true,
        message: "User document created/verified successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Quick fix failed: ${error}`,
      };
    }
  },

  // Get current Firebase configuration status
  getConfigStatus(): {
    hasFirebaseConfig: boolean;
    hasAuth: boolean;
    hasFirestore: boolean;
    projectId: string | undefined;
  } {
    return {
      hasFirebaseConfig: !!auth.app,
      hasAuth: !!auth.currentUser,
      hasFirestore: !!db,
      projectId: auth.app?.options?.projectId,
    };
  },
};
