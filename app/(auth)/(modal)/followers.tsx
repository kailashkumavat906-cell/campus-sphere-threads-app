import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useThemeColors } from '@/hooks/useThemeColor';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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

type FollowUser = {
    _id: Id<'users'>;
    clerkId: string;
    first_name?: string;
    last_name?: string;
    username?: string | null;
    imageUrl?: string;
    followersCount?: number;
};

// Individual FollowUserItem component - can use hooks properly
function FollowUserItem({ item }: { item: FollowUser }) {
    const colors = useThemeColors();
    const { userId: currentUserId } = useAuth();
    const followUser = useMutation(api.users.followUser);
    const unfollowUser = useMutation(api.users.unfollowUser);
    
    // Use query-based follow status - this is at top level of component, valid
    const followStatus = useQuery(
        api.users.getFollowStatus,
        item.clerkId ? { clerkId: item.clerkId } : 'skip'
    );
    
    const isFollowing = followStatus?.isFollowing ?? false;
    const isCurrentUser = currentUserId && item.clerkId === currentUserId;
    
    const fullName = [item.first_name, item.last_name].filter(Boolean).join(' ') || 'Unknown';
    const username = item.username ? `@${item.username}` : '';

    const handleFollow = async () => {
        if (isCurrentUser) return;
        try {
            if (isFollowing) {
                await unfollowUser({ userId: item.clerkId });
            } else {
                await followUser({ userId: item.clerkId });
            }
        } catch (error) {
            console.error('Error following user:', error);
        }
    };

    return (
        <View style={[styles.userItem, { backgroundColor: colors.background }]}>
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
                </View>
                {!isCurrentUser && (
                    <TouchableOpacity
                        style={[
                            styles.followButton, 
                            isFollowing ? { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border } : { backgroundColor: colors.primary }
                        ]}
                        onPress={handleFollow}
                    >
                        <Text style={[
                            styles.followButtonText, 
                            { color: isFollowing ? colors.text : colors.background }
                        ]}>{isFollowing ? 'Following' : 'Follow'}</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

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

export default function FollowersScreen() {
    const { clerkId } = useLocalSearchParams<{ clerkId: string }>();
    const router = useRouter();
    const colors = useThemeColors();
    const insets = useSafeAreaInsets();
    const [searchText, setSearchText] = useState('');
    const debouncedSearchText = useDebounce(searchText, 300);
    
    // Get followers list
    const followersData = useQuery(
        api.users.getFollowers,
        clerkId ? { clerkId } : 'skip'
    );
    
    const filteredUsers = (followersData || []).filter(user => {
        if (!user) return false;
        if (!debouncedSearchText) return true;
        const searchLower = debouncedSearchText.toLowerCase();
        const fullName = `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase();
        const username = (user.username || '').toLowerCase();
        return fullName.includes(searchLower) || username.includes(searchLower);
    });

    const isLoading = followersData === undefined;

    // Use memoized render function that doesn't use hooks
    const renderItem = ({ item }: { item: FollowUser | null }) => {
        if (!item) return null;
        return <FollowUserItem item={item} />;
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top }]}>
                {/* Back button and title */}
                <View style={styles.titleRow}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.title, { color: colors.text }]}>Followers</Text>
                    <View style={styles.backButton} />
                </View>
                {/* Search */}
                <View style={[styles.searchContainer, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                    <TextInput
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder="Search followers"
                        placeholderTextColor={colors.icon}
                        value={searchText}
                        onChangeText={setSearchText}
                        autoCapitalize="none"
                        autoCorrect={false}
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
            ) : (
                <FlatList
                    data={filteredUsers}
                    keyExtractor={(item) => item?._id || ''}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.centerContent}>
                            <Text style={[styles.emptyText, { color: colors.icon }]}>
                                No followers yet
                            </Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    tabContainer: {
        flexDirection: 'row',
        borderRadius: 12,
        padding: 4,
        marginBottom: 12,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        gap: 6,
    },
    tabText: {
        fontSize: 16,
        fontWeight: '600',
    },
    tabCount: {
        fontSize: 14,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 40,
        borderWidth: 1,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
    },
    clearButton: {
        padding: 4,
    },
    clearButtonText: {
        fontSize: 14,
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
    },
    listContent: {
        paddingBottom: 20,
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
    },
    followButton: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20,
    },
    followButtonText: {
        fontSize: 14,
        fontWeight: '600',
    },
});
