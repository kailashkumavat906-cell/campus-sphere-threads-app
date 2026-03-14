
import { v } from 'convex/values';
import { Id } from './_generated/dataModel';
import { internalMutation, mutation, query, QueryCtx } from './_generated/server';

export const getUserByClerkId = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.clerkId) return null;
    
    const user = await ctx.db
      .query('users')
      .withIndex('byClerkId', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (!user) return null;

    // Return user as-is - imageUrl is already a URL (not storage ID)
    return user;
  },
});

// Search users by name or username
export const searchUsers = query({
  args: {
    searchText: v.string(),
  },
  handler: async (ctx, args) => {
    const searchText = args.searchText.trim();
    
    // Return empty array if search text is empty
    if (!searchText) {
      return [];
    }

    // Get current user to exclude from results and get blocked list
    const currentUser = await getCurrentUser(ctx);
    const currentUserId = currentUser?._id;
    const currentUserClerkId = currentUser?.clerkId;

    // Get list of blocked user IDs (both ways for bidirectional blocking)
    // 1. Users that current user has blocked
    // 2. Users who have blocked current user
    let blockedIds: string[] = [];
    if (currentUserClerkId) {
      // Users current user has blocked
      const blockedByMe = await ctx.db
        .query('blockedUsers')
        .withIndex('byBlocker', (q) => q.eq('blockerId', currentUserClerkId))
        .collect();
      
      // Users who have blocked current user
      const blockedMe = await ctx.db
        .query('blockedUsers')
        .withIndex('byBlocked', (q) => q.eq('blockedId', currentUserClerkId))
        .collect();
      
      // Combine both lists
      blockedIds = [
        ...blockedByMe.map(b => b.blockedId),
        ...blockedMe.map(b => b.blockerId)
      ];
    }

    // Convert search text to lowercase for case-insensitive matching
    const searchLower = searchText.toLowerCase();

    // Get all users and filter manually (Convex doesn't support full-text search across multiple fields)
    const allUsers = await ctx.db.query('users').collect();
    
    // Get all follows to calculate live counts
    const allFollows = await ctx.db.query('follows').collect();

    // Calculate live followers count for each user
    const getLiveFollowersCount = (clerkId: string) => {
      return allFollows.filter(f => f.followingId === clerkId).length;
    };
    
    // Filter users matching the search text and remove blocked users
    const matchingUsers = allUsers
      .filter((user) => {
        // Exclude current user from results
        if (currentUserId && user._id === currentUserId) {
          return false;
        }
        
        // Exclude blocked users
        if (user.clerkId && blockedIds.includes(user.clerkId)) {
          return false;
        }
        
        // Exclude users who disabled profile search
        if (user.allowProfileSearch === false) {
          return false;
        }
        
        // Check if search text matches username, first_name, or last_name
        const username = (user.username || '').toLowerCase();
        const firstName = (user.first_name || '').toLowerCase();
        const lastName = (user.last_name || '').toLowerCase();
        
        return (
          username.includes(searchLower) ||
          firstName.includes(searchLower) ||
          lastName.includes(searchLower)
        );
      })
      .slice(0, 20) // Limit to 20 results
      .map((user) => ({
        _id: user._id,
        clerkId: user.clerkId,
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.username,
        imageUrl: user.imageUrl,
        // Online status fields
        isOnline: user.isOnline,
        showOnlineStatus: user.showOnlineStatus,
        // Use live followers count from follows table
        followersCount: getLiveFollowersCount(user.clerkId),
      }));

    return matchingUsers;
  },
});

// Get recommended users (sorted by followers count, excluding current user)
export const getRecommendedUsers = query({
  args: {},
  handler: async (ctx, args) => {
    // Get current user to exclude from results
    const currentUser = await getCurrentUser(ctx);
    const currentUserId = currentUser?._id;

    // Get all users
    const allUsers = await ctx.db.query('users').collect();

    // Get all follows to calculate live counts
    const allFollows = await ctx.db.query('follows').collect();

    // Calculate live followers count for each user
    const getLiveFollowersCount = (clerkId: string) => {
      return allFollows.filter(f => f.followingId === clerkId).length;
    };

    // Filter and sort users
    const recommendedUsers = allUsers
      .filter((user) => {
        // Exclude current user from results
        if (currentUserId && user._id === currentUserId) {
          return false;
        }
        
        // Exclude users who disabled profile search
        if (user.allowProfileSearch === false) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Sort by live followersCount descending
        return (getLiveFollowersCount(b.clerkId) || 0) - (getLiveFollowersCount(a.clerkId) || 0);
      })
      .slice(0, 20) // Limit to 20 users
      .map((user) => ({
        _id: user._id,
        clerkId: user.clerkId,
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.username,
        imageUrl: user.imageUrl,
        // Use live followers count from follows table
        followersCount: getLiveFollowersCount(user.clerkId),
      }));

    return recommendedUsers;
  },
});

// Check if current user is following a specific user (by Clerk ID)
export const isFollowing = query({
  args: {
    clerkId: v.string(), // Clerk ID of target user
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser || !currentUser.clerkId) return false;

    const existingFollow = await ctx.db
      .query('follows')
      .withIndex('byFollowerAndFollowing', (q) => 
        q.eq('followerId', currentUser.clerkId).eq('followingId', args.clerkId)
      )
      .unique();

    return !!existingFollow;
  },
});

