import { Router, Request, Response } from 'express';
import { getDatabase } from '../config/database';
import { authenticateAdmin, authenticateUser, authenticateOptional } from '../middleware/auth';

const router = Router();

// ============================================
// CONSTANTS
// ============================================

const TICKET_CATEGORIES: Record<string, string> = {
  general: 'General Inquiry',
  order: 'Order Issue',
  payment: 'Payment Issue',
  delivery: 'Delivery Problem',
  product: 'Product Quality',
  refund: 'Refund Request',
  return: 'Return Issue',
  account: 'Account Issue',
  technical: 'Technical Support',
  feedback: 'Feedback/Suggestion',
  other: 'Other',
};

const TICKET_PRIORITIES: Record<string, { label: string; slaHours: number; color: string }> = {
  low: { label: 'Low', slaHours: 72, color: '#6B7280' },
  medium: { label: 'Medium', slaHours: 48, color: '#F59E0B' },
  high: { label: 'High', slaHours: 24, color: '#EF4444' },
  urgent: { label: 'Urgent', slaHours: 4, color: '#DC2626' },
};

const TICKET_STATUSES: Record<string, { label: string; color: string; isClosed: boolean }> = {
  open: { label: 'Open', color: '#3B82F6', isClosed: false },
  in_progress: { label: 'In Progress', color: '#8B5CF6', isClosed: false },
  awaiting_customer: { label: 'Awaiting Customer', color: '#F59E0B', isClosed: false },
  awaiting_internal: { label: 'Awaiting Internal', color: '#06B6D4', isClosed: false },
  escalated: { label: 'Escalated', color: '#EF4444', isClosed: false },
  resolved: { label: 'Resolved', color: '#10B981', isClosed: true },
  closed: { label: 'Closed', color: '#6B7280', isClosed: true },
};

// Helper functions
function generateTicketNumber(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'TKT-';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function calculateSlaDue(priority: string): string {
  const hours = TICKET_PRIORITIES[priority]?.slaHours || 48;
  const dueDate = new Date();
  dueDate.setHours(dueDate.getHours() + hours);
  return dueDate.toISOString().slice(0, 19).replace('T', ' ');
}

async function logTicketActivity(
  ticketId: number,
  activityType: string,
  actorType: string,
  actorId: number,
  actorName: string,
  oldValue?: string,
  newValue?: string,
  description?: string
): Promise<void> {
  const db = getDatabase();
  await db.run(
    `INSERT INTO ticket_activities (ticket_id, activity_type, actor_type, actor_id, actor_name, old_value, new_value, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [ticketId, activityType, actorType, actorId, actorName, oldValue, newValue, description]
  );
}

// ============================================
// PUBLIC ENDPOINTS (Get options)
// ============================================

// GET /api/tickets/categories - Get ticket categories
router.get('/categories', async (req: Request, res: Response): Promise<void> => {
  res.json({
    success: true,
    categories: Object.entries(TICKET_CATEGORIES).map(([code, label]) => ({ code, label })),
  });
});

// GET /api/tickets/priorities - Get ticket priorities
router.get('/priorities', async (req: Request, res: Response): Promise<void> => {
  res.json({
    success: true,
    priorities: Object.entries(TICKET_PRIORITIES).map(([code, data]) => ({
      code,
      label: data.label,
      sla_hours: data.slaHours,
    })),
  });
});

// GET /api/tickets/statuses - Get ticket statuses
router.get('/statuses', async (req: Request, res: Response): Promise<void> => {
  res.json({
    success: true,
    statuses: Object.entries(TICKET_STATUSES).map(([code, data]) => ({
      code,
      label: data.label,
      is_closed: data.isClosed,
    })),
  });
});

// ============================================
// USER ENDPOINTS
// ============================================

// POST /api/tickets - Create a new ticket
router.post('/', authenticateUser, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const user = (req as any).user;
    const {
      subject,
      description,
      category = 'general',
      priority = 'medium',
      order_id,
    } = req.body;

    if (!subject || !description) {
      res.status(400).json({ success: false, message: 'Subject and description are required' });
      return;
    }

    // Validate category
    if (!TICKET_CATEGORIES[category]) {
      res.status(400).json({ success: false, message: 'Invalid category' });
      return;
    }

    // Validate priority
    if (!TICKET_PRIORITIES[priority]) {
      res.status(400).json({ success: false, message: 'Invalid priority' });
      return;
    }

    // Validate order if provided
    if (order_id) {
      const order = await db.get('SELECT id FROM orders WHERE id = ? AND user_id = ?', [order_id, user.id]);
      if (!order) {
        res.status(400).json({ success: false, message: 'Invalid order' });
        return;
      }
    }

    const ticketNumber = generateTicketNumber();
    const slaDueAt = calculateSlaDue(priority);
    const slaHours = TICKET_PRIORITIES[priority].slaHours;

    const result = await db.run(
      `INSERT INTO tickets (
        ticket_number, user_id, order_id, subject, description, category, priority, 
        status, sla_hours, sla_due_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
      [ticketNumber, user.id, order_id || null, subject, description, category, priority, slaHours, slaDueAt]
    );

    // Add initial message
    await db.run(
      `INSERT INTO ticket_messages (ticket_id, sender_type, sender_id, sender_name, message)
       VALUES (?, 'user', ?, ?, ?)`,
      [result.lastID, user.id, user.name || user.email, description]
    );

    // Log activity
    await logTicketActivity(
      result.lastID!,
      'ticket_created',
      'user',
      user.id,
      user.name || user.email,
      undefined,
      undefined,
      `Ticket created: ${subject}`
    );

    const ticket = await db.get('SELECT * FROM tickets WHERE id = ?', [result.lastID]);

    res.status(201).json({
      success: true,
      message: 'Ticket created successfully',
      ticket: {
        ...ticket,
        category_label: TICKET_CATEGORIES[ticket.category],
        priority_label: TICKET_PRIORITIES[ticket.priority]?.label,
        status_label: TICKET_STATUSES[ticket.status]?.label,
      },
    });
  } catch (error) {
    console.error('Error creating ticket:', error);
    res.status(500).json({ success: false, message: 'Failed to create ticket' });
  }
});

