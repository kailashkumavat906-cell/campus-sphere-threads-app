import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useThemeColors } from '@/hooks/useThemeColor';
import { useMutation, useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type FollowRequestWithUser = {
  _id: Id<'followRequests'>;
  fromClerkId: string;
  toClerkId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: number;
  updatedAt: number;
  user?: {
    _id: Id<'users'>;
    clerkId: string;
    first_name?: string;
    last_name?: string;
    username?: string | null;
    imageUrl?: string;
  };
};

function FollowRequestItem({ 
  item, 
  onAccept, 
  onReject 
}: { 
  item: FollowRequestWithUser; 
  onAccept: (requestId: Id<'followRequests'>) => void;
  onReject: (requestId: Id<'followRequests'>) => void;
}) {
  const colors = useThemeColors();
  
  if (!item.user) return null;
  
  const fullName = [item.user.first_name, item.user.last_name]
    .filter(Boolean)
    .join(' ') || 'Unknown';
  const username = item.user.username ? `@${item.user.username}` : '';

  return (
    <View style={[styles.userItem, { backgroundColor: colors.background }]}>
      <View style={styles.userContent}>
        <View style={styles.avatarContainer}>
          {item.user.imageUrl ? (
            <Image
              source={{ uri: item.user.imageUrl }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.tint }]}>
              <Text style={styles.avatarPlaceholderText}>
                {(item.user.first_name?.[0] || item.user.last_name?.[0] || '?').toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.userInfo}>
          <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
            {fullName}
          </Text>
          {username ? (
            <Text style={[styles.username, { color: colors.icon }]} numberOfLines={1}>
              {username}
            </Text>
          ) : null}
          <Text style={[styles.requestTime, { color: colors.icon }]}>
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>
      </View>
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.acceptButton, { backgroundColor: colors.tint }]}
          onPress={() => onAccept(item._id)}
        >
          <Text style={styles.acceptButtonText}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.rejectButton, { backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }]}
          onPress={() => onReject(item._id)}
        >
          <Text style={[styles.rejectButtonText, { color: colors.text }]}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function FollowRequestsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  
  // Get pending follow requests
  const requestsData = useQuery(api.users.getPendingFollowRequests);
  const acceptRequest = useMutation(api.users.acceptFollowRequest);
  const rejectRequest = useMutation(api.users.rejectFollowRequest);
  
  const [refreshing, setRefreshing] = useState(false);

  const handleGoBack = useCallback(() => {
    router.dismiss();
  }, [router]);

  const handleAccept = useCallback(async (requestId: Id<'followRequests'>) => {
    try {
      await acceptRequest({ requestId });
    } catch (error) {
      console.error('Error accepting request:', error);
    }
  }, [acceptRequest]);

  const handleReject = useCallback(async (requestId: Id<'followRequests'>) => {
    try {
      await rejectRequest({ requestId });
    } catch (error) {
      console.error('Error rejecting request:', error);
    }
  }, [rejectRequest]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    // The query will auto-refresh, just reset the refreshing state after a delay
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  const isLoading = requestsData === undefined;
  const requests = (requestsData || []) as FollowRequestWithUser[];

  // Add navigation to profile when tapping a request
  const handleUserPress = useCallback((clerkId: string) => {
    router.push({ pathname: '/profile', params: { clerkId } });
  }, [router]);

  const renderItem = ({ item }: { item: FollowRequestWithUser }) => (
    <TouchableOpacity 
      onPress={() => item.user && handleUserPress(item.user.clerkId)}
      activeOpacity={0.7}
    >
      <FollowRequestItem 
        item={item} 
        onAccept={handleAccept} 
        onReject={handleReject} 
      />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <Text style={[styles.backText, { color: colors.text }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Follow Requests</Text>
        <View style={styles.backButton} />
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      ) : requests.length === 0 ? (
        <View style={styles.centerContent}>
          <Text style={[styles.emptyText, { color: colors.icon }]}>
            No pending follow requests
          </Text>
          <Text style={[styles.emptySubtext, { color: colors.icon }]}>
            When someone wants to follow you, their request will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={handleRefresh}
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  backButton: {
    width: 60,
  },
  backText: {
    fontSize: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  userContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
  },
  username: {
    fontSize: 14,
    marginTop: 2,
  },
  requestTime: {
    fontSize: 12,
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  rejectButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  rejectButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
