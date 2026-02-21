import Thread from '@/components/Thread';
import { api } from '@/convex/_generated/api';
import { useThemeColors } from '@/hooks/useThemeColor';
import { usePaginatedQuery } from 'convex/react';
import { useRef } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const Page = () => {
    const { top } = useSafeAreaInsets();
    const { results, status, loadMore } = usePaginatedQuery(
        api.messages.getSavedPosts,
        {},
        { initialNumItems: 20 },
    );
    const ref = useRef<FlatList>(null);
    const colors = useThemeColors();

    const renderItem = ({ item }: { item: typeof results[0] }) => {
        if (!item) return null;
        return (
            <>
                <Thread thread={item as any} />
                <View style={[styles.separator, { backgroundColor: colors.border }]} />
            </>
        );
    };

    const renderEmpty = () => (
        <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
            <Text style={[styles.emptyText, { color: colors.text }]}>No saved posts yet</Text>
            <Text style={[styles.emptySubtext, { color: colors.icon }]}>
                Posts you save will appear here
            </Text>
        </View>
    );

    return (
        <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: top }}>
            <FlatList
                ref={ref}
                data={results}
                renderItem={renderItem}
                keyExtractor={(item) => item?._id ?? Math.random().toString()}
                onEndReached={() => loadMore(20)}
                onEndReachedThreshold={0.5}
                ListHeaderComponent={
                    <View style={[styles.headerContainer, { backgroundColor: colors.background }]}>
                        <Text style={[styles.headerTitle, { color: colors.text }]}>Saved</Text>
                        <View style={[styles.headerSeparator, { backgroundColor: colors.border }]} />
                    </View>
                }
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
        paddingVertical: 12,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    headerSeparator: {
        height: 1,
        marginTop: 12,
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
