import { Router } from 'express';
import { authenticateAdmin, authenticateUser } from '../middleware/auth';
import { getDatabase } from '../config/database';

const router = Router();

// Generate unique invoice number
function generateInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `INV-${year}-${timestamp}${random}`;
}

// Generate unique credit note number
function generateCreditNoteNumber(): string {
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CN-${year}-${timestamp}${random}`;
}

// ==================== ADMIN ROUTES ====================

// Get all invoices (admin)
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const { 
      page = 1, 
      limit = 20, 
      status,
      invoice_type,
      start_date,
      end_date,
      search 
    } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = `
      SELECT i.*, 
             o.order_number,
             u.name as customer_name, 
             u.email as customer_email
      FROM invoices i
      LEFT JOIN orders o ON i.order_id = o.id
      LEFT JOIN users u ON i.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status && status !== 'all') {
      query += ' AND i.status = ?';
      params.push(status);
    }

    if (invoice_type && invoice_type !== 'all') {
      query += ' AND i.invoice_type = ?';
      params.push(invoice_type);
    }

    if (start_date) {
      query += ' AND DATE(i.issued_at) >= DATE(?)';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND DATE(i.issued_at) <= DATE(?)';
      params.push(end_date);
    }

    if (search) {
      query += ' AND (i.invoice_number LIKE ? OR o.order_number LIKE ? OR u.name LIKE ? OR u.email LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Get total count
    const countQuery = query.replace(
      'SELECT i.*, o.order_number, u.name as customer_name, u.email as customer_email',
      'SELECT COUNT(*) as total'
    );
    const countResult = await db.get(countQuery, params);

    // Get paginated invoices
    query += ' ORDER BY i.issued_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), offset);

    const invoices = await db.all(query, params);

    // Get invoice stats
    const stats = await db.get(`
      SELECT 
        COUNT(*) as total_count,
        SUM(total_amount) as total_amount,
        SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END) as paid_amount,
        SUM(CASE WHEN status = 'issued' THEN total_amount ELSE 0 END) as pending_amount,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count,
        COUNT(CASE WHEN status = 'issued' THEN 1 END) as pending_count,
        COUNT(CASE WHEN status = 'voided' THEN 1 END) as voided_count
      FROM invoices
    `);

    res.json({
      success: true,
      invoices,
      stats,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: countResult?.total || 0,
        totalPages: Math.ceil((countResult?.total || 0) / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get single invoice (admin)
router.get('/:id', authenticateAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const invoice = await db.get(
      `SELECT i.*, 
              o.order_number, o.status as order_status,
              u.name as customer_name, u.email as customer_email, 
              u.phone as customer_phone, u.address as customer_address,
              p.transaction_id as payment_transaction_id, p.payment_method
       FROM invoices i
       LEFT JOIN orders o ON i.order_id = o.id
       LEFT JOIN users u ON i.user_id = u.id
       LEFT JOIN payments p ON i.payment_id = p.id
       WHERE i.id = ?`,
      [req.params.id]
    );

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    // Get invoice items
    const items = await db.all(
      `SELECT ii.*, p.image_url as product_image
       FROM invoice_items ii
       LEFT JOIN products p ON ii.product_id = p.id
       WHERE ii.invoice_id = ?`,
      [invoice.id]
    );

    // Get related credit notes
    const creditNotes = await db.all(
      'SELECT id, credit_note_number, total_amount, status, issued_at FROM credit_notes WHERE invoice_id = ?',
      [invoice.id]
    );

    res.json({ 
      success: true, 
      invoice: {
        ...invoice,
        items,
        credit_notes: creditNotes
      }
    });
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Generate invoice for an order (admin)
router.post('/generate', authenticateAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const admin = (req as any).admin;
    const { order_id, notes } = req.body;

    // Check if invoice already exists for this order
    const existingInvoice = await db.get(
      'SELECT id, invoice_number FROM invoices WHERE order_id = ?',
      [order_id]
    );

    if (existingInvoice) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invoice already exists for this order',
        invoice_number: existingInvoice.invoice_number
      });
    }

    // Get order details
    const order = await db.get(
      `SELECT o.*, u.name, u.email, u.phone, u.address
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       WHERE o.id = ?`,
      [order_id]
    );

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Get order items
    const orderItems = await db.all(
      `SELECT oi.*, p.sku as product_sku
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?`,
      [order_id]
    );

    // Get payment if exists
    const payment = await db.get(
      'SELECT id FROM payments WHERE order_id = ? AND status = ?',
      [order_id, 'completed']
    );

    const invoiceNumber = generateInvoiceNumber();

    // Calculate amounts
    const subtotal = orderItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
    const taxAmount = 0; // Add tax calculation logic if needed
    const shippingAmount = order.shipping_cost || 0;
    const discountAmount = order.discount || 0;
    const totalAmount = subtotal + taxAmount + shippingAmount - discountAmount;

    // Parse shipping address
    let billingAddress = '';
    let billingCity = '';
    let billingState = '';
    let billingPostalCode = '';
    let billingCountry = 'US';
    
    if (order.shipping_address) {
      try {
        const addr = typeof order.shipping_address === 'string' 
          ? JSON.parse(order.shipping_address) 
          : order.shipping_address;
        billingAddress = addr.street || addr.address || '';
        billingCity = addr.city || '';
        billingState = addr.state || '';
        billingPostalCode = addr.postal_code || addr.zip || '';
        billingCountry = addr.country || 'US';
      } catch (e) {
        billingAddress = order.shipping_address;
      }
    }

    // Create invoice
    const invoiceResult = await db.run(
      `INSERT INTO invoices (
        invoice_number, order_id, user_id, payment_id, invoice_type,
        subtotal, tax_amount, shipping_amount, discount_amount, total_amount,
        status, billing_name, billing_address, billing_city, billing_state,
        billing_postal_code, billing_country, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoiceNumber,
        order_id,
        order.user_id,
        payment?.id || null,
        'sale',
        subtotal,
        taxAmount,
        shippingAmount,
        discountAmount,
        totalAmount,
        payment ? 'paid' : 'issued',
        order.name,
        billingAddress,
        billingCity,
        billingState,
        billingPostalCode,
        billingCountry,
        notes
      ]
    );

    const invoiceId = invoiceResult.lastID;

    // Create invoice items
    for (const item of orderItems) {
      const itemTotal = item.price * item.quantity;
      await db.run(
        `INSERT INTO invoice_items (
          invoice_id, product_id, product_name, product_sku,
          quantity, unit_price, tax_rate, tax_amount, total_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          invoiceId,
          item.product_id,
          item.product_name || 'Product',
          item.product_sku || '',
          item.quantity,
          item.price,
          0,
          0,
          itemTotal
        ]
      );
    }

    // Log admin action
    await db.run(
      `INSERT INTO admin_logs (admin_id, action, resource_type, resource_id, changes)
       VALUES (?, ?, ?, ?, ?)`,
      [admin.id, 'generate_invoice', 'invoice', invoiceId, JSON.stringify({ 
        invoice_number: invoiceNumber,
        order_id 
      })]
    );

    res.json({ 
      success: true, 
      message: 'Invoice generated successfully',
      invoice: {
        id: invoiceId,
        invoice_number: invoiceNumber
      }
    });
  } catch (error) {
    console.error('Generate invoice error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update invoice status (admin)
router.patch('/:id/status', authenticateAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const { status } = req.body;
    const { id } = req.params;
    const admin = (req as any).admin;

    const invoice = await db.get('SELECT * FROM invoices WHERE id = ?', [id]);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    // Invoices are immutable, only status can change
    const validStatuses = ['issued', 'paid', 'voided', 'overdue'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const updateFields: any = { status };
    if (status === 'paid') {
      updateFields.paid_at = new Date().toISOString();
    } else if (status === 'voided') {
      updateFields.voided_at = new Date().toISOString();
    }

    await db.run(
      `UPDATE invoices SET status = ?, paid_at = ?, voided_at = ? WHERE id = ?`,
      [status, updateFields.paid_at || invoice.paid_at, updateFields.voided_at || invoice.voided_at, id]
    );

    // Log admin action
    await db.run(
      `INSERT INTO admin_logs (admin_id, action, resource_type, resource_id, changes)
       VALUES (?, ?, ?, ?, ?)`,
      [admin.id, 'update_invoice_status', 'invoice', id, JSON.stringify({ 
        old_status: invoice.status, 
        new_status: status 
      })]
    );

    res.json({ success: true, message: 'Invoice status updated' });
  } catch (error) {
    console.error('Update invoice status error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Generate PDF representation (returns invoice data for PDF generation)
router.get('/:id/pdf', authenticateAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const invoice = await db.get(
      `SELECT i.*, 
              o.order_number,
              u.name as customer_name, u.email as customer_email, u.phone as customer_phone
       FROM invoices i
       LEFT JOIN orders o ON i.order_id = o.id
       LEFT JOIN users u ON i.user_id = u.id
       WHERE i.id = ?`,
      [req.params.id]
    );

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const items = await db.all(
      'SELECT * FROM invoice_items WHERE invoice_id = ?',
      [invoice.id]
    );

    // Return formatted invoice data for PDF generation
    res.json({ 
      success: true, 
      invoice_pdf_data: {
        invoice_number: invoice.invoice_number,
        issued_at: invoice.issued_at,
        due_at: invoice.due_at,
        status: invoice.status,
        customer: {
          name: invoice.billing_name || invoice.customer_name,
          email: invoice.customer_email,
          phone: invoice.customer_phone,
          address: {
            street: invoice.billing_address,
            city: invoice.billing_city,
            state: invoice.billing_state,
            postal_code: invoice.billing_postal_code,
            country: invoice.billing_country
          }
        },
        items: items.map((item: any) => ({
          name: item.product_name,
          sku: item.product_sku,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax: item.tax_amount,
          total: item.total_amount
        })),
        totals: {
          subtotal: invoice.subtotal,
          tax: invoice.tax_amount,
          shipping: invoice.shipping_amount,
          discount: invoice.discount_amount,
          total: invoice.total_amount
        },
        order_number: invoice.order_number,
        notes: invoice.notes
      }
    });
  } catch (error) {
    console.error('Get invoice PDF error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==================== USER ROUTES ====================

// Get user's invoices
router.get('/user/list', authenticateUser, async (req, res) => {
  try {
    const db = getDatabase();
    const user = (req as any).user;
    const { page = 1, limit = 10 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // Exclude voided/cancelled invoices from user view
    const invoices = await db.all(
      `SELECT i.*, o.order_number
       FROM invoices i
       LEFT JOIN orders o ON i.order_id = o.id
       WHERE i.user_id = ? AND i.status NOT IN ('voided', 'cancelled')
       ORDER BY i.issued_at DESC
       LIMIT ? OFFSET ?`,
      [user.id, Number(limit), offset]
    );

    const countResult = await db.get(
      `SELECT COUNT(*) as total FROM invoices WHERE user_id = ? AND status NOT IN ('voided', 'cancelled')`,
      [user.id]
    );

    res.json({
      success: true,
      invoices,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: countResult?.total || 0,
        totalPages: Math.ceil((countResult?.total || 0) / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get user invoices error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get user's single invoice
router.get('/user/:id', authenticateUser, async (req, res) => {
  try {
    const db = getDatabase();
    const user = (req as any).user;
    
    const invoice = await db.get(
      `SELECT i.*, o.order_number
       FROM invoices i
       LEFT JOIN orders o ON i.order_id = o.id
       WHERE i.id = ? AND i.user_id = ?`,
      [req.params.id, user.id]
    );

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const items = await db.all(
      'SELECT * FROM invoice_items WHERE invoice_id = ?',
      [invoice.id]
    );

    res.json({ 
      success: true, 
      invoice: {
        ...invoice,
        items
      }
    });
  } catch (error) {
    console.error('Get user invoice error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
