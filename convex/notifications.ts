import { v } from 'convex/values';
import { Id } from './_generated/dataModel';
import { QueryCtx, mutation, query } from './_generated/server';
import { getCurrentUser } from './users';

// Type for notification
export type NotificationType = 'like' | 'follow' | 'comment' | 'mention' | 'new_post' | 'user_online';

// Spam limiting: time window in milliseconds (5 minutes)
const SPAM_WINDOW = 5 * 60 * 1000;

// Helper to check for duplicate notifications
const checkDuplicateNotification = async (
  ctx: QueryCtx,
  receiverId: Id<'users'>,
  senderId: string,
  type: NotificationType,
  relatedId?: Id<'messages'>
): Promise<boolean> => {
  const fiveMinutesAgo = Date.now() - SPAM_WINDOW;
  
  const existingNotifications = await ctx.db
    .query('notifications')
    .withIndex('byUserId', (q) => q.eq('userId', receiverId))
    .filter((q) =>
      q.and(
        q.eq(q.field('senderId'), senderId),
        q.eq(q.field('type'), type),
        q.gte(q.field('createdAt'), fiveMinutesAgo)
      )
    )
    .collect();

  // If relatedId is provided, also check for that
  if (relatedId) {
    return existingNotifications.some(
      (n) => n.relatedId?.toString() === relatedId?.toString()
    );
  }

  return existingNotifications.length > 0;
};

// Add a new notification
export const addNotification = mutation({
  args: {
    userId: v.id('users'),
    senderId: v.string(),
    senderUsername: v.string(),
    senderImageUrl: v.optional(v.string()),
    type: v.union(v.literal('like'), v.literal('follow'), v.literal('comment'), v.literal('mention'), v.literal('new_post')),
    message: v.string(),
    relatedId: v.optional(v.id('messages')),
  },
  handler: async (ctx, args) => {
    // Check for duplicate notification (spam prevention)
    const isDuplicate = await checkDuplicateNotification(
      ctx,
      args.userId,
      args.senderId,
      args.type,
      args.relatedId
    );
    
    if (isDuplicate) {
      console.log('[Notifications] Duplicate notification skipped:', args.type, 'from', args.senderId);
      return null;
    }

    const notification = await ctx.db.insert('notifications', {
      userId: args.userId,
      senderId: args.senderId,
      senderUsername: args.senderUsername,
      senderImageUrl: args.senderImageUrl,
      type: args.type,
      message: args.message,
      createdAt: Date.now(),
      isRead: false,
      relatedId: args.relatedId,
    });
    return notification;
  },
});

// Get all notifications for a user (sorted by latest first)
export const getNotifications = query({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const notifications = await ctx.db
      .query('notifications')
      .withIndex('byUserIdAndCreatedAt', (q) => 
        q.eq('userId', args.userId)
      )
      .collect();
    
    // Sort by createdAt descending (latest first)
    const sortedNotifications = notifications.sort((a, b) => b.createdAt - a.createdAt);
    
    // For each notification with a relatedId, fetch the post to get the image
    const notificationsWithPostImage = await Promise.all(
      sortedNotifications.map(async (notification) => {
        // Get sender info for online status
        let senderData = {
          _id: notification.senderId as Id<'users'>,
          username: '',
          imageUrl: undefined as string | undefined,
          isOnline: false,
          showOnlineStatus: true,
        };
        try {
          const sender = await ctx.db.get(notification.senderId as Id<'users'>);
          if (sender) {
            senderData = {
              _id: sender._id,
              username: sender.username || '',
              imageUrl: sender.imageUrl,
              isOnline: sender.isOnline || false,
              showOnlineStatus: sender.showOnlineStatus !== false,
            };
          }
        } catch (e) {
          // Ignore errors getting sender
        }
        
        if (notification.relatedId && (notification.type === 'like' || notification.type === 'comment' || notification.type === 'new_post')) {
          try {
            const post = await ctx.db.get(notification.relatedId);
            // Get the first media file if available
            const postImageUrl = post?.mediaFiles && post.mediaFiles.length > 0 ? post.mediaFiles[0] : null;
            // Get the post text (first 2-3 lines, approximately 100 characters)
            const postText = post?.content ? (post.content.length > 100 ? post.content.substring(0, 100) + '...' : post.content) : null;
            return {
              ...notification,
              postId: notification.relatedId,
              postImageUrl,
              postText,
              sender: senderData,
            };
          } catch (e) {
            return { ...notification, postId: notification.relatedId, postImageUrl: null, postText: null, sender: senderData };
          }
        }
        return { ...notification, postId: notification.relatedId || null, postImageUrl: null, postText: null, sender: senderData };
      })
    );
    
    return notificationsWithPostImage;
  },
});

