import { Router } from 'express';
import { authenticateAdmin } from '../middleware/auth';
import { getDatabase } from '../config/database';

const router = Router();

// Get all stores
router.get('/', async (req, res) => {
  try {
    const db = getDatabase();
    const { page = 1, limit = 20, search } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = 'SELECT * FROM stores WHERE 1=1';
    const params: any[] = [];

    if (search) {
      query += ' AND (name LIKE ? OR location LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    // Get total count
    const countResult = await db.get(
      query.replace('SELECT *', 'SELECT COUNT(*) as total'),
      params
    );

    // Get paginated stores
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), offset);

    const stores = await db.all(query, params);

    res.json({
      success: true,
      stores,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: countResult?.total || 0,
        totalPages: Math.ceil((countResult?.total || 0) / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get stores error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get single store
router.get('/:id', async (req, res) => {
  try {
    const db = getDatabase();
    const store = await db.get('SELECT * FROM stores WHERE id = ?', [req.params.id]);

    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }

    // Get store products
    const products = await db.all(
      'SELECT * FROM products WHERE store_id = ? ORDER BY created_at DESC LIMIT 10',
      [store.id]
    );
    store.products = products;

    res.json({ success: true, store });
  } catch (error) {
    console.error('Get store error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create store (admin only)
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const { name, location, order_processed, image_url, description } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Store name is required' });
    }

    const result = await db.run(
      `INSERT INTO stores (name, location, order_processed, image_url, description)
       VALUES (?, ?, ?, ?, ?)`,
      [name, location, order_processed || '2 Hours', image_url, description]
    );

    const store = await db.get('SELECT * FROM stores WHERE id = ?', [result.lastID]);
    res.status(201).json({ success: true, store });
  } catch (error) {
    console.error('Create store error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update store (admin only)
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { name, location, order_processed, image_url, description, is_active } = req.body;

    const existing = await db.get('SELECT * FROM stores WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }

    await db.run(
      `UPDATE stores SET
        name = COALESCE(?, name),
        location = COALESCE(?, location),
        order_processed = COALESCE(?, order_processed),
        image_url = COALESCE(?, image_url),
        description = COALESCE(?, description),
        is_active = COALESCE(?, is_active),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, location, order_processed, image_url, description, is_active, id]
    );

    const store = await db.get('SELECT * FROM stores WHERE id = ?', [id]);
    res.json({ success: true, store });
  } catch (error) {
    console.error('Update store error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete store (admin only)
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const existing = await db.get('SELECT * FROM stores WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }

    await db.run('DELETE FROM stores WHERE id = ?', [id]);
    res.json({ success: true, message: 'Store deleted' });
  } catch (error) {
    console.error('Delete store error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
