import { Router, Request, Response } from 'express';
import { getDatabase } from '../config/database';
import { authenticateAdmin } from '../middleware/auth';

// Simple file upload middleware for CSV (no external dependency needed)
interface MulterRequest extends Request {
  file?: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
  };
}

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

// Helper to create product version
async function createProductVersion(productId: number, changes: any, changedBy: number) {
  const db = getDatabase();
  
  // Get current version
  const product = await db.get('SELECT version FROM products WHERE id = ?', [productId]);
  const newVersion = (product?.version || 0) + 1;
  
  // Update product version
  await db.run('UPDATE products SET version = ? WHERE id = ?', [newVersion, productId]);
  
  // Create version record
  await db.run(
    `INSERT INTO product_versions (product_id, version, changes, changed_by)
     VALUES (?, ?, ?, ?)`,
    [productId, newVersion, JSON.stringify(changes), changedBy]
  );
  
  return newVersion;
}

// Helper to check and create low stock alerts
async function checkLowStockAlert(productId: number) {
  const db = getDatabase();
  
  const product = await db.get(
    'SELECT id, name, stock_quantity, low_stock_threshold FROM products WHERE id = ?',
    [productId]
  );
  
  if (!product) return;
  
  if (product.stock_quantity <= product.low_stock_threshold) {
    // Check if there's already an unresolved alert
    const existingAlert = await db.get(
      'SELECT id FROM low_stock_alerts WHERE product_id = ? AND is_resolved = 0',
      [productId]
    );
    
    if (!existingAlert) {
      const alertType = product.stock_quantity === 0 ? 'out_of_stock' : 'low_stock';
      await db.run(
        `INSERT INTO low_stock_alerts (product_id, alert_type, current_stock, threshold)
         VALUES (?, ?, ?, ?)`,
        [productId, alertType, product.stock_quantity, product.low_stock_threshold]
      );
    }
  } else {
    // Resolve any existing alerts
    await db.run(
      `UPDATE low_stock_alerts SET is_resolved = 1, resolved_at = CURRENT_TIMESTAMP 
       WHERE product_id = ? AND is_resolved = 0`,
      [productId]
    );
  }
}

