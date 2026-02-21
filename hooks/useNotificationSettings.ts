import { useAuth, useUser } from '@clerk/clerk-expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const NOTIFICATIONS_ENABLED_KEY = 'notifications_enabled';

export function useNotificationSettings() {
  const { isLoaded: isAuthLoaded, isSignedIn, getToken } = useAuth();
  const { user, isLoaded: isUserLoaded } = useUser();
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState(true);

  // Load notification setting on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoading(true);
        
        // If user is signed in, try to get from Clerk metadata first
        if (isSignedIn && user?.publicMetadata?.notificationsEnabled !== undefined) {
          const clerkValue = user.publicMetadata.notificationsEnabled as boolean;
          setNotificationsEnabled(clerkValue);
          // Also save to AsyncStorage for offline access
          await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, clerkValue.toString());
        } else {
          // Fallback to AsyncStorage
          const storedValue = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
          if (storedValue !== null) {
            setNotificationsEnabled(storedValue === 'true');
          } else {
            // Default to true if nothing stored
            setNotificationsEnabled(true);
          }
        }
      } catch (error) {
        console.error('Error loading notification settings:', error);
        setNotificationsEnabled(true); // Default to true on error
      } finally {
        setIsLoading(false);
      }
    };

    if (isAuthLoaded && isUserLoaded) {
      loadSettings();
    }
  }, [isAuthLoaded, isUserLoaded, isSignedIn, user?.publicMetadata]);

  // Toggle notifications
  const toggleNotifications = useCallback(async () => {
    try {
      const newValue = !notificationsEnabled;
      setNotificationsEnabled(newValue);
      
      // Save to AsyncStorage
      await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, newValue.toString());
      
      // If user is signed in, also update Clerk metadata
      if (isSignedIn && user) {
        try {
          // Note: For Clerk metadata updates, you would typically use the Clerk API
          // This is a client-side update attempt - actual implementation may vary
          console.log('Would update Clerk metadata for notifications:', newValue);
        } catch (clerkError) {
          console.error('Error updating Clerk metadata:', clerkError);
        }
      }
    } catch (error) {
      console.error('Error saving notification setting:', error);
      // Revert on error
      setNotificationsEnabled(!notificationsEnabled);
    }
  }, [notificationsEnabled, isSignedIn, user]);

  return {
    notificationsEnabled,
    isLoading,
    toggleNotifications,
  };
}
