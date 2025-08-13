import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ScrollView,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { pushNotificationService } from '@/lib/services/pushNotificationService';
import { fcmService } from '@/lib/services/fcmService';
import { alertService } from '@/lib/services/alertService';

export default function DebugNotificationsScreen() {
  const { user } = useAuth();
  const [lastTest, setLastTest] = useState<string>('');

  const testLocalNotification = async () => {
    try {
      console.log('📱 Testing local notification...');
      const Notifications = await import('expo-notifications');

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🧪 Direct Local Test',
          body: 'This is a direct local notification test',
          sound: 'default',
          badge: 1,
          color: '#2563EB',
        },
        trigger: null,
      });

      setLastTest('Direct local notification sent');
      console.log('✅ Direct local notification sent');
    } catch (error) {
      console.error('❌ Local notification failed:', error);
      setLastTest(`Error: ${error}`);
    }
  };

  const testServiceNotification = async () => {
    if (!user) {
      Alert.alert('Error', 'Please log in first');
      return;
    }

    try {
      console.log('📱 Testing service notification...');
      await pushNotificationService.sendTestNotification(user.id, user.name);
      setLastTest('Service notification sent');
      console.log('✅ Service notification sent');
    } catch (error) {
      console.error('❌ Service notification failed:', error);
      setLastTest(`Error: ${error}`);
    }
  };

  const testFallAlert = async () => {
    if (!user) {
      Alert.alert('Error', 'Please log in first');
      return;
    }

    try {
      console.log('🚨 Testing fall alert...');
      const alertId = await alertService.createFallAlert(user.id);
      setLastTest(`Fall alert created: ${alertId}`);
      console.log('✅ Fall alert created:', alertId);
    } catch (error) {
      console.error('❌ Fall alert failed:', error);
      setLastTest(`Error: ${error}`);
    }
  };

  const testFCMAvailability = async () => {
    try {
      console.log('📱 Testing FCM availability...');
      const isAvailable = await fcmService.isFCMAvailable();
      setLastTest(`FCM Available: ${isAvailable}`);
      console.log('📱 FCM Available:', isAvailable);
    } catch (error) {
      console.error('❌ FCM availability check failed:', error);
      setLastTest(`Error: ${error}`);
    }
  };

  const testFCMToken = async () => {
    if (!user) {
      Alert.alert('Error', 'Please log in first');
      return;
    }

    try {
      console.log('📱 Testing FCM token...');
      const tokenResult = await fcmService.getFCMToken();
      setLastTest(`FCM Token: ${JSON.stringify(tokenResult, null, 2)}`);
      console.log('📱 FCM Token result:', tokenResult);
    } catch (error) {
      console.error('❌ FCM token failed:', error);
      setLastTest(`Error: ${error}`);
    }
  };

  const testFCMInitialization = async () => {
    if (!user) {
      Alert.alert('Error', 'Please log in first');
      return;
    }

    try {
      console.log('📱 Testing FCM initialization...');
      const success = await fcmService.initializeFCM(user.id);
      setLastTest(`FCM Initialized: ${success}`);
      console.log('📱 FCM Initialized:', success);
    } catch (error) {
      console.error('❌ FCM initialization failed:', error);
      setLastTest(`Error: ${error}`);
    }
  };

  const checkPermissions = async () => {
    try {
      const Notifications = await import('expo-notifications');
      const permission = await Notifications.getPermissionsAsync();

      console.log('🔒 Notification permissions:', permission);
      setLastTest(`Permissions: ${JSON.stringify(permission, null, 2)}`);

      if (!permission.granted) {
        const request = await Notifications.requestPermissionsAsync();
        console.log('🔒 Permission request result:', request);
        setLastTest(
          `Permission requested: ${JSON.stringify(request, null, 2)}`
        );
      }
    } catch (error) {
      console.error('❌ Permission check failed:', error);
      setLastTest(`Error: ${error}`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <Text style={styles.title}>🧪 Notification Debug</Text>

        <Text style={styles.userInfo}>
          User: {user?.name || 'Not logged in'}
        </Text>

        <Text style={styles.userInfo}>
          Family ID: {user?.familyId || 'No family'}
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Step 1: Check Permissions</Text>
          <TouchableOpacity style={styles.button} onPress={checkPermissions}>
            <Text style={styles.buttonText}>Check Permissions</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Step 2: Test Direct Local</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={testLocalNotification}
          >
            <Text style={styles.buttonText}>
              Send Direct Local Notification
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Step 3: Test Service</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={testServiceNotification}
          >
            <Text style={styles.buttonText}>Send Service Notification</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Step 4: Test Fall Alert</Text>
          <TouchableOpacity style={styles.button} onPress={testFallAlert}>
            <Text style={styles.buttonText}>Create Fall Alert</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Remote Push (FCM) Tests</Text>
          <TouchableOpacity
            style={styles.fcmButton}
            onPress={testFCMAvailability}
          >
            <Text style={styles.buttonText}>Check FCM Availability</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.fcmButton} onPress={testFCMToken}>
            <Text style={styles.buttonText}>Get FCM Token</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.fcmButton}
            onPress={testFCMInitialization}
          >
            <Text style={styles.buttonText}>Initialize FCM</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.result}>
          <Text style={styles.resultTitle}>Last Test Result:</Text>
          <Text style={styles.resultText}>
            {lastTest || 'No tests run yet'}
          </Text>
        </View>

        <View style={styles.instructions}>
          <Text style={styles.instructionsTitle}>📋 Testing Instructions:</Text>
          <Text style={styles.instructionsText}>
            <Text style={{ fontWeight: 'bold' }}>
              Local Notifications (Blue buttons):
            </Text>
            {'\n'}
            1. Make sure your app has notification permissions{'\n'}
            2. Put the app in background after tapping a test button{'\n'}
            3. Check your notification panel{'\n'}
            4. Watch the console logs in Expo{'\n\n'}
            <Text style={{ fontWeight: 'bold' }}>
              Remote FCM Push (Purple buttons):
            </Text>
            {'\n'}
            1. FCM requires a development build (not Expo Go){'\n'}
            2. Check FCM availability first{'\n'}
            3. Get FCM token to verify setup{'\n'}
            4. Initialize FCM to register with Firebase{'\n'}
            5. FCM will send push notifications to other devices
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  userInfo: {
    fontSize: 16,
    marginBottom: 10,
    padding: 10,
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  button: {
    backgroundColor: '#2563EB',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  fcmButton: {
    backgroundColor: '#7C3AED',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  result: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  resultText: {
    fontSize: 14,
    fontFamily: 'monospace',
  },
  instructions: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#DBEAFE',
    borderRadius: 8,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  instructionsText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
