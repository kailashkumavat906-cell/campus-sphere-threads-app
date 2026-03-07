import NotificationItem from '@/components/NotificationItem';
import { api } from '@/convex/_generated/api';
import { useThemeColors } from '@/hooks/useThemeColor';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type TabType = 'all' | 'comments' | 'follows';

const TABS: { key: TabType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'comments', label: 'Comments' },
  { key: 'follows', label: 'Follows' },
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

  // Mutations
  // @ts-ignore
  const markAsRead = useMutation(api.notifications.markAsRead);
  // @ts-ignore
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);
  // @ts-ignore
  const createDummyNotifications = useMutation(api.notifications.createDummyNotifications);

  // Filter notifications by type
  const filteredNotifications = useMemo(() => {
    if (!notifications) return [];
    
    switch (activeTab) {
      case 'comments':
        return notifications.filter((n: any) => n.type === 'comment' || n.type === 'mention');
      case 'follows':
        return notifications.filter((n: any) => n.type === 'follow');
      default:
        return notifications;
    }
  }, [notifications, activeTab]);

  // Handle tab change
  const handleTabChange = (tab: TabType) => {
    if (tab !== activeTab) {
      setTabKey(k => k + 1);
      setActiveTab(tab);
    }
  };

  // Handle notification press
  const handleNotificationPress = useCallback(async (notification: any) => {
    if (!notification.isRead) {
      await markAsRead({ notificationId: notification._id });
    }
    
    // Navigate based on notification type
    if (notification.type === 'like' || notification.type === 'comment' || notification.type === 'mention') {
      if (notification.relatedId) {
        router.push(`/(auth)/(modal)/reply/${notification.relatedId}`);
      }
    }
  }, [markAsRead]);

  // Handle follow back
  const handleFollowBack = useCallback((senderId: string) => {
    console.log('Follow back:', senderId);
  }, []);

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
  const renderItem = ({ item }: { item: any }) => (
    <>
      <NotificationItem
        notification={item}
        onPress={handleNotificationPress}
        onFollowBack={handleFollowBack}
      />
      <View style={[styles.separator, { backgroundColor: colors.border }]} />
    </>
  );

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
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }} key={tabKey}>
        {/* Header */}
        <View style={[styles.headerContainer, { backgroundColor: colors.background }]}>
          <Pressable 
            onPress={() => router.back()} 
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          
          <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
          
          <Pressable 
            onPress={handleCreateDummyData}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="add-circle-outline" size={24} color={colors.tint} />
          </Pressable>
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
                  { color: activeTab === tab.key ? colors.text : colors.icon }
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  tabContainer: {
    borderBottomWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  tabList: {
    flexDirection: 'row',
    gap: 28,
  },
  tabButton: {
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    position: 'relative',
    minWidth: 60,
  },
  tab: {
    // Not used - keeping for compatibility
  },
  activeTab: {
    // Not used - keeping for compatibility
  },
  tabText: {
    fontSize: 15,
  },
  inactiveTabText: {
    fontWeight: '400',
  },
  activeTabText: {
    fontWeight: '700',
  },
  activeTabIndicator: {
    position: 'absolute',
    bottom: -4,
    left: 0,
    right: 0,
    height: 3,
    borderRadius: 1.5,
  },
  separator: {
    height: 1,
    marginLeft: 64,
  },
  loadingFooter: {
    padding: 20,
  },
  listContent: {
    flexGrow: 1,
    justifyContent: 'center',
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
