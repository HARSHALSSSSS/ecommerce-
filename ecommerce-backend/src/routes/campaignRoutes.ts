import { Router, Request, Response } from 'express';
import { authenticateAdmin, authenticateUser } from '../middleware/auth';
import { getDatabase } from '../config/database';

const router = Router();

// ==================== MARKETING CAMPAIGNS ====================

// Get all campaigns
router.get('/', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { status, campaign_type, segment_type } = req.query;

    let query = `
      SELECT 
        mc.*,
        nt.name as template_name,
        a.name as created_by_name,
        (SELECT COUNT(*) FROM campaign_logs WHERE campaign_id = mc.id) as total_logs,
        (SELECT COUNT(*) FROM campaign_logs WHERE campaign_id = mc.id AND status = 'sent') as logs_sent
      FROM marketing_campaigns mc
      LEFT JOIN notification_templates nt ON mc.template_id = nt.id
      LEFT JOIN admins a ON mc.created_by = a.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status && status !== 'all') {
      query += ' AND mc.status = ?';
      params.push(status);
    }

    if (campaign_type) {
      query += ' AND mc.campaign_type = ?';
      params.push(campaign_type);
    }

    if (segment_type) {
      query += ' AND mc.segment_type = ?';
      params.push(segment_type);
    }

    query += ' ORDER BY mc.created_at DESC';

    const campaigns = await db.all(query, params);

    // Parse JSON fields
    campaigns.forEach((c: any) => {
      if (c.segment_criteria) c.segment_criteria = JSON.parse(c.segment_criteria);
    });

    // Get stats
    const stats = await db.get(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_count,
        COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled_count,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
        COUNT(CASE WHEN status = 'paused' THEN 1 END) as paused_count,
        SUM(sent_count) as total_sent,
        SUM(delivered_count) as total_delivered,
        SUM(opened_count) as total_opened,
        SUM(clicked_count) as total_clicked
      FROM marketing_campaigns
    `);

    res.json({
      success: true,
      campaigns,
      stats
    });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch campaigns' });
  }
});

// Get single campaign with logs
router.get('/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const campaign = await db.get(`
      SELECT 
        mc.*,
        nt.name as template_name,
        nt.subject_template,
        nt.body_template,
        a.name as created_by_name
      FROM marketing_campaigns mc
      LEFT JOIN notification_templates nt ON mc.template_id = nt.id
      LEFT JOIN admins a ON mc.created_by = a.id
      WHERE mc.id = ?
    `, [id]);

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    if (campaign.segment_criteria) {
      campaign.segment_criteria = JSON.parse(campaign.segment_criteria);
    }

    // Get campaign logs
    const logs = await db.all(`
      SELECT cl.*, u.name as user_name, u.email as user_email
      FROM campaign_logs cl
      LEFT JOIN users u ON cl.user_id = u.id
      WHERE cl.campaign_id = ?
      ORDER BY cl.created_at DESC
      LIMIT 100
    `, [id]);

    // Get performance metrics
    const metrics = await db.get(`
      SELECT 
        COUNT(*) as total_recipients,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered,
        COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) as opened,
        COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) as clicked,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
      FROM campaign_logs
      WHERE campaign_id = ?
    `, [id]);

    res.json({
      success: true,
      campaign: {
        ...campaign,
        logs,
        metrics
      }
    });
  } catch (error) {
    console.error('Error fetching campaign:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch campaign' });
  }
});

// Create campaign
router.post('/', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const admin = (req as any).admin;
    const {
      name,
      description,
      campaign_type,
      template_id,
      segment_type,
      segment_criteria,
      channel,
      scheduled_at,
      frequency_cap_hours,
      requires_opt_in
    } = req.body;

    // Calculate potential recipients
    let recipientCount = 0;
    if (segment_type === 'all_users') {
      const count = await db.get(`
        SELECT COUNT(*) as count FROM users 
        WHERE is_active = 1
        ${requires_opt_in ? 'AND id IN (SELECT user_id FROM user_marketing_preferences WHERE email_marketing = 1 OR push_marketing = 1)' : ''}
      `);
      recipientCount = count?.count || 0;
    }

    const result = await db.run(
      `INSERT INTO marketing_campaigns (
        name, description, campaign_type, template_id, segment_type, segment_criteria,
        channel, status, scheduled_at, total_recipients, frequency_cap_hours, requires_opt_in, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        description,
        campaign_type,
        template_id || null,
        segment_type,
        segment_criteria ? JSON.stringify(segment_criteria) : null,
        channel,
        scheduled_at ? 'scheduled' : 'draft',
        scheduled_at || null,
        recipientCount,
        frequency_cap_hours || 24,
        requires_opt_in !== false ? 1 : 0,
        admin?.id || null
      ]
    );

    const campaign = await db.get('SELECT * FROM marketing_campaigns WHERE id = ?', [result.lastID]);

    res.status(201).json({ success: true, campaign });
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ success: false, message: 'Failed to create campaign' });
  }
});

