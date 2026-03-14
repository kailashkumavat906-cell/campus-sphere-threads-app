import { api } from '@/convex/_generated/api';
import { getDeviceInfo, type DeviceType } from '@/utils/device';
import { useMutation } from 'convex/react';
import { useEffect, useState } from 'react';

interface SessionInfo {
  deviceName: string;
  deviceType: DeviceType;
  deviceInfo: string;
}

/**
 * Hook to create a session when user logs in
 * Call this after successful authentication
 */
export function useDeviceSession(clerkId: string | null | undefined) {
  const [isSessionCreated, setIsSessionCreated] = useState(false);
  const createSession = useMutation(api.sessions.createSession);

  useEffect(() => {
    if (!clerkId || isSessionCreated) return;

    const createNewSession = async () => {
      try {
        const deviceInfo = getDeviceInfo();
        
        await createSession({
          clerkId,
          deviceName: deviceInfo.deviceName,
          deviceType: deviceInfo.deviceType,
          deviceInfo: deviceInfo.deviceInfo,
        });
        
        setIsSessionCreated(true);
        console.log('Session created successfully');
      } catch (error) {
        console.error('Failed to create session:', error);
      }
    };

    createNewSession();
  }, [clerkId, createSession, isSessionCreated]);

  return { isSessionCreated };
}

/**
 * Hook to update session last active time
 * Call this periodically or on user actions
 */
export function useUpdateSessionLastActive(clerkId: string | null | undefined) {
  const updateLastActive = useMutation(api.sessions.updateLastActiveByClerkId);

  const updateActive = async () => {
    if (!clerkId) return;
    
    try {
      await updateLastActive({ clerkId });
    } catch (error) {
      console.error('Failed to update last active:', error);
    }
  };

  return { updateActive };
}

/**
 * Get current device info
 */
export function useDeviceInfo(): SessionInfo {
  const [deviceInfo, setDeviceInfo] = useState<SessionInfo>({
    deviceName: 'Unknown Device',
    deviceType: 'mobile',
    deviceInfo: '',
  });

  useEffect(() => {
    const info = getDeviceInfo();
    setDeviceInfo(info);
  }, []);

  return deviceInfo;
}
