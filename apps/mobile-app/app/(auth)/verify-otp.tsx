import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, TouchableWithoutFeedback, Keyboard, useWindowDimensions } from 'react-native';
import { useState, useRef, useEffect } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/contexts/AuthContext";
import { API_URL } from '@/constants/api';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigationStack } from '@/contexts/NavigationStackContext';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';
import { IS_PASSWORD_LOGIN_ENABLED } from '@/constants/authMode';

export default function VerifyOtpScreen() {
    const { width: screenWidth } = useWindowDimensions();
    const router = useRouter();
    const { push, replace, pop, resetStack } = useNavigationStack();
    useAndroidBackHandler();
    const { login } = useAuth();
    const { phone } = useLocalSearchParams<{ phone: string }>();

    const [otp, setOtp] = useState(["", "", "", "", "", ""]);
    const [isLoading, setIsLoading] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const [resendTimer, setResendTimer] = useState(60);

    const inputRefs = useRef<Array<TextInput | null>>([]);

    // Resend countdown timer
    useEffect(() => {
        if (resendTimer <= 0) return;
        const interval = setInterval(() => {
            setResendTimer(prev => prev - 1);
        }, 1000);
        return () => clearInterval(interval);
    }, [resendTimer]);

    const handleOtpChange = (value: string, index: number) => {
        // Strip non-digits
        const digit = value.replace(/\D/g, '').slice(-1);
        const newOtp = [...otp];
        newOtp[index] = digit;
        setOtp(newOtp);

        // Auto-focus next input
        if (digit && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyPress = (e: any, index: number) => {
        if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleResendOtp = async () => {
        if (resendTimer > 0 || isResending) return;

        if (!phone) {
            Alert.alert("Missing Phone", "Phone number is missing. Please go back and try again.");
            return;
        }

        const rawPhone = phone.replace('+', '').replace(/^91/, '');
        setIsResending(true);

        try {
            const response = await fetch(`${API_URL}/auth/send-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: `91${rawPhone}` }),
            });

            const data = await response.json().catch(() => null);

            if (response.ok && data?.success) {
                Alert.alert("OTP Sent", "A new verification code has been sent to your mobile number.");
                setResendTimer(60);
                setOtp(["", "", "", "", "", ""]);
                inputRefs.current[0]?.focus();
            } else if (response.status === 429) {
                Alert.alert("Rate Limit Exceeded", data?.message || "Please wait a few minutes before requesting another OTP.");
            } else {
                Alert.alert("Unable to Resend OTP", data?.message || "Failed to resend code. Please try again.");
            }
        } catch (error) {
            console.error("Resend OTP Error:", error);
            Alert.alert("Connection Error", "Could not connect to server. Please check your internet connection.");
        } finally {
            setIsResending(false);
        }
    };

    const handleVerify = async () => {
        const enteredOtp = otp.join("");
        if (enteredOtp.length !== 6) {
            Alert.alert("Incomplete Code", "Please enter all 6 digits of the verification code.");
            return;
        }

        if (!phone) {
            Alert.alert("Error", "Phone number is missing. Go back and try logging in again.");
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch(`${API_URL}/auth/verify-otp`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ phone, otp: enteredOtp }),
            });

            const data = await response.json().catch(() => null);

            if (response.ok && data?.success) {
                const result = data.data;

                if (result.isNewUser) {
                    if (IS_PASSWORD_LOGIN_ENABLED) {
                        push({ pathname: "/(auth)/register", params: { phone } });
                    } else {
                        push({ pathname: "/(auth)/register-otp", params: { phone } });
                    }
                } else if (result.user) {
                    // PERSIST SESSION via AuthContext
                    await login(result.token, result.user);
                    resetStack();

                    const role = result.user.role;
                    if (role === "care_companion") {
                        replace("/(care-companion)");
                    } else if (role === "beneficiary") {
                        replace("/(beneficiary)");
                    } else {
                        replace("/(subscriber)");
                    }
                }
            } else if (response.status === 429) {
                Alert.alert(
                    "Rate Limit Reached",
                    data?.message || "Too many failed attempts. Please wait a few minutes before trying again."
                );
            } else {
                Alert.alert("Verification Failed", data?.message || "Invalid or expired verification code.");
                setOtp(["", "", "", "", "", ""]);
                inputRefs.current[0]?.focus();
            }
        } catch (error) {
            console.error("Verify OTP Error:", error);
            Alert.alert(
                "Connection Error",
                "Could not connect to the Mai-Hoonaa server. Please check your internet connection."
            );
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <TouchableWithoutFeedback onPress={Platform.OS === 'web' ? undefined : Keyboard.dismiss} accessible={false}>
                    <View style={styles.container}>
                        <View style={styles.header}>
                            <TouchableOpacity onPress={() => {
                                if (router.canGoBack()) {
                                    pop();
                                } else {
                                    replace('/(auth)');
                                }
                            }} style={styles.backButton}>
                                <Ionicons name="arrow-back" size={22} color="#111827" />
                            </TouchableOpacity>
                            <Text style={styles.headerTitle}>Verify Phone</Text>
                            <View style={styles.headerSpacer} />
                        </View>

                        <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 60 }}>

                            <View style={styles.heroTextWrap}>
                                <Text style={styles.title}>Enter Verification Code</Text>
                                <Text style={styles.subtitle}>We've sent a 6-digit code to</Text>
                                <Text style={styles.maskedPhone}>
                                    {phone ? `${phone.slice(0, 3)} ••• ••• ${phone.slice(-4)}` : "+91 ••• ••• 1234"}
                                </Text>
                            </View>

                            <LinearGradient
                                colors={["#FFFFFF", "#FFE2CC"]}
                                start={{ x: 0.5, y: 0 }}
                                end={{ x: 0.5, y: 1 }}
                                style={styles.card}
                            >
                                <View style={styles.otpContainer}>
                                    {otp.map((digit, index) => {
                                        const cardPadding = Math.max(16, screenWidth * 0.07);
                                        const cardWidth = screenWidth - 40;
                                        const gap = Math.max(6, screenWidth * 0.016);
                                        const boxSize = Math.min(52, Math.floor((cardWidth - cardPadding * 2 - gap * 5) / 6));
                                        return (
                                            <TextInput
                                                key={index}
                                                ref={(ref: TextInput | null) => { inputRefs.current[index] = ref; }}
                                                style={[
                                                    styles.otpInput,
                                                    digit ? styles.otpInputFilled : null,
                                                    { width: boxSize, height: Math.min(60, boxSize * 1.1) }
                                                ]}
                                                keyboardType="numeric"
                                                maxLength={1}
                                                value={digit}
                                                onChangeText={(value) => handleOtpChange(value, index)}
                                                onKeyPress={(e) => handleKeyPress(e, index)}
                                                editable={!isLoading && !isResending}
                                            />
                                        );
                                    })}
                                </View>

                                {resendTimer > 0 ? (
                                    <Text style={styles.resendTimer}>
                                        Resend code in {String(Math.floor(resendTimer / 60)).padStart(2, '0')}:{String(resendTimer % 60).padStart(2, '0')}
                                    </Text>
                                ) : (
                                    <TouchableOpacity onPress={handleResendOtp} disabled={isResending || isLoading}>
                                        {isResending ? (
                                            <ActivityIndicator size="small" color="#FE6700" style={{ marginVertical: 8 }} />
                                        ) : (
                                            <Text style={styles.resendLinkActive}>Resend OTP</Text>
                                        )}
                                    </TouchableOpacity>
                                )}

                                <TouchableOpacity
                                    style={[
                                        styles.verifyButton,
                                        isLoading && styles.verifyButtonDisabled,
                                        { width: Math.min(282, screenWidth - 80) }
                                    ]}
                                    onPress={handleVerify}
                                    disabled={isLoading}
                                    activeOpacity={0.85}
                                >
                                    {isLoading ? (
                                        <ActivityIndicator color="#FFFFFF" />
                                    ) : (
                                        <Text style={styles.verifyButtonText}>Verify & Proceed</Text>
                                    )}
                                </TouchableOpacity>
                            </LinearGradient>
                        </View>

                        <Text style={styles.terms}>
                            By continuing, you agree to our{" "}
                            <Text style={styles.termsLink}>Terms of Service</Text>
                            {"\n"}and <Text style={styles.termsLink}>Privacy Policy</Text>
                        </Text>
                    </View>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    container: {
        flex: 1,
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 24,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: 'Poppins-SemiBold',
        color: '#111827',
    },
    headerSpacer: {
        width: 40,
    },
    heroTextWrap: {
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 22,
        fontFamily: 'Poppins-Bold',
        color: '#111827',
        textAlign: 'center',
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 14,
        fontFamily: 'Poppins-Regular',
        color: '#6B7280',
        textAlign: 'center',
    },
    maskedPhone: {
        fontSize: 15,
        fontFamily: 'Poppins-SemiBold',
        color: '#FE6700',
        textAlign: 'center',
        marginTop: 2,
    },
    card: {
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#FFE2CC',
        shadowColor: '#FE6700',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 4,
    },
    otpContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 16,
        width: '100%',
    },
    otpInput: {
        width: 48,
        height: 52,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: '#FFB47D',
        backgroundColor: '#FFFFFF',
        color: '#111111',
        fontSize: 24,
        fontFamily: 'Poppins-Bold',
        textAlign: 'center',
        textAlignVertical: 'center',
        padding: 0,
        includeFontPadding: false,
    },
    otpInputFilled: {
        borderColor: '#FE6700',
        backgroundColor: '#FFF8F4',
    },
    resendTimer: {
        fontSize: 13,
        fontFamily: 'Poppins-Regular',
        color: '#9CA3AF',
        marginBottom: 16,
    },
    resendLinkActive: {
        fontSize: 14,
        fontFamily: 'Poppins-SemiBold',
        color: '#FE6700',
        marginBottom: 16,
        textDecorationLine: 'underline',
    },
    verifyButton: {
        height: 48,
        borderRadius: 10,
        backgroundColor: '#FE6700',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
        shadowColor: '#FE6700',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 3,
    },
    verifyButtonDisabled: {
        backgroundColor: '#FDBA74',
    },
    verifyButtonText: {
        fontSize: 16,
        fontFamily: 'Poppins-SemiBold',
        color: '#FFFFFF',
    },
    terms: {
        fontSize: 12,
        fontFamily: 'Poppins-Regular',
        color: '#9CA3AF',
        textAlign: 'center',
        lineHeight: 18,
    },
    termsLink: {
        color: '#FE6700',
        fontFamily: 'Poppins-Medium',
    },
});
