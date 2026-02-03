/**
 * Gemini AI Service - Google AI integration for product content generation
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getDatabase } from '../config/database.js';

interface AIGenerationRequest {
  type: 'image' | 'description' | 'both';
  prompt: string;
  productId?: number;
  adminId: number;
}

interface AIGenerationResult {
  success: boolean;
  generationId?: number;
  content?: string;
  imageUrl?: string;
  tokensUsed?: number;
  cost?: number;
  error?: string;
}

interface UsageQuota {
  dailyLimit: number;
  used: number;
  remaining: number;
  canGenerate: boolean;
}

const getDb = () => getDatabase();

export class GeminiService {
  private genAI: GoogleGenerativeAI | null = null;
  private initialized: boolean = false;

  /**
   * Ensure AI tables exist in database
   */
  async ensureTablesExist(): Promise<void> {
    try {
      const db = getDb();

      await db.run(`
        CREATE TABLE IF NOT EXISTS ai_settings (
          id INTEGER PRIMARY KEY DEFAULT 1,
          gemini_api_key TEXT,
          daily_quota_per_user INTEGER DEFAULT 100,
          cost_per_image_usd REAL DEFAULT 0.02,
          cost_per_1k_tokens_usd REAL DEFAULT 0.001,
          image_generation_enabled INTEGER DEFAULT 1,
          description_generation_enabled INTEGER DEFAULT 1,
          auto_approval_enabled INTEGER DEFAULT 0,
          updated_by INTEGER,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await db.run(`INSERT OR IGNORE INTO ai_settings (id, daily_quota_per_user) VALUES (1, 100)`);

      await db.run(`
        CREATE TABLE IF NOT EXISTS ai_generations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL CHECK (type IN ('image', 'description', 'both')),
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'generating', 'failed')),
          prompt TEXT NOT NULL,
          product_id INTEGER,
          requested_by INTEGER NOT NULL,
          generated_content TEXT,
          generated_image_url TEXT,
          ai_model TEXT DEFAULT 'gemini-2.5-flash',
          approved_by INTEGER,
          rejected_by INTEGER,
          approval_notes TEXT,
          approved_at TIMESTAMP,
          rejected_at TIMESTAMP,
          tokens_used INTEGER DEFAULT 0,
          cost_usd REAL DEFAULT 0,
          generation_time_ms INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await db.run(`
        CREATE TABLE IF NOT EXISTS ai_usage_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          usage_date TEXT NOT NULL,
          admin_id INTEGER NOT NULL,
          total_requests INTEGER DEFAULT 0,
          successful_requests INTEGER DEFAULT 0,
          failed_requests INTEGER DEFAULT 0,
          image_requests INTEGER DEFAULT 0,
          description_requests INTEGER DEFAULT 0,
          total_tokens INTEGER DEFAULT 0,
          total_cost_usd REAL DEFAULT 0,
          daily_quota_limit INTEGER DEFAULT 100,
          quota_remaining INTEGER DEFAULT 100,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(usage_date, admin_id)
        )
      `);

      await db.run(`
        CREATE TABLE IF NOT EXISTS ai_audit_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          action_type TEXT NOT NULL,
          action_description TEXT,
          generation_id INTEGER,
          admin_id INTEGER NOT NULL,
          success INTEGER DEFAULT 1,
          error_message TEXT,
          ip_address TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      console.log('âœ… AI tables ensured');
    } catch (error) {
      console.error('Error ensuring AI tables:', error);
    }
  }

  /**
   * Initialize with API key from environment or database fallback
   */
  async initialize(): Promise<void> {
    try {
      await this.ensureTablesExist();

      let apiKey = process.env.GEMINI_API_KEY;
      console.log('[Gemini] Checking for GEMINI_API_KEY in environment:', apiKey ? 'Found (length: ' + apiKey.length + ')' : 'Not found');

      if (!apiKey) {
        try {
          const db = getDb();
          const settings = await db.get('SELECT gemini_api_key FROM ai_settings WHERE id = 1');
          apiKey = settings?.gemini_api_key;
          console.log('ðŸ”‘ Checking for GEMINI_API_KEY in database:', apiKey ? 'Found' : 'Not found');
        } catch (e) {
          console.log('Could not get API key from database, using env only');
        }
      }
      
      if (!apiKey) {
        console.warn('âš ï¸ Gemini API key not configured. AI features will be disabled.');
        this.initialized = false;
        return;
      }

      this.genAI = new GoogleGenerativeAI(apiKey);
      this.initialized = true;
      console.log('✅ Gemini AI service initialized with model: gemini-2.5-flash');
    } catch (error) {
      console.error('âŒ Failed to initialize Gemini AI:', error);
      this.initialized = false;
    }
  }

  isInitialized(): boolean {
    return this.initialized && this.genAI !== null;
  }

  /**
   * Returns remaining quota for rate limiting
   */
  async checkQuota(adminId: number): Promise<UsageQuota> {
    try {
      await this.ensureTablesExist();
      const db = getDb();
      const today = new Date().toISOString().split('T')[0];

      let usage = await db.get(
        'SELECT * FROM ai_usage_logs WHERE admin_id = ? AND usage_date = ?',
        [adminId, today]
      );

      if (!usage) {
        const settings = await db.get('SELECT daily_quota_per_user FROM ai_settings WHERE id = 1');
        const dailyLimit = settings?.daily_quota_per_user || 100;

        await db.run(
          `INSERT INTO ai_usage_logs 
           (usage_date, admin_id, daily_quota_limit, quota_remaining) 
           VALUES (?, ?, ?, ?)`,
          [today, adminId, dailyLimit, dailyLimit]
        );

        return {
          dailyLimit,
          used: 0,
          remaining: dailyLimit,
          canGenerate: true
        };
      }

      return {
        dailyLimit: usage.daily_quota_limit,
        used: usage.total_requests,
        remaining: usage.quota_remaining,
        canGenerate: usage.quota_remaining > 0
      };
    } catch (error) {
      console.error('Error checking quota:', error);
      return { dailyLimit: 100, used: 0, remaining: 100, canGenerate: true };
    }
  }

  private async updateUsage(adminId: number, type: string, tokens: number, cost: number, success: boolean): Promise<void> {
    try {
      const db = getDb();
      const today = new Date().toISOString().split('T')[0];
      const isImage = type === 'image' ? 1 : 0;
      const isDescription = type === 'description' ? 1 : 0;

      const existing = await db.get(
        'SELECT id FROM ai_usage_logs WHERE admin_id = ? AND usage_date = ?',
        [adminId, today]
      );

      if (existing) {
        await db.run(
          `UPDATE ai_usage_logs SET
            total_requests = total_requests + 1,
            successful_requests = successful_requests + ?,
            failed_requests = failed_requests + ?,
            image_requests = image_requests + ?,
            description_requests = description_requests + ?,
            total_tokens = total_tokens + ?,
            total_cost_usd = total_cost_usd + ?,
            quota_remaining = quota_remaining - 1,
            updated_at = CURRENT_TIMESTAMP
           WHERE admin_id = ? AND usage_date = ?`,
          [success ? 1 : 0, success ? 0 : 1, isImage, isDescription, tokens, cost, adminId, today]
        );
      } else {
        const settings = await db.get('SELECT daily_quota_per_user FROM ai_settings WHERE id = 1');
        const dailyLimit = settings?.daily_quota_per_user || 100;

        await db.run(
          `INSERT INTO ai_usage_logs 
           (usage_date, admin_id, total_requests, successful_requests, failed_requests,
            image_requests, description_requests, total_tokens, total_cost_usd, 
            daily_quota_limit, quota_remaining)
           VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [today, adminId, success ? 1 : 0, success ? 0 : 1, isImage, isDescription,
           tokens, cost, dailyLimit, dailyLimit - 1]
        );
      }
    } catch (error) {
      console.error('Error updating usage:', error);
    }
  }

  async generateDescription(request: AIGenerationRequest): Promise<AIGenerationResult> {
    if (!this.isInitialized()) {
      console.error('âŒ generateDescription called but Gemini AI not initialized');
      console.error('   initialized flag:', this.initialized);
      console.error('   genAI exists:', this.genAI !== null);
      return { 
        success: false, 
        error: 'Gemini AI not initialized. Please check GEMINI_API_KEY environment variable in Render dashboard.' 
      };
    }

    await this.ensureTablesExist();
    const db = getDb();
    const startTime = Date.now();

    try {
      // Check quota
      const quota = await this.checkQuota(request.adminId);
      if (!quota.canGenerate) {
        return { 
          success: false, 
          error: `Daily quota exceeded. Limit: ${quota.dailyLimit}, Used: ${quota.used}` 
        };
      }

      // Get product details if productId provided
      let productContext = '';
      if (request.productId) {
        const product = await db.get('SELECT * FROM products WHERE id = ?', [request.productId]);
        if (product) {
          productContext = `\nProduct Name: ${product.name}\nCategory: ${product.category}\nPrice: $${product.price}`;
        }
      }

      // Generate content with Gemini 2.5 Flash (stable, free tier)
      const model = this.genAI!.getGenerativeModel({ model: 'gemini-2.5-flash' });
      
      const enhancedPrompt = `You are a professional e-commerce product copywriter. Generate an engaging, SEO-optimized product description.

${request.prompt}${productContext}

Requirements:
- Keep it concise (2-3 paragraphs, 100-150 words)
- Highlight key features and benefits
- Use persuasive language
- Include relevant keywords naturally
- Make it customer-focused

Generate only the description, no additional formatting or notes.`;

      const result = await model.generateContent(enhancedPrompt);
      const response = await result.response;
      const description = response.text();

      // Estimate tokens and cost (rough estimate)
      const tokensUsed = Math.ceil((enhancedPrompt.length + description.length) / 4);
      const settings = await db.get('SELECT cost_per_1k_tokens_usd FROM ai_settings WHERE id = 1');
      const cost = (tokensUsed / 1000) * (settings?.cost_per_1k_tokens_usd || 0.001);

      const generationTime = Date.now() - startTime;

      // Save generation to database
      const genResult = await db.run(
        `INSERT INTO ai_generations 
         (type, status, prompt, product_id, requested_by, generated_content, 
          ai_model, tokens_used, cost_usd, generation_time_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'description', 'pending', request.prompt, request.productId || null,
          request.adminId, description, 'gemini-2.5-flash', tokensUsed, cost, generationTime
        ]
      );

      // Update usage stats
      await this.updateUsage(request.adminId, 'description', tokensUsed, cost, true);

      // Log audit trail
      await db.run(
        `INSERT INTO ai_audit_log (action_type, action_description, generation_id, admin_id, success)
         VALUES (?, ?, ?, ?, ?)`,
        ['generate_description', `Generated description with ${tokensUsed} tokens`, genResult.lastID, request.adminId, 1]
      );

      return {
        success: true,
        generationId: genResult.lastID,
        content: description,
        tokensUsed,
        cost
      };
    } catch (error: any) {
      console.error('Error generating description:', error);
      const db = getDb();
      
      // Update usage with failure
      await this.updateUsage(request.adminId, 'description', 0, 0, false);

      // Check for quota exceeded error
      let errorMessage = error.message || 'Failed to generate description';
      if (error.status === 429 || errorMessage.includes('quota') || errorMessage.includes('Too Many Requests')) {
        errorMessage = 'AI quota exceeded. The free tier daily limit has been reached. Please wait for quota reset (usually 24 hours) or upgrade to a paid plan at https://aistudio.google.com/';
      }

      // Log error in audit
      await db.run(
        `INSERT INTO ai_audit_log (action_type, action_description, admin_id, success, error_message)
         VALUES (?, ?, ?, ?, ?)`,
        ['generate_description', 'Failed to generate description', request.adminId, 0, errorMessage]
      );

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Generate product image prompt (Gemini doesn't generate images directly, 
   * but can generate detailed prompts for image generation services)
   */
  async generateImagePrompt(request: AIGenerationRequest): Promise<AIGenerationResult> {
    if (!this.isInitialized()) {
      console.error('âŒ generateImagePrompt called but Gemini AI not initialized');
      return { 
        success: false, 
        error: 'Gemini AI not initialized. Please check GEMINI_API_KEY environment variable in Render dashboard.' 
      };
    }

    await this.ensureTablesExist();
    const db = getDb();
    const startTime = Date.now();

    try {
      // Check quota
      const quota = await this.checkQuota(request.adminId);
      if (!quota.canGenerate) {
        return { 
          success: false, 
          error: `Daily quota exceeded. Limit: ${quota.dailyLimit}, Used: ${quota.used}` 
        };
      }

      // Get product details if productId provided
      let productContext = '';
      if (request.productId) {
        const product = await db.get('SELECT * FROM products WHERE id = ?', [request.productId]);
        if (product) {
          productContext = `\nProduct: ${product.name}\nCategory: ${product.category}`;
        }
      }

      const model = this.genAI!.getGenerativeModel({ model: 'gemini-2.5-flash' });
      
      const enhancedPrompt = `You are an expert at creating detailed image generation prompts. Create a highly detailed prompt for generating a professional product photo.

${request.prompt}${productContext}

Requirements:
- Specify lighting (professional studio lighting, soft shadows)
- Describe composition (product placement, angle, background)
- Mention style (minimalist, modern, lifestyle, etc.)
- Include quality markers (high resolution, 4K, product photography)
- Keep it under 200 words

Generate only the image prompt, no additional commentary.`;

      const result = await model.generateContent(enhancedPrompt);
      const response = await result.response;
      const imagePrompt = response.text();

      const tokensUsed = Math.ceil((enhancedPrompt.length + imagePrompt.length) / 4);
      const settings = await db.get('SELECT cost_per_1k_tokens_usd FROM ai_settings WHERE id = 1');
      const cost = (tokensUsed / 1000) * (settings?.cost_per_1k_tokens_usd || 0.001);

      const generationTime = Date.now() - startTime;

      // Save generation
      const genResult = await db.run(
        `INSERT INTO ai_generations 
         (type, status, prompt, product_id, requested_by, generated_content, 
          ai_model, tokens_used, cost_usd, generation_time_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'image', 'pending', request.prompt, request.productId || null,
          request.adminId, imagePrompt, 'gemini-2.5-flash', tokensUsed, cost, generationTime
        ]
      );

      await this.updateUsage(request.adminId, 'image', tokensUsed, cost, true);

      await db.run(
        `INSERT INTO ai_audit_log (action_type, action_description, generation_id, admin_id, success)
         VALUES (?, ?, ?, ?, ?)`,
        ['generate_image_prompt', `Generated image prompt with ${tokensUsed} tokens`, genResult.lastID, request.adminId, 1]
      );

      return {
        success: true,
        generationId: genResult.lastID,
        content: imagePrompt,
        tokensUsed,
        cost
      };
    } catch (error: any) {
      console.error('Error generating image prompt:', error);
      const db = getDb();
      
      await this.updateUsage(request.adminId, 'image', 0, 0, false);

      // Check for quota exceeded error
      let errorMessage = error.message || 'Failed to generate image prompt';
      if (error.status === 429 || errorMessage.includes('quota') || errorMessage.includes('Too Many Requests')) {
        errorMessage = 'AI quota exceeded. The free tier daily limit has been reached. Please wait for quota reset (usually 24 hours) or upgrade to a paid plan at https://aistudio.google.com/';
      }

      await db.run(
        `INSERT INTO ai_audit_log (action_type, action_description, admin_id, success, error_message)
         VALUES (?, ?, ?, ?, ?)`,
        ['generate_image_prompt', 'Failed to generate image prompt', request.adminId, 0, errorMessage]
      );

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Approve AI generation and apply to product
   */
  async approveGeneration(generationId: number, adminId: number, notes?: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.ensureTablesExist();
      const db = getDb();
      const generation = await db.get('SELECT * FROM ai_generations WHERE id = ?', [generationId]);
      
      if (!generation) {
        return { success: false, error: 'Generation not found' };
      }

      if (generation.status !== 'pending') {
        return { success: false, error: `Cannot approve generation with status: ${generation.status}` };
      }

      // Update generation status
      await db.run(
        `UPDATE ai_generations 
         SET status = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP, approval_notes = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        ['approved', adminId, notes || null, generationId]
      );

      // If there's a product_id, update the product
      if (generation.product_id && generation.generated_content) {
        if (generation.type === 'description') {
          await db.run(
            'UPDATE products SET description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [generation.generated_content, generation.product_id]
          );
        }
      }

      // Log approval
      await db.run(
        `INSERT INTO ai_audit_log (action_type, action_description, generation_id, admin_id, success)
         VALUES (?, ?, ?, ?, ?)`,
        ['approve_generation', notes || 'Approved AI generation', generationId, adminId, 1]
      );

      return { success: true };
    } catch (error: any) {
      console.error('Error approving generation:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Reject AI generation
   */
  async rejectGeneration(generationId: number, adminId: number, reason: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.ensureTablesExist();
      const db = getDb();
      const generation = await db.get('SELECT * FROM ai_generations WHERE id = ?', [generationId]);
      
      if (!generation) {
        return { success: false, error: 'Generation not found' };
      }

      if (generation.status !== 'pending') {
        return { success: false, error: `Cannot reject generation with status: ${generation.status}` };
      }

      await db.run(
        `UPDATE ai_generations 
         SET status = ?, rejected_by = ?, rejected_at = CURRENT_TIMESTAMP, approval_notes = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        ['rejected', adminId, reason, generationId]
      );

      await db.run(
        `INSERT INTO ai_audit_log (action_type, action_description, generation_id, admin_id, success)
         VALUES (?, ?, ?, ?, ?)`,
        ['reject_generation', reason, generationId, adminId, 1]
      );

      return { success: true };
    } catch (error: any) {
      console.error('Error rejecting generation:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get pending generations for approval queue
   */
  async getPendingGenerations(): Promise<any[]> {
    try {
      await this.ensureTablesExist();
      const db = getDb();
      const generations = await db.all(
        `SELECT g.*, p.name as product_name, a.name as requester_name
         FROM ai_generations g
         LEFT JOIN products p ON g.product_id = p.id
         LEFT JOIN admins a ON g.requested_by = a.id
         WHERE g.status = 'pending'
         ORDER BY g.created_at DESC`
      );
      return generations || [];
    } catch (error) {
      console.error('Error getting pending generations:', error);
      return [];
    }
  }

  /**
   * Get all generations with filters
   */
  async getGenerations(filters?: { status?: string; type?: string; limit?: number; offset?: number }): Promise<any[]> {
    try {
      await this.ensureTablesExist();
      const db = getDb();
      let query = `
        SELECT g.*, p.name as product_name
        FROM ai_generations g
        LEFT JOIN products p ON g.product_id = p.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (filters?.status) {
        query += ' AND g.status = ?';
        params.push(filters.status);
      }
      if (filters?.type) {
        query += ' AND g.type = ?';
        params.push(filters.type);
      }

      query += ' ORDER BY g.created_at DESC';

      if (filters?.limit) {
        query += ' LIMIT ?';
        params.push(filters.limit);
      }
      if (filters?.offset) {
        query += ' OFFSET ?';
        params.push(filters.offset);
      }

      const generations = await db.all(query, params);
      return generations || [];
    } catch (error) {
      console.error('Error getting generations:', error);
      return [];
    }
  }

  /**
   * Get usage statistics
   */
  async getUsageStats(startDate?: string, endDate?: string): Promise<any> {
    try {
      await this.ensureTablesExist();
      const db = getDb();
      const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const end = endDate || new Date().toISOString().split('T')[0];

      const stats = await db.all(
        `SELECT 
          usage_date,
          SUM(total_requests) as total_requests,
          SUM(successful_requests) as successful_requests,
          SUM(failed_requests) as failed_requests,
          SUM(image_requests) as image_requests,
          SUM(description_requests) as description_requests,
          SUM(total_tokens) as total_tokens,
          SUM(total_cost_usd) as total_cost_usd
         FROM ai_usage_logs
         WHERE usage_date BETWEEN ? AND ?
         GROUP BY usage_date
         ORDER BY usage_date DESC`,
        [start, end]
      );

      const totalCost = await db.get(
        'SELECT SUM(total_cost_usd) as total FROM ai_usage_logs WHERE usage_date BETWEEN ? AND ?',
        [start, end]
      );

      const totalRequests = await db.get(
        'SELECT SUM(total_requests) as total FROM ai_usage_logs WHERE usage_date BETWEEN ? AND ?',
        [start, end]
      );

      return {
        stats: stats || [],
        totalCost: totalCost?.total || 0,
        totalRequests: totalRequests?.total || 0,
        period: { start, end }
      };
    } catch (error: any) {
      console.error('Error getting usage stats:', error);
      return { stats: [], totalCost: 0, totalRequests: 0, period: { start: '', end: '' } };
    }
  }
}

// Export singleton instance
export const geminiService = new GeminiService();
