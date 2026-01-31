import { Router, Request, Response } from 'express';
import { getDatabase } from '../config/database';
import { authenticateAdmin } from '../middleware/auth';

const router = Router();

// Get all feature toggles
router.get('/', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { category, is_enabled } = req.query;

    let query = `
      SELECT ft.*, a.name as updated_by_name
      FROM feature_toggles ft
      LEFT JOIN admins a ON a.id = ft.updated_by
      WHERE 1=1
    `;
    const params: any[] = [];

    if (category) {
      query += ' AND ft.category = ?';
      params.push(category);
    }

    if (is_enabled !== undefined) {
      query += ' AND ft.is_enabled = ?';
      params.push(is_enabled === 'true' ? 1 : 0);
    }

    query += ' ORDER BY ft.category, ft.feature_name';

    const toggles = await db.all(query, params);

    // Parse JSON fields
    toggles.forEach(t => {
      if (t.dependencies) t.dependencies = JSON.parse(t.dependencies);
      if (t.enabled_for_users) t.enabled_for_users = JSON.parse(t.enabled_for_users);
      if (t.disabled_for_users) t.disabled_for_users = JSON.parse(t.disabled_for_users);
    });

    // Group by category
    const groupedToggles: Record<string, any[]> = {};
    toggles.forEach(toggle => {
      if (!groupedToggles[toggle.category]) {
        groupedToggles[toggle.category] = [];
      }
      groupedToggles[toggle.category].push(toggle);
    });

    res.json({
      success: true,
      data: toggles,
      grouped: groupedToggles
    });

  } catch (error) {
    console.error('Error fetching feature toggles:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch feature toggles' });
  }
});

// Get toggle categories
router.get('/categories', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();

    const categories = await db.all(`
      SELECT 
        category, 
        COUNT(*) as total,
        SUM(is_enabled) as enabled
      FROM feature_toggles
      GROUP BY category
      ORDER BY category
    `);

    res.json({ success: true, data: categories });

  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch categories' });
  }
});

// Get single feature toggle
router.get('/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const toggle = await db.get(`
      SELECT ft.*, a.name as updated_by_name
      FROM feature_toggles ft
      LEFT JOIN admins a ON a.id = ft.updated_by
      WHERE ft.id = ?
    `, [id]);

    if (!toggle) {
      return res.status(404).json({ success: false, message: 'Feature toggle not found' });
    }

    // Parse JSON fields
    if (toggle.dependencies) toggle.dependencies = JSON.parse(toggle.dependencies);
    if (toggle.enabled_for_users) toggle.enabled_for_users = JSON.parse(toggle.enabled_for_users);
    if (toggle.disabled_for_users) toggle.disabled_for_users = JSON.parse(toggle.disabled_for_users);

    // Get toggle history
    const history = await db.all(`
      SELECT fth.*, a.name as changed_by_name
      FROM feature_toggle_history fth
      LEFT JOIN admins a ON a.id = fth.changed_by
      WHERE fth.feature_id = ?
      ORDER BY fth.created_at DESC
      LIMIT 20
    `, [id]);

    res.json({ 
      success: true, 
      data: { ...toggle, history } 
    });

  } catch (error) {
    console.error('Error fetching feature toggle:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch feature toggle' });
  }
});

// Toggle feature on/off
router.put('/:id/toggle', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { change_reason } = req.body;
    const adminId = (req as any).admin?.id;

    const toggle = await db.get('SELECT * FROM feature_toggles WHERE id = ?', [id]);
    if (!toggle) {
      return res.status(404).json({ success: false, message: 'Feature toggle not found' });
    }

    const newState = toggle.is_enabled ? 0 : 1;
    const action = newState ? 'enabled' : 'disabled';

    // Check dependencies if enabling
    if (newState && toggle.dependencies) {
      const deps = JSON.parse(toggle.dependencies);
      for (const depKey of deps) {
        const dep = await db.get(
          'SELECT is_enabled FROM feature_toggles WHERE feature_key = ?', 
          [depKey]
        );
        if (dep && !dep.is_enabled) {
          return res.status(400).json({ 
            success: false, 
            message: `Cannot enable: dependency "${depKey}" is disabled` 
          });
        }
      }
    }

    // Update toggle
    await db.run(`
      UPDATE feature_toggles 
      SET is_enabled = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [newState, adminId, id]);

    // Record history
    await db.run(`
      INSERT INTO feature_toggle_history (
        feature_id, feature_key, action, old_state, new_state, changed_by, change_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, toggle.feature_key, action, toggle.is_enabled, newState, adminId, change_reason]);

    // Create audit log
    const severity = toggle.is_kill_switch ? 'critical' : 'warning';
    await db.run(`
      INSERT INTO audit_logs (action_type, entity_type, entity_id, admin_id, description, severity)
      VALUES (?, 'feature_toggle', ?, ?, ?, ?)
    `, [action, id, adminId, `${action.charAt(0).toUpperCase() + action.slice(1)} feature: ${toggle.feature_name}`, severity]);

    const updated = await db.get('SELECT * FROM feature_toggles WHERE id = ?', [id]);

    res.json({
      success: true,
      data: updated,
      message: `Feature ${action} successfully`
    });

  } catch (error) {
    console.error('Error toggling feature:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle feature' });
  }
});

// Update feature toggle details
router.put('/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { 
      feature_name,
      description,
      category,
      is_kill_switch,
      rollout_percentage,
      dependencies,
      enabled_for_users,
      disabled_for_users
    } = req.body;
    const adminId = (req as any).admin?.id;

    const toggle = await db.get('SELECT * FROM feature_toggles WHERE id = ?', [id]);
    if (!toggle) {
      return res.status(404).json({ success: false, message: 'Feature toggle not found' });
    }

    await db.run(`
      UPDATE feature_toggles 
      SET feature_name = COALESCE(?, feature_name),
          description = COALESCE(?, description),
          category = COALESCE(?, category),
          is_kill_switch = COALESCE(?, is_kill_switch),
          rollout_percentage = COALESCE(?, rollout_percentage),
          dependencies = ?,
          enabled_for_users = ?,
          disabled_for_users = ?,
          updated_by = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      feature_name,
      description,
      category,
      is_kill_switch !== undefined ? (is_kill_switch ? 1 : 0) : null,
      rollout_percentage,
      dependencies ? JSON.stringify(dependencies) : toggle.dependencies,
      enabled_for_users ? JSON.stringify(enabled_for_users) : toggle.enabled_for_users,
      disabled_for_users ? JSON.stringify(disabled_for_users) : toggle.disabled_for_users,
      adminId,
      id
    ]);

    // Record history
    await db.run(`
      INSERT INTO feature_toggle_history (
        feature_id, feature_key, action, changed_by, change_reason
      ) VALUES (?, ?, 'updated', ?, 'Configuration updated')
    `, [id, toggle.feature_key, adminId]);

    const updated = await db.get('SELECT * FROM feature_toggles WHERE id = ?', [id]);

    res.json({
      success: true,
      data: updated,
      message: 'Feature toggle updated successfully'
    });

  } catch (error) {
    console.error('Error updating feature toggle:', error);
    res.status(500).json({ success: false, message: 'Failed to update feature toggle' });
  }
});

