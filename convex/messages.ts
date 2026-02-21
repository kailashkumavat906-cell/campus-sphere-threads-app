import { paginationOptsValidator } from 'convex/server';
import { v } from 'convex/values';
import { api } from './_generated/api';
import { Id } from './_generated/dataModel';
import { action, mutation, query, QueryCtx } from './_generated/server';
import { getCurrentUserOrThrow } from './users';

export const addThread = mutation({
  args: {
    content: v.string(),
    mediaFiles: v.optional(v.array(v.string())),
    websiteUrl: v.optional(v.string()),
    threadId: v.optional(v.id('messages')),
    parentId: v.optional(v.union(v.id('messages'), v.null())), // For nested replies
    scheduledFor: v.optional(v.number()),
    // Poll fields
    isPoll: v.optional(v.boolean()),
    pollQuestion: v.optional(v.string()),
    pollOptions: v.optional(v.array(v.string())),
    pollDuration: v.optional(v.number()),
    pollMultipleChoice: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);

    // Check if this is a scheduled post
    const isScheduled = args.scheduledFor !== undefined && args.scheduledFor > Date.now();

    // Extract poll fields
    const { isPoll, pollQuestion, pollOptions, pollDuration, pollMultipleChoice, ...rest } = args;

    const message = await ctx.db.insert('messages', {
      ...rest,
      userId: user._id,
      likeCount: 0,
      commentCount: 0,
      retweetCount: 0,
      scheduledFor: args.scheduledFor,
      isScheduled: isScheduled,
      isPosted: !isScheduled, // Immediately posted if not scheduled
      isPoll,
      pollQuestion,
      pollOptions,
      pollDuration,
      pollMultipleChoice,
      parentId: args.parentId ?? undefined,
    });

    // Update parent thread's comment count if this is a comment
    if (args.threadId && !isScheduled) {
      const parentThread = await ctx.db.get(args.threadId);
      if (parentThread) {
        await ctx.db.patch(args.threadId, {
          commentCount: (parentThread.commentCount || 0) + 1,
        });
      }
    }

    return message;
  },
});

export const getThreads = query({
  args: { paginationOpts: paginationOptsValidator, userId: v.optional(v.id('users')) },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserOrThrow(ctx);
    console.log('[getThreads] Current user:', JSON.stringify(currentUser), args);
    let threads;
    if (args.userId) {
      threads = await ctx.db
        .query('messages')
        .withIndex('byUser')
        .filter((q) => q.eq(q.field('userId'), args.userId))
        .order('desc')
        .paginate(args.paginationOpts);
    } else {
      threads = await ctx.db
        .query('messages')
        .filter((q) => q.eq(q.field('threadId'), undefined))
        .order('desc')
        .paginate(args.paginationOpts);
    }

    // Filter posts in JS to handle isPosted field that might be undefined for old posts
    const threadsWithMedia = await Promise.all(
      threads.page
        .filter((thread) => {
          // Show posts where isPosted is true OR undefined (for backward compatibility)
          return thread.isPosted !== false;
        })
        .map(async (thread) => {
          console.log('[getThreads] Thread mediaFiles from DB:', JSON.stringify(thread.mediaFiles));
          
          const creator = await getMessageCreator(ctx, thread.userId);
          const mediaUrls = await getMediaUrls(ctx, thread.mediaFiles);
          
          // Check if current user has liked this message
          const existingLike = await ctx.db
            .query('likes')
            .filter((q) => 
              q.and(
                q.eq(q.field('userId'), currentUser._id),
                q.eq(q.field('messageId'), thread._id)
              )
            )
            .first();
          
          const isLiked = !!existingLike;

          // Check if current user is following this creator
          let isFollowing = false;
          if (creator && creator._id && creator._id !== currentUser._id) {
            const existingFollow = await ctx.db
              .query('follows')
              .filter((q) => 
                q.and(
                  q.eq(q.field('followerId'), currentUser._id),
                  q.eq(q.field('followingId'), creator._id)
                )
              )
              .first();
            isFollowing = !!existingFollow;
          }

          return {
            ...thread,
            mediaFiles: mediaUrls,
            creator,
            isLiked,
            isFollowing,
          };
        })
    );

    return {
      ...threads,
      page: threadsWithMedia,
    };
  },
});

