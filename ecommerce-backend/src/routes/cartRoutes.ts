import { Router } from 'express';
import { authenticateUser } from '../middleware/auth';
import { getDatabase } from '../config/database';

const router = Router();

// Get user's cart
router.get('/', authenticateUser, async (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user!.id;

    console.log('📦 Getting cart for user:', userId);

    const cartItems = await db.all(
      `SELECT c.id, c.quantity, p.id as product_id, p.name, p.price, p.discount_percent, 
              p.image_url, p.stock_quantity
       FROM cart c
       JOIN products p ON c.product_id = p.id
       WHERE c.user_id = ?`,
      [userId]
    );

    console.log('📦 Cart items found:', cartItems.length);

    // Calculate totals
    let subtotal = 0;
    const items = cartItems.map(item => {
      const discountedPrice = item.price * (1 - item.discount_percent / 100);
      const itemTotal = discountedPrice * item.quantity;
      subtotal += itemTotal;
      return {
        ...item,
        discounted_price: discountedPrice,
        item_total: itemTotal,
      };
    });

    res.json({
      success: true,
      cart: {
        items,
        subtotal,
        item_count: items.reduce((sum, item) => sum + item.quantity, 0),
      },
    });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Add to cart
router.post('/add', authenticateUser, async (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user!.id;
    const { product_id, quantity = 1 } = req.body;

    console.log('🛒 Add to cart request - User:', userId, 'Product:', product_id, 'Qty:', quantity);

    if (!product_id) {
      return res.status(400).json({ success: false, message: 'Product ID is required' });
    }

    // Check if product exists
    const product = await db.get('SELECT * FROM products WHERE id = ?', [product_id]);
    if (!product) {
      console.log('🛒 Product not found:', product_id);
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    console.log('🛒 Product found:', product.name);

    // Check stock
    if (product.stock_quantity < quantity) {
      return res.status(400).json({ success: false, message: 'Not enough stock' });
    }

    // Check if already in cart
    const existingItem = await db.get(
      'SELECT * FROM cart WHERE user_id = ? AND product_id = ?',
      [userId, product_id]
    );

    if (existingItem) {
      // Update quantity
      const newQuantity = existingItem.quantity + quantity;
      if (newQuantity > product.stock_quantity) {
        return res.status(400).json({ success: false, message: 'Not enough stock' });
      }

      await db.run(
        'UPDATE cart SET quantity = ? WHERE id = ?',
        [newQuantity, existingItem.id]
      );
      console.log('🛒 Updated cart item quantity to:', newQuantity);
    } else {
      // Add new item
      await db.run(
        'INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, ?)',
        [userId, product_id, quantity]
      );
      console.log('🛒 Added new item to cart');
    }

    res.json({ success: true, message: 'Added to cart' });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update cart item quantity
router.put('/:id', authenticateUser, async (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user!.id;
    const { id } = req.params;
    const { quantity } = req.body;

    if (quantity < 1) {
      return res.status(400).json({ success: false, message: 'Quantity must be at least 1' });
    }

    // Check if cart item belongs to user
    const cartItem = await db.get(
      'SELECT c.*, p.stock_quantity FROM cart c JOIN products p ON c.product_id = p.id WHERE c.id = ? AND c.user_id = ?',
      [id, userId]
    );

    if (!cartItem) {
      return res.status(404).json({ success: false, message: 'Cart item not found' });
    }

    if (quantity > cartItem.stock_quantity) {
      return res.status(400).json({ success: false, message: 'Not enough stock' });
    }

    await db.run('UPDATE cart SET quantity = ? WHERE id = ?', [quantity, id]);
    res.json({ success: true, message: 'Cart updated' });
  } catch (error) {
    console.error('Update cart error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Remove from cart
router.delete('/:id', authenticateUser, async (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user!.id;
    const { id } = req.params;

    const cartItem = await db.get(
      'SELECT * FROM cart WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (!cartItem) {
      return res.status(404).json({ success: false, message: 'Cart item not found' });
    }

    await db.run('DELETE FROM cart WHERE id = ?', [id]);
    res.json({ success: true, message: 'Removed from cart' });
  } catch (error) {
    console.error('Remove from cart error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Clear cart
router.delete('/', authenticateUser, async (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user!.id;

    await db.run('DELETE FROM cart WHERE user_id = ?', [userId]);
    res.json({ success: true, message: 'Cart cleared' });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
