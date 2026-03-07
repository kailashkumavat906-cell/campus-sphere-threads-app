import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

// Type for notification
export type NotificationType = 'like' | 'follow' | 'comment' | 'mention';

// Add a new notification
export const addNotification = mutation({
  args: {
    userId: v.id('users'),
    senderId: v.string(),
    senderUsername: v.string(),
    senderImageUrl: v.optional(v.string()),
    type: v.union(v.literal('like'), v.literal('follow'), v.literal('comment'), v.literal('mention')),
    message: v.string(),
    relatedId: v.optional(v.id('messages')),
  },
  handler: async (ctx, args) => {
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
    return notifications.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Get notifications by type
export const getNotificationsByType = query({
  args: {
    userId: v.id('users'),
    type: v.union(v.literal('like'), v.literal('follow'), v.literal('comment'), v.literal('mention')),
  },
  handler: async (ctx, args) => {
    const notifications = await ctx.db
      .query('notifications')
      .withIndex('byUserIdAndType', (q) => 
        q.eq('userId', args.userId).eq('type', args.type)
      )
      .collect();
    
    // Sort by createdAt descending (latest first)
    return notifications.sort((a, b) => b.createdAt - a.createdAt);
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