// GET /api/tickets/my-tickets - Get user's tickets
router.get('/my-tickets', authenticateUser, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const user = (req as any).user;
    const { status, page = 1, limit = 20 } = req.query;

    let query = `SELECT t.*, o.order_number FROM tickets t 
                 LEFT JOIN orders o ON t.order_id = o.id
                 WHERE t.user_id = ?`;
    const params: any[] = [user.id];

    if (status && status !== 'all') {
      query += ` AND t.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY t.created_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), (Number(page) - 1) * Number(limit));

    const tickets = await db.all(query, params);

    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM tickets WHERE user_id = ?`;
    const countParams: any[] = [user.id];
    if (status && status !== 'all') {
      countQuery += ` AND status = ?`;
      countParams.push(status);
    }
    const { total } = await db.get(countQuery, countParams);

    res.json({
      success: true,
      tickets: tickets.map(t => ({
        ...t,
        category_label: TICKET_CATEGORIES[t.category],
        priority_label: TICKET_PRIORITIES[t.priority]?.label,
        status_label: TICKET_STATUSES[t.status]?.label,
        is_sla_breached: t.sla_breached || (new Date(t.sla_due_at) < new Date() && !TICKET_STATUSES[t.status]?.isClosed),
      })),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch tickets' });
  }
});

// GET /api/tickets/my-tickets/:id - Get single ticket detail for user
router.get('/my-tickets/:id', authenticateUser, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const user = (req as any).user;
    const { id } = req.params;

    const ticket = await db.get(
      `SELECT t.*, o.order_number, o.total_amount as order_total
       FROM tickets t
       LEFT JOIN orders o ON t.order_id = o.id
       WHERE t.id = ? AND t.user_id = ?`,
      [id, user.id]
    );

    if (!ticket) {
      res.status(404).json({ success: false, message: 'Ticket not found' });
      return;
    }

    // Get messages (excluding internal notes)
    const messages = await db.all(
      `SELECT * FROM ticket_messages WHERE ticket_id = ? AND is_internal = 0 ORDER BY created_at ASC`,
      [id]
    );

    // Get attachments
    const attachments = await db.all(
      `SELECT * FROM ticket_attachments WHERE ticket_id = ? ORDER BY created_at ASC`,
      [id]
    );

    res.json({
      success: true,
      ticket: {
        ...ticket,
        category_label: TICKET_CATEGORIES[ticket.category],
        priority_label: TICKET_PRIORITIES[ticket.priority]?.label,
        status_label: TICKET_STATUSES[ticket.status]?.label,
        is_sla_breached: ticket.sla_breached || (new Date(ticket.sla_due_at) < new Date() && !TICKET_STATUSES[ticket.status]?.isClosed),
        messages,
        attachments,
      },
    });
  } catch (error) {
    console.error('Error fetching ticket:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch ticket' });
  }
});

