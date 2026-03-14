import { v } from 'convex/values';
import { internalMutation, mutation, query } from './_generated/server';

const MAX_SESSIONS_PER_USER = 10;
const DUPLICATE_TIME_WINDOW = 30 * 60 * 1000; // 30 minutes in milliseconds

// Get all sessions for a user by Clerk ID
export const getUserSessions = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.clerkId) return [];

    const sessions = await ctx.db
      .query('sessions')
      .withIndex('byClerkId', (q) => q.eq('clerkId', args.clerkId))
      .collect();

    // Sort by loginTime descending (most recent first) and limit to 10
    return sessions
      .sort((a, b) => b.loginTime - a.loginTime)
      .slice(0, MAX_SESSIONS_PER_USER);
  },
});

// Get current device session for a user
export const getCurrentSession = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.clerkId) return null;

    const session = await ctx.db
      .query('sessions')
      .withIndex('byClerkIdAndCurrent', (q) => 
        q.eq('clerkId', args.clerkId).eq('isCurrentDevice', true)
      )
      .unique();

    return session;
  },
});

// Create a new session (called on login) - internal version
export const createSessionInternal = internalMutation({
  args: {
    userId: v.id('users'),
    clerkId: v.string(),
    deviceName: v.string(),
    deviceType: v.union(v.literal('mobile'), v.literal('desktop')),
    deviceInfo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // First, mark all existing sessions as not current
    const existingSessions = await ctx.db
      .query('sessions')
      .withIndex('byClerkId', (q) => q.eq('clerkId', args.clerkId))
      .collect();

    for (const session of existingSessions) {
      await ctx.db.patch(session._id, { isCurrentDevice: false });
    }

    // Create new session as current device
    const sessionId = await ctx.db.insert('sessions', {
      userId: args.userId,
      clerkId: args.clerkId,
      deviceName: args.deviceName,
      deviceType: args.deviceType,
      loginTime: now,
      lastActive: now,
      isCurrentDevice: true,
      deviceInfo: args.deviceInfo,
    });

    return sessionId;
  },
});

// Create session from client (called on login)
export const createSession = mutation({
  args: {
    clerkId: v.string(),
    deviceName: v.string(),
    deviceType: v.union(v.literal('mobile'), v.literal('desktop')),
    deviceInfo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.clerkId) return null;

    // Get user by clerkId
    const user = await ctx.db
      .query('users')
      .withIndex('byClerkId', (q) => q.eq('clerkId', args.clerkId))
      .unique();

    if (!user) return null;

    const now = Date.now();

    // Check for existing sessions
    const existingSessions = await ctx.db
      .query('sessions')
      .withIndex('byClerkId', (q) => q.eq('clerkId', args.clerkId))
      .collect();

    // Check if same device logged in within time window - update instead of create
    const recentSession = existingSessions.find(
      (s) =>
        s.deviceName === args.deviceName &&
        now - s.loginTime < DUPLICATE_TIME_WINDOW
    );

    if (recentSession) {
      // Update lastActive time for existing session
      await ctx.db.patch(recentSession._id, {
        lastActive: now,
        isCurrentDevice: true,
      });

      // Mark all other sessions as not current
      for (const session of existingSessions) {
        if (session._id !== recentSession._id) {
          await ctx.db.patch(session._id, { isCurrentDevice: false });
        }
      }

      return recentSession._id;
    }

    // Mark all existing sessions as not current
    for (const session of existingSessions) {
      await ctx.db.patch(session._id, { isCurrentDevice: false });
    }

    // Create new session as current device
    const sessionId = await ctx.db.insert('sessions', {
      userId: user._id,
      clerkId: args.clerkId,
      deviceName: args.deviceName,
      deviceType: args.deviceType,
      loginTime: now,
      lastActive: now,
      isCurrentDevice: true,
      deviceInfo: args.deviceInfo,
    });

    // Clean up old sessions - keep only latest MAX_SESSIONS_PER_USER
    const allSessions = await ctx.db
      .query('sessions')
      .withIndex('byClerkId', (q) => q.eq('clerkId', args.clerkId))
      .collect();

    if (allSessions.length > MAX_SESSIONS_PER_USER) {
      // Sort by loginTime descending and keep only the most recent ones
      const sortedSessions = allSessions.sort(
        (a, b) => b.loginTime - a.loginTime
      );
      const sessionsToDelete = sortedSessions.slice(MAX_SESSIONS_PER_USER);

      for (const session of sessionsToDelete) {
        await ctx.db.delete(session._id);
      }
    }

    return sessionId;
  },
});

// Update session to mark it as current device (when user switches devices)
export const setCurrentDevice = mutation({
  args: {
    sessionId: v.id('sessions'),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return null;

    // Mark all other sessions as not current
    const allSessions = await ctx.db
      .query('sessions')
      .withIndex('byClerkId', (q) => q.eq('clerkId', session.clerkId))
      .collect();

    for (const s of allSessions) {
      await ctx.db.patch(s._id, { isCurrentDevice: s._id === args.sessionId });
    }

    return args.sessionId;
  },
});

// Update last active timestamp for a session
export const updateSessionLastActive = mutation({
  args: {
    sessionId: v.id('sessions'),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return null;

    await ctx.db.patch(args.sessionId, {
      lastActive: Date.now(),
    });

    return args.sessionId;
  },
});

// Update session last active by Clerk ID (for external calls)
export const updateLastActiveByClerkId = mutation({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query('sessions')
      .withIndex('byClerkIdAndCurrent', (q) => 
        q.eq('clerkId', args.clerkId).eq('isCurrentDevice', true)
      )
      .unique();

    if (!session) return null;

    await ctx.db.patch(session._id, {
      lastActive: Date.now(),
    });

    return session._id;
  },
});

// Delete a specific session
export const deleteSession = mutation({
  args: {
    sessionId: v.id('sessions'),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return false;

    await ctx.db.delete(args.sessionId);
    return true;
  },
});

// Delete all sessions for a user (logout from all devices)
export const deleteAllUserSessions = mutation({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query('sessions')
      .withIndex('byClerkId', (q) => q.eq('clerkId', args.clerkId))
      .collect();

    for (const session of sessions) {
      await ctx.db.delete(session._id);
    }

    return sessions.length;
  },
});

// Delete all sessions except the current one
export const deleteOtherSessions = mutation({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query('sessions')
      .withIndex('byClerkId', (q) => q.eq('clerkId', args.clerkId))
      .collect();

    let deletedCount = 0;
    for (const session of sessions) {
      if (!session.isCurrentDevice) {
        await ctx.db.delete(session._id);
        deletedCount++;
      }
    }

    return deletedCount;
  },
});
