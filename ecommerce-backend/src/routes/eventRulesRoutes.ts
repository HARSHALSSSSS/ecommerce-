import { Router, Request, Response } from 'express';
import { authenticateAdmin } from '../middleware/auth';
import { getDatabase } from '../config/database';

const router = Router();

// ==================== EVENT TRIGGER RULES ====================

// Get all event trigger rules
router.get('/', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { event_type, channel, is_active } = req.query;

    let query = `
      SELECT 
        etr.*,
        nt.name as template_name,
        nt.notification_type as template_type,
        a.name as created_by_name,
        (SELECT COUNT(*) FROM notification_logs WHERE notification_type = etr.event_type) as trigger_count
      FROM event_trigger_rules etr
      LEFT JOIN notification_templates nt ON etr.template_id = nt.id
      LEFT JOIN admins a ON etr.created_by = a.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (event_type) {
      query += ' AND etr.event_type = ?';
      params.push(event_type);
    }

    if (channel) {
      query += ' AND etr.channel = ?';
      params.push(channel);
    }

    if (is_active !== undefined) {
      query += ' AND etr.is_active = ?';
      params.push(is_active === 'true' ? 1 : 0);
    }

    query += ' ORDER BY etr.priority DESC, etr.created_at DESC';

    const rules = await db.all(query, params);

    // Parse JSON conditions
    rules.forEach((r: any) => {
      if (r.conditions) r.conditions = JSON.parse(r.conditions);
    });

    res.json({ success: true, rules });
  } catch (error) {
    console.error('Error fetching event rules:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch event rules' });
  }
});

// Get available event types
router.get('/types/available', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const eventTypes = [
      { type: 'order_created', label: 'Order Created', description: 'When a new order is placed' },
      { type: 'order_confirmed', label: 'Order Confirmed', description: 'When order is confirmed' },
      { type: 'order_processing', label: 'Order Processing', description: 'When order starts processing' },
      { type: 'order_shipped', label: 'Order Shipped', description: 'When order is shipped' },
      { type: 'order_delivered', label: 'Order Delivered', description: 'When order is delivered' },
      { type: 'order_cancelled', label: 'Order Cancelled', description: 'When order is cancelled' },
      { type: 'payment_success', label: 'Payment Success', description: 'When payment is successful' },
      { type: 'payment_failed', label: 'Payment Failed', description: 'When payment fails' },
      { type: 'payment_refunded', label: 'Payment Refunded', description: 'When payment is refunded' },
      { type: 'return_initiated', label: 'Return Initiated', description: 'When return request is created' },
      { type: 'return_approved', label: 'Return Approved', description: 'When return is approved' },
      { type: 'return_rejected', label: 'Return Rejected', description: 'When return is rejected' },
      { type: 'refund_processed', label: 'Refund Processed', description: 'When refund is processed' },
      { type: 'shipment_created', label: 'Shipment Created', description: 'When shipment is created' },
      { type: 'shipment_in_transit', label: 'Shipment In Transit', description: 'When shipment is in transit' },
      { type: 'shipment_delivered', label: 'Shipment Delivered', description: 'When shipment is delivered' },
      { type: 'user_registered', label: 'User Registered', description: 'When new user signs up' },
      { type: 'password_reset', label: 'Password Reset', description: 'When user requests password reset' },
      { type: 'cart_abandoned', label: 'Cart Abandoned', description: 'When user abandons cart' },
      { type: 'wishlist_price_drop', label: 'Wishlist Price Drop', description: 'When wishlist item price drops' },
      { type: 'back_in_stock', label: 'Back In Stock', description: 'When item is back in stock' },
      { type: 'review_requested', label: 'Review Requested', description: 'Request review after delivery' }
    ];

    res.json({ success: true, eventTypes });
  } catch (error) {
    console.error('Error fetching event types:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch event types' });
  }
});

// Get single rule
router.get('/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const rule = await db.get(`
      SELECT 
        etr.*,
        nt.name as template_name,
        nt.notification_type as template_type,
        nt.subject_template,
        nt.body_template,
        a.name as created_by_name
      FROM event_trigger_rules etr
      LEFT JOIN notification_templates nt ON etr.template_id = nt.id
      LEFT JOIN admins a ON etr.created_by = a.id
      WHERE etr.id = ?
    `, [id]);

    if (!rule) {
      return res.status(404).json({ success: false, message: 'Rule not found' });
    }

    if (rule.conditions) {
      rule.conditions = JSON.parse(rule.conditions);
    }

    // Get recent notifications triggered by this rule
    const recentNotifications = await db.all(`
      SELECT id, user_id, status, sent_at, created_at
      FROM notification_logs
      WHERE notification_type = ?
      ORDER BY created_at DESC
      LIMIT 10
    `, [rule.event_type]);

    res.json({
      success: true,
      rule: {
        ...rule,
        recent_notifications: recentNotifications
      }
    });
  } catch (error) {
    console.error('Error fetching rule:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch rule' });
  }
});

// Create new rule
router.post('/', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const admin = (req as any).admin;
    const { name, event_type, template_id, conditions, channel, priority, delay_minutes, is_active } = req.body;

    // Validate template exists
    const template = await db.get('SELECT id FROM notification_templates WHERE id = ?', [template_id]);
    if (!template) {
      return res.status(400).json({ success: false, message: 'Template not found' });
    }

    const result = await db.run(
      `INSERT INTO event_trigger_rules (name, event_type, template_id, conditions, channel, priority, delay_minutes, is_active, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        event_type,
        template_id,
        conditions ? JSON.stringify(conditions) : null,
        channel,
        priority || 0,
        delay_minutes || 0,
        is_active !== false ? 1 : 0,
        admin?.id || null
      ]
    );

    const rule = await db.get('SELECT * FROM event_trigger_rules WHERE id = ?', [result.lastID]);
    if (rule.conditions) {
      rule.conditions = JSON.parse(rule.conditions);
    }

    res.status(201).json({ success: true, rule });
  } catch (error) {
    console.error('Error creating rule:', error);
    res.status(500).json({ success: false, message: 'Failed to create rule' });
  }
});

