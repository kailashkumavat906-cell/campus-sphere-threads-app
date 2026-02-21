import { AuthConfig } from "convex/server";

export default {
  providers: [
    {
      domain: "https://climbing-mayfly-30.clerk.accounts.dev",
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
