import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { COLORS, SPACING, BORDER_RADIUS } from '@/src/constants/colors';
import { RESPONSIVE_FONT } from '@/src/constants/responsive';
import { returnsAPI } from '@/src/services/api';

const API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:5000/api' : 'http://localhost:5000/api';

interface ReturnReason {
  code: string;
  label: string;
  category: string;
}

interface ReturnAction {
  code: string;
  label: string;
}

interface OrderItem {
  id: number;
  name: string;
  quantity: number;
  price: number;
}

export default function ReturnRequestScreen() {
  const params = useLocalSearchParams<{ orderId: string; orderNumber: string; orderTotal: string }>();
  const { isAuthenticated } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reasons, setReasons] = useState<ReturnReason[]>([]);
  const [actions, setActions] = useState<ReturnAction[]>([]);
  
  // Form state
  const [selectedReason, setSelectedReason] = useState('');
  const [reasonText, setReasonText] = useState('');
  const [selectedAction, setSelectedAction] = useState('refund');
  const [pickupAddress, setPickupAddress] = useState('');

  useEffect(() => {
    fetchOptions();
  }, []);

  const fetchOptions = async () => {
    try {
      const [reasonsData, actionsData] = await Promise.all([
        returnsAPI.getReasons(),
        returnsAPI.getActions(),
      ]);
      
      if (reasonsData.success) {
        setReasons(reasonsData.reasons);
      }
      if (actionsData.success) {
        setActions(actionsData.actions);
      }
    } catch (error) {
      console.error('Error fetching options:', error);
      Alert.alert('Error', 'Failed to load return options');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedReason) {
      Alert.alert('Error', 'Please select a reason for return');
      return;
    }

    if (!isAuthenticated) {
      Alert.alert('Error', 'Please login to submit a return request');
      return;
    }

    setSubmitting(true);
    try {
      const data = await returnsAPI.create({
        order_id: Number(params.orderId),
        reason_code: selectedReason,
        requested_action: selectedAction,
        reason_text: reasonText,
        pickup_address: pickupAddress,
      });

      if (data.success) {
        Alert.alert(
          'Success',
          `Return request submitted successfully!\n\nReturn #: ${data.return_request.id}`,
          [
            {
              text: 'OK',
              onPress: () => router.back(),
            },
          ]
        );
      } else {
        Alert.alert('Error', data.message || 'Failed to submit return request');
      }
    } catch (error: any) {
      console.error('Error submitting return:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to submit return request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

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
        <Text style={styles.headerTitle}>Return Request</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Order Info */}
        <View style={styles.orderInfo}>
          <Text style={styles.orderNumber}>Order: {params.orderNumber}</Text>
          <Text style={styles.orderTotal}>Total: ${parseFloat(params.orderTotal || '0').toFixed(2)}</Text>
        </View>

        {/* Reason Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Why are you returning this order?</Text>
          <View style={styles.reasonList}>
            {reasons.map((reason) => (
              <TouchableOpacity
                key={reason.code}
                style={[
                  styles.reasonItem,
                  selectedReason === reason.code && styles.reasonItemSelected,
                ]}
                onPress={() => setSelectedReason(reason.code)}
              >
                <View style={styles.radioOuter}>
                  {selectedReason === reason.code && <View style={styles.radioInner} />}
                </View>
                <Text
                  style={[
                    styles.reasonText,
                    selectedReason === reason.code && styles.reasonTextSelected,
                  ]}
                >
                  {reason.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Additional Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Details (Optional)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Please provide more details about the issue..."
            placeholderTextColor={COLORS.mediumGray}
            multiline
            numberOfLines={4}
            value={reasonText}
            onChangeText={setReasonText}
            textAlignVertical="top"
          />
        </View>

        {/* Requested Action */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What would you like?</Text>
          <View style={styles.actionList}>
            {actions.map((action) => (
              <TouchableOpacity
                key={action.code}
                style={[
                  styles.actionItem,
                  selectedAction === action.code && styles.actionItemSelected,
                ]}
                onPress={() => setSelectedAction(action.code)}
              >
                <Ionicons
                  name={
                    action.code === 'refund'
                      ? 'wallet-outline'
                      : action.code === 'replacement'
                      ? 'swap-horizontal-outline'
                      : 'build-outline'
                  }
                  size={24}
                  color={selectedAction === action.code ? COLORS.primary : COLORS.mediumGray}
                />
                <Text
                  style={[
                    styles.actionText,
                    selectedAction === action.code && styles.actionTextSelected,
                  ]}
                >
                  {action.label}
                </Text>
                {selectedAction === action.code && (
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Pickup Address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pickup Address (Optional)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Enter address for pickup or leave blank to use order address"
            placeholderTextColor={COLORS.mediumGray}
            multiline
            numberOfLines={3}
            value={pickupAddress}
            onChangeText={setPickupAddress}
            textAlignVertical="top"
          />
        </View>

        {/* Info Note */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color={COLORS.primary} />
          <Text style={styles.infoText}>
            Our team will review your request within 24-48 hours. You'll receive an email with next steps.
          </Text>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.submitButtonText}>Submit Return Request</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  content: {
    flex: 1,
    padding: SPACING.lg,
  },
  orderInfo: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  orderNumber: {
    fontSize: RESPONSIVE_FONT.base,
    fontWeight: '600',
    color: COLORS.dark,
  },
  orderTotal: {
    fontSize: RESPONSIVE_FONT.base,
    fontWeight: '600',
    color: COLORS.primary,
  },
  section: {
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
  sectionTitle: {
    fontSize: RESPONSIVE_FONT.base,
    fontWeight: '600',
    color: COLORS.dark,
    marginBottom: SPACING.md,
  },
  reasonList: {
    gap: SPACING.sm,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.md,
  },
  reasonItemSelected: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}15`,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.mediumGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  reasonText: {
    fontSize: RESPONSIVE_FONT.sm,
    color: COLORS.mediumGray,
    flex: 1,
  },
  reasonTextSelected: {
    color: COLORS.dark,
    fontWeight: '500',
  },
  textInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.md,
    fontSize: RESPONSIVE_FONT.sm,
    color: COLORS.dark,
    minHeight: 100,
    backgroundColor: COLORS.gray,
  },
  actionList: {
    gap: SPACING.sm,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.md,
  },
  actionItemSelected: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}15`,
  },
  actionText: {
    fontSize: RESPONSIVE_FONT.sm,
    color: COLORS.mediumGray,
    flex: 1,
  },
  actionTextSelected: {
    color: COLORS.dark,
    fontWeight: '500',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: `${COLORS.primary}15`,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  infoText: {
    flex: 1,
    fontSize: RESPONSIVE_FONT.xs,
    color: COLORS.mediumGray,
    lineHeight: 18,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: COLORS.white,
    fontSize: RESPONSIVE_FONT.base,
    fontWeight: '600',
  },
});