export const toggleLike = mutation({
  args: {
    messageId: v.id('messages'),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    
    // Check if user already liked this message
    const existingLike = await ctx.db
      .query('likes')
      .filter((q) => 
        q.and(
          q.eq(q.field('userId'), user._id),
          q.eq(q.field('messageId'), args.messageId)
        )
      )
      .first();

    if (existingLike) {
      // Unlike - remove the like record
      await ctx.db.delete(existingLike._id);
      
      // Decrement like count
      const message = await ctx.db.get(args.messageId);
      if (message && message.likeCount > 0) {
        await ctx.db.patch(args.messageId, {
          likeCount: message.likeCount - 1,
        });
      }
      
      return { action: 'unlike' };
    } else {
      // Like - add a like record
      await ctx.db.insert('likes', {
        userId: user._id,
        messageId: args.messageId,
      });
      
      // Increment like count
      const message = await ctx.db.get(args.messageId);
      await ctx.db.patch(args.messageId, {
        likeCount: (message?.likeCount || 0) + 1,
      });
      
      return { action: 'like' };
    }
  },
});

export const getThreadById = query({
  args: {
    messageId: v.id('messages'),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) return null;

    const creator = await getMessageCreator(ctx, message.userId);
    const mediaUrls = await getMediaUrls(ctx, message.mediaFiles);

    return {
      ...message,
      mediaFiles: mediaUrls,
      creator,
    };
  },
});

export const getThreadComments = query({
  args: {
    messageId: v.id('messages'),
  },
  handler: async (ctx, args) => {
    const allComments = await ctx.db
      .query('messages')
      .filter((q) => q.eq(q.field('threadId'), args.messageId))
      .order('desc')
      .collect();

    // Filter for posted comments only (not drafts or scheduled)
    const postedComments = allComments.filter((comment) => comment.isPosted !== false);

    const commentsWithMedia = await Promise.all(
      postedComments.map(async (comment) => {
        const creator = await getMessageCreator(ctx, comment.userId);
        const mediaUrls = await getMediaUrls(ctx, comment.mediaFiles);

        return {
          ...comment,
          mediaFiles: mediaUrls,
          creator,
        };
      })
    );

    // Organize comments into a tree structure
    const commentMap = new Map();
    const topLevelComments: any[] = [];

    // First pass: create map of all comments
    commentsWithMedia.forEach((comment) => {
      commentMap.set(comment._id, { ...comment, replies: [] });
    });

    // Second pass: organize into tree
    commentsWithMedia.forEach((comment) => {
      const commentWithReplies = commentMap.get(comment._id);
      if (comment.parentId) {
        // This is a reply to another comment
        const parentComment = commentMap.get(comment.parentId);
        if (parentComment) {
          parentComment.replies.push(commentWithReplies);
        } else {
          // Parent not found, treat as top-level
          topLevelComments.push(commentWithReplies);
        }
      } else {
        // Top-level comment
        topLevelComments.push(commentWithReplies);
      }
    });

    // Sort replies by creation time (oldest first for replies)
    const sortReplies = (comments: any[]) => {
      comments.forEach((comment) => {
        if (comment.replies && comment.replies.length > 0) {
          comment.replies.sort((a: any, b: any) => a._creationTime - b._creationTime);
          sortReplies(comment.replies);
        }
      });
    };
    sortReplies(topLevelComments);

    return topLevelComments;
  },
});

const getMessageCreator = async (ctx: QueryCtx, userId: Id<'users'>) => {
  const user = await ctx.db.get(userId);
  if (!user) {
    return { _id: userId, first_name: '', last_name: '', imageUrl: undefined, username: '' };
  }
  
  // If imageUrl is already an http URL, use it as-is
  if (user.imageUrl && user.imageUrl.startsWith('http')) {
    return { ...user, imageUrl: user.imageUrl };
  }
  
  // If imageUrl is a storage ID, get the URL
  if (user.imageUrl) {
    const url = await ctx.storage.getUrl(user.imageUrl as Id<'_storage'>);
    return { ...user, imageUrl: url };
  }
  
  return { ...user, imageUrl: undefined };
};

const getMediaUrls = async (ctx: QueryCtx, mediaFiles: string[] | undefined) => {
  if (!mediaFiles || mediaFiles.length === 0) {
    console.log('[getMediaUrls] No mediaFiles provided');
    return [];
  }

  console.log('[getMediaUrls] Processing mediaFiles:', JSON.stringify(mediaFiles));

  const urlPromises = mediaFiles.map((file) => ctx.storage.getUrl(file as Id<'_storage'>));
  const results = await Promise.allSettled(urlPromises);
  
  const validUrls = results
    .filter((result): result is PromiseFulfilledResult<string> => 
      result.status === 'fulfilled' && result.value !== null && result.value !== undefined
    )
    .map((result) => result.value);
    
  console.log('[getMediaUrls] Converted URLs:', JSON.stringify(validUrls));
  
  return validUrls;
};

