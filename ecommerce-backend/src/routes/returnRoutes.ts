import { Router, Request, Response } from 'express';
import { getDatabase } from '../config/database';
import { authenticateAdmin, authenticateUser } from '../middleware/auth';

const router = Router();

// Helper: Safely parse JSON - handles both string and already-parsed objects (PostgreSQL JSONB)
function safeJsonParse(value: any, defaultValue: any = []): any {
  if (value === null || value === undefined) return defaultValue;
  if (typeof value === 'object') return value; // Already parsed (PostgreSQL JSONB)
  try {
    return JSON.parse(value);
  } catch {
    return defaultValue;
  }
}

// ========================================
// RETURN REQUEST CONFIGURATION
// ========================================
const RETURN_REASON_CODES: Record<string, { label: string; category: string }> = {
  defective: { label: 'Product Defective/Damaged', category: 'quality' },
  not_as_described: { label: 'Not as Described', category: 'quality' },
  wrong_item: { label: 'Wrong Item Received', category: 'fulfillment' },
  missing_parts: { label: 'Missing Parts/Accessories', category: 'quality' },
  quality_issue: { label: 'Quality Not Satisfactory', category: 'quality' },
  size_issue: { label: 'Size/Fit Issue', category: 'preference' },
  changed_mind: { label: 'Changed Mind', category: 'preference' },
  found_better_price: { label: 'Found Better Price', category: 'preference' },
  late_delivery: { label: 'Delivered Too Late', category: 'fulfillment' },
  other: { label: 'Other', category: 'other' },
};

const RETURN_STATUSES: Record<string, { label: string; next: string[] }> = {
  pending: { label: 'Pending Review', next: ['approved', 'rejected', 'more_info_needed'] },
  more_info_needed: { label: 'More Info Needed', next: ['pending', 'approved', 'rejected'] },
  approved: { label: 'Approved', next: ['pickup_scheduled', 'awaiting_return'] },
  rejected: { label: 'Rejected', next: [] },
  pickup_scheduled: { label: 'Pickup Scheduled', next: ['picked_up', 'pickup_failed'] },
  pickup_failed: { label: 'Pickup Failed', next: ['pickup_scheduled', 'awaiting_return'] },
  awaiting_return: { label: 'Awaiting Return', next: ['received'] },
  picked_up: { label: 'Picked Up', next: ['in_transit'] },
  in_transit: { label: 'In Transit', next: ['received'] },
  received: { label: 'Received', next: ['inspecting'] },
  inspecting: { label: 'Quality Inspection', next: ['inspection_passed', 'inspection_failed'] },
  inspection_passed: { label: 'Inspection Passed', next: ['refund_initiated', 'replacement_initiated'] },
  inspection_failed: { label: 'Inspection Failed', next: ['refund_partial', 'rejected'] },
  refund_initiated: { label: 'Refund Initiated', next: ['completed'] },
  refund_partial: { label: 'Partial Refund Initiated', next: ['completed'] },
  replacement_initiated: { label: 'Replacement Initiated', next: ['completed'] },
  completed: { label: 'Completed', next: [] },
};

const REQUESTED_ACTIONS: Record<string, string> = {
  refund: 'Full Refund',
  replacement: 'Replacement',
  exchange: 'Exchange for Different Item',
  repair: 'Repair/Fix',
};

// Helper: Generate return number
function generateReturnNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `RET-${timestamp}-${random}`;
}

