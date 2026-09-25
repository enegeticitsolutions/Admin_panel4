import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView, Dimensions, Image, TouchableWithoutFeedback, Keyboard, Linking } from 'react-native';
import { useState, useEffect } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '@/constants/api';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigationStack } from '@/contexts/NavigationStackContext';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';
import { useAuth } from '@/contexts/AuthContext';
import { IS_PASSWORD_LOGIN_ENABLED } from '@/constants/authMode';
import { CountryPickerModal } from '@/components/ui/CountryPickerModal';

const { width, height } = Dimensions.get('window');
const BASE_WIDTH = 390;
const scale = (size: number) => Math.round((width / BASE_WIDTH) * size);
const vscale = (size: number) => Math.round((height / 844) * size);

type BiometricKind = 'face' | 'fingerprint' | 'biometric';

export default function AuthScreen() {
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("91");
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [biometricType, setBiometricType] = useState<BiometricKind>('biometric');
  const [hasBiometricsSetup, setHasBiometricsSetup] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState(false);


  const { push } = useNavigationStack();
  useAndroidBackHandler();
  const { login } = useAuth();
  const { message } = useLocalSearchParams();

  useEffect(() => {
    if (message) {
      Alert.alert("Login Required", message as string);
    }
  }, [message]);

  // Detect device biometric capabilities on mount
  useEffect(() => {
    const detectBiometrics = async () => {
      if (Platform.OS === 'web') return;
      try {
        const hasHw = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();

        if (hasHw) {
          const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
          if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
            setBiometricType('face');
          } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
            setBiometricType('fingerprint');
          } else {
            setBiometricType('biometric');
          }
        }

        const secureToken = await SecureStore.getItemAsync('secureUserToken');
        const secureUser = await SecureStore.getItemAsync('secureUserData');
        const isReady = Boolean(hasHw && isEnrolled && secureToken && secureUser);
        setHasBiometricsSetup(isReady);
      } catch (e) {
        console.warn('[Biometrics] Detection note:', e);
      }
    };
    detectBiometrics();
  }, []);

  const getBiometricButtonTitle = () => {
    switch (biometricType) {
      case 'face':
        return 'Login with Face ID';
      case 'fingerprint':
        return 'Login with Fingerprint';
      default:
        return 'Biometric Login';
    }
  };

  const getBiometricIconName = (): keyof typeof MaterialCommunityIcons.glyphMap => {
    switch (biometricType) {
      case 'face':
        return 'face-recognition';
      case 'fingerprint':
        return 'fingerprint';
      default:
        return 'shield-account-outline';
    }
  };

  const handleBiometricLogin = async (silent = false) => {
    if (Platform.OS === 'web') return;
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) {
        if (!silent) {
          Alert.alert("Biometrics Not Supported", "Your device does not support biometric authentication.");
        }
        return;
      }

      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!isEnrolled) {
        if (!silent) {
          Alert.alert(
            "Biometrics Not Enrolled",
            "No biometrics registered on this device. Please set up Face ID or Fingerprint in your device Settings."
          );
        }
        return;
      }

      const secureToken = await SecureStore.getItemAsync('secureUserToken');
      const secureUser = await SecureStore.getItemAsync('secureUserData');

      if (!secureToken || !secureUser) {
        if (!silent) {
          Alert.alert(
            "First Login Required",
            "Please log in with your phone number and OTP once to enable biometric login on this device."
          );
        }
        return;
      }

      const promptLabel = biometricType === 'face'
        ? "Authenticate with Face ID"
        : biometricType === 'fingerprint'
        ? "Authenticate with Fingerprint"
        : "Login to Mai-Hoonaa";

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: promptLabel,
        fallbackLabel: "Use OTP",
        cancelLabel: "Cancel",
        disableDeviceFallback: false,
      });

      if (result.success) {
        let parsedUser: any;
        try {
          parsedUser = JSON.parse(secureUser);
        } catch {
          parsedUser = { role: 'subscriber' };
        }
        await login(secureToken, parsedUser);
      } else {
        const errType = (result as any).error;
        if (errType === 'user_cancel' || errType === 'system_cancel' || errType === 'app_cancel') {
          // User tapped cancel — do not show error alert
          return;
        }
        if (errType === 'lockout' || errType === 'lockout_permanent') {
          if (!silent) {
            Alert.alert(
              "Biometrics Locked",
              "Too many failed attempts. Please login using your phone number and OTP."
            );
          }
          return;
        }
        if (!silent) {
          Alert.alert(
            "Authentication Failed",
            "Biometric verification did not match. Please try again or use your phone number."
          );
        }
      }
    } catch (error) {
      console.error("Biometric error:", error);
      if (!silent) {
        Alert.alert("Biometric Error", "An error occurred during biometric login. Please log in using OTP.");
      }
    }
  };

  const handleLogin = async () => {
    const cleanedPhone = phone.trim().replace(/\D/g, '');
    if (cleanedPhone.length < 5) {
      Alert.alert("Invalid Phone Number", "Please enter a valid mobile number.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: `${countryCode}${cleanedPhone}` }),
      });

      const data = await response.json().catch(() => null);

      if (response.ok && data?.success) {
        push({
          pathname: "/(auth)/verify-otp",
          params: { phone: `+${countryCode}${cleanedPhone}` },
        });
      } else if (response.status === 429) {
        Alert.alert(
          "Rate Limit Exceeded",
          data?.message || "Too many OTP requests from this device. Please wait a few minutes before trying again."
        );
      } else {
        Alert.alert(
          "Verification Error",
          data?.message || "Failed to send verification code. Please check your mobile number and try again."
        );
      }
    } catch (error) {
      console.error("Login API Error:", error);
      Alert.alert(
        "Network Connection Error",
        "Could not connect to the Mai-Hoonaa server. Please check your internet connection."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <TouchableWithoutFeedback onPress={Platform.OS === 'web' ? undefined : Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
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
                source={require("../../assets/images/logo_full.png")}
                style={styles.logoFullImage}
              />
            </View>

            {/* Login Card */}
            <LinearGradient
              colors={["#FFFFFF", "#FFE3D1"]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.card}
            >
              <Text style={styles.title}>Login with Phone</Text>

              <Text style={styles.label}>Phone Number</Text>
              <View style={styles.inputRow}>
                <TouchableOpacity 
                  style={[styles.countryCodeContainer, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]}
                  onPress={() => setShowCountryPicker(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.countryCode}>+{countryCode}</Text>
                  <Ionicons name="chevron-down" size={14} color="#6B7280" style={{ marginLeft: 4 }} />
                </TouchableOpacity>

                <TextInput
                  style={styles.input}
                  placeholder="Enter mobile number"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  maxLength={15}
                  value={phone}
                  onChangeText={(text) => setPhone(text.replace(/\D/g, ''))}
                  editable={!isLoading}
                />
              </View>

              <TouchableOpacity
                style={[styles.otpButton, isLoading && styles.otpButtonDisabled]}
                onPress={handleLogin}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.otpButtonText}>Send OTP</Text>
                )}
              </TouchableOpacity>
            </LinearGradient>

            {/* Password Login — staging / dev only */}
            {IS_PASSWORD_LOGIN_ENABLED && (
              <TouchableOpacity
                style={styles.passwordButton}
                onPress={() => push("/(auth)/login-password" as any)}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="lock-outline" size={scale(22)} color="#111827" style={{ marginRight: scale(8) }} />
                <Text style={styles.passwordButtonText}>Login with Password</Text>
              </TouchableOpacity>
            )}

            {/* Footer */}
            <View style={styles.footer}>
              <View style={styles.signUpRow}>
                <Text style={styles.footerText}>Don't have an account? </Text>
                <TouchableOpacity onPress={() => push("/(auth)/register")}>
                  <Text style={styles.orangeTextBold}>Sign Up</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.browseButton}
                onPress={() => push("/(setup)/subscription-packages")}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="package-variant-closed" size={scale(22)} color="#FF8E4D" />
                <Text style={styles.browseButtonText}>Browse Packages</Text>
              </TouchableOpacity>

              <Text style={styles.terms}>
                By continuing, you agree to our{"\n"}
                <Text style={styles.orangeTextTerms} onPress={() => Linking.openURL('https://maihoonna.com/terms')}>
                  Terms of Service
                </Text>
                {' & '}
                <Text style={styles.orangeTextTerms} onPress={() => Linking.openURL('https://maihoonna.com/privacy')}>
                  Privacy Policy
                </Text>
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
      
      <CountryPickerModal
        visible={showCountryPicker}
        onClose={() => setShowCountryPicker(false)}
        selectedCode={countryCode}
        onSelect={setCountryCode}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: scale(24),
    paddingTop: vscale(40),
    paddingBottom: scale(32),
    alignItems: "center",
  },

  /* Logo */
  logoContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: vscale(32),
  },
  logoFullImage: {
    width: scale(220),
    height: scale(220 / 5.333),
    resizeMode: 'contain',
  },

  /* Card */
  card: {
    width: "100%",
    borderRadius: scale(16),
    paddingHorizontal: scale(28),
    paddingTop: scale(30),
    paddingBottom: scale(36),
    borderWidth: 1,
    borderColor: "#FFE2CC",
    shadowColor: "#FE6700",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  title: {
    fontSize: scale(22),
    lineHeight: scale(30),
    color: "#000000",
    textAlign: "center",
    fontFamily: "Poppins-SemiBold",
    marginBottom: scale(24),
  },
  label: {
    fontSize: scale(14),
    lineHeight: scale(20),
    color: "#1F2937",
    fontFamily: "Poppins-Medium",
    marginBottom: scale(8),
    alignSelf: 'flex-start',
  },
  inputRow: {
    flexDirection: "row",
    gap: scale(8),
    marginBottom: scale(14),
  },
  countryCodeContainer: {
    width: scale(76),
    height: scale(48),
    borderRadius: scale(10),
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
  },
  countryCode: {
    fontSize: scale(15),
    color: "#111827",
    fontFamily: "Poppins-Medium",
  },
  input: {
    flex: 1,
    height: scale(48),
    borderRadius: scale(10),
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: scale(14),
    fontSize: scale(15),
    color: "#111827",
    fontFamily: "Poppins-Regular",
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any, cursor: 'text' as any } : {}),
  },
  otpButton: {
    height: scale(50),
    borderRadius: scale(10),
    backgroundColor: "#FF8E4D",
    justifyContent: "center",
    alignItems: "center",
    marginTop: scale(8),
    shadowColor: "#FF8E4D",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  otpButtonDisabled: {
    backgroundColor: "#FFBFA0",
  },
  otpButtonText: {
    fontSize: scale(16),
    color: "#FFFFFF",
    fontFamily: "Poppins-SemiBold",
  },

  /* Divider */
  dividerRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    marginTop: vscale(28),
    marginBottom: vscale(24),
    paddingHorizontal: scale(4),
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5E7EB",
  },
  dividerText: {
    marginHorizontal: scale(16),
    fontSize: scale(14),
    color: "#6B7280",
    fontFamily: "Poppins-Medium",
  },

  /* Buttons */
  bioButton: {
    width: "100%",
    height: scale(50),
    borderRadius: scale(10),
    backgroundColor: "#000000",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: scale(10),
    marginBottom: scale(14),
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  bioButtonText: {
    fontSize: scale(16),
    color: "#FFFFFF",
    fontFamily: "Poppins-SemiBold",
  },
  passwordButton: {
    width: "100%",
    height: scale(50),
    borderRadius: scale(10),
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: scale(20),
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  passwordButtonText: {
    fontSize: scale(16),
    color: "#111827",
    fontFamily: "Poppins-SemiBold",
  },

  /* Footer */
  footer: {
    width: "100%",
    alignItems: "center",
    marginTop: vscale(24),
  },
  signUpRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: scale(16),
  },
  footerText: {
    fontSize: scale(15),
    color: "#6B7280",
    fontFamily: "Poppins-Regular",
  },
  orangeTextBold: {
    fontSize: scale(15),
    color: "#FE6700",
    fontFamily: "Poppins-SemiBold",
  },
  browseButton: {
    width: "100%",
    height: scale(50),
    borderRadius: scale(10),
    borderWidth: 1,
    borderColor: "#FF8E4D",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: scale(10),
    marginBottom: scale(24),
  },
  browseButtonText: {
    fontSize: scale(16),
    color: "#FF8E4D",
    fontFamily: "Poppins-SemiBold",
  },
  terms: {
    fontSize: scale(12),
    lineHeight: scale(18),
    color: "#9CA3AF",
    textAlign: "center",
    fontFamily: "Poppins-Regular",
  },
  orangeTextTerms: {
    color: "#FF8E4D",
    fontFamily: "Poppins-Medium",
  },
});