// Update campaign
router.put('/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const {
      name,
      description,
      campaign_type,
      template_id,
      segment_type,
      segment_criteria,
      channel,
      scheduled_at,
      frequency_cap_hours,
      requires_opt_in
    } = req.body;

    const existing = await db.get('SELECT * FROM marketing_campaigns WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    if (existing.status === 'active' || existing.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Cannot edit active or completed campaigns' });
    }

    await db.run(
      `UPDATE marketing_campaigns SET 
        name = ?, description = ?, campaign_type = ?, template_id = ?,
        segment_type = ?, segment_criteria = ?, channel = ?, scheduled_at = ?,
        frequency_cap_hours = ?, requires_opt_in = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        name,
        description,
        campaign_type,
        template_id || null,
        segment_type,
        segment_criteria ? JSON.stringify(segment_criteria) : null,
        channel,
        scheduled_at || null,
        frequency_cap_hours || 24,
        requires_opt_in ? 1 : 0,
        id
      ]
    );

    const campaign = await db.get('SELECT * FROM marketing_campaigns WHERE id = ?', [id]);

    res.json({ success: true, campaign });
  } catch (error) {
    console.error('Error updating campaign:', error);
    res.status(500).json({ success: false, message: 'Failed to update campaign' });
  }
});

// Delete campaign
router.delete('/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const existing = await db.get('SELECT * FROM marketing_campaigns WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    if (existing.status === 'active') {
      return res.status(400).json({ success: false, message: 'Cannot delete active campaign. Pause it first.' });
    }

    await db.run('DELETE FROM marketing_campaigns WHERE id = ?', [id]);

    res.json({ success: true, message: 'Campaign deleted successfully' });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({ success: false, message: 'Failed to delete campaign' });
  }
});

// Start/Launch campaign
router.post('/:id/start', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const campaign = await db.get(`
      SELECT mc.*, nt.subject_template, nt.body_template
      FROM marketing_campaigns mc
      LEFT JOIN notification_templates nt ON mc.template_id = nt.id
      WHERE mc.id = ?
    `, [id]);

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
      return res.status(400).json({ success: false, message: 'Campaign cannot be started in current state' });
    }

    // Get target users based on segment
    let usersQuery = `
      SELECT DISTINCT u.id, u.email, u.name, u.phone
      FROM users u
      WHERE u.is_active = 1
    `;

    if (campaign.requires_opt_in) {
      if (campaign.channel === 'email') {
        usersQuery += ` AND u.id IN (SELECT user_id FROM user_marketing_preferences WHERE email_marketing = 1)`;
      } else if (campaign.channel === 'push') {
        usersQuery += ` AND u.id IN (SELECT user_id FROM user_marketing_preferences WHERE push_marketing = 1)`;
      } else if (campaign.channel === 'sms') {
        usersQuery += ` AND u.id IN (SELECT user_id FROM user_marketing_preferences WHERE sms_marketing = 1)`;
      }
    }

    // Apply frequency cap
    const params: any[] = [];
    if (campaign.frequency_cap_hours) {
      usersQuery += ` AND u.id NOT IN (
        SELECT user_id FROM campaign_logs 
        WHERE campaign_id = ? 
        AND sent_at > datetime('now', '-' || ? || ' hours')
      )`;
      params.push(id, campaign.frequency_cap_hours);
    }

    const users = await db.all(usersQuery, params);

    // Update campaign status
    await db.run(
      `UPDATE marketing_campaigns SET 
        status = 'active', 
        started_at = CURRENT_TIMESTAMP,
        total_recipients = ?
       WHERE id = ?`,
      [users.length, id]
    );

    // Create campaign logs and send notifications
    let sentCount = 0;
    for (const user of users) {
      try {
        // Replace variables in template
        let subject = campaign.subject_template || '';
        let body = campaign.body_template || '';

        const replaceVars = (text: string) => {
          return text
            .replace(/\{\{customer_name\}\}/g, user.name || 'Customer')
            .replace(/\{\{email\}\}/g, user.email);
        };

        subject = replaceVars(subject);
        body = replaceVars(body);

        // Create notification log
        const notifResult = await db.run(
          `INSERT INTO notification_logs (user_id, notification_type, channel, recipient, subject, message, status, sent_at)
           VALUES (?, 'marketing', ?, ?, ?, ?, 'sent', CURRENT_TIMESTAMP)`,
          [user.id, campaign.channel, user.email, subject, body]
        );

        // Create campaign log
        await db.run(
          `INSERT INTO campaign_logs (campaign_id, user_id, notification_id, status, sent_at)
           VALUES (?, ?, ?, 'sent', CURRENT_TIMESTAMP)`,
          [id, user.id, notifResult.lastID]
        );

        sentCount++;
      } catch (e) {
        // Log failed send
        await db.run(
          `INSERT INTO campaign_logs (campaign_id, user_id, status, error_message)
           VALUES (?, ?, 'failed', ?)`,
          [id, user.id, (e as Error).message]
        );
      }
    }

    // Update sent count
    await db.run(
      `UPDATE marketing_campaigns SET 
        sent_count = ?,
        status = 'completed',
        completed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [sentCount, id]
    );

    res.json({
      success: true,
      message: 'Campaign launched successfully',
      total_recipients: users.length,
      sent_count: sentCount
    });
  } catch (error) {
    console.error('Error starting campaign:', error);
    res.status(500).json({ success: false, message: 'Failed to start campaign' });
  }
});

