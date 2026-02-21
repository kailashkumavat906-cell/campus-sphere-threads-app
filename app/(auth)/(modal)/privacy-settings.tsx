import { useThemeContext } from '@/hooks/ThemeContext';
import { usePrivacySettings } from '@/hooks/usePrivacySettings';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Material Design colors
const BLUE_COLOR = '#1E88E5';
const GRAY_COLOR = '#6B7280';

// Animated Switch Component - Android Material Design Style
function AnimatedSwitch({ 
  isEnabled, 
  onToggle,
  size = 'default' 
}: { 
  isEnabled: boolean; 
  onToggle: () => void;
  size?: 'default' | 'small';
}) {
  const animatedValue = useRef(new Animated.Value(isEnabled ? 1 : 0)).current;
  const [currentValue, setCurrentValue] = useState(isEnabled);
  
  const trackWidth = size === 'small' ? 40 : 52;
  const trackHeight = size === 'small' ? 24 : 28;
  const thumbSize = size === 'small' ? 20 : 24;
  const thumbTranslate = size === 'small' ? 18 : 22;

  const handleToggle = () => {
    const newValue = !currentValue;
    setCurrentValue(newValue);
    
    Animated.timing(animatedValue, {
      toValue: newValue ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
    
    onToggle();
  };

  // Interpolate track color from gray to blue
  const trackColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [GRAY_COLOR, BLUE_COLOR],
  });

  // Interpolate thumb position from left to right
  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [2, thumbTranslate],
  });

  return (
    <TouchableOpacity
      style={styles.switchContainer}
      onPress={handleToggle}
      activeOpacity={0.7}
      accessibilityRole="switch"
      accessibilityLabel="Toggle"
      accessibilityValue={{ text: currentValue ? 'On' : 'Off' }}
    >
      <Animated.View style={[
        styles.switchTrack,
        {
          width: trackWidth,
          height: trackHeight,
          backgroundColor: trackColor,
        }
      ]}>
        <Animated.View style={[
          styles.switchThumb,
          {
            width: thumbSize,
            height: thumbSize,
            transform: [{ translateX }],
          }
        ]} />
      </Animated.View>
    </TouchableOpacity>
  );
}

interface PrivacyToggleRowProps {
  title: string;
  subtitle: string;
  icon: string;
  isEnabled: boolean;
  onToggle: () => void;
  colors: any;
}

function PrivacyToggleRow({ title, subtitle, icon, isEnabled, onToggle, colors }: PrivacyToggleRowProps) {
  return (
    <View style={styles.toggleRow}>
      <TouchableOpacity
        style={styles.labelContainer}
        onPress={onToggle}
        accessibilityRole="button"
        activeOpacity={0.7}
      >
        <Ionicons name={icon as any} size={22} color={colors.text} />
        <View style={styles.textContainer}>
          <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.rowSubtitle, { color: colors.icon }]}>{subtitle}</Text>
        </View>
      </TouchableOpacity>
      
      <AnimatedSwitch isEnabled={isEnabled} onToggle={onToggle} />
    </View>
  );
}

interface ClickableRowProps {
  title: string;
  subtitle?: string;
  icon: string;
  onPress: () => void;
  colors: any;
}

function ClickableRow({ title, subtitle, icon, onPress, colors }: ClickableRowProps) {
  return (
    <TouchableOpacity
      style={styles.clickableRow}
      onPress={onPress}
      accessibilityRole="button"
      activeOpacity={0.7}
    >
      <View style={styles.rowContent}>
        <Ionicons name={icon as any} size={22} color={colors.text} />
        <View style={styles.textContainer}>
          <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
          {subtitle && (
            <Text style={[styles.rowSubtitle, { color: colors.icon }]}>{subtitle}</Text>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={22} color={colors.icon} />
    </TouchableOpacity>
  );
}

export default function PrivacySettingsScreen() {
  const { top } = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useThemeContext();
  const { settings, isLoading, toggleSetting } = usePrivacySettings();

  const handleGoBack = useCallback(() => {
    router.dismiss();
  }, [router]);

  const handleBlockedUsers = useCallback(() => {
    // @ts-ignore
    router.push('/(auth)/(modal)/blocked-users');
  }, [router]);

  const handleDataActivity = useCallback(() => {
    // @ts-ignore
    router.push('/(auth)/(modal)/data-activity');
  }, [router]);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={BLUE_COLOR} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header - Fixed at top */}
      <View style={[styles.header, { paddingTop: top + 14 }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Privacy Settings</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Scrollable Content */}
      <ScrollView 
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={true}
        alwaysBounceVertical={false}
      >
        {/* Account Privacy Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.icon }]}>Account Privacy</Text>
          
          <PrivacyToggleRow
            title="Private Account"
            subtitle="Only approved followers can see your content"
            icon="lock-closed"
            isEnabled={settings.privateAccount}
            onToggle={() => toggleSetting('privateAccount')}
            colors={colors}
          />
        </View>

        {/* Activity Status Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.icon }]}>Activity Status</Text>
          
          <PrivacyToggleRow
            title="Show Online Status"
            subtitle="Allow others to see when you are online"
            icon="eye"
            isEnabled={settings.showOnlineStatus}
            onToggle={() => toggleSetting('showOnlineStatus')}
            colors={colors}
          />
        </View>

        {/* Messaging Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.icon }]}>Messaging</Text>
          
          <PrivacyToggleRow
            title="Allow Messages"
            subtitle="Allow users to send you direct messages"
            icon="mail"
            isEnabled={settings.allowMessages}
            onToggle={() => toggleSetting('allowMessages')}
            colors={colors}
          />
        </View>

        {/* Discovery Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.icon }]}>Discovery</Text>
          
          <PrivacyToggleRow
            title="Allow Profile Search"
            subtitle="Allow your profile to appear in search results"
            icon="search"
            isEnabled={settings.allowProfileSearch}
            onToggle={() => toggleSetting('allowProfileSearch')}
            colors={colors}
          />
        </View>

        {/* Additional Options Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.icon }]}>Additional Options</Text>
          
          <ClickableRow
            title="Blocked Users"
            subtitle="Manage blocked accounts"
            icon="person-remove"
            onPress={handleBlockedUsers}
            colors={colors}
          />
          
          <ClickableRow
            title="Data & Activity"
            subtitle="Manage your data and activity"
            icon="analytics"
            onPress={handleDataActivity}
            colors={colors}
          />
        </View>

        {/* Bottom padding for safe area */}
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
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    padding: 16,
  },
  section: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  clickableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  textContainer: {
    marginLeft: 12,
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '400',
  },
  rowSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  switchContainer: {
    padding: 4,
  },
  switchTrack: {
    borderRadius: 14,
    justifyContent: 'center',
    padding: 2,
  },
  switchThumb: {
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  bottomPadding: {
    height: 16,
  },
});
