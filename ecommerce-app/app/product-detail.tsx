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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { productsAPI, cartAPI, activityAPI } from '@/src/services/api';
import { COLORS, SPACING, BORDER_RADIUS } from '@/src/constants/colors';
import { RESPONSIVE_FONT, RESPONSIVE_SPACING, RESPONSIVE_DIMENSION } from '@/src/constants/responsive';
import { validateImageUrl } from '@/src/utils/imageCache';

// Category-specific size options
const SIZE_OPTIONS: Record<string, string[]> = {
  'Clothing': ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  'Men\'s Clothing': ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'],
  'Women\'s Clothing': ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  'Kids Clothing': ['2T', '3T', '4T', '5T', '6', '7', '8', '10', '12'],
  'Shoes': ['6', '7', '8', '9', '10', '11', '12'],
  'Men\'s Shoes': ['7', '8', '9', '10', '11', '12', '13'],
  'Women\'s Shoes': ['5', '6', '7', '8', '9', '10', '11'],
  'Kids Shoes': ['10', '11', '12', '13', '1', '2', '3', '4'],
  'Hats': ['S/M', 'L/XL', 'One Size'],
  'Caps': ['One Size'],
  'Accessories': ['One Size'],
  'Jewelry': ['S', 'M', 'L', 'Adjustable'],
  'Bags': ['Small', 'Medium', 'Large'],
  'Home & Living': [], // No sizes for home items
  'Furniture': [], // No sizes for furniture
  'Electronics': [], // No sizes for electronics
  'Books': [], // No sizes for books
  'Beauty': ['50ml', '100ml', '250ml'], // For beauty products
  'Default': ['S', 'M', 'L', 'XL'], // Fallback
};

interface Product {
  id: number;
  name: string;
  price: number;
  discount_percent: number;
  rating: number;
  description: string;
  image_url?: string;
  category?: string;
}

