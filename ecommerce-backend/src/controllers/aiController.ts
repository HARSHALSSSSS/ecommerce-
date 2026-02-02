/**
 * AI Controller
 * Handles all AI-related endpoints for the admin panel
 */

import { Request, Response } from 'express';
import { geminiService } from '../services/geminiService.js';
import { getDatabase } from '../config/database.js';

// Helper to get db instance
const db = () => getDatabase();

/**
 * Initialize AI service (called on server startup)
 */
export const initializeAI = async (_req: Request, res: Response) => {
  try {
    await geminiService.initialize();
    res.json({ success: true, message: 'AI service initialized' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Generate product description
 */
export const generateDescription = async (req: Request, res: Response) => {
  try {
    const { prompt, productId } = req.body;
    const adminId = req.admin?.id;

    if (!prompt) {
      return res.status(400).json({ success: false, message: 'Prompt is required' });
    }

    // Check quota first
    const quota = await geminiService.checkQuota(adminId);
    if (!quota.canGenerate) {
      return res.status(429).json({ 
        success: false, 
        message: `Daily quota exceeded. Used: ${quota.used}/${quota.dailyLimit}`,
        quota
      });
    }

    const result = await geminiService.generateDescription({
      type: 'description',
      prompt,
      productId,
      adminId
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Get the created generation
    const generation = await db().get(
      'SELECT * FROM ai_generations WHERE id = ?',
      [result.generationId]
    );

    res.json({
      success: true,
      generation,
      quota: await geminiService.checkQuota(adminId)
    });
  } catch (error: any) {
    console.error('Error in generateDescription:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Generate image prompt
 */
export const generateImagePrompt = async (req: Request, res: Response) => {
  try {
    const { prompt, productId } = req.body;
    const adminId = req.admin?.id;

    if (!prompt) {
      return res.status(400).json({ success: false, message: 'Prompt is required' });
    }

    const quota = await geminiService.checkQuota(adminId);
    if (!quota.canGenerate) {
      return res.status(429).json({ 
        success: false, 
        message: `Daily quota exceeded. Used: ${quota.used}/${quota.dailyLimit}`,
        quota
      });
    }

    const result = await geminiService.generateImagePrompt({
      type: 'image',
      prompt,
      productId,
      adminId
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    const generation = await db().get(
      'SELECT * FROM ai_generations WHERE id = ?',
      [result.generationId]
    );

    res.json({
      success: true,
      generation,
      quota: await geminiService.checkQuota(adminId)
    });
  } catch (error: any) {
    console.error('Error in generateImagePrompt:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get pending approvals
 */
export const getPendingApprovals = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const generations = await db().all(
      `SELECT 
        g.*,
        a.name as requester_name,
        p.name as product_name
       FROM ai_generations g
       LEFT JOIN admins a ON g.requested_by = a.id
       LEFT JOIN products p ON g.product_id = p.id
       WHERE g.status = 'pending'
       ORDER BY g.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const totalResult = await db().get(
      'SELECT COUNT(*) as count FROM ai_generations WHERE status = ?',
      ['pending']
    );

    res.json({
      success: true,
      generations,
      pagination: {
        page,
        limit,
        total: totalResult.count,
        totalPages: Math.ceil(totalResult.count / limit)
      }
    });
  } catch (error: any) {
    console.error('Error in getPendingApprovals:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get all generations (with filters)
 */
export const getAllGenerations = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status as string;
    const type = req.query.type as string;

    let whereConditions = [];
    let params: any[] = [];

    if (status) {
      whereConditions.push('g.status = ?');
      params.push(status);
    }

    if (type) {
      whereConditions.push('g.type = ?');
      params.push(type);
    }

    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    const generations = await db().all(
      `SELECT 
        g.*,
        requester.name as requester_name,
        approver.name as approver_name,
        rejecter.name as rejecter_name,
        p.name as product_name
       FROM ai_generations g
       LEFT JOIN admins requester ON g.requested_by = requester.id
       LEFT JOIN admins approver ON g.approved_by = approver.id
       LEFT JOIN admins rejecter ON g.rejected_by = rejecter.id
       LEFT JOIN products p ON g.product_id = p.id
       ${whereClause}
       ORDER BY g.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const totalResult = await db().get(
      `SELECT COUNT(*) as count FROM ai_generations g ${whereClause}`,
      params
    );

    res.json({
      success: true,
      generations,
      pagination: {
        page,
        limit,
        total: totalResult.count,
        totalPages: Math.ceil(totalResult.count / limit)
      }
    });
  } catch (error: any) {
    console.error('Error in getAllGenerations:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Approve generation
 */
export const approveGeneration = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const adminId = req.admin?.id;

    const result = await geminiService.approveGeneration(
      parseInt(id),
      adminId,
      notes
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    const generation = await db().get(
      `SELECT 
        g.*,
        p.name as product_name
       FROM ai_generations g
       LEFT JOIN products p ON g.product_id = p.id
       WHERE g.id = ?`,
      [id]
    );

    res.json({
      success: true,
      message: 'Generation approved successfully',
      generation
    });
  } catch (error: any) {
    console.error('Error in approveGeneration:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Reject generation
 */
export const rejectGeneration = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.admin?.id;

    if (!reason) {
      return res.status(400).json({ success: false, message: 'Rejection reason is required' });
    }

    const result = await geminiService.rejectGeneration(
      parseInt(id),
      adminId,
      reason
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      message: 'Generation rejected successfully'
    });
  } catch (error: any) {
    console.error('Error in rejectGeneration:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get usage quota for current admin
 */
export const getMyQuota = async (req: Request, res: Response) => {
  try {
    const adminId = req.admin?.id;
    const quota = await geminiService.checkQuota(adminId);
    
    res.json({
      success: true,
      quota
    });
  } catch (error: any) {
    console.error('Error in getMyQuota:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get usage statistics (Super Admin only)
 */
export const getUsageStats = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    
    const stats = await geminiService.getUsageStats(
      startDate as string,
      endDate as string
    );

    // Get top users
    const topUsers = await db().all(
      `SELECT 
        a.name,
        a.email,
        SUM(u.total_requests) as total_requests,
        SUM(u.total_cost_usd) as total_cost
       FROM ai_usage_logs u
       JOIN admins a ON u.admin_id = a.id
       WHERE u.usage_date BETWEEN ? AND ?
       GROUP BY u.admin_id, a.name, a.email
       ORDER BY total_requests DESC
       LIMIT 10`,
      [stats.period.start, stats.period.end]
    );

    // Get status breakdown
    const statusBreakdown = await db().all(
      `SELECT 
        status,
        COUNT(*) as count,
        SUM(cost_usd) as total_cost
       FROM ai_generations
       WHERE DATE(created_at) BETWEEN ? AND ?
       GROUP BY status`,
      [stats.period.start, stats.period.end]
    );

    res.json({
      success: true,
      stats: stats.stats,
      totalCost: stats.totalCost,
      period: stats.period,
      topUsers,
      statusBreakdown
    });
  } catch (error: any) {
    console.error('Error in getUsageStats:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get AI settings
 */
export const getAISettings = async (_req: Request, res: Response) => {
  try {
    const settings = await db().get('SELECT * FROM ai_settings WHERE id = 1');
    
    // Don't expose API key
    if (settings) {
      delete settings.gemini_api_key;
    }

    res.json({
      success: true,
      settings: settings || {
        daily_quota_per_user: 100,
        image_generation_enabled: true,
        description_generation_enabled: true,
        auto_approval_enabled: false
      }
    });
  } catch (error: any) {
    console.error('Error in getAISettings:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update AI settings (Super Admin only)
 */
export const updateAISettings = async (req: Request, res: Response) => {
  try {
    const { 
      gemini_api_key,
      daily_quota_per_user,
      image_generation_enabled,
      description_generation_enabled,
      auto_approval_enabled,
      cost_per_image_usd,
      cost_per_1k_tokens_usd
    } = req.body;

    const adminId = req.admin?.id;

    const updates: string[] = [];
    const params: any[] = [];

    if (gemini_api_key !== undefined) {
      updates.push('gemini_api_key = ?');
      params.push(gemini_api_key);
    }
    if (daily_quota_per_user !== undefined) {
      updates.push('daily_quota_per_user = ?');
      params.push(daily_quota_per_user);
    }
    if (image_generation_enabled !== undefined) {
      updates.push('image_generation_enabled = ?');
      params.push(image_generation_enabled ? 1 : 0);
    }
    if (description_generation_enabled !== undefined) {
      updates.push('description_generation_enabled = ?');
      params.push(description_generation_enabled ? 1 : 0);
    }
    if (auto_approval_enabled !== undefined) {
      updates.push('auto_approval_enabled = ?');
      params.push(auto_approval_enabled ? 1 : 0);
    }
    if (cost_per_image_usd !== undefined) {
      updates.push('cost_per_image_usd = ?');
      params.push(cost_per_image_usd);
    }
    if (cost_per_1k_tokens_usd !== undefined) {
      updates.push('cost_per_1k_tokens_usd = ?');
      params.push(cost_per_1k_tokens_usd);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No updates provided' });
    }

    updates.push('updated_by = ?');
    params.push(adminId);

    await db().run(
      `UPDATE ai_settings SET ${updates.join(', ')} WHERE id = 1`,
      params
    );

    // Reinitialize if API key was updated
    if (gemini_api_key !== undefined) {
      await geminiService.initialize();
    }

    // Log audit
    await db().run(
      `INSERT INTO ai_audit_log (action_type, action_description, admin_id, success)
       VALUES (?, ?, ?, ?)`,
      ['update_settings', 'Updated AI settings', adminId, 1]
    );

    const settings = await db().get('SELECT * FROM ai_settings WHERE id = 1');
    if (settings) {
      delete settings.gemini_api_key;
    }

    res.json({
      success: true,
      message: 'Settings updated successfully',
      settings
    });
  } catch (error: any) {
    console.error('Error in updateAISettings:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
