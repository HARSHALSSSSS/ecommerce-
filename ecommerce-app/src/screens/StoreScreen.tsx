import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import db from '../database/db';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/colors';

const { width } = Dimensions.get('window');
const PRODUCT_WIDTH = (width - SPACING.lg * 2 - SPACING.md) / 2;

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
}

export default function StoreScreen({ navigation }: any) {
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedTab, setSelectedTab] = useState<'product' | 'testimoni'>('product');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load first store
      const storeResult = await db.getFirstAsync('SELECT * FROM stores LIMIT 1');
      setStore(storeResult as Store);

      // Load products for this store
      const productsResult = await db.getAllAsync('SELECT * FROM products WHERE store_id = 1');
      setProducts(productsResult as Product[]);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const renderProductCard = (item: Product) => {
    const discountedPrice = item.price * (1 - item.discount_percent / 100);

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.productCard}
        onPress={() => navigation.navigate('ProductDetail', { product: item })}
      >
        <View style={styles.productImage}>
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
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Store Header */}
      <View style={styles.storeHeader}>
        <View style={styles.storeLogo}>
          <Ionicons name="eye" size={32} color={COLORS.white} />
        </View>
        <View>
          <Text style={styles.storeName}>{store.name}</Text>
          <Text style={styles.storeLocation}>{store.location}</Text>
        </View>
      </View>

      {/* Store Stats */}
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

      {/* Tabs */}
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

      {/* Products Grid */}
      {selectedTab === 'product' && (
        <View style={styles.productsGrid}>
          {products.map((product) => renderProductCard(product))}
        </View>
      )}

      {/* Testimoni Tab */}
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
  );
}

const styles = StyleSheet.create({
  container: {
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
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.dark,
  },
  storeLocation: {
    fontSize: 12,
    color: COLORS.primary,
    marginTop: SPACING.xs,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.gray,
    marginHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.lg,
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.dark,
    marginTop: SPACING.xs,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.mediumGray,
    marginTop: SPACING.xs,
  },
  statDivider: {
    width: 1,
    height: 50,
    backgroundColor: COLORS.border,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tabText: {
    fontSize: 14,
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
    paddingHorizontal: SPACING.lg,
  },
  productCard: {
    width: PRODUCT_WIDTH,
    marginBottom: SPACING.lg,
  },
  productImage: {
    width: '100%',
    height: 180,
    backgroundColor: COLORS.lightGray,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
  },
  discountBadge: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  discountText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '700',
  },
  productName: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.dark,
    marginBottom: SPACING.sm,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
    marginRight: SPACING.sm,
  },
  originalPrice: {
    fontSize: 12,
    color: COLORS.mediumGray,
    textDecorationLine: 'line-through',
  },
  testimoniContainer: {
    paddingHorizontal: SPACING.lg,
  },
  testimoniCard: {
    backgroundColor: COLORS.gray,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.lg,
  },
  testimoniHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  testimoniAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  avatarText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 12,
  },
  testimoniName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.dark,
  },
  testimoniRating: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  testimoniText: {
    fontSize: 12,
    color: COLORS.mediumGray,
    lineHeight: 18,
  },
});
