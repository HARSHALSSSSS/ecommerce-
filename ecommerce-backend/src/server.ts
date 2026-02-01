import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { initializeDatabase, closeDatabase } from './config/database';
import authRoutes from './routes/authRoutes';
import productRoutes from './routes/productRoutes';
import orderRoutes from './routes/orderRoutes';
import userRoutes from './routes/userRoutes';
import storeRoutes from './routes/storeRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import cartRoutes from './routes/cartRoutes';
import rbacRoutes from './routes/rbacRoutes';
import userManagementRoutes from './routes/userManagementRoutes';
import categoryRoutes from './routes/categoryRoutes';
import productManagementRoutes from './routes/productManagementRoutes';
import orderManagementRoutes from './routes/orderManagementRoutes';
import shipmentRoutes from './routes/shipmentRoutes';
import returnRoutes from './routes/returnRoutes';
import refundRoutes from './routes/refundRoutes';
import replacementRoutes from './routes/replacementRoutes';
import ticketRoutes from './routes/ticketRoutes';
import paymentRoutes from './routes/paymentRoutes';
import invoiceRoutes from './routes/invoiceRoutes';
import creditNoteRoutes from './routes/creditNoteRoutes';
import notificationRoutes from './routes/notificationRoutes';
import templateRoutes from './routes/templateRoutes';
import eventRulesRoutes from './routes/eventRulesRoutes';
import campaignRoutes from './routes/campaignRoutes';
import reportRoutes from './routes/reportRoutes';
import auditRoutes from './routes/auditRoutes';
import settingsRoutes from './routes/settingsRoutes';
import featureToggleRoutes from './routes/featureToggleRoutes';

dotenv.config();

const app: Express = express();
const PORT: number = parseInt(process.env.PORT || '5000', 10);

// Middleware
app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Ensure DB is initialized before handling any request
app.use(async (req, res, next) => {
  try {
    const { getDatabase } = require('./config/database');
    getDatabase();
    next();
  } catch (err) {
    console.error('Database not initialized:', err);
    res.status(503).json({ success: false, message: 'Database not initialized. Please try again in a moment.' });
  }
});

// CORS configuration - allow all localhost ports for development
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow all localhost origins for development
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    
    // Check against allowed origins from env
    const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || [];
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    callback(null, true); // Allow all for now in development
  },
  credentials: true,
  optionsSuccessStatus: 200,
}));

// Rate limiting - Increased limits for development
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 500, // limit each IP to 500 requests per minute (much higher for dev)
  message: 'Too many requests from this IP, please try again later.',
});

const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Allow more attempts for testing/development
  message: 'Too many login attempts, please try again later.',
});

app.use('/api/', limiter);
app.use('/api/auth/', authLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderManagementRoutes); // User-facing order routes (my-orders) - MUST come before orderRoutes
app.use('/api/orders', orderRoutes); // Legacy order routes
app.use('/api/admin', orderManagementRoutes); // Admin order management routes
app.use('/api/users', userRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/rbac', rbacRoutes);
app.use('/api/admin', userManagementRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/admin', productManagementRoutes);

// Shipment, Return, Refund, Replacement routes (Phase 5)
app.use('/api/admin', shipmentRoutes);           // Admin shipment management (/admin/couriers, /admin/shipments)
app.use('/api/shipments', shipmentRoutes);       // User shipment tracking (/tracking/:orderId)
app.use('/api/returns', returnRoutes);           // All return routes (user: /reasons, /actions, /request, /my-returns; admin: /admin/*)
app.use('/api/refunds', refundRoutes);           // All refund routes (user: /my-refunds, /order/:orderId; admin: /admin/*)
app.use('/api/replacements', replacementRoutes); // All replacement routes (user: /my-replacements; admin: /admin/*)
app.use('/api/tickets', ticketRoutes);           // All ticket routes (user: /, /my-tickets; admin: /admin/*)

// Payment, Invoice & Notification routes (Phase 7)
app.use('/api/payments', paymentRoutes);         // All payment routes (user: /user/history, /user/:id; admin: /, /:id, /:id/status)
app.use('/api/invoices', invoiceRoutes);         // All invoice routes (user: /user/list, /user/:id; admin: /, /:id, /generate, /:id/pdf)
app.use('/api/credit-notes', creditNoteRoutes);  // All credit note routes (user: /user/list, /user/:id; admin: /, /:id, /:id/apply)
app.use('/api/notifications', notificationRoutes); // All notification routes (user: /user/list, /user/preferences; admin: /, /send, /templates)

// Notification, Email & Marketing routes (Phase 8)
app.use('/api/admin/templates', templateRoutes);      // Template management with versioning
app.use('/api/admin/event-rules', eventRulesRoutes);  // Event trigger rules for notifications
app.use('/api/campaigns', campaignRoutes);            // Marketing campaigns, segments, category rules

// Reports, Audit & System Settings routes (Phase 9)
app.use('/api/reports', reportRoutes);                // Sales, tax, order analytics with export
app.use('/api/audit', auditRoutes);                   // System-wide audit logs (WORM-compliant)
app.use('/api/settings', settingsRoutes);             // System configuration with version control
app.use('/api/features', featureToggleRoutes);        // Feature toggles with kill-switch support

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ success: true, message: 'Server is running' });
});

// Not found handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Initialize database and start server
async function startServer() {
  try {
    console.log('🚀 Starting Ecommerce Backend Server...');

    // Initialize database
    await initializeDatabase();

    // Start server on all network interfaces (0.0.0.0) so mobile devices can connect
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
      console.log(`📡 API available at http://localhost:${PORT}/api`);
      console.log(`🏥 Health check at http://localhost:${PORT}/api/health`);
      console.log(`📱 For mobile devices, use your computer's IP address:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n👋 Shutting down gracefully...');
  await closeDatabase();
  process.exit(0);
});

startServer();

export default app;