// Update rule
router.put('/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { name, event_type, template_id, conditions, channel, priority, delay_minutes, is_active } = req.body;

    const existing = await db.get('SELECT * FROM event_trigger_rules WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Rule not found' });
    }

    // Validate template if changed
    if (template_id) {
      const template = await db.get('SELECT id FROM notification_templates WHERE id = ?', [template_id]);
      if (!template) {
        return res.status(400).json({ success: false, message: 'Template not found' });
      }
    }

    await db.run(
      `UPDATE event_trigger_rules SET 
        name = ?, event_type = ?, template_id = ?, conditions = ?, channel = ?, 
        priority = ?, delay_minutes = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        name,
        event_type,
        template_id,
        conditions ? JSON.stringify(conditions) : null,
        channel,
        priority || 0,
        delay_minutes || 0,
        is_active ? 1 : 0,
        id
      ]
    );

    const rule = await db.get('SELECT * FROM event_trigger_rules WHERE id = ?', [id]);
    if (rule.conditions) {
      rule.conditions = JSON.parse(rule.conditions);
    }

    res.json({ success: true, rule });
  } catch (error) {
    console.error('Error updating rule:', error);
    res.status(500).json({ success: false, message: 'Failed to update rule' });
  }
});

// Delete rule
router.delete('/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const existing = await db.get('SELECT * FROM event_trigger_rules WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Rule not found' });
    }

    await db.run('DELETE FROM event_trigger_rules WHERE id = ?', [id]);

    res.json({ success: true, message: 'Rule deleted successfully' });
  } catch (error) {
    console.error('Error deleting rule:', error);
    res.status(500).json({ success: false, message: 'Failed to delete rule' });
  }
});

// Toggle rule active status
router.patch('/:id/toggle', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const existing = await db.get('SELECT * FROM event_trigger_rules WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Rule not found' });
    }

    const newStatus = existing.is_active ? 0 : 1;
    await db.run(
      'UPDATE event_trigger_rules SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newStatus, id]
    );

    res.json({ success: true, message: `Rule ${newStatus ? 'activated' : 'deactivated'}`, is_active: newStatus === 1 });
  } catch (error) {
    console.error('Error toggling rule:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle rule' });
  }
});

// ==================== RULE TESTING ====================

// Test rule conditions against sample data
router.post('/:id/test', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { sample_data } = req.body;

    const rule = await db.get(`
      SELECT etr.*, nt.subject_template, nt.body_template, nt.variables
      FROM event_trigger_rules etr
      LEFT JOIN notification_templates nt ON etr.template_id = nt.id
      WHERE etr.id = ?
    `, [id]);

    if (!rule) {
      return res.status(404).json({ success: false, message: 'Rule not found' });
    }

    const conditions = rule.conditions ? JSON.parse(rule.conditions) : null;
    let conditionsMet = true;
    const conditionResults: any[] = [];

    // Evaluate conditions
    if (conditions && conditions.length > 0) {
      for (const condition of conditions) {
        const { field, operator, value } = condition;
        const dataValue = sample_data?.[field];
        let result = false;

        switch (operator) {
          case 'equals':
            result = dataValue === value;
            break;
          case 'not_equals':
            result = dataValue !== value;
            break;
          case 'greater_than':
            result = parseFloat(dataValue) > parseFloat(value);
            break;
          case 'less_than':
            result = parseFloat(dataValue) < parseFloat(value);
            break;
          case 'contains':
            result = String(dataValue).includes(value);
            break;
          case 'in':
            result = Array.isArray(value) ? value.includes(dataValue) : false;
            break;
          default:
            result = true;
        }

        conditionResults.push({
          field,
          operator,
          expected: value,
          actual: dataValue,
          passed: result
        });

        if (!result) conditionsMet = false;
      }
    }

    // Generate preview
    let previewSubject = rule.subject_template || '';
    let previewBody = rule.body_template || '';

    const replaceVariables = (text: string, data: any): string => {
      return text.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
        return data[variable] !== undefined ? data[variable] : match;
      });
    };

    previewSubject = replaceVariables(previewSubject, sample_data || {});
    previewBody = replaceVariables(previewBody, sample_data || {});

    res.json({
      success: true,
      result: {
        rule_id: rule.id,
        rule_name: rule.name,
        conditions_met: conditionsMet,
        condition_results: conditionResults,
        would_trigger: conditionsMet && rule.is_active,
        delay_minutes: rule.delay_minutes,
        preview: {
          channel: rule.channel,
          subject: previewSubject,
          body: previewBody
        }
      }
    });
  } catch (error) {
    console.error('Error testing rule:', error);
    res.status(500).json({ success: false, message: 'Failed to test rule' });
  }
});

// ==================== RULE EXECUTION ====================

// Manually trigger rule for testing
router.post('/:id/trigger', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { user_id, data, related_type, related_id } = req.body;

    const rule = await db.get(`
      SELECT etr.*, nt.subject_template, nt.body_template
      FROM event_trigger_rules etr
      LEFT JOIN notification_templates nt ON etr.template_id = nt.id
      WHERE etr.id = ?
    `, [id]);

    if (!rule) {
      return res.status(404).json({ success: false, message: 'Rule not found' });
    }

    // Get user details
    const user = await db.get('SELECT id, email, name FROM users WHERE id = ?', [user_id]);
    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    // Replace variables
    let subject = rule.subject_template || '';
    let message = rule.body_template || '';

    const replaceVariables = (text: string, data: any): string => {
      return text.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
        return data[variable] !== undefined ? data[variable] : match;
      });
    };

    const fullData = { ...data, customer_name: user.name, email: user.email };
    subject = replaceVariables(subject, fullData);
    message = replaceVariables(message, fullData);

    // Create notification log
    const result = await db.run(
      `INSERT INTO notification_logs (user_id, notification_type, channel, recipient, subject, message, status, related_type, related_id, sent_at)
       VALUES (?, ?, ?, ?, ?, ?, 'sent', ?, ?, CURRENT_TIMESTAMP)`,
      [user_id, rule.event_type, rule.channel, user.email, subject, message, related_type, related_id]
    );

    res.json({
      success: true,
      message: 'Rule triggered successfully',
      notification_id: result.lastID,
      preview: { subject, message, channel: rule.channel }
    });
  } catch (error) {
    console.error('Error triggering rule:', error);
    res.status(500).json({ success: false, message: 'Failed to trigger rule' });
  }
});

export default router;
