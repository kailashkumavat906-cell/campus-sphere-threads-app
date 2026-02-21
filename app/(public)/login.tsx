import { api } from '@/convex/_generated/api';
import { useThemeContext } from '@/hooks/ThemeContext';
import { useOAuth, useSignIn, useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from 'convex/react';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// Required for web OAuth - must be called before any OAuth flow
if (Platform.OS === 'web') {
  WebBrowser.maybeCompleteAuthSession();
}

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, setActive, isLoaded } = useSignIn();
  const { startOAuthFlow: startGoogleOAuthFlow } = useOAuth({ strategy: 'oauth_google' });
  const { user: clerkUser } = useUser();
  const syncUserToConvex = useMutation(api.users.syncUser);
  
  // Theme context
  const { colors, isDark } = useThemeContext();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateFields = (): boolean => {
    const newErrors: { email?: string; password?: string } = {};
    
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(email)) {
      newErrors.email = 'Please enter a valid email';
    }
    
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Helper function to sync user to Convex after login
  const syncUserAfterLogin = async () => {
    // Give a small delay for Clerk user to populate
    await new Promise(resolve => setTimeout(resolve, 500));
    
    if (clerkUser) {
      console.log('Syncing user to Convex after login:', clerkUser.id);
      try {
        await syncUserToConvex({
          clerkId: clerkUser.id,
          email: clerkUser.primaryEmailAddress?.emailAddress || '',
          imageUrl: clerkUser.imageUrl || undefined,
          first_name: clerkUser.firstName || undefined,
          last_name: clerkUser.lastName || undefined,
        });
        console.log('User synced to Convex successfully!');
      } catch (syncErr) {
        console.error('Failed to sync user to Convex:', syncErr);
      }
    } else {
      console.log('Clerk user not available yet, will sync on next app load');
    }
  };

  const handleEmailLogin = useCallback(async () => {
    if (!validateFields()) {
      return;
    }

    if (!isLoaded) {
      return;
    }

    setLoading(true);
    try {
      console.log('Starting login with email:', email);
      
      const result = await signIn.create({
        identifier: email,
        password: password,
      });

      console.log('SignIn result - status:', result.status);
      console.log('SignIn result - createdSessionId:', result.createdSessionId);

      if (result.status === 'complete') {
        console.log('Sign in complete, activating session...');
        await setActive!({ session: result.createdSessionId });
        console.log('Session activated, syncing to Convex...');
        await syncUserAfterLogin();
        console.log('Login flow complete, redirecting to feed...');
        router.replace('/(auth)/(tabs)/feed');
      } else {
        console.log('Sign in incomplete, status:', result.status);
        Alert.alert('Error', 'Sign in was not completed. Please try again.');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      console.log('Full error:', JSON.stringify(error, null, 2));
      const errorMessage = error?.errors?.[0]?.message || error?.message || 'Failed to login. Please check your credentials.';
      Alert.alert('Login Error', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [isLoaded, email, password, signIn, setActive, router, clerkUser, syncUserToConvex]);

  const handleGoogleLogin = useCallback(async () => {
    try {
      setLoading(true);
      const { createdSessionId, setActive } = await startGoogleOAuthFlow();
      console.log('🚀 ~ handleGoogleLogin ~ createdSessionId:', createdSessionId);
      
      if (createdSessionId) {
        await setActive!({ session: createdSessionId });
        console.log('✅ Session activated successfully!');
        await syncUserAfterLogin();
        router.replace('/(auth)/(tabs)/feed');
      } else {
        console.log('⚠️ No session created - user may have cancelled');
      }
    } catch (error: any) {
      console.error('❌ Google OAuth Error:', error);
      Alert.alert('Login Error', error?.message || 'Failed to login with Google');
    } finally {
      setLoading(false);
    }
  }, [startGoogleOAuthFlow, router, clerkUser, syncUserToConvex]);

  const handleForgotPassword = useCallback(async () => {
    if (!email.trim()) {
      Alert.alert(
        'Reset Password',
        'Please enter your email address first, then click "Forgot Password" to receive a password reset link.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!isLoaded || !signIn) {
      Alert.alert('Error', 'Authentication not loaded. Please try again.');
      return;
    }

    try {
      setLoading(true);
      // Use Clerk's signIn.create with reset password strategy
      await signIn.create({
        identifier: email,
        strategy: 'reset_password_email_code',
      });
      Alert.alert(
        'Password Reset',
        'A password reset code has been sent to your email. Check your inbox to reset your password.',
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      console.error('Password reset error:', error);
      Alert.alert(
        'Reset Password',
        'Would you like to reset your password through Clerk?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Continue', 
            onPress: () => {
              Alert.alert(
                'Password Reset',
                'Please visit the Clerk dashboard or use the password reset link sent to your email.',
                [{ text: 'OK' }]
              );
            }
          }
        ]
      );
    } finally {
      setLoading(false);
    }
  }, [email, signIn, isLoaded]);

  const handleNavigateToSignUp = useCallback(() => {
    router.push('/signup');
  }, [router]);

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.authBackground }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      {/* Gradient Background */}
      <View style={[styles.gradientBackground, { backgroundColor: colors.authBackground }]}>
        <View style={[styles.gradientOverlay, { backgroundColor: colors.authBackgroundOverlay }]} />
      </View>

      <View style={styles.content}>
        {/* Card Container */}
        <View style={[styles.card, { backgroundColor: colors.authCardBackground }]}>
          {/* Logo Section - Increased size by ~50% */}
          <View style={styles.logoSection}>
            <Image 
              source={require('@/assets/images/icon.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={[styles.logoTitle, { color: colors.authText }]}>Campus Sphere</Text>
            <Text style={[styles.subtitle, { color: colors.authTextSecondary }]}>Connect Your Campus World</Text>
          </View>

          {/* Input Fields */}
          <View style={styles.inputSection}>
            {/* Email Input */}
            <View style={[
              styles.inputContainer, 
              { 
                backgroundColor: colors.authInputBackground, 
                borderColor: colors.authInputBorder 
              },
              errors.email && { borderColor: colors.authError }
            ]}>
              <Ionicons 
                name="mail-outline" 
                size={20} 
                color={colors.authInputIcon} 
                style={styles.inputIcon} 
              />
              <TextInput
                style={[styles.input, { color: colors.authInputText }]}
                placeholder="Email"
                placeholderTextColor={colors.authTextPlaceholder}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (errors.email) setErrors(prev => ({ ...prev, email: undefined }));
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Email input"
                accessibilityHint="Enter your email address"
              />
            </View>
            {errors.email && <Text style={[styles.errorText, { color: colors.authError }]}>{errors.email}</Text>}

            {/* Password Input */}
            <View style={[
              styles.inputContainer, 
              { 
                backgroundColor: colors.authInputBackground, 
                borderColor: colors.authInputBorder 
              },
              errors.password && { borderColor: colors.authError }
            ]}>
              <Ionicons 
                name="lock-closed-outline" 
                size={20} 
                color={colors.authInputIcon} 
                style={styles.inputIcon} 
              />
              <TextInput
                style={[styles.input, { color: colors.authInputText }]}
                placeholder="Password"
                placeholderTextColor={colors.authTextPlaceholder}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errors.password) setErrors(prev => ({ ...prev, password: undefined }));
                }}
                secureTextEntry={!showPassword}
                accessibilityLabel="Password input"
                accessibilityHint="Enter your password"
              />
              <TouchableOpacity 
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              >
                <Ionicons 
                  name={showPassword ? 'eye-outline' : 'eye-off-outline'} 
                  size={20} 
                  color={colors.authInputIcon} 
                />
              </TouchableOpacity>
            </View>
            {errors.password && <Text style={[styles.errorText, { color: colors.authError }]}>{errors.password}</Text>}

            {/* Forgot Password */}
            <TouchableOpacity 
              style={styles.forgotPasswordContainer}
              onPress={handleForgotPassword}
              accessibilityLabel="Forgot password"
            >
              <Text style={[styles.forgotPasswordText, { color: colors.authLink }]}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* Log In Button with Gradient */}
            <TouchableOpacity 
              onPress={handleEmailLogin}
              disabled={loading}
              accessibilityLabel="Log in button"
              accessibilityRole="button"
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={colors.authGradient as any}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.loginButton}
              >
                {loading ? (
                  <ActivityIndicator color={colors.authButtonText} />
                ) : (
                  <Text style={[styles.loginButtonText, { color: colors.authButtonText }]}>Log In</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={[styles.dividerLine, { backgroundColor: colors.authDivider }]} />
            <Text style={[styles.dividerText, { color: colors.authTextSecondary }]}>OR CONTINUE WITH</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.authDivider }]} />
          </View>

          {/* Social Login - Only Google */}
          <View style={styles.socialSection}>
            {/* Google Sign-In */}
            <TouchableOpacity 
              style={[
                styles.googleButton, 
                { 
                  backgroundColor: colors.authSocialBackground,
                  borderColor: colors.authSocialBorder
                }
              ]}
              onPress={handleGoogleLogin}
              disabled={loading}
              accessibilityLabel="Continue with Google"
              accessibilityRole="button"
            >
              <Image 
                source={require('@/assets/images/google_icon.webp')} 
                style={styles.googleIcon} 
              />
              <Text style={[styles.googleButtonText, { color: colors.authSocialText }]}>Google</Text>
            </TouchableOpacity>
          </View>

          {/* Bottom Text - Navigate to Sign Up */}
          <View style={styles.bottomTextContainer}>
            <Text style={[styles.bottomText, { color: colors.authTextSecondary }]}>Don't have an account? </Text>
            <TouchableOpacity 
              onPress={handleNavigateToSignUp}
              accessibilityLabel="Navigate to sign up"
            >
              <Text style={[styles.signUpLinkText, { color: colors.authLink }]}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    padding: 32,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 12,
  },
  logoTitle: {
    fontFamily: 'System',
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: 'System',
    fontSize: 14,
    fontWeight: '400',
  },
  inputSection: {
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  inputError: {
    borderWidth: 1,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  eyeButton: {
    padding: 4,
  },
  errorText: {
    fontSize: 12,
    marginBottom: 8,
    marginLeft: 4,
  },
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginBottom: 20,
    marginTop: 8,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '500',
  },
  loginButton: {
    width: '100%',
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '600',
    marginHorizontal: 16,
    letterSpacing: 1,
  },
  socialSection: {
    gap: 12,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 10,
  },
  googleButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  bottomTextContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  bottomText: {
    fontSize: 14,
  },
  signUpLinkText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
