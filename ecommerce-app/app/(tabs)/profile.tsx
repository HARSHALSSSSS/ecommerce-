import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  FlatList,
  Modal,
  TextInput,
  Dimensions,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS } from '@/src/constants/colors';
import { RESPONSIVE_FONT, RESPONSIVE_SPACING, RESPONSIVE_DIMENSION, getScreenPadding } from '@/src/constants/responsive';
import { useAuth } from '@/src/context/AuthContext';
import { ordersAPI, shipmentsAPI, returnsAPI, refundsAPI, replacementsAPI } from '@/src/services/api';

const { width } = Dimensions.get('window');
const SCREEN_PADDING = getScreenPadding();

interface UserProfile {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
}

interface OrderItem {
  product_id: number;
  product_name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: number;
  created_at: string;
  status: string;
  total_amount: number;
  items: OrderItem[];
  delivery_address: string;
  city: string;
  payment_method: string;
  notes?: string;
  timeline?: OrderEvent[];
}

interface OrderEvent {
  id: number;
  event_type: string;
  previous_status: string | null;
  new_status: string | null;
  notes: string | null;
  created_at: string;
}

interface ShipmentTracking {
  id: number;
  order_id: number;
  courier_name: string;
  tracking_number: string;
  status: string;
  tracking_url?: string;
  estimated_delivery?: string;
  actual_delivery?: string;
  events?: ShipmentEvent[];
}

interface ShipmentEvent {
  id: number;
  event_type: string;
  location?: string;
  description?: string;
  created_at: string;
}

interface ReturnRequest {
  id: number;
  status: string;
  reason: string;
  requested_action: string;
  created_at: string;
}

interface Refund {
  id: number;
  amount: number;
  status: string;
  payment_mode: string;
  created_at: string;
}

