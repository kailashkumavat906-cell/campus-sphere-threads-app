import React from 'react';
import { ActivityIndicator, Appearance, Image, StyleSheet, Text, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

// Prevent the native splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

interface AppLoadingProps {
  onFinish: () => void;
}

// Splash screen duration in milliseconds (5000 = 5 seconds)
const SPLASH_DURATION = 5000;

export default function AppLoading({ onFinish }: AppLoadingProps): React.JSX.Element {
  // Get the current color scheme
  const colorScheme = Appearance.getColorScheme() || 'dark';
  const isDark = colorScheme === 'dark';

  React.useEffect(() => {
    const prepareApp = async () => {
      // Wait for splash screen duration
      await new Promise(resolve => setTimeout(resolve, SPLASH_DURATION));
      
      // Hide the native splash screen
      await SplashScreen.hideAsync();
      onFinish();
    };
    
    prepareApp();
  }, [onFinish]);

  const backgroundColor = isDark ? '#000000' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : '#000000';
  const sloganColor = isDark ? '#B3B3B3' : '#5E5E5E';

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Image
        source={require('../assets/images/icon.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={[styles.appName, { color: textColor }]}>CampusSphere</Text>
      <Text style={[styles.slogan, { color: sloganColor }]}>Your College. Your Community.</Text>
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#0095F6" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  logo: {
    width: 200,
    height: 200,
    marginBottom: 40,
  },
  appName: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  slogan: {
    fontSize: 16,
    marginBottom: 60,
    textAlign: 'center',
    opacity: 0.8,
  },
  loaderContainer: {
    marginTop: 20,
  },
});
