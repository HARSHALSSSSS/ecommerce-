import { Router, Request, Response } from 'express';
import { authenticateAdmin, authenticateUser } from '../middleware/auth';
import { getDatabase } from '../config/database';

const router = Router();

// ========================================
// ORDER STATUS STATE MACHINE
// ========================================
// Defines valid status transitions with business rules
const ORDER_STATUS_TRANSITIONS: Record<string, { next: string[]; slaHours: number }> = {
  pending: {
    next: ['confirmed', 'cancelled'],
    slaHours: 2, // Must be confirmed within 2 hours
  },
  confirmed: {
    next: ['processing', 'cancelled'],
    slaHours: 4, // Must start processing within 4 hours
  },
  processing: {
    next: ['ready_for_shipping', 'cancelled'],
    slaHours: 24, // Must be ready for shipping within 24 hours
  },
  ready_for_shipping: {
    next: ['shipped', 'cancelled'],
    slaHours: 12, // Must be shipped within 12 hours
  },
  shipped: {
    next: ['out_for_delivery', 'delivered', 'returned'],
    slaHours: 72, // Must be out for delivery within 72 hours
  },
  out_for_delivery: {
    next: ['delivered', 'failed_delivery'],
    slaHours: 24, // Must be delivered within 24 hours
  },
  delivered: {
    next: ['refund_requested'],
    slaHours: 0, // No SLA - final state
  },
  failed_delivery: {
    next: ['out_for_delivery', 'returned', 'cancelled'],
    slaHours: 48, // Must retry or cancel within 48 hours
  },
  cancelled: {
    next: [], // Final state
    slaHours: 0,
  },
  returned: {
    next: ['refund_processing'],
    slaHours: 24, // Must start refund within 24 hours
  },
  refund_requested: {
    next: ['refund_processing', 'refund_rejected'],
    slaHours: 48, // Must process refund request within 48 hours
  },
  refund_processing: {
    next: ['refunded'],
    slaHours: 72, // Must complete refund within 72 hours
  },
  refund_rejected: {
    next: [], // Final state
    slaHours: 0,
  },
  refunded: {
    next: [], // Final state
    slaHours: 0,
  },
};

const STATUS_DISPLAY_NAMES: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  processing: 'Processing',
  ready_for_shipping: 'Ready for Shipping',
  shipped: 'Shipped',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  failed_delivery: 'Failed Delivery',
  cancelled: 'Cancelled',
  returned: 'Returned',
  refund_requested: 'Refund Requested',
  refund_processing: 'Refund Processing',
  refund_rejected: 'Refund Rejected',
  refunded: 'Refunded',
};