// POST /api/tickets/:id/reply - User reply to ticket
router.post('/:id/reply', authenticateUser, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const user = (req as any).user;
    const { id } = req.params;
    const { message } = req.body;

    if (!message?.trim()) {
      res.status(400).json({ success: false, message: 'Message is required' });
      return;
    }

    // Verify ticket belongs to user
    const ticket = await db.get('SELECT * FROM tickets WHERE id = ? AND user_id = ?', [id, user.id]);
    if (!ticket) {
      res.status(404).json({ success: false, message: 'Ticket not found' });
      return;
    }

    // Check if ticket is closed
    if (TICKET_STATUSES[ticket.status]?.isClosed) {
      res.status(400).json({ success: false, message: 'Cannot reply to a closed ticket' });
      return;
    }

    // Add message
    const result = await db.run(
      `INSERT INTO ticket_messages (ticket_id, sender_type, sender_id, sender_name, message)
       VALUES (?, 'user', ?, ?, ?)`,
      [id, user.id, user.name || user.email, message]
    );

    // Update ticket status if it was awaiting customer response
    if (ticket.status === 'awaiting_customer') {
      await db.run(
        `UPDATE tickets SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [id]
      );
    } else {
      await db.run(`UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
    }

    // Log activity
    await logTicketActivity(
      Number(id),
      'message_added',
      'user',
      user.id,
      user.name || user.email,
      undefined,
      undefined,
      'Customer replied to ticket'
    );

    const newMessage = await db.get('SELECT * FROM ticket_messages WHERE id = ?', [result.lastID]);

    res.status(201).json({
      success: true,
      message: 'Reply sent successfully',
      ticket_message: newMessage,
    });
  } catch (error) {
    console.error('Error replying to ticket:', error);
    res.status(500).json({ success: false, message: 'Failed to send reply' });
  }
});

// ============================================
// ADMIN ENDPOINTS
// ============================================