// Get complete follow status for a user (by Clerk ID)
export const getFollowStatus = query({
  args: {
    clerkId: v.string(), // Clerk ID of target user
  },
  handler: async (ctx, args) => {
    // Get followers count (people following this user) - NO authentication needed
    const followers = await ctx.db
      .query('follows')
      .withIndex('byFollowing', (q) => q.eq('followingId', args.clerkId))
      .collect();

    // Get following count (people this user follows) - NO authentication needed
    const following = await ctx.db
      .query('follows')
      .withIndex('byFollower', (q) => q.eq('followerId', args.clerkId))
      .collect();

    // Check if current user is following - requires authentication
    const identity = await ctx.auth.getUserIdentity();
    let isFollowing = false;
    
    if (identity) {
      const currentUserRecord = await ctx.db
        .query('users')
        .withIndex('byClerkId', (q) => q.eq('clerkId', identity.subject))
        .unique();
      
      if (currentUserRecord) {
        isFollowing = followers.some(f => f.followerId === identity.subject);
      }
    }

    return {
      isFollowing,
      followersCount: followers.length,
      followingCount: following.length,
    };
  },
});

// Get followers count for a user (by Clerk ID)
export const getFollowersCount = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const follows = await ctx.db
      .query('follows')
      .withIndex('byFollowing', (q) => q.eq('followingId', args.clerkId))
      .collect();
    
    return follows.length;
  },
});

// Get following count for a user (by Clerk ID)
export const getFollowingCount = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const follows = await ctx.db
      .query('follows')
      .withIndex('byFollower', (q) => q.eq('followerId', args.clerkId))
      .collect();
    
    return follows.length;
  },
});

// Get both followers and following counts for a user (by Clerk ID)
export const getFollowCounts = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    // Followers = people following this user (where followingId == userId)
    const followers = await ctx.db
      .query('follows')
      .withIndex('byFollowing', (q) => q.eq('followingId', args.clerkId))
      .collect();
    
    // Following = people this user follows (where followerId == userId)
    const following = await ctx.db
      .query('follows')
      .withIndex('byFollower', (q) => q.eq('followerId', args.clerkId))
      .collect();
    
    return {
      followersCount: followers.length,
      followingCount: following.length,
    };
  },
});

