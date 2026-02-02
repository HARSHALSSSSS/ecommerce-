import React from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  FlexStyle,
} from 'react-native';
import { RESPONSIVE_SPACING } from '@/src/constants/responsive';

/**
 * Enhanced Container component with responsive padding and margins
 */
interface ContainerProps {
  children: React.ReactNode;
  padding?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  margin?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  paddingHorizontal?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  paddingVertical?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  marginHorizontal?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  marginVertical?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  gap?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  direction?: 'row' | 'column';
  align?: 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline';
  justify?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly';
  style?: ViewStyle;
}

const getSpacingValue = (size: string): number => {
  const spacing = {
    xs: RESPONSIVE_SPACING.xs,
    sm: RESPONSIVE_SPACING.sm,
    md: RESPONSIVE_SPACING.md,
    lg: RESPONSIVE_SPACING.lg,
    xl: RESPONSIVE_SPACING.xl,
    xxl: RESPONSIVE_SPACING.xxl,
  };
  return spacing[size as keyof typeof spacing] || 0;
};

export const Container: React.FC<ContainerProps> = ({
  children,
  padding,
  margin,
  paddingHorizontal,
  paddingVertical,
  marginHorizontal,
  marginVertical,
  gap,
  direction = 'column',
  align = 'stretch',
  justify = 'flex-start',
  style,
}) => {
  const containerStyle: ViewStyle = {
    flexDirection: direction as FlexStyle['flexDirection'],
    alignItems: align as FlexStyle['alignItems'],
    justifyContent: justify as FlexStyle['justifyContent'],
  };

  if (padding) {
    const spacingValue = getSpacingValue(padding);
    containerStyle.padding = spacingValue;
  }

  if (paddingHorizontal) {
    containerStyle.paddingHorizontal = getSpacingValue(paddingHorizontal);
  }

  if (paddingVertical) {
    containerStyle.paddingVertical = getSpacingValue(paddingVertical);
  }

  if (margin) {
    const spacingValue = getSpacingValue(margin);
    containerStyle.margin = spacingValue;
  }

  if (marginHorizontal) {
    containerStyle.marginHorizontal = getSpacingValue(marginHorizontal);
  }

  if (marginVertical) {
    containerStyle.marginVertical = getSpacingValue(marginVertical);
  }

  if (gap) {
    containerStyle.gap = getSpacingValue(gap);
  }

  return (
    <View style={[containerStyle, style]}>
      {children}
    </View>
  );
};

/**
 * Enhanced Spacer component for consistent spacing
 */
interface SpacerProps {
  height?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | number;
  width?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | number;
}

export const Spacer: React.FC<SpacerProps> = ({ height = 'md', width = 0 }) => {
  const heightValue = typeof height === 'string' ? getSpacingValue(height) : height;
  const widthValue = typeof width === 'string' ? getSpacingValue(width) : width;

  return (
    <View
      style={{
        height: heightValue,
        width: widthValue,
      }}
    />
  );
};

/**
 * Enhanced HStack (Horizontal Stack)
 */
interface HStackProps {
  children: React.ReactNode;
  gap?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  align?: 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline';
  justify?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly';
  style?: ViewStyle;
}

export const HStack: React.FC<HStackProps> = ({
  children,
  gap = 'md',
  align = 'center',
  justify = 'flex-start',
  style,
}) => {
  return (
    <Container
      direction="row"
      gap={gap}
      align={align}
      justify={justify}
      style={style}
    >
      {children}
    </Container>
  );
};

/**
 * Enhanced VStack (Vertical Stack)
 */
interface VStackProps {
  children: React.ReactNode;
  gap?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  align?: 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline';
  justify?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly';
  style?: ViewStyle;
}

export const VStack: React.FC<VStackProps> = ({
  children,
  gap = 'md',
  align = 'stretch',
  justify = 'flex-start',
  style,
}) => {
  return (
    <Container
      direction="column"
      gap={gap}
      align={align}
      justify={justify}
      style={style}
    >
      {children}
    </Container>
  );
};

/**
 * Divider component with responsive sizing
 */
interface DividerProps {
  color?: string;
  thickness?: 'thin' | 'medium' | 'thick';
  margin?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  orientation?: 'horizontal' | 'vertical';
}

export const Divider: React.FC<DividerProps> = ({
  color = '#E0E0E0',
  thickness = 'thin',
  margin = 'md',
  orientation = 'horizontal',
}) => {
  const thicknessMap = {
    thin: 1,
    medium: 2,
    thick: 4,
  };

  const marginValue = getSpacingValue(margin);

  return (
    <View
      style={{
        height: orientation === 'horizontal' ? thicknessMap[thickness] : '100%',
        width: orientation === 'vertical' ? thicknessMap[thickness] : '100%',
        backgroundColor: color,
        marginHorizontal: orientation === 'horizontal' ? 0 : marginValue,
        marginVertical: orientation === 'vertical' ? 0 : marginValue,
      }}
    />
  );
};

const styles = StyleSheet.create({
  // Additional styles can be added here if needed
});
