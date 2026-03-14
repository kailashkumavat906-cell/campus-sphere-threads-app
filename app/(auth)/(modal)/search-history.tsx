import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useThemeContext } from '@/hooks/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface SearchHistoryItem {
  _id: Id<"searchHistory">;
  searchedUsername: string;
  searchedClerkId: string;
  searchedAt: number;
}

export default function SearchHistoryScreen() {
  const { top } = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useThemeContext();
  
  const searchHistory = useQuery(api.users.getSearchHistory);
  const clearHistory = useMutation(api.users.clearSearchHistory);
  const deleteSearchHistoryItem = useMutation(api.users.deleteSearchHistoryItem);
  const [isClearing, setIsClearing] = useState(false);

  const handleGoBack = useCallback(() => {
    router.dismiss();
  }, [router]);

  const handleClearHistory = useCallback(() => {
    Alert.alert(
      'Clear Search History',
      'Are you sure you want to clear all search history? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: async () => {
            setIsClearing(true);
            try {
              await clearHistory();
            } finally {
              setIsClearing(false);
            }
          }
        },
      ]
    );
  }, [clearHistory]);

  const handleDeleteItem = useCallback((itemId: Id<"searchHistory">, username: string) => {
    Alert.alert(
      'Delete Search Entry',
      `Are you sure you want to delete "${username}" from your search history?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            await deleteSearchHistoryItem({ id: itemId });
          }
        },
      ]
    );
  }, [deleteSearchHistoryItem]);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const renderSearchItem = ({ item }: { item: SearchHistoryItem }) => (
    <View style={[styles.searchItem, { backgroundColor: colors.background }]}>
      <View style={styles.avatar}>
        <Ionicons name="person" size={20} color={colors.icon} />
      </View>
      <View style={styles.searchContent}>
        <Text style={[styles.username, { color: colors.text }]}>
          {item.searchedUsername}
        </Text>
        <Text style={[styles.searchDate, { color: colors.icon }]}>
          {formatDate(item.searchedAt)}
        </Text>
      </View>
      <TouchableOpacity 
        onPress={() => handleDeleteItem(item._id, item.searchedUsername)}
        style={styles.deleteButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="close-circle" size={20} color={colors.icon} />
      </TouchableOpacity>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="search-outline" size={64} color={colors.icon} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No search history</Text>
      <Text style={[styles.emptySubtitle, { color: colors.icon }]}>
        Profiles you search for will appear here
      </Text>
    </View>
  );

  const renderHeader = () => {
    if (!searchHistory || searchHistory.length === 0) return null;
    
    return (
      <View style={styles.headerActions}>
        <TouchableOpacity 
          style={styles.clearButton} 
          onPress={handleClearHistory}
          disabled={isClearing}
        >
          {isClearing ? (
            <ActivityIndicator size="small" color="#EF4444" />
          ) : (
            <>
              <Ionicons name="trash-outline" size={16} color="#EF4444" />
              <Text style={styles.clearButtonText}>Clear History</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Search History</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Content */}
      {searchHistory === undefined ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary || '#1E88E5'} />
        </View>
      ) : (
        <FlatList
          data={searchHistory}
          keyExtractor={(item) => item._id}
          renderItem={renderSearchItem}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={renderHeader}
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
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 16,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  clearButtonText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  searchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  searchContent: {
    flex: 1,
  },
  username: {
    fontSize: 15,
    fontWeight: '500',
  },
  searchDate: {
    fontSize: 12,
    marginTop: 2,
  },
  deleteButton: {
    padding: 4,
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