// Helper: Log return event
async function logReturnEvent(
  returnId: number,
  eventType: string,
  previousStatus: string | null,
  newStatus: string | null,
  actorType: string,
  actorId: number,
  actorName: string,
  notes: string | null = null
): Promise<void> {
  const db = getDatabase();
  await db.run(
    `INSERT INTO return_events (return_id, event_type, previous_status, new_status, actor_type, actor_id, actor_name, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [returnId, eventType, previousStatus, newStatus, actorType, actorId, actorName, notes]
  );
}

// ========================================
// USER RETURN REQUEST ROUTES (Mobile App)
// ========================================

// GET /api/returns/reasons - Get return reason codes
router.get('/reasons', async (req: Request, res: Response): Promise<void> => {
  const reasons = Object.entries(RETURN_REASON_CODES).map(([code, info]) => ({
    code,
    ...info,
  }));
  res.json({ success: true, reasons });
});

// GET /api/returns/actions - Get available requested actions
router.get('/actions', async (req: Request, res: Response): Promise<void> => {
  const actions = Object.entries(REQUESTED_ACTIONS).map(([code, label]) => ({
    code,
    label,
  }));
  res.json({ success: true, actions });
});

// POST /api/returns/request - Create a return request (User)
router.post('/request', authenticateUser, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const user = (req as any).user;
    const {
      order_id,
      reason_code,
      reason_text,
      requested_action,
      items,
      images,
      pickup_address,
    } = req.body;

    // Validate order
    const order = await db.get(
      `SELECT id, order_number, status, user_id, total_amount FROM orders WHERE id = ? AND user_id = ?`,
      [order_id, user.id]
    );

    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    // Validate order status allows returns
    if (!['delivered', 'partially_delivered'].includes(order.status)) {
      res.status(400).json({
        success: false,
        message: `Cannot create return request for order with status: ${order.status}. Order must be delivered first.`,
      });
      return;
    }

    // Check if return already exists
    const existingReturn = await db.get(
      `SELECT id, status FROM return_requests WHERE order_id = ? AND status NOT IN ('rejected', 'completed')`,
      [order_id]
    );

    if (existingReturn) {
      res.status(400).json({
        success: false,
        message: 'An active return request already exists for this order',
      });
      return;
    }

    // Validate reason code
    if (!RETURN_REASON_CODES[reason_code]) {
      res.status(400).json({ success: false, message: 'Invalid reason code' });
      return;
    }

    // Validate requested action
    if (!REQUESTED_ACTIONS[requested_action]) {
      res.status(400).json({ success: false, message: 'Invalid requested action' });
      return;
    }

    // Create return request
    const returnNumber = generateReturnNumber();
    const result = await db.run(
      `INSERT INTO return_requests (
        order_id, user_id, return_number, reason_code, reason_text,
        requested_action, items, images, pickup_address, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        order_id, user.id, returnNumber, reason_code, reason_text,
        requested_action, JSON.stringify(items || []), JSON.stringify(images || []),
        pickup_address,
      ]
    );

    const returnId = result.lastID;

    // Log initial event
    await logReturnEvent(
      returnId!,
      'created',
      null,
      'pending',
      'user',
      user.id,
      user.name || user.email,
      `Return request created: ${RETURN_REASON_CODES[reason_code].label}`
    );

    // Update order status
    await db.run(
      `UPDATE orders SET status = 'return_requested', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [order_id]
    );

    // Log order event
    await db.run(
      `INSERT INTO order_events (order_id, event_type, previous_status, new_status, actor_type, actor_id, actor_name, notes)
       VALUES (?, 'status_change', 'delivered', 'return_requested', 'user', ?, ?, ?)`,
      [order_id, user.id, user.name || user.email, `Return request created: ${returnNumber}`]
    );

    const returnRequest = await db.get('SELECT * FROM return_requests WHERE id = ?', [returnId]);

    res.status(201).json({
      success: true,
      message: 'Return request submitted successfully',
      return_request: {
        ...returnRequest,
        reason_label: RETURN_REASON_CODES[reason_code].label,
        action_label: REQUESTED_ACTIONS[requested_action],
        status_label: RETURN_STATUSES['pending'].label,
      },
    });
  } catch (error) {
    console.error('Error creating return request:', error);
    res.status(500).json({ success: false, message: 'Failed to create return request' });
  }
});

// GET /api/returns/my-returns - Get user's return requests
router.get('/my-returns', authenticateUser, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const user = (req as any).user;

    const returns = await db.all(
      `SELECT r.*, o.order_number, o.total_amount as order_total
       FROM return_requests r
       LEFT JOIN orders o ON r.order_id = o.id
       WHERE r.user_id = ?
       ORDER BY r.created_at DESC`,
      [user.id]
    );

    const formattedReturns = returns.map(r => ({
      ...r,
      reason_label: RETURN_REASON_CODES[r.reason_code]?.label || r.reason_code,
      action_label: REQUESTED_ACTIONS[r.requested_action] || r.requested_action,
      status_label: RETURN_STATUSES[r.status]?.label || r.status,
      items: safeJsonParse(r.items, []),
      images: safeJsonParse(r.images, []),
    }));

    res.json({ success: true, returns: formattedReturns });
  } catch (error) {
    console.error('Error fetching user returns:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch return requests' });
  }
});

// GET /api/returns/my-returns/:id - Get single return request details (User)
router.get('/my-returns/:id', authenticateUser, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const user = (req as any).user;
    const { id } = req.params;

    const returnRequest = await db.get(
      `SELECT r.*, o.order_number, o.total_amount as order_total
       FROM return_requests r
       LEFT JOIN orders o ON r.order_id = o.id
       WHERE r.id = ? AND r.user_id = ?`,
      [id, user.id]
    );

    if (!returnRequest) {
      res.status(404).json({ success: false, message: 'Return request not found' });
      return;
    }

    // Get timeline
    const timeline = await db.all(
      `SELECT event_type, previous_status, new_status, notes, created_at
       FROM return_events
       WHERE return_id = ?
       ORDER BY created_at DESC`,
      [id]
    );

    // Get associated refund if any
    const refund = await db.get(
      `SELECT id, refund_number, amount, status, created_at FROM refunds WHERE return_id = ?`,
      [id]
    );

    // Get replacement order if any
    const replacement = await db.get(
      `SELECT ro.*, o.order_number as replacement_order_number
       FROM replacement_orders ro
       LEFT JOIN orders o ON ro.replacement_order_id = o.id
       WHERE ro.return_id = ?`,
      [id]
    );

    res.json({
      success: true,
      return_request: {
        ...returnRequest,
        reason_label: RETURN_REASON_CODES[returnRequest.reason_code]?.label || returnRequest.reason_code,
        action_label: REQUESTED_ACTIONS[returnRequest.requested_action] || returnRequest.requested_action,
        status_label: RETURN_STATUSES[returnRequest.status]?.label || returnRequest.status,
        items: safeJsonParse(returnRequest.items, []),
        images: safeJsonParse(returnRequest.images, []),
        timeline: timeline.map(e => ({
          ...e,
          new_status_label: RETURN_STATUSES[e.new_status]?.label || e.new_status,
        })),
        refund,
        replacement,
      },
    });
  } catch (error) {
    console.error('Error fetching return request:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch return request' });
  }
});

// ========================================
// ADMIN RETURN REQUEST ROUTES
// ========================================

// GET /api/admin/returns - Get all return requests
router.get('/admin', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const { page = 1, limit = 20, status, reason, action, search, date_from, date_to } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereClause = '1=1';
    const params: any[] = [];

    if (status && status !== 'all') {
      whereClause += ' AND r.status = ?';
      params.push(status);
    }

    if (reason) {
      whereClause += ' AND r.reason_code = ?';
      params.push(reason);
    }

    if (action) {
      whereClause += ' AND r.requested_action = ?';
      params.push(action);
    }

    if (search) {
      whereClause += ' AND (r.return_number LIKE ? OR o.order_number LIKE ? OR u.name LIKE ? OR u.email LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (date_from) {
      whereClause += ' AND DATE(r.created_at) >= ?';
      params.push(date_from);
    }

    if (date_to) {
      whereClause += ' AND DATE(r.created_at) <= ?';
      params.push(date_to);
    }

    // Get count
    const countResult = await db.get(
      `SELECT COUNT(*) as total FROM return_requests r
       LEFT JOIN orders o ON r.order_id = o.id
       LEFT JOIN users u ON r.user_id = u.id
       WHERE ${whereClause}`,
      params
    );

    // Get returns
    const returns = await db.all(
      `SELECT r.*, 
              o.order_number, o.total_amount as order_total,
              u.name as customer_name, u.email as customer_email
       FROM return_requests r
       LEFT JOIN orders o ON r.order_id = o.id
       LEFT JOIN users u ON r.user_id = u.id
       WHERE ${whereClause}
       ORDER BY 
         CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END,
         r.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );

    const formattedReturns = returns.map(r => ({
      ...r,
      reason_label: RETURN_REASON_CODES[r.reason_code]?.label || r.reason_code,
      action_label: REQUESTED_ACTIONS[r.requested_action] || r.requested_action,
      status_label: RETURN_STATUSES[r.status]?.label || r.status,
      items: safeJsonParse(r.items, []),
      images: safeJsonParse(r.images, []),
    }));

    res.json({
      success: true,
      returns: formattedReturns,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: countResult?.total || 0,
        totalPages: Math.ceil((countResult?.total || 0) / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching returns:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch return requests' });
  }
});

// GET /api/admin/returns/stats - Get return statistics
router.get('/admin/stats', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();

    const stats = await db.get(`
      SELECT 
        COUNT(*) as total_returns,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN status IN ('inspecting', 'received', 'in_transit', 'picked_up') THEN 1 ELSE 0 END) as in_process,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN requested_action = 'refund' THEN 1 ELSE 0 END) as refund_requests,
        SUM(CASE WHEN requested_action = 'replacement' THEN 1 ELSE 0 END) as replacement_requests
      FROM return_requests
    `);

    const reasonStats = await db.all(`
      SELECT reason_code, COUNT(*) as count
      FROM return_requests
      GROUP BY reason_code
      ORDER BY count DESC
    `);

    const todayStats = await db.get(`
      SELECT 
        COUNT(*) as created_today,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_today,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_today
      FROM return_requests
      WHERE DATE(created_at) = DATE('now')
    `);

    res.json({
      success: true,
      stats: {
        ...stats,
        today: todayStats,
        by_reason: reasonStats.map(r => ({
          ...r,
          reason_label: RETURN_REASON_CODES[r.reason_code]?.label || r.reason_code,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching return stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch return statistics' });
  }
});

// GET /api/admin/returns/:id - Get single return request details
router.get('/admin/:id', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const returnRequest = await db.get(
      `SELECT r.*, 
              o.order_number, o.total_amount as order_total,
              o.delivery_address, o.city, o.postal_code,
              u.name as customer_name, u.email as customer_email, u.phone as customer_phone
       FROM return_requests r
       LEFT JOIN orders o ON r.order_id = o.id
       LEFT JOIN users u ON r.user_id = u.id
       WHERE r.id = ?`,
      [id]
    );

    if (!returnRequest) {
      res.status(404).json({ success: false, message: 'Return request not found' });
      return;
    }

    // Get order items separately (since they're in a separate table)
    let orderItems: any[] = [];
    try {
      orderItems = await db.all(
        `SELECT oi.*, p.name as product_name, p.sku, p.image_url
         FROM order_items oi
         LEFT JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ?`,
        [returnRequest.order_id]
      );
    } catch (orderItemsError) {
      console.log('Could not fetch order items:', orderItemsError);
    }

    // Get timeline
    const timeline = await db.all(
      `SELECT * FROM return_events WHERE return_id = ? ORDER BY created_at DESC`,
      [id]
    );

    // Get refund if any
    let refund = null;
    try {
      refund = await db.get(
        `SELECT * FROM refunds WHERE return_id = ?`,
        [id]
      );
    } catch (refundError) {
      console.log('Could not fetch refund:', refundError);
    }

    // Get replacement order if any
    let replacement = null;
    try {
      replacement = await db.get(
        `SELECT ro.*, o.order_number as replacement_order_number
         FROM replacement_orders ro
         LEFT JOIN orders o ON ro.replacement_order_id = o.id
         WHERE ro.return_id = ?`,
        [id]
      );
    } catch (replacementError) {
      console.log('Could not fetch replacement:', replacementError);
    }

    // Get available transitions
    const currentStatus = returnRequest.status;
    const transitions = RETURN_STATUSES[currentStatus];
    const availableTransitions = transitions?.next.map(status => ({
      status,
      label: RETURN_STATUSES[status]?.label || status,
    })) || [];

    res.json({
      success: true,
      return_request: {
        ...returnRequest,
        reason_label: RETURN_REASON_CODES[returnRequest.reason_code]?.label || returnRequest.reason_code,
        action_label: REQUESTED_ACTIONS[returnRequest.requested_action] || returnRequest.requested_action,
        status_label: RETURN_STATUSES[returnRequest.status]?.label || returnRequest.status,
        items: safeJsonParse(returnRequest.items, []),
        images: safeJsonParse(returnRequest.images, []),
        order_items: orderItems,
        timeline,
        refund,
        replacement,
        available_transitions: availableTransitions,
      },
    });
  } catch (error) {
    console.error('Error fetching return request:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch return request' });
  }
});

// PUT /api/admin/returns/:id/status - Update return request status
router.put('/admin/:id/status', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const admin = (req as any).admin;
    const { id } = req.params;
    const { new_status, notes, pickup_scheduled, pickup_carrier } = req.body;

    const returnRequest = await db.get('SELECT * FROM return_requests WHERE id = ?', [id]);
    if (!returnRequest) {
      res.status(404).json({ success: false, message: 'Return request not found' });
      return;
    }

    // Validate transition
    const currentTransitions = RETURN_STATUSES[returnRequest.status];
    if (!currentTransitions?.next.includes(new_status)) {
      res.status(400).json({
        success: false,
        message: `Invalid status transition from '${returnRequest.status}' to '${new_status}'`,
      });
      return;
    }

    // Update return request
    let updateQuery = 'UPDATE return_requests SET status = ?, updated_at = CURRENT_TIMESTAMP';
    const updateParams: any[] = [new_status];

    if (notes) {
      updateQuery += ', admin_notes = ?';
      updateParams.push(notes);
    }

    if (pickup_scheduled) {
      updateQuery += ', pickup_scheduled = ?';
      updateParams.push(pickup_scheduled);
    }

    if (pickup_carrier) {
      updateQuery += ', pickup_carrier = ?';
      updateParams.push(pickup_carrier);
    }

    if (new_status === 'approved') {
      updateQuery += ', approved_at = CURRENT_TIMESTAMP, approved_by = ?';
      updateParams.push(admin.id);
    }

    if (new_status === 'completed') {
      updateQuery += ', completed_at = CURRENT_TIMESTAMP';
    }

    updateQuery += ' WHERE id = ?';
    updateParams.push(id);

    await db.run(updateQuery, updateParams);

    // Log return event
    await logReturnEvent(
      Number(id),
      'status_change',
      returnRequest.status,
      new_status,
      'admin',
      admin.id,
      admin.email,
      notes
    );

    // Update order status based on return status
    if (new_status === 'completed') {
      await db.run(
        `UPDATE orders SET status = 'return_completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [returnRequest.order_id]
      );
    } else if (new_status === 'rejected') {
      await db.run(
        `UPDATE orders SET status = 'delivered', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [returnRequest.order_id]
      );
    }

    res.json({
      success: true,
      message: `Return request status updated to ${RETURN_STATUSES[new_status]?.label || new_status}`,
    });
  } catch (error) {
    console.error('Error updating return status:', error);
    res.status(500).json({ success: false, message: 'Failed to update return status' });
  }
});

