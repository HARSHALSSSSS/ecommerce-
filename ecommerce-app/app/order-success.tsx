import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS, SPACING, BORDER_RADIUS } from '@/src/constants/colors';
import { RESPONSIVE_FONT, RESPONSIVE_SPACING, RESPONSIVE_DIMENSION } from '@/src/constants/responsive';

export default function OrderSuccessScreen() {
  const router = useRouter();
  const { orderId, total, items, paymentMethod } = useLocalSearchParams();

  return (
    <SafeAreaView style={styles.safeContainer}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView 
          style={styles.container} 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Success Animation */}
          <View style={styles.successContainer}>
          <View style={styles.successCircle}>
            <Ionicons name="checkmark" size={60} color={COLORS.white} />
          </View>
          <Text style={styles.successTitle}>Order Confirmed!</Text>
          <Text style={styles.successSubtitle}>Your order has been placed successfully</Text>
        </View>

        {/* Order Details */}
        <View style={styles.detailsSection}>
          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Order ID</Text>
              <Text style={styles.detailValue}># {orderId || '12345'}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Total Amount</Text>
              <Text style={styles.detailValue}>${total || '0.00'}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Payment Method</Text>
              <Text style={styles.detailValue}>{paymentMethod || 'Credit Card'}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Status</Text>
              <View style={styles.statusBadge}>
                <Ionicons name="time-outline" size={14} color={COLORS.primary} />
                <Text style={styles.statusText}>Processing</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Order Timeline */}
        <View style={styles.timelineSection}>
          <Text style={styles.sectionTitle}>Order Timeline</Text>
          <View style={styles.timeline}>
            <View style={styles.timelineItem}>
              <View style={[styles.timelineCircle, styles.timelineActive]}>
                <Ionicons name="checkmark" size={16} color={COLORS.white} />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Order Placed</Text>
                <Text style={styles.timelineSubtitle}>Today at 2:30 PM</Text>
              </View>
            </View>

            <View style={styles.timelineLine} />

            <View style={styles.timelineItem}>
              <View style={styles.timelineCircle}>
                <View style={styles.timelineEmptyCircle} />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Processing</Text>
                <Text style={styles.timelineSubtitle}>Estimated 1-2 hours</Text>
              </View>
            </View>

            <View style={styles.timelineLine} />

            <View style={styles.timelineItem}>
              <View style={styles.timelineCircle}>
                <View style={styles.timelineEmptyCircle} />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Shipped</Text>
                <Text style={styles.timelineSubtitle}>Estimated tomorrow</Text>
              </View>
            </View>

            <View style={styles.timelineLine} />

            <View style={styles.timelineItem}>
              <View style={styles.timelineCircle}>
                <View style={styles.timelineEmptyCircle} />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Delivered</Text>
                <Text style={styles.timelineSubtitle}>Estimated in 2-3 days</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color={COLORS.primary} />
          <Text style={styles.infoText}>
            A confirmation email has been sent to your registered email address. You can track your order from your profile.
          </Text>
        </View>

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.continueButton}
            onPress={() => router.push('/(tabs)')}
            activeOpacity={0.8}
          >
            <Text style={styles.continueButtonText}>Continue Shopping</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.trackButton}
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.7}
          >
            <Text style={styles.trackButtonText}>Track Order</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: SPACING.xl }} />
      </ScrollView>
      </KeyboardAvoidingView>
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
  },
  scrollContent: {
    paddingHorizontal: RESPONSIVE_SPACING.lg,
    paddingBottom: RESPONSIVE_SPACING.xl,
    flexGrow: 1,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: RESPONSIVE_SPACING.xl,
    marginBottom: RESPONSIVE_SPACING.lg,
    marginTop: RESPONSIVE_SPACING.md,
  },
  successCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: RESPONSIVE_SPACING.lg,
  },
  successTitle: {
    fontSize: RESPONSIVE_FONT.xxl,
    fontWeight: 'bold',
    color: COLORS.dark,
    marginBottom: RESPONSIVE_SPACING.sm,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: RESPONSIVE_FONT.sm,
    color: COLORS.mediumGray,
    textAlign: 'center',
  },
  detailsSection: {
    marginBottom: RESPONSIVE_SPACING.lg,
  },
  detailCard: {
    backgroundColor: '#FFF5F0',
    borderRadius: RESPONSIVE_DIMENSION.cardBorderRadius,
    padding: RESPONSIVE_SPACING.lg,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: RESPONSIVE_SPACING.md,
  },
  detailLabel: {
    fontSize: RESPONSIVE_FONT.sm,
    color: COLORS.mediumGray,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: RESPONSIVE_FONT.sm,
    fontWeight: 'bold',
    color: COLORS.dark,
  },
  divider: {
    height: 1,
    backgroundColor: '#E8E8E8',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: RESPONSIVE_SPACING.md,
    paddingVertical: RESPONSIVE_SPACING.sm,
    borderRadius: RESPONSIVE_DIMENSION.buttonBorderRadius,
    gap: RESPONSIVE_SPACING.sm,
  },
  statusText: {
    fontSize: RESPONSIVE_FONT.xs,
    color: COLORS.primary,
    fontWeight: '600',
  },
  timelineSection: {
    marginBottom: RESPONSIVE_SPACING.lg,
  },
  sectionTitle: {
    fontSize: RESPONSIVE_FONT.lg,
    fontWeight: 'bold',
    color: COLORS.dark,
    marginBottom: RESPONSIVE_SPACING.lg,
  },
  timeline: {
    marginLeft: RESPONSIVE_SPACING.lg,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: RESPONSIVE_SPACING.lg,
  },
  timelineCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E8E8E8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: RESPONSIVE_SPACING.lg,
    marginTop: -6,
  },
  timelineActive: {
    backgroundColor: COLORS.primary,
  },
  timelineEmptyCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#D8D8D8',
  },
  timelineContent: {
    flex: 1,
  },
  timelineTitle: {
    fontSize: RESPONSIVE_FONT.sm,
    fontWeight: '600',
    color: COLORS.dark,
    marginBottom: RESPONSIVE_SPACING.xs,
  },
  timelineSubtitle: {
    fontSize: RESPONSIVE_FONT.xs,
    color: COLORS.mediumGray,
  },
  timelineLine: {
    width: 2,
    height: 30,
    backgroundColor: '#E8E8E8',
    marginLeft: 15,
    marginBottom: RESPONSIVE_SPACING.md,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#FFF5F0',
    borderRadius: RESPONSIVE_DIMENSION.cardBorderRadius,
    padding: RESPONSIVE_SPACING.lg,
    gap: RESPONSIVE_SPACING.md,
    marginBottom: RESPONSIVE_SPACING.lg,
    alignItems: 'flex-start',
  },
  infoText: {
    fontSize: RESPONSIVE_FONT.sm,
    color: COLORS.dark,
    flex: 1,
    lineHeight: 20,
  },
  buttonContainer: {
    gap: RESPONSIVE_SPACING.md,
    marginBottom: RESPONSIVE_SPACING.lg,
  },
  continueButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RESPONSIVE_DIMENSION.buttonBorderRadius,
    paddingVertical: RESPONSIVE_SPACING.lg + 2,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  continueButtonText: {
    color: COLORS.white,
    fontSize: RESPONSIVE_FONT.lg,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  trackButton: {
    backgroundColor: COLORS.white,
    borderRadius: RESPONSIVE_DIMENSION.buttonBorderRadius,
    paddingVertical: RESPONSIVE_SPACING.lg + 2,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary,
    minHeight: 52,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  trackButtonText: {
    color: COLORS.primary,
    fontSize: RESPONSIVE_FONT.lg,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});
