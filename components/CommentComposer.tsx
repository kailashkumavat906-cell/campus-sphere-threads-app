import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useThemeColors } from '@/hooks/useThemeColor';
import { useUserProfile } from '@/hooks/useUserProfile';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type CommentComposerProps = {
    threadId: Id<'messages'>;
    showThread?: boolean;
};

const CommentComposer: React.FC<CommentComposerProps> = ({ threadId, showThread = false }) => {
    const [commentContent, setCommentContent] = useState('');
    const [replyingToId, setReplyingToId] = useState<string | null>(null);
    const [replyingToName, setReplyingToName] = useState<string>('');
    const { userProfile } = useUserProfile();
    const addThread = useMutation(api.messages.addThread);
    const toggleLike = useMutation(api.messages.toggleLike);
    const comments = useQuery(api.messages.getThreadComments, { messageId: threadId });
    const thread = useQuery(api.messages.getThreadById, { messageId: threadId });
    const colors = useThemeColors();

    // Track local like states
    const [likedComments, setLikedComments] = useState<Set<string>>(new Set());
    const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});

    const handleSubmit = async () => {
        if (commentContent.trim() === '') return;
        
        await addThread({
            threadId,
            content: commentContent,
            parentId: replyingToId as Id<'messages'> | undefined,
        });
        setCommentContent('');
        setReplyingToId(null);
        setReplyingToName('');
    };

    const handleLike = async (commentId: string, currentLiked: boolean, currentCount: number) => {
        try {
            await toggleLike({ messageId: commentId as Id<'messages'> });
            
            // Update local state
            setLikedComments(prev => {
                const newSet = new Set(prev);
                if (currentLiked) {
                    newSet.delete(commentId);
                } else {
                    newSet.add(commentId);
                }
                return newSet;
            });
            
            setLikeCounts(prev => ({
                ...prev,
                [commentId]: currentLiked ? currentCount - 1 : currentCount + 1
            }));
        } catch (error) {
            console.error('Error toggling like:', error);
            Alert.alert('Error', 'Unable to like comment. Please try again.');
        }
    };

    const handleReply = (commentId: string, username: string) => {
        setReplyingToId(commentId);
        setReplyingToName(username);
    };

    const handleShare = async (commentContent: string, username: string) => {
        try {
            const shareMessage = `@${username}: ${commentContent}`;
            await Share.share({
                message: shareMessage,
                title: 'Share Comment',
            });
        } catch (error: any) {
            if (error.message !== 'User did not share') {
                console.error('Error sharing:', error);
                Alert.alert('Error', 'Unable to share. Please try again.');
            }
        }
    };

    const isPostButtonDisabled = commentContent.trim() === '';

    if (comments === undefined) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="small" color={colors.icon} />
            </View>
        );
    }

    // Render a single comment (can be top-level or reply)
    const renderCommentItem = (item: any, isReply: boolean = false) => {
        const isLiked = likedComments.has(item._id);
        const displayCount = likeCounts[item._id] !== undefined 
            ? likeCounts[item._id] 
            : (item.likeCount || 0);
        const username = `${item.creator?.first_name || ''} ${item.creator?.last_name || ''}`.trim() || 'User';

        return (
            <View key={item._id} style={[styles.commentItem, isReply && styles.replyCommentItem]}>
                <Image
                    source={{ uri: item.creator?.imageUrl || 'https://via.placeholder.com/40' }}
                    style={[styles.commentAvatar, isReply && styles.replyAvatar]}
                />
                <View style={styles.commentContent}>
                    <View style={styles.commentHeader}>
                        <Text style={[styles.commentUsername, { color: colors.text }]}>
                            {username}
                        </Text>
                        <Text style={[styles.commentTime, { color: colors.icon }]}>
                            · {new Date(item._creationTime).toLocaleDateString()}
                        </Text>
                    </View>
                    <Text style={[styles.commentText, { color: colors.text }]}>{item.content}</Text>
                    <View style={styles.commentActions}>
                        {/* Like button */}
                        <TouchableOpacity 
                            style={styles.commentAction}
                            onPress={() => handleLike(item._id, isLiked, displayCount)}
                        >
                            <Ionicons 
                                name={isLiked ? "heart" : "heart-outline"} 
                                size={16} 
                                color={isLiked ? '#FF3B30' : colors.icon} 
                            />
                            {displayCount > 0 && (
                                <Text style={[styles.actionCount, { color: isLiked ? '#FF3B30' : colors.icon }]}>
                                    {displayCount}
                                </Text>
                            )}
                        </TouchableOpacity>
                        
                        {/* Reply button */}
                        <TouchableOpacity 
                            style={styles.commentAction}
                            onPress={() => handleReply(item._id, item.creator?.username || username)}
                        >
                            <Ionicons name="chatbubble-outline" size={16} color={colors.icon} />
                        </TouchableOpacity>
                        
                        {/* Share button */}
                        <TouchableOpacity 
                            style={styles.commentAction}
                            onPress={() => handleShare(item.content, username)}
                        >
                            <Ionicons name="send" size={16} color={colors.icon} />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    };

    // Render comment with its replies
    const renderCommentWithReplies = ({ item }: { item: any }) => {
        return (
            <View>
                {renderCommentItem(item, false)}
                {/* Render nested replies */}
                {item.replies && item.replies.length > 0 && (
                    <View style={styles.repliesContainer}>
                        {item.replies.map((reply: any) => renderCommentItem(reply, true))}
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Thread being replied to */}
            {showThread && thread && (
                <View style={styles.threadContainer}>
                    <View style={styles.threadRow}>
                        <Image
                            source={{ uri: thread.creator?.imageUrl || 'https://via.placeholder.com/40' }}
                            style={styles.threadAvatar}
                        />
                        <View style={styles.threadContent}>
                            <Text style={[styles.threadName, { color: colors.text }]}>
                                {thread.creator?.first_name} {thread.creator?.last_name}
                            </Text>
                            <Text style={[styles.threadText, { color: colors.text }]}>{thread.content}</Text>
                        </View>
                    </View>
                </View>
            )}

            {/* Replying to indicator */}
            {replyingToId && (
                <View style={[styles.replyingToContainer, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.replyingToText, { color: colors.icon }]}>
                        Replying to @{replyingToName}
                    </Text>
                    <TouchableOpacity onPress={() => {
                        setReplyingToId(null);
                        setReplyingToName('');
                    }}>
                        <Ionicons name="close-circle" size={20} color={colors.icon} />
                    </TouchableOpacity>
                </View>
            )}

            {/* Comments List */}
            <FlatList
                data={comments}
                keyExtractor={(item) => item._id}
                renderItem={renderCommentWithReplies}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={[styles.emptyTitle, { color: colors.text }]}>No comments yet</Text>
                        <Text style={[styles.emptySubtitle, { color: colors.icon }]}>Be the first to share what you think</Text>
                    </View>
                }
                contentContainerStyle={styles.commentsList}
                showsVerticalScrollIndicator={false}
            />

            {/* Input */}
            <View style={[styles.inputContainer, { borderTopColor: colors.border }]}>
                <Image
                    source={{ uri: userProfile?.imageUrl as string }}
                    style={styles.inputAvatar}
                />
                <TextInput
                    style={[styles.input, { color: colors.text }]}
                    placeholder={replyingToId ? `Reply to @${replyingToName}...` : "Add a comment..."}
                    placeholderTextColor={colors.icon}
                    value={commentContent}
                    onChangeText={setCommentContent}
                    multiline
                />
                <TouchableOpacity
                    style={[styles.postButton, isPostButtonDisabled && styles.postButtonDisabled]}
                    onPress={handleSubmit}
                    disabled={isPostButtonDisabled}>
                    <Text style={[styles.postButtonText, { color: isPostButtonDisabled ? colors.icon : colors.tint }]}>
                        Post
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    threadContainer: {
        padding: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#DBDBDB',
    },
    threadRow: {
        flexDirection: 'row',
    },
    threadAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 12,
    },
    threadContent: {
        flex: 1,
        justifyContent: 'center',
    },
    threadName: {
        fontWeight: '600',
        fontSize: 14,
        marginBottom: 4,
    },
    threadText: {
        fontSize: 14,
        lineHeight: 18,
    },
    replyingToContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    replyingToText: {
        fontSize: 12,
    },
    commentsList: {
        flexGrow: 1,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '600',
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        textAlign: 'center',
    },
    commentItem: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    commentAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        marginRight: 12,
    },
    commentContent: {
        flex: 1,
    },
    commentHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 2,
    },
    commentUsername: {
        fontWeight: '600',
        fontSize: 14,
    },
    commentTime: {
        fontSize: 14,
    },
    commentText: {
        fontSize: 14,
        lineHeight: 18,
        marginBottom: 8,
    },
    commentActions: {
        flexDirection: 'row',
        gap: 20,
    },
    commentAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        padding: 2,
    },
    actionCount: {
        fontSize: 12,
        marginLeft: 2,
    },
    // Reply/Nested comment styles
    repliesContainer: {
        marginLeft: 24,
        paddingLeft: 12,
        borderLeftWidth: 2,
        borderLeftColor: '#E0E0E0',
    },
    replyCommentItem: {
        paddingVertical: 8,
    },
    replyAvatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    inputAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 12,
    },
    input: {
        flex: 1,
        fontSize: 14,
        maxHeight: 100,
    },
    postButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    postButtonDisabled: {
        opacity: 0.5,
    },
    postButtonText: {
        fontWeight: '600',
        fontSize: 14,
    },
});

export default CommentComposer;