// Follow a user (by Clerk ID)
export const followUser = mutation({
  args: {
    userId: v.string(), // Clerk ID of target user
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserOrThrow(ctx);
    
    if (!currentUser.clerkId) {
      throw new Error("User not authenticated properly");
    }

    // Can't follow yourself
    if (currentUser.clerkId === args.userId) {
      throw new Error("You can't follow yourself");
    }

    // Check if already following
    const existingFollow = await ctx.db
      .query('follows')
      .withIndex('byFollowerAndFollowing', (q) => 
        q.eq('followerId', currentUser.clerkId).eq('followingId', args.userId)
      )
      .unique();

    if (existingFollow) {
      // Already following, do nothing
      return { success: true, action: 'already_following' };
    }

    // Create follow
    await ctx.db.insert('follows', {
      followerId: currentUser.clerkId,
      followingId: args.userId,
      createdAt: Date.now(),
    });

    // Create follow notification for the target user
    const targetUser = await ctx.db
      .query('users')
      .withIndex('byClerkId', (q) => q.eq('clerkId', args.userId))
      .first();

    if (targetUser) {
      const senderUsername = currentUser.username || `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() || 'Someone';
      
      // Check notification preferences before creating notification
      const enableNotifications = targetUser.enableNotifications !== false;
      const notifyFollows = targetUser.notifyFollows !== false;
      
      if (enableNotifications && notifyFollows) {
        await ctx.db.insert('notifications', {
          userId: targetUser._id,
          senderId: currentUser.clerkId,
          senderUsername,
          senderImageUrl: currentUser.imageUrl,
          type: 'follow',
          message: 'started following you',
          createdAt: Date.now(),
          isRead: false,
        });
      }
    }

    return { success: true, action: 'followed' };
  },
});

// Unfollow a user (by Clerk ID)
export const unfollowUser = mutation({
  args: {
    userId: v.string(), // Clerk ID of target user
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserOrThrow(ctx);
    
    if (!currentUser.clerkId) {
      throw new Error("User not authenticated properly");
    }

    // Can't unfollow yourself
    if (currentUser.clerkId === args.userId) {
      throw new Error("You can't unfollow yourself");
    }

    // Check if currently following
    const existingFollow = await ctx.db
      .query('follows')
      .withIndex('byFollowerAndFollowing', (q) => 
        q.eq('followerId', currentUser.clerkId).eq('followingId', args.userId)
      )
      .unique();

    if (!existingFollow) {
      // Not following, do nothing
      return { success: true, action: 'not_following' };
    }

    // Delete follow
    await ctx.db.delete(existingFollow._id);
    
    return { success: true, action: 'unfollowed' };
  },
});

// Get followers of a user (by Clerk ID)
export const getFollowers = query({
  args: {
    clerkId: v.string(), // Clerk ID of target user
  },
  handler: async (ctx, args) => {
    // Get all follows where followingId = clerkId (people following this user)
    const follows = await ctx.db
      .query('follows')
      .withIndex('byFollowing', (q) => q.eq('followingId', args.clerkId))
      .collect();

    // Get ALL follows to calculate live counts
    const allFollows = await ctx.db.query('follows').collect();

    // Calculate live followers count for a user
    const getLiveFollowersCount = (targetClerkId: string) => {
      return allFollows.filter(f => f.followingId === targetClerkId).length;
    };

    // Get user details for each follower by Clerk ID
    const followers = await Promise.all(
      follows.map(async (follow) => {
        const user = await ctx.db
          .query('users')
          .withIndex('byClerkId', (q) => q.eq('clerkId', follow.followerId))
          .unique();
        if (!user) return null;
        return {
          _id: user._id,
          clerkId: user.clerkId,
          first_name: user.first_name,
          last_name: user.last_name,
          username: user.username,
          imageUrl: user.imageUrl,
          // Use live followers count from follows table
          followersCount: getLiveFollowersCount(user.clerkId),
        };
      })
    );

    return followers.filter(Boolean);
  },
});

// Get users that a user is following (by Clerk ID)
export const getFollowing = query({
  args: {
    clerkId: v.string(), // Clerk ID of target user
  },
  handler: async (ctx, args) => {
    // Get all follows where followerId = clerkId (people this user follows)
    const follows = await ctx.db
      .query('follows')
      .withIndex('byFollower', (q) => q.eq('followerId', args.clerkId))
      .collect();

    // Get ALL follows to calculate live counts
    const allFollows = await ctx.db.query('follows').collect();

    // Calculate live followers count for a user
    const getLiveFollowersCount = (targetClerkId: string) => {
      return allFollows.filter(f => f.followingId === targetClerkId).length;
    };

    // Get user details for each following by Clerk ID
    const following = await Promise.all(
      follows.map(async (follow) => {
        const user = await ctx.db
          .query('users')
          .withIndex('byClerkId', (q) => q.eq('clerkId', follow.followingId))
          .unique();
        if (!user) return null;
        return {
          _id: user._id,
          clerkId: user.clerkId,
          first_name: user.first_name,
          last_name: user.last_name,
          username: user.username,
          imageUrl: user.imageUrl,
          // Use live followers count from follows table
          followersCount: getLiveFollowersCount(user.clerkId),
        };
      })
    );

    return following.filter(Boolean);
  },
});

export const getUserById = query({
  args: {
    userId: v.optional(v.id('users')),
  },
  handler: async (ctx, args) => {
    if (!args.userId) return null;
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    
    // Return user as-is - imageUrl is already a URL (not storage ID)
    return user;
  },
});

export const createUser = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    first_name: v.optional(v.string()),
    last_name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    username: v.union(v.string(), v.null()),
    bio: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    followersCount: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.db.insert('users', {
      ...args,
      username: args.username || `${args.first_name || ''}${args.last_name || ''}`,
    });
    return userId;
  },
});

export const updateUser = mutation({
  args: {
    _id: v.id('users'),
    first_name: v.optional(v.string()),
    last_name: v.optional(v.string()),
    username: v.optional(v.string()),
    bio: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    pushToken: v.optional(v.string()),
    // Education fields
    college: v.optional(v.string()),
    course: v.optional(v.string()),
    branch: v.optional(v.string()),
    semester: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await getCurrentUserOrThrow(ctx);

    const { _id, ...rest } = args;
    console.log('updateUser: updating user with:', { _id, ...rest });
    return await ctx.db.patch(_id, rest);
  },
});

export const generateUploadUrl = mutation(async (ctx) => {
  await getCurrentUserOrThrow(ctx);

  return await ctx.storage.generateUploadUrl();
});

export const updateImage = mutation({
  args: { storageId: v.id('_storage'), _id: v.id('users') },
  handler: async (ctx, args) => {
    await ctx.db.patch(args._id, {
      imageUrl: args.storageId,
    });
  },
});

// Update user image with resolved URL (simpler than storage ID)
export const updateUserImage = mutation({
  args: {
    _id: v.id('users'),
    imageUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args._id, {
      imageUrl: args.imageUrl,
    });
  },
});

// Update notification settings
export const updateNotificationSetting = mutation({
  args: {
    enableNotifications: v.boolean(),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserOrThrow(ctx);
    
    await ctx.db.patch(currentUser._id, {
      enableNotifications: args.enableNotifications,
    });
    
    return { success: true, enableNotifications: args.enableNotifications };
  },
});

// Get file URL from storage
export const getFileUrl = query({
  args: { storageId: v.string() },
  handler: async (ctx, args) => {
    console.log('getFileUrl: fetching URL for storageId:', args.storageId);
    try {
      const url = await ctx.storage.getUrl(args.storageId as Id<'_storage'>);
      console.log('getFileUrl: resolved URL:', url);
      return url;
    } catch (error) {
      console.error('getFileUrl: error:', error);
      return null;
    }
  },
});

// Fix corrupted user profile (reset imageUrl to Clerk URL)
export const fixUserProfile = mutation({
  args: {
    clerkId: v.string(),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('byClerkId', (q) => q.eq('clerkId', args.clerkId))
      .unique();
    
    if (!user) {
      throw new Error('User not found');
    }
    
    // Reset imageUrl to the Clerk URL (or clear it if not provided)
    await ctx.db.patch(user._id, {
      imageUrl: args.imageUrl || undefined,
    });
    
    return user._id;
  },
});

// Sync user from Clerk to Convex (called on login)
export const syncUser = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    imageUrl: v.optional(v.string()),
    first_name: v.optional(v.string()),
    last_name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Validate required fields
    if (!args.clerkId) {
      throw new Error('clerkId is required');
    }
    if (!args.email) {
      throw new Error('email is required');
    }
    
    // Check if user exists
    const existingUser = await ctx.db
      .query('users')
      .withIndex('byClerkId', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (existingUser) {
      // Update existing user with latest Clerk data
      // Only update imageUrl if user doesn't have a custom uploaded image
      // Custom images are stored as Convex storage IDs (short strings without slashes or file:// prefix)
      const updates: Record<string, any> = {
        email: args.email,
        first_name: args.first_name,
        last_name: args.last_name,
      };

      console.log('syncUser: existingUser:', existingUser);
      
      // Check if user has a valid custom image (Convex storage ID)
      // We consider anything that doesn't start with http/https to be a custom image (storage ID)
      const isConvexStorageId = (id: string | null | undefined): boolean => {
        if (!id) return false;
        // Check if it's NOT a standard URL
        return !id.startsWith('http://') && !id.startsWith('https://');
      };
      
      const hasCustomImage = isConvexStorageId(existingUser.imageUrl);
      
      console.log(`Syncing user ${args.clerkId}: hasCustomImage=${hasCustomImage}, existingImage=${existingUser.imageUrl}, newImage=${args.imageUrl}`);
      
      await ctx.db.patch(existingUser._id, updates);
      return existingUser._id;
    }

    // Create new user
    const userId = await ctx.db.insert('users', {
      clerkId: args.clerkId,
      email: args.email,
      imageUrl: args.imageUrl,
      first_name: args.first_name,
      last_name: args.last_name,
      username: `${args.first_name || ''}${args.last_name || ''}`,
      bio: undefined,
      websiteUrl: undefined,
      location: undefined,
      followersCount: 0,
      pushToken: undefined,
      isPrivate: false,
    });

    return userId;
  },
});

// IDENTITY CHECK
// https://docs.convex.dev/auth/database-auth#mutations-for-upserting-and-deleting-users

export const current = query({
  args: {},
  handler: async (ctx) => {
    return await getCurrentUser(ctx);
  },
});

export const deleteFromClerk = internalMutation({
  args: { clerkUserId: v.string() },
  async handler(ctx, { clerkUserId }) {
    const user = await userByExternalId(ctx, clerkUserId);

    if (user !== null) {
      await ctx.db.delete(user._id);
    } else {
      console.warn(`Can't delete user, there is none for Clerk user ID: ${clerkUserId}`);
    }
  },
});

