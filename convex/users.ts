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

// Check if current user is following a specific user
export const isFollowing = query({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) return false;

    const existingFollow = await ctx.db
      .query('follows')
      .withIndex('byFollowerAndFollowing', (q) => 
        q.eq('followerId', currentUser._id).eq('followingId', args.userId)
      )
      .unique();

    return !!existingFollow;
  },
});

// Follow a user
export const followUser = mutation({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserOrThrow(ctx);

    // Can't follow yourself
    if (currentUser._id === args.userId) {
      throw new Error("You can't follow yourself");
    }

    // Check if already following
    const existingFollow = await ctx.db
      .query('follows')
      .withIndex('byFollowerAndFollowing', (q) => 
        q.eq('followerId', currentUser._id).eq('followingId', args.userId)
      )
      .unique();

    if (existingFollow) {
      // Already following, unfollow
      await ctx.db.delete(existingFollow._id);
      
      // Decrease followers count
      const targetUser = await ctx.db.get(args.userId);
      if (targetUser) {
        await ctx.db.patch(args.userId, {
          followersCount: Math.max(0, (targetUser.followersCount || 1) - 1),
        });
      }
      
      return { success: false };
    }

    // Create follow
    await ctx.db.insert('follows', {
      followerId: currentUser._id,
      followingId: args.userId,
      createdAt: Date.now(),
    });

    // Increase followers count
    const targetUser = await ctx.db.get(args.userId);
    if (targetUser) {
      await ctx.db.patch(args.userId, {
        followersCount: (targetUser.followersCount || 0) + 1,
      });
    }

    return { success: true };
  },
});

// Get followers of a user
export const getFollowers = query({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    // Get all follows where followingId = userId (people following this user)
    const follows = await ctx.db
      .query('follows')
      .withIndex('byFollowing', (q) => q.eq('followingId', args.userId))
      .collect();

    // Get user details for each follower
    const followers = await Promise.all(
      follows.map(async (follow) => {
        const user = await ctx.db.get(follow.followerId);
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

// Get users that a user is following
export const getFollowing = query({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    // Get all follows where followerId = userId (people this user follows)
    const follows = await ctx.db
      .query('follows')
      .withIndex('byFollower', (q) => q.eq('followerId', args.userId))
      .collect();

    // Get user details for each following
    const following = await Promise.all(
      follows.map(async (follow) => {
        const user = await ctx.db.get(follow.followingId);
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