// Helper to log inventory change
async function logInventoryChange(
  productId: number, 
  previousQty: number, 
  newQty: number, 
  changeType: string, 
  reason: string, 
  changedBy: number | null, 
  orderId: number | null = null
) {
  const db = getDatabase();
  await db.run(
    `INSERT INTO inventory_logs (product_id, previous_quantity, new_quantity, change_quantity, change_type, reason, changed_by, order_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [productId, previousQty, newQty, newQty - previousQty, changeType, reason, changedBy, orderId]
  );
}

// ==================== PRODUCT LIST ====================

// GET /api/admin/products - Get all products with advanced filtering
router.get('/products', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search as string || '';
    const category = req.query.category as string;
    const status = req.query.status as string; // 'active', 'inactive', 'hidden', 'visible', 'all'
    const stockStatus = req.query.stockStatus as string; // 'in_stock', 'low_stock', 'out_of_stock'
    const sortBy = req.query.sortBy as string || 'created_at';
    const sortOrder = req.query.sortOrder as string || 'DESC';

    let whereClause = '1=1';
    const params: any[] = [];

    if (search) {
      whereClause += ` AND (p.name LIKE ? OR p.sku LIKE ? OR p.description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (category) {
      whereClause += ` AND (p.category_id = ? OR p.category = ?)`;
      params.push(category, category);
    }

    if (status === 'active') {
      whereClause += ` AND p.is_active = 1`;
    } else if (status === 'inactive') {
      whereClause += ` AND p.is_active = 0`;
    } else if (status === 'visible') {
      whereClause += ` AND p.is_visible = 1 AND p.is_active = 1`;
    } else if (status === 'hidden') {
      whereClause += ` AND p.is_visible = 0`;
    }

    if (stockStatus === 'out_of_stock') {
      whereClause += ` AND p.stock_quantity = 0`;
    } else if (stockStatus === 'low_stock') {
      whereClause += ` AND p.stock_quantity > 0 AND p.stock_quantity <= p.low_stock_threshold`;
    } else if (stockStatus === 'in_stock') {
      whereClause += ` AND p.stock_quantity > p.low_stock_threshold`;
    }

    // Get total count
    const countResult = await db.get(
      `SELECT COUNT(*) as total FROM products p WHERE ${whereClause}`,
      params
    );

    // Allowed sort columns
    const allowedSortColumns = ['created_at', 'name', 'price', 'stock_quantity', 'updated_at'];
    const sortColumn = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Get products with category info
    const products = await db.all(
      `SELECT p.*,
        c.name as category_name,
        s.name as store_name,
        CASE 
          WHEN p.stock_quantity = 0 THEN 'out_of_stock'
          WHEN p.stock_quantity <= p.low_stock_threshold THEN 'low_stock'
          ELSE 'in_stock'
        END as stock_status
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN stores s ON s.id = p.store_id
      WHERE ${whereClause}
      ORDER BY p.${sortColumn} ${order}
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      products,
      pagination: {
        page,
        limit,
        total: countResult?.total || 0,
        totalPages: Math.ceil((countResult?.total || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch products' });
  }
});

// GET /api/admin/products/stats - Get product statistics
router.get('/products/stats', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();

    const stats = await db.get(`
      SELECT 
        COUNT(*) as total_products,
        SUM(CASE WHEN is_active = 1 AND is_visible = 1 THEN 1 ELSE 0 END) as active_visible,
        SUM(CASE WHEN is_active = 1 AND is_visible = 0 THEN 1 ELSE 0 END) as active_hidden,
        SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive,
        SUM(CASE WHEN stock_quantity = 0 THEN 1 ELSE 0 END) as out_of_stock,
        SUM(CASE WHEN stock_quantity > 0 AND stock_quantity <= low_stock_threshold THEN 1 ELSE 0 END) as low_stock,
        SUM(stock_quantity) as total_inventory,
        AVG(price) as avg_price
      FROM products
    `);

    const lowStockAlerts = await db.get(`
      SELECT COUNT(*) as count FROM low_stock_alerts WHERE is_resolved = 0
    `);

    const recentChanges = await db.all(`
      SELECT pv.*, p.name as product_name
      FROM product_versions pv
      JOIN products p ON p.id = pv.product_id
      ORDER BY pv.created_at DESC
      LIMIT 5
    `);

    res.json({
      success: true,
      stats: {
        totalProducts: stats?.total_products || 0,
        activeVisible: stats?.active_visible || 0,
        activeHidden: stats?.active_hidden || 0,
        inactive: stats?.inactive || 0,
        outOfStock: stats?.out_of_stock || 0,
        lowStock: stats?.low_stock || 0,
        totalInventory: stats?.total_inventory || 0,
        avgPrice: stats?.avg_price || 0,
        unresolvedAlerts: lowStockAlerts?.count || 0,
      },
      recentChanges,
    });
  } catch (error) {
    console.error('Error fetching product stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
});

// ==================== PRODUCT DETAIL ====================

// GET /api/admin/products/:id - Get product detail with version history
router.get('/products/:id', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const productId = parseInt(req.params.id);

    const product = await db.get(
      `SELECT p.*,
        c.name as category_name,
        s.name as store_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN stores s ON s.id = p.store_id
      WHERE p.id = ?`,
      [productId]
    );

    if (!product) {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }

    // Get version history
    const versions = await db.all(
      `SELECT pv.*, a.name as changed_by_name
       FROM product_versions pv
       LEFT JOIN admins a ON a.id = pv.changed_by
       WHERE pv.product_id = ?
       ORDER BY pv.version DESC
       LIMIT 10`,
      [productId]
    );

    // Get inventory logs
    const inventoryLogs = await db.all(
      `SELECT il.*, a.name as changed_by_name
       FROM inventory_logs il
       LEFT JOIN admins a ON a.id = il.changed_by
       WHERE il.product_id = ?
       ORDER BY il.created_at DESC
       LIMIT 10`,
      [productId]
    );

    // Get low stock alerts
    const alerts = await db.all(
      `SELECT * FROM low_stock_alerts WHERE product_id = ? ORDER BY created_at DESC LIMIT 5`,
      [productId]
    );

    res.json({
      success: true,
      product,
      versions,
      inventoryLogs,
      alerts,
    });
  } catch (error) {
    console.error('Error fetching product detail:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch product' });
  }
});

// PUT /api/admin/products/:id - Update product with version control
router.put('/products/:id', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const adminId = (req as any).admin.id;
    const productId = parseInt(req.params.id);
    const {
      name,
      description,
      price,
      discount_percent,
      category_id,
      category,
      image_url,
      store_id,
      stock_quantity,
      sku,
      is_active,
      is_visible,
      low_stock_threshold,
      reorder_quantity,
    } = req.body;

    const existing = await db.get('SELECT * FROM products WHERE id = ?', [productId]);
    if (!existing) {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }

    // Track changes for version history
    const changes: Record<string, { old: any; new: any }> = {};
    const fields = { name, description, price, discount_percent, category_id, category, image_url, store_id, sku, is_active, is_visible, low_stock_threshold, reorder_quantity };
    
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined && value !== existing[key]) {
        changes[key] = { old: existing[key], new: value };
      }
    }

    // Handle stock quantity change separately (logged in inventory)
    if (stock_quantity !== undefined && stock_quantity !== existing.stock_quantity) {
      await logInventoryChange(
        productId,
        existing.stock_quantity,
        stock_quantity,
        'manual_adjustment',
        'Updated via product edit',
        adminId
      );
    }

    await db.run(
      `UPDATE products SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        price = COALESCE(?, price),
        discount_percent = COALESCE(?, discount_percent),
        category_id = COALESCE(?, category_id),
        category = COALESCE(?, category),
        image_url = COALESCE(?, image_url),
        store_id = COALESCE(?, store_id),
        stock_quantity = COALESCE(?, stock_quantity),
        sku = COALESCE(?, sku),
        is_active = COALESCE(?, is_active),
        is_visible = COALESCE(?, is_visible),
        low_stock_threshold = COALESCE(?, low_stock_threshold),
        reorder_quantity = COALESCE(?, reorder_quantity),
        last_stock_update = CASE WHEN ? IS NOT NULL THEN CURRENT_TIMESTAMP ELSE last_stock_update END,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, description, price, discount_percent, category_id, category, image_url, store_id, stock_quantity, sku, is_active, is_visible, low_stock_threshold, reorder_quantity, stock_quantity, productId]
    );

    // Create version record if there are changes
    if (Object.keys(changes).length > 0) {
      await createProductVersion(productId, changes, adminId);
    }

    // Check for low stock alerts
    await checkLowStockAlert(productId);

    const product = await db.get('SELECT * FROM products WHERE id = ?', [productId]);

    // Log admin action
    await logAdminAction(adminId, 'update_product', 'product', productId, changes, req);

    res.json({
      success: true,
      message: 'Product updated successfully',
      product,
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ success: false, message: 'Failed to update product' });
  }
});