// GET /api/tickets/admin - List all tickets (admin)
router.get('/admin', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const { 
      status, 
      priority, 
      category, 
      assigned_to, 
      search, 
      sla_status,
      page = 1, 
      limit = 20 
    } = req.query;

    let query = `
      SELECT t.*, 
             u.name as customer_name, u.email as customer_email,
             a.email as assigned_name,
             o.order_number
      FROM tickets t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN admins a ON t.assigned_to = a.id
      LEFT JOIN orders o ON t.order_id = o.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status && status !== 'all') {
      query += ` AND t.status = ?`;
      params.push(status);
    }

    if (priority && priority !== 'all') {
      query += ` AND t.priority = ?`;
      params.push(priority);
    }

    if (category && category !== 'all') {
      query += ` AND t.category = ?`;
      params.push(category);
    }

    if (assigned_to && assigned_to !== 'all') {
      if (assigned_to === 'unassigned') {
        query += ` AND t.assigned_to IS NULL`;
      } else {
        query += ` AND t.assigned_to = ?`;
        params.push(assigned_to);
      }
    }

    if (sla_status === 'breached') {
      query += ` AND (t.sla_breached = 1 OR (t.sla_due_at < CURRENT_TIMESTAMP AND t.status NOT IN ('resolved', 'closed')))`;
    } else if (sla_status === 'at_risk') {
      query += ` AND t.sla_due_at > CURRENT_TIMESTAMP AND t.sla_due_at < datetime(CURRENT_TIMESTAMP, '+4 hours') AND t.status NOT IN ('resolved', 'closed')`;
    }

    if (search) {
      query += ` AND (t.ticket_number LIKE ? OR t.subject LIKE ? OR u.name LIKE ? OR u.email LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Count query
    const countQuery = query.replace(/SELECT .* FROM/, 'SELECT COUNT(*) as total FROM');
    const { total } = await db.get(countQuery, params);

    // Add pagination
    query += ` ORDER BY 
      CASE WHEN t.status = 'escalated' THEN 0 ELSE 1 END,
      CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      t.sla_due_at ASC
    `;
    query += ` LIMIT ? OFFSET ?`;
    params.push(Number(limit), (Number(page) - 1) * Number(limit));

    const tickets = await db.all(query, params);

    res.json({
      success: true,
      tickets: tickets.map(t => ({
        ...t,
        category_label: TICKET_CATEGORIES[t.category],
        priority_label: TICKET_PRIORITIES[t.priority]?.label,
        priority_color: TICKET_PRIORITIES[t.priority]?.color,
        status_label: TICKET_STATUSES[t.status]?.label,
        status_color: TICKET_STATUSES[t.status]?.color,
        is_sla_breached: t.sla_breached || (new Date(t.sla_due_at) < new Date() && !TICKET_STATUSES[t.status]?.isClosed),
        sla_remaining: Math.max(0, Math.floor((new Date(t.sla_due_at).getTime() - Date.now()) / (1000 * 60))),
      })),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch tickets' });
  }
});

// GET /api/tickets/admin/stats - Get ticket statistics
router.get('/admin/stats', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();

    const stats = await db.get(`
      SELECT 
        COUNT(*) as total_tickets,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_tickets,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'awaiting_customer' THEN 1 ELSE 0 END) as awaiting_customer,
        SUM(CASE WHEN status = 'escalated' THEN 1 ELSE 0 END) as escalated,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
        SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed,
        SUM(CASE WHEN assigned_to IS NULL AND status NOT IN ('resolved', 'closed') THEN 1 ELSE 0 END) as unassigned,
        SUM(CASE WHEN sla_breached = 1 OR (sla_due_at < CURRENT_TIMESTAMP AND status NOT IN ('resolved', 'closed')) THEN 1 ELSE 0 END) as sla_breached,
        SUM(CASE WHEN sla_due_at > CURRENT_TIMESTAMP AND sla_due_at < datetime(CURRENT_TIMESTAMP, '+4 hours') AND status NOT IN ('resolved', 'closed') THEN 1 ELSE 0 END) as sla_at_risk
      FROM tickets
    `);

    const priorityStats = await db.all(`
      SELECT priority, COUNT(*) as count
      FROM tickets
      WHERE status NOT IN ('resolved', 'closed')
      GROUP BY priority
    `);

    const categoryStats = await db.all(`
      SELECT category, COUNT(*) as count
      FROM tickets
      WHERE status NOT IN ('resolved', 'closed')
      GROUP BY category
      ORDER BY count DESC
      LIMIT 5
    `);

    const todayStats = await db.get(`
      SELECT 
        COUNT(CASE WHEN DATE(created_at) = DATE('now') THEN 1 END) as created_today,
        COUNT(CASE WHEN DATE(closed_at) = DATE('now') THEN 1 END) as closed_today
      FROM tickets
    `);

    // Average resolution time (in hours)
    const avgResolution = await db.get(`
      SELECT AVG((JULIANDAY(closed_at) - JULIANDAY(created_at)) * 24) as avg_hours
      FROM tickets
      WHERE closed_at IS NOT NULL
    `);

    // First response time (in hours)
    const avgFirstResponse = await db.get(`
      SELECT AVG((JULIANDAY(first_response_at) - JULIANDAY(created_at)) * 24) as avg_hours
      FROM tickets
      WHERE first_response_at IS NOT NULL
    `);

    res.json({
      success: true,
      stats: {
        ...stats,
        today: todayStats,
        by_priority: priorityStats.map(p => ({
          ...p,
          priority_label: TICKET_PRIORITIES[p.priority]?.label,
          priority_color: TICKET_PRIORITIES[p.priority]?.color,
        })),
        by_category: categoryStats.map(c => ({
          ...c,
          category_label: TICKET_CATEGORIES[c.category],
        })),
        avg_resolution_hours: avgResolution?.avg_hours || 0,
        avg_first_response_hours: avgFirstResponse?.avg_hours || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching ticket stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch ticket statistics' });
  }
});

// GET /api/tickets/admin/escalated - Get escalated tickets
// NOTE: This route must come BEFORE /admin/:id to avoid matching "escalated" as an id
router.get('/admin/escalated', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const { page = 1, limit = 20 } = req.query;

    const tickets = await db.all(
      `SELECT t.*, 
              u.name as customer_name, u.email as customer_email,
              a.email as assigned_name,
              e.reason as escalation_reason, e.created_at as escalated_at,
              ea.email as escalated_by_name
       FROM tickets t
       LEFT JOIN users u ON t.user_id = u.id
       LEFT JOIN admins a ON t.assigned_to = a.id
       LEFT JOIN ticket_escalations e ON t.id = e.ticket_id AND e.resolved_at IS NULL
       LEFT JOIN admins ea ON e.escalated_by = ea.id
       WHERE t.status = 'escalated'
       ORDER BY t.escalation_level DESC, t.sla_due_at ASC
       LIMIT ? OFFSET ?`,
      [Number(limit), (Number(page) - 1) * Number(limit)]
    );

    const { total } = await db.get(`SELECT COUNT(*) as total FROM tickets WHERE status = 'escalated'`);

    res.json({
      success: true,
      tickets: tickets.map(t => ({
        ...t,
        category_label: TICKET_CATEGORIES[t.category],
        priority_label: TICKET_PRIORITIES[t.priority]?.label,
        priority_color: TICKET_PRIORITIES[t.priority]?.color,
        status_label: TICKET_STATUSES[t.status]?.label,
        status_color: TICKET_STATUSES[t.status]?.color,
        is_sla_breached: t.sla_breached || (new Date(t.sla_due_at) < new Date()),
      })),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching escalated tickets:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch escalated tickets' });
  }
});

// GET /api/tickets/admin/agents - Get admin agents for assignment
// NOTE: This route must come BEFORE /admin/:id to avoid matching "agents" as an id
router.get('/admin/agents', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    
    const agents = await db.all(
      `SELECT a.id, a.email, a.role,
              COUNT(t.id) as open_tickets
       FROM admins a
       LEFT JOIN tickets t ON a.id = t.assigned_to AND t.status NOT IN ('resolved', 'closed')
       WHERE a.is_active = 1
       GROUP BY a.id
       ORDER BY a.email`
    );

    res.json({
      success: true,
      agents,
    });
  } catch (error) {
    console.error('Error fetching agents:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch agents' });
  }
});

