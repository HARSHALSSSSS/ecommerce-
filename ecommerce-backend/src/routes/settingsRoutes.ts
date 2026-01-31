import { Router, Request, Response } from 'express';
import { getDatabase } from '../config/database';
import { authenticateAdmin } from '../middleware/auth';

const router = Router();

// Get all settings
router.get('/', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { category } = req.query;

    let query = `
      SELECT s.*, a.name as updated_by_name
      FROM system_settings s
      LEFT JOIN admins a ON a.id = s.updated_by
    `;
    const params: any[] = [];

    if (category) {
      query += ' WHERE s.category = ?';
      params.push(category);
    }

    query += ' ORDER BY s.category, s.setting_key';

    const settings = await db.all(query, params);

    // Group settings by category
    const groupedSettings: Record<string, any[]> = {};
    settings.forEach(setting => {
      // Hide sensitive values
      if (setting.is_sensitive) {
        setting.setting_value = '********';
      }
      
      if (!groupedSettings[setting.category]) {
        groupedSettings[setting.category] = [];
      }
      groupedSettings[setting.category].push(setting);
    });

    res.json({
      success: true,
      data: settings,
      grouped: groupedSettings
    });

  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch settings' });
  }
});

// Get settings categories
router.get('/categories', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();

    const categories = await db.all(`
      SELECT DISTINCT category, COUNT(*) as count
      FROM system_settings
      GROUP BY category
      ORDER BY category
    `);

    res.json({ success: true, data: categories });

  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch categories' });
  }
});

// Get single setting by key
router.get('/key/:key', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { key } = req.params;

    const setting = await db.get(`
      SELECT s.*, a.name as updated_by_name
      FROM system_settings s
      LEFT JOIN admins a ON a.id = s.updated_by
      WHERE s.setting_key = ?
    `, [key]);

    if (!setting) {
      return res.status(404).json({ success: false, message: 'Setting not found' });
    }

    // Hide sensitive values
    if (setting.is_sensitive) {
      setting.setting_value = '********';
    }

    res.json({ success: true, data: setting });

  } catch (error) {
    console.error('Error fetching setting:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch setting' });
  }
});

// Get setting history
router.get('/:id/history', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const history = await db.all(`
      SELECT sh.*, a.name as changed_by_name
      FROM settings_history sh
      LEFT JOIN admins a ON a.id = sh.changed_by
      WHERE sh.setting_id = ?
      ORDER BY sh.created_at DESC
    `, [id]);

    res.json({ success: true, data: history });

  } catch (error) {
    console.error('Error fetching setting history:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch setting history' });
  }
});

// Update setting
router.put('/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { setting_value, change_reason } = req.body;
    const adminId = (req as any).admin?.id;

    // Get current setting
    const current = await db.get('SELECT * FROM system_settings WHERE id = ?', [id]);
    if (!current) {
      return res.status(404).json({ success: false, message: 'Setting not found' });
    }

    // Validate value based on type
    let validatedValue = setting_value;
    if (current.setting_type === 'boolean') {
      validatedValue = setting_value === true || setting_value === 'true' ? 'true' : 'false';
    } else if (current.setting_type === 'number') {
      if (isNaN(Number(setting_value))) {
        return res.status(400).json({ success: false, message: 'Invalid number value' });
      }
      validatedValue = String(setting_value);
    }

    const newVersion = current.version + 1;

    // Save to history
    await db.run(`
      INSERT INTO settings_history (
        setting_id, setting_key, old_value, new_value, version, changed_by, change_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, current.setting_key, current.setting_value, validatedValue, newVersion, adminId, change_reason]);

    // Update setting
    await db.run(`
      UPDATE system_settings 
      SET setting_value = ?, version = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [validatedValue, newVersion, adminId, id]);

    // Create audit log
    await db.run(`
      INSERT INTO audit_logs (action_type, entity_type, entity_id, admin_id, old_values, new_values, description, severity)
      VALUES ('update', 'system_setting', ?, ?, ?, ?, ?, 'warning')
    `, [
      id,
      adminId,
      JSON.stringify({ value: current.setting_value }),
      JSON.stringify({ value: validatedValue }),
      `Updated setting ${current.setting_key}`
    ]);

    const updated = await db.get('SELECT * FROM system_settings WHERE id = ?', [id]);

    res.json({
      success: true,
      data: updated,
      message: 'Setting updated successfully'
    });

  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({ success: false, message: 'Failed to update setting' });
  }
});

// Update multiple settings at once
router.put('/bulk/update', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { settings, change_reason } = req.body;
    const adminId = (req as any).admin?.id;

    if (!Array.isArray(settings) || settings.length === 0) {
      return res.status(400).json({ success: false, message: 'Settings array is required' });
    }

    const results: any[] = [];

    for (const { key, value } of settings) {
      const current = await db.get('SELECT * FROM system_settings WHERE setting_key = ?', [key]);
      if (!current) continue;

      let validatedValue = value;
      if (current.setting_type === 'boolean') {
        validatedValue = value === true || value === 'true' ? 'true' : 'false';
      } else if (current.setting_type === 'number') {
        if (isNaN(Number(value))) continue;
        validatedValue = String(value);
      }

      const newVersion = current.version + 1;

      // Save to history
      await db.run(`
        INSERT INTO settings_history (
          setting_id, setting_key, old_value, new_value, version, changed_by, change_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [current.id, key, current.setting_value, validatedValue, newVersion, adminId, change_reason]);

      // Update setting
      await db.run(`
        UPDATE system_settings 
        SET setting_value = ?, version = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [validatedValue, newVersion, adminId, current.id]);

      results.push({ key, success: true });
    }

    // Create audit log
    await db.run(`
      INSERT INTO audit_logs (action_type, entity_type, admin_id, description, severity)
      VALUES ('bulk_update', 'system_settings', ?, ?, 'warning')
    `, [adminId, `Bulk updated ${results.length} settings`]);

    res.json({
      success: true,
      data: results,
      message: `Updated ${results.length} settings`
    });

  } catch (error) {
    console.error('Error bulk updating settings:', error);
    res.status(500).json({ success: false, message: 'Failed to bulk update settings' });
  }
});

