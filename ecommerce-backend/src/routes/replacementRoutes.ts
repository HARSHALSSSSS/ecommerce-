import { Router, Request, Response } from 'express';
import { getDatabase } from '../config/database';
import { authenticateAdmin, authenticateUser } from '../middleware/auth';

const router = Router();

// ========================================
// REPLACEMENT ORDER CONFIGURATION
// ========================================
const REPLACEMENT_STATUSES: Record<string, { label: string; next: string[] }> = {
  pending: { label: 'Pending Approval', next: ['approved', 'rejected'] },
  approved: { label: 'Approved', next: ['processing'] },
  processing: { label: 'Processing', next: ['shipped'] },
  shipped: { label: 'Shipped', next: ['delivered'] },
  delivered: { label: 'Delivered', next: ['completed'] },
  completed: { label: 'Completed', next: [] },
  rejected: { label: 'Rejected', next: [] },
  cancelled: { label: 'Cancelled', next: [] },
};

const REPLACEMENT_REASONS: Record<string, string> = {
  defective: 'Defective Product',
  wrong_item: 'Wrong Item Received',
  damaged_shipping: 'Damaged in Shipping',
  missing_parts: 'Missing Parts',
  quality_issue: 'Quality Issue',
  size_exchange: 'Size/Color Exchange',
  warranty: 'Warranty Replacement',
  other: 'Other',
};

// Helper: Generate replacement number
function generateReplacementNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `RPL-${timestamp}-${random}`;
}

// Helper: Generate order number
function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${timestamp}-${random}`;
}

// ========================================
// ADMIN REPLACEMENT ROUTES
// ========================================

// GET /api/admin/replacements - Get all replacements
router.get('/admin', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const { page = 1, limit = 20, status, reason, search, date_from, date_to } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereClause = '1=1';
    const params: any[] = [];

    if (status && status !== 'all') {
      whereClause += ' AND rp.status = ?';
      params.push(status);
    }

    if (reason) {
      whereClause += ' AND rp.reason = ?';
      params.push(reason);
    }

    if (search) {
      whereClause += ' AND (rp.replacement_number LIKE ? OR oo.order_number LIKE ? OR ro.order_number LIKE ? OR u.name LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (date_from) {
      whereClause += ' AND DATE(rp.created_at) >= ?';
      params.push(date_from);
    }

    if (date_to) {
      whereClause += ' AND DATE(rp.created_at) <= ?';
      params.push(date_to);
    }

    // Get count
    const countResult = await db.get(
      `SELECT COUNT(*) as total FROM replacement_orders rp
       LEFT JOIN orders oo ON rp.original_order_id = oo.id
       LEFT JOIN orders ro ON rp.replacement_order_id = ro.id
       LEFT JOIN users u ON oo.user_id = u.id
       WHERE ${whereClause}`,
      params
    );

    // Get replacements
    const replacements = await db.all(
      `SELECT rp.*, 
              oo.order_number as original_order_number, oo.total_amount as original_order_total,
              ro.order_number as replacement_order_number, ro.status as replacement_order_status,
              u.name as customer_name, u.email as customer_email,
              ret.return_number
       FROM replacement_orders rp
       LEFT JOIN orders oo ON rp.original_order_id = oo.id
       LEFT JOIN orders ro ON rp.replacement_order_id = ro.id
       LEFT JOIN users u ON oo.user_id = u.id
       LEFT JOIN return_requests ret ON rp.return_id = ret.id
       WHERE ${whereClause}
       ORDER BY 
         CASE WHEN rp.status = 'pending' THEN 0 ELSE 1 END,
         rp.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );

    const formattedReplacements = replacements.map(rp => ({
      ...rp,
      reason_label: REPLACEMENT_REASONS[rp.reason] || rp.reason,
      status_label: REPLACEMENT_STATUSES[rp.status]?.label || rp.status,
      items: rp.items ? JSON.parse(rp.items) : [],
    }));

    res.json({
      success: true,
      replacements: formattedReplacements,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: countResult?.total || 0,
        totalPages: Math.ceil((countResult?.total || 0) / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching replacements:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch replacements' });
  }
});

