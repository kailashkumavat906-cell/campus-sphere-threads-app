import { NativeModules, Platform } from 'react-native';

// Device type based on platform
export type DeviceType = 'mobile' | 'desktop';

export interface DeviceInfo {
  deviceName: string;
  deviceType: DeviceType;
  deviceInfo: string;
}

/**
 * Get device information based on the platform
 * This function should only be called on the client side
 */
export function getDeviceInfo(): DeviceInfo {
  // Default values for SSR or when platform is not available
  let platform = 'unknown';
  let isMobile = false;
  let isTablet = false;
  
  try {
    platform = Platform?.OS || 'web';
    isMobile = platform === 'ios' || platform === 'android';
  } catch (e) {
    // If Platform is not available (e.g., SSR), default to web
    platform = 'web';
    isMobile = false;
  }
  
  let deviceName = 'Unknown Device';
  let deviceType: DeviceType = 'mobile';
  
  if (isMobile) {
    deviceType = 'mobile';
    // Try to get device model
    if (platform === 'ios') {
      try {
        const { PlatformConstants } = NativeModules;
        if (PlatformConstants) {
          const { interfaceIdiom } = PlatformConstants;
          if (interfaceIdiom === 'pad') {
            deviceName = 'iPad';
            isTablet = true;
          } else {
            deviceName = 'iPhone';
          }
        } else {
          deviceName = 'iPhone';
        }
      } catch (e) {
        deviceName = 'iPhone';
      }
    } else if (platform === 'android') {
      // Try to detect if it's a tablet
      try {
        const { PlatformConstants } = NativeModules;
        if (PlatformConstants) {
          const { interfaceIdiom } = PlatformConstants;
          if (interfaceIdiom === 'pad') {
            deviceName = 'Android Tablet';
            isTablet = true;
          } else {
            deviceName = 'Android Phone';
          }
        } else {
          deviceName = 'Android Phone';
        }
      } catch (e) {
        deviceName = 'Android Phone';
      }
    }
  } else {
    deviceType = 'desktop';
    deviceName = 'Web Browser';
  }
  
  const deviceLabel = isTablet ? 'Tablet' : (deviceType === 'mobile' ? 'Phone' : 'Browser');
  
  return {
    deviceName,
    deviceType,
    deviceInfo: `${platform} - ${deviceName}`,
  };
}

/**
 * Get device name from user agent string (for web)
 */
export function getDeviceNameFromUA(userAgent: string): DeviceInfo {
  let deviceName = 'Unknown Device';
  let deviceType: DeviceType = 'desktop';
  
  // Check for mobile devices
  if (/mobile|android|iphone|ipad|ipod|iphone/i.test(userAgent)) {
    deviceType = 'mobile';
    
    if (/ipad/i.test(userAgent)) {
      deviceName = 'iPad';
    } else if (/iphone/i.test(userAgent)) {
      deviceName = 'iPhone';
    } else if (/android/i.test(userAgent)) {
      // Try to extract Android device name
      const androidMatch = userAgent.match(/Android[^;]+;([^;]+)/);
      if (androidMatch && androidMatch[1]) {
        deviceName = androidMatch[1].trim();
      } else {
        deviceName = 'Android Device';
      }
    } else {
      deviceName = 'Mobile Device';
    }
  } else {
    // Desktop - check browser
    deviceType = 'desktop';
    
    if (/chrome/i.test(userAgent)) {
      deviceName = 'Windows Chrome';
    } else if (/firefox/i.test(userAgent)) {
      deviceName = 'Windows Firefox';
    } else if (/safari/i.test(userAgent)) {
      deviceName = 'macOS Safari';
    } else if (/edge/i.test(userAgent)) {
      deviceName = 'Windows Edge';
    } else {
      deviceName = 'Desktop Browser';
    }
  }
  
  return {
    deviceName,
    deviceType,
    deviceInfo: userAgent,
  };
}

/**
 * Format device type for display
 */
export function formatDeviceType(deviceType: DeviceType): string {
  return deviceType === 'mobile' ? 'Mobile' : 'Desktop';
}
