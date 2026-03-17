import { api } from '@/convex/_generated/api';
import { Doc, Id } from '@/convex/_generated/dataModel';
import { useThemeColors } from '@/hooks/useThemeColor';
import { useAuth } from '@clerk/clerk-expo';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ImageViewer from './ImageViewer';
import PollCard from './PollCard';

// Extended thread type with poll fields
type ThreadWithPoll = Doc<'messages'> & {
    creator: Doc<'users'> | null;
    isLiked?: boolean;
    isSaved?: boolean;
    isPoll?: boolean;
    pollQuestion?: string;
    pollOptions?: string[];
    isFollowing?: boolean;
};

type ThreadProps = {
    thread: ThreadWithPoll;
    showMenu?: boolean;
    onDelete?: (threadId: Id<'messages'>) => void;
    onLikeToggle?: (isLiked: boolean, threadId: Id<'messages'>) => void;
};

const Thread = ({ thread, showMenu = false, onDelete, onLikeToggle }: ThreadProps) => {
    const { content, mediaFiles, likeCount, commentCount, retweetCount, creator, isLiked: initialIsLiked, isSaved: initialIsSaved, isFollowing: initialIsFollowing, postId, threadId, parentId } = thread;
    
    // Check if this is a reply (has parent reference)
    const isReply = !!(postId || threadId || parentId);
    const toggleLike = useMutation(api.messages.toggleLike);
    const toggleSavePost = useMutation(api.messages.toggleSavePost);
    const voteOnPoll = useMutation(api.messages.voteOnPoll);
    const deleteThread = useMutation(api.messages.deleteThread);
    const archivePost = useMutation(api.messages.archivePost);
    const followUser = useMutation(api.users.followUser);
    const unfollowUser = useMutation(api.users.unfollowUser);
    const router = useRouter();
    const { userId: currentUserId } = useAuth();
    
    // Use database-driven like state directly from the thread prop
    // The query will automatically re-fetch after toggleLike mutation
    const isLiked = thread.isLiked ?? false;
    const displayLikeCount = thread.likeCount ?? 0;
    // Use database-driven saved state directly from the thread prop
    const isSaved = thread.isSaved ?? false;
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [showPostMenu, setShowPostMenu] = useState(false);
    const colors = useThemeColors();
    
    // Get follow status from query (single source of truth)
    const followStatus = useQuery(
        api.users.getFollowStatus,
        creator?.clerkId ? { clerkId: creator.clerkId } : 'skip'
    );
    
    // Use query result for follow state, fallback to initial
    const isFollowing = followStatus?.isFollowing ?? initialIsFollowing ?? false;

    // Get poll votes data
    const pollVotesData = useQuery(
        api.messages.getPollVotes,
        thread.isPoll ? { pollId: thread._id as Id<'messages'> } : 'skip'
    );
    
    // Check if current user is the owner of this thread
    const isOwner = creator && currentUserId && creator.clerkId === currentUserId;
    
    // Build display name from first_name and last_name
    const displayName = creator
        ? `${creator.first_name || ''} ${creator.last_name || ''}`.trim()
        : '';
    
    // Get username from creator - handle null case
    const username = (creator as any)?.username;
    
    // If no display name, use first_name
    const finalDisplayName = displayName || creator?.first_name || 'User';
    
    // If no username in DB, generate from first_name or use 'user'
    const finalUsername = username || creator?.first_name?.toLowerCase() || 'user';
    
    // Navigate to user profile
    const navigateToProfile = () => {
        if (creator?._id) {
            router.push({
                pathname: '/(auth)/(tabs)/profile',
                params: { userId: creator._id }
            });
        }
    };

    const handleLike = async () => {
        // Call the mutation - query will automatically re-fetch after it completes
        await toggleLike({ messageId: thread._id });
        // No need to manually update state - the query will re-fetch and update the UI
    };

    const handleComment = () => {
        router.push(`/(auth)/(modal)/reply/${thread._id}` as any);
    };

    // Handle share post
    const handleShare = async () => {
        try {
            // Build the share message
            let shareMessage = content || '';
            
            // Add username if available
            if (displayName) {
                shareMessage = `${displayName}: ${shareMessage}`;
            }
            
            // Get first image URL if available
            const imageUrl = mediaFiles && mediaFiles.length > 0 ? mediaFiles[0] : null;
            
            // Try native share
            if (imageUrl) {
                // Share with image URL in message
                const result = await Share.share({
                    message: `${shareMessage}\n\nImage: ${imageUrl}`,
                    title: 'Share Post',
                });
                
                if (result.action === Share.sharedAction) {
                    console.log('Post shared successfully');
                }
            } else {
                // Share text only
                const result = await Share.share({
                    message: shareMessage || 'Check out this post',
                    title: 'Share Post',
                });
                
                if (result.action === Share.sharedAction) {
                    console.log('Post shared successfully');
                }
            }
        } catch (error: any) {
            // Handle case where share is cancelled or fails
            if (error.message !== 'User did not share') {
                console.error('Error sharing post:', error);
                Alert.alert('Error', 'Unable to share post. Please try again.');
            }
        }
    };

    // Handle save/unsave post
    const handleSave = async () => {
        try {
            await toggleSavePost({ messageId: thread._id });
            // No need to manually update state - the query will re-fetch and update the UI
        } catch (error) {
            console.error('Error saving post:', error);
            Alert.alert('Error', 'Unable to save post. Please try again.');
        }
    };

    // Handle poll vote
    const handleVote = async (optionId: string) => {
        await voteOnPoll({
            pollId: thread._id,
            optionIndex: parseInt(optionId, 10),
        });
    };

    // Handle follow/unfollow
    const handleFollow = async () => {
        if (!creator?._id || isOwner) return;
        try {
            if (isFollowing) {
                await unfollowUser({ userId: creator.clerkId });
            } else {
                await followUser({ userId: creator.clerkId });
            }
            // State will automatically update from query
        } catch (error) {
            console.error('Error following user:', error);
            Alert.alert('Error', 'Unable to follow user. Please try again.');
        }
    };

    // Format poll options for PollCard
    const pollOptions = React.useMemo(() => {
        if (!thread.pollOptions) return [];
        return thread.pollOptions.map((text, index) => ({
            id: String(index),
            text,
            percentage: 0,
            voteCount: 0,
        }));
    }, [thread.pollOptions]);

    // Get userVote and votes from pollVotesData
    const userVote = pollVotesData?.userVote !== undefined ? String(pollVotesData.userVote) : null;
    
    // Convert poll results to votes array for real-time sync
    const votes: { userId: string; optionId: string }[] = useMemo(() => {
        if (!pollVotesData?.results) return [];
        const voteList: { userId: string; optionId: string }[] = [];
        pollVotesData.results.forEach((result: any) => {
            // Each result now has voters array
            if (result.voters && Array.isArray(result.voters)) {
                result.voters.forEach((userId: string) => {
                    voteList.push({
                        userId,
                        optionId: String(result.optionIndex),
                    });
                });
            }
        });
        return voteList;
    }, [pollVotesData]);

    // Update poll options with vote data if available
    const displayPollOptions = React.useMemo(() => {
        if (!pollVotesData?.results) return pollOptions;
        return pollOptions.map((option, index) => {
            const result = pollVotesData.results.find((r: any) => r.optionIndex === index);
            return {
                ...option,
                percentage: result?.percentage || 0,
                voteCount: result?.count || 0,
            };
        });
    }, [pollOptions, pollVotesData]);

    return (
        <>
            <View style={styles.container}>
                <TouchableOpacity onPress={navigateToProfile} activeOpacity={0.7}>
                    <View style={styles.avatarContainer}>
                        {creator && creator.imageUrl ? (
                            <Image
                                source={{ uri: creator.imageUrl }}
                                style={styles.avatar}
                            />
                        ) : (
                            <Image
                                source={require('@/assets/images/react-logo.png')}
                                style={styles.avatar}
                            />
                        )}
                        {/* Online Indicator */}
                        {creator && creator.isOnline && creator.showOnlineStatus && (
                            <View style={styles.onlineIndicator} />
                        )}
                        {creator && (
                            <>
                            {console.log('[Thread] Creator online status:', creator.isOnline, 'showOnlineStatus:', creator.showOnlineStatus)}
                            </>
                        )}
                    </View>
                </TouchableOpacity>
                <View style={styles.contentContainer}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={navigateToProfile} style={styles.headerText} activeOpacity={0.7}>
                            <View style={styles.nameRow}>
                                <Text style={[styles.displayName, { color: colors.text }]}>{finalDisplayName}</Text>
                                <Text style={[styles.atSymbol, { color: colors.text }]}>@</Text>
                                <Text style={[styles.username, { color: colors.text }]}>{finalUsername}</Text>
                            </View>
                            <Text style={[styles.timestamp, { color: colors.icon }]}>
                                · {new Date(thread._creationTime).toLocaleDateString()}
                            </Text>
                        </TouchableOpacity>
                        {/* Follow button - show for non-owners */}
                        {!isOwner && creator && creator._id && (
                            <TouchableOpacity
                                style={[
                                    styles.followButton,
                                    isFollowing 
                                        ? { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border }
                                        : { backgroundColor: colors.primary }
                                ]}
                                onPress={handleFollow}
                            >
                                <Text style={[
                                    styles.followButtonText,
                                    { color: isFollowing ? colors.text : '#FFFFFF' }
                                ]}>
                                    {isFollowing ? 'Following' : 'Follow'}
                                </Text>
                            </TouchableOpacity>
                        )}
                        {/* Three-dot menu - only show if showMenu is true and user is owner */}
                        {showMenu && isOwner && (
                            <TouchableOpacity 
                                style={styles.moreButton}
                                onPress={() => setShowPostMenu(true)}
                            >
                                <Ionicons
                                    name="ellipsis-horizontal"
                                    size={18}
                                    color={colors.icon}
                                />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Bottom Sheet Menu for Post Options */}
                    <Modal
                        visible={showPostMenu}
                        transparent
                        animationType="slide"
                        onRequestClose={() => setShowPostMenu(false)}
                    >
                        <Pressable 
                            style={styles.modalOverlay}
                            onPress={() => setShowPostMenu(false)}
                        >
                            <Pressable 
                                style={[styles.bottomSheet, { backgroundColor: colors.background }]}
                                onPress={(e) => e.stopPropagation()}
                            >
                                <View style={[styles.bottomSheetHandle, { backgroundColor: colors.icon }]} />
                                <Text style={[styles.bottomSheetTitle, { color: colors.text }]}>Post Options</Text>
                                
                                <TouchableOpacity
                                    style={styles.bottomSheetOption}
                                    onPress={async () => {
                                        setShowPostMenu(false);
                                        try {
                                            await archivePost({ messageId: thread._id });
                                            Alert.alert('Success', 'Post archived successfully');
                                            if (onDelete) {
                                                onDelete(thread._id);
                                            }
                                        } catch (error) {
                                            console.error('Failed to archive post:', error);
                                            Alert.alert('Error', 'Failed to archive post. Please try again.');
                                        }
                                    }}
                                >
                                    <Ionicons name="archive-outline" size={22} color={colors.text} />
                                    <Text style={[styles.bottomSheetOptionText, { color: colors.text }]}>Archive Post</Text>
                                </TouchableOpacity>
                                
                                <TouchableOpacity
                                    style={styles.bottomSheetOption}
                                    onPress={() => {
                                        setShowPostMenu(false);
                                        Alert.alert(
                                            isReply ? 'Delete this reply?' : 'Delete this post?',
                                            'This action cannot be undone.',
                                            [
                                                { text: 'Cancel', style: 'cancel' },
                                                {
                                                    text: 'Delete',
                                                    style: 'destructive',
                                                    onPress: async () => {
                                                        try {
                                                            await deleteThread({ threadId: thread._id });
                                                            if (onDelete) {
                                                                onDelete(thread._id);
                                                            }
                                                        } catch (error) {
                                                            console.error('Failed to delete thread:', error);
                                                            Alert.alert('Error', 'Failed to delete thread. Please try again.');
                                                        }
                                                    },
                                                },
                                            ]
                                        );
                                    }}
                                >
                                    <Ionicons name="trash-outline" size={22} color="#FF3B30" />
                                    <Text style={[styles.bottomSheetOptionText, { color: '#FF3B30' }]}>Delete Post</Text>
                                </TouchableOpacity>
                                
                                <TouchableOpacity
                                    style={[styles.bottomSheetOption, { borderBottomWidth: 0 }]}
                                    onPress={() => setShowPostMenu(false)}
                                >
                                    <Text style={[styles.bottomSheetCancelText, { color: colors.text }]}>Cancel</Text>
                                </TouchableOpacity>
                            </Pressable>
                        </Pressable>
                    </Modal>

                    <Text style={[styles.content, { color: colors.text }]}>{content}</Text>

                    {/* Render poll if available */}
                    {thread.isPoll && thread.pollQuestion && creator && (
                        <PollCard
                            pollId={thread._id}
                            question={thread.pollQuestion}
                            options={pollOptions}
                            votes={votes}
                            currentUserId={currentUserId || ''}
                            selectedOption={userVote}
                            onVote={handleVote}
                            creator={{
                                name: finalDisplayName,
                                username: finalUsername,
                                avatar: creator.imageUrl || undefined,
                            }}
                            timestamp={new Date(thread._creationTime).toLocaleDateString()}
                        />
                    )}

                    {mediaFiles && mediaFiles.length > 0 && (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.mediaContainer}>
                            {mediaFiles.map((imageUrl, index) => (
                                imageUrl ? (
                                    <TouchableOpacity
                                        key={index}
                                        style={styles.mediaImageWrapper}
                                        onPress={() => imageUrl && setSelectedImage(imageUrl)}>
                                        <Image 
                                            source={{ uri: imageUrl }} 
                                            style={styles.mediaImage}
                                            resizeMode="cover"
                                            onError={() => console.warn(`Failed to load image: ${imageUrl}`)}
                                        />
                                    </TouchableOpacity>
                                ) : null
                            ))}
                        </ScrollView>
                    )}

                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={handleLike}>
                            <View style={styles.actionIcon}>
                                <Ionicons 
                                    name={isLiked ? "heart" : "heart-outline"} 
                                    size={22} 
                                    color={isLiked ? '#FF3B30' : colors.icon} 
                                />
                            </View>
                            <Text style={[styles.actionText, isLiked ? { color: '#FF3B30' } : { color: colors.icon }]}>
                                {displayLikeCount}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.actionButton} onPress={handleComment}>
                            <View style={styles.actionIcon}>
                                <Ionicons name="chatbubble-outline" size={20} color={colors.icon} />
                            </View>
                            {commentCount > 0 && (
                                <Text style={[styles.actionText, { color: colors.icon }]}>{commentCount}</Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
                            <View style={styles.actionIcon}>
                                <Feather name="send" size={20} color={colors.icon} />
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.actionButton} onPress={handleSave}>
                            <View style={styles.actionIcon}>
                                <Ionicons 
                                    name={isSaved ? "bookmark" : "bookmark-outline"} 
                                    size={22} 
                                    color={isSaved ? '#007AFF' : colors.icon} 
                                />
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            <ImageViewer
                visible={selectedImage !== null}
                imageUrl={selectedImage || ''}
                onClose={() => setSelectedImage(null)}
            />
        </>
    );
};

