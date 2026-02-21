import { api } from '@/convex/_generated/api';
import { useThemeContext } from '@/hooks/ThemeContext';
import { useAuth, useSignUp, useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from 'convex/react';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

const OTP_LENGTH = 6;

export default function VerifyScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const { signUp, setActive, isLoaded } = useSignUp();
  const { isSignedIn } = useAuth();
  const { user: clerkUser } = useUser();
  const syncUserToConvex = useMutation(api.users.syncUser);
  const { colors, isDark } = useThemeContext();
  
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const otpInputs = useRef<(TextInput | null)[]>([]);

  // Check if already verified on mount
  useEffect(() => {
    const checkVerificationStatus = async () => {
      if (!isLoaded || !signUp) {
        console.log('Not ready yet - isLoaded:', isLoaded, 'signUp:', !!signUp);
        return;
      }
      
      console.log('Checking signUp status on mount:', signUp.status);
      console.log('signUp.createdSessionId:', signUp.createdSessionId);
      
      // If already complete with session, activate and redirect to feed
      if (signUp.status === 'complete' && signUp.createdSessionId) {
        console.log('Sign up already complete, activating session...');
        try {
          await setActive!({ session: signUp.createdSessionId });
          console.log('Session activated!');
          
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          if (clerkUser) {
            await syncUserToConvex({
              clerkId: clerkUser.id,
              email: clerkUser.primaryEmailAddress?.emailAddress || '',
              imageUrl: clerkUser.imageUrl || undefined,
              first_name: clerkUser.firstName || undefined,
              last_name: clerkUser.lastName || undefined,
            });
            console.log('User synced to Convex!');
          }
          
          router.replace('/(auth)/(tabs)/feed');
        } catch (err) {
          console.error('Error activating session:', err);
        }
      }
    };
    
    const timer = setTimeout(checkVerificationStatus, 500);
    return () => clearTimeout(timer);
  }, [isLoaded, signUp, setActive, router, clerkUser, syncUserToConvex]);

  // Check if user is already signed in
  useEffect(() => {
    if (isSignedIn) {
      console.log('User already signed in, redirecting...');
      router.replace('/(auth)/(tabs)/feed');
    }
  }, [isSignedIn, router]);

  // Countdown timer for resend
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [resendTimer]);

  // Auto-focus first input on mount
  useEffect(() => {
    setTimeout(() => otpInputs.current[0]?.focus(), 100);
  }, []);

  const handleOtpChange = (value: string, index: number) => {
    const numericValue = value.replace(/[^0-9]/g, '');
    
    if (numericValue.length <= 1) {
      const newOtp = otp.split('');
      newOtp[index] = numericValue;
      const finalOtp = newOtp.join('');
      setOtp(finalOtp);
      setError('');
      
      if (numericValue && index < OTP_LENGTH - 1) {
        otpInputs.current[index + 1]?.focus();
      }
      
      if (finalOtp.length === OTP_LENGTH) {
        Keyboard.dismiss();
      }
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
  };

  const handleVerify = useCallback(async () => {
    if (verifying || success) return; // Prevent double verification
    
    if (!otp || otp.length !== OTP_LENGTH) {
      setError('Please enter all 6 digits');
      return;
    }

    if (!isLoaded || !signUp) {
      Alert.alert('Error', 'Authentication session expired. Please go back and sign up again.');
      return;
    }

    setVerifying(true);
    setLoading(true);
    setError('');

    try {
      console.log('Starting verification with code:', otp);
      console.log('Current signUp status:', signUp.status);
      console.log('Current signUp id:', signUp.id);
      
      // Check if already verified
      if (signUp.status === 'complete') {
        console.log('Already verified, redirecting to login...');
        setSuccess(true);
        router.replace('/login');
        return;
      }

      // Try to verify
      console.log('Attempting email verification...');
      const signUpAttempt = await signUp.attemptEmailAddressVerification({

        code: otp,
      });

      console.log('Verification result - status:', signUpAttempt.status);
      console.log('Verification result - id:', signUpAttempt.id);
      console.log('Verification result - createdSessionId:', signUpAttempt.createdSessionId);
      console.log('Verification result - emailAddress:', signUpAttempt.emailAddress);

      if (signUpAttempt.status === 'complete' && signUpAttempt.createdSessionId) {
        console.log('Verification complete - activating session...');
        
        // Activate session immediately
        await setActive!({ session: signUpAttempt.createdSessionId });
        console.log('Session activated!');
        
        // Wait for user to be available
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Get Clerk user
        if (clerkUser) {
          console.log('Syncing user to Convex:', clerkUser.id);
          try {
            await syncUserToConvex({
              clerkId: clerkUser.id,
              email: clerkUser.primaryEmailAddress?.emailAddress || '',
              imageUrl: clerkUser.imageUrl || undefined,
              first_name: clerkUser.firstName || undefined,
              last_name: clerkUser.lastName || undefined,
            });
            console.log('User synced to Convex!');
          } catch (syncErr) {
            console.error('Failed to sync user to Convex:', syncErr);
          }
        }
        
        setSuccess(true);
        router.replace('/(auth)/(tabs)/feed');
      } else if (signUpAttempt.status === 'missing_requirements') {
        // Email verified but needs more info - provide required fields and complete
        console.log('Email verified but needs more requirements');
        
        try {
          // Update signUp with required fields (firstName, lastName)
          // Use email prefix as default name
          const emailPrefix = signUpAttempt.emailAddress?.split('@')[0] || 'user';
          
          await signUp.update({
            firstName: emailPrefix,
            lastName: 'User',
          });
          
          console.log('SignUp updated with required fields');
          
          // After update, check if we can now get a session
          if (signUp.createdSessionId) {
            await setActive!({ session: signUp.createdSessionId });
            setSuccess(true);
            router.replace('/(auth)/(tabs)/feed');
          } else {
            // Try fetching the signUp status again
            console.log('Still no session after update, checking status...');
            setError('Verification complete! Redirecting...');
            setTimeout(() => router.replace('/(auth)/(tabs)/feed'), 1500);
          }
        } catch (updateErr) {
          console.error('Error updating signUp:', updateErr);
          setError('Verification complete! Please try logging in.');
          setTimeout(() => router.replace('/login'), 1500);
        }
      } else {
        console.log('Verification status:', signUpAttempt.status);
        setError('Verification incomplete. Please try again.');
      }
    } catch (err: any) {
      console.error('Verification error:', err);
      console.log('Full error object:', JSON.stringify(err, null, 2));
      
      // Handle "already verified" error
      const errorMessage = err?.errors?.[0]?.longMessage || 
                          err?.errors?.[0]?.message ||
                          err?.message || '';
      
      console.log('Error message:', errorMessage);
      
      if (errorMessage.includes('already been verified') || 
          errorMessage.includes('already verified') ||
          errorMessage.includes('verification has already been verified')) {
        console.log('Email already verified - redirecting to login');
        setSuccess(true);
        router.replace('/login');
      } else {
        setError(errorMessage || 'Invalid verification code. Please try again.');
      }
    } finally {
      setVerifying(false);
      setLoading(false);
    }
  }, [otp, isLoaded, signUp, router, verifying, success]);

  const handleResend = useCallback(async () => {
    Alert.alert('Resend Code', 'Please go back to sign up again to receive a new code.', [
      { text: 'OK', onPress: () => router.back() }
    ]);
  }, [router]);

  const handleBackToSignup = useCallback(() => {
    router.back();
  }, [router]);

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.authBackground }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.gradientBackground, { backgroundColor: colors.authBackground }]}>
        <View style={[styles.gradientOverlay, { backgroundColor: colors.authBackgroundOverlay }]} />
      </View>

      <View style={styles.content}>
        <View style={[styles.card, { backgroundColor: colors.authCardBackground }]}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={handleBackToSignup}
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={24} color={colors.authText} />
            <Text style={[styles.backText, { color: colors.authText }]}>Back</Text>
          </TouchableOpacity>

          <View style={styles.logoSection}>
            <View style={styles.iconContainer}>
              <Ionicons name="mail-unread-outline" size={48} color="#0095F6" />
            </View>
            <Text style={styles.title}>Verify Your Email</Text>
            <Text style={styles.subtitle}>
              Enter the 6-digit verification code sent to{'\n'}
              <Text style={styles.emailText}>{email || 'your email'}</Text>
            </Text>
          </View>

          <View style={styles.otpContainer}>
            <View style={styles.otpInputsRow}>
              {Array.from({ length: OTP_LENGTH }).map((_, index) => (
                <TextInput
                  key={index}
                  ref={el => { otpInputs.current[index] = el; }}
                  style={[
                    styles.otpInput,
                    otp[index] ? styles.otpInputFilled : null,
                    error ? styles.otpInputError : null,
                  ]}
                  value={otp[index] || ''}
                  onChangeText={(value) => handleOtpChange(value, index)}
                  onKeyPress={(e) => handleKeyPress(e, index)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                  accessibilityLabel={`Digit ${index + 1}`}
                  returnKeyType="done"
                  onSubmitEditing={handleVerify}
                  editable={!verifying && !loading}
                />
              ))}
            </View>
            
            {error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : null}
          </View>

          <TouchableOpacity 
            onPress={handleVerify}
            disabled={loading || otp.length !== OTP_LENGTH || verifying}
            accessibilityLabel="Verify button"
            accessibilityRole="button"
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#0095F6', '#8B5CF6', '#D53F8C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                styles.verifyButton,
                (loading || otp.length !== OTP_LENGTH || verifying) && styles.verifyButtonDisabled,
              ]}
            >
              {loading || verifying ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.verifyButtonText}>Verify</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.resendContainer}>
            <Text style={styles.resendText}>
              Didn't receive the code?{' '}
            </Text>
            {canResend ? (
              <TouchableOpacity 
                onPress={handleResend}
                accessibilityLabel="Resend verification code"
              >
                <Text style={styles.resendLink}>Resend</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.resendTimer}>
                Resend in {resendTimer}s
              </Text>
            )}
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
    backgroundColor: '#E8EAF6',
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#E0E7FF',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backText: {
    fontSize: 16,
    color: '#1A1A2E',
    marginLeft: 4,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E8EAF6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 20,
  },
  emailText: {
    color: '#0095F6',
    fontWeight: '600',
  },
  otpContainer: {
    marginBottom: 24,
  },
  otpInputsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  otpInput: {
    width: 45,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  otpInputFilled: {
    borderColor: '#0095F6',
    backgroundColor: '#E8F4FD',
  },
  otpInputError: {
    borderColor: '#FF3B30',
    backgroundColor: '#FFE8E8',
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    textAlign: 'center',
    marginTop: 8,
  },
  verifyButton: {
    width: '100%',
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0095F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 24,
  },
  verifyButtonDisabled: {
    opacity: 0.6,
  },
  verifyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resendText: {
    fontSize: 14,
    color: '#666666',
  },
  resendLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0095F6',
  },
  resendTimer: {
    fontSize: 14,
    color: '#999999',
  },
});
