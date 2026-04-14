import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const createReport = mutation({
  args: {
    type: v.union(v.literal("user"), v.literal("post"), v.literal("comment")),
    targetId: v.string(),
    reason: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) throw new Error("Not logged in");

    await ctx.db.insert("reports", {
      type: args.type,
      targetId: args.targetId,
      reason: args.reason,
      message: args.message,
      reporterId: identity.subject,
      reporterEmail: identity.email || "",
      status: "pending",
      createdAt: Date.now(),
    });
  },
});
