import CommentComposer from '@/components/CommentComposer';
import { useThemeColors } from '@/hooks/useThemeColor';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ReplyPage = () => {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const colors = useThemeColors();
    const { top } = useSafeAreaInsets();

    if (!id) {
        return null;
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header with Comments title */}
            <View style={[styles.header, { paddingTop: top + 8 }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color={colors.text} />
                    <Text style={[styles.backText, { color: colors.text }]}>Back</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Comments</Text>
                <View style={styles.placeholder} />
            </View>

            {/* Comment Composer with Thread */}
            <CommentComposer threadId={id as any} showThread={true} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    backText: {
        fontSize: 16,
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '600',
    },
    placeholder: {
        width: 40,
    },
});

export default ReplyPage;
