import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Platform,
  Animated,
  Pressable,
  View,
  ActivityIndicator,
} from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '@/src/constants/colors';
import { RESPONSIVE_FONT, RESPONSIVE_SPACING, RESPONSIVE_DIMENSION } from '@/src/constants/responsive';

interface EnhancedButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const EnhancedButton: React.FC<EnhancedButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = false,
  icon,
  style,
  textStyle,
}) => {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (!disabled && !loading) {
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver: true,
        speed: 50,
        bounciness: 10,
      }).start();
    }
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 10,
    }).start();
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          height: RESPONSIVE_DIMENSION.buttonHeight - 4,
          paddingHorizontal: RESPONSIVE_SPACING.md,
          fontSize: RESPONSIVE_FONT.sm,
        };
      case 'large':
        return {
          height: RESPONSIVE_DIMENSION.buttonHeight + 4,
          paddingHorizontal: RESPONSIVE_SPACING.lg,
          fontSize: RESPONSIVE_FONT.lg,
        };
      case 'medium':
      default:
        return {
          height: RESPONSIVE_DIMENSION.buttonHeight,
          paddingHorizontal: RESPONSIVE_SPACING.lg,
          fontSize: RESPONSIVE_FONT.base,
        };
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'secondary':
        return {
          backgroundColor: COLORS.lightGray,
          borderColor: COLORS.gray,
          borderWidth: 1,
        };
      case 'danger':
        return {
          backgroundColor: COLORS.error,
          borderColor: COLORS.error,
          borderWidth: 1,
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderColor: COLORS.primary,
          borderWidth: 2,
        };
      case 'primary':
      default:
        return {
          backgroundColor: COLORS.primary,
          borderColor: COLORS.primary,
          borderWidth: 0,
        };
    }
  };

  const getTextColor = () => {
    switch (variant) {
      case 'outline':
        return COLORS.primary;
      case 'secondary':
      case 'danger':
        return disabled ? COLORS.mediumGray : COLORS.dark;
      case 'primary':
      default:
        return COLORS.white;
    }
  };

  const sizeStyles = getSizeStyles();
  const variantStyles = getVariantStyles();
  const textColor = getTextColor();

  return (
    <Animated.View
      style={[
        {
          transform: [{ scale: scaleAnim }],
          width: fullWidth ? '100%' : 'auto',
        },
      ]}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        activeOpacity={0.8}
        style={[
          styles.button,
          sizeStyles,
          variantStyles,
          disabled && styles.disabledButton,
          fullWidth && { width: '100%' },
          style,
        ]}
      >
        <View style={styles.buttonContent}>
          {loading ? (
            <ActivityIndicator size="small" color={textColor} />
          ) : (
            <>
              {icon && <View style={styles.iconContainer}>{icon}</View>}
              <Text
                style={[
                  styles.buttonText,
                  {
                    color: disabled ? COLORS.mediumGray : textColor,
                    fontSize: sizeStyles.fontSize,
                  },
                  textStyle,
                ]}
                numberOfLines={1}
              >
                {title}
              </Text>
            </>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: RESPONSIVE_DIMENSION.buttonBorderRadius,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: RESPONSIVE_SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    ...Platform.select({
      ios: {
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontWeight: '600',
    textAlign: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  iconContainer: {
    marginRight: RESPONSIVE_SPACING.sm,
  },
});
