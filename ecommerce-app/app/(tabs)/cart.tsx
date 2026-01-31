import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, FlatList, Alert, Platform, Image, Dimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import db from '@/src/database/db';
import { COLORS, SPACING, BORDER_RADIUS } from '@/src/constants/colors';
import { RESPONSIVE_FONT, RESPONSIVE_SPACING, RESPONSIVE_DIMENSION, getScreenPadding } from '@/src/constants/responsive';

const { width } = Dimensions.get('window');
const SCREEN_PADDING = getScreenPadding();

interface CartItem {
  id: number;
  product_id: number;
  name: string;
  price: number;
  quantity: number;
  size: string;
}

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [totalPrice, setTotalPrice] = useState(0);

  useFocusEffect(
    React.useCallback(() => {
      loadCart();
    }, [])
  );

  const loadCart = async () => {
    try {
      if (Platform.OS === 'web' || !db) {
        // Mock cart data for web
        setCartItems([]);
        setTotalPrice(0);
        return;
      }

      const result = await db.getAllAsync(`
        SELECT c.id, c.product_id, p.name, p.price, c.quantity, c.size
        FROM cart c
        JOIN products p ON c.product_id = p.id
      `);
      setCartItems(result as CartItem[]);

      const total = (result as CartItem[]).reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );
      setTotalPrice(total);
    } catch (error) {
      console.error('Error loading cart:', error);
    }
  };

  const handleRemoveItem = async (cartId: number) => {
    try {
      if (Platform.OS === 'web' || !db) {
        Alert.alert('Web Mode', 'Database operations not available on web');
        return;
      }
      await db.runAsync('DELETE FROM cart WHERE id = ?', [cartId]);
      loadCart();
      Alert.alert('Success', 'Item removed from cart');
    } catch (error) {
      Alert.alert('Error', 'Failed to remove item');
    }
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0) {
      Alert.alert('Error', 'Your cart is empty');
      return;
    }

    try {
      // Create order
      const orderResult = await db.runAsync(
        'INSERT INTO orders (user_id, total_amount, status, delivery_address) VALUES (?, ?, ?, ?)',
        [1, totalPrice, 'pending', 'Default Address']
      );

      // Add order items
      for (const item of cartItems) {
        await db.runAsync(
          'INSERT INTO order_items (order_id, product_id, quantity, size, price) VALUES (?, ?, ?, ?, ?)',
          [orderResult.lastInsertRowId, item.product_id, item.quantity, item.size, item.price]
        );
      }

      // Clear cart
      await db.runAsync('DELETE FROM cart');
      setCartItems([]);
      setTotalPrice(0);
      Alert.alert('Success', 'Order placed successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to place order');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={[styles.content, { paddingTop: insets.top }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Shopping Cart</Text>
        </View>

        {cartItems.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="cart-outline" size={80} color={COLORS.lightGray} />
            <Text style={styles.emptyText}>Your cart is empty</Text>
          </View>
        ) : (
          <View>
            {cartItems.map((item) => (
              <View key={item.id} style={styles.cartItem}>
                <View style={styles.itemImage} />
                <View style={styles.itemDetails}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemSize}>Size: {item.size}</Text>
                  <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
                </View>
                <View style={styles.itemQuantity}>
                  <Text style={styles.quantity}>x{item.quantity}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleRemoveItem(item.id)}
                  style={styles.deleteButton}
                >
                  <Ionicons name="trash-outline" size={20} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {cartItems.length > 0 && (
        <View style={styles.footer}>
          <View style={styles.priceBreakdown}>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Subtotal</Text>
              <Text style={styles.priceValue}>${totalPrice.toFixed(2)}</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Shipping</Text>
              <Text style={styles.priceValue}>$10.00</Text>
            </View>
            <View style={[styles.priceRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>${(totalPrice + 10).toFixed(2)}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.checkoutButton} onPress={handleCheckout}>
            <Text style={styles.checkoutButtonText}>Checkout</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  content: {
    flex: 1,
    paddingHorizontal: SCREEN_PADDING,
  },
  header: {
    paddingVertical: RESPONSIVE_SPACING.lg,
  },
  title: {
    fontSize: RESPONSIVE_FONT.xl,
    fontWeight: '700',
    color: COLORS.dark,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: RESPONSIVE_SPACING.xxl,
  },
  emptyText: {
    fontSize: RESPONSIVE_FONT.base,
    color: COLORS.mediumGray,
    marginTop: RESPONSIVE_SPACING.lg,
  },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gray,
    borderRadius: BORDER_RADIUS.md,
    padding: RESPONSIVE_SPACING.md,
    marginBottom: RESPONSIVE_SPACING.lg,
  },
  itemImage: {
    width: width < 360 ? 60 : 80,
    height: width < 360 ? 60 : 80,
    backgroundColor: COLORS.lightGray,
    borderRadius: BORDER_RADIUS.sm,
    marginRight: RESPONSIVE_SPACING.md,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: RESPONSIVE_FONT.sm,
    fontWeight: '600',
    color: COLORS.dark,
  },
  itemSize: {
    fontSize: RESPONSIVE_FONT.xs,
    color: COLORS.mediumGray,
    marginTop: RESPONSIVE_SPACING.xs,
  },
  itemPrice: {
    fontSize: RESPONSIVE_FONT.sm,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: RESPONSIVE_SPACING.xs,
  },
  itemQuantity: {
    marginRight: RESPONSIVE_SPACING.md,
  },
  quantity: {
    fontSize: RESPONSIVE_FONT.sm,
    fontWeight: '600',
    color: COLORS.dark,
  },
  deleteButton: {
    padding: RESPONSIVE_SPACING.sm,
  },
  footer: {
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: RESPONSIVE_SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  priceBreakdown: {
    marginBottom: RESPONSIVE_SPACING.lg,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: RESPONSIVE_SPACING.md,
  },
  priceLabel: {
    fontSize: RESPONSIVE_FONT.sm,
    color: COLORS.mediumGray,
  },
  priceValue: {
    fontSize: RESPONSIVE_FONT.sm,
    fontWeight: '600',
    color: COLORS.dark,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: RESPONSIVE_SPACING.md,
    marginTop: RESPONSIVE_SPACING.md,
  },
  totalLabel: {
    fontSize: RESPONSIVE_FONT.base,
    fontWeight: '700',
    color: COLORS.dark,
  },
  totalValue: {
    fontSize: RESPONSIVE_FONT.base,
    fontWeight: '700',
    color: COLORS.primary,
  },
  checkoutButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: RESPONSIVE_SPACING.md,
    borderRadius: RESPONSIVE_DIMENSION.buttonBorderRadius,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkoutButtonText: {
    fontSize: RESPONSIVE_FONT.base,
    fontWeight: '700',
    color: COLORS.white,
  },
});