// PUT /api/admin/returns/:id/approve - Quick approve return
router.put('/admin/:id/approve', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const admin = (req as any).admin;
    const { id } = req.params;
    const { notes, pickup_scheduled, pickup_carrier } = req.body;

    const returnRequest = await db.get('SELECT * FROM return_requests WHERE id = ?', [id]);
    if (!returnRequest) {
      res.status(404).json({ success: false, message: 'Return request not found' });
      return;
    }

    if (returnRequest.status !== 'pending' && returnRequest.status !== 'more_info_needed') {
      res.status(400).json({ success: false, message: 'Return request cannot be approved in current status' });
      return;
    }

    await db.run(
      `UPDATE return_requests SET 
        status = 'approved',
        processed_at = CURRENT_TIMESTAMP,
        processed_by = ?,
        admin_notes = ?,
        pickup_scheduled = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [admin.id, notes, pickup_scheduled, id]
    );

    await logReturnEvent(
      Number(id),
      'approved',
      returnRequest.status,
      'approved',
      'admin',
      admin.id,
      admin.email,
      notes || 'Return request approved'
    );

    res.json({ success: true, message: 'Return request approved successfully' });
  } catch (error) {
    console.error('Error approving return:', error);
    res.status(500).json({ success: false, message: 'Failed to approve return request' });
  }
});

// PUT /api/admin/returns/:id/reject - Quick reject return
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

    const returnRequest = await db.get('SELECT * FROM return_requests WHERE id = ?', [id]);
    if (!returnRequest) {
      res.status(404).json({ success: false, message: 'Return request not found' });
      return;
    }

    if (!['pending', 'more_info_needed', 'inspection_failed'].includes(returnRequest.status)) {
      res.status(400).json({ success: false, message: 'Return request cannot be rejected in current status' });
      return;
    }

    await db.run(
      `UPDATE return_requests SET 
        status = 'rejected',
        admin_notes = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [notes, id]
    );

    await logReturnEvent(
      Number(id),
      'rejected',
      returnRequest.status,
      'rejected',
      'admin',
      admin.id,
      admin.email,
      notes
    );

    // Restore order status
    await db.run(
      `UPDATE orders SET status = 'delivered', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [returnRequest.order_id]
    );

    res.json({ success: true, message: 'Return request rejected' });
  } catch (error) {
    console.error('Error rejecting return:', error);
    res.status(500).json({ success: false, message: 'Failed to reject return request' });
  }
});

export default router;
