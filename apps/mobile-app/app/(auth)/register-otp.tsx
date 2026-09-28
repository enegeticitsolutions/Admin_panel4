import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView, TouchableWithoutFeedback, Keyboard
} from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { API_URL } from '@/constants/api';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigationStack } from '@/contexts/NavigationStackContext';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';
import { useSafeBack } from '@/hooks/useSafeBack';

/**
 * OTP Registration Completion Screen  (Production Flow)
 *
 * Reached after phone OTP verification when the user is brand new.
 * Phone is already verified — we only need Name + Age.
 * No pincode, no password.
 *
 * Calls: POST /auth/register-otp  { phone, name, age }
 */
export default function RegisterOtpScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { login } = useAuth();
  const { push, replace, resetStack } = useNavigationStack();
  useAndroidBackHandler();
  const safeBack = useSafeBack();

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCompleteRegistration = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Missing Name', 'Please enter your full name.');
      return;
    }

    const ageNum = parseInt(age, 10);
    if (isNaN(ageNum) || ageNum < 18 || ageNum > 120) {
      Alert.alert('Invalid Age', 'Please enter a valid age (18–120).');
      return;
    }

    if (!phone) {
      Alert.alert('Error', 'Phone number is missing. Please go back and verify again.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/register-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, name: trimmedName, age: ageNum }),
      });

      const data = await response.json();

      if (data.success) {
        const result = data.data;
        await login(result.token, result.user);
        resetStack();

        const role = result.user.role;
        if (role === 'care_companion') {
          replace('/(care-companion)');
        } else if (role === 'beneficiary') {
          replace('/(beneficiary)');
        } else if (role === 'prospect') {
          replace('/(setup)/subscription-packages');
        } else {
          replace('/(subscriber)');
        }
      } else {
        Alert.alert('Registration Failed', data.message || 'Something went wrong.');
      }
    } catch (error) {
      console.error('Register OTP Error:', error);
      Alert.alert('Network Error', 'Could not connect to the server.');
    } finally {
      setIsLoading(false);
    }
  };

  const maskedPhone = phone
    ? `${phone.slice(0, 3)} ••• ••• ${phone.slice(-4)}`
    : '';

  return (
    <SafeAreaView style={styles.safeArea}>
      <TouchableWithoutFeedback onPress={Platform.OS === 'web' ? undefined : Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
        <View style={styles.navHeader}>
          <TouchableOpacity onPress={() => safeBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.navTitle}>Create Account</Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Welcome Header */}
          <View style={styles.welcomeHeader}>
            <Text style={styles.title}>Almost there!</Text>
            <Text style={styles.subtitle}>
              Tell us a bit about yourself to complete your account.
            </Text>
            {maskedPhone ? (
              <View style={styles.phoneVerifiedBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                <Text style={styles.phoneVerifiedText}>
                  Verified: {maskedPhone}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Form Card */}
          <LinearGradient
            colors={['#FFFFFF', '#FFE2CC']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.formCard}
          >
            {/* Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your full name"
                placeholderTextColor="#9CA3AF"
                value={name}
                onChangeText={setName}
                editable={!isLoading}
                autoCapitalize="words"
              />
            </View>

            {/* Age */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Age *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your age (18+)"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                maxLength={3}
                value={age}
                onChangeText={setAge}
                editable={!isLoading}
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]}
              onPress={handleCompleteRegistration}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Complete Sign Up</Text>
              )}
            </TouchableOpacity>
          </LinearGradient>

          <Text style={styles.footerText}>
            By continuing, you agree to our{' '}
            <Text style={styles.footerLink}>Terms of Service</Text>
            {'\n'}and <Text style={styles.footerLink}>Privacy Policy</Text>
          </Text>
        </ScrollView>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
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
  navHeader: {
    height: Platform.OS === 'ios' ? 54 : 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  navTitle: {
    fontSize: 16,
    lineHeight: 24,
    color: '#000000',
    fontFamily: 'Poppins-Regular',
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 40,
    backgroundColor: '#FFFFFF',
  },
  welcomeHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    lineHeight: 32,
    color: '#000000',
    fontFamily: 'Poppins-SemiBold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#667085',
    textAlign: 'center',
    fontFamily: 'Poppins-Regular',
    marginBottom: 16,
  },
  phoneVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  phoneVerifiedText: {
    fontSize: 13,
    color: '#16A34A',
    fontFamily: 'Poppins-Medium',
  },
  formCard: {
    width: '100%',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingTop: 26,
    paddingBottom: 40,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
    color: '#344054',
    fontFamily: 'Poppins-Medium',
    marginBottom: 9,
  },
  input: {
    height: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    fontSize: 16,
    lineHeight: 24,
    color: '#111827',
    fontFamily: 'Poppins-Regular',
  },
  primaryButton: {
    height: 48,
    borderRadius: 8,
    backgroundColor: '#FFA366',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryButtonDisabled: {
    opacity: 0.75,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'Poppins-SemiBold',
  },
  footerText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#9CA3AF',
    textAlign: 'center',
    fontFamily: 'Poppins-Regular',
  },
  footerLink: {
    color: '#FE6700',
  },
});
