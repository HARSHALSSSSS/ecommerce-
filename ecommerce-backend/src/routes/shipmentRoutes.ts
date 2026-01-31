import { Router, Request, Response } from 'express';
import { getDatabase } from '../config/database';
import { authenticateAdmin, authenticateUser } from '../middleware/auth';

const router = Router();

// ========================================
// COURIER CONFIGURATION
// ========================================
const DEFAULT_COURIERS = [
  { code: 'fedex', name: 'FedEx', tracking_url_template: 'https://www.fedex.com/fedextrack/?trknbr={tracking_number}' },
  { code: 'ups', name: 'UPS', tracking_url_template: 'https://www.ups.com/track?tracknum={tracking_number}' },
  { code: 'usps', name: 'USPS', tracking_url_template: 'https://tools.usps.com/go/TrackConfirmAction?tLabels={tracking_number}' },
  { code: 'dhl', name: 'DHL', tracking_url_template: 'https://www.dhl.com/en/express/tracking.html?AWB={tracking_number}' },
  { code: 'bluedart', name: 'BlueDart', tracking_url_template: 'https://www.bluedart.com/tracking/{tracking_number}' },
  { code: 'local', name: 'Local Delivery', tracking_url_template: '' },
];

// Shipment statuses
const SHIPMENT_STATUSES: Record<string, { label: string; next: string[] }> = {
  pending: { label: 'Pending', next: ['picked_up', 'cancelled'] },
  picked_up: { label: 'Picked Up', next: ['in_transit', 'returned_to_sender'] },
  in_transit: { label: 'In Transit', next: ['out_for_delivery', 'at_facility', 'delayed', 'returned_to_sender'] },
  at_facility: { label: 'At Facility', next: ['in_transit', 'out_for_delivery'] },
  out_for_delivery: { label: 'Out for Delivery', next: ['delivered', 'failed_attempt'] },
  delivered: { label: 'Delivered', next: [] },
  failed_attempt: { label: 'Failed Attempt', next: ['out_for_delivery', 'returned_to_sender'] },
  delayed: { label: 'Delayed', next: ['in_transit', 'returned_to_sender'] },
  returned_to_sender: { label: 'Returned to Sender', next: [] },
  cancelled: { label: 'Cancelled', next: [] },
};

