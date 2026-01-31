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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { COLORS, SPACING, BORDER_RADIUS } from '@/src/constants/colors';
import { RESPONSIVE_FONT, RESPONSIVE_SPACING } from '@/src/constants/responsive';
import { paymentsAPI, invoicesAPI } from '../src/services/api';
import { useAuth } from '@/src/context/AuthContext';

interface Payment {
  id: number;
  transaction_id: string;
  order_id: number;
  amount: number;
  currency: string;
  payment_method: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  gateway_response?: any;
  created_at: string;
}

interface Invoice {
  id: number;
  invoice_number: string;
  order_id: number;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  currency: string;
  status: 'draft' | 'issued' | 'paid' | 'cancelled' | 'void';
  issued_at: string;
  due_date: string;
}

const PAYMENT_STATUS_CONFIG: Record<string, { color: string; bgColor: string; icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  pending: { color: '#F59E0B', bgColor: '#FEF3C7', icon: 'time-outline', label: 'Pending' },
  processing: { color: '#3B82F6', bgColor: '#DBEAFE', icon: 'sync-outline', label: 'Processing' },
  completed: { color: '#10B981', bgColor: '#D1FAE5', icon: 'checkmark-circle-outline', label: 'Completed' },
  failed: { color: '#EF4444', bgColor: '#FEE2E2', icon: 'close-circle-outline', label: 'Failed' },
  refunded: { color: '#8B5CF6', bgColor: '#EDE9FE', icon: 'return-up-back-outline', label: 'Refunded' },
};

const INVOICE_STATUS_CONFIG: Record<string, { color: string; bgColor: string; icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  draft: { color: '#6B7280', bgColor: '#F3F4F6', icon: 'document-outline', label: 'Draft' },
  issued: { color: '#3B82F6', bgColor: '#DBEAFE', icon: 'document-text-outline', label: 'Issued' },
  paid: { color: '#10B981', bgColor: '#D1FAE5', icon: 'checkmark-circle-outline', label: 'Paid' },
  cancelled: { color: '#EF4444', bgColor: '#FEE2E2', icon: 'close-circle-outline', label: 'Cancelled' },
  void: { color: '#6B7280', bgColor: '#F3F4F6', icon: 'ban-outline', label: 'Void' },
};

const PAYMENT_METHOD_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  credit_card: 'card-outline',
  debit_card: 'card-outline',
  bank_transfer: 'business-outline',
  cash_on_delivery: 'cash-outline',
  wallet: 'wallet-outline',
  upi: 'phone-portrait-outline',
  paypal: 'logo-paypal',
};

