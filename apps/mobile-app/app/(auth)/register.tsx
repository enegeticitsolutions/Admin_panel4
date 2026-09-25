import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView, Linking, Modal, FlatList } from 'react-native';
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
import { getAccurateLocation, getCurrentLocation } from '@/services/location';
import { serviceabilityService, ServiceabilityResult } from '@/services/serviceability.service';
import { LegalConsentModal } from '@/components/shared/LegalConsentModal';
import { CountryPickerModal } from '@/components/ui/CountryPickerModal';

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
    const [regions, setRegions] = useState<any[]>([]);
    const [showRegionModal, setShowRegionModal] = useState(false);
    
    const [countryCode, setCountryCode] = useState("91");
    const [showCountryPicker, setShowCountryPicker] = useState(false);

    useEffect(() => {
        const fetchRegions = async () => {
            try {
                const url = `${API_URL}/public/zones/regions`;
                console.log("[Regions] Fetching from:", url);
                const response = await fetch(url);
                const json = await response.json();
                console.log("[Regions] Response:", JSON.stringify(json));
                if (json.success && Array.isArray(json.data) && json.data.length > 0) {
                    setRegions(json.data);
                } else {
                    console.warn("[Regions] No regions returned or fetch failed:", json);
                }
            } catch (error) {
                console.error("[Regions] Error fetching regions:", error);
            }
        };
        fetchRegions();
    }, []);

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
        setServiceability(null);
        try {
            // Use raw GPS only — no reverse geocoding needed, we match against our regions list
            const coords = await getCurrentLocation();

            // Haversine: find nearest region
            let matchedRegion: any = null;
            let minDist = Infinity;
            for (const r of regions) {
                const dLat = (r.latitude - coords.latitude) * (Math.PI / 180);
                const dLng = (r.longitude - coords.longitude) * (Math.PI / 180);
                const a =
                    Math.sin(dLat / 2) ** 2 +
                    Math.cos(coords.latitude * (Math.PI / 180)) *
                        Math.cos(r.latitude * (Math.PI / 180)) *
                        Math.sin(dLng / 2) ** 2;
                const dist = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                if (dist < minDist) {
                    minDist = dist;
                    matchedRegion = r;
                }
            }

            if (matchedRegion) {
                setForm((prev) => ({
                    ...prev,
                    address: matchedRegion.name,
                    pincode: "",
                    latitude: matchedRegion.latitude,
                    longitude: matchedRegion.longitude,
                }));
                await evaluateServiceability(matchedRegion.latitude, matchedRegion.longitude, undefined);
            } else {
                await evaluateServiceability(coords.latitude, coords.longitude, undefined);
            }
        } catch (err) {
            Alert.alert(
                "Location Access",
                "Could not detect your location. Please allow location permission and try again, or select a region manually."
            );
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
                body: JSON.stringify({ phone: `+${countryCode}${cleanPhone}` }),
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
                        phone: `+${countryCode}${cleanPhone}`,
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
                    body: JSON.stringify({ phone: `+${countryCode}${cleanPhone}` }),
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
                body: JSON.stringify({ phone: `+${countryCode}${cleanPhone}`, otp: enteredOtp }),
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
                    phone: `+${countryCode}${cleanPhone}`,
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
                                        <TouchableOpacity 
                                            style={[styles.countryCodeBox, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]}
                                            onPress={() => setShowCountryPicker(true)}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={styles.countryCodeText}>+{countryCode}</Text>
                                            <Ionicons name="chevron-down" size={14} color="#6B7280" style={{ marginLeft: 4 }} />
                                        </TouchableOpacity>
                                        <TextInput
                                            style={styles.phoneInput}
                                            placeholder="Enter mobile number"
                                            placeholderTextColor="#9CA3AF"
                                            keyboardType="numeric"
                                            maxLength={15}
                                            value={form.phone}
                                            onChangeText={(text) => setForm({ ...form, phone: text.replace(/\D/g, '') })}
                                            editable={!isLoading}
                                        />
                                    </View>
                                </View>

                                {/* ── Regions Dropdown ── */}
                                <View style={styles.inputGroup}>
                                    <View style={styles.regionLabelRow}>
                                        <Text style={styles.label}>Our serviceable regions *</Text>
                                        {/* Auto-detect pill */}
                                        <TouchableOpacity
                                            style={styles.gpsAutoBtn}
                                            onPress={handleAutoDetectLocation}
                                            disabled={isDetectingGps || isLoading}
                                            activeOpacity={0.75}
                                        >
                                            {isDetectingGps ? (
                                                <ActivityIndicator size={12} color="#FE6700" style={{ marginRight: 5 }} />
                                            ) : (
                                                <Ionicons name="navigate" size={13} color="#FE6700" style={{ marginRight: 4 }} />
                                            )}
                                            <Text style={styles.gpsAutoBtnText}>
                                                {isDetectingGps ? "Detecting..." : "Auto-detect"}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>

                                    {/* Custom Dropdown Trigger */}
                                    <TouchableOpacity
                                        style={[
                                            styles.regionDropdownTrigger,
                                            form.address ? styles.regionDropdownTriggerActive : null,
                                        ]}
                                        onPress={() => setShowRegionModal(true)}
                                        activeOpacity={0.8}
                                        disabled={isLoading}
                                    >
                                        <View style={styles.regionDropdownLeft}>
                                            <View style={[styles.regionDropdownIcon, form.address ? styles.regionDropdownIconActive : null]}>
                                                <Ionicons
                                                    name="location-sharp"
                                                    size={16}
                                                    color={form.address ? "#FE6700" : "#9CA3AF"}
                                                />
                                            </View>
                                            <Text
                                                style={[
                                                    styles.regionDropdownText,
                                                    form.address ? styles.regionDropdownTextSelected : null,
                                                ]}
                                                numberOfLines={1}
                                            >
                                                {form.address || "Select a region..."}
                                            </Text>
                                        </View>
                                        <Ionicons
                                            name="chevron-down"
                                            size={18}
                                            color={form.address ? "#FE6700" : "#9CA3AF"}
                                        />
                                    </TouchableOpacity>

                                    {/* Region Picker Modal */}
                                    <Modal
                                        visible={showRegionModal}
                                        transparent
                                        animationType="slide"
                                        onRequestClose={() => setShowRegionModal(false)}
                                    >
                                        <TouchableOpacity
                                            style={styles.regionModalOverlay}
                                            activeOpacity={1}
                                            onPress={() => setShowRegionModal(false)}
                                        >
                                            <View style={styles.regionModalSheet}>
                                                {/* Handle bar */}
                                                <View style={styles.regionModalHandle} />

                                                {/* Header */}
                                                <View style={styles.regionModalHeader}>
                                                    <View style={styles.regionModalHeaderLeft}>
                                                        <View style={styles.regionModalHeaderIcon}>
                                                            <Ionicons name="location-sharp" size={20} color="#FE6700" />
                                                        </View>
                                                        <View>
                                                            <Text style={styles.regionModalTitle}>Select Your Region</Text>
                                                            <Text style={styles.regionModalSubtitle}>{regions.length} regions available</Text>
                                                        </View>
                                                    </View>
                                                    <TouchableOpacity
                                                        style={styles.regionModalClose}
                                                        onPress={() => setShowRegionModal(false)}
                                                    >
                                                        <Ionicons name="close" size={20} color="#6B7280" />
                                                    </TouchableOpacity>
                                                </View>

                                                {/* Divider */}
                                                <View style={styles.regionModalDivider} />

                                                {/* Region List */}
                                                <FlatList
                                                    data={regions}
                                                    keyExtractor={(item) => item.id}
                                                    showsVerticalScrollIndicator={false}
                                                    contentContainerStyle={{ paddingBottom: 24 }}
                                                    renderItem={({ item }) => {
                                                        const isSelected = form.address === item.name;
                                                        return (
                                                            <TouchableOpacity
                                                                style={[
                                                                    styles.regionItem,
                                                                    isSelected ? styles.regionItemSelected : null,
                                                                ]}
                                                                activeOpacity={0.7}
                                                                onPress={() => {
                                                                    setForm(prev => ({
                                                                        ...prev,
                                                                        address: item.name,
                                                                        pincode: "",
                                                                        latitude: item.latitude || undefined,
                                                                        longitude: item.longitude || undefined,
                                                                    }));
                                                                    evaluateServiceability(item.latitude, item.longitude, undefined);
                                                                    setShowRegionModal(false);
                                                                }}
                                                            >
                                                                <View style={[
                                                                    styles.regionItemIconWrap,
                                                                    isSelected ? styles.regionItemIconWrapSelected : null,
                                                                ]}>
                                                                    <Ionicons
                                                                        name={isSelected ? "location-sharp" : "location-outline"}
                                                                        size={18}
                                                                        color={isSelected ? "#FE6700" : "#9CA3AF"}
                                                                    />
                                                                </View>
                                                                <View style={{ flex: 1 }}>
                                                                    <Text style={[
                                                                        styles.regionItemName,
                                                                        isSelected ? styles.regionItemNameSelected : null,
                                                                    ]}>{item.name}</Text>
                                                                    <Text style={styles.regionItemSub}>{item.city}, {item.state}</Text>
                                                                </View>
                                                                {isSelected && (
                                                                    <Ionicons name="checkmark-circle" size={22} color="#FE6700" />
                                                                )}
                                                            </TouchableOpacity>
                                                        );
                                                    }}
                                                />
                                            </View>
                                        </TouchableOpacity>
                                    </Modal>

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
                                            <View style={styles.successRow}>
                                                <View style={styles.successIconWrap}>
                                                    <Ionicons name="checkmark-circle" size={22} color="#16A34A" />
                                                </View>
                                                <View style={styles.successTextWrap}>
                                                    <Text style={styles.successTitle}>Great news! We're in your area</Text>
                                                    <Text style={styles.successMessage} numberOfLines={2}>
                                                        {serviceability.message || `We serve ${serviceability.region?.name || serviceability.location}`}
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>
                                    )}

                                    {/* Unserviceable Warning Badge */}
                                    {serviceability && !serviceability.isServiceable && !isCheckingServiceability && (
                                        <View style={styles.unavailableBox}>
                                            <View style={styles.unavailableIconWrap}>
                                                <Ionicons name="alert-circle" size={22} color="#D97706" />
                                            </View>
                                            <View style={styles.unavailableTextWrap}>
                                                <Text style={styles.unavailableTitle}>Area Not Yet Serviceable</Text>
                                                <Text style={styles.unavailableText}>
                                                    We haven't expanded here yet. Please choose an active region.
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
                                            onPress={(e) => { e.stopPropagation?.(); Linking.openURL('https://maihoonna.com/terms'); }}
                                        >
                                            Terms of Service
                                        </Text>
                                        {" & "}
                                        <Text
                                            style={styles.consentLink}
                                            onPress={(e) => { e.stopPropagation?.(); Linking.openURL('https://maihoonna.com/privacy'); }}
                                        >
                                            Privacy Policy
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
                                    <Text style={{ fontWeight: '600', color: '#111827' }}>+{countryCode} {form.phone}</Text>
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
            
            <CountryPickerModal
                visible={showCountryPicker}
                onClose={() => setShowCountryPicker(false)}
                selectedCode={countryCode}
                onSelect={setCountryCode}
            />

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
        width: 76,
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
    inputWrapper: {
        height: 50,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#D1D5DB",
        backgroundColor: "#FFFFFF",
        justifyContent: "center",
    },
    // ── Region Dropdown Trigger ──────────────────────────────────────────────
    // ── Label Row with Auto-detect Pill ────────────────────────────────────
    regionLabelRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 9,
    },
    gpsAutoBtn: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFF5EE",
        borderWidth: 1,
        borderColor: "#FDBA74",
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    gpsAutoBtnText: {
        fontSize: 12,
        fontFamily: "Poppins-Medium",
        color: "#FE6700",
    },
    regionDropdownTrigger: {
        height: 54,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: "#D1D5DB",
        backgroundColor: "#FFFFFF",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 14,
    },
    regionDropdownTriggerActive: {
        borderColor: "#FE6700",
        backgroundColor: "#FFF9F5",
    },
    regionDropdownLeft: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
    },
    regionDropdownIcon: {
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: "#F3F4F6",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 10,
    },
    regionDropdownIconActive: {
        backgroundColor: "#FFF0E6",
    },
    regionDropdownText: {
        fontSize: 15,
        color: "#9CA3AF",
        fontFamily: "Poppins-Regular",
        flex: 1,
    },
    regionDropdownTextSelected: {
        color: "#111827",
        fontFamily: "Poppins-Medium",
    },
    // ── Region Modal ─────────────────────────────────────────────────────────
    regionModalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.45)",
        justifyContent: "flex-end",
    },
    regionModalSheet: {
        backgroundColor: "#FFFFFF",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 12,
        maxHeight: "75%",
    },
    regionModalHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: "#E5E7EB",
        alignSelf: "center",
        marginBottom: 16,
    },
    regionModalHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        marginBottom: 12,
    },
    regionModalHeaderLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    regionModalHeaderIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: "#FFF0E6",
        alignItems: "center",
        justifyContent: "center",
    },
    regionModalTitle: {
        fontSize: 16,
        fontFamily: "Poppins-SemiBold",
        color: "#111827",
    },
    regionModalSubtitle: {
        fontSize: 12,
        fontFamily: "Poppins-Regular",
        color: "#9CA3AF",
        marginTop: 1,
    },
    regionModalClose: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: "#F3F4F6",
        alignItems: "center",
        justifyContent: "center",
    },
    regionModalDivider: {
        height: 1,
        backgroundColor: "#F3F4F6",
        marginBottom: 4,
    },
    // ── Region List Items ────────────────────────────────────────────────────
    regionItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingVertical: 14,
        gap: 14,
    },
    regionItemSelected: {
        backgroundColor: "#FFF5EE",
    },
    regionItemIconWrap: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: "#F3F4F6",
        alignItems: "center",
        justifyContent: "center",
    },
    regionItemIconWrapSelected: {
        backgroundColor: "#FFF0E6",
    },
    regionItemName: {
        fontSize: 14,
        fontFamily: "Poppins-Medium",
        color: "#111827",
    },
    regionItemNameSelected: {
        color: "#FE6700",
    },
    regionItemSub: {
        fontSize: 12,
        fontFamily: "Poppins-Regular",
        color: "#9CA3AF",
        marginTop: 1,
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
        backgroundColor: "#F0FDF4",
        borderWidth: 1.5,
        borderColor: "#86EFAC",
        borderRadius: 12,
        padding: 14,
        marginTop: 10,
    },
    successRow: {
        flexDirection: "row",
        alignItems: "flex-start",
    },
    successIconWrap: {
        marginRight: 10,
        marginTop: 1,
    },
    successTextWrap: {
        flex: 1,
    },
    successTitle: {
        fontSize: 13,
        fontFamily: "Poppins-SemiBold",
        color: "#15803D",
        marginBottom: 2,
    },
    successMessage: {
        fontSize: 13,
        lineHeight: 19,
        color: "#16A34A",
        fontFamily: "Poppins-Regular",
        flexShrink: 1,
    },
    successHeader: {
        flexDirection: "row",
        alignItems: "flex-start",
    },
    successStatsRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 4,
    },
    successCheck: {
        fontSize: 14,
        color: "#16A34A",
        marginRight: 6,
        fontFamily: "Poppins-Regular",
    },
    successStatText: {
        fontSize: 13,
        color: "#16A34A",
        fontFamily: "Poppins-Regular",
        flex: 1,
    },
    unavailableBox: {
        flexDirection: "row",
        alignItems: "flex-start",
        backgroundColor: "#FFFBEB",
        borderWidth: 1.5,
        borderColor: "#FCD34D",
        borderRadius: 12,
        padding: 14,
        marginTop: 10,
    },
    unavailableIconWrap: {
        marginRight: 10,
        marginTop: 1,
    },
    unavailableTextWrap: {
        flex: 1,
    },
    unavailableTitle: {
        fontSize: 13,
        fontFamily: "Poppins-SemiBold",
        color: "#92400E",
        marginBottom: 2,
    },
    unavailableText: {
        fontSize: 12,
        color: "#D97706",
        lineHeight: 18,
        fontFamily: "Poppins-Regular",
        flexShrink: 1,
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
});
