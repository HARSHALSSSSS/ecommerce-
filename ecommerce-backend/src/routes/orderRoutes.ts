import { Router } from 'express';
import { authenticateAdmin, authenticateUser } from '../middleware/auth';
import { getDatabase } from '../config/database';
import { sendEmail } from '../utils/email';
import { sendPushNotification } from '../utils/pushNotification';

const router = Router();

// Get all orders (admin)
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const { page = 1, limit = 20, status } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = `
      SELECT o.*, u.name as customer_name, u.email as customer_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status && status !== 'All') {
      query += ' AND o.status = ?';
      params.push(status);
    }

    // Get total count
    const countQuery = query.replace('SELECT o.*, u.name as customer_name, u.email as customer_email', 'SELECT COUNT(*) as total');
    const countResult = await db.get(countQuery, params);

    // Get paginated orders
    query += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), offset);

    const orders = await db.all(query, params);

    // Get order items for each order
    for (const order of orders) {
      const items = await db.all(
        `SELECT oi.*, p.name as product_name
         FROM order_items oi
         LEFT JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ?`,
        [order.id]
      );
      order.items = items;
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
    console.error('Get orders error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get single order
router.get('/:id', authenticateAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const order = await db.get(
      `SELECT o.*, u.name as customer_name, u.email as customer_email
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       WHERE o.id = ?`,
      [req.params.id]
    );

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const items = await db.all(
      `SELECT oi.*, p.name as product_name
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?`,
      [order.id]
    );
    order.items = items;

    // Define available status transitions based on current status
    const statusTransitions: Record<string, { status: string; display_name: string }[]> = {
      pending: [
        { status: 'confirmed', display_name: 'Confirm Order' },
        { status: 'cancelled', display_name: 'Cancel Order' },
      ],
      confirmed: [
        { status: 'processing', display_name: 'Start Processing' },
        { status: 'cancelled', display_name: 'Cancel Order' },
      ],
      processing: [
        { status: 'ready_for_shipping', display_name: 'Ready for Shipping' },
        { status: 'cancelled', display_name: 'Cancel Order' },
      ],
      ready_for_shipping: [
        { status: 'shipped', display_name: 'Mark as Shipped' },
        { status: 'cancelled', display_name: 'Cancel Order' },
      ],
      shipped: [
        { status: 'out_for_delivery', display_name: 'Out for Delivery' },
        { status: 'delivered', display_name: 'Mark as Delivered' },
        { status: 'failed_delivery', display_name: 'Delivery Failed' },
      ],
      out_for_delivery: [
        { status: 'delivered', display_name: 'Mark as Delivered' },
        { status: 'failed_delivery', display_name: 'Delivery Failed' },
      ],
      failed_delivery: [
        { status: 'shipped', display_name: 'Reship Order' },
        { status: 'cancelled', display_name: 'Cancel Order' },
      ],
      delivered: [
        { status: 'refund_requested', display_name: 'Process Refund Request' },
        { status: 'returned', display_name: 'Mark as Returned' },
      ],
      refund_requested: [
        { status: 'refund_processing', display_name: 'Process Refund' },
        { status: 'refund_rejected', display_name: 'Reject Refund' },
      ],
      refund_processing: [
        { status: 'refunded', display_name: 'Complete Refund' },
      ],
      cancelled: [],
      refunded: [],
      returned: [],
      refund_rejected: [],
    };

    order.available_transitions = statusTransitions[order.status] || [];

    res.json({ success: true, order });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update order status (admin only)
router.patch('/:id/status', authenticateAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { new_status, notes, notify_customer } = req.body;
    const status = new_status || req.body.status; // Support both new_status and status

    const validStatuses = [
      'pending', 'confirmed', 'processing', 'ready_for_shipping', 
      'shipped', 'out_for_delivery', 'delivered', 'failed_delivery',
      'cancelled', 'returned', 'refund_requested', 'refund_processing', 
      'refund_rejected', 'refunded'
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const existing = await db.get('SELECT o.*, u.email FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE o.id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const previousStatus = existing.status;

    await db.run(
      'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, id]
    );

    // Log the status change in order timeline
    await db.run(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES (?, ?, 'order', ?, ?, ?)`,
      [
        (req as any).admin?.id || 1, 
        'order_status_update', 
        id, 
        JSON.stringify({ previous_status: previousStatus, new_status: status, notes: notes || '' }),
        req.ip || ''
      ]
    );

    // Create notification for status update
    const statusMessages: Record<string, string> = {
      pending: `Your order #${existing.order_number} is pending confirmation.`,
      confirmed: `Your order #${existing.order_number} has been confirmed!`,
      processing: `Your order #${existing.order_number} is now being processed.`,
      ready_for_shipping: `Your order #${existing.order_number} is ready for shipping.`,
      shipped: `Great news! Your order #${existing.order_number} has been shipped.`,
      out_for_delivery: `Your order #${existing.order_number} is out for delivery!`,
      delivered: `Your order #${existing.order_number} has been delivered successfully.`,
      failed_delivery: `Delivery attempt for order #${existing.order_number} failed. We'll try again.`,
      cancelled: `Your order #${existing.order_number} has been cancelled.`,
      returned: `Your order #${existing.order_number} has been returned.`,
      refund_requested: `Refund request for order #${existing.order_number} is being reviewed.`,
      refund_processing: `Refund for order #${existing.order_number} is being processed.`,
      refund_rejected: `Refund request for order #${existing.order_number} was not approved.`,
      refunded: `Refund for order #${existing.order_number} has been completed.`,
    };

    if (notify_customer !== false) {
      // Create in-app notification
      await db.run(
        `INSERT INTO notification_logs (user_id, notification_type, channel, recipient, subject, message, related_type, related_id, status, sent_at)
         VALUES (?, 'order_status_update', 'in_app', ?, ?, ?, 'order', ?, 'delivered', CURRENT_TIMESTAMP)`,
        [existing.user_id, existing.email || '', `Order Status: ${status.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}`, statusMessages[status] || `Order status updated to ${status}`, id]
      );

      // Send email notification for important status updates
      const emailStatuses = ['confirmed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'refunded'];
      if (existing.email && emailStatuses.includes(status)) {
        const statusEmojis: Record<string, string> = {
          confirmed: '✅',
          shipped: '📦',
          out_for_delivery: '🚚',
          delivered: '🎉',
          cancelled: '❌',
          refunded: '💰',
        };

        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #E07856, #D4694A); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0;">${statusEmojis[status] || '📋'} Order Update</h1>
            </div>
            <div style="padding: 30px; background: #f9f9f9;">
              <p style="font-size: 16px;">Hi ${existing.name || 'Customer'},</p>
              <p style="font-size: 16px;">${statusMessages[status] || `Your order status has been updated to ${status}.`}</p>
              
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Order Number:</strong> ${existing.order_number}</p>
                <p><strong>Status:</strong> <span style="color: #E07856; font-weight: bold;">${status.replace(/_/g, ' ').toUpperCase()}</span></p>
                <p><strong>Total:</strong> $${existing.total_amount?.toFixed(2) || '0.00'}</p>
              </div>
              
              ${notes ? `<p style="background: #fff3cd; padding: 15px; border-radius: 8px;"><strong>Note:</strong> ${notes}</p>` : ''}
            </div>
            <div style="padding: 20px; text-align: center; color: #888; font-size: 12px;">
              <p>Thank you for shopping with us!</p>
              <p>© 2024 Ecommerce. All rights reserved.</p>
            </div>
          </div>
        `;

        const emailSent = await sendEmail(
          existing.email, 
          `Order ${status.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())} - #${existing.order_number}`, 
          emailHtml
        );

        // Log email notification
        await db.run(
          `INSERT INTO notification_logs (user_id, notification_type, channel, recipient, subject, message, related_type, related_id, status, sent_at)
           VALUES (?, 'order_status_update', 'email', ?, ?, ?, 'order', ?, ?, CURRENT_TIMESTAMP)`,
          [existing.user_id, existing.email, `Order ${status.replace(/_/g, ' ')} - #${existing.order_number}`, statusMessages[status], id, emailSent ? 'delivered' : 'failed']
        );

        console.log(`📧 Order status email ${emailSent ? 'sent' : 'failed'} to ${existing.email}`);
      }

      // Send push notification
      const pushTokens = await db.all(
        'SELECT token FROM push_tokens WHERE user_id = ? AND is_active = 1',
        [existing.user_id]
      );

      for (const tokenRow of pushTokens) {
        await sendPushNotification(
          tokenRow.token,
          `Order ${status.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}`,
          statusMessages[status] || `Your order status has been updated.`,
          { type: 'order_status_update', order_id: id, status, order_number: existing.order_number }
        );
      }
    }

    // Update payment status based on order status
    if (status === 'delivered') {
      // Mark payment as completed
      await db.run(
        `UPDATE payments SET status = 'completed', processed_at = CURRENT_TIMESTAMP WHERE order_id = ? AND status != 'refunded'`,
        [id]
      );
      
      // Auto-generate invoice for COD orders when delivered (if not already exists)
      const existingInvoice = await db.get('SELECT id FROM invoices WHERE order_id = ?', [id]);
      if (!existingInvoice) {
        const payment = await db.get('SELECT id FROM payments WHERE order_id = ?', [id]);
        const user = await db.get('SELECT name FROM users WHERE id = ?', [existing.user_id]);
        const invoiceNumber = `INV-${Date.now()}-${id}`;
        const subtotal = existing.total_amount * 0.82;
        const taxAmount = existing.total_amount * 0.18;
        
        const invoiceResult = await db.run(
          `INSERT INTO invoices (
            invoice_number, order_id, user_id, payment_id,
            subtotal, tax_amount, shipping_amount, discount_amount, total_amount,
            status, billing_name, billing_address, billing_city,
            issued_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
          [
            invoiceNumber, id, existing.user_id, payment?.id || null,
            subtotal, taxAmount, 0, 0, existing.total_amount,
            'paid', user?.name || 'Customer', existing.delivery_address || '', existing.city || ''
          ]
        );
        
        // Add invoice items from order items
        const orderItems = await db.all(
          `SELECT oi.*, p.name as product_name, p.sku 
           FROM order_items oi 
           LEFT JOIN products p ON oi.product_id = p.id 
           WHERE oi.order_id = ?`,
          [id]
        );
        
        for (const item of orderItems) {
          await db.run(
            `INSERT INTO invoice_items (invoice_id, product_id, product_name, product_sku, quantity, unit_price, total_amount)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [invoiceResult.lastID, item.product_id, item.product_name, item.sku || '', item.quantity, item.price, item.price * item.quantity]
          );
        }
        
        console.log(`✅ Invoice ${invoiceNumber} auto-generated for delivered COD order`);
      }
    } else if (status === 'cancelled') {
      await db.run(
        `UPDATE payments SET status = 'cancelled' WHERE order_id = ? AND status = 'pending'`,
        [id]
      );
    } else if (status === 'refunded') {
      await db.run(
        `UPDATE payments SET status = 'refunded', processed_at = CURRENT_TIMESTAMP WHERE order_id = ?`,
        [id]
      );
    }

    const order = await db.get('SELECT * FROM orders WHERE id = ?', [id]);
    res.json({ success: true, order, message: `Order status updated to ${status.replace(/_/g, ' ')}` });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create order (from mobile app)
