import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  Dimensions,
} from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import db from '../database/db';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/colors';

const { width } = Dimensions.get('window');
const PRODUCT_WIDTH = (width - SPACING.lg * 2 - SPACING.md) / 2;

interface Product {
  id: number;
  name: string;
  price: number;
  discount_percent: number;
  rating: number;
}

interface Store {
  id: number;
  name: string;
  location: string;
}

export default function HomeScreen({ navigation }: any) {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [userName, setUserName] = useState('Maruyama');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load products
      const productResult = await db.getAllAsync('SELECT * FROM products LIMIT 4');
      setProducts(productResult as Product[]);

      // Load first store
      const storeResult = await db.getFirstAsync('SELECT * FROM stores LIMIT 1');
      setSelectedStore(storeResult as Store);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleCategoryPress = (category: string) => {
    console.log('Category pressed:', category);
  };

  const renderCategoryIcon = (icon: string, label: string) => {
    const iconMap: any = {
      clothing: 'shopping',
      shoes: 'boot',
      wallet: 'wallet',
      hat: 'hat',
      accessories: 'ring',
    };

    return (
      <TouchableOpacity
        key={label}
        style={styles.categoryIcon}
        onPress={() => handleCategoryPress(label)}
      >
        <View style={styles.iconCircle}>
          <FontAwesome5 name={iconMap[label] || 'shopping'} size={20} color={COLORS.primary} />
        </View>
      </TouchableOpacity>
    );
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

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good Morning</Text>
          <Text style={styles.userName}>{userName}</Text>
        </View>
        <TouchableOpacity style={styles.notificationIcon}>
          <Ionicons name="notifications" size={24} color={COLORS.dark} />
        </TouchableOpacity>
      </View>

      {/* Delivery Location */}
      <View style={styles.deliverySection}>
        <View style={styles.locationCircle}>
          <Ionicons name="location" size={20} color={COLORS.white} />
        </View>
        <View style={styles.deliveryInfo}>
          <Text style={styles.sendToLabel}>Send to :</Text>
          <Text style={styles.storeName}>{selectedStore?.name || 'Mega Regency'}</Text>
        </View>
        <TouchableOpacity>
          <Text style={styles.changeButton}>Change</Text>
        </TouchableOpacity>
      </View>

      {/* Categories */}
      <View style={styles.categoriesSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {renderCategoryIcon('clothing', 'clothing')}
          {renderCategoryIcon('shoes', 'shoes')}
          {renderCategoryIcon('wallet', 'wallet')}
          {renderCategoryIcon('hat', 'hat')}
          {renderCategoryIcon('accessories', 'accessories')}
        </ScrollView>
      </View>

      {/* Most Popular Section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Most popular</Text>
        <TouchableOpacity>
          <Text style={styles.viewMore}>View More</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.productsGrid}>
        {products.map((product) => renderProductCard(product))}
      </View>

      {/* Collection Section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Collection</Text>
        <TouchableOpacity>
          <Text style={styles.viewMore}>View More</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.collectionCard}>
        <View style={styles.collectionBg} />
        <Text style={styles.collectionText}>Explore Our Latest Collection</Text>
      </TouchableOpacity>

      <View style={{ height: SPACING.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  greeting: {
    fontSize: 14,
    color: COLORS.mediumGray,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.dark,
    marginTop: SPACING.sm,
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.gray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deliverySection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  locationCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  deliveryInfo: {
    flex: 1,
  },
  sendToLabel: {
    fontSize: 12,
    color: COLORS.mediumGray,
  },
  storeName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.dark,
    marginTop: SPACING.sm,
  },
  changeButton: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  categoriesSection: {
    marginBottom: SPACING.lg,
  },
  categoryIcon: {
    marginRight: SPACING.lg,
  },
  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.gray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    marginTop: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.dark,
  },
  viewMore: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  productsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    marginBottom: SPACING.lg,
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
  collectionCard: {
    width: '100%',
    height: 150,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
  },
  collectionBg: {
    flex: 1,
    backgroundColor: COLORS.dark,
  },
  collectionText: {
    position: 'absolute',
    bottom: SPACING.lg,
    left: SPACING.lg,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
});
