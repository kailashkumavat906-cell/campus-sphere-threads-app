import { useThemeContext } from '@/hooks/ThemeContext';
import React, { useEffect, useMemo, useRef } from 'react';
import {
    Animated,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

type PollOption = {
    id: string;
    text: string;
};

type Vote = {
    userId: string;
    optionId: string;
};

type PollCardProps = {
    pollId: string;
    question: string;
    options: PollOption[];
    votes: Vote[];
    currentUserId: string;
    onVote: (optionId: string) => void;
    creator?: {
        name: string;
        username: string;
        avatar?: string;
    };
    timestamp?: string;
};

export const PollCard = ({
    question,
    options,
    votes,
    currentUserId,
    onVote,
    creator,
    timestamp,
}: PollCardProps) => {
    const { colors } = useThemeContext();
    
    // Get current user's vote
    const userVote = useMemo(() => {
        return votes.find(v => v.userId === currentUserId)?.optionId || null;
    }, [votes, currentUserId]);
    
    // Calculate total votes
    const totalVotes = votes.length;
    
    // Calculate votes per option
    const votesPerOption = useMemo(() => {
        const counts: Record<string, number> = {};
        options.forEach(opt => counts[opt.id] = 0);
        votes.forEach(v => {
            if (counts[v.optionId] !== undefined) {
                counts[v.optionId]++;
            }
        });
        return counts;
    }, [votes, options]);
    
    // Calculate percentage for an option
    const getPercentage = (optionId: string): number => {
        if (totalVotes === 0) return 0;
        const count = votesPerOption[optionId] || 0;
        return Math.round((count / totalVotes) * 100);
    };
    
    // Animation refs
    const containerFade = useRef(new Animated.Value(0)).current;
    const containerSlide = useRef(new Animated.Value(20)).current;
    
    // Initialize animations
    useEffect(() => {
        Animated.parallel([
            Animated.timing(containerFade, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }),
            Animated.timing(containerSlide, {
                toValue: 0,
                duration: 400,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);
    
    // Handle option press
    const handleOptionPress = (optionId: string) => {
        console.log('Option clicked:', optionId);
        onVote(optionId);
    };
    
    // Show results only when there are votes
    const showResults = totalVotes > 0;
    
    // Dynamic styles based on theme
    const isDark = colors.background === '#000000';
    
    const dynamicStyles = {
        container: {
            backgroundColor: colors.background,
            borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
        },
        creatorName: {
            color: colors.text,
        },
        creatorUsername: {
            color: isDark ? '#AAAAAA' : '#666666',
        },
        timestamp: {
            color: isDark ? '#666666' : '#999999',
        },
        question: {
            color: colors.text,
        },
        option: {
            borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
        },
        optionSelected: {
            borderColor: colors.primary,
        },
        radioButton: {
            borderColor: isDark ? '#444444' : '#CCCCCC',
        },
        radioButtonSelected: {
            borderColor: colors.primary,
        },
        radioButtonInner: {
            backgroundColor: colors.primary,
        },
        optionText: {
            color: colors.text,
        },
        percentage: {
            color: isDark ? '#AAAAAA' : '#666666',
        },
        percentageSelected: {
            color: colors.primary,
        },
        footer: {
            borderTopColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
        },
        voteCount: {
            color: isDark ? '#666666' : '#999999',
        },
    };
    
    return (
        <Animated.View
            style={[
                styles.container,
                dynamicStyles.container,
                {
                    opacity: containerFade,
                    transform: [{ translateY: containerSlide }],
                },
            ]}
        >
            {/* Creator Info */}
            {creator && (
                <View style={styles.creatorRow}>
                    {creator.avatar ? (
                        <Animated.Image
                            source={{ uri: creator.avatar }}
                            style={styles.avatar}
                        />
                    ) : (
                        <View style={[styles.avatar, { backgroundColor: isDark ? '#2A2A2A' : '#E5E5EA' }]}>
                            <Text style={[styles.avatarInitial, { color: colors.text }]}>
                                {creator.name.charAt(0).toUpperCase()}
                            </Text>
                        </View>
                    )}
                    <View>
                        <Text style={[styles.creatorName, dynamicStyles.creatorName]}>
                            {creator.name}
                        </Text>
                        <Text style={[styles.creatorUsername, dynamicStyles.creatorUsername]}>
                            @{creator.username}
                        </Text>
                    </View>
                    {timestamp && (
                        <Text style={[styles.timestamp, dynamicStyles.timestamp]}>
                            {timestamp}
                        </Text>
                    )}
                </View>
            )}
            
            {/* Question */}
            <Text style={[styles.question, dynamicStyles.question]}>
                {question}
            </Text>
            
            {/* Options */}
            <View style={styles.optionsContainer}>
                {options.map((option) => {
                    const isSelected = userVote === option.id;
                    const percentage = getPercentage(option.id);
                    const optionVotes = votesPerOption[option.id] || 0;
                    
                    return (
                        <TouchableOpacity
                            key={option.id}
                            style={[
                                styles.option,
                                dynamicStyles.option,
                                isSelected && dynamicStyles.optionSelected,
                            ]}
                            onPress={() => handleOptionPress(option.id)}
                            activeOpacity={0.8}
                        >
                            {/* Progress Bar Background */}
                            {showResults && (
                                <Animated.View
                                    pointerEvents="none"
                                    style={[
                                        styles.progressBar,
                                        {
                                            width: `${percentage}%`,
                                            backgroundColor: isSelected 
                                                ? `${colors.primary}33` 
                                                : isDark 
                                                    ? 'rgba(255, 255, 255, 0.1)' 
                                                    : 'rgba(0, 0, 0, 0.05)',
                                        },
                                    ]}
                                />
                            )}
                            
                            {/* Option Content */}
                            <View style={styles.optionContent}>
                                <View style={styles.optionLeft}>
                                    {/* Radio Button Circle */}
                                    <View
                                        style={[
                                            styles.radioButton,
                                            dynamicStyles.radioButton,
                                            isSelected && dynamicStyles.radioButtonSelected,
                                        ]}
                                    >
                                        {isSelected && (
                                            <View style={[styles.radioButtonInner, { backgroundColor: colors.primary }]} />
                                        )}
                                    </View>
                                    <Text
                                        style={[
                                            styles.optionText,
                                            dynamicStyles.optionText,
                                            isSelected && styles.optionTextSelected,
                                        ]}
                                    >
                                        {option.text}
                                    </Text>
                                </View>
                                
                                {/* Percentage and Votes */}
                                {showResults && (
                                    <View style={styles.percentageContainer}>
                                        <Text
                                            style={[
                                                styles.percentage,
                                                dynamicStyles.percentage,
                                                isSelected && dynamicStyles.percentageSelected,
                                            ]}
                                        >
                                            {percentage}%
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>
            
            {/* Footer */}
            {showResults && (
                <View style={[styles.footer, dynamicStyles.footer]}>
                    <Text style={[styles.voteCount, dynamicStyles.voteCount]}>
                        {totalVotes} vote{totalVotes !== 1 ? 's' : ''}
                    </Text>
                </View>
            )}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 20,
        padding: 20,
        marginHorizontal: 16,
        marginVertical: 8,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
        borderWidth: 1,
    },
    creatorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarInitial: {
        fontSize: 16,
        fontWeight: '600',
    },
    creatorName: {
        fontSize: 15,
        fontWeight: '600',
    },
    creatorUsername: {
        fontSize: 13,
    },
    timestamp: {
        fontSize: 12,
        marginLeft: 'auto',
    },
    question: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 20,
        lineHeight: 26,
    },
    optionsContainer: {
        gap: 12,
    },
    option: {
        position: 'relative',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        backgroundColor: 'transparent',
    },
    progressBar: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        borderRadius: 16,
    },
    optionContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        position: 'relative',
        zIndex: 1,
    },
    optionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    radioButton: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    radioButtonInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    optionText: {
        fontSize: 15,
        fontWeight: '500',
        flex: 1,
    },
    optionTextSelected: {
        fontWeight: '600',
    },
    percentageContainer: {
        minWidth: 50,
        alignItems: 'flex-end',
    },
    percentage: {
        fontSize: 14,
        fontWeight: '600',
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
    },
    voteCount: {
        fontSize: 13,
    },
});

export default PollCard;
