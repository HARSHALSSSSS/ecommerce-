import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../services/api';
import { initializePushNotifications, unregisterPushToken } from '../services/pushNotifications';

interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  updateUser: (data: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const userStr = await AsyncStorage.getItem('user');

      if (token && userStr) {
        const userData = JSON.parse(userStr);
        // Use cached user data immediately for fast startup
        setUser(userData);
        setIsLoading(false);
        
        // Validate token in background (non-blocking)
        setTimeout(async () => {
          try {
            const response = await authAPI.getProfile();
            if (response.success) {
              setUser(response.user);
              await AsyncStorage.setItem('user', JSON.stringify(response.user));
              initializePushNotifications().catch(() => {});
            }
          } catch (error) {
            // Token expired - clear session
            console.log('Token validation failed, clearing session');
            await AsyncStorage.removeItem('userToken');
            await AsyncStorage.removeItem('user');
            setUser(null);
          }
        }, 100);
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await authAPI.login(email, password);
      
      if (response.success) {
        setUser(response.user);
        // Initialize push notifications after successful login
        initializePushNotifications().catch(console.error);
        return { success: true };
      } else {
        return { success: false, message: response.message || 'Invalid email or password' };
      }
    } catch (error: any) {
      console.error('Login error in AuthContext:', error);
      // Determine the appropriate error message
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        return { success: false, message: 'Connection timed out. Please check your internet and try again.' };
      } else if (error.message?.includes('Network Error') || !error.response) {
        return { success: false, message: 'Unable to connect. Please check your internet connection.' };
      } else if (error.response?.status === 401 || error.response?.status === 400) {
        return { success: false, message: error.response?.data?.message || 'Invalid email or password' };
      }
      return { success: false, message: 'Something went wrong. Please try again.' };
    }
  };

  const register = async (name: string, email: string, password: string) => {
    try {
      const response = await authAPI.register(name, email, password);
      
      if (response.success) {
        setUser(response.user);
        // Initialize push notifications after successful registration
        initializePushNotifications().catch(console.error);
        return { success: true };
      } else {
        return { success: false, message: response.message || 'Registration failed' };
      }
    } catch (error: any) {
      console.error('Register error in AuthContext:', error);
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        return { success: false, message: 'Connection timed out. Please check your internet and try again.' };
      } else if (error.message?.includes('Network Error') || !error.response) {
        return { success: false, message: 'Unable to connect. Please check your internet connection.' };
      } else if (error.response?.status === 409) {
        return { success: false, message: 'An account with this email already exists' };
      }
      return { success: false, message: 'Something went wrong. Please try again.' };
    }
  };

  const logout = async () => {
    try {
      // Unregister push token before logout
      await unregisterPushToken();
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
    }
  };

  const updateUser = async (data: Partial<User>) => {
    if (user) {
      try {
        // Update on backend
        const response = await authAPI.updateProfile(data);
        if (response.success && response.user) {
          setUser(response.user);
          await AsyncStorage.setItem('user', JSON.stringify(response.user));
        } else {
          // Fallback to local update
          const updatedUser = { ...user, ...data };
          setUser(updatedUser);
          await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
        }
      } catch (error) {
        console.error('Update profile error:', error);
        // Fallback to local update
        const updatedUser = { ...user, ...data };
        setUser(updatedUser);
        await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
