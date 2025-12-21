import { useRouter } from "expo-router";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { auth, db } from "@/lib/firebase";

export default function FirebaseTestScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const log = (message: string) => {
    setTestResults((prev) => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${message}`,
    ]);
  };

  const clearLogs = () => {
    setTestResults([]);
  };

  const testFirebaseSetup = async () => {
    setIsLoading(true);
    clearLogs();

    try {
      log("🔥 Starting Firebase Permissions Test...");

      // Test 1: Check Authentication
      log("📋 Testing Authentication...");
      const currentUser = auth.currentUser;
      if (!currentUser) {
        log("❌ No user authenticated");
        return;
      }
      log(
        `✅ User authenticated: ${currentUser.email} (ID: ${currentUser.uid})`
      );

      // Test 2: Check Firebase Project Config
      log("📋 Testing Firebase Configuration...");
      log(`✅ Project ID: ${auth.app.options.projectId}`);
      log(`✅ Auth Domain: ${auth.app.options.authDomain}`);

      // Test 3: Test Users Collection Access
      log("📋 Testing Users Collection...");
      try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          log(
            `✅ User document exists: ${userData.firstName && userData.lastName ? `${userData.firstName} ${userData.lastName}` : userData.firstName || "User"} (Family: ${userData.familyId})`
          );
        } else {
          log("⚠️ User document does not exist");
        }
      } catch (error: any) {
        log(
          `❌ Users collection error: ${error.message} (Code: ${error.code})`
        );
      }

      // Test 4: Test Families Collection Access
      log("📋 Testing Families Collection...");
      try {
        if (user?.familyId) {
          const familyDoc = await getDoc(doc(db, "families", user.familyId));
          if (familyDoc.exists()) {
            const familyData = familyDoc.data();
            log(
              `✅ Family document exists: ${familyData.name} (Members: ${
                familyData.members?.length || 0
              })`
            );
          } else {
            log("❌ Family document does not exist");
          }
        } else {
          log("⚠️ No family ID found in user data");
        }
      } catch (error: any) {
        log(
          `❌ Families collection error: ${error.message} (Code: ${error.code})`
        );
      }

      // Test 5: Test Query on Users Collection (Family Members)
      log("📋 Testing Family Members Query...");
      try {
        if (user?.familyId) {
          const q = query(
            collection(db, "users"),
            where("familyId", "==", user.familyId)
          );
          const querySnapshot = await getDocs(q);
          log(
            `✅ Family members query successful: ${querySnapshot.size} members found`
          );
        } else {
          log("⚠️ Skipping family members query - no family ID");
        }
      } catch (error: any) {
        log(
          `❌ Family members query error: ${error.message} (Code: ${error.code})`
        );
      }

      // Test 6: Test Symptoms Collection Query
      log("📋 Testing Symptoms Collection...");
      try {
        const q = query(
          collection(db, "symptoms"),
          where("userId", "==", currentUser.uid)
        );
        const querySnapshot = await getDocs(q);
        log(
          `✅ Symptoms query successful: ${querySnapshot.size} symptoms found`
        );
      } catch (error: any) {
        log(`❌ Symptoms query error: ${error.message} (Code: ${error.code})`);
      }

      // Test 7: Test Medications Collection Query
      log("📋 Testing Medications Collection...");
      try {
        const q = query(
          collection(db, "medications"),
          where("userId", "==", currentUser.uid)
        );
        const querySnapshot = await getDocs(q);
        log(
          `✅ Medications query successful: ${querySnapshot.size} medications found`
        );
      } catch (error: any) {
        log(
          `❌ Medications query error: ${error.message} (Code: ${error.code})`
        );
      }

      // Test 8: Test Write Operations
      log("📋 Testing Write Operations...");
      try {
        // Try to create a test document
        const testDoc = await addDoc(collection(db, "symptoms"), {
          userId: currentUser.uid,
          type: "test",
          severity: 1,
          timestamp: new Date(),
          description: "Firebase rules test",
        });
        log(`✅ Write test successful - Created doc: ${testDoc.id}`);

        // Clean up test document
        await deleteDoc(testDoc);
        log("✅ Delete test successful - Removed test doc");
      } catch (error: any) {
        log(`❌ Write test error: ${error.message} (Code: ${error.code})`);
      }

      log("🎉 Firebase test completed!");
    } catch (error: any) {
      log(`💥 Test failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <Text style={styles.title}>Firebase Permissions Test</Text>

        <View style={styles.userInfo}>
          <Text style={styles.label}>User Status:</Text>
          <Text style={styles.value}>
            {user ? `${user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName || "User"} (${user.id})` : "Not authenticated"}
          </Text>
          {user?.familyId && (
            <>
              <Text style={styles.label}>Family ID:</Text>
              <Text style={styles.value}>{user.familyId}</Text>
            </>
          )}
        </View>

        <TouchableOpacity
          disabled={isLoading}
          onPress={testFirebaseSetup}
          style={[styles.button, isLoading && styles.buttonDisabled]}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.buttonText}>Run Permission Tests</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={clearLogs} style={styles.clearButton}>
          <Text style={styles.clearButtonText}>Clear Logs</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>← Back to App</Text>
        </TouchableOpacity>

        <View style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>Test Results:</Text>
          <ScrollView style={styles.results}>
            {testResults.map((result, index) => (
              <Text
                key={index}
                style={[
                  styles.resultText,
                  result.includes("❌") && styles.errorText,
                  result.includes("✅") && styles.successText,
                  result.includes("⚠️") && styles.warningText,
                ]}
              >
                {result}
              </Text>
            ))}
            {testResults.length === 0 && (
              <Text style={styles.placeholderText}>
                Click "Run Permission Tests" to start testing...
              </Text>
            )}
          </ScrollView>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  userInfo: {
    backgroundColor: "white",
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginTop: 10,
  },
  value: {
    fontSize: 16,
    color: "#333",
    marginTop: 2,
  },
  button: {
    backgroundColor: "#2563EB",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "center",
  },
  buttonDisabled: {
    backgroundColor: "#94A3B8",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  clearButton: {
    backgroundColor: "#EF4444",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 10,
  },
  clearButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  backButton: {
    backgroundColor: "#6B7280",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 20,
  },
  backButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  resultsContainer: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 15,
    flex: 1,
    minHeight: 300,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 10,
  },
  results: {
    maxHeight: 400,
  },
  resultText: {
    fontSize: 12,
    fontFamily: "monospace",
    marginBottom: 4,
    lineHeight: 16,
  },
  errorText: {
    color: "#EF4444",
  },
  successText: {
    color: "#10B981",
  },
  warningText: {
    color: "#F59E0B",
  },
  placeholderText: {
    fontSize: 14,
    color: "#6B7280",
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 20,
  },
});