// GET /api/tickets/admin/:id - Get single ticket detail (admin)
router.get('/admin/:id', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const ticket = await db.get(
      `SELECT t.*, 
              u.name as customer_name, u.email as customer_email, u.phone as customer_phone,
              a.email as assigned_name,
              o.order_number, o.total_amount as order_total, o.status as order_status
       FROM tickets t
       LEFT JOIN users u ON t.user_id = u.id
       LEFT JOIN admins a ON t.assigned_to = a.id
       LEFT JOIN orders o ON t.order_id = o.id
       WHERE t.id = ?`,
      [id]
    );

    if (!ticket) {
      res.status(404).json({ success: false, message: 'Ticket not found' });
      return;
    }

    // Get all messages (including internal notes for admin)
    const messages = await db.all(
      `SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC`,
      [id]
    );

    // Get attachments
    const attachments = await db.all(
      `SELECT * FROM ticket_attachments WHERE ticket_id = ? ORDER BY created_at ASC`,
      [id]
    );

    // Get escalations
    const escalations = await db.all(
      `SELECT e.*, a1.email as escalated_by_name, a2.email as escalated_to_name, a3.email as resolved_by_name
       FROM ticket_escalations e
       LEFT JOIN admins a1 ON e.escalated_by = a1.id
       LEFT JOIN admins a2 ON e.escalated_to = a2.id
       LEFT JOIN admins a3 ON e.resolved_by = a3.id
       WHERE e.ticket_id = ?
       ORDER BY e.created_at DESC`,
      [id]
    );

    // Get activity log
    const activities = await db.all(
      `SELECT * FROM ticket_activities WHERE ticket_id = ? ORDER BY created_at DESC LIMIT 50`,
      [id]
    );

    res.json({
      success: true,
      ticket: {
        ...ticket,
        category_label: TICKET_CATEGORIES[ticket.category],
        priority_label: TICKET_PRIORITIES[ticket.priority]?.label,
        priority_color: TICKET_PRIORITIES[ticket.priority]?.color,
        status_label: TICKET_STATUSES[ticket.status]?.label,
        status_color: TICKET_STATUSES[ticket.status]?.color,
        is_sla_breached: ticket.sla_breached || (new Date(ticket.sla_due_at) < new Date() && !TICKET_STATUSES[ticket.status]?.isClosed),
        sla_remaining: Math.max(0, Math.floor((new Date(ticket.sla_due_at).getTime() - Date.now()) / (1000 * 60))),
        messages,
        attachments,
        escalations,
        activities,
      },
    });
  } catch (error) {
    console.error('Error fetching ticket:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch ticket' });
  }
});