// Get unread notification count for the current user
export const getUnreadNotificationCount = query({
  args: {},
  handler: async (ctx) => {
    // Safely check if user is authenticated
    const currentUser = await getCurrentUser(ctx);
    
    // Return 0 if user is not authenticated
    if (!currentUser) {
      return 0;
    }
    
    // Get all unread notifications for the user
    const unreadNotifications = await ctx.db
      .query('notifications')
      .withIndex('byUserId', (q) => q.eq('userId', currentUser._id))
      .collect();
    
    // Filter for unread only
    const unreadCount = unreadNotifications.filter(n => !n.isRead).length;
    
    return unreadCount;
  },
});
export const getNotificationsByType = query({
  args: {
    userId: v.id('users'),
    type: v.union(v.literal('like'), v.literal('follow'), v.literal('comment'), v.literal('mention'), v.literal('new_post')),
  },
  handler: async (ctx, args) => {
    const notifications = await ctx.db
      .query('notifications')
      .withIndex('byUserIdAndType', (q) => 
        q.eq('userId', args.userId).eq('type', args.type)
      )
      .collect();
    
    // Sort by createdAt descending (latest first)
    const sortedNotifications = notifications.sort((a, b) => b.createdAt - a.createdAt);
    
    // For each notification with a relatedId, fetch the post to get the image
    const notificationsWithPostImage = await Promise.all(
      sortedNotifications.map(async (notification) => {
        if (notification.relatedId && (notification.type === 'like' || notification.type === 'comment' || notification.type === 'new_post')) {
          try {
            const post = await ctx.db.get(notification.relatedId);
            // Get the first media file if available
            const postImageUrl = post?.mediaFiles && post.mediaFiles.length > 0 ? post.mediaFiles[0] : null;
            // Get the post text (first 50 characters)
            const postText = post?.content ? (post.content.length > 50 ? post.content.substring(0, 50) + '...' : post.content) : null;
            return {
              ...notification,
              postId: notification.relatedId,
              postImageUrl,
              postText,
            };
          } catch (e) {
            return { ...notification, postId: notification.relatedId, postImageUrl: null, postText: null };
          }
        }
        return { ...notification, postId: notification.relatedId || null, postImageUrl: null, postText: null };
      })
    );
    
    return notificationsWithPostImage;
  },
});

// Get unread notification count
export const getUnreadCount = query({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const notifications = await ctx.db
      .query('notifications')
      .withIndex('byUserIdAndIsRead', (q) => 
        q.eq('userId', args.userId).eq('isRead', false)
      )
      .collect();
    
    return notifications.length;
  },
});

// Mark a notification as read
export const markAsRead = mutation({
  args: {
    notificationId: v.id('notifications'),
  },
  handler: async (ctx, args) => {
    const notification = await ctx.db.get(args.notificationId);
    if (notification) {
      await ctx.db.patch(args.notificationId, { isRead: true });
    }
    return notification;
  },
});

// Mark all notifications as read for a user
export const markAllAsRead = mutation({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const notifications = await ctx.db
      .query('notifications')
      .withIndex('byUserIdAndIsRead', (q) => 
        q.eq('userId', args.userId).eq('isRead', false)
      )
      .collect();
    
    // Mark all as read
    for (const notification of notifications) {
      await ctx.db.patch(notification._id, { isRead: true });
    }
    
    return notifications.length;
  },
});

