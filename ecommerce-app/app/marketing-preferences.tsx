import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { COLORS, SPACING, BORDER_RADIUS } from '@/src/constants/colors';
import { RESPONSIVE_FONT, RESPONSIVE_SPACING } from '@/src/constants/responsive';
import { marketingAPI, categoriesAPI } from '../src/services/api';
import { useAuth } from '@/src/context/AuthContext';

interface MarketingPreferences {
  email_marketing: boolean;
  push_marketing: boolean;
  sms_marketing: boolean;
  category_preferences: number[];
}

interface Category {
  id: number;
  name: string;
  description?: string;
  image?: string;
}

export default function MarketingPreferencesScreen() {
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [preferences, setPreferences] = useState<MarketingPreferences>({
    email_marketing: false,
    push_marketing: false,
    sms_marketing: false,
    category_preferences: [],
  });

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [prefsRes, catsRes] = await Promise.all([
        marketingAPI.getPreferences(),
        categoriesAPI.getAll(),
      ]);

      if (prefsRes.success && prefsRes.preferences) {
        setPreferences({
          email_marketing: prefsRes.preferences.email_marketing || false,
          push_marketing: prefsRes.preferences.push_marketing || false,
          sms_marketing: prefsRes.preferences.sms_marketing || false,
          category_preferences: prefsRes.preferences.category_preferences || [],
        });
      }

      setCategories(catsRes.categories || []);
    } catch (error) {
      console.error('Error fetching marketing preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData().finally(() => setRefreshing(false));
  }, []);

  const toggleChannel = async (channel: 'email_marketing' | 'push_marketing' | 'sms_marketing') => {
    const newValue = !preferences[channel];
    const updatedPrefs = { ...preferences, [channel]: newValue };
    setPreferences(updatedPrefs);
    
    try {
      setSaving(true);
      await marketingAPI.updatePreferences(updatedPrefs);
    } catch (error) {
      // Revert on error
      setPreferences(prev => ({ ...prev, [channel]: !newValue }));
      console.error('Error updating preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  const toggleCategory = async (categoryId: number) => {
    const isCurrentlySelected = preferences.category_preferences.includes(categoryId);
    let newCategoryPrefs: number[];
    
    if (isCurrentlySelected) {
      newCategoryPrefs = preferences.category_preferences.filter(id => id !== categoryId);
    } else {
      newCategoryPrefs = [...preferences.category_preferences, categoryId];
    }
    
    const updatedPrefs = { ...preferences, category_preferences: newCategoryPrefs };
    setPreferences(updatedPrefs);
    
    try {
      setSaving(true);
      await marketingAPI.updatePreferences(updatedPrefs);
    } catch (error) {
      // Revert on error
      setPreferences(prev => ({ ...prev, category_preferences: isCurrentlySelected 
        ? [...prev.category_preferences, categoryId]
        : prev.category_preferences.filter(id => id !== categoryId)
      }));
      console.error('Error updating preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.dark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Marketing Preferences</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="mail-outline" size={64} color={COLORS.mediumGray} />
          <Text style={styles.emptyTitle}>Login Required</Text>
          <Text style={styles.emptySubtitle}>
            Please login to manage your marketing preferences
          </Text>
          <TouchableOpacity style={styles.loginButton} onPress={() => router.replace('/login' as any)}>
            <Text style={styles.loginButtonText}>Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.dark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Marketing Preferences</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading preferences...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Marketing Preferences</Text>
        <View style={styles.headerSpacer}>
          {saving && <ActivityIndicator size="small" color={COLORS.primary} />}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Info Section */}
        <View style={styles.infoSection}>
          <Ionicons name="information-circle-outline" size={24} color={COLORS.primary} />
          <Text style={styles.infoText}>
            Control what marketing communications you'd like to receive from us. 
            Your preferences are saved automatically.
          </Text>
        </View>

        {/* Benefits Section */}
        <View style={styles.benefitsSection}>
          <Text style={styles.benefitsSectionTitle}>Why Subscribe?</Text>
          <View style={styles.benefitsGrid}>
            <View style={styles.benefitItem}>
              <View style={[styles.benefitIcon, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="gift-outline" size={20} color="#F59E0B" />
              </View>
              <Text style={styles.benefitText}>Exclusive Deals</Text>
            </View>
            <View style={styles.benefitItem}>
              <View style={[styles.benefitIcon, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="flash-outline" size={20} color="#3B82F6" />
              </View>
              <Text style={styles.benefitText}>Early Access</Text>
            </View>
            <View style={styles.benefitItem}>
              <View style={[styles.benefitIcon, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="pricetag-outline" size={20} color="#10B981" />
              </View>
              <Text style={styles.benefitText}>Special Discounts</Text>
            </View>
            <View style={styles.benefitItem}>
              <View style={[styles.benefitIcon, { backgroundColor: '#EDE9FE' }]}>
                <Ionicons name="sparkles-outline" size={20} color="#8B5CF6" />
              </View>
              <Text style={styles.benefitText}>New Arrivals</Text>
            </View>
          </View>
        </View>

        {/* Communication Channels Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Communication Channels</Text>
          <Text style={styles.sectionSubtitle}>
            Choose how you'd like to receive marketing updates
          </Text>

          <View style={styles.card}>
            {/* Email Marketing */}
            <View style={styles.preferenceRow}>
              <View style={styles.preferenceLeft}>
                <View style={[styles.iconContainer, { backgroundColor: '#3B82F620' }]}>
                  <Ionicons name="mail-outline" size={22} color="#3B82F6" />
                </View>
                <View style={styles.preferenceTextContainer}>
                  <Text style={styles.preferenceTitle}>Email Marketing</Text>
                  <Text style={styles.preferenceDescription}>
                    Receive promotions and offers via email
                  </Text>
                </View>
              </View>
              <Switch
                value={preferences.email_marketing}
                onValueChange={() => toggleChannel('email_marketing')}
                trackColor={{ false: '#E5E5E5', true: `${COLORS.primary}50` }}
                thumbColor={preferences.email_marketing ? COLORS.primary : '#F4F4F4'}
              />
            </View>

            <View style={styles.divider} />

            {/* Push Notifications */}
            <View style={styles.preferenceRow}>
              <View style={styles.preferenceLeft}>
                <View style={[styles.iconContainer, { backgroundColor: '#8B5CF620' }]}>
                  <Ionicons name="phone-portrait-outline" size={22} color="#8B5CF6" />
                </View>
                <View style={styles.preferenceTextContainer}>
                  <Text style={styles.preferenceTitle}>Push Notifications</Text>
                  <Text style={styles.preferenceDescription}>
                    Get notified about deals on your device
                  </Text>
                </View>
              </View>
              <Switch
                value={preferences.push_marketing}
                onValueChange={() => toggleChannel('push_marketing')}
                trackColor={{ false: '#E5E5E5', true: `${COLORS.primary}50` }}
                thumbColor={preferences.push_marketing ? COLORS.primary : '#F4F4F4'}
              />
            </View>

            <View style={styles.divider} />

            {/* SMS Marketing */}
            <View style={styles.preferenceRow}>
              <View style={styles.preferenceLeft}>
                <View style={[styles.iconContainer, { backgroundColor: '#10B98120' }]}>
                  <Ionicons name="chatbubble-outline" size={22} color="#10B981" />
                </View>
                <View style={styles.preferenceTextContainer}>
                  <Text style={styles.preferenceTitle}>SMS Marketing</Text>
                  <Text style={styles.preferenceDescription}>
                    Receive text messages with exclusive offers
                  </Text>
                </View>
              </View>
              <Switch
                value={preferences.sms_marketing}
                onValueChange={() => toggleChannel('sms_marketing')}
                trackColor={{ false: '#E5E5E5', true: `${COLORS.primary}50` }}
                thumbColor={preferences.sms_marketing ? COLORS.primary : '#F4F4F4'}
              />
            </View>
          </View>
        </View>

        {/* Category Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Category Interests</Text>
          <Text style={styles.sectionSubtitle}>
            Select categories you're interested in to receive relevant offers
          </Text>

          <View style={styles.categoryGrid}>
            {categories.map((category) => {
              const isSelected = preferences.category_preferences.includes(category.id);
              return (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryChip,
                    isSelected && styles.categoryChipSelected,
                  ]}
                  onPress={() => toggleCategory(category.id)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      isSelected && styles.categoryChipTextSelected,
                    ]}
                  >
                    {category.name}
                  </Text>
                  {isSelected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color={COLORS.white}
                      style={styles.categoryCheckIcon}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {categories.length === 0 && (
            <View style={styles.noCategoriesContainer}>
              <Ionicons name="grid-outline" size={32} color={COLORS.mediumGray} />
              <Text style={styles.noCategoriesText}>No categories available</Text>
            </View>
          )}
        </View>

        {/* Privacy Note */}
        <View style={styles.privacyNote}>
          <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.success} />
          <Text style={styles.privacyText}>
            We respect your privacy. You can update these preferences anytime 
            and unsubscribe from all marketing communications.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.gray,
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
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.gray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: RESPONSIVE_FONT.lg,
    fontWeight: '700',
    color: COLORS.dark,
  },
  headerSpacer: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: RESPONSIVE_FONT.base,
    color: COLORS.mediumGray,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  emptyTitle: {
    fontSize: RESPONSIVE_FONT.xl,
    fontWeight: '700',
    color: COLORS.dark,
    marginTop: SPACING.lg,
  },
  emptySubtitle: {
    fontSize: RESPONSIVE_FONT.base,
    color: COLORS.mediumGray,
    textAlign: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  loginButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  loginButtonText: {
    color: COLORS.white,
    fontSize: RESPONSIVE_FONT.base,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  infoSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: `${COLORS.primary}10`,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  infoText: {
    flex: 1,
    fontSize: RESPONSIVE_FONT.sm,
    color: COLORS.dark,
    lineHeight: 20,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: RESPONSIVE_FONT.lg,
    fontWeight: '700',
    color: COLORS.dark,
    marginBottom: SPACING.xs,
  },
  sectionSubtitle: {
    fontSize: RESPONSIVE_FONT.sm,
    color: COLORS.mediumGray,
    marginBottom: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
  },
  preferenceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  preferenceTextContainer: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  preferenceTitle: {
    fontSize: RESPONSIVE_FONT.base,
    fontWeight: '600',
    color: COLORS.dark,
    marginBottom: 2,
  },
  preferenceDescription: {
    fontSize: RESPONSIVE_FONT.sm,
    color: COLORS.mediumGray,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginLeft: 72,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.xl,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  categoryChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryChipText: {
    fontSize: RESPONSIVE_FONT.sm,
    fontWeight: '500',
    color: COLORS.dark,
  },
  categoryChipTextSelected: {
    color: COLORS.white,
  },
  categoryCheckIcon: {
    marginLeft: SPACING.xs,
  },
  noCategoriesContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
  },
  noCategoriesText: {
    fontSize: RESPONSIVE_FONT.sm,
    color: COLORS.mediumGray,
    marginTop: SPACING.sm,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: `${COLORS.success}10`,
    borderRadius: BORDER_RADIUS.md,
  },
  privacyText: {
    flex: 1,
    fontSize: RESPONSIVE_FONT.sm,
    color: COLORS.dark,
    lineHeight: 20,
  },
  benefitsSection: {
    marginBottom: SPACING.lg,
  },
  benefitsSectionTitle: {
    fontSize: RESPONSIVE_FONT.base,
    fontWeight: '600',
    color: COLORS.dark,
    marginBottom: SPACING.md,
  },
  benefitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  benefitItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    gap: SPACING.sm,
  },
  benefitIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  benefitText: {
    flex: 1,
    fontSize: RESPONSIVE_FONT.sm,
    fontWeight: '500',
    color: COLORS.dark,
  },
});
