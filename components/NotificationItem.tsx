import { formatTimestamp } from '@/constants/notifications';
import { Id } from '@/convex/_generated/dataModel';
import { useThemeColors } from '@/hooks/useThemeColor';
import React, { useMemo } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

// Types
type NotificationType = 'like' | 'follow' | 'comment' | 'mention';

interface NotificationItemProps {
  notification: {
    _id: Id<'notifications'>;
    _creationTime: number;
    userId: Id<'users'>;
    senderId: string;
    senderUsername: string;
    senderImageUrl?: string;
    type: NotificationType;
    message: string;
    createdAt: number;
    isRead: boolean;
    relatedId?: Id<'messages'>;
  };
  onPress: (notification: any) => void;
  onFollowBack?: (senderId: string) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onPress,
  onFollowBack,
}) => {
  const colors = useThemeColors();
  const isFollowType = notification.type === 'follow';

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
      {/* Profile Image */}
      <View style={styles.avatarContainer}>
        {notification.senderImageUrl ? (
          <Image
            source={{ uri: notification.senderImageUrl }}
            style={styles.avatar}
          />
        ) : (
          <View style={[styles.placeholderAvatar, dynamicStyles.placeholderAvatar]}>
            <Text style={[styles.placeholderText, dynamicStyles.placeholderText]}>
              {notification.senderUsername.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.textContainer}>
          <Text style={[styles.username, dynamicStyles.username]}>
            {notification.senderUsername}
          </Text>
          <Text style={[styles.message, dynamicStyles.message]} numberOfLines={2}>
            {notification.message}
          </Text>
          <Text style={[styles.timestamp, dynamicStyles.timestamp]}>
            {formatTimestamp(notification.createdAt)}
          </Text>
        </View>

        {/* Right side: Follow button or Unread indicator */}
        <View style={styles.rightContainer}>
          {isFollowType && onFollowBack && (
            <Pressable
              style={({ pressed }) => [
                [styles.followButton, dynamicStyles.followButton],
                pressed && styles.followButtonPressed,
              ]}
              onPress={() => onFollowBack(notification.senderId)}
            >
              <Text style={styles.followButtonText}>Follow</Text>
            </Pressable>
          )}
          
          {!notification.isRead && (
            <View style={[styles.unreadDot, dynamicStyles.unreadDot]} />
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
});

export default NotificationItem;
