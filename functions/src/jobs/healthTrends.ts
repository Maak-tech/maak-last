/**
 * Health Trends Analysis Job
 * Analyzes vital signs and symptom trends daily and alerts admins of concerning patterns
 */

import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from '../observability/logger';
import { getFamilyAdmins } from '../modules/family/admins';

/**
 * Send trend alert to admins
 */
async function sendTrendAlertToAdmins(
  userId: string,
  userName: string,
  trendType: 'vital' | 'symptom',
  analysis: {
    type: string;
    trend: string;
    severity: 'critical' | 'warning';
    message: string;
    changePercent?: number;
    frequency?: number;
  }
): Promise<void> {
  try {
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (!userData?.familyId) {
      return; // No family, no admins to alert
    }

    const adminIds = await getFamilyAdmins(userData.familyId);
    // Don't alert the user themselves if they're an admin
    const adminIdsToAlert = adminIds.filter((id) => id !== userId);

    if (adminIdsToAlert.length === 0) {
      return;
    }

    const severityEmoji = analysis.severity === 'critical' ? '📈' : '📊';
    const trendEmoji =
      analysis.trend === 'increasing'
        ? '📈'
        : analysis.trend === 'decreasing'
        ? '📉'
        : '📊';

    const notification = {
      title: `${severityEmoji} ${trendEmoji} Health Trend Alert`,
      body: `${userName}: ${analysis.message}`,
      priority: analysis.severity === 'critical' ? ('high' as const) : ('normal' as const),
      data: {
        type: 'trend_alert',
        trendType,
        analysisType: analysis.type,
        trend: analysis.trend,
        severity: analysis.severity,
        userId,
        userName,
        message: analysis.message,
      },
      clickAction: trendType === 'vital' ? 'OPEN_VITALS' : 'OPEN_SYMPTOMS',
      color: analysis.severity === 'critical' ? '#EF4444' : '#F59E0B',
    };

    // Send to admins
    // Note: This requires sendPushNotification to be exported from index.ts
    const indexModule = await import('../index.js') as any;
    const result = await indexModule.sendPushNotification(
      {
        userIds: adminIdsToAlert,
        notification,
        notificationType: 'trend',
      },
      { auth: { uid: 'system' } } as any
    );

    // Log the alert
    await db.collection('notificationLogs').add({
      type: 'trend_alert',
      userId,
      trendType,
      analysisType: analysis.type,
      trend: analysis.trend,
      severity: analysis.severity,
      recipientIds: adminIdsToAlert,
      adminRecipients: adminIdsToAlert,
      sentAt: FieldValue.serverTimestamp(),
      result,
    });
  } catch (error) {
    logger.error('Error sending trend alert to admins', error as Error, {
      fn: 'sendTrendAlertToAdmins',
    });
    // Don't throw - alerts are non-critical
  }
}

/**
 * Scheduled function to analyze health trends and alert admins
 * Runs daily at 2 AM
 */
