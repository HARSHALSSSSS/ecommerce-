import { Router, Request, Response } from 'express';
import { getDatabase } from '../config/database';
import { authenticateAdmin } from '../middleware/auth';

const router = Router();

// Get all audit logs (Super Admin only)
router.get('/', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { 
      page = 1, 
      limit = 50,
      action_type,
      entity_type,
      entity_id,
      admin_id,
      user_id,
      severity,
      start_date,
      end_date,
      search
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    const conditions: string[] = [];
    const params: any[] = [];

    if (action_type) {
      conditions.push('al.action_type = ?');
      params.push(action_type);
    }

    if (entity_type) {
      conditions.push('al.entity_type = ?');
      params.push(entity_type);
    }

    if (entity_id) {
      conditions.push('al.entity_id = ?');
      params.push(Number(entity_id));
    }

    if (admin_id) {
      conditions.push('al.admin_id = ?');
      params.push(Number(admin_id));
    }

    if (user_id) {
      conditions.push('al.user_id = ?');
      params.push(Number(user_id));
    }

    if (severity) {
      conditions.push('al.severity = ?');
      params.push(severity);
    }

    if (start_date) {
      conditions.push('DATE(al.created_at) >= ?');
      params.push(start_date);
    }

    if (end_date) {
      conditions.push('DATE(al.created_at) <= ?');
      params.push(end_date);
    }

    if (search) {
      conditions.push('(al.description LIKE ? OR al.action_type LIKE ? OR al.entity_type LIKE ?)');
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const logs = await db.all(`
      SELECT 
        al.*,
        a.name as admin_name,
        a.email as admin_email,
        u.name as user_name,
        u.email as user_email
      FROM audit_logs al
      LEFT JOIN admins a ON a.id = al.admin_id
      LEFT JOIN users u ON u.id = al.user_id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, Number(limit), offset]);

    const total = await db.get(`
      SELECT COUNT(*) as count FROM audit_logs al ${whereClause}
    `, params);

    // Get summary stats
    const stats = await db.get(`
      SELECT 
        COUNT(*) as total_logs,
        COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_count,
        COUNT(CASE WHEN severity = 'warning' THEN 1 END) as warning_count,
        COUNT(CASE WHEN severity = 'info' THEN 1 END) as info_count,
        COUNT(CASE WHEN DATE(created_at) = DATE('now') THEN 1 END) as today_count
      FROM audit_logs
    `);

    res.json({
      success: true,
      data: logs,
      stats,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: total?.count || 0,
        pages: Math.ceil((total?.count || 0) / Number(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch audit logs' });
  }
});

// Get single audit log
router.get('/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const log = await db.get(`
      SELECT 
        al.*,
        a.name as admin_name,
        a.email as admin_email,
        u.name as user_name,
        u.email as user_email
      FROM audit_logs al
      LEFT JOIN admins a ON a.id = al.admin_id
      LEFT JOIN users u ON u.id = al.user_id
      WHERE al.id = ?
    `, [id]);

    if (!log) {
      return res.status(404).json({ success: false, message: 'Audit log not found' });
    }

    // Parse JSON fields
    if (log.old_values) log.old_values = JSON.parse(log.old_values);
    if (log.new_values) log.new_values = JSON.parse(log.new_values);

    res.json({ success: true, data: log });

  } catch (error) {
    console.error('Error fetching audit log:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch audit log' });
  }
});

// Get audit log statistics
router.get('/stats/summary', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();

    // Actions breakdown
    const actionBreakdown = await db.all(`
      SELECT action_type, COUNT(*) as count
      FROM audit_logs
      GROUP BY action_type
      ORDER BY count DESC
      LIMIT 10
    `);

    // Entity breakdown
    const entityBreakdown = await db.all(`
      SELECT entity_type, COUNT(*) as count
      FROM audit_logs
      GROUP BY entity_type
      ORDER BY count DESC
      LIMIT 10
    `);

    // Daily activity (last 30 days)
    const dailyActivity = await db.all(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count,
        COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical
      FROM audit_logs
      WHERE created_at >= datetime('now', '-30 days')
      GROUP BY DATE(created_at)
      ORDER BY date
    `);

    // Top admins by activity
    const topAdmins = await db.all(`
      SELECT 
        a.id,
        a.name,
        COUNT(al.id) as action_count
      FROM audit_logs al
      JOIN admins a ON a.id = al.admin_id
      WHERE al.created_at >= datetime('now', '-7 days')
      GROUP BY a.id
      ORDER BY action_count DESC
      LIMIT 5
    `);

    // Recent critical/warning logs
    const recentAlerts = await db.all(`
      SELECT 
        al.*,
        a.name as admin_name
      FROM audit_logs al
      LEFT JOIN admins a ON a.id = al.admin_id
      WHERE al.severity IN ('critical', 'warning')
      ORDER BY al.created_at DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        action_breakdown: actionBreakdown,
        entity_breakdown: entityBreakdown,
        daily_activity: dailyActivity,
        top_admins: topAdmins,
        recent_alerts: recentAlerts
      }
    });

  } catch (error) {
    console.error('Error fetching audit stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch audit statistics' });
  }
});

// Get action types (for filtering)
router.get('/filters/action-types', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();

    const actionTypes = await db.all(`
      SELECT DISTINCT action_type FROM audit_logs ORDER BY action_type
    `);

    res.json({
      success: true,
      data: actionTypes.map(a => a.action_type)
    });

  } catch (error) {
    console.error('Error fetching action types:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch action types' });
  }
});

// Get entity types (for filtering)
router.get('/filters/entity-types', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();

    const entityTypes = await db.all(`
      SELECT DISTINCT entity_type FROM audit_logs ORDER BY entity_type
    `);

    res.json({
      success: true,
      data: entityTypes.map(e => e.entity_type)
    });

  } catch (error) {
    console.error('Error fetching entity types:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch entity types' });
  }
});

// Create audit log (internal use)
router.post('/', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const {
      action_type,
      entity_type,
      entity_id,
      user_id,
      old_values,
      new_values,
      description,
      severity = 'info'
    } = req.body;

    const adminId = (req as any).admin?.id;
    const ip_address = req.ip || req.connection.remoteAddress;
    const user_agent = req.headers['user-agent'];

    if (!action_type || !entity_type) {
      return res.status(400).json({ 
        success: false, 
        message: 'action_type and entity_type are required' 
      });
    }

    const result = await db.run(`
      INSERT INTO audit_logs (
        action_type, entity_type, entity_id, admin_id, user_id,
        ip_address, user_agent, old_values, new_values, description, severity
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      action_type,
      entity_type,
      entity_id || null,
      adminId,
      user_id || null,
      ip_address,
      user_agent,
      old_values ? JSON.stringify(old_values) : null,
      new_values ? JSON.stringify(new_values) : null,
      description,
      severity
    ]);

    res.json({
      success: true,
      data: { id: result.lastID }
    });

  } catch (error) {
    console.error('Error creating audit log:', error);
    res.status(500).json({ success: false, message: 'Failed to create audit log' });
  }
});

