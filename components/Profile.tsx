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
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react';
import { PaginationOptions } from 'convex/server';
import * as Linking from 'expo-linking';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
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
  const [selectedDraft, setSelectedDraft] = useState<any>(null);
  const [selectedReply, setSelectedReply] = useState<any>(null);
  
  // Mutation to delete a draft
  const deleteDraft = useMutation(api.messages.deleteDraft);
  // Mutation to delete a comment/reply
  const deleteComment = useMutation(api.messages.deleteComment);
  const { userProfile, syncUserToConvex, isSignedIn, userLoaded } = useUserProfile();
  const { signOut, userId: clerkUserId } = useAuth();
  const { colors, theme, setTheme } = useThemeContext();
  
  // Auto-sync user if not found in Convex
  useEffect(() => {
    if (isSignedIn && userLoaded && !userProfile && syncUserToConvex) {
      console.log('Profile: User not found in Convex, triggering sync...');
      syncUserToConvex();
    }
  }, [isSignedIn, userLoaded, userProfile, syncUserToConvex]);
  
  // Get userId from params if not provided as prop - support both userId (internal) and clerkId
  // FIXED: Don't fallback to currentUserId when viewing another user's profile
  const [profileUserId, setProfileUserId] = useState<Id<'users'> | undefined>(undefined);
  const [isViewingOtherUser, setIsViewingOtherUser] = useState(false);
  
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
      setIsViewingOtherUser(true);
      return;
    }
    
    // If userId is provided in params, we're viewing another user's profile
    if (params.userId && typeof params.userId === 'string') {
      setProfileUserId(params.userId as Id<'users'>);
      setIsViewingOtherUser(true);
    } else if (propUserId) {
      // If propUserId is provided, we're viewing another user's profile
      setProfileUserId(propUserId);
      setIsViewingOtherUser(true);
    } else {
      // No userId in params - this is our own profile
      setProfileUserId(undefined);
      setIsViewingOtherUser(false);
    }
  }, [params.userId, params.clerkId, propUserId, userProfile]);
  
  // When we get the user by clerkId, update the profileUserId
  useEffect(() => {
    if (userByClerkId) {
      setProfileUserId(userByClerkId._id);
      setIsViewingOtherUser(true);
    }
  }, [userByClerkId]);

  // Get profile user data for privacy check
  const profileUser = useQuery(
    api.users.getUserById,
    profileUserId ? { userId: profileUserId } : 'skip'
  );

  // Get current user ID
  const { userId: currentClerkId } = useAuth();

  // Check if viewing own profile - compare current user with viewed profile
  const isOwnProfile = (!params.clerkId && !params.userId) || 
    (currentClerkId && profileUser?.clerkId === currentClerkId) || 
    (params.userId && userProfile?._id === params.userId);

  // Check if profile user is blocked by current user
  const profileBlockCheck = useQuery(
    api.users.getUserProfileWithBlockStatus,
    profileUser?.clerkId ? { profileClerkId: profileUser.clerkId } : 'skip'
  );
  
  // Use the boolean result from isUserBlocked query
  const isBlockedByView = profileBlockCheck?.blockedView ?? false;
  const iBlockedThem = profileBlockCheck?.iBlockedThem ?? false;

  // Block/Unblock mutation
  const blockUser = useMutation(api.users.blockUser);
  const unblockUser = useMutation(api.users.unblockUser);

  // Check if profile is private and current user is not following
  const profileFollowStatus = useQuery(
    api.users.getFollowStatus,
    profileUser?.clerkId && !isOwnProfile ? { clerkId: profileUser.clerkId } : 'skip'
  );

  const isFollowing = profileFollowStatus?.isFollowing ?? false;

  // Determine if we should show private account view
  // eslint-disable-next-line no-console
  console.log('[Profile] profileUser?.isPrivate:', profileUser?.isPrivate, 'isOwnProfile:', isOwnProfile, 'isFollowing:', isFollowing, 'profileUser?.clerkId:', profileUser?.clerkId, 'currentClerkId:', currentClerkId);
  const showPrivateAccountView = profileUser?.isPrivate && !isOwnProfile && !isFollowing;

  // Check if profile is blocked (either direction)
  const showBlockedView = isBlockedByView && !isOwnProfile;

  // Check if user is not found (for viewing other user's profile)
  const showUserNotFound = isViewingOtherUser && !profileUserId && !profileUser;

  // Menu state
  const [menuVisible, setMenuVisible] = useState(false);

  // FIXED: Use profileUserId directly for other users, only use userProfile._id for own profile
  // This prevents the bug where viewing another user's profile shows current user's profile
  const profileId = isViewingOtherUser ? profileUserId : (profileUserId || userProfile?._id);

  // If viewing own profile, use userProfile; otherwise use the profileUserId for queries

  const paginationOpts: PaginationOptions = {
    numItems: 20,
    cursor: null,
  };

  // Get user's threads using paginated query for proper infinite scroll
  // Pass userId when viewing a specific user's profile, otherwise pass undefined to get all posts
  const { results: threadsData, status: threadsStatus, loadMore: loadMoreThreads } = usePaginatedQuery(
    api.messages.getThreads as any,
    profileId ? { userId: profileId } : { userId: undefined, filterType: undefined },
    { initialNumItems: 20 }
  );

  // Get user's replies using paginated query
  const { results: repliesData, status: repliesStatus, loadMore: loadMoreReplies } = usePaginatedQuery(
    api.messages.getUserReplies as any,
    profileId ? { userId: profileId } : 'skip',
    { initialNumItems: 20 }
  );

  // Get user's drafts (only for own profile)
  const draftsResult = useQuery(
    api.messages.getDraftPosts,
    isOwnProfile ? { paginationOpts } : 'skip'
  );

  // Get threads for current user only (not replies)
  // usePaginatedQuery returns results directly (not .page)
  const userThreads = (threadsData || []).filter((item: any) => !item.threadId);
  // Replies are already filtered by the query
  const userReplies = (repliesData || []);
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

  const handleDeleteReply = async (reply: any) => {
    try {
      await deleteComment({ commentId: reply._id });
      // Force refresh to update the list after delete
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Error deleting reply:', error);
      Alert.alert('Error', 'Failed to delete reply. Please try again.');
    }
  };

  const handleOpenDraftMenu = (draft: any) => {
    setSelectedDraft(draft);
    // Show options using Alert
    Alert.alert(
      'Draft Options',
      'Choose an action',
      [
        {
          text: 'Edit Draft',
          onPress: () => handleEditDraft(draft._id),
        },
        {
          text: 'Delete Draft',
          style: 'destructive',
          onPress: () => handleDeleteDraftConfirm(draft),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const handleDeleteDraftConfirm = (draft: any) => {
    // Show confirmation dialog
    Alert.alert(
      'Delete Draft',
      'Are you sure you want to delete this draft?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDraft({ draftId: draft._id });
              // Refresh to update the list
              setRefreshKey(prev => prev + 1);
            } catch (error) {
              console.error('Error deleting draft:', error);
              Alert.alert('Error', 'Failed to delete draft. Please try again.');
            }
          },
        },
      ]
    );
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

  // Handle block/unblock user
  const handleBlockUser = useCallback(async () => {
    if (!profileUser?.clerkId) return;
    
    const action = isBlockedByView ? 'unblock' : 'block';
    const userName = `${profileUser.first_name || ''} ${profileUser.last_name || ''}`.trim() || 'this user';
    
    Alert.alert(
      `${action.charAt(0).toUpperCase() + action.slice(1)} User`,
      `Are you sure you want to ${action} ${userName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action === 'block' ? 'Block' : 'Unblock',
          style: 'destructive',
          onPress: async () => {
            try {
              if (isBlockedByView) {
                await unblockUser({ blockedClerkId: profileUser.clerkId });
                Alert.alert('Success', `You have unblocked ${userName}`);
              } else {
                await blockUser({ blockedClerkId: profileUser.clerkId });
                Alert.alert('Success', `You have blocked ${userName}`);
                // Navigate back after blocking
                router.back();
              }
            } catch (error) {
              console.error('Error blocking/unblocking user:', error);
              Alert.alert('Error', `Unable to ${action} user. Please try again.`);
            }
          },
        },
      ]
    );
  }, [profileUser, isBlockedByView, blockUser, unblockUser, router]);

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
    items.push({ icon: 'bookmark-outline', label: 'Saved Posts', onPress: () => router.push({ pathname: '/(auth)/(tabs)/favorites', params: { initialTab: 'saved' } }) });
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
      {/* Show user not found, private account message, or main content */}
      {showUserNotFound ? (
        <View style={styles.centerContent}>
          <Text style={[styles.emptyText, { color: colors.text }]}>User not found</Text>
        </View>
      ) : showPrivateAccountView ? (
        <View style={styles.centerContent}>
          <Ionicons name="lock-closed" size={64} color={colors.icon} />
          <Text style={[styles.emptyText, { color: colors.text, marginTop: 16 }]}>
            This Account is Private
          </Text>
          <Text style={[styles.emptySubtext, { color: colors.icon, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 }]}>
            Follow this account to see their posts and media
          </Text>
        </View>
      ) : (
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
                  <View style={styles.draftItem}>
                    <TouchableOpacity onPress={() => handleEditDraft(item._id)} style={styles.draftContentContainer}>
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
                    </TouchableOpacity>
                    
                    {/* Three-dot menu button for drafts */}
                    <TouchableOpacity 
                      onPress={() => handleOpenDraftMenu(item)} 
                      style={styles.draftMenuButton}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                // For Replies tab, render a custom reply card
                activeTab === 'Replies' ? (
                  <View style={styles.replyContainer}>
                    {/* Original post */}
                    <View style={styles.replyPostContainer}>
                      <Text style={[styles.replyPostLabel, { color: colors.icon }]}>
                        Replying to @{item.postCreator?.username || item.postCreator?.first_name || 'user'}
                      </Text>
                      <Text style={[styles.replyPostContent, { color: colors.text }]} numberOfLines={3}>
                        {item.postContent || (item.postIsPoll ? item.postPollQuestion : '') || 'Post not available'}
                      </Text>
                      {item.postIsPoll && item.postPollOptions && (
                        <View style={styles.replyPollOptions}>
                          {item.postPollOptions.slice(0, 3).map((opt: string, idx: number) => (
                            <Text key={idx} style={[styles.replyPollOption, { color: colors.icon }]}>
                              • {opt}
                            </Text>
                          ))}
                          {item.postPollOptions.length > 3 && (
                            <Text style={[styles.replyPollMore, { color: colors.icon }]}>
                              +{item.postPollOptions.length - 3} more
                            </Text>
                          )}
                        </View>
                      )}
                    </View>
                    {/* User's reply */}
                    <View style={styles.replyContentContainer}>
                      <View style={styles.replyHeader}>
                        <Image
                          source={{ uri: item.creator?.imageUrl || 'https://via.placeholder.com/40' }}
                          style={styles.replyAvatar}
                        />
                        <View style={styles.replyHeaderText}>
                          <Text style={[styles.replyDisplayName, { color: colors.text }]}>
                            {item.creator?.first_name} {item.creator?.last_name}
                          </Text>
                          <Text style={[styles.replyUsername, { color: colors.icon }]}>
                            @{item.creator?.username || item.creator?.first_name?.toLowerCase() || 'user'}
                          </Text>
                          <Text style={[styles.replyTimestamp, { color: colors.icon }]}>
                            · {new Date(item.createdAt).toLocaleDateString()}
                          </Text>
                        </View>
                        {/* Three-dot menu for delete - only show for own profile */}
                        {isOwnProfile && (
                          <TouchableOpacity
                            onPress={() => {
                              Alert.alert(
                                'Delete Reply',
                                'Are you sure you want to delete this reply?',
                                [
                                  { text: 'Cancel', style: 'cancel' },
                                  {
                                    text: 'Delete',
                                    style: 'destructive',
                                    onPress: () => handleDeleteReply(item),
                                  },
                                ]
                              );
                            }}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <Ionicons name="ellipsis-horizontal" size={18} color={colors.icon} />
                          </TouchableOpacity>
                        )}
                      </View>
                      <Text style={[styles.replyText, { color: colors.text }]}>
                        {item.commentText}
                      </Text>
                    </View>
                  </View>
                ) : (
                <Link href="/" asChild>
                  <TouchableOpacity>
                    <Thread 
                      thread={item} 
                      showMenu={!!isOwnProfile}
                      onDelete={() => {
                        // Force refresh to update the list after delete
                        setRefreshKey(prev => prev + 1);
                      }}
                    />
                  </TouchableOpacity>
                </Link>
                ))}
              <View style={[styles.separator, { backgroundColor: colors.border }]} />
            </>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            {showBlockedView ? (
              <>
                <Ionicons name="eye-off" size={48} color={colors.icon} />
                <Text style={[styles.tabContentText, { color: colors.icon, marginTop: 12, textAlign: 'center', paddingHorizontal: 32 }]}>
                  This account is not available{/* */}
                </Text>
                <Text style={[styles.emptySubtext, { color: colors.icon, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 }]}>
                  You can't see their posts, replies, or media
                </Text>
              </>
            ) : (
              <Text style={[styles.tabContentText, { color: colors.icon }]}>
                {activeTab === 'Posts'
                  ? "You haven't posted any threads yet."
                  : activeTab === 'Replies'
                  ? "You haven't replied to any threads yet."
                  : 'No drafts saved yet.'}
              </Text>
            )}
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
                {/* Block User button - only show for other users */}
                {!isOwnProfile && profileUser?.clerkId && (
                  <TouchableOpacity
                    onPress={handleBlockUser}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons 
                      name={isBlockedByView ? 'checkmark-circle' : 'ban-outline'} 
                      size={24} 
                      color={colors.text} 
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>
            {profileId ? (
              <UserProfile userId={profileId} isBlocked={showBlockedView} iBlockedThem={iBlockedThem} />
            ) : (
              <View style={[styles.container, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.tint} />
              </View>
            )}
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
            <Tabs
              onTabChange={handleTabChange}
              initialTab={activeTab}
              showDraftsTab={!!showDraftsTab}
            />
          </>
        }
        onEndReached={() => {
          // Load more posts/replies based on active tab
          if (activeTab === 'Posts' && threadsStatus === 'CanLoadMore') {
            loadMoreThreads(20);
          } else if (activeTab === 'Replies' && repliesStatus === 'CanLoadMore') {
            loadMoreReplies(20);
          }
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          (activeTab === 'Posts' && threadsStatus === 'CanLoadMore') || 
          (activeTab === 'Replies' && repliesStatus === 'CanLoadMore') ? (
            <View style={[styles.loadingFooter, { backgroundColor: colors.background }]}>
            </View>
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />
      )}

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
  draftContentContainer: {
    flex: 1,
  },
  draftMenuButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  draftItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
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
  loadingFooter: {
    padding: 20,
  },
  // Reply styles
  replyContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  replyPostContainer: {
    backgroundColor: 'rgba(0,0,0,0.03)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  replyPostLabel: {
    fontSize: 13,
    marginBottom: 4,
  },
  replyPostContent: {
    fontSize: 15,
    lineHeight: 22,
  },
  replyPollOptions: {
    marginTop: 8,
  },
  replyPollOption: {
    fontSize: 13,
    marginTop: 2,
  },
  replyPollMore: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  replyContentContainer: {
    paddingLeft: 0,
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  replyAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  replyHeaderText: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  replyDisplayName: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
  },
  replyUsername: {
    fontSize: 14,
    marginRight: 4,
  },
  replyTimestamp: {
    fontSize: 14,
  },
  replyText: {
    fontSize: 15,
    lineHeight: 22,
    paddingLeft: 40,
  },
});