// GET /api/admin/replacements/stats - Get replacement statistics
router.get('/admin/stats', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();

    const stats = await db.get(`
      SELECT 
        COUNT(*) as total_replacements,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
        SUM(CASE WHEN status IN ('shipped', 'delivered') THEN 1 ELSE 0 END) as in_transit,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
      FROM replacement_orders
    `);

    const reasonStats = await db.all(`
      SELECT reason, COUNT(*) as count
      FROM replacement_orders
      GROUP BY reason
      ORDER BY count DESC
    `);

    const todayStats = await db.get(`
      SELECT 
        COUNT(*) as created_today,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_today,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_today
      FROM replacement_orders
      WHERE DATE(created_at) = DATE('now')
    `);

    res.json({
      success: true,
      stats: {
        ...stats,
        today: todayStats,
        by_reason: reasonStats.map(r => ({
          ...r,
          reason_label: REPLACEMENT_REASONS[r.reason] || r.reason,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching replacement stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch replacement statistics' });
  }
});

// POST /api/admin/replacements - Create replacement order
router.post('/admin', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const admin = (req as any).admin;
    const {
      original_order_id,
      return_id,
      reason,
      items,
      notes,
      auto_approve = false,
    } = req.body;

    // Validate original order
    const originalOrder = await db.get(
      `SELECT o.*, u.name as customer_name, u.email as customer_email
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       WHERE o.id = ?`,
      [original_order_id]
    );

    if (!originalOrder) {
      res.status(404).json({ success: false, message: 'Original order not found' });
      return;
    }

    // Check if replacement already exists
    const existingReplacement = await db.get(
      `SELECT id FROM replacement_orders WHERE original_order_id = ? AND status NOT IN ('rejected', 'cancelled', 'completed')`,
      [original_order_id]
    );

    if (existingReplacement) {
      res.status(400).json({ success: false, message: 'An active replacement already exists for this order' });
      return;
    }

    // Validate reason
    if (!REPLACEMENT_REASONS[reason]) {
      res.status(400).json({ success: false, message: 'Invalid replacement reason' });
      return;
    }

    // Calculate items to replace (use original order items if not specified)
    const replacementItems = items || JSON.parse(originalOrder.items || '[]');

    // Create replacement number
    const replacementNumber = generateReplacementNumber();
    const initialStatus = auto_approve ? 'approved' : 'pending';

    // Create the replacement order entry (without creating new order yet)
    const result = await db.run(
      `INSERT INTO replacement_orders (
        original_order_id, return_id, replacement_number, reason, status, items, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        original_order_id, return_id || null, replacementNumber, reason,
        initialStatus, JSON.stringify(replacementItems), notes, admin.id
      ]
    );

    const replacementId = result.lastID;

    // Log order event
    await db.run(
      `INSERT INTO order_events (order_id, event_type, actor_type, actor_id, actor_name, notes)
       VALUES (?, 'replacement_created', 'admin', ?, ?, ?)`,
      [original_order_id, admin.id, admin.email, `Replacement order created: ${replacementNumber}`]
    );

    // If linked to return, update return status
    if (return_id) {
      await db.run(
        `UPDATE return_requests SET status = 'replacement_initiated', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [return_id]
      );
    }

    // Update original order status
    await db.run(
      `UPDATE orders SET status = 'replacement_initiated', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [original_order_id]
    );

    const replacement = await db.get('SELECT * FROM replacement_orders WHERE id = ?', [replacementId]);

    res.status(201).json({
      success: true,
      message: 'Replacement order created successfully',
      replacement: {
        ...replacement,
        reason_label: REPLACEMENT_REASONS[reason],
        status_label: REPLACEMENT_STATUSES[initialStatus].label,
        items: replacementItems,
        original_order: {
          id: originalOrder.id,
          order_number: originalOrder.order_number,
          total_amount: originalOrder.total_amount,
          customer_name: originalOrder.customer_name,
          customer_email: originalOrder.customer_email,
        },
      },
    });
  } catch (error) {
    console.error('Error creating replacement:', error);
    res.status(500).json({ success: false, message: 'Failed to create replacement order' });
  }
});

// GET /api/admin/replacements/:id - Get single replacement details
router.get('/admin/:id', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const replacement = await db.get(
      `SELECT rp.*, 
              oo.order_number as original_order_number, oo.total_amount as original_order_total,
              oo.items as original_items, oo.delivery_address, oo.city, oo.postal_code,
              ro.order_number as replacement_order_number, ro.status as replacement_order_status,
              u.name as customer_name, u.email as customer_email, u.phone as customer_phone,
              ret.return_number, ret.reason_code as return_reason,
              a.email as created_by_email, aa.email as approved_by_email
       FROM replacement_orders rp
       LEFT JOIN orders oo ON rp.original_order_id = oo.id
       LEFT JOIN orders ro ON rp.replacement_order_id = ro.id
       LEFT JOIN users u ON oo.user_id = u.id
       LEFT JOIN return_requests ret ON rp.return_id = ret.id
       LEFT JOIN admins a ON rp.created_by = a.id
       LEFT JOIN admins aa ON rp.approved_by = aa.id
       WHERE rp.id = ?`,
      [id]
    );

    if (!replacement) {
      res.status(404).json({ success: false, message: 'Replacement order not found' });
      return;
    }

    // Get replacement order's shipment if exists
    let replacementShipment = null;
    if (replacement.replacement_order_id) {
      replacementShipment = await db.get(
        `SELECT s.*, 
                (SELECT COUNT(*) FROM shipment_events WHERE shipment_id = s.id) as event_count
         FROM shipments s WHERE s.order_id = ?`,
        [replacement.replacement_order_id]
      );
    }

    // Get available transitions
    const currentStatus = replacement.status;
    const transitions = REPLACEMENT_STATUSES[currentStatus];
    const availableTransitions = transitions?.next.map(status => ({
      status,
      label: REPLACEMENT_STATUSES[status]?.label || status,
    })) || [];

    res.json({
      success: true,
      replacement: {
        ...replacement,
        reason_label: REPLACEMENT_REASONS[replacement.reason] || replacement.reason,
        status_label: REPLACEMENT_STATUSES[replacement.status]?.label || replacement.status,
        items: replacement.items ? JSON.parse(replacement.items) : [],
        original_items: replacement.original_items ? JSON.parse(replacement.original_items) : [],
        replacement_shipment: replacementShipment,
        available_transitions: availableTransitions,
      },
    });
  } catch (error) {
    console.error('Error fetching replacement:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch replacement order' });
  }
});

// PUT /api/admin/replacements/:id/approve - Approve replacement
router.put('/admin/:id/approve', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const admin = (req as any).admin;
    const { id } = req.params;
    const { notes, create_order = true } = req.body;

    const replacement = await db.get(
      `SELECT rp.*, oo.user_id, oo.delivery_address, oo.city, oo.postal_code, oo.phone
       FROM replacement_orders rp
       LEFT JOIN orders oo ON rp.original_order_id = oo.id
       WHERE rp.id = ?`,
      [id]
    );

    if (!replacement) {
      res.status(404).json({ success: false, message: 'Replacement order not found' });
      return;
    }

    if (replacement.status !== 'pending') {
      res.status(400).json({ success: false, message: 'Replacement is not in pending status' });
      return;
    }

    let replacementOrderId = null;
    let replacementOrderNumber = null;

    // Create the actual replacement order if requested
    if (create_order) {
      replacementOrderNumber = generateOrderNumber();
      const items = JSON.parse(replacement.items || '[]');
      const totalAmount = items.reduce((sum: number, item: any) => sum + (item.price * (item.quantity || 1)), 0);

      const orderResult = await db.run(
        `INSERT INTO orders (
          user_id, order_number, items, total_amount, status,
          delivery_address, city, postal_code, phone, notes
        ) VALUES (?, ?, ?, ?, 'processing', ?, ?, ?, ?, ?)`,
        [
          replacement.user_id, replacementOrderNumber, replacement.items, totalAmount,
          replacement.delivery_address, replacement.city, replacement.postal_code,
          replacement.phone, `Replacement for order (Original replacement: ${replacement.replacement_number})`
        ]
      );

      replacementOrderId = orderResult.lastID;

      // Log event on new order
      await db.run(
        `INSERT INTO order_events (order_id, event_type, actor_type, actor_id, actor_name, notes)
         VALUES (?, 'created', 'admin', ?, ?, ?)`,
        [replacementOrderId, admin.id, admin.email, `Replacement order created from ${replacement.replacement_number}`]
      );
    }

    // Update replacement
    await db.run(
      `UPDATE replacement_orders SET 
        status = 'approved',
        replacement_order_id = ?,
        approved_by = ?,
        approved_at = CURRENT_TIMESTAMP,
        notes = COALESCE(?, notes),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [replacementOrderId, admin.id, notes, id]
    );

    // Update linked return
    if (replacement.return_id) {
      await db.run(
        `UPDATE return_requests SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [replacement.return_id]
      );
    }

    res.json({
      success: true,
      message: 'Replacement approved successfully',
      replacement_order_id: replacementOrderId,
      replacement_order_number: replacementOrderNumber,
    });
  } catch (error) {
    console.error('Error approving replacement:', error);
    res.status(500).json({ success: false, message: 'Failed to approve replacement' });
  }
});

// PUT /api/admin/replacements/:id/reject - Reject replacement
router.put('/admin/:id/reject', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const admin = (req as any).admin;
    const { id } = req.params;
    const { notes } = req.body;

    if (!notes) {
      res.status(400).json({ success: false, message: 'Rejection reason is required' });
      return;
    }

    const replacement = await db.get('SELECT * FROM replacement_orders WHERE id = ?', [id]);
    if (!replacement) {
      res.status(404).json({ success: false, message: 'Replacement order not found' });
      return;
    }

    if (replacement.status !== 'pending') {
      res.status(400).json({ success: false, message: 'Replacement is not in pending status' });
      return;
    }

    await db.run(
      `UPDATE replacement_orders SET 
        status = 'rejected',
        notes = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [notes, id]
    );

    // Log order event
    await db.run(
      `INSERT INTO order_events (order_id, event_type, actor_type, actor_id, actor_name, notes)
       VALUES (?, 'replacement_rejected', 'admin', ?, ?, ?)`,
      [replacement.original_order_id, admin.id, admin.email, `Replacement rejected: ${notes}`]
    );

    res.json({ success: true, message: 'Replacement rejected' });
  } catch (error) {
    console.error('Error rejecting replacement:', error);
    res.status(500).json({ success: false, message: 'Failed to reject replacement' });
  }
});

// PUT /api/admin/replacements/:id/status - Update replacement status
router.put('/admin/:id/status', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const admin = (req as any).admin;
    const { id } = req.params;
    const { new_status, notes } = req.body;

    const replacement = await db.get('SELECT * FROM replacement_orders WHERE id = ?', [id]);
    if (!replacement) {
      res.status(404).json({ success: false, message: 'Replacement order not found' });
      return;
    }

    // Validate transition
    const currentTransitions = REPLACEMENT_STATUSES[replacement.status];
    if (!currentTransitions?.next.includes(new_status)) {
      res.status(400).json({
        success: false,
        message: `Invalid status transition from '${replacement.status}' to '${new_status}'`,
      });
      return;
    }

    await db.run(
      `UPDATE replacement_orders SET 
        status = ?,
        notes = COALESCE(?, notes),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [new_status, notes, id]
    );

    // Sync replacement order status if exists
    if (replacement.replacement_order_id) {
      let orderStatus = null;
      if (new_status === 'processing') orderStatus = 'processing';
      else if (new_status === 'shipped') orderStatus = 'shipped';
      else if (new_status === 'delivered') orderStatus = 'delivered';
      else if (new_status === 'completed') orderStatus = 'delivered';

      if (orderStatus) {
        await db.run(
          `UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [orderStatus, replacement.replacement_order_id]
        );
      }
    }

    res.json({
      success: true,
      message: `Replacement status updated to ${REPLACEMENT_STATUSES[new_status]?.label || new_status}`,
    });
  } catch (error) {
    console.error('Error updating replacement status:', error);
    res.status(500).json({ success: false, message: 'Failed to update replacement status' });
  }
});