export const analyzeHealthTrends = onSchedule(
  '0 2 * * *', // Daily at 2 AM
  async () => {
    const db = admin.firestore();
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    try {
      // Get all users with families
      const usersSnapshot = await db
        .collection('users')
        .where('familyId', '!=', null)
        .get();

      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        const userData = userDoc.data();

        if (!userData.familyId) continue;

        const userName =
          userData.firstName && userData.lastName
            ? `${userData.firstName} ${userData.lastName}`
            : userData.email || 'User';

        // Analyze vital signs trends (last 7 days)
        const vitalsSnapshot = await db
          .collection('vitals')
          .where('userId', '==', userId)
          .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(sevenDaysAgo))
          .orderBy('timestamp', 'asc')
          .get();

        // Group vitals by type
        const vitalsByType: Record<
          string,
          Array<{ value: number; timestamp: Date }>
        > = {};

        vitalsSnapshot.forEach((doc) => {
          const vitalData = doc.data();
          const type = vitalData.type;
          const value = vitalData.value;
          const timestamp = vitalData.timestamp?.toDate() || new Date();

          if (typeof value === 'number' && type) {
            if (!vitalsByType[type]) {
              vitalsByType[type] = [];
            }
            vitalsByType[type].push({ value, timestamp });
          }
        });

        // Analyze trends for each vital type
        for (const [vitalType, values] of Object.entries(vitalsByType)) {
          if (values.length < 3) continue; // Need at least 3 data points

          // Simple trend analysis: compare first half vs second half
          const midpoint = Math.floor(values.length / 2);
          const firstHalf = values.slice(0, midpoint);
          const secondHalf = values.slice(midpoint);

          const firstAvg =
            firstHalf.reduce((sum, v) => sum + v.value, 0) / firstHalf.length;
          const secondAvg =
            secondHalf.reduce((sum, v) => sum + v.value, 0) / secondHalf.length;

          const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;
          const trend =
            Math.abs(changePercent) < 2
              ? 'stable'
              : changePercent > 0
              ? 'increasing'
              : 'decreasing';

          // Determine severity
          let severity: 'critical' | 'warning' | null = null;
          const thresholds: Record<
            string,
            { critical: number; warning: number }
          > = {
            heartRate: { critical: 15, warning: 10 },
            restingHeartRate: { critical: 20, warning: 12 },
            bloodPressure: { critical: 15, warning: 10 },
            respiratoryRate: { critical: 25, warning: 15 },
            oxygenSaturation: { critical: 5, warning: 3 },
            bodyTemperature: { critical: 10, warning: 5 },
            weight: { critical: 5, warning: 3 },
          };

          const vitalThresholds = thresholds[vitalType] || {
            critical: 20,
            warning: 10,
          };

          if (trend === 'increasing' && changePercent >= vitalThresholds.critical) {
            severity = 'critical';
          } else if (
            trend === 'increasing' &&
            changePercent >= vitalThresholds.warning
          ) {
            severity = 'warning';
          } else if (
            trend === 'decreasing' &&
            changePercent <= -vitalThresholds.critical
          ) {
            severity = 'critical';
          } else if (
            trend === 'decreasing' &&
            changePercent <= -vitalThresholds.warning
          ) {
            severity = 'warning';
          }

          if (severity) {
            await sendTrendAlertToAdmins(userId, userName, 'vital', {
              type: vitalType,
              trend,
              severity,
              message: `${vitalType} is ${trend} (${changePercent.toFixed(1)}% change) over the past 7 days`,
              changePercent,
            });
          }
        }

        // Analyze symptom trends (last 30 days)
        const symptomsSnapshot = await db
          .collection('symptoms')
          .where('userId', '==', userId)
          .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
          .orderBy('timestamp', 'asc')
          .get();

        // Group symptoms by type
        const symptomsByType: Record<
          string,
          Array<{ severity: number; timestamp: Date }>
        > = {};

        symptomsSnapshot.forEach((doc) => {
          const symptomData = doc.data();
          const type = symptomData.type || symptomData.symptomType;
          const severity = symptomData.severity;
          const timestamp = symptomData.timestamp?.toDate() || new Date();

          if (typeof severity === 'number' && type) {
            if (!symptomsByType[type]) {
              symptomsByType[type] = [];
            }
            symptomsByType[type].push({ severity, timestamp });
          }
        });

        // Analyze trends for each symptom type
        for (const [symptomType, symptoms] of Object.entries(symptomsByType)) {
          if (symptoms.length < 2) continue;

          const daysSinceFirst =
            (now.getTime() - symptoms[0].timestamp.getTime()) /
            (1000 * 60 * 60 * 24);
          const frequency = (symptoms.length / daysSinceFirst) * 7; // per week

          const averageSeverity =
            symptoms.reduce((sum, s) => sum + s.severity, 0) / symptoms.length;

          // Compare recent vs older symptoms
          const midpoint = Math.floor(symptoms.length / 2);
          const recentCount = symptoms.slice(midpoint).length;
          const olderCount = symptoms.slice(0, midpoint).length;

          const recentFrequency =
            olderCount > 0 ? (recentCount / olderCount) * frequency : frequency;

          const trend =
            recentFrequency > frequency * 1.3
              ? 'increasing'
              : recentFrequency < frequency * 0.7
              ? 'decreasing'
              : 'stable';

          let severity: 'critical' | 'warning' | null = null;

          if (trend === 'increasing') {
            if (frequency >= 5 || averageSeverity >= 4) {
              severity = 'critical';
            } else if (frequency >= 3 || averageSeverity >= 3) {
              severity = 'warning';
            }
          } else if (averageSeverity >= 4 && frequency >= 2) {
            severity = 'warning';
          }

          if (severity) {
            await sendTrendAlertToAdmins(userId, userName, 'symptom', {
              type: symptomType,
              trend,
              severity,
              message: `${symptomType} is ${trend === 'increasing' ? 'becoming more frequent' : trend === 'decreasing' ? 'decreasing in frequency' : 'occurring regularly'} (${frequency.toFixed(1)}x per week, avg severity ${averageSeverity.toFixed(1)}/5)`,
              frequency,
            });
          }
        }
      }
    } catch (error) {
      logger.error('Error analyzing health trends', error as Error, {
        fn: 'analyzeHealthTrends',
      });
      // Don't throw - this is a background function
    }
  }
);
