import { api } from '@/convex/_generated/api';
import { useThemeContext } from '@/hooks/ThemeContext';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface LoginDevice {
  _id: string;
  deviceName: string;
  deviceType: 'mobile' | 'desktop';
  loginTime: number;
  lastActive: number;
  isCurrentDevice: boolean;
  deviceInfo?: string;
}

export default function LoginActivityScreen() {
  const { top } = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useThemeContext();
  const { userId } = useAuth();
  
  // Fetch all sessions for the current user
  const sessions = useQuery(api.sessions.getUserSessions, { 
    clerkId: userId || '' 
  });

  const handleGoBack = useCallback(() => {
    router.dismiss();
  }, [router]);

  // Improved relative time formatter
  const formatRelativeTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    // Less than 1 minute
    if (seconds < 60) {
      return 'Active now';
    }
    
    // Less than 1 hour
    if (minutes < 60) {
      return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
    }
    
    // Less than 24 hours
    if (hours < 24) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }
    
    // Yesterday
    if (days === 1) {
      return 'Yesterday';
    }
    
    // Less than 7 days
    if (days < 7) {
      return `${days} days ago`;
    }
    
    // More than 7 days - show date
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  // Format login time
  const formatLoginTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Get device icon based on type
  const getDeviceIcon = (deviceType: 'mobile' | 'desktop', deviceName: string) => {
    if (deviceName.toLowerCase().includes('iphone') || deviceName.toLowerCase().includes('android')) {
      return 'phone-portrait';
    }
    if (deviceName.toLowerCase().includes('ipad') || deviceName.toLowerCase().includes('tablet')) {
      return 'tablet-portrait';
    }
    if (deviceName.toLowerCase().includes('web') || deviceName.toLowerCase().includes('browser')) {
      return 'globe-outline';
    }
    return 'device-mobile';
  };

  // Transform sessions to the format needed for display
  const loginDevices = useMemo((): LoginDevice[] => {
    if (!sessions) return [];
    return sessions;
  }, [sessions]);

  const renderDeviceItem = ({ item }: { item: LoginDevice }) => {
    const deviceIcon = getDeviceIcon(item.deviceType, item.deviceName);
    
    return (
      <View style={[styles.deviceItem, { backgroundColor: colors.cardBackground }]}>
        {/* Device Icon */}
        <View style={[styles.deviceIconContainer, { 
          backgroundColor: item.isCurrentDevice ? '#10B981' + '20' : colors.primary + '15' 
        }]}>
          <Ionicons 
            name={deviceIcon as any} 
            size={22} 
            color={item.isCurrentDevice ? '#10B981' : colors.primary} 
          />
        </View>
        
        {/* Device Info */}
        <View style={styles.deviceInfoContainer}>
          <View style={styles.deviceHeader}>
            <Text style={[styles.deviceName, { color: colors.text }]} numberOfLines={1}>
              {item.deviceName}
            </Text>
            {item.isCurrentDevice && (
              <View style={styles.currentBadge}>
                <View style={styles.currentBadgeDot} />
                <Text style={styles.currentBadgeText}>Current</Text>
              </View>
            )}
          </View>
          
          <Text style={[styles.deviceType, { color: colors.icon }]}>
            Mobile App
          </Text>
          
          <Text style={[styles.lastActive, { color: colors.icon }]}>
            {formatRelativeTime(item.lastActive)}
          </Text>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIconContainer, { backgroundColor: colors.primary + '15' }]}>
        <Ionicons name="shield-checkmark-outline" size={48} color={colors.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No login activity</Text>
      <Text style={[styles.emptySubtitle, { color: colors.icon }]}>
        Your login history will appear here
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Login Activity</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Content */}
      {sessions === undefined ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary || '#1E88E5'} />
        </View>
      ) : (
        <FlatList
          data={loginDevices}
          keyExtractor={(item) => item._id}
          renderItem={renderDeviceItem}
          contentContainerStyle={[
            styles.listContent,
            loginDevices.length === 0 && styles.emptyListContent
          ]}
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    position: 'absolute',
    left: 8,
    padding: 8,
    zIndex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  headerRight: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  emptyListContent: {
    flex: 1,
  },
  deviceItem: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  deviceIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  deviceInfoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  deviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  currentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981' + '20',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  currentBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 4,
  },
  currentBadgeText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '600',
  },
  deviceType: {
    fontSize: 13,
    marginBottom: 2,
  },
  lastActive: {
    fontSize: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
});
