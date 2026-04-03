import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SPACING, BORDER_RADIUS } from '@/src/constants/colors';
import { RESPONSIVE_FONT, RESPONSIVE_SPACING, RESPONSIVE_DIMENSION } from '@/src/constants/responsive';
import { useAuth } from '@/src/context/AuthContext';

export default function UserDetailsScreen() {
  const router = useRouter();
  const { updateUser } = useAuth();
  const { productId, quantity, size, productName, productPrice, discount, returnTo } = useLocalSearchParams();
  
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadExistingData();
  }, []);

  // Reload data when screen is focused (after profile/checkout update)
  useFocusEffect(
    useCallback(() => {
      loadExistingData();
    }, [])
  );

  const loadExistingData = async () => {
    try {
      // Try to load from user object first
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        setName(user.name || '');
        setPhone(user.phone || '');
        setAddress(user.address || '');
        setCity(user.city || '');
      }
    } catch (error) {
      console.log('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const validateFields = () => {
    if (!name.trim()) {
      Alert.alert('Required Field', 'Please enter your name');
      return false;
    }
    if (!phone.trim()) {
      Alert.alert('Required Field', 'Please enter your phone number');
      return false;
    }
    if (phone.trim().length < 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid phone number (at least 10 digits)');
      return false;
    }
    if (!address.trim()) {
      Alert.alert('Required Field', 'Please enter your delivery address');
      return false;
    }
    if (!city.trim()) {
      Alert.alert('Required Field', 'Please enter your city');
      return false;
    }
    return true;
  };

  const handleSaveAndContinue = async () => {
    if (!validateFields()) {
      return;
    }

    setSaving(true);

    try {
      // Get existing user data
      const userStr = await AsyncStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : {};

      // Update user data with new information
      const updatedUser = {
        ...user,
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        city: city.trim(),
        profileComplete: true,
      };

      // Save updated user data
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));

      // Also save to userProfile for backward compatibility
      await AsyncStorage.setItem('userProfile', JSON.stringify(updatedUser));

      // Sync with AuthContext for app-wide consistency
      if (updateUser) {
        await updateUser({
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
          city: city.trim(),
        }).catch(err => console.log('AuthContext sync warning:', err));
      }

      Alert.alert('Success', 'Your details have been saved successfully', [
        {
          text: 'OK',
          onPress: () => {
            // Navigate based on returnTo parameter
            if (returnTo === 'checkout' && productId) {
              // Navigate to checkout with product details
              router.replace({
                pathname: '/checkout',
                params: {
                  productId,
                  productName,
                  productPrice,
                  discount,
                  quantity,
                  size,
                },
              });
            } else {
              // Go back to previous screen
              router.back();
            }
          }
        }
      ]);
    } catch (error) {
      console.error('Error saving user details:', error);
      Alert.alert('Error', 'Failed to save your details. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading your details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          bounces={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={24} color={COLORS.dark} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Complete Your Profile</Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* Info Banner */}
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle" size={24} color={COLORS.primary} />
            <Text style={styles.infoBannerText}>
              Please provide your contact and delivery information to proceed with your purchase.
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Name Field */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Full Name <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color={COLORS.mediumGray} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your full name"
                  placeholderTextColor={COLORS.mediumGray}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>
            </View>

            {/* Phone Field */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Phone Number <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.inputContainer}>
                <Ionicons name="call-outline" size={20} color={COLORS.mediumGray} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your phone number"
                  placeholderTextColor={COLORS.mediumGray}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  returnKeyType="next"
                />
              </View>
              <Text style={styles.helpText}>Include country code (e.g., +1 234 567 8900)</Text>
            </View>

            {/* Address Field */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Delivery Address <Text style={styles.required}>*</Text>
              </Text>
              <View style={[styles.inputContainer, styles.textAreaContainer]}>
                <Ionicons name="home-outline" size={20} color={COLORS.mediumGray} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Enter your complete delivery address"
                  placeholderTextColor={COLORS.mediumGray}
                  value={address}
                  onChangeText={setAddress}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  returnKeyType="next"
                />
              </View>
              <Text style={styles.helpText}>Include street, building, apartment number</Text>
            </View>

            {/* City Field */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                City <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.inputContainer}>
                <Ionicons name="location-outline" size={20} color={COLORS.mediumGray} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your city"
                  placeholderTextColor={COLORS.mediumGray}
                  value={city}
                  onChangeText={setCity}
                  autoCapitalize="words"
                  returnKeyType="done"
                  onSubmitEditing={handleSaveAndContinue}
                />
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Bottom Save Button */}
        <View style={styles.bottomButtonContainer}>
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSaveAndContinue}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color={COLORS.white} size="small" />
            ) : (
              <>
                <Text style={styles.saveButtonText}>Save & Continue</Text>
                <Ionicons name="checkmark-circle" size={20} color={COLORS.white} />
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: RESPONSIVE_SPACING.md,
    paddingVertical: RESPONSIVE_SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: RESPONSIVE_FONT.lg,
    fontWeight: '700',
    color: COLORS.dark,
    textAlign: 'center',
    marginHorizontal: SPACING.sm,
  },
  headerSpacer: {
    width: 40,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EFF6FF',
    margin: RESPONSIVE_SPACING.md,
    padding: RESPONSIVE_SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  infoBannerText: {
    flex: 1,
    marginLeft: SPACING.sm,
    fontSize: RESPONSIVE_FONT.sm,
    color: COLORS.dark,
    lineHeight: 20,
  },
  form: {
    paddingHorizontal: RESPONSIVE_SPACING.md,
  },
  formGroup: {
    marginBottom: RESPONSIVE_SPACING.lg,
  },
  label: {
    fontSize: RESPONSIVE_FONT.base,
    fontWeight: '600',
    color: COLORS.dark,
    marginBottom: SPACING.sm,
  },
  required: {
    color: '#EF4444',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.md,
    minHeight: 52,
  },
  textAreaContainer: {
    alignItems: 'flex-start',
    paddingVertical: SPACING.sm,
  },
  inputIcon: {
    marginRight: SPACING.sm,
  },
  input: {
    flex: 1,
    fontSize: RESPONSIVE_FONT.base,
    color: COLORS.dark,
    paddingVertical: SPACING.sm,
  },
  textArea: {
    minHeight: 80,
    paddingTop: SPACING.sm,
  },
  helpText: {
    fontSize: RESPONSIVE_FONT.xs,
    color: COLORS.mediumGray,
    marginTop: SPACING.xs,
    marginLeft: SPACING.xs,
  },
  bottomButtonContainer: {
    paddingHorizontal: RESPONSIVE_SPACING.md,
    paddingTop: RESPONSIVE_SPACING.md,
    paddingBottom: Platform.OS === 'android' ? RESPONSIVE_SPACING.lg : RESPONSIVE_SPACING.md,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: RESPONSIVE_SPACING.md + 4,
    borderRadius: BORDER_RADIUS.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 52,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: RESPONSIVE_FONT.base,
    fontWeight: '700',
    color: COLORS.white,
    marginRight: SPACING.sm,
    letterSpacing: 0.5,
  },
});
