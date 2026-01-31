import { Dimensions, Platform } from 'react-native';

const { width, height } = Dimensions.get('window');

// Breakpoints for different device sizes
export const DEVICE = {
  // Screen dimensions
  screenWidth: width,
  screenHeight: height,
  
  // Device type detection
  isSmallPhone: width < 360,      // iPhone SE, small Android
  isMediumPhone: width >= 360 && width < 410, // iPhone 12/13
  isLargePhone: width >= 410,     // iPhone 14 Pro Max, large Android
  isTablet: width > 600,          // Tablets
  
  // Safe area considerations
  isNotch: height > 800 && Platform.OS === 'ios',
};

// Responsive font sizes
export const RESPONSIVE_FONT = {
  xs: width < 360 ? 10 : 11,
  sm: width < 360 ? 12 : 13,
  base: width < 360 ? 14 : 15,
  lg: width < 360 ? 16 : 17,
  xl: width < 360 ? 18 : 20,
  xxl: width < 360 ? 22 : 24,
  xxxl: width < 360 ? 28 : 32,
};

// Responsive spacing
export const RESPONSIVE_SPACING = {
  xs: width < 360 ? 2 : 4,
  sm: width < 360 ? 4 : 6,
  md: width < 360 ? 8 : 12,
  lg: width < 360 ? 12 : 16,
  xl: width < 360 ? 16 : 20,
  xxl: width < 360 ? 20 : 24,
  xxxl: width < 360 ? 24 : 32,
};

// Responsive dimensions
export const RESPONSIVE_DIMENSION = {
  // Product grid calculations
  productGridGap: width < 360 ? 8 : 12,
  productCardWidth: (width - (width < 360 ? 28 : 36) - (width < 360 ? 8 : 12)) / 2,
  productImageHeight: width < 360 ? 140 : 180,
  productImageBorderRadius: width < 360 ? 8 : 12,
  
  // Icon sizes
  iconSmall: width < 360 ? 18 : 20,
  iconMedium: width < 360 ? 24 : 26,
  iconLarge: width < 360 ? 32 : 36,
  
  // Button dimensions
  buttonHeight: width < 360 ? 44 : 48,
  buttonBorderRadius: width < 360 ? 10 : 12,
  
  // Card dimensions
  cardBorderRadius: width < 360 ? 10 : 16,
  cardPadding: width < 360 ? 10 : 12,
  
  // Input dimensions
  inputHeight: width < 360 ? 40 : 48,
  inputBorderRadius: width < 360 ? 8 : 12,
  inputPadding: width < 360 ? 10 : 12,
  
  // Section header
  sectionTitleSize: width < 360 ? 15 : 18,
  
  // Modal dimensions
  modalBorderRadius: width < 360 ? 16 : 24,
};

// Responsive line heights
export const RESPONSIVE_LINEHEIGHT = {
  tight: width < 360 ? 1.2 : 1.3,
  normal: width < 360 ? 1.4 : 1.5,
  relaxed: width < 360 ? 1.6 : 1.8,
};

// Safe area calculation
export const SAFE_AREA_PADDING = {
  top: Platform.OS === 'ios' ? (height > 800 ? 44 : 20) : 0,
  bottom: Platform.OS === 'ios' ? (height > 800 ? 34 : 0) : 0,
};

// Media query-like helper
export const scale = (value: number) => {
  return (width / 375) * value; // Scale based on standard iPhone width
};

// Get optimal product columns based on screen width
export const getProductColumns = () => {
  if (width < 360) return 2;
  if (width > 600) return 3;
  return 2;
};

// Get optimal padding based on screen width
export const getScreenPadding = () => {
  if (width < 360) return 12;
  if (width < 410) return 16;
  return 20;
};