// Create new feature toggle
router.post('/', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { 
      feature_key,
      feature_name,
      description,
      is_enabled = true,
      is_kill_switch = false,
      category = 'general',
      rollout_percentage = 100,
      dependencies
    } = req.body;
    const adminId = (req as any).admin?.id;

    if (!feature_key || !feature_name) {
      return res.status(400).json({ 
        success: false, 
        message: 'feature_key and feature_name are required' 
      });
    }

    // Check if key exists
    const existing = await db.get('SELECT id FROM feature_toggles WHERE feature_key = ?', [feature_key]);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Feature key already exists' });
    }

    const result = await db.run(`
      INSERT INTO feature_toggles (
        feature_key, feature_name, description, is_enabled, is_kill_switch,
        category, rollout_percentage, dependencies, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      feature_key,
      feature_name,
      description,
      is_enabled ? 1 : 0,
      is_kill_switch ? 1 : 0,
      category,
      rollout_percentage,
      dependencies ? JSON.stringify(dependencies) : null,
      adminId
    ]);

    // Record history
    await db.run(`
      INSERT INTO feature_toggle_history (
        feature_id, feature_key, action, new_state, changed_by, change_reason
      ) VALUES (?, ?, 'created', ?, ?, 'Feature toggle created')
    `, [result.lastID, feature_key, is_enabled ? 1 : 0, adminId]);

    // Create audit log
    await db.run(`
      INSERT INTO audit_logs (action_type, entity_type, entity_id, admin_id, description, severity)
      VALUES ('create', 'feature_toggle', ?, ?, ?, 'info')
    `, [result.lastID, adminId, `Created feature toggle: ${feature_name}`]);

    const newToggle = await db.get('SELECT * FROM feature_toggles WHERE id = ?', [result.lastID]);

    res.json({
      success: true,
      data: newToggle,
      message: 'Feature toggle created successfully'
    });

  } catch (error) {
    console.error('Error creating feature toggle:', error);
    res.status(500).json({ success: false, message: 'Failed to create feature toggle' });
  }
});

// Delete feature toggle
router.delete('/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const adminId = (req as any).admin?.id;

    const toggle = await db.get('SELECT * FROM feature_toggles WHERE id = ?', [id]);
    if (!toggle) {
      return res.status(404).json({ success: false, message: 'Feature toggle not found' });
    }

    // Don't allow deleting kill-switch features
    if (toggle.is_kill_switch) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot delete kill-switch features. Disable it instead.' 
      });
    }

    await db.run('DELETE FROM feature_toggles WHERE id = ?', [id]);

    // Create audit log
    await db.run(`
      INSERT INTO audit_logs (action_type, entity_type, entity_id, admin_id, old_values, description, severity)
      VALUES ('delete', 'feature_toggle', ?, ?, ?, ?, 'warning')
    `, [id, adminId, JSON.stringify(toggle), `Deleted feature toggle: ${toggle.feature_name}`]);

    res.json({ success: true, message: 'Feature toggle deleted successfully' });

  } catch (error) {
    console.error('Error deleting feature toggle:', error);
    res.status(500).json({ success: false, message: 'Failed to delete feature toggle' });
  }
});

// Emergency kill-switch - disable all features in a category
router.post('/kill-switch/:category', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { category } = req.params;
    const { change_reason } = req.body;
    const adminId = (req as any).admin?.id;

    // Get all enabled features in category
    const features = await db.all(`
      SELECT * FROM feature_toggles 
      WHERE category = ? AND is_enabled = 1
    `, [category]);

    // Disable all
    await db.run(`
      UPDATE feature_toggles 
      SET is_enabled = 0, updated_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE category = ?
    `, [adminId, category]);

    // Record history for each
    for (const feature of features) {
      await db.run(`
        INSERT INTO feature_toggle_history (
          feature_id, feature_key, action, old_state, new_state, changed_by, change_reason
        ) VALUES (?, ?, 'kill_switch', 1, 0, ?, ?)
      `, [feature.id, feature.feature_key, adminId, change_reason || 'Emergency kill-switch activated']);
    }

    // Create critical audit log
    await db.run(`
      INSERT INTO audit_logs (action_type, entity_type, admin_id, description, severity)
      VALUES ('kill_switch', 'feature_toggles', ?, ?, 'critical')
    `, [adminId, `Kill-switch activated for category: ${category}. Disabled ${features.length} features.`]);

    res.json({
      success: true,
      message: `Kill-switch activated. Disabled ${features.length} features in ${category}.`
    });

  } catch (error) {
    console.error('Error activating kill-switch:', error);
    res.status(500).json({ success: false, message: 'Failed to activate kill-switch' });
  }
});

// Public endpoint to check features (for mobile app)
router.get('/public/check', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { user_id } = req.query;

    const toggles = await db.all(`
      SELECT feature_key, is_enabled, rollout_percentage, enabled_for_users, disabled_for_users
      FROM feature_toggles
    `);

    const features: Record<string, boolean> = {};

    toggles.forEach(toggle => {
      let isEnabled = toggle.is_enabled === 1;

      // Check user-specific overrides
      if (user_id && toggle.enabled_for_users) {
        const enabledUsers = JSON.parse(toggle.enabled_for_users);
        if (enabledUsers.includes(Number(user_id))) {
          isEnabled = true;
        }
      }

      if (user_id && toggle.disabled_for_users) {
        const disabledUsers = JSON.parse(toggle.disabled_for_users);
        if (disabledUsers.includes(Number(user_id))) {
          isEnabled = false;
        }
      }

      // Check rollout percentage (simple hash-based)
      if (isEnabled && toggle.rollout_percentage < 100 && user_id) {
        const hash = Number(user_id) % 100;
        isEnabled = hash < toggle.rollout_percentage;
      }

      features[toggle.feature_key] = isEnabled;
    });

    res.json({ success: true, data: features });

  } catch (error) {
    console.error('Error checking features:', error);
    res.status(500).json({ success: false, message: 'Failed to check features' });
  }
});

// Check single feature (for mobile app)
router.get('/public/check/:feature_key', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { feature_key } = req.params;
    const { user_id } = req.query;

    const toggle = await db.get(`
      SELECT is_enabled, rollout_percentage, enabled_for_users, disabled_for_users
      FROM feature_toggles
      WHERE feature_key = ?
    `, [feature_key]);

    if (!toggle) {
      return res.json({ success: true, data: { enabled: false, reason: 'Feature not found' } });
    }

    let isEnabled = toggle.is_enabled === 1;
    let reason = isEnabled ? 'Feature is enabled' : 'Feature is disabled';

    // Check user-specific overrides
    if (user_id && toggle.enabled_for_users) {
      const enabledUsers = JSON.parse(toggle.enabled_for_users);
      if (enabledUsers.includes(Number(user_id))) {
        isEnabled = true;
        reason = 'User is in enabled list';
      }
    }

    if (user_id && toggle.disabled_for_users) {
      const disabledUsers = JSON.parse(toggle.disabled_for_users);
      if (disabledUsers.includes(Number(user_id))) {
        isEnabled = false;
        reason = 'User is in disabled list';
      }
    }

    res.json({ 
      success: true, 
      data: { 
        feature_key,
        enabled: isEnabled,
        reason
      } 
    });

  } catch (error) {
    console.error('Error checking feature:', error);
    res.status(500).json({ success: false, message: 'Failed to check feature' });
  }
});

export default router;
