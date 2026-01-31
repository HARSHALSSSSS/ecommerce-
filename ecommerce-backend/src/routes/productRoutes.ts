import { Router } from 'express';
import { authenticateAdmin } from '../middleware/auth';
import { getDatabase } from '../config/database';

const router = Router();

// Get all products
router.get('/', async (req, res) => {
  try {
    const db = getDatabase();
    const { page = 1, limit = 20, category, search, visible } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = 'SELECT * FROM products WHERE is_active = 1';
    const params: any[] = [];

    // By default, only show visible products to public (mobile app)
    // Admin can pass visible=false to see hidden products
    if (visible !== 'false') {
      query += ' AND is_visible = 1';
    }

    if (category && category !== 'All') {
      query += ' AND category = ?';
      params.push(category);
    }

    if (search) {
      query += ' AND (name LIKE ? OR sku LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    // Get total count
    const countResult = await db.get(
      query.replace('SELECT *', 'SELECT COUNT(*) as total'),
      params
    );

    // Get paginated products
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), offset);

    const products = await db.all(query, params);

    res.json({
      success: true,
      products,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: countResult?.total || 0,
        totalPages: Math.ceil((countResult?.total || 0) / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get single product
router.get('/:id', async (req, res) => {
  try {
    const db = getDatabase();
    const product = await db.get('SELECT * FROM products WHERE id = ?', [req.params.id]);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, product });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create product (admin only)
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const {
      name,
      description,
      price,
      discount_percent = 0,
      category,
      image_url,
      store_id,
      stock_quantity = 0,
      sku,
    } = req.body;

    if (!name || !price) {
      return res.status(400).json({ success: false, message: 'Name and price are required' });
    }

    const result = await db.run(
      `INSERT INTO products (name, description, price, discount_percent, category, image_url, store_id, stock_quantity, sku)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, description, price, discount_percent, category, image_url, store_id, stock_quantity, sku]
    );

    const product = await db.get('SELECT * FROM products WHERE id = ?', [result.lastID]);

    res.status(201).json({ success: true, product });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update product (admin only)
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const {
      name,
      description,
      price,
      discount_percent,
      category,
      image_url,
      store_id,
      stock_quantity,
      sku,
      is_active,
    } = req.body;

    const existing = await db.get('SELECT * FROM products WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    await db.run(
      `UPDATE products SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        price = COALESCE(?, price),
        discount_percent = COALESCE(?, discount_percent),
        category = COALESCE(?, category),
        image_url = COALESCE(?, image_url),
        store_id = COALESCE(?, store_id),
        stock_quantity = COALESCE(?, stock_quantity),
        sku = COALESCE(?, sku),
        is_active = COALESCE(?, is_active),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, description, price, discount_percent, category, image_url, store_id, stock_quantity, sku, is_active, id]
    );

    const product = await db.get('SELECT * FROM products WHERE id = ?', [id]);
    res.json({ success: true, product });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete product (admin only)
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const existing = await db.get('SELECT * FROM products WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    await db.run('DELETE FROM products WHERE id = ?', [id]);
    res.json({ success: true, message: 'Product deleted' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
