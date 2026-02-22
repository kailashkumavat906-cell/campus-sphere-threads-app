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

    // Get current user to exclude from results
    const currentUser = await getCurrentUser(ctx);
    const currentUserId = currentUser?._id;

    // Convert search text to lowercase for case-insensitive matching
    const searchLower = searchText.toLowerCase();

    // Get all users and filter manually (Convex doesn't support full-text search across multiple fields)
    const allUsers = await ctx.db.query('users').collect();
    
    // Filter users matching the search text
    const matchingUsers = allUsers
      .filter((user) => {
        // Exclude current user from results
        if (currentUserId && user._id === currentUserId) {
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

    // Filter and sort users
    const recommendedUsers = allUsers
      .filter((user) => {
        // Exclude current user from results
        if (currentUserId && user._id === currentUserId) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Sort by followersCount descending
        return (b.followersCount || 0) - (a.followersCount || 0);
      })
      .slice(0, 20) // Limit to 20 users
      .map((user) => ({
        _id: user._id,
        clerkId: user.clerkId,
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.username,
        imageUrl: user.imageUrl,
        followersCount: user.followersCount,
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
          followersCount: user.followersCount,
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
          followersCount: user.followersCount,
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
