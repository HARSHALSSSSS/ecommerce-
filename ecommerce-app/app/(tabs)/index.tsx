import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Platform,
  TextInput,
  FlatList,
  Modal,
  Alert,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { productsAPI, storesAPI, categoriesAPI } from '@/src/services/api';
import { COLORS, SPACING, BORDER_RADIUS } from '@/src/constants/colors';
import { RESPONSIVE_FONT, RESPONSIVE_SPACING, RESPONSIVE_DIMENSION, getScreenPadding } from '@/src/constants/responsive';
import { preloadImages, validateImageUrl } from '@/src/utils/imageCache';

const { width } = Dimensions.get('window');
const PRODUCT_WIDTH = RESPONSIVE_DIMENSION.productCardWidth;
const SCREEN_PADDING = getScreenPadding();

interface Product {
  id: number;
  name: string;
  price: number;
  discount_percent: number;
  rating: number;
  image_url?: string;
  category?: string;
}

interface Store {
  id: number;
  name: string;
  location: string;
}

interface Category {
  id: number;
  name: string;
  slug: string;
  image_url?: string;
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [userName, setUserName] = useState('Guest');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [newAddress, setNewAddress] = useState('');
  const [loadingImages, setLoadingImages] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    loadData();
    loadCategories();
    loadDeliveryAddress();
    loadUserName();
  }, []);

  // Reload user name and products when screen is focused (after profile update or admin changes)
  useFocusEffect(
    React.useCallback(() => {
      loadUserName();
      loadDeliveryAddress();
      loadData(); // Refresh products to get latest prices from backend
    }, [])
  );

  const loadUserName = async () => {
    try {
      // First try 'user' key (used by AuthContext)
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user.name) {
          setUserName(user.name);
          return;
        }
      }
      // Fallback to 'userProfile' key
      const saved = await AsyncStorage.getItem('userProfile');
      if (saved) {
        const profile = JSON.parse(saved);
        if (profile.name) {
          setUserName(profile.name);
        }
      }
    } catch (error) {
      console.error('Error loading user name:', error);
    }
  };

  const loadDeliveryAddress = async () => {
    try {
      // Load from 'user' object (same as profile/checkout)
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        // Combine address and city for display
        if (user.address && user.city) {
          setDeliveryAddress(`${user.address}, ${user.city}`);
          setNewAddress(`${user.address}, ${user.city}`);
        } else if (user.address) {
          setDeliveryAddress(user.address);
          setNewAddress(user.address);
        } else if (user.city) {
          setDeliveryAddress(user.city);
          setNewAddress(user.city);
        } else {
          setDeliveryAddress('Set delivery address');
          setNewAddress('');
        }
        return;
      }
      // Fallback: no address set
      setDeliveryAddress('Set delivery address');
      setNewAddress('');
    } catch (error) {
      console.error('Error loading delivery address:', error);
      setDeliveryAddress('Set delivery address');
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      console.log('📱 Loading products from API...');
      console.log('🔗 API will use production URL for standalone build');
      
      // Fetch products from backend API
      const productsResponse = await productsAPI.getAll();
      console.log('📦 API Response:', JSON.stringify(productsResponse).substring(0, 200));
      console.log('📦 Products count:', productsResponse?.products?.length || 0);
      
      if (productsResponse && productsResponse.success && Array.isArray(productsResponse.products)) {
        const apiProducts = productsResponse.products.map((p: any) => ({
          id: p.id,
          name: p.name || 'Unknown Product',
          price: p.price || 0,
          discount_percent: p.discount_percent || 0,
          rating: p.rating || 4.5,
          image_url: p.image_url || '',
          category: p.category || 'other',
        }));
        
        // Log first few products with prices for debugging
        console.log('💰 First 3 products:', apiProducts.slice(0, 3).map((p: any) => `${p.name}: $${p.price} (img: ${p.image_url ? 'yes' : 'no'})`));
        
        // Don't filter out products without images - show all products
        // Only filter for products that have image URLs starting with http
        const validProducts = apiProducts.filter((p: Product) => {
          const hasValidImage = p.image_url && (p.image_url.startsWith('http://') || p.image_url.startsWith('https://'));
          if (!hasValidImage) {
            console.log(`⚠️ Product "${p.name}" has invalid image URL:`, p.image_url);
          }
          return hasValidImage;
        });
        
        console.log(`✅ ${validProducts.length} products with valid images out of ${apiProducts.length} total`);
        
        setAllProducts(validProducts);
        
        const firstSix = validProducts.slice(0, 6);
        setProducts(firstSix);
        
        // FAST: Preload first 6 images immediately (high priority)
        if (firstSix.length > 0) {
          console.log('⚡ Preloading first 6 visible product images...');
          const topImageUrls = firstSix
            .map((p: Product) => p.image_url)
            .filter((url: string | undefined): url is string => !!url && (url.startsWith('http://') || url.startsWith('https://')));
          preloadImages(topImageUrls).catch(() => {});
        }
        
        // ASYNC: Preload ALL remaining images in background (don't block)
        if (validProducts.length > 6) {
          setTimeout(() => {
            console.log('🖼️ Preloading all remaining product images in background...');
            const allImageUrls = validProducts
              .map((p: Product) => p.image_url)
              .filter((url: string | undefined): url is string => !!url && (url.startsWith('http://') || url.startsWith('https://')));
            preloadImages(allImageUrls).catch(() => {});
          }, 500);
        }
      } else {
        console.warn('⚠️ API returned no products or invalid response');
        console.warn('Response was:', JSON.stringify(productsResponse));
        setAllProducts([]);
        setProducts([]);
      }
      
      // Fetch stores from API
      try {
        const storesResponse = await storesAPI.getAll();
        if (storesResponse.success && storesResponse.stores && storesResponse.stores.length > 0) {
          setSelectedStore(storesResponse.stores[0]);
        }
      } catch (storeError) {
        console.log('Using default store');
        setSelectedStore({ id: 1, name: 'UFO Fashion', location: 'Cikarang, Bekasi' });
      }
    } catch (error: any) {
      console.error('❌ Error loading data from API:', error?.message || error);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
      setLoadError(error?.message || 'Failed to load products');
      
      // Silent retry on first attempts (up to 2 retries)
      if (retryCount < 2) {
        console.log(`🔄 Retrying... (attempt ${retryCount + 1}/2)`);
        setRetryCount(prev => prev + 1);
        setTimeout(() => {
          loadData();
        }, 2000); // Wait 2 seconds before retry
      } else {
        // After retries exhausted, set error state but DON'T show alert
        // User will see inline error message with manual retry button
        console.log('❌ All retry attempts exhausted');
        setAllProducts([]);
        setProducts([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      console.log('📱 Loading categories from API...');
      const response = await categoriesAPI.getAll();
      if (response.success && response.categories) {
        setCategories(response.categories);
      } else {
        // Fallback default categories
        setCategories([
          { id: 1, name: 'Clothing', slug: 'clothing' },
          { id: 2, name: 'Shoes', slug: 'shoes' },
          { id: 3, name: 'Hats', slug: 'hat' },
          { id: 4, name: 'Home & Living', slug: 'home' },
          { id: 5, name: 'Accessories', slug: 'accessories' },
        ]);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
      // Fallback default categories
      setCategories([
        { id: 1, name: 'Clothing', slug: 'clothing' },
        { id: 2, name: 'Shoes', slug: 'shoes' },
        { id: 3, name: 'Hats', slug: 'hat' },
        { id: 4, name: 'Home & Living', slug: 'home' },
        { id: 5, name: 'Accessories', slug: 'accessories' },
      ]);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim().length > 0) {
      const filtered = allProducts.filter(product =>
        product.name.toLowerCase().includes(query.toLowerCase()) ||
        product.category?.toLowerCase().includes(query.toLowerCase())
      );
      setProducts(filtered);
      setShowSearchResults(true);
      // Preload search result images
      const searchImageUrls = filtered
        .slice(0, 12)
        .map(p => p.image_url)
        .filter((url) => url && validateImageUrl(url)) as string[];
      preloadImages(searchImageUrls).catch(() => {});
    } else {
      setProducts(allProducts.slice(0, 6));
      setShowSearchResults(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setProducts(allProducts.slice(0, 6));
    setShowSearchResults(false);
  };

  const handleRetry = () => {
    setRetryCount(0);
    setLoadError(null);
    loadData();
  };

  const handleChangeAddress = async () => {
    if (newAddress.trim().length === 0) {
      Alert.alert('Error', 'Please enter a valid address');
      return;
    }
    try {
      // Update the user object to keep data in sync
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        // Store the full address in the address field
        user.address = newAddress.trim();
        await AsyncStorage.setItem('user', JSON.stringify(user));
        await AsyncStorage.setItem('userProfile', JSON.stringify(user)); // Backward compatibility
      } else {
        // Create new user object if none exists
        const newUser = {
          name: userName,
          address: newAddress.trim(),
          city: '',
          phone: '',
          email: '',
        };
        await AsyncStorage.setItem('user', JSON.stringify(newUser));
        await AsyncStorage.setItem('userProfile', JSON.stringify(newUser));
      }
      
      setDeliveryAddress(newAddress.trim());
      setShowAddressModal(false);
      Alert.alert('Success', 'Delivery address updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to update address');
      console.error(error);
    }
  };

  const handleCategoryPress = (category: string) => {
    console.log('Category pressed:', category);
    // Navigate to category filtered products
    router.push({
      pathname: '/category',
      params: { category }
    });
  };

  const getCategoryIcon = (slug: string): string => {
    switch (slug.toLowerCase()) {
      case 'clothing':
        return 'shirt';
      case 'shoes':
        return 'walk';
      case 'hat':
      case 'hats':
        return 'glasses'; // FontAwesome5 hat-cowboy handled separately
      case 'home':
      case 'home-living':
        return 'home';
      case 'accessories':
        return 'sparkles';
      default:
        return 'apps';
    }
  };

  const renderCategoryIcon = (category: Category) => {
    const slug = category.slug.toLowerCase();
    const isHat = slug === 'hat' || slug === 'hats';
    
    return (
      <TouchableOpacity
        key={category.id}
        style={styles.categoryIcon}
        onPress={() => handleCategoryPress(category.slug)}
      >
        <View style={styles.iconCircle}>
          {isHat ? (
            <FontAwesome5 name="hat-cowboy" size={24} color={COLORS.primary} />
          ) : (
            <Ionicons name={getCategoryIcon(category.slug) as any} size={24} color={COLORS.primary} />
          )}
        </View>
        <Text style={styles.categoryLabel}>{category.name}</Text>
      </TouchableOpacity>
    );
  };

  const renderProductCard = (item: Product) => {
    const discountedPrice = item.price * (1 - item.discount_percent / 100);
    const imageUri = item.image_url && validateImageUrl(item.image_url) ? item.image_url.trim() : null;
    const isLoadingImage = loadingImages.has(item.id);

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.productCard}
        onPress={() => router.push({
          pathname: '/product-detail',
          params: { productId: item.id }
        })}
        activeOpacity={0.8}
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

  // Show loading indicator during initial load
  if (isLoading && products.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading products...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show error state with retry button
  if (loadError && products.length === 0 && !isLoading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.errorContainer}>
          <Ionicons name="cloud-offline-outline" size={80} color={COLORS.mediumGray} />
          <Text style={styles.errorTitle}>Unable to Load Products</Text>
          <Text style={styles.errorMessage}>
            Please check your internet connection and try again.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry} activeOpacity={0.8}>
            <Ionicons name="reload" size={20} color={COLORS.white} />
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeContainer} edges={['left', 'right']}>
      {!showSearchResults ? (
        <ScrollView 
          style={[styles.container, { paddingTop: insets.top }]} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: Platform.OS === 'android' ? 100 : 80 }}
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Hello</Text>
              <Text style={styles.userName}>{userName}</Text>
            </View>
            <TouchableOpacity style={styles.notificationIcon}>
              <Ionicons name="notifications" size={24} color={COLORS.dark} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={COLORS.mediumGray} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search products..."
              placeholderTextColor={COLORS.mediumGray}
              value={searchQuery}
              onChangeText={handleSearch}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={clearSearch}>
                <Ionicons name="close-circle" size={20} color={COLORS.mediumGray} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.deliverySection}>
            <View style={styles.locationCircle}>
              <Ionicons name="location" size={20} color={COLORS.white} />
            </View>
            <View style={styles.deliveryInfo}>
              <Text style={styles.sendToLabel}>Send to :</Text>
              <Text style={styles.storeName}>{deliveryAddress}</Text>
            </View>
            <TouchableOpacity onPress={() => setShowAddressModal(true)}>
              <Text style={styles.changeButton}>Change</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.categoriesSection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {categories.map((category) => renderCategoryIcon(category))}
            </ScrollView>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Most popular</Text>
            <TouchableOpacity onPress={() => router.push({ pathname: '/category', params: { category: 'all' } })}>
              <Text style={styles.viewMore}>View More</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.productsGrid}>
            {products.map((product) => renderProductCard(product))}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Collection</Text>
            <TouchableOpacity onPress={() => router.push('/collection-detail')} activeOpacity={0.7}>
              <Text style={styles.viewMore}>See More</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={styles.collectionCard}
            onPress={() => router.push('/collection-detail')}
            activeOpacity={0.8}
          >
            <View style={styles.collectionBg} />
            <Text style={styles.collectionText}>Explore Our Latest Collection</Text>
          </TouchableOpacity>

          <View style={{ height: SPACING.xxl }} />
        </ScrollView>
      ) : (
        <View style={[styles.container, { paddingTop: insets.top }]}>
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Hello</Text>
              <Text style={styles.userName}>{userName}</Text>
            </View>
            <TouchableOpacity style={styles.notificationIcon}>
              <Ionicons name="notifications" size={24} color={COLORS.dark} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={COLORS.mediumGray} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search products..."
              placeholderTextColor={COLORS.mediumGray}
              value={searchQuery}
              onChangeText={handleSearch}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={clearSearch}>
                <Ionicons name="close-circle" size={20} color={COLORS.mediumGray} />
              </TouchableOpacity>
            )}
          </View>

          {products.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <Ionicons name="search" size={60} color={COLORS.lightGray} />
              <Text style={styles.emptyStateTitle}>No products found</Text>
              <Text style={styles.emptyStateSubtitle}>Try searching with different keywords</Text>
              <TouchableOpacity style={styles.resetButton} onPress={clearSearch} activeOpacity={0.7}>
                <Text style={styles.resetButtonText}>Clear Search</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={products}
              numColumns={2}
              renderItem={({ item }) => (
                <View style={{ flex: 1, marginRight: SPACING.md, marginBottom: SPACING.lg }}>
                  {renderProductCard(item)}
                </View>
              )}
              keyExtractor={(item) => item.id.toString()}
              columnWrapperStyle={{ justifyContent: 'space-between' }}
              scrollEnabled={true}
              contentContainerStyle={{ paddingBottom: SPACING.xxl }}
            />
          )}
        </View>
      )}

      <Modal
        visible={showAddressModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddressModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Delivery Address</Text>
              <TouchableOpacity onPress={() => setShowAddressModal(false)} activeOpacity={0.7}>
                <Ionicons name="close" size={24} color={COLORS.dark} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Delivery Address</Text>
              <TextInput
                style={styles.addressInput}
                placeholder="Enter your delivery address"
                placeholderTextColor={COLORS.mediumGray}
                value={newAddress}
                onChangeText={setNewAddress}
                multiline={true}
                numberOfLines={4}
              />
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setNewAddress(deliveryAddress);
                  setShowAddressModal(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleChangeAddress}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmButtonText}>Save Address</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: SCREEN_PADDING,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: RESPONSIVE_SPACING.md,
    paddingBottom: RESPONSIVE_SPACING.lg,
  },
  greeting: {
    fontSize: RESPONSIVE_FONT.sm,
    color: COLORS.mediumGray,
  },
  userName: {
    fontSize: RESPONSIVE_FONT.lg,
    fontWeight: 'bold',
    color: COLORS.dark,
    marginTop: RESPONSIVE_SPACING.sm,
  },
  notificationIcon: {
    width: RESPONSIVE_DIMENSION.buttonHeight,
    height: RESPONSIVE_DIMENSION.buttonHeight,
    borderRadius: RESPONSIVE_DIMENSION.buttonHeight / 2,
    backgroundColor: COLORS.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: RESPONSIVE_SPACING.sm,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray,
    borderRadius: RESPONSIVE_DIMENSION.inputBorderRadius,
    paddingHorizontal: RESPONSIVE_SPACING.md,
    marginBottom: RESPONSIVE_SPACING.lg,
    height: RESPONSIVE_DIMENSION.inputHeight,
  },
  searchIcon: {
    marginRight: RESPONSIVE_SPACING.md,
  },
  searchInput: {
    flex: 1,
    fontSize: RESPONSIVE_FONT.base,
    color: COLORS.dark,
    fontWeight: '500',
  },
  deliverySection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: RESPONSIVE_SPACING.lg,
    paddingVertical: RESPONSIVE_SPACING.md,
    paddingHorizontal: RESPONSIVE_SPACING.md,
    backgroundColor: '#FFF5F0',
    borderRadius: RESPONSIVE_DIMENSION.cardBorderRadius,
  },
  locationCircle: {
    width: RESPONSIVE_DIMENSION.buttonHeight,
    height: RESPONSIVE_DIMENSION.buttonHeight,
    borderRadius: RESPONSIVE_DIMENSION.buttonHeight / 2,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: RESPONSIVE_SPACING.md,
  },
  deliveryInfo: {
    flex: 1,
  },
  sendToLabel: {
    fontSize: RESPONSIVE_FONT.xs,
    color: COLORS.mediumGray,
  },
  storeName: {
    fontSize: RESPONSIVE_FONT.base,
    fontWeight: '600',
    color: COLORS.dark,
    marginTop: RESPONSIVE_SPACING.xs,
  },
  changeButton: {
    fontSize: RESPONSIVE_FONT.sm,
    color: COLORS.primary,
    fontWeight: '600',
    paddingVertical: RESPONSIVE_SPACING.sm,
    paddingHorizontal: RESPONSIVE_SPACING.md,
  },
  categoriesSection: {
    marginBottom: RESPONSIVE_SPACING.xl,
    marginTop: RESPONSIVE_SPACING.md,
  },
  categoryIcon: {
    marginRight: RESPONSIVE_SPACING.xl,
    alignItems: 'center',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: RESPONSIVE_SPACING.sm,
  },
  categoryLabel: {
    fontSize: RESPONSIVE_FONT.xs,
    color: COLORS.dark,
    fontWeight: '500',
    textAlign: 'center',
    width: 60,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: RESPONSIVE_SPACING.md,
    marginTop: RESPONSIVE_SPACING.md,
  },
  sectionTitle: {
    fontSize: RESPONSIVE_FONT.lg,
    fontWeight: '700',
    color: COLORS.dark,
  },
  viewMore: {
    fontSize: RESPONSIVE_FONT.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
  productsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    marginBottom: RESPONSIVE_SPACING.md,
  },
  productCard: {
    width: PRODUCT_WIDTH,
    marginBottom: RESPONSIVE_SPACING.md,
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
  collectionCard: {
    width: '100%',
    height: width < 360 ? 120 : 150,
    borderRadius: RESPONSIVE_DIMENSION.cardBorderRadius,
    overflow: 'hidden',
    marginBottom: RESPONSIVE_SPACING.lg,
  },
  collectionBg: {
    flex: 1,
    backgroundColor: COLORS.dark,
  },
  collectionText: {
    position: 'absolute',
    bottom: RESPONSIVE_SPACING.lg,
    left: RESPONSIVE_SPACING.lg,
    fontSize: RESPONSIVE_FONT.lg,
    fontWeight: '700',
    color: COLORS.white,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: RESPONSIVE_SPACING.lg,
    marginTop: RESPONSIVE_SPACING.xl,
  },
  emptyStateTitle: {
    fontSize: RESPONSIVE_FONT.lg,
    fontWeight: '700',
    color: COLORS.dark,
    marginTop: RESPONSIVE_SPACING.lg,
  },
  emptyStateSubtitle: {
    fontSize: RESPONSIVE_FONT.base,
    color: COLORS.mediumGray,
    marginTop: RESPONSIVE_SPACING.sm,
    textAlign: 'center',
  },
  resetButton: {
    marginTop: RESPONSIVE_SPACING.lg,
    paddingVertical: RESPONSIVE_SPACING.md,
    paddingHorizontal: RESPONSIVE_SPACING.xl,
    backgroundColor: COLORS.primary,
    borderRadius: RESPONSIVE_DIMENSION.buttonBorderRadius,
  },
  resetButtonText: {
    fontSize: RESPONSIVE_FONT.base,
    fontWeight: '600',
    color: COLORS.white,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RESPONSIVE_DIMENSION.modalBorderRadius,
    borderTopRightRadius: RESPONSIVE_DIMENSION.modalBorderRadius,
    maxHeight: '80%',
    paddingBottom: RESPONSIVE_SPACING.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: RESPONSIVE_SPACING.lg,
    paddingVertical: RESPONSIVE_SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  modalTitle: {
    fontSize: RESPONSIVE_FONT.lg,
    fontWeight: '700',
    color: COLORS.dark,
  },
  modalBody: {
    paddingHorizontal: RESPONSIVE_SPACING.lg,
    paddingVertical: RESPONSIVE_SPACING.lg,
  },
  inputLabel: {
    fontSize: RESPONSIVE_FONT.base,
    fontWeight: '600',
    color: COLORS.dark,
    marginBottom: RESPONSIVE_SPACING.md,
  },
  addressInput: {
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: RESPONSIVE_DIMENSION.inputBorderRadius,
    paddingHorizontal: RESPONSIVE_SPACING.md,
    paddingVertical: RESPONSIVE_SPACING.md,
    fontSize: RESPONSIVE_FONT.base,
    color: COLORS.dark,
    backgroundColor: COLORS.lightGray,
    textAlignVertical: 'top',
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: RESPONSIVE_FONT.base,
    color: COLORS.mediumGray,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.xl,
  },
  errorTitle: {
    marginTop: SPACING.lg,
    fontSize: RESPONSIVE_FONT.xl,
    fontWeight: '700',
    color: COLORS.dark,
    textAlign: 'center',
  },
  errorMessage: {
    marginTop: SPACING.sm,
    fontSize: RESPONSIVE_FONT.base,
    color: COLORS.mediumGray,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryButton: {
    marginTop: SPACING.xl,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.lg,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  retryButtonText: {
    marginLeft: SPACING.sm,
    fontSize: RESPONSIVE_FONT.base,
    fontWeight: '700',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
    minHeight: 120,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: RESPONSIVE_SPACING.md,
    paddingHorizontal: RESPONSIVE_SPACING.lg,
    paddingVertical: RESPONSIVE_SPACING.md,
  },
  modalButton: {
    flex: 1,
    paddingVertical: RESPONSIVE_SPACING.md,
    borderRadius: RESPONSIVE_DIMENSION.buttonBorderRadius,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: COLORS.lightGray,
  },
  confirmButton: {
    backgroundColor: COLORS.primary,
  },
  cancelButtonText: {
    fontSize: RESPONSIVE_FONT.base,
    fontWeight: '600',
    color: COLORS.dark,
  },
  confirmButtonText: {
    fontSize: RESPONSIVE_FONT.base,
    fontWeight: '600',
    color: COLORS.white,
  },
});
