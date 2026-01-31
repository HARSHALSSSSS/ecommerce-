import { Router, Request, Response } from 'express';
import { authenticateAdmin } from '../middleware/auth';
import { getDatabase } from '../config/database';

const router = Router();

// ============ ROLES MANAGEMENT ============

// Get all roles
router.get('/roles', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const roles = await db.all(`
      SELECT r.*, 
        (SELECT COUNT(*) FROM admin_roles WHERE role_id = r.id) as admin_count
      FROM roles r
      ORDER BY r.created_at DESC
    `);

    // Get permissions for each role
    for (const role of roles) {
      const permissions = await db.all(`
        SELECT p.* FROM permissions p
        JOIN role_permissions rp ON p.id = rp.permission_id
        WHERE rp.role_id = ?
      `, [role.id]);
      role.permissions = permissions;
    }

    res.json({ success: true, roles });
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get single role
router.get('/roles/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const role = await db.get('SELECT * FROM roles WHERE id = ?', [req.params.id]);

    if (!role) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    // Get permissions for this role
    const permissions = await db.all(`
      SELECT p.* FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = ?
    `, [role.id]);
    role.permissions = permissions;

    res.json({ success: true, role });
  } catch (error) {
    console.error('Get role error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create role
router.post('/roles', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { name, display_name, description, permissions } = req.body;

    if (!name || !display_name) {
      return res.status(400).json({ success: false, message: 'Name and display name required' });
    }

    // Check if role exists
    const existing = await db.get('SELECT id FROM roles WHERE name = ?', [name]);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Role name already exists' });
    }

    const result = await db.run(
      'INSERT INTO roles (name, display_name, description) VALUES (?, ?, ?)',
      [name.toLowerCase().replace(/\s+/g, '_'), display_name, description || null]
    );

    // Assign permissions if provided
    if (permissions && permissions.length > 0) {
      for (const permId of permissions) {
        await db.run(
          'INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
          [result.lastID, permId]
        );
      }
    }

    // Log action
    await db.run(
      'INSERT INTO admin_logs (admin_id, action, resource_type, resource_id, ip_address) VALUES (?, ?, ?, ?, ?)',
      [req.admin?.id, 'create', 'role', result.lastID, req.ip]
    );

    const role = await db.get('SELECT * FROM roles WHERE id = ?', [result.lastID]);
    res.status(201).json({ success: true, role });
  } catch (error) {
    console.error('Create role error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update role
router.put('/roles/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { display_name, description, permissions, is_active } = req.body;

    const role = await db.get('SELECT * FROM roles WHERE id = ?', [id]);
    if (!role) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    if (role.is_system) {
      return res.status(403).json({ success: false, message: 'Cannot modify system role' });
    }

    await db.run(
      `UPDATE roles SET 
        display_name = COALESCE(?, display_name),
        description = COALESCE(?, description),
        is_active = COALESCE(?, is_active),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [display_name, description, is_active, id]
    );

    // Update permissions if provided
    if (permissions !== undefined) {
      await db.run('DELETE FROM role_permissions WHERE role_id = ?', [id]);
      for (const permId of permissions) {
        await db.run(
          'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
          [id, permId]
        );
      }
    }

    // Log action
    await db.run(
      'INSERT INTO admin_logs (admin_id, action, resource_type, resource_id, ip_address) VALUES (?, ?, ?, ?, ?)',
      [req.admin?.id, 'update', 'role', id, req.ip]
    );

    const updatedRole = await db.get('SELECT * FROM roles WHERE id = ?', [id]);
    res.json({ success: true, role: updatedRole });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete role
router.delete('/roles/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const role = await db.get('SELECT * FROM roles WHERE id = ?', [id]);
    if (!role) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    if (role.is_system) {
      return res.status(403).json({ success: false, message: 'Cannot delete system role' });
    }

    // Check if role is assigned to any admin
    const assigned = await db.get('SELECT COUNT(*) as count FROM admin_roles WHERE role_id = ?', [id]);
    if (assigned && assigned.count > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot delete role. It is assigned to ${assigned.count} admin(s)` 
      });
    }

    await db.run('DELETE FROM roles WHERE id = ?', [id]);

    // Log action
    await db.run(
      'INSERT INTO admin_logs (admin_id, action, resource_type, resource_id, ip_address) VALUES (?, ?, ?, ?, ?)',
      [req.admin?.id, 'delete', 'role', id, req.ip]
    );

    res.json({ success: true, message: 'Role deleted' });
  } catch (error) {
    console.error('Delete role error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============ PERMISSIONS MANAGEMENT ============

// Get all permissions (grouped by module)
router.get('/permissions', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const permissions = await db.all('SELECT * FROM permissions ORDER BY module, action');

    // Group by module
    const grouped: Record<string, any[]> = {};
    for (const perm of permissions) {
      if (!grouped[perm.module]) {
        grouped[perm.module] = [];
      }
      grouped[perm.module].push(perm);
    }

    res.json({ success: true, permissions, grouped });
  } catch (error) {
    console.error('Get permissions error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get permission matrix for a role
router.get('/permissions/matrix/:roleId', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { roleId } = req.params;

    const role = await db.get('SELECT * FROM roles WHERE id = ?', [roleId]);
    if (!role) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    const allPermissions = await db.all('SELECT * FROM permissions ORDER BY module, action');
    const rolePermissions = await db.all(
      'SELECT permission_id FROM role_permissions WHERE role_id = ?',
      [roleId]
    );
    const rolePermIds = new Set(rolePermissions.map(rp => rp.permission_id));

    // Build matrix
    const modules: Record<string, any> = {};
    for (const perm of allPermissions) {
      if (!modules[perm.module]) {
        modules[perm.module] = { module: perm.module, permissions: {} };
      }
      modules[perm.module].permissions[perm.action] = {
        id: perm.id,
        enabled: rolePermIds.has(perm.id)
      };
    }

    res.json({ success: true, role, matrix: Object.values(modules) });
  } catch (error) {
    console.error('Get permission matrix error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update permission matrix for a role
router.put('/permissions/matrix/:roleId', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { roleId } = req.params;
    const { permissions } = req.body; // Array of permission IDs to enable

    const role = await db.get('SELECT * FROM roles WHERE id = ?', [roleId]);
    if (!role) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    if (role.is_system && role.name === 'super_admin') {
      return res.status(403).json({ success: false, message: 'Cannot modify super admin permissions' });
    }

    // Replace all permissions
    await db.run('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);
    
    if (permissions && permissions.length > 0) {
      for (const permId of permissions) {
        await db.run(
          'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
          [roleId, permId]
        );
      }
    }

    // Log action
    await db.run(
      'INSERT INTO admin_logs (admin_id, action, resource_type, resource_id, changes, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
      [req.admin?.id, 'update_permissions', 'role', roleId, JSON.stringify(permissions), req.ip]
    );

    res.json({ success: true, message: 'Permissions updated' });
  } catch (error) {
    console.error('Update permission matrix error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============ ADMIN USER MANAGEMENT ============

// Get all admins with roles
router.get('/admins', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { page = 1, limit = 20, status } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = 'SELECT id, email, name, role, is_active, last_login, created_at FROM admins WHERE 1=1';
    const params: any[] = [];

    if (status === 'active') {
      query += ' AND is_active = 1';
    } else if (status === 'blocked') {
      query += ' AND is_active = 0';
    }

    const countResult = await db.get(query.replace('SELECT id, email, name, role, is_active, last_login, created_at', 'SELECT COUNT(*) as total'), params);

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), offset);

    const admins = await db.all(query, params);

    // Get roles for each admin
    for (const admin of admins) {
      const roles = await db.all(`
        SELECT r.* FROM roles r
        JOIN admin_roles ar ON r.id = ar.role_id
        WHERE ar.admin_id = ?
      `, [admin.id]);
      admin.roles = roles;
    }

    res.json({
      success: true,
      admins,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: countResult?.total || 0,
        totalPages: Math.ceil((countResult?.total || 0) / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get admins error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get single admin
router.get('/admins/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const admin = await db.get(
      'SELECT id, email, name, role, is_active, last_login, created_at FROM admins WHERE id = ?',
      [req.params.id]
    );

    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    // Get roles
    const roles = await db.all(`
      SELECT r.* FROM roles r
      JOIN admin_roles ar ON r.id = ar.role_id
      WHERE ar.admin_id = ?
    `, [admin.id]);
    admin.roles = roles;

    // Get activity logs
    const logs = await db.all(
      'SELECT * FROM admin_logs WHERE admin_id = ? ORDER BY created_at DESC LIMIT 20',
      [admin.id]
    );
    admin.recentActivity = logs;

    res.json({ success: true, admin });
  } catch (error) {
    console.error('Get admin error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create admin
router.post('/admins', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const bcrypt = await import('bcryptjs');
    const { email, password, name, roleIds } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ success: false, message: 'Email, password and name required' });
    }

    // Check if email exists
    const existing = await db.get('SELECT id FROM admins WHERE email = ?', [email]);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await db.run(
      'INSERT INTO admins (email, password, name) VALUES (?, ?, ?)',
      [email, hashedPassword, name]
    );

    // Assign roles
    if (roleIds && roleIds.length > 0) {
      for (const roleId of roleIds) {
        await db.run(
          'INSERT INTO admin_roles (admin_id, role_id, assigned_by) VALUES (?, ?, ?)',
          [result.lastID, roleId, req.admin?.id]
        );
      }
    }

    // Log action
    await db.run(
      'INSERT INTO admin_logs (admin_id, action, resource_type, resource_id, ip_address) VALUES (?, ?, ?, ?, ?)',
      [req.admin?.id, 'create', 'admin', result.lastID, req.ip]
    );

    res.status(201).json({ 
      success: true, 
      admin: { id: result.lastID, email, name }
    });
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update admin
router.put('/admins/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { name, is_active, roleIds } = req.body;

    const admin = await db.get('SELECT * FROM admins WHERE id = ?', [id]);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    // Prevent self-deactivation
    if (Number(id) === req.admin?.id && is_active === 0) {
      return res.status(400).json({ success: false, message: 'Cannot deactivate yourself' });
    }

    await db.run(
      `UPDATE admins SET 
        name = COALESCE(?, name),
        is_active = COALESCE(?, is_active),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, is_active, id]
    );

    // Update roles if provided
    if (roleIds !== undefined) {
      await db.run('DELETE FROM admin_roles WHERE admin_id = ?', [id]);
      for (const roleId of roleIds) {
        await db.run(
          'INSERT INTO admin_roles (admin_id, role_id, assigned_by) VALUES (?, ?, ?)',
          [id, roleId, req.admin?.id]
        );
      }
    }

    // Log action
    await db.run(
      'INSERT INTO admin_logs (admin_id, action, resource_type, resource_id, ip_address) VALUES (?, ?, ?, ?, ?)',
      [req.admin?.id, 'update', 'admin', id, req.ip]
    );

    res.json({ success: true, message: 'Admin updated' });
  } catch (error) {
    console.error('Update admin error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Block/Unblock admin
router.patch('/admins/:id/status', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { is_active } = req.body;

    if (Number(id) === req.admin?.id) {
      return res.status(400).json({ success: false, message: 'Cannot change your own status' });
    }

    await db.run('UPDATE admins SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [is_active ? 1 : 0, id]);

    // If blocking, invalidate all sessions
    if (!is_active) {
      await db.run('UPDATE admin_sessions SET is_active = 0 WHERE admin_id = ?', [id]);
    }

    // Log action
    await db.run(
      'INSERT INTO admin_logs (admin_id, action, resource_type, resource_id, ip_address) VALUES (?, ?, ?, ?, ?)',
      [req.admin?.id, is_active ? 'unblock' : 'block', 'admin', id, req.ip]
    );

    res.json({ success: true, message: is_active ? 'Admin unblocked' : 'Admin blocked' });
  } catch (error) {
    console.error('Update admin status error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============ SESSION MANAGEMENT ============

// Get all active sessions
router.get('/sessions', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const sessions = await db.all(`
      SELECT s.*, a.name as admin_name, a.email as admin_email
      FROM admin_sessions s
      JOIN admins a ON s.admin_id = a.id
      WHERE s.is_active = 1 AND s.expires_at > datetime('now')
      ORDER BY s.last_activity DESC
    `);

    res.json({ success: true, sessions });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get sessions for specific admin
router.get('/sessions/admin/:adminId', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const sessions = await db.all(`
      SELECT * FROM admin_sessions 
      WHERE admin_id = ? AND is_active = 1 AND expires_at > datetime('now')
      ORDER BY last_activity DESC
    `, [req.params.adminId]);

    res.json({ success: true, sessions });
  } catch (error) {
    console.error('Get admin sessions error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Force logout session
router.delete('/sessions/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const session = await db.get('SELECT * FROM admin_sessions WHERE id = ?', [id]);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    await db.run('UPDATE admin_sessions SET is_active = 0 WHERE id = ?', [id]);

    // Log action
    await db.run(
      'INSERT INTO admin_logs (admin_id, action, resource_type, resource_id, ip_address) VALUES (?, ?, ?, ?, ?)',
      [req.admin?.id, 'force_logout', 'session', id, req.ip]
    );

    res.json({ success: true, message: 'Session terminated' });
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Force logout all sessions for an admin
router.delete('/sessions/admin/:adminId/all', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { adminId } = req.params;

    await db.run('UPDATE admin_sessions SET is_active = 0 WHERE admin_id = ?', [adminId]);

    // Log action
    await db.run(
      'INSERT INTO admin_logs (admin_id, action, resource_type, resource_id, ip_address) VALUES (?, ?, ?, ?, ?)',
      [req.admin?.id, 'force_logout_all', 'admin', adminId, req.ip]
    );

    res.json({ success: true, message: 'All sessions terminated' });
  } catch (error) {
    console.error('Delete all sessions error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============ ACTIVITY LOGS ============

router.get('/logs', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { page = 1, limit = 50, admin_id, action, resource_type } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = `
      SELECT l.*, a.name as admin_name, a.email as admin_email
      FROM admin_logs l
      LEFT JOIN admins a ON l.admin_id = a.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (admin_id) {
      query += ' AND l.admin_id = ?';
      params.push(admin_id);
    }
    if (action) {
      query += ' AND l.action = ?';
      params.push(action);
    }
    if (resource_type) {
      query += ' AND l.resource_type = ?';
      params.push(resource_type);
    }

    const countResult = await db.get(
      query.replace('SELECT l.*, a.name as admin_name, a.email as admin_email', 'SELECT COUNT(*) as total'),
      params
    );

    query += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), offset);

    const logs = await db.all(query, params);

    res.json({
      success: true,
      logs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: countResult?.total || 0,
        totalPages: Math.ceil((countResult?.total || 0) / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
