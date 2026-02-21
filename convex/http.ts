import { api, internal } from "@/convex/_generated/api";
import { httpRouter } from "convex/server";
import { Webhook } from "svix";
import { httpAction } from "./_generated/server";

const http = httpRouter();

export const handleClerkWebhook = httpAction(async (ctx, request) => {
  const svix_id = request.headers.get("svix-id");
  const svix_timestamp = request.headers.get("svix-timestamp");
  const svix_signature = request.headers.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Error occurred -- no svix headers", {
      status: 400,
    });
  }

  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);
  let evt: any;

  try {
    const payload = await request.text();
    evt = wh.verify(payload, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as any;
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return new Response("Error occurred", {
      status: 400,
    });
  }

  const { data, type } = evt;

  console.log("🚀 ~ handleClerkWebhook ~ data:", data);

  switch (type) {
    case "user.created":
      await ctx.runMutation(internal.users.createUser, {
        clerkId: data.id,
        email: data.email_addresses[0].email_address,
        first_name: data.first_name,
        last_name: data.last_name,
        imageUrl: data.image_url,
        username: null,
        followersCount: 0,
      });
      break;
    case "user.updated":
      console.log("User updated");
      break;
  }
  return new Response(null, { status: 200 });
});

http.route({
  path: "/clerk-users-webhook",
  method: "POST",
  handler: handleClerkWebhook,
});
// https://agreeable-chihuahua-740.convex.site/clerk-users-webhook
// https://agreeable-chihuahua-740.convex.cloud

// Cron job endpoint to process scheduled posts
export const handleProcessScheduled = httpAction(async (ctx, request) => {
  try {
    const result = await ctx.runAction(api.messages.processScheduledPosts);
    return new Response(JSON.stringify({
      success: true,
      published: result.published,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error processing scheduled posts:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

http.route({
  path: "/process-scheduled",
  method: "POST",
  handler: handleProcessScheduled,
});

export default http;