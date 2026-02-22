import Thread from '@/components/Thread';
import { api } from '@/convex/_generated/api';
import { useThemeColors } from '@/hooks/useThemeColor';
import { usePaginatedQuery } from 'convex/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type TabType = 'saved' | 'liked';

const Page = () => {
    const [activeTab, setActiveTab] = useState<TabType>('saved');
    const colors = useThemeColors();
    
    // State to hold filtered results
    const [savedPosts, setSavedPosts] = useState<any[]>([]);
    const [likedPosts, setLikedPosts] = useState<any[]>([]);
    
    // Track removed post IDs (for instant UI update on unlike)
    const [removedLikedIds, setRemovedLikedIds] = useState<Set<string>>(new Set());
    
    // Key to force refresh when switching tabs
    const [tabKey, setTabKey] = useState(0);
    
    // Always run both queries - they auto-update on mutations
    const savedResults = usePaginatedQuery(
        api.messages.getSavedPosts,
        {},
        { initialNumItems: 20 },
    );
    
    const likedResults = usePaginatedQuery(
        api.messages.getLikedPosts,
        {},
        { initialNumItems: 20 },
    );
    
    // Update local state when query results change - but respect removed posts
    useEffect(() => {
        if (savedResults.results) {
            const filtered = savedResults.results.filter((p): p is any => p !== null);
            setSavedPosts(filtered);
            console.log("[Favorites] Saved posts:", filtered.length);
        }
    }, [savedResults.results]);
    
    useEffect(() => {
        if (likedResults.results) {
            // Filter out removed posts
            const filtered = likedResults.results
                .filter((p): p is any => p !== null)
                .filter(p => !removedLikedIds.has(p._id.toString()));
            setLikedPosts(filtered);
            console.log("[Favorites] Liked posts (after filter):", filtered.length, "removed:", removedLikedIds.size);
        }
    }, [likedResults.results, removedLikedIds]);
    
    const results = activeTab === 'saved' ? savedPosts : likedPosts;
    const status = activeTab === 'saved' ? savedResults.status : likedResults.status;
    const loadMore = activeTab === 'saved' ? savedResults.loadMore : likedResults.loadMore;
    
    const ref = useRef<FlatList>(null);

    // Handle tab change
    const handleTabChange = (tab: TabType) => {
        if (tab !== activeTab) {
            setTabKey(k => k + 1);
            setActiveTab(tab);
            // Clear removed IDs when switching tabs
            if (tab === 'liked') {
                setRemovedLikedIds(new Set());
            }
        }
    };

    // Handle like toggle - track removed posts
    const handleLikeToggle = useCallback((isLiked: boolean, threadId: any) => {
        console.log("[Favorites] Like toggle:", isLiked, threadId);
        
        // When unliking in Liked tab, add to removed set
        if (activeTab === 'liked' && !isLiked) {
            const threadIdStr = threadId.toString();
            setRemovedLikedIds(prev => {
                const newSet = new Set(prev);
                newSet.add(threadIdStr);
                console.log("[Favorites] Added to removed set:", threadIdStr);
                return newSet;
            });
            // Also filter from local state immediately
            setLikedPosts(prev => prev.filter(p => p._id.toString() !== threadIdStr));
        }
    }, [activeTab]);

    const renderItem = ({ item }: { item: any }) => {
        if (!item) return null;
        return (
            <>
                <Thread 
                    thread={item} 
                    onLikeToggle={handleLikeToggle}
                />
                <View style={[styles.separator, { backgroundColor: colors.border }]} />
            </>
        );
    };

    const renderEmpty = () => (
        <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
            <Text style={[styles.emptyText, { color: colors.text }]}>
                {activeTab === 'saved' ? 'No saved posts yet' : 'No liked posts yet'}
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.icon }]}>
                {activeTab === 'saved' 
                    ? 'Posts you save will appear here' 
                    : 'Posts you like will appear here'}
            </Text>
        </View>
    );

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }} key={tabKey}>
            {/* Header with Tabs */}
            <View style={[styles.headerContainer, { backgroundColor: colors.background }]}>
                {/* Tab Buttons */}
                <View style={[styles.tabContainer, { borderBottomColor: colors.border }]}>
                    <TouchableOpacity 
                        style={[styles.tab, activeTab === 'saved' && styles.activeTab]}
                        onPress={() => handleTabChange('saved')}
                    >
                        <Text style={[
                            styles.tabText, 
                            { color: activeTab === 'saved' ? colors.tint : colors.icon }
                        ]}>
                            Saved
                        </Text>
                        {activeTab === 'saved' && (
                            <View style={[styles.activeTabIndicator, { backgroundColor: colors.tint }]} />
                        )}
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                        style={[styles.tab, activeTab === 'liked' && styles.activeTab]}
                        onPress={() => handleTabChange('liked')}
                    >
                        <Text style={[
                            styles.tabText, 
                            { color: activeTab === 'liked' ? colors.tint : colors.icon }
                        ]}>
                            Liked
                        </Text>
                        {activeTab === 'liked' && (
                            <View style={[styles.activeTabIndicator, { backgroundColor: colors.tint }]} />
                        )}
                    </TouchableOpacity>
                </View>
            </View>
            
            <FlatList
                ref={ref}
                data={results}
                renderItem={renderItem}
                keyExtractor={(item) => item?._id?.toString() ?? Math.random().toString()}
                onEndReached={() => loadMore(20)}
                onEndReachedThreshold={0.5}
                contentContainerStyle={{ backgroundColor: colors.background, minHeight: '100%' }}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={renderEmpty}
                ListFooterComponent={
                    status === 'CanLoadMore' ? (
                        <View style={[styles.loadingFooter, { backgroundColor: colors.background }]}>
                        </View>
                    ) : null
                }
            />
        </View>
    );
};

export default Page;

const styles = StyleSheet.create({
    headerContainer: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 8,
    },
    tabContainer: {
        flexDirection: 'row',
        borderBottomWidth: 1,
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        position: 'relative',
    },
    activeTab: {
        // No additional style needed
    },
    tabText: {
        fontSize: 16,
        fontWeight: '600',
    },
    activeTabIndicator: {
        position: 'absolute',
        bottom: 0,
        left: '20%',
        right: '20%',
        height: 3,
        borderRadius: 2,
    },
    separator: {
        height: 1,
        marginLeft: 72,
    },
    loadingFooter: {
        padding: 20,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
        paddingHorizontal: 32,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 8,
    },
    emptySubtext: {
        fontSize: 14,
        textAlign: 'center',
    },
});