// POST /api/tickets/admin/:id/reply - Admin reply to ticket
router.post('/admin/:id/reply', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const admin = (req as any).admin;
    const { id } = req.params;
    const { message, is_internal = false } = req.body;

    if (!message?.trim()) {
      res.status(400).json({ success: false, message: 'Message is required' });
      return;
    }

    const ticket = await db.get('SELECT * FROM tickets WHERE id = ?', [id]);
    if (!ticket) {
      res.status(404).json({ success: false, message: 'Ticket not found' });
      return;
    }

    // Add message
    const result = await db.run(
      `INSERT INTO ticket_messages (ticket_id, sender_type, sender_id, sender_name, message, is_internal)
       VALUES (?, 'admin', ?, ?, ?, ?)`,
      [id, admin.id, admin.email, message, is_internal ? 1 : 0]
    );

    // Update ticket
    const updateFields: string[] = ['updated_at = CURRENT_TIMESTAMP', 'last_response_at = CURRENT_TIMESTAMP'];
    
    // Set first response time if not set
    if (!ticket.first_response_at && !is_internal) {
      updateFields.push('first_response_at = CURRENT_TIMESTAMP');
    }

    // Update status to awaiting customer if it was open/in_progress
    if (!is_internal && ['open', 'in_progress'].includes(ticket.status)) {
      updateFields.push(`status = 'awaiting_customer'`);
    }

    await db.run(`UPDATE tickets SET ${updateFields.join(', ')} WHERE id = ?`, [id]);

    // Log activity
    await logTicketActivity(
      Number(id),
      is_internal ? 'internal_note_added' : 'admin_reply',
      'admin',
      admin.id,
      admin.email,
      undefined,
      undefined,
      is_internal ? 'Internal note added' : 'Admin replied to ticket'
    );

    const newMessage = await db.get('SELECT * FROM ticket_messages WHERE id = ?', [result.lastID]);

    res.status(201).json({
      success: true,
      message: is_internal ? 'Internal note added' : 'Reply sent successfully',
      ticket_message: newMessage,
    });
  } catch (error) {
    console.error('Error replying to ticket:', error);
    res.status(500).json({ success: false, message: 'Failed to send reply' });
  }
});

