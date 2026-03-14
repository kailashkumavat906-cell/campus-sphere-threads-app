import Thread from '@/components/Thread';
import ThreadComposer from '@/components/ThreadComposer';
import { api } from '@/convex/_generated/api';
import { useThemeColors } from '@/hooks/useThemeColor';
import { Ionicons } from '@expo/vector-icons';
import { usePaginatedQuery, useQuery } from 'convex/react';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const Page = () => {
    const [feedType, setFeedType] = useState<"foryou" | "following">("foryou");
    const [showFilter, setShowFilter] = useState(false);
    
    const { results, status, loadMore } = usePaginatedQuery(
        api.messages.getThreads as any,
        { userId: undefined, filterType: feedType },
        { initialNumItems: 20 },
    );
    
    // Get unread notification count
    const unreadCount = useQuery(api.notifications.getUnreadNotificationCount) ?? 0;
    
    const ref = useRef<FlatList>(null);
    const colors = useThemeColors();

    const handleFilterChange = (type: "foryou" | "following") => {
        setFeedType(type);
        setShowFilter(false);
    };

    const renderItem = ({ item }: { item: typeof results[0] }) => {
        if (!item) return null;
        return (
            <>
                <Thread thread={item as any} />
                <View style={[styles.separator, { backgroundColor: colors.border }]} />
            </>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
            {/* Custom Header */}
            <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                {/* Menu Icon */}
                <Pressable 
                    onPress={() => setShowFilter(true)} 
                    style={styles.menuButton}
                >
                    <Ionicons name="list" size={24} color={colors.text} />
                </Pressable>
                
                {/* Title */}
                <Text style={[styles.headerTitle, { color: colors.text }]}>
                    CampusSphere
                </Text>
                
                {/* Notification Bell */}
                <Pressable 
                    style={styles.notificationButton}
                    onPress={() => router.push("/(auth)/(modal)/notifications")}
                >
                    <View style={{ position: 'relative' }}>
                        <Ionicons 
                            name="notifications-outline" 
                            size={24} 
                            color={colors.text} 
                        />
                        {unreadCount > 0 && (
                            <View style={{
                                position: 'absolute',
                                top: -4,
                                right: -4,
                                backgroundColor: '#ff3b30',
                                borderRadius: 10,
                                paddingHorizontal: 5,
                                minWidth: 18,
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}>
                                <Text style={{
                                    color: 'white',
                                    fontSize: 10,
                                    fontWeight: 'bold'
                                }}>
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </Text>
                            </View>
                        )}
                    </View>
                </Pressable>
            </View>

            {/* Filter Modal */}
            <Modal
                visible={showFilter}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowFilter(false)}
            >
                <Pressable 
                    style={styles.modalOverlay} 
                    onPress={() => setShowFilter(false)}
                >
                    <View style={[styles.filterDropdown, { backgroundColor: colors.background, borderColor: colors.border }]}>
                        <Pressable 
                            style={[styles.filterOption, feedType === "foryou" && { backgroundColor: colors.tint + '20' }]}
                            onPress={() => handleFilterChange("foryou")}
                        >
                            <Text style={[
                                styles.filterText, 
                                { color: feedType === "foryou" ? colors.tint : colors.text }
                            ]}>
                                For You
                            </Text>
                            {feedType === "foryou" && (
                                <Ionicons name="checkmark" size={20} color={colors.tint} />
                            )}
                        </Pressable>
                        <Pressable 
                            style={[styles.filterOption, feedType === "following" && { backgroundColor: colors.tint + '20' }]}
                            onPress={() => handleFilterChange("following")}
                        >
                            <Text style={[
                                styles.filterText, 
                                { color: feedType === "following" ? colors.tint : colors.text }
                            ]}>
                                Following
                            </Text>
                            {feedType === "following" && (
                                <Ionicons name="checkmark" size={20} color={colors.tint} />
                            )}
                        </Pressable>
                    </View>
                </Pressable>
            </Modal>

            <FlatList
                ref={ref}
                data={results}
                renderItem={renderItem}
                keyExtractor={(item) => item?._id ?? Math.random().toString()}
                onEndReached={() => loadMore(20)}
                onEndReachedThreshold={0.5}
                ListHeaderComponent={
                    <View style={[styles.headerContainer, { backgroundColor: colors.background }]}>
                        <ThreadComposer isPreview />
                        <View style={[styles.headerSeparator, { backgroundColor: colors.border }]} />
                    </View>
                }
                contentContainerStyle={{ backgroundColor: colors.background, minHeight: '100%' }}
                showsVerticalScrollIndicator={false}
                ListFooterComponent={
                    status === 'CanLoadMore' ? (
                        <View style={[styles.loadingFooter, { backgroundColor: colors.background }]}>
                        </View>
                    ) : null
                }
            />
        </SafeAreaView>
    );
};

export default Page;

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 60,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
    },
    menuButton: {
        padding: 8,
        width: 40,
    },
    headerTitle: {
        fontSize: 23,
        fontWeight: '700',
        textAlign: 'center',
    },
    notificationButton: {
        padding: 8,
        width: 40,
        alignItems: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-start',
        paddingTop: 50,
        paddingLeft: 16,
    },
    filterDropdown: {
        borderRadius: 12,
        overflow: 'hidden',
        width: 160,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    filterOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    filterText: {
        fontSize: 16,
        fontWeight: '500',
    },
    headerContainer: {
        // backgroundColor set dynamically
    },
    headerSeparator: {
        height: 1,
        // backgroundColor set dynamically
    },
    separator: {
        height: 1,
        marginLeft: 72,
        // backgroundColor set dynamically
    },
    loadingFooter: {
        padding: 20,
        // backgroundColor set dynamically
    },
});
