import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useThemeColors } from '@/hooks/useThemeColor';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAuth } from '@clerk/clerk-expo';
import { useFocusEffect } from '@react-navigation/native';
import { useMutation, useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type UserProfileProps = {
  userId?: Id<"users">;
};

// Helper function to get display string from profile directly
const getUserDisplayString = (profile: any): string => {
  const parts = [];
  if (profile.college) parts.push(profile.college);
  if (profile.course) parts.push(profile.course);
  if (profile.branch) parts.push(profile.branch);
  if (profile.semester) parts.push(profile.semester);
  return parts.join(' · ');
};

const UserProfile = ({ userId }: UserProfileProps) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [showFullScreenImage, setShowFullScreenImage] = useState(false);
  const colors = useThemeColors();
  const router = useRouter();
  const { top } = useSafeAreaInsets();
  const { userProfile } = useUserProfile();
  const { userId: currentClerkId } = useAuth();
  
  // Check if viewing own profile
  const isOwnProfile = !userId || (userId === userProfile?._id);
  
  // Query for isFollowing if viewing another user's profile
  const isFollowingData = useQuery(
    api.users.isFollowing,
    !isOwnProfile && userId ? { userId } : 'skip'
  );
  
  // Get following count
  const followingData = useQuery(
    api.users.getFollowing,
    userId ? { userId } : 'skip'
  );
  
  const followingCount = followingData?.length || 0;
  
  // Mutation for follow/unfollow
  const followUser = useMutation(api.users.followUser);
  const [isFollowing, setIsFollowing] = useState(false);
  
  // Update local state when query result changes
  useEffect(() => {
    if (isFollowingData !== undefined) {
      setIsFollowing(isFollowingData);
    }
  }, [isFollowingData]);
  
  const handleFollowToggle = async () => {
    if (!userId) return;
    try {
      const result = await followUser({ userId });
      setIsFollowing(result.success);
    } catch (error) {
      console.error('Error toggling follow:', error);
    }
  };
  
  // Navigate to followers/following list
  const navigateToFollowers = () => {
    if (userId) {
      router.push({ pathname: '/(auth)/(modal)/followers', params: { userId } });
    }
  };
  
  const navigateToFollowing = () => {
    if (userId) {
      router.push({ pathname: '/(auth)/(modal)/following', params: { userId } });
    }
  };
  
  // Force refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      setRefreshKey(prev => prev + 1);
    }, [])
  );

  // Include refreshKey in query to force-refetch
  const profile = useQuery(
    api.users.getUserById,
    userId ? { userId } : "skip"
  );

  // Force refresh when profile data changes
  useEffect(() => {
    if (profile) {
      setRefreshKey(prev => prev + 1);
    }
  }, [profile]);

  // Show loading state while fetching
  if (profile === undefined) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  // Show user not found if profile is null
  if (!profile) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.text }]}>User not found</Text>
      </View>
    );
  }

  // Add cache-busting query param to image URL
  const imageSource = profile.imageUrl 
    ? { uri: `${profile.imageUrl}?t=${refreshKey}` }
    : require('@/assets/images/react-logo.png');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.profileHeader}>
        <View style={styles.profileTextContainer}>
          <Text style={[styles.name, { color: colors.text }]}>
            {profile.first_name} {profile.last_name}
          </Text>
          <Text style={[styles.username, { color: colors.icon }]}>@{profile.username}</Text>
          
          {/* College Details - From viewed user's profile data */}
          {getUserDisplayString(profile) && (
            <Text style={[styles.collegeInfo, { color: colors.icon }]}>
              {getUserDisplayString(profile)}
            </Text>
          )}
        </View>

        <TouchableOpacity 
          onPress={() => profile.imageUrl && setShowFullScreenImage(true)}
          activeOpacity={0.8}
        >
          <Image
            source={imageSource}
            style={styles.profilePicture}
          />
        </TouchableOpacity>
      </View>
      
      <Text style={[styles.bio, { color: colors.text }]}>{profile.bio || 'No bio available'}</Text>

      {/* Followers/Following counts - button style */}
      <View style={styles.followersContainer}>
        <TouchableOpacity 
          onPress={navigateToFollowers} 
          style={[styles.countButton, { backgroundColor: colors.secondary }]}
        >
          <Text style={[styles.countButtonNumber, { color: colors.text }]}>
            {profile.followersCount}
          </Text>
          <Text style={[styles.countButtonLabel, { color: colors.icon }]}>
            Followers
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={navigateToFollowing} 
          style={[styles.countButton, { backgroundColor: colors.secondary }]}
        >
          <Text style={[styles.countButtonNumber, { color: colors.text }]}>
            {followingCount}
          </Text>
          <Text style={[styles.countButtonLabel, { color: colors.icon }]}>
            Following
          </Text>
        </TouchableOpacity>
      </View>

      {/* Follow/Unfollow button - only show for other users */}
      {!isOwnProfile && userId && (
        <TouchableOpacity
          style={[
            styles.followButton,
            { backgroundColor: isFollowing ? colors.background : colors.tint },
            isFollowing && { borderWidth: 1, borderColor: colors.border }
          ]}
          onPress={handleFollowToggle}
        >
          <Text style={[
            styles.followButtonText,
            { color: isFollowing ? colors.text : '#FFFFFF' }
          ]}>
            {isFollowing ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Full-screen profile image modal */}
      <Modal
        visible={showFullScreenImage}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFullScreenImage(false)}
      >
        <TouchableOpacity 
          style={styles.fullScreenContainer}
          activeOpacity={1}
          onPress={() => setShowFullScreenImage(false)}
        >
          <TouchableOpacity 
            style={styles.fullScreenImageContainer}
            activeOpacity={1}
            onPress={() => {}}
          >
            {profile.imageUrl && (
              <Image
                source={{ uri: profile.imageUrl }}
                style={styles.fullScreenImage}
                resizeMode="contain"
              />
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

export default UserProfile;

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  profileTextContainer: {
    flex: 1,
    paddingRight: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  username: {
    fontSize: 16,
    marginTop: 2,
  },
  collegeInfo: {
    fontSize: 14,
    marginTop: 4,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  profilePicture: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  bio: {
    fontSize: 16,
    marginBottom: 8,
  },
  followers: {
    fontSize: 14,
    marginBottom: 16,
  },
  followersContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  countButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  countButtonNumber: {
    fontSize: 16,
    fontWeight: '700',
  },
  countButtonLabel: {
    fontSize: 14,
  },
  followersTouch: {
    padding: 2,
  },
  followButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  buttonRow: {
    marginTop: 16,
    alignItems: 'center',
  },
  button: {
    width: '100%',
    maxWidth: 300,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#F5F5F5',
    overflow: 'hidden',
  },
  buttonTouchable: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontWeight: '600',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
  // Full-screen image viewer styles
  fullScreenContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImageContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
  },
});
