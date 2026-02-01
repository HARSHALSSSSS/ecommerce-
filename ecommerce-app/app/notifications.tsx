import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { COLORS, SPACING, BORDER_RADIUS } from '@/src/constants/colors';
import { RESPONSIVE_FONT, RESPONSIVE_SPACING } from '@/src/constants/responsive';
import { notificationsAPI } from '../src/services/api';
import { useAuth } from '@/src/context/AuthContext';

interface Notification {
  id: number;
  subject: string;
  message: string;
  channel: 'email' | 'push' | 'sms' | 'in_app';
  notification_type: string;
  read_at: string | null;
  metadata?: any;
  created_at: string;
}

interface NotificationPreferences {
  email_enabled: boolean;
  push_enabled: boolean;
  sms_enabled: boolean;
  in_app_enabled: boolean;
  order_updates: boolean;
  payment_updates: boolean;
  promotional: boolean;
}

const CHANNEL_CONFIG: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; label: string }> = {
  email: { icon: 'mail-outline', color: '#3B82F6', label: 'Email' },
  push: { icon: 'phone-portrait-outline', color: '#8B5CF6', label: 'Push' },
  sms: { icon: 'chatbubble-outline', color: '#10B981', label: 'SMS' },
  in_app: { icon: 'notifications-outline', color: COLORS.primary, label: 'In-App' },
};

const EVENT_CONFIG: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  order_created: { icon: 'bag-check-outline', color: '#3B82F6' },
  order_confirmed: { icon: 'checkmark-circle-outline', color: '#10B981' },
  order_shipped: { icon: 'airplane-outline', color: '#8B5CF6' },
  order_delivered: { icon: 'home-outline', color: '#10B981' },
  order_cancelled: { icon: 'close-circle-outline', color: '#EF4444' },
  payment_received: { icon: 'card-outline', color: '#10B981' },
  payment_failed: { icon: 'alert-circle-outline', color: '#EF4444' },
  refund_processed: { icon: 'refresh-outline', color: '#F59E0B' },
  return_approved: { icon: 'return-up-back-outline', color: '#10B981' },
  ticket_reply: { icon: 'chatbubbles-outline', color: '#3B82F6' },
  promotional: { icon: 'megaphone-outline', color: COLORS.primary },
};