export default Thread;

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 12,
    },
    avatarContainer: {
        position: 'relative',
    },
    onlineIndicator: {
        position: 'absolute',
        bottom: 0,
        right: 8,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#22c55e',
        borderWidth: 2,
        borderColor: '#fff',
    },
    contentContainer: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    headerText: {
        flex: 1,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
    },
    displayName: {
        fontWeight: '600',
        fontSize: 15,
    },
    atSymbol: {
        fontSize: 15,
        marginHorizontal: 2,
    },
    username: {
        fontSize: 15,
    },
    timestamp: {
        fontSize: 14,
        marginTop: 2,
    },
    moreButton: {
        padding: 4,
    },
    followButton: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
        marginLeft: 8,
    },
    followButtonText: {
        fontSize: 13,
        fontWeight: '600',
    },
    content: {
        fontSize: 15,
        lineHeight: 20,
        marginBottom: 12,
    },
    mediaContainer: {
        gap: 8,
    },
    mediaImageWrapper: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    mediaImage: {
        width: 280,
        height: 320,
        borderRadius: 16,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 4,
        paddingRight: 20,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    actionIcon: {
        padding: 8,
    },
    actionText: {
        fontSize: 14,
        color: '#6B6B6B',
    },
    // Bottom Sheet Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    bottomSheet: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    bottomSheetHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 16,
    },
    bottomSheetTitle: {
        fontSize: 18,
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 20,
    },
    bottomSheetOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(128, 128, 128, 0.2)',
    },
    bottomSheetOptionText: {
        fontSize: 16,
        marginLeft: 12,
    },
    bottomSheetCancelText: {
        fontSize: 16,
        textAlign: 'center',
        paddingVertical: 16,
    },
});