export const generateUploadUrl = mutation(async (ctx) => {
  await getCurrentUserOrThrow(ctx);

  return await ctx.storage.generateUploadUrl();
});

// Get user's replies (comments on other threads)
export const getUserReplies = query({
  args: { paginationOpts: paginationOptsValidator, userId: v.optional(v.id('users')) },
  handler: async (ctx, args) => {
    if (!args.userId) {
      return { page: [], continueCursor: null, isDone: true };
    }
    
    // Get all messages by this user that are replies (have threadId)
    const messages = await ctx.db
      .query('messages')
      .withIndex('byUser')
      .filter((q) => q.eq(q.field('userId'), args.userId))
      .order('desc')
      .paginate(args.paginationOpts);

    // Filter for replies (have threadId) and isPosted
    const repliesWithCreator = await Promise.all(
      messages.page
        .filter((message) => {
          // Must have a threadId (be a reply) and be posted
          return message.threadId !== undefined && message.isPosted !== false;
        })
        .map(async (message) => {
          const creator = await getMessageCreator(ctx, message.userId);
          const mediaUrls = await getMediaUrls(ctx, message.mediaFiles);
          
          return {
            ...message,
            mediaFiles: mediaUrls,
            creator,
            isLiked: false,
          };
        })
    );

    return {
      ...messages,
      page: repliesWithCreator,
    };
  },
});

// Get user's scheduled posts (not yet posted)
export const getScheduledPosts = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    
    const scheduledPosts = await ctx.db
      .query('messages')
      .filter((q) => q.and(
        q.eq(q.field('userId'), user._id),
        q.eq(q.field('isScheduled'), true),
        q.eq(q.field('isPosted'), false)
      ))
      .order('asc')
      .paginate(args.paginationOpts);

    const postsWithMedia = await Promise.all(
      scheduledPosts.page.map(async (post) => {
        const mediaUrls = await getMediaUrls(ctx, post.mediaFiles);
        
        return {
          ...post,
          mediaFiles: mediaUrls,
        };
      })
    );

    return {
      ...scheduledPosts,
      page: postsWithMedia,
    };
  },
});

// Get user's draft posts
export const getDraftPosts = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    
    const drafts = await ctx.db
      .query('messages')
      .filter((q) => q.and(
        q.eq(q.field('userId'), user._id),
        q.eq(q.field('isDraft'), true)
      ))
      .order('desc')
      .paginate(args.paginationOpts);

    const postsWithMedia = await Promise.all(
      drafts.page.map(async (post) => {
        const mediaUrls = await getMediaUrls(ctx, post.mediaFiles);
        
        return {
          ...post,
          mediaFiles: mediaUrls,
        };
      })
    );

    return {
      ...drafts,
      page: postsWithMedia,
    };
  },
});

// Save a draft post
export const saveDraft = mutation({
  args: {
    content: v.string(),
    mediaFiles: v.optional(v.array(v.string())),
    websiteUrl: v.optional(v.string()),
    threadId: v.optional(v.id('messages')),
    draftId: v.optional(v.id('messages')),
    // Poll fields
    isPoll: v.optional(v.boolean()),
    pollQuestion: v.optional(v.string()),
    pollOptions: v.optional(v.array(v.string())),
    pollDuration: v.optional(v.number()),
    pollMultipleChoice: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    
    // Extract poll fields
    const { isPoll, pollQuestion, pollOptions, pollDuration, pollMultipleChoice, ...rest } = args;
    
    if (args.draftId) {
      // Update existing draft
      const existingDraft = await ctx.db.get(args.draftId);
      if (existingDraft && existingDraft.userId === user._id && existingDraft.isDraft) {
        await ctx.db.patch(args.draftId, {
          ...rest,
          isPoll,
          pollQuestion,
          pollOptions,
          pollDuration,
          pollMultipleChoice,
        });
        return args.draftId;
      }
    }
    
    // Create new draft
    const draftId = await ctx.db.insert('messages', {
      ...rest,
      userId: user._id,
      likeCount: 0,
      commentCount: 0,
      retweetCount: 0,
      isDraft: true,
      isPosted: false,
      isScheduled: false,
      isPoll,
      pollQuestion,
      pollOptions,
      pollDuration,
      pollMultipleChoice,
    });
    
    return draftId;
  },
});

