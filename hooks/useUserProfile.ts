import { api } from '@/convex/_generated/api';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useMutation, useQuery } from 'convex/react';
import { useCallback } from 'react';

export function useUserProfile() {
  const { user, isLoaded: userLoaded } = useUser();
  const { isSignedIn } = useAuth();
  const clerkId = user?.id;

  const userProfile = useQuery(
    api.users.getUserByClerkId,
    clerkId ? { clerkId } : 'skip'
  );

  // Add manual sync function
  const syncUser = useMutation(api.users.syncUser);
  
  const syncUserToConvex = useCallback(async () => {
    if (user?.id) {
      try {
        await syncUser({
          clerkId: user.id?.toString() || '',
          email: user.primaryEmailAddress?.emailAddress?.toString() || '',
          imageUrl: user.imageUrl?.toString() || undefined,
          first_name: user.firstName?.toString() || undefined,
          last_name: user.lastName?.toString() || undefined,
        });
        console.log('Manual sync completed');
      } catch (error) {
        console.error('Manual sync failed:', error);
      }
    }
  }, [user, syncUser]);

  return {
    userProfile,
    isLoading: userProfile === undefined,
    error: userProfile === null,
    syncUserToConvex,
    isSignedIn: isSignedIn ?? false,
    userLoaded,
  };
}

