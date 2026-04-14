import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from 'convex/react';
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type CommentItemProps = {
    comment: {
        _id: string;
        _creationTime: number;
        text: string;
        creator?: {
            clerkId?: string;
            username?: string;
            first_name?: string;
            last_name?: string;
            imageUrl?: string;
        };
        likeCount?: number;
        isLiked?: boolean;
    };
    isReply?: boolean;
    onUserPress?: (clerkId: string) => void;
    onReply?: (commentId: string, username: string) => void;
};

const CommentItem: React.FC<CommentItemProps> = ({
    comment,
    isReply = false,
    onUserPress,
    onReply,
}) => {
    const textColor = useThemeColor({}, 'text');
    const iconColor = useThemeColor({}, 'icon');
    const toggleCommentLike = useMutation(api.messages.toggleCommentLike);
    
    // Each comment manages its own like state - initialize from comment data
    const [isLiked, setIsLiked] = useState(() => comment.isLiked ?? false);
    const [likeCount, setLikeCount] = useState(() => comment.likeCount ?? 0);
    const [isToggling, setIsToggling] = useState(false);
    
    // Only sync from props when comment ID changes (not on every render)
    useEffect(() => {
        setIsLiked(comment.isLiked ?? false);
        setLikeCount(comment.likeCount ?? 0);
    }, [comment._id]);

    const handleLike = async () => {
        // Prevent double-toggling while mutation is in progress
        if (isToggling) return;
        
        setIsToggling(true);
        
        // Optimistic update - instant UI feedback
        const wasLiked = isLiked;
        setIsLiked(!wasLiked);
        setLikeCount(prev => wasLiked ? prev - 1 : prev + 1);
        
        try {
            await toggleCommentLike({ commentId: comment._id as Id<'comments'> });
        } catch (error) {
            console.error('Error toggling like:', error);
            // Revert on error
            setIsLiked(wasLiked);
            setLikeCount(prev => wasLiked ? prev + 1 : prev - 1);
        } finally {
            setIsToggling(false);
        }
    };

    const username = `${comment.creator?.first_name || ''} ${comment.creator?.last_name || ''}`.trim() || 'User';
    const displayUsername = comment.creator?.username || username;

    return (
        <View style={[styles.commentItem, isReply && styles.replyCommentItem]}>
            <TouchableOpacity 
                onPress={() => onUserPress?.(comment.creator?.clerkId || '')}
                disabled={!comment.creator?.clerkId}
            >
                <Image
                    source={{ uri: comment.creator?.imageUrl || 'https://via.placeholder.com/40' }}
                    style={[styles.commentAvatar, isReply && styles.replyAvatar]}
                />
            </TouchableOpacity>
            <View style={styles.commentContent}>
                <View style={styles.commentHeader}>
                    <TouchableOpacity 
                        onPress={() => onUserPress?.(comment.creator?.clerkId || '')}
                        disabled={!comment.creator?.clerkId}
                    >
                        <Text style={[styles.commentUsername, { color: textColor }]}>
                            {username}
                        </Text>
                    </TouchableOpacity>
                    <Text style={[styles.commentTime, { color: iconColor }]}>
                        · {new Date(comment._creationTime).toLocaleDateString()}
                    </Text>
                </View>
                <Text style={[styles.commentText, { color: textColor }]}>
                    {comment.text}
                </Text>
                <View style={styles.commentActions}>
                    {/* Like button with heart icon */}
                    <TouchableOpacity 
                        style={styles.commentAction}
                        onPress={handleLike}
                        disabled={isToggling}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons 
                            name={isLiked ? "heart" : "heart-outline"} 
                            size={16} 
                            color={isLiked ? '#FF3B30' : iconColor} 
                        />
                        {likeCount > 0 && (
                            <Text style={[styles.actionCount, { color: isLiked ? '#FF3B30' : iconColor }]}>
                                {likeCount}
                            </Text>
                        )}
                    </TouchableOpacity>
                    
                    {/* Reply button */}
                    <TouchableOpacity 
                        style={styles.commentAction}
                        onPress={() => onReply?.(comment._id, displayUsername)}
                    >
                        <Text style={[styles.replyText, { color: iconColor }]}>Reply</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
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
        gap: 12,
        marginTop: 4,
    },
    commentAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        padding: 4,
    },
    actionCount: {
        fontSize: 12,
        marginLeft: 2,
    },
    replyText: {
        fontSize: 12,
        fontWeight: '500',
    },
    // Reply/Nested comment styles
    replyCommentItem: {
        paddingVertical: 8,
    },
    replyAvatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
    },
});

export default CommentItem;
