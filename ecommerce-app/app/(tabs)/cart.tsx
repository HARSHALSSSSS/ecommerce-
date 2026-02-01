import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Platform, Image, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import db from '@/src/database/db';
import { useRouter } from 'expo-router';
import { cartAPI, ordersAPI } from '@/src/services/api';
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
  discounted_price?: number;
  image_url?: string;
}

export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [totalPrice, setTotalPrice] = useState(0);
  const [loading, setLoading] = useState(true);
  const [cartFromApi, setCartFromApi] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      loadCart();
    }, [])
  );

  const loadCart = async () => {
    setLoading(true);
    try {
      // 1) Try backend API first (logged-in user – source of truth for add-to-cart from product detail)
      const apiResponse = await cartAPI.get();
      if (apiResponse?.success && apiResponse.cart) {
        const items = (apiResponse.cart.items || []) as any[];
        if (items.length > 0) {
        const mapped: CartItem[] = items.map((item: any) => ({
          id: item.id,
          product_id: item.product_id,
          name: item.name,
          price: item.discounted_price ?? item.price,
          quantity: item.quantity,
          size: item.size ?? 'M',
          image_url: item.image_url,
        }));
        setCartItems(mapped);
        setTotalPrice(apiResponse.cart.subtotal ?? mapped.reduce((sum, i) => sum + i.price * i.quantity, 0));
          setCartFromApi(true); // IMPORTANT: Set this BEFORE returning so checkout knows to use API
          setLoading(false);
          return;
        }
        // No items in API cart, but still mark as API cart if user is logged in
        setCartFromApi(true);
      }

      // 2) Fallback: local SQLite (offline / no token)
      if (Platform.OS === 'web' || !db) {
        setCartItems([]);
        setTotalPrice(0);
        setLoading(false);
        return;
      }

      const result = await db.getAllAsync(`
        SELECT c.id, c.product_id, p.name, p.price, c.quantity, c.size
        FROM cart c
        JOIN products p ON c.product_id = p.id
      `);
      const localItems = (result || []) as CartItem[];
      setCartItems(localItems);
      setTotalPrice(localItems.reduce((sum, item) => sum + item.price * item.quantity, 0));
      setCartFromApi(false);
    } catch (error) {
      console.error('Error loading cart:', error);
      if (Platform.OS !== 'web' && db) {
        try {
          const result = await db.getAllAsync(`
            SELECT c.id, c.product_id, p.name, p.price, c.quantity, c.size
            FROM cart c
            JOIN products p ON c.product_id = p.id
          `);
          const localItems = (result || []) as CartItem[];
          setCartItems(localItems);
          setTotalPrice(localItems.reduce((sum, item) => sum + item.price * item.quantity, 0));
          setCartFromApi(false);
        } catch (e) {
          setCartItems([]);
          setTotalPrice(0);
        }
      } else {
        setCartItems([]);
        setTotalPrice(0);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveItem = async (cartId: number) => {
    try {
      // Try API first (if user is logged in, cart is on backend)
      await cartAPI.removeItem(cartId);
      await loadCart();
      Alert.alert('Success', 'Item removed from cart');
    } catch {
      if (Platform.OS === 'web' || !db) {
        Alert.alert('Web Mode', 'Database operations not available on web');
        return;
      }
      try {
        await db.runAsync('DELETE FROM cart WHERE id = ?', [cartId]);
        await loadCart();
        Alert.alert('Success', 'Item removed from cart');
      } catch (error) {
        Alert.alert('Error', 'Failed to remove item');
      }
    }
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0) {
      Alert.alert('Error', 'Your cart is empty');
      return;
    }

    setCheckoutLoading(true);
    try {
      // When cart was loaded from API (logged-in user), create order on backend and clear API cart
      if (cartFromApi) {
        const orderData = {
          items: cartItems.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
          delivery_address: 'Default Address',
          city: 'Default City',
          postal_code: '10001',
          payment_method: 'cash-on-delivery',
          notes: undefined,
        };
        const apiResponse = await ordersAPI.create(orderData);
        const orderId = apiResponse.order?.id || apiResponse.orderId;
        await cartAPI.clear();
        setCartItems([]);
        setTotalPrice(0);
        setCartFromApi(false);
        setCheckoutLoading(false);
        router.push({
          pathname: '/order-success',
          params: { orderId: String(orderId ?? ''), total: String(totalPrice), paymentMethod: 'Cash on Delivery', items: cartItems.map((i) => i.name).join(', ') },
        });
        return;
      }

      // Fallback: local DB (offline / no token). Skip on web where db is unavailable.
      if (Platform.OS === 'web' || !db) {
        Alert.alert('Not available', 'Please log in to place an order from cart.');
        setCheckoutLoading(false);
        return;
      }

      const orderResult = await db.runAsync(
        'INSERT INTO orders (user_id, total_amount, status, delivery_address) VALUES (?, ?, ?, ?)',
        [1, totalPrice, 'pending', 'Default Address']
      );
      for (const item of cartItems) {
        await db.runAsync(
          'INSERT INTO order_items (order_id, product_id, quantity, size, price) VALUES (?, ?, ?, ?, ?)',
          [orderResult.lastInsertRowId, item.product_id, item.quantity, item.size, item.price]
        );
      }
      await db.runAsync('DELETE FROM cart');
      setCartItems([]);
      setTotalPrice(0);
      setCheckoutLoading(false);
      Alert.alert('Success', 'Order placed successfully!');
    } catch (error: any) {
      setCheckoutLoading(false);
      const msg = error.response?.data?.message || error.message || 'Failed to place order';
      Alert.alert('Error', msg);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading cart...</Text>
        </View>
      </SafeAreaView>
    );
  }

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
          <TouchableOpacity
            style={styles.checkoutButton}
            onPress={handleCheckout}
            disabled={checkoutLoading}
          >
            {checkoutLoading ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.checkoutButtonText}>Checkout</Text>
            )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SCREEN_PADDING,
  },
  loadingText: {
    marginTop: RESPONSIVE_SPACING.md,
    fontSize: RESPONSIVE_FONT.sm,
    color: COLORS.mediumGray,
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
