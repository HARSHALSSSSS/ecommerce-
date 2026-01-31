import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationsAPI } from './api';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Register for push notifications and get Expo Push Token
 * @returns Expo Push Token or null if failed
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token: string | null = null;

  // Check if physical device (push notifications don't work on simulators)
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  try {
    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permissions if not granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission not granted');
      return null;
    }

    // Get Expo Push Token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'your-project-id', // Will use app.json projectId by default
    });
    token = tokenData.data;

    console.log('✅ Expo Push Token:', token);
  } catch (error) {
    console.error('Error getting push token:', error);
    return null;
  }

  // Configure Android notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF6B6B',
    });

    // Order notifications channel
    await Notifications.setNotificationChannelAsync('orders', {
      name: 'Order Updates',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#3B82F6',
    });

    // Promotional notifications channel
    await Notifications.setNotificationChannelAsync('promotions', {
      name: 'Promotions',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  return token;
}

/**
 * Register push token with backend server
 */
export async function registerPushTokenWithServer(token: string): Promise<boolean> {
  try {
    const userToken = await AsyncStorage.getItem('userToken');
    if (!userToken) {
      console.log('User not logged in, skipping push token registration');
      return false;
    }

    await notificationsAPI.registerPushToken(token, Platform.OS, Device.modelName || undefined);
    console.log('✅ Push token registered with server');
    
    // Save token locally
    await AsyncStorage.setItem('expoPushToken', token);
    return true;
  } catch (error) {
    console.error('Failed to register push token with server:', error);
    return false;
  }
}

/**
 * Initialize push notifications for the app
 * Call this when user logs in or app starts with authenticated user
 */
export async function initializePushNotifications(): Promise<string | null> {
  try {
    const token = await registerForPushNotificationsAsync();
    
    if (token) {
      await registerPushTokenWithServer(token);
    }
    
    return token;
  } catch (error) {
    console.error('Push notification initialization error:', error);
    return null;
  }
}

/**
 * Unregister push token when user logs out
 */
export async function unregisterPushToken(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem('expoPushToken');
    if (token) {
      await notificationsAPI.unregisterPushToken(token);
      await AsyncStorage.removeItem('expoPushToken');
      console.log('✅ Push token unregistered');
    }
  } catch (error) {
    console.error('Failed to unregister push token:', error);
  }
}

/**
 * Add listener for when a notification is received while app is foregrounded
 */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
): Notifications.EventSubscription {
  return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Add listener for when user taps on a notification
 */
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.EventSubscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Get the last notification response (if app was opened from notification)
 */
export async function getLastNotificationResponse(): Promise<Notifications.NotificationResponse | null> {
  return Notifications.getLastNotificationResponseAsync();
}

/**
 * Schedule a local notification
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: Record<string, any>,
  seconds: number = 1
): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger: seconds > 0 ? { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds } : null,
  });
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Get badge count
 */
export async function getBadgeCount(): Promise<number> {
  return Notifications.getBadgeCountAsync();
}

/**
 * Set badge count
 */
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}
