import { Router, Request, Response } from 'express';
import { getDatabase } from '../config/database';
import { authenticateAdmin, authenticateUser } from '../middleware/auth';

const router = Router();

// Helper to log admin action
async function logAdminAction(adminId: number, action: string, resourceType: string, resourceId: number, changes: any, req: Request) {
  const db = getDatabase();
  await db.run(
    `INSERT INTO admin_logs (admin_id, action, resource_type, resource_id, changes, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [adminId, action, resourceType, resourceId, JSON.stringify(changes), req.ip, req.headers['user-agent']]
  );
}

// Helper to generate slug
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Helper to update category product counts
async function updateCategoryProductCounts() {
  const db = getDatabase();
  await db.run(`
    UPDATE categories 
    SET product_count = (
      SELECT COUNT(*) FROM products 
      WHERE products.category_id = categories.id 
      AND products.is_active = 1
    )
  `);
}

// ==================== PUBLIC ROUTES ====================

// GET /api/categories - Get all active categories (for mobile app)
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const includeInactive = req.query.includeInactive === 'true';

    let query = `
      SELECT c.*, 
        (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.is_active = 1 AND p.is_visible = 1) as active_products
      FROM categories c
    `;

    if (!includeInactive) {
      query += ' WHERE c.is_active = 1';
    }

    query += ' ORDER BY c.display_order ASC, c.name ASC';

    const categories = await db.all(query);

    res.json({
      success: true,
      categories,
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch categories' });
  }
});

// GET /api/categories/:id - Get single category with products
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const categoryId = req.params.id;

    // Handle both ID and slug
    const category = await db.get(
      `SELECT * FROM categories WHERE id = ? OR slug = ?`,
      [categoryId, categoryId]
    );

    if (!category) {
      res.status(404).json({ success: false, message: 'Category not found' });
      return;
    }

    // Get products in this category
    const products = await db.all(
      `SELECT * FROM products 
       WHERE category_id = ? AND is_active = 1 AND is_visible = 1
       ORDER BY created_at DESC`,
      [category.id]
    );

    // Get subcategories
    const subcategories = await db.all(
      `SELECT * FROM categories WHERE parent_id = ? AND is_active = 1`,
      [category.id]
    );

    res.json({
      success: true,
      category,
      products,
      subcategories,
    });
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch category' });
  }
});

// ==================== ADMIN ROUTES ====================

// GET /api/categories/admin/list - Get all categories for admin (includes inactive)
router.get('/admin/list', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search as string || '';
    const status = req.query.status as string; // 'active', 'inactive', 'all'

    let whereClause = '1=1';
    const params: any[] = [];

    if (search) {
      whereClause += ` AND (c.name LIKE ? OR c.slug LIKE ? OR c.description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status === 'active') {
      whereClause += ` AND c.is_active = 1`;
    } else if (status === 'inactive') {
      whereClause += ` AND c.is_active = 0`;
    }

    // Get total count
    const countResult = await db.get(
      `SELECT COUNT(*) as total FROM categories c WHERE ${whereClause}`,
      params
    );

    // Get categories with product count
    const categories = await db.all(
      `SELECT c.*,
        (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) as total_products,
        (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.is_active = 1 AND p.is_visible = 1) as active_products,
        (SELECT name FROM categories pc WHERE pc.id = c.parent_id) as parent_name
      FROM categories c
      WHERE ${whereClause}
      ORDER BY c.display_order ASC, c.created_at DESC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      categories,
      pagination: {
        page,
        limit,
        total: countResult?.total || 0,
        totalPages: Math.ceil((countResult?.total || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching admin categories:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch categories' });
  }
});

// GET /api/categories/admin/stats - Get category statistics
router.get('/admin/stats', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();

    const stats = await db.get(`
      SELECT 
        COUNT(*) as total_categories,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_categories,
        SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive_categories
      FROM categories
    `);

    const topCategories = await db.all(`
      SELECT c.*, COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id AND p.is_active = 1
      WHERE c.is_active = 1
      GROUP BY c.id
      ORDER BY product_count DESC
      LIMIT 5
    `);

    res.json({
      success: true,
      stats: {
        totalCategories: stats?.total_categories || 0,
        activeCategories: stats?.active_categories || 0,
        inactiveCategories: stats?.inactive_categories || 0,
      },
      topCategories,
    });
  } catch (error) {
    console.error('Error fetching category stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
});

// POST /api/categories/admin - Create new category
router.post('/admin', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const adminId = (req as any).admin.id;
    const { name, description, image_url, parent_id, display_order } = req.body;

    if (!name || name.trim().length < 2) {
      res.status(400).json({ success: false, message: 'Category name is required (min 2 characters)' });
      return;
    }

    // Generate unique slug
    let slug = generateSlug(name.trim());
    const existingSlug = await db.get('SELECT id FROM categories WHERE slug = ?', [slug]);
    if (existingSlug) {
      slug = `${slug}-${Date.now()}`;
    }

    const result = await db.run(
      `INSERT INTO categories (name, slug, description, image_url, parent_id, display_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [name.trim(), slug, description || null, image_url || null, parent_id || null, display_order || 0]
    );

    const category = await db.get('SELECT * FROM categories WHERE id = ?', [result.lastID]);

    // Log admin action
    await logAdminAction(adminId, 'create_category', 'category', result.lastID as number, { name, slug }, req);

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      category,
    });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ success: false, message: 'Failed to create category' });
  }
});

