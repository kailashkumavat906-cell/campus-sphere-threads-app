import Thread from '@/components/Thread';
import ThreadComposer from '@/components/ThreadComposer';
import { api } from '@/convex/_generated/api';
import { useThemeColors } from '@/hooks/useThemeColor';
import { usePaginatedQuery } from 'convex/react';
import { useRef } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

const Page = () => {
    const { results, status, loadMore } = usePaginatedQuery(
        api.messages.getThreads,
        { userId: undefined },
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

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
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
        </View>
    );
};

export default Page;

const styles = StyleSheet.create({
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