// ============ PRIVATE ACCOUNT FEATURE ============

// Send a follow request to a private account
export const sendFollowRequest = mutation({
  args: {
    targetClerkId: v.string(), // Clerk ID of user to send request to
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserOrThrow(ctx);
    const { targetClerkId } = args;

    // Can't follow yourself
    if (currentUser.clerkId === targetClerkId) {
      throw new Error("You can't follow yourself");
    }

    // Get target user
    const targetUser = await ctx.db
      .query('users')
      .withIndex('byClerkId', (q) => q.eq('clerkId', targetClerkId))
      .unique();

    if (!targetUser) {
      throw new Error('User not found');
    }

    // Check if already following
    const existingFollow = await ctx.db
      .query('follows')
      .withIndex('byFollowerAndFollowing', (q) => 
        q.eq('followerId', currentUser.clerkId).eq('followingId', targetClerkId)
      )
      .unique();

    if (existingFollow) {
      return { success: true, message: 'Already following' };
    }

    // Check if already have a pending request
    const existingRequest = await ctx.db
      .query('followRequests')
      .withIndex('byToAndStatus', (q) => 
        q.eq('toClerkId', targetClerkId).eq('status', 'pending')
      )
      .filter((q) => q.eq(q.field('fromClerkId'), currentUser.clerkId))
      .first();

    if (existingRequest) {
      return { success: true, message: 'Request already sent' };
    }

    // If account is NOT private, follow directly without request
    if (!targetUser.isPrivate) {
      // Create follow relationship
      await ctx.db.insert('follows', {
        followerId: currentUser.clerkId,
        followingId: targetClerkId,
        createdAt: Date.now(),
      });

      // Update follower count
      await ctx.db.patch(targetUser._id, {
        followersCount: (targetUser.followersCount || 0) + 1,
      });

      return { success: true, message: 'Now following' };
    }

    // Account is private - send follow request
    await ctx.db.insert('followRequests', {
      fromClerkId: currentUser.clerkId,
      toClerkId: targetClerkId,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true, message: 'Follow request sent' };
  },
});

// Accept a follow request
export const acceptFollowRequest = mutation({
  args: {
    requestId: v.id('followRequests'),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    // Get the request
    const request = await ctx.db.get(args.requestId);

    if (!request) {
      throw new Error('Request not found');
    }

    // Verify this request is for current user
    if (request.toClerkId !== currentUser.clerkId) {
      throw new Error('Not authorized');
    }

    if (request.status !== 'pending') {
      throw new Error('Request already processed');
    }

    // Get the requester (follower) user
    const requesterUser = await ctx.db
      .query('users')
      .withIndex('byClerkId', (q) => q.eq('clerkId', request.fromClerkId))
      .unique();

    // Create follow relationship (follower follows current user)
    await ctx.db.insert('follows', {
      followerId: request.fromClerkId,
      followingId: currentUser.clerkId,
      createdAt: Date.now(),
    });

    // Update follower count
    if (requesterUser) {
      await ctx.db.patch(requesterUser._id, {
        followersCount: (requesterUser.followersCount || 0) + 1,
      });
    }

    // Update request status
    await ctx.db.patch(args.requestId, {
      status: 'accepted',
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Reject a follow request
export const rejectFollowRequest = mutation({
  args: {
    requestId: v.id('followRequests'),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    // Get the request
    const request = await ctx.db.get(args.requestId);

    if (!request) {
      throw new Error('Request not found');
    }

    // Verify this request is for current user
    if (request.toClerkId !== currentUser.clerkId) {
      throw new Error('Not authorized');
    }

    if (request.status !== 'pending') {
      throw new Error('Request already processed');
    }

    // Update request status
    await ctx.db.patch(args.requestId, {
      status: 'rejected',
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Cancel own follow request
export const cancelFollowRequest = mutation({
  args: {
    targetClerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    // Find the pending request
    const request = await ctx.db
      .query('followRequests')
      .withIndex('byToAndStatus', (q) => 
        q.eq('toClerkId', args.targetClerkId).eq('status', 'pending')
      )
      .filter((q) => q.eq(q.field('fromClerkId'), currentUser.clerkId))
      .first();

    if (!request) {
      return { success: true, message: 'No pending request' };
    }

    // Delete the request
    await ctx.db.delete(request._id);

    return { success: true };
  },
});

// Get pending follow requests for current user
export const getPendingFollowRequests = query({
  args: {},
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    const requests = await ctx.db
      .query('followRequests')
      .withIndex('byToAndStatus', (q) => 
        q.eq('toClerkId', currentUser.clerkId).eq('status', 'pending')
      )
      .collect();

    // Get user details for each request
    const requestsWithUsers = await Promise.all(
      requests.map(async (request) => {
        const user = await ctx.db
          .query('users')
          .withIndex('byClerkId', (q) => q.eq('clerkId', request.fromClerkId))
          .unique();

        return {
          ...request,
          user: user ? {
            _id: user._id,
            clerkId: user.clerkId,
            first_name: user.first_name,
            last_name: user.last_name,
            username: user.username,
            imageUrl: user.imageUrl,
          } : null,
        };
      })
    );

    return requestsWithUsers;
  },
});

// Get follow request status for a user
export const getFollowRequestStatus = query({
  args: {
    targetClerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    if (currentUser.clerkId === args.targetClerkId) {
      return { status: 'self' };
    }

    // Check if already following
    const existingFollow = await ctx.db
      .query('follows')
      .withIndex('byFollowerAndFollowing', (q) => 
        q.eq('followerId', currentUser.clerkId).eq('followingId', args.targetClerkId)
      )
      .unique();

    if (existingFollow) {
      return { status: 'following' };
    }

    // Check for pending request
    const pendingRequest = await ctx.db
      .query('followRequests')
      .withIndex('byToAndStatus', (q) => 
        q.eq('toClerkId', args.targetClerkId).eq('status', 'pending')
      )
      .filter((q) => q.eq(q.field('fromClerkId'), currentUser.clerkId))
      .first();

    if (pendingRequest) {
      return { status: 'pending' };
    }

    return { status: 'none' };
  },
});

// Update user's privacy setting
export const updatePrivacySetting = mutation({
  args: {
    isPrivate: v.boolean(),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    await ctx.db.patch(currentUser._id, {
      isPrivate: args.isPrivate,
    });

    return { success: true };
  },
});

// Get user's privacy setting
export const getPrivacySetting = query({
  args: {},
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserOrThrow(ctx);
    return currentUser.isPrivate || false;
  },
});

// Update notification settings
export const updateNotificationSettings = mutation({
  args: {
    enableNotifications: v.optional(v.boolean()),
    notifyLikes: v.optional(v.boolean()),
    notifyComments: v.optional(v.boolean()),
    notifyFollows: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserOrThrow(ctx);
    
    await ctx.db.patch(currentUser._id, {
      enableNotifications: args.enableNotifications,
      notifyLikes: args.notifyLikes,
      notifyComments: args.notifyComments,
      notifyFollows: args.notifyFollows,
    });
    
    return { success: true };
  },
});

// Get notification settings
export const getNotificationSettings = query({
  args: {},
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserOrThrow(ctx);
    return {
      enableNotifications: currentUser.enableNotifications ?? true,
      notifyLikes: currentUser.notifyLikes ?? true,
      notifyComments: currentUser.notifyComments ?? true,
      notifyFollows: currentUser.notifyFollows ?? true,
    };
  },
});

export async function getCurrentUserOrThrow(ctx: QueryCtx) {
  const userRecord = await getCurrentUser(ctx);
  if (!userRecord) throw new Error("Can't get current user");
  return userRecord;
}

export async function getCurrentUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    return null;
  }
  return await userByExternalId(ctx, identity.subject);
}

async function userByExternalId(ctx: QueryCtx, externalId: string) {
  return await ctx.db
    .query('users')
    .withIndex('byClerkId', (q) => q.eq('clerkId', externalId))
    .unique();
}

// Block a user
export const blockUser = mutation({
  args: {
    blockedClerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserOrThrow(ctx);
    
    if (!currentUser.clerkId) {
      throw new Error("Can't get current user's clerk ID");
    }
    
    // Don't allow blocking yourself
    if (currentUser.clerkId === args.blockedClerkId) {
      throw new Error("You cannot block yourself");
    }
    
    // Check if already blocked
    const existingBlock = await ctx.db
      .query('blockedUsers')
      .withIndex('byBlockerAndBlocked', (q) => 
        q.eq('blockerId', currentUser.clerkId).eq('blockedId', args.blockedClerkId)
      )
      .unique();
    
    if (existingBlock) {
      return { success: true, message: 'User already blocked' };
    }
    
    // Create block record
    await ctx.db.insert('blockedUsers', {
      blockerId: currentUser.clerkId,
      blockedId: args.blockedClerkId,
      createdAt: Date.now(),
    });
    
    // Remove any follow relationship
    const existingFollow = await ctx.db
      .query('follows')
      .withIndex('byFollowerAndFollowing', (q) => 
        q.eq('followerId', currentUser.clerkId).eq('followingId', args.blockedClerkId)
      )
      .unique();
    
    if (existingFollow) {
      await ctx.db.delete(existingFollow._id);
    }
    
    // Also remove if the blocked user was following the current user
    const existingFollower = await ctx.db
      .query('follows')
      .withIndex('byFollowerAndFollowing', (q) => 
        q.eq('followerId', args.blockedClerkId).eq('followingId', currentUser.clerkId)
      )
      .unique();
    
    if (existingFollower) {
      await ctx.db.delete(existingFollower._id);
    }
    
    // Cancel any pending follow requests
    const pendingRequest = await ctx.db
      .query('followRequests')
      .withIndex('byToAndStatus', (q) => 
        q.eq('toClerkId', currentUser.clerkId).eq('status', 'pending')
      )
      .filter((q) => q.eq(q.field('fromClerkId'), args.blockedClerkId))
      .first();
    
    if (pendingRequest) {
      await ctx.db.delete(pendingRequest._id);
    }
    
    return { success: true };
  },
});

// Unblock a user
export const unblockUser = mutation({
  args: {
    blockedClerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserOrThrow(ctx);
    
    if (!currentUser.clerkId) {
      throw new Error("Can't get current user's clerk ID");
    }
    
    // Find and delete block record
    const existingBlock = await ctx.db
      .query('blockedUsers')
      .withIndex('byBlockerAndBlocked', (q) => 
        q.eq('blockerId', currentUser.clerkId).eq('blockedId', args.blockedClerkId)
      )
      .unique();
    
    if (existingBlock) {
      await ctx.db.delete(existingBlock._id);
    }
    
    return { success: true };
  },
});

// Check if user is blocked
export const isUserBlocked = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    
    if (!currentUser || !currentUser.clerkId) {
      return false;
    }
    
    const existingBlock = await ctx.db
      .query('blockedUsers')
      .withIndex('byBlockerAndBlocked', (q) => 
        q.eq('blockerId', currentUser.clerkId).eq('blockedId', args.clerkId)
      )
      .unique();
    
    return !!existingBlock;
  },
});

// Get all blocked users
export const getBlockedUsers = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUserOrThrow(ctx);
    
    if (!currentUser.clerkId) {
      throw new Error("Can't get current user's clerk ID");
    }
    
    // Get all blocked user records for this blocker
    const blocked = await ctx.db
      .query('blockedUsers')
      .withIndex('byBlocker', (q) => q.eq('blockerId', currentUser.clerkId))
      .collect();
    
    const users = [];
    
    for (const item of blocked) {
      // Get the blocked user's details using their clerkId
      const blockedUser = await ctx.db
        .query('users')
        .withIndex('byClerkId', (q) => q.eq('clerkId', item.blockedId))
        .unique();
      
      if (blockedUser) {
        users.push({
          ...blockedUser,
          blockedAt: item.createdAt,
        });
      }
    }
    
    return users;
  },
});

