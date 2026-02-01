import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Image,
  Alert,
  Platform,
  TextInput,
  ActivityIndicator,
  InteractionManager,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import db from '@/src/database/db';
import { COLORS, SPACING, BORDER_RADIUS } from '@/src/constants/colors';
import { RESPONSIVE_FONT, RESPONSIVE_SPACING, RESPONSIVE_DIMENSION } from '@/src/constants/responsive';
import { ordersAPI, activityAPI } from '@/src/services/api';

interface Product {
  id: number;
  name: string;
  price: number;
  discount_percent: number;
  image_url?: string;
}

export default function CheckoutScreen() {
  const router = useRouter();
  const { productId, quantity, size, productName, productPrice, discount } = useLocalSearchParams();
  const [selectedPayment, setSelectedPayment] = useState<string>('credit-card');
  const [deliveryAddress, setDeliveryAddress] = useState('123 Main Street, Apartment 4B');
  const [isEditing, setIsEditing] = useState(false);
  const [newAddress, setNewAddress] = useState(deliveryAddress);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  const productQty = Number(quantity) || 1;
  const productDiscount = Number(discount) || 0;
  const productPriceNum = Number(productPrice) || 0;
  const discountedPrice = productPriceNum * (1 - productDiscount / 100);
  const totalPrice = discountedPrice * productQty;
  const shippingCost = 10;
  const tax = (totalPrice * 0.1).toFixed(2);
  const finalTotal = (totalPrice + shippingCost + parseFloat(tax as string)).toFixed(2);

  const paymentMethods = [
    { id: 'credit-card', name: 'Credit Card', icon: 'card' },
    { id: 'debit-card', name: 'Debit Card', icon: 'card' },
    { id: 'digital-wallet', name: 'Digital Wallet', icon: 'wallet' },
    { id: 'cash-on-delivery', name: 'Cash on Delivery', icon: 'cash' },
  ];

  const handlePlaceOrder = async () => {
    if (!selectedPayment) {
      Alert.alert('Error', 'Please select a payment method');
      return;
    }
    
    if (isPlacingOrder) return; // Prevent double-tap
    setIsPlacingOrder(true);

    const paymentMethodName = paymentMethods.find(p => p.id === selectedPayment)?.name || 'Credit Card';
    
    // Generate a temporary order ID for immediate navigation
    const tempOrderId = `ORD-${Date.now()}`;
    
    // Capture all values needed for background processing BEFORE navigation
    const orderParams = {
      productId: Number(productId),
      qty: productQty,
      address: newAddress || deliveryAddress,
      payment: selectedPayment,
      sizeNote: size ? `Size: ${size}` : undefined,
      total: finalTotal,
    };
    
    // Navigate to success page IMMEDIATELY - this is the FIRST thing that happens
    router.replace({
      pathname: '/order-success',
      params: {
        orderId: tempOrderId,
        total: finalTotal,
        paymentMethod: paymentMethodName,
        items: productName as string,
      },
    });

    // Use InteractionManager to defer ALL other work until after navigation animation completes
    InteractionManager.runAfterInteractions(() => {
      // Save order locally for offline access
      const newOrder = {
        id: tempOrderId,
        date: new Date().toLocaleString(),
        productName: productName,
        quantity: orderParams.qty,
        size: size || 'M',
        unitPrice: discountedPrice,
        subtotal: totalPrice.toFixed(2),
        shipping: shippingCost,
        tax: tax,
        total: orderParams.total,
        paymentMethod: paymentMethodName,
        deliveryAddress: orderParams.address,
        status: 'Processing',
      };

      // Fire and forget - don't await
      AsyncStorage.getItem('orders').then(existingOrders => {
        const orders = existingOrders ? JSON.parse(existingOrders) : [];
        orders.push(newOrder);
        AsyncStorage.setItem('orders', JSON.stringify(orders)).catch(() => {});
      }).catch(() => {});

      // Create order on backend - fire and forget
      const orderData = {
        items: [{ product_id: orderParams.productId, quantity: orderParams.qty }],
        delivery_address: orderParams.address,
        city: 'Default City',
        postal_code: '10001',
        payment_method: orderParams.payment,
        notes: orderParams.sizeNote,
      };

      ordersAPI.create(orderData).then(apiResponse => {
        const realOrderId = apiResponse.order?.id || apiResponse.orderId;
        console.log('✅ Order created:', realOrderId);
        
        // Update local storage with real order ID
        AsyncStorage.getItem('orders').then(existingOrders => {
          const orders = existingOrders ? JSON.parse(existingOrders) : [];
          const orderIndex = orders.findIndex((o: any) => o.id === tempOrderId);
          if (orderIndex >= 0) {
            orders[orderIndex].id = realOrderId;
            orders[orderIndex].status = 'Confirmed';
            AsyncStorage.setItem('orders', JSON.stringify(orders)).catch(() => {});
          }
        }).catch(() => {});

        activityAPI.logCheckout(realOrderId, parseFloat(orderParams.total)).catch(() => {});
      }).catch(error => {
        console.error('Background order error:', error);
      });
    });
  };

  const handleAddressUpdate = () => {
    if (newAddress.trim()) {
      setDeliveryAddress(newAddress);
      setIsEditing(false);
      Alert.alert('Success', 'Address updated successfully');
    } else {
      Alert.alert('Error', 'Please enter a valid address');
    }
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBackButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={COLORS.dark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Checkout</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Order Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.orderCard}>
            <View style={styles.orderItemHeader}>
              <Text style={styles.productNameCheckout}>{productName}</Text>
              <Text style={styles.quantityBadge}>x{productQty}</Text>
            </View>
            <View style={styles.orderItemDetails}>
              <Text style={styles.orderDetailLabel}>Size: <Text style={styles.orderDetailValue}>{size || 'M'}</Text></Text>
              <Text style={styles.orderDetailLabel}>Price: <Text style={styles.orderDetailValue}>${discountedPrice.toFixed(2)}</Text></Text>
            </View>
            {productDiscount > 0 && (
              <View style={styles.discountInfo}>
                <Ionicons name="pricetag" size={16} color={COLORS.primary} />
                <Text style={styles.discountLabel}>Discount {productDiscount}% applied</Text>
              </View>
            )}
          </View>
        </View>

        {/* Delivery Address */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderWithButton}>
            <Text style={styles.sectionTitle}>Delivery Address</Text>
            <TouchableOpacity onPress={() => setIsEditing(!isEditing)}>
              <Text style={styles.editButton}>{isEditing ? 'Cancel' : 'Edit'}</Text>
            </TouchableOpacity>
          </View>

          {!isEditing ? (
            <View style={styles.addressCard}>
              <View style={styles.addressIcon}>
                <Ionicons name="location" size={20} color={COLORS.primary} />
              </View>
              <View style={styles.addressContent}>
                <Text style={styles.addressLabel}>Delivery Address</Text>
                <Text style={styles.addressText}>{deliveryAddress}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.addressEditCard}>
              <TextInput
                style={styles.addressInput}
                placeholder="Enter delivery address"
                placeholderTextColor={COLORS.mediumGray}
                value={newAddress}
                onChangeText={setNewAddress}
                multiline
              />
              <TouchableOpacity style={styles.updateAddressButton} onPress={handleAddressUpdate}>
                <Text style={styles.updateAddressButtonText}>Update Address</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Payment Method */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          {paymentMethods.map((method) => (
            <TouchableOpacity
              key={method.id}
              style={[
                styles.paymentMethodCard,
                selectedPayment === method.id && styles.paymentMethodCardSelected,
              ]}
              onPress={() => setSelectedPayment(method.id)}
            >
              <View style={styles.paymentMethodIconContainer}>
                <Ionicons
                  name={method.icon as any}
                  size={24}
                  color={selectedPayment === method.id ? COLORS.primary : COLORS.mediumGray}
                />
              </View>
              <View style={styles.paymentMethodInfo}>
                <Text
                  style={[
                    styles.paymentMethodName,
                    selectedPayment === method.id && styles.paymentMethodNameSelected,
                  ]}
                >
                  {method.name}
                </Text>
              </View>
              <View
                style={[
                  styles.radioButton,
                  selectedPayment === method.id && styles.radioButtonSelected,
                ]}
              >
                {selectedPayment === method.id && (
                  <View style={styles.radioButtonInner} />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Price Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Price Details</Text>
          <View style={styles.priceBreakdown}>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Subtotal ({productQty} item)</Text>
              <Text style={styles.priceValue}>${totalPrice.toFixed(2)}</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Shipping</Text>
              <Text style={styles.priceValue}>${shippingCost.toFixed(2)}</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Tax (10%)</Text>
              <Text style={styles.priceValue}>${tax}</Text>
            </View>
            <View style={[styles.priceRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalPrice}>${finalTotal}</Text>
            </View>
          </View>
        </View>

        <View style={{ height: SPACING.lg }} />
      </ScrollView>

      {/* Place Order Button */}
      <View style={styles.bottomButtonContainer}>
        <TouchableOpacity 
          style={[styles.placeOrderButton, isPlacingOrder && styles.placeOrderButtonDisabled]} 
          onPress={handlePlaceOrder}
          disabled={isPlacingOrder}
        >
          {isPlacingOrder ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.placeOrderButtonText}>Processing...</Text>
            </View>
          ) : (
            <Text style={styles.placeOrderButtonText}>Place Order</Text>
          )}
        </TouchableOpacity>
      </View>
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
    paddingHorizontal: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
    marginBottom: SPACING.lg,
    minHeight: 56,
  },
  headerBackButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -SPACING.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.dark,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 44,
  },
  section: {
    marginBottom: RESPONSIVE_SPACING.xl,
  },
  sectionTitle: {
    fontSize: RESPONSIVE_FONT.lg,
    fontWeight: '700',
    color: COLORS.dark,
    marginBottom: RESPONSIVE_SPACING.md,
  },
  sectionHeaderWithButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: RESPONSIVE_SPACING.md,
  },
  editButton: {
    fontSize: RESPONSIVE_FONT.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
  orderCard: {
    backgroundColor: COLORS.lightGray,
    borderRadius: RESPONSIVE_DIMENSION.cardBorderRadius,
    padding: RESPONSIVE_SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  orderItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: RESPONSIVE_SPACING.md,
  },
  productNameCheckout: {
    fontSize: RESPONSIVE_FONT.sm,
    fontWeight: '600',
    color: COLORS.dark,
    flex: 1,
  },
  quantityBadge: {
    fontSize: RESPONSIVE_FONT.sm,
    fontWeight: '600',
    color: COLORS.primary,
    backgroundColor: COLORS.white,
    paddingHorizontal: RESPONSIVE_SPACING.sm,
    paddingVertical: RESPONSIVE_SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  orderItemDetails: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: RESPONSIVE_SPACING.md,
    marginBottom: RESPONSIVE_SPACING.md,
  },
  orderDetailLabel: {
    fontSize: RESPONSIVE_FONT.xs,
    color: COLORS.mediumGray,
    marginBottom: RESPONSIVE_SPACING.sm,
  },
  orderDetailValue: {
    fontWeight: '600',
    color: COLORS.dark,
  },
  discountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    gap: SPACING.xs,
  },
  discountLabel: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  addressCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.lightGray,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addressIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  addressContent: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 12,
    color: COLORS.mediumGray,
    marginBottom: SPACING.xs,
  },
  addressText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.dark,
  },
  addressEditCard: {
    backgroundColor: COLORS.lightGray,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addressInput: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: 13,
    color: COLORS.dark,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  updateAddressButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  updateAddressButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
  },
  paymentMethodCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.lightGray,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  paymentMethodCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#FFF5F0',
  },
  paymentMethodIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  paymentMethodInfo: {
    flex: 1,
  },
  paymentMethodName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.dark,
  },
  paymentMethodNameSelected: {
    color: COLORS.primary,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.mediumGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    borderColor: COLORS.primary,
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  priceBreakdown: {
    backgroundColor: COLORS.lightGray,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  totalRow: {
    borderBottomWidth: 0,
    marginBottom: 0,
    paddingBottom: 0,
  },
  priceLabel: {
    fontSize: 13,
    color: COLORS.mediumGray,
  },
  priceValue: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.dark,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.dark,
  },
  totalPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },
  bottomButtonContainer: {
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
  },
  placeOrderButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeOrderButtonDisabled: {
    opacity: 0.7,
  },
  placeOrderButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
});
