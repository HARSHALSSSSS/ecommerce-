/**
 * AI Routes
 * Endpoints for AI features in admin panel
 */

import express from 'express';
import * as aiController from '../controllers/aiController.js';
import { authenticateAdmin, requireRole } from '../middleware/auth.js';
import { geminiService } from '../services/geminiService.js';

const router = express.Router();

// Health check for AI service (no auth required for debugging)
router.get('/status', (req, res) => {
  res.json({
    success: true,
    ai_service_initialized: geminiService.isInitialized(),
    timestamp: new Date().toISOString()
  });
});

// All AI routes require admin authentication
router.use(authenticateAdmin);

// Description Generation
router.post('/generate/description', aiController.generateDescription);

// Image Prompt Generation
router.post('/generate/image', aiController.generateImagePrompt);

// Approval Management
router.get('/approvals/pending', aiController.getPendingApprovals);
router.get('/generations', aiController.getAllGenerations);
router.post('/approvals/:id/approve', aiController.approveGeneration);
router.post('/approvals/:id/reject', aiController.rejectGeneration);

// Quota Management
router.get('/quota/me', aiController.getMyQuota);

// Usage Statistics (Super Admin only)
router.get('/usage/stats', requireRole('super_admin'), aiController.getUsageStats);

// Settings Management (Super Admin only)
router.get('/settings', requireRole('super_admin'), aiController.getAISettings);
router.put('/settings', requireRole('super_admin'), aiController.updateAISettings);

// Initialize AI (called on server startup)
router.post('/initialize', requireRole('super_admin'), aiController.initializeAI);

export default router;