// Helper function to check if either user has blocked the other (bidirectional check)
// Returns true if:
// - viewerId has blocked profileUserId, OR
// - profileUserId has blocked viewerId
export async function isBlocked(ctx: QueryCtx, viewerClerkId: string | undefined, profileClerkId: string | undefined): Promise<boolean> {
  if (!viewerClerkId || !profileClerkId) {
    return false;
  }
  
  // Check if viewer has blocked profile user
  const block1 = await ctx.db
    .query('blockedUsers')
    .withIndex('byBlockerAndBlocked', (q) => 
      q.eq('blockerId', viewerClerkId).eq('blockedId', profileClerkId)
    )
    .first();
  
  if (block1) {
    return true;
  }
  
  // Check if profile user has blocked viewer
  const block2 = await ctx.db
    .query('blockedUsers')
    .withIndex('byBlockerAndBlocked', (q) => 
      q.eq('blockerId', profileClerkId).eq('blockedId', viewerClerkId)
    )
    .first();
  
  return !!block2;
}

// Get user's profile with blocked status - returns limited info if blocked
export const getUserProfileWithBlockStatus = query({
  args: {
    profileClerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    const viewerClerkId = currentUser?.clerkId;
    
    // Get the profile user by clerkId
    const user = await ctx.db
      .query('users')
      .withIndex('byClerkId', (q) => q.eq('clerkId', args.profileClerkId))
      .unique();
    
    if (!user) {
      return null;
    }
    
    // Check if either user has blocked the other (bidirectional)
    const blocked = await isBlocked(ctx, viewerClerkId, args.profileClerkId);
    
    // Check specifically if current user blocked profile user
    let iBlockedThem = false;
    if (viewerClerkId) {
      const blockRecord = await ctx.db
        .query('blockedUsers')
        .withIndex('byBlockerAndBlocked', (q) => 
          q.eq('blockerId', viewerClerkId).eq('blockedId', args.profileClerkId)
        )
        .first();
      iBlockedThem = !!blockRecord;
    }
    
    // Get live follow counts
    const followers = await ctx.db
      .query('follows')
      .withIndex('byFollowing', (q) => q.eq('followingId', args.profileClerkId))
      .collect();
    
    const following = await ctx.db
      .query('follows')
      .withIndex('byFollower', (q) => q.eq('followerId', args.profileClerkId))
      .collect();
    
    if (blocked && viewerClerkId !== args.profileClerkId) {
      // Return limited profile info when blocked
      return {
        _id: user._id,
        clerkId: user.clerkId,
        username: user.username,
        imageUrl: user.imageUrl,
        bio: user.bio,
        first_name: user.first_name,
        last_name: user.last_name,
        college: user.college,
        course: user.course,
        branch: user.branch,
        semester: user.semester,
        followersCount: followers.length,
        followingCount: following.length,
        posts: [],
        replies: [],
        blockedView: true,
        iBlockedThem: iBlockedThem,
      };
    }
    
    // Return full profile info
    return {
      ...user,
      followersCount: followers.length,
      followingCount: following.length,
      posts: [],
      replies: [],
      blockedView: false,
      iBlockedThem: false,
    };
  },
});