// Pause campaign
router.post('/:id/pause', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const existing = await db.get('SELECT * FROM marketing_campaigns WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    if (existing.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Only active campaigns can be paused' });
    }

    await db.run(
      `UPDATE marketing_campaigns SET status = 'paused', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [id]
    );

    res.json({ success: true, message: 'Campaign paused' });
  } catch (error) {
    console.error('Error pausing campaign:', error);
    res.status(500).json({ success: false, message: 'Failed to pause campaign' });
  }
});

// ==================== CAMPAIGN SEGMENTS ====================

// Get all segments
router.get('/segments/list', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();

    const segments = await db.all(`
      SELECT cs.*, a.name as created_by_name
      FROM campaign_segments cs
      LEFT JOIN admins a ON cs.created_by = a.id
      ORDER BY cs.created_at DESC
    `);

    segments.forEach((s: any) => {
      if (s.criteria) s.criteria = JSON.parse(s.criteria);
    });

    res.json({ success: true, segments });
  } catch (error) {
    console.error('Error fetching segments:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch segments' });
  }
});

// Create segment
router.post('/segments', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const admin = (req as any).admin;
    const { name, description, segment_type, criteria, is_dynamic } = req.body;

    // Calculate user count
    let userCount = 0;
    const countResult = await db.get('SELECT COUNT(*) as count FROM users WHERE is_active = 1');
    userCount = countResult?.count || 0;

    const result = await db.run(
      `INSERT INTO campaign_segments (name, description, segment_type, criteria, user_count, is_dynamic, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, description, segment_type, JSON.stringify(criteria || {}), userCount, is_dynamic ? 1 : 0, admin?.id || null]
    );

    const segment = await db.get('SELECT * FROM campaign_segments WHERE id = ?', [result.lastID]);

    res.status(201).json({ success: true, segment });
  } catch (error) {
    console.error('Error creating segment:', error);
    res.status(500).json({ success: false, message: 'Failed to create segment' });
  }
});

