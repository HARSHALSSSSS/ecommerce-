import { Router, Request, Response } from 'express';
import { getDatabase } from '../config/database';
import { authenticateAdmin } from '../middleware/auth';

const router = Router();

// Helper function to get date range
function getDateRange(period: string): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString().split('T')[0];
  let start: Date;

  switch (period) {
    case 'today':
      start = now;
      break;
    case 'yesterday':
      start = new Date(now.setDate(now.getDate() - 1));
      break;
    case 'week':
      start = new Date(now.setDate(now.getDate() - 7));
      break;
    case 'month':
      start = new Date(now.setMonth(now.getMonth() - 1));
      break;
    case 'quarter':
      start = new Date(now.setMonth(now.getMonth() - 3));
      break;
    case 'year':
      start = new Date(now.setFullYear(now.getFullYear() - 1));
      break;
    default:
      start = new Date(now.setMonth(now.getMonth() - 1));
  }

  return { start: start.toISOString().split('T')[0], end };
}

// Get Sales Report
router.get('/sales', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { period = 'month', start_date, end_date } = req.query;

    const dateRange = start_date && end_date 
      ? { start: start_date as string, end: end_date as string }
      : getDateRange(period as string);

    // Check cache first
    const cacheKey = `sales_${dateRange.start}_${dateRange.end}`;
    const cached = await db.get(
      `SELECT report_data FROM report_cache 
       WHERE report_type = 'sales' AND report_key = ? AND expires_at > datetime('now')`,
      [cacheKey]
    );

    if (cached) {
      return res.json({
        success: true,
        data: JSON.parse(cached.report_data),
        cached: true
      });
    }

    // Sales summary
    const salesSummary = await db.get(`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COALESCE(AVG(total_amount), 0) as average_order_value,
        COUNT(DISTINCT user_id) as unique_customers
      FROM orders
      WHERE created_at::date BETWEEN $1 AND $2
        AND status != 'cancelled'
    `, [dateRange.start, dateRange.end]);

    // Daily sales trend
    const dailySales = await db.all(`
      SELECT 
        created_at::date as date,
        COUNT(*) as orders,
        COALESCE(SUM(total_amount), 0) as revenue
      FROM orders
      WHERE created_at::date BETWEEN $1 AND $2
        AND status != 'cancelled'
      GROUP BY created_at::date
      ORDER BY date
    `, [dateRange.start, dateRange.end]);

    // Top selling products
    const topProducts = await db.all(`
      SELECT 
        p.id,
        p.name,
        p.image_url,
        SUM(oi.quantity) as units_sold,
        SUM(oi.quantity * oi.price) as revenue
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      JOIN orders o ON o.id = oi.order_id
      WHERE o.created_at::date BETWEEN $1 AND $2
        AND o.status != 'cancelled'
      GROUP BY p.id
      ORDER BY units_sold DESC
      LIMIT 10
    `, [dateRange.start, dateRange.end]);

    // Sales by category
    const salesByCategory = await db.all(`
      SELECT 
        c.name as category,
        COUNT(DISTINCT o.id) as orders,
        SUM(oi.quantity) as units_sold,
        SUM(oi.quantity * oi.price) as revenue
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      JOIN categories c ON c.id = p.category_id
      JOIN orders o ON o.id = oi.order_id
      WHERE o.created_at::date BETWEEN $1 AND $2
        AND o.status != 'cancelled'
      GROUP BY c.id
      ORDER BY revenue DESC
    `, [dateRange.start, dateRange.end]);

    // Sales by status
    const salesByStatus = await db.all(`
      SELECT 
        status,
        COUNT(*) as count,
        COALESCE(SUM(total_amount), 0) as revenue
      FROM orders
      WHERE created_at::date BETWEEN $1 AND $2
      GROUP BY status
    `, [dateRange.start, dateRange.end]);

    // Payment method breakdown
    const paymentMethods = await db.all(`
      SELECT 
        COALESCE(payment_method, 'unknown') as method,
        COUNT(*) as count,
        COALESCE(SUM(total_amount), 0) as revenue
      FROM orders
      WHERE created_at::date BETWEEN $1 AND $2
        AND status != 'cancelled'
      GROUP BY payment_method
    `, [dateRange.start, dateRange.end]);

    const reportData = {
      period: dateRange,
      summary: salesSummary,
      daily_sales: dailySales,
      top_products: topProducts,
      sales_by_category: salesByCategory,
      sales_by_status: salesByStatus,
      payment_methods: paymentMethods
    };

    // Cache the report (expires in 1 hour)
    await db.run(
      `INSERT OR REPLACE INTO report_cache (report_type, report_key, report_data, expires_at, generated_by)
       VALUES ('sales', ?, ?, datetime('now', '+1 hour'), ?)`,
      [cacheKey, JSON.stringify(reportData), (req as any).admin?.id]
    );

    res.json({
      success: true,
      data: reportData,
      cached: false
    });

  } catch (error) {
    console.error('Error generating sales report:', error);
    res.status(500).json({ success: false, message: 'Failed to generate sales report' });
  }
});

