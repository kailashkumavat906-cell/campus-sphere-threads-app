import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useThemeContext } from '@/hooks/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type BlockedUser = {
  _id: Id<'users'>;
  clerkId: string;
  first_name?: string;
  last_name?: string;
  username?: string | null;
  imageUrl?: string;
  blockedAt: number;
};

export default function BlockedUsersScreen() {
  const { top } = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useThemeContext();

  // Fetch blocked users
  const blockedUsers = useQuery(api.users.getBlockedUsers);
  
  // Unblock user mutation
  const unblockUser = useMutation(api.users.unblockUser);

  const handleGoBack = useCallback(() => {
    router.dismiss();
  }, [router]);

  const handleUnblock = useCallback(async (clerkId: string) => {
    try {
      await unblockUser({ blockedClerkId: clerkId });
    } catch (error) {
      console.error('Error unblocking user:', error);
    }
  }, [unblockUser]);

  const renderItem = useCallback(({ item }: { item: BlockedUser }) => {
    const displayName = [item.first_name, item.last_name]
      .filter(Boolean)
      .join(' ') || item.username || 'Unknown';
    
    return (
      <View style={[styles.userItem, { backgroundColor: colors.cardBackground }]}>
        <Image
          source={{ uri: item.imageUrl || 'https://via.placeholder.com/50' }}
          style={styles.avatar}
        />
        <View style={styles.userInfo}>
          <Text style={[styles.username, { color: colors.text }]}>
            {displayName}
          </Text>
          <Text style={[styles.handle, { color: colors.icon }]}>
            @{item.username || 'unknown'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.unblockButton, { borderColor: colors.danger }]}
          onPress={() => handleUnblock(item.clerkId)}
        >
          <Text style={[styles.unblockText, { color: colors.danger }]}>
            Unblock
          </Text>
        </TouchableOpacity>
      </View>
    );
  }, [colors, handleUnblock]);

  const renderEmpty = useCallback(() => {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="person-remove" size={64} color={colors.icon} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>No Blocked Users</Text>
        <Text style={[styles.emptySubtitle, { color: colors.icon }]}>
          When you block someone, they won't be able to find your profile or see your content.
        </Text>
      </View>
    );
  }, [colors]);

  // Show loading state
  if (blockedUsers === undefined) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: top }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleGoBack} accessibilityLabel="Back">
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Blocked Users</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={{ color: colors.icon }}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Blocked Users</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Content */}
      {blockedUsers.length === 0 ? (
        renderEmpty()
      ) : (
        <FlatList
          data={blockedUsers}
          renderItem={renderItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '500',
    textAlign: 'center',
    marginRight: 40,
  },
  headerRight: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ccc',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
  },
  handle: {
    fontSize: 14,
    marginTop: 2,
  },
  unblockButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  unblockText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 24,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
});
