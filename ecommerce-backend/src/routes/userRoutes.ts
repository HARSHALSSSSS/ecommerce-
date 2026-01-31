import { Router } from 'express';
import { authenticateAdmin } from '../middleware/auth';
import { getDatabase } from '../config/database';

const router = Router();

// Get all users (admin only)
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const { page = 1, limit = 20, search } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = 'SELECT id, name, email, phone, address, city, is_active, created_at FROM users WHERE 1=1';
    const params: any[] = [];

    if (search) {
      query += ' AND (name LIKE ? OR email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    // Get total count
    const countResult = await db.get(
      query.replace('SELECT id, name, email, phone, address, city, is_active, created_at', 'SELECT COUNT(*) as total'),
      params
    );

    // Get paginated users
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), offset);

    const users = await db.all(query, params);

    // Get order stats for each user
    for (const user of users) {
      const stats = await db.get(
        `SELECT COUNT(*) as total_orders, COALESCE(SUM(total_amount), 0) as total_spent
         FROM orders WHERE user_id = ?`,
        [user.id]
      );
      user.total_orders = stats?.total_orders || 0;
      user.total_spent = stats?.total_spent || 0;
    }

    res.json({
      success: true,
      users,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: countResult?.total || 0,
        totalPages: Math.ceil((countResult?.total || 0) / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get single user
router.get('/:id', authenticateAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const user = await db.get(
      'SELECT id, name, email, phone, address, city, is_active, created_at FROM users WHERE id = ?',
      [req.params.id]
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Get order stats
    const stats = await db.get(
      `SELECT COUNT(*) as total_orders, COALESCE(SUM(total_amount), 0) as total_spent
       FROM orders WHERE user_id = ?`,
      [user.id]
    );
    user.total_orders = stats?.total_orders || 0;
    user.total_spent = stats?.total_spent || 0;

    // Get recent orders
    const recentOrders = await db.all(
      'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 5',
      [user.id]
    );
    user.recent_orders = recentOrders;

    res.json({ success: true, user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Toggle user active status (admin only)
router.patch('/:id/toggle-active', authenticateAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const user = await db.get('SELECT is_active FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const newStatus = user.is_active ? 0 : 1;
    await db.run(
      'UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newStatus, id]
    );

    res.json({ success: true, is_active: !!newStatus });
  } catch (error) {
    console.error('Toggle user active error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update user (admin only)
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { name, email, phone, address, city, is_active } = req.body;

    const existing = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await db.run(
      `UPDATE users SET
        name = COALESCE(?, name),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        address = COALESCE(?, address),
        city = COALESCE(?, city),
        is_active = COALESCE(?, is_active),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, email, phone, address, city, is_active, id]
    );

    const user = await db.get(
      'SELECT id, name, email, phone, address, city, is_active, created_at FROM users WHERE id = ?',
      [id]
    );
    res.json({ success: true, user });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