// Get list of Clerk IDs that the current user has blocked
export const getBlockedUserIds = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUser(ctx);
    
    if (!currentUser || !currentUser.clerkId) {
      return [];
    }
    
    const blocked = await ctx.db
      .query('blockedUsers')
      .withIndex('byBlocker', (q) => q.eq('blockerId', currentUser.clerkId))
      .collect();
    
    return blocked.map(b => b.blockedId);
  },
});

// Set user as online (called when app opens)
export const setUserOnline = mutation({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUserOrThrow(ctx);
    
    await ctx.db.patch(currentUser._id, {
      isOnline: true,
      lastSeen: Date.now(),
    });
    
    return { success: true };
  },
});

// Set user as offline (called when app goes to background)
export const setUserOffline = mutation({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUserOrThrow(ctx);
    
    await ctx.db.patch(currentUser._id, {
      isOnline: false,
      lastSeen: Date.now(),
    });
    
    return { success: true };
  },
});

// Update show online status privacy setting
export const updateShowOnlineStatus = mutation({
  args: {
    showOnlineStatus: v.boolean(),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserOrThrow(ctx);
    
    await ctx.db.patch(currentUser._id, {
      showOnlineStatus: args.showOnlineStatus,
    });
    
    return { success: true };
  },
});

// Update allow profile search privacy setting
export const updateAllowProfileSearch = mutation({
  args: {
    allowProfileSearch: v.boolean(),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserOrThrow(ctx);
    
    await ctx.db.patch(currentUser._id, {
      allowProfileSearch: args.allowProfileSearch,
    });
    
    return { success: true };
  },
});

