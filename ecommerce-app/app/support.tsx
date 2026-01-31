import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { COLORS, SPACING, BORDER_RADIUS } from '@/src/constants/colors';
import { RESPONSIVE_FONT, RESPONSIVE_SPACING } from '@/src/constants/responsive';
import { ticketsAPI, ordersAPI } from '../src/services/api';

interface Ticket {
  id: number;
  ticket_number: string;
  subject: string;
  description: string;
  category: string;
  category_label: string;
  priority: string;
  priority_label: string;
  status: string;
  status_label: string;
  is_sla_breached: boolean;
  order_number?: string;
  created_at: string;
  updated_at: string;
}

interface TicketMessage {
  id: number;
  sender_type: 'user' | 'admin';
  sender_name: string;
  message: string;
  created_at: string;
}

interface Category {
  code: string;
  label: string;
}

interface Order {
  id: number;
  order_number: string;
  status: string;
}

export default function SupportScreen() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [ticketMessages, setTicketMessages] = useState<TicketMessage[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  
  // Create ticket form
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [priority, setPriority] = useState('medium');
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Reply form
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'open' | 'closed'>('open');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [ticketsRes, categoriesRes, ordersRes] = await Promise.all([
        ticketsAPI.getMyTickets(),
        ticketsAPI.getCategories(),
        ordersAPI.getAll().catch(() => ({ orders: [] })),
      ]);
      
      setTickets(ticketsRes.tickets || []);
      setCategories(categoriesRes.categories || []);
      setOrders(ordersRes.orders || []);
    } catch (error) {
      console.error('Error fetching support data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, []);

  const fetchTicketDetail = async (ticket: Ticket) => {
    try {
      const response = await ticketsAPI.getById(ticket.id);
      setSelectedTicket(response.ticket);
      setTicketMessages(response.ticket.messages || []);
      setShowDetailModal(true);
    } catch (error) {
      Alert.alert('Error', 'Failed to load ticket details');
    }
  };

  const handleCreateTicket = async () => {
    if (!subject.trim() || !description.trim()) {
      Alert.alert('Error', 'Please fill in subject and description');
      return;
    }

    setSubmitting(true);
    try {
      await ticketsAPI.create({
        subject,
        description,
        category,
        priority,
        order_id: selectedOrderId || undefined,
      });
      
      Alert.alert('Success', 'Your support ticket has been created');
      setShowCreateModal(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to create ticket');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendReply = async () => {
    if (!selectedTicket || !replyMessage.trim()) return;

    setSendingReply(true);
    try {
      await ticketsAPI.reply(selectedTicket.id, replyMessage);
      setReplyMessage('');
      fetchTicketDetail(selectedTicket);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  };

  const resetForm = () => {
    setSubject('');
    setDescription('');
    setCategory('general');
    setPriority('medium');
    setSelectedOrderId(null);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return '#3B82F6';
      case 'in_progress': return '#8B5CF6';
      case 'awaiting_customer': return COLORS.warning;
      case 'escalated': return COLORS.error;
      case 'resolved': return COLORS.success;
      case 'closed': return COLORS.mediumGray;
      default: return COLORS.mediumGray;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return '#DC2626';
      case 'high': return COLORS.error;
      case 'medium': return COLORS.warning;
      case 'low': return COLORS.mediumGray;
      default: return COLORS.mediumGray;
    }
  };

  const filteredTickets = tickets.filter(t => {
    if (activeTab === 'open') {
      return !['resolved', 'closed'].includes(t.status);
    } else {
      return ['resolved', 'closed'].includes(t.status);
    }
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
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
        <Text style={styles.headerTitle}>Support Tickets</Text>
        <TouchableOpacity
          onPress={() => setShowCreateModal(true)}
          style={styles.addButton}
        >
          <Ionicons name="add" size={24} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'open' && styles.activeTab]}
          onPress={() => setActiveTab('open')}
        >
          <Text style={[styles.tabText, activeTab === 'open' && styles.activeTabText]}>
            Open ({tickets.filter(t => !['resolved', 'closed'].includes(t.status)).length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'closed' && styles.activeTab]}
          onPress={() => setActiveTab('closed')}
        >
          <Text style={[styles.tabText, activeTab === 'closed' && styles.activeTabText]}>
            Closed ({tickets.filter(t => ['resolved', 'closed'].includes(t.status)).length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tickets List */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        {filteredTickets.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyCircle}>
              <Ionicons name="chatbubbles-outline" size={48} color={COLORS.mediumGray} />
            </View>
            <Text style={styles.emptyTitle}>No Tickets</Text>
            <Text style={styles.emptyText}>
              {activeTab === 'open' 
                ? "You don't have any open tickets" 
                : "You don't have any closed tickets"}
            </Text>
            {activeTab === 'open' && (
              <TouchableOpacity
                style={styles.createButton}
                onPress={() => setShowCreateModal(true)}
              >
                <Text style={styles.createButtonText}>Create Ticket</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredTickets.map((ticket) => (
            <TouchableOpacity
              key={ticket.id}
              style={styles.ticketCard}
              onPress={() => fetchTicketDetail(ticket)}
            >
              <View style={styles.ticketHeader}>
                <Text style={styles.ticketNumber}>{ticket.ticket_number}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(ticket.status) + '20' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(ticket.status) }]}>
                    {ticket.status_label}
                  </Text>
                </View>
              </View>
              <Text style={styles.ticketSubject} numberOfLines={2}>{ticket.subject}</Text>
              <View style={styles.ticketMeta}>
                <View style={styles.ticketMetaItem}>
                  <Ionicons name="folder-outline" size={14} color={COLORS.mediumGray} />
                  <Text style={styles.ticketMetaText}>{ticket.category_label}</Text>
                </View>
                <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(ticket.priority) + '20' }]}>
                  <Text style={[styles.priorityText, { color: getPriorityColor(ticket.priority) }]}>
                    {ticket.priority_label}
                  </Text>
                </View>
              </View>
              {ticket.order_number && (
                <Text style={styles.orderNumber}>Order: {ticket.order_number}</Text>
              )}
              <Text style={styles.ticketDate}>{formatDate(ticket.created_at)}</Text>
              {ticket.is_sla_breached && (
                <View style={styles.slaBreach}>
                  <Ionicons name="warning" size={14} color={COLORS.error} />
                  <Text style={styles.slaBreachText}>SLA Breached</Text>
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Create Ticket Modal */}
      <Modal visible={showCreateModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => { setShowCreateModal(false); resetForm(); }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>New Ticket</Text>
              <TouchableOpacity onPress={handleCreateTicket} disabled={submitting}>
                <Text style={[styles.submitText, submitting && styles.disabledText]}>
                  {submitting ? 'Creating...' : 'Create'}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Subject *</Text>
                <TextInput
                  style={styles.input}
                  value={subject}
                  onChangeText={setSubject}
                  placeholder="Brief description of your issue"
                  placeholderTextColor={COLORS.mediumGray}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Description *</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Provide details about your issue..."
                  placeholderTextColor={COLORS.mediumGray}
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionsScroll}>
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat.code}
                      style={[styles.optionChip, category === cat.code && styles.optionChipSelected]}
                      onPress={() => setCategory(cat.code)}
                    >
                      <Text style={[styles.optionChipText, category === cat.code && styles.optionChipTextSelected]}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Priority</Text>
                <View style={styles.priorityOptions}>
                  {[
                    { code: 'low', label: 'Low', color: COLORS.mediumGray },
                    { code: 'medium', label: 'Medium', color: COLORS.warning },
                    { code: 'high', label: 'High', color: COLORS.error },
                    { code: 'urgent', label: 'Urgent', color: '#DC2626' },
                  ].map((p) => (
                    <TouchableOpacity
                      key={p.code}
                      style={[
                        styles.priorityOption,
                        priority === p.code && { backgroundColor: p.color + '20', borderColor: p.color },
                      ]}
                      onPress={() => setPriority(p.code)}
                    >
                      <Text style={[styles.priorityOptionText, priority === p.code && { color: p.color }]}>
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {orders.length > 0 && (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Related Order (Optional)</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionsScroll}>
                    <TouchableOpacity
                      style={[styles.optionChip, !selectedOrderId && styles.optionChipSelected]}
                      onPress={() => setSelectedOrderId(null)}
                    >
                      <Text style={[styles.optionChipText, !selectedOrderId && styles.optionChipTextSelected]}>
                        None
                      </Text>
                    </TouchableOpacity>
                    {orders.slice(0, 10).map((order) => (
                      <TouchableOpacity
                        key={order.id}
                        style={[styles.optionChip, selectedOrderId === order.id && styles.optionChipSelected]}
                        onPress={() => setSelectedOrderId(order.id)}
                      >
                        <Text style={[styles.optionChipText, selectedOrderId === order.id && styles.optionChipTextSelected]}>
                          {order.order_number}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Ticket Detail Modal */}
      <Modal visible={showDetailModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => { setShowDetailModal(false); setSelectedTicket(null); }}>
                <Text style={styles.cancelText}>Close</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{selectedTicket?.ticket_number}</Text>
              <View style={{ width: 50 }} />
            </View>

            {selectedTicket && (
              <>
                <ScrollView style={styles.modalContent}>
                  {/* Ticket Info */}
                  <View style={styles.ticketInfo}>
                    <Text style={styles.detailSubject}>{selectedTicket.subject}</Text>
                    <View style={styles.detailBadges}>
                      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedTicket.status) + '20' }]}>
                        <Text style={[styles.statusText, { color: getStatusColor(selectedTicket.status) }]}>
                          {selectedTicket.status_label}
                        </Text>
                      </View>
                      <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(selectedTicket.priority) + '20' }]}>
                        <Text style={[styles.priorityText, { color: getPriorityColor(selectedTicket.priority) }]}>
                          {selectedTicket.priority_label}
                        </Text>
                      </View>
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryText}>{selectedTicket.category_label}</Text>
                      </View>
                    </View>
                    {selectedTicket.order_number && (
                      <Text style={styles.detailOrder}>Related Order: {selectedTicket.order_number}</Text>
                    )}
                    <Text style={styles.detailDate}>Created: {formatDate(selectedTicket.created_at)}</Text>
                  </View>

                  {/* Messages */}
                  <Text style={styles.messagesTitle}>Conversation</Text>
                  {ticketMessages.map((msg) => (
                    <View
                      key={msg.id}
                      style={[
                        styles.messageCard,
                        msg.sender_type === 'admin' ? styles.adminMessage : styles.userMessage,
                      ]}
                    >
                      <View style={styles.messageHeader}>
                        <Text style={styles.messageSender}>{msg.sender_name}</Text>
                        <Text style={styles.messageType}>
                          {msg.sender_type === 'admin' ? 'Support' : 'You'}
                        </Text>
                      </View>
                      <Text style={styles.messageText}>{msg.message}</Text>
                      <Text style={styles.messageDate}>{formatDate(msg.created_at)}</Text>
                    </View>
                  ))}
                </ScrollView>

                {/* Reply Input */}
                {!['resolved', 'closed'].includes(selectedTicket.status) && (
                  <View style={styles.replyContainer}>
                    <TextInput
                      style={styles.replyInput}
                      value={replyMessage}
                      onChangeText={setReplyMessage}
                      placeholder="Type your reply..."
                      placeholderTextColor={COLORS.mediumGray}
                      multiline
                    />
                    <TouchableOpacity
                      style={[styles.sendButton, !replyMessage.trim() && styles.sendButtonDisabled]}
                      onPress={handleSendReply}
                      disabled={!replyMessage.trim() || sendingReply}
                    >
                      {sendingReply ? (
                        <ActivityIndicator size="small" color={COLORS.white} />
                      ) : (
                        <Ionicons name="send" size={20} color={COLORS.white} />
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </KeyboardAvoidingView>
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
    padding: SPACING.sm,
  },
  headerTitle: {
    fontSize: RESPONSIVE_FONT.lg,
    fontWeight: '600',
    color: COLORS.dark,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    padding: SPACING.sm,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: RESPONSIVE_FONT.sm,
    color: COLORS.mediumGray,
  },
  activeTabText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: SPACING.lg,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: RESPONSIVE_FONT.lg,
    fontWeight: '600',
    color: COLORS.dark,
    marginTop: SPACING.lg,
  },
  emptyText: {
    fontSize: RESPONSIVE_FONT.sm,
    color: COLORS.mediumGray,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  createButton: {
    marginTop: SPACING.xl,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  createButtonText: {
    color: COLORS.white,
    fontSize: RESPONSIVE_FONT.base,
    fontWeight: '600',
  },
  ticketCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  ticketNumber: {
    fontSize: RESPONSIVE_FONT.xs,
    fontWeight: '600',
    color: COLORS.primary,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  ticketSubject: {
    fontSize: RESPONSIVE_FONT.base,
    fontWeight: '600',
    color: COLORS.dark,
    marginBottom: SPACING.sm,
  },
  ticketMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.xs,
  },
  ticketMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  ticketMetaText: {
    fontSize: RESPONSIVE_FONT.xs,
    color: COLORS.mediumGray,
  },
  priorityBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '500',
  },
  orderNumber: {
    fontSize: RESPONSIVE_FONT.xs,
    color: COLORS.primary,
    marginTop: SPACING.xs,
  },
  ticketDate: {
    fontSize: RESPONSIVE_FONT.xs,
    color: COLORS.mediumGray,
    marginTop: SPACING.sm,
  },
  slaBreach: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  slaBreachText: {
    fontSize: RESPONSIVE_FONT.xs,
    color: COLORS.error,
    fontWeight: '500',
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
    fontWeight: '600',
    color: COLORS.dark,
  },
  cancelText: {
    fontSize: RESPONSIVE_FONT.base,
    color: COLORS.mediumGray,
  },
  submitText: {
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
  formGroup: {
    marginBottom: SPACING.xl,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  label: {
    fontSize: RESPONSIVE_FONT.sm,
    fontWeight: '600',
    color: COLORS.dark,
    marginBottom: SPACING.sm,
  },
  input: {
    backgroundColor: COLORS.gray,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    fontSize: RESPONSIVE_FONT.sm,
    color: COLORS.dark,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  optionsScroll: {
    flexGrow: 0,
  },
  optionChip: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    marginRight: SPACING.sm,
  },
  optionChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  optionChipText: {
    fontSize: RESPONSIVE_FONT.sm,
    color: COLORS.dark,
  },
  optionChipTextSelected: {
    color: COLORS.white,
  },
  priorityOptions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  priorityOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.sm,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  priorityOptionText: {
    fontSize: RESPONSIVE_FONT.sm,
    fontWeight: '500',
    color: COLORS.dark,
  },
  ticketInfo: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  detailSubject: {
    fontSize: RESPONSIVE_FONT.lg,
    fontWeight: '600',
    color: COLORS.dark,
    marginBottom: SPACING.md,
  },
  detailBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  categoryBadge: {
    backgroundColor: COLORS.lightGray,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  categoryText: {
    fontSize: 11,
    color: COLORS.dark,
  },
  detailOrder: {
    fontSize: RESPONSIVE_FONT.sm,
    color: COLORS.primary,
    marginTop: SPACING.sm,
  },
  detailDate: {
    fontSize: RESPONSIVE_FONT.xs,
    color: COLORS.mediumGray,
    marginTop: SPACING.sm,
  },
  messagesTitle: {
    fontSize: RESPONSIVE_FONT.base,
    fontWeight: '600',
    color: COLORS.dark,
    marginBottom: SPACING.md,
  },
  messageCard: {
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  userMessage: {
    backgroundColor: COLORS.white,
    marginRight: SPACING.xl,
  },
  adminMessage: {
    backgroundColor: `${COLORS.primary}15`,
    marginLeft: SPACING.xl,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  messageSender: {
    fontSize: RESPONSIVE_FONT.sm,
    fontWeight: '600',
    color: COLORS.dark,
  },
  messageType: {
    fontSize: RESPONSIVE_FONT.xs,
    color: COLORS.mediumGray,
  },
  messageText: {
    fontSize: RESPONSIVE_FONT.sm,
    color: COLORS.dark,
    lineHeight: 20,
  },
  messageDate: {
    fontSize: 11,
    color: COLORS.mediumGray,
    marginTop: SPACING.sm,
    textAlign: 'right',
  },
  replyContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: SPACING.lg,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.md,
  },
  replyInput: {
    flex: 1,
    backgroundColor: COLORS.gray,
    borderRadius: 20,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    fontSize: RESPONSIVE_FONT.sm,
    maxHeight: 100,
    color: COLORS.dark,
  },
  sendButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.mediumGray,
  },
});
