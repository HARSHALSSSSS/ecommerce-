import { Router, Request, Response } from 'express';
import { getDatabase } from '../config/database';
import { authenticateAdmin } from '../middleware/auth';

const router = Router();

// Helper to mask PII data
function maskPII(data: any, fields: string[]): any {
  const masked = { ...data };
  fields.forEach(field => {
    if (masked[field]) {
      const value = String(masked[field]);
      if (field === 'email') {
        const [local, domain] = value.split('@');
        masked[field] = `${local.substring(0, 2)}***@${domain}`;
      } else if (field === 'phone') {
        masked[field] = value.substring(0, 3) + '****' + value.slice(-2);
      } else if (field === 'address') {
        masked[field] = value.substring(0, 10) + '***';
      }
    }
  });
  return masked;
}

// Helper to log admin action
async function logAdminAction(adminId: number, action: string, resourceType: string, resourceId: number, changes: any, req: Request) {
  const db = getDatabase();
  await db.run(
    `INSERT INTO admin_logs (admin_id, action, resource_type, resource_id, changes, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [adminId, action, resourceType, resourceId, JSON.stringify(changes), req.ip, req.headers['user-agent']]
  );
}

// ==================== USER LIST ====================

// GET /api/admin/users - Get all users with pagination and search
router.get('/users', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search as string || '';
    const status = req.query.status as string; // 'active', 'blocked', 'all'

    let whereClause = '1=1';
    const params: any[] = [];

    if (search) {
      whereClause += ` AND (u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status === 'active') {
      whereClause += ` AND u.is_active = 1 AND NOT EXISTS (SELECT 1 FROM user_blocks ub WHERE ub.user_id = u.id AND ub.is_active = 1)`;
    } else if (status === 'blocked') {
      whereClause += ` AND EXISTS (SELECT 1 FROM user_blocks ub WHERE ub.user_id = u.id AND ub.is_active = 1)`;
    }

    // Get total count
    const countResult = await db.get(
      `SELECT COUNT(*) as total FROM users u WHERE ${whereClause}`,
      params
    );

    // Get users with block status and order count
    const users = await db.all(
      `SELECT 
        u.id, u.name, u.email, u.phone, u.city, u.is_active, u.created_at,
        (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) as order_count,
        (SELECT SUM(total_amount) FROM orders o WHERE o.user_id = u.id) as total_spent,
        (SELECT COUNT(*) FROM user_blocks ub WHERE ub.user_id = u.id AND ub.is_active = 1) > 0 as is_blocked,
        (SELECT reason FROM user_blocks ub WHERE ub.user_id = u.id AND ub.is_active = 1 LIMIT 1) as block_reason,
        (SELECT created_at FROM user_activity_logs ual WHERE ual.user_id = u.id ORDER BY created_at DESC LIMIT 1) as last_activity
      FROM users u
      WHERE ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      users: users.map(u => maskPII(u, ['email', 'phone'])),
      pagination: {
        page,
        limit,
        total: countResult?.total || 0,
        totalPages: Math.ceil((countResult?.total || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
});

// ==================== USER DETAIL ====================

// GET /api/admin/users/:id - Get user detail with full info
router.get('/users/:id', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const userId = parseInt(req.params.id);
    const showFullPII = req.query.showPII === 'true'; // Only for authorized admins

    const user = await db.get(
      `SELECT 
        u.*,
        (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) as order_count,
        (SELECT SUM(total_amount) FROM orders o WHERE o.user_id = u.id) as total_spent,
        (SELECT COUNT(*) FROM user_blocks ub WHERE ub.user_id = u.id AND ub.is_active = 1) > 0 as is_blocked
      FROM users u
      WHERE u.id = ?`,
      [userId]
    );

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    // Get recent orders
    const orders = await db.all(
      `SELECT id, order_number, total_amount, status, created_at
       FROM orders
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 10`,
      [userId]
    );

    // Get support tickets
    const tickets = await db.all(
      `SELECT id, ticket_number, subject, category, priority, status, created_at
       FROM tickets
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 10`,
      [userId]
    );

    // Get block history
    const blockHistory = await db.all(
      `SELECT ub.*, a1.name as blocked_by_name, a2.name as unblocked_by_name
       FROM user_blocks ub
       LEFT JOIN admins a1 ON ub.blocked_by = a1.id
       LEFT JOIN admins a2 ON ub.unblocked_by = a2.id
       WHERE ub.user_id = ?
       ORDER BY ub.blocked_at DESC`,
      [userId]
    );

    // Get notification preferences
    const preferences = await db.get(
      `SELECT * FROM user_notification_preferences WHERE user_id = ?`,
      [userId]
    );

    // Mask PII unless explicitly requested
    const userData = showFullPII ? user : maskPII(user, ['email', 'phone', 'address']);
    delete userData.password; // Never expose password

    res.json({
      success: true,
      user: userData,
      orders,
      tickets,
      blockHistory,
      preferences: preferences || {
        email_marketing: 1,
        email_orders: 1,
        email_promotions: 1,
        push_enabled: 1,
        push_orders: 1,
        push_promotions: 1,
        sms_enabled: 0,
        sms_orders: 0
      }
    });
  } catch (error) {
    console.error('Error fetching user detail:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch user details' });
  }
});

// ==================== BLOCK / UNBLOCK USER ====================

// POST /api/admin/users/:id/block - Block a user
router.post('/users/:id/block', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const userId = parseInt(req.params.id);
    const { reason } = req.body;
    const adminId = (req as any).admin.id;

    if (!reason || reason.trim().length < 10) {
      res.status(400).json({ success: false, message: 'Reason is required (minimum 10 characters)' });
      return;
    }

    // Check if user exists
    const user = await db.get('SELECT id, name, email FROM users WHERE id = ?', [userId]);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    // Check if already blocked
    const existingBlock = await db.get(
      'SELECT id FROM user_blocks WHERE user_id = ? AND is_active = 1',
      [userId]
    );

    if (existingBlock) {
      res.status(400).json({ success: false, message: 'User is already blocked' });
      return;
    }

    // Create block record
    await db.run(
      `INSERT INTO user_blocks (user_id, blocked_by, reason) VALUES (?, ?, ?)`,
      [userId, adminId, reason]
    );

    // Deactivate user
    await db.run('UPDATE users SET is_active = 0 WHERE id = ?', [userId]);

    // Log activity
    await db.run(
      `INSERT INTO user_activity_logs (user_id, action, action_type, ip_address, metadata)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, 'account_blocked', 'admin_action', req.ip, JSON.stringify({ reason, blocked_by: adminId })]
    );

    // Log admin action
    await logAdminAction(adminId, 'block_user', 'user', userId, { reason }, req);

    res.json({ success: true, message: 'User blocked successfully' });
  } catch (error) {
    console.error('Error blocking user:', error);
    res.status(500).json({ success: false, message: 'Failed to block user' });
  }
});

