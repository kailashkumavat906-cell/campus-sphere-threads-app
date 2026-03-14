import { useRouter } from 'expo-router';

/**
 * Hook for navigating to user profiles
 * 
 * Usage:
 * const { openUserProfile } = useUserProfileNavigation();
 * 
 * // Open profile by Clerk ID
 * openUserProfile(user.clerkId);
 * 
 * // Open profile by Convex user ID (will need to fetch clerkId first)
 * openUserProfile(undefined, userId);
 */
export const useUserProfileNavigation = () => {
  const router = useRouter();

  const openUserProfile = (clerkId?: string, userId?: string) => {
    if (clerkId) {
      router.push(`/profile?clerkId=${clerkId}`);
    } else if (userId) {
      router.push(`/profile?userId=${userId}`);
    }
  };

  return { openUserProfile };
};

export default useUserProfileNavigation;