// PUT /api/categories/admin/:id - Update category
router.put('/admin/:id', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const adminId = (req as any).admin.id;
    const categoryId = parseInt(req.params.id);
    const { name, description, image_url, parent_id, display_order, is_active } = req.body;

    const existing = await db.get('SELECT * FROM categories WHERE id = ?', [categoryId]);
    if (!existing) {
      res.status(404).json({ success: false, message: 'Category not found' });
      return;
    }

    // Don't allow setting parent to self or child
    if (parent_id && parent_id === categoryId) {
      res.status(400).json({ success: false, message: 'Category cannot be its own parent' });
      return;
    }

    let slug = existing.slug;
    if (name && name !== existing.name) {
      slug = generateSlug(name.trim());
      const existingSlug = await db.get('SELECT id FROM categories WHERE slug = ? AND id != ?', [slug, categoryId]);
      if (existingSlug) {
        slug = `${slug}-${Date.now()}`;
      }
    }

    await db.run(
      `UPDATE categories SET
        name = COALESCE(?, name),
        slug = ?,
        description = COALESCE(?, description),
        image_url = COALESCE(?, image_url),
        parent_id = ?,
        display_order = COALESCE(?, display_order),
        is_active = COALESCE(?, is_active),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, slug, description, image_url, parent_id, display_order, is_active, categoryId]
    );

    const category = await db.get('SELECT * FROM categories WHERE id = ?', [categoryId]);

    // Log admin action
    await logAdminAction(adminId, 'update_category', 'category', categoryId, { 
      previous: existing, 
      updated: { name, description, is_active } 
    }, req);

    res.json({
      success: true,
      message: 'Category updated successfully',
      category,
    });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ success: false, message: 'Failed to update category' });
  }
});

// POST /api/categories/admin/:id/toggle - Toggle category status (soft disable)
router.post('/admin/:id/toggle', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const adminId = (req as any).admin.id;
    const categoryId = parseInt(req.params.id);

    const category = await db.get('SELECT * FROM categories WHERE id = ?', [categoryId]);
    if (!category) {
      res.status(404).json({ success: false, message: 'Category not found' });
      return;
    }

    const newStatus = category.is_active ? 0 : 1;

    await db.run(
      'UPDATE categories SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newStatus, categoryId]
    );

    // Log admin action
    await logAdminAction(adminId, newStatus ? 'enable_category' : 'disable_category', 'category', categoryId, {
      previous_status: category.is_active,
      new_status: newStatus,
    }, req);

    res.json({
      success: true,
      message: `Category ${newStatus ? 'enabled' : 'disabled'} successfully`,
      is_active: newStatus,
    });
  } catch (error) {
    console.error('Error toggling category:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle category' });
  }
});

// DELETE /api/categories/admin/:id - Soft delete category (set inactive)
router.delete('/admin/:id', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const adminId = (req as any).admin.id;
    const categoryId = parseInt(req.params.id);

    const category = await db.get('SELECT * FROM categories WHERE id = ?', [categoryId]);
    if (!category) {
      res.status(404).json({ success: false, message: 'Category not found' });
      return;
    }

    // Check for products in this category
    const productCount = await db.get(
      'SELECT COUNT(*) as count FROM products WHERE category_id = ?',
      [categoryId]
    );

    if (productCount && productCount.count > 0) {
      res.status(400).json({ 
        success: false, 
        message: `Cannot delete category with ${productCount.count} products. Remove or reassign products first.` 
      });
      return;
    }

    // Check for subcategories
    const subCategoryCount = await db.get(
      'SELECT COUNT(*) as count FROM categories WHERE parent_id = ?',
      [categoryId]
    );

    if (subCategoryCount && subCategoryCount.count > 0) {
      res.status(400).json({ 
        success: false, 
        message: `Cannot delete category with ${subCategoryCount.count} subcategories. Remove subcategories first.` 
      });
      return;
    }

    // Soft delete - just mark as inactive
    await db.run(
      'UPDATE categories SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [categoryId]
    );

    // Log admin action
    await logAdminAction(adminId, 'delete_category', 'category', categoryId, { name: category.name }, req);

    res.json({
      success: true,
      message: 'Category deleted successfully (soft delete)',
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ success: false, message: 'Failed to delete category' });
  }
});

export default router;
