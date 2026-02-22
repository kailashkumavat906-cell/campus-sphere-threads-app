import { useThemeContext } from '@/hooks/ThemeContext';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TermsScreen() {
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Terms & Privacy</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={true}
      >
        <Text style={[styles.title, { color: colors.text }]}>
          Terms & Privacy Policy
        </Text>

        <Text style={[styles.welcomeText, { color: colors.text }]}>
          Welcome to Campus Sphere.
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Terms of Service
        </Text>

        <Text style={[styles.paragraph, { color: colors.icon }]}>
          1. Users must not post harmful or illegal content.
        </Text>
        <Text style={[styles.paragraph, { color: colors.icon }]}>
          2. Respect other users and community guidelines.
        </Text>
        <Text style={[styles.paragraph, { color: colors.icon }]}>
          3. Your account information is stored securely.
        </Text>
        <Text style={[styles.paragraph, { color: colors.icon }]}>
          4. We do not sell your personal data.
        </Text>
        <Text style={[styles.paragraph, { color: colors.icon }]}>
          5. You are responsible for your activity in the app.
        </Text>
        <Text style={[styles.paragraph, { color: colors.icon }]}>
          6. Harassment, bullying, or hate speech is strictly prohibited.
        </Text>
        <Text style={[styles.paragraph, { color: colors.icon }]}>
          7. Spam and repetitive content may result in account suspension.
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Privacy Policy
        </Text>

        <Text style={[styles.paragraph, { color: colors.icon }]}>
          • Email and profile information is stored for login and app features.
        </Text>
        <Text style={[styles.paragraph, { color: colors.icon }]}>
          • Your data is used only for app functionality.
        </Text>
        <Text style={[styles.paragraph, { color: colors.icon }]}>
          • We do not share your personal information with third parties.
        </Text>
        <Text style={[styles.paragraph, { color: colors.icon }]}>
          • You can request account deletion at any time.
        </Text>
        <Text style={[styles.paragraph, { color: colors.icon }]}>
          • Posts, likes, and follows are visible to other users based on your privacy settings.
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Account Security
        </Text>

        <Text style={[styles.paragraph, { color: colors.icon }]}>
          • Keep your login credentials confidential.
        </Text>
        <Text style={[styles.paragraph, { color: colors.icon }]}>
          • Report any suspicious activity immediately.
        </Text>
        <Text style={[styles.paragraph, { color: colors.icon }]}>
          • Use the app responsibly and ethically.
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Contact Us
        </Text>

        <Text style={[styles.paragraph, { color: colors.icon }]}>
          If you have any questions or concerns about these terms, please use the "Report a Problem" feature in the app settings.
        </Text>

        <Text style={[styles.lastUpdated, { color: colors.icon }]}>
          Last updated: February 2026
        </Text>

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
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 60,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  welcomeText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8,
  },
  lastUpdated: {
    fontSize: 12,
    marginTop: 32,
    textAlign: 'center',
  },
  bottomPadding: {
    height: 40,
  },
});
