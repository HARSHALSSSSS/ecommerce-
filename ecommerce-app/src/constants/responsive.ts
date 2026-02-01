import { Dimensions, Platform, PixelRatio } from 'react-native';

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

// Normalize font size across different screen densities
const fontScale = PixelRatio.getFontScale();
const normalizedFontScale = fontScale > 1.3 ? 1.3 : fontScale; // Cap font scaling

// Responsive font sizes
export const RESPONSIVE_FONT = {
  xs: Math.round((width < 360 ? 10 : 11) / normalizedFontScale),
  sm: Math.round((width < 360 ? 12 : 13) / normalizedFontScale),
  base: Math.round((width < 360 ? 14 : 15) / normalizedFontScale),
  lg: Math.round((width < 360 ? 16 : 17) / normalizedFontScale),
  xl: Math.round((width < 360 ? 18 : 20) / normalizedFontScale),
  xxl: Math.round((width < 360 ? 22 : 24) / normalizedFontScale),
  xxxl: Math.round((width < 360 ? 28 : 32) / normalizedFontScale),
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

// Vertical scale for height-related values
export const verticalScale = (value: number) => {
  return (height / 812) * value; // Scale based on standard iPhone X height
};

// Moderate scale for values that shouldn't scale too much
export const moderateScale = (value: number, factor = 0.5) => {
  return value + (scale(value) - value) * factor;
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

// Header height based on device
export const getHeaderHeight = () => {
  if (Platform.OS === 'ios') {
    return height > 800 ? 56 : 48; // Taller for notched devices
  }
  return 56;
};

// Touch target size (minimum 44pt for accessibility)
export const TOUCH_TARGET_SIZE = Math.max(44, scale(44));

// Bottom navigation bar safe padding (for Android gesture navigation)
export const BOTTOM_TAB_HEIGHT = Platform.OS === 'android' ? 80 : 70;
export const BOTTOM_SAFE_PADDING = Platform.OS === 'android' ? 24 : (height > 800 ? 34 : 0);

// Back button container style helper
export const getBackButtonStyle = () => ({
  width: 40,
  height: 40,
  justifyContent: 'center' as const,
  alignItems: 'center' as const,
  borderRadius: 20,
  backgroundColor: 'rgba(255, 255, 255, 0.9)',
});

