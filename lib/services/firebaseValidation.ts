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

      // Check if user document exists in Firestore
      try {
        const userDoc = await userService.getUser(currentUser.uid);
        if (!userDoc) {
          // Split displayName into firstName and lastName
          const displayName = currentUser.displayName || "User";
          const nameParts = displayName.split(" ");
          const firstName = nameParts[0] || "User";
          const lastName = nameParts.slice(1).join(" ") || "";
          
          await userService.ensureUserDocument(
            currentUser.uid,
            currentUser.email || "",
            firstName,
            lastName
          );
        }
      } catch (error) {
        issues.push("Cannot access user document in Firestore");
        recommendations.push(
          "Check Firestore security rules for users collection"
        );
      }

      // Test symptoms collection permissions
      try {
        const testSymptom = {
          userId: currentUser.uid,
          type: "test",
          severity: 1 as const,
          timestamp: new Date(),
          description: "Firebase validation test",
        };

        const docRef = await addDoc(collection(db, "symptoms"), testSymptom);

        // Clean up test document
        await deleteDoc(docRef);
      } catch (error: any) {
        issues.push(`Cannot write to symptoms collection: ${error.message}`);
        recommendations.push(
          "Check Firestore security rules for symptoms collection"
        );
      }

      // Test medications collection permissions
      try {
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

        // Clean up test document
        await deleteDoc(docRef);
      } catch (error: any) {
        issues.push(`Cannot write to medications collection: ${error.message}`);
        recommendations.push(
          "Check Firestore security rules for medications collection"
        );
      }

      // Test reading from collections
      try {
        // Try to read symptoms
        const symptomsQuery = collection(db, "symptoms");
        await getDocs(symptomsQuery);

        // Try to read medications
        const medicationsQuery = collection(db, "medications");
        await getDocs(medicationsQuery);
      } catch (error: any) {
        issues.push(`Cannot read from collections: ${error.message}`);
        recommendations.push(
          "Check Firestore security rules for read permissions"
        );
      }
    } catch (error) {
      issues.push(`Validation failed: ${error}`);
      recommendations.push(
        "Check Firebase configuration and network connection"
      );
    }

    const isValid = issues.length === 0;

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
      // Split displayName into firstName and lastName
      const displayName = currentUser.displayName || "User";
      const nameParts = displayName.split(" ");
      const firstName = nameParts[0] || "User";
      const lastName = nameParts.slice(1).join(" ") || "";
      
      await userService.ensureUserDocument(
        currentUser.uid,
        currentUser.email || "",
        firstName,
        lastName
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