// Helper: Generate shipment number
function generateShipmentNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SHP-${timestamp}-${random}`;
}

// Helper: Log shipment event
async function logShipmentEvent(
  shipmentId: number,
  status: string,
  location: string | null,
  description: string,
  source: string = 'manual'
): Promise<void> {
  const db = getDatabase();
  await db.run(
    `INSERT INTO shipment_events (shipment_id, status, location, description, source)
     VALUES (?, ?, ?, ?, ?)`,
    [shipmentId, status, location, description, source]
  );
}

// ========================================
// ADMIN SHIPMENT ROUTES
// ========================================

// GET /api/admin/couriers - Get available couriers
router.get('/couriers', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    let couriers = await db.all('SELECT * FROM couriers WHERE is_active = 1 ORDER BY priority DESC, name ASC');
    
    // Seed default couriers if none exist
    if (couriers.length === 0) {
      for (const courier of DEFAULT_COURIERS) {
        await db.run(
          `INSERT INTO couriers (code, name, tracking_url_template) VALUES (?, ?, ?)`,
          [courier.code, courier.name, courier.tracking_url_template]
        );
      }
      couriers = await db.all('SELECT * FROM couriers WHERE is_active = 1 ORDER BY priority DESC, name ASC');
    }
    
    res.json({ success: true, couriers });
  } catch (error) {
    console.error('Error fetching couriers:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch couriers' });
  }
});

// POST /api/admin/shipments - Create shipment for an order
router.post('/shipments', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const admin = (req as any).admin;
    const {
      order_id,
      courier_id,
      tracking_number,
      weight,
      dimensions,
      shipping_cost,
      estimated_delivery,
      pickup_address,
      pickup_scheduled,
      notes,
    } = req.body;

    // Validate order exists and is ready for shipping
    const order = await db.get(
      'SELECT id, status, order_number FROM orders WHERE id = ?',
      [order_id]
    );
    
    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    if (!['ready_for_shipping', 'processing'].includes(order.status)) {
      res.status(400).json({ 
        success: false, 
        message: `Cannot create shipment for order with status: ${order.status}. Order must be in 'processing' or 'ready_for_shipping' status.` 
      });
      return;
    }

    // Check if shipment already exists
    const existingShipment = await db.get(
      'SELECT id FROM shipments WHERE order_id = ?',
      [order_id]
    );
    
    if (existingShipment) {
      res.status(400).json({ success: false, message: 'Shipment already exists for this order' });
      return;
    }

    // Get courier details
    const courier = await db.get('SELECT * FROM couriers WHERE code = ?', [courier_id]);
    if (!courier) {
      res.status(400).json({ success: false, message: 'Invalid courier selected' });
      return;
    }

    // Generate tracking URL
    let tracking_url = null;
    if (tracking_number && courier.tracking_url_template) {
      tracking_url = courier.tracking_url_template.replace('{tracking_number}', tracking_number);
    }

    // Create shipment
    const shipmentNumber = generateShipmentNumber();
    const result = await db.run(
      `INSERT INTO shipments (
        order_id, shipment_number, courier_id, courier_name, tracking_number,
        tracking_url, status, weight, dimensions, shipping_cost,
        estimated_delivery, pickup_address, pickup_scheduled, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        order_id, shipmentNumber, courier_id, courier.name, tracking_number,
        tracking_url, weight, dimensions, shipping_cost,
        estimated_delivery, pickup_address, pickup_scheduled, notes, admin.id
      ]
    );

    const shipmentId = result.lastID;

    // Log initial event
    await logShipmentEvent(
      shipmentId!,
      'pending',
      null,
      `Shipment created with ${courier.name}${tracking_number ? ` (Tracking: ${tracking_number})` : ''}`
    );

    // Update order status to shipped
    await db.run(
      `UPDATE orders SET status = 'shipped', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [order_id]
    );

    // Log order event
    await db.run(
      `INSERT INTO order_events (order_id, event_type, previous_status, new_status, actor_type, actor_id, actor_name, notes)
       VALUES (?, 'status_change', ?, 'shipped', 'admin', ?, ?, ?)`,
      [order_id, order.status, admin.id, admin.email, `Shipment created: ${shipmentNumber}`]
    );

    const shipment = await db.get('SELECT * FROM shipments WHERE id = ?', [shipmentId]);

    res.status(201).json({
      success: true,
      message: 'Shipment created successfully',
      shipment,
    });
  } catch (error) {
    console.error('Error creating shipment:', error);
    res.status(500).json({ success: false, message: 'Failed to create shipment' });
  }
});

// GET /api/admin/shipments - Get all shipments
router.get('/shipments', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const { page = 1, limit = 20, status, courier, search, date_from, date_to } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereClause = '1=1';
    const params: any[] = [];

    if (status && status !== 'all') {
      whereClause += ' AND s.status = ?';
      params.push(status);
    }

    if (courier) {
      whereClause += ' AND s.courier_id = ?';
      params.push(courier);
    }

    if (search) {
      whereClause += ' AND (s.shipment_number LIKE ? OR s.tracking_number LIKE ? OR o.order_number LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (date_from) {
      whereClause += ' AND DATE(s.created_at) >= ?';
      params.push(date_from);
    }

    if (date_to) {
      whereClause += ' AND DATE(s.created_at) <= ?';
      params.push(date_to);
    }

    // Get count
    const countResult = await db.get(
      `SELECT COUNT(*) as total FROM shipments s
       LEFT JOIN orders o ON s.order_id = o.id
       WHERE ${whereClause}`,
      params
    );

    // Get shipments with order and customer info
    const shipments = await db.all(
      `SELECT s.*, 
              o.order_number, o.total_amount as order_total, o.status as order_status,
              u.name as customer_name, u.email as customer_email
       FROM shipments s
       LEFT JOIN orders o ON s.order_id = o.id
       LEFT JOIN users u ON o.user_id = u.id
       WHERE ${whereClause}
       ORDER BY s.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );

    res.json({
      success: true,
      shipments,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: countResult?.total || 0,
        totalPages: Math.ceil((countResult?.total || 0) / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching shipments:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch shipments' });
  }
});

