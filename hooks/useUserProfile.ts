import { api } from '@/convex/_generated/api';
import { useUser } from '@clerk/clerk-expo';
import { useQuery } from 'convex/react';

export function useUserProfile() {
  const { user } = useUser();
  const clerkId = user?.id;

  const userProfile = useQuery(
    api.users.getUserByClerkId,
    clerkId ? { clerkId } : 'skip'
  );

  return {
    userProfile,
    isLoading: userProfile === undefined,
    error: userProfile === null,
  };
}
