import { Router, Request, Response } from 'express';
import { getDatabase } from '../config/database';
import { authenticateAdmin, authenticateUser } from '../middleware/auth';

const router = Router();

// ========================================
// REFUND CONFIGURATION
// ========================================
const REFUND_STATUSES: Record<string, { label: string; next: string[] }> = {
  pending: { label: 'Pending', next: ['approved', 'rejected'] },
  approved: { label: 'Approved', next: ['processing'] },
  processing: { label: 'Processing', next: ['completed', 'failed'] },
  completed: { label: 'Completed', next: [] },
  failed: { label: 'Failed', next: ['processing', 'rejected'] },
  rejected: { label: 'Rejected', next: [] },
};

const PAYMENT_MODES: Record<string, string> = {
  original: 'Refund to Original Payment Method',
  wallet: 'Store Credit/Wallet',
  bank_transfer: 'Bank Transfer',
  upi: 'UPI',
  cheque: 'Cheque',
};

const REFUND_REASONS: Record<string, string> = {
  return: 'Product Return',
  order_cancelled: 'Order Cancelled',
  partial_delivery: 'Partial Delivery',
  damaged_product: 'Damaged Product',
  wrong_product: 'Wrong Product Delivered',
  duplicate_payment: 'Duplicate Payment',
  overcharge: 'Overcharge',
  goodwill: 'Goodwill/Compensation',
  other: 'Other',
};

// Helper: Generate refund number
function generateRefundNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `REF-${timestamp}-${random}`;
}

// ========================================
// ADMIN REFUND ROUTES
// ========================================

