import { api } from '@/convex/_generated/api';
import { useThemeContext } from '@/hooks/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface InteractionItem {
  _id: string;
  type: 'like' | 'comment';
  messageId?: string;
  content?: string;
  parentId?: string;
  createdAt: number;
}

export default function InteractionHistoryScreen() {
  const { top } = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useThemeContext();
  
  const interactions = useQuery(api.users.getInteractionHistory);

  const handleGoBack = useCallback(() => {
    router.dismiss();
  }, [router]);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderInteractionItem = ({ item }: { item: InteractionItem }) => (
    <View style={[styles.interactionItem, { backgroundColor: colors.background }]}>
      <View style={[styles.interactionIcon, { backgroundColor: item.type === 'like' ? '#E91E63' + '20' : colors.primary + '20' }]}>
        <Ionicons 
          name={item.type === 'like' ? 'heart' : 'chatbubble'} 
          size={16} 
          color={item.type === 'like' ? '#E91E63' : colors.primary} 
        />
      </View>
      <View style={styles.interactionContent}>
        <Text style={[styles.interactionType, { color: colors.icon }]}>
          {item.type === 'like' ? 'Someone liked your post' : 'Someone commented on your post'}
        </Text>
        {item.content && (
          <Text style={[styles.interactionText, { color: colors.text }]} numberOfLines={2}>
            "{item.content}"
          </Text>
        )}
        <Text style={[styles.interactionDate, { color: colors.icon }]}>
          {formatDate(item.createdAt)}
        </Text>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="chatbubbles-outline" size={64} color={colors.icon} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No interactions yet</Text>
      <Text style={[styles.emptySubtitle, { color: colors.icon }]}>
        Likes and comments on your posts will appear here
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Interaction History</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Content */}
      {interactions === undefined ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary || '#1E88E5'} />
        </View>
      ) : (
        <FlatList
          data={interactions}
          keyExtractor={(item) => item._id}
          renderItem={renderInteractionItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
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
    flexGrow: 1,
  },
  interactionItem: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  interactionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  interactionContent: {
    flex: 1,
  },
  interactionType: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
  },
  interactionText: {
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 4,
  },
  interactionDate: {
    fontSize: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
});
