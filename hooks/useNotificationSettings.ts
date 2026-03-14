import { api } from '@/convex/_generated/api';
import { useAuth, useUser } from '@clerk/clerk-expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery } from 'convex/react';
import { useCallback, useEffect, useState } from 'react';

const NOTIFICATIONS_ENABLED_KEY = 'notifications_enabled';

export function useNotificationSettings() {
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { user, isLoaded: isUserLoaded } = useUser();
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState(true);
  
  // Use the existing convex mutation to update notification settings
  const updateNotificationSetting = useMutation(api.users.updateNotificationSettings);
  
  // Query to get current notification settings from database
  const dbSettings = useQuery(api.users.getNotificationSettings);

  // Load notification setting on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoading(true);
        
        // First try to use database settings
        if (dbSettings !== undefined && dbSettings !== null) {
          setNotificationsEnabled(dbSettings.enableNotifications ?? true);
          await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, (dbSettings.enableNotifications ?? true).toString());
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
  }, [isAuthLoaded, isUserLoaded, dbSettings]);

  // Toggle notifications - now saves to both AsyncStorage and Convex database
  const toggleNotifications = useCallback(async () => {
    try {
      const newValue = !notificationsEnabled;
      
      // Update state immediately for responsive UI
      setNotificationsEnabled(newValue);
      
      // Save to AsyncStorage for offline access
      await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, newValue.toString());
      
      // Update Convex database if user is signed in
      if (isSignedIn) {
        await updateNotificationSetting({ enableNotifications: newValue });
        console.log('Notification setting updated in database:', newValue);
      }
    } catch (error) {
      console.error('Error saving notification setting:', error);
      // Revert on error
      setNotificationsEnabled(!notificationsEnabled);
    }
  }, [notificationsEnabled, isSignedIn, updateNotificationSetting]);

  return {
    notificationsEnabled,
    isLoading,
    toggleNotifications,
  };
}
