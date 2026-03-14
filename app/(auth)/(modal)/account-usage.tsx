import { api } from '@/convex/_generated/api';
import { useThemeContext } from '@/hooks/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface StatItem {
  label: string;
  value: number;
  icon: string;
  color: string;
}

export default function AccountUsageScreen() {
  const { top } = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useThemeContext();
  
  const accountUsage = useQuery(api.users.getAccountUsage);

  const handleGoBack = useCallback(() => {
    router.dismiss();
  }, [router]);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const stats: StatItem[] = accountUsage ? [
    { label: 'Total Posts', value: accountUsage.totalPosts, icon: 'document-text', color: '#1E88E5' },
    { label: 'Total Likes', value: accountUsage.totalLikes, icon: 'heart', color: '#E91E63' },
    { label: 'Total Comments', value: accountUsage.totalComments, icon: 'chatbubble', color: '#10B981' },
    { label: 'Followers', value: accountUsage.totalFollowers, icon: 'people', color: '#9C27B0' },
    { label: 'Following', value: accountUsage.totalFollowing, icon: 'person-add', color: '#FF9800' },
  ] : [];

  const renderStatItem = (item: StatItem, index: number) => (
    <View 
      key={item.label} 
      style={[styles.statItem, { backgroundColor: colors.background }]}
    >
      <View style={[styles.statIcon, { backgroundColor: item.color + '20' }]}>
        <Ionicons name={item.icon as any} size={22} color={item.color} />
      </View>
      <View style={styles.statContent}>
        <Text style={[styles.statValue, { color: colors.text }]}>
          {item.value}
        </Text>
        <Text style={[styles.statLabel, { color: colors.icon }]}>
          {item.label}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Account Usage</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Content */}
      {accountUsage === undefined ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary || '#1E88E5'} />
        </View>
      ) : (
        <View style={styles.content}>
          {/* Account Info Card */}
          <View style={[styles.accountCard, { backgroundColor: colors.background }]}>
            <View style={styles.accountHeader}>
              <Ionicons name="person-circle" size={48} color={colors.primary || '#1E88E5'} />
              <View style={styles.accountInfo}>
                <Text style={[styles.accountTitle, { color: colors.text }]}>
                  Account Statistics
                </Text>
                <Text style={[styles.accountSubtitle, { color: colors.icon }]}>
                  {accountUsage ? `Member since ${formatDate(accountUsage.accountCreatedAt)}` : ''}
                </Text>
              </View>
            </View>
          </View>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            {stats.map((item, index) => renderStatItem(item, index))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '500',
    textAlign: 'center',
    marginRight: 40,
  },
  headerRight: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
  },
  accountCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountInfo: {
    marginLeft: 12,
  },
  accountTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  accountSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
});
