import axios from 'axios';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface ExpoPushMessage {
  to: string | string[];
  title?: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
  ttl?: number;
}

interface ExpoPushTicket {
  id?: string;
  status: 'ok' | 'error';
  message?: string;
  details?: {
    error?: string;
  };
}

interface ExpoPushReceipt {
  status: 'ok' | 'error';
  message?: string;
  details?: {
    error?: string;
  };
}

/**
 * Send push notification via Expo Push Notification service
 * @param pushToken - Expo push token (ExponentPushToken[xxx])
 * @param title - Notification title
 * @param body - Notification body/message
 * @param data - Optional data payload
 * @returns boolean indicating success
 */
export async function sendPushNotification(
  pushToken: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<boolean> {
  try {
    // Validate Expo push token format
    if (!pushToken || !isExpoPushToken(pushToken)) {
      console.error('Invalid Expo push token:', pushToken);
      return false;
    }

    const message: ExpoPushMessage = {
      to: pushToken,
      title,
      body,
      sound: 'default',
      priority: 'high',
      data: data || {},
    };

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    };

    // Add authorization if access token is available
    if (process.env.EXPO_ACCESS_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
    }

    const response = await axios.post<{ data: ExpoPushTicket[] }>(
      EXPO_PUSH_URL,
      [message],
      { headers }
    );

    const ticket = response.data.data[0];

    if (ticket.status === 'ok') {
      console.log(`✅ Push notification sent to ${pushToken}`);
      return true;
    } else {
      console.error('Push notification failed:', ticket.message, ticket.details);
      return false;
    }
  } catch (error) {
    console.error('Push notification error:', error);
    return false;
  }
}

/**
 * Send push notifications to multiple tokens
 * @param pushTokens - Array of Expo push tokens
 * @param title - Notification title
 * @param body - Notification body/message
 * @param data - Optional data payload
 * @returns Object with success count and failed tokens
 */
export async function sendBulkPushNotifications(
  pushTokens: string[],
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<{ successCount: number; failedTokens: string[] }> {
  const validTokens = pushTokens.filter(isExpoPushToken);
  const failedTokens: string[] = [];
  
  if (validTokens.length === 0) {
    return { successCount: 0, failedTokens: pushTokens };
  }

  try {
    const messages: ExpoPushMessage[] = validTokens.map(token => ({
      to: token,
      title,
      body,
      sound: 'default',
      priority: 'high',
      data: data || {},
    }));

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    };

    if (process.env.EXPO_ACCESS_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
    }

    // Send in chunks of 100 (Expo's limit)
    const chunkSize = 100;
    let successCount = 0;

    for (let i = 0; i < messages.length; i += chunkSize) {
      const chunk = messages.slice(i, i + chunkSize);
      const tokenChunk = validTokens.slice(i, i + chunkSize);

      const response = await axios.post<{ data: ExpoPushTicket[] }>(
        EXPO_PUSH_URL,
        chunk,
        { headers }
      );

      response.data.data.forEach((ticket, index) => {
        if (ticket.status === 'ok') {
          successCount++;
        } else {
          failedTokens.push(tokenChunk[index]);
        }
      });
    }

    console.log(`✅ Bulk push sent: ${successCount}/${validTokens.length} successful`);
    return { successCount, failedTokens };
  } catch (error) {
    console.error('Bulk push notification error:', error);
    return { successCount: 0, failedTokens: validTokens };
  }
}

/**
 * Validate if a string is a valid Expo push token
 */
export function isExpoPushToken(token: string): boolean {
  return /^ExponentPushToken\[.+\]$/.test(token) || /^ExpoPushToken\[.+\]$/.test(token);
}

/**
 * Order notification templates
 */
export const PushTemplates = {
  orderPlaced: (orderNumber: string) => ({
    title: '🎉 Order Confirmed!',
    body: `Your order #${orderNumber} has been placed successfully.`,
  }),
  
  orderShipped: (orderNumber: string, trackingNumber?: string) => ({
    title: '📦 Order Shipped!',
    body: `Your order #${orderNumber} is on its way!${trackingNumber ? ` Track: ${trackingNumber}` : ''}`,
  }),
  
  orderDelivered: (orderNumber: string) => ({
    title: '✅ Order Delivered!',
    body: `Your order #${orderNumber} has been delivered. Enjoy!`,
  }),
  
  orderCancelled: (orderNumber: string) => ({
    title: '❌ Order Cancelled',
    body: `Your order #${orderNumber} has been cancelled.`,
  }),
  
  refundProcessed: (amount: string) => ({
    title: '💰 Refund Processed',
    body: `Your refund of ${amount} has been processed.`,
  }),
  
  priceDropAlert: (productName: string, newPrice: string) => ({
    title: '🔥 Price Drop Alert!',
    body: `${productName} is now ${newPrice}!`,
  }),
  
  backInStock: (productName: string) => ({
    title: '📢 Back in Stock!',
    body: `${productName} is back in stock. Get it before it's gone!`,
  }),
  
  promotional: (title: string, message: string) => ({
    title,
    body: message,
  }),
};
