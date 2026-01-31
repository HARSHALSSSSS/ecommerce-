import { Router } from 'express';
import { authenticateAdmin, authenticateUser } from '../middleware/auth';
import { getDatabase } from '../config/database';
import { sendEmail } from '../utils/email';
import { sendPushNotification, sendBulkPushNotifications } from '../utils/pushNotification';

const router = Router();

// ==================== NOTIFICATION SERVICE HELPERS ====================

// Get user push tokens
async function getUserPushTokens(userId: number): Promise<string[]> {
  const db = getDatabase();
  const tokens = await db.all(
    'SELECT token FROM push_tokens WHERE user_id = ? AND is_active = 1',
    [userId]
  );
  return tokens.map((t: any) => t.token);
}

// Send notification helper function with real delivery
async function sendNotification(data: {
  user_id?: number;
  admin_id?: number;
  notification_type: string;
  channel: string;
  recipient: string;
  subject?: string;
  message: string;
  related_type?: string;
  related_id?: number;
  metadata?: any;
}): Promise<{ id: number; delivered: boolean }> {
  const db = getDatabase();
  let delivered = false;
  let errorMessage: string | null = null;

  // Actually send the notification based on channel
  try {
    if (data.channel === 'email' && data.recipient) {
      // Send real email
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>${data.subject || 'Notification'}</h2>
          <p>${data.message}</p>
          <hr style="margin: 20px 0;">
          <p style="color: #888; font-size: 12px;">This email was sent from Ecommerce App</p>
        </div>
      `;
      delivered = await sendEmail(data.recipient, data.subject || 'Notification', emailHtml);
    } else if (data.channel === 'push' && data.user_id) {
      // Send real push notification
      const pushTokens = await getUserPushTokens(data.user_id);
      if (pushTokens.length > 0) {
        for (const token of pushTokens) {
          delivered = await sendPushNotification(
            token,
            data.subject || 'Notification',
            data.message,
            {
              type: data.notification_type,
              related_type: data.related_type,
              related_id: data.related_id,
            }
          );
          if (delivered) break; // At least one succeeded
        }
      }
    } else if (data.channel === 'in_app') {
      // In-app notifications are stored in DB and marked as delivered
      delivered = true;
    }
  } catch (error: any) {
    console.error(`Notification delivery error (${data.channel}):`, error);
    errorMessage = error.message || 'Delivery failed';
  }
  
  const result = await db.run(
    `INSERT INTO notification_logs (
      user_id, admin_id, notification_type, channel, recipient, subject, message,
      related_type, related_id, status, sent_at, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.user_id || null,
      data.admin_id || null,
      data.notification_type,
      data.channel,
      data.recipient,
      data.subject || null,
      data.message,
      data.related_type || null,
      data.related_id || null,
      delivered ? 'delivered' : 'failed',
      new Date().toISOString(),
      data.metadata ? JSON.stringify({ ...data.metadata, error: errorMessage }) : (errorMessage ? JSON.stringify({ error: errorMessage }) : null)
    ]
  );

  // If failed, add to DLQ for retry
  if (!delivered && data.channel !== 'in_app') {
    await db.run(
      `INSERT INTO notification_dlq (
        original_notification_id, user_id, notification_type, channel, recipient,
        subject, message, related_type, related_id, error_message, status, next_retry_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        result.lastID,
        data.user_id || null,
        data.notification_type,
        data.channel,
        data.recipient,
        data.subject || null,
        data.message,
        data.related_type || null,
        data.related_id || null,
        errorMessage,
        'pending',
        new Date(Date.now() + 5 * 60 * 1000).toISOString() // Retry in 5 minutes
      ]
    );
  }

  return { id: result.lastID, delivered };
}

// ==================== ADMIN ROUTES ====================

// Get all notification logs (admin)
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const { 
      page = 1, 
      limit = 20, 
      notification_type,
      channel,
      status,
      start_date,
      end_date,
      search 
    } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = `
      SELECT nl.*, 
             u.name as user_name, u.email as user_email,
             a.name as admin_name
      FROM notification_logs nl
      LEFT JOIN users u ON nl.user_id = u.id
      LEFT JOIN admins a ON nl.admin_id = a.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (notification_type && notification_type !== 'all') {
      query += ' AND nl.notification_type = ?';
      params.push(notification_type);
    }

    if (channel && channel !== 'all') {
      query += ' AND nl.channel = ?';
      params.push(channel);
    }

    if (status && status !== 'all') {
      query += ' AND nl.status = ?';
      params.push(status);
    }

    if (start_date) {
      query += ' AND DATE(nl.created_at) >= DATE(?)';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND DATE(nl.created_at) <= DATE(?)';
      params.push(end_date);
    }

    if (search) {
      query += ' AND (nl.subject LIKE ? OR nl.message LIKE ? OR u.name LIKE ? OR u.email LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Get total count
    const countQuery = query.replace(
      'SELECT nl.*, u.name as user_name, u.email as user_email, a.name as admin_name',
      'SELECT COUNT(*) as total'
    );
    const countResult = await db.get(countQuery, params);

    // Get paginated notifications
    query += ' ORDER BY nl.created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), offset);

    const notifications = await db.all(query, params);

    // Get notification stats
    const stats = await db.get(`
      SELECT 
        COUNT(*) as total_count,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_count,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_count,
        COUNT(CASE WHEN status = 'read' THEN 1 END) as read_count,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
        COUNT(CASE WHEN channel = 'email' THEN 1 END) as email_count,
        COUNT(CASE WHEN channel = 'push' THEN 1 END) as push_count,
        COUNT(CASE WHEN channel = 'sms' THEN 1 END) as sms_count,
        COUNT(CASE WHEN channel = 'in_app' THEN 1 END) as in_app_count,
        COUNT(CASE WHEN DATE(created_at) = DATE('now') THEN 1 END) as today_count
      FROM notification_logs
    `);

    // Get notification types breakdown
    const typeBreakdown = await db.all(`
      SELECT notification_type, COUNT(*) as count
      FROM notification_logs
      GROUP BY notification_type
      ORDER BY count DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      notifications,
      stats: {
        ...stats,
        type_breakdown: typeBreakdown
      },
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: countResult?.total || 0,
        totalPages: Math.ceil((countResult?.total || 0) / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get single notification (admin)
router.get('/:id', authenticateAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const notification = await db.get(
      `SELECT nl.*, 
              u.name as user_name, u.email as user_email, u.phone as user_phone,
              a.name as admin_name
       FROM notification_logs nl
       LEFT JOIN users u ON nl.user_id = u.id
       LEFT JOIN admins a ON nl.admin_id = a.id
       WHERE nl.id = ?`,
      [req.params.id]
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.json({ success: true, notification });
  } catch (error) {
    console.error('Get notification error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Send notification to user (admin)
router.post('/send', authenticateAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const admin = (req as any).admin;
    const { 
      user_id, 
      notification_type,
      channel,
      subject,
      message,
      related_type,
      related_id 
    } = req.body;

    // Get user details
    const user = await db.get('SELECT id, email, phone FROM users WHERE id = ?', [user_id]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Determine recipient based on channel
    let recipient = user_id.toString();
    if (channel === 'email') {
      recipient = user.email;
    } else if (channel === 'sms' && user.phone) {
      recipient = user.phone;
    }

    const notificationId = await sendNotification({
      user_id,
      admin_id: admin.id,
      notification_type: notification_type || 'admin_message',
      channel: channel || 'in_app',
      recipient,
      subject,
      message,
      related_type,
      related_id,
      metadata: { sent_by_admin: admin.id }
    });

    // Log admin action
    await db.run(
      `INSERT INTO admin_logs (admin_id, action, resource_type, resource_id, changes)
       VALUES (?, ?, ?, ?, ?)`,
      [admin.id, 'send_notification', 'notification', notificationId, JSON.stringify({ 
        user_id,
        channel,
        notification_type
      })]
    );

    res.json({ 
      success: true, 
      message: 'Notification sent successfully',
      notification_id: notificationId
    });
  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Send bulk notification (admin)
router.post('/send-bulk', authenticateAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const admin = (req as any).admin;
    const { 
      user_ids,
      notification_type,
      channel,
      subject,
      message 
    } = req.body;

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return res.status(400).json({ success: false, message: 'User IDs are required' });
    }

    let successCount = 0;
    let failCount = 0;

    for (const userId of user_ids) {
      try {
        const user = await db.get('SELECT id, email, phone FROM users WHERE id = ?', [userId]);
        if (user) {
          let recipient = userId.toString();
          if (channel === 'email') {
            recipient = user.email;
          } else if (channel === 'sms' && user.phone) {
            recipient = user.phone;
          }

          await sendNotification({
            user_id: userId,
            admin_id: admin.id,
            notification_type: notification_type || 'admin_message',
            channel: channel || 'in_app',
            recipient,
            subject,
            message,
            metadata: { sent_by_admin: admin.id, bulk_send: true }
          });
          successCount++;
        } else {
          failCount++;
        }
      } catch (e) {
        failCount++;
      }
    }

    // Log admin action
    await db.run(
      `INSERT INTO admin_logs (admin_id, action, resource_type, resource_id, changes)
       VALUES (?, ?, ?, ?, ?)`,
      [admin.id, 'send_bulk_notification', 'notification', null, JSON.stringify({ 
        total_users: user_ids.length,
        success_count: successCount,
        fail_count: failCount,
        channel,
        notification_type
      })]
    );

    res.json({ 
      success: true, 
      message: `Notifications sent: ${successCount} success, ${failCount} failed`,
      success_count: successCount,
      fail_count: failCount
    });
  } catch (error) {
    console.error('Send bulk notification error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get notification templates (admin)
router.get('/templates/list', authenticateAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const templates = await db.all('SELECT * FROM notification_templates ORDER BY name');
    res.json({ success: true, templates });
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create notification template (admin)
router.post('/templates', authenticateAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const { 
      name, 
      notification_type, 
      channel, 
      subject_template, 
      body_template,
      variables 
    } = req.body;

    const result = await db.run(
      `INSERT INTO notification_templates (
        name, notification_type, channel, subject_template, body_template, variables
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [name, notification_type, channel, subject_template, body_template, JSON.stringify(variables || [])]
    );

    res.json({ 
      success: true, 
      message: 'Template created successfully',
      template_id: result.lastID
    });
  } catch (error) {
    console.error('Create template error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update notification template (admin)
router.put('/templates/:id', authenticateAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { 
      name, 
      notification_type, 
      channel, 
      subject_template, 
      body_template,
      variables,
      is_active 
    } = req.body;

    await db.run(
      `UPDATE notification_templates 
       SET name = ?, notification_type = ?, channel = ?, subject_template = ?, 
           body_template = ?, variables = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, notification_type, channel, subject_template, body_template, 
       JSON.stringify(variables || []), is_active ? 1 : 0, id]
    );

    res.json({ success: true, message: 'Template updated successfully' });
  } catch (error) {
    console.error('Update template error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==================== USER ROUTES ====================

// Get user's notifications
router.get('/user/list', authenticateUser, async (req, res) => {
  try {
    const db = getDatabase();
    const user = (req as any).user;
    const { page = 1, limit = 20, unread_only } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = `
      SELECT * FROM notification_logs
      WHERE user_id = ?
    `;
    const params: any[] = [user.id];

    if (unread_only === 'true') {
      query += ' AND read_at IS NULL';
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), offset);

    const notifications = await db.all(query, params);

    const countResult = await db.get(
      'SELECT COUNT(*) as total FROM notification_logs WHERE user_id = ?',
      [user.id]
    );

    const unreadCount = await db.get(
      'SELECT COUNT(*) as count FROM notification_logs WHERE user_id = ? AND read_at IS NULL',
      [user.id]
    );

    res.json({
      success: true,
      notifications,
      unread_count: unreadCount?.count || 0,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: countResult?.total || 0,
        totalPages: Math.ceil((countResult?.total || 0) / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get user notifications error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get user's unread notification count
router.get('/user/unread-count', authenticateUser, async (req, res) => {
  try {
    const db = getDatabase();
    const user = (req as any).user;

    const result = await db.get(
      'SELECT COUNT(*) as count FROM notification_logs WHERE user_id = ? AND read_at IS NULL',
      [user.id]
    );

    res.json({ success: true, unread_count: result?.count || 0 });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Mark notification as read
router.patch('/user/:id/read', authenticateUser, async (req, res) => {
  try {
    const db = getDatabase();
    const user = (req as any).user;
    const { id } = req.params;

    const notification = await db.get(
      'SELECT id FROM notification_logs WHERE id = ? AND user_id = ?',
      [id, user.id]
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    await db.run(
      'UPDATE notification_logs SET read_at = CURRENT_TIMESTAMP, status = ? WHERE id = ?',
      ['read', id]
    );

    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Mark all notifications as read
router.patch('/user/read-all', authenticateUser, async (req, res) => {
  try {
    const db = getDatabase();
    const user = (req as any).user;

    await db.run(
      'UPDATE notification_logs SET read_at = CURRENT_TIMESTAMP, status = ? WHERE user_id = ? AND read_at IS NULL',
      ['read', user.id]
    );

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get user notification preferences
router.get('/user/preferences', authenticateUser, async (req, res) => {
  try {
    const db = getDatabase();
    const user = (req as any).user;

    let preferences = await db.get(
      'SELECT * FROM user_notification_preferences WHERE user_id = ?',
      [user.id]
    );

    if (!preferences) {
      // Create default preferences
      await db.run(
        'INSERT INTO user_notification_preferences (user_id) VALUES (?)',
        [user.id]
      );
      preferences = await db.get(
        'SELECT * FROM user_notification_preferences WHERE user_id = ?',
        [user.id]
      );
    }

    res.json({ success: true, preferences });
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update user notification preferences
router.put('/user/preferences', authenticateUser, async (req, res) => {
  try {
    const db = getDatabase();
    const user = (req as any).user;
    const { 
      order_updates,
      shipping_updates,
      payment_updates,
      promotional,
      email_enabled,
      push_enabled,
      sms_enabled 
    } = req.body;

    // Ensure preferences exist
    const existing = await db.get(
      'SELECT id FROM user_notification_preferences WHERE user_id = ?',
      [user.id]
    );

    if (!existing) {
      await db.run(
        `INSERT INTO user_notification_preferences (
          user_id, order_updates, shipping_updates, payment_updates, 
          promotional, email_enabled, push_enabled, sms_enabled
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [user.id, 
         order_updates !== undefined ? (order_updates ? 1 : 0) : 1,
         shipping_updates !== undefined ? (shipping_updates ? 1 : 0) : 1,
         payment_updates !== undefined ? (payment_updates ? 1 : 0) : 1,
         promotional !== undefined ? (promotional ? 1 : 0) : 1,
         email_enabled !== undefined ? (email_enabled ? 1 : 0) : 1,
         push_enabled !== undefined ? (push_enabled ? 1 : 0) : 1,
         sms_enabled !== undefined ? (sms_enabled ? 1 : 0) : 0]
      );
    } else {
      await db.run(
        `UPDATE user_notification_preferences 
         SET order_updates = ?, shipping_updates = ?, payment_updates = ?,
             promotional = ?, email_enabled = ?, push_enabled = ?, sms_enabled = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ?`,
        [
          order_updates !== undefined ? (order_updates ? 1 : 0) : 1,
          shipping_updates !== undefined ? (shipping_updates ? 1 : 0) : 1,
          payment_updates !== undefined ? (payment_updates ? 1 : 0) : 1,
          promotional !== undefined ? (promotional ? 1 : 0) : 1,
          email_enabled !== undefined ? (email_enabled ? 1 : 0) : 1,
          push_enabled !== undefined ? (push_enabled ? 1 : 0) : 1,
          sms_enabled !== undefined ? (sms_enabled ? 1 : 0) : 0,
          user.id
        ]
      );
    }

    res.json({ success: true, message: 'Preferences updated successfully' });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==================== EVENT-DRIVEN NOTIFICATION TRIGGERS ====================

// Trigger order status notification (internal use)
router.post('/trigger/order-status', async (req, res) => {
  try {
    const db = getDatabase();
    const { order_id, new_status, old_status } = req.body;

    const order = await db.get(
      `SELECT o.*, u.email, u.name 
       FROM orders o 
       LEFT JOIN users u ON o.user_id = u.id 
       WHERE o.id = ?`,
      [order_id]
    );

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Check user preferences
    const prefs = await db.get(
      'SELECT order_updates FROM user_notification_preferences WHERE user_id = ?',
      [order.user_id]
    );

    if (prefs && !prefs.order_updates) {
      return res.json({ success: true, message: 'User has disabled order updates' });
    }

    const statusMessages: { [key: string]: string } = {
      'confirmed': `Your order #${order.order_number} has been confirmed and is being processed.`,
      'processing': `Your order #${order.order_number} is now being prepared for shipment.`,
      'shipped': `Great news! Your order #${order.order_number} has been shipped.`,
      'out_for_delivery': `Your order #${order.order_number} is out for delivery today!`,
      'delivered': `Your order #${order.order_number} has been delivered. Thank you for shopping with us!`,
      'cancelled': `Your order #${order.order_number} has been cancelled.`,
      'refunded': `A refund has been processed for your order #${order.order_number}.`
    };

    const message = statusMessages[new_status] || `Your order #${order.order_number} status has been updated to ${new_status}.`;

    await sendNotification({
      user_id: order.user_id,
      notification_type: 'order_status_update',
      channel: 'in_app',
      recipient: order.user_id.toString(),
      subject: `Order Status Update: ${new_status.charAt(0).toUpperCase() + new_status.slice(1)}`,
      message,
      related_type: 'order',
      related_id: order_id,
      metadata: { old_status, new_status }
    });

    res.json({ success: true, message: 'Notification sent' });
  } catch (error) {
    console.error('Trigger order notification error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Trigger payment notification (internal use)
router.post('/trigger/payment', async (req, res) => {
  try {
    const db = getDatabase();
    const { payment_id, event_type } = req.body;

    const payment = await db.get(
      `SELECT p.*, o.order_number, u.email, u.name 
       FROM payments p 
       LEFT JOIN orders o ON p.order_id = o.id
       LEFT JOIN users u ON p.user_id = u.id 
       WHERE p.id = ?`,
      [payment_id]
    );

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    const prefs = await db.get(
      'SELECT payment_updates FROM user_notification_preferences WHERE user_id = ?',
      [payment.user_id]
    );

    if (prefs && !prefs.payment_updates) {
      return res.json({ success: true, message: 'User has disabled payment updates' });
    }

    const eventMessages: { [key: string]: string } = {
      'completed': `Payment of $${payment.amount.toFixed(2)} for order #${payment.order_number} was successful.`,
      'failed': `Payment for order #${payment.order_number} failed. Please try again or use a different payment method.`,
      'refunded': `A refund of $${Math.abs(payment.amount).toFixed(2)} has been processed for order #${payment.order_number}.`
    };

    const message = eventMessages[event_type] || `Payment update for order #${payment.order_number}.`;

    await sendNotification({
      user_id: payment.user_id,
      notification_type: 'payment_update',
      channel: 'in_app',
      recipient: payment.user_id.toString(),
      subject: `Payment ${event_type.charAt(0).toUpperCase() + event_type.slice(1)}`,
      message,
      related_type: 'payment',
      related_id: payment_id,
      metadata: { event_type, amount: payment.amount }
    });

    res.json({ success: true, message: 'Notification sent' });
  } catch (error) {
    console.error('Trigger payment notification error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==================== DEAD LETTER QUEUE (DLQ) ROUTES ====================

// Get all DLQ entries (admin)
router.get('/dlq/list', authenticateAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const { 
      page = 1, 
      limit = 20, 
      status,
      notification_type,
      channel 
    } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = `
      SELECT dlq.*, 
             u.name as user_name, u.email as user_email
      FROM notification_dlq dlq
      LEFT JOIN users u ON dlq.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status && status !== 'all') {
      query += ' AND dlq.status = ?';
      params.push(status);
    }

    if (notification_type) {
      query += ' AND dlq.notification_type = ?';
      params.push(notification_type);
    }

    if (channel) {
      query += ' AND dlq.channel = ?';
      params.push(channel);
    }

    const countQuery = query.replace(
      'SELECT dlq.*, u.name as user_name, u.email as user_email',
      'SELECT COUNT(*) as total'
    );
    const countResult = await db.get(countQuery, params);

    query += ' ORDER BY dlq.created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), offset);

    const entries = await db.all(query, params);

    // Get DLQ stats
    const stats = await db.get(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN status = 'retrying' THEN 1 END) as retrying_count,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_count,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
        COUNT(CASE WHEN retry_count >= max_retries THEN 1 END) as max_retries_reached
      FROM notification_dlq
    `);

    res.json({
      success: true,
      entries,
      stats,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: countResult?.total || 0,
        totalPages: Math.ceil((countResult?.total || 0) / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get DLQ entries error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get single DLQ entry
router.get('/dlq/:id', authenticateAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const entry = await db.get(`
      SELECT dlq.*, 
             u.name as user_name, u.email as user_email,
             nl.id as original_notification_id
      FROM notification_dlq dlq
      LEFT JOIN users u ON dlq.user_id = u.id
      LEFT JOIN notification_logs nl ON dlq.original_notification_id = nl.id
      WHERE dlq.id = ?
    `, [id]);

    if (!entry) {
      return res.status(404).json({ success: false, message: 'DLQ entry not found' });
    }

    res.json({ success: true, entry });
  } catch (error) {
    console.error('Get DLQ entry error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Retry DLQ entry
router.post('/dlq/:id/retry', authenticateAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const entry = await db.get('SELECT * FROM notification_dlq WHERE id = ?', [id]);

    if (!entry) {
      return res.status(404).json({ success: false, message: 'DLQ entry not found' });
    }

    if (entry.retry_count >= entry.max_retries) {
      return res.status(400).json({ 
        success: false, 
        message: 'Maximum retries reached for this entry' 
      });
    }

    // Update status to retrying
    await db.run(
      `UPDATE notification_dlq SET 
        status = 'retrying', 
        retry_count = retry_count + 1,
        next_retry_at = datetime('now', '+5 minutes')
       WHERE id = ?`,
      [id]
    );

    // Attempt to resend
    try {
      const notificationId = await sendNotification({
        user_id: entry.user_id,
        notification_type: entry.notification_type,
        channel: entry.channel,
        recipient: entry.recipient,
        subject: entry.subject,
        message: entry.message,
        related_type: entry.related_type,
        related_id: entry.related_id,
        metadata: { retried_from_dlq: id, retry_count: entry.retry_count + 1 }
      });

      // Mark as resolved
      await db.run(
        `UPDATE notification_dlq SET 
          status = 'resolved', 
          resolved_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [id]
      );

      res.json({ 
        success: true, 
        message: 'Notification resent successfully',
        new_notification_id: notificationId
      });
    } catch (sendError: any) {
      // Update with new error
      await db.run(
        `UPDATE notification_dlq SET 
          status = 'pending', 
          error_message = ?,
          next_retry_at = datetime('now', '+15 minutes')
         WHERE id = ?`,
        [sendError.message || 'Retry failed', id]
      );

      res.status(500).json({ 
        success: false, 
        message: 'Retry failed, entry updated for next retry' 
      });
    }
  } catch (error) {
    console.error('Retry DLQ entry error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Bulk retry pending DLQ entries
router.post('/dlq/retry-all', authenticateAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const { notification_type, channel } = req.body;

    let query = `
      SELECT * FROM notification_dlq 
      WHERE status = 'pending' 
      AND retry_count < max_retries
    `;
    const params: any[] = [];

    if (notification_type) {
      query += ' AND notification_type = ?';
      params.push(notification_type);
    }

    if (channel) {
      query += ' AND channel = ?';
      params.push(channel);
    }

    query += ' LIMIT 50'; // Process max 50 at a time

    const entries = await db.all(query, params);
    let successCount = 0;
    let failCount = 0;

    for (const entry of entries) {
      try {
        await db.run(
          `UPDATE notification_dlq SET 
            status = 'retrying', 
            retry_count = retry_count + 1
           WHERE id = ?`,
          [entry.id]
        );

        await sendNotification({
          user_id: entry.user_id,
          notification_type: entry.notification_type,
          channel: entry.channel,
          recipient: entry.recipient,
          subject: entry.subject,
          message: entry.message,
          related_type: entry.related_type,
          related_id: entry.related_id,
          metadata: { retried_from_dlq: entry.id }
        });

        await db.run(
          `UPDATE notification_dlq SET 
            status = 'resolved', 
            resolved_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [entry.id]
        );
        successCount++;
      } catch (e) {
        await db.run(
          `UPDATE notification_dlq SET 
            status = 'pending',
            next_retry_at = datetime('now', '+30 minutes')
           WHERE id = ?`,
          [entry.id]
        );
        failCount++;
      }
    }

    res.json({
      success: true,
      message: `Retry completed: ${successCount} successful, ${failCount} failed`,
      success_count: successCount,
      fail_count: failCount
    });
  } catch (error) {
    console.error('Bulk retry DLQ error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete DLQ entry
router.delete('/dlq/:id', authenticateAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const entry = await db.get('SELECT * FROM notification_dlq WHERE id = ?', [id]);
    if (!entry) {
      return res.status(404).json({ success: false, message: 'DLQ entry not found' });
    }

    await db.run('DELETE FROM notification_dlq WHERE id = ?', [id]);

    res.json({ success: true, message: 'DLQ entry deleted' });
  } catch (error) {
    console.error('Delete DLQ entry error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Mark DLQ entry as failed (stop retrying)
router.post('/dlq/:id/mark-failed', authenticateAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { reason } = req.body;

    const entry = await db.get('SELECT * FROM notification_dlq WHERE id = ?', [id]);
    if (!entry) {
      return res.status(404).json({ success: false, message: 'DLQ entry not found' });
    }

    await db.run(
      `UPDATE notification_dlq SET 
        status = 'failed', 
        error_message = ?,
        resolved_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [reason || 'Manually marked as failed', id]
    );

    res.json({ success: true, message: 'DLQ entry marked as failed' });
  } catch (error) {
    console.error('Mark DLQ failed error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Add to DLQ helper - to be used when notification fails
async function addToDLQ(data: {
  original_notification_id?: number;
  user_id?: number;
  notification_type: string;
  channel: string;
  recipient: string;
  subject?: string;
  message: string;
  related_type?: string;
  related_id?: number;
  error_message: string;
  max_retries?: number;
}) {
  const db = getDatabase();
  
  const result = await db.run(
    `INSERT INTO notification_dlq (
      original_notification_id, user_id, notification_type, channel, recipient,
      subject, message, related_type, related_id, error_message, max_retries,
      next_retry_at, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+5 minutes'), 'pending')`,
    [
      data.original_notification_id || null,
      data.user_id || null,
      data.notification_type,
      data.channel,
      data.recipient,
      data.subject || null,
      data.message,
      data.related_type || null,
      data.related_id || null,
      data.error_message,
      data.max_retries || 3
    ]
  );

  return result.lastID;
}

// Trigger notification with DLQ support
router.post('/trigger/with-retry', authenticateAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const { 
      user_id, 
      notification_type,
      channel,
      subject,
      message,
      related_type,
      related_id,
      simulate_failure // For testing
    } = req.body;

    const user = await db.get('SELECT id, email, phone FROM users WHERE id = ?', [user_id]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let recipient = user_id.toString();
    if (channel === 'email') {
      recipient = user.email;
    } else if (channel === 'sms' && user.phone) {
      recipient = user.phone;
    }

    try {
      // Simulate failure for testing
      if (simulate_failure) {
        throw new Error('Simulated notification failure');
      }

      const notificationId = await sendNotification({
        user_id,
        notification_type: notification_type || 'general',
        channel: channel || 'in_app',
        recipient,
        subject,
        message,
        related_type,
        related_id
      });

      res.json({ 
        success: true, 
        message: 'Notification sent successfully',
        notification_id: notificationId
      });
    } catch (sendError: any) {
      // Add to DLQ
      const dlqId = await addToDLQ({
        user_id,
        notification_type: notification_type || 'general',
        channel: channel || 'in_app',
        recipient,
        subject,
        message,
        related_type,
        related_id,
        error_message: sendError.message || 'Failed to send notification'
      });

      res.status(500).json({ 
        success: false, 
        message: 'Notification failed, added to retry queue',
        dlq_id: dlqId
      });
    }
  } catch (error) {
    console.error('Trigger notification with retry error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==================== PUSH TOKEN ROUTES ====================

// Register push token (user)
router.post('/push-token', authenticateUser, async (req, res) => {
  try {
    const db = getDatabase();
    const user = (req as any).user;
    const { token, device_type, device_name } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Push token is required' });
    }

    // Check if token already exists for this user
    const existing = await db.get(
      'SELECT id FROM push_tokens WHERE user_id = ? AND token = ?',
      [user.id, token]
    );

    if (existing) {
      // Update last used time
      await db.run(
        'UPDATE push_tokens SET is_active = 1, last_used_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [existing.id]
      );
      return res.json({ success: true, message: 'Push token updated' });
    }

    // Insert new token
    await db.run(
      `INSERT INTO push_tokens (user_id, token, device_type, device_name, last_used_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [user.id, token, device_type || 'mobile', device_name || null]
    );

    res.json({ success: true, message: 'Push token registered successfully' });
  } catch (error) {
    console.error('Register push token error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Unregister push token (user) 
router.delete('/push-token', authenticateUser, async (req, res) => {
  try {
    const db = getDatabase();
    const user = (req as any).user;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Push token is required' });
    }

    await db.run(
      'UPDATE push_tokens SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND token = ?',
      [user.id, token]
    );

    res.json({ success: true, message: 'Push token unregistered' });
  } catch (error) {
    console.error('Unregister push token error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get user's push tokens (user)
router.get('/push-tokens', authenticateUser, async (req, res) => {
  try {
    const db = getDatabase();
    const user = (req as any).user;

    const tokens = await db.all(
      'SELECT id, device_type, device_name, is_active, last_used_at, created_at FROM push_tokens WHERE user_id = ?',
      [user.id]
    );

    res.json({ success: true, tokens });
  } catch (error) {
    console.error('Get push tokens error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Admin: Get all push tokens
router.get('/admin/push-tokens', authenticateAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const tokens = await db.all(
      `SELECT pt.*, u.name as user_name, u.email as user_email
       FROM push_tokens pt
       LEFT JOIN users u ON pt.user_id = u.id
       ORDER BY pt.created_at DESC
       LIMIT ? OFFSET ?`,
      [Number(limit), offset]
    );

    const countResult = await db.get('SELECT COUNT(*) as total FROM push_tokens');

    res.json({
      success: true,
      tokens,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: countResult?.total || 0,
        totalPages: Math.ceil((countResult?.total || 0) / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get admin push tokens error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Admin: Send test push notification
router.post('/admin/test-push', authenticateAdmin, async (req, res) => {
  try {
    const { user_id, title, message } = req.body;

    if (!user_id || !message) {
      return res.status(400).json({ success: false, message: 'User ID and message are required' });
    }

    const tokens = await getUserPushTokens(user_id);

    if (tokens.length === 0) {
      return res.status(404).json({ success: false, message: 'No push tokens found for this user' });
    }

    let successCount = 0;
    for (const token of tokens) {
      const success = await sendPushNotification(token, title || 'Test Notification', message, { test: true });
      if (success) successCount++;
    }

    res.json({ 
      success: successCount > 0, 
      message: `Push sent to ${successCount}/${tokens.length} devices` 
    });
  } catch (error) {
    console.error('Test push error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Admin: Send test email
router.post('/admin/test-email', authenticateAdmin, async (req, res) => {
  try {
    const { email, subject, message } = req.body;

    if (!email || !message) {
      return res.status(400).json({ success: false, message: 'Email and message are required' });
    }

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${subject || 'Test Email'}</h2>
        <p>${message}</p>
        <hr style="margin: 20px 0;">
        <p style="color: #888; font-size: 12px;">This is a test email from Ecommerce Admin Panel</p>
      </div>
    `;

    const success = await sendEmail(email, subject || 'Test Email', emailHtml);

    res.json({ 
      success, 
      message: success ? 'Email sent successfully!' : 'Failed to send email' 
    });
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