// ==================== CATEGORY MARKETING RULES ====================

// Get all category rules
router.get('/category-rules/list', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { category_id, is_active } = req.query;

    let query = `
      SELECT 
        cmr.*,
        c.name as category_name,
        nt.name as template_name,
        a.name as created_by_name
      FROM category_marketing_rules cmr
      LEFT JOIN categories c ON cmr.category_id = c.id
      LEFT JOIN notification_templates nt ON cmr.template_id = nt.id
      LEFT JOIN admins a ON cmr.created_by = a.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (category_id) {
      query += ' AND cmr.category_id = ?';
      params.push(category_id);
    }

    if (is_active !== undefined) {
      query += ' AND cmr.is_active = ?';
      params.push(is_active === 'true' ? 1 : 0);
    }

    query += ' ORDER BY cmr.created_at DESC';

    const rules = await db.all(query, params);

    rules.forEach((r: any) => {
      if (r.trigger_conditions) r.trigger_conditions = JSON.parse(r.trigger_conditions);
    });

    res.json({ success: true, rules });
  } catch (error) {
    console.error('Error fetching category rules:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch category rules' });
  }
});

// Create category marketing rule
router.post('/category-rules', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const admin = (req as any).admin;
    const {
      name,
      category_id,
      template_id,
      trigger_type,
      trigger_conditions,
      channel,
      frequency_cap_hours,
      is_active,
      requires_opt_in
    } = req.body;

    const result = await db.run(
      `INSERT INTO category_marketing_rules (
        name, category_id, template_id, trigger_type, trigger_conditions,
        channel, frequency_cap_hours, is_active, requires_opt_in, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        category_id,
        template_id,
        trigger_type,
        trigger_conditions ? JSON.stringify(trigger_conditions) : null,
        channel,
        frequency_cap_hours || 24,
        is_active !== false ? 1 : 0,
        requires_opt_in !== false ? 1 : 0,
        admin?.id || null
      ]
    );

    const rule = await db.get('SELECT * FROM category_marketing_rules WHERE id = ?', [result.lastID]);

    res.status(201).json({ success: true, rule });
  } catch (error) {
    console.error('Error creating category rule:', error);
    res.status(500).json({ success: false, message: 'Failed to create category rule' });
  }
});

