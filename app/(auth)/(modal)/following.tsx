import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useThemeColors } from '@/hooks/useThemeColor';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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

function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}

export default function FollowingScreen() {
    const { userId } = useLocalSearchParams<{ userId: string }>();
    const router = useRouter();
    const colors = useThemeColors();
    const insets = useSafeAreaInsets();
    const [searchText, setSearchText] = useState('');
    const debouncedSearchText = useDebounce(searchText, 300);
    const targetUserId = userId as Id<'users'> | undefined;
    
    const followingData = useQuery(api.users.getFollowing, targetUserId ? { userId: targetUserId } : 'skip');
    
    const filteredUsers = (followingData || []).filter(user => {
        if (!user) return false;
        if (!debouncedSearchText) return true;
        const searchLower = debouncedSearchText.toLowerCase();
        const fullName = `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase();
        const username = (user.username || '').toLowerCase();
        return fullName.includes(searchLower) || username.includes(searchLower);
    });

    const isLoading = followingData === undefined;

    const renderUser = ({ item }: { item: FollowUser | null }) => {
        if (!item) return null;
        const fullName = [item.first_name, item.last_name].filter(Boolean).join(' ') || 'Unknown';
        const username = item.username ? `@${item.username}` : '';

        return (
            <View style={[styles.userItem, { backgroundColor: colors.background }]}>
                <View style={styles.userContent}>
                    <View style={styles.avatarContainer}>
                        {item.imageUrl ? (
                            <Image source={{ uri: item.imageUrl }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.tint }]}>
                                <Text style={styles.avatarPlaceholderText}>
                                    {(item.first_name?.[0] || item.last_name?.[0] || '?').toUpperCase()}
                                </Text>
                            </View>
                        )}
                    </View>
                    <View style={styles.userInfo}>
                        <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>{fullName}</Text>
                        {username ? <Text style={[styles.username, { color: colors.icon }]} numberOfLines={1}>{username}</Text> : null}
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { paddingTop: insets.top }]}>
                <View style={styles.titleRow}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.title, { color: colors.text }]}>Following</Text>
                    <View style={styles.backButton} />
                </View>
                <View style={[styles.searchContainer, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                    <TextInput
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder="Search following"
                        placeholderTextColor={colors.icon}
                        value={searchText}
                        onChangeText={setSearchText}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                    {searchText.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchText('')} style={styles.clearButton}>
                            <Text style={[styles.clearButtonText, { color: colors.icon }]}>✕</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
            {isLoading ? (
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color={colors.tint} />
                </View>
            ) : (
                <FlatList
                    data={filteredUsers}
                    keyExtractor={(item) => item?._id || ''}
                    renderItem={renderUser}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.centerContent}>
                            <Text style={[styles.emptyText, { color: colors.icon }]}>Not following anyone yet</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { paddingHorizontal: 16, paddingBottom: 12 },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    title: { fontSize: 18, fontWeight: '700' },
    searchContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 12, height: 40, borderWidth: 1 },
    searchInput: { flex: 1, fontSize: 15 },
    clearButton: { padding: 4 },
    clearButtonText: { fontSize: 16 },
    listContent: { paddingBottom: 20 },
    centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
    emptyText: { fontSize: 16 },
    userItem: { paddingVertical: 12, paddingHorizontal: 16 },
    userContent: { flexDirection: 'row', alignItems: 'center' },
    avatarContainer: { marginRight: 12 },
    avatar: { width: 48, height: 48, borderRadius: 24 },
    avatarPlaceholder: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
    avatarPlaceholderText: { color: 'white', fontSize: 18, fontWeight: '600' },
    userInfo: { flex: 1 },
    userName: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
    username: { fontSize: 14 },
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