export default function NotificationsScreen() {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    email_enabled: true,
    push_enabled: true,
    sms_enabled: false,
    in_app_enabled: true,
    order_updates: true,
    payment_updates: true,
    promotional: false,
  });
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
      fetchPreferences();
    }
  }, [isAuthenticated]);

  const fetchNotifications = async () => {
    try {
      const [notificationsRes, unreadRes] = await Promise.all([
        notificationsAPI.getList(),
        notificationsAPI.getUnreadCount(),
      ]);
      
      setNotifications(notificationsRes.notifications || []);
      setUnreadCount(unreadRes.unread_count || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchPreferences = async () => {
    try {
      const response = await notificationsAPI.getPreferences();
      if (response.preferences) {
        setPreferences(response.preferences);
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (notification: Notification) => {
    if (notification.read_at) return;
    
    try {
      await notificationsAPI.markAsRead(notification.id);
      setNotifications(prev =>
        prev.map(n => n.id === notification.id ? { ...n, read_at: new Date().toISOString() } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsAPI.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleSavePreferences = async () => {
    setSavingPreferences(true);
    try {
      await notificationsAPI.updatePreferences(preferences);
      setShowSettingsModal(false);
    } catch (error) {
      console.error('Error saving preferences:', error);
    } finally {
      setSavingPreferences(false);
    }
  };

  const handleNotificationPress = (notification: Notification) => {
    handleMarkAsRead(notification);
    setSelectedNotification(notification);
    setShowDetailModal(true);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const formatFullDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getEventConfig = (eventType: string) => {
    return EVENT_CONFIG[eventType] || { icon: 'notifications-outline', color: COLORS.mediumGray };
  };

  const filteredNotifications = notifications.filter(n => {
    if (activeTab === 'unread') return !n.read_at;
    return true;
  });

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.dark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.emptyState}>
          <View style={styles.emptyCircle}>
            <Ionicons name="notifications-off-outline" size={48} color={COLORS.mediumGray} />
          </View>
          <Text style={styles.emptyTitle}>Login Required</Text>
          <Text style={styles.emptyText}>Please login to view your notifications</Text>
          <TouchableOpacity style={styles.loginButton} onPress={() => router.replace('/login')}>
            <Text style={styles.loginButtonText}>Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity onPress={() => setShowSettingsModal(true)} style={styles.settingsButton}>
          <Ionicons name="settings-outline" size={24} color={COLORS.dark} />
        </TouchableOpacity>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{notifications.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: COLORS.primary }]}>{unreadCount}</Text>
          <Text style={styles.statLabel}>Unread</Text>
        </View>
        {unreadCount > 0 && (
          <>
            <View style={styles.statDivider} />
            <TouchableOpacity style={styles.markAllButton} onPress={handleMarkAllAsRead}>
              <Ionicons name="checkmark-done-outline" size={18} color={COLORS.primary} />
              <Text style={styles.markAllText}>Mark All Read</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'all' && styles.activeTab]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>
            All ({notifications.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'unread' && styles.activeTab]}
          onPress={() => setActiveTab('unread')}
        >
          <Text style={[styles.tabText, activeTab === 'unread' && styles.activeTabText]}>
            Unread ({unreadCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Notifications List */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        {filteredNotifications.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyCircle}>
              <Ionicons name="notifications-outline" size={48} color={COLORS.mediumGray} />
            </View>
            <Text style={styles.emptyTitle}>No Notifications</Text>
            <Text style={styles.emptyText}>
              {activeTab === 'unread' 
                ? "You've read all your notifications" 
                : "You don't have any notifications yet"}
            </Text>
          </View>
        ) : (
          filteredNotifications.map((notification) => {
            const eventConfig = getEventConfig(notification.notification_type);
            const channelConfig = CHANNEL_CONFIG[notification.channel] || CHANNEL_CONFIG.in_app;
            
            return (
              <TouchableOpacity
                key={notification.id}
                style={[styles.notificationCard, !notification.read_at && styles.unreadCard]}
                onPress={() => handleNotificationPress(notification)}
              >
                <View style={[styles.iconContainer, { backgroundColor: eventConfig.color + '15' }]}>
                  <Ionicons name={eventConfig.icon} size={24} color={eventConfig.color} />
                </View>
                <View style={styles.notificationContent}>
                  <View style={styles.notificationHeader}>
                    <Text style={styles.notificationTitle} numberOfLines={1}>
                      {notification.subject || 'Notification'}
                    </Text>
                    {!notification.read_at && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={styles.notificationBody} numberOfLines={2}>
                    {notification.message}
                  </Text>
                  <View style={styles.notificationMeta}>
                    <View style={[styles.channelBadge, { backgroundColor: channelConfig.color + '15' }]}>
                      <Ionicons name={channelConfig.icon} size={12} color={channelConfig.color} />
                      <Text style={[styles.channelText, { color: channelConfig.color }]}>
                        {channelConfig.label}
                      </Text>
                    </View>
                    <Text style={styles.notificationTime}>{formatDate(notification.created_at)}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Settings Modal */}
      <Modal visible={showSettingsModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowSettingsModal(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Notification Settings</Text>
            <TouchableOpacity onPress={handleSavePreferences} disabled={savingPreferences}>
              <Text style={[styles.saveText, savingPreferences && styles.disabledText]}>
                {savingPreferences ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.settingsSection}>
              <Text style={styles.settingsSectionTitle}>Notification Channels</Text>
              
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Ionicons name="mail-outline" size={22} color="#3B82F6" />
                  <Text style={styles.settingLabel}>Email Notifications</Text>
                </View>
                <Switch
                  value={preferences.email_enabled}
                  onValueChange={(value) => setPreferences(prev => ({ ...prev, email_enabled: value }))}
                  trackColor={{ false: '#E5E7EB', true: COLORS.primary + '50' }}
                  thumbColor={preferences.email_enabled ? COLORS.primary : '#fff'}
                />
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Ionicons name="phone-portrait-outline" size={22} color="#8B5CF6" />
                  <Text style={styles.settingLabel}>Push Notifications</Text>
                </View>
                <Switch
                  value={preferences.push_enabled}
                  onValueChange={(value) => setPreferences(prev => ({ ...prev, push_enabled: value }))}
                  trackColor={{ false: '#E5E7EB', true: COLORS.primary + '50' }}
                  thumbColor={preferences.push_enabled ? COLORS.primary : '#fff'}
                />
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Ionicons name="chatbubble-outline" size={22} color="#10B981" />
                  <Text style={styles.settingLabel}>SMS Notifications</Text>
                </View>
                <Switch
                  value={preferences.sms_enabled}
                  onValueChange={(value) => setPreferences(prev => ({ ...prev, sms_enabled: value }))}
                  trackColor={{ false: '#E5E7EB', true: COLORS.primary + '50' }}
                  thumbColor={preferences.sms_enabled ? COLORS.primary : '#fff'}
                />
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Ionicons name="notifications-outline" size={22} color={COLORS.primary} />
                  <Text style={styles.settingLabel}>In-App Notifications</Text>
                </View>
                <Switch
                  value={preferences.in_app_enabled}
                  onValueChange={(value) => setPreferences(prev => ({ ...prev, in_app_enabled: value }))}
                  trackColor={{ false: '#E5E7EB', true: COLORS.primary + '50' }}
                  thumbColor={preferences.in_app_enabled ? COLORS.primary : '#fff'}
                />
              </View>
            </View>

            <View style={styles.settingsSection}>
              <Text style={styles.settingsSectionTitle}>Notification Types</Text>
              
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Ionicons name="bag-outline" size={22} color="#3B82F6" />
                  <Text style={styles.settingLabel}>Order Updates</Text>
                </View>
                <Switch
                  value={preferences.order_updates}
                  onValueChange={(value) => setPreferences(prev => ({ ...prev, order_updates: value }))}
                  trackColor={{ false: '#E5E7EB', true: COLORS.primary + '50' }}
                  thumbColor={preferences.order_updates ? COLORS.primary : '#fff'}
                />
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Ionicons name="card-outline" size={22} color="#10B981" />
                  <Text style={styles.settingLabel}>Payment Updates</Text>
                </View>
                <Switch
                  value={preferences.payment_updates}
                  onValueChange={(value) => setPreferences(prev => ({ ...prev, payment_updates: value }))}
                  trackColor={{ false: '#E5E7EB', true: COLORS.primary + '50' }}
                  thumbColor={preferences.payment_updates ? COLORS.primary : '#fff'}
                />
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Ionicons name="megaphone-outline" size={22} color={COLORS.primary} />
                  <Text style={styles.settingLabel}>Promotional Offers</Text>
                </View>
                <Switch
                  value={preferences.promotional}
                  onValueChange={(value) => setPreferences(prev => ({ ...prev, promotional: value }))}
                  trackColor={{ false: '#E5E7EB', true: COLORS.primary + '50' }}
                  thumbColor={preferences.promotional ? COLORS.primary : '#fff'}
                />
              </View>
            </View>

            <Text style={styles.settingsNote}>
              You can always change these settings later. We'll respect your preferences for all future notifications.
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Notification Detail Modal */}
      <Modal visible={showDetailModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowDetailModal(false)}>
              <Ionicons name="close" size={24} color={COLORS.dark} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Notification</Text>
            <View style={{ width: 24 }} />
          </View>

          {selectedNotification && (
            <ScrollView style={styles.modalContent}>
              <View style={styles.detailHeader}>
                <View style={[
                  styles.detailIconContainer, 
                  { backgroundColor: getEventConfig(selectedNotification.notification_type).color + '15' }
                ]}>
                  <Ionicons 
                    name={getEventConfig(selectedNotification.notification_type).icon} 
                    size={32} 
                    color={getEventConfig(selectedNotification.notification_type).color} 
                  />
                </View>
                <Text style={styles.detailTitle}>{selectedNotification.subject || 'Notification'}</Text>
                <Text style={styles.detailTime}>{formatFullDate(selectedNotification.created_at)}</Text>
              </View>

              <View style={styles.detailBody}>
                <Text style={styles.detailBodyText}>{selectedNotification.message}</Text>
              </View>

              <View style={styles.detailMeta}>
                <View style={styles.detailMetaItem}>
                  <Text style={styles.detailMetaLabel}>Channel</Text>
                  <View style={[
                    styles.detailMetaBadge, 
                    { backgroundColor: CHANNEL_CONFIG[selectedNotification.channel]?.color + '15' }
                  ]}>
                    <Ionicons 
                      name={CHANNEL_CONFIG[selectedNotification.channel]?.icon || 'notifications-outline'} 
                      size={16} 
                      color={CHANNEL_CONFIG[selectedNotification.channel]?.color || COLORS.mediumGray} 
                    />
                    <Text style={[
                      styles.detailMetaBadgeText, 
                      { color: CHANNEL_CONFIG[selectedNotification.channel]?.color || COLORS.mediumGray }
                    ]}>
                      {CHANNEL_CONFIG[selectedNotification.channel]?.label || 'Unknown'}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailMetaItem}>
                  <Text style={styles.detailMetaLabel}>Type</Text>
                  <Text style={styles.detailMetaValue}>
                    {(selectedNotification.notification_type || 'general').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Text>
                </View>

                <View style={styles.detailMetaItem}>
                  <Text style={styles.detailMetaLabel}>Status</Text>
                  <Text style={[styles.detailMetaValue, { color: '#10B981' }]}>
                    Read
                  </Text>
                </View>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.gray,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: RESPONSIVE_FONT.base,
    color: COLORS.mediumGray,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    minHeight: 56,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: RESPONSIVE_FONT.lg,
    fontWeight: '700',
    color: COLORS.dark,
    flex: 1,
    textAlign: 'center',
  },
  settingsButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSpacer: {
    width: 44,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  statValue: {
    fontSize: RESPONSIVE_FONT.xl,
    fontWeight: '700',
    color: COLORS.dark,
  },
  statLabel: {
    fontSize: RESPONSIVE_FONT.xs,
    color: COLORS.mediumGray,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: COLORS.border,
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    gap: 4,
  },
  markAllText: {
    fontSize: RESPONSIVE_FONT.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: RESPONSIVE_FONT.base,
    color: COLORS.mediumGray,
    fontWeight: '500',
  },
  activeTabText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  unreadCard: {
    backgroundColor: COLORS.primary + '08',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitle: {
    flex: 1,
    fontSize: RESPONSIVE_FONT.base,
    fontWeight: '600',
    color: COLORS.dark,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginLeft: SPACING.xs,
  },
  notificationBody: {
    fontSize: RESPONSIVE_FONT.sm,
    color: COLORS.gray,
    lineHeight: 20,
    marginBottom: SPACING.xs,
  },
  notificationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  channelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
    gap: 4,
  },
  channelText: {
    fontSize: RESPONSIVE_FONT.xs,
    fontWeight: '500',
  },
  notificationTime: {
    fontSize: RESPONSIVE_FONT.xs,
    color: COLORS.mediumGray,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl * 2,
  },
  emptyCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    fontSize: RESPONSIVE_FONT.lg,
    fontWeight: '700',
    color: COLORS.dark,
    marginBottom: SPACING.xs,
  },
  emptyText: {
    fontSize: RESPONSIVE_FONT.base,
    color: COLORS.mediumGray,
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
  },
  loginButton: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
  },
  loginButtonText: {
    color: COLORS.white,
    fontSize: RESPONSIVE_FONT.base,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.gray,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: RESPONSIVE_FONT.lg,
    fontWeight: '700',
    color: COLORS.dark,
  },
  cancelText: {
    fontSize: RESPONSIVE_FONT.base,
    color: COLORS.mediumGray,
  },
  saveText: {
    fontSize: RESPONSIVE_FONT.base,
    color: COLORS.primary,
    fontWeight: '600',
  },
  disabledText: {
    opacity: 0.5,
  },
  modalContent: {
    flex: 1,
    padding: SPACING.lg,
  },
  settingsSection: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  settingsSectionTitle: {
    fontSize: RESPONSIVE_FONT.base,
    fontWeight: '700',
    color: COLORS.dark,
    marginBottom: SPACING.lg,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  settingLabel: {
    fontSize: RESPONSIVE_FONT.base,
    color: COLORS.dark,
  },
  settingsNote: {
    fontSize: RESPONSIVE_FONT.sm,
    color: COLORS.mediumGray,
    textAlign: 'center',
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
    lineHeight: 20,
  },
  detailHeader: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: SPACING.lg,
  },
  detailIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  detailTitle: {
    fontSize: RESPONSIVE_FONT.lg,
    fontWeight: '700',
    color: COLORS.dark,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  detailTime: {
    fontSize: RESPONSIVE_FONT.sm,
    color: COLORS.mediumGray,
  },
  detailBody: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  detailBodyText: {
    fontSize: RESPONSIVE_FONT.base,
    color: COLORS.gray,
    lineHeight: 24,
  },
  detailMeta: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
  },
  detailMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  detailMetaLabel: {
    fontSize: RESPONSIVE_FONT.sm,
    color: COLORS.mediumGray,
  },
  detailMetaValue: {
    fontSize: RESPONSIVE_FONT.sm,
    fontWeight: '600',
    color: COLORS.dark,
  },
  detailMetaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
    gap: 4,
  },
  detailMetaBadgeText: {
    fontSize: RESPONSIVE_FONT.sm,
    fontWeight: '500',
  },
});