// PUT /api/tickets/admin/:id/assign - Assign ticket
router.put('/admin/:id/assign', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const admin = (req as any).admin;
    const { id } = req.params;
    const { assigned_to } = req.body;

    const ticket = await db.get('SELECT * FROM tickets WHERE id = ?', [id]);
    if (!ticket) {
      res.status(404).json({ success: false, message: 'Ticket not found' });
      return;
    }

    // Verify assigned_to is a valid admin
    let assignedAdmin = null;
    if (assigned_to) {
      assignedAdmin = await db.get('SELECT id, email FROM admins WHERE id = ?', [assigned_to]);
      if (!assignedAdmin) {
        res.status(400).json({ success: false, message: 'Invalid admin to assign' });
        return;
      }
    }

    const oldAssigned = ticket.assigned_to;
    await db.run(
      `UPDATE tickets SET assigned_to = ?, assigned_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [assigned_to || null, id]
    );

    // Log activity
    await logTicketActivity(
      Number(id),
      'assigned',
      'admin',
      admin.id,
      admin.email,
      oldAssigned?.toString(),
      assigned_to?.toString(),
      `Ticket assigned to ${assignedAdmin?.email || 'unassigned'}`
    );

    res.json({
      success: true,
      message: assigned_to ? `Ticket assigned to ${assignedAdmin?.email}` : 'Ticket unassigned',
    });
  } catch (error) {
    console.error('Error assigning ticket:', error);
    res.status(500).json({ success: false, message: 'Failed to assign ticket' });
  }
});

// PUT /api/tickets/admin/:id/status - Update ticket status
router.put('/admin/:id/status', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const admin = (req as any).admin;
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!TICKET_STATUSES[status]) {
      res.status(400).json({ success: false, message: 'Invalid status' });
      return;
    }

    const ticket = await db.get('SELECT * FROM tickets WHERE id = ?', [id]);
    if (!ticket) {
      res.status(404).json({ success: false, message: 'Ticket not found' });
      return;
    }

    const oldStatus = ticket.status;
    await db.run(
      `UPDATE tickets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [status, id]
    );

    // Add internal note if provided
    if (notes) {
      await db.run(
        `INSERT INTO ticket_messages (ticket_id, sender_type, sender_id, sender_name, message, is_internal)
         VALUES (?, 'admin', ?, ?, ?, 1)`,
        [id, admin.id, admin.email, `Status changed to ${TICKET_STATUSES[status].label}: ${notes}`]
      );
    }

    // Log activity
    await logTicketActivity(
      Number(id),
      'status_changed',
      'admin',
      admin.id,
      admin.email,
      oldStatus,
      status,
      `Status changed from ${TICKET_STATUSES[oldStatus]?.label} to ${TICKET_STATUSES[status]?.label}`
    );

    res.json({
      success: true,
      message: `Ticket status updated to ${TICKET_STATUSES[status].label}`,
    });
  } catch (error) {
    console.error('Error updating ticket status:', error);
    res.status(500).json({ success: false, message: 'Failed to update ticket status' });
  }
});

// PUT /api/tickets/admin/:id/priority - Update ticket priority
router.put('/admin/:id/priority', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const admin = (req as any).admin;
    const { id } = req.params;
    const { priority } = req.body;

    if (!TICKET_PRIORITIES[priority]) {
      res.status(400).json({ success: false, message: 'Invalid priority' });
      return;
    }

    const ticket = await db.get('SELECT * FROM tickets WHERE id = ?', [id]);
    if (!ticket) {
      res.status(404).json({ success: false, message: 'Ticket not found' });
      return;
    }

    const oldPriority = ticket.priority;
    const newSlaDue = calculateSlaDue(priority);
    const newSlaHours = TICKET_PRIORITIES[priority].slaHours;

    await db.run(
      `UPDATE tickets SET priority = ?, sla_hours = ?, sla_due_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [priority, newSlaHours, newSlaDue, id]
    );

    // Log activity
    await logTicketActivity(
      Number(id),
      'priority_changed',
      'admin',
      admin.id,
      admin.email,
      oldPriority,
      priority,
      `Priority changed from ${TICKET_PRIORITIES[oldPriority]?.label} to ${TICKET_PRIORITIES[priority]?.label}`
    );

    res.json({
      success: true,
      message: `Ticket priority updated to ${TICKET_PRIORITIES[priority].label}`,
    });
  } catch (error) {
    console.error('Error updating ticket priority:', error);
    res.status(500).json({ success: false, message: 'Failed to update ticket priority' });
  }
});

// PUT /api/tickets/admin/:id/escalate - Escalate ticket
router.put('/admin/:id/escalate', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const admin = (req as any).admin;
    const { id } = req.params;
    const { reason, notes, escalate_to } = req.body;

    if (!reason?.trim()) {
      res.status(400).json({ success: false, message: 'Escalation reason is required' });
      return;
    }

    const ticket = await db.get('SELECT * FROM tickets WHERE id = ?', [id]);
    if (!ticket) {
      res.status(404).json({ success: false, message: 'Ticket not found' });
      return;
    }

    if (TICKET_STATUSES[ticket.status]?.isClosed) {
      res.status(400).json({ success: false, message: 'Cannot escalate a closed ticket' });
      return;
    }

    const previousLevel = ticket.escalation_level || 0;
    const newLevel = previousLevel + 1;

    // Create escalation record
    await db.run(
      `INSERT INTO ticket_escalations (ticket_id, previous_level, new_level, escalated_by, escalated_by_type, escalated_to, reason, notes)
       VALUES (?, ?, ?, ?, 'admin', ?, ?, ?)`,
      [id, previousLevel, newLevel, admin.id, escalate_to || null, reason, notes]
    );

    // Update ticket
    await db.run(
      `UPDATE tickets SET 
        status = 'escalated', 
        escalation_level = ?, 
        priority = 'urgent',
        sla_hours = ?,
        sla_due_at = ?,
        updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [newLevel, TICKET_PRIORITIES.urgent.slaHours, calculateSlaDue('urgent'), id]
    );

    // Add internal note
    await db.run(
      `INSERT INTO ticket_messages (ticket_id, sender_type, sender_id, sender_name, message, is_internal)
       VALUES (?, 'admin', ?, ?, ?, 1)`,
      [id, admin.id, admin.email, `Ticket escalated to Level ${newLevel}. Reason: ${reason}`]
    );

    // Log activity
    await logTicketActivity(
      Number(id),
      'escalated',
      'admin',
      admin.id,
      admin.email,
      previousLevel.toString(),
      newLevel.toString(),
      `Ticket escalated to Level ${newLevel}: ${reason}`
    );

    res.json({
      success: true,
      message: `Ticket escalated to Level ${newLevel}`,
    });
  } catch (error) {
    console.error('Error escalating ticket:', error);
    res.status(500).json({ success: false, message: 'Failed to escalate ticket' });
  }
});

