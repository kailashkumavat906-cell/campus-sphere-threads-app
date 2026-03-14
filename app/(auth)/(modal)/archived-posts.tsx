import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useThemeContext } from '@/hooks/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ArchivedPostsScreen() {
  const { top } = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useThemeContext();
  
  const archivedPosts = useQuery(api.messages.getArchivedPosts);
  const unarchivePost = useMutation(api.messages.unarchivePost);
  const deleteThread = useMutation(api.messages.deleteThread);
  
  const [refreshing, setRefreshing] = useState(false);

  const handleGoBack = useCallback(() => {
    router.dismiss();
  }, [router]);

  const handleRestore = async (postId: Id<'messages'>) => {
    try {
      await unarchivePost({ messageId: postId });
      Alert.alert('Success', 'Post restored successfully');
    } catch (error) {
      console.error('Failed to restore post:', error);
      Alert.alert('Error', 'Failed to restore post. Please try again.');
    }
  };

  const handleDelete = (postId: Id<'messages'>) => {
    Alert.alert(
      'Delete this post?',
      'This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteThread({ threadId: postId });
              Alert.alert('Success', 'Post deleted successfully');
            } catch (error) {
              console.error('Failed to delete post:', error);
              Alert.alert('Error', 'Failed to delete post. Please try again.');
            }
          },
        },
      ]
    );
  };

  const renderArchivedPost = ({ item }: { item: any }) => {
    const username = item.creator?.username || 
      `${item.creator?.first_name || ''} ${item.creator?.last_name || ''}`.trim() || 'User';
    
    return (
      <View style={[styles.postContainer, { borderBottomColor: colors.border }]}>
        <View style={styles.postHeader}>
          <View style={styles.userInfo}>
            <Image
              source={{ uri: item.creator?.imageUrl || 'https://via.placeholder.com/40' }}
              style={styles.avatar}
            />
            <View>
              <Text style={[styles.displayName, { color: colors.text }]}>
                {item.creator?.first_name} {item.creator?.last_name}
              </Text>
              <Text style={[styles.username, { color: colors.icon }]}>@{username}</Text>
            </View>
          </View>
        </View>
        
        <Text style={[styles.postContent, { color: colors.text }]}>{item.content}</Text>
        
        {item.mediaFiles && item.mediaFiles.length > 0 && (
          <View style={styles.mediaContainer}>
            {item.mediaFiles.slice(0, 4).map((imageUrl: string, index: number) => (
              <Image
                key={index}
                source={{ uri: imageUrl }}
                style={styles.mediaImage}
              />
            ))}
          </View>
        )}
        
        <View style={styles.actionRow}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleRestore(item._id)}
          >
            <Ionicons name="archive" size={20} color={colors.text} />
            <Text style={[styles.actionText, { color: colors.text }]}>Restore</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleDelete(item._id)}
          >
            <Ionicons name="trash" size={20} color="#FF3B30" />
            <Text style={[styles.actionText, { color: '#FF3B30' }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (archivedPosts === undefined) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.text} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: top + 14, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Archived Posts</Text>
        <View style={styles.headerRight} />
      </View>

      {archivedPosts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="archive-outline" size={64} color={colors.icon} />
          <Text style={[styles.emptyText, { color: colors.icon }]}>
            No archived posts
          </Text>
          <Text style={[styles.emptySubtext, { color: colors.icon }]}>
            Posts you archive will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={archivedPosts}
          renderItem={renderArchivedPost}
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
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  listContent: {
    paddingBottom: 20,
  },
  postContainer: {
    padding: 16,
    borderBottomWidth: 1,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  displayName: {
    fontSize: 15,
    fontWeight: '600',
  },
  username: {
    fontSize: 13,
  },
  postContent: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  mediaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  mediaImage: {
    width: '48%',
    height: 120,
    marginBottom: 4,
    borderRadius: 8,
    marginRight: '2%',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 24,
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  actionText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});