// Helper: Log order event to immutable event store
async function logOrderEvent(
  orderId: number,
  eventType: string,
  previousStatus: string | null,
  newStatus: string | null,
  actorType: 'admin' | 'user' | 'system',
  actorId: number | null,
  actorName: string | null,
  notes?: string,
  metadata?: object
): Promise<void> {
  const db = getDatabase();
  await db.run(
    `INSERT INTO order_events (order_id, event_type, previous_status, new_status, actor_type, actor_id, actor_name, notes, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [orderId, eventType, previousStatus, newStatus, actorType, actorId, actorName, notes, metadata ? JSON.stringify(metadata) : null]
  );
}

// Helper: Update SLA tracking
async function updateOrderSLA(orderId: number, newStatus: string): Promise<void> {
  const db = getDatabase();
  const statusConfig = ORDER_STATUS_TRANSITIONS[newStatus];
  
  if (!statusConfig || statusConfig.slaHours === 0) {
    // Remove SLA for final states
    await db.run('DELETE FROM order_sla WHERE order_id = ?', [orderId]);
    return;
  }

  const deadline = new Date();
  deadline.setHours(deadline.getHours() + statusConfig.slaHours);

  const existing = await db.get('SELECT id FROM order_sla WHERE order_id = ?', [orderId]);
  
  if (existing) {
    await db.run(
      `UPDATE order_sla SET status = ?, sla_deadline = ?, is_breached = 0, breached_at = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE order_id = ?`,
      [newStatus, deadline.toISOString(), orderId]
    );
  } else {
    await db.run(
      `INSERT INTO order_sla (order_id, status, sla_deadline) VALUES (?, ?, ?)`,
      [orderId, newStatus, deadline.toISOString()]
    );
  }
}

// Helper: Check and mark breached SLAs
async function checkSLABreaches(): Promise<number> {
  const db = getDatabase();
  const result = await db.run(
    `UPDATE order_sla 
     SET is_breached = 1, breached_at = CURRENT_TIMESTAMP 
     WHERE is_breached = 0 AND sla_deadline < CURRENT_TIMESTAMP`
  );
  return result.changes || 0;
}

// ========================================
// ADMIN ORDER MANAGEMENT ROUTES
// ========================================

// GET /api/admin/orders - Get all orders with filters
router.get('/orders', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const {
      page = 1,
      limit = 20,
      status,
      search,
      customer_id,
      date_from,
      date_to,
      sort_by = 'created_at',
      sort_order = 'desc',
      sla_status, // 'all', 'breached', 'at_risk', 'on_track'
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    let whereClause = '1=1';
    const params: any[] = [];

    // Status filter
    if (status && status !== 'all') {
      whereClause += ' AND o.status = ?';
      params.push(status);
    }

    // Customer filter
    if (customer_id) {
      whereClause += ' AND o.user_id = ?';
      params.push(customer_id);
    }

    // Search filter (order number, customer name, email)
    if (search) {
      whereClause += ' AND (o.order_number LIKE ? OR u.name LIKE ? OR u.email LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Date range filter
    if (date_from) {
      whereClause += ' AND DATE(o.created_at) >= ?';
      params.push(date_from);
    }
    if (date_to) {
      whereClause += ' AND DATE(o.created_at) <= ?';
      params.push(date_to);
    }

    // SLA status filter
    let slaJoin = '';
    if (sla_status && sla_status !== 'all') {
      slaJoin = 'LEFT JOIN order_sla sla ON o.id = sla.order_id';
      if (sla_status === 'breached') {
        whereClause += ' AND sla.is_breached = 1';
      } else if (sla_status === 'at_risk') {
        whereClause += ' AND sla.is_breached = 0 AND sla.sla_deadline <= datetime("now", "+2 hours")';
      } else if (sla_status === 'on_track') {
        whereClause += ' AND (sla.id IS NULL OR (sla.is_breached = 0 AND sla.sla_deadline > datetime("now", "+2 hours")))';
      }
    }

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ${slaJoin}
      WHERE ${whereClause}
    `;
    const countResult = await db.get(countQuery, params);

    // Main query with SLA info
    const validSortColumns = ['created_at', 'total_amount', 'status', 'order_number'];
    const sortColumn = validSortColumns.includes(sort_by as string) ? sort_by : 'created_at';
    const sortDir = sort_order === 'asc' ? 'ASC' : 'DESC';

    const ordersQuery = `
      SELECT 
        o.*,
        u.name as customer_name,
        u.email as customer_email,
        u.phone as customer_phone,
        sla.sla_deadline,
        sla.is_breached as sla_breached,
        CASE 
          WHEN sla.is_breached = 1 THEN 'breached'
          WHEN sla.sla_deadline IS NULL THEN 'completed'
          WHEN sla.sla_deadline <= datetime('now', '+2 hours') THEN 'at_risk'
          ELSE 'on_track'
        END as sla_status
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN order_sla sla ON o.id = sla.order_id
      WHERE ${whereClause}
      ORDER BY o.${sortColumn} ${sortDir}
      LIMIT ? OFFSET ?
    `;
    params.push(Number(limit), offset);

    const orders = await db.all(ordersQuery, params);

    // Get item count for each order
    for (const order of orders) {
      const itemCount = await db.get(
        'SELECT COUNT(*) as count, SUM(quantity) as total_items FROM order_items WHERE order_id = ?',
        [order.id]
      );
      order.item_count = itemCount?.count || 0;
      order.total_items = itemCount?.total_items || 0;
    }

    // Check for SLA breaches
    await checkSLABreaches();

    res.json({
      success: true,
      orders,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: countResult?.total || 0,
        totalPages: Math.ceil((countResult?.total || 0) / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch orders' });
  }
});

// GET /api/admin/orders/stats - Get order statistics
router.get('/orders/stats', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();

    // Overall stats
    const stats = await db.get(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
        SUM(CASE WHEN status = 'ready_for_shipping' THEN 1 ELSE 0 END) as ready_for_shipping,
        SUM(CASE WHEN status = 'shipped' THEN 1 ELSE 0 END) as shipped,
        SUM(CASE WHEN status = 'out_for_delivery' THEN 1 ELSE 0 END) as out_for_delivery,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN status IN ('refund_requested', 'refund_processing', 'refunded') THEN 1 ELSE 0 END) as refunds,
        SUM(total_amount) as total_revenue,
        AVG(total_amount) as avg_order_value
      FROM orders
    `);

    // SLA stats
    const slaStats = await db.get(`
      SELECT 
        COUNT(*) as total_tracked,
        SUM(CASE WHEN is_breached = 1 THEN 1 ELSE 0 END) as breached,
        SUM(CASE WHEN is_breached = 0 AND sla_deadline <= datetime('now', '+2 hours') THEN 1 ELSE 0 END) as at_risk,
        SUM(CASE WHEN is_breached = 0 AND sla_deadline > datetime('now', '+2 hours') THEN 1 ELSE 0 END) as on_track
      FROM order_sla
    `);

    // Today's stats
    const todayStats = await db.get(`
      SELECT 
        COUNT(*) as orders_today,
        SUM(total_amount) as revenue_today
      FROM orders
      WHERE DATE(created_at) = DATE('now')
    `);

    // This week stats
    const weekStats = await db.get(`
      SELECT 
        COUNT(*) as orders_this_week,
        SUM(total_amount) as revenue_this_week
      FROM orders
      WHERE DATE(created_at) >= DATE('now', '-7 days')
    `);

    res.json({
      success: true,
      stats: {
        ...stats,
        sla: slaStats,
        today: todayStats,
        week: weekStats,
      },
    });
  } catch (error) {
    console.error('Error fetching order stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch order statistics' });
  }
});

// GET /api/admin/orders/:id - Get single order with full details
router.get('/orders/:id', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const order = await db.get(`
      SELECT 
        o.*,
        u.name as customer_name,
        u.email as customer_email,
        u.phone as customer_phone,
        u.created_at as customer_since,
        sla.sla_deadline,
        sla.is_breached as sla_breached,
        CASE 
          WHEN sla.is_breached = 1 THEN 'breached'
          WHEN sla.sla_deadline IS NULL THEN 'completed'
          WHEN sla.sla_deadline <= datetime('now', '+2 hours') THEN 'at_risk'
          ELSE 'on_track'
        END as sla_status
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN order_sla sla ON o.id = sla.order_id
      WHERE o.id = ?
    `, [id]);

    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    // Get order items with product details
    const items = await db.all(`
      SELECT 
        oi.*,
        p.name as product_name,
        p.image_url as product_image,
        p.sku,
        c.name as category_name
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE oi.order_id = ?
    `, [id]);

    // Get available status transitions based on current state
    const currentStatus = order.status;
    const transitions = ORDER_STATUS_TRANSITIONS[currentStatus];
    const availableTransitions = transitions?.next.map(status => ({
      status,
      display_name: STATUS_DISPLAY_NAMES[status] || status,
    })) || [];

    // Get customer's order history count
    const customerOrders = await db.get(
      'SELECT COUNT(*) as total_orders, SUM(total_amount) as total_spent FROM orders WHERE user_id = ?',
      [order.user_id]
    );

    res.json({
      success: true,
      order: {
        ...order,
        items,
        available_transitions: availableTransitions,
        customer_stats: customerOrders,
      },
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch order' });
  }
});

// GET /api/admin/orders/:id/timeline - Get order timeline/events
router.get('/orders/:id/timeline', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    // Verify order exists
    const order = await db.get('SELECT id, order_number FROM orders WHERE id = ?', [id]);
    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    // Get all events for this order
    const events = await db.all(`
      SELECT 
        id,
        event_type,
        previous_status,
        new_status,
        actor_type,
        actor_id,
        actor_name,
        notes,
        metadata,
        created_at
      FROM order_events
      WHERE order_id = ?
      ORDER BY created_at ASC
    `, [id]);

    // Parse metadata JSON
    const parsedEvents = events.map(event => ({
      ...event,
      metadata: event.metadata ? JSON.parse(event.metadata) : null,
      previous_status_display: event.previous_status ? STATUS_DISPLAY_NAMES[event.previous_status] : null,
      new_status_display: event.new_status ? STATUS_DISPLAY_NAMES[event.new_status] : null,
    }));

    res.json({
      success: true,
      order_number: order.order_number,
      timeline: parsedEvents,
    });
  } catch (error) {
    console.error('Error fetching order timeline:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch order timeline' });
  }
});

// PUT /api/admin/orders/:id/status - Update order status with state machine validation
router.put('/orders/:id/status', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { new_status, notes, notify_customer = true } = req.body;
    const admin = (req as any).admin;

    // Get current order
    const order = await db.get('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    const currentStatus = order.status;
    const transitions = ORDER_STATUS_TRANSITIONS[currentStatus];

    // Validate transition
    if (!transitions || !transitions.next.includes(new_status)) {
      res.status(400).json({
        success: false,
        message: `Invalid status transition from "${STATUS_DISPLAY_NAMES[currentStatus]}" to "${STATUS_DISPLAY_NAMES[new_status] || new_status}"`,
        allowed_transitions: transitions?.next.map(s => ({
          status: s,
          display_name: STATUS_DISPLAY_NAMES[s],
        })) || [],
      });
      return;
    }

    // Update order status
    await db.run(
      'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [new_status, id]
    );

    // Log event to immutable event store
    await logOrderEvent(
      Number(id),
      'status_change',
      currentStatus,
      new_status,
      'admin',
      admin.id,
      admin.name || admin.email,
      notes,
      { notify_customer, ip_address: req.ip }
    );

    // Update SLA tracking
    await updateOrderSLA(Number(id), new_status);

    // TODO: Send notification to customer if notify_customer is true

    const updatedOrder = await db.get(`
      SELECT o.*, u.name as customer_name, u.email as customer_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.id = ?
    `, [id]);

    res.json({
      success: true,
      message: `Order status updated to ${STATUS_DISPLAY_NAMES[new_status]}`,
      order: updatedOrder,
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ success: false, message: 'Failed to update order status' });
  }
});

// POST /api/admin/orders/:id/notes - Add note to order
router.post('/orders/:id/notes', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { note } = req.body;
    const admin = (req as any).admin;

    if (!note || !note.trim()) {
      res.status(400).json({ success: false, message: 'Note is required' });
      return;
    }

    // Verify order exists
    const order = await db.get('SELECT id FROM orders WHERE id = ?', [id]);
    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    // Log note event
    await logOrderEvent(
      Number(id),
      'note_added',
      null,
      null,
      'admin',
      admin.id,
      admin.name || admin.email,
      note
    );

    res.json({ success: true, message: 'Note added successfully' });
  } catch (error) {
    console.error('Error adding order note:', error);
    res.status(500).json({ success: false, message: 'Failed to add note' });
  }
});

// GET /api/admin/orders/sla/breached - Get orders with breached SLA
router.get('/orders-sla/breached', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();

    // First check for new breaches
    await checkSLABreaches();

    const orders = await db.all(`
      SELECT 
        o.*,
        u.name as customer_name,
        u.email as customer_email,
        sla.sla_deadline,
        sla.breached_at,
        ROUND((julianday('now') - julianday(sla.sla_deadline)) * 24, 1) as hours_overdue
      FROM orders o
      JOIN order_sla sla ON o.id = sla.order_id
      LEFT JOIN users u ON o.user_id = u.id
      WHERE sla.is_breached = 1
      ORDER BY sla.breached_at DESC
    `);

    res.json({ success: true, orders });
  } catch (error) {
    console.error('Error fetching breached SLA orders:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch breached orders' });
  }
});

// GET /api/admin/orders/sla/at-risk - Get orders at risk of breaching SLA
router.get('/orders-sla/at-risk', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();

    const orders = await db.all(`
      SELECT 
        o.*,
        u.name as customer_name,
        u.email as customer_email,
        sla.sla_deadline,
        ROUND((julianday(sla.sla_deadline) - julianday('now')) * 24, 1) as hours_remaining
      FROM orders o
      JOIN order_sla sla ON o.id = sla.order_id
      LEFT JOIN users u ON o.user_id = u.id
      WHERE sla.is_breached = 0 
        AND sla.sla_deadline <= datetime('now', '+2 hours')
        AND sla.sla_deadline > datetime('now')
      ORDER BY sla.sla_deadline ASC
    `);

    res.json({ success: true, orders });
  } catch (error) {
    console.error('Error fetching at-risk orders:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch at-risk orders' });
  }
});

// ========================================
// USER-FACING ORDER ROUTES (Mobile App)
// ========================================

// GET /api/orders/my-orders - Get current user's orders with timeline
router.get('/my-orders', authenticateUser, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const userId = (req as any).user.id;
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereClause = 'o.user_id = ?';
    const params: any[] = [userId];

    if (status && status !== 'all') {
      whereClause += ' AND o.status = ?';
      params.push(status);
    }

    const countResult = await db.get(
      `SELECT COUNT(*) as total FROM orders o WHERE ${whereClause}`,
      params
    );

    const orders = await db.all(`
      SELECT 
        o.*,
        (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
      FROM orders o
      WHERE ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, Number(limit), offset]);

    // Get items for each order
    for (const order of orders) {
      const items = await db.all(`
        SELECT 
          oi.*,
          p.name as product_name,
          p.image_url as product_image
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
      `, [order.id]);
      order.items = items;
      order.status_display = STATUS_DISPLAY_NAMES[order.status] || order.status;
    }

    res.json({
      success: true,
      orders,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: countResult?.total || 0,
        totalPages: Math.ceil((countResult?.total || 0) / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch orders' });
  }
});

// GET /api/orders/my-orders/:id - Get single order detail for user
router.get('/my-orders/:id', authenticateUser, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const userId = (req as any).user.id;
    const { id } = req.params;

    const order = await db.get(`
      SELECT * FROM orders WHERE id = ? AND user_id = ?
    `, [id, userId]);

    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    // Get items
    const items = await db.all(`
      SELECT 
        oi.*,
        p.name as product_name,
        p.image_url as product_image,
        p.sku
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `, [id]);

    // Get timeline (filtered for customer view)
    const timeline = await db.all(`
      SELECT 
        event_type,
        new_status,
        notes,
        created_at
      FROM order_events
      WHERE order_id = ? AND event_type = 'status_change'
      ORDER BY created_at ASC
    `, [id]);

    const parsedTimeline = timeline.map(event => ({
      ...event,
      status_display: event.new_status ? STATUS_DISPLAY_NAMES[event.new_status] : null,
    }));

    // Check if can cancel
    const canCancel = ['pending', 'confirmed'].includes(order.status);

    // Check if can request refund
    const canRequestRefund = order.status === 'delivered';

    res.json({
      success: true,
      order: {
        ...order,
        status_display: STATUS_DISPLAY_NAMES[order.status] || order.status,
        items,
        timeline: parsedTimeline,
        can_cancel: canCancel,
        can_request_refund: canRequestRefund,
      },
    });
  } catch (error) {
    console.error('Error fetching order detail:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch order' });
  }
});

