import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "@/lib/firebase";
import {
  escalationService,
  healthTimelineService,
  observabilityEmitter,
} from "@/lib/observability";
import type { EmergencyAlert } from "@/types";
import { emergencySmsService } from "./emergencySmsService";
import { pushNotificationService } from "./pushNotificationService";
import { userService } from "./userService";

const removeUndefinedValues = (
  obj: Record<string, unknown>
): Record<string, unknown> => {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      cleaned[key] = value.filter((item) => item !== undefined);
    } else if (
      value !== null &&
      typeof value === "object" &&
      !(value instanceof Timestamp)
    ) {
      cleaned[key] = removeUndefinedValues(value as Record<string, unknown>);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
};

/**
 * Extracts error code and message from Firebase Functions errors
 * Firebase Functions errors can have different structures depending on how they're thrown
 */
const extractFirebaseFunctionsError = (
  error: any
): {
  code: string | undefined;
  message: string;
} => {
  if (!error) {
    return { code: undefined, message: "Unknown error" };
  }

  // Firebase Functions HttpsError structure
  // Error can be: { code: "...", message: "...", details: ... }
  // Or wrapped in error.details or error.error
  let code: string | undefined;
  let message = "Unknown error";

  // Try to extract code from various possible locations
  if (error.code) {
    code = String(error.code);
  } else if (error.details?.code) {
    code = String(error.details.code);
  } else if (error.error?.code) {
    code = String(error.error.code);
  }

  // Try to extract message
  if (error.message) {
    message = String(error.message);
  } else if (error.details?.message) {
    message = String(error.details.message);
  } else if (error.error?.message) {
    message = String(error.error.message);
  } else if (typeof error === "string") {
    message = error;
  } else {
    // Try to stringify the error for debugging
    try {
      message = JSON.stringify(error);
    } catch {
      message = String(error);
    }
  }

  return { code, message };
};