// ========================================
// USER REPLACEMENT ROUTES (Mobile App)
// ========================================

// GET /api/replacements/my-replacements - Get user's replacements
router.get('/my-replacements', authenticateUser, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const user = (req as any).user;

    const replacements = await db.all(
      `SELECT rp.*, 
              oo.order_number as original_order_number, oo.total_amount as original_order_total,
              ro.order_number as replacement_order_number, ro.status as replacement_order_status
       FROM replacement_orders rp
       LEFT JOIN orders oo ON rp.original_order_id = oo.id
       LEFT JOIN orders ro ON rp.replacement_order_id = ro.id
       WHERE oo.user_id = ?
       ORDER BY rp.created_at DESC`,
      [user.id]
    );

    const formattedReplacements = replacements.map(rp => ({
      ...rp,
      reason_label: REPLACEMENT_REASONS[rp.reason] || rp.reason,
      status_label: REPLACEMENT_STATUSES[rp.status]?.label || rp.status,
      items: rp.items ? JSON.parse(rp.items) : [],
    }));

    res.json({ success: true, replacements: formattedReplacements });
  } catch (error) {
    console.error('Error fetching user replacements:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch replacements' });
  }
});

// GET /api/replacements/order/:orderId - Get replacement by original order (User)
router.get('/order/:orderId', authenticateUser, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const user = (req as any).user;
    const { orderId } = req.params;

    // Verify order belongs to user
    const order = await db.get(
      'SELECT id FROM orders WHERE id = ? AND user_id = ?',
      [orderId, user.id]
    );

    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    const replacement = await db.get(
      `SELECT rp.*, ro.order_number as replacement_order_number, ro.status as replacement_order_status
       FROM replacement_orders rp
       LEFT JOIN orders ro ON rp.replacement_order_id = ro.id
       WHERE rp.original_order_id = ?`,
      [orderId]
    );

    if (!replacement) {
      res.json({ success: true, replacement: null });
      return;
    }

    res.json({
      success: true,
      replacement: {
        ...replacement,
        reason_label: REPLACEMENT_REASONS[replacement.reason] || replacement.reason,
        status_label: REPLACEMENT_STATUSES[replacement.status]?.label || replacement.status,
        items: replacement.items ? JSON.parse(replacement.items) : [],
      },
    });
  } catch (error) {
    console.error('Error fetching order replacement:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch replacement' });
  }
});

// Export reasons for frontend
router.get('/options', async (req: Request, res: Response): Promise<void> => {
  res.json({
    success: true,
    reasons: Object.entries(REPLACEMENT_REASONS).map(([code, label]) => ({ code, label })),
    statuses: Object.entries(REPLACEMENT_STATUSES).map(([code, info]) => ({ code, label: info.label })),
  });
});

export default router;