// ==================== PRODUCT SHOW/HIDE ====================

// POST /api/admin/products/:id/toggle-visibility - Toggle product visibility
router.post('/products/:id/toggle-visibility', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const adminId = (req as any).admin.id;
    const productId = parseInt(req.params.id);

    const product = await db.get('SELECT * FROM products WHERE id = ?', [productId]);
    if (!product) {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }

    const newVisibility = product.is_visible ? 0 : 1;

    await db.run(
      'UPDATE products SET is_visible = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newVisibility, productId]
    );

    // Create version record
    await createProductVersion(productId, { 
      is_visible: { old: product.is_visible, new: newVisibility } 
    }, adminId);

    // Log admin action
    await logAdminAction(adminId, newVisibility ? 'show_product' : 'hide_product', 'product', productId, {
      previous_visibility: product.is_visible,
      new_visibility: newVisibility,
    }, req);

    res.json({
      success: true,
      message: `Product ${newVisibility ? 'shown' : 'hidden'} successfully`,
      is_visible: newVisibility,
    });
  } catch (error) {
    console.error('Error toggling product visibility:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle visibility' });
  }
});

// POST /api/admin/products/:id/show - Show product
router.post('/products/:id/show', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const adminId = (req as any).admin.id;
    const productId = parseInt(req.params.id);

    const product = await db.get('SELECT * FROM products WHERE id = ?', [productId]);
    if (!product) {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }

    if (product.is_visible === 1) {
      res.json({ success: true, message: 'Product is already visible', is_visible: 1 });
      return;
    }

    await db.run(
      'UPDATE products SET is_visible = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [productId]
    );

    await createProductVersion(productId, { is_visible: { old: 0, new: 1 } }, adminId);
    await logAdminAction(adminId, 'show_product', 'product', productId, {}, req);

    res.json({ success: true, message: 'Product is now visible', is_visible: 1 });
  } catch (error) {
    console.error('Error showing product:', error);
    res.status(500).json({ success: false, message: 'Failed to show product' });
  }
});