// GET /api/admin/shipments/stats - Get shipment statistics
router.get('/shipments/stats', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();

    const stats = await db.get(`
      SELECT 
        COUNT(*) as total_shipments,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'picked_up' THEN 1 ELSE 0 END) as picked_up,
        SUM(CASE WHEN status = 'in_transit' THEN 1 ELSE 0 END) as in_transit,
        SUM(CASE WHEN status = 'out_for_delivery' THEN 1 ELSE 0 END) as out_for_delivery,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN status IN ('failed_attempt', 'delayed') THEN 1 ELSE 0 END) as issues,
        SUM(CASE WHEN status = 'returned_to_sender' THEN 1 ELSE 0 END) as returned,
        SUM(shipping_cost) as total_shipping_cost
      FROM shipments
    `);

    const todayStats = await db.get(`
      SELECT 
        COUNT(*) as created_today,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered_today
      FROM shipments
      WHERE DATE(created_at) = DATE('now')
    `);

    res.json({
      success: true,
      stats: {
        ...stats,
        today: todayStats,
      },
    });
  } catch (error) {
    console.error('Error fetching shipment stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch shipment statistics' });
  }
});

// GET /api/admin/shipments/:id - Get single shipment details
router.get('/shipments/:id', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const shipment = await db.get(
      `SELECT s.*, 
              o.order_number, o.total_amount as order_total, o.status as order_status,
              o.delivery_address, o.city, o.postal_code,
              u.name as customer_name, u.email as customer_email, u.phone as customer_phone
       FROM shipments s
       LEFT JOIN orders o ON s.order_id = o.id
       LEFT JOIN users u ON o.user_id = u.id
       WHERE s.id = ?`,
      [id]
    );

    if (!shipment) {
      res.status(404).json({ success: false, message: 'Shipment not found' });
      return;
    }

    // Get tracking timeline
    const timeline = await db.all(
      `SELECT * FROM shipment_events WHERE shipment_id = ? ORDER BY event_time DESC`,
      [id]
    );

    // Get available status transitions
    const currentStatus = shipment.status;
    const transitions = SHIPMENT_STATUSES[currentStatus];
    const availableTransitions = transitions?.next.map(status => ({
      status,
      label: SHIPMENT_STATUSES[status]?.label || status,
    })) || [];

    res.json({
      success: true,
      shipment: {
        ...shipment,
        timeline,
        available_transitions: availableTransitions,
      },
    });
  } catch (error) {
    console.error('Error fetching shipment:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch shipment' });
  }
});

// GET /api/admin/shipments/order/:orderId - Get shipment by order ID
router.get('/shipments/order/:orderId', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const { orderId } = req.params;

    const shipment = await db.get(
      `SELECT s.*, 
              o.order_number, o.total_amount as order_total
       FROM shipments s
       LEFT JOIN orders o ON s.order_id = o.id
       WHERE s.order_id = ?`,
      [orderId]
    );

    if (!shipment) {
      res.json({ success: true, shipment: null });
      return;
    }

    // Get tracking timeline
    const timeline = await db.all(
      `SELECT * FROM shipment_events WHERE shipment_id = ? ORDER BY event_time DESC`,
      [shipment.id]
    );

    res.json({
      success: true,
      shipment: {
        ...shipment,
        timeline,
      },
    });
  } catch (error) {
    console.error('Error fetching shipment by order:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch shipment' });
  }
});