// Add to search history
export const addToSearchHistory = mutation({
  args: {
    searchedUsername: v.string(),
    searchedClerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserOrThrow(ctx);
    
    // Check if already exists in recent history (within last hour)
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const existingEntry = await ctx.db
      .query('searchHistory')
      .withIndex('byUserAndSearchedAt', (q) => 
        q.eq('userId', currentUser._id)
      )
      .filter((q) => q.gte(q.field('searchedAt'), oneHourAgo))
      .collect();
    
    const alreadySearched = existingEntry.find(
      entry => entry.searchedClerkId === args.searchedClerkId
    );
    
    if (!alreadySearched) {
      await ctx.db.insert('searchHistory', {
        userId: currentUser._id,
        searchedUsername: args.searchedUsername,
        searchedClerkId: args.searchedClerkId,
        searchedAt: Date.now(),
      });
    }
    
    return { success: true };
  },
});

// Get search history
export const getSearchHistory = query({
  args: {},
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) return [];
    
    const history = await ctx.db
      .query('searchHistory')
      .withIndex('byUserAndSearchedAt', (q) => 
        q.eq('userId', currentUser._id)
      )
      .order('desc')
      .take(50);
    
    return history;
  },
});

// Clear search history
export const clearSearchHistory = mutation({
  args: {},
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserOrThrow(ctx);
    
    const history = await ctx.db
      .query('searchHistory')
      .withIndex('byUser', (q) => q.eq('userId', currentUser._id))
      .collect();
    
    // Delete all entries
    for (const entry of history) {
      await ctx.db.delete(entry._id);
    }
    
    return { success: true };
  },
});

// Delete a single search history item
export const deleteSearchHistoryItem = mutation({
  args: { id: v.id('searchHistory') },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserOrThrow(ctx);
    
    // Get the search history entry
    const entry = await ctx.db.get(args.id);
    
    // Verify the entry exists and belongs to the current user
    if (!entry || entry.userId !== currentUser._id) {
      throw new Error('Search history entry not found or access denied');
    }
    
    // Delete the entry
    await ctx.db.delete(args.id);
    
    return { success: true };
  },
});

