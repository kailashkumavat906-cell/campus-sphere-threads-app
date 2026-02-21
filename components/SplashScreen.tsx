import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold, useFonts } from '@expo-google-fonts/dm-sans';
import * as SplashScreenNative from 'expo-splash-screen';
import { useCallback } from 'react';
import { ActivityIndicator, Appearance, Image, StyleSheet, Text, View } from 'react-native';

// Prevent the native splash screen from auto-hiding
SplashScreenNative.preventAutoHideAsync();

// Splash screen duration in milliseconds (5000 = 5 seconds)
const SPLASH_DURATION = 5000;

interface SplashScreenProps {
  onAppReady: () => void;
}

export default function SplashScreen({ onAppReady }: SplashScreenProps) {
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  // Get the current color scheme
  const colorScheme = Appearance.getColorScheme() || 'dark';
  const isDark = colorScheme === 'dark';

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      // Wait for splash screen duration
      await new Promise(resolve => setTimeout(resolve, SPLASH_DURATION));
      
      // Hide the native splash screen
      await SplashScreenNative.hideAsync();
      onAppReady();
    }
  }, [fontsLoaded, fontError, onAppReady]);

  // If fonts are still loading, show the splash screen
  if (!fontsLoaded && !fontError) {
    const backgroundColor = isDark ? '#000000' : '#FFFFFF';
    const textColor = isDark ? '#FFFFFF' : '#000000';
    const sloganColor = isDark ? '#B3B3B3' : '#5E5E5E';

    return (
      <View 
        style={[styles.container, { backgroundColor }]} 
        onLayout={onLayoutRootView}
      >
        <Image
          source={require('../assets/images/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={[styles.appName, { color: textColor }]}>CampusSphere</Text>
        <Text style={[styles.slogan, { color: sloganColor }]}>Your College. Your Community.</Text>
        <ActivityIndicator size="large" color="#0095F6" style={styles.loader} />
      </View>
    );
  }

  // When fonts are loaded, render null and let onLayoutRootView handle hiding
  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  logo: {
    width: 280,
    height: 280,
    marginBottom: 48,
  },
  appName: {
    fontSize: 40,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: 0.5,
    fontFamily: 'DMSans_700Bold',
  },
  slogan: {
    fontSize: 18,
    marginBottom: 60,
    textAlign: 'center',
    opacity: 0.8,
    fontFamily: 'DMSans_400Regular',
  },
  loader: {
    marginTop: 20,
  },
});