router.post('/', authenticateUser, async (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user!.id;
    const { items, delivery_address, city, postal_code, payment_method, notes } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ success: false, message: 'Order items required' });
    }

    // Calculate total
    let totalAmount = 0;
    for (const item of items) {
      const product = await db.get('SELECT price, discount_percent FROM products WHERE id = ?', [item.product_id]);
      if (product) {
        const price = product.price * (1 - product.discount_percent / 100);
        totalAmount += price * item.quantity;
      }
    }

    // Generate order number
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    // Create order
    const result = await db.run(
      `INSERT INTO orders (order_number, user_id, total_amount, status, payment_method, delivery_address, city, postal_code, notes)
       VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
      [orderNumber, userId, totalAmount, payment_method, delivery_address, city, postal_code, notes]
    );

    const orderId = result.lastID;

    // Create order items
    for (const item of items) {
      const product = await db.get('SELECT price FROM products WHERE id = ?', [item.product_id]);
      if (product) {
        await db.run(
          'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
          [orderId, item.product_id, item.quantity, product.price]
        );
      }
    }

    // Create payment record for the order
    const transactionId = `TXN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    // COD payments are pending until delivery, online payments (card, wallet, upi) are completed immediately
    const onlinePaymentMethods = ['credit_card', 'debit_card', 'wallet', 'upi', 'net_banking'];
    const paymentStatus = payment_method === 'cash_on_delivery' || payment_method === 'cod' 
      ? 'pending' 
      : onlinePaymentMethods.includes(payment_method) 
        ? 'completed' 
        : 'processing';
    
    const paymentResult = await db.run(
      `INSERT INTO payments (order_id, user_id, payment_method, transaction_id, amount, currency, status, payment_type, processed_at)
       VALUES (?, ?, ?, ?, ?, 'USD', ?, 'order', ?)`,
      [orderId, userId, payment_method, transactionId, totalAmount, paymentStatus, paymentStatus === 'completed' ? new Date().toISOString() : null]
    );

    // Get user details for invoice and notification
    const user = await db.get('SELECT name, email FROM users WHERE id = ?', [userId]);

    // If payment is completed (online payment), automatically generate invoice
    if (paymentStatus === 'completed') {
      const invoiceNumber = `INV-${Date.now()}-${orderId}`;
      const subtotal = totalAmount * 0.82; // Assuming 18% tax
      const taxAmount = totalAmount * 0.18;

      const invoiceResult = await db.run(
        `INSERT INTO invoices (
          invoice_number, order_id, user_id, payment_id,
          subtotal, tax_amount, shipping_amount, discount_amount, total_amount,
          status, billing_name, billing_address, billing_city,
          issued_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [
          invoiceNumber,
          orderId,
          userId,
          paymentResult.lastID,
          subtotal,
          taxAmount,
          0, // shipping
          0, // discount
          totalAmount,
          'issued',
          user?.name || 'Customer',
          delivery_address || '',
          city || ''
        ]
      );

      // Add invoice items from order items
      const orderItems = await db.all(
        `SELECT oi.*, p.name as product_name, p.sku 
         FROM order_items oi 
         LEFT JOIN products p ON oi.product_id = p.id 
         WHERE oi.order_id = ?`,
        [orderId]
      );
      
      for (const item of orderItems) {
        await db.run(
          `INSERT INTO invoice_items (invoice_id, product_id, product_name, product_sku, quantity, unit_price, total_amount)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [invoiceResult.lastID, item.product_id, item.product_name, item.sku || '', item.quantity, item.price, item.price * item.quantity]
        );
      }

      console.log(`✅ Invoice ${invoiceNumber} auto-generated for online payment with ${orderItems.length} items`);
    }

    // Create initial notification for order (in-app)
    await db.run(
      `INSERT INTO notification_logs (user_id, notification_type, channel, recipient, subject, message, related_type, related_id, status, sent_at)
       VALUES (?, 'order_created', 'in_app', ?, 'Order Placed Successfully', ?, 'order', ?, 'delivered', CURRENT_TIMESTAMP)`,
      [userId, user?.email || '', `Your order #${orderNumber} has been placed successfully. Total: $${totalAmount.toFixed(2)}`, orderId]
    );

    // Send order confirmation email
    if (user?.email) {
      const orderItemsList = await db.all(
        `SELECT oi.*, p.name as product_name 
         FROM order_items oi 
         LEFT JOIN products p ON oi.product_id = p.id 
         WHERE oi.order_id = ?`,
        [orderId]
      );

      const itemsHtml = orderItemsList.map((item: any) => 
        `<tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.product_name}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${(item.price * item.quantity).toFixed(2)}</td>
        </tr>`
      ).join('');

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #E07856, #D4694A); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Order Confirmed! 🎉</h1>
          </div>
          <div style="padding: 30px; background: #f9f9f9;">
            <p style="font-size: 16px;">Hi ${user.name || 'Customer'},</p>
            <p style="font-size: 16px;">Thank you for your order! We've received it and are getting it ready.</p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #333;">Order Details</h3>
              <p><strong>Order Number:</strong> ${orderNumber}</p>
              <p><strong>Payment Method:</strong> ${payment_method?.replace(/_/g, ' ')?.toUpperCase() || 'N/A'}</p>
              
              <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                <thead>
                  <tr style="background: #f5f5f5;">
                    <th style="padding: 10px; text-align: left;">Product</th>
                    <th style="padding: 10px; text-align: center;">Qty</th>
                    <th style="padding: 10px; text-align: right;">Price</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="2" style="padding: 15px 10px; text-align: right; font-weight: bold;">Total:</td>
                    <td style="padding: 15px 10px; text-align: right; font-weight: bold; font-size: 18px; color: #E07856;">$${totalAmount.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            
            ${delivery_address ? `
            <div style="background: white; padding: 20px; border-radius: 8px;">
              <h3 style="margin-top: 0; color: #333;">Delivery Address</h3>
              <p style="margin: 0;">${delivery_address}</p>
              ${city ? `<p style="margin: 5px 0;">${city} ${postal_code || ''}</p>` : ''}
            </div>
            ` : ''}
          </div>
          <div style="padding: 20px; text-align: center; color: #888; font-size: 12px;">
            <p>Thank you for shopping with us!</p>
            <p>© 2024 Ecommerce. All rights reserved.</p>
          </div>
        </div>
      `;

      const emailSent = await sendEmail(user.email, `Order Confirmed - #${orderNumber}`, emailHtml);
      
      // Log email notification
      await db.run(
        `INSERT INTO notification_logs (user_id, notification_type, channel, recipient, subject, message, related_type, related_id, status, sent_at)
         VALUES (?, 'order_created', 'email', ?, ?, ?, 'order', ?, ?, CURRENT_TIMESTAMP)`,
        [userId, user.email, `Order Confirmed - #${orderNumber}`, `Your order has been placed successfully.`, orderId, emailSent ? 'delivered' : 'failed']
      );
      
      console.log(`📧 Order confirmation email ${emailSent ? 'sent' : 'failed'} to ${user.email}`);
    }

    // Send push notification
    const pushTokens = await db.all(
      'SELECT token FROM push_tokens WHERE user_id = ? AND is_active = 1',
      [userId]
    );

    for (const tokenRow of pushTokens) {
      const pushSent = await sendPushNotification(
        tokenRow.token,
        '🎉 Order Confirmed!',
        `Your order #${orderNumber} has been placed. Total: $${totalAmount.toFixed(2)}`,
        { type: 'order_created', order_id: orderId, order_number: orderNumber }
      );
      
      if (pushSent) {
        console.log(`📱 Push notification sent for order ${orderNumber}`);
      }
    }

    // Clear user's cart
    await db.run('DELETE FROM cart WHERE user_id = ?', [userId]);

    const order = await db.get('SELECT * FROM orders WHERE id = ?', [orderId]);
    res.status(201).json({ success: true, order });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get user's own orders (for mobile app)
router.get('/my-orders', authenticateUser, async (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user!.id;

    const orders = await db.all(
      `SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC`,
      [userId]
    );

    // Get order items for each order
    for (const order of orders) {
      const items = await db.all(
        `SELECT oi.*, p.name as product_name, p.image
         FROM order_items oi
         LEFT JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ?`,
        [order.id]
      );
      order.items = items;
    }

    res.json({ success: true, orders });
  } catch (error) {
    console.error('Get user orders error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
