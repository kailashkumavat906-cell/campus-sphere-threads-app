import { api } from '@/convex/_generated/api';
import { useThemeContext } from '@/hooks/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ActivityItem {
  _id: string;
  type: string;
  content?: string;
  createdAt: number;
  messageId?: string;
  parentId?: string;
}

export default function ActivityHistoryScreen() {
  const { top } = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useThemeContext();
  
  const activityData = useQuery(api.users.getActivityHistory);
  const [selectedTab, setSelectedTab] = useState<'posts' | 'likes' | 'comments'>('posts');

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

  const renderActivityItem = ({ item }: { item: ActivityItem }) => (
    <View style={[styles.activityItem, { backgroundColor: colors.background }]}>
      <View style={styles.activityIcon}>
        <Ionicons 
          name={item.type === 'post' ? 'create' : item.type === 'like' ? 'heart' : 'chatbubble'} 
          size={18} 
          color={item.type === 'like' ? '#E91E63' : colors.text} 
        />
      </View>
      <View style={styles.activityContent}>
        <Text style={[styles.activityType, { color: colors.icon }]}>
          {item.type === 'post' ? 'Posted' : item.type === 'like' ? 'Liked a post' : 'Commented'}
        </Text>
        {item.content && (
          <Text style={[styles.activityText, { color: colors.text }]} numberOfLines={2}>
            {item.content}
          </Text>
        )}
        <Text style={[styles.activityDate, { color: colors.icon }]}>
          {formatDate(item.createdAt)}
        </Text>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="document-text-outline" size={64} color={colors.icon} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No {selectedTab} yet</Text>
      <Text style={[styles.emptySubtitle, { color: colors.icon }]}>
        Your {selectedTab} will appear here
      </Text>
    </View>
  );

  const getData = (): ActivityItem[] => {
    if (!activityData) return [];
    switch (selectedTab) {
      case 'posts':
        return (activityData.posts || []) as ActivityItem[];
      case 'likes':
        return (activityData.likes || []) as ActivityItem[];
      case 'comments':
        return (activityData.comments || []) as ActivityItem[];
      default:
        return [];
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Activity History</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Tabs */}
      <View style={[styles.tabContainer, { borderBottomColor: colors.border || '#E5E7EB' }]}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'posts' && { borderBottomColor: colors.primary || '#1E88E5' }]}
          onPress={() => setSelectedTab('posts')}
        >
          <Text style={[styles.tabText, { color: selectedTab === 'posts' ? (colors.primary || '#1E88E5') : colors.icon }]}>
            Posts
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'likes' && { borderBottomColor: colors.primary || '#1E88E5' }]}
          onPress={() => setSelectedTab('likes')}
        >
          <Text style={[styles.tabText, { color: selectedTab === 'likes' ? (colors.primary || '#1E88E5') : colors.icon }]}>
            Likes
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'comments' && { borderBottomColor: colors.primary || '#1E88E5' }]}
          onPress={() => setSelectedTab('comments')}
        >
          <Text style={[styles.tabText, { color: selectedTab === 'comments' ? (colors.primary || '#1E88E5') : colors.icon }]}>
            Comments
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activityData === undefined ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary || '#1E88E5'} />
        </View>
      ) : (
        <FlatList
          data={getData()}
          keyExtractor={(item) => item._id}
          renderItem={renderActivityItem}
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
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
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
  activityItem: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityType: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
  },
  activityText: {
    fontSize: 14,
    marginBottom: 4,
  },
  activityDate: {
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
  },
});
