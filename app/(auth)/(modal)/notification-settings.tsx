import { useNotificationSettings } from '@/hooks/useNotificationSettings';
import { useThemeContext } from '@/hooks/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useState, useRef } from 'react';
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

export default function NotificationSettingsScreen() {
  const { top } = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useThemeContext();
  const { notificationsEnabled, isLoading, toggleNotifications } = useNotificationSettings();

  const handleGoBack = useCallback(() => {
    router.dismiss();
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Notification Settings</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Scrollable Content */}
      <ScrollView 
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={true}
        alwaysBounceVertical={false}
      >
        {/* Main Toggle */}
        <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
          <View style={styles.row}>
            <View style={styles.labelContainer}>
              <Ionicons 
                name={notificationsEnabled ? 'notifications' : 'notifications-off'} 
                size={24} 
                color={notificationsEnabled ? BLUE_COLOR : colors.icon} 
              />
              <View style={styles.textContainer}>
                <Text style={[styles.title, { color: colors.text }]}>
                  Enable Notifications
                </Text>
                <Text style={[styles.subtitle, { color: colors.icon }]}>
                  {notificationsEnabled 
                    ? 'You will receive push notifications' 
                    : 'Notifications are disabled'}
                </Text>
              </View>
            </View>
            
            <AnimatedSwitch 
              isEnabled={notificationsEnabled} 
              onToggle={toggleNotifications} 
            />
          </View>
        </View>

        {/* Notification Types */}
        {notificationsEnabled && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.icon }]}>Notification Types</Text>
            
            <ToggleRow
              title="Likes"
              subtitle="When someone likes your posts"
              icon="heart"
              colors={colors}
            />
            
            <ToggleRow
              title="Comments"
              subtitle="When someone comments on your posts"
              icon="chatbubble"
              colors={colors}
            />
            
            <ToggleRow
              title="Follows"
              subtitle="When someone follows you"
              icon="person-add"
              colors={colors}
            />
          </View>
        )}

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Ionicons name="information-circle" size={20} color={colors.icon} />
          <Text style={[styles.infoText, { color: colors.icon }]}>
            You can customize which notifications you receive in your device settings.
          </Text>
        </View>

        {/* Bottom padding for safe area */}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

// Toggle Row Component with Animated Switch
function ToggleRow({ 
  title, 
  subtitle, 
  icon,
  colors 
}: { 
  title: string; 
  subtitle: string; 
  icon: string;
  colors: any;
}) {
  const [isEnabled, setIsEnabled] = useState(true);

  const handleToggle = () => {
    setIsEnabled(!isEnabled);
  };

  return (
    <View style={styles.toggleRow}>
      <TouchableOpacity
        style={styles.labelContainer}
        onPress={handleToggle}
        accessibilityRole="button"
        activeOpacity={0.7}
      >
        <Ionicons name={icon as any} size={22} color={colors.text} />
        <View style={styles.textContainer}>
          <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.rowSubtitle, { color: colors.icon }]}>{subtitle}</Text>
        </View>
      </TouchableOpacity>
      
      <AnimatedSwitch 
        isEnabled={isEnabled} 
        onToggle={handleToggle}
        size="small"
      />
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
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
  title: {
    fontSize: 16,
    fontWeight: '500',
  },
  subtitle: {
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
  sectionTitle: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '400',
  },
  rowSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  infoSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 8,
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 13,
    lineHeight: 20,
  },
  bottomPadding: {
    height: 16,
  },
});
