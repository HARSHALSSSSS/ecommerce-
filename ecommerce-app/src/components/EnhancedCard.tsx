import React from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  Platform,
} from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '@/src/constants/colors';
import { RESPONSIVE_SPACING, RESPONSIVE_DIMENSION } from '@/src/constants/responsive';

interface EnhancedCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: 'small' | 'medium' | 'large';
  borderRadius?: 'small' | 'medium' | 'large';
  shadow?: 'small' | 'medium' | 'large' | 'none';
  backgroundColor?: string;
  variant?: 'default' | 'elevated' | 'outlined';
}

export const EnhancedCard: React.FC<EnhancedCardProps> = ({
  children,
  style,
  padding = 'medium',
  borderRadius = 'medium',
  shadow = 'small',
  backgroundColor = COLORS.white,
  variant = 'default',
}) => {
  const getPaddingStyle = () => {
    switch (padding) {
      case 'small':
        return RESPONSIVE_SPACING.md;
      case 'large':
        return RESPONSIVE_SPACING.xl;
      case 'medium':
      default:
        return RESPONSIVE_SPACING.lg;
    }
  };

  const getBorderRadiusStyle = () => {
    switch (borderRadius) {
      case 'small':
        return RESPONSIVE_DIMENSION.cardBorderRadius - 4;
      case 'large':
        return RESPONSIVE_DIMENSION.cardBorderRadius + 4;
      case 'medium':
      default:
        return RESPONSIVE_DIMENSION.cardBorderRadius;
    }
  };

  const getShadowStyle = () => {
    if (shadow === 'none') return {};

    const shadowLevel = {
      small: { opacity: 0.08, radius: 2, offset: 1 },
      medium: { opacity: 0.12, radius: 4, offset: 2 },
      large: { opacity: 0.15, radius: 8, offset: 4 },
    }[shadow];

    return {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: shadowLevel.offset },
      shadowOpacity: shadowLevel.opacity,
      shadowRadius: shadowLevel.radius,
      elevation: shadow === 'small' ? 2 : shadow === 'medium' ? 4 : 6,
    };
  };

  const getVariantStyle = () => {
    switch (variant) {
      case 'outlined':
        return {
          borderWidth: 1,
          borderColor: COLORS.lightGray,
          backgroundColor: 'transparent',
        };
      case 'elevated':
        return {
          backgroundColor: COLORS.white,
          borderWidth: 0,
        };
      case 'default':
      default:
        return {
          backgroundColor,
          borderWidth: 0,
        };
    }
  };

  return (
    <View
      style={[
        styles.card,
        {
          padding: getPaddingStyle(),
          borderRadius: getBorderRadiusStyle(),
        },
        getShadowStyle(),
        getVariantStyle(),
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 2 },
      },
      android: {
        elevation: 3,
      },
    }),
  },
});
