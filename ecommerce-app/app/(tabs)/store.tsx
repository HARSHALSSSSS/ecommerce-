import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { productsAPI, storesAPI } from '@/src/services/api';
import { COLORS, SPACING, BORDER_RADIUS } from '@/src/constants/colors';
import { RESPONSIVE_FONT, RESPONSIVE_SPACING, RESPONSIVE_DIMENSION, getScreenPadding } from '@/src/constants/responsive';
import { preloadImages, validateImageUrl } from '@/src/utils/imageCache';

const { width } = Dimensions.get('window');
const SCREEN_PADDING = getScreenPadding();
const PRODUCT_WIDTH = RESPONSIVE_DIMENSION.productCardWidth;

interface Store {
  id: number;
  name: string;
  location: string;
  rating: number;
  followers: number;
  order_processed: string;
}

interface Product {
  id: number;
  name: string;
  price: number;
  discount_percent: number;
  image_url?: string;
}

export default function StoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedTab, setSelectedTab] = useState<'product' | 'testimoni'>('product');
  const [loadingImages, setLoadingImages] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  // Refresh products when screen is focused to get latest prices
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      console.log('📱 Loading store and products from API...');
      
      // Fetch store from backend API
      try {
        const storeResponse = await storesAPI.getAll();
        if (storeResponse.success && storeResponse.stores && storeResponse.stores.length > 0) {
          setStore(storeResponse.stores[0]);
        } else {
          setStore({
            id: 1,
            name: 'UFO Fashion',
            location: 'Mumbai, Maharashtra',
            rating: 5.0,
            followers: 50000,
            order_processed: '2 Hours',
          });
        }
      } catch (storeError) {
        console.log('Using default store');
        setStore({
          id: 1,
          name: 'UFO Fashion',
          location: 'Mumbai, Maharashtra',
          rating: 5.0,
          followers: 50000,
          order_processed: '2 Hours',
        });
      }

      // Fetch products from backend API
      const productsResponse = await productsAPI.getAll();
      
      if (productsResponse.success && productsResponse.products) {
        const apiProducts = productsResponse.products.map((p: any) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          discount_percent: p.discount_percent || 0,
          image_url: p.image_url, // Fixed: was p.image, should be p.image_url
        }));
        
        const validProducts = apiProducts.filter((p: Product) => 
          p.image_url && validateImageUrl(p.image_url)
        );
        setProducts(validProducts);
        
        // Preload all product images
        const imageUrls = validProducts
          .map((p: Product) => p.image_url)
          .filter((url: string | undefined) => url && validateImageUrl(url)) as string[];
        preloadImages(imageUrls);
      } else {
        console.warn('⚠️ API returned no products');
        setProducts([]);
      }
    } catch (error) {
      console.error('❌ Error loading data from API:', error);
      // Show error to user - don't use stale/mock data as prices may be wrong
      Alert.alert(
        'Connection Error',
        'Unable to load products from server. Please check your network connection and try again.',
        [{ text: 'Retry', onPress: () => loadData() }]
      );
    }
  };

  const renderProductCard = (item: Product) => {
    const discountedPrice = item.price * (1 - item.discount_percent / 100);

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.productCard}
        onPress={() => router.push({
          pathname: '/product-detail',
          params: { productId: item.id }
        })}
      >
        <View style={styles.productImage}>
          {item.image_url && validateImageUrl(item.image_url) ? (
            <>
              {loadingImages.has(item.id) && (
                <View style={styles.loadingIndicator}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                </View>
              )}
              <Image
                source={{ uri: item.image_url.trim() }}
                style={{ flex: 1 }}
                resizeMode="cover"
                onError={(error) => {
                  console.warn('❌ Image load error for:', item.name, error?.error);
                  setLoadingImages(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(item.id);
                    return newSet;
                  });
                }}
                onLoad={() => {
                  console.log('✓ Image loaded for:', item.name);
                  setLoadingImages(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(item.id);
                    return newSet;
                  });
                }}
                onLoadStart={() => {
                  console.log('⏳ Loading image for:', item.name);
                  setLoadingImages(prev => new Set(prev).add(item.id));
                }}
              />
            </>
          ) : (
            <View style={[styles.productImageContent, styles.placeholderImage]}>
              <Ionicons name="image-outline" size={40} color={COLORS.gray} />
              <Text style={{ fontSize: 12, marginTop: 8, color: COLORS.gray }}>No image</Text>
            </View>
          )}
          {item.discount_percent > 0 && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>-{item.discount_percent}%</Text>
            </View>
          )}
        </View>
        <Text style={styles.productName} numberOfLines={2}>
          {item.name}
        </Text>
        <View style={styles.priceContainer}>
          <Text style={styles.price}>${discountedPrice.toFixed(2)}</Text>
          {item.discount_percent > 0 && (
            <Text style={styles.originalPrice}>${item.price.toFixed(2)}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (!store) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScrollView 
        style={[styles.containerScroll, { paddingTop: insets.top }]} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === 'android' ? 100 : 80 }}
      >
        <View style={styles.storeHeader}>
        <View style={styles.storeLogo}>
          <Ionicons name="eye" size={32} color={COLORS.white} />
        </View>
        <View>
          <Text style={styles.storeName}>{store.name}</Text>
          <Text style={styles.storeLocation}>{store.location}</Text>
        </View>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Ionicons name="star" size={18} color={COLORS.warning} />
          <Text style={styles.statValue}>{store.rating.toFixed(1)}</Text>
          <Text style={styles.statLabel}>Ratings</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="time" size={18} color={COLORS.primary} />
          <Text style={styles.statValue}>{store.order_processed}</Text>
          <Text style={styles.statLabel}>Order processed</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="people" size={18} color={COLORS.dark} />
          <Text style={styles.statValue}>{store.followers}K</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </View>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'product' && styles.tabActive]}
          onPress={() => setSelectedTab('product')}
        >
          <Text
            style={[
              styles.tabText,
              selectedTab === 'product' && styles.tabTextActive,
            ]}
          >
            Product
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'testimoni' && styles.tabActive]}
          onPress={() => setSelectedTab('testimoni')}
        >
          <Text
            style={[
              styles.tabText,
              selectedTab === 'testimoni' && styles.tabTextActive,
            ]}
          >
            Testimoni
          </Text>
        </TouchableOpacity>
      </View>

      {selectedTab === 'product' && (
        <View style={styles.productsGrid}>
          {products.map((product) => renderProductCard(product))}
        </View>
      )}

      {selectedTab === 'testimoni' && (
        <View style={styles.testimoniContainer}>
          <View style={styles.testimoniCard}>
            <View style={styles.testimoniHeader}>
              <View style={styles.testimoniAvatar}>
                <Text style={styles.avatarText}>JD</Text>
              </View>
              <View>
                <Text style={styles.testimoniName}>John Doe</Text>
                <View style={styles.testimoniRating}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Ionicons key={i} name="star" size={12} color={COLORS.warning} />
                  ))}
                </View>
              </View>
            </View>
            <Text style={styles.testimoniText}>
              Great quality products and fast delivery! Highly recommended.
            </Text>
          </View>
          <View style={styles.testimoniCard}>
            <View style={styles.testimoniHeader}>
              <View style={styles.testimoniAvatar}>
                <Text style={styles.avatarText}>SM</Text>
              </View>
              <View>
                <Text style={styles.testimoniName}>Sarah Miller</Text>
                <View style={styles.testimoniRating}>
                  {[1, 2, 3, 4].map((i) => (
                    <Ionicons key={i} name="star" size={12} color={COLORS.warning} />
                  ))}
                </View>
              </View>
            </View>
            <Text style={styles.testimoniText}>
              Amazing collection! Perfect fitting and true to size.
            </Text>
          </View>
        </View>
      )}

      <View style={{ height: SPACING.xl }} />
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  containerScroll: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  storeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  storeLogo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.dark,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.lg,
  },
  storeName: {
    fontSize: RESPONSIVE_FONT.lg,
    fontWeight: '700',
    color: COLORS.dark,
  },
  storeLocation: {
    fontSize: RESPONSIVE_FONT.xs,
    color: COLORS.primary,
    marginTop: RESPONSIVE_SPACING.xs,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: RESPONSIVE_SPACING.lg,
    paddingVertical: RESPONSIVE_SPACING.lg,
    backgroundColor: COLORS.gray,
    marginHorizontal: RESPONSIVE_SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: RESPONSIVE_SPACING.lg,
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontSize: RESPONSIVE_FONT.sm,
    fontWeight: '700',
    color: COLORS.dark,
    marginTop: RESPONSIVE_SPACING.xs,
  },
  statLabel: {
    fontSize: RESPONSIVE_FONT.xs,
    color: COLORS.mediumGray,
    marginTop: RESPONSIVE_SPACING.xs,
  },
  statDivider: {
    width: 1,
    height: 50,
    backgroundColor: COLORS.border,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: RESPONSIVE_SPACING.lg,
    marginBottom: RESPONSIVE_SPACING.lg,
    gap: RESPONSIVE_SPACING.md,
  },
  tab: {
    flex: 1,
    paddingVertical: RESPONSIVE_SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tabText: {
    fontSize: RESPONSIVE_FONT.sm,
    fontWeight: '600',
    color: COLORS.dark,
  },
  tabTextActive: {
    color: COLORS.white,
  },
  productsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    paddingHorizontal: RESPONSIVE_SPACING.lg,
  },
  productCard: {
    width: PRODUCT_WIDTH,
    marginBottom: RESPONSIVE_SPACING.lg,
  },
  productImage: {
    width: '100%',
    height: RESPONSIVE_DIMENSION.productImageHeight,
    backgroundColor: COLORS.lightGray,
    borderRadius: RESPONSIVE_DIMENSION.productImageBorderRadius,
    marginBottom: RESPONSIVE_SPACING.md,
    overflow: 'hidden',
  },
  productImageContent: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray,
  },
  discountBadge: {
    position: 'absolute',
    top: RESPONSIVE_SPACING.md,
    right: RESPONSIVE_SPACING.md,
    backgroundColor: COLORS.primary,
    paddingHorizontal: RESPONSIVE_SPACING.sm,
    paddingVertical: RESPONSIVE_SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  discountText: {
    fontSize: RESPONSIVE_FONT.xs,
    color: COLORS.white,
    fontWeight: '700',
  },
  productName: {
    fontSize: RESPONSIVE_FONT.sm,
    fontWeight: '600',
    color: COLORS.dark,
    marginBottom: RESPONSIVE_SPACING.sm,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  price: {
    fontSize: RESPONSIVE_FONT.base,
    fontWeight: '700',
    color: COLORS.primary,
    marginRight: RESPONSIVE_SPACING.sm,
  },
  originalPrice: {
    fontSize: RESPONSIVE_FONT.xs,
    color: COLORS.mediumGray,
    textDecorationLine: 'line-through',
  },
  testimoniContainer: {
    paddingHorizontal: RESPONSIVE_SPACING.lg,
  },
  testimoniCard: {
    backgroundColor: COLORS.gray,
    padding: RESPONSIVE_SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: RESPONSIVE_SPACING.lg,
  },
  testimoniHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: RESPONSIVE_SPACING.md,
  },
  testimoniAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: RESPONSIVE_SPACING.md,
  },
  avatarText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: RESPONSIVE_FONT.xs,
  },
  testimoniName: {
    fontSize: RESPONSIVE_FONT.sm,
    fontWeight: '600',
    color: COLORS.dark,
  },
  testimoniRating: {
    flexDirection: 'row',
    gap: RESPONSIVE_SPACING.xs,
    marginTop: RESPONSIVE_SPACING.xs,
  },
  testimoniText: {
    fontSize: RESPONSIVE_FONT.xs,
    color: COLORS.mediumGray,
    lineHeight: 18,
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