// Publish a draft post
export const publishDraft = mutation({
  args: {
    draftId: v.id('messages'),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    
    const draft = await ctx.db.get(args.draftId);
    if (!draft) {
      throw new Error('Draft not found');
    }
    
    // Verify the user owns this draft
    if (draft.userId !== user._id || !draft.isDraft) {
      throw new Error('Not authorized to publish this draft');
    }
    
    // Update the draft to mark it as posted
    await ctx.db.patch(args.draftId, {
      isDraft: false,
      isPosted: true,
    });
    
    // Update parent thread's comment count if this is a comment
    if (draft.threadId) {
      const parentThread = await ctx.db.get(draft.threadId);
      if (parentThread) {
        await ctx.db.patch(draft.threadId, {
          commentCount: (parentThread.commentCount || 0) + 1,
        });
      }
    }

    return { success: true };
  },
});

// Delete a draft post
export const deleteDraft = mutation({
  args: {
    draftId: v.id('messages'),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    
    const draft = await ctx.db.get(args.draftId);
    if (!draft) {
      throw new Error('Draft not found');
    }
    
    // Verify the user owns this draft
    if (draft.userId !== user._id || !draft.isDraft) {
      throw new Error('Not authorized to delete this draft');
    }
    
    await ctx.db.delete(args.draftId);

    return { success: true };
  },
});

// Delete a thread/post
export const deleteThread = mutation({
  args: {
    threadId: v.id('messages'),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error('Thread not found');
    }
    
    // Verify the user owns this thread using userId
    if (thread.userId !== user._id) {
      throw new Error('Not authorized to delete this thread');
    }
    
    // Check if this is a reply (has parent reference)
    const parentId = thread.postId || thread.threadId || thread.parentId;
    
    // If this is a reply, decrement the parent's comment count
    if (parentId) {
      const parent = await ctx.db.get(parentId);
      if (parent) {
        // Ensure commentCount never goes below 0
        const newCommentCount = Math.max(0, (parent.commentCount || 1) - 1);
        await ctx.db.patch(parentId, {
          commentCount: newCommentCount,
        });
      }
    }
    
    await ctx.db.delete(args.threadId);

    return { success: true };
  },
});

// Publish a scheduled post
export const publishScheduledPost = mutation({
  args: {
    messageId: v.id('messages'),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      console.error(`[DEBUG] Message not found: ${args.messageId}`);
      throw new Error('Message not found');
    }
    
    console.log(`[DEBUG] publishScheduledPost called for ${args.messageId}, current isPosted: ${message.isPosted}, isScheduled: ${message.isScheduled}`);
    
    // IDEMPOTENCY CHECK: Verify post is not already posted
    if (message.isPosted === true) {
      console.warn(`[DEBUG] Post ${args.messageId} already posted, skipping duplicate publish`);
      return { success: true, duplicate: true };
    }
    
    // Verify the user owns this message
    if (message.userId !== user._id) {
      console.error(`[DEBUG] User ${user._id} not authorized for post ${args.messageId}`);
      throw new Error('Not authorized to publish this post');
    }
    
    // Double-check isPosted before updating (race condition prevention)
    const freshMessage = await ctx.db.get(args.messageId);
    if (freshMessage?.isPosted === true) {
      console.warn(`[DEBUG] Race condition detected: Post ${args.messageId} was just posted by another process`);
      return { success: true, duplicate: true };
    }
    
    // Update the message to mark it as posted
    await ctx.db.patch(args.messageId, {
      isPosted: true,
      isScheduled: false,
    });
    console.log(`[DEBUG] Successfully published post ${args.messageId}`);

    // Update parent thread's comment count if this is a comment
    if (message.threadId) {
      const parentThread = await ctx.db.get(message.threadId);
      if (parentThread) {
        await ctx.db.patch(message.threadId, {
          commentCount: (parentThread.commentCount || 0) + 1,
        });
      }
    }

    return { success: true, duplicate: false };
  },
});

// Delete a scheduled post
export const deleteScheduledPost = mutation({
  args: {
    messageId: v.id('messages'),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error('Message not found');
    }
    
    // Verify the user owns this message
    if (message.userId !== user._id) {
      throw new Error('Not authorized to delete this post');
    }
    
    // Only allow deleting scheduled (not yet posted) posts
    if (!message.isScheduled || message.isPosted) {
      throw new Error('Can only delete scheduled posts');
    }
    
    await ctx.db.delete(args.messageId);

    return { success: true };
  },
});

