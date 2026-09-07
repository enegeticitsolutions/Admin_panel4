import React, { useState, useEffect, useRef } from 'react';
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
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { API_URL } from '@/constants/api';
import { useNavigationStack } from '@/contexts/NavigationStackContext';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';
import { AddressInputField } from '@/components/ui/AddressInputField';
import { useAuth } from '@/contexts/AuthContext';
import { IS_PASSWORD_LOGIN_ENABLED } from '@/constants/authMode';

const { width } = Dimensions.get('window');
const scale = (size: number) => Math.round((width / 390) * size);

const INTEREST_TAGS = ['Music', 'Cooking', 'Reading', 'Gardening', 'Arts & Crafts'];

export default function RegisterVolunteerScreen() {
  const { push, replace, pop } = useNavigationStack();
  useAndroidBackHandler();
  const { login } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    previousExperience: '',
    whyJoin: '',
  });

  const [address, setAddress] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [customInterest, setCustomInterest] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [agreeGuidelines, setAgreeGuidelines] = useState(false);
  const [consentBackground, setConsentBackground] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [resendTimer, setResendTimer] = useState(0);

  const toggleInterest = (tag: string) => {
    if (selectedInterests.includes(tag)) {
      setSelectedInterests(selectedInterests.filter((t) => t !== tag));
    } else {
      setSelectedInterests([...selectedInterests, tag]);
    }
  };

  const handleAddCustomInterest = () => {
    if (customInterest.trim()) {
      const tag = customInterest.trim();
      if (!selectedInterests.includes(tag)) {
        setSelectedInterests([...selectedInterests, tag]);
      }
      setCustomInterest('');
      setShowCustomInput(false);
    }
  };

  const otpInputs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0 && step === 'otp') {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer, step]);

  const handleOtpChange = (text: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    if (text !== '' && index < 5) {
      otpInputs.current[index + 1]?.focus();
    }
    if (text === '' && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: `+91${form.phone}` }),
      });
      const data = await response.json();
      if (response.ok || data.success) {
        setResendTimer(30);
        setOtp(['', '', '', '', '', '']);
      } else {
        Alert.alert('Error', data.message || 'Failed to resend OTP.');
      }
    } catch (error) {
      Alert.alert('Error', 'Could not connect to the server.');
    } finally {
      setIsLoading(false);
    }
  };

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

  const handleVerifyOtp = async () => {
    const code = otp.join('');
    if (code.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter the complete 6-digit OTP.');
      return;
    }
    setIsLoading(true);
    try {
      const registerRes = await fetch(`${API_URL}/sathi/auth/register-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: `+91${form.phone}`, name: form.name, otp: code }),
      });
      const registerData = await registerRes.json();
      
      if (registerRes.ok || registerData.success) {
        const result = registerData.data;
        await login(result.token, result.volunteer || result.user);
        replace('/(sathi)/apply');
      } else {
        const message = registerData.message || 'Failed to create volunteer account.';
        if (registerRes.status === 403 || message.toLowerCase().includes('deleted')) {
          showDeletedAccountAlert(message);
        } else {
          Alert.alert('Registration Failed', message);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Could not connect to the server.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!form.name || !form.phone) {
      Alert.alert('Required Fields', 'Full Name and Phone Number are required.');
      return;
    }
    if (IS_PASSWORD_LOGIN_ENABLED && !form.password) {
      Alert.alert('Required Fields', 'Password is required.');
      return;
    }
    if (form.phone.length !== 10) {
      Alert.alert('Invalid Input', 'Please enter a valid 10-digit phone number.');
      return;
    }

    setIsLoading(true);

    try {
      if (IS_PASSWORD_LOGIN_ENABLED) {
        const response = await fetch(`${API_URL}/sathi/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: `+91${form.phone}`,
            password: form.password,
            name: form.name,
          }),
        });

        const data = await response.json();

        if (response.ok || data.success) {
          const result = data.data;
          await login(result.token, result.volunteer || result.user);
          replace('/(sathi)/apply');
        } else {
          const message = data.message || 'Failed to create account.';
          if (response.status === 403 || message.toLowerCase().includes('deleted')) {
            showDeletedAccountAlert(message);
          } else {
            Alert.alert('Registration Failed', message);
          }
        }
      } else {
        const response = await fetch(`${API_URL}/auth/send-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: `+91${form.phone}`,
          }),
        });

        const data = await response.json();

        if (response.ok || data.success) {
          setStep('otp');
          setResendTimer(30);
          setOtp(['', '', '', '', '', '']);
        } else {
          const message = data.message || 'Failed to send OTP.';
          if (response.status === 403 || message.toLowerCase().includes('deleted')) {
            showDeletedAccountAlert(message);
          } else {
            Alert.alert('Error', message);
          }
        }
      }
    } catch (error) {
      console.error('Registration Error:', error);
      Alert.alert('Network Error', 'Could not connect to the backend server.');
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
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => step === 'otp' ? setStep('form') : pop()} style={styles.backButton}>
              <MaterialCommunityIcons name="arrow-left" size={scale(24)} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.title}>{step === 'otp' ? 'Verify OTP' : 'Register as Saathi'}</Text>
            <Text style={styles.subtitle}>
              {step === 'otp' 
                ? `Enter the 6-digit code sent to +91 ${form.phone}` 
                : 'Join our network of care companions'}
            </Text>
          </View>

          {/* Form */}
          <View style={styles.card}>
            {step === 'form' ? (
              <>
                {/* Full Name */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Full Name *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your full name"
                    placeholderTextColor="#9CA3AF"
                    value={form.name}
                    onChangeText={(text) => setForm({ ...form, name: text })}
                    editable={!isLoading}
                  />
                </View>

                {/* Phone */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Phone Number *</Text>
                  <View style={styles.phoneRow}>
                    <Text style={styles.countryCode}>+91</Text>
                    <TextInput
                      style={styles.phoneInput}
                      placeholder="10-digit mobile number"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                      maxLength={10}
                      value={form.phone}
                      onChangeText={(text) => setForm({ ...form, phone: text })}
                      editable={!isLoading}
                    />
                  </View>
                </View>

                {/* Password */}
                {IS_PASSWORD_LOGIN_ENABLED && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Create Password *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Minimum 6 characters"
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry
                      value={form.password}
                      onChangeText={(text) => setForm({ ...form, password: text })}
                      editable={!isLoading}
                    />
                  </View>
                )}

                {/* Submit */}
                <TouchableOpacity
                  style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
                  onPress={handleRegister}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitButtonText}>{IS_PASSWORD_LOGIN_ENABLED ? 'Create Account' : 'Send OTP'}</Text>
                  )}
                </TouchableOpacity>

                {/* Footer Signin */}
                <TouchableOpacity
                  style={styles.loginLink}
                  onPress={() => replace('/(auth)')}
                  disabled={isLoading}
                >
                  <Text style={styles.loginLinkText}>
                    Already have an account? <Text style={styles.orangeTextBold}>Sign in here</Text>
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.otpContainer}>
                  {otp.map((digit, index) => (
                    <TextInput
                      key={`otp-${index}`}
                      ref={(ref) => {
                        otpInputs.current[index] = ref;
                      }}
                      style={styles.otpInput}
                      value={digit}
                      onChangeText={(text) => handleOtpChange(text, index)}
                      keyboardType="numeric"
                      maxLength={1}
                      selectTextOnFocus
                      editable={!isLoading}
                    />
                  ))}
                </View>
                
                <TouchableOpacity
                  onPress={handleResendOtp}
                  disabled={resendTimer > 0 || isLoading}
                  style={styles.resendContainer}
                >
                  <Text style={[styles.resendText, (resendTimer > 0 || isLoading) && styles.resendTextDisabled]}>
                    {resendTimer > 0 ? `Resend code in ${resendTimer}s` : 'Resend Code'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
                  onPress={handleVerifyOtp}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitButtonText}>Verify & Create Account</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
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
    paddingHorizontal: scale(20),
    paddingTop: scale(20),
    paddingBottom: scale(40),
  },
  header: {
    marginBottom: scale(24),
  },
  backButton: {
    marginBottom: scale(16),
  },
  title: {
    fontSize: scale(26),
    fontWeight: '700',
    color: '#111827',
    marginBottom: scale(6),
  },
  subtitle: {
    fontSize: scale(14),
    color: '#6B7280',
  },
  card: {
    backgroundColor: '#FFF5EE',
    padding: scale(20),
    borderRadius: scale(16),
    borderWidth: 1,
    borderColor: '#FFE3D1',
  },
  inputGroup: {
    marginBottom: scale(20),
  },
  label: {
    fontSize: scale(14),
    color: '#374151',
    fontWeight: '600',
    marginBottom: scale(8),
  },
  helpText: {
    fontSize: scale(12),
    color: '#6B7280',
    marginBottom: scale(12),
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: scale(8),
    paddingHorizontal: scale(14),
    paddingVertical: scale(12),
    fontSize: scale(15),
    color: '#111827',
  },
  textArea: {
    height: scale(80),
    textAlignVertical: 'top',
  },
  phoneRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: scale(8),
    alignItems: 'center',
    paddingHorizontal: scale(12),
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  countryCode: {
    fontSize: scale(15),
    color: '#111827',
    marginRight: scale(8),
    fontWeight: '500',
  },
  phoneInput: {
    flex: 1,
    paddingVertical: scale(12),
    fontSize: scale(15),
    color: '#111827',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(8),
  },
  tag: {
    paddingHorizontal: scale(14),
    paddingVertical: scale(8),
    backgroundColor: '#F3F4F6',
    borderRadius: scale(20),
  },
  tagSelected: {
    backgroundColor: '#FF6F00',
  },
  tagText: {
    fontSize: scale(13),
    color: '#4B5563',
    fontWeight: '500',
  },
  tagTextSelected: {
    color: '#FFFFFF',
  },
  addTag: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  addTagText: {
    fontSize: scale(13),
    color: '#6B7280',
    fontWeight: '500',
  },
  customInterestInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: scale(20),
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingLeft: scale(12),
    height: scale(36),
  },
  customInterestInput: {
    fontSize: scale(13),
    color: '#111827',
    width: scale(90),
  },
  customInterestAddBtn: {
    backgroundColor: '#FF6F00',
    padding: scale(6),
    borderRadius: scale(18),
    marginLeft: scale(4),
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: scale(16),
  },
  checkbox: {
    width: scale(18),
    height: scale(18),
    borderRadius: scale(4),
    borderWidth: 1.5,
    borderColor: '#9CA3AF',
    marginRight: scale(10),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: scale(2),
  },
  checkboxActive: {
    backgroundColor: '#FF6F00',
    borderColor: '#FF6F00',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: scale(13),
    color: '#4B5563',
    lineHeight: scale(18),
  },
  orangeTextBold: {
    color: '#FF6F00',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#FF6F00',
    paddingVertical: scale(14),
    borderRadius: scale(10),
    alignItems: 'center',
    marginTop: scale(12),
  },
  submitButtonDisabled: {
    backgroundColor: '#FFB27A',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: scale(16),
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: scale(20),
  },
  otpInput: {
    width: scale(45),
    height: scale(50),
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: scale(8),
    backgroundColor: '#FFFFFF',
    textAlign: 'center',
    fontSize: scale(20),
    fontWeight: '600',
    color: '#111827',
  },
  resendContainer: {
    alignItems: 'center',
    marginBottom: scale(16),
  },
  resendText: {
    fontSize: scale(14),
    color: '#FF6F00',
    fontWeight: '600',
  },
  resendTextDisabled: {
    color: '#9CA3AF',
  },
  loginLink: {
    marginTop: scale(20),
    alignItems: 'center',
  },
  loginLinkText: {
    fontSize: scale(14),
    color: '#4B5563',
  },
});
