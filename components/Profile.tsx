import Tabs from '@/components/Tabs';
import Thread from '@/components/Thread';
import UserProfile from '@/components/UserProfile';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useThemeContext } from '@/hooks/ThemeContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { useQuery } from 'convex/react';
import { PaginationOptions } from 'convex/server';
import * as Linking from 'expo-linking';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheetMenu from './BottomSheetMenu';

type ProfileProps = {
  userId?: Id<'users'>;
  showBackButton?: boolean;
};

export default function Profile({ userId: propUserId, showBackButton = true }: ProfileProps) {
  const { top } = useSafeAreaInsets();
  const navigation = useNavigation();
  const router = useRouter();
  const params = useLocalSearchParams();
  const [activeTab, setActiveTab] = useState<'Posts' | 'Replies' | 'Drafts'>('Posts');
  const [refreshKey, setRefreshKey] = useState(0);
  const { userProfile } = useUserProfile();
  const { signOut } = useAuth();
  const { colors, theme, setTheme } = useThemeContext();
  
  // Get userId from params if not provided as prop - support both userId (internal) and clerkId
  const [profileUserId, setProfileUserId] = useState<Id<'users'> | undefined>(undefined);
  
  // Query to get user by clerkId if needed
  const userByClerkId = useQuery(
    api.users.getUserByClerkId,
    params.clerkId ? { clerkId: params.clerkId as string } : 'skip'
  );
  
  useEffect(() => {
    // If clerkId is provided, use it to look up the user
    if (params.clerkId && typeof params.clerkId === 'string') {
      // The userByClerkId query will return the user, use its _id
      // We'll handle this in another effect
      return;
    }
    
    // If no userId in params, always show current user's profile
    if (!params.userId) {
      setProfileUserId(undefined); // Reset to trigger fallback to userProfile._id
    } else if (params.userId && typeof params.userId === 'string') {
      setProfileUserId(params.userId as Id<'users'>);
    } else if (propUserId) {
      setProfileUserId(propUserId);
    }
    // If params.userId is undefined/null, we don't set profileUserId,
    // so the fallback to userProfile._id will be used
  }, [params.userId, params.clerkId, propUserId, userProfile]);
  
  // When we get the user by clerkId, update the profileUserId
  useEffect(() => {
    if (userByClerkId) {
      setProfileUserId(userByClerkId._id);
    }
  }, [userByClerkId]);

  // Menu state
  const [menuVisible, setMenuVisible] = useState(false);

  const profileId = profileUserId || userProfile?._id;
  // Check if viewing own profile: no profileUserId set (using fallback) or userId matches current user
  const isOwnProfile = !profileUserId || (profileUserId === userProfile?._id);

  // If viewing own profile, use userProfile; otherwise use the profileUserId for queries

  const paginationOpts: PaginationOptions = {
    numItems: 20,
    cursor: null,
  };

  // Get user's threads
  const threadsResult = useQuery(
    api.messages.getThreads,
    profileId ? { userId: profileId, paginationOpts } : { paginationOpts }
  );

  // Get user's replies
  const repliesResult = useQuery(
    api.messages.getUserReplies,
    profileId ? { userId: profileId, paginationOpts } : { paginationOpts }
  );

  // Get user's drafts (only for own profile)
  const draftsResult = useQuery(
    api.messages.getDraftPosts,
    isOwnProfile ? { paginationOpts } : 'skip'
  );

  // Get threads for current user only (not replies)
  const userThreads = (threadsResult?.page || []).filter((item: any) => !item.threadId);
  // Replies are already filtered by the query
  const userReplies = (repliesResult?.page || []);
  const userDrafts = (draftsResult?.page || []).filter((item: any) => item.isDraft);

  const displayedData =
    activeTab === 'Posts' ? userThreads : activeTab === 'Replies' ? userReplies : userDrafts;

  const showDraftsTab = isOwnProfile;

  const handleTabChange = (tab: 'Posts' | 'Replies' | 'Drafts') => {
    setActiveTab(tab);
  };

  const handleEditDraft = (draftId: string) => {
    // Navigate to create page with draft ID to edit
    router.push({ pathname: '/(auth)/(modal)/create', params: { draftId } });
  };

  const handleLogout = async () => {
    // Show confirmation dialog
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              // Sign out from Clerk
              await signOut();
              // Reset navigation stack and redirect to login
              navigation.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [{ name: '(public)' }],
                })
              );
            } catch (error) {
              console.error('Logout error:', error);
            }
          },
        },
      ]
    );
  };

  // Handle share profile
  const handleShareProfile = async () => {
    try {
      const name = userProfile?.first_name || 'User';
      const username = userProfile?.username || '';
      const message = `Check out ${name}'s profile!\n@${username}\nhttps://yourapplink.com/user/${username}`;

      await Share.share({
        message,
        title: 'Share Profile',
      });
    } catch (error) {
      console.error('Share error:', error);
      Alert.alert('Error', 'Unable to share profile at this time.');
    }
  };

  // Handle report a problem - open email
  const handleReportProblem = useCallback(async () => {
    const email = 'kumavatkailash60@gmail.com';
    const subject = 'Campus Sphere - Problem Report';
    const body = `App: Campus Sphere\n\nUser Email: ${userProfile?.email || 'Not available'}\n\nMessage: Describe your issue here...`;
    
    const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    const canOpen = await Linking.canOpenURL(mailtoUrl);
    
    if (canOpen) {
      await Linking.openURL(mailtoUrl);
    } else {
      Alert.alert('Email app not found', 'Please install an email app to report problems.');
    }
  }, [userProfile]);

  // Build menu items with checkmarks for active theme
  const getMenuItems = () => {
    const items = [];

    // 1. Appearance / Theme Section (with checkmarks)
    items.push({
      icon: 'moon-outline',
      label: 'Dark Mode',
      onPress: () => setTheme('dark'),
      isActive: theme === 'dark',
    });
    items.push({
      icon: 'sunny-outline',
      label: 'Light Mode',
      onPress: () => setTheme('light'),
      isActive: theme === 'light',
    });
    items.push({
      icon: 'phone-portrait-outline',
      label: 'System Default',
      onPress: () => setTheme('system'),
      isActive: theme === 'system',
    });

    items.push({ icon: 'notifications-outline', label: 'Notification Settings', onPress: () => router.push('/(auth)/(modal)/notification-settings') });
    items.push({ icon: 'lock-closed-outline', label: 'Privacy Settings', onPress: () => router.push('/(auth)/(modal)/privacy-settings') });
    items.push({ icon: 'bookmark-outline', label: 'Saved Posts', onPress: () => router.push('/(auth)/(tabs)/favorites') });
    items.push({ icon: 'share-outline', label: 'Share Profile', onPress: handleShareProfile });

    // 4. Support & Info
    items.push({ icon: 'flag-outline', label: 'Report a Problem', onPress: handleReportProblem });
    items.push({ icon: 'information-circle-outline', label: 'About App', onPress: () => router.push('/(auth)/(modal)/about') });
    items.push({ icon: 'document-text-outline', label: 'Terms & Privacy Policy', onPress: () => router.push('/(auth)/(modal)/terms') });
    items.push({ icon: 'log-out-outline', label: 'Logout', danger: true, onPress: handleLogout });

    return items;
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: top }}>
      <FlatList
        data={displayedData}
        keyExtractor={(item: any) => item._id}
        renderItem={({ item }: { item: any }) => {
          if (!item || (activeTab !== 'Drafts' && !item.creator)) {
            return null;
          }
          return (
            <>
              {activeTab === 'Drafts' ? (
                <View style={styles.draftsContainer}>
                  <TouchableOpacity onPress={() => handleEditDraft(item._id)}>
                    <View style={styles.draftItem}>
                      <View style={styles.draftHeader}>
                        {item.isPoll ? (
                          <Ionicons name="stats-chart-outline" size={20} color={colors.text} />
                        ) : item.mediaFiles && item.mediaFiles.length > 0 ? (
                          <Ionicons name="image-outline" size={20} color={colors.text} />
                        ) : (
                          <Ionicons name="document-text-outline" size={20} color={colors.text} />
                        )}
                        <Text style={[styles.draftLabel, { color: colors.text }]}>
                          {item.isPoll ? 'Poll Draft' : 'Draft'}
                        </Text>
                      </View>

                      {/* Show poll question for poll drafts */}
                      {item.isPoll && item.pollQuestion && (
                        <Text style={[styles.draftContent, { color: colors.text }]} numberOfLines={2}>
                          {item.pollQuestion}
                        </Text>
                      )}

                      {/* Show content for non-poll drafts */}
                      {!item.isPoll && (
                        <Text style={[styles.draftContent, { color: colors.text }]} numberOfLines={3}>
                          {item.content || 'No content'}
                        </Text>
                      )}

                      {/* Show poll options count for poll drafts */}
                      {item.isPoll && item.pollOptions && (
                        <View style={styles.mediaIndicator}>
                          <Ionicons name="list-outline" size={16} color={colors.text} />
                          <Text style={[styles.mediaCount, { color: colors.icon }]}>
                            {item.pollOptions.length} options
                          </Text>
                        </View>
                      )}

                      {/* Show media indicator for non-poll drafts */}
                      {!item.isPoll && item.mediaFiles && item.mediaFiles.length > 0 && (
                        <View style={styles.mediaIndicator}>
                          <Ionicons name="image" size={16} color={colors.text} />
                          <Text style={[styles.mediaCount, { color: colors.icon }]}>
                            {item.mediaFiles.length} media files
                          </Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                </View>
              ) : (
                <Link href="/" asChild>
                  <TouchableOpacity>
                    <Thread 
                      thread={item} 
                      showMenu={isOwnProfile}
                      onDelete={() => {
                        // Force refresh to update the list after delete
                        setRefreshKey(prev => prev + 1);
                      }}
                    />
                  </TouchableOpacity>
                </Link>
              )}
              <View style={[styles.separator, { backgroundColor: colors.border }]} />
            </>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.tabContentText, { color: colors.icon }]}>
              {activeTab === 'Posts'
                ? "You haven't posted any threads yet."
                : activeTab === 'Replies'
                ? "You haven't replied to any threads yet."
                : 'No drafts saved yet.'}
            </Text>
          </View>
        }
        ListHeaderComponent={
          <>
            <View style={[styles.header, { backgroundColor: colors.background }]}>
              {showBackButton || params.userId ? (
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                  <Ionicons name="chevron-back" size={24} color={colors.text} />
                  <Text style={[styles.backText, { color: colors.text }]}>Back</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ width: 24 }} />
              )}
              <View style={styles.headerIcons}>
                {/* Three-dot menu button - only show for own profile */}
                {isOwnProfile && (
                  <TouchableOpacity
                    onPress={() => setMenuVisible(true)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="ellipsis-horizontal" size={24} color={colors.text} />
                  </TouchableOpacity>
                )}
                {/* Edit icon button - only show for own profile */}
                {isOwnProfile && (
                  <TouchableOpacity
                    onPress={() => {
                      console.log('Edit icon pressed');
                      const userId = profileId || userProfile?._id;
                      if (userId) {
                        router.push({
                          pathname: '/(auth)/(modal)/edit-profile',
                          params: { userId: userId },
                        });
                      }
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="create-outline" size={24} color={colors.text} />
                  </TouchableOpacity>
                )}
                {/* Logout button - Instagram style - only show for own profile */}
                {isOwnProfile && (
                  <TouchableOpacity
                    onPress={handleLogout}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="log-out-outline" size={24} color={colors.text} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
            {profileId ? (
              <UserProfile userId={profileId} />
            ) : (
              <View style={[styles.container, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.tint} />
              </View>
            )}
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
            <Tabs
              onTabChange={handleTabChange}
              initialTab={activeTab}
              showDraftsTab={showDraftsTab}
            />
          </>
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Three-dot Menu Bottom Sheet */}
      <BottomSheetMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        items={getMenuItems()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  tabContentText: {
    fontSize: 16,
    marginVertical: 16,
    alignSelf: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backText: {
    fontSize: 16,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  draftsContainer: {
    paddingTop: 12,
  },
  draftItem: {
    padding: 16,
  },
  draftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  draftLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  draftContent: {
    fontSize: 15,
    lineHeight: 20,
  },
  mediaIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  mediaCount: {
    fontSize: 12,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  collegeInfoContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    alignItems: 'center',
  },
  collegeInfoText: {
    fontSize: 14,
    opacity: 0.8,
  },
});
