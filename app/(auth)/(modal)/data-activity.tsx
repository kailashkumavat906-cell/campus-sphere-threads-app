import { useThemeContext } from '@/hooks/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ActivityOptionProps {
  title: string;
  subtitle: string;
  icon: string;
  onPress: () => void;
  colors: any;
}

function ActivityOption({ title, subtitle, icon, onPress, colors }: ActivityOptionProps) {
  return (
    <TouchableOpacity
      style={styles.option}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: colors.icon + '20' }]}>
        <Ionicons name={icon as any} size={22} color={colors.text} />
      </View>
      <View style={styles.optionContent}>
        <Text style={[styles.optionTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.optionSubtitle, { color: colors.icon }]}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.icon} />
    </TouchableOpacity>
  );
}

export default function DataActivityScreen() {
  const { top } = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useThemeContext();

  const handleGoBack = useCallback(() => {
    router.dismiss();
  }, [router]);

  const handleSearchHistory = useCallback(() => {
    // @ts-ignore
    router.push('/(auth)/(modal)/search-history');
  }, [router]);

  const handleLoginActivity = useCallback(() => {
    // @ts-ignore
    router.push('/(auth)/(modal)/login-activity');
  }, [router]);

  const handleAccountUsage = useCallback(() => {
    // @ts-ignore
    router.push('/(auth)/(modal)/account-usage');
  }, [router]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Data & Activity</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.icon }]}>Activity</Text>
          
          <ActivityOption
            title="Search History"
            subtitle="Profiles you've searched for"
            icon="search"
            onPress={handleSearchHistory}
            colors={colors}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.icon }]}>Account</Text>
          
          <ActivityOption
            title="Login Activity"
            subtitle="Devices where your account is logged in"
            icon="device-mobile"
            onPress={handleLoginActivity}
            colors={colors}
          />
          
          <ActivityOption
            title="Account Usage"
            subtitle="Your account statistics"
            icon="stats-chart"
            onPress={handleAccountUsage}
            colors={colors}
          />
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
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
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  optionSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  bottomPadding: {
    height: 32,
  },
});