export const alertService = {
  async createAlert(alertData: Omit<EmergencyAlert, "id">): Promise<string> {
    try {
      const cleanedAlertData = removeUndefinedValues(
        alertData as Record<string, unknown>
      ) as Omit<EmergencyAlert, "id">;

      // Try direct Firestore write first
      try {
        const docRef = await addDoc(collection(db, "alerts"), {
          ...cleanedAlertData,
          timestamp: Timestamp.fromDate(alertData.timestamp),
        });

        await healthTimelineService.addEvent({
          userId: alertData.userId,
          eventType: "alert_created",
          title: `Alert: ${alertData.type}`,
          description: alertData.message,
          timestamp: alertData.timestamp,
          severity:
            alertData.severity === "critical"
              ? "critical"
              : alertData.severity === "high"
                ? "error"
                : "warn",
          icon:
            alertData.type === "fall"
              ? "alert-triangle"
              : alertData.type === "medication"
                ? "pill"
                : "heart-pulse",
          metadata: {
            alertId: docRef.id,
            alertType: alertData.type,
            alertSeverity: alertData.severity,
          },
          relatedEntityId: docRef.id,
          relatedEntityType: "alert",
          actorType: "system",
        });

        observabilityEmitter.emit({
          domain: "alerts",
          source: "alertService",
          message: `Alert created: ${alertData.type}`,
          severity:
            alertData.severity === "critical"
              ? "critical"
              : alertData.severity === "high"
                ? "error"
                : "warn",
          status: "success",
          metadata: {
            alertId: docRef.id,
            alertType: alertData.type,
            userId: alertData.userId,
          },
        });

        return docRef.id;
      } catch (directError: any) {
        // If permission-denied, try Cloud Function fallback
        const errorCode =
          typeof directError === "object" &&
          directError &&
          "code" in directError
            ? String((directError as { code?: unknown }).code)
            : undefined;

        if (errorCode === "permission-denied" && auth.currentUser) {
          // Verify functions is initialized
          if (!functions) {
            observabilityEmitter.emit({
              domain: "alerts",
              source: "alertService",
              message: "Cloud Functions not initialized, cannot use fallback",
              severity: "error",
              status: "failure",
              metadata: {
                alertType: alertData.type,
                userId: alertData.userId,
                errorCode: "permission-denied",
              },
            });
            throw new Error("Cloud Functions not initialized");
          }

          // Use Cloud Function to create alert server-side
          observabilityEmitter.emit({
            domain: "alerts",
            source: "alertService",
            message: "Attempting Cloud Function fallback for alert creation",
            severity: "warn",
            status: "in_progress",
            metadata: {
              alertType: alertData.type,
              userId: alertData.userId,
              errorCode: "permission-denied",
              method: "cloud_function_fallback",
            },
          });

          try {
            // Convert Date to ISO string for Cloud Function serialization
            const createAlertFunc = httpsCallable(functions, "createAlert");

            if (__DEV__) {
              console.log("[alertService] Calling Cloud Function createAlert", {
                userId: alertData.userId,
                alertType: alertData.type,
                authUid: auth.currentUser?.uid,
              });
            }

            const result = (await createAlertFunc({
              alertData: {
                ...cleanedAlertData,
                timestamp:
                  alertData.timestamp instanceof Date
                    ? alertData.timestamp.toISOString()
                    : alertData.timestamp,
              },
            })) as { data: { success: boolean; alertId: string } };

            if (__DEV__) {
              console.log("[alertService] Cloud Function response", {
                success: result.data?.success,
                alertId: result.data?.alertId,
              });
            }

            if (result.data?.success && result.data?.alertId) {
              const alertId = result.data.alertId;

              // Add timeline event (may also fail, but that's okay)
              try {
                await healthTimelineService.addEvent({
                  userId: alertData.userId,
                  eventType: "alert_created",
                  title: `Alert: ${alertData.type}`,
                  description: alertData.message,
                  timestamp: alertData.timestamp,
                  severity:
                    alertData.severity === "critical"
                      ? "critical"
                      : alertData.severity === "high"
                        ? "error"
                        : "warn",
                  icon:
                    alertData.type === "fall"
                      ? "alert-triangle"
                      : alertData.type === "medication"
                        ? "pill"
                        : "heart-pulse",
                  metadata: {
                    alertId,
                    alertType: alertData.type,
                    alertSeverity: alertData.severity,
                  },
                  relatedEntityId: alertId,
                  relatedEntityType: "alert",
                  actorType: "system",
                });
              } catch {
                // Timeline event failure is non-critical
              }

              observabilityEmitter.emit({
                domain: "alerts",
                source: "alertService",
                message: `Alert created via Cloud Function: ${alertData.type}`,
                severity:
                  alertData.severity === "critical"
                    ? "critical"
                    : alertData.severity === "high"
                      ? "error"
                      : "warn",
                status: "success",
                metadata: {
                  alertId,
                  alertType: alertData.type,
                  userId: alertData.userId,
                  method: "cloud_function",
                },
              });

              return alertId;
            }
            // Cloud Function returned but without success/alertId
            observabilityEmitter.emit({
              domain: "alerts",
              source: "alertService",
              message: "Cloud Function returned invalid response",
              severity: "error",
              status: "failure",
              metadata: {
                alertType: alertData.type,
                userId: alertData.userId,
                response: result.data,
              },
            });
            throw new Error("Cloud Function returned invalid response");
          } catch (cloudFunctionError: any) {
            // Cloud Function call failed
            const cfErrorCode =
              typeof cloudFunctionError === "object" &&
              cloudFunctionError &&
              "code" in cloudFunctionError
                ? String((cloudFunctionError as { code?: unknown }).code)
                : undefined;
            const cfErrorMessage =
              cloudFunctionError instanceof Error
                ? cloudFunctionError.message
                : "Unknown Cloud Function error";

            observabilityEmitter.emit({
              domain: "alerts",
              source: "alertService",
              message: "Cloud Function fallback failed",
              severity: "error",
              status: "failure",
              error: {
                message: cfErrorMessage,
                code: cfErrorCode,
              },
              metadata: {
                alertType: alertData.type,
                userId: alertData.userId,
                errorCode: cfErrorCode,
                method: "cloud_function_fallback",
              },
            });

            if (__DEV__) {
              console.error("[alertService] Cloud Function error", {
                error: cloudFunctionError,
                code: cfErrorCode,
                message: cfErrorMessage,
              });
            }

            // Re-throw Cloud Function error
            throw cloudFunctionError;
          }
        }

        // Re-throw if fallback didn't work or wasn't applicable
        throw directError;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const errorCode =
        typeof error === "object" && error && "code" in error
          ? String((error as { code?: unknown }).code)
          : undefined;
      observabilityEmitter.emit({
        domain: "alerts",
        source: "alertService",
        message: "Failed to create alert",
        severity: "error",
        status: "failure",
        error: {
          message: errorMessage,
          code: errorCode,
        },
        metadata: {
          alertType: alertData.type,
          userId: alertData.userId,
          errorCode,
        },
      });
      throw error;
    }
  },

  async getUserAlerts(
    userId: string,
    limitCount = 20
  ): Promise<EmergencyAlert[]> {
    try {
      const q = query(
        collection(db, "alerts"),
        where("userId", "==", userId),
        orderBy("timestamp", "desc"),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      const alerts: EmergencyAlert[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        alerts.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp.toDate(),
        } as EmergencyAlert);
      });

      return alerts;
    } catch (error) {
      throw error;
    }
  },

  async getFamilyAlerts(
    userIds: string[],
    limitCount = 50
  ): Promise<EmergencyAlert[]> {
    try {
      const q = query(
        collection(db, "alerts"),
        where("userId", "in", userIds),
        where("resolved", "==", false),
        orderBy("timestamp", "desc"),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      const alerts: EmergencyAlert[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        alerts.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp.toDate(),
        } as EmergencyAlert);
      });

      return alerts;
    } catch (error) {
      throw error;
    }
  },

  async resolveAlert(alertId: string, resolverId: string): Promise<void> {
    try {
      const alertRef = doc(db, "alerts", alertId);

      const alertDoc = await getDoc(alertRef);
      if (!alertDoc.exists()) {
        throw new Error(`Alert ${alertId} does not exist`);
      }

      const alertData = alertDoc.data();

      // Try Cloud Function first for more reliable resolution (bypasses Firestore rules)
      // This ensures consistent behavior regardless of Firestore rule deployment status
      if (auth.currentUser && functions) {
        try {
          observabilityEmitter.emit({
            domain: "alerts",
            source: "alertService",
            message: "Attempting to resolve alert via Cloud Function",
            severity: "info",
            status: "in_progress",
            metadata: {
              alertId,
              resolverId,
              method: "cloud_function",
            },
          });

          const resolveAlertFunc = httpsCallable(functions, "resolveAlert");
          const result = await resolveAlertFunc({ alertId });

          // Verify the result indicates success
          const resultData = result.data as any;
          if (!resultData || resultData.success !== true) {
            const errorMessage =
              resultData?.message ||
              `Cloud Function did not return success: ${JSON.stringify(resultData)}`;

            if (__DEV__) {
              console.error(
                "[alertService] Cloud Function returned non-success",
                {
                  resultData,
                  alertId,
                  resolverId,
                }
              );
            }

            throw new Error(errorMessage);
          }

          observabilityEmitter.emit({
            domain: "alerts",
            source: "alertService",
            message: "Alert resolved via Cloud Function",
            severity: "info",
            status: "success",
            metadata: {
              alertId,
              resolverId,
              method: "cloud_function",
            },
          });

          // Still need to add health timeline event and resolve escalation
          // These should work since we have permission to read the alert
          // Wrap in try-catch so they don't fail the whole operation if they error
          try {
            await healthTimelineService.addEvent({
              userId: alertData.userId,
              eventType: "alert_resolved",
              title: `Alert resolved: ${alertData.type}`,
              description: "Alert was resolved",
              timestamp: new Date(),
              severity: "info",
              icon: "check-circle",
              metadata: {
                alertId,
                alertType: alertData.type,
                resolvedBy: resolverId,
              },
              relatedEntityId: alertId,
              relatedEntityType: "alert",
              actorId: resolverId,
              actorType: "user",
            });
          } catch (timelineError) {
            // Log but don't fail - alert is already resolved
            observabilityEmitter.emit({
              domain: "alerts",
              source: "alertService",
              message:
                "Failed to add health timeline event after alert resolution",
              severity: "warn",
              status: "partial_success",
              error: {
                message:
                  timelineError instanceof Error
                    ? timelineError.message
                    : "Unknown error",
              },
              metadata: { alertId, resolverId },
            });
          }

          // Escalation resolution is now handled by the Cloud Function
          // Only attempt client-side resolution if Cloud Function didn't handle it
          // (This is a fallback for edge cases, but should rarely be needed)
          try {
            await escalationService.resolveEscalation(alertId, resolverId);
          } catch (escalationError: any) {
            // Log but don't fail - alert is already resolved
            // The Cloud Function should have handled escalation resolution
            // This error is expected if Firestore rules don't allow client-side updates
            const errorCode =
              escalationError?.code ||
              (typeof escalationError === "object" &&
              escalationError &&
              "code" in escalationError
                ? String(escalationError.code)
                : undefined);

            // Only log as warning if it's a permission error (expected)
            // Log as error for other issues
            const severity =
              errorCode === "permission-denied" ? "warn" : "error";

            observabilityEmitter.emit({
              domain: "alerts",
              source: "alertService",
              message:
                errorCode === "permission-denied"
                  ? "Escalation resolution handled by Cloud Function (client-side permission denied expected)"
                  : "Failed to resolve escalation after alert resolution",
              severity,
              status: "partial_success",
              error: {
                message:
                  escalationError instanceof Error
                    ? escalationError.message
                    : "Unknown error",
                code: errorCode,
              },
              metadata: { alertId, resolverId },
            });
          }

          observabilityEmitter.emit({
            domain: "alerts",
            source: "alertService",
            message: `Alert resolved: ${alertData.type}`,
            severity: "info",
            status: "success",
            metadata: {
              alertId,
              alertType: alertData.type,
              resolvedBy: resolverId,
            },
          });

          return;
        } catch (cloudFunctionError: any) {
          // Extract error details using helper function
          const { code: errorCode, message: errorMessage } =
            extractFirebaseFunctionsError(cloudFunctionError);

          // Log detailed error information for debugging
          if (__DEV__) {
            console.error("[alertService] Cloud Function error details", {
              error: cloudFunctionError,
              errorCode,
              errorMessage,
              errorKeys: cloudFunctionError
                ? Object.keys(cloudFunctionError)
                : [],
              alertId,
              resolverId,
              errorString: JSON.stringify(cloudFunctionError, null, 2),
            });
          }

          // If Cloud Function doesn't exist or failed, fall back to direct Firestore update
          if (
            errorCode === "not-found" ||
            errorCode === "unavailable" ||
            errorMessage.includes("not found") ||
            errorMessage.includes("does not exist") ||
            errorMessage.includes("Function") ||
            errorMessage.includes("function") ||
            errorMessage.includes("UNAVAILABLE")
          ) {
            observabilityEmitter.emit({
              domain: "alerts",
              source: "alertService",
              message:
                "Cloud Function not available, falling back to direct Firestore update",
              severity: "warn",
              status: "in_progress",
              metadata: {
                alertId,
                resolverId,
                errorCode,
                errorMessage,
              },
            });
            // Fall through to direct Firestore update
          } else if (errorCode === "permission-denied") {
            // Permission denied - log and throw with clear message
            observabilityEmitter.emit({
              domain: "alerts",
              source: "alertService",
              message: "Cloud Function permission denied for alert resolution",
              severity: "error",
              status: "failure",
              error: {
                message: errorMessage,
                code: errorCode,
              },
              metadata: {
                alertId,
                resolverId,
                userId: alertData?.userId,
              },
            });

            // Try fallback to direct Firestore update for permission-denied
            // Sometimes Firestore rules allow what Cloud Function doesn't
            observabilityEmitter.emit({
              domain: "alerts",
              source: "alertService",
              message:
                "Cloud Function permission denied, attempting direct Firestore update",
              severity: "warn",
              status: "in_progress",
              metadata: {
                alertId,
                resolverId,
              },
            });
            // Fall through to direct Firestore update
          } else {
            // Cloud Function returned an error - log and try fallback
            observabilityEmitter.emit({
              domain: "alerts",
              source: "alertService",
              message: "Cloud Function failed for alert resolution",
              severity: "error",
              status: "failure",
              error: {
                message: errorMessage,
                code: errorCode,
              },
              metadata: {
                alertId,
                resolverId,
                errorDetails: cloudFunctionError,
              },
            });

            // For other errors, try fallback to direct Firestore update
            // This provides better resilience
            observabilityEmitter.emit({
              domain: "alerts",
              source: "alertService",
              message:
                "Cloud Function error, attempting direct Firestore update fallback",
              severity: "warn",
              status: "in_progress",
              metadata: {
                alertId,
                resolverId,
                errorCode,
              },
            });
            // Fall through to direct Firestore update
          }
        }
      }

      // Fallback to direct Firestore update if Cloud Function not available
      try {
        await updateDoc(alertRef, {
          resolved: true,
          resolvedAt: Timestamp.now(),
          resolvedBy: resolverId,
        });

        const updatedDoc = await getDoc(alertRef);
        const updatedData = updatedDoc.data();

        if (!updatedData?.resolved) {
          throw new Error(`Alert ${alertId} was not marked as resolved`);
        }
      } catch (directError: any) {
        // Direct Firestore update failed - throw error since Cloud Function already tried
        const errorCode =
          typeof directError === "object" &&
          directError &&
          "code" in directError
            ? String((directError as { code?: unknown }).code)
            : undefined;

        const errorMessage =
          directError?.message || String(directError) || "Unknown error";

        observabilityEmitter.emit({
          domain: "alerts",
          source: "alertService",
          message: "Direct Firestore update failed for alert resolution",
          severity: "error",
          status: "failure",
          error: {
            message: errorMessage,
            code: errorCode,
          },
          metadata: {
            alertId,
            resolverId,
            hasAuth: !!auth.currentUser,
            hasFunctions: !!functions,
          },
        });

        throw new Error(`Failed to resolve alert: ${errorMessage}`);
      }

      // If we get here, direct Firestore update succeeded

      await healthTimelineService.addEvent({
        userId: alertData.userId,
        eventType: "alert_resolved",
        title: `Alert resolved: ${alertData.type}`,
        description: "Alert was resolved",
        timestamp: new Date(),
        severity: "info",
        icon: "check-circle",
        metadata: {
          alertId,
          alertType: alertData.type,
          resolvedBy: resolverId,
        },
        relatedEntityId: alertId,
        relatedEntityType: "alert",
        actorId: resolverId,
        actorType: "user",
      });

      await escalationService.resolveEscalation(alertId, resolverId);

      observabilityEmitter.emit({
        domain: "alerts",
        source: "alertService",
        message: `Alert resolved: ${alertData.type}`,
        severity: "info",
        status: "success",
        metadata: {
          alertId,
          alertType: alertData.type,
          resolvedBy: resolverId,
        },
      });
    } catch (error: any) {
      // Extract error details using helper function
      const { code: errorCode, message: errorMessage } =
        extractFirebaseFunctionsError(error);

      // Log detailed error information
      if (__DEV__) {
        console.error("[alertService] Final error in resolveAlert", {
          error,
          errorCode,
          errorMessage,
          alertId,
          resolverId,
          errorKeys: error ? Object.keys(error) : [],
        });
      }

      observabilityEmitter.emit({
        domain: "alerts",
        source: "alertService",
        message: "Failed to resolve alert",
        severity: "error",
        status: "failure",
        error: {
          message: errorMessage,
          code: errorCode,
        },
        metadata: {
          alertId,
          resolverId,
          errorDetails: error,
        },
      });

      // Preserve original error message if it's meaningful
      const finalMessage =
        errorMessage !== "Unknown error"
          ? `Failed to resolve alert: ${errorMessage}`
          : `Failed to resolve alert: ${errorCode || "Unknown error"}`;

      throw new Error(finalMessage);
    }
  },

  async addResponder(alertId: string, responderId: string): Promise<void> {
    try {
      await updateDoc(doc(db, "alerts", alertId), {
        responders: [responderId],
      });
    } catch (error) {
      throw error;
    }
  },

  async createFallAlert(userId: string, location?: string): Promise<string> {
    try {
      const alertData: Omit<EmergencyAlert, "id"> = {
        userId,
        type: "fall",
        severity: "high",
        message: `Fall detected for user. Immediate attention may be required.${
          location ? ` Location: ${location}` : ""
        }`,
        timestamp: new Date(),
        resolved: false,
        responders: [],
        metadata: { location },
      };

      const alertId = await this.createAlert(alertData);
      const user = await userService.getUser(userId);

      await healthTimelineService.addEvent({
        userId,
        eventType: "fall_detected",
        title: "Fall detected",
        description: location
          ? `Location: ${location}`
          : "Fall detected - location unknown",
        timestamp: new Date(),
        severity: "critical",
        icon: "alert-triangle",
        metadata: { alertId, location },
        relatedEntityId: alertId,
        relatedEntityType: "alert",
        actorType: "system",
      });

      await escalationService.startEscalation(
        alertId,
        "fall_detected",
        userId,
        user?.familyId
      );

      try {
        if (user && user.familyId) {
          const userName =
            user.firstName && user.lastName
              ? `${user.firstName} ${user.lastName}`
              : user.firstName || "User";
          await pushNotificationService.sendFallAlert(
            userId,
            alertId,
            userName,
            user.familyId
          );
          await emergencySmsService.sendEmergencySms({
            userId,
            alertType: "fall",
            message: `Emergency: ${userName} may have fallen and needs help.${
              location ? ` Location: ${location}.` : ""
            }`,
          });
        } else {
          const userName =
            user?.firstName && user?.lastName
              ? `${user.firstName} ${user.lastName}`
              : user?.firstName || "User";
          await pushNotificationService.sendFallAlert(
            userId,
            alertId,
            userName
          );
          await emergencySmsService.sendEmergencySms({
            userId,
            alertType: "fall",
            message: `Emergency: ${userName} may have fallen and needs help.${
              location ? ` Location: ${location}.` : ""
            }`,
          });
        }
      } catch (notificationError) {
        observabilityEmitter.emit({
          domain: "notifications",
          source: "alertService",
          message: "Failed to send fall alert notification",
          severity: "warn",
          status: "failure",
          error: {
            message:
              notificationError instanceof Error
                ? notificationError.message
                : "Unknown error",
          },
          metadata: { alertId, userId },
        });
      }

      return alertId;
    } catch (error) {
      throw error;
    }
  },

  async createMedicationAlert(
    userId: string,
    medicationName: string
  ): Promise<string> {
    try {
      const alertData: Omit<EmergencyAlert, "id"> = {
        userId,
        type: "medication",
        severity: "medium",
        message: `Medication reminder: ${medicationName} was not taken as scheduled.`,
        timestamp: new Date(),
        resolved: false,
        responders: [],
      };

      return await this.createAlert(alertData);
    } catch (error) {
      throw error;
    }
  },

  async createVitalsAlert(
    userId: string,
    vitalType: string,
    value: number,
    normalRange: string
  ): Promise<string> {
    try {
      const alertData: Omit<EmergencyAlert, "id"> = {
        userId,
        type: "vitals",
        severity: "high",
        message: `Abnormal ${vitalType} reading: ${value}. Normal range: ${normalRange}`,
        timestamp: new Date(),
        resolved: false,
        responders: [],
      };

      return await this.createAlert(alertData);
    } catch (error) {
      throw error;
    }
  },

  // Create caregiver notification to admin
  async createCaregiverAlert(
    caregiverId: string,
    familyId: string,
    message: string,
    severity: "low" | "medium" | "high" | "critical" = "medium"
  ): Promise<string> {
    try {
      // Verify caregiver has permission
      const caregiver = await userService.getUser(caregiverId);
      if (
        !caregiver ||
        caregiver.familyId !== familyId ||
        (caregiver.role !== "admin" && caregiver.role !== "caregiver")
      ) {
        throw new Error(
          "Access denied: Only admins and caregivers can send alerts"
        );
      }

      const alertData: Omit<EmergencyAlert, "id"> = {
        userId: caregiverId,
        type: "emergency",
        severity,
        message: `Caregiver Alert: ${message}`,
        timestamp: new Date(),
        resolved: false,
        responders: [],
      };

      const alertId = await this.createAlert(alertData);

      // Send notification to all admins in the family
      try {
        await pushNotificationService.sendToAdmins(
          familyId,
          {
            title: "Caregiver Alert",
            body: message,
            data: {
              type: "caregiver_alert",
              alertId,
              caregiverId,
              familyId,
            },
          },
          caregiverId // Exclude the caregiver who sent the alert
        );
      } catch (notificationError) {
        // Silently fail if notification fails
      }

      return alertId;
    } catch (error) {
      throw error;
    }
  },

  async getActiveAlertsCount(userId: string): Promise<number> {
    try {
      const q = query(
        collection(db, "alerts"),
        where("userId", "==", userId),
        where("resolved", "==", false)
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.size;
    } catch (error) {
      return 0;
    }
  },

  async getActiveAlerts(userId: string): Promise<EmergencyAlert[]> {
    try {
      const q = query(
        collection(db, "alerts"),
        where("userId", "==", userId),
        where("resolved", "==", false)
      );

      const querySnapshot = await getDocs(q);
      const alerts: EmergencyAlert[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const alert = {
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate() || new Date(),
          resolved: data.resolved,
        } as EmergencyAlert;

        // Double-check resolved status in memory
        if (!alert.resolved) {
          alerts.push(alert);
        }
      });

      // Additional filter to ensure no resolved alerts slip through
      const filteredAlerts = alerts.filter((a) => !a.resolved);

      // Sort by timestamp descending
      filteredAlerts.sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
      );

      return filteredAlerts;
    } catch (error: any) {
      // Silently handle error

      // If it's an index error, try without the resolved filter
      if (
        error.message?.includes("index") ||
        error.code === "failed-precondition"
      ) {
        try {
          const q = query(
            collection(db, "alerts"),
            where("userId", "==", userId)
          );
          const querySnapshot = await getDocs(q);
          const alerts: EmergencyAlert[] = [];
          querySnapshot.forEach((doc) => {
            const data = doc.data();
            const alert = {
              id: doc.id,
              ...data,
              timestamp: data.timestamp?.toDate() || new Date(),
              resolved: data.resolved,
            } as EmergencyAlert;

            if (!alert.resolved) {
              alerts.push(alert);
            }
          });
          alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
          return alerts;
        } catch (retryError: any) {
          // Silently handle error
          return [];
        }
      }
      return [];
    }
  },
};
