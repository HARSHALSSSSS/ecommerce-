import { Router, Request, Response } from 'express';
import { authenticateAdmin } from '../middleware/auth';
import { getDatabase } from '../config/database';

const router = Router();

// ==================== TEMPLATE VERSION MANAGEMENT ====================

// Get all templates with their active version
router.get('/', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { type, channel, is_active } = req.query;

    let query = `
      SELECT 
        nt.*,
        ntv.id as active_version_id,
        ntv.version as current_version,
        ntv.subject_template as version_subject,
        ntv.body_template as version_body,
        ntv.variables as version_variables,
        (SELECT COUNT(*) FROM notification_template_versions WHERE template_id = nt.id) as version_count
      FROM notification_templates nt
      LEFT JOIN notification_template_versions ntv ON nt.id = ntv.template_id AND ntv.is_active = 1
      WHERE 1=1
    `;
    const params: any[] = [];

    if (type) {
      query += ' AND nt.notification_type = ?';
      params.push(type);
    }

    if (channel) {
      query += ' AND nt.channel = ?';
      params.push(channel);
    }

    if (is_active !== undefined) {
      query += ' AND nt.is_active = ?';
      params.push(is_active === 'true' ? 1 : 0);
    }

    query += ' ORDER BY nt.created_at DESC';

    const templates = await db.all(query, params);

    // Parse JSON fields
    templates.forEach((t: any) => {
      if (t.variables) t.variables = JSON.parse(t.variables);
      if (t.version_variables) t.version_variables = JSON.parse(t.version_variables);
    });

    res.json({ success: true, templates });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch templates' });
  }
});

// Get single template with all versions
router.get('/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const template = await db.get('SELECT * FROM notification_templates WHERE id = ?', [id]);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    if (template.variables) {
      template.variables = JSON.parse(template.variables);
    }

    // Get all versions
    const versions = await db.all(
      `SELECT ntv.*, a.name as created_by_name
       FROM notification_template_versions ntv
       LEFT JOIN admins a ON ntv.created_by = a.id
       WHERE ntv.template_id = ?
       ORDER BY ntv.version DESC`,
      [id]
    );

    versions.forEach((v: any) => {
      if (v.variables) v.variables = JSON.parse(v.variables);
    });

    res.json({
      success: true,
      template: {
        ...template,
        versions
      }
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch template' });
  }
});

// Create new template
router.post('/', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const admin = (req as any).admin;
    const { name, type, channel, subject_template, body_template, variables, is_active } = req.body;

    const result = await db.run(
      `INSERT INTO notification_templates (name, type, channel, subject_template, body_template, variables, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, type, channel, subject_template, body_template, JSON.stringify(variables || []), is_active ? 1 : 0]
    );

    // Create initial version (version 1)
    await db.run(
      `INSERT INTO notification_template_versions (template_id, version, subject_template, body_template, variables, change_notes, created_by, is_active)
       VALUES (?, 1, ?, ?, ?, 'Initial version', ?, 1)`,
      [result.lastID, subject_template, body_template, JSON.stringify(variables || []), admin?.id || null]
    );

    const template = await db.get('SELECT * FROM notification_templates WHERE id = ?', [result.lastID]);

    res.status(201).json({ success: true, template });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ success: false, message: 'Failed to create template' });
  }
});

// Update template (creates new version)
router.put('/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const admin = (req as any).admin;
    const { id } = req.params;
    const { name, type, channel, subject_template, body_template, variables, is_active, change_notes, create_version } = req.body;

    const existing = await db.get('SELECT * FROM notification_templates WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    // Update main template
    await db.run(
      `UPDATE notification_templates SET 
        name = ?, type = ?, channel = ?, subject_template = ?, body_template = ?, 
        variables = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, type, channel, subject_template, body_template, JSON.stringify(variables || []), is_active ? 1 : 0, id]
    );

    // Create new version if content changed or explicitly requested
    if (create_version !== false && 
        (subject_template !== existing.subject_template || body_template !== existing.body_template)) {
      // Get current max version
      const maxVersion = await db.get(
        'SELECT MAX(version) as max_ver FROM notification_template_versions WHERE template_id = ?',
        [id]
      );

      const newVersion = (maxVersion?.max_ver || 0) + 1;

      // Deactivate previous active version
      await db.run(
        'UPDATE notification_template_versions SET is_active = 0 WHERE template_id = ?',
        [id]
      );

      // Create new version
      await db.run(
        `INSERT INTO notification_template_versions (template_id, version, subject_template, body_template, variables, change_notes, created_by, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [id, newVersion, subject_template, body_template, JSON.stringify(variables || []), change_notes || 'Updated template', admin?.id || null]
      );
    }

    const template = await db.get('SELECT * FROM notification_templates WHERE id = ?', [id]);
    if (template.variables) {
      template.variables = JSON.parse(template.variables);
    }

    res.json({ success: true, template });
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ success: false, message: 'Failed to update template' });
  }
});

// Delete template
router.delete('/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const existing = await db.get('SELECT * FROM notification_templates WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    // Check if template is in use by event rules
    const inUse = await db.get(
      'SELECT COUNT(*) as count FROM event_trigger_rules WHERE template_id = ?',
      [id]
    );

    if (inUse && inUse.count > 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Cannot delete template. It is being used by event trigger rules.' 
      });
    }

    await db.run('DELETE FROM notification_templates WHERE id = ?', [id]);

    res.json({ success: true, message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ success: false, message: 'Failed to delete template' });
  }
});

// ==================== VERSION MANAGEMENT ====================

// Get specific version
router.get('/:id/versions/:versionId', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { id, versionId } = req.params;

    const version = await db.get(
      `SELECT ntv.*, a.name as created_by_name
       FROM notification_template_versions ntv
       LEFT JOIN admins a ON ntv.created_by = a.id
       WHERE ntv.id = ? AND ntv.template_id = ?`,
      [versionId, id]
    );

    if (!version) {
      return res.status(404).json({ success: false, message: 'Version not found' });
    }

    if (version.variables) {
      version.variables = JSON.parse(version.variables);
    }

    res.json({ success: true, version });
  } catch (error) {
    console.error('Error fetching version:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch version' });
  }
});

// Activate specific version (rollback)
router.post('/:id/versions/:versionId/activate', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { id, versionId } = req.params;

    const version = await db.get(
      'SELECT * FROM notification_template_versions WHERE id = ? AND template_id = ?',
      [versionId, id]
    );

    if (!version) {
      return res.status(404).json({ success: false, message: 'Version not found' });
    }

    // Deactivate all versions for this template
    await db.run(
      'UPDATE notification_template_versions SET is_active = 0 WHERE template_id = ?',
      [id]
    );

    // Activate selected version
    await db.run(
      'UPDATE notification_template_versions SET is_active = 1 WHERE id = ?',
      [versionId]
    );

    // Update main template with version content
    await db.run(
      `UPDATE notification_templates SET 
        subject_template = ?, body_template = ?, variables = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [version.subject_template, version.body_template, version.variables, id]
    );

    res.json({ success: true, message: 'Version activated successfully', version });
  } catch (error) {
    console.error('Error activating version:', error);
    res.status(500).json({ success: false, message: 'Failed to activate version' });
  }
});

