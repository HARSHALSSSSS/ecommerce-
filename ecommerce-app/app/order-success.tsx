import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS, SPACING, BORDER_RADIUS } from '@/src/constants/colors';

export default function OrderSuccessScreen() {
  const router = useRouter();
  const { orderId, total, items, paymentMethod } = useLocalSearchParams();

  return (
    <SafeAreaView style={styles.safeContainer}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
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
          >
            <Text style={styles.continueButtonText}>Continue Shopping</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.trackButton}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <Text style={styles.trackButtonText}>Track Order</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: SPACING.xl }} />
      </ScrollView>
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
  successContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  successCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.dark,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 14,
    color: COLORS.mediumGray,
    textAlign: 'center',
  },
  detailsSection: {
    marginBottom: SPACING.lg,
  },
  detailCard: {
    backgroundColor: '#FFF5F0',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  detailLabel: {
    fontSize: 14,
    color: COLORS.mediumGray,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
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
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
  },
  statusText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  timelineSection: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.dark,
    marginBottom: SPACING.lg,
  },
  timeline: {
    marginLeft: SPACING.lg,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: SPACING.lg,
  },
  timelineCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E8E8E8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.lg,
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
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.dark,
    marginBottom: SPACING.xs,
  },
  timelineSubtitle: {
    fontSize: 12,
    color: COLORS.mediumGray,
  },
  timelineLine: {
    width: 2,
    height: 30,
    backgroundColor: '#E8E8E8',
    marginLeft: 15,
    marginBottom: SPACING.md,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#FFF5F0',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.md,
    marginBottom: SPACING.lg,
    alignItems: 'flex-start',
  },
  infoText: {
    fontSize: 13,
    color: COLORS.dark,
    flex: 1,
    lineHeight: 20,
  },
  buttonContainer: {
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  continueButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  continueButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  trackButton: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  trackButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
