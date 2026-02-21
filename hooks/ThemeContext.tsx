import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Appearance } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'system';

// Define color types
interface ThemeColors {
  // Original app colors
  background: string;
  text: string;
  tint: string;
  icon: string;
  border: string;
  cardBackground: string;
  surface: string;
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  danger: string;

  // Auth-specific colors
  authBackground: string;
  authBackgroundOverlay: string;
  authCardBackground: string;
  authCardShadow: string;
  authText: string;
  authTextSecondary: string;
  authTextPlaceholder: string;
  authInputBackground: string;
  authInputBorder: string;
  authInputText: string;
  authInputIcon: string;
  authGradient: string[];
  authButtonText: string;
  authIconPrimary: string;
  authDivider: string;
  authError: string;
  authErrorBackground: string;
  authSocialBackground: string;
  authSocialBorder: string;
  authSocialText: string;
  authLink: string;
  authStatusBar: 'light-content' | 'dark-content';
}

// Light theme colors
const lightColors: ThemeColors = {
  // Original app colors
  background: '#FFFFFF',
  text: '#000000',
  tint: '#007AFF',
  icon: '#8E8E93',
  border: '#E5E5EA',
  cardBackground: '#F2F2F7',
  surface: '#FFFFFF',
  primary: '#007AFF',
  secondary: '#F2F2F7',
  success: '#34C759',
  warning: '#FF9500',
  danger: '#FF3B30',

  // Auth-specific colors
  authBackground: '#E8EAF6',
  authBackgroundOverlay: '#E0E7FF',
  authCardBackground: '#FFFFFF',
  authCardShadow: '#000000',
  authText: '#1A1A2E',
  authTextSecondary: '#666666',
  authTextPlaceholder: '#999999',
  authInputBackground: '#F5F5F5',
  authInputBorder: '#E0E0E0',
  authInputText: '#1A1A2E',
  authInputIcon: '#666666',
  authGradient: ['#0095F6', '#8B5CF6', '#D53F8C'],
  authButtonText: '#FFFFFF',
  authIconPrimary: '#0095F6',
  authDivider: '#E0E0E0',
  authError: '#FF3B30',
  authErrorBackground: '#FFE8E8',
  authSocialBackground: '#FFFFFF',
  authSocialBorder: '#E0E0E0',
  authSocialText: '#333333',
  authLink: '#0095F6',
  authStatusBar: 'dark-content',
};

// Dark theme colors
const darkColors: ThemeColors = {
  // Original app colors
  background: '#000000',
  text: '#FFFFFF',
  tint: '#0A84FF',
  icon: '#8E8E93',
  border: '#38383A',
  cardBackground: '#1C1C1E',
  surface: '#1C1C1E',
  primary: '#0A84FF',
  secondary: '#1C1C1E',
  success: '#30D158',
  warning: '#FF9F0A',
  danger: '#FF453A',

  // Auth-specific colors (dark mode)
  authBackground: '#0A0A0F',
  authBackgroundOverlay: '#121218',
  authCardBackground: '#1C1C1E',
  authCardShadow: '#000000',
  authText: '#FFFFFF',
  authTextSecondary: '#A0A0A0',
  authTextPlaceholder: '#6B6B6B',
  authInputBackground: '#2C2C2E',
  authInputBorder: '#3A3A3C',
  authInputText: '#FFFFFF',
  authInputIcon: '#A0A0A0',
  authGradient: ['#0A84FF', '#7C3AED', '#E11D48'],
  authButtonText: '#FFFFFF',
  authIconPrimary: '#0A84FF',
  authDivider: '#3A3A3C',
  authError: '#FF453A',
  authErrorBackground: '#3A1A1A',
  authSocialBackground: '#2C2C2E',
  authSocialBorder: '#3A3A3C',
  authSocialText: '#FFFFFF',
  authLink: '#0A84FF',
  authStatusBar: 'light-content',
};

type ThemeContextType = {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  resolvedTheme: 'light' | 'dark';
  colors: ThemeColors;
  isDark: boolean;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  
  // Get initial system color scheme
  const getSystemColorScheme = useCallback((): 'light' | 'dark' => {
    return (Appearance.getColorScheme() ?? 'light') as 'light' | 'dark';
  }, []);

  // Load saved theme from storage and initialize
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('themeMode');
        if (savedTheme) {
          const loadedTheme = savedTheme as ThemeMode;
          setThemeState(loadedTheme);
          
          if (loadedTheme === 'system') {
            setResolvedTheme(getSystemColorScheme());
          } else {
            setResolvedTheme(loadedTheme);
          }
        } else {
          // Default to system theme
          setResolvedTheme(getSystemColorScheme());
        }
      } catch (error) {
        console.error('Failed to load theme:', error);
        // Fallback to system theme
        setResolvedTheme(getSystemColorScheme());
      }
    };
    loadTheme();
  }, [getSystemColorScheme]);

  // Listen for system theme changes only when in system mode
  useEffect(() => {
    // Only add listener if theme is 'system'
    if (theme !== 'system') {
      return;
    }

    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      const resolved = (colorScheme ?? 'light') as 'light' | 'dark';
      setResolvedTheme(resolved);
      console.log('System theme changed to:', resolved);
    });

    return () => {
      subscription.remove();
    };
  }, [theme]);

  const setTheme = useCallback(async (newTheme: ThemeMode) => {
    // Trigger haptic feedback
    Haptics.selectionAsync();
    
    setThemeState(newTheme);
    
    try {
      await AsyncStorage.setItem('themeMode', newTheme);
    } catch (error) {
      console.error('Failed to save theme:', error);
    }

    // Apply the new theme
    if (newTheme === 'system') {
      setResolvedTheme(getSystemColorScheme());
    } else {
      setResolvedTheme(newTheme);
    }
  }, [getSystemColorScheme]);

  const colors = resolvedTheme === 'dark' ? darkColors : lightColors;
  const isDark = resolvedTheme === 'dark';

  const value: ThemeContextType = {
    theme,
    setTheme,
    resolvedTheme,
    colors,
    isDark,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeContext() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
}

// Helper hook for color scheme that respects our theme mode
export function useThemeColorScheme(): 'light' | 'dark' {
  const { resolvedTheme } = useThemeContext();
  return resolvedTheme;
}