// PUT /api/tickets/admin/:id/close - Close ticket
router.put('/admin/:id/close', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const admin = (req as any).admin;
    const { id } = req.params;
    const { resolution_summary, status = 'resolved' } = req.body;

    if (!resolution_summary?.trim()) {
      res.status(400).json({ success: false, message: 'Resolution summary is required' });
      return;
    }

    if (!['resolved', 'closed'].includes(status)) {
      res.status(400).json({ success: false, message: 'Invalid close status' });
      return;
    }

    const ticket = await db.get('SELECT * FROM tickets WHERE id = ?', [id]);
    if (!ticket) {
      res.status(404).json({ success: false, message: 'Ticket not found' });
      return;
    }

    if (TICKET_STATUSES[ticket.status]?.isClosed) {
      res.status(400).json({ success: false, message: 'Ticket is already closed' });
      return;
    }

    const oldStatus = ticket.status;

    // Check if SLA was breached
    const slaBreached = ticket.sla_breached || (new Date(ticket.sla_due_at) < new Date());

    await db.run(
      `UPDATE tickets SET 
        status = ?, 
        resolution_summary = ?,
        closed_at = CURRENT_TIMESTAMP,
        closed_by = ?,
        sla_breached = ?,
        updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [status, resolution_summary, admin.id, slaBreached ? 1 : 0, id]
    );

    // Add closure message
    await db.run(
      `INSERT INTO ticket_messages (ticket_id, sender_type, sender_id, sender_name, message, is_internal)
       VALUES (?, 'admin', ?, ?, ?, 0)`,
      [id, admin.id, admin.email, `Ticket ${status}: ${resolution_summary}`]
    );

    // Resolve any pending escalations
    await db.run(
      `UPDATE ticket_escalations SET resolved_at = CURRENT_TIMESTAMP, resolved_by = ?, resolution_notes = ?
       WHERE ticket_id = ? AND resolved_at IS NULL`,
      [admin.id, resolution_summary, id]
    );

    // Log activity
    await logTicketActivity(
      Number(id),
      'closed',
      'admin',
      admin.id,
      admin.email,
      oldStatus,
      status,
      `Ticket ${status}: ${resolution_summary}`
    );

    res.json({
      success: true,
      message: `Ticket ${TICKET_STATUSES[status].label.toLowerCase()} successfully`,
    });
  } catch (error) {
    console.error('Error closing ticket:', error);
    res.status(500).json({ success: false, message: 'Failed to close ticket' });
  }
});

export default router;