// PUT /api/admin/shipments/:id/status - Update shipment status
router.put('/shipments/:id/status', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const admin = (req as any).admin;
    const { id } = req.params;
    const { new_status, location, description } = req.body;

    const shipment = await db.get('SELECT * FROM shipments WHERE id = ?', [id]);
    if (!shipment) {
      res.status(404).json({ success: false, message: 'Shipment not found' });
      return;
    }

    // Validate transition
    const currentTransitions = SHIPMENT_STATUSES[shipment.status];
    if (!currentTransitions?.next.includes(new_status)) {
      res.status(400).json({
        success: false,
        message: `Invalid status transition from '${shipment.status}' to '${new_status}'`,
      });
      return;
    }

    // Update shipment
    let updateQuery = 'UPDATE shipments SET status = ?, updated_at = CURRENT_TIMESTAMP';
    const updateParams: any[] = [new_status];

    if (new_status === 'delivered') {
      updateQuery += ', actual_delivery = CURRENT_TIMESTAMP';
    }

    updateQuery += ' WHERE id = ?';
    updateParams.push(id);

    await db.run(updateQuery, updateParams);

    // Log shipment event
    await logShipmentEvent(
      Number(id),
      new_status,
      location || null,
      description || `Status updated to ${SHIPMENT_STATUSES[new_status]?.label || new_status}`
    );

    // Update order status if delivered
    if (new_status === 'delivered') {
      await db.run(
        `UPDATE orders SET status = 'delivered', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [shipment.order_id]
      );

      await db.run(
        `INSERT INTO order_events (order_id, event_type, previous_status, new_status, actor_type, actor_id, actor_name, notes)
         VALUES (?, 'status_change', 'shipped', 'delivered', 'admin', ?, ?, 'Package delivered')`,
        [shipment.order_id, admin.id, admin.email]
      );
    }

    res.json({
      success: true,
      message: `Shipment status updated to ${SHIPMENT_STATUSES[new_status]?.label || new_status}`,
    });
  } catch (error) {
    console.error('Error updating shipment status:', error);
    res.status(500).json({ success: false, message: 'Failed to update shipment status' });
  }
});

// PUT /api/admin/shipments/:id/tracking - Update tracking number
router.put('/shipments/:id/tracking', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { tracking_number } = req.body;

    const shipment = await db.get('SELECT * FROM shipments WHERE id = ?', [id]);
    if (!shipment) {
      res.status(404).json({ success: false, message: 'Shipment not found' });
      return;
    }

    // Get courier for tracking URL
    const courier = await db.get('SELECT * FROM couriers WHERE code = ?', [shipment.courier_id]);
    let tracking_url = null;
    if (tracking_number && courier?.tracking_url_template) {
      tracking_url = courier.tracking_url_template.replace('{tracking_number}', tracking_number);
    }

    await db.run(
      `UPDATE shipments SET tracking_number = ?, tracking_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [tracking_number, tracking_url, id]
    );

    await logShipmentEvent(
      Number(id),
      shipment.status,
      null,
      `Tracking number updated: ${tracking_number}`
    );

    res.json({
      success: true,
      message: 'Tracking number updated',
      tracking_url,
    });
  } catch (error) {
    console.error('Error updating tracking number:', error);
    res.status(500).json({ success: false, message: 'Failed to update tracking number' });
  }
});

// ========================================
// USER SHIPMENT ROUTES (for mobile app)
// ========================================

// GET /api/orders/shipment/:orderId - Get shipment tracking for user's order
router.get('/tracking/:orderId', authenticateUser, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const user = (req as any).user;
    const { orderId } = req.params;

    // Verify order belongs to user
    const order = await db.get(
      'SELECT id FROM orders WHERE id = ? AND user_id = ?',
      [orderId, user.id]
    );

    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    const shipment = await db.get(
      `SELECT id, shipment_number, courier_name, tracking_number, tracking_url,
              status, estimated_delivery, actual_delivery, created_at
       FROM shipments WHERE order_id = ?`,
      [orderId]
    );

    if (!shipment) {
      res.json({ success: true, shipment: null, message: 'No shipment created yet' });
      return;
    }

    // Get tracking timeline
    const timeline = await db.all(
      `SELECT status, location, description, event_time 
       FROM shipment_events 
       WHERE shipment_id = ? 
       ORDER BY event_time DESC`,
      [shipment.id]
    );

    res.json({
      success: true,
      shipment: {
        ...shipment,
        status_label: SHIPMENT_STATUSES[shipment.status]?.label || shipment.status,
        timeline: timeline.map(e => ({
          ...e,
          status_label: SHIPMENT_STATUSES[e.status]?.label || e.status,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching shipment tracking:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch shipment tracking' });
  }
});

export default router;
