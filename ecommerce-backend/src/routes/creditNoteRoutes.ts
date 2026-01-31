import { Router } from 'express';
import { authenticateAdmin, authenticateUser } from '../middleware/auth';
import { getDatabase } from '../config/database';

const router = Router();

// Generate unique credit note number
function generateCreditNoteNumber(): string {
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CN-${year}-${timestamp}${random}`;
}

// ==================== ADMIN ROUTES ====================

// Get all credit notes (admin)
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const { 
      page = 1, 
      limit = 20, 
      status,
      reason_category,
      start_date,
      end_date,
      search 
    } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = `
      SELECT cn.*, 
             i.invoice_number,
             o.order_number,
             u.name as customer_name, 
             u.email as customer_email,
             a.name as issued_by_name
      FROM credit_notes cn
      LEFT JOIN invoices i ON cn.invoice_id = i.id
      LEFT JOIN orders o ON cn.order_id = o.id
      LEFT JOIN users u ON cn.user_id = u.id
      LEFT JOIN admins a ON cn.issued_by = a.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status && status !== 'all') {
      query += ' AND cn.status = ?';
      params.push(status);
    }

    if (reason_category && reason_category !== 'all') {
      query += ' AND cn.reason_category = ?';
      params.push(reason_category);
    }

    if (start_date) {
      query += ' AND DATE(cn.issued_at) >= DATE(?)';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND DATE(cn.issued_at) <= DATE(?)';
      params.push(end_date);
    }

    if (search) {
      query += ' AND (cn.credit_note_number LIKE ? OR i.invoice_number LIKE ? OR o.order_number LIKE ? OR u.name LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Get total count
    const countQuery = query.replace(
      'SELECT cn.*, i.invoice_number, o.order_number, u.name as customer_name, u.email as customer_email, a.name as issued_by_name',
      'SELECT COUNT(*) as total'
    );
    const countResult = await db.get(countQuery, params);

    // Get paginated credit notes
    query += ' ORDER BY cn.issued_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), offset);

    const creditNotes = await db.all(query, params);

    // Get credit note stats
    const stats = await db.get(`
      SELECT 
        COUNT(*) as total_count,
        SUM(total_amount) as total_amount,
        SUM(CASE WHEN status = 'applied' THEN total_amount ELSE 0 END) as applied_amount,
        SUM(CASE WHEN status = 'issued' THEN total_amount ELSE 0 END) as pending_amount,
        COUNT(CASE WHEN status = 'applied' THEN 1 END) as applied_count,
        COUNT(CASE WHEN status = 'issued' THEN 1 END) as pending_count,
        COUNT(CASE WHEN reason_category = 'refund' THEN 1 END) as refund_count,
        COUNT(CASE WHEN reason_category = 'return' THEN 1 END) as return_count,
        COUNT(CASE WHEN reason_category = 'adjustment' THEN 1 END) as adjustment_count
      FROM credit_notes
    `);

    res.json({
      success: true,
      creditNotes,
      stats,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: countResult?.total || 0,
        totalPages: Math.ceil((countResult?.total || 0) / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get credit notes error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get single credit note (admin)
router.get('/:id', authenticateAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const creditNote = await db.get(
      `SELECT cn.*, 
              i.invoice_number, i.total_amount as invoice_total,
              o.order_number, o.status as order_status,
              u.name as customer_name, u.email as customer_email, u.phone as customer_phone,
              a.name as issued_by_name
       FROM credit_notes cn
       LEFT JOIN invoices i ON cn.invoice_id = i.id
       LEFT JOIN orders o ON cn.order_id = o.id
       LEFT JOIN users u ON cn.user_id = u.id
       LEFT JOIN admins a ON cn.issued_by = a.id
       WHERE cn.id = ?`,
      [req.params.id]
    );

    if (!creditNote) {
      return res.status(404).json({ success: false, message: 'Credit note not found' });
    }

    // Get credit note items
    const items = await db.all(
      `SELECT cni.*, p.image_url as product_image
       FROM credit_note_items cni
       LEFT JOIN products p ON cni.product_id = p.id
       WHERE cni.credit_note_id = ?`,
      [creditNote.id]
    );

    res.json({ 
      success: true, 
      creditNote: {
        ...creditNote,
        items
      }
    });
  } catch (error) {
    console.error('Get credit note error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create credit note (admin)
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const admin = (req as any).admin;
    const { 
      invoice_id, 
      reason, 
      reason_category,
      items,
      notes,
      refund_method 
    } = req.body;

    // Get invoice details
    const invoice = await db.get(
      `SELECT i.*, o.order_number, o.id as order_id
       FROM invoices i
       LEFT JOIN orders o ON i.order_id = o.id
       WHERE i.id = ?`,
      [invoice_id]
    );

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    // Calculate totals from items
    let subtotal = 0;
    let taxAmount = 0;
    
    if (items && items.length > 0) {
      for (const item of items) {
        subtotal += item.unit_price * item.quantity;
        taxAmount += item.tax_amount || 0;
      }
    } else {
      // Full credit note for entire invoice
      subtotal = invoice.subtotal;
      taxAmount = invoice.tax_amount;
    }

    const totalAmount = subtotal + taxAmount;
    const creditNoteNumber = generateCreditNoteNumber();

    // Create credit note
    const creditNoteResult = await db.run(
      `INSERT INTO credit_notes (
        credit_note_number, invoice_id, order_id, user_id,
        reason, reason_category, subtotal, tax_amount, total_amount,
        status, refund_method, notes, issued_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        creditNoteNumber,
        invoice_id,
        invoice.order_id,
        invoice.user_id,
        reason,
        reason_category || 'refund',
        subtotal,
        taxAmount,
        totalAmount,
        'issued',
        refund_method || 'original_payment_method',
        notes,
        admin.id
      ]
    );

    const creditNoteId = creditNoteResult.lastID;

    // Create credit note items
    if (items && items.length > 0) {
      for (const item of items) {
        const itemTotal = item.unit_price * item.quantity;
        await db.run(
          `INSERT INTO credit_note_items (
            credit_note_id, invoice_item_id, product_id, product_name, product_sku,
            quantity, unit_price, tax_amount, total_amount
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            creditNoteId,
            item.invoice_item_id || null,
            item.product_id,
            item.product_name,
            item.product_sku || '',
            item.quantity,
            item.unit_price,
            item.tax_amount || 0,
            itemTotal
          ]
        );
      }
    } else {
      // Copy all items from invoice
      const invoiceItems = await db.all(
        'SELECT * FROM invoice_items WHERE invoice_id = ?',
        [invoice_id]
      );

      for (const item of invoiceItems) {
        await db.run(
          `INSERT INTO credit_note_items (
            credit_note_id, invoice_item_id, product_id, product_name, product_sku,
            quantity, unit_price, tax_amount, total_amount
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            creditNoteId,
            item.id,
            item.product_id,
            item.product_name,
            item.product_sku,
            item.quantity,
            item.unit_price,
            item.tax_amount,
            item.total_amount
          ]
        );
      }
    }

    // Log admin action
    await db.run(
      `INSERT INTO admin_logs (admin_id, action, resource_type, resource_id, changes)
       VALUES (?, ?, ?, ?, ?)`,
      [admin.id, 'create_credit_note', 'credit_note', creditNoteId, JSON.stringify({ 
        credit_note_number: creditNoteNumber,
        invoice_id,
        total_amount: totalAmount,
        reason 
      })]
    );

    // Create notification for user
    await db.run(
      `INSERT INTO notification_logs (
        user_id, notification_type, channel, recipient, subject, message,
        related_type, related_id, status, sent_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoice.user_id,
        'credit_note_issued',
        'in_app',
        invoice.user_id.toString(),
        'Credit Note Issued',
        `A credit note ${creditNoteNumber} for $${totalAmount.toFixed(2)} has been issued for your order.`,
        'credit_note',
        creditNoteId,
        'sent',
        new Date().toISOString()
      ]
    );

    res.json({ 
      success: true, 
      message: 'Credit note created successfully',
      creditNote: {
        id: creditNoteId,
        credit_note_number: creditNoteNumber,
        total_amount: totalAmount
      }
    });
  } catch (error) {
    console.error('Create credit note error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Apply credit note (mark as refunded)
router.patch('/:id/apply', authenticateAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const admin = (req as any).admin;
    const { id } = req.params;
    const { refund_transaction_id } = req.body;

    const creditNote = await db.get('SELECT * FROM credit_notes WHERE id = ?', [id]);
    if (!creditNote) {
      return res.status(404).json({ success: false, message: 'Credit note not found' });
    }

    if (creditNote.status !== 'issued') {
      return res.status(400).json({ success: false, message: 'Credit note already processed' });
    }

    await db.run(
      `UPDATE credit_notes 
       SET status = ?, refund_transaction_id = ?, applied_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      ['applied', refund_transaction_id, id]
    );

    // Log admin action
    await db.run(
      `INSERT INTO admin_logs (admin_id, action, resource_type, resource_id, changes)
       VALUES (?, ?, ?, ?, ?)`,
      [admin.id, 'apply_credit_note', 'credit_note', id, JSON.stringify({ 
        refund_transaction_id 
      })]
    );

    // Create notification for user
    await db.run(
      `INSERT INTO notification_logs (
        user_id, notification_type, channel, recipient, subject, message,
        related_type, related_id, status, sent_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        creditNote.user_id,
        'refund_processed',
        'in_app',
        creditNote.user_id.toString(),
        'Refund Processed',
        `Your refund of $${creditNote.total_amount.toFixed(2)} has been processed.`,
        'credit_note',
        id,
        'sent',
        new Date().toISOString()
      ]
    );

    res.json({ success: true, message: 'Credit note applied successfully' });
  } catch (error) {
    console.error('Apply credit note error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Void credit note
router.patch('/:id/void', authenticateAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const admin = (req as any).admin;
    const { id } = req.params;
    const { reason } = req.body;

    const creditNote = await db.get('SELECT * FROM credit_notes WHERE id = ?', [id]);
    if (!creditNote) {
      return res.status(404).json({ success: false, message: 'Credit note not found' });
    }

    if (creditNote.status === 'applied') {
      return res.status(400).json({ success: false, message: 'Cannot void an applied credit note' });
    }

    await db.run(
      `UPDATE credit_notes 
       SET status = ?, notes = COALESCE(notes, '') || ' [VOIDED: ' || ? || ']'
       WHERE id = ?`,
      ['voided', reason || 'No reason provided', id]
    );

    // Log admin action
    await db.run(
      `INSERT INTO admin_logs (admin_id, action, resource_type, resource_id, changes)
       VALUES (?, ?, ?, ?, ?)`,
      [admin.id, 'void_credit_note', 'credit_note', id, JSON.stringify({ reason })]
    );

    res.json({ success: true, message: 'Credit note voided successfully' });
  } catch (error) {
    console.error('Void credit note error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get PDF data for credit note
router.get('/:id/pdf', authenticateAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const creditNote = await db.get(
      `SELECT cn.*, 
              i.invoice_number,
              o.order_number,
              u.name as customer_name, u.email as customer_email, u.phone as customer_phone
       FROM credit_notes cn
       LEFT JOIN invoices i ON cn.invoice_id = i.id
       LEFT JOIN orders o ON cn.order_id = o.id
       LEFT JOIN users u ON cn.user_id = u.id
       WHERE cn.id = ?`,
      [req.params.id]
    );

    if (!creditNote) {
      return res.status(404).json({ success: false, message: 'Credit note not found' });
    }

    const items = await db.all(
      'SELECT * FROM credit_note_items WHERE credit_note_id = ?',
      [creditNote.id]
    );

    res.json({ 
      success: true, 
      credit_note_pdf_data: {
        credit_note_number: creditNote.credit_note_number,
        issued_at: creditNote.issued_at,
        status: creditNote.status,
        reason: creditNote.reason,
        reason_category: creditNote.reason_category,
        customer: {
          name: creditNote.customer_name,
          email: creditNote.customer_email,
          phone: creditNote.customer_phone
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
          subtotal: creditNote.subtotal,
          tax: creditNote.tax_amount,
          total: creditNote.total_amount
        },
        invoice_number: creditNote.invoice_number,
        order_number: creditNote.order_number,
        notes: creditNote.notes
      }
    });
  } catch (error) {
    console.error('Get credit note PDF error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==================== USER ROUTES ====================

// Get user's credit notes
router.get('/user/list', authenticateUser, async (req, res) => {
  try {
    const db = getDatabase();
    const user = (req as any).user;
    const { page = 1, limit = 10 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const creditNotes = await db.all(
      `SELECT cn.*, i.invoice_number, o.order_number
       FROM credit_notes cn
       LEFT JOIN invoices i ON cn.invoice_id = i.id
       LEFT JOIN orders o ON cn.order_id = o.id
       WHERE cn.user_id = ?
       ORDER BY cn.issued_at DESC
       LIMIT ? OFFSET ?`,
      [user.id, Number(limit), offset]
    );

    const countResult = await db.get(
      'SELECT COUNT(*) as total FROM credit_notes WHERE user_id = ?',
      [user.id]
    );

    res.json({
      success: true,
      creditNotes,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: countResult?.total || 0,
        totalPages: Math.ceil((countResult?.total || 0) / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get user credit notes error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get user's single credit note
router.get('/user/:id', authenticateUser, async (req, res) => {
  try {
    const db = getDatabase();
    const user = (req as any).user;
    
    const creditNote = await db.get(
      `SELECT cn.*, i.invoice_number, o.order_number
       FROM credit_notes cn
       LEFT JOIN invoices i ON cn.invoice_id = i.id
       LEFT JOIN orders o ON cn.order_id = o.id
       WHERE cn.id = ? AND cn.user_id = ?`,
      [req.params.id, user.id]
    );

    if (!creditNote) {
      return res.status(404).json({ success: false, message: 'Credit note not found' });
    }

    const items = await db.all(
      'SELECT * FROM credit_note_items WHERE credit_note_id = ?',
      [creditNote.id]
    );

    res.json({ 
      success: true, 
      creditNote: {
        ...creditNote,
        items
      }
    });
  } catch (error) {
    console.error('Get user credit note error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
