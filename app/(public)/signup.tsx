import { useThemeContext } from '@/hooks/ThemeContext';
import { useOAuth, useSignUp } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
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

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp, setActive, isLoaded } = useSignUp();
  const { startOAuthFlow: startGoogleOAuthFlow } = useOAuth({ strategy: 'oauth_google' });
  const { colors, isDark } = useThemeContext();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  // Password validation state - individual requirements
  const [passwordRequirements, setPasswordRequirements] = useState({
    minLength: false,
    uppercase: false,
    number: false,
    specialChars: false,
  });

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Update individual password requirements as user types
  const updatePasswordRequirements = (pwd: string) => {
    const specialChars = pwd.match(/[!@#$%^&*]/g) || [];
    setPasswordRequirements({
      minLength: pwd.length >= 8,
      uppercase: /[A-Z]/.test(pwd),
      number: /[0-9]/.test(pwd),
      specialChars: specialChars.length >= 2,
    });
  };

  // Check if all password requirements are met
  const isPasswordValid = (): boolean => {
    return passwordRequirements.minLength && 
           passwordRequirements.uppercase && 
           passwordRequirements.number && 
           passwordRequirements.specialChars;
  };

  const validatePassword = (password: string): { isValid: boolean; error?: string } => {
    if (!password || password.length < 8) {
      return { isValid: false, error: 'Password must be at least 8 characters, include an uppercase letter, a number, and 2 special characters.' };
    }
    
    if (!/[A-Z]/.test(password)) {
      return { isValid: false, error: 'Password must contain at least one uppercase letter.' };
    }
    
    if (!/[0-9]/.test(password)) {
      return { isValid: false, error: 'Password must contain at least one number.' };
    }
    
    const specialChars = password.match(/[!@#$%^&*]/g) || [];
    if (specialChars.length < 2) {
      return { isValid: false, error: 'Password must contain at least 2 special characters (!@#$%^&*).' };
    }
    
    return { isValid: true };
  };

  const validateFields = (): boolean => {
    const newErrors: { email?: string; password?: string } = {};
    
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(email)) {
      newErrors.email = 'Please enter a valid email';
    }
    
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      newErrors.password = passwordValidation.error;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleEmailSignUp = useCallback(async () => {
    // First, validate password locally before attempting signup
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      setErrors(prev => ({ ...prev, password: passwordValidation.error }));
      return;
    }

    // Also check if all UI requirements are met
    if (!isPasswordValid()) {
      setErrors(prev => ({ ...prev, password: 'Please meet all password requirements.' }));
      return;
    }

    if (!validateFields()) {
      return;
    }

    if (!isLoaded || !signUp) {
      Alert.alert('Error', 'Authentication not loaded. Please try again.');
      return;
    }

    setLoading(true);
    try {
      // Create the sign up attempt with Clerk
      const signUpResult = await signUp.create({
        emailAddress: email,
        password: password,
      });

      console.log('SignUp created, status:', signUpResult.status);
      console.log('SignUp ID:', signUpResult.id);

      // Prepare email verification (Clerk will send verification email)
      await signUp.prepareEmailAddressVerification({
        strategy: 'email_code',
      });

      console.log('Verification email prepared, navigating to verify page');

      // Navigate to verification page with signUp ID
      router.push({ pathname: '/verify', params: { email, signUpId: signUpResult.id } });
    } catch (error: any) {
      // Log technical error only to console (not visible to users)
      console.error('Sign up error:', error);
      
      // Extract error message safely
      const errorMessage = error?.errors?.[0]?.message || error?.message || '';
      const errorCode = error?.errors?.[0]?.code || '';
      const lowerMessage = errorMessage.toLowerCase();
      
      // Check for password breach/compromised error from Clerk
      const isBreachError = 
        lowerMessage.includes('breach') || 
        lowerMessage.includes('compromised') ||
        lowerMessage.includes('exposed') ||
        errorCode === 'password_breach' ||
        errorCode === 'password_compromised' ||
        errorCode === 'form_param_format_error';
      
      if (isBreachError) {
        // Show clean user-friendly message for password breach
        Alert.alert(
          'Password Issue',
          'Please choose a stronger password that has not been used before.'
        );
        setErrors(prev => ({ ...prev, password: 'Please choose a stronger password' }));
      } else {
        // Show generic error for other signup failures (never show raw error)
        Alert.alert(
          'Sign Up Error',
          'Unable to create account. Please try again or use a different email.'
        );
      }
    } finally {
      setLoading(false);
    }
  }, [isLoaded, signUp, email, password, router]);

  const handleGoogleSignUp = useCallback(async () => {
    try {
      setLoading(true);
      const { createdSessionId, setActive } = await startGoogleOAuthFlow();
      console.log('🚀 ~ handleGoogleSignUp ~ createdSessionId:', createdSessionId);
      
      if (createdSessionId) {
        await setActive!({ session: createdSessionId });
        console.log('✅ Session activated successfully!');
        router.replace('/(auth)/(tabs)/feed');
      } else {
        console.log('⚠️ No session created - user may have cancelled');
      }
    } catch (error: any) {
      console.error('❌ Google OAuth Error:', error);
      Alert.alert('Sign Up Error', error?.message || 'Failed to sign up with Google');
    } finally {
      setLoading(false);
    }
  }, [startGoogleOAuthFlow, router]);

  const handleNavigateToLogin = useCallback(() => {
    router.push('/login');
  }, [router]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.authBackground }]}>
      <KeyboardAvoidingView 
        style={[styles.container, { backgroundColor: colors.authBackground }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Gradient Background */}
        <View style={[styles.gradientBackground, { backgroundColor: colors.authBackground }]}>
          <View style={[styles.gradientOverlay, { backgroundColor: colors.authBackgroundOverlay }]} />
        </View>

        <View style={styles.content}>
          {/* Card Container */}
          <View style={[styles.card, { backgroundColor: colors.authCardBackground }]}>
            {/* Logo Section */}
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
                  updatePasswordRequirements(text);
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

            {/* Password Requirements Checklist */}
            <View style={styles.passwordRequirementsContainer}>
              <Text style={[styles.passwordRequirementsTitle, { color: colors.authTextSecondary }]}>
                Password Requirements
              </Text>
              
              {/* Minimum 8 characters */}
              <View style={styles.requirementRow}>
                <Ionicons 
                  name={passwordRequirements.minLength ? 'checkmark-circle' : 'ellipse-outline'} 
                  size={16} 
                  color={passwordRequirements.minLength ? '#22c55e' : colors.authTextPlaceholder} 
                  style={styles.requirementIcon}
                />
                <Text style={[
                  styles.requirementText, 
                  { color: passwordRequirements.minLength ? '#22c55e' : colors.authTextPlaceholder }
                ]}>
                  At least 8 characters
                </Text>
              </View>
              
              {/* One uppercase letter */}
              <View style={styles.requirementRow}>
                <Ionicons 
                  name={passwordRequirements.uppercase ? 'checkmark-circle' : 'ellipse-outline'} 
                  size={16} 
                  color={passwordRequirements.uppercase ? '#22c55e' : colors.authTextPlaceholder} 
                  style={styles.requirementIcon}
                />
                <Text style={[
                  styles.requirementText, 
                  { color: passwordRequirements.uppercase ? '#22c55e' : colors.authTextPlaceholder }
                ]}>
                  One uppercase letter
                </Text>
              </View>
              
              {/* One number */}
              <View style={styles.requirementRow}>
                <Ionicons 
                  name={passwordRequirements.number ? 'checkmark-circle' : 'ellipse-outline'} 
                  size={16} 
                  color={passwordRequirements.number ? '#22c55e' : colors.authTextPlaceholder} 
                  style={styles.requirementIcon}
                />
                <Text style={[
                  styles.requirementText, 
                  { color: passwordRequirements.number ? '#22c55e' : colors.authTextPlaceholder }
                ]}>
                  One number
                </Text>
              </View>
              
              {/* Two special characters */}
              <View style={styles.requirementRow}>
                <Ionicons 
                  name={passwordRequirements.specialChars ? 'checkmark-circle' : 'ellipse-outline'} 
                  size={16} 
                  color={passwordRequirements.specialChars ? '#22c55e' : colors.authTextPlaceholder} 
                  style={styles.requirementIcon}
                />
                <Text style={[
                  styles.requirementText, 
                  { color: passwordRequirements.specialChars ? '#22c55e' : colors.authTextPlaceholder }
                ]}>
                  Two special characters
                </Text>
              </View>
            </View>

            {/* Sign Up Button with Gradient */}
            <TouchableOpacity 
              onPress={handleEmailSignUp}
              disabled={loading || !isPasswordValid()}
              accessibilityLabel="Sign up button"
              accessibilityRole="button"
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={!isPasswordValid() ? ['#9ca3af', '#9ca3af'] : (colors.authGradient as any)}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.signUpButton, !isPasswordValid() && styles.signUpButtonDisabled]}
              >
                {loading ? (
                  <ActivityIndicator color={colors.authButtonText} />
                ) : (
                  <Text style={[styles.signUpButtonText, { color: colors.authButtonText }]}>Sign Up</Text>
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

          {/* Social Login */}
          <View style={styles.socialSection}>
            {/* Google Sign-Up */}
            <TouchableOpacity 
              style={[
                styles.googleButton, 
                { 
                  backgroundColor: colors.authSocialBackground,
                  borderColor: colors.authSocialBorder
                }
              ]}
              onPress={handleGoogleSignUp}
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

          {/* Bottom Text - Navigate to Login */}
          <View style={styles.bottomTextContainer}>
            <Text style={[styles.bottomText, { color: colors.authTextSecondary }]}>Already a user? </Text>
            <TouchableOpacity 
              onPress={handleNavigateToLogin}
              accessibilityLabel="Navigate to login"
            >
              <Text style={[styles.loginLinkText, { color: colors.authLink }]}>Log In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
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
    marginBottom: 24,
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
    marginBottom: 20,
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
  passwordRequirementsContainer: {
    marginTop: 8,
    marginBottom: 16,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 12,
  },
  passwordRequirementsTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  requirementIcon: {
    marginRight: 8,
  },
  requirementText: {
    fontSize: 13,
  },
  signUpButton: {
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
    marginTop: 8,
  },
  signUpButtonDisabled: {
    shadowOpacity: 0.1,
    elevation: 2,
  },
  signUpButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
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
  loginLinkText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
