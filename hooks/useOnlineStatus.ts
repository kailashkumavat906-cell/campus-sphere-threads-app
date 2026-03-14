import { api } from '@/convex/_generated/api';
import { useMutation } from 'convex/react';
import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';

/**
 * Hook to automatically set user online/offline based on app state
 * Call this hook in the root layout to track user presence
 */
export function useOnlineStatus() {
  const setUserOnline = useMutation(api.users.setUserOnline);
  const setUserOffline = useMutation(api.users.setUserOffline);

  useEffect(() => {
    // Set user as online when app becomes active
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        console.log('[useOnlineStatus] App is active - setting user online');
        try {
          const result = await setUserOnline();
          console.log('[useOnlineStatus] Set online result:', result);
        } catch (error) {
          console.error('[useOnlineStatus] Error setting user online:', error);
        }
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        console.log('[useOnlineStatus] App is background - setting user offline');
        try {
          await setUserOffline();
        } catch (error) {
          console.error('[useOnlineStatus] Error setting user offline:', error);
        }
      }
    };

    // Subscribe to app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Set user online on mount
    setUserOnline().catch(console.error);

    return () => {
      // Clean up - set user offline when component unmounts
      setUserOffline().catch(console.error);
      subscription.remove();
    };
  }, [setUserOnline, setUserOffline]);
}
