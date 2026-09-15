import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView, Linking, Modal } from 'react-native';
import { useState, useEffect, useRef } from "react";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { API_URL } from '@/constants/api';
import { LEGAL_CONFIG } from '@/constants/legal';
import { useSafeBack } from '@/hooks/useSafeBack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigationStack } from '@/contexts/NavigationStackContext';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';
import { useAuth } from '@/contexts/AuthContext';
import { IS_PASSWORD_LOGIN_ENABLED } from '@/constants/authMode';
import { AddressPicker, SelectedAddress } from '@/components/ui/AddressPicker';
import { getAccurateLocation } from '@/services/location';
import { serviceabilityService, ServiceabilityResult } from '@/services/serviceability.service';
import { LegalConsentModal } from '@/components/shared/LegalConsentModal';

export default function RegisterScreen() {
    const { push, replace } = useNavigationStack();
    useAndroidBackHandler();
    const safeBack = useSafeBack();
    const { login } = useAuth();

    const [step, setStep] = useState<'form' | 'otp'>('form');
    const [otp, setOtp] = useState(["", "", "", "", "", ""]);
    const [consentGiven, setConsentGiven] = useState(false);
    const [showLegalModal, setShowLegalModal] = useState(false);
    const [resendTimer, setResendTimer] = useState(60);
    const inputRefs = useRef<Array<TextInput | null>>([]);

    const [form, setForm] = useState({
        name: "",
        email: "",
        phone: "",
        pincode: "",
        address: "",
        age: "",
        password: "",
        latitude: undefined as number | undefined,
        longitude: undefined as number | undefined,
    });

    const [showAddressPicker, setShowAddressPicker] = useState(false);
    const [isDetectingGps, setIsDetectingGps] = useState(false);
    const [isCheckingServiceability, setIsCheckingServiceability] = useState(false);
    const [serviceability, setServiceability] = useState<ServiceabilityResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Resend countdown timer
    useEffect(() => {
        let interval: any;
        if (step === 'otp' && resendTimer > 0) {
            interval = setInterval(() => {
                setResendTimer((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [step, resendTimer]);

    // ── Location & Serviceability Handlers ──────────────────────────────────

    const evaluateServiceability = async (lat?: number, lng?: number, pin?: string) => {
        setIsCheckingServiceability(true);
        try {
            const result = await serviceabilityService.checkLocation(lat, lng, pin);
            setServiceability(result);
        } catch (err) {
            console.error("Serviceability evaluation failed:", err);
            setServiceability(null);
        } finally {
            setIsCheckingServiceability(false);
        }
    };

    const handleAutoDetectLocation = async () => {
        setIsDetectingGps(true);
        try {
            const loc = await getAccurateLocation();
            const resolvedAddress = loc.address || [loc.city, loc.state].filter(Boolean).join(', ') || 'Current Location';
            setForm((prev) => ({
                ...prev,
                address: resolvedAddress,
                pincode: loc.pincode || prev.pincode,
                latitude: loc.latitude,
                longitude: loc.longitude,
            }));
            await evaluateServiceability(loc.latitude, loc.longitude, loc.pincode);
        } catch (err) {
            Alert.alert(
                "GPS Location",
                "Could not automatically detect your location. Please select it on the map."
            );
            setShowAddressPicker(true);
        } finally {
            setIsDetectingGps(false);
        }
    };

    const handleAddressSelected = async (selected: SelectedAddress) => {
        setShowAddressPicker(false);
        setForm((prev) => ({
            ...prev,
            address: selected.address,
            pincode: selected.pincode || prev.pincode,
            latitude: selected.latitude !== 0 ? selected.latitude : prev.latitude,
            longitude: selected.longitude !== 0 ? selected.longitude : prev.longitude,
        }));
        await evaluateServiceability(
            selected.latitude !== 0 ? selected.latitude : undefined,
            selected.longitude !== 0 ? selected.longitude : undefined,
            selected.pincode
        );
    };

    const handleBackPress = () => {
        if (step === 'otp') {
            setStep('form');
        } else {
            safeBack();
        }
    };

    const handleOtpChange = (value: string, index: number) => {
        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        // Auto-focus next input
        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyPress = (e: any, index: number) => {
        if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleResendOtp = async () => {
        if (resendTimer > 0 || isLoading) return;
        const cleanPhone = form.phone.replace(/\D/g, '').slice(-10);
        setIsLoading(true);
        try {
            const response = await fetch(`${API_URL}/auth/send-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: `+91${cleanPhone}` }),
            });
            const data = await response.json();
            if (data.success) {
                setResendTimer(60);
                Alert.alert("Code Sent", "A new verification code has been sent to your phone number.");
            } else {
                Alert.alert("Error", data.message || "Failed to resend verification code.");
            }
        } catch (err) {
            Alert.alert("Network Error", "Could not connect to the backend server.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegister = async () => {
        const cleanPhone = form.phone.replace(/\D/g, '').slice(-10);
        if (!form.name.trim()) {
            Alert.alert("Missing Name", "Please enter your full name.");
            return;
        }
        if (cleanPhone.length !== 10) {
            Alert.alert("Invalid Phone", "Please enter a valid 10-digit phone number.");
            return;
        }
        if (!form.address && !form.pincode) {
            Alert.alert("Location Required", "Please select your service location on the map.");
            return;
        }
        if (serviceability && !serviceability.isServiceable) {
            Alert.alert(
                "Area Not Serviceable",
                "We are not operating in this area yet. Please select a location within our active service regions."
            );
            return;
        }
        const ageNum = parseInt(form.age, 10);
        if (isNaN(ageNum) || ageNum < 18 || ageNum > 120) {
            Alert.alert("Invalid Age", "Please enter a valid age (18+).");
            return;
        }
        if (!consentGiven) {
            Alert.alert(
                "Consent Required",
                "Please accept our Terms of Service and Privacy Policy to continue."
            );
            return;
        }

        if (IS_PASSWORD_LOGIN_ENABLED) {
            if (!form.password || form.password.length < 6) {
                Alert.alert("Weak Password", "Password must be at least 6 characters.");
                return;
            }

            setIsLoading(true);
            try {
                const response = await fetch(`${API_URL}/auth/register-password`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        phone: `+91${cleanPhone}`,
                        name: form.name,
                        email: form.email,
                        age: ageNum,
                        pincode: form.pincode,
                        password: form.password,
                        location: form.address,
                        latitude: form.latitude,
                        longitude: form.longitude,
                    }),
                });

                const data = await response.json();

                if (data.success) {
                    const result = data.data;
                    await login(result.token, result.user);
                    if (result.user.role === 'care_companion') {
                        replace("/(care-companion)");
                    } else if (result.user.role === 'beneficiary') {
                        replace("/(beneficiary)");
                    } else if (result.user.role === 'prospect') {
                        replace("/(setup)/subscription-packages");
                    } else {
                        replace("/(subscriber)");
                    }
                } else {
                    Alert.alert("Registration Failed", data.message || "Something went wrong.");
                }
            } catch (error) {
                console.error("Register Error:", error);
                Alert.alert("Network Error", "Could not connect to the backend server.");
            } finally {
                setIsLoading(false);
            }
        } else {
            // Production mode (password disabled): Send OTP first via exact same /auth/send-otp endpoint as login
            setIsLoading(true);
            try {
                const response = await fetch(`${API_URL}/auth/send-otp`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ phone: `+91${cleanPhone}` }),
                });

                const data = await response.json();

                if (data.success) {
                    setStep('otp');
                    setResendTimer(60);
                    setOtp(["", "", "", "", "", ""]);
                } else {
                    Alert.alert("Verification Error", data.message || "Failed to send verification code.");
                }
            } catch (error) {
                console.error("Send OTP Error:", error);
                Alert.alert("Network Error", "Could not connect to the backend server.");
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleVerifyAndRegister = async () => {
        const cleanPhone = form.phone.replace(/\D/g, '').slice(-10);
        const enteredOtp = otp.join("");
        if (enteredOtp.length !== 6) {
            Alert.alert("Invalid Code", "Please fill in all 6 digits of the verification code.");
            return;
        }

        const ageNum = parseInt(form.age, 10);

        setIsLoading(true);
        try {
            // 1. Verify OTP code via exact same /auth/verify-otp route as login
            const verifyRes = await fetch(`${API_URL}/auth/verify-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: `+91${cleanPhone}`, otp: enteredOtp }),
            });

            const verifyData = await verifyRes.json();

            if (!verifyData.success) {
                Alert.alert("Verification Failed", verifyData.message || "Invalid verification code entered.");
                setIsLoading(false);
                return;
            }

            // 2. Complete OTP registration
            const registerRes = await fetch(`${API_URL}/auth/register-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phone: `+91${cleanPhone}`,
                    name: form.name,
                    email: form.email,
                    age: ageNum,
                    pincode: form.pincode,
                    location: form.address,
                    latitude: form.latitude,
                    longitude: form.longitude,
                }),
            });

            const registerData = await registerRes.json();

            if (registerData.success) {
                const result = registerData.data;
                await login(result.token, result.user);
                if (result.user.role === 'care_companion') {
                    replace("/(care-companion)");
                } else if (result.user.role === 'beneficiary') {
                    replace("/(beneficiary)");
                } else if (result.user.role === 'prospect') {
                    replace("/(setup)/subscription-packages");
                } else {
                    replace("/(subscriber)");
                }
            } else {
                Alert.alert("Registration Failed", registerData.message || "Something went wrong.");
            }
        } catch (error) {
            console.error("Verify & Register Error:", error);
            Alert.alert("Network Error", "Could not connect to the backend server.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={styles.keyboardView}
            >
                <View style={styles.navHeader}>
                    <TouchableOpacity onPress={handleBackPress} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={22} color="#111827" />
                    </TouchableOpacity>
                    <Text style={styles.navTitle}>
                        {step === 'otp' ? 'Verify Mobile Number' : 'Create Account'}
                    </Text>
                    <View style={styles.backBtn} />
                </View>

                <ScrollView
                    contentContainerStyle={styles.container}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {step === 'form' ? (
                        <>
                            <View style={styles.welcomeHeader}>
                                <Text style={styles.title}>Welcome!</Text>
                                <Text style={styles.subtitle}>
                                    Let's set up your account to access personalised care for your loved ones
                                </Text>
                            </View>

                            <LinearGradient
                                colors={["#FFFFFF", "#FFE2CC"]}
                                start={{ x: 0.5, y: 0 }}
                                end={{ x: 0.5, y: 1 }}
                                style={styles.formCard}
                            >
                                {/* Full Name */}
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Full Name *</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Enter your full name"
                                        placeholderTextColor="#9CA3AF"
                                        autoCapitalize="words"
                                        value={form.name}
                                        onChangeText={(text) => setForm({ ...form, name: text })}
                                        editable={!isLoading}
                                    />
                                </View>

                                {/* Email */}
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Email Address</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Enter your email"
                                        placeholderTextColor="#9CA3AF"
                                        autoCapitalize="none"
                                        keyboardType="email-address"
                                        value={form.email}
                                        onChangeText={(text) => setForm({ ...form, email: text })}
                                        editable={!isLoading}
                                    />
                                </View>

                                {/* Phone */}
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Phone Number *</Text>
                                    <View style={styles.phoneRow}>
                                        <View style={styles.countryCodeBox}>
                                            <Text style={styles.countryCodeText}>+91</Text>
                                        </View>
                                        <TextInput
                                            style={styles.phoneInput}
                                            placeholder="Enter 10-digit number"
                                            placeholderTextColor="#9CA3AF"
                                            keyboardType="numeric"
                                            maxLength={10}
                                            value={form.phone}
                                            onChangeText={(text) => setForm({ ...form, phone: text.replace(/\D/g, '') })}
                                            editable={!isLoading}
                                        />
                                    </View>
                                </View>

                                {/* ── Swiggy/Zomato-Style Location Selector ── */}
                                <View style={styles.inputGroup}>
                                    <View style={styles.labelRow}>
                                        <Text style={styles.label}>Service Location *</Text>
                                        {form.address ? (
                                            <TouchableOpacity onPress={() => setShowAddressPicker(true)}>
                                                <Text style={styles.changeLocationText}>Change</Text>
                                            </TouchableOpacity>
                                        ) : null}
                                    </View>

                                    {/* Location Display / Select Box */}
                                    <TouchableOpacity
                                        style={[
                                            styles.locationCard,
                                            serviceability?.isServiceable === true && styles.locationCardSuccess,
                                            serviceability && !serviceability.isServiceable && styles.locationCardError,
                                        ]}
                                        onPress={() => setShowAddressPicker(true)}
                                        activeOpacity={0.8}
                                    >
                                        <View style={styles.locationIconCircle}>
                                            <Ionicons name="location-sharp" size={20} color="#FE6700" />
                                        </View>
                                        <View style={styles.locationTextContainer}>
                                            <Text style={styles.locationTitle} numberOfLines={1}>
                                                {form.address ? form.address : "Select Service Area on Map"}
                                            </Text>
                                            <Text style={styles.locationSubtitle} numberOfLines={1}>
                                                {form.pincode
                                                    ? `Pincode: ${form.pincode} • Tap to view on map`
                                                    : "Tap to search area or pin exact location"}
                                            </Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                                    </TouchableOpacity>

                                    {/* GPS Quick Detect Button */}
                                    <TouchableOpacity
                                        style={styles.gpsDetectBtn}
                                        onPress={handleAutoDetectLocation}
                                        disabled={isDetectingGps}
                                        activeOpacity={0.8}
                                    >
                                        {isDetectingGps ? (
                                            <ActivityIndicator size="small" color="#FE6700" style={{ marginRight: 8 }} />
                                        ) : (
                                            <Ionicons name="navigate-outline" size={16} color="#FE6700" style={{ marginRight: 6 }} />
                                        )}
                                        <Text style={styles.gpsDetectText}>
                                            {isDetectingGps ? "Detecting GPS location..." : "Use Current GPS Location"}
                                        </Text>
                                    </TouchableOpacity>

                                    {/* Checking Indicator */}
                                    {isCheckingServiceability && (
                                        <View style={styles.checkingBox}>
                                            <ActivityIndicator size="small" color="#FE6700" />
                                            <Text style={styles.checkingText}>Verifying service coverage in your region...</Text>
                                        </View>
                                    )}

                                    {/* Serviceable Success Badge */}
                                    {serviceability && serviceability.isServiceable && !isCheckingServiceability && (
                                        <View style={styles.successBox}>
                                            <View style={styles.successHeader}>
                                                <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
                                                <Text style={styles.successMessage}>
                                                    {serviceability.message || `Great! We serve ${serviceability.region?.name || serviceability.location}`}
                                                </Text>
                                            </View>
                                            <View style={styles.successStatsRow}>
                                                <Text style={styles.successCheck}>✓</Text>
                                                <Text style={styles.successStatText}>
                                                    {serviceability.stats.companions} care companions available
                                                </Text>
                                            </View>
                                            <View style={styles.successStatsRow}>
                                                <Text style={styles.successCheck}>✓</Text>
                                                <Text style={styles.successStatText}>
                                                    {serviceability.stats.centers} active care centers
                                                </Text>
                                            </View>
                                        </View>
                                    )}

                                    {/* Unserviceable Warning Badge */}
                                    {serviceability && !serviceability.isServiceable && !isCheckingServiceability && (
                                        <View style={styles.unavailableBox}>
                                            <Ionicons name="alert-circle-outline" size={22} color="#D97706" />
                                            <View style={{ flex: 1, marginLeft: 10 }}>
                                                <Text style={styles.unavailableTitle}>Area Not Yet Serviceable</Text>
                                                <Text style={styles.unavailableText}>
                                                    We haven't expanded to this specific area yet. Please select a location in Delhi NCR or active regions.
                                                </Text>
                                            </View>
                                        </View>
                                    )}
                                </View>

                                {/* Age */}
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Age *</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Enter your age"
                                        placeholderTextColor="#9CA3AF"
                                        keyboardType="numeric"
                                        maxLength={3}
                                        value={form.age}
                                        onChangeText={(text) => setForm({ ...form, age: text })}
                                        editable={!isLoading}
                                    />
                                </View>

                                {/* Password — staging only */}
                                {IS_PASSWORD_LOGIN_ENABLED && (
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Password *</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Secure password (min 6 chars)"
                                            placeholderTextColor="#9CA3AF"
                                            secureTextEntry
                                            value={form.password}
                                            onChangeText={(text) => setForm({ ...form, password: text })}
                                            editable={!isLoading}
                                        />
                                    </View>
                                )}

                                {/* ── Data Consent Checkbox ── */}
                                <TouchableOpacity
                                    style={styles.consentBox}
                                    onPress={() => {
                                        if (!consentGiven) {
                                            setShowLegalModal(true);
                                        } else {
                                            setConsentGiven(false);
                                        }
                                    }}
                                    activeOpacity={0.8}
                                    accessibilityRole="checkbox"
                                    accessibilityLabel="Accept Terms of Service and Privacy Policy"
                                    accessibilityState={{ checked: consentGiven }}
                                >
                                    <View style={[styles.consentCheckbox, consentGiven && styles.consentCheckboxActive]}>
                                        {consentGiven && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
                                    </View>
                                    <Text style={styles.consentText}>
                                        I agree that MaiHoonNa may collect and use my personal information (name, phone, age, and location) to provide elder care coordination services. I have read and accept the{" "}
                                        <Text
                                            style={styles.consentLink}
                                            onPress={(e) => { e.stopPropagation?.(); setShowLegalModal(true); }}
                                        >
                                            Terms of Service & Privacy Policy
                                        </Text>
                                        .
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.primaryButton, (isLoading || !consentGiven) && styles.primaryButtonDisabled]}
                                    onPress={handleRegister}
                                    disabled={isLoading || !consentGiven}
                                    activeOpacity={0.85}
                                >
                                    {isLoading ? (
                                        <ActivityIndicator color="#FFFFFF" />
                                    ) : (
                                        <Text style={styles.primaryButtonText}>
                                            {IS_PASSWORD_LOGIN_ENABLED ? "Create Account" : "Send Verification Code"}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </LinearGradient>
                        </>
                    ) : (
                        /* Step 2: OTP Verification */
                        <>
                            <View style={styles.welcomeHeader}>
                                <Text style={styles.title}>Enter Code</Text>
                                <Text style={styles.subtitle}>
                                    We have sent a 6-digit verification code to{"\n"}
                                    <Text style={{ fontWeight: '600', color: '#111827' }}>+91 {form.phone}</Text>
                                </Text>
                            </View>

                            <LinearGradient
                                colors={["#FFFFFF", "#FFE2CC"]}
                                start={{ x: 0.5, y: 0 }}
                                end={{ x: 0.5, y: 1 }}
                                style={styles.formCard}
                            >
                                <Text style={styles.label}>Verification Code *</Text>
                                <View style={styles.otpRow}>
                                    {otp.map((digit, index) => (
                                        <TextInput
                                            key={index}
                                            ref={(el) => { inputRefs.current[index] = el; }}
                                            style={[styles.otpInput, digit ? styles.otpInputFilled : null]}
                                            keyboardType="numeric"
                                            maxLength={1}
                                            value={digit}
                                            onChangeText={(text) => handleOtpChange(text, index)}
                                            onKeyPress={(e) => handleKeyPress(e, index)}
                                            editable={!isLoading}
                                            autoFocus={index === 0}
                                        />
                                    ))}
                                </View>

                                <TouchableOpacity
                                    style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]}
                                    onPress={handleVerifyAndRegister}
                                    disabled={isLoading}
                                    activeOpacity={0.85}
                                >
                                    {isLoading ? (
                                        <ActivityIndicator color="#FFFFFF" />
                                    ) : (
                                        <Text style={styles.primaryButtonText}>Verify & Create Account</Text>
                                    )}
                                </TouchableOpacity>

                                <View style={styles.otpActionsRow}>
                                    <TouchableOpacity
                                        onPress={handleResendOtp}
                                        disabled={resendTimer > 0 || isLoading}
                                        style={{ paddingVertical: 8 }}
                                    >
                                        <Text style={[styles.resendText, resendTimer > 0 && styles.resendTextDisabled]}>
                                            {resendTimer > 0 ? `Resend code in ${resendTimer}s` : "Resend Code"}
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => setStep('form')}
                                        disabled={isLoading}
                                        style={{ paddingVertical: 8 }}
                                    >
                                        <Text style={styles.changePhoneText}>Edit Details</Text>
                                    </TouchableOpacity>
                                </View>
                            </LinearGradient>
                        </>
                    )}

                    <View style={styles.bottomSection}>
                        <TouchableOpacity
                            style={styles.loginRow}
                            onPress={() => push("/(auth)")}
                        >
                            <Text style={styles.loginTextNormal}>Already have an account? </Text>
                            <Text style={styles.loginTextHighlight}>Login</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* ── Address & Map Picker Modal ── */}
            <Modal visible={showAddressPicker} animationType="slide" transparent={false}>
                <AddressPicker
                    onAddressSelected={handleAddressSelected}
                    onCancel={() => setShowAddressPicker(false)}
                    title="Select Service Location"
                    subtitle="Move the pin to your service address"
                />
            </Modal>

            <LegalConsentModal
                visible={showLegalModal}
                onClose={() => setShowLegalModal(false)}
                onAccept={() => {
                    setConsentGiven(true);
                    setShowLegalModal(false);
                }}
                requireConsent={!consentGiven}
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
    navHeader: {
        height: Platform.OS === "ios" ? 54 : 64,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        backgroundColor: "#FFFFFF",
    },
    backBtn: {
        width: 40,
        height: 40,
        justifyContent: "center",
        alignItems: "flex-start",
    },
    navTitle: {
        fontSize: 16,
        lineHeight: 24,
        color: "#000000",
        fontFamily: "Poppins-Regular",
    },
    container: {
        flexGrow: 1,
        paddingHorizontal: 20,
        paddingTop: 32,
        paddingBottom: 24,
        backgroundColor: "#FFFFFF",
    },
    welcomeHeader: {
        alignItems: "center",
        marginBottom: 28,
    },
    title: {
        fontSize: 24,
        lineHeight: 32,
        color: "#000000",
        fontFamily: "Poppins-SemiBold",
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 15,
        lineHeight: 22,
        color: "#667085",
        textAlign: "center",
        fontFamily: "Poppins-Regular",
    },
    formCard: {
        width: "100%",
        borderRadius: 10,
        paddingHorizontal: 16,
        paddingTop: 26,
        paddingBottom: 36,
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 4,
    },
    inputGroup: {
        marginBottom: 22,
    },
    label: {
        fontSize: 14,
        lineHeight: 20,
        color: "#344054",
        fontFamily: "Poppins-Medium",
        marginBottom: 9,
    },
    input: {
        height: 50,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#D1D5DB",
        backgroundColor: "#FFFFFF",
        paddingHorizontal: 16,
        fontSize: 16,
        lineHeight: 24,
        color: "#111827",
        fontFamily: "Poppins-Regular",
    },
    phoneRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    countryCodeBox: {
        width: 64,
        height: 50,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#D1D5DB",
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
    },
    countryCodeText: {
        fontSize: 14,
        lineHeight: 20,
        color: "#000000",
        fontFamily: "Poppins-Regular",
    },
    phoneInput: {
        flex: 1,
        height: 50,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#D1D5DB",
        backgroundColor: "#FFFFFF",
        paddingHorizontal: 16,
        fontSize: 16,
        lineHeight: 24,
        color: "#111827",
        fontFamily: "Poppins-Regular",
    },
    checkingBox: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 8,
    },
    checkingText: {
        fontSize: 12,
        color: "#667085",
        marginLeft: 8,
        fontFamily: "Poppins-Regular",
    },
    locationPinRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 8,
        marginBottom: 10,
        paddingHorizontal: 2,
    },
    locationPinText: {
        fontSize: 14,
        lineHeight: 20,
        color: "#667085",
        marginLeft: 6,
        fontFamily: "Poppins-Regular",
    },
    successBox: {
        backgroundColor: "#ECFDF3",
        borderWidth: 1,
        borderColor: "#22C55E",
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 15,
        marginBottom: 4,
    },
    successHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 8,
    },
    successMessage: {
        fontSize: 15,
        lineHeight: 22,
        color: "#16A34A",
        marginLeft: 10,
        fontFamily: "Poppins-Regular",
    },
    successStatsRow: {
        flexDirection: "row",
        alignItems: "center",
        marginLeft: 30,
        marginBottom: 2,
    },
    successCheck: {
        fontSize: 14,
        lineHeight: 20,
        color: "#16A34A",
        marginRight: 6,
        fontFamily: "Poppins-Regular",
    },
    successStatText: {
        fontSize: 13,
        lineHeight: 20,
        color: "#16A34A",
        fontFamily: "Poppins-Regular",
    },
    unavailableBox: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFBEB",
        borderWidth: 1,
        borderColor: "#FDE68A",
        borderRadius: 8,
        padding: 14,
        marginBottom: 4,
    },
    unavailableText: {
        flex: 1,
        fontSize: 13,
        color: "#D97706",
        marginLeft: 10,
        lineHeight: 18,
        fontFamily: "Poppins-Regular",
    },
    primaryButton: {
        height: 50,
        borderRadius: 8,
        backgroundColor: "#FFA366",
        alignItems: "center",
        justifyContent: "center",
        marginTop: 4,
    },
    primaryButtonDisabled: {
        opacity: 0.75,
    },
    primaryButtonText: {
        color: "#FFFFFF",
        fontSize: 16,
        lineHeight: 24,
        fontFamily: "Poppins-SemiBold",
    },
    otpRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 24,
    },
    otpInput: {
        width: 44,
        height: 52,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#D1D5DB",
        backgroundColor: "#FFFFFF",
        textAlign: "center",
        fontSize: 20,
        fontWeight: "600",
        color: "#111827",
        fontFamily: "Poppins-SemiBold",
    },
    otpInputFilled: {
        borderColor: "#FE6700",
        backgroundColor: "#FFF5ED",
    },
    otpActionsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 18,
        paddingHorizontal: 4,
    },
    resendText: {
        fontSize: 14,
        color: "#FE6700",
        fontFamily: "Poppins-Medium",
    },
    resendTextDisabled: {
        color: "#9CA3AF",
    },
    changePhoneText: {
        fontSize: 14,
        color: "#6B7280",
        fontFamily: "Poppins-Regular",
    },
    bottomSection: {
        alignItems: "center",
        marginTop: 32,
    },
    loginRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 12,
    },
    loginTextNormal: {
        fontSize: 15,
        lineHeight: 24,
        color: "#6B6B6B",
        fontFamily: "Poppins-Regular",
    },
    loginTextHighlight: {
        fontSize: 15,
        lineHeight: 24,
        color: "#FE6700",
        fontFamily: "Poppins-Medium",
    },
    footerText: {
        fontSize: 13,
        lineHeight: 20,
        color: "#9CA3AF",
        textAlign: "center",
        fontFamily: "Poppins-Regular",
    },
    footerLink: {
        color: "#FE6700",
        textDecorationLine: "underline",
    },
    consentBox: {
        flexDirection: "row",
        alignItems: "flex-start",
        backgroundColor: "#FFF8F3",
        borderWidth: 1,
        borderColor: "#FFD7BC",
        borderRadius: 10,
        padding: 14,
        marginBottom: 18,
        marginTop: 8,
    },
    consentCheckbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: "#D1D5DB",
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
        marginTop: 1,
        flexShrink: 0,
    },
    consentCheckboxActive: {
        backgroundColor: "#FE6700",
        borderColor: "#FE6700",
    },
    consentText: {
        flex: 1,
        fontSize: 12,
        lineHeight: 18,
        color: "#4B5563",
        fontFamily: "Poppins-Regular",
        marginLeft: 10,
    },
    consentLink: {
        color: "#FE6700",
        fontFamily: "Poppins-Medium",
        textDecorationLine: "underline",
    },
    labelRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
    },
    changeLocationText: {
        fontSize: 13,
        color: "#FE6700",
        fontFamily: "Poppins-Medium",
    },
    locationCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderWidth: 1.5,
        borderColor: "#E5E7EB",
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
    },
    locationCardSuccess: {
        borderColor: "#86EFAC",
        backgroundColor: "#F0FDF4",
    },
    locationCardError: {
        borderColor: "#FCA5A5",
        backgroundColor: "#FEF2F2",
    },
    locationIconCircle: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: "#FFF5ED",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    locationTextContainer: {
        flex: 1,
        marginRight: 8,
    },
    locationTitle: {
        fontSize: 14,
        fontWeight: "600",
        color: "#111827",
        fontFamily: "Poppins-Medium",
        marginBottom: 2,
    },
    locationSubtitle: {
        fontSize: 12,
        color: "#6B7280",
        fontFamily: "Poppins-Regular",
    },
    gpsDetectBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FFF5ED",
        borderWidth: 1,
        borderColor: "#FE6700",
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 14,
        marginBottom: 12,
    },
    gpsDetectText: {
        fontSize: 13,
        color: "#FE6700",
        fontFamily: "Poppins-Medium",
    },
    unavailableTitle: {
        fontSize: 14,
        fontWeight: "600",
        color: "#B45309",
        fontFamily: "Poppins-Medium",
        marginBottom: 2,
    },
});
