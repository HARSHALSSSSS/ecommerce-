import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { productsAPI, cartAPI, activityAPI } from '@/src/services/api';
import { COLORS, SPACING, BORDER_RADIUS } from '@/src/constants/colors';
import { validateImageUrl } from '@/src/utils/imageCache';

const SIZES = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

interface Product {
  id: number;
  name: string;
  price: number;
  discount_percent: number;
  rating: number;
  description: string;
  image_url?: string;
}

export default function ProductDetailScreen() {
  const router = useRouter();
  const { productId } = useLocalSearchParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [selectedSize, setSelectedSize] = useState<string>('M');
  const [quantity, setQuantity] = useState(1);
  const [imageLoading, setImageLoading] = useState(true);

  useEffect(() => {
    loadProduct();
  }, [productId]);

  // Refresh product when screen is focused to get latest price
  useFocusEffect(
    useCallback(() => {
      loadProduct();
    }, [productId])
  );

  const loadProduct = async () => {
    try {
      console.log(`📱 Loading product ${productId} from API...`);
      
      // Fetch product from backend API
      const response = await productsAPI.getById(Number(productId));
      console.log('📦 API Response for product:', JSON.stringify(response, null, 2));
      
      if (response.success && response.product) {
        const apiProduct = {
          id: response.product.id,
          name: response.product.name,
          price: response.product.price,
          discount_percent: response.product.discount_percent || 0,
          rating: response.product.rating || 4.5,
          description: response.product.description || 'High quality product',
          image_url: response.product.image_url,
        };
        console.log('✅ Product loaded from API:', apiProduct.name, 'Price:', apiProduct.price, 'Discount:', apiProduct.discount_percent);
        setProduct(apiProduct);
      } else {
        console.warn('⚠️ API returned no product');
        Alert.alert(
          'Product Not Found',
          'This product could not be loaded. Please try again.',
          [
            { text: 'Go Back', onPress: () => router.back() },
            { text: 'Retry', onPress: () => loadProduct() }
          ]
        );
      }
    } catch (error) {
      console.error('❌ Error loading product from API:', error);
      // Show error to user - don't use stale/mock data as prices may be wrong
      Alert.alert(
        'Connection Error',
        'Unable to load product details from server. Please check your network connection and try again.',
        [
          { text: 'Go Back', onPress: () => router.back() },
          { text: 'Retry', onPress: () => loadProduct() }
        ]
      );
    }
  };

  const handleAddToCart = async () => {
  if (!product) return;
  
  try {
    const result = await cartAPI.addItem(product.id, quantity, selectedSize);
    
    if (result.success) {
      Alert.alert('Success', 'Product added to cart!');
    } else {
      Alert.alert('Error', result.message || 'Failed to add to cart');
    }
  } catch (error) {
    console.error('Error adding to cart:', error);
    Alert.alert('Error', 'Failed to add product to cart');
  }
};

  const handleBuyNow = async () => {
    if (!product) return;
    
    // Navigate to checkout screen with product details
    router.push({
      pathname: '/checkout',
      params: {
        productId: product.id,
        productName: product.name,
        productPrice: product.price,
        discount: product.discount_percent,
        quantity: quantity,
        size: selectedSize,
      },
    });
  };

  if (!product) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading...</Text>
      </View>
    );
  }

  const discountedPrice = product.price * (1 - product.discount_percent / 100);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { paddingTop: SPACING.md }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={COLORS.dark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Detail Product</Text>
          <TouchableOpacity>
            <Ionicons name="ellipsis-vertical" size={24} color={COLORS.dark} />
          </TouchableOpacity>
        </View>

        <View style={styles.mainImageContainer}>
          <View style={styles.mainImage}>
            {product.image_url && validateImageUrl(product.image_url) ? (
              <>
                {imageLoading && (
                  <View style={styles.loadingIndicator}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                  </View>
                )}
                <Image
                  source={{ uri: product.image_url.trim() }}
                  style={{ flex: 1 }}
                  resizeMode="cover"
                  onError={() => {
                    console.warn('Main image load error for:', product.name);
                    setImageLoading(false);
                  }}
                  onLoad={() => {
                    console.log('Main image loaded for:', product.name);
                    setImageLoading(false);
                  }}
                  onLoadStart={() => setImageLoading(true)}
                />
              </>
            ) : (
              <View style={styles.placeholderImage}>
                <Ionicons name="image-outline" size={60} color={COLORS.gray} />
                <Text style={{ fontSize: 12, marginTop: 8, color: COLORS.gray }}>No image available</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.thumbnailContainer}>
          <View style={styles.thumbnail}>
            {product.image_url && validateImageUrl(product.image_url) ? (
              <Image
                source={{ uri: product.image_url.trim() }}
                style={{ width: '100%', height: '100%', borderRadius: 8 }}
                resizeMode="cover"
              />
            ) : (
              <Ionicons name="image-outline" size={24} color={COLORS.gray} />
            )}
          </View>
          <View style={styles.thumbnail}>
            {product.image_url && validateImageUrl(product.image_url) ? (
              <Image
                source={{ uri: product.image_url.trim() }}
                style={{ width: '100%', height: '100%', borderRadius: 8 }}
                resizeMode="cover"
              />
            ) : (
              <Ionicons name="image-outline" size={24} color={COLORS.gray} />
            )}
          </View>
        </View>

        <View style={styles.infoSection}>
          <View style={styles.productHeader}>
            <View>
              <Text style={styles.productName}>{product.name}</Text>
              <View style={styles.ratingContainer}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <Ionicons key={i} name="star" size={16} color={COLORS.warning} />
                ))}
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

          <View style={styles.priceSection}>
            <Text style={styles.discountedPrice}>${discountedPrice.toFixed(2)}</Text>
            {product.discount_percent > 0 && (
              <Text style={styles.originalPrice}>${product.price.toFixed(2)}</Text>
            )}
          </View>

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
      </ScrollView>

      <View style={styles.buttonSection}>
        <TouchableOpacity style={styles.buyButton} onPress={handleBuyNow}>
          <Text style={styles.buyButtonText}>Buy Now</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cartButton} onPress={handleAddToCart}>
          <Text style={styles.cartButtonText}>Add Cart</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
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
    overflow: 'hidden',
  },
  mainImageContent: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray,
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
    paddingVertical: SPACING.lg,
    gap: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
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
  loadingIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    zIndex: 10,
  },
});
