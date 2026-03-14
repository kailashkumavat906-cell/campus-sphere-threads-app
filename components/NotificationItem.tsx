import { formatTimestamp } from '@/constants/notifications';
import { Id } from '@/convex/_generated/dataModel';
import { useThemeColors } from '@/hooks/useThemeColor';
import { useUserProfileNavigation } from '@/hooks/useUserProfileNavigation';
import React, { useEffect, useMemo } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// Types
type NotificationType = 'like' | 'follow' | 'comment' | 'mention' | 'new_post' | 'user_online';

// Sender type with online status
type SenderInfo = {
  _id: Id<'users'>;
  username?: string;
  imageUrl?: string;
  isOnline?: boolean;
  showOnlineStatus?: boolean;
};

interface NotificationItemProps {
  notification: {
    _id: Id<'notifications'>;
    _creationTime: number;
    userId: Id<'users'>;
    senderId: string;
    senderUsername: string;
    senderImageUrl?: string;
    senderIsOnline?: boolean;
    senderShowOnlineStatus?: boolean;
    sender?: SenderInfo;
    type: NotificationType;
    message: string;
    createdAt: number;
    isRead: boolean;
    relatedId?: Id<'messages'>;
    postId?: Id<'messages'> | null;
    postImageUrl?: string | null;
    postText?: string | null;
  };
  onPress: (notification: any) => void;
  onFollowBack?: (senderId: string) => void;
  isFollowing?: boolean;
  currentUserClerkId?: string;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onPress,
  onFollowBack,
  isFollowing = false,
  currentUserClerkId,
}) => {
  const colors = useThemeColors();
  const { openUserProfile } = useUserProfileNavigation();
  const isFollowType = notification.type === 'follow';
  const isNewPostType = notification.type === 'new_post';
  const isUserOnlineType = notification.type === 'user_online';
  
  // For user_online notifications, don't show post preview or follow button
  const showPostImage = !isUserOnlineType && (notification.type === 'like' || notification.type === 'comment' || notification.type === 'new_post') && notification.postImageUrl;
  const showPostText = !isUserOnlineType && (notification.type === 'like' || notification.type === 'comment' || notification.type === 'new_post') && notification.postText;
  
  // Debug: Log sender info
  useEffect(() => {
    console.log('[NotificationItem] Sender data:', JSON.stringify(notification.sender));
    console.log('[NotificationItem] Legacy fields:', { senderIsOnline: notification.senderIsOnline, senderShowOnlineStatus: notification.senderShowOnlineStatus });
  }, [notification]);
  
  // Don't show follow button if the notification is from the current user
  const isFromCurrentUser = currentUserClerkId && notification.senderId === currentUserClerkId;
  const showFollowButton = isFollowType && onFollowBack && !isFromCurrentUser;

  // Memoize styles to avoid recreation on every render
  const dynamicStyles = useMemo(() => {
    return {
      container: {
        backgroundColor: colors.background,
      },
      unreadContainer: {
        backgroundColor: colors.secondary + '15',
      },
      placeholderAvatar: {
        backgroundColor: colors.secondary,
      },
      placeholderText: {
        color: colors.text,
      },
      username: {
        color: colors.text,
      },
      message: {
        color: colors.icon,
      },
      timestamp: {
        color: colors.icon,
      },
      followButton: {
        backgroundColor: colors.tint,
      },
      unreadDot: {
        backgroundColor: colors.tint,
      },
    };
  }, [colors]);

  return (
    <Pressable
      style={({ pressed }) => [
        [styles.container, dynamicStyles.container],
        !notification.isRead && [styles.unreadContainer, dynamicStyles.unreadContainer],
        pressed && styles.pressed,
      ]}
      onPress={() => onPress(notification)}
    >
      {/* Profile Image - Clickable to open profile */}
      <TouchableOpacity 
        style={styles.avatarContainer}
        onPress={() => openUserProfile(notification.senderId)}
        activeOpacity={0.7}
      >
        <View style={styles.avatarWrapper}>
          {/* Use sender object if available, otherwise fall back to legacy fields */}
          {(notification.sender?.imageUrl || notification.senderImageUrl) ? (
            <Image
              source={{ uri: notification.sender?.imageUrl || notification.senderImageUrl }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.placeholderAvatar, dynamicStyles.placeholderAvatar]}>
              <Text style={[styles.placeholderText, dynamicStyles.placeholderText]}>
                {notification.senderUsername.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          {/* Online Indicator - check sender object first, then legacy fields */}
          {((notification.sender?.isOnline === true && notification.sender?.showOnlineStatus === true) || 
            (notification.senderIsOnline && notification.senderShowOnlineStatus)) && (
            <View style={styles.onlineIndicator} />
          )}
        </View>
      </TouchableOpacity>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.textContainer}>
          {/* Username - Clickable to open profile */}
          <TouchableOpacity onPress={() => openUserProfile(notification.senderId)}>
            <Text style={[styles.username, dynamicStyles.username]}>
              {notification.senderUsername}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.message, dynamicStyles.message]} numberOfLines={2}>
            {notification.message}
          </Text>
          {showPostText && (
            <Text style={[styles.postText, { color: colors.icon }]} numberOfLines={1}>
              {notification.postText}
            </Text>
          )}
          <Text style={[styles.timestamp, dynamicStyles.timestamp]}>
            {formatTimestamp(notification.createdAt)}
          </Text>
        </View>

        {/* Right side: Follow button, Unread indicator, or Post image preview */}
        <View style={styles.rightContainer}>
          {showPostImage && (
            <Image
              source={{ uri: notification.postImageUrl! }}
              style={styles.postPreview}
            />
          )}
          {!showPostImage && (
            <>
              {showFollowButton && (
                <Pressable
                  style={({ pressed }) => [
                    styles.followButton,
                    isFollowing 
                      ? { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border }
                      : dynamicStyles.followButton,
                    pressed && styles.followButtonPressed,
                  ]}
                  onPress={() => onFollowBack!(notification.senderId)}
                >
                  <Text style={[
                    styles.followButtonText,
                    { color: isFollowing ? colors.text : '#FFFFFF' }
                  ]}>
                    {isFollowing ? 'Following' : 'Follow'}
                  </Text>
                </Pressable>
              )}
              
              {!notification.isRead && (
                <View style={[styles.unreadDot, dynamicStyles.unreadDot]} />
              )}
              
              {/* Show green indicator for user_online notifications */}
              {isUserOnlineType && (
                <View style={[styles.unreadDot, { backgroundColor: '#22C55E' }]} />
              )}
            </>
          )}
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  unreadContainer: {
    // background handled by dynamicStyles
  },
  pressed: {
    opacity: 0.7,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  placeholderAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 18,
    fontWeight: '600',
  },
  avatarWrapper: {
    position: 'relative',
    width: 44,
    height: 44,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: '#fff',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  username: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  message: {
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 2,
  },
  postText: {
    fontSize: 12,
    marginBottom: 2,
  },
  timestamp: {
    fontSize: 12,
  },
  rightContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 60,
  },
  followButton: {
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  followButtonPressed: {
    opacity: 0.8,
  },
  followButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 8,
  },
  postPreview: {
    width: 45,
    height: 45,
    borderRadius: 6,
  },
});

export default NotificationItem;