// Order status configuration
const ORDER_STATUS_CONFIG: Record<string, { color: string; bgColor: string; icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  pending: { color: '#F59E0B', bgColor: '#FEF3C7', icon: 'time-outline', label: 'Pending' },
  confirmed: { color: '#3B82F6', bgColor: '#DBEAFE', icon: 'checkmark-circle-outline', label: 'Confirmed' },
  processing: { color: '#8B5CF6', bgColor: '#EDE9FE', icon: 'construct-outline', label: 'Processing' },
  ready_for_shipping: { color: '#06B6D4', bgColor: '#CFFAFE', icon: 'cube-outline', label: 'Ready to Ship' },
  shipped: { color: '#0EA5E9', bgColor: '#E0F2FE', icon: 'airplane-outline', label: 'Shipped' },
  out_for_delivery: { color: '#22C55E', bgColor: '#DCFCE7', icon: 'car-outline', label: 'Out for Delivery' },
  delivered: { color: '#10B981', bgColor: '#D1FAE5', icon: 'checkmark-done-circle', label: 'Delivered' },
  cancelled: { color: '#EF4444', bgColor: '#FEE2E2', icon: 'close-circle-outline', label: 'Cancelled' },
  returned: { color: '#6B7280', bgColor: '#F3F4F6', icon: 'return-down-back-outline', label: 'Returned' },
  refund_requested: { color: '#F97316', bgColor: '#FFEDD5', icon: 'wallet-outline', label: 'Refund Requested' },
  refund_approved: { color: '#14B8A6', bgColor: '#CCFBF1', icon: 'checkmark-outline', label: 'Refund Approved' },
  refunded: { color: '#059669', bgColor: '#A7F3D0', icon: 'card-outline', label: 'Refunded' },
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout, updateUser, isAuthenticated } = useAuth();
  
  const [profile, setProfile] = useState<UserProfile>({
    name: user?.name || 'Guest',
    email: user?.email || 'guest@example.com',
    phone: user?.phone || '+62 812 3456 7890',
    address: user?.address || '123 Fashion Street',
    city: user?.city || 'Jakarta, Indonesia',
  });
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'orders'>('profile');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState<UserProfile>(profile);
  const [loggingOut, setLoggingOut] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderDetail, setShowOrderDetail] = useState(false);
  const [orderShipment, setOrderShipment] = useState<ShipmentTracking | null>(null);
  const [orderReturns, setOrderReturns] = useState<ReturnRequest[]>([]);
  const [orderRefunds, setOrderRefunds] = useState<Refund[]>([]);
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);

  // Sync profile with user from auth context
  useEffect(() => {
    if (user) {
      const updatedProfile = {
        name: user.name || 'Guest',
        email: user.email || 'guest@example.com',
        phone: user.phone || '+62 812 3456 7890',
        address: user.address || '123 Fashion Street',
        city: user.city || 'Jakarta, Indonesia',
      };
      setProfile(updatedProfile);
      setEditData(updatedProfile);
    }
  }, [user]);

  const loadProfile = async () => {
    // Profile is now loaded from AuthContext
    // This function is kept for compatibility
  };

  const loadOrders = useCallback(async (isRefresh = false) => {
    if (!isAuthenticated) {
      setOrders([]);
      return;
    }
    
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      const response = await ordersAPI.getAll();
      if (response.success && response.orders) {
        setOrders(response.orders);
      } else {
        setOrders([]);
      }
    } catch (error) {
      console.error('Error loading orders:', error);
      // Fallback to AsyncStorage for offline/error cases
      try {
        const ordersData = await AsyncStorage.getItem('orders');
        if (ordersData) {
          setOrders(JSON.parse(ordersData));
        }
      } catch {
        setOrders([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  const onRefresh = useCallback(() => {
    loadOrders(true);
  }, [loadOrders]);

  useEffect(() => {
    loadProfile();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [loadOrders])
  );

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Logout', 
        style: 'destructive',
        onPress: async () => {
          try {
            setLoggingOut(true);
            await logout();
            // Navigation is handled by AuthContext/RootLayoutNav
          } catch (error) {
            console.error('Logout error:', error);
            Alert.alert('Error', 'Failed to logout. Please try again.');
          } finally {
            setLoggingOut(false);
          }
        } 
      },
    ]);
  };

  const handleEditProfile = () => {
    setEditData(profile);
    setShowEditModal(true);
  };

  const handleSaveProfile = async () => {
    if (!editData.name.trim() || !editData.email.trim()) {
      Alert.alert('Error', 'Name and email are required');
      return;
    }
    try {
      // Update in auth context (also saves to AsyncStorage)
      if (updateUser) {
        await updateUser({
          name: editData.name,
          email: editData.email,
          phone: editData.phone,
          address: editData.address,
          city: editData.city,
        });
      }
      setProfile(editData);
      setShowEditModal(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
      console.error(error);
    }
  };

  const handleCancelOrder = async (order: Order) => {
    if (!['pending', 'confirmed'].includes(order.status)) {
      Alert.alert('Cannot Cancel', 'This order cannot be cancelled at this stage.');
      return;
    }
    
    Alert.alert(
      'Cancel Order',
      'Are you sure you want to cancel this order?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await ordersAPI.cancel(order.id, 'Customer requested cancellation');
              if (response.success) {
                Alert.alert('Success', 'Order cancelled successfully');
                loadOrders();
                setShowOrderDetail(false);
              } else {
                Alert.alert('Error', response.message || 'Failed to cancel order');
              }
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.message || 'Failed to cancel order');
            }
          },
        },
      ]
    );
  };

  const handleRequestRefund = (order: Order) => {
    if (order.status !== 'delivered') {
      Alert.alert('Cannot Request Refund', 'Refunds can only be requested for delivered orders.');
      return;
    }
    
    Alert.prompt(
      'Request Refund',
      'Please provide a reason for your refund request:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async (reason) => {
            if (!reason?.trim()) {
              Alert.alert('Error', 'Please provide a reason for your refund request.');
              return;
            }
            try {
              const response = await ordersAPI.requestRefund(order.id, reason);
              if (response.success) {
                Alert.alert('Success', 'Refund request submitted successfully');
                loadOrders();
                setShowOrderDetail(false);
              } else {
                Alert.alert('Error', response.message || 'Failed to submit refund request');
              }
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.message || 'Failed to submit refund request');
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const handleViewOrderDetail = async (order: Order) => {
    setLoadingOrderDetails(true);
    setOrderShipment(null);
    setOrderReturns([]);
    setOrderRefunds([]);
    
    try {
      // Fetch order details
      const response = await ordersAPI.getById(order.id);
      if (response.success && response.order) {
        setSelectedOrder(response.order);
      } else {
        setSelectedOrder(order);
      }
      setShowOrderDetail(true);
      
      // Fetch additional order info in parallel
      const [shipmentRes, returnsRes, refundsRes] = await Promise.allSettled([
        shipmentsAPI.getTracking(order.id),
        returnsAPI.getMyReturns(),
        refundsAPI.getByOrder(order.id),
      ]);
      
      // Set shipment tracking if available
      if (shipmentRes.status === 'fulfilled' && shipmentRes.value.success && shipmentRes.value.shipment) {
        setOrderShipment(shipmentRes.value.shipment);
      }
      
      // Filter returns for this order
      if (returnsRes.status === 'fulfilled' && returnsRes.value.success && returnsRes.value.returns) {
        const orderReturns = returnsRes.value.returns.filter((r: any) => r.order_id === order.id);
        setOrderReturns(orderReturns);
      }
      
      // Set refunds for this order
      if (refundsRes.status === 'fulfilled' && refundsRes.value.success && refundsRes.value.refund) {
        setOrderRefunds([refundsRes.value.refund]);
      } else if (refundsRes.status === 'fulfilled' && refundsRes.value.success && refundsRes.value.refunds) {
        setOrderRefunds(refundsRes.value.refunds);
      }
    } catch (error) {
      console.error('Error fetching order detail:', error);
      setSelectedOrder(order);
      setShowOrderDetail(true);
    } finally {
      setLoadingOrderDetails(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusConfig = (status: string) => {
    return ORDER_STATUS_CONFIG[status] || ORDER_STATUS_CONFIG.pending;
  };

  const renderOrderCard = ({ item }: { item: Order }) => {
    const statusConfig = getStatusConfig(item.status);
    const totalItems = item.items?.reduce((sum, i) => sum + i.quantity, 0) || 0;
    const firstProduct = item.items?.[0]?.product_name || 'Unknown Product';
    const itemCount = item.items?.length || 0;
    
    return (
      <TouchableOpacity 
        style={styles.orderCard}
        onPress={() => handleViewOrderDetail(item)}
        activeOpacity={0.7}
      >
        <View style={styles.orderHeader}>
          <View>
            <Text style={styles.orderId}>Order #{item.id}</Text>
            <Text style={styles.orderDate}>{formatDate(item.created_at)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
            <Ionicons name={statusConfig.icon} size={14} color={statusConfig.color} />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
        </View>

        <View style={styles.orderDivider} />

        <View style={styles.orderContent}>
          <View style={styles.productInfo}>
            <Text style={styles.productName} numberOfLines={2}>
              {firstProduct}
              {itemCount > 1 && ` +${itemCount - 1} more`}
            </Text>
            <Text style={styles.productQty}>{totalItems} item{totalItems !== 1 ? 's' : ''}</Text>
          </View>
          <Text style={styles.orderTotal}>${Number(item.total_amount).toFixed(2)}</Text>
        </View>

        <View style={styles.orderDivider} />

        <View style={styles.orderActions}>
          <TouchableOpacity 
            style={styles.trackButton}
            onPress={() => handleViewOrderDetail(item)}
          >
            <Ionicons name="eye-outline" size={14} color={COLORS.primary} />
            <Text style={styles.trackButtonText}>View Details</Text>
          </TouchableOpacity>
          
          {['pending', 'confirmed'].includes(item.status) && (
            <TouchableOpacity 
              style={[styles.trackButton, { marginLeft: SPACING.sm }]}
              onPress={() => handleCancelOrder(item)}
            >
              <Ionicons name="close-circle-outline" size={14} color="#EF4444" />
              <Text style={[styles.trackButtonText, { color: '#EF4444' }]}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const EmptyOrdersState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyCircle}>
        <Ionicons name="bag-outline" size={48} color={COLORS.mediumGray} />
      </View>
      <Text style={styles.emptyTitle}>No Orders Yet</Text>
      <Text style={styles.emptySubtitle}>Start shopping and your orders will appear here</Text>
      <TouchableOpacity style={styles.emptyButton}>
        <Text style={styles.emptyButtonText}>Start Shopping</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={[styles.containerScroll, { paddingTop: insets.top }]} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.profileContainer}>
            <View style={styles.profileImage}>
              <Text style={styles.profileInitial}>{profile.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{profile.name}</Text>
              <Text style={styles.profileEmail}>{profile.email}</Text>
              {!isAuthenticated && (
                <Text style={styles.guestBadge}>Guest Account</Text>
              )}
            </View>
            <TouchableOpacity onPress={handleEditProfile} style={styles.editButton}>
              <Ionicons name="create-outline" size={24} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'profile' && styles.activeTab]}
            onPress={() => setActiveTab('profile')}
          >
            <Ionicons name="person-outline" size={20} color={activeTab === 'profile' ? COLORS.primary : COLORS.mediumGray} />
            <Text style={[styles.tabText, activeTab === 'profile' && styles.activeTabText]}>Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'orders' && styles.activeTab]}
            onPress={() => setActiveTab('orders')}
          >
            <Ionicons name="receipt-outline" size={20} color={activeTab === 'orders' ? COLORS.primary : COLORS.mediumGray} />
            <Text style={[styles.tabText, activeTab === 'orders' && styles.activeTabText]}>
              Orders ({orders.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Profile Tab Content */}
        {activeTab === 'profile' && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Account Information</Text>

              <View style={styles.infoItem}>
                <Ionicons name="person-outline" size={20} color={COLORS.primary} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Full Name</Text>
                  <Text style={styles.infoValue}>{profile.name}</Text>
                </View>
              </View>

              <View style={styles.infoItem}>
                <Ionicons name="mail-outline" size={20} color={COLORS.primary} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Email</Text>
                  <Text style={styles.infoValue}>{profile.email}</Text>
                </View>
              </View>

              <View style={styles.infoItem}>
                <Ionicons name="call-outline" size={20} color={COLORS.primary} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Phone</Text>
                  <Text style={styles.infoValue}>{profile.phone}</Text>
                </View>
              </View>

              <View style={styles.infoItem}>
                <Ionicons name="location-outline" size={20} color={COLORS.primary} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Address</Text>
                  <Text style={styles.infoValue}>{profile.address}</Text>
                </View>
              </View>

              <View style={styles.infoItem}>
                <Ionicons name="home-outline" size={20} color={COLORS.primary} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>City</Text>
                  <Text style={styles.infoValue}>{profile.city}</Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Settings</Text>
              <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/payments' as any)}>
                <Ionicons name="card-outline" size={20} color={COLORS.dark} />
                <Text style={styles.menuText}>Payments & Invoices</Text>
                <Ionicons name="chevron-forward" size={20} color={COLORS.mediumGray} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/notifications' as any)}>
                <Ionicons name="notifications-outline" size={20} color={COLORS.dark} />
                <Text style={styles.menuText}>Notifications</Text>
                <Ionicons name="chevron-forward" size={20} color={COLORS.mediumGray} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/marketing-preferences' as any)}>
                <Ionicons name="megaphone-outline" size={20} color={COLORS.dark} />
                <Text style={styles.menuText}>Marketing Preferences</Text>
                <Ionicons name="chevron-forward" size={20} color={COLORS.mediumGray} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem}>
                <Ionicons name="lock-closed-outline" size={20} color={COLORS.dark} />
                <Text style={styles.menuText}>Privacy & Security</Text>
                <Ionicons name="chevron-forward" size={20} color={COLORS.mediumGray} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/support')}>
                <Ionicons name="chatbubbles-outline" size={20} color={COLORS.dark} />
                <Text style={styles.menuText}>Support Tickets</Text>
                <Ionicons name="chevron-forward" size={20} color={COLORS.mediumGray} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem}>
                <Ionicons name="help-circle-outline" size={20} color={COLORS.dark} />
                <Text style={styles.menuText}>Help & FAQ</Text>
                <Ionicons name="chevron-forward" size={20} color={COLORS.mediumGray} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.menuItem, styles.logoutButton]} 
                onPress={handleLogout}
                disabled={loggingOut}
              >
                {loggingOut ? (
                  <ActivityIndicator size="small" color="#E74C3C" />
                ) : (
                  <Ionicons name="log-out-outline" size={20} color="#E74C3C" />
                )}
                <Text style={[styles.menuText, { color: '#E74C3C' }]}>
                  {loggingOut ? 'Logging out...' : 'Logout'}
                </Text>
                {!loggingOut && <Ionicons name="chevron-forward" size={20} color="#E74C3C" />}
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Orders Tab Content */}
        {activeTab === 'orders' && (
          <View style={styles.ordersSection}>
            {!isAuthenticated ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyCircle}>
                  <Ionicons name="lock-closed-outline" size={48} color={COLORS.mediumGray} />
                </View>
                <Text style={styles.emptyTitle}>Login Required</Text>
                <Text style={styles.emptySubtitle}>Please login to view your orders</Text>
                <TouchableOpacity 
                  style={styles.emptyButton}
                  onPress={() => router.push('/login')}
                >
                  <Text style={styles.emptyButtonText}>Login</Text>
                </TouchableOpacity>
              </View>
            ) : loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Loading your orders...</Text>
              </View>
            ) : orders.length === 0 ? (
              <EmptyOrdersState />
            ) : (
              <>
                <View style={styles.ordersHeader}>
                  <Text style={styles.ordersTitle}>Your Orders ({orders.length})</Text>
                  <TouchableOpacity onPress={() => loadOrders(true)}>
                    <Ionicons name="refresh-outline" size={20} color={COLORS.primary} />
                  </TouchableOpacity>
                </View>

                <FlatList
                  data={orders}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={renderOrderCard}
                  scrollEnabled={false}
                  ItemSeparatorComponent={() => <View style={{ height: SPACING.md }} />}
                  refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
                  }
                />
              </>
            )}
          </View>
        )}

        <View style={{ height: SPACING.xl }} />
      </ScrollView>

      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.dark} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Full Name</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Enter your full name"
                  placeholderTextColor={COLORS.mediumGray}
                  value={editData.name}
                  onChangeText={(text) => setEditData({ ...editData, name: text })}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Email Address</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Enter your email"
                  placeholderTextColor={COLORS.mediumGray}
                  value={editData.email}
                  onChangeText={(text) => setEditData({ ...editData, email: text })}
                  keyboardType="email-address"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Phone Number</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Enter your phone number"
                  placeholderTextColor={COLORS.mediumGray}
                  value={editData.phone}
                  onChangeText={(text) => setEditData({ ...editData, phone: text })}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Street Address</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Enter your street address"
                  placeholderTextColor={COLORS.mediumGray}
                  value={editData.address}
                  onChangeText={(text) => setEditData({ ...editData, address: text })}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>City</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Enter your city"
                  placeholderTextColor={COLORS.mediumGray}
                  value={editData.city}
                  onChangeText={(text) => setEditData({ ...editData, city: text })}
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowEditModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleSaveProfile}
              >
                <Text style={styles.confirmButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Order Detail Modal */}
      <Modal
        visible={showOrderDetail}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowOrderDetail(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Order #{selectedOrder?.id}
              </Text>
              <TouchableOpacity onPress={() => setShowOrderDetail(false)}>
                <Ionicons name="close" size={24} color={COLORS.dark} />
              </TouchableOpacity>
            </View>

            {selectedOrder && (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {/* Order Status */}
                <View style={styles.orderDetailSection}>
                  <Text style={styles.orderDetailSectionTitle}>Status</Text>
                  <View style={[
                    styles.statusBadge, 
                    { 
                      backgroundColor: getStatusConfig(selectedOrder.status).bgColor,
                      alignSelf: 'flex-start',
                      paddingHorizontal: SPACING.md,
                      paddingVertical: SPACING.sm,
                    }
                  ]}>
                    <Ionicons 
                      name={getStatusConfig(selectedOrder.status).icon} 
                      size={18} 
                      color={getStatusConfig(selectedOrder.status).color} 
                    />
                    <Text style={[
                      styles.statusText, 
                      { color: getStatusConfig(selectedOrder.status).color, fontSize: 14 }
                    ]}>
                      {getStatusConfig(selectedOrder.status).label}
                    </Text>
                  </View>
                </View>

                {/* Order Items */}
                <View style={styles.orderDetailSection}>
                  <Text style={styles.orderDetailSectionTitle}>Items</Text>
                  {selectedOrder.items?.map((item, index) => (
                    <View key={index} style={styles.orderItemRow}>
                      <View style={styles.orderItemInfo}>
                        <Text style={styles.orderItemName}>{item.product_name}</Text>
                        <Text style={styles.orderItemQty}>Qty: {item.quantity}</Text>
                      </View>
                      <Text style={styles.orderItemPrice}>
                        ${(item.price * item.quantity).toFixed(2)}
                      </Text>
                    </View>
                  ))}
                  <View style={[styles.orderItemRow, { borderTopWidth: 1, borderTopColor: '#ECECEC', paddingTop: SPACING.sm, marginTop: SPACING.sm }]}>
                    <Text style={styles.orderTotalLabel}>Total</Text>
                    <Text style={styles.orderTotalValue}>
                      ${Number(selectedOrder.total_amount).toFixed(2)}
                    </Text>
                  </View>
                </View>

                {/* Delivery Info */}
                <View style={styles.orderDetailSection}>
                  <Text style={styles.orderDetailSectionTitle}>Delivery Address</Text>
                  <Text style={styles.orderDetailText}>{selectedOrder.delivery_address}</Text>
                  <Text style={styles.orderDetailText}>{selectedOrder.city}</Text>
                </View>

                {/* Payment Info */}
                <View style={styles.orderDetailSection}>
                  <Text style={styles.orderDetailSectionTitle}>Payment Method</Text>
                  <Text style={styles.orderDetailText}>{selectedOrder.payment_method}</Text>
                </View>

                {/* Order Date */}
                <View style={styles.orderDetailSection}>
                  <Text style={styles.orderDetailSectionTitle}>Order Date</Text>
                  <Text style={styles.orderDetailText}>{formatDate(selectedOrder.created_at)}</Text>
                </View>

                {/* Order Timeline */}
                {selectedOrder.timeline && selectedOrder.timeline.length > 0 && (
                  <View style={styles.orderDetailSection}>
                    <Text style={styles.orderDetailSectionTitle}>Order Timeline</Text>
                    {selectedOrder.timeline.map((event, index) => (
                      <View key={event.id} style={styles.timelineItem}>
                        <View style={styles.timelineDot}>
                          <View style={[
                            styles.timelineDotInner,
                            { backgroundColor: index === 0 ? COLORS.primary : COLORS.mediumGray }
                          ]} />
                        </View>
                        {index < selectedOrder.timeline!.length - 1 && (
                          <View style={styles.timelineLine} />
                        )}
                        <View style={styles.timelineContent}>
                          <Text style={styles.timelineEvent}>
                            {event.event_type === 'status_change' 
                              ? `Status changed to ${getStatusConfig(event.new_status || '').label}`
                              : event.event_type
                            }
                          </Text>
                          {event.notes && (
                            <Text style={styles.timelineNotes}>{event.notes}</Text>
                          )}
                          <Text style={styles.timelineDate}>{formatDate(event.created_at)}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Notes */}
                {selectedOrder.notes && (
                  <View style={styles.orderDetailSection}>
                    <Text style={styles.orderDetailSectionTitle}>Notes</Text>
                    <Text style={styles.orderDetailText}>{selectedOrder.notes}</Text>
                  </View>
                )}

                {/* Shipment Tracking */}
                {orderShipment && (
                  <View style={styles.orderDetailSection}>
                    <Text style={styles.orderDetailSectionTitle}>
                      <Ionicons name="airplane-outline" size={16} color={COLORS.dark} /> Shipment Tracking
                    </Text>
                    <View style={styles.trackingCard}>
                      <View style={styles.trackingRow}>
                        <Text style={styles.trackingLabel}>Courier</Text>
                        <Text style={styles.trackingValue}>{orderShipment.courier_name}</Text>
                      </View>
                      <View style={styles.trackingRow}>
                        <Text style={styles.trackingLabel}>Tracking #</Text>
                        <Text style={[styles.trackingValue, { fontFamily: 'monospace' }]}>
                          {orderShipment.tracking_number}
                        </Text>
                      </View>
                      <View style={styles.trackingRow}>
                        <Text style={styles.trackingLabel}>Status</Text>
                        <View style={[styles.statusBadge, { backgroundColor: '#E0F2FE', paddingHorizontal: 8, paddingVertical: 4 }]}>
                          <Text style={[styles.statusText, { color: '#0EA5E9', fontSize: 12 }]}>
                            {orderShipment.status.replace(/_/g, ' ').toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      {orderShipment.estimated_delivery && (
                        <View style={styles.trackingRow}>
                          <Text style={styles.trackingLabel}>Est. Delivery</Text>
                          <Text style={styles.trackingValue}>{formatDate(orderShipment.estimated_delivery)}</Text>
                        </View>
                      )}
                      {orderShipment.actual_delivery && (
                        <View style={styles.trackingRow}>
                          <Text style={styles.trackingLabel}>Delivered</Text>
                          <Text style={[styles.trackingValue, { color: '#10B981' }]}>{formatDate(orderShipment.actual_delivery)}</Text>
                        </View>
                      )}
                    </View>
                    
                    {/* Shipment Events Timeline */}
                    {orderShipment.events && orderShipment.events.length > 0 && (
                      <View style={{ marginTop: SPACING.md }}>
                        {orderShipment.events.map((event, index) => (
                          <View key={event.id} style={styles.timelineItem}>
                            <View style={styles.timelineDot}>
                              <View style={[
                                styles.timelineDotInner,
                                { backgroundColor: index === 0 ? '#0EA5E9' : COLORS.mediumGray }
                              ]} />
                            </View>
                            {index < orderShipment.events!.length - 1 && (
                              <View style={styles.timelineLine} />
                            )}
                            <View style={styles.timelineContent}>
                              <Text style={styles.timelineEvent}>{event.event_type.replace(/_/g, ' ')}</Text>
                              {event.location && (
                                <Text style={styles.timelineNotes}>{event.location}</Text>
                              )}
                              {event.description && (
                                <Text style={styles.timelineNotes}>{event.description}</Text>
                              )}
                              <Text style={styles.timelineDate}>{formatDate(event.created_at)}</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}

                {/* Return Requests */}
                {orderReturns.length > 0 && (
                  <View style={styles.orderDetailSection}>
                    <Text style={styles.orderDetailSectionTitle}>
                      <Ionicons name="return-down-back-outline" size={16} color={COLORS.dark} /> Return Requests
                    </Text>
                    {orderReturns.map((returnReq, index) => (
                      <View key={returnReq.id} style={[styles.trackingCard, { marginBottom: index < orderReturns.length - 1 ? SPACING.sm : 0 }]}>
                        <View style={styles.trackingRow}>
                          <Text style={styles.trackingLabel}>Return #{returnReq.id}</Text>
                          <View style={[styles.statusBadge, { 
                            backgroundColor: returnReq.status === 'completed' ? '#D1FAE5' : 
                              returnReq.status === 'rejected' ? '#FEE2E2' : '#FEF3C7',
                            paddingHorizontal: 8, paddingVertical: 4 
                          }]}>
                            <Text style={[styles.statusText, { 
                              color: returnReq.status === 'completed' ? '#10B981' : 
                                returnReq.status === 'rejected' ? '#EF4444' : '#F59E0B', 
                              fontSize: 12 
                            }]}>
                              {returnReq.status.replace(/_/g, ' ').toUpperCase()}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.trackingRow}>
                          <Text style={styles.trackingLabel}>Reason</Text>
                          <Text style={styles.trackingValue}>{returnReq.reason.replace(/_/g, ' ')}</Text>
                        </View>
                        <View style={styles.trackingRow}>
                          <Text style={styles.trackingLabel}>Action</Text>
                          <Text style={styles.trackingValue}>{returnReq.requested_action}</Text>
                        </View>
                        <View style={styles.trackingRow}>
                          <Text style={styles.trackingLabel}>Submitted</Text>
                          <Text style={styles.trackingValue}>{formatDate(returnReq.created_at)}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Refunds */}
                {orderRefunds.length > 0 && (
                  <View style={styles.orderDetailSection}>
                    <Text style={styles.orderDetailSectionTitle}>
                      <Ionicons name="wallet-outline" size={16} color={COLORS.dark} /> Refunds
                    </Text>
                    {orderRefunds.map((refund, index) => (
                      <View key={refund.id} style={[styles.trackingCard, { marginBottom: index < orderRefunds.length - 1 ? SPACING.sm : 0 }]}>
                        <View style={styles.trackingRow}>
                          <Text style={styles.trackingLabel}>Refund #{refund.id}</Text>
                          <View style={[styles.statusBadge, { 
                            backgroundColor: refund.status === 'completed' ? '#D1FAE5' : 
                              refund.status === 'failed' ? '#FEE2E2' : '#DBEAFE',
                            paddingHorizontal: 8, paddingVertical: 4 
                          }]}>
                            <Text style={[styles.statusText, { 
                              color: refund.status === 'completed' ? '#10B981' : 
                                refund.status === 'failed' ? '#EF4444' : '#3B82F6', 
                              fontSize: 12 
                            }]}>
                              {refund.status.replace(/_/g, ' ').toUpperCase()}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.trackingRow}>
                          <Text style={styles.trackingLabel}>Amount</Text>
                          <Text style={[styles.trackingValue, { color: '#10B981', fontWeight: '600' }]}>
                            ${Number(refund.amount).toFixed(2)}
                          </Text>
                        </View>
                        <View style={styles.trackingRow}>
                          <Text style={styles.trackingLabel}>Payment Mode</Text>
                          <Text style={styles.trackingValue}>{refund.payment_mode.replace(/_/g, ' ')}</Text>
                        </View>
                        <View style={styles.trackingRow}>
                          <Text style={styles.trackingLabel}>Initiated</Text>
                          <Text style={styles.trackingValue}>{formatDate(refund.created_at)}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
            )}

            <View style={styles.modalFooter}>
              {selectedOrder && ['pending', 'confirmed'].includes(selectedOrder.status) && (
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: '#FEE2E2', flex: 1, marginRight: SPACING.sm }]}
                  onPress={() => handleCancelOrder(selectedOrder)}
                >
                  <Text style={[styles.cancelButtonText, { color: '#EF4444' }]}>Cancel Order</Text>
                </TouchableOpacity>
              )}
              {selectedOrder?.status === 'delivered' && (
                <>
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: '#EDE9FE', flex: 1, marginRight: SPACING.sm }]}
                    onPress={() => {
                      setShowOrderDetail(false);
                      router.push({
                        pathname: '/return-request',
                        params: { orderId: selectedOrder.id.toString() }
                      });
                    }}
                  >
                    <Text style={[styles.cancelButtonText, { color: '#8B5CF6' }]}>Request Return</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: '#FEF3C7', flex: 1, marginRight: SPACING.sm }]}
                    onPress={() => handleRequestRefund(selectedOrder)}
                  >
                    <Text style={[styles.cancelButtonText, { color: '#F59E0B' }]}>Request Refund</Text>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton, { flex: 1 }]}
                onPress={() => setShowOrderDetail(false)}
              >
                <Text style={styles.confirmButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
    flex: 1,
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.lg,
  },
  header: {
    marginBottom: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  profileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F0',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
  },
  profileImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.lg,
  },
  profileInitial: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.dark,
    marginBottom: SPACING.xs,
  },
  profileEmail: {
    fontSize: 12,
    color: COLORS.mediumGray,
  },
  guestBadge: {
    fontSize: 10,
    color: COLORS.white,
    backgroundColor: COLORS.mediumGray,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 4,
    alignSelf: 'flex-start',
    overflow: 'hidden',
  },
  editButton: {
    padding: SPACING.md,
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#ECECEC',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    gap: SPACING.sm,
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.mediumGray,
  },
  activeTabText: {
    color: COLORS.primary,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.dark,
    marginBottom: SPACING.lg,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.lg,
    backgroundColor: '#FFF5F0',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
  },
  infoContent: {
    flex: 1,
    marginLeft: SPACING.lg,
  },
  infoLabel: {
    fontSize: 12,
    color: COLORS.mediumGray,
    marginBottom: SPACING.xs,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.dark,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    backgroundColor: '#ECECEC',
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
  },
  menuText: {
    flex: 1,
    marginLeft: SPACING.lg,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.dark,
  },
  logoutButton: {
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
  },
  ordersSection: {
    marginBottom: SPACING.lg,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl,
  },
  loadingText: {
    marginTop: SPACING.lg,
    fontSize: 14,
    color: COLORS.mediumGray,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#ECECEC',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.dark,
    marginBottom: SPACING.sm,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.mediumGray,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  emptyButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
  },
  emptyButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 14,
  },
  ordersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  ordersTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.dark,
  },
  orderCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: '#ECECEC',
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderId: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.dark,
    marginBottom: SPACING.xs,
  },
  orderDate: {
    fontSize: 12,
    color: COLORS.mediumGray,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.xs,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  orderDivider: {
    height: 1,
    backgroundColor: '#ECECEC',
    marginVertical: SPACING.lg,
  },
  orderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.dark,
    marginBottom: SPACING.xs,
  },
  productQty: {
    fontSize: 12,
    color: COLORS.mediumGray,
  },
  orderTotal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  trackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF5F0',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
  },
  trackButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    maxHeight: '90%',
    paddingBottom: SPACING.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.dark,
  },
  modalBody: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  formGroup: {
    marginBottom: SPACING.lg,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.dark,
    marginBottom: SPACING.sm,
  },
  formInput: {
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: 14,
    color: COLORS.dark,
    backgroundColor: COLORS.lightGray,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  modalButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
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
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.dark,
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.white,
  },
  orderActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderDetailSection: {
    marginBottom: SPACING.lg,
    paddingBottom: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#ECECEC',
  },
  orderDetailSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.dark,
    marginBottom: SPACING.md,
  },
  orderDetailText: {
    fontSize: 14,
    color: COLORS.mediumGray,
    lineHeight: 20,
  },
  orderItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  orderItemInfo: {
    flex: 1,
  },
  orderItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.dark,
  },
  orderItemQty: {
    fontSize: 12,
    color: COLORS.mediumGray,
    marginTop: 2,
  },
  orderItemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.dark,
  },
  orderTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.dark,
  },
  orderTotalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
    position: 'relative',
  },
  timelineDot: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  timelineDotInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
  },
  timelineLine: {
    position: 'absolute',
    left: 11,
    top: 24,
    bottom: -SPACING.md,
    width: 2,
    backgroundColor: '#ECECEC',
  },
  timelineContent: {
    flex: 1,
  },
  timelineEvent: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.dark,
    marginBottom: 2,
  },
  timelineNotes: {
    fontSize: 12,
    color: COLORS.mediumGray,
    fontStyle: 'italic',
    marginBottom: 2,
  },
  timelineDate: {
    fontSize: 11,
    color: COLORS.mediumGray,
  },
  trackingCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  trackingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  trackingLabel: {
    fontSize: 12,
    color: COLORS.mediumGray,
    fontWeight: '500',
  },
  trackingValue: {
    fontSize: 13,
    color: COLORS.dark,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
    marginLeft: SPACING.sm,
  },
});
