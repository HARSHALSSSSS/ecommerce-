import { Tabs } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { Platform, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/src/constants/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cartAPI } from '@/src/services/api';
import db from '@/src/database/db';
import { useFocusEffect } from '@react-navigation/native';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const [cartItemCount, setCartItemCount] = useState(0);
  
  // Extra padding for Android gesture navigation bar
  const bottomPadding = Platform.OS === 'android' ? Math.max(insets.bottom, 16) : insets.bottom;
  
  // Load cart count
  useFocusEffect(
    React.useCallback(() => {
      loadCartCount();
    }, [])
  );
  
  const loadCartCount = async () => {
    try {
      const apiResponse = await cartAPI.get();
      if (apiResponse?.success && apiResponse.cart?.items) {
        const totalQty = apiResponse.cart.items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
        setCartItemCount(totalQty);
        return;
      }
      
      if (Platform.OS !== 'web' && db) {
        const result = await db.getAllAsync('SELECT SUM(quantity) as total FROM cart');
        const total = (result[0] as any)?.total || 0;
        setCartItemCount(total);
      }
    } catch (error) {
      console.log('Error loading cart count:', error);
    }
  };
  
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: '#999999',
        headerShown: false,
        tabBarStyle: {
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          backgroundColor: COLORS.white,
          paddingBottom: bottomPadding + 8,
          paddingTop: 8,
          height: 60 + bottomPadding,
          // Ensure tab bar is above Android navigation gestures
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: 2,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="store"
        options={{
          title: 'Store',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'storefront' : 'storefront-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          tabBarIcon: ({ color, focused }) => (
            <View>
              <Ionicons name={focused ? 'cart' : 'cart-outline'} size={24} color={color} />
              {cartItemCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {cartItemCount > 99 ? '99+' : cartItemCount}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    right: -8,
    top: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
});
