import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { COLORS, SPACING, BORDER_RADIUS } from '@/src/constants/colors';
import { RESPONSIVE_FONT, RESPONSIVE_SPACING } from '@/src/constants/responsive';

interface FAQItem {
  id: number;
  question: string;
  answer: string;
  category: string;
}

interface HelpCategory {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
  action?: () => void;
}

const FAQ_DATA: FAQItem[] = [
  {
    id: 1,
    question: 'How do I place an order?',
    answer: 'Browse products from the Store tab, add items to your cart, then proceed to checkout. Select your payment method and delivery address to complete your order.',
    category: 'orders',
  },
  {
    id: 2,
    question: 'How can I track my order?',
    answer: 'Go to Profile > My Orders and tap on any order to see real-time tracking information including shipment status and estimated delivery date.',
    category: 'orders',
  },
  {
    id: 3,
    question: 'What payment methods are accepted?',
    answer: 'We accept Credit Cards, Debit Cards, Digital Wallets (PayPal, Apple Pay, Google Pay), and Cash on Delivery for eligible orders.',
    category: 'payments',
  },
  {
    id: 4,
    question: 'How do I return a product?',
    answer: 'For delivered orders, go to Profile > My Orders, select the order, and tap "Request Return". Choose your reason and preferred action (refund/replacement). Our team will process your request within 24-48 hours.',
    category: 'returns',
  },
  {
    id: 5,
    question: 'When will I receive my refund?',
    answer: 'Refunds are processed within 5-7 business days after we receive and inspect the returned item. The amount will be credited to your original payment method.',
    category: 'returns',
  },
  {
    id: 6,
    question: 'How do I change my delivery address?',
    answer: 'You can update your delivery address during checkout. For existing orders, contact our support team through Profile > Support Tickets before the order is shipped.',
    category: 'account',
  },
  {
    id: 7,
    question: 'How do I update my account information?',
    answer: 'Go to Profile > Edit Profile (tap the edit icon) to update your name, email, phone number, and default address.',
    category: 'account',
  },
  {
    id: 8,
    question: 'How do I contact customer support?',
    answer: 'Create a support ticket from Profile > Support Tickets. Our team responds within 24 hours. For urgent issues, select "High" or "Urgent" priority.',
    category: 'support',
  },
  {
    id: 9,
    question: 'Is my payment information secure?',
    answer: 'Yes! We use industry-standard SSL encryption and never store your full card details. All transactions are processed through secure payment gateways.',
    category: 'payments',
  },
  {
    id: 10,
    question: 'Can I cancel my order?',
    answer: 'Orders can be cancelled before they are shipped. Go to Profile > My Orders, select the order, and tap "Cancel Order" if available. Once shipped, you\'ll need to request a return instead.',
    category: 'orders',
  },
];

const HELP_CATEGORIES: HelpCategory[] = [
  {
    id: 'support',
    title: 'Support Tickets',
    icon: 'chatbubbles-outline',
    description: 'Create a ticket for personalized help',
    action: () => router.push('/support'),
  },
  {
    id: 'orders',
    title: 'My Orders',
    icon: 'receipt-outline',
    description: 'Track orders, returns & refunds',
    action: () => router.push('/profile'),
  },
  {
    id: 'payments',
    title: 'Payments & Invoices',
    icon: 'card-outline',
    description: 'View payment history & invoices',
    action: () => router.push('/payments' as any),
  },
  {
    id: 'notifications',
    title: 'Notifications',
    icon: 'notifications-outline',
    description: 'Manage your notification settings',
    action: () => router.push('/notifications' as any),
  },
];