// POST /api/admin/users/:id/unblock - Unblock a user
router.post('/users/:id/unblock', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const userId = parseInt(req.params.id);
    const { reason } = req.body;
    const adminId = (req as any).admin.id;

    if (!reason || reason.trim().length < 10) {
      res.status(400).json({ success: false, message: 'Reason is required (minimum 10 characters)' });
      return;
    }

    // Check if user exists
    const user = await db.get('SELECT id FROM users WHERE id = ?', [userId]);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    // Find active block
    const activeBlock = await db.get(
      'SELECT id FROM user_blocks WHERE user_id = ? AND is_active = 1',
      [userId]
    );

    if (!activeBlock) {
      res.status(400).json({ success: false, message: 'User is not blocked' });
      return;
    }

    // Update block record
    await db.run(
      `UPDATE user_blocks 
       SET is_active = 0, unblocked_at = CURRENT_TIMESTAMP, unblocked_by = ?, unblock_reason = ?
       WHERE id = ?`,
      [adminId, reason, activeBlock.id]
    );

    // Reactivate user
    await db.run('UPDATE users SET is_active = 1 WHERE id = ?', [userId]);

    // Log activity
    await db.run(
      `INSERT INTO user_activity_logs (user_id, action, action_type, ip_address, metadata)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, 'account_unblocked', 'admin_action', req.ip, JSON.stringify({ reason, unblocked_by: adminId })]
    );

    // Log admin action
    await logAdminAction(adminId, 'unblock_user', 'user', userId, { reason }, req);

    res.json({ success: true, message: 'User unblocked successfully' });
  } catch (error) {
    console.error('Error unblocking user:', error);
    res.status(500).json({ success: false, message: 'Failed to unblock user' });
  }
});

// ==================== USER ACTIVITY LOGS ====================

// GET /api/admin/users/:id/activity - Get user activity logs
router.get('/users/:id/activity', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const userId = parseInt(req.params.id);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const actionType = req.query.actionType as string;

    let whereClause = 'user_id = ?';
    const params: any[] = [userId];

    if (actionType) {
      whereClause += ' AND action_type = ?';
      params.push(actionType);
    }

    const countResult = await db.get(
      `SELECT COUNT(*) as total FROM user_activity_logs WHERE ${whereClause}`,
      params
    );

    const logs = await db.all(
      `SELECT * FROM user_activity_logs
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Mask IP addresses for GDPR compliance (show only first 2 octets)
    const maskedLogs = logs.map(log => ({
      ...log,
      ip_address: log.ip_address ? log.ip_address.split('.').slice(0, 2).join('.') + '.x.x' : null
    }));

    res.json({
      success: true,
      logs: maskedLogs,
      pagination: {
        page,
        limit,
        total: countResult?.total || 0,
        totalPages: Math.ceil((countResult?.total || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching user activity:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch activity logs' });
  }
});

// POST /api/admin/users/:id/activity - Log user activity (for mobile app)
router.post('/users/:id/activity', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const userId = parseInt(req.params.id);
    const { action, action_type, device_info, metadata } = req.body;

    await db.run(
      `INSERT INTO user_activity_logs (user_id, action, action_type, ip_address, user_agent, device_info, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, action, action_type || 'app_action', req.ip, req.headers['user-agent'], device_info, JSON.stringify(metadata || {})]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error logging activity:', error);
    res.status(500).json({ success: false, message: 'Failed to log activity' });
  }
});

// ==================== USER NOTIFICATION PREFERENCES ====================

// GET /api/admin/users/:id/preferences - Get notification preferences
router.get('/users/:id/preferences', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const userId = parseInt(req.params.id);

    const preferences = await db.get(
      `SELECT * FROM user_notification_preferences WHERE user_id = ?`,
      [userId]
    );

    // Return defaults if no preferences set
    const defaultPreferences = {
      user_id: userId,
      email_marketing: 1,
      email_orders: 1,
      email_promotions: 1,
      push_enabled: 1,
      push_orders: 1,
      push_promotions: 1,
      sms_enabled: 0,
      sms_orders: 0,
      consent_date: null,
      consent_source: null
    };

    res.json({
      success: true,
      preferences: preferences || defaultPreferences
    });
  } catch (error) {
    console.error('Error fetching preferences:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch preferences' });
  }
});

// ==================== SUPPORT TICKETS ====================

// GET /api/admin/tickets - Get all tickets
router.get('/tickets', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;
    const status = req.query.status as string;
    const priority = req.query.priority as string;

    let whereClause = '1=1';
    const params: any[] = [];

    if (status) {
      whereClause += ' AND st.status = ?';
      params.push(status);
    }
    if (priority) {
      whereClause += ' AND st.priority = ?';
      params.push(priority);
    }

    const countResult = await db.get(
      `SELECT COUNT(*) as total FROM tickets st WHERE ${whereClause}`,
      params
    );

    const tickets = await db.all(
      `SELECT st.*, u.name as user_name, u.email as user_email, a.email as assigned_to_name
       FROM tickets st
       LEFT JOIN users u ON st.user_id = u.id
       LEFT JOIN admins a ON st.assigned_to = a.id
       WHERE ${whereClause}
       ORDER BY 
         CASE st.priority 
           WHEN 'urgent' THEN 1 
           WHEN 'high' THEN 2 
           WHEN 'medium' THEN 3 
           ELSE 4 
         END,
         st.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      tickets,
      pagination: {
        page,
        limit,
        total: countResult?.total || 0,
        totalPages: Math.ceil((countResult?.total || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch tickets' });
  }
});

// GET /api/admin/tickets/:id - Get ticket detail (Legacy - use /api/tickets/admin/:id instead)
router.get('/tickets/:id', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const ticketId = parseInt(req.params.id);

    const ticket = await db.get(
      `SELECT st.*, u.name as user_name, u.email as user_email, a.email as assigned_to_name
       FROM tickets st
       LEFT JOIN users u ON st.user_id = u.id
       LEFT JOIN admins a ON st.assigned_to = a.id
       WHERE st.id = ?`,
      [ticketId]
    );

    if (!ticket) {
      res.status(404).json({ success: false, message: 'Ticket not found' });
      return;
    }

    const messages = await db.all(
      `SELECT tm.*, tm.sender_name
       FROM ticket_messages tm
       WHERE tm.ticket_id = ?
       ORDER BY tm.created_at ASC`,
      [ticketId]
    );

    res.json({ success: true, ticket, messages });
  } catch (error) {
    console.error('Error fetching ticket:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch ticket' });
  }
});

// PUT /api/admin/tickets/:id - Update ticket
router.put('/tickets/:id', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const ticketId = parseInt(req.params.id);
    const { status, priority, assigned_to } = req.body;
    const adminId = (req as any).admin.id;

    const updates: string[] = [];
    const params: any[] = [];

    if (status) {
      updates.push('status = ?');
      params.push(status);
      if (status === 'resolved') {
        updates.push('resolved_at = CURRENT_TIMESTAMP');
      }
    }
    if (priority) {
      updates.push('priority = ?');
      params.push(priority);
    }
    if (assigned_to !== undefined) {
      updates.push('assigned_to = ?');
      params.push(assigned_to || null);
    }

    if (updates.length === 0) {
      res.status(400).json({ success: false, message: 'No updates provided' });
      return;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(ticketId);

    await db.run(
      `UPDATE tickets SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    await logAdminAction(adminId, 'update_ticket', 'ticket', ticketId, req.body, req);

    res.json({ success: true, message: 'Ticket updated successfully' });
  } catch (error) {
    console.error('Error updating ticket:', error);
    res.status(500).json({ success: false, message: 'Failed to update ticket' });
  }
});

// POST /api/admin/tickets/:id/messages - Add message to ticket (Legacy - use /api/tickets/admin/:id/reply instead)
router.post('/tickets/:id/messages', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const ticketId = parseInt(req.params.id);
    const { message } = req.body;
    const admin = (req as any).admin;

    if (!message) {
      res.status(400).json({ success: false, message: 'Message is required' });
      return;
    }

    await db.run(
      `INSERT INTO ticket_messages (ticket_id, sender_type, sender_id, sender_name, message)
       VALUES (?, 'admin', ?, ?, ?)`,
      [ticketId, admin.id, admin.email, message]
    );

    // Update ticket
    await db.run(
      `UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [ticketId]
    );

    res.json({ success: true, message: 'Message added successfully' });
  } catch (error) {
    console.error('Error adding message:', error);
    res.status(500).json({ success: false, message: 'Failed to add message' });
  }
});

// ==================== DASHBOARD STATS ====================

// GET /api/admin/users/stats - Get user statistics
router.get('/stats/users', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();

    const totalUsers = await db.get('SELECT COUNT(*) as count FROM users');
    const activeUsers = await db.get('SELECT COUNT(*) as count FROM users WHERE is_active = 1');
    const blockedUsers = await db.get(
      'SELECT COUNT(DISTINCT user_id) as count FROM user_blocks WHERE is_active = 1'
    );
    const newUsersToday = await db.get(
      `SELECT COUNT(*) as count FROM users WHERE date(created_at) = date('now')`
    );
    const newUsersThisWeek = await db.get(
      `SELECT COUNT(*) as count FROM users WHERE created_at >= datetime('now', '-7 days')`
    );
    const newUsersThisMonth = await db.get(
      `SELECT COUNT(*) as count FROM users WHERE created_at >= datetime('now', '-30 days')`
    );

    // Open tickets
    const openTickets = await db.get(
      `SELECT COUNT(*) as count FROM tickets WHERE status IN ('open', 'in_progress')`
    );

    res.json({
      success: true,
      stats: {
        totalUsers: totalUsers?.count || 0,
        activeUsers: activeUsers?.count || 0,
        blockedUsers: blockedUsers?.count || 0,
        newUsersToday: newUsersToday?.count || 0,
        newUsersThisWeek: newUsersThisWeek?.count || 0,
        newUsersThisMonth: newUsersThisMonth?.count || 0,
        openTickets: openTickets?.count || 0
      }
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
});

export default router;
