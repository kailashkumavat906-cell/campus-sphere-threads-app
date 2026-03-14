import { api } from '@/convex/_generated/api';
import { useAuth } from '@clerk/clerk-expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation } from 'convex/react';
import { useCallback, useEffect, useState } from 'react';

const PRIVACY_KEYS = {
  showOnlineStatus: 'privacy_show_online_status',
  allowProfileSearch: 'privacy_allow_profile_search',
};

interface PrivacySettings {
  showOnlineStatus: boolean;
  allowProfileSearch: boolean;
}

const defaultSettings: PrivacySettings = {
  showOnlineStatus: true,
  allowProfileSearch: true,
};

export function usePrivacySettings() {
  const [settings, setSettings] = useState<PrivacySettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const { userId } = useAuth();
  const updateShowOnlineStatus = useMutation(api.users.updateShowOnlineStatus);
  const updateAllowProfileSearch = useMutation(api.users.updateAllowProfileSearch);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoading(true);
        
        const loadedSettings: PrivacySettings = { ...defaultSettings };
        
        // Load each setting from AsyncStorage
        for (const [key, storageKey] of Object.entries(PRIVACY_KEYS)) {
          const storedValue = await AsyncStorage.getItem(storageKey);
          if (storedValue !== null) {
            loadedSettings[key as keyof PrivacySettings] = storedValue === 'true';
          }
        }
        
        setSettings(loadedSettings);
      } catch (error) {
        console.error('Error loading privacy settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  // Update a single setting
  const updateSetting = useCallback(async (key: keyof PrivacySettings, value: boolean) => {
    try {
      // Update state immediately for responsive UI
      setSettings(prev => ({ ...prev, [key]: value }));
      
      // Persist to AsyncStorage
      await AsyncStorage.setItem(PRIVACY_KEYS[key], value.toString());
      
      // Sync show online status with Convex backend
      if (key === 'showOnlineStatus') {
        console.log('[PrivacySettings] Syncing showOnlineStatus to backend:', value);
        await updateShowOnlineStatus({ showOnlineStatus: value });
      }
      
      // Sync allow profile search with Convex backend
      if (key === 'allowProfileSearch') {
        console.log('[PrivacySettings] Syncing allowProfileSearch to backend:', value);
        await updateAllowProfileSearch({ allowProfileSearch: value });
      }
    } catch (error) {
      console.error('Error saving privacy setting:', error);
      // Revert on error
      setSettings(prev => ({ ...prev, [key]: !value }));
    }
  }, [updateShowOnlineStatus, updateAllowProfileSearch]);

  // Toggle a setting
  const toggleSetting = useCallback((key: keyof PrivacySettings) => {
    updateSetting(key, !settings[key]);
  }, [settings, updateSetting]);

  return {
    settings,
    isLoading,
    updateSetting,
    toggleSetting,
  };
}
