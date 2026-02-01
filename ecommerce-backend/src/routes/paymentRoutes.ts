import { Router } from 'express';
import { authenticateAdmin, authenticateUser } from '../middleware/auth';
import { getDatabase } from '../config/database';

const router = Router();

// Generate unique transaction ID
function generateTransactionId(): string {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 10);
  return `TXN-${timestamp}-${randomStr}`.toUpperCase();
}

// ==================== ADMIN ROUTES ====================

// Get all payments (admin)
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const { 
      page = 1, 
      limit = 20, 
      status, 
      payment_method,
      start_date,
      end_date,
      search 
    } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = `
      SELECT p.*, 
             o.order_number,
             u.name as customer_name, 
             u.email as customer_email
      FROM payments p
      LEFT JOIN orders o ON p.order_id = o.id
      LEFT JOIN users u ON p.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status && status !== 'all') {
      query += ' AND p.status = ?';
      params.push(status);
    }

    if (payment_method && payment_method !== 'all') {
      query += ' AND p.payment_method = ?';
      params.push(payment_method);
    }

    if (start_date) {
      query += ' AND DATE(p.created_at) >= DATE(?)';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND DATE(p.created_at) <= DATE(?)';
      params.push(end_date);
    }

    if (search) {
      query += ' AND (p.transaction_id LIKE ? OR o.order_number LIKE ? OR u.name LIKE ? OR u.email LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Get total count
    const countQuery = query.replace(
      'SELECT p.*, o.order_number, u.name as customer_name, u.email as customer_email',
      'SELECT COUNT(*) as total'
    );
    const countResult = await db.get(countQuery, params);

    // Get paginated payments
    query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), offset);

    const payments = await db.all(query, params);

    // Get payment stats
    const stats = await db.get(`
      SELECT 
        COUNT(*) as total_count,
        SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as total_completed,
        SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as total_pending,
        SUM(CASE WHEN status = 'failed' THEN amount ELSE 0 END) as total_failed,
        SUM(CASE WHEN status = 'refunded' THEN amount ELSE 0 END) as total_refunded,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
        COUNT(CASE WHEN status = 'refunded' THEN 1 END) as refunded_count
      FROM payments
    `);

    res.json({
      success: true,
      payments,
      stats,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: countResult?.total || 0,
        totalPages: Math.ceil((countResult?.total || 0) / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get single payment (admin)
router.get('/:id', authenticateAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const payment = await db.get(
      `SELECT p.*, 
              o.order_number, o.status as order_status, o.total_amount as order_total,
              u.name as customer_name, u.email as customer_email, u.phone as customer_phone
       FROM payments p
       LEFT JOIN orders o ON p.order_id = o.id
       LEFT JOIN users u ON p.user_id = u.id
       WHERE p.id = ?`,
      [req.params.id]
    );

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    // Get related invoice if exists (wrapped in try-catch to handle missing table)
    let invoice = null;
    try {
      invoice = await db.get(
        'SELECT id, invoice_number, status FROM invoices WHERE payment_id = ?',
        [payment.id]
      );
    } catch (invoiceError) {
      console.log('Invoice query failed (table may not exist):', invoiceError);
    }

    // Calculate available status transitions based on current status and payment method
    let availableTransitions: { status: string; display_name: string }[] = [];
    const isCOD = payment.payment_method === 'cash_on_delivery' || payment.payment_method === 'cod' || payment.payment_method === 'COD';
    
    if (payment.status === 'pending') {
      if (isCOD) {
        // COD payments can be marked as completed when cash is collected
        availableTransitions = [
          { status: 'completed', display_name: 'Mark Payment Received (COD)' },
          { status: 'cancelled', display_name: 'Cancel Payment' },
        ];
      } else {
        availableTransitions = [
          { status: 'processing', display_name: 'Mark as Processing' },
          { status: 'completed', display_name: 'Mark as Completed' },
          { status: 'failed', display_name: 'Mark as Failed' },
          { status: 'cancelled', display_name: 'Cancel Payment' },
        ];
      }
    } else if (payment.status === 'processing') {
      availableTransitions = [
        { status: 'completed', display_name: 'Mark as Completed' },
        { status: 'failed', display_name: 'Mark as Failed' },
      ];
    } else if (payment.status === 'completed') {
      availableTransitions = [
        { status: 'refunded', display_name: 'Process Refund' },
      ];
    } else if (payment.status === 'failed') {
      availableTransitions = [
        { status: 'pending', display_name: 'Retry Payment' },
      ];
    }

    res.json({ 
      success: true, 
      payment: {
        ...payment,
        invoice,
        available_transitions: availableTransitions,
      }
    });
  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update payment status (admin) - for manual adjustments
router.patch('/:id/status', authenticateAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const { status, notes } = req.body;
    const { id } = req.params;

    const payment = await db.get('SELECT * FROM payments WHERE id = ?', [id]);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    const validStatuses = ['pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const processedAt = status === 'completed' ? new Date().toISOString() : payment.processed_at;

    // Simple update without json_set for better PostgreSQL compatibility
    await db.run(
      `UPDATE payments 
       SET status = ?, processed_at = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, processedAt, id]
    );

    // If payment is completed, automatically generate invoice
    if (status === 'completed' && payment.status !== 'completed') {
      // Check if invoice already exists for this payment
      const existingInvoice = await db.get(
        'SELECT id FROM invoices WHERE payment_id = ? OR order_id = ?',
        [id, payment.order_id]
      );

      if (!existingInvoice) {
        // Get order details for invoice
        const order = await db.get(
          `SELECT o.*, u.name as customer_name, u.email as customer_email, u.phone as customer_phone
           FROM orders o
           LEFT JOIN users u ON o.user_id = u.id
           WHERE o.id = ?`,
          [payment.order_id]
        );

        if (order) {
          // Generate invoice number
          const invoiceNumber = `INV-${Date.now()}-${payment.order_id}`;
          const subtotal = order.total_amount * 0.82; // Assuming 18% tax
          const taxAmount = order.total_amount * 0.18;
          const totalAmount = order.total_amount;

          const invoiceResult = await db.run(
            `INSERT INTO invoices (
              invoice_number, order_id, user_id, payment_id,
              subtotal, tax_amount, shipping_amount, discount_amount, total_amount,
              status, billing_name, billing_address, billing_city,
              issued_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
            [
              invoiceNumber,
              payment.order_id,
              order.user_id,
              id,
              subtotal,
              taxAmount,
              0, // shipping
              0, // discount
              totalAmount,
              'paid',
              order.customer_name || 'Customer',
              order.delivery_address || '',
              order.city || ''
            ]
          );

          // Add invoice items from order items
          const orderItems = await db.all(
            `SELECT oi.*, p.name as product_name, p.sku 
             FROM order_items oi 
             LEFT JOIN products p ON oi.product_id = p.id 
             WHERE oi.order_id = ?`,
            [payment.order_id]
          );
          
          for (const item of orderItems) {
            await db.run(
              `INSERT INTO invoice_items (invoice_id, product_id, product_name, product_sku, quantity, unit_price, total_amount)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [invoiceResult.lastID, item.product_id, item.product_name, item.sku || '', item.quantity, item.price, item.price * item.quantity]
            );
          }

          console.log(`✅ Invoice ${invoiceNumber} auto-generated for payment ${id} with ${orderItems.length} items`);
        }
      }
    }

    // Log admin action
    const admin = (req as any).admin;
    await db.run(
      `INSERT INTO admin_logs (admin_id, action, resource_type, resource_id, changes)
       VALUES (?, ?, ?, ?, ?)`,
      [admin.id, 'update_payment_status', 'payment', id, JSON.stringify({ 
        old_status: payment.status, 
        new_status: status,
        notes 
      })]
    );

    res.json({ success: true, message: 'Payment status updated' });
  } catch (error) {
    console.error('Update payment status error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==================== USER ROUTES ====================

// Get user's payment history
router.get('/user/history', authenticateUser, async (req, res) => {
  try {
    const db = getDatabase();
    const user = (req as any).user;
    const { page = 1, limit = 10 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // Only show payments that have valid orders (INNER JOIN filters orphaned payments)
    const payments = await db.all(
      `SELECT p.*, o.order_number
       FROM payments p
       INNER JOIN orders o ON p.order_id = o.id
       WHERE p.user_id = ?
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [user.id, Number(limit), offset]
    );

    const countResult = await db.get(
      `SELECT COUNT(*) as total FROM payments p
       INNER JOIN orders o ON p.order_id = o.id
       WHERE p.user_id = ?`,
      [user.id]
    );

    res.json({
      success: true,
      payments,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: countResult?.total || 0,
        totalPages: Math.ceil((countResult?.total || 0) / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get user payments error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get user's single payment
router.get('/user/:id', authenticateUser, async (req, res) => {
  try {
    const db = getDatabase();
    const user = (req as any).user;
    
    const payment = await db.get(
      `SELECT p.*, o.order_number, o.status as order_status
       FROM payments p
       LEFT JOIN orders o ON p.order_id = o.id
       WHERE p.id = ? AND p.user_id = ?`,
      [req.params.id, user.id]
    );

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    res.json({ success: true, payment });
  } catch (error) {
    console.error('Get user payment error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==================== INTERNAL ROUTES (for order processing) ====================

// Process payment for an order (internal use)
router.post('/process', authenticateUser, async (req, res) => {
  try {
    const db = getDatabase();
    const user = (req as any).user;
    const { 
      order_id, 
      payment_method, 
      payment_provider,
      amount,
      currency = 'USD',
      metadata 
    } = req.body;

    // Verify order belongs to user
    const order = await db.get(
      'SELECT * FROM orders WHERE id = ? AND user_id = ?',
      [order_id, user.id]
    );

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const transactionId = generateTransactionId();

    // Simulate payment processing (in production, integrate with payment gateway)
    const paymentResult = await db.run(
      `INSERT INTO payments (
        order_id, user_id, payment_method, payment_provider, 
        transaction_id, amount, currency, status, payment_type,
        ip_address, metadata, processed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        order_id,
        user.id,
        payment_method,
        payment_provider || 'internal',
        transactionId,
        amount || order.total,
        currency,
        'completed', // For demo purposes, auto-complete
        'order',
        req.ip,
        JSON.stringify(metadata || {}),
        new Date().toISOString()
      ]
    );

    // Update order payment status
    await db.run(
      'UPDATE orders SET payment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['paid', order_id]
    );

    res.json({ 
      success: true, 
      message: 'Payment processed successfully',
      payment: {
        id: paymentResult.lastID,
        transaction_id: transactionId,
        status: 'completed'
      }
    });
  } catch (error) {
    console.error('Process payment error:', error);
    res.status(500).json({ success: false, message: 'Payment processing failed' });
  }
});

// Record refund payment (internal use by refund system)
router.post('/refund', authenticateAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const admin = (req as any).admin;
    const { 
      order_id, 
      original_payment_id,
      amount,
      reason,
      refund_method 
    } = req.body;

    // Get original payment
    const originalPayment = await db.get(
      'SELECT * FROM payments WHERE id = ?',
      [original_payment_id]
    );

    if (!originalPayment) {
      return res.status(404).json({ success: false, message: 'Original payment not found' });
    }

    const transactionId = generateTransactionId();

    // Create refund payment record
    const refundResult = await db.run(
      `INSERT INTO payments (
        order_id, user_id, payment_method, payment_provider, 
        transaction_id, amount, currency, status, payment_type,
        metadata, processed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        order_id,
        originalPayment.user_id,
        refund_method || originalPayment.payment_method,
        originalPayment.payment_provider,
        transactionId,
        -Math.abs(amount), // Negative amount for refund
        originalPayment.currency,
        'completed',
        'refund',
        JSON.stringify({ 
          original_payment_id,
          reason,
          refunded_by: admin.id 
        }),
        new Date().toISOString()
      ]
    );

    // Update original payment status
    await db.run(
      'UPDATE payments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['refunded', original_payment_id]
    );

    res.json({ 
      success: true, 
      message: 'Refund processed successfully',
      refund: {
        id: refundResult.lastID,
        transaction_id: transactionId,
        status: 'completed'
      }
    });
  } catch (error) {
    console.error('Process refund error:', error);
    res.status(500).json({ success: false, message: 'Refund processing failed' });
  }
});

export default router;
