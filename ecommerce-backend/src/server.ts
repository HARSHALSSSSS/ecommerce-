import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { initializeDatabase, closeDatabase, getDatabase } from './config/database';
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
import aiRoutes from './routes/aiRoutes.js';
import { geminiService } from './services/geminiService.js';

dotenv.config();

const app: Express = express();
const PORT: number = parseInt(process.env.PORT || '5000', 10);

// Trust proxy - REQUIRED for Render and other reverse proxy deployments
// This allows express-rate-limit to correctly identify users by their real IP
app.set('trust proxy', 1);

app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Ensure DB is initialized before handling any request
app.use(async (req, res, next) => {
  try {
    getDatabase();
    next();
  } catch (err) {
    console.error('Database not initialized:', err);
    res.status(503).json({ success: false, message: 'Database not initialized. Please try again in a moment.' });
  }
});

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

// Returns & Fulfillment
app.use('/api/admin', shipmentRoutes);
app.use('/api/shipments', shipmentRoutes);
app.use('/api/returns', returnRoutes);
app.use('/api/refunds', refundRoutes);
app.use('/api/replacements', replacementRoutes);
app.use('/api/tickets', ticketRoutes);

// Payments & Billing
app.use('/api/payments', paymentRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/credit-notes', creditNoteRoutes);
app.use('/api/notifications', notificationRoutes);

// Marketing & Templates
app.use('/api/admin/templates', templateRoutes);
app.use('/api/admin/event-rules', eventRulesRoutes);
app.use('/api/campaigns', campaignRoutes);

// System Administration
app.use('/api/reports', reportRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/features', featureToggleRoutes);

app.use('/api/ai', aiRoutes);

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ success: true, message: 'Server is running' });
});

// AI service status (no auth - for debugging)
app.get('/api/ai-status', (req: Request, res: Response) => {
  const apiKeySet = !!process.env.GEMINI_API_KEY;
  res.json({ 
    success: true,
    gemini_api_key_set: apiKeySet,
    ai_service_initialized: geminiService.isInitialized(),
    environment: process.env.NODE_ENV
  });
});

// Not found handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Initialize database and start server
async function startServer() {
  try {
    console.log('🚀 Starting Ecommerce Backend Server...');

    // Initialize database first
    await initializeDatabase();
    console.log('✅ Database initialized');

    // Initialize AI service BEFORE server starts (uses same instance as controllers)
    try {
      await geminiService.initialize();
      console.log('🤖 AI service initialized successfully');
    } catch (error) {
      console.warn('⚠️ AI service initialization failed:', error instanceof Error ? error.message : 'Unknown error');
      console.warn('   AI features may not work. Check GEMINI_API_KEY environment variable.');
    }

    // Start server and bind to port
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
      console.log(`📡 API available at http://localhost:${PORT}/api`);
      console.log(`🏥 Health check at http://localhost:${PORT}/api/health`);
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