// GET /api/admin/refunds - Get all refunds
router.get('/admin', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const { page = 1, limit = 20, status, reason, payment_mode, search, date_from, date_to } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereClause = '1=1';
    const params: any[] = [];

    if (status && status !== 'all') {
      whereClause += ' AND rf.status = ?';
      params.push(status);
    }

    if (reason) {
      whereClause += ' AND rf.reason = ?';
      params.push(reason);
    }

    if (payment_mode) {
      whereClause += ' AND rf.payment_mode = ?';
      params.push(payment_mode);
    }

    if (search) {
      whereClause += ' AND (rf.refund_number LIKE ? OR o.order_number LIKE ? OR u.name LIKE ? OR u.email LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (date_from) {
      whereClause += ' AND DATE(rf.created_at) >= ?';
      params.push(date_from);
    }

    if (date_to) {
      whereClause += ' AND DATE(rf.created_at) <= ?';
      params.push(date_to);
    }

    // Get count
    const countResult = await db.get(
      `SELECT COUNT(*) as total FROM refunds rf
       LEFT JOIN orders o ON rf.order_id = o.id
       LEFT JOIN users u ON o.user_id = u.id
       WHERE ${whereClause}`,
      params
    );

    // Get refunds
    const refunds = await db.all(
      `SELECT rf.*, 
              o.order_number, o.total_amount as order_total,
              u.name as customer_name, u.email as customer_email,
              r.return_number
       FROM refunds rf
       LEFT JOIN orders o ON rf.order_id = o.id
       LEFT JOIN users u ON o.user_id = u.id
       LEFT JOIN return_requests r ON rf.return_id = r.id
       WHERE ${whereClause}
       ORDER BY 
         CASE WHEN rf.status = 'pending' THEN 0 ELSE 1 END,
         rf.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );

    const formattedRefunds = refunds.map(rf => ({
      ...rf,
      reason_label: REFUND_REASONS[rf.reason] || rf.reason,
      payment_mode_label: PAYMENT_MODES[rf.payment_mode] || rf.payment_mode,
      status_label: REFUND_STATUSES[rf.status]?.label || rf.status,
    }));

    res.json({
      success: true,
      refunds: formattedRefunds,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: countResult?.total || 0,
        totalPages: Math.ceil((countResult?.total || 0) / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching refunds:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch refunds' });
  }
});

// GET /api/admin/refunds/stats - Get refund statistics
router.get('/admin/stats', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();

    const stats = await db.get(`
      SELECT 
        COUNT(*) as total_refunds,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(amount) as total_amount,
        SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as refunded_amount,
        SUM(CASE WHEN status = 'pending' OR status = 'approved' OR status = 'processing' THEN amount ELSE 0 END) as pending_amount
      FROM refunds
    `);

    const modeStats = await db.all(`
      SELECT payment_mode, COUNT(*) as count, SUM(amount) as total
      FROM refunds
      WHERE status = 'completed'
      GROUP BY payment_mode
    `);

    const todayStats = await db.get(`
      SELECT 
        COUNT(*) as created_today,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_today,
        SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as amount_today
      FROM refunds
      WHERE DATE(created_at) = DATE('now')
    `);

    res.json({
      success: true,
      stats: {
        ...stats,
        today: todayStats,
        by_payment_mode: modeStats.map(m => ({
          ...m,
          payment_mode_label: PAYMENT_MODES[m.payment_mode] || m.payment_mode,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching refund stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch refund statistics' });
  }
});

// POST /api/admin/refunds - Create/Initiate a refund
router.post('/admin', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const admin = (req as any).admin;
    const {
      order_id,
      return_id,
      amount,
      currency = 'USD',
      reason,
      payment_mode,
      notes,
    } = req.body;

    // Validate order
    const order = await db.get('SELECT id, order_number, total_amount, user_id FROM orders WHERE id = ?', [order_id]);
    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    // Validate amount
    if (!amount || amount <= 0) {
      res.status(400).json({ success: false, message: 'Invalid refund amount' });
      return;
    }

    if (amount > order.total_amount) {
      res.status(400).json({ success: false, message: 'Refund amount cannot exceed order total' });
      return;
    }

    // Check for existing pending/processing refund
    const existingRefund = await db.get(
      `SELECT id FROM refunds WHERE order_id = ? AND status IN ('pending', 'approved', 'processing')`,
      [order_id]
    );

    if (existingRefund) {
      res.status(400).json({ success: false, message: 'An active refund already exists for this order' });
      return;
    }

    // Validate reason
    if (!REFUND_REASONS[reason]) {
      res.status(400).json({ success: false, message: 'Invalid refund reason' });
      return;
    }

    // Validate payment mode
    if (!PAYMENT_MODES[payment_mode]) {
      res.status(400).json({ success: false, message: 'Invalid payment mode' });
      return;
    }

    // Create refund
    const refundNumber = generateRefundNumber();
    const result = await db.run(
      `INSERT INTO refunds (
        order_id, return_id, refund_number, amount, currency,
        reason, payment_mode, notes, status, processed_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [order_id, return_id || null, refundNumber, amount, currency, reason, payment_mode, notes, admin.id]
    );

    // Log order event
    await db.run(
      `INSERT INTO order_events (order_id, event_type, actor_type, actor_id, actor_name, notes)
       VALUES (?, 'refund_initiated', 'admin', ?, ?, ?)`,
      [order_id, admin.id, admin.email, `Refund initiated: ${refundNumber} for ${currency} ${amount}`]
    );

    // If linked to return, update return status
    if (return_id) {
      await db.run(
        `UPDATE return_requests SET status = 'refund_initiated', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [return_id]
      );
    }

    const refund = await db.get('SELECT * FROM refunds WHERE id = ?', [result.lastID]);

    res.status(201).json({
      success: true,
      message: 'Refund initiated successfully',
      refund: {
        ...refund,
        reason_label: REFUND_REASONS[reason],
        payment_mode_label: PAYMENT_MODES[payment_mode],
        status_label: REFUND_STATUSES['pending'].label,
      },
    });
  } catch (error) {
    console.error('Error creating refund:', error);
    res.status(500).json({ success: false, message: 'Failed to create refund' });
  }
});

// GET /api/admin/refunds/:id - Get single refund details
router.get('/admin/:id', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const refund = await db.get(
      `SELECT rf.*, 
              o.order_number, o.total_amount as order_total, o.items as order_items,
              u.name as customer_name, u.email as customer_email, u.phone as customer_phone,
              r.return_number, r.reason_code as return_reason,
              a.email as initiated_by_email,
              pa.email as processed_by_email
       FROM refunds rf
       LEFT JOIN orders o ON rf.order_id = o.id
       LEFT JOIN users u ON o.user_id = u.id
       LEFT JOIN return_requests r ON rf.return_id = r.id
       LEFT JOIN admins a ON rf.initiated_by = a.id
       LEFT JOIN admins pa ON rf.processed_by = pa.id
       WHERE rf.id = ?`,
      [id]
    );

    if (!refund) {
      res.status(404).json({ success: false, message: 'Refund not found' });
      return;
    }

    // Get available transitions
    const currentStatus = refund.status;
    const transitions = REFUND_STATUSES[currentStatus];
    const availableTransitions = transitions?.next.map(status => ({
      status,
      label: REFUND_STATUSES[status]?.label || status,
    })) || [];

    res.json({
      success: true,
      refund: {
        ...refund,
        reason_label: REFUND_REASONS[refund.reason] || refund.reason,
        payment_mode_label: PAYMENT_MODES[refund.payment_mode] || refund.payment_mode,
        status_label: REFUND_STATUSES[refund.status]?.label || refund.status,
        order_items: refund.order_items ? JSON.parse(refund.order_items) : [],
        available_transitions: availableTransitions,
      },
    });
  } catch (error) {
    console.error('Error fetching refund:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch refund' });
  }
});

// PUT /api/admin/refunds/:id/status - Update refund status
router.put('/admin/:id/status', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const admin = (req as any).admin;
    const { id } = req.params;
    const { new_status, transaction_id, bank_reference, notes } = req.body;

    const refund = await db.get('SELECT * FROM refunds WHERE id = ?', [id]);
    if (!refund) {
      res.status(404).json({ success: false, message: 'Refund not found' });
      return;
    }

    // Validate transition
    const currentTransitions = REFUND_STATUSES[refund.status];
    if (!currentTransitions?.next.includes(new_status)) {
      res.status(400).json({
        success: false,
        message: `Invalid status transition from '${refund.status}' to '${new_status}'`,
      });
      return;
    }

    // Update refund
    let updateQuery = 'UPDATE refunds SET status = ?, updated_at = CURRENT_TIMESTAMP';
    const updateParams: any[] = [new_status];

    if (transaction_id) {
      updateQuery += ', transaction_id = ?';
      updateParams.push(transaction_id);
    }

    if (bank_reference) {
      updateQuery += ', bank_reference = ?';
      updateParams.push(bank_reference);
    }

    if (notes) {
      updateQuery += ', notes = ?';
      updateParams.push(notes);
    }

    if (new_status === 'processing' || new_status === 'completed') {
      updateQuery += ', processed_by = ?';
      updateParams.push(admin.id);
    }

    if (new_status === 'completed') {
      updateQuery += ', processed_at = CURRENT_TIMESTAMP';
    }

    updateQuery += ' WHERE id = ?';
    updateParams.push(id);

    await db.run(updateQuery, updateParams);

    // Log order event
    await db.run(
      `INSERT INTO order_events (order_id, event_type, actor_type, actor_id, actor_name, notes)
       VALUES (?, 'refund_status_change', 'admin', ?, ?, ?)`,
      [refund.order_id, admin.id, admin.email, `Refund ${refund.refund_number} status: ${new_status}`]
    );

    // If completed and linked to return, update return
    if (new_status === 'completed' && refund.return_id) {
      await db.run(
        `UPDATE return_requests SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [refund.return_id]
      );

      await db.run(
        `UPDATE orders SET status = 'refunded', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [refund.order_id]
      );
    }

    res.json({
      success: true,
      message: `Refund status updated to ${REFUND_STATUSES[new_status]?.label || new_status}`,
    });
  } catch (error) {
    console.error('Error updating refund status:', error);
    res.status(500).json({ success: false, message: 'Failed to update refund status' });
  }
});

// PUT /api/admin/refunds/:id/process - Process refund (quick action)
router.put('/admin/:id/process', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const admin = (req as any).admin;
    const { id } = req.params;
    const { transaction_id, bank_reference, notes } = req.body;

    const refund = await db.get('SELECT * FROM refunds WHERE id = ?', [id]);
    if (!refund) {
      res.status(404).json({ success: false, message: 'Refund not found' });
      return;
    }

    if (!['pending', 'approved'].includes(refund.status)) {
      res.status(400).json({ success: false, message: 'Refund cannot be processed in current status' });
      return;
    }

    await db.run(
      `UPDATE refunds SET 
        status = 'completed',
        transaction_id = ?,
        bank_reference = ?,
        notes = ?,
        processed_by = ?,
        processed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [transaction_id, bank_reference, notes, admin.id, id]
    );

    // Log order event
    await db.run(
      `INSERT INTO order_events (order_id, event_type, actor_type, actor_id, actor_name, notes)
       VALUES (?, 'refund_completed', 'admin', ?, ?, ?)`,
      [refund.order_id, admin.id, admin.email, `Refund completed: ${refund.refund_number}`]
    );

    // Update linked return and order
    if (refund.return_id) {
      await db.run(
        `UPDATE return_requests SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [refund.return_id]
      );
    }

    await db.run(
      `UPDATE orders SET status = 'refunded', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [refund.order_id]
    );

    res.json({ success: true, message: 'Refund processed successfully' });
  } catch (error) {
    console.error('Error processing refund:', error);
    res.status(500).json({ success: false, message: 'Failed to process refund' });
  }
});

// ========================================
// USER REFUND ROUTES (Mobile App)
// ========================================

// GET /api/refunds/my-refunds - Get user's refunds
router.get('/my-refunds', authenticateUser, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const user = (req as any).user;

    const refunds = await db.all(
      `SELECT rf.*, o.order_number, o.total_amount as order_total, r.return_number
       FROM refunds rf
       LEFT JOIN orders o ON rf.order_id = o.id
       LEFT JOIN return_requests r ON rf.return_id = r.id
       WHERE o.user_id = ?
       ORDER BY rf.created_at DESC`,
      [user.id]
    );

    const formattedRefunds = refunds.map(rf => ({
      ...rf,
      reason_label: REFUND_REASONS[rf.reason] || rf.reason,
      payment_mode_label: PAYMENT_MODES[rf.payment_mode] || rf.payment_mode,
      status_label: REFUND_STATUSES[rf.status]?.label || rf.status,
    }));

    res.json({ success: true, refunds: formattedRefunds });
  } catch (error) {
    console.error('Error fetching user refunds:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch refunds' });
  }
});