// POST /api/admin/products/:id/hide - Hide product
router.post('/products/:id/hide', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const adminId = (req as any).admin.id;
    const productId = parseInt(req.params.id);

    const product = await db.get('SELECT * FROM products WHERE id = ?', [productId]);
    if (!product) {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }

    if (product.is_visible === 0) {
      res.json({ success: true, message: 'Product is already hidden', is_visible: 0 });
      return;
    }

    await db.run(
      'UPDATE products SET is_visible = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [productId]
    );

    await createProductVersion(productId, { is_visible: { old: 1, new: 0 } }, adminId);
    await logAdminAction(adminId, 'hide_product', 'product', productId, {}, req);

    res.json({ success: true, message: 'Product is now hidden', is_visible: 0 });
  } catch (error) {
    console.error('Error hiding product:', error);
    res.status(500).json({ success: false, message: 'Failed to hide product' });
  }
});

// ==================== BULK PRODUCT VISIBILITY ====================

// POST /api/admin/products/bulk-visibility - Bulk show/hide products
router.post('/products/bulk-visibility', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const adminId = (req as any).admin.id;
    const { product_ids, action } = req.body; // action: 'show' or 'hide'

    if (!product_ids || !Array.isArray(product_ids) || product_ids.length === 0) {
      res.status(400).json({ success: false, message: 'Product IDs are required' });
      return;
    }

    if (!['show', 'hide'].includes(action)) {
      res.status(400).json({ success: false, message: 'Action must be "show" or "hide"' });
      return;
    }

    const newVisibility = action === 'show' ? 1 : 0;
    const results = { success: 0, failed: 0, skipped: 0 };

    for (const productId of product_ids) {
      try {
        const product = await db.get('SELECT id, is_visible FROM products WHERE id = ?', [productId]);
        
        if (!product) {
          results.failed++;
          continue;
        }

        // Idempotent: skip if already in desired state
        if (product.is_visible === newVisibility) {
          results.skipped++;
          continue;
        }

        await db.run(
          'UPDATE products SET is_visible = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [newVisibility, productId]
        );

        await createProductVersion(productId, { 
          is_visible: { old: product.is_visible, new: newVisibility } 
        }, adminId);

        results.success++;
      } catch (err) {
        results.failed++;
      }
    }

    // Log admin action
    await logAdminAction(adminId, `bulk_${action}_products`, 'products', 0, {
      product_ids,
      results,
    }, req);

    res.json({
      success: true,
      message: `Bulk ${action} completed`,
      results,
    });
  } catch (error) {
    console.error('Error in bulk visibility:', error);
    res.status(500).json({ success: false, message: 'Failed to process bulk visibility' });
  }
});

