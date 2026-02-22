import { useThemeContext } from '@/hooks/ThemeContext';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AboutScreen() {
  const router = useRouter();
  const { colors } = useThemeContext();
  const { top } = useSafeAreaInsets();

  const handleGoBack = useCallback(() => {
    router.dismiss();
  }, [router]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Custom Header */}
      <View style={[styles.header, { paddingTop: top + 14 }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack} accessibilityLabel="Back">
          <Text style={[styles.backText, { color: colors.text }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>About</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={true}
      >
        {/* App Logo - Using actual app icon */}
        <View style={styles.iconContainer}>
          <Image
            source={require('@/assets/images/icon.png')}
            style={styles.appLogo}
            resizeMode="contain"
          />
        </View>

        {/* App Name */}
        <Text style={[styles.appName, { color: colors.text }]}>Campus Sphere</Text>
        
        {/* Version */}
        <Text style={[styles.version, { color: colors.icon }]}>Version 1.0.0</Text>

        {/* Description */}
        <View style={styles.descriptionContainer}>
          <Text style={[styles.description, { color: colors.text }]}>
            Campus Sphere is a social platform for students to connect, share posts, follow others and interact with campus community.
          </Text>
        </View>

        {/* Features */}
        <View style={styles.featuresContainer}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Features</Text>
          <Text style={[styles.featureText, { color: colors.icon }]}>• Share posts and updates</Text>
          <Text style={[styles.featureText, { color: colors.icon }]}>• Follow other students</Text>
          <Text style={[styles.featureText, { color: colors.icon }]}>• Like and comment on posts</Text>
          <Text style={[styles.featureText, { color: colors.icon }]}>• Save favorite posts</Text>
          <Text style={[styles.featureText, { color: colors.icon }]}>• Private account option</Text>
          <Text style={[styles.featureText, { color: colors.icon }]}>• Search for users</Text>
        </View>

        {/* Contact */}
        <View style={styles.contactContainer}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Contact</Text>
          <Text style={[styles.contactText, { color: colors.icon }]}>
            For support, use "Report a Problem" in settings.
          </Text>
        </View>

        {/* Bottom padding */}
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
    width: 60,
  },
  backText: {
    fontSize: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  headerRight: {
    width: 60,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    padding: 24,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 16,
    marginTop: 20,
  },
  appLogo: {
    width: 100,
    height: 100,
    borderRadius: 20,
  },
  appName: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  version: {
    fontSize: 14,
    marginBottom: 24,
  },
  descriptionContainer: {
    marginBottom: 24,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  featuresContainer: {
    width: '100%',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 14,
    lineHeight: 22,
  },
  contactContainer: {
    width: '100%',
  },
  contactText: {
    fontSize: 14,
    lineHeight: 20,
  },
  bottomPadding: {
    height: 40,
  },
});