// Get Tax Report
router.get('/tax', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { period = 'month', start_date, end_date } = req.query;

    const dateRange = start_date && end_date 
      ? { start: start_date as string, end: end_date as string }
      : getDateRange(period as string);

    // Tax summary
    const taxSummary = await db.get(`
      SELECT 
        COUNT(*) as taxable_orders,
        COALESCE(SUM(total_amount), 0) as gross_revenue,
        COALESCE(SUM(tax_amount), 0) as total_tax_collected,
        COALESCE(AVG(tax_amount), 0) as average_tax_per_order
      FROM orders
      WHERE created_at::date BETWEEN $1 AND $2
        AND status NOT IN ('cancelled', 'refunded')
        AND tax_amount > 0
    `, [dateRange.start, dateRange.end]);

    // Daily tax breakdown
    const dailyTax = await db.all(`
      SELECT 
        created_at::date as date,
        COUNT(*) as orders,
        COALESCE(SUM(total_amount), 0) as gross_revenue,
        COALESCE(SUM(tax_amount), 0) as tax_collected
      FROM orders
      WHERE created_at::date BETWEEN $1 AND $2
        AND status NOT IN ('cancelled', 'refunded')
      GROUP BY created_at::date
      ORDER BY date
    `, [dateRange.start, dateRange.end]);

    // Tax by category
    const taxByCategory = await db.all(`
      SELECT 
        c.name as category,
        COUNT(DISTINCT o.id) as orders,
        COALESCE(SUM(o.tax_amount), 0) as tax_collected
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products p ON p.id = oi.product_id
      JOIN categories c ON c.id = p.category_id
      WHERE o.created_at::date BETWEEN $1 AND $2
        AND o.status NOT IN ('cancelled', 'refunded')
      GROUP BY c.id
      ORDER BY tax_collected DESC
    `, [dateRange.start, dateRange.end]);

    res.json({
      success: true,
      data: {
        period: dateRange,
        summary: taxSummary,
        daily_tax: dailyTax,
        tax_by_category: taxByCategory
      }
    });

  } catch (error) {
    console.error('Error generating tax report:', error);
    res.status(500).json({ success: false, message: 'Failed to generate tax report' });
  }
});

