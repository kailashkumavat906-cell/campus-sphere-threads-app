import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useThemeColors } from '@/hooks/useThemeColor';
import { useUserProfile } from '@/hooks/useUserProfile';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    InputAccessoryView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ThreadComposerProps = {
    isPreview?: boolean;
    isReply?: boolean;
    threadId?: Id<'messages'>;
    draftId?: string;
};

const ThreadComposer: React.FC<ThreadComposerProps> = ({ isReply, threadId, draftId }) => {
    const router = useRouter();
    const { top } = useSafeAreaInsets();
    const [threadContent, setThreadContent] = useState('');
    const { userProfile } = useUserProfile();
    const inputAccessoryViewID = 'uniqueID';
    const addThread = useMutation(api.messages.addThread);
    const addComment = useMutation(api.messages.addComment);
    const saveDraft = useMutation(api.messages.saveDraft);
    const deleteDraft = useMutation(api.messages.deleteDraft);
    const [mediaFiles, setMediaFiles] = useState<ImagePicker.ImagePickerAsset[]>([]);
    const [isPosting, setIsPosting] = useState(false);
    const generateUploadUrl = useMutation(api.messages.generateUploadUrl);
    const colors = useThemeColors();

    // Load draft content when editing
    const draft = useQuery(
        api.messages.getThreadById,
        draftId ? { messageId: draftId as Id<'messages'> } : 'skip'
    );

    useEffect(() => {
        if (draft && draft.isDraft) {
            setThreadContent(draft.content || '');
            
            // Load media files from draft if available
            if (draft.mediaFiles && draft.mediaFiles.length > 0) {
                // Convert storage URLs to ImagePicker assets with storage IDs
                const assets: any[] = draft.mediaFiles.map((url, index) => {
                    // Extract storage ID from URL if it's a full URL
                    let storageId = url;
                    if (url.startsWith('http')) {
                        // Extract the storage ID from the URL path
                        // URL format: https://xxx.convex.cloud/api/storage/xxxxx
                        const parts = url.split('/');
                        storageId = parts[parts.length - 1];
                    }
                    return {
                        uri: url, // Use full URL for display
                        assetId: `draft-${draft._id}-${index}`,
                        type: 'image',
                        width: 0,
                        height: 0,
                        storageId: storageId, // Store the storage ID for re-uploading
                    };
                });
                setMediaFiles(assets);
            }
            
            // Load poll data from draft if available
            if (draft.isPoll && draft.pollQuestion) {
                setPollData({
                    question: draft.pollQuestion,
                    options: draft.pollOptions || [],
                });
                setPollQuestion(draft.pollQuestion || '');
                setPollOptions(draft.pollOptions || ['', '']);
            }
        }
    }, [draft]);

    // Poll state
    const [showPollCreator, setShowPollCreator] = useState(false);
    const [pollQuestion, setPollQuestion] = useState('');
    const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
    const [pollData, setPollData] = useState<{ question: string; options: string[] } | null>(null);

    // Emoji picker state
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [activeEmojiCategory, setActiveEmojiCategory] = useState('smileys');
    
    // Hashtag picker state
    const [showHashtagPicker, setShowHashtagPicker] = useState(false);
    
    // Menu state
    const [showMenu, setShowMenu] = useState(false);
    
    // Trending hashtags (in real app, this would come from API)
    const trendingHashtags = [
        { tag: 'trending', posts: '125K' },
        { tag: 'news', posts: '89K' },
        { tag: 'technology', posts: '67K' },
        { tag: 'sports', posts: '54K' },
        { tag: 'entertainment', posts: '48K' },
        { tag: 'music', posts: '42K' },
        { tag: 'art', posts: '35K' },
        { tag: 'photography', posts: '31K' },
        { tag: 'food', posts: '28K' },
        { tag: 'travel', posts: '24K' },
        { tag: 'fashion', posts: '21K' },
        { tag: 'fitness', posts: '19K' },
    ];

    // Poll functions
    const addPollOption = () => {
        if (pollOptions.length < 4) {
            setPollOptions([...pollOptions, '']);
        }
    };

    const updatePollOption = (index: number, value: string) => {
        const newOptions = [...pollOptions];
        newOptions[index] = value;
        setPollOptions(newOptions);
    };

    const removePollOption = (index: number) => {
        if (pollOptions.length > 2) {
            const newOptions = pollOptions.filter((_, i) => i !== index);
            setPollOptions(newOptions);
        }
    };

    const createPoll = () => {
        const validOptions = pollOptions.filter(opt => opt.trim() !== '');
        if (pollQuestion.trim() && validOptions.length >= 2) {
            setPollData({
                question: pollQuestion,
                options: validOptions,
            });
            setShowPollCreator(false);
        } else {
            Alert.alert('Invalid Poll', 'Please enter a question and at least 2 options.');
        }
    };

    const cancelPoll = () => {
        setShowPollCreator(false);
        setPollQuestion('');
        setPollOptions(['', '']);
    };

    const removePoll = () => {
        setPollData(null);
        setPollQuestion('');
        setPollOptions(['', '']);
    };

    const insertEmoji = (emoji: string) => {
        setThreadContent(prev => prev + emoji);
        setShowEmojiPicker(false);
    };
    
    const insertHashtag = (tag: string) => {
        setThreadContent(prev => prev + ' #' + tag);
        setShowHashtagPicker(false);
    };

    const uploadMediaFile = async (image: ImagePicker.ImagePickerAsset | null | undefined) => {
        // Safely handle undefined or null image
        if (!image) {
            console.log('uploadMediaFile: image is null/undefined');
            return '';
        }
        
        // Safely get the URI
        const imageUri = image.uri;
        if (!imageUri) {
            console.log('uploadMediaFile: image.uri is undefined');
            return '';
        }
        
        try {
            console.log('uploadMediaFile: starting upload for', imageUri);
            const postUrl = await generateUploadUrl();
            const response = await fetch(imageUri);
            const blob = await response.blob();
            const mimeType = image.mimeType || 'image/jpeg';
            
            const result = await fetch(postUrl, {
                method: 'POST',
                headers: { 'Content-Type': mimeType },
                body: blob,
            });
            
            if (!result.ok) {
                console.log('uploadMediaFile: upload failed with status', result.status);
                return '';
            }
            
            const data = await result.json();
            const storageId = data.storageId || '';
            console.log('uploadMediaFile: got storageId', storageId);
            return storageId;
        } catch (error) {
            console.error('uploadMediaFile: error', error);
            return '';
        }
    };

    const selectImage = async (source: 'camera' | 'library' | 'gif') => {
        try {
            const options: ImagePicker.ImagePickerOptions = {
                allowsEditing: true,
                aspect: [4, 3],
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
            };

            let result;

            if (source === 'camera') {
                const permission = await ImagePicker.requestCameraPermissionsAsync();
                if (!permission.granted) {
                    Alert.alert('Permission needed', 'Camera permission is required to take photos.');
                    return;
                }
                result = await ImagePicker.launchCameraAsync(options);
            } else if (source === 'gif') {
                const gifOptions: ImagePicker.ImagePickerOptions = {
                    allowsEditing: false,
                    mediaTypes: ImagePicker.MediaTypeOptions.All,
                };
                result = await ImagePicker.launchImageLibraryAsync(gifOptions);
            } else {
                result = await ImagePicker.launchImageLibraryAsync(options);
            }

            // Safely check for result and assets
            if (!result) return;
            
            // Check if user cancelled
            if (result.canceled) return;
            
            // Check if assets exist and have items
            const assets = result.assets;
            if (!assets || !Array.isArray(assets) || assets.length === 0) return;
            
            // Safely get the first asset's URI
            const firstAsset = assets[0];
            if (!firstAsset || !firstAsset.uri) return;
            
            // Add the image to mediaFiles
            setMediaFiles([firstAsset, ...mediaFiles]);
        } catch (error) {
            console.error('Error selecting image:', error);
            Alert.alert('Error', 'Failed to select image. Please try again.');
        }
    };

    const removeImage = (index: number) => {
        setMediaFiles(mediaFiles.filter((_, i) => i !== index));
    };

    const handleCancel = () => {
        setThreadContent('');
        setMediaFiles([]);
        setPollData(null);
        Alert.alert('Discard thread?', '', [
            {
                text: 'Discard',
                style: 'destructive',
                onPress: () => {
                    // Safe navigation - prefer going back
                    if (router.canGoBack()) {
                        router.back();
                    } else {
                        router.replace('/(auth)/(tabs)/feed');
                    }
                },
            },
            {
                text: 'Save Draft',
                style: 'cancel',
            },
            {
                text: 'Cancel',
                style: 'cancel',
            },
        ]);
    };
    
    // Menu functions
    const saveAsDraft = async () => {
        if (threadContent.trim() === '' && mediaFiles.length === 0 && !pollData) {
            Alert.alert('Empty Draft', 'Cannot save an empty draft.');
            return;
        }
        
        try {
            const mediaStorageIds: string[] = [];
            
            for (const file of mediaFiles) {
                const id = await uploadMediaFile(file);
                if (id) {
                    mediaStorageIds.push(id);
                }
            }
            
            await saveDraft({
                content: threadContent,
                mediaFiles: mediaStorageIds.length > 0 ? mediaStorageIds : undefined,
                draftId: draftId as Id<'messages'> | undefined,
                isPoll: pollData ? true : undefined,
                pollQuestion: pollData?.question,
                pollOptions: pollData?.options,
            });
            
            Alert.alert('Draft Saved', 'Your post has been saved as a draft.');
            
            // Safe navigation - check if we can go back first
            if (router.canGoBack()) {
                router.back();
            } else {
                router.replace('/(auth)/(tabs)/feed');
            }
        } catch (error) {
            console.error('Error saving draft:', error);
            Alert.alert('Error', 'Failed to save draft. Please try again.');
        }
    };
    
    const clearPost = () => {
        Alert.alert(
            'Clear Post?',
            'Are you sure you want to clear all text and media? This cannot be undone.',
            [
                {
                    text: 'Cancel',
                    style: 'cancel',
                    onPress: () => setShowMenu(false),
                },
                {
                    text: 'Clear',
                    style: 'destructive',
                    onPress: () => {
                        setThreadContent('');
                        setMediaFiles([]);
                        setPollData(null);
                        setShowMenu(false);
                        // Safe navigation - prefer going back
                        if (router.canGoBack()) {
                            router.back();
                        } else {
                            router.replace('/(auth)/(tabs)/feed');
                        }
                    },
                },
            ]
        );
    };

    const isPostButtonDisabled = (threadContent.trim() === '' && mediaFiles.length === 0 && !pollData) || isPosting;

    const handleSubmit = async () => {
        // Prevent multiple submissions
        if (isPosting) return;
        
        if (threadContent.trim() === '' && mediaFiles.length === 0 && !pollData) {
            return;
        }

        setIsPosting(true);
        
        try {
            const mediaStorageIds: string[] = [];
            
            for (const file of mediaFiles) {
                // Check if file has a storageId (from draft)
                const fileAny = file as any;
                if (fileAny.storageId) {
                    // Use the existing storage ID directly
                    console.log('Using existing storageId from draft:', fileAny.storageId);
                    mediaStorageIds.push(fileAny.storageId);
                } else {
                    // For new files from picker, always upload them
                    // Don't use file.uri directly - it could be a local path
                    console.log('Uploading new file, uri:', file.uri);
                    const id = await uploadMediaFile(file);
                    console.log('Upload returned storageId:', id);
                    if (id) {
                        mediaStorageIds.push(id);
                    } else {
                        console.error('Upload failed - no storageId returned');
                    }
                }
            }

            console.log('Final mediaStorageIds to save:', mediaStorageIds);

            // Use addComment for replies, addThread for new posts
            if (threadId) {
                // This is a comment/reply - use addComment mutation
                await addComment({
                    postId: threadId,
                    text: threadContent,
                });
            } else {
                // This is a new post - use addThread mutation
                await addThread({ 
                    content: threadContent, 
                    mediaFiles: mediaStorageIds.length > 0 ? mediaStorageIds : undefined,
                    isPoll: pollData ? true : undefined,
                    pollQuestion: pollData?.question,
                    pollOptions: pollData?.options,
                });
            }

            // Delete the draft if we're editing one
            if (draftId) {
                try {
                    await deleteDraft({ draftId: draftId as Id<'messages'> });
                } catch (deleteError) {
                    console.error('Error deleting draft:', deleteError);
                }
            }

            // Reset and navigate back
            setThreadContent('');
            setMediaFiles([]);
            setPollData(null);
            
            // Safe navigation - check if we can go back first
            if (router.canGoBack()) {
                router.back();
            } else {
                // If we can't go back, try to navigate to feed
                router.replace('/(auth)/(tabs)/feed');
            }
        } catch (error) {
            console.error('Error posting thread:', error);
            Alert.alert('Error', 'Failed to post thread. Please try again.');
        } finally {
            setIsPosting(false);
        }
    };

    // Emoji categories with icons (like Threads app)
    const emojiCategories = [
        { id: 'smileys', icon: '😊', name: 'Smileys' },
        { id: 'gestures', icon: '👍', name: 'Gestures' },
        { id: 'objects', icon: '❤️', name: 'Objects' },
        { id: 'animals', icon: '🐱', name: 'Animals' },
        { id: 'food', icon: '🍕', name: 'Food' },
        { id: 'activities', icon: '⚽', name: 'Activities' },
    ];
    
    // Emojis for each category
    const emojisByCategory: Record<string, string[]> = {
        smileys: ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖'],
        gestures: ['👍', '👎', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '👋', '🤚', '🖐️', '✋', '🖖', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄', '💋', '👶', '👧', '🧒', '👦', '👩', '🧑', '👨', '👩‍🦱', '👨‍🦱', '👩‍🦰', '👨‍🦰', '👱‍♀️', '👱‍♂️', '👩‍🦳', '👨‍🦳', '👩‍🦲', '👨‍🦲', '🧔', '👵', '👴', '👲', '👳‍♀️', '👳‍♂️', '🧕', '👮‍♀️', '👮‍♂️', '👷‍♀️', '👷‍♂️', '💂‍♀️', '💂‍♂️', '🕵️‍♀️', '🕵️‍♂️', '👩‍⚕️', '👨‍⚕️', '👩‍🌾', '👨‍🌾', '👩‍🍳', '👨‍🍳', '👩‍🎓', '👨‍🎓', '👩‍🎤', '👨‍🎤', '👩‍🏫', '👨‍🏫', '👩‍🏭', '👨‍🏭', '👩‍💻', '👨‍💻', '👩‍💼', '👨‍💼', '👩‍🔧', '👨‍🔧', '👩‍🔬', '👨‍🔬', '👩‍🎨', '👨‍🎨', '👩‍🚒', '👨‍🚒', '👩‍✈️', '👨‍✈️', '👩‍🚀', '👨‍🚀', '👩‍⚖️', '👨‍⚖️', '👰', '🤵', '👸', '🤴', '🦸‍♀️', '🦸‍♂️', '🦹‍♀️', '🦹‍♂️', '🧙‍♀️', '🧙‍♂️', '🧚‍♀️', '🧚‍♂️', '🧛‍♀️', '🧛‍♂️', '🧜‍♀️', '🧜‍♂️', '🧝‍♀️', '🧝‍♂️', '🧞‍♀️', '🧞‍♂️', '🧟‍♀️', '🧟‍♂️', '💆‍♀️', '💆‍♂️', '💇‍♀️', '💇‍♂️', '🚶‍♀️', '🚶‍♂️', '🧍‍♀️', '🧍‍♂️', '🧎‍♀️', '🧎‍♂️', '👩‍🦯', '👨‍🦯', '👩‍🦼', '👨‍🦼', '👩‍🦽', '👨‍🦽', '🏃‍♀️', '🏃‍♂️', '💃', '🕺', '🕴️', '👯‍♀️', '👯‍♂️', '🧖‍♀️', '🧖‍♂️', '👭', '👫', '👬', '💏', '💑', '👪', '👨‍👩‍👦', '👩‍👩‍👦'],
        objects: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉁', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❕', '🔅', '🔆', '🔦', '🕯️', '💡', '🔌', '🔋', '🧲', '🪐', '🌌', '💫', '⭐', '🌟', '✨', '💥', '💥', '💥'],
        animals: ['🐱', '🐶', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞', '🐜', '🪰', '🪲', '🪳', '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🦣', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🦬', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐈‍⬛', '🦜', '🦢', '🦩', '🕊️', '🐇', '🦝', '🦨', '🦡', '🦫', '🦦', '🦥', '🐁', '🐀', '🐿️', '🦔'],
        food: ['🍕', '🍔', '🍟', '🌭', '🍿', '🧈', '🥚', '🍳', '🥓', '🥞', '🧇', '🧀', '🍖', '🍗', '🥩', '🥓', '🌮', '🌯', '🥙', '🧆', '🥗', '🥘', '🫕', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '☕', '🫖', '🍵', '🧃', '🥤', '🧋', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍾', '🧊'],
        activities: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '⛹️', '🤺', '🤾', '🏌️', '🏇', '🧘', '🏄', '🏊', '🤽', '🚣', '🧗', '🚵', '🚴', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🏵️', '🎗️', '🎫', '🎟️', '🎪', '🎭', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🪘', '🎷', '🎺', '🪗', '🎸', '🪕', '🎻', '🎲', '♟️', '🎯', '🪄', '🎮', '🎰', '🧩'],
    };
    
    const getCurrentEmojis = () => emojisByCategory[activeEmojiCategory] || emojisByCategory.smileys;

    return (
        <View style={[styles.container, { paddingTop: top + 8 }]}>
            <Stack.Screen
                options={{
                    headerLeft: () => (
                        <TouchableOpacity onPress={handleCancel}>
                            <Ionicons name="close" size={24} color={colors.text} />
                        </TouchableOpacity>
                    ),
                    headerRight: () => (
                        <View style={styles.headerRight}>
                            <TouchableOpacity 
                                style={styles.menuButton}
                                onPress={() => setShowMenu(true)}>
                                <Ionicons name="ellipsis-horizontal" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                    ),
                }}
            />
            
            {/* Menu Modal */}
            <Modal
                visible={showMenu}
                transparent
                animationType="fade"
                onRequestClose={() => setShowMenu(false)}>
                <TouchableOpacity 
                    style={styles.menuOverlay} 
                    activeOpacity={1}
                    onPress={() => setShowMenu(false)}>
                    <TouchableOpacity 
                        style={[styles.menuContainer, { backgroundColor: colors.secondary }]} 
                        activeOpacity={1}
                        onPress={() => {}}>
                        <TouchableOpacity style={styles.menuItem} onPress={saveAsDraft}>
                            <Ionicons name="document-outline" size={20} color={colors.text} />
                            <Text style={[styles.menuItemText, { color: colors.text }]}>Save as Draft</Text>
                        </TouchableOpacity>
                        <View style={[styles.menuDivider, { borderBottomColor: colors.border }]} />
                        <TouchableOpacity style={styles.menuItem} onPress={clearPost}>
                            <Ionicons name="trash-outline" size={20} color={colors.text} />
                            <Text style={[styles.menuItemText, { color: colors.text }]}>Clear Post</Text>
                        </TouchableOpacity>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            <View style={styles.topRow}>
                <Image source={{ uri: userProfile?.imageUrl as string }} style={styles.avatar} />
                <View style={styles.centerContainer}>
                    <View style={styles.nameRow}>
                        <Text style={[styles.name, { color: colors.text }]}>
                            {userProfile?.first_name} {userProfile?.last_name}
                        </Text>
                        <Text style={[styles.username, { color: colors.icon }]}>@{userProfile?.username || userProfile?.first_name?.toLowerCase() || 'user'}</Text>
                        {isReply && <Text style={styles.replyingTo}>replying to @thread</Text>}
                    </View>
                    <TextInput
                        style={[styles.input, { color: colors.text }]}
                        placeholder={isReply ? 'Reply to thread' : "What's new?"}
                        placeholderTextColor={colors.icon}
                        value={threadContent}
                        onChangeText={setThreadContent}
                        multiline
                        inputAccessoryViewID={inputAccessoryViewID}
                    />
                    
                    {/* Poll Display */}
                    {pollData && (
                        <View style={styles.pollContainer}>
                            <Text style={[styles.pollQuestion, { color: colors.text }]}>{pollData.question}</Text>
                            {pollData.options.map((option, index) => (
                                <View key={index} style={[styles.pollOption, { borderColor: colors.border }]}>
                                    <Text style={[styles.pollOptionText, { color: colors.text }]}>{option}</Text>
                                </View>
                            ))}
                            <TouchableOpacity onPress={removePoll} style={styles.removePollButton}>
                                <Text style={[styles.removePollText, { color: colors.icon }]}>Remove poll</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Poll Creator */}
                    {showPollCreator && (
                        <View style={styles.pollCreator}>
                            <TextInput
                                style={[styles.pollQuestionInput, { color: colors.text, borderColor: colors.border }]}
                                placeholder="Ask a question..."
                                placeholderTextColor={colors.icon}
                                value={pollQuestion}
                                onChangeText={setPollQuestion}
                            />
                            {pollOptions.map((option, index) => (
                                <View key={index} style={styles.pollOptionRow}>
                                    <View style={[styles.pollOptionInput, { borderColor: colors.border }]}>
                                        <Text style={[styles.pollCircle, { color: colors.text }]}>{String.fromCharCode(65 + index)}</Text>
                                        <TextInput
                                            style={[styles.pollOptionTextInput, { color: colors.text }]}
                                            placeholder={`Option ${index + 1}`}
                                            placeholderTextColor={colors.icon}
                                            value={option}
                                            onChangeText={(value) => updatePollOption(index, value)}
                                        />
                                    </View>
                                    {pollOptions.length > 2 && (
                                        <TouchableOpacity onPress={() => removePollOption(index)}>
                                            <Ionicons name="close" size={20} color={colors.icon} />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            ))}
                            <View style={styles.pollActions}>
                                {pollOptions.length < 4 && (
                                    <TouchableOpacity onPress={addPollOption} style={styles.addOptionButton}>
                                        <Ionicons name="add" size={20} color={colors.icon} />
                                        <Text style={[styles.addOptionText, { color: colors.icon }]}>Add option</Text>
                                    </TouchableOpacity>
                                )}
                                <View style={styles.pollButtons}>
                                    <TouchableOpacity onPress={cancelPoll} style={[styles.pollButton, { borderColor: colors.icon }]}>
                                        <Text style={[styles.pollButtonText, { color: colors.icon }]}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={createPoll} style={styles.pollButton}>
                                        <Text style={styles.pollButtonText}>Create</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Emoji Picker */}
                    {showEmojiPicker && (
                        <View style={[styles.emojiPicker, { borderColor: colors.border }]}>
                            {/* Category tabs */}
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emojiCategoryRow}>
                                {emojiCategories.map((category) => (
                                    <TouchableOpacity
                                        key={category.id}
                                        style={[
                                            styles.emojiCategoryButton,
                                            activeEmojiCategory === category.id && styles.emojiCategoryButtonActive
                                        ]}
                                        onPress={() => setActiveEmojiCategory(category.id)}>
                                        <Text style={styles.emojiCategoryIcon}>{category.icon}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                            {/* Emoji grid */}
                            <ScrollView showsVerticalScrollIndicator={false} style={styles.emojiGrid}>
                                <View style={styles.emojiGridContent}>
                                    {getCurrentEmojis().map((emoji, index) => (
                                        <TouchableOpacity
                                            key={index}
                                            style={styles.emojiGridButton}
                                            onPress={() => insertEmoji(emoji)}>
                                            <Text style={styles.emojiGridText}>{emoji}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </ScrollView>
                        </View>
                    )}

                    {/* Hashtag Picker */}
                    {showHashtagPicker && (
                        <View style={[styles.hashtagPicker, { borderColor: colors.border }]}>
                            <View style={styles.hashtagHeader}>
                                <Text style={[styles.hashtagTitle, { color: colors.text }]}>Trending Hashtags</Text>
                                <TouchableOpacity onPress={() => setShowHashtagPicker(false)}>
                                    <Ionicons name="close" size={20} color={colors.icon} />
                                </TouchableOpacity>
                            </View>
                            <ScrollView showsVerticalScrollIndicator={false} style={styles.hashtagList}>
                                {trendingHashtags.map((item, index) => (
                                    <TouchableOpacity
                                        key={index}
                                        style={[styles.hashtagItem, { borderBottomColor: colors.border }]}
                                        onPress={() => insertHashtag(item.tag)}>
                                        <View style={styles.hashtagIconContainer}>
                                            <Ionicons name="flash-outline" size={18} color={colors.icon} />
                                        </View>
                                        <View style={styles.hashtagInfo}>
                                            <Text style={[styles.hashtagTag, { color: colors.text }]}>#{item.tag}</Text>
                                            <Text style={[styles.hashtagCount, { color: colors.icon }]}>{item.posts} posts</Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    {/* Show hashtag hint when typing # */}
                    {!showHashtagPicker && threadContent.includes('#') && (
                        <TouchableOpacity 
                            style={styles.hashtagHint}
                            onPress={() => setShowHashtagPicker(true)}>
                            <Ionicons name="add-circle-outline" size={16} color={colors.icon} />
                            <Text style={[styles.hashtagHintText, { color: colors.icon }]}>
                                View trending hashtags
                            </Text>
                        </TouchableOpacity>
                    )}

                    {mediaFiles.length > 0 && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaPreviewContainer}>
                            {mediaFiles.map((file, index) => (
                                <View key={index} style={styles.mediaWrapper}>
                                    <Image source={{ uri: file.uri }} style={styles.previewImage} />
                                    <TouchableOpacity
                                        style={styles.deleteIconContainer}
                                        onPress={() => removeImage(index)}>
                                        <View style={styles.deleteButton}>
                                            <Ionicons name="close" size={16} color="white" />
                                        </View>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </ScrollView>
                    )}
                </View>
            </View>

            <View style={styles.toolbar}>
                <View style={styles.iconRow}>
                    <TouchableOpacity style={styles.iconButton} onPress={() => selectImage('library')}>
                        <Ionicons name="images-outline" size={22} color={colors.icon} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconButton} onPress={() => selectImage('camera')}>
                        <Ionicons name="camera-outline" size={22} color={colors.icon} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconButton} onPress={() => selectImage('gif')}>
                        <MaterialIcons name="gif-box" size={22} color={colors.icon} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconButton} onPress={() => setShowPollCreator(true)}>
                        <MaterialIcons name="poll" size={22} color={colors.icon} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconButton} onPress={() => setShowHashtagPicker(true)}>
                        <MaterialIcons name="tag" size={22} color={colors.icon} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconButton} onPress={() => setShowEmojiPicker(!showEmojiPicker)}>
                        <Ionicons name="happy-outline" size={22} color={colors.icon} />
                    </TouchableOpacity>
                </View>
                <View style={styles.rightSection}>
                    <TouchableOpacity
                        style={[styles.postButton, isPostButtonDisabled && styles.postButtonDisabled]}
                        onPress={handleSubmit}
                        disabled={isPostButtonDisabled}>
                        {isPosting ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Ionicons name="arrow-up" size={20} color={isPostButtonDisabled ? colors.icon : '#fff'} />
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {Platform.OS === 'ios' && (
                <InputAccessoryView nativeID={inputAccessoryViewID}>
                    <View style={[styles.keyboardAccessory, { backgroundColor: colors.secondary, borderTopColor: colors.border }]}>
                        <Text style={[styles.keyboardAccessoryText, { color: colors.icon }]}>
                            {isReply ? 'Anyone can reply and quote' : 'Profiles that you follow can reply and quote'}
                        </Text>
                        <TouchableOpacity
                            style={[styles.postButton, isPostButtonDisabled && styles.postButtonDisabled]}
                            onPress={handleSubmit}
                            disabled={isPostButtonDisabled}>
                            {isPosting ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Ionicons name="arrow-up" size={20} color={isPostButtonDisabled ? colors.icon : '#fff'} />
                            )}
                        </TouchableOpacity>
                    </View>
                </InputAccessoryView>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 16,
        paddingBottom: 8,
    },
    topRow: {
        flexDirection: 'row',
        gap: 12,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    centerContainer: {
        flex: 1,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    name: {
        fontSize: 16,
        fontWeight: '600',
    },
    username: {
        fontSize: 15,
    },
    replyingTo: {
        fontSize: 14,
        color: '#6B6B6B',
    },
    input: {
        fontSize: 16,
        minHeight: 24,
        maxHeight: 120,
        padding: 0,
        marginTop: 4,
    },
    mediaPreviewContainer: {
        marginTop: 12,
    },
    mediaWrapper: {
        position: 'relative',
        marginRight: 12,
    },
    previewImage: {
        width: 260,
        height: 320,
        borderRadius: 16,
    },
    deleteIconContainer: {
        position: 'absolute',
        top: 12,
        right: 12,
    },
    deleteButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    toolbar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderColor: '#DBDBDB',
    },
    iconRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    rightSection: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconButton: {
        padding: 8,
    },
    postButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0095F6',
    },
    postButtonDisabled: {
        backgroundColor: 'rgba(0, 149, 246, 0.5)',
    },
    keyboardAccessory: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    keyboardAccessoryText: {
        fontSize: 14,
    },
    // Poll styles
    pollContainer: {
        marginTop: 12,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#DBDBDB',
    },
    pollQuestion: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
    },
    pollOption: {
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.03)',
    },
    pollOptionText: {
        fontSize: 14,
    },
    removePollButton: {
        marginTop: 8,
    },
    removePollText: {
        fontSize: 14,
    },
    pollCreator: {
        marginTop: 12,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#DBDBDB',
    },
    pollQuestionInput: {
        fontSize: 16,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 12,
    },
    pollOptionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    pollOptionInput: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
    },
    pollCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#DBDBDB',
        textAlign: 'center',
        textAlignVertical: 'center',
        marginRight: 8,
        fontSize: 12,
    },
    pollOptionTextInput: {
        flex: 1,
        fontSize: 14,
    },
    pollActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 12,
    },
    addOptionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
    },
    addOptionText: {
        fontSize: 14,
        marginLeft: 4,
    },
    pollButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    pollButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#0095F6',
    },
    pollButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    // Menu styles
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    menuButton: {
        padding: 4,
    },
    menuOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-start',
        alignItems: 'flex-end',
        paddingTop: 60,
        paddingRight: 16,
    },
    menuContainer: {
        width: 200,
        borderRadius: 12,
        paddingVertical: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12,
    },
    menuItemText: {
        fontSize: 16,
    },
    menuDivider: {
        height: 1,
        marginVertical: 4,
    },
    // Emoji picker styles
    emojiPicker: {
        marginTop: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#DBDBDB',
        overflow: 'hidden',
    },
    emojiCategoryRow: {
        flexDirection: 'row',
        paddingVertical: 8,
        paddingHorizontal: 4,
        borderBottomWidth: 1,
        borderBottomColor: '#DBDBDB',
    },
    emojiCategoryButton: {
        padding: 8,
        marginHorizontal: 4,
        borderRadius: 8,
    },
    emojiCategoryButtonActive: {
        backgroundColor: 'rgba(0, 149, 246, 0.1)',
    },
    emojiCategoryIcon: {
        fontSize: 20,
    },
    emojiGrid: {
        maxHeight: 200,
    },
    emojiGridContent: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 8,
    },
    emojiGridButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emojiGridText: {
        fontSize: 24,
    },
    emojiButton: {
        padding: 4,
    },
    emojiText: {
        fontSize: 24,
    },
    // Hashtag styles
    hashtagContainer: {
        marginTop: 8,
    },
    hashtagHint: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        gap: 4,
    },
    hashtagHintText: {
        fontSize: 14,
    },
    hashtagPicker: {
        marginTop: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#DBDBDB',
        maxHeight: 300,
        overflow: 'hidden',
    },
    hashtagHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#DBDBDB',
    },
    hashtagTitle: {
        fontSize: 16,
        fontWeight: '600',
    },
    hashtagList: {
        maxHeight: 250,
    },
    hashtagItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    hashtagIconContainer: {
        marginRight: 12,
    },
    hashtagInfo: {
        flex: 1,
    },
    hashtagTag: {
        fontSize: 14,
        fontWeight: '500',
    },
    hashtagCount: {
        fontSize: 12,
        marginTop: 2,
    },
});

export default ThreadComposer;
