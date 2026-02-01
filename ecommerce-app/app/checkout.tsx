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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import db from '@/src/database/db';
import { COLORS, SPACING, BORDER_RADIUS } from '@/src/constants/colors';
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

    try {
      const paymentMethodName = paymentMethods.find(p => p.id === selectedPayment)?.name || 'Credit Card';

      // Create order via API
      const orderData = {
        items: [{ 
          product_id: Number(productId), 
          quantity: productQty 
        }],
        delivery_address: newAddress || deliveryAddress,
        city: 'Default City',
        postal_code: '10001',
        payment_method: selectedPayment,
        notes: size ? `Size: ${size}` : undefined,
      };

      console.log('Creating order with data:', orderData);
      const apiResponse = await ordersAPI.create(orderData);
      console.log('Order created:', apiResponse);

      const orderId = apiResponse.order?.id || apiResponse.orderId || Math.floor(Math.random() * 100000) + 10000;

      // Log activity
      await activityAPI.logCheckout(orderId, parseFloat(finalTotal));

      // Also save to local storage for offline access
      const newOrder = {
        id: orderId,
        date: new Date().toLocaleString(),
        productName: productName,
        quantity: productQty,
        size: size || 'M',
        unitPrice: discountedPrice,
        subtotal: totalPrice.toFixed(2),
        shipping: shippingCost,
        tax: tax,
        total: finalTotal,
        paymentMethod: paymentMethodName,
        deliveryAddress: newAddress || deliveryAddress,
        status: 'Processing',
      };

      const existingOrders = await AsyncStorage.getItem('orders');
      const orders = existingOrders ? JSON.parse(existingOrders) : [];
      orders.push(newOrder);
      await AsyncStorage.setItem('orders', JSON.stringify(orders));

      console.log('Order saved locally:', newOrder);

      // Navigate to success page
      router.push({
        pathname: '/order-success',
        params: {
          orderId: orderId,
          total: finalTotal,
          paymentMethod: paymentMethodName,
          items: productName,
        },
      });
    } catch (error: any) {
      console.error('Error placing order:', error);
      let errorMessage = 'Failed to place order. Please try again.';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message === 'Network Error') {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Request timed out. The server may be starting up, please try again in a moment.';
      } else if (error.response?.status === 401) {
        errorMessage = 'Please login to place an order.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      Alert.alert('Order Failed', errorMessage);
    }
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
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={COLORS.dark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Checkout</Text>
          <View style={{ width: 24 }} />
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
        <TouchableOpacity style={styles.placeOrderButton} onPress={handlePlaceOrder}>
          <Text style={styles.placeOrderButtonText}>Place Order</Text>
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
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.dark,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.dark,
    marginBottom: SPACING.md,
  },
  sectionHeaderWithButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  editButton: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },
  orderCard: {
    backgroundColor: COLORS.lightGray,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  orderItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  productNameCheckout: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.dark,
    flex: 1,
  },
  quantityBadge: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  orderItemDetails: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.md,
    marginBottom: SPACING.md,
  },
  orderDetailLabel: {
    fontSize: 12,
    color: COLORS.mediumGray,
    marginBottom: SPACING.sm,
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
  placeOrderButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
});