// Get Order Analytics Report
router.get('/orders', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { period = 'month', start_date, end_date } = req.query;

    const dateRange = start_date && end_date 
      ? { start: start_date as string, end: end_date as string }
      : getDateRange(period as string);

    // Order summary
    const orderSummary = await db.get(`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = 'completed' OR status = 'delivered' THEN 1 END) as completed_orders,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
        COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_orders,
        COUNT(CASE WHEN status = 'shipped' THEN 1 END) as shipped_orders,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
        COUNT(CASE WHEN status = 'refunded' THEN 1 END) as refunded_orders,
        ROUND(CAST(COUNT(CASE WHEN status = 'completed' OR status = 'delivered' THEN 1 END) AS FLOAT) / 
              NULLIF(COUNT(*), 0) * 100, 2) as fulfillment_rate
      FROM orders
      WHERE created_at::date BETWEEN $1 AND $2
    `, [dateRange.start, dateRange.end]);

    // Daily order trend
    const dailyOrders = await db.all(`
      SELECT 
        created_at::date as date,
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'completed' OR status = 'delivered' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled
      FROM orders
      WHERE created_at::date BETWEEN $1 AND $2
      GROUP BY created_at::date
      ORDER BY date
    `, [dateRange.start, dateRange.end]);

    // Average processing time
    const processingTime = await db.get(`
      SELECT 
        AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600) as avg_hours_to_process
      FROM orders
      WHERE created_at::date BETWEEN $1 AND $2
        AND status IN ('completed', 'delivered', 'shipped')
    `, [dateRange.start, dateRange.end]);

    // Orders by hour of day
    const ordersByHour = await db.all(`
      SELECT 
        EXTRACT(HOUR FROM created_at) as hour,
        COUNT(*) as count
      FROM orders
      WHERE created_at::date BETWEEN $1 AND $2
      GROUP BY hour
      ORDER BY hour
    `, [dateRange.start, dateRange.end]);

    // Orders by day of week
    const ordersByDay = await db.all(`
      SELECT 
        CASE EXTRACT(DOW FROM created_at)
          WHEN 0 THEN 'Sunday'
          WHEN 1 THEN 'Monday'
          WHEN 2 THEN 'Tuesday'
          WHEN 3 THEN 'Wednesday'
          WHEN 4 THEN 'Thursday'
          WHEN 5 THEN 'Friday'
          WHEN 6 THEN 'Saturday'
        END as day,
        COUNT(*) as count
      FROM orders
      WHERE created_at::date BETWEEN $1 AND $2
      GROUP BY EXTRACT(DOW FROM created_at)
      ORDER BY EXTRACT(DOW FROM created_at)
    `, [dateRange.start, dateRange.end]);

    res.json({
      success: true,
      data: {
        period: dateRange,
        summary: orderSummary,
        daily_orders: dailyOrders,
        processing_time: processingTime,
        orders_by_hour: ordersByHour,
        orders_by_day: ordersByDay
      }
    });

  } catch (error) {
    console.error('Error generating order analytics:', error);
    res.status(500).json({ success: false, message: 'Failed to generate order analytics' });
  }
});

// Get Customers Report
router.get('/customers', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { period = 'month', start_date, end_date } = req.query;

    const dateRange = start_date && end_date 
      ? { start: start_date as string, end: end_date as string }
      : getDateRange(period as string);

    // Customer summary
    const customerSummary = await db.get(`
      SELECT 
        COUNT(*) as total_customers,
        COUNT(CASE WHEN created_at::date BETWEEN $1 AND $2 THEN 1 END) as new_customers
      FROM users
    `, [dateRange.start, dateRange.end]);

    // Daily new customers
    const dailyNewCustomers = await db.all(`
      SELECT 
        created_at::date as date,
        COUNT(*) as count
      FROM users
      WHERE created_at::date BETWEEN $1 AND $2
      GROUP BY created_at::date
      ORDER BY date
    `, [dateRange.start, dateRange.end]);

    // Top customers by spending
    const topCustomers = await db.all(`
      SELECT 
        u.id,
        u.name,
        u.email,
        COUNT(o.id) as total_orders,
        COALESCE(SUM(o.total_amount), 0) as total_spent
      FROM users u
      LEFT JOIN orders o ON o.user_id = u.id AND o.status != 'cancelled'
      WHERE o.created_at::date BETWEEN $1 AND $2
      GROUP BY u.id
      ORDER BY total_spent DESC
      LIMIT 10
    `, [dateRange.start, dateRange.end]);

    // Customer retention (repeat customers)
    const repeatCustomers = await db.get(`
      SELECT 
        COUNT(DISTINCT user_id) as repeat_customers
      FROM (
        SELECT user_id, COUNT(*) as order_count
        FROM orders
        WHERE created_at::date BETWEEN $1 AND $2
          AND status != 'cancelled'
        GROUP BY user_id
        HAVING COUNT(*) > 1
      ) as repeat_orders
    `, [dateRange.start, dateRange.end]);

    res.json({
      success: true,
      data: {
        period: dateRange,
        summary: { ...customerSummary, repeat_customers: repeatCustomers?.repeat_customers || 0 },
        daily_new_customers: dailyNewCustomers,
        top_customers: topCustomers
      }
    });

  } catch (error) {
    console.error('Error generating customer report:', error);
    res.status(500).json({ success: false, message: 'Failed to generate customer report' });
  }
});

