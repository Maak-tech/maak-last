/**
 * HealthKit Debug Screen
 * Diagnose HealthKit native module issues
 */

import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";
import { Platform, NativeModules } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";

export default function HealthKitDebugScreen() {
  const [diagnostics, setDiagnostics] = useState<string[]>([]);

  const runDiagnostics = async () => {
    const results: string[] = [];
    
    try {
      // Basic platform check - safest possible
      try {
        results.push(`Platform: ${Platform?.OS || "unknown"}`);
      } catch (e) {
        results.push(`Platform: Error - ${e}`);
      }
      
      try {
        const isDevice = Device?.isDevice !== undefined ? (Device.isDevice ? "Yes" : "No (Simulator)") : "Unknown";
        results.push(`Is Device: ${isDevice}`);
      } catch (e) {
        results.push(`Is Device: Error - ${e}`);
      }
      
      try {
        const model = Device?.modelName || Device?.modelId || "Unknown";
        results.push(`Device Model: ${model}`);
      } catch (e) {
        results.push(`Device Model: Error - ${e}`);
      }
      
      // Expo environment check
      try {
        results.push(`\nExpo Environment:`);
        results.push(`- Execution: ${Constants?.executionEnvironment || "Unknown"}`);
        results.push(`- App Ownership: ${Constants?.appOwnership || "Unknown"}`);
        results.push(`- Is Expo Go: ${Constants?.executionEnvironment === "storeClient" ? "YES" : "NO"}`);
      } catch (e) {
        results.push(`\nExpo Environment: Error - ${e}`);
      }
      
      // Native modules check - very defensive
      results.push(`\nNative Modules Available:`);
      try {
        if (typeof NativeModules === "undefined" || NativeModules === null) {
          results.push(`- NativeModules is ${NativeModules === null ? "null" : "undefined"}`);
          results.push(`- Total modules: 0`);
        } else {
          try {
            const allModules = Object.keys(NativeModules);
            results.push(`- Total modules: ${allModules.length}`);
            results.push(`- NativeModules type: ${typeof NativeModules}`);
            
            if (allModules.length === 0) {
              results.push(`\n⚠️ CRITICAL: No native modules found at all!`);
              results.push(`This suggests:`);
              results.push(`1. The app might not be a proper development build`);
              results.push(`2. Native modules weren't compiled into the binary`);
              results.push(`3. There's a runtime issue preventing module registration`);
            } else {
              // Check for common Expo modules
              try {
                const commonModules = ["PlatformConstants", "StatusBarManager", "DeviceInfo", "ExpoModulesCore"];
                const foundCommon: string[] = [];
                commonModules.forEach(name => {
                  try {
                    if (NativeModules[name]) {
                      foundCommon.push(name);
                    }
                  } catch (e) {
                    // Skip this module
                  }
                });
                results.push(`- Common Expo modules found: ${foundCommon.length > 0 ? foundCommon.join(", ") : "NONE (⚠️ This suggests a build issue!)"}`);
              } catch (e) {
                results.push(`- Error checking common modules: ${e}`);
              }
              
              // Check for health-related modules
              try {
                const healthModules = allModules.filter(name => {
                  try {
                    const lower = name.toLowerCase();
                    return lower.includes("health") || 
                           lower.includes("apple") ||
                           lower.includes("fitness") ||
                           lower.includes("rnhealth") ||
                           name === "RNFitness" ||
                           name === "RCTAppleHealthKit" ||
                           name === "AppleHealthKit" ||
                           name === "RNAppleHealthKit";
                  } catch {
                    return false;
                  }
                });
                
                if (healthModules.length > 0) {
                  results.push(`- Health-related modules found: ${healthModules.join(", ")}`);
                } else {
                  results.push(`- ❌ NO health-related modules found!`);
                }
              } catch (e) {
                results.push(`- Error checking health modules: ${e}`);
              }
              
              // Show first few modules
              try {
                if (allModules.length > 0) {
                  results.push(`\nFirst 20 modules:`);
                  results.push(`  ${allModules.slice(0, 20).join(", ")}`);
                }
              } catch (e) {
                results.push(`- Error listing modules: ${e}`);
              }
            }
          } catch (e) {
            results.push(`- Error accessing NativeModules: ${e}`);
          }
        }
      } catch (modulesError: any) {
        results.push(`❌ Error checking native modules: ${modulesError?.message || String(modulesError)}`);
      }
      
      // Try to load @kingstinct/react-native-healthkit - very defensive
      results.push(`\n\nTrying to require('@kingstinct/react-native-healthkit')...`);
      try {
        // Use a function to isolate the require call
        let RNHealth: any = null;
        try {
          RNHealth = require("@kingstinct/react-native-healthkit");
        } catch (requireError: any) {
          results.push(`❌ require() failed: ${requireError?.message || String(requireError)}`);
          setDiagnostics(results);
          return; // Exit early if require fails
        }
        
        if (!RNHealth) {
          results.push(`❌ Module loaded but is null/undefined`);
          setDiagnostics(results);
          return;
        }
        
        results.push(`✅ JavaScript module loaded successfully`);
        
        try {
          results.push(`- Type: ${typeof RNHealth}`);
        } catch (e) {
          results.push(`- Type: Error checking - ${e}`);
        }
        
        try {
          results.push(`- Has default: ${RNHealth?.default ? "YES" : "NO"}`);
        } catch (e) {
          results.push(`- Has default: Error checking - ${e}`);
        }
        
        try {
          const healthModule = RNHealth?.default || RNHealth;
          if (healthModule && typeof healthModule === "object") {
            const methods = Object.keys(healthModule).filter(key => {
              try {
                return typeof healthModule[key] === "function";
              } catch {
                return false;
              }
            });
            results.push(`- Methods: ${methods.slice(0, 10).join(", ")}`);
          }
        } catch (e) {
          results.push(`- Error checking methods: ${e}`);
        }
        
        // Skip the isAvailable() test - it's too risky and might crash
        results.push(`\n⚠️ Skipping native call test to prevent crashes`);
        results.push(`(The module loads, but calling native methods might fail)`);
        
      } catch (error: any) {
        results.push(`❌ Failed to load: ${error?.message || String(error)}`);
      }
    } catch (fatalError: any) {
      results.push(`\n❌ FATAL ERROR: ${fatalError?.message || String(fatalError)}`);
      if (fatalError?.stack) {
        try {
          results.push(`Stack: ${fatalError.stack.substring(0, 200)}`);
        } catch {
          // Ignore stack trace errors
        }
      }
    }
    
    try {
      setDiagnostics(results);
    } catch (setError: any) {
      // If setDiagnostics fails, at least try to show something
      console.error("Failed to set diagnostics:", setError);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.title}>HealthKit Diagnostics</Text>
        <Text style={styles.subtitle}>
          This screen helps diagnose HealthKit native module issues
        </Text>

        <TouchableOpacity 
          style={styles.button} 
          onPress={() => {
            try {
              runDiagnostics().catch((error) => {
                setDiagnostics([`❌ Error running diagnostics: ${error?.message || String(error)}`]);
              });
            } catch (error: any) {
              setDiagnostics([`❌ Fatal error: ${error?.message || String(error)}`]);
            }
          }}
        >
          <Text style={styles.buttonText}>Run Diagnostics</Text>
        </TouchableOpacity>

        {diagnostics.length > 0 && (
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsTitle}>Results:</Text>
            {diagnostics.map((line, index) => (
              <Text key={index} style={styles.resultLine}>
                {line}
              </Text>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#64748B",
    marginBottom: 24,
  },
  button: {
    backgroundColor: "#2563EB",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 24,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
  resultsContainer: {
    backgroundColor: "#1E293B",
    padding: 16,
    borderRadius: 12,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 12,
  },
  resultLine: {
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#E2E8F0",
    marginBottom: 4,
  },
});

