import NotificationItem from '@/components/NotificationItem';
import { api } from '@/convex/_generated/api';
import { useThemeColors } from '@/hooks/useThemeColor';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type TabType = 'all' | 'likes' | 'comments' | 'follows' | 'posts';

const TABS: { key: TabType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'likes', label: 'Likes' },
  { key: 'comments', label: 'Comments' },
  { key: 'follows', label: 'Follows' },
  { key: 'posts', label: 'Posts' },
];

const Page = () => {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { userId: clerkId } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [tabKey, setTabKey] = useState(0);

  // Get user from Convex
  // @ts-ignore
  const user = useQuery(api.users.getUserByClerkId, { clerkId: clerkId || '' });

  // Get all notifications
  // @ts-ignore
  const allNotificationsQuery = useQuery(
    api.notifications.getNotifications,
    user ? { userId: user._id } : 'skip'
  );

  // Local state for filtered notifications
  const [notifications, setNotifications] = useState<any[]>([]);

  // Update local state when query results change
  useEffect(() => {
    if (allNotificationsQuery) {
      setNotifications(allNotificationsQuery);
    }
  }, [allNotificationsQuery]);

  // Mark all notifications as read when screen loads
  useEffect(() => {
    if (user && allNotificationsQuery && allNotificationsQuery.length > 0) {
      const hasUnread = allNotificationsQuery.some((n: any) => !n.isRead);
      if (hasUnread) {
        markAllAsRead({ userId: user._id });
      }
    }
  }, [user, allNotificationsQuery]);

  // Mutations
  // @ts-ignore
  const markAsRead = useMutation(api.notifications.markAsRead);
  // @ts-ignore
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);
  // @ts-ignore
  const createDummyNotifications = useMutation(api.notifications.createDummyNotifications);
  // @ts-ignore
  const followUser = useMutation(api.users.followUser);
  // @ts-ignore
  const unfollowUser = useMutation(api.users.unfollowUser);

  // Get following list to check follow status (list of users we follow)
  // @ts-ignore
  const followingList = useQuery(api.users.getFollowing, clerkId ? { clerkId } : 'skip');

  // Helper to check if current user follows a specific user
  const isFollowingUser = (targetClerkId: string): boolean => {
    if (!followingList || !targetClerkId) return false;
    return followingList.some((f: any) => f.clerkId === targetClerkId);
  };

  // Filter notifications by type
  const filteredNotifications = useMemo(() => {
    if (!notifications) return [];
    
    // First filter out user_online notifications
    const filtered = notifications.filter((n: any) => n.type !== 'user_online');
    
    switch (activeTab) {
      case 'likes':
        return filtered.filter((n: any) => n.type === 'like');
      case 'comments':
        return filtered.filter((n: any) => n.type === 'comment' || n.type === 'mention');
      case 'follows':
        return filtered.filter((n: any) => n.type === 'follow');
      case 'posts':
        return filtered.filter((n: any) => n.type === 'new_post');
      default:
        return filtered;
    }
  }, [notifications, activeTab]);

  // Handle tab change
  const handleTabChange = (tab: TabType) => {
    if (tab !== activeTab) {
      setTabKey(k => k + 1);
      setActiveTab(tab);
    }
  };

  // Handle notification press - universal handler for all notification types
  const handleNotificationPress = useCallback(async (notification: any) => {
    // Guard clause for null/undefined notification
    if (!notification) {
      console.log('[Notifications] Notification is null/undefined');
      return;
    }
    
    console.log('[Notifications] Handling press for notification:', notification.type, notification._id);
    
    // Mark as read
    if (!notification.isRead) {
      await markAsRead({ notificationId: notification._id });
    }
    
    // Get the postId - prefer postId, fallback to relatedId
    const postId = notification.postId || notification.relatedId;
    
    // ONLY allow navigation for follow notifications
    // All other notification types are non-interactive
    if (notification.type === 'follow') {
      if (notification.senderId) {
        router.push(`/profile?clerkId=${notification.senderId}`);
      }
    }
    // Like, comment, reply, post, mention notifications - no action on tap
    // They are display-only in the list
  }, [markAsRead, router]);

  // Handle follow back (follow/unfollow)
  const handleFollowBack = useCallback(async (senderId: string) => {
    // Check if already following using the helper function
    const isAlreadyFollowing = isFollowingUser(senderId);
    
    if (isAlreadyFollowing) {
      // Unfollow
      await unfollowUser({ userId: senderId });
    } else {
      // Follow
      await followUser({ userId: senderId });
    }
  }, [followUser, unfollowUser, isFollowingUser]);

  // Handle mark all as read
  const handleMarkAllAsRead = useCallback(async () => {
    if (user) {
      await markAllAsRead({ userId: user._id });
    }
  }, [markAllAsRead, user]);

  // Handle refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  // Handle create dummy data
  const handleCreateDummyData = useCallback(async () => {
    if (user) {
      await createDummyNotifications({ userId: user._id });
    }
  }, [createDummyNotifications, user]);

  // Render notification item
  const renderItem = ({ item }: { item: any }) => {
    // Check if current user follows this person using helper function
    const isFollowing = isFollowingUser(item.senderId);
    
    return (
      <>
        <NotificationItem
          notification={item}
          onPress={handleNotificationPress}
          onFollowBack={handleFollowBack}
          isFollowing={isFollowing}
          currentUserClerkId={clerkId || undefined}
        />
        <View style={[styles.separator, { backgroundColor: colors.border }]} />
      </>
    );
  };

  // Render empty state
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="notifications-outline" size={48} color={colors.icon} style={styles.emptyIcon} />
      <Text style={[styles.emptyText, { color: colors.text }]}>
        You&apos;re all caught up
      </Text>
      <Text style={[styles.emptySubtext, { color: colors.icon }]}>
        When you receive notifications, they&apos;ll show up here.
      </Text>
    </View>
  );

  const status = 'CanLoadMore';

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header with Back Arrow and Title */}
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <View style={styles.headerSide}>
          <Pressable 
            onPress={() => router.back()} 
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
        </View>
        
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
        </View>
        
        <View style={styles.headerSide} />
      </View>

      {/* Tab Buttons */}
      <View style={[styles.tabContainer, { borderBottomColor: colors.border }]}>
        <View style={styles.tabList}>
          {TABS.map((tab) => (
            <TouchableOpacity 
              key={tab.key}
              style={styles.tabButton}
              onPress={() => handleTabChange(tab.key)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.tabText, 
                activeTab === tab.key ? styles.activeTabText : styles.inactiveTabText,
                { color: activeTab === tab.key ? colors.tint : colors.icon }
              ]}>
                {tab.label}
              </Text>
              {activeTab === tab.key && (
                <View style={[styles.activeTabIndicator, { backgroundColor: colors.tint }]} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
      
      <FlatList
          data={filteredNotifications}
          renderItem={renderItem}
          keyExtractor={(item) => item._id}
          onEndReached={() => {}}
          onEndReachedThreshold={0.5}
          contentContainerStyle={styles.listContent}
          style={{ flex: 1 }}
          ListHeaderComponent={null}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={
            status === 'CanLoadMore' ? (
              <View style={[styles.loadingFooter, { backgroundColor: colors.background }]}>
              </View>
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.tint}
            />
          }
        />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backButton: {
    padding: 4,
  },
  headerSide: {
    width: 40,
    alignItems: 'flex-start',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginTop: 8,
  },
  tabList: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 24,
  },
  tabButton: {
    paddingVertical: 12,
    alignItems: 'center',
    position: 'relative',
    minWidth: 50,
  },
  tab: {
    // Not used - keeping for compatibility
  },
  activeTab: {
    // Not used - keeping for compatibility
  },
  tabText: {
    fontSize: 14,
  },
  inactiveTabText: {
    fontWeight: '400',
  },
  activeTabText: {
    fontWeight: '700',
  },
  activeTabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: '20%',
    right: '20%',
    height: 3,
    borderRadius: 2,
  },
  separator: {
    height: 1,
    marginLeft: 60,
  },
  loadingFooter: {
    padding: 20,
  },
  listContent: {
    flexGrow: 1,
    minHeight: '100%',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
  },
});

export default Page;