// Migration: Update all existing posts to have isPosted: true
export const migratePostsToPosted = mutation({
  args: {},
  handler: async (ctx) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const user = await getCurrentUserOrThrow(ctx);
    
    // Only allow admin to run this migration (you may want to add admin check)
    
    const messages = await ctx.db.query('messages').collect();
    
    let updated = 0;
    for (const message of messages) {
      // If isPosted is undefined or false, and isScheduled is undefined or false, set to posted
      if (message.isPosted === undefined || message.isPosted === false) {
        if (message.isScheduled !== true) {
          await ctx.db.patch(message._id, {
            isPosted: true,
            isScheduled: false,
          });
          updated++;
        }
      }
    }
    
    return { updated };
  },
});

// Internal query to get scheduled posts for processing (without auth)
export const getScheduledPostsForProcessing = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const posts = await ctx.db
      .query('messages')
      .filter((q) => q.and(
        q.eq(q.field('isScheduled'), true),
        q.eq(q.field('isPosted'), false)
      ))
      .collect();
    
    // Filter in query for posts that are due (scheduledFor <= now)
    const duePosts = posts.filter(post => {
      const isDue = post.scheduledFor && post.scheduledFor <= now;
      console.log(`[DEBUG] Post ${post._id}: scheduledFor=${post.scheduledFor}, now=${now}, isDue=${isDue}`);
      return isDue;
    });
    
    console.log(`[DEBUG] getScheduledPostsForProcessing: found ${posts.length} scheduled posts, ${duePosts.length} due for publishing`);
    return duePosts;
  },
});

// Action to process scheduled posts (can be called by cron job)
export const processScheduledPosts = action(async (ctx) => {
  const now = Date.now();
  console.log(`[DEBUG] processScheduledPosts: Starting at ${now}`);
  
  // Get all scheduled posts that are ready to be published
  const scheduledPosts = await ctx.runQuery(api.messages.getScheduledPostsForProcessing);
  
  console.log(`[DEBUG] processScheduledPosts: Found ${scheduledPosts.length} posts to process`);
  
  let published = 0;
  let skipped = 0;
  for (const post of scheduledPosts) {
    if (post.scheduledFor && post.scheduledFor <= now) {
      try {
        const result = await ctx.runMutation(api.messages.publishScheduledPost, {
          messageId: post._id,
        });
        if (result.duplicate) {
          skipped++;
          console.log(`[DEBUG] Skipped duplicate post: ${post._id}`);
        } else {
          published++;
          console.log(`[DEBUG] Published scheduled post: ${post._id}`);
        }
      } catch (error) {
        console.error(`[DEBUG] Failed to publish post ${post._id}:`, error);
      }
    } else {
      console.log(`[DEBUG] Skipped future post: ${post._id} (scheduled for ${post.scheduledFor})`);
    }
  }
  
  console.log(`[DEBUG] processScheduledPosts: Completed. Published: ${published}, Skipped: ${skipped}`);
  return { published, skipped };
});

// Vote on a poll
export const voteOnPoll = mutation({
  args: {
    pollId: v.id('messages'),
    optionIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    
    // Check if poll exists
    const poll = await ctx.db.get(args.pollId);
    if (!poll) {
      throw new Error('Poll not found');
    }
    
    // Check if poll is a poll
    if (!poll.isPoll) {
      throw new Error('This is not a poll');
    }
    
    // Check if user already voted on this poll
    const existingVote = await ctx.db
      .query('pollVotes')
      .withIndex('byUserAndPoll')
      .filter((q) => q.and(
        q.eq(q.field('userId'), user._id),
        q.eq(q.field('pollId'), args.pollId)
      ))
      .first();
    
    if (existingVote) {
      if (existingVote.optionIndex === args.optionIndex) {
        // User clicked same option again - REMOVE the vote
        await ctx.db.delete(existingVote._id);
        return { success: true, action: 'removed' };
      } else {
        // User changed vote - UPDATE the vote
        await ctx.db.patch(existingVote._id, {
          optionIndex: args.optionIndex,
        });
        return { success: true, action: 'updated' };
      }
    }
    
    // Create new vote
    await ctx.db.insert('pollVotes', {
      pollId: args.pollId,
      optionIndex: args.optionIndex,
      userId: user._id,
    });
    
    return { success: true, action: 'created' };
  },
});

