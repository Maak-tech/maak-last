import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';

export const useNotifications = () => {
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();
  const isInitialized = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web' || isInitialized.current) {
      return;
    }

    const initializeNotifications = async () => {
      try {
        const [Notifications, Device] = await Promise.all([
          import('expo-notifications'),
          import('expo-device')
        ]);
        
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          }),
        });

        await registerForPushNotificationsAsync(Notifications, Device);

        notificationListener.current = Notifications.addNotificationReceivedListener((notification: any) => {
          console.log('Notification received:', notification);
        });

        responseListener.current = Notifications.addNotificationResponseReceivedListener((response: any) => {
          console.log('Notification response:', response);
        });

        isInitialized.current = true;
      } catch (error) {
        console.warn('Failed to initialize notifications:', error);
      }
    };

    initializeNotifications();

    return () => {
      if (notificationListener.current) {
        try {
          notificationListener.current.remove();
        } catch (error) {
          console.warn('Error removing notification listener:', error);
        }
      }
      if (responseListener.current) {
        try {
          responseListener.current.remove();
        } catch (error) {
          console.warn('Error removing response listener:', error);
        }
      }
    };
  }, []);

  const scheduleNotification = useCallback(async (title: string, body: string, trigger: Date) => {
    if (Platform.OS === 'web') {
      console.log('Notification scheduled (web):', { title, body, trigger });
      return;
    }

    try {
      const Notifications = await import('expo-notifications');
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
  }, []);

  const scheduleMedicationReminder = useCallback(async (medicationName: string, time: Date) => {
    await scheduleNotification(
      'Medication Reminder',
      `Time to take your ${medicationName}`,
      time
    );
  }, [scheduleNotification]);

  return {
    scheduleNotification,
    scheduleMedicationReminder,
  };
};

async function registerForPushNotificationsAsync(Notifications: any, Device: any) {
  try {
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
        console.warn('Push notification permissions not granted');
        return;
      }
      
      console.log('Push notifications registered successfully');
    } else {
      console.warn('Must use physical device for push notifications');
    }
  } catch (error) {
    console.warn('Failed to register for push notifications:', error);
  }
}