// POST /api/admin/products/bulk-visibility-csv - Bulk visibility via CSV upload
router.post('/products/bulk-visibility-csv', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const adminId = (req as any).admin.id;
    const { action, csvData } = req.body;

    if (!csvData) {
      res.status(400).json({ success: false, message: 'CSV data is required' });
      return;
    }

    if (!['show', 'hide'].includes(action)) {
      res.status(400).json({ success: false, message: 'Action must be "show" or "hide"' });
      return;
    }

    // Parse CSV content
    const csvContent = typeof csvData === 'string' ? csvData : '';
    const lines = csvContent.split('\n').filter((line: string) => line.trim());
    
    // Skip header if present
    const startIndex = lines[0]?.toLowerCase().includes('product') || lines[0]?.toLowerCase().includes('id') ? 1 : 0;
    
    const productIdentifiers: (number | string)[] = [];
    for (let i = startIndex; i < lines.length; i++) {
      const values = lines[i].split(',').map((v: string) => v.trim().replace(/"/g, ''));
      if (values[0]) {
        // Could be ID or SKU
        const id = parseInt(values[0]);
        productIdentifiers.push(isNaN(id) ? values[0] : id);
      }
    }

    const newVisibility = action === 'show' ? 1 : 0;
    const results = { success: 0, failed: 0, skipped: 0, notFound: 0 };

    for (const identifier of productIdentifiers) {
      try {
        // Find product by ID or SKU
        const product = await db.get(
          'SELECT id, is_visible FROM products WHERE id = ? OR sku = ?',
          [identifier, identifier]
        );
        
        if (!product) {
          results.notFound++;
          continue;
        }

        // Idempotent: skip if already in desired state
        if (product.is_visible === newVisibility) {
          results.skipped++;
          continue;
        }

        await db.run(
          'UPDATE products SET is_visible = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [newVisibility, product.id]
        );

        await createProductVersion(product.id, { 
          is_visible: { old: product.is_visible, new: newVisibility } 
        }, adminId);

        results.success++;
      } catch (err) {
        results.failed++;
      }
    }

    // Log admin action
    await logAdminAction(adminId, `bulk_csv_${action}_products`, 'products', 0, {
      total_rows: productIdentifiers.length,
      results,
    }, req);

    res.json({
      success: true,
      message: `CSV bulk ${action} completed`,
      totalProcessed: productIdentifiers.length,
      results,
    });
  } catch (error) {
    console.error('Error in CSV bulk visibility:', error);
    res.status(500).json({ success: false, message: 'Failed to process CSV' });
  }
});

// ==================== INVENTORY MANAGEMENT ====================

