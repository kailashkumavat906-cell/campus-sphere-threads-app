import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export const User = {
  email: v.string(),
  clerkId: v.string(),
  imageUrl: v.optional(v.string()),
  first_name: v.optional(v.string()),
  last_name: v.optional(v.string()),
  username: v.union(v.string(), v.null()),
  bio: v.optional(v.string()),
  location: v.optional(v.string()),
  websiteUrl: v.optional(v.string()),
  followersCount: v.number(),
  pushToken: v.optional(v.string()),
  // Education fields
  college: v.optional(v.string()),
  course: v.optional(v.string()),
  branch: v.optional(v.string()),
  semester: v.optional(v.string()),
};

export const Message = {
  userId: v.id('users'),
  postId: v.optional(v.id('messages')),
  threadId: v.optional(v.id('messages')), // Temporary: for migration from threadId to postId
  parentId: v.optional(v.id('messages')), // For nested replies to comments
  content: v.string(),
  likeCount: v.number(),
  commentCount: v.number(),
  retweetCount: v.number(),
  mediaFiles: v.optional(v.array(v.string())),
  websiteUrl: v.optional(v.string()),
  // Scheduled post fields
  scheduledFor: v.optional(v.number()),
  isScheduled: v.optional(v.boolean()),
  isPosted: v.optional(v.boolean()),
  isDraft: v.optional(v.boolean()),
  // Poll fields
  isPoll: v.optional(v.boolean()),
  pollQuestion: v.optional(v.string()),
  pollOptions: v.optional(v.array(v.string())),
  pollDuration: v.optional(v.number()), // Duration in hours (24, 72, 168)
  pollMultipleChoice: v.optional(v.boolean()),
};

export const Like = {
  userId: v.id('users'),
  messageId: v.id('messages'),
};

export const PollVote = {
  pollId: v.id('messages'),
  optionIndex: v.number(),
  userId: v.id('users'),
};

export const SavedPost = {
  userId: v.id('users'),
  messageId: v.id('messages'),
  savedAt: v.number(), // timestamp when saved
};

export const Follow = {
  followerId: v.id('users'),
  followingId: v.id('users'),
  createdAt: v.number(),
};

export default defineSchema({
  users: defineTable(User).index('byClerkId', ['clerkId']).searchIndex('searchUsers', {
    searchField: 'username',
  }),
  messages: defineTable(Message)
    .index('byUser', ['userId'])
    .index('byUserAndPosted', ['userId', 'isPosted'])
    .index('byUserAndDraft', ['userId', 'isDraft'])
    .index('byThreadAndPosted', ['threadId', 'isPosted'])
    .index('byScheduledFor', ['scheduledFor'])
    .index('byParentId', ['parentId']),
  likes: defineTable(Like).index('byUserAndMessage', ['userId', 'messageId']),
  pollVotes: defineTable(PollVote).index('byUserAndPoll', ['userId', 'pollId']),
  savedPosts: defineTable(SavedPost).index('byUserAndMessage', ['userId', 'messageId']).index('byUser', ['userId']),
  follows: defineTable(Follow).index('byFollower', ['followerId']).index('byFollowing', ['followingId']).index('byFollowerAndFollowing', ['followerId', 'followingId']),
});