// Get Inventory Report
router.get('/inventory', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();

    // Inventory summary
    const inventorySummary = await db.get(`
      SELECT 
        COUNT(*) as total_products,
        COUNT(CASE WHEN stock_quantity <= low_stock_threshold THEN 1 END) as low_stock,
        COUNT(CASE WHEN stock_quantity = 0 THEN 1 END) as out_of_stock,
        COALESCE(SUM(stock_quantity), 0) as total_units,
        COALESCE(SUM(stock_quantity * price), 0) as inventory_value
      FROM products
      WHERE is_active = 1
    `);

    // Products needing reorder
    const reorderProducts = await db.all(`
      SELECT 
        id, name, sku, stock_quantity, low_stock_threshold, reorder_quantity, price,
        stock_quantity * price as value
      FROM products
      WHERE is_active = 1 AND stock_quantity <= low_stock_threshold
      ORDER BY stock_quantity ASC
      LIMIT 20
    `);

    // Inventory by category
    const inventoryByCategory = await db.all(`
      SELECT 
        c.name as category,
        COUNT(p.id) as products,
        COALESCE(SUM(p.stock_quantity), 0) as total_units,
        COALESCE(SUM(p.stock_quantity * p.price), 0) as value
      FROM products p
      JOIN categories c ON c.id = p.category_id
      WHERE p.is_active = 1
      GROUP BY c.id
      ORDER BY value DESC
    `);

    // Recent stock changes
    const recentStockChanges = await db.all(`
      SELECT 
        il.id,
        p.name as product_name,
        il.change_type,
        il.change_quantity,
        il.previous_quantity,
        il.new_quantity,
        il.reason,
        il.created_at
      FROM inventory_logs il
      JOIN products p ON p.id = il.product_id
      ORDER BY il.created_at DESC
      LIMIT 20
    `);

    res.json({
      success: true,
      data: {
        summary: inventorySummary,
        reorder_products: reorderProducts,
        inventory_by_category: inventoryByCategory,
        recent_stock_changes: recentStockChanges
      }
    });

  } catch (error) {
    console.error('Error generating inventory report:', error);
    res.status(500).json({ success: false, message: 'Failed to generate inventory report' });
  }
});

// Export Report
router.post('/export', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { report_type, format = 'csv', parameters } = req.body;
    const adminId = (req as any).admin?.id;

    if (!report_type) {
      return res.status(400).json({ success: false, message: 'Report type is required' });
    }

    // Create export record
    const fileName = `${report_type}_${new Date().toISOString().split('T')[0]}_${Date.now()}.${format}`;
    
    const result = await db.run(
      `INSERT INTO report_exports (report_type, file_name, format, parameters, status, exported_by)
       VALUES (?, ?, ?, ?, 'completed', ?)`,
      [report_type, fileName, format, JSON.stringify(parameters || {}), adminId]
    );

    // Log audit
    await db.run(
      `INSERT INTO audit_logs (action_type, entity_type, entity_id, admin_id, description, severity)
       VALUES ('export', 'report', ?, ?, ?, 'info')`,
      [result.lastID, adminId, `Exported ${report_type} report as ${format}`]
    );

    res.json({
      success: true,
      data: {
        id: result.lastID,
        file_name: fileName,
        format,
        status: 'completed'
      }
    });

  } catch (error) {
    console.error('Error exporting report:', error);
    res.status(500).json({ success: false, message: 'Failed to export report' });
  }
});

// Get Export History
router.get('/exports', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const exports = await db.all(`
      SELECT re.*, a.name as exported_by_name
      FROM report_exports re
      LEFT JOIN admins a ON a.id = re.exported_by
      ORDER BY re.created_at DESC
      LIMIT ? OFFSET ?
    `, [Number(limit), offset]);

    const total = await db.get('SELECT COUNT(*) as count FROM report_exports');

    res.json({
      success: true,
      data: exports,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: total?.count || 0,
        pages: Math.ceil((total?.count || 0) / Number(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching exports:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch exports' });
  }
});

// Clear report cache
router.delete('/cache', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { report_type } = req.query;

    if (report_type) {
      await db.run('DELETE FROM report_cache WHERE report_type = ?', [report_type]);
    } else {
      await db.run('DELETE FROM report_cache');
    }

    res.json({ success: true, message: 'Report cache cleared' });

  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({ success: false, message: 'Failed to clear cache' });
  }
});

export default router;
