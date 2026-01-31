import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import db from '../database/db';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/colors';

const SIZES = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

export default function ProductDetailScreen({ route, navigation }: any) {
  const { product } = route.params;
  const [selectedSize, setSelectedSize] = useState<string>('M');
  const [quantity, setQuantity] = useState(1);

  const discountedPrice = product.price * (1 - product.discount_percent / 100);

  const handleAddToCart = async () => {
    try {
      await db.runAsync(
        'INSERT INTO cart (product_id, quantity, size) VALUES (?, ?, ?)',
        [product.id, quantity, selectedSize]
      );
      Alert.alert('Success', 'Product added to cart!');
    } catch (error) {
      console.error('Error adding to cart:', error);
      Alert.alert('Error', 'Failed to add product to cart');
    }
  };

  const handleBuyNow = async () => {
    try {
      // Create order
      const orderResult = await db.runAsync(
        'INSERT INTO orders (user_id, total_amount, status, delivery_address) VALUES (?, ?, ?, ?)',
        [1, discountedPrice * quantity, 'pending', 'Default Address']
      );

      // Add order items
      await db.runAsync(
        'INSERT INTO order_items (order_id, product_id, quantity, size, price) VALUES (?, ?, ?, ?, ?)',
        [orderResult.lastInsertRowId, product.id, quantity, selectedSize, discountedPrice]
      );

      Alert.alert('Success', 'Order placed successfully!');
      navigation.navigate('Home');
    } catch (error) {
      console.error('Error creating order:', error);
      Alert.alert('Error', 'Failed to place order');
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detail Product</Text>
        <TouchableOpacity>
          <Ionicons name="ellipsis-vertical" size={24} color={COLORS.dark} />
        </TouchableOpacity>
      </View>

      {/* Product Images */}
      <View style={styles.mainImageContainer}>
        <View style={styles.mainImage} />
      </View>

      {/* Thumbnail Images */}
      <View style={styles.thumbnailContainer}>
        <View style={styles.thumbnail} />
        <View style={styles.thumbnail} />
      </View>

      {/* Product Info */}
      <View style={styles.infoSection}>
        <View style={styles.productHeader}>
          <View>
            <Text style={styles.productName}>{product.name}</Text>
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={16} color={COLORS.warning} />
              <Ionicons name="star" size={16} color={COLORS.warning} />
              <Ionicons name="star" size={16} color={COLORS.warning} />
              <Ionicons name="star" size={16} color={COLORS.warning} />
              <Ionicons name="star" size={16} color={COLORS.warning} />
            </View>
          </View>
          {product.discount_percent > 0 && (
            <View style={styles.discountBadgeDetail}>
              <Text style={styles.discountTextDetail}>
                Discount {product.discount_percent}%
              </Text>
            </View>
          )}
        </View>

        {/* Price */}
        <View style={styles.priceSection}>
          <Text style={styles.discountedPrice}>${discountedPrice.toFixed(2)}</Text>
          {product.discount_percent > 0 && (
            <Text style={styles.originalPrice}>${product.price.toFixed(2)}</Text>
          )}
        </View>

        {/* Size Selection */}
        <View style={styles.sizeSection}>
          <View style={styles.sizeHeader}>
            <Text style={styles.sizeLabel}>Size</Text>
            <TouchableOpacity>
              <Text style={styles.chooseVariant}>Choose Variant</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.sizeOptions}>
            {SIZES.map((size) => (
              <TouchableOpacity
                key={size}
                style={[
                  styles.sizeButton,
                  selectedSize === size && styles.sizeButtonSelected,
                ]}
                onPress={() => setSelectedSize(size)}
              >
                <Text
                  style={[
                    styles.sizeButtonText,
                    selectedSize === size && styles.sizeButtonTextSelected,
                  ]}
                >
                  {size}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Quantity */}
        <View style={styles.quantitySection}>
          <Text style={styles.quantityLabel}>Quantity</Text>
          <View style={styles.quantityControl}>
            <TouchableOpacity
              onPress={() => setQuantity(Math.max(1, quantity - 1))}
              style={styles.quantityButton}
            >
              <Text style={styles.quantityButtonText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.quantityValue}>{quantity}</Text>
            <TouchableOpacity
              onPress={() => setQuantity(quantity + 1)}
              style={styles.quantityButton}
            >
              <Text style={styles.quantityButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Buttons */}
      <View style={styles.buttonSection}>
        <TouchableOpacity style={styles.buyButton} onPress={handleBuyNow}>
          <Text style={styles.buyButtonText}>Buy Now</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cartButton} onPress={handleAddToCart}>
          <Text style={styles.cartButtonText}>Add Cart</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: SPACING.lg }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.dark,
  },
  mainImageContainer: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  mainImage: {
    width: '100%',
    height: 250,
    backgroundColor: COLORS.lightGray,
    borderRadius: BORDER_RADIUS.lg,
  },
  thumbnailContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.xl,
    gap: SPACING.md,
  },
  thumbnail: {
    flex: 1,
    height: 120,
    backgroundColor: COLORS.lightGray,
    borderRadius: BORDER_RADIUS.md,
  },
  infoSection: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.lg,
  },
  productName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.dark,
    marginBottom: SPACING.sm,
    maxWidth: 200,
  },
  ratingContainer: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  discountBadgeDetail: {
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  discountTextDetail: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  priceSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },
  discountedPrice: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.primary,
  },
  originalPrice: {
    fontSize: 14,
    color: COLORS.mediumGray,
    textDecorationLine: 'line-through',
  },
  sizeSection: {
    marginBottom: SPACING.xl,
  },
  sizeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sizeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.dark,
  },
  chooseVariant: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  sizeOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sizeButton: {
    width: '14%',
    aspectRatio: 1,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  sizeButtonSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  sizeButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.dark,
  },
  sizeButtonTextSelected: {
    color: COLORS.white,
  },
  quantitySection: {
    marginBottom: SPACING.xl,
  },
  quantityLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.dark,
    marginBottom: SPACING.md,
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'space-between',
  },
  quantityButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.dark,
  },
  quantityValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.dark,
  },
  buttonSection: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
  },
  buyButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buyButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
  },
  cartButton: {
    flex: 1,
    backgroundColor: COLORS.dark,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
  },
});
