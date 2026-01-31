import { Router } from 'express';
import { authenticateAdmin } from '../middleware/auth';
import { getDatabase } from '../config/database';

const router = Router();

// Get dashboard stats
router.get('/stats', authenticateAdmin, async (req, res) => {
  try {
    const db = getDatabase();

    // Total revenue
    const revenueResult = await db.get(
      `SELECT COALESCE(SUM(total_amount), 0) as total FROM orders WHERE status != 'cancelled'`
    );

    // Total orders
    const ordersResult = await db.get('SELECT COUNT(*) as total FROM orders');

    // Total users
    const usersResult = await db.get('SELECT COUNT(*) as total FROM users');

    // Total products
    const productsResult = await db.get('SELECT COUNT(*) as total FROM products');

    // Last month stats for comparison
    const lastMonthDate = new Date();
    lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
    const lastMonthStr = lastMonthDate.toISOString().split('T')[0];

    const lastMonthRevenue = await db.get(
      `SELECT COALESCE(SUM(total_amount), 0) as total FROM orders 
       WHERE status != 'cancelled' AND created_at < ?`,
      [lastMonthStr]
    );

    const lastMonthOrders = await db.get(
      'SELECT COUNT(*) as total FROM orders WHERE created_at < ?',
      [lastMonthStr]
    );

    // Calculate percentage changes
    const currentRevenue = revenueResult?.total || 0;
    const prevRevenue = lastMonthRevenue?.total || 1;
    const revenueChange = ((currentRevenue - prevRevenue) / prevRevenue) * 100;

    const currentOrders = ordersResult?.total || 0;
    const prevOrders = lastMonthOrders?.total || 1;
    const ordersChange = ((currentOrders - prevOrders) / prevOrders) * 100;

    res.json({
      success: true,
      stats: {
        totalRevenue: currentRevenue,
        totalOrders: currentOrders,
        totalUsers: usersResult?.total || 0,
        totalProducts: productsResult?.total || 0,
        revenueChange: Math.round(revenueChange * 10) / 10,
        ordersChange: Math.round(ordersChange * 10) / 10,
        usersChange: 15.3, // Mock for now
        productsChange: -2.4, // Mock for now
      },
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get recent orders
router.get('/recent-orders', authenticateAdmin, async (req, res) => {
  try {
    const db = getDatabase();

    const orders = await db.all(
      `SELECT o.id, o.order_number, o.total_amount, o.status, o.created_at,
              u.name as customer_name, u.email as customer_email
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       ORDER BY o.created_at DESC
       LIMIT 5`
    );

    res.json({ success: true, orders });
  } catch (error) {
    console.error('Get recent orders error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get sales chart data
router.get('/sales-chart', authenticateAdmin, async (req, res) => {
  try {
    const db = getDatabase();

    // Get monthly sales for last 7 months
    const months = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthName = date.toLocaleString('default', { month: 'short' });
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];

      const sales = await db.get(
        `SELECT COALESCE(SUM(total_amount), 0) as total FROM orders 
         WHERE status != 'cancelled' AND created_at >= ? AND created_at <= ?`,
        [startOfMonth, endOfMonth]
      );

      const orders = await db.get(
        `SELECT COUNT(*) as total FROM orders 
         WHERE created_at >= ? AND created_at <= ?`,
        [startOfMonth, endOfMonth]
      );

      months.push({
        name: monthName,
        sales: sales?.total || 0,
        orders: orders?.total || 0,
      });
    }

    res.json({ success: true, data: months });
  } catch (error) {
    console.error('Get sales chart error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get top products
router.get('/top-products', authenticateAdmin, async (req, res) => {
  try {
    const db = getDatabase();

    const products = await db.all(
      `SELECT p.id, p.name, 
              COUNT(oi.id) as total_orders,
              SUM(oi.quantity) as total_sales,
              SUM(oi.quantity * oi.price) as revenue
       FROM products p
       LEFT JOIN order_items oi ON p.id = oi.product_id
       LEFT JOIN orders o ON oi.order_id = o.id AND o.status != 'cancelled'
       GROUP BY p.id
       ORDER BY total_sales DESC
       LIMIT 5`
    );

    res.json({ success: true, products });
  } catch (error) {
    console.error('Get top products error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