// Get user's activity history (posts, comments, likes)
export const getActivityHistory = query({
  args: {},
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) return { posts: [], likes: [], comments: [] };
    
    // Get posts by user
    const posts = await ctx.db
      .query('messages')
      .withIndex('byUser', (q) => q.eq('userId', currentUser._id))
      .filter((q) => q.eq(q.field('isPosted'), true))
      .order('desc')
      .take(50);
    
    // Get likes by user
    const likes = await ctx.db
      .query('likes')
      .withIndex('byUser', (q) => q.eq('userId', currentUser._id))
      .order('desc')
      .take(50);
    
    // Get messages that are comments (have parentId)
    const allMessages = await ctx.db
      .query('messages')
      .withIndex('byUser', (q) => q.eq('userId', currentUser._id))
      .filter((q) => q.neq(q.field('parentId'), undefined))
      .order('desc')
      .take(50);
    
    return {
      posts: posts.map(p => ({
        _id: p._id,
        content: p.content,
        createdAt: p._creationTime,
        type: 'post',
      })),
      likes: likes.map(l => ({
        _id: l._id,
        messageId: l.messageId,
        createdAt: l._creationTime,
        type: 'like',
      })),
      comments: allMessages.map(c => ({
        _id: c._id,
        content: c.content,
        parentId: c.parentId,
        createdAt: c._creationTime,
        type: 'comment',
      })),
    };
  },
});

// Get interaction history (likes, comments, replies on user's posts)
export const getInteractionHistory = query({
  args: {},
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) return [];
    
    // Get all posts by current user
    const userPosts = await ctx.db
      .query('messages')
      .withIndex('byUser', (q) => q.eq('userId', currentUser._id))
      .filter((q) => q.eq(q.field('isPosted'), true))
      .collect();
    
    const userPostIds = new Set(userPosts.map(p => p._id));
    
    // Get likes on user's posts
    const allLikes = await ctx.db.query('likes').collect();
    const likesOnPosts = allLikes.filter(l => userPostIds.has(l.messageId));
    
    // Get messages that are replies to user's posts
    const allMessages = await ctx.db.query('messages').collect();
    const repliesToPosts = allMessages.filter(
      m => m.parentId && userPostIds.has(m.parentId)
    );
    
    // Combine and sort by time
    const interactions = [
      ...likesOnPosts.map(l => ({
        _id: l._id,
        type: 'like' as const,
        messageId: l.messageId,
        createdAt: l._creationTime,
      })),
      ...repliesToPosts.map(r => ({
        _id: r._id,
        type: 'comment' as const,
        content: r.content,
        parentId: r.parentId,
        createdAt: r._creationTime,
      })),
    ].sort((a, b) => b.createdAt - a.createdAt).slice(0, 50);
    
    return interactions;
  },
});

// Get account usage statistics
export const getAccountUsage = query({
  args: {},
  handler: async (ctx, args) => {
    // Step 1: Get Current User
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    const currentUserId = identity.subject;
    
    // Get the Convex user record
    const currentUser = await ctx.db
      .query('users')
      .withIndex('byClerkId', (q) => q.eq('clerkId', currentUserId))
      .unique();
    
    if (!currentUser) return null;
    
    // Step 2: Total Posts - Count only posts created by the current user
    // Must match exactly what the profile shows:
    // - isPosted !== false (includes both true and undefined for backward compatibility)
    // - isArchived !== true (excludes archived posts)
    // - threadId === undefined (excludes replies/comments, only top-level posts)
    const allUserMessages = await ctx.db
      .query('messages')
      .withIndex('byUser', (q) => q.eq('userId', currentUser._id))
      .collect();
    
    // Filter for posts: isPosted !== false AND isArchived !== true AND threadId === undefined
    // This exactly matches what the profile shows (Posts tab)
    const posts = allUserMessages.filter(m => 
      m.isPosted !== false && 
      m.isArchived !== true &&
      !m.threadId
    );
    const postIds = posts.map(p => p._id);
    
    // Step 3: Total Likes - Count all likes received on the user's posts
    let totalLikes = 0;
    for (const post of posts) {
      const likesOnPost = await ctx.db
        .query('likes')
        .withIndex('byMessage', (q) => q.eq('messageId', post._id))
        .collect();
      totalLikes += likesOnPost.length;
    }
    
    // Step 4: Total Comments - Count all comments on the user's visible posts
    // Get all comments where threadId OR postId matches any of the user's post IDs
    const allMessages = await ctx.db.query('messages').collect();
    
    // Create a Set of post IDs as strings for comparison
    const postIdSet = new Set(postIds.map(id => id.toString()));
    
    // Filter comments that are on the user's posts and are posted
    const commentsOnUserPosts = allMessages.filter(m => {
      // Must be a comment (has threadId or postId, but no parentId for top-level comments)
      const isComment = (m.threadId || m.postId) && !m.parentId;
      if (!isComment) return false;
      
      // Must be on one of the user's visible posts
      const commentThreadId = m.threadId?.toString();
      const commentPostId = m.postId?.toString();
      const isOnUserPost = (commentThreadId && postIdSet.has(commentThreadId)) || 
                           (commentPostId && postIdSet.has(commentPostId));
      if (!isOnUserPost) return false;
      
      // Must be posted (not draft, not scheduled)
      return m.isPosted !== false && m.isDraft !== true;
    });
    
    const totalComments = commentsOnUserPosts.length;
    
    // Step 5: Followers - Count users who follow the current user
    const followers = await ctx.db
      .query('follows')
      .withIndex('byFollowing', (q) => q.eq('followingId', currentUserId))
      .collect();
    
    // Step 6: Following - Count users the current user follows
    const following = await ctx.db
      .query('follows')
      .withIndex('byFollower', (q) => q.eq('followerId', currentUserId))
      .collect();

    // Step 7: Return Statistics
    return {
      totalPosts: posts.length,
      totalLikes: totalLikes,
      totalComments: totalComments,
      totalFollowers: followers.length,
      totalFollowing: following.length,
      accountCreatedAt: currentUser._creationTime,
    };
  },
});