// Get poll votes for a specific poll
export const getPollVotes = query({
  args: {
    pollId: v.id('messages'),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    
    // Get all votes for this poll with voter info
    const allVotes = await ctx.db
      .query('pollVotes')
      .filter((q) => q.eq(q.field('pollId'), args.pollId))
      .collect();
    
    // Get user's vote
    const userVote = await ctx.db
      .query('pollVotes')
      .withIndex('byUserAndPoll')
      .filter((q) => q.and(
        q.eq(q.field('userId'), user._id),
        q.eq(q.field('pollId'), args.pollId)
      ))
      .first();
    
    // Build voters map per option for real-time sync
    const votersByOption: Record<number, string[]> = {};
    for (const vote of allVotes) {
      if (!votersByOption[vote.optionIndex]) {
        votersByOption[vote.optionIndex] = [];
      }
      votersByOption[vote.optionIndex].push(vote.userId);
    }
    
    const totalVotes = allVotes.length;
    
    // Calculate percentages and include voters array
    const results = Object.entries(votersByOption).map(([index, voters]) => ({
      optionIndex: parseInt(index),
      voters, // Array of userIds who voted for this option
      count: voters.length,
      percentage: totalVotes > 0 ? Math.round((voters.length / totalVotes) * 100) : 0,
    }));
    
    return {
      totalVotes,
      results,
      userVote: userVote?.optionIndex ?? null,
    };
  },
});

// ============ SAVED POSTS API ============

// Toggle save/unsave a post
export const toggleSavePost = mutation({
  args: {
    messageId: v.id('messages'),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    
    // Check if already saved
    const existing = await ctx.db
      .query('savedPosts')
      .withIndex('byUserAndMessage')
      .filter((q) => q.and(
        q.eq(q.field('userId'), user._id),
        q.eq(q.field('messageId'), args.messageId)
      ))
      .first();
    
    if (existing) {
      // Unsave: remove the saved post
      await ctx.db.delete(existing._id);
      return { saved: false };
    } else {
      // Save: add to saved posts
      await ctx.db.insert('savedPosts', {
        userId: user._id,
        messageId: args.messageId,
        savedAt: Date.now(),
      });
      return { saved: true };
    }
  },
});

// Check if a post is saved by current user
export const isPostSaved = query({
  args: {
    messageId: v.id('messages'),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    
    const saved = await ctx.db
      .query('savedPosts')
      .withIndex('byUserAndMessage')
      .filter((q) => q.and(
        q.eq(q.field('userId'), user._id),
        q.eq(q.field('messageId'), args.messageId)
      ))
      .first();
    
    return !!saved;
  },
});

// Get all saved posts for current user
export const getSavedPosts = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    
    // Get saved posts sorted by savedAt descending
    const savedPosts = await ctx.db
      .query('savedPosts')
      .withIndex('byUser')
      .filter((q) => q.eq(q.field('userId'), user._id))
      .order('desc')
      .paginate(args.paginationOpts);
    
    // Get the actual message details for each saved post
    const threads = [];
    for (const saved of savedPosts.page) {
      const message = await ctx.db.get(saved.messageId);
      if (message && !message.isDraft) {
        // Get creator info
        const creator = await ctx.db.get(message.userId);
        // Check if liked by current user
        const like = await ctx.db
          .query('likes')
          .withIndex('byUserAndMessage')
          .filter((q) => q.and(
            q.eq(q.field('userId'), user._id),
            q.eq(q.field('messageId'), message._id)
          ))
          .first();
        
        threads.push({
          ...message,
          creator,
          isLiked: !!like,
          isSaved: true,
        });
      }
    }
    
    return {
      ...savedPosts,
      page: threads,
    };
  },
});

// Get saved status for multiple posts
export const getSavedStatus = query({
  args: {
    messageIds: v.array(v.id('messages')),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    
    const savedStatus: Record<string, boolean> = {};
    
    for (const messageId of args.messageIds) {
      const saved = await ctx.db
        .query('savedPosts')
        .withIndex('byUserAndMessage')
        .filter((q) => q.and(
          q.eq(q.field('userId'), user._id),
          q.eq(q.field('messageId'), messageId)
        ))
        .first();
      
      savedStatus[messageId] = !!saved;
    }
    
    return savedStatus;
  },
});