// Update category marketing rule
router.put('/category-rules/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const {
      name,
      category_id,
      template_id,
      trigger_type,
      trigger_conditions,
      channel,
      frequency_cap_hours,
      is_active,
      requires_opt_in
    } = req.body;

    const existing = await db.get('SELECT * FROM category_marketing_rules WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Category rule not found' });
    }

    await db.run(
      `UPDATE category_marketing_rules SET 
        name = ?, category_id = ?, template_id = ?, trigger_type = ?,
        trigger_conditions = ?, channel = ?, frequency_cap_hours = ?,
        is_active = ?, requires_opt_in = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        name,
        category_id,
        template_id,
        trigger_type,
        trigger_conditions ? JSON.stringify(trigger_conditions) : null,
        channel,
        frequency_cap_hours || 24,
        is_active ? 1 : 0,
        requires_opt_in ? 1 : 0,
        id
      ]
    );

    const rule = await db.get('SELECT * FROM category_marketing_rules WHERE id = ?', [id]);

    res.json({ success: true, rule });
  } catch (error) {
    console.error('Error updating category rule:', error);
    res.status(500).json({ success: false, message: 'Failed to update category rule' });
  }
});

// Delete category marketing rule
router.delete('/category-rules/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const existing = await db.get('SELECT * FROM category_marketing_rules WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Category rule not found' });
    }

    await db.run('DELETE FROM category_marketing_rules WHERE id = ?', [id]);

    res.json({ success: true, message: 'Category rule deleted successfully' });
  } catch (error) {
    console.error('Error deleting category rule:', error);
    res.status(500).json({ success: false, message: 'Failed to delete category rule' });
  }
});

// Toggle category rule active status
router.patch('/category-rules/:id/toggle', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const existing = await db.get('SELECT * FROM category_marketing_rules WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Category rule not found' });
    }

    const newStatus = existing.is_active ? 0 : 1;
    await db.run(
      'UPDATE category_marketing_rules SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newStatus, id]
    );

    res.json({ success: true, message: `Rule ${newStatus ? 'activated' : 'deactivated'}`, is_active: newStatus === 1 });
  } catch (error) {
    console.error('Error toggling category rule:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle category rule' });
  }
});

// ==================== USER MARKETING PREFERENCES (User-facing) ====================

// Get user's marketing preferences
router.get('/preferences/user', authenticateUser, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const user = (req as any).user;

    let prefs = await db.get(
      'SELECT * FROM user_marketing_preferences WHERE user_id = ?',
      [user.id]
    );

    if (!prefs) {
      // Create default preferences
      await db.run(
        `INSERT INTO user_marketing_preferences (user_id, email_marketing, push_marketing, sms_marketing)
         VALUES (?, 0, 0, 0)`,
        [user.id]
      );
      prefs = await db.get('SELECT * FROM user_marketing_preferences WHERE user_id = ?', [user.id]);
    }

    if (prefs.category_preferences) {
      prefs.category_preferences = JSON.parse(prefs.category_preferences);
    }

    res.json({ success: true, preferences: prefs });
  } catch (error) {
    console.error('Error fetching marketing preferences:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch preferences' });
  }
});

// Update user's marketing preferences
router.put('/preferences/user', authenticateUser, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const user = (req as any).user;
    const { email_marketing, push_marketing, sms_marketing, category_preferences } = req.body;

    const existing = await db.get('SELECT * FROM user_marketing_preferences WHERE user_id = ?', [user.id]);

    if (existing) {
      await db.run(
        `UPDATE user_marketing_preferences SET 
          email_marketing = ?, push_marketing = ?, sms_marketing = ?,
          category_preferences = ?, opt_in_date = CASE WHEN (? = 1 OR ? = 1 OR ? = 1) AND opt_in_date IS NULL THEN CURRENT_TIMESTAMP ELSE opt_in_date END,
          opt_out_date = CASE WHEN ? = 0 AND ? = 0 AND ? = 0 THEN CURRENT_TIMESTAMP ELSE NULL END,
          updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ?`,
        [
          email_marketing ? 1 : 0,
          push_marketing ? 1 : 0,
          sms_marketing ? 1 : 0,
          category_preferences ? JSON.stringify(category_preferences) : null,
          email_marketing ? 1 : 0,
          push_marketing ? 1 : 0,
          sms_marketing ? 1 : 0,
          email_marketing ? 1 : 0,
          push_marketing ? 1 : 0,
          sms_marketing ? 1 : 0,
          user.id
        ]
      );
    } else {
      await db.run(
        `INSERT INTO user_marketing_preferences (user_id, email_marketing, push_marketing, sms_marketing, category_preferences, opt_in_date)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          user.id,
          email_marketing ? 1 : 0,
          push_marketing ? 1 : 0,
          sms_marketing ? 1 : 0,
          category_preferences ? JSON.stringify(category_preferences) : null,
          (email_marketing || push_marketing || sms_marketing) ? new Date().toISOString() : null
        ]
      );
    }

    const prefs = await db.get('SELECT * FROM user_marketing_preferences WHERE user_id = ?', [user.id]);

    res.json({ success: true, message: 'Preferences updated', preferences: prefs });
  } catch (error) {
    console.error('Error updating marketing preferences:', error);
    res.status(500).json({ success: false, message: 'Failed to update preferences' });
  }
});

export default router;
