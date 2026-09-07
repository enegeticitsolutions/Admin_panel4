import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Image,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { API_URL } from '@/constants/api';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigationStack } from '@/contexts/NavigationStackContext';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';
import { IS_PASSWORD_LOGIN_ENABLED } from '@/constants/authMode';
import { LegalConsentModal } from '@/components/shared/LegalConsentModal';

const { width, height } = Dimensions.get('window');
const scale = (size: number) => Math.round((width / 390) * size);
const vscale = (size: number) => Math.round((height / 844) * size);

export default function AuthScreen() {
  const [form, setForm] = useState({
    phone: '',
    password: '',
  });
  const [loginMode, setLoginMode] = useState<'password' | 'otp'>('otp');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showLegal, setShowLegal] = useState(false);
  const { push, replace } = useNavigationStack();
  useAndroidBackHandler();
  const { login } = useAuth();
  const router = useRouter();

  const showDeletedAccountAlert = (customMsg?: string) => {
    Alert.alert(
      'Account Deleted',
      customMsg ||
        'This account has been deleted.\n\nTo reactivate, please contact the Saathi coordinator on aastha@maihoonna.com',
      [
        {
          text: 'Contact Coordinator',
          onPress: () => {
            Linking.openURL('mailto:aastha@maihoonna.com?subject=Reactivate%20Saathi%20Account');
          },
        },
        { text: 'OK', style: 'cancel' },
      ]
    );
  };

  const handleSendOtp = async () => {
    setErrorMessage('');
    if (form.phone.length !== 10) {
      setErrorMessage('Please enter a valid 10-digit phone number.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/sathi/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: `+91${form.phone}`,
        }),
      });

      const data = await response.json();
      if (response.ok || data.success) {
        setOtpSent(true);
      } else {
        const message = data.message || 'Account not found. Please register first.';
        setErrorMessage(message);
        if (response.status === 403 || message.toLowerCase().includes('deleted')) {
          setOtpSent(false);
          showDeletedAccountAlert(message);
        }
      }
    } catch (error) {
      console.error('OTP Send Error:', error);
      setErrorMessage('Could not connect to the backend server.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setErrorMessage('');
    if (otpCode.length < 4) {
      setErrorMessage('Please enter a valid OTP code.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/sathi/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: `+91${form.phone}`,
          otp: otpCode,
        }),
      });

      const data = await response.json();
      if (response.ok || data.success) {
        const result = data.data;
        await login(result.token, result.volunteer || result.user);
        replace('/(sathi)');
      } else {
        const message = data.message || 'Invalid or expired OTP code.';
        setErrorMessage(message);
        if (response.status === 403 || message.toLowerCase().includes('deleted')) {
          showDeletedAccountAlert(message);
        }
      }
    } catch (error) {
      console.error('OTP Verify Error:', error);
      setErrorMessage('Could not connect to the backend server.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordLogin = async () => {
    setErrorMessage('');
    if (form.phone.length !== 10) {
      setErrorMessage('Please enter a valid 10-digit phone number.');
      return;
    }
    if (!form.password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/sathi/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: `+91${form.phone}`,
          password: form.password,
        }),
      });

      const data = await response.json();

      if (response.ok || data.success) {
        const result = data.data;
        // Save session via AuthContext
        await login(result.token, result.volunteer || result.user);
        // Navigate to the volunteer layout
        replace('/(sathi)');
      } else {
        const message = data.message || 'Invalid credentials or review in progress.';
        setErrorMessage(message);
        if (response.status === 403 || message.toLowerCase().includes('deleted')) {
          showDeletedAccountAlert(message);
        }
      }
    } catch (error) {
      console.error('Login Error:', error);
      setErrorMessage('Could not connect to the backend server.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/images/logo_full.png')}
              style={styles.logoFullImage}
            />
          </View>

          {/* Login Card */}
          <LinearGradient
            colors={['#FFFFFF', '#FFE3D1']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.card}
          >
            <Text style={styles.title}>Saathi Login</Text>
            
            {!!errorMessage && (
              <View style={styles.errorContainer}>
                <MaterialCommunityIcons name="alert-circle" size={scale(18)} color="#DC2626" style={{ marginTop: 2 }} />
                <View style={{ flex: 1, marginLeft: scale(8) }}>
                  <Text style={styles.errorText}>{errorMessage}</Text>
                  {errorMessage.toLowerCase().includes('aastha@maihoonna.com') && (
                    <TouchableOpacity
                      onPress={() =>
                        Linking.openURL('mailto:aastha@maihoonna.com?subject=Reactivate%20Saathi%20Account')
                      }
                      style={{ marginTop: scale(6) }}
                    >
                      <Text style={styles.coordinatorLink}>✉️ Contact: aastha@maihoonna.com</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            <Text style={styles.label}>Phone Number</Text>
            <View style={styles.inputRow}>
              <View style={styles.countryCodeContainer}>
                <Text style={styles.countryCode}>+91</Text>
              </View>

              <TextInput
                style={styles.input}
                placeholder="Enter 10-digit number"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                maxLength={10}
                value={form.phone}
                onChangeText={(text) => {
                  setForm({ ...form, phone: text });
                  if (otpSent) setOtpSent(false);
                  if (errorMessage) setErrorMessage('');
                }}
                editable={!isLoading}
              />
            </View>

            {loginMode === 'password' ? (
              <>
                <Text style={styles.label}>Password</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Enter password"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry
                    value={form.password}
                    onChangeText={(text) => {
                      setForm({ ...form, password: text });
                      if (errorMessage) setErrorMessage('');
                    }}
                    editable={!isLoading}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.otpButton, isLoading && styles.otpButtonDisabled]}
                  onPress={handlePasswordLogin}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.otpButtonText}>Log In</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                {otpSent && (
                  <>
                    <Text style={styles.label}>One-Time Password (OTP)</Text>
                    <View style={styles.passwordRow}>
                      <TextInput
                        style={styles.passwordInput}
                        placeholder="Enter OTP code"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="numeric"
                        maxLength={6}
                        value={otpCode}
                        onChangeText={(text) => {
                          setOtpCode(text);
                          if (errorMessage) setErrorMessage('');
                        }}
                        editable={!isLoading}
                      />
                    </View>
                  </>
                )}

                <TouchableOpacity
                  style={[styles.otpButton, isLoading && styles.otpButtonDisabled]}
                  onPress={otpSent ? handleVerifyOtp : handleSendOtp}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.otpButtonText}>
                      {otpSent ? 'Verify & Log In' : 'Send OTP'}
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            {IS_PASSWORD_LOGIN_ENABLED && (
              <TouchableOpacity
                onPress={() => {
                  setLoginMode(loginMode === 'password' ? 'otp' : 'password');
                  setOtpSent(false);
                  setOtpCode('');
                  setErrorMessage('');
                }}
                style={styles.modeToggleBtn}
              >
                <Text style={styles.modeToggleText}>
                  {loginMode === 'password' ? 'Login with OTP' : 'Login with Password'}
                </Text>
              </TouchableOpacity>
            )}
          </LinearGradient>

          {/* Footer */}
          <View style={styles.footer}>
            <View style={styles.signUpRow}>
              <Text style={styles.footerText}>Want to volunteer? </Text>
              <TouchableOpacity onPress={() => push('/(auth)/register')}>
                <Text style={styles.orangeTextBold}>Register as Saathi</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.terms}>
              By continuing, you agree to our{' '}
              <Text style={styles.orangeTextTerms} onPress={() => setShowLegal(true)}>Terms of Service and Privacy Policy</Text>
            </Text>

            <LegalConsentModal
              visible={showLegal}
              onClose={() => setShowLegal(false)}
              onAccept={() => setShowLegal(false)}
              requireConsent={false}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: scale(24),
    paddingTop: vscale(40),
    paddingBottom: scale(32),
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: vscale(32),
  },
  logoFullImage: {
    width: scale(220),
    height: scale(220 / 5.333),
    resizeMode: 'contain',
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: scale(24),
    borderRadius: scale(20),
    borderWidth: 1,
    borderColor: '#FFE3D1',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 2,
  },
  title: {
    fontSize: scale(22),
    fontWeight: '700',
    color: '#111827',
    marginBottom: scale(24),
    textAlign: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    padding: scale(12),
    borderRadius: scale(8),
    marginBottom: scale(16),
  },
  errorText: {
    color: '#DC2626',
    fontSize: scale(13),
    fontWeight: '500',
    lineHeight: scale(18),
  },
  coordinatorLink: {
    color: '#C2410C',
    fontSize: scale(13),
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  label: {
    fontSize: scale(13),
    color: '#4B5563',
    marginBottom: scale(8),
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: scale(8),
    paddingHorizontal: scale(12),
    marginBottom: scale(16),
  },
  countryCodeContainer: {
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    paddingRight: scale(10),
    marginRight: scale(10),
  },
  countryCode: {
    fontSize: scale(15),
    color: '#111827',
    fontWeight: '600',
  },
  input: {
    flex: 1,
    paddingVertical: scale(12),
    fontSize: scale(15),
    color: '#111827',
  },
  passwordRow: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: scale(8),
    paddingHorizontal: scale(12),
    marginBottom: scale(24),
  },
  passwordInput: {
    paddingVertical: scale(12),
    fontSize: scale(15),
    color: '#111827',
  },
  otpButton: {
    backgroundColor: '#FF6F00',
    paddingVertical: scale(14),
    borderRadius: scale(8),
    alignItems: 'center',
  },
  otpButtonDisabled: {
    backgroundColor: '#FFB27A',
  },
  otpButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: scale(16),
  },
  footer: {
    marginTop: vscale(40),
    alignItems: 'center',
    width: '100%',
  },
  signUpRow: {
    flexDirection: 'row',
    marginBottom: scale(20),
  },
  footerText: {
    fontSize: scale(14),
    color: '#4B5563',
  },
  orangeTextBold: {
    color: '#FF6F00',
    fontWeight: '600',
    fontSize: scale(14),
  },
  terms: {
    fontSize: scale(11),
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: scale(16),
  },
  orangeTextTerms: {
    color: '#FF6F00',
  },
  modeToggleBtn: {
    alignSelf: 'center',
    marginTop: scale(16),
  },
  modeToggleText: {
    color: '#FF6F00',
    fontWeight: '700',
    fontSize: scale(14),
  },
});
