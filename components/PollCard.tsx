import { useThemeContext } from '@/hooks/ThemeContext';
import React, { useEffect, useMemo, useRef } from 'react';
import {
    Animated,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

// Sky blue color for selected option (#38BDF8)
const SKY_BLUE = '#38BDF8';

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
    selectedOption?: string | null; // Optional: pass directly from database query
    onVote: (optionId: string) => void;
    creator?: {
        name: string;
        username: string;
        avatar?: string;
    };
    timestamp?: string;
    isMultipleChoice?: boolean;
};

export const PollCard = ({
    question,
    options,
    votes,
    currentUserId,
    selectedOption: selectedOptionProp,
    onVote,
    creator,
    timestamp,
    isMultipleChoice = false,
}: PollCardProps) => {
    const { colors } = useThemeContext();
    
    // Use passed selectedOption if provided, otherwise compute from votes array
    // The selectedOptionProp comes directly from the database query (userVote)
    // which correctly uses the Convex user ID, avoiding Clerk ID mismatch
    const selectedOption = selectedOptionProp !== undefined 
        ? selectedOptionProp 
        : useMemo(() => {
            return votes.find(v => v.userId === currentUserId)?.optionId || null;
        }, [votes, currentUserId]);
    
    // Get all user votes (for multiple choice)
    const userVotes = useMemo(() => {
        return votes.filter(v => v.userId === currentUserId).map(v => v.optionId);
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
    
    // Animation refs for each option
    const animatedWidths = useRef<Record<string, Animated.Value>>({});
    
    // Initialize animations for each option
    useEffect(() => {
        options.forEach(option => {
            if (!animatedWidths.current[option.id]) {
                animatedWidths.current[option.id] = new Animated.Value(0);
            }
        });
    }, [options]);
    
    // Animate progress bar when percentage changes
    const animateProgressBar = (optionId: string, toValue: number) => {
        if (!animatedWidths.current[optionId]) {
            animatedWidths.current[optionId] = new Animated.Value(0);
        }
        Animated.timing(animatedWidths.current[optionId], {
            toValue,
            duration: 500,
            useNativeDriver: false,
        }).start();
    };
    
    // Trigger animation when showing results
    useEffect(() => {
        if (totalVotes > 0) {
            options.forEach(option => {
                const percentage = getPercentage(option.id);
                animateProgressBar(option.id, percentage);
            });
        }
    }, [totalVotes, votes]);
    
    // Handle option press - toggle selection
    const handleOptionPress = (optionId: string) => {
        console.log('Option clicked:', optionId);
        
        // For voting, we just call the onVote callback
        // The database will handle the vote state and return the updated value
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
            backgroundColor: isDark ? '#1E1E1E' : '#F5F8FA',
        },
        optionSelected: {
            borderColor: SKY_BLUE,
            backgroundColor: SKY_BLUE,
        },
        radioButton: {
            borderColor: isDark ? '#555555' : '#99AAB5',
        },
        radioButtonSelected: {
            borderColor: '#FFFFFF',
        },
        radioButtonInner: {
            backgroundColor: '#FFFFFF',
        },
        optionText: {
            color: colors.text,
        },
        optionTextSelected: {
            color: '#FFFFFF',
        },
        percentage: {
            color: isDark ? '#8899A6' : '#536471',
        },
        percentageSelected: {
            color: '#FFFFFF',
        },
        footer: {
            borderTopColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
        },
        voteCount: {
            color: isDark ? '#8899A6' : '#536471',
        },
        progressBar: {
            backgroundColor: 'rgba(255, 255, 255, 0.25)',
        },
    };
    
    return (
        <View
            style={[
                styles.container,
                dynamicStyles.container,
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
                    const isSelected = selectedOption === option.id;
                    const percentage = getPercentage(option.id);
                    const optionVotes = votesPerOption[option.id] || 0;
                    
                    return (
                        <TouchableOpacity
                            key={option.id}
                            style={[
                                styles.option,
                                {
                                    backgroundColor: isSelected ? SKY_BLUE : (isDark ? '#1E1E1E' : '#F5F8FA'),
                                    borderColor: isSelected ? SKY_BLUE : (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'),
                                },
                            ]}
                            onPress={() => handleOptionPress(option.id)}
                            activeOpacity={0.7}
                        >
                            {/* Progress Bar Background */}
                            {showResults && (
                                <Animated.View
                                    pointerEvents="none"
                                    style={[
                                        styles.progressBar,
                                        {
                                            width: animatedWidths.current[option.id] 
                                                ? animatedWidths.current[option.id].interpolate({
                                                    inputRange: [0, 100],
                                                    outputRange: ['0%', '100%'],
                                                })
                                                : `${percentage}%`,
                                            backgroundColor: isSelected 
                                                ? 'rgba(255, 255, 255, 0.3)' 
                                                : 'rgba(255, 255, 255, 0.1)',
                                        },
                                    ]}
                                />
                            )}
                            
                            {/* Option Content */}
                            <View style={styles.optionContent}>
                                <View style={styles.optionLeft}>
                                    {/* Radio Button Circle - Filled when selected, empty when not */}
                                    <View
                                        style={[
                                            styles.radioButton,
                                            {
                                                borderColor: isSelected ? '#FFFFFF' : (isDark ? '#555555' : '#99AAB5'),
                                                backgroundColor: isSelected ? '#FFFFFF' : 'transparent',
                                            },
                                        ]}
                                    >
                                        {/* Inner circle only shows when selected */}
                                        {isSelected && (
                                            <View style={[styles.radioButtonInner, { backgroundColor: SKY_BLUE }]} />
                                        )}
                                    </View>
                                    <Text
                                        style={[
                                            styles.optionText,
                                            {
                                                color: isSelected ? '#FFFFFF' : colors.text,
                                                fontWeight: isSelected ? '600' : '500',
                                            },
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
                                                {
                                                    color: isSelected ? '#FFFFFF' : (isDark ? '#8899A6' : '#536471'),
                                                    fontWeight: isSelected ? '700' : '600',
                                                },
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
                        {totalVotes} vote{totalVotes !== 1 ? 's' : ''} • {totalVotes === 0 ? 'Be the first to vote' : isMultipleChoice ? 'Multiple choice' : 'Final results'}
                    </Text>
                </View>
            )}
        </View>
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
        borderWidth: 1.5,
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
        paddingVertical: 14,
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
        marginRight: 14,
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
        fontWeight: '700',
        color: '#FFFFFF',
    },
    percentageContainer: {
        minWidth: 50,
        alignItems: 'flex-end',
    },
    percentage: {
        fontSize: 15,
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
        fontSize: 14,
    },
});

export default PollCard;
