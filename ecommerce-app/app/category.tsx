import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Platform,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { productsAPI } from '@/src/services/api';
import { COLORS, SPACING, BORDER_RADIUS } from '@/src/constants/colors';
import { RESPONSIVE_FONT, RESPONSIVE_SPACING, RESPONSIVE_DIMENSION, getScreenPadding } from '@/src/constants/responsive';

const { width } = Dimensions.get('window');
const SCREEN_PADDING = getScreenPadding();
const PRODUCT_WIDTH = RESPONSIVE_DIMENSION.productCardWidth;

interface Product {
  id: number;
  name: string;
  price: number;
  discount_percent: number;
  rating: number;
  image_url?: string;
  category?: string;
}

export default function CategoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { category } = useLocalSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchModal, setShowSearchModal] = useState(false);

  useEffect(() => {
    loadCategoryProducts();
  }, [category]);

  // Refresh products when screen is focused to get latest prices
  useFocusEffect(
    useCallback(() => {
      loadCategoryProducts();
    }, [category])
  );

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim().length > 0) {
      const filtered = products.filter(product =>
        product.name.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredProducts(filtered);
    } else {
      setFilteredProducts(products);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setFilteredProducts(products);
    setShowSearchModal(false);
  };

  const loadCategoryProducts = async () => {
    try {
      setLoading(true);
      console.log(`📱 Loading category "${category}" products from API...`);
      
      // Fetch products from backend API
      const params = category === 'all' ? {} : { category: category as string };
      const response = await productsAPI.getAll(params);
      
      console.log(`📦 API Response for category "${category}":`, response?.products?.length || 0, 'products');
      
      if (response && response.success && Array.isArray(response.products)) {
        const apiProducts = response.products.map((p: any) => ({
          id: p.id,
          name: p.name || 'Unknown Product',
          price: p.price || 0,
          discount_percent: p.discount_percent || 0,
          rating: p.rating || 4.5,
          image_url: p.image_url || '',
          category: p.category || 'other',
        }));
        
        console.log(`✅ Loaded ${apiProducts.length} products for category "${category}"`);
        setProducts(apiProducts);
        setFilteredProducts(apiProducts);
      } else {
        console.warn('⚠️ API returned no products or invalid response');
        console.warn('Response was:', JSON.stringify(response));
        setProducts([]);
        setFilteredProducts([]);
      }
      setLoading(false);
    } catch (error: any) {
      console.error('❌ Error loading category products from API:', error?.message || error);
      setLoading(false);
      // Show error to user - don't use stale/mock data as prices may be wrong
      Alert.alert(
        'Connection Error',
        `Unable to load products. Error: ${error?.message || 'Unknown error'}`,
        [{ text: 'Retry', onPress: () => loadCategoryProducts() }]
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
          {item.image_url && item.image_url.trim() ? (
            <Image
              source={{ uri: item.image_url }}
              style={{ flex: 1 }}
              resizeMode="cover"
              onError={() => console.log('Image load error for:', item.name)}
              onLoad={() => console.log('Image loaded for:', item.name)}
            />
          ) : (
            <View style={[styles.productImageContent, styles.placeholderImage]}>
              <Ionicons name="image-outline" size={40} color={COLORS.gray} />
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
        <View style={styles.ratingContainer}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Ionicons
              key={i}
              name={i <= Math.floor(item.rating) ? 'star' : 'star-outline'}
              size={14}
              color={COLORS.primary}
            />
          ))}
        </View>
        <View style={styles.priceContainer}>
          <Text style={styles.price}>${discountedPrice.toFixed(2)}</Text>
          {item.discount_percent > 0 && (
            <Text style={styles.originalPrice}>${item.price.toFixed(2)}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={[styles.containerScroll, { paddingTop: Math.max(insets.top - 12, 0) }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBackButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={COLORS.dark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{category === 'all' ? 'All Products' : category}</Text>
          <TouchableOpacity style={styles.headerSearchButton} onPress={() => setShowSearchModal(true)}>
            <Ionicons name="search" size={24} color={COLORS.dark} />
          </TouchableOpacity>
        </View>

        <View style={styles.productsGrid}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Loading products...</Text>
            </View>
          ) : filteredProducts.length > 0 ? (
            filteredProducts.map((product) => renderProductCard(product))
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {searchQuery ? `No products found for "${searchQuery}"` : 'No products found in this category'}
              </Text>
            </View>
          )}
        </View>

        <View style={{ height: SPACING.xl }} />
      </ScrollView>

      {/* Search Modal */}
      <Modal
        visible={showSearchModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowSearchModal(false)}
      >
        <SafeAreaView style={styles.searchModalContainer}>
          <View style={styles.searchHeader}>
            <TouchableOpacity onPress={() => setShowSearchModal(false)}>
              <Ionicons name="chevron-back" size={24} color={COLORS.dark} />
            </TouchableOpacity>
            <TextInput
              style={styles.searchInputModal}
              placeholder={`Search in ${category === 'all' ? 'All Products' : category}...`}
              placeholderTextColor={COLORS.mediumGray}
              value={searchQuery}
              onChangeText={handleSearch}
              autoFocus={true}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={clearSearch}>
                <Ionicons name="close-circle" size={24} color={COLORS.mediumGray} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.searchResultsContainer}>
            <View style={styles.searchResultsContent}>
              {filteredProducts.length > 0 ? (
                <View style={styles.searchProductsGrid}>
                  {filteredProducts.map((product) => renderProductCard(product))}
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    {searchQuery ? `No products found for "${searchQuery}"` : 'No products found'}
                  </Text>
                </View>
              )}
              <View style={{ height: SPACING.xl }} />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  containerScroll: {
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: SPACING.md,
    minHeight: 56,
  },
  headerBackButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: RESPONSIVE_FONT.xl,
    fontWeight: '700',
    color: COLORS.dark,
    textTransform: 'capitalize',
    flex: 1,
    textAlign: 'center',
  },
  headerSearchButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    marginTop: 2,
    gap: RESPONSIVE_SPACING.sm,
  },
  productCard: {
    width: PRODUCT_WIDTH,
    marginBottom: RESPONSIVE_SPACING.sm,
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
    top: SPACING.md,
    right: SPACING.md,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  discountText: {
    fontSize: 12,
    color: COLORS.white,
    fontWeight: '700',
  },
  productName: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.dark,
    marginBottom: SPACING.sm,
  },
  ratingContainer: {
    flexDirection: 'row',
    gap: RESPONSIVE_SPACING.xs,
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 300,
    width: '100%',
  },
  emptyText: {
    fontSize: RESPONSIVE_FONT.lg,
    color: COLORS.mediumGray,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 300,
    width: '100%',
  },
  loadingText: {
    fontSize: RESPONSIVE_FONT.sm,
    color: COLORS.mediumGray,
    fontWeight: '500',
    marginTop: RESPONSIVE_SPACING.md,
  },
  searchModalContainer: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: RESPONSIVE_SPACING.md,
    paddingVertical: RESPONSIVE_SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
    gap: RESPONSIVE_SPACING.md,
    minHeight: 56,
  },
  searchInputModal: {
    flex: 1,
    fontSize: RESPONSIVE_FONT.lg,
    color: COLORS.dark,
    paddingHorizontal: RESPONSIVE_SPACING.md,
    paddingVertical: RESPONSIVE_SPACING.sm,
    backgroundColor: COLORS.lightGray,
    borderRadius: RESPONSIVE_DIMENSION.inputBorderRadius,
    minHeight: 44,
  },
  searchResultsContainer: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  searchResultsContent: {
    paddingHorizontal: RESPONSIVE_SPACING.md,
    paddingVertical: RESPONSIVE_SPACING.sm,
  },
  searchProductsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: RESPONSIVE_SPACING.sm,
  },
});