export default function HelpFAQScreen() {
  const insets = useSafeAreaInsets();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = [
    { id: 'all', label: 'All' },
    { id: 'orders', label: 'Orders' },
    { id: 'payments', label: 'Payments' },
    { id: 'returns', label: 'Returns' },
    { id: 'account', label: 'Account' },
    { id: 'support', label: 'Support' },
  ];

  const filteredFAQs = selectedCategory === 'all' 
    ? FAQ_DATA 
    : FAQ_DATA.filter(faq => faq.category === selectedCategory);

  const handleContactEmail = () => {
    Linking.openURL('mailto:support@ecommerceapp.com?subject=Help Request');
  };

  const handleCallSupport = () => {
    Linking.openURL('tel:+1234567890');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & FAQ</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        {/* Quick Help Categories */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Help</Text>
          <View style={styles.helpGrid}>
            {HELP_CATEGORIES.map((category) => (
              <TouchableOpacity 
                key={category.id}
                style={styles.helpCard}
                onPress={category.action}
                activeOpacity={0.7}
              >
                <View style={styles.helpIconContainer}>
                  <Ionicons name={category.icon} size={24} color={COLORS.primary} />
                </View>
                <Text style={styles.helpCardTitle}>{category.title}</Text>
                <Text style={styles.helpCardDescription}>{category.description}</Text>
                <Ionicons name="chevron-forward" size={16} color={COLORS.mediumGray} style={styles.helpCardArrow} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Contact Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Us</Text>
          <View style={styles.contactRow}>
            <TouchableOpacity style={styles.contactCard} onPress={handleContactEmail}>
              <View style={[styles.contactIconContainer, { backgroundColor: '#EDE9FE' }]}>
                <Ionicons name="mail-outline" size={22} color="#8B5CF6" />
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactLabel}>Email Support</Text>
                <Text style={styles.contactValue}>support@ecommerceapp.com</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.contactCard} onPress={handleCallSupport}>
              <View style={[styles.contactIconContainer, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="call-outline" size={22} color="#10B981" />
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactLabel}>Phone Support</Text>
                <Text style={styles.contactValue}>+1 (234) 567-890</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* FAQ Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          
          {/* Category Filter */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroll}
            contentContainerStyle={styles.categoryContainer}
          >
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryChip,
                  selectedCategory === cat.id && styles.categoryChipActive,
                ]}
                onPress={() => setSelectedCategory(cat.id)}
              >
                <Text style={[
                  styles.categoryChipText,
                  selectedCategory === cat.id && styles.categoryChipTextActive,
                ]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* FAQ Items */}
          {filteredFAQs.map((faq) => (
            <TouchableOpacity 
              key={faq.id}
              style={styles.faqItem}
              onPress={() => setExpandedId(expandedId === faq.id ? null : faq.id)}
              activeOpacity={0.7}
            >
              <View style={styles.faqHeader}>
                <Text style={styles.faqQuestion}>{faq.question}</Text>
                <Ionicons 
                  name={expandedId === faq.id ? 'chevron-up' : 'chevron-down'} 
                  size={20} 
                  color={COLORS.mediumGray} 
                />
              </View>
              {expandedId === faq.id && (
                <Text style={styles.faqAnswer}>{faq.answer}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Additional Resources */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Resources</Text>
          <View style={styles.resourceCard}>
            <View style={styles.resourceRow}>
              <Ionicons name="document-text-outline" size={20} color={COLORS.primary} />
              <Text style={styles.resourceText}>Terms & Conditions</Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.mediumGray} />
            </View>
            <View style={styles.resourceDivider} />
            <View style={styles.resourceRow}>
              <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.primary} />
              <Text style={styles.resourceText}>Privacy Policy</Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.mediumGray} />
            </View>
            <View style={styles.resourceDivider} />
            <View style={styles.resourceRow}>
              <Ionicons name="refresh-outline" size={20} color={COLORS.primary} />
              <Text style={styles.resourceText}>Return & Refund Policy</Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.mediumGray} />
            </View>
            <View style={styles.resourceDivider} />
            <View style={styles.resourceRow}>
              <Ionicons name="car-outline" size={20} color={COLORS.primary} />
              <Text style={styles.resourceText}>Shipping Information</Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.mediumGray} />
            </View>
          </View>
        </View>

        {/* App Version */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>App Version 1.0.0</Text>
          <Text style={styles.versionSubtext}>© 2024 E-Commerce App. All rights reserved.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: RESPONSIVE_FONT.lg,
    fontWeight: '700',
    color: COLORS.dark,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.md,
  },
  section: {
    marginTop: SPACING.lg,
  },
  sectionTitle: {
    fontSize: RESPONSIVE_FONT.base,
    fontWeight: '700',
    color: COLORS.dark,
    marginBottom: SPACING.md,
  },
  helpGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  helpCard: {
    width: '48%',
    backgroundColor: COLORS.lightGray,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    position: 'relative',
  },
  helpIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  helpCardTitle: {
    fontSize: RESPONSIVE_FONT.sm,
    fontWeight: '600',
    color: COLORS.dark,
    marginBottom: 4,
  },
  helpCardDescription: {
    fontSize: RESPONSIVE_FONT.xs,
    color: COLORS.mediumGray,
    lineHeight: 16,
  },
  helpCardArrow: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
  },
  contactRow: {
    gap: SPACING.sm,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  contactIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  contactInfo: {
    flex: 1,
  },
  contactLabel: {
    fontSize: RESPONSIVE_FONT.xs,
    color: COLORS.mediumGray,
    marginBottom: 2,
  },
  contactValue: {
    fontSize: RESPONSIVE_FONT.sm,
    fontWeight: '600',
    color: COLORS.dark,
  },
  categoryScroll: {
    marginBottom: SPACING.md,
  },
  categoryContainer: {
    gap: SPACING.sm,
  },
  categoryChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    backgroundColor: COLORS.lightGray,
  },
  categoryChipActive: {
    backgroundColor: COLORS.primary,
  },
  categoryChipText: {
    fontSize: RESPONSIVE_FONT.sm,
    color: COLORS.dark,
    fontWeight: '500',
  },
  categoryChipTextActive: {
    color: COLORS.white,
  },
  faqItem: {
    backgroundColor: COLORS.lightGray,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestion: {
    flex: 1,
    fontSize: RESPONSIVE_FONT.sm,
    fontWeight: '600',
    color: COLORS.dark,
    marginRight: SPACING.sm,
  },
  faqAnswer: {
    marginTop: SPACING.sm,
    fontSize: RESPONSIVE_FONT.sm,
    color: COLORS.mediumGray,
    lineHeight: 20,
  },
  resourceCard: {
    backgroundColor: COLORS.lightGray,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
  },
  resourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  resourceText: {
    flex: 1,
    marginLeft: SPACING.md,
    fontSize: RESPONSIVE_FONT.sm,
    color: COLORS.dark,
  },
  resourceDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.xs,
  },
  versionContainer: {
    alignItems: 'center',
    marginTop: SPACING.xxl,
    marginBottom: SPACING.lg,
  },
  versionText: {
    fontSize: RESPONSIVE_FONT.xs,
    color: COLORS.mediumGray,
  },
  versionSubtext: {
    fontSize: RESPONSIVE_FONT.xs,
    color: COLORS.mediumGray,
    marginTop: 4,
  },
});