// POST /api/orders/:id/cancel - Cancel order (user)
router.post('/my-orders/:id/cancel', authenticateUser, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const userId = (req as any).user.id;
    const { id } = req.params;
    const { reason } = req.body;

    const order = await db.get('SELECT * FROM orders WHERE id = ? AND user_id = ?', [id, userId]);

    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    // Check if order can be cancelled
    if (!['pending', 'confirmed'].includes(order.status)) {
      res.status(400).json({
        success: false,
        message: 'Order cannot be cancelled at this stage',
      });
      return;
    }

    // Cancel order
    await db.run(
      'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['cancelled', id]
    );

    // Log event
    const user = await db.get('SELECT name FROM users WHERE id = ?', [userId]);
    await logOrderEvent(
      Number(id),
      'status_change',
      order.status,
      'cancelled',
      'user',
      userId,
      user?.name || 'Customer',
      reason || 'Cancelled by customer'
    );

    // Remove SLA tracking
    await db.run('DELETE FROM order_sla WHERE order_id = ?', [id]);

    res.json({ success: true, message: 'Order cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel order' });
  }
});

// POST /api/orders/:id/refund-request - Request refund (user)
router.post('/my-orders/:id/refund-request', authenticateUser, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const userId = (req as any).user.id;
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      res.status(400).json({ success: false, message: 'Reason is required for refund request' });
      return;
    }

    const order = await db.get('SELECT * FROM orders WHERE id = ? AND user_id = ?', [id, userId]);

    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    // Check if refund can be requested
    if (order.status !== 'delivered') {
      res.status(400).json({
        success: false,
        message: 'Refund can only be requested for delivered orders',
      });
      return;
    }

    // Update to refund requested
    await db.run(
      'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['refund_requested', id]
    );

    // Log event
    const user = await db.get('SELECT name FROM users WHERE id = ?', [userId]);
    await logOrderEvent(
      Number(id),
      'status_change',
      order.status,
      'refund_requested',
      'user',
      userId,
      user?.name || 'Customer',
      reason,
      { refund_reason: reason }
    );

    // Update SLA
    await updateOrderSLA(Number(id), 'refund_requested');

    res.json({ success: true, message: 'Refund request submitted successfully' });
  } catch (error) {
    console.error('Error requesting refund:', error);
    res.status(500).json({ success: false, message: 'Failed to submit refund request' });
  }
});

// GET /api/orders/status-options - Get available order statuses
router.get('/status-options', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  const statuses = Object.entries(STATUS_DISPLAY_NAMES).map(([key, display_name]) => ({
    value: key,
    label: display_name,
    transitions: ORDER_STATUS_TRANSITIONS[key]?.next || [],
  }));

  res.json({ success: true, statuses });
});

export default router;