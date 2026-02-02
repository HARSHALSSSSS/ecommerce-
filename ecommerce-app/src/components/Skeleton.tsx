import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  ViewStyle,
  Dimensions,
} from 'react-native';
import { COLORS } from '@/src/constants/colors';
import { RESPONSIVE_SPACING, RESPONSIVE_DIMENSION } from '@/src/constants/responsive';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
  variant?: 'text' | 'circle' | 'product' | 'button';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 16,
  borderRadius = 8,
  style,
  variant = 'text',
}) => {
  const shimmerAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    shimmer.start();
    return () => shimmer.stop();
  }, [shimmerAnim]);

  const getVariantDimensions = () => {
    const numericWidth = typeof width === 'string' ? (Dimensions.get('window').width - RESPONSIVE_SPACING.lg * 2) : width;
    
    switch (variant) {
      case 'circle':
        return {
          width: height,
          height,
          borderRadius: height / 2,
        };
      case 'product':
        return {
          width: (Dimensions.get('window').width - RESPONSIVE_SPACING.lg * 2 - RESPONSIVE_SPACING.md) / 2,
          height: RESPONSIVE_DIMENSION.productImageHeight + 100,
          borderRadius: RESPONSIVE_DIMENSION.productImageBorderRadius,
        };
      case 'button':
        return {
          width: numericWidth,
          height: RESPONSIVE_DIMENSION.buttonHeight,
          borderRadius: RESPONSIVE_DIMENSION.buttonBorderRadius,
        };
      case 'text':
      default:
        return {
          width: numericWidth,
          height,
          borderRadius,
        };
    }
  };

  const opacityAnimation = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  const dimensions = getVariantDimensions();

  return (
    <Animated.View
      style={[
        styles.skeleton,
        dimensions,
        { opacity: opacityAnimation },
        style,
      ]}
    />
  );
};

interface SkeletonGroupProps {
  count: number;
  variant?: 'text' | 'product';
  spacing?: number;
  style?: ViewStyle;
}

export const SkeletonGroup: React.FC<SkeletonGroupProps> = ({
  count,
  variant = 'text',
  spacing = RESPONSIVE_SPACING.md,
  style,
}) => {
  return (
    <View style={[{ gap: spacing }, style]}>
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} variant={variant} />
      ))}
    </View>
  );
};

interface ProductSkeletonProps {
  count?: number;
  style?: ViewStyle;
}

export const ProductSkeleton: React.FC<ProductSkeletonProps> = ({
  count = 2,
  style,
}) => {
  return (
    <View
      style={[
        styles.productGrid,
        style,
      ]}
    >
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton
          key={index}
          variant="product"
          style={styles.productSkeletonItem}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: COLORS.lightGray,
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: RESPONSIVE_SPACING.md,
  },
  productSkeletonItem: {
    flex: 1,
    minWidth: (Dimensions.get('window').width - RESPONSIVE_SPACING.lg * 2 - RESPONSIVE_SPACING.md) / 2,
  },
});
