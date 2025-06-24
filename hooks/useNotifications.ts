import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

export const useNotifications = () => {
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();

  useEffect(() => {
    if (Platform.OS === 'web') {
      // Notifications not available on web
      return;
    }

    try {
      const Notifications = require('expo-notifications');
      
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });

      registerForPushNotificationsAsync();

      notificationListener.current = Notifications.addNotificationReceivedListener((notification: any) => {
        console.log('Notification received:', notification);
      });

      responseListener.current = Notifications.addNotificationResponseReceivedListener((response: any) => {
        console.log('Notification response:', response);
      });

      return () => {
        if (notificationListener.current) {
          Notifications.removeNotificationSubscription(notificationListener.current);
        }
        if (responseListener.current) {
          Notifications.removeNotificationSubscription(responseListener.current);
        }
      };
    } catch (error) {
      console.warn('Notifications not available:', error);
    }
  }, []);

  const scheduleNotification = async (title: string, body: string, trigger: Date) => {
    if (Platform.OS === 'web') {
      console.log('Notification scheduled (web):', { title, body, trigger });
      return;
    }

    try {
      const Notifications = require('expo-notifications');
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: 'default',
        },
        trigger,
      });
    } catch (error) {
      console.warn('Failed to schedule notification:', error);
    }
  };

  const scheduleMedicationReminder = async (medicationName: string, time: Date) => {
    await scheduleNotification(
      'Medication Reminder',
      `Time to take your ${medicationName}`,
      time
    );
  };

  return {
    scheduleNotification,
    scheduleMedicationReminder,
  };
};

async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'web') {
    return;
  }

  try {
    const Notifications = require('expo-notifications');
    const Device = require('expo-device');

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        console.warn('Failed to get push token for push notification!');
        return;
      }
    }
  } catch (error) {
    console.warn('Failed to register for push notifications:', error);
  }
}