// Export audit logs
router.post('/export', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { start_date, end_date, format = 'csv' } = req.body;
    const adminId = (req as any).admin?.id;

    // Get logs for export
    const logs = await db.all(`
      SELECT 
        al.*,
        a.name as admin_name,
        u.name as user_name
      FROM audit_logs al
      LEFT JOIN admins a ON a.id = al.admin_id
      LEFT JOIN users u ON u.id = al.user_id
      WHERE DATE(al.created_at) BETWEEN ? AND ?
      ORDER BY al.created_at DESC
    `, [start_date || '1970-01-01', end_date || '2099-12-31']);

    // Create export record
    const fileName = `audit_logs_${new Date().toISOString().split('T')[0]}_${Date.now()}.${format}`;
    
    await db.run(
      `INSERT INTO report_exports (report_type, file_name, format, parameters, status, exported_by)
       VALUES ('audit_logs', ?, ?, ?, 'completed', ?)`,
      [fileName, format, JSON.stringify({ start_date, end_date }), adminId]
    );

    // Log this export action
    await db.run(`
      INSERT INTO audit_logs (action_type, entity_type, admin_id, description, severity)
      VALUES ('export', 'audit_logs', ?, 'Exported audit logs', 'info')
    `, [adminId]);

    res.json({
      success: true,
      data: {
        file_name: fileName,
        record_count: logs.length,
        logs: logs
      }
    });

  } catch (error) {
    console.error('Error exporting audit logs:', error);
    res.status(500).json({ success: false, message: 'Failed to export audit logs' });
  }
});

export default router;
