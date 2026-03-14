import { useAuth, useSignIn } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
  View
} from "react-native";

export const options = {
  headerShown: false
};

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const { signIn, isLoaded } = useSignIn();
  const { signOut } = useAuth();
  
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Password validation state
  const [passwordRequirements, setPasswordRequirements] = useState({
    minLength: false,
    uppercase: false,
    number: false,
    specialChars: false,
  });

  // Update password requirements as user types
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

  // Handle complete password reset - code verification + new password in one step
  const handleResetPassword = useCallback(async () => {
    // Validate code
    if (!code.trim()) {
      Alert.alert('Error', 'Please enter the verification code');
      return;
    }

    // Validate new password
    if (!newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please enter and confirm your new password');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (!isPasswordValid()) {
      Alert.alert('Error', 'Please meet all password requirements');
      return;
    }

    if (!isLoaded || !signIn) {
      Alert.alert('Error', 'Authentication not loaded. Please try again.');
      return;
    }

    setLoading(true);
    try {
      // Complete the password reset by verifying code AND setting new password together
      // This is the correct Clerk flow - code and password must be sent together
      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: code,
        password: newPassword,
      });

      if (result.status === 'complete') {
        // Sign out any old sessions to ensure clean state
        await signOut();
        
        Alert.alert(
          'Success',
          'Password reset successfully! Please login with your new password.',
          [{ text: 'OK', onPress: () => router.replace('/login') }]
        );
      } else {
        Alert.alert('Error', 'Failed to reset password. Please try again.');
      }
    } catch (error: any) {
      console.error('Reset password error:', error);
      Alert.alert('Error', 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [code, newPassword, confirmPassword, signIn, isLoaded, router, signOut]);

  const handleGoBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleResendCode = useCallback(async () => {
    if (!email) {
      Alert.alert('Error', 'Email not found. Please start over.');
      return;
    }

    if (!isLoaded || !signIn) {
      Alert.alert('Error', 'Authentication not loaded. Please try again.');
      return;
    }

    setLoading(true);
    try {
      await signIn.create({
        identifier: email,
        strategy: 'reset_password_email_code',
      });
      Alert.alert('Success', 'A new verification code has been sent to your email.');
    } catch (error: any) {
      console.error('Resend code error:', error);
      Alert.alert('Error', 'Failed to resend code. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [email, signIn, isLoaded]);

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Dark background */}
      <View style={styles.background} />

      <View style={styles.content}>
        {/* Back Button */}
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image 
            source={require('@/assets/images/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Title */}
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>
          Enter the code sent to your email and create a new password
        </Text>

        {/* Verification Code Input */}
        <View style={styles.inputContainer}>
          <Ionicons name="key-outline" size={20} color="rgba(255, 255, 255, 0.6)" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Verification Code"
            placeholderTextColor="rgba(255, 255, 255, 0.4)"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
          />
        </View>

        {/* Resend Code */}
        <TouchableOpacity 
          style={styles.resendButton}
          onPress={handleResendCode}
          disabled={loading}
        >
          <Text style={styles.resendText}>
            Didn't receive the code? <Text style={styles.resendLink}>Resend</Text>
          </Text>
        </TouchableOpacity>

        {/* New Password Input */}
        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed-outline" size={20} color="rgba(255, 255, 255, 0.6)" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="New Password"
            placeholderTextColor="rgba(255, 255, 255, 0.4)"
            value={newPassword}
            onChangeText={(text) => {
              setNewPassword(text);
              updatePasswordRequirements(text);
            }}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons 
              name={showPassword ? 'eye-outline' : 'eye-off-outline'} 
              size={20} 
              color="rgba(255, 255, 255, 0.6)" 
            />
          </TouchableOpacity>
        </View>

        {/* Password Requirements */}
        <View style={styles.passwordRequirementsContainer}>
          <Text style={styles.passwordRequirementsTitle}>Password Requirements</Text>
          
          <View style={styles.requirementRow}>
            <Ionicons 
              name={passwordRequirements.minLength ? 'checkmark-circle' : 'ellipse-outline'} 
              size={16} 
              color={passwordRequirements.minLength ? '#22c55e' : 'rgba(255, 255, 255, 0.4)'} 
              style={styles.requirementIcon}
            />
            <Text style={[
              styles.requirementText, 
              { color: passwordRequirements.minLength ? '#22c55e' : 'rgba(255, 255, 255, 0.4)' }
            ]}>
              At least 8 characters
            </Text>
          </View>
          
          <View style={styles.requirementRow}>
            <Ionicons 
              name={passwordRequirements.uppercase ? 'checkmark-circle' : 'ellipse-outline'} 
              size={16} 
              color={passwordRequirements.uppercase ? '#22c55e' : 'rgba(255, 255, 255, 0.4)'} 
              style={styles.requirementIcon}
            />
            <Text style={[
              styles.requirementText, 
              { color: passwordRequirements.uppercase ? '#22c55e' : 'rgba(255, 255, 255, 0.4)' }
            ]}>
              One uppercase letter
            </Text>
          </View>
          
          <View style={styles.requirementRow}>
            <Ionicons 
              name={passwordRequirements.number ? 'checkmark-circle' : 'ellipse-outline'} 
              size={16} 
              color={passwordRequirements.number ? '#22c55e' : 'rgba(255, 255, 255, 0.4)'} 
              style={styles.requirementIcon}
            />
            <Text style={[
              styles.requirementText, 
              { color: passwordRequirements.number ? '#22c55e' : 'rgba(255, 255, 255, 0.4)' }
            ]}>
              One number
            </Text>
          </View>
          
          <View style={styles.requirementRow}>
            <Ionicons 
              name={passwordRequirements.specialChars ? 'checkmark-circle' : 'ellipse-outline'} 
              size={16} 
              color={passwordRequirements.specialChars ? '#22c55e' : 'rgba(255, 255, 255, 0.4)'} 
              style={styles.requirementIcon}
            />
            <Text style={[
              styles.requirementText, 
              { color: passwordRequirements.specialChars ? '#22c55e' : 'rgba(255, 255, 255, 0.4)' }
            ]}>
              Two special characters
            </Text>
          </View>
        </View>

        {/* Confirm Password Input */}
        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed-outline" size={20} color="rgba(255, 255, 255, 0.6)" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor="rgba(255, 255, 255, 0.4)"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showPassword}
          />
        </View>

        {/* Reset Password Button */}
        <TouchableOpacity 
          style={[
            styles.actionButton,
            (!code.trim() || !isPasswordValid()) && styles.actionButtonDisabled
          ]}
          onPress={handleResetPassword}
          disabled={loading || !code.trim() || !isPasswordValid()}
        >
          {loading ? (
            <ActivityIndicator color="#000000" />
          ) : (
            <Text style={styles.actionButtonText}>Reset Password</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0D0D0D',
    zIndex: -1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 24,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },
  backText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 16,
    color: '#FFFFFF',
  },
  logoContainer: {
    marginBottom: 32,
    marginTop: 40,
  },
  logo: {
    width: 80,
    height: 80,
  },
  title: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 28,
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 32,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 56,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    color: '#FFFFFF',
  },
  actionButton: {
    width: '100%',
    height: 50,
    borderRadius: 25,
    backgroundColor: '#0095F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  actionButtonDisabled: {
    backgroundColor: '#666666',
  },
  actionButtonText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 16,
    color: '#000000',
  },
  resendButton: {
    marginTop: 24,
  },
  resendText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  resendLink: {
    color: '#0095F6',
    fontFamily: 'DMSans_700Bold',
  },
  passwordRequirementsContainer: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  passwordRequirementsTitle: {
    fontFamily: 'DMSans_600Medium',
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  requirementIcon: {
    marginRight: 8,
  },
  requirementText: {
    fontSize: 13,
  },
});
