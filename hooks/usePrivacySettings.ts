import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const PRIVACY_KEYS = {
  privateAccount: 'privacy_private_account',
  showOnlineStatus: 'privacy_show_online_status',
  allowMessages: 'privacy_allow_messages',
  allowProfileSearch: 'privacy_allow_profile_search',
};

interface PrivacySettings {
  privateAccount: boolean;
  showOnlineStatus: boolean;
  allowMessages: boolean;
  allowProfileSearch: boolean;
}

const defaultSettings: PrivacySettings = {
  privateAccount: false,
  showOnlineStatus: true,
  allowMessages: true,
  allowProfileSearch: true,
};

export function usePrivacySettings() {
  const [settings, setSettings] = useState<PrivacySettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

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
    } catch (error) {
      console.error('Error saving privacy setting:', error);
      // Revert on error
      setSettings(prev => ({ ...prev, [key]: !value }));
    }
  }, []);

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