// Create new setting
router.post('/', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { 
      setting_key, 
      setting_value, 
      setting_type = 'string',
      category = 'general',
      description,
      is_sensitive = false
    } = req.body;
    const adminId = (req as any).admin?.id;

    if (!setting_key) {
      return res.status(400).json({ success: false, message: 'Setting key is required' });
    }

    // Check if key exists
    const existing = await db.get('SELECT id FROM system_settings WHERE setting_key = ?', [setting_key]);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Setting key already exists' });
    }

    const result = await db.run(`
      INSERT INTO system_settings (
        setting_key, setting_value, setting_type, category, description, is_sensitive, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [setting_key, setting_value || '', setting_type, category, description, is_sensitive ? 1 : 0, adminId]);

    // Create audit log
    await db.run(`
      INSERT INTO audit_logs (action_type, entity_type, entity_id, admin_id, description, severity)
      VALUES ('create', 'system_setting', ?, ?, ?, 'info')
    `, [result.lastID, adminId, `Created setting ${setting_key}`]);

    const newSetting = await db.get('SELECT * FROM system_settings WHERE id = ?', [result.lastID]);

    res.json({
      success: true,
      data: newSetting,
      message: 'Setting created successfully'
    });

  } catch (error) {
    console.error('Error creating setting:', error);
    res.status(500).json({ success: false, message: 'Failed to create setting' });
  }
});

// Delete setting
router.delete('/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const adminId = (req as any).admin?.id;

    const setting = await db.get('SELECT * FROM system_settings WHERE id = ?', [id]);
    if (!setting) {
      return res.status(404).json({ success: false, message: 'Setting not found' });
    }

    await db.run('DELETE FROM system_settings WHERE id = ?', [id]);

    // Create audit log
    await db.run(`
      INSERT INTO audit_logs (action_type, entity_type, entity_id, admin_id, old_values, description, severity)
      VALUES ('delete', 'system_setting', ?, ?, ?, ?, 'warning')
    `, [id, adminId, JSON.stringify(setting), `Deleted setting ${setting.setting_key}`]);

    res.json({ success: true, message: 'Setting deleted successfully' });

  } catch (error) {
    console.error('Error deleting setting:', error);
    res.status(500).json({ success: false, message: 'Failed to delete setting' });
  }
});

// Rollback setting to previous version
router.post('/:id/rollback', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { version } = req.body;
    const adminId = (req as any).admin?.id;

    const setting = await db.get('SELECT * FROM system_settings WHERE id = ?', [id]);
    if (!setting) {
      return res.status(404).json({ success: false, message: 'Setting not found' });
    }

    // Get the historical value
    const historical = await db.get(`
      SELECT * FROM settings_history 
      WHERE setting_id = ? AND version = ?
    `, [id, version]);

    if (!historical) {
      return res.status(404).json({ success: false, message: 'Version not found' });
    }

    const newVersion = setting.version + 1;

    // Save current to history
    await db.run(`
      INSERT INTO settings_history (
        setting_id, setting_key, old_value, new_value, version, changed_by, change_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, setting.setting_key, setting.setting_value, historical.old_value, newVersion, adminId, `Rollback to version ${version}`]);

    // Update setting
    await db.run(`
      UPDATE system_settings 
      SET setting_value = ?, version = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [historical.old_value, newVersion, adminId, id]);

    // Create audit log
    await db.run(`
      INSERT INTO audit_logs (action_type, entity_type, entity_id, admin_id, description, severity)
      VALUES ('rollback', 'system_setting', ?, ?, ?, 'warning')
    `, [id, adminId, `Rolled back setting ${setting.setting_key} to version ${version}`]);

    const updated = await db.get('SELECT * FROM system_settings WHERE id = ?', [id]);

    res.json({
      success: true,
      data: updated,
      message: 'Setting rolled back successfully'
    });

  } catch (error) {
    console.error('Error rolling back setting:', error);
    res.status(500).json({ success: false, message: 'Failed to rollback setting' });
  }
});

// Public endpoint to get non-sensitive settings (for mobile app)
router.get('/public/app', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();

    const settings = await db.all(`
      SELECT setting_key, setting_value, setting_type, category
      FROM system_settings
      WHERE is_sensitive = 0
      ORDER BY category, setting_key
    `);

    // Convert to key-value object
    const settingsObject: Record<string, any> = {};
    settings.forEach(s => {
      let value: any = s.setting_value;
      if (s.setting_type === 'boolean') {
        value = s.setting_value === 'true';
      } else if (s.setting_type === 'number') {
        value = Number(s.setting_value);
      }
      settingsObject[s.setting_key] = value;
    });

    res.json({ success: true, data: settingsObject });

  } catch (error) {
    console.error('Error fetching public settings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch settings' });
  }
});

export default router;