// ==================== TEMPLATE PREVIEW ====================

// Preview template with sample data
router.post('/:id/preview', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { sample_data, version_id } = req.body;

    let templateData;

    if (version_id) {
      templateData = await db.get(
        'SELECT subject_template, body_template, variables FROM notification_template_versions WHERE id = ? AND template_id = ?',
        [version_id, id]
      );
    } else {
      templateData = await db.get(
        'SELECT subject_template, body_template, variables FROM notification_templates WHERE id = ?',
        [id]
      );
    }

    if (!templateData) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    // Replace variables in template
    let previewSubject = templateData.subject_template || '';
    let previewBody = templateData.body_template || '';

    const data = sample_data || {};

    // Replace {{variable}} patterns
    const replaceVariables = (text: string, data: any): string => {
      return text.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
        return data[variable] !== undefined ? data[variable] : match;
      });
    };

    previewSubject = replaceVariables(previewSubject, data);
    previewBody = replaceVariables(previewBody, data);

    res.json({
      success: true,
      preview: {
        subject: previewSubject,
        body: previewBody,
        original_subject: templateData.subject_template,
        original_body: templateData.body_template,
        variables: templateData.variables ? JSON.parse(templateData.variables) : []
      }
    });
  } catch (error) {
    console.error('Error previewing template:', error);
    res.status(500).json({ success: false, message: 'Failed to preview template' });
  }
});

// Get template variable suggestions based on type
router.get('/variables/:type', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { type } = req.params;

    const variableSuggestions: Record<string, string[]> = {
      order_confirmation: ['order_id', 'order_number', 'total_amount', 'customer_name', 'item_count', 'order_date'],
      order_status: ['order_id', 'order_number', 'status', 'customer_name', 'tracking_number'],
      payment_confirmation: ['payment_id', 'amount', 'method', 'transaction_id', 'customer_name'],
      payment_failed: ['payment_id', 'amount', 'method', 'error_message', 'retry_link'],
      shipping_update: ['order_id', 'tracking_number', 'carrier', 'estimated_delivery', 'status'],
      return_initiated: ['return_id', 'order_id', 'reason', 'item_name', 'refund_amount'],
      refund_processed: ['refund_id', 'amount', 'method', 'processing_days'],
      welcome: ['customer_name', 'email', 'verification_link'],
      password_reset: ['customer_name', 'reset_link', 'expiry_time'],
      promotional: ['customer_name', 'discount_code', 'discount_percentage', 'expiry_date', 'product_name'],
      cart_abandoned: ['customer_name', 'cart_items', 'cart_total', 'checkout_link'],
      review_request: ['customer_name', 'product_name', 'order_id', 'review_link']
    };

    res.json({ success: true, variables: variableSuggestions[type] || ['customer_name', 'date', 'amount'] });
  } catch (error) {
    console.error('Error fetching variables:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch variables' });
  }
});

export default router;