// GET /api/admin/inventory - Get inventory overview
router.get('/inventory', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const stockStatus = req.query.status as string; // 'all', 'low_stock', 'out_of_stock', 'in_stock'
    const search = req.query.search as string || '';

    let whereClause = 'p.is_active = 1';
    const params: any[] = [];

    if (search) {
      whereClause += ` AND (p.name LIKE ? OR p.sku LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    if (stockStatus === 'out_of_stock') {
      whereClause += ` AND p.stock_quantity = 0`;
    } else if (stockStatus === 'low_stock') {
      whereClause += ` AND p.stock_quantity > 0 AND p.stock_quantity <= p.low_stock_threshold`;
    } else if (stockStatus === 'in_stock') {
      whereClause += ` AND p.stock_quantity > p.low_stock_threshold`;
    }

    const countResult = await db.get(
      `SELECT COUNT(*) as total FROM products p WHERE ${whereClause}`,
      params
    );

    const products = await db.all(
      `SELECT p.id, p.name, p.sku, p.stock_quantity, p.low_stock_threshold, p.reorder_quantity,
        p.last_stock_update, p.is_visible, p.price,
        c.name as category_name,
        CASE 
          WHEN p.stock_quantity = 0 THEN 'out_of_stock'
          WHEN p.stock_quantity <= p.low_stock_threshold THEN 'low_stock'
          ELSE 'in_stock'
        END as stock_status,
        (SELECT COUNT(*) FROM low_stock_alerts lsa WHERE lsa.product_id = p.id AND lsa.is_resolved = 0) as active_alerts
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE ${whereClause}
      ORDER BY p.stock_quantity ASC, p.name ASC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      inventory: products,
      pagination: {
        page,
        limit,
        total: countResult?.total || 0,
        totalPages: Math.ceil((countResult?.total || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch inventory' });
  }
});

// GET /api/admin/inventory/alerts - Get low stock alerts
router.get('/inventory/alerts', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const showResolved = req.query.showResolved === 'true';

    let whereClause = showResolved ? '1=1' : 'lsa.is_resolved = 0';

    const alerts = await db.all(
      `SELECT lsa.*, p.name as product_name, p.sku, p.stock_quantity as current_stock
       FROM low_stock_alerts lsa
       JOIN products p ON p.id = lsa.product_id
       WHERE ${whereClause}
       ORDER BY lsa.created_at DESC
       LIMIT 50`
    );

    const summary = await db.get(`
      SELECT 
        COUNT(*) as total_alerts,
        SUM(CASE WHEN is_resolved = 0 THEN 1 ELSE 0 END) as unresolved,
        SUM(CASE WHEN alert_type = 'out_of_stock' AND is_resolved = 0 THEN 1 ELSE 0 END) as out_of_stock,
        SUM(CASE WHEN alert_type = 'low_stock' AND is_resolved = 0 THEN 1 ELSE 0 END) as low_stock
      FROM low_stock_alerts
    `);

    res.json({
      success: true,
      alerts,
      summary: {
        totalAlerts: summary?.total_alerts || 0,
        unresolved: summary?.unresolved || 0,
        outOfStock: summary?.out_of_stock || 0,
        lowStock: summary?.low_stock || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch alerts' });
  }
});

// PUT /api/admin/inventory/:productId - Update stock quantity
router.put('/inventory/:productId', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const adminId = (req as any).admin.id;
    const productId = parseInt(req.params.productId);
    const { quantity, change_type, reason, low_stock_threshold, reorder_quantity } = req.body;

    const product = await db.get('SELECT * FROM products WHERE id = ?', [productId]);
    if (!product) {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }

    let newQuantity = product.stock_quantity;

    if (quantity !== undefined) {
      if (change_type === 'set') {
        newQuantity = quantity;
      } else if (change_type === 'add') {
        newQuantity = product.stock_quantity + quantity;
      } else if (change_type === 'subtract') {
        newQuantity = Math.max(0, product.stock_quantity - quantity);
      } else {
        // Default to 'set'
        newQuantity = quantity;
      }

      // Log inventory change
      await logInventoryChange(
        productId,
        product.stock_quantity,
        newQuantity,
        change_type || 'manual_adjustment',
        reason || 'Stock updated by admin',
        adminId
      );
    }

    await db.run(
      `UPDATE products SET 
        stock_quantity = ?,
        low_stock_threshold = COALESCE(?, low_stock_threshold),
        reorder_quantity = COALESCE(?, reorder_quantity),
        last_stock_update = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newQuantity, low_stock_threshold, reorder_quantity, productId]
    );

    // Check for low stock alerts
    await checkLowStockAlert(productId);

    const updatedProduct = await db.get(
      `SELECT id, name, sku, stock_quantity, low_stock_threshold, reorder_quantity, last_stock_update
       FROM products WHERE id = ?`,
      [productId]
    );

    // Log admin action
    await logAdminAction(adminId, 'update_inventory', 'product', productId, {
      previous_quantity: product.stock_quantity,
      new_quantity: newQuantity,
      change_type,
      reason,
    }, req);

    res.json({
      success: true,
      message: 'Inventory updated successfully',
      product: updatedProduct,
    });
  } catch (error) {
    console.error('Error updating inventory:', error);
    res.status(500).json({ success: false, message: 'Failed to update inventory' });
  }
});

// POST /api/admin/inventory/bulk-update - Bulk update stock
router.post('/inventory/bulk-update', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const adminId = (req as any).admin.id;
    const { updates } = req.body; // Array of { product_id, quantity, change_type }

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      res.status(400).json({ success: false, message: 'Updates array is required' });
      return;
    }

    const results = { success: 0, failed: 0 };

    for (const update of updates) {
      try {
        const { product_id, quantity, change_type = 'set', reason } = update;
        
        const product = await db.get('SELECT * FROM products WHERE id = ?', [product_id]);
        if (!product) {
          results.failed++;
          continue;
        }

        let newQuantity = product.stock_quantity;
        if (change_type === 'set') {
          newQuantity = quantity;
        } else if (change_type === 'add') {
          newQuantity = product.stock_quantity + quantity;
        } else if (change_type === 'subtract') {
          newQuantity = Math.max(0, product.stock_quantity - quantity);
        }

        await logInventoryChange(
          product_id,
          product.stock_quantity,
          newQuantity,
          change_type,
          reason || 'Bulk stock update',
          adminId
        );

        await db.run(
          `UPDATE products SET stock_quantity = ?, last_stock_update = CURRENT_TIMESTAMP WHERE id = ?`,
          [newQuantity, product_id]
        );

        await checkLowStockAlert(product_id);
        results.success++;
      } catch (err) {
        results.failed++;
      }
    }

    await logAdminAction(adminId, 'bulk_update_inventory', 'products', 0, { results }, req);

    res.json({
      success: true,
      message: 'Bulk inventory update completed',
      results,
    });
  } catch (error) {
    console.error('Error in bulk inventory update:', error);
    res.status(500).json({ success: false, message: 'Failed to process bulk update' });
  }
});

// POST /api/admin/inventory/alerts/:id/resolve - Resolve a low stock alert
router.post('/inventory/alerts/:id/resolve', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const adminId = (req as any).admin.id;
    const alertId = parseInt(req.params.id);

    const alert = await db.get('SELECT * FROM low_stock_alerts WHERE id = ?', [alertId]);
    if (!alert) {
      res.status(404).json({ success: false, message: 'Alert not found' });
      return;
    }

    if (alert.is_resolved) {
      res.json({ success: true, message: 'Alert is already resolved' });
      return;
    }

    await db.run(
      `UPDATE low_stock_alerts SET is_resolved = 1, resolved_at = CURRENT_TIMESTAMP, resolved_by = ?
       WHERE id = ?`,
      [adminId, alertId]
    );

    res.json({
      success: true,
      message: 'Alert resolved successfully',
    });
  } catch (error) {
    console.error('Error resolving alert:', error);
    res.status(500).json({ success: false, message: 'Failed to resolve alert' });
  }
});

// GET /api/admin/inventory/logs - Get inventory change logs
router.get('/inventory/logs', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    const productId = req.query.productId as string;
    const changeType = req.query.changeType as string;

    let whereClause = '1=1';
    const params: any[] = [];

    if (productId) {
      whereClause += ' AND il.product_id = ?';
      params.push(productId);
    }

    if (changeType) {
      whereClause += ' AND il.change_type = ?';
      params.push(changeType);
    }

    const countResult = await db.get(
      `SELECT COUNT(*) as total FROM inventory_logs il WHERE ${whereClause}`,
      params
    );

    const logs = await db.all(
      `SELECT il.*, p.name as product_name, p.sku, a.name as changed_by_name
       FROM inventory_logs il
       JOIN products p ON p.id = il.product_id
       LEFT JOIN admins a ON a.id = il.changed_by
       WHERE ${whereClause}
       ORDER BY il.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      logs,
      pagination: {
        page,
        limit,
        total: countResult?.total || 0,
        totalPages: Math.ceil((countResult?.total || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching inventory logs:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch logs' });
  }
});

// POST /api/admin/products - Create new product
router.post('/products', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const adminId = (req as any).admin.id;
    const {
      name,
      description,
      price,
      discount_percent = 0,
      category_id,
      category,
      image_url,
      store_id,
      stock_quantity = 0,
      sku,
      is_active = 1,
      is_visible = 1,
      low_stock_threshold = 10,
      reorder_quantity = 50,
    } = req.body;

    if (!name || !price) {
      res.status(400).json({ success: false, message: 'Name and price are required' });
      return;
    }

    // Generate SKU if not provided
    let productSku = sku;
    if (!productSku) {
      productSku = `SKU-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    }

    const result = await db.run(
      `INSERT INTO products (name, description, price, discount_percent, category_id, category, image_url, store_id, stock_quantity, sku, is_active, is_visible, low_stock_threshold, reorder_quantity, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [name, description, price, discount_percent, category_id, category, image_url, store_id, stock_quantity, productSku, is_active, is_visible, low_stock_threshold, reorder_quantity]
    );

    const product = await db.get('SELECT * FROM products WHERE id = ?', [result.lastID]);

    // Create initial version
    await db.run(
      `INSERT INTO product_versions (product_id, version, changes, changed_by)
       VALUES (?, 1, ?, ?)`,
      [result.lastID, JSON.stringify({ action: 'created' }), adminId]
    );

    // Check for low stock alerts
    await checkLowStockAlert(result.lastID as number);

    // Log admin action
    await logAdminAction(adminId, 'create_product', 'product', result.lastID as number, { name, price, sku: productSku }, req);

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product,
    });
  } catch (error: any) {
    console.error('Error creating product:', error);
    if (error.message?.includes('UNIQUE constraint failed')) {
      res.status(400).json({ success: false, message: 'SKU already exists' });
      return;
    }
    res.status(500).json({ success: false, message: 'Failed to create product' });
  }
});

export default router;
