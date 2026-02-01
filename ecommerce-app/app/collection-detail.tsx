import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import db from '@/src/database/db';
import { COLORS, SPACING, BORDER_RADIUS } from '@/src/constants/colors';
import { RESPONSIVE_FONT, RESPONSIVE_SPACING, RESPONSIVE_DIMENSION, getScreenPadding } from '@/src/constants/responsive';
import { preloadImages, validateImageUrl } from '@/src/utils/imageCache';

interface Product {
  id: number;
  name: string;
  price: number;
  discount_percent: number;
  rating: number;
  image_url?: string;
  category?: string;
  is_collection?: boolean;
}

export default function CollectionDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingImages, setLoadingImages] = useState<Set<number>>(new Set());

  useFocusEffect(
    React.useCallback(() => {
      loadCollectionProducts();
    }, [])
  );

  const loadCollectionProducts = async () => {
    try {
      setLoading(true);
      if (Platform.OS === 'web' || !db) {
        // Mock collection products for web
        const mockProducts: Product[] = [
          {
            id: 101,
            name: 'New Jacket',
            price: 189.99,
            discount_percent: 15,
            rating: 4.8,
            image_url: 'https://assets.myntassets.com/dpr_1.5,q_30,w_400,c_limit,fl_progressive/assets/images/2025/APRIL/24/tjlztGaF_822d160dea33450c94a27cc17dfdaf4c.jpg',
            category: 'clothing',
            is_collection: true,
          },
          {
            id: 102,
            name: 'New Watch',
            price: 249.99,
            discount_percent: 10,
            rating: 4.9,
            image_url: 'https://images-cdn.ubuy.co.in/65fe5a0cf323f3169711abc0-pagani-design-new-men-s-quartz-watches.jpg',
            category: 'accessories',
            is_collection: true,
          },
          {
            id: 103,
            name: 'New Dinner Set',
            price: 179.99,
            discount_percent: 20,
            rating: 4.7,
            image_url: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSesL6tuGW5IiFU3PhzwqKRUeQEMR8A3Sp15A&s',
            category: 'home',
            is_collection: true,
          },
          {
            id: 104,
            name: 'New Sunglasses',
            price: 129.99,
            discount_percent: 25,
            rating: 4.6,
            image_url: 'https://images.jdmagicbox.com/quickquotes/images_main/2021-new-flat-top-men-women-round-sunglasses-uv400-mirror-eyewear-387415962-4sv6j.jpg',
            category: 'accessories',
            is_collection: true,
          },
          {
            id: 105,
            name: 'New Flower Pot',
            price: 89.99,
            discount_percent: 30,
            rating: 4.5,
            image_url: 'https://img.tatacliq.com/images/i11/437Wx649H/MP000000017605818_437Wx649H_202305182049011.jpeg',
            category: 'home',
            is_collection: true,
          },
        ];
        setProducts(mockProducts);
        preloadImages(mockProducts.map(p => p.image_url).filter(Boolean) as string[]);
        return;
      }

      const result = await db.getAllAsync(
        'SELECT * FROM products WHERE is_collection = 1'
      );
      const collectionProducts = (result as Product[]).filter(p =>
        p.image_url && validateImageUrl(p.image_url)
      );
      
      setProducts(collectionProducts);
      if (collectionProducts.length > 0) {
        preloadImages(collectionProducts.map(p => p.image_url).filter(Boolean) as string[]);
      }
    } catch (error) {
      console.error('Error loading collection products:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderProductCard = (product: Product) => {
    const discountedPrice = product.price * (1 - product.discount_percent / 100);
    const imageUri = product.image_url;
    const isLoadingImage = loadingImages.has(product.id);

    return (
      <TouchableOpacity
        key={product.id}
        style={styles.productCard}
        activeOpacity={0.8}
        onPress={() =>
          router.push({
            pathname: '/product-detail',
            params: { productId: product.id },
          })
        }
      >
        <View style={styles.productImage}>
          {imageUri ? (
            <>
              {isLoadingImage && (
                <View style={styles.loadingIndicator}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                </View>
              )}
              <Image
                source={{ uri: imageUri }}
                style={{ flex: 1 }}
                resizeMode="cover"
                onError={(error) => {
                  console.warn('❌ Image load error for:', product.name);
                  setLoadingImages(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(product.id);
                    return newSet;
                  });
                }}
                onLoad={() => {
                  console.log('✓ Image loaded for:', product.name);
                  setLoadingImages(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(product.id);
                    return newSet;
                  });
                }}
                onLoadStart={() => {
                  console.log('⏳ Loading image for:', product.name);
                  setLoadingImages(prev => new Set(prev).add(product.id));
                }}
              />
            </>
          ) : (
            <View style={[styles.productImageContent, styles.placeholderImage]}>
              <Ionicons name="image-outline" size={40} color={COLORS.gray} />
              <Text style={{ fontSize: 12, marginTop: 8, color: COLORS.gray }}>No image</Text>
            </View>
          )}
          {product.discount_percent > 0 && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>-{product.discount_percent}%</Text>
            </View>
          )}
        </View>
        <Text style={styles.productName} numberOfLines={2}>
          {product.name}
        </Text>
        <View style={styles.priceContainer}>
          <Text style={styles.price}>${discountedPrice.toFixed(2)}</Text>
          {product.discount_percent > 0 && (
            <Text style={styles.originalPrice}>${product.price.toFixed(2)}</Text>
          )}
        </View>
        <View style={styles.ratingContainer}>
          <Ionicons name="star" size={14} color={COLORS.primary} />
          <Text style={styles.rating}>{product.rating}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      <ScrollView style={[styles.container, { paddingTop: Math.max(insets.top - 12, 0) }]} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={COLORS.dark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Collection</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Collection Banner */}
        <View style={styles.bannerContainer}>
          <View style={styles.bannerContent}>
            <Text style={styles.bannerTitle}>Explore Our Latest Collection</Text>
            <Text style={styles.bannerSubtitle}>Premium products handpicked for you</Text>
          </View>
        </View>

        {/* Products Grid */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading collection...</Text>
          </View>
        ) : products.length > 0 ? (
          <View style={styles.productsGrid}>
            {products.map((product) => renderProductCard(product))}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="bag-outline" size={48} color={COLORS.mediumGray} />
            <Text style={styles.emptyText}>No items in collection</Text>
          </View>
        )}

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
    paddingHorizontal: RESPONSIVE_SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 0,
    marginBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    fontSize: RESPONSIVE_FONT.xxl,
    fontWeight: '700',
    color: COLORS.dark,
  },
  bannerContainer: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    marginTop: 2,
  },
  bannerContent: {
    justifyContent: 'center',
  },
  bannerTitle: {
    fontSize: RESPONSIVE_FONT.lg,
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: SPACING.xs,
  },
  bannerSubtitle: {
    fontSize: RESPONSIVE_FONT.base,
    color: COLORS.white,
    opacity: 0.9,
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: RESPONSIVE_SPACING.sm,
    marginTop: 2,
  },
  productCard: {
    width: RESPONSIVE_DIMENSION.productCardWidth,
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: RESPONSIVE_DIMENSION.productCardWidth,
    backgroundColor: COLORS.lightGray,
    position: 'relative',
  },
  productImageContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderImage: {
    backgroundColor: COLORS.lightGray,
  },
  loadingIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    zIndex: 10,
  },
  discountBadge: {
    position: 'absolute',
    top: RESPONSIVE_SPACING.sm,
    right: RESPONSIVE_SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: RESPONSIVE_SPACING.sm,
    paddingVertical: RESPONSIVE_SPACING.xs,
    zIndex: 5,
  },
  discountText: {
    fontSize: RESPONSIVE_FONT.xs,
    fontWeight: '700',
    color: COLORS.white,
  },
  productName: {
    fontSize: RESPONSIVE_FONT.base,
    fontWeight: '600',
    color: COLORS.dark,
    marginTop: RESPONSIVE_SPACING.sm,
    paddingHorizontal: RESPONSIVE_SPACING.sm,
    height: 40,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: RESPONSIVE_SPACING.sm,
    marginTop: RESPONSIVE_SPACING.xs,
    gap: RESPONSIVE_SPACING.xs,
  },
  price: {
    fontSize: RESPONSIVE_FONT.base,
    fontWeight: '700',
    color: COLORS.primary,
  },
  originalPrice: {
    fontSize: RESPONSIVE_FONT.xs,
    color: COLORS.mediumGray,
    textDecorationLine: 'line-through',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: RESPONSIVE_SPACING.sm,
    paddingBottom: RESPONSIVE_SPACING.sm,
    marginTop: RESPONSIVE_SPACING.xs,
    gap: RESPONSIVE_SPACING.xs,
  },
  rating: {
    fontSize: RESPONSIVE_FONT.xs,
    color: COLORS.mediumGray,
    fontWeight: '600',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  loadingText: {
    fontSize: RESPONSIVE_FONT.base,
    color: COLORS.mediumGray,
    marginTop: SPACING.md,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  emptyText: {
    fontSize: RESPONSIVE_FONT.base,
    color: COLORS.mediumGray,
    marginTop: SPACING.md,
  },
});