export default function PaymentsScreen() {
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<'payments' | 'invoices'>('payments');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showPaymentDetail, setShowPaymentDetail] = useState(false);
  const [showInvoiceDetail, setShowInvoiceDetail] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  const fetchData = async () => {
    try {
      const [paymentsRes, invoicesRes] = await Promise.all([
        paymentsAPI.getHistory(),
        invoicesAPI.getList(),
      ]);
      
      setPayments(paymentsRes.payments || []);
      setInvoices(invoicesRes.invoices || []);
    } catch (error) {
      console.error('Error fetching payments data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
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

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const formatPaymentMethod = (method: string) => {
    return method.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getPaymentStatusConfig = (status: string) => {
    return PAYMENT_STATUS_CONFIG[status] || PAYMENT_STATUS_CONFIG.pending;
  };

  const getInvoiceStatusConfig = (status: string) => {
    return INVOICE_STATUS_CONFIG[status] || INVOICE_STATUS_CONFIG.draft;
  };

  const getPaymentMethodIcon = (method: string): keyof typeof Ionicons.glyphMap => {
    return PAYMENT_METHOD_ICONS[method] || 'card-outline';
  };

  const totalPayments = payments.reduce((sum, p) => p.status === 'completed' ? sum + Number(p.amount) : sum, 0);

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.dark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Payments & Invoices</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.emptyState}>
          <View style={styles.emptyCircle}>
            <Ionicons name="card-outline" size={48} color={COLORS.mediumGray} />
          </View>
          <Text style={styles.emptyTitle}>Login Required</Text>
          <Text style={styles.emptyText}>Please login to view your payment history</Text>
          <TouchableOpacity style={styles.loginButton} onPress={() => router.push('/login' as any)}>
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
          <Text style={styles.loadingText}>Loading payment history...</Text>
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
        <Text style={styles.headerTitle}>Payments & Invoices</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Ionicons name="card-outline" size={24} color={COLORS.primary} />
          <View style={styles.statInfo}>
            <Text style={styles.statValue}>{payments.length}</Text>
            <Text style={styles.statLabel}>Payments</Text>
          </View>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="document-text-outline" size={24} color="#3B82F6" />
          <View style={styles.statInfo}>
            <Text style={styles.statValue}>{invoices.length}</Text>
            <Text style={styles.statLabel}>Invoices</Text>
          </View>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="trending-up-outline" size={24} color="#10B981" />
          <View style={styles.statInfo}>
            <Text style={[styles.statValue, { fontSize: RESPONSIVE_FONT.base }]}>
              {formatCurrency(totalPayments)}
            </Text>
            <Text style={styles.statLabel}>Total Paid</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'payments' && styles.activeTab]}
          onPress={() => setActiveTab('payments')}
        >
          <Ionicons 
            name="card-outline" 
            size={18} 
            color={activeTab === 'payments' ? COLORS.primary : COLORS.mediumGray} 
          />
          <Text style={[styles.tabText, activeTab === 'payments' && styles.activeTabText]}>
            Payments ({payments.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'invoices' && styles.activeTab]}
          onPress={() => setActiveTab('invoices')}
        >
          <Ionicons 
            name="document-text-outline" 
            size={18} 
            color={activeTab === 'invoices' ? COLORS.primary : COLORS.mediumGray} 
          />
          <Text style={[styles.tabText, activeTab === 'invoices' && styles.activeTabText]}>
            Invoices ({invoices.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        {activeTab === 'payments' ? (
          payments.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyCircle}>
                <Ionicons name="card-outline" size={48} color={COLORS.mediumGray} />
              </View>
              <Text style={styles.emptyTitle}>No Payments</Text>
              <Text style={styles.emptyText}>Your payment history will appear here</Text>
            </View>
          ) : (
            payments.map((payment) => {
              const statusConfig = getPaymentStatusConfig(payment.status);
              return (
                <TouchableOpacity
                  key={payment.id}
                  style={styles.itemCard}
                  onPress={() => {
                    setSelectedPayment(payment);
                    setShowPaymentDetail(true);
                  }}
                >
                  <View style={[styles.itemIcon, { backgroundColor: statusConfig.bgColor }]}>
                    <Ionicons name={getPaymentMethodIcon(payment.payment_method)} size={22} color={statusConfig.color} />
                  </View>
                  <View style={styles.itemContent}>
                    <View style={styles.itemHeader}>
                      <Text style={styles.itemTitle}>
                        {formatPaymentMethod(payment.payment_method)}
                      </Text>
                      <Text style={[styles.itemAmount, { color: statusConfig.color }]}>
                        {formatCurrency(payment.amount, payment.currency)}
                      </Text>
                    </View>
                    <Text style={styles.itemSubtitle}>Order #{payment.order_id}</Text>
                    <View style={styles.itemFooter}>
                      <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
                        <Ionicons name={statusConfig.icon} size={12} color={statusConfig.color} />
                        <Text style={[styles.statusText, { color: statusConfig.color }]}>
                          {statusConfig.label}
                        </Text>
                      </View>
                      <Text style={styles.itemDate}>{formatDate(payment.created_at)}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )
        ) : (
          invoices.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyCircle}>
                <Ionicons name="document-text-outline" size={48} color={COLORS.mediumGray} />
              </View>
              <Text style={styles.emptyTitle}>No Invoices</Text>
              <Text style={styles.emptyText}>Your invoices will appear here</Text>
            </View>
          ) : (
            invoices.map((invoice) => {
              const statusConfig = getInvoiceStatusConfig(invoice.status);
              return (
                <TouchableOpacity
                  key={invoice.id}
                  style={styles.itemCard}
                  onPress={() => {
                    setSelectedInvoice(invoice);
                    setShowInvoiceDetail(true);
                  }}
                >
                  <View style={[styles.itemIcon, { backgroundColor: statusConfig.bgColor }]}>
                    <Ionicons name="document-text-outline" size={22} color={statusConfig.color} />
                  </View>
                  <View style={styles.itemContent}>
                    <View style={styles.itemHeader}>
                      <Text style={styles.itemTitle}>{invoice.invoice_number}</Text>
                      <Text style={[styles.itemAmount, { color: COLORS.dark }]}>
                        {formatCurrency(invoice.total_amount, invoice.currency)}
                      </Text>
                    </View>
                    <Text style={styles.itemSubtitle}>Order #{invoice.order_id}</Text>
                    <View style={styles.itemFooter}>
                      <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
                        <Ionicons name={statusConfig.icon} size={12} color={statusConfig.color} />
                        <Text style={[styles.statusText, { color: statusConfig.color }]}>
                          {statusConfig.label}
                        </Text>
                      </View>
                      <Text style={styles.itemDate}>{formatDate(invoice.issued_at)}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Payment Detail Modal */}
      <Modal visible={showPaymentDetail} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowPaymentDetail(false)}>
              <Ionicons name="close" size={24} color={COLORS.dark} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Payment Details</Text>
            <View style={{ width: 24 }} />
          </View>

          {selectedPayment && (
            <ScrollView style={styles.modalContent}>
              <View style={styles.detailHeader}>
                <View style={[
                  styles.detailIconContainer,
                  { backgroundColor: getPaymentStatusConfig(selectedPayment.status).bgColor }
                ]}>
                  <Ionicons
                    name={getPaymentMethodIcon(selectedPayment.payment_method)}
                    size={32}
                    color={getPaymentStatusConfig(selectedPayment.status).color}
                  />
                </View>
                <Text style={styles.detailAmount}>
                  {formatCurrency(selectedPayment.amount, selectedPayment.currency)}
                </Text>
                <View style={[
                  styles.detailStatusBadge,
                  { backgroundColor: getPaymentStatusConfig(selectedPayment.status).bgColor }
                ]}>
                  <Ionicons
                    name={getPaymentStatusConfig(selectedPayment.status).icon}
                    size={16}
                    color={getPaymentStatusConfig(selectedPayment.status).color}
                  />
                  <Text style={[
                    styles.detailStatusText,
                    { color: getPaymentStatusConfig(selectedPayment.status).color }
                  ]}>
                    {getPaymentStatusConfig(selectedPayment.status).label}
                  </Text>
                </View>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Transaction Information</Text>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Transaction ID</Text>
                  <Text style={styles.detailValue}>{selectedPayment.transaction_id}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Order ID</Text>
                  <Text style={[styles.detailValue, { color: COLORS.primary }]}>
                    #{selectedPayment.order_id}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Payment Method</Text>
                  <Text style={styles.detailValue}>
                    {formatPaymentMethod(selectedPayment.payment_method)}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Date</Text>
                  <Text style={styles.detailValue}>{formatFullDate(selectedPayment.created_at)}</Text>
                </View>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Invoice Detail Modal */}
      <Modal visible={showInvoiceDetail} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowInvoiceDetail(false)}>
              <Ionicons name="close" size={24} color={COLORS.dark} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Invoice Details</Text>
            <View style={{ width: 24 }} />
          </View>

          {selectedInvoice && (
            <ScrollView style={styles.modalContent}>
              <View style={styles.detailHeader}>
                <View style={[
                  styles.detailIconContainer,
                  { backgroundColor: getInvoiceStatusConfig(selectedInvoice.status).bgColor }
                ]}>
                  <Ionicons
                    name="document-text-outline"
                    size={32}
                    color={getInvoiceStatusConfig(selectedInvoice.status).color}
                  />
                </View>
                <Text style={styles.detailInvoiceNumber}>{selectedInvoice.invoice_number}</Text>
                <View style={[
                  styles.detailStatusBadge,
                  { backgroundColor: getInvoiceStatusConfig(selectedInvoice.status).bgColor }
                ]}>
                  <Ionicons
                    name={getInvoiceStatusConfig(selectedInvoice.status).icon}
                    size={16}
                    color={getInvoiceStatusConfig(selectedInvoice.status).color}
                  />
                  <Text style={[
                    styles.detailStatusText,
                    { color: getInvoiceStatusConfig(selectedInvoice.status).color }
                  ]}>
                    {getInvoiceStatusConfig(selectedInvoice.status).label}
                  </Text>
                </View>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Invoice Breakdown</Text>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Subtotal</Text>
                  <Text style={styles.detailValue}>
                    {formatCurrency(selectedInvoice.subtotal, selectedInvoice.currency)}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Tax</Text>
                  <Text style={styles.detailValue}>
                    {formatCurrency(selectedInvoice.tax_amount, selectedInvoice.currency)}
                  </Text>
                </View>

                {selectedInvoice.discount_amount > 0 && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Discount</Text>
                    <Text style={[styles.detailValue, { color: '#10B981' }]}>
                      -{formatCurrency(selectedInvoice.discount_amount, selectedInvoice.currency)}
                    </Text>
                  </View>
                )}

                <View style={[styles.detailRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>
                    {formatCurrency(selectedInvoice.total_amount, selectedInvoice.currency)}
                  </Text>
                </View>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Invoice Information</Text>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Order ID</Text>
                  <Text style={[styles.detailValue, { color: COLORS.primary }]}>
                    #{selectedInvoice.order_id}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Issued Date</Text>
                  <Text style={styles.detailValue}>{formatFullDate(selectedInvoice.issued_at)}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Due Date</Text>
                  <Text style={styles.detailValue}>{formatDate(selectedInvoice.due_date)}</Text>
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
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    fontSize: RESPONSIVE_FONT.lg,
    fontWeight: '700',
    color: COLORS.dark,
  },
  headerSpacer: {
    width: 32,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.sm,
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gray,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    gap: SPACING.xs,
  },
  statInfo: {
    flex: 1,
  },
  statValue: {
    fontSize: RESPONSIVE_FONT.lg,
    fontWeight: '700',
    color: COLORS.dark,
  },
  statLabel: {
    fontSize: RESPONSIVE_FONT.xs,
    color: COLORS.mediumGray,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    gap: SPACING.xs,
  },
  activeTab: {
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: RESPONSIVE_FONT.sm,
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
  itemCard: {
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
  itemIcon: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  itemContent: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  itemTitle: {
    fontSize: RESPONSIVE_FONT.base,
    fontWeight: '600',
    color: COLORS.dark,
  },
  itemAmount: {
    fontSize: RESPONSIVE_FONT.base,
    fontWeight: '700',
  },
  itemSubtitle: {
    fontSize: RESPONSIVE_FONT.sm,
    color: COLORS.mediumGray,
    marginBottom: SPACING.xs,
  },
  itemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
    gap: 4,
  },
  statusText: {
    fontSize: RESPONSIVE_FONT.xs,
    fontWeight: '500',
  },
  itemDate: {
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
  modalContent: {
    flex: 1,
    padding: SPACING.lg,
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
  detailAmount: {
    fontSize: RESPONSIVE_FONT.xxl,
    fontWeight: '700',
    color: COLORS.dark,
    marginBottom: SPACING.sm,
  },
  detailInvoiceNumber: {
    fontSize: RESPONSIVE_FONT.lg,
    fontWeight: '700',
    color: COLORS.dark,
    marginBottom: SPACING.sm,
  },
  detailStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    gap: 6,
  },
  detailStatusText: {
    fontSize: RESPONSIVE_FONT.sm,
    fontWeight: '600',
  },
  detailSection: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  detailSectionTitle: {
    fontSize: RESPONSIVE_FONT.base,
    fontWeight: '700',
    color: COLORS.dark,
    marginBottom: SPACING.lg,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  detailLabel: {
    fontSize: RESPONSIVE_FONT.sm,
    color: COLORS.mediumGray,
  },
  detailValue: {
    fontSize: RESPONSIVE_FONT.sm,
    fontWeight: '600',
    color: COLORS.dark,
  },
  totalRow: {
    borderBottomWidth: 0,
    marginTop: SPACING.sm,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  totalLabel: {
    fontSize: RESPONSIVE_FONT.base,
    fontWeight: '700',
    color: COLORS.dark,
  },
  totalValue: {
    fontSize: RESPONSIVE_FONT.lg,
    fontWeight: '700',
    color: COLORS.primary,
  },
});