// GET /api/refunds/order/:orderId - Get refund by order (User)
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

    const refund = await db.get(
      `SELECT rf.*, r.return_number
       FROM refunds rf
       LEFT JOIN return_requests r ON rf.return_id = r.id
       WHERE rf.order_id = ?`,
      [orderId]
    );

    if (!refund) {
      res.json({ success: true, refund: null });
      return;
    }

    res.json({
      success: true,
      refund: {
        ...refund,
        reason_label: REFUND_REASONS[refund.reason] || refund.reason,
        payment_mode_label: PAYMENT_MODES[refund.payment_mode] || refund.payment_mode,
        status_label: REFUND_STATUSES[refund.status]?.label || refund.status,
      },
    });
  } catch (error) {
    console.error('Error fetching order refund:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch refund' });
  }
});

// Export payment modes and reasons for frontend
router.get('/options', async (req: Request, res: Response): Promise<void> => {
  res.json({
    success: true,
    payment_modes: Object.entries(PAYMENT_MODES).map(([code, label]) => ({ code, label })),
    reasons: Object.entries(REFUND_REASONS).map(([code, label]) => ({ code, label })),
    statuses: Object.entries(REFUND_STATUSES).map(([code, info]) => ({ code, label: info.label })),
  });
});

export default router;