// Delete a notification
export const deleteNotification = mutation({
  args: {
    notificationId: v.id('notifications'),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.notificationId);
  },
});

// Create dummy notifications for testing
export const createDummyNotifications = mutation({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const dummyNotifications = [
      {
        userId: args.userId,
        senderId: 'user_123',
        senderUsername: 'john_doe',
        senderImageUrl: 'https://i.pravatar.cc/150?u=john',
        type: 'like' as const,
        message: 'liked your post',
        createdAt: Date.now() - 1000 * 60 * 30, // 30 minutes ago
        isRead: false,
      },
      {
        userId: args.userId,
        senderId: 'user_456',
        senderUsername: 'jane_smith',
        senderImageUrl: 'https://i.pravatar.cc/150?u=jane',
        type: 'follow' as const,
        message: 'started following you',
        createdAt: Date.now() - 1000 * 60 * 60 * 2, // 2 hours ago
        isRead: false,
      },
      {
        userId: args.userId,
        senderId: 'user_789',
        senderUsername: 'bob_wilson',
        senderImageUrl: 'https://i.pravatar.cc/150?u=bob',
        type: 'comment' as const,
        message: 'commented on your post: "Great photo!"',
        createdAt: Date.now() - 1000 * 60 * 60 * 5, // 5 hours ago
        isRead: false,
      },
      {
        userId: args.userId,
        senderId: 'user_321',
        senderUsername: 'alice_brown',
        senderImageUrl: 'https://i.pravatar.cc/150?u=alice',
        type: 'mention' as const,
        message: 'mentioned you in a post',
        createdAt: Date.now() - 1000 * 60 * 60 * 24, // 1 day ago
        isRead: true,
      },
      {
        userId: args.userId,
        senderId: 'user_654',
        senderUsername: 'charlie_davis',
        senderImageUrl: 'https://i.pravatar.cc/150?u=charlie',
        type: 'like' as const,
        message: 'liked your post',
        createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2, // 2 days ago
        isRead: true,
      },
      {
        userId: args.userId,
        senderId: 'user_987',
        senderUsername: 'emma_jones',
        senderImageUrl: 'https://i.pravatar.cc/150?u=emma',
        type: 'follow' as const,
        message: 'started following you',
        createdAt: Date.now() - 1000 * 60 * 60 * 24 * 4, // 4 days ago
        isRead: true,
      },
      {
        userId: args.userId,
        senderId: 'user_111',
        senderUsername: 'david_miller',
        senderImageUrl: 'https://i.pravatar.cc/150?u=david',
        type: 'comment' as const,
        message: 'commented: "This is amazing!"',
        createdAt: Date.now() - 1000 * 60 * 60 * 24 * 7, // 1 week ago
        isRead: true,
      },
      {
        userId: args.userId,
        senderId: 'user_222',
        senderUsername: 'sarah_taylor',
        senderImageUrl: 'https://i.pravatar.cc/150?u=sarah',
        type: 'mention' as const,
        message: 'mentioned you in a comment',
        createdAt: Date.now() - 1000 * 60 * 60 * 24 * 14, // 2 weeks ago
        isRead: true,
      },
      {
        userId: args.userId,
        senderId: 'user_333',
        senderUsername: 'mike_anderson',
        senderImageUrl: 'https://i.pravatar.cc/150?u=mike',
        type: 'like' as const,
        message: 'liked your post',
        createdAt: Date.now() - 1000 * 60 * 60 * 24 * 21, // 3 weeks ago
        isRead: true,
      },
      {
        userId: args.userId,
        senderId: 'user_444',
        senderUsername: 'lisa_thomas',
        senderImageUrl: 'https://i.pravatar.cc/150?u=lisa',
        type: 'follow' as const,
        message: 'started following you',
        createdAt: Date.now() - 1000 * 60 * 60 * 24 * 28, // 4 weeks ago
        isRead: true,
      },
    ];

    // Insert dummy notifications
    for (const notification of dummyNotifications) {
      await ctx.db.insert('notifications', notification);
    }

    return dummyNotifications.length;
  },
});
