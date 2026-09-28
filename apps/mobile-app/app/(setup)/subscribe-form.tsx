import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Animated, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.75;

import GlobalDrawer from '../(subscriber)/components/shared/GlobalDrawer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AddressInputField } from '../../components/ui/AddressInputField';

import { API_URL } from '@/constants/api';
import { useSafeBack } from '@/hooks/useSafeBack';
import { useNavigationStack } from '@/contexts/NavigationStackContext';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';
import { SafeAreaView } from 'react-native-safe-area-context';
import NotificationBell from '@/components/shared/NotificationBell';

type PackageDetails = {
    id: string;
    name: string;
    price: number;
    durationString: string;
    hoursString: string;
};

export default function SubscribeFormScreen() {
    const router = useRouter();
    const { push } = useNavigationStack();
    const safeBack = useSafeBack();
    useAndroidBackHandler();
    const params = useLocalSearchParams();

    const [drawerOpen, setDrawerOpen] = useState(false);
    const drawerAnim = useRef(new Animated.Value(DRAWER_WIDTH)).current;
    const scrollViewRef = useRef<ScrollView>(null);
    const [userData, setUserData] = useState<any>(null);

    useEffect(() => {
        AsyncStorage.getItem('userData').then(data => {
            if (data) setUserData(JSON.parse(data));
        });
    }, []);

    const openDrawer = () => {
        setDrawerOpen(true);
        Animated.timing(drawerAnim, { toValue: 0, duration: 280, useNativeDriver: true }).start();
    };
    const closeDrawer = () => {
        Animated.timing(drawerAnim, { toValue: DRAWER_WIDTH, duration: 240, useNativeDriver: true }).start(() => setDrawerOpen(false));
    };

    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const [selectedPackage, setSelectedPackage] = useState<PackageDetails>({
        id: 'loading...',
        name: 'Loading Package...',
        price: 0,
        durationString: '...',
        hoursString: '...'
    });

    const [subscriberForm, setSubscriberForm] = useState({
        fullName: '',
        phone: '',
        email: '',
        address: '',
        flatPlot: '',
        streetArea: '',
        landmark: '',
        city: '',
        state: '',
        pincode: '',
        latitude: 0,
        longitude: 0,
    });
    const [nameError, setNameError] = useState('');
    const [phoneError, setPhoneError] = useState('');
    const [emailError, setEmailError] = useState('');
    const [flatPlotError, setFlatPlotError] = useState('');
    const [streetAreaError, setStreetAreaError] = useState('');
    const [cityError, setCityError] = useState('');
    const [pincodeError, setPincodeError] = useState('');
    const [stateError, setStateError] = useState('');

    useEffect(() => {
        const checkAuthAndFetchPackage = async () => {
            try {
                // Guard: packageId is required for purchase flow — no fallback allowed (would corrupt DB records)
                // Linking flow (from dashboard "Add Beneficiary") does NOT need a packageId — backend resolves it automatically
                if (!params.packageId && params.isLinkingFlow !== 'true') {
                    alert('No package selected. Please go back and select a package.');
                    router.back();
                    return;
                }

                // 1. Check for existing session
                const stored = await AsyncStorage.getItem('userData');
                if (stored) {
                    const user = JSON.parse(stored);
                    
                    if (params.isLinkingFlow === 'true') {
                        // Linking flow: subscriber already paid, now enrolling a beneficiary
                        // Go directly to beneficiary-info to start the enrollment wizard
                        const subscriberData = {
                            fullName: user.name || '',
                            phone: user.phone?.replace('+91', '') || '',
                            email: user.email || '',
                            address: user.address || ''
                        };
                        router.replace({
                            pathname: '/(setup)/beneficiary-info',
                            params: {
                                packageId: params.packageId,
                                subscriberData: JSON.stringify(subscriberData),
                                isLinkingFlow: 'true'
                            }
                        });
                    } else {
                        // New purchase flow: go directly to checkout
                        // (beneficiary info is collected AFTER payment via dashboard)
                        router.replace({
                            pathname: '/(setup)/checkout',
                            params: { packageId: params.packageId }
                        });
                    }
                    return; // Stop execution here
                }

                // 2. Fetch package details if not logged in
                const response = await fetch(`${API_URL}/subscriber/subscriptions/packages`);
                const json = await response.json();
                if (json.success) {
                    const pkgType = params.packageId || 'silver';
                    const pkg = json.data.find((p: any) => p.type === pkgType) || json.data[0];
                    if (pkg) {
                        setSelectedPackage({
                            id: pkg.type,
                            name: pkg.name,
                            price: pkg.basePrice || 0,
                            durationString: '30 days',
                            hoursString: `${pkg.hoursPerMonth || (pkg.visitsPerWeek || 0) * 10} hours/month`
                        });
                    }
                }
            } catch (err) {
                console.error('Failed to fetch package or auth:', err);
            } finally {
                setIsCheckingAuth(false);
            }
        };
        checkAuthAndFetchPackage();
    }, [params.packageId]);

    const handleNext = () => {
        let hasError = false;

        if (!subscriberForm.fullName.trim()) {
            setNameError('Full name is required');
            hasError = true;
        } else {
            setNameError('');
        }

        const cleanedPhone = subscriberForm.phone.replace(/\D/g, '');
        if (!cleanedPhone) {
            setPhoneError('Phone number is required');
            hasError = true;
        } else if (cleanedPhone.length !== 10) {
            setPhoneError('Phone number must be exactly 10 digits');
            hasError = true;
        } else {
            setPhoneError('');
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!subscriberForm.email.trim()) {
            setEmailError('Email is required');
            hasError = true;
        } else if (!emailRegex.test(subscriberForm.email.trim())) {
            setEmailError('Please enter a valid email address');
            hasError = true;
        } else {
            setEmailError('');
        }

        if (!subscriberForm.flatPlot.trim()) {
            setFlatPlotError('Flat / Plot / Building is required');
            hasError = true;
        } else {
            setFlatPlotError('');
        }

        if (!subscriberForm.streetArea.trim()) {
            setStreetAreaError('Street / Area is required');
            hasError = true;
        } else {
            setStreetAreaError('');
        }

        if (!subscriberForm.city.trim()) {
            setCityError('City is required');
            hasError = true;
        } else {
            setCityError('');
        }

        const cleanedPincode = subscriberForm.pincode.replace(/\D/g, '');
        if (!cleanedPincode) {
            setPincodeError('Pincode is required');
            hasError = true;
        } else if (cleanedPincode.length !== 6) {
            setPincodeError('Pincode must be exactly 6 digits');
            hasError = true;
        } else {
            setPincodeError('');
        }

        if (!subscriberForm.state.trim()) {
            setStateError('State is required');
            hasError = true;
        } else {
            setStateError('');
        }

        if (hasError) {
            scrollViewRef.current?.scrollTo({ y: 0, animated: true });
            return;
        }

        const constructedAddress = [
            subscriberForm.flatPlot.trim(),
            subscriberForm.streetArea.trim(),
            subscriberForm.landmark.trim(),
            subscriberForm.city.trim(),
            subscriberForm.state.trim(),
            cleanedPincode
        ].filter(Boolean).join(', ');

        const finalAddress = subscriberForm.address.trim() || constructedAddress;

        push('/(setup)/beneficiary-info', {
            packageId: params.packageId || 'silver',
            subscriberData: JSON.stringify({
                ...subscriberForm,
                address: finalAddress,
                phone: cleanedPhone,
                pincode: cleanedPincode
            }),
            isLinkingFlow: params.isLinkingFlow || 'false'
        });
    };

    const handleBack = () => {
        safeBack();
    };

    if (isCheckingAuth) {
        return (
            <SafeAreaView style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#F97316" />
                <Text style={styles.loadingText}>Checking session...</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerTopRow}>
                        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                            <Ionicons name="arrow-back" size={24} color="#111827" />
                        </TouchableOpacity>
                        <View style={styles.headerTextContainer}>
                            <Text style={styles.headerTitle}>Subscribe to Care</Text>
                            <Text style={styles.headerSubtitle}>Step 1 of 5</Text>
                        </View>
                        <View style={styles.headerIcons}>
                            <NotificationBell />
                            <TouchableOpacity onPress={openDrawer}>
                                <Ionicons name="menu-outline" size={30} color="#111827" style={{ marginLeft: 15 }} />
                            </TouchableOpacity>
                        </View>
                    </View>
                    {/* Progress Bar */}
                    <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: '20%' }]} />
                    </View>
                </View>

                <ScrollView ref={scrollViewRef} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                    {/* Sticky Package Banner */}
                    <View style={styles.packageBanner}>
                        <View>
                            <Text style={styles.packageName}>{selectedPackage.name}</Text>
                            <Text style={styles.packageSub}>{selectedPackage.hoursString}</Text>
                        </View>
                        <View style={styles.packagePriceContainer}>
                            <Text style={styles.packagePrice}>₹{selectedPackage.price.toLocaleString('en-IN')}</Text>
                            <Text style={styles.packageSub}>{selectedPackage.durationString}</Text>
                        </View>
                    </View>

                    {/* Form Container */}
                    <View style={styles.formCard}>
                        <Text style={styles.sectionTitle}>Subscriber Information</Text>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Full Name *</Text>
                            <TextInput
                                style={[styles.input, nameError ? { borderColor: '#EF4444' } : null]}
                                placeholder="Enter your full name"
                                placeholderTextColor="#9CA3AF"
                                value={subscriberForm.fullName}
                                maxLength={50}
                                onChangeText={(text) => {
                                    setSubscriberForm({ ...subscriberForm, fullName: text });
                                    if (nameError) setNameError('');
                                }}
                            />
                            {nameError ? (
                                <Text style={styles.errorText}>{nameError}</Text>
                            ) : null}
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Phone Number *</Text>
                            <View style={styles.phoneInputContainer}>
                                <View style={[styles.countryCodeBox, phoneError ? { borderColor: '#EF4444' } : null]}>
                                    <Text style={styles.countryCodeText}>+91</Text>
                                </View>
                                <TextInput
                                    style={[styles.phoneInput, phoneError ? { borderColor: '#EF4444' } : null]}
                                    placeholder="90000 90000"
                                    placeholderTextColor="#9CA3AF"
                                    keyboardType="numeric"
                                    maxLength={10}
                                    value={subscriberForm.phone}
                                    onChangeText={(text) => {
                                        setSubscriberForm({ ...subscriberForm, phone: text.replace(/[^0-9]/g, '').slice(0, 10) });
                                        if (phoneError) setPhoneError('');
                                    }}
                                />
                            </View>
                            {phoneError ? (
                                <Text style={styles.errorText}>{phoneError}</Text>
                            ) : null}
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Email Address *</Text>
                            <TextInput
                                style={[styles.input, emailError ? { borderColor: '#EF4444' } : null]}
                                placeholder="your@email.com"
                                placeholderTextColor="#9CA3AF"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                value={subscriberForm.email}
                                maxLength={80}
                                onChangeText={(text) => {
                                    setSubscriberForm({ ...subscriberForm, email: text });
                                    if (emailError) setEmailError('');
                                }}
                            />
                            {emailError ? (
                                <Text style={styles.errorText}>{emailError}</Text>
                            ) : null}
                        </View>

                        <AddressInputField
                            label=""
                            value={subscriberForm.address}
                            onChangeText={(text) => setSubscriberForm(prev => ({ ...prev, address: text }))}
                            onLocationFetched={(details) => {
                                setSubscriberForm(prev => ({
                                    ...prev,
                                    address: details.address || prev.address,
                                    streetArea: details.address?.split(',')[0] || prev.streetArea,
                                    city: details.city || prev.city,
                                    state: details.state || prev.state,
                                    pincode: details.pincode || prev.pincode,
                                    latitude: details.latitude || 0,
                                    longitude: details.longitude || 0,
                                }));
                                if (details.address) setStreetAreaError('');
                                if (details.city) setCityError('');
                                if (details.state) setStateError('');
                                if (details.pincode) setPincodeError('');
                            }}
                        />

                        <View style={styles.row}>
                            <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                                <Text style={styles.label}>Flat / Plot / Building *</Text>
                                <TextInput
                                    style={[styles.input, flatPlotError ? { borderColor: '#EF4444' } : null]}
                                    placeholder="e.g. 402, Sunshine"
                                    placeholderTextColor="#9CA3AF"
                                    value={subscriberForm.flatPlot}
                                    maxLength={50}
                                    onChangeText={(t) => {
                                        setSubscriberForm({ ...subscriberForm, flatPlot: t });
                                        if (flatPlotError) setFlatPlotError('');
                                    }}
                                />
                                {flatPlotError ? (
                                    <Text style={styles.errorText}>{flatPlotError}</Text>
                                ) : null}
                            </View>
                            <View style={[styles.inputGroup, { flex: 1.5 }]}>
                                <Text style={styles.label}>Street / Area *</Text>
                                <TextInput
                                    style={[styles.input, streetAreaError ? { borderColor: '#EF4444' } : null]}
                                    placeholder="e.g. Sector 15"
                                    placeholderTextColor="#9CA3AF"
                                    value={subscriberForm.streetArea}
                                    maxLength={80}
                                    onChangeText={(t) => {
                                        setSubscriberForm({ ...subscriberForm, streetArea: t });
                                        if (streetAreaError) setStreetAreaError('');
                                    }}
                                />
                                {streetAreaError ? (
                                    <Text style={styles.errorText}>{streetAreaError}</Text>
                                ) : null}
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Landmark (Optional)</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. Near HDFC Bank"
                                placeholderTextColor="#9CA3AF"
                                value={subscriberForm.landmark}
                                maxLength={80}
                                onChangeText={(t) => setSubscriberForm({ ...subscriberForm, landmark: t })}
                            />
                        </View>

                        <View style={styles.row}>
                            <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                                <Text style={styles.label}>City *</Text>
                                <TextInput
                                    style={[styles.input, cityError ? { borderColor: '#EF4444' } : null]}
                                    placeholder="City"
                                    placeholderTextColor="#9CA3AF"
                                    value={subscriberForm.city}
                                    maxLength={50}
                                    onChangeText={(t) => {
                                        setSubscriberForm({ ...subscriberForm, city: t });
                                        if (cityError) setCityError('');
                                    }}
                                />
                                {cityError ? (
                                    <Text style={styles.errorText}>{cityError}</Text>
                                ) : null}
                            </View>
                            <View style={[styles.inputGroup, { flex: 1 }]}>
                                <Text style={styles.label}>Pincode *</Text>
                                <TextInput
                                    style={[styles.input, pincodeError ? { borderColor: '#EF4444' } : null]}
                                    placeholder="Pincode"
                                    placeholderTextColor="#9CA3AF"
                                    keyboardType="numeric"
                                    maxLength={6}
                                    value={subscriberForm.pincode}
                                    onChangeText={(t) => {
                                        setSubscriberForm({ ...subscriberForm, pincode: t.replace(/[^0-9]/g, '').slice(0, 6) });
                                        if (pincodeError) setPincodeError('');
                                    }}
                                />
                                {pincodeError ? (
                                    <Text style={styles.errorText}>{pincodeError}</Text>
                                ) : null}
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>State *</Text>
                            <TextInput
                                style={[styles.input, stateError ? { borderColor: '#EF4444' } : null]}
                                placeholder="State"
                                placeholderTextColor="#9CA3AF"
                                value={subscriberForm.state}
                                maxLength={50}
                                onChangeText={(t) => {
                                    setSubscriberForm({ ...subscriberForm, state: t });
                                    if (stateError) setStateError('');
                                }}
                            />
                            {stateError ? (
                                <Text style={styles.errorText}>{stateError}</Text>
                            ) : null}
                        </View>
                    </View>
                </ScrollView>

                {/* Footer Buttons */}
                <View style={styles.buttonRow}>
                    <TouchableOpacity style={[styles.nextBtn, { flex: 1 }]} onPress={handleNext}>
                        <Text style={styles.nextBtnText}>Next</Text>
                    </TouchableOpacity>
                </View>

            </KeyboardAvoidingView>

            <GlobalDrawer 
                isOpen={drawerOpen} 
                onClose={closeDrawer} 
                drawerAnim={drawerAnim} 
                userData={userData} 
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#FFF5ED' },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF5ED' },
    loadingText: { marginTop: 15, fontSize: 16, color: '#6B7280', fontWeight: '500' },
    header: { backgroundColor: '#FFFFFF', paddingTop: 10 },
    headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingBottom: 10 },
    headerIcons: { flexDirection: 'row', alignItems: 'center' },
    backButton: { width: 40 },
    headerTextContainer: { alignItems: 'center' },
    headerTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
    headerSubtitle: { fontSize: 12, color: '#9CA3AF', textAlign: 'center' },
    notifBadge: { position: 'absolute', right: -4, top: -2, backgroundColor: '#E46C2B', borderRadius: 10, width: 18, height: 18, justifyContent: 'center', alignItems: 'center' },
    notifText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
    progressBarBg: { height: 4, backgroundColor: '#E5E7EB', width: '100%' },
    progressBarFill: { height: 4, backgroundColor: '#F97316', width: '20%' },

    scrollContent: { padding: 15 },
    packageBanner: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 2,
        borderColor: '#3B82F6',
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    packageName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    packageSub: {
        fontSize: 13,
        color: '#6B7280',
    },
    packagePriceContainer: {
        alignItems: 'flex-end',
    },
    packagePrice: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#F97316',
        marginBottom: 2,
    },
    row: { flexDirection: 'row', alignItems: 'center' },

    formCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, elevation: 1 },
    sectionTitle: { fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 20 },

    label: { fontSize: 14, fontWeight: '500', color: '#111827', marginBottom: 10 },
    inputGroup: { marginBottom: 20 },
    input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, padding: 12, fontSize: 15, color: '#111827' },
    textArea: { height: 80, textAlignVertical: 'top' },

    phoneInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    countryCodeBox: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#F9FAFB',
        marginRight: 12,
    },
    countryCodeText: {
        fontSize: 15,
        color: '#374151',
        fontWeight: '500',
    },
    phoneInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 15,
        color: '#111827',
        backgroundColor: '#FFFFFF',
    },

    buttonRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 20 },
    nextBtn: { backgroundColor: '#F97316', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
    nextBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
    errorText: { color: '#EF4444', fontSize: 12, marginTop: 4, marginLeft: 4 }
});
