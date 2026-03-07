import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useThemeColors } from '@/hooks/useThemeColor';
import { useAuth } from '@clerk/clerk-expo';
import { useMutation, useQuery } from 'convex/react';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type SearchUser = {
    _id: Id<'users'>;
    clerkId: string;
    first_name?: string;
    last_name?: string;
    username?: string | null;
    imageUrl?: string;
    followersCount?: number;
};

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

// Individual user item component with follow status
const UserItem = ({ 
    item, 
    onUserPress, 
    onFollowPress,
    isSearching 
}: { 
    item: SearchUser; 
    onUserPress: (clerkId: string) => void;
    onFollowPress: (clerkId: string, isCurrentlyFollowing: boolean) => void;
    isSearching: boolean;
}) => {
    const colors = useThemeColors();
    const { userId: currentUserId } = useAuth();
    
    // Get follow status for this user - single source of truth
    const followStatus = useQuery(
        api.users.getFollowStatus,
        item.clerkId ? { clerkId: item.clerkId } : 'skip'
    );
    
    const isFollowing = followStatus?.isFollowing ?? false;
    const isOwner = currentUserId === item.clerkId;
    
    const fullName = [item.first_name, item.last_name].filter(Boolean).join(' ') || 'Unknown';
    const username = item.username ? `@${item.username}` : '';

    const formatFollowers = (count?: number) => {
        if (!count) return '0 followers';
        if (count >= 1000000) {
            return `${(count / 1000000).toFixed(1)}M followers`;
        }
        if (count >= 1000) {
            return `${(count / 1000).toFixed(1)}K followers`;
        }
        return `${count} followers`;
    };

    return (
        <TouchableOpacity
            style={[styles.userItem, { backgroundColor: colors.background }]}
            onPress={() => onUserPress(item.clerkId)}
            activeOpacity={0.7}
        >
            <View style={styles.userContent}>
                <View style={styles.avatarContainer}>
                    {item.imageUrl ? (
                        <Image
                            source={{ uri: item.imageUrl }}
                            style={styles.avatar}
                        />
                    ) : (
                        <View style={[styles.avatarPlaceholder, { backgroundColor: colors.tint }]}>
                            <Text style={styles.avatarPlaceholderText}>
                                {(item.first_name?.[0] || item.last_name?.[0] || '?').toUpperCase()}
                            </Text>
                        </View>
                    )}
                </View>
                <View style={styles.userInfo}>
                    <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
                        {fullName}
                    </Text>
                    {username ? (
                        <Text style={[styles.username, { color: colors.icon }]} numberOfLines={1}>
                            {username}
                        </Text>
                    ) : null}
                    <Text style={[styles.followers, { color: colors.icon }]} numberOfLines={1}>
                        {formatFollowers(item.followersCount)}
                    </Text>
                </View>
            </View>
            {!isSearching && !isOwner && (
                <TouchableOpacity
                    style={[
                        styles.followButton,
                        isFollowing 
                            ? { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }
                            : { backgroundColor: colors.tint }
                    ]}
                    onPress={() => onFollowPress(item.clerkId, isFollowing)}
                    activeOpacity={0.7}
                >
                    <Text style={[
                        styles.followButtonText,
                        { color: isFollowing ? colors.text : '#FFFFFF' }
                    ]}>
                        {isFollowing ? 'Following' : 'Follow'}
                    </Text>
                </TouchableOpacity>
            )}
        </TouchableOpacity>
    );
};

const Page = () => {
    const colors = useThemeColors();
    const insets = useSafeAreaInsets();
    const [searchText, setSearchText] = useState('');
    const debouncedSearchText = useDebounce(searchText, 300);

    // Query for recommended users (when search is empty)
    const recommendedUsers = useQuery(api.users.getRecommendedUsers);
    
    // Query for search results (when typing)
    const searchResults = useQuery(
        api.users.searchUsers,
        { searchText: debouncedSearchText }
    );

    // Mutation for follow/unfollow
    const followUser = useMutation(api.users.followUser);
    const unfollowUser = useMutation(api.users.unfollowUser);

    // Determine what to show
    const isSearching = searchText.length > 0;
    const isLoading = isSearching ? searchResults === undefined : recommendedUsers === undefined;
    const users = isSearching ? searchResults : recommendedUsers;
    const showEmptyState = !isLoading && users && users.length === 0;
    const showInitialState = !isSearching && recommendedUsers && recommendedUsers.length > 0;

    const handleUserPress = useCallback((clerkId: string) => {
        router.push(`/profile?clerkId=${clerkId}`);
    }, []);

    const handleFollowPress = useCallback(async (clerkId: string, isCurrentlyFollowing: boolean) => {
        try {
            if (isCurrentlyFollowing) {
                await unfollowUser({ userId: clerkId });
            } else {
                await followUser({ userId: clerkId });
            }
            // UI will automatically update from the query result
        } catch (error) {
            console.error('Error toggling follow:', error);
        }
    }, [followUser, unfollowUser]);

    const renderUser = useCallback(({ item }: { item: SearchUser }) => (
        <UserItem 
            item={item} 
            onUserPress={handleUserPress}
            onFollowPress={handleFollowPress}
            isSearching={isSearching}
        />
    ), [handleUserPress, handleFollowPress, isSearching, colors]);

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Search Header */}
            <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                <View style={[styles.searchContainer, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                    <TextInput
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder="Search people"
                        placeholderTextColor={colors.icon}
                        value={searchText}
                        onChangeText={setSearchText}
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="search"
                    />
                    {searchText.length > 0 && (
                        <TouchableOpacity
                            onPress={() => setSearchText('')}
                            style={styles.clearButton}
                        >
                            <Text style={[styles.clearButtonText, { color: colors.icon }]}>✕</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Content */}
            {isLoading ? (
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color={colors.tint} />
                </View>
            ) : showEmptyState ? (
                <View style={styles.centerContent}>
                    <Text style={[styles.placeholderText, { color: colors.icon }]}>
                        {isSearching ? 'No users found' : 'No recommendations available'}
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={users}
                    keyExtractor={(item) => item._id}
                    renderItem={renderUser}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ListHeaderComponent={
                        !isSearching && showInitialState ? (
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>
                                Suggested for you
                            </Text>
                        ) : null
                    }
                />
            )}
        </View>
    );
};

export default Page;

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 44,
        borderWidth: 1,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        height: '100%',
    },
    clearButton: {
        padding: 4,
    },
    clearButtonText: {
        fontSize: 16,
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    placeholderText: {
        fontSize: 16,
        textAlign: 'center',
    },
    listContent: {
        paddingBottom: 20,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 12,
    },
    userItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    userContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    avatarContainer: {
        marginRight: 12,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    avatarPlaceholder: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarPlaceholderText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '600',
    },
    userInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    userName: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 2,
    },
    username: {
        fontSize: 14,
        marginBottom: 2,
    },
    followers: {
        fontSize: 12,
    },
    followButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        minWidth: 80,
        alignItems: 'center',
    },
    followButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
});