export default function ProductDetailScreen() {
  const router = useRouter();
  const { productId } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [product, setProduct] = useState<Product | null>(null);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [imageLoading, setImageLoading] = useState(true);

  // Get sizes based on product category
  const getSizesForCategory = (category?: string): string[] => {
    if (!category) return SIZE_OPTIONS['Default'];
    
    // Check for exact match first
    if (SIZE_OPTIONS[category]) {
      return SIZE_OPTIONS[category];
    }
    
    // Check for partial matches (case-insensitive)
    const categoryLower = category.toLowerCase();
    for (const key in SIZE_OPTIONS) {
      if (key.toLowerCase().includes(categoryLower) || categoryLower.includes(key.toLowerCase())) {
        return SIZE_OPTIONS[key];
      }
    }
    
    return SIZE_OPTIONS['Default'];
  };

  const availableSizes = product ? getSizesForCategory(product.category) : [];

  useEffect(() => {
    loadProduct();
  }, [productId]);

  // Set default size when product or sizes change
  useEffect(() => {
    if (availableSizes.length > 0 && !selectedSize) {
      // Set middle size as default, or first if there's only one
      const defaultIndex = Math.floor(availableSizes.length / 2);
      setSelectedSize(availableSizes[defaultIndex]);
    }
  }, [availableSizes, product]);

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
          category: response.product.category || 'Default',
        };
        console.log('✅ Product loaded from API:', apiProduct.name, 'Price:', apiProduct.price, 'Category:', apiProduct.category);
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
      // If no sizes available for this category, pass 'N/A' instead of empty string
      const sizeToSend = availableSizes.length > 0 ? selectedSize : 'N/A';
      const result = await cartAPI.addItem(product.id, quantity, sizeToSend);
      
      if (result.success) {
        Alert.alert('Success', 'Product added to cart!');
      } else {
        Alert.alert('Error', result.message || 'Failed to add to cart');
      }
    } catch (error: any) {
      console.error('Error adding to cart:', error);
      let errorMessage = 'Failed to add product to cart';
      if (error.message === 'Network Error') {
        errorMessage = 'Network error. Please check your internet connection.';
      } else if (error.response?.status === 401) {
        errorMessage = 'Please login to add items to cart.';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      Alert.alert('Cart Error', errorMessage);
    }
  };

  const handleBuyNow = async () => {
    if (!product) return;
    
    // If no sizes available for this category, pass 'N/A' instead of empty string
    const sizeToSend = availableSizes.length > 0 ? selectedSize : 'N/A';
    
    // Navigate to checkout screen with product details
    router.push({
      pathname: '/checkout',
      params: {
        productId: product.id,
        productName: product.name,
        productPrice: product.price,
        discount: product.discount_percent,
        quantity: quantity,
        size: sizeToSend,
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
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBackButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={COLORS.dark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Detail Product</Text>
          <TouchableOpacity style={styles.headerRightButton}>
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

          {availableSizes.length > 0 && (
            <View style={styles.sizeSection}>
              <View style={styles.sizeHeader}>
                <Text style={styles.sizeLabel}>Size</Text>
                <TouchableOpacity>
                  <Text style={styles.chooseVariant}>Choose Variant</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.sizeOptions}>
                {availableSizes.map((size) => (
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
          )}

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

      <View style={[styles.buttonSection, { paddingBottom: Math.max(RESPONSIVE_SPACING.lg, Platform.OS === 'android' ? insets.bottom + 16 : insets.bottom) }]}>
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
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    minHeight: 56,
  },
  headerBackButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
  },
  headerTitle: {
    fontSize: RESPONSIVE_FONT.lg,
    fontWeight: '600',
    color: COLORS.dark,
    flex: 1,
    textAlign: 'center',
  },
  headerRightButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainImageContainer: {
    paddingHorizontal: RESPONSIVE_SPACING.lg,
    marginBottom: RESPONSIVE_SPACING.lg,
  },
  mainImage: {
    width: '100%',
    height: RESPONSIVE_DIMENSION.productImageHeight + 70,
    backgroundColor: COLORS.lightGray,
    borderRadius: RESPONSIVE_DIMENSION.cardBorderRadius,
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
    paddingHorizontal: RESPONSIVE_SPACING.lg,
    marginBottom: RESPONSIVE_SPACING.xl,
    gap: RESPONSIVE_SPACING.md,
  },
  thumbnail: {
    flex: 1,
    height: RESPONSIVE_DIMENSION.productImageHeight - 60,
    backgroundColor: COLORS.lightGray,
    borderRadius: RESPONSIVE_DIMENSION.productImageBorderRadius,
  },
  infoSection: {
    paddingHorizontal: RESPONSIVE_SPACING.lg,
    marginBottom: RESPONSIVE_SPACING.lg,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: RESPONSIVE_SPACING.lg,
  },
  productName: {
    fontSize: RESPONSIVE_FONT.lg,
    fontWeight: '700',
    color: COLORS.dark,
    marginBottom: RESPONSIVE_SPACING.sm,
    maxWidth: '70%',
  },
  ratingContainer: {
    flexDirection: 'row',
    gap: RESPONSIVE_SPACING.xs,
  },
  discountBadgeDetail: {
    backgroundColor: COLORS.white,
    paddingHorizontal: RESPONSIVE_SPACING.md,
    paddingVertical: RESPONSIVE_SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  discountTextDetail: {
    fontSize: RESPONSIVE_FONT.xs,
    color: COLORS.primary,
    fontWeight: '600',
  },
  priceSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: RESPONSIVE_SPACING.lg,
    gap: RESPONSIVE_SPACING.md,
  },
  discountedPrice: {
    fontSize: RESPONSIVE_FONT.xxl,
    fontWeight: '700',
    color: COLORS.primary,
  },
  originalPrice: {
    fontSize: RESPONSIVE_FONT.sm,
    color: COLORS.mediumGray,
    textDecorationLine: 'line-through',
  },
  sizeSection: {
    marginBottom: RESPONSIVE_SPACING.xl,
  },
  sizeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: RESPONSIVE_SPACING.md,
  },
  sizeLabel: {
    fontSize: RESPONSIVE_FONT.sm,
    fontWeight: '600',
    color: COLORS.dark,
  },
  chooseVariant: {
    fontSize: RESPONSIVE_FONT.xs,
    color: COLORS.primary,
    fontWeight: '600',
  },
  sizeOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: RESPONSIVE_SPACING.sm,
  },
  sizeButton: {
    width: '15%',
    minWidth: 44,
    minHeight: 44,
    aspectRatio: 1,
    borderRadius: RESPONSIVE_DIMENSION.buttonBorderRadius,
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
    fontSize: RESPONSIVE_FONT.xs,
    fontWeight: '600',
    color: COLORS.dark,
  },
  sizeButtonTextSelected: {
    color: COLORS.white,
  },
  quantitySection: {
    marginBottom: RESPONSIVE_SPACING.xl,
  },
  quantityLabel: {
    fontSize: RESPONSIVE_FONT.sm,
    fontWeight: '600',
    color: COLORS.dark,
    marginBottom: RESPONSIVE_SPACING.md,
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RESPONSIVE_DIMENSION.buttonBorderRadius,
    justifyContent: 'space-between',
  },
  quantityButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    fontSize: RESPONSIVE_FONT.xl,
    fontWeight: '600',
    color: COLORS.dark,
  },
  quantityValue: {
    fontSize: RESPONSIVE_FONT.sm,
    fontWeight: '600',
    color: COLORS.dark,
  },
  buttonSection: {
    flexDirection: 'row',
    paddingHorizontal: RESPONSIVE_SPACING.lg,
    paddingVertical: RESPONSIVE_SPACING.lg,
    gap: RESPONSIVE_SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  buyButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: RESPONSIVE_SPACING.md,
    borderRadius: RESPONSIVE_DIMENSION.buttonBorderRadius,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: RESPONSIVE_DIMENSION.buttonHeight,
  },
  buyButtonText: {
    fontSize: RESPONSIVE_FONT.sm,
    fontWeight: '700',
    color: COLORS.white,
  },
  cartButton: {
    flex: 1,
    backgroundColor: COLORS.dark,
    paddingVertical: RESPONSIVE_SPACING.md,
    borderRadius: RESPONSIVE_DIMENSION.buttonBorderRadius,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: RESPONSIVE_DIMENSION.buttonHeight,
  },
  cartButtonText: {
    fontSize: RESPONSIVE_FONT.sm,
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
