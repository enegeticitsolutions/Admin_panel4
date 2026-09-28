import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Modal, Pressable, Animated, Dimensions, ActivityIndicator } from 'react-native';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.75;

import GlobalDrawer from '../(subscriber)/components/shared/GlobalDrawer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold } from '@expo-google-fonts/poppins';
import { AddressPicker, SelectedAddress } from '../../components/ui/AddressPicker';
import { useLocationPermission } from '../../hooks/useLocationPermission';
import { PhotoPickerInput } from '../../components/ui/PhotoPickerInput';
import { AddressInputField } from '../../components/ui/AddressInputField';
import { useSafeBack } from '@/hooks/useSafeBack';
import { useNavigationStack } from '@/contexts/NavigationStackContext';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { SafeAreaView } from 'react-native-safe-area-context';
import HeaderSpacer from '@/components/HeaderSpacer';
import { API_URL } from '@/constants/api';
import NotificationBell from '@/components/shared/NotificationBell';


export default function BeneficiaryInfoScreen() {
    const router = useRouter();
    const { push } = useNavigationStack();
    const safeBack = useSafeBack();
    useAndroidBackHandler();
    const params = useLocalSearchParams();
    const [fontsLoaded] = useFonts({
        Poppins_400Regular,
        Poppins_500Medium,
        Poppins_600SemiBold
    });

    const [drawerOpen, setDrawerOpen] = useState(false);
    const drawerAnim = useRef(new Animated.Value(DRAWER_WIDTH)).current;
    const scrollViewRef = useRef<ScrollView>(null);
    const [userData, setUserData] = useState<any>(null);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [pendingData, setPendingData] = useState<any>(null);

    const isVerificationFlow = params.isVerificationFlow === 'true';
    const beneficiaryId = params.beneficiaryId as string;

    // Track original phone so we don't falsely block it during verification
    const [originalPhone, setOriginalPhone] = useState<string>('');
    const [isSameAsSubscriber, setIsSameAsSubscriber] = useState(false);
    const [hasActiveSelf, setHasActiveSelf] = useState(false);
    const [subscriberProfile, setSubscriberProfile] = useState<any>(null);

    useEffect(() => {
        const loadSubscriberData = async () => {
            try {
                const data = await AsyncStorage.getItem('userData');
                let parsedUser = data ? JSON.parse(data) : null;
                if (parsedUser) setUserData(parsedUser);

                let subDataFromParams: any = null;
                if (params.subscriberData) {
                    try {
                        subDataFromParams = JSON.parse(params.subscriberData as string);
                    } catch (e) {}
                }

                // Attempt to fetch fresh profile & dashboard data from API
                const token = await AsyncStorage.getItem('userToken');
                if (token) {
                    try {
                        const [dashRes, profileRes] = await Promise.allSettled([
                            fetch(`${API_URL}/subscriber/dashboard/me`, {
                                headers: { Authorization: `Bearer ${token}` }
                            }).then(r => r.json()),
                            fetch(`${API_URL}/subscriber/profile`, {
                                headers: { Authorization: `Bearer ${token}` }
                            }).then(r => r.json())
                        ]);

                        let activeSelf = false;

                        if (dashRes.status === 'fulfilled' && dashRes.value?.success) {
                            const dData = dashRes.value;
                            const bens = dData.beneficiaries || [];
                            const activeSubs = dData.activeSubscriptions || [];

                            activeSelf = bens.some((b: any) => {
                                const isSelfRel = (b.relationship || '').toLowerCase() === 'self' || b.isSelf || (parsedUser?.id && b.userId === parsedUser.id);
                                if (!isSelfRel) return false;
                                const hasActivePkg = b.packageStatus === 'active' || (!b.isExpired && b.packageStatus !== 'expired' && b.packageStatus !== 'none') || activeSubs.some((s: any) => s.beneficiaryId === b.id);
                                return hasActivePkg;
                            });
                        }

                        if (!activeSelf) {
                            try {
                                const cacheRaw = await AsyncStorage.getItem('beneficiaryDashboardCache');
                                if (cacheRaw) {
                                    const cache = JSON.parse(cacheRaw);
                                    Object.values(cache).forEach((cachedItem: any) => {
                                        const dData = cachedItem?.response;
                                        if (dData?.beneficiaries) {
                                            const found = dData.beneficiaries.some((b: any) => {
                                                const isSelfRel = (b.relationship || '').toLowerCase() === 'self' || b.isSelf || (parsedUser?.id && b.userId === parsedUser.id);
                                                return isSelfRel && (b.packageStatus === 'active' || !b.isExpired);
                                            });
                                            if (found) activeSelf = true;
                                        }
                                    });
                                }
                            } catch (_) {}
                        }

                        setHasActiveSelf(activeSelf);

                        if (profileRes.status === 'fulfilled' && profileRes.value?.success && profileRes.value.data) {
                            parsedUser = { ...parsedUser, ...profileRes.value.data };
                            setUserData(parsedUser);
                        }
                    } catch (err) {
                        console.error('Error loading subscriber profile/dashboard:', err);
                    }
                }

                setSubscriberProfile({
                    ...parsedUser,
                    ...subDataFromParams
                });
            } catch (e) {
                console.error('Error loading subscriber data:', e);
            }
        };

        loadSubscriberData();

        if (isVerificationFlow && beneficiaryId) {
            setIsLoadingDetails(true);
            AsyncStorage.getItem('userToken').then(async (token) => {
                try {
                    const response = await fetch(`${API_URL}/subscriber/beneficiaries/${beneficiaryId}/pending-details`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    const resData = await response.json();
                    if (resData.success && resData.data) {
                        setPendingData(resData.data);
                        const b = resData.data;
                        let formattedDob = '';
                        if (b.dateOfBirth) {
                            const d = new Date(b.dateOfBirth);
                            const day = d.getDate().toString().padStart(2, '0');
                            const month = (d.getMonth() + 1).toString().padStart(2, '0');
                            const year = d.getFullYear();
                            formattedDob = `${day}/${month}/${year}`;
                        }
                        const capitalize = (s: string) => s ? (s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()) : '';
                        setBeneficiaryForm({
                            fullName: b.name || '',
                            dob: formattedDob,
                            gender: capitalize(b.gender),
                            maritalStatus: capitalize(b.maritalStatus),
                            relationship: capitalize(b.relationship),
                            phone: b.phone || '',
                            address: b.address || '',
                            flatPlot: b.flatPlot || '',
                            streetArea: b.streetArea || '',
                            landmark: b.landmark || '',
                            city: b.city || '',
                            state: b.state || '',
                            pincode: b.pincode || '',
                            latitude: b.latitude || 0,
                            longitude: b.longitude || 0,
                        });
                        if (b.photo) {
                            setPickedPhotoUri(b.photo);
                        }
                        // Store original phone to skip uniqueness check for it
                        if (b.phone) {
                            setOriginalPhone(b.phone.replace(/\D/g, '').slice(-10));
                        }
                    }
                } catch (err) {
                    console.error('Error fetching pending details:', err);
                } finally {
                    setIsLoadingDetails(false);
                }
            });
        }
    }, [isVerificationFlow, beneficiaryId, params.subscriberData]);

    const handleToggleSameAsSubscriber = () => {
        const nextState = !isSameAsSubscriber;
        setIsSameAsSubscriber(nextState);

        if (nextState) {
            let subData: any = {};
            if (params.subscriberData) {
                try {
                    subData = JSON.parse(params.subscriberData as string);
                } catch (e) {}
            }
            const source = {
                ...userData,
                ...subscriberProfile,
                ...subData,
            };

            let formattedDob = '';
            const rawDob = source.dateOfBirth || source.dob;
            if (rawDob) {
                try {
                    const d = new Date(rawDob);
                    if (!isNaN(d.getTime())) {
                        const day = d.getDate().toString().padStart(2, '0');
                        const month = (d.getMonth() + 1).toString().padStart(2, '0');
                        const year = d.getFullYear();
                        formattedDob = `${day}/${month}/${year}`;
                    } else if (typeof rawDob === 'string' && rawDob.includes('/')) {
                        formattedDob = rawDob;
                    }
                } catch (e) {}
            }

            const cleanPhone = (source.phone || '').replace(/\D/g, '').slice(-10);
            const capitalize = (s: string) => s ? (s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()) : '';
            const fullAddr = source.address || source.location || [source.flatPlot, source.streetArea, source.city, source.state].filter(Boolean).join(', ');

            setBeneficiaryForm({
                fullName: source.fullName || source.name || '',
                dob: formattedDob || beneficiaryForm.dob,
                gender: capitalize(source.gender) || beneficiaryForm.gender || 'Male',
                maritalStatus: capitalize(source.maritalStatus) || beneficiaryForm.maritalStatus || 'Single',
                relationship: 'Self',
                phone: cleanPhone,
                address: fullAddr,
                flatPlot: source.flatPlot || '',
                streetArea: source.streetArea || '',
                landmark: source.landmark || '',
                city: source.city || '',
                state: source.state || '',
                pincode: source.pincode || '',
                latitude: Number(source.latitude) || 0,
                longitude: Number(source.longitude) || 0,
            });

            if (source.profilePhoto || source.photo) {
                setPickedPhotoUri(source.profilePhoto || source.photo);
            }

            if (phoneError) setPhoneError(null);
            if (dobError) setDobError(null);
            setNameError(null);
            setGenderError(null);
            setMaritalStatusError(null);
            setRelationshipError(null);
            setCustomRelationshipError(null);
            setFlatPlotError(null);
            setStreetAreaError(null);
            setCityError(null);
            setStateError(null);
            setPincodeError(null);
        } else {
            setBeneficiaryForm({
                fullName: '',
                dob: '',
                gender: '',
                maritalStatus: '',
                relationship: '',
                phone: '',
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
            setPickedPhotoUri(null);
            setNameError(null);
            setGenderError(null);
            setMaritalStatusError(null);
            setRelationshipError(null);
            setCustomRelationshipError(null);
            setFlatPlotError(null);
            setStreetAreaError(null);
            setCityError(null);
            setStateError(null);
            setPincodeError(null);
        }
    };

    const openDrawer = () => {
        setDrawerOpen(true);
        Animated.timing(drawerAnim, { toValue: 0, duration: 280, useNativeDriver: true }).start();
    };
    const closeDrawer = () => {
        Animated.timing(drawerAnim, { toValue: DRAWER_WIDTH, duration: 240, useNativeDriver: true }).start(() => setDrawerOpen(false));
    };

    const [showRelationshipModal, setShowRelationshipModal] = useState(false);
    const [pickedPhotoUri, setPickedPhotoUri] = useState<string | null>(null);
    const allRelationships = ['Self', 'Spouse', 'Father', 'Mother', 'Son', 'Daughter', 'Sibling', 'Guardian', 'Friend', 'Other'];
    const relationships = hasActiveSelf ? allRelationships.filter(r => r !== 'Self') : allRelationships;

    // Request location permission immediately on screen load
    const { location: userLocation } = useLocationPermission({ requestOnMount: true });

    const [beneficiaryForm, setBeneficiaryForm] = useState({
        fullName: '',
        dob: '',
        gender: '',
        maritalStatus: '',
        relationship: '',
        phone: '',
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


    const [isDatePickerVisible, setDatePickerVisibility] = useState(false);

    const [dobError, setDobError] = useState<string | null>(null);

    const handleDobChange = (text: string) => {
        let cleaned = text.replace(/\D/g, '');
        
        // Prevent day > 31
        if (cleaned.length >= 2) {
            let day = parseInt(cleaned.substring(0, 2), 10);
            if (day > 31) cleaned = '31' + cleaned.substring(2);
            if (day === 0) cleaned = '01' + cleaned.substring(2);
        }
        
        // Prevent month > 12
        if (cleaned.length >= 4) {
            let month = parseInt(cleaned.substring(2, 4), 10);
            if (month > 12) cleaned = cleaned.substring(0, 2) + '12' + cleaned.substring(4);
            if (month === 0) cleaned = cleaned.substring(0, 2) + '01' + cleaned.substring(4);
        }

        let formatted = cleaned;
        if (cleaned.length > 2) {
            formatted = cleaned.substring(0, 2) + '/' + cleaned.substring(2);
        }
        if (cleaned.length > 4) {
            formatted = formatted.substring(0, 5) + '/' + cleaned.substring(4);
        }
        if (formatted.length > 10) {
            formatted = formatted.substring(0, 10);
        }
        setBeneficiaryForm({ ...beneficiaryForm, dob: formatted });
        if (dobError) setDobError(null);
    };

    const handleConfirmDate = (date: Date) => {
        setDatePickerVisibility(false);
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        setBeneficiaryForm({ ...beneficiaryForm, dob: `${day}/${month}/${year}` });
    };

    const [phoneError, setPhoneError] = useState<string | null>(null);
    const [nameError, setNameError] = useState<string | null>(null);
    const [genderError, setGenderError] = useState<string | null>(null);
    const [maritalStatusError, setMaritalStatusError] = useState<string | null>(null);
    const [relationshipError, setRelationshipError] = useState<string | null>(null);
    const [customRelationshipError, setCustomRelationshipError] = useState<string | null>(null);
    const [flatPlotError, setFlatPlotError] = useState<string | null>(null);
    const [streetAreaError, setStreetAreaError] = useState<string | null>(null);
    const [cityError, setCityError] = useState<string | null>(null);
    const [stateError, setStateError] = useState<string | null>(null);
    const [pincodeError, setPincodeError] = useState<string | null>(null);

    const validatePhone = async (phoneStr: string) => {
        if (!phoneStr || phoneStr.length < 10) {
            setPhoneError(null);
            return true;
        }
        const cleaned = phoneStr.replace(/\D/g, '').slice(-10);

        // In verification flow or when matching subscriber's own phone, allow it!
        if (isVerificationFlow && originalPhone && cleaned === originalPhone) {
            setPhoneError(null);
            return true;
        }

        const subscriberPhone = (userData?.phone || '').replace(/\D/g, '').slice(-10);
        if (subscriberPhone && cleaned === subscriberPhone) {
            setPhoneError(null);
            return true;
        }

        try {
            const res = await fetch(`${API_URL}/public/check-enrollment?phone=${phoneStr}`);
            const data = await res.json();
            if (data.success && data.data.exists) {
                if (data.data.enrolled) {
                    setPhoneError("This phone number is already enrolled in an active package. Please use a different number.");
                    return false;
                }
            }
        } catch (e) {
            console.error('Phone validation error:', e);
        }
        setPhoneError(null);
        return true;
    };

    const handleNext = async () => {
        let hasError = false;

        if (!beneficiaryForm.fullName.trim()) {
            setNameError("Beneficiary name is required");
            hasError = true;
        } else {
            setNameError(null);
        }

        if (!beneficiaryForm.dob) {
            setDobError("Date of Birth is required");
            hasError = true;
        } else if (beneficiaryForm.dob.length === 10) {
            const parts = beneficiaryForm.dob.split('/');
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);
            const year = parseInt(parts[2], 10);
            
            const currentYear = new Date().getFullYear();
            if (year > currentYear || year < currentYear - 120) {
                setDobError(`Year must be between ${currentYear - 120} and ${currentYear}`);
                hasError = true;
            } else {
                const dateObj = new Date(year, month - 1, day);
                if (dateObj.getFullYear() !== year || dateObj.getMonth() !== month - 1 || dateObj.getDate() !== day) {
                    setDobError("Invalid date format (e.g. 31st of Feb)");
                    hasError = true;
                } else {
                    setDobError(null);
                }
            }
        } else {
            setDobError("Date must be in DD/MM/YYYY format");
            hasError = true;
        }

        if (!beneficiaryForm.gender) {
            setGenderError("Gender is required");
            hasError = true;
        } else {
            setGenderError(null);
        }

        if (!beneficiaryForm.maritalStatus) {
            setMaritalStatusError("Marital status is required");
            hasError = true;
        } else {
            setMaritalStatusError(null);
        }

        const rel = (beneficiaryForm.relationship || '').trim();
        if (!rel || rel.toLowerCase() === 'please select') {
            setRelationshipError("Relationship to subscriber is required");
            hasError = true;
        } else if (rel.toLowerCase() === 'other') {
            setCustomRelationshipError("Please specify relationship");
            hasError = true;
        } else {
            setRelationshipError(null);
            setCustomRelationshipError(null);
        }

        // Phone is required
        if (!beneficiaryForm.phone || beneficiaryForm.phone.trim().length === 0) {
            setPhoneError("Phone number is required.");
            hasError = true;
        } else if (beneficiaryForm.phone.length !== 10) {
            setPhoneError("Phone number must be exactly 10 digits");
            hasError = true;
        } else {
            const isPhoneValid = await validatePhone(beneficiaryForm.phone);
            if (!isPhoneValid) {
                hasError = true;
            }
        }

        if (!beneficiaryForm.flatPlot.trim()) {
            setFlatPlotError("Flat / Plot / Building is required");
            hasError = true;
        } else {
            setFlatPlotError(null);
        }

        if (!beneficiaryForm.streetArea.trim()) {
            setStreetAreaError("Street / Area is required");
            hasError = true;
        } else {
            setStreetAreaError(null);
        }

        if (!beneficiaryForm.city.trim()) {
            setCityError("City is required");
            hasError = true;
        } else {
            setCityError(null);
        }

        const cleanedPincode = beneficiaryForm.pincode.replace(/\D/g, '');
        if (!cleanedPincode) {
            setPincodeError("Pincode is required");
            hasError = true;
        } else if (cleanedPincode.length !== 6) {
            setPincodeError("Pincode must be exactly 6 digits");
            hasError = true;
        } else {
            setPincodeError(null);
        }

        if (!beneficiaryForm.state.trim()) {
            setStateError("State is required");
            hasError = true;
        } else {
            setStateError(null);
        }

        if (hasError) {
            scrollViewRef.current?.scrollTo({ y: 0, animated: true });
            return;
        }

        const constructedAddress = [
            beneficiaryForm.flatPlot.trim(),
            beneficiaryForm.streetArea.trim(),
            beneficiaryForm.landmark.trim(),
            beneficiaryForm.city.trim(),
            beneficiaryForm.state.trim(),
            cleanedPincode
        ].filter(Boolean).join(', ');

        const finalAddress = beneficiaryForm.address.trim() || constructedAddress;

        const packageIdToPass = params.packageId || (pendingData?.subscriptions?.[0]?.packageType || '');
        push('/(setup)/medical-info', {
            packageId: packageIdToPass,
            subscriberData: params.subscriberData,
            isVerificationFlow: params.isVerificationFlow,
            beneficiaryId: params.beneficiaryId,
            beneficiaryData: JSON.stringify({
                ...beneficiaryForm,
                address: finalAddress,
                photoUri: pickedPhotoUri
            }),
            pendingDetails: pendingData ? JSON.stringify(pendingData) : undefined,
            isLinkingFlow: params.isLinkingFlow || 'false'
        });
    };

    const handleBack = () => {
        safeBack();
    };

    const SegmentedButton = ({ label, active, hasError, onPress }: { label: string, active: boolean, hasError?: boolean, onPress: () => void }) => (
        <TouchableOpacity
            style={[
                styles.segmentBtn,
                active && styles.segmentBtnActive,
                hasError && !active && { borderColor: '#EF4444', borderWidth: 1 }
            ]}
            onPress={onPress}
        >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
        </TouchableOpacity>
    );

    if (!fontsLoaded) {
        return (
            <SafeAreaView style={[styles.safeArea, styles.loadingContainer]}>
                <ActivityIndicator size="small" color="#FF5C00" />
            </SafeAreaView>
        );
    }

    return (
        <View style={styles.safeArea}>
            <HeaderSpacer backgroundColor="#FFFFFF" />
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
                            <Text style={styles.headerSubtitle}>Step 2 of 5</Text>
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
                        <View style={[styles.progressBarFill, { width: '40%' }]} />
                    </View>
                </View>

                <ScrollView ref={scrollViewRef} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                    <View style={styles.formCard}>
                        <Text style={styles.sectionTitle}>Beneficiary Information</Text>

                        {/* Same as Subscriber Toggle — hidden when activating pre-existing beneficiaries or when subscriber already has an active self package */}
                        {!isVerificationFlow && !hasActiveSelf && (
                            <TouchableOpacity
                                style={[
                                    styles.sameAsSubscriberBox,
                                    isSameAsSubscriber && styles.sameAsSubscriberBoxActive
                                ]}
                                onPress={handleToggleSameAsSubscriber}
                                activeOpacity={0.8}
                            >
                                <View style={styles.sameAsSubscriberLeft}>
                                    <View style={[styles.checkboxBox, isSameAsSubscriber && styles.checkboxBoxActive]}>
                                        {isSameAsSubscriber && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 10 }}>
                                        <Text style={styles.sameAsSubscriberTitle}>Same as Subscriber</Text>
                                        <Text style={styles.sameAsSubscriberSub}>
                                            {isSameAsSubscriber ? 'Details auto-filled from your profile' : 'Tap to auto-fill details for self'}
                                        </Text>
                                    </View>
                                </View>
                                <View style={[styles.selfPill, isSameAsSubscriber && styles.selfPillActive]}>
                                    <Ionicons name="person-outline" size={12} color={isSameAsSubscriber ? '#FFFFFF' : '#FF5C00'} style={{ marginRight: 3 }} />
                                    <Text style={[styles.selfPillText, isSameAsSubscriber && styles.selfPillTextActive]}>
                                        Self
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        )}

                        {/* Profile Photo Upload UI */}
                        <Text style={styles.label}>Profile Photo</Text>
                        <View style={styles.photoUploadContainer}>
                            <PhotoPickerInput
                                currentUri={pickedPhotoUri}
                                onPhotoSelected={(uri) => setPickedPhotoUri(uri)}
                                onPhotoClear={() => setPickedPhotoUri(null)}
                                size={108}
                                width={190}
                                height={119}
                                shape="square"
                                accentColor="#FE6700"
                                emptyImageSource={require("../../assets/images/camera.png")}
                                label="Upload Photo"
                                hint="Add a clear photo for identification"
                            />
                        </View>

                        {/* Beneficiary Name */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Beneficiary Name *</Text>
                            <TextInput
                                style={[styles.input, nameError ? { borderColor: '#EF4444' } : null]}
                                placeholder="Enter beneficiary's full name"
                                placeholderTextColor="#9CA3AF"
                                value={beneficiaryForm.fullName}
                                maxLength={50}
                                onChangeText={(t) => {
                                    setBeneficiaryForm({ ...beneficiaryForm, fullName: t });
                                    if (nameError) setNameError(null);
                                }}
                            />
                            {nameError && (
                                <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 4, fontFamily: 'Poppins_400Regular' }}>
                                    {nameError}
                                </Text>
                            )}
                        </View>

                        {/* Date of Birth */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Date of Birth *</Text>
                            <View style={[styles.inputWithIcon, dobError ? { borderColor: '#EF4444' } : null]}>
                                <TextInput
                                    style={styles.flexInput}
                                    placeholder="dd/mm/yyyy"
                                    placeholderTextColor="#9CA3AF"
                                    keyboardType="numeric"
                                    value={beneficiaryForm.dob}
                                    onChangeText={handleDobChange}
                                />
                                <TouchableOpacity onPress={() => {
                                    if (Platform.OS === 'web') {
                                        alert("Please type the date directly (dd/mm/yyyy). The calendar picker will work natively on the mobile app.");
                                    } else {
                                        setDatePickerVisibility(true);
                                    }
                                }}>
                                    <Ionicons name="calendar-outline" size={20} color="#4B5563" />
                                </TouchableOpacity>
                            </View>
                            {dobError && (
                                <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 4, fontFamily: 'Poppins_400Regular' }}>
                                    {dobError}
                                </Text>
                            )}
                        </View>

                        {/* Gender Segmented Selection */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Gender *</Text>
                            <View style={styles.segmentContainer}>
                                <SegmentedButton
                                    label="Male"
                                    active={beneficiaryForm.gender === 'Male'}
                                    hasError={!!genderError}
                                    onPress={() => {
                                        setBeneficiaryForm({ ...beneficiaryForm, gender: 'Male' });
                                        if (genderError) setGenderError(null);
                                    }}
                                />
                                <SegmentedButton
                                    label="Female"
                                    active={beneficiaryForm.gender === 'Female'}
                                    hasError={!!genderError}
                                    onPress={() => {
                                        setBeneficiaryForm({ ...beneficiaryForm, gender: 'Female' });
                                        if (genderError) setGenderError(null);
                                    }}
                                />
                            </View>
                            {genderError && (
                                <Text style={styles.errorText}>
                                    {genderError}
                                </Text>
                            )}
                        </View>

                        {/* Marital Status Segmented Selection */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Marital Status *</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.segmentContainer}>
                                {['Single', 'Married', 'Widowed', 'Divorced'].map((status) => (
                                    <SegmentedButton
                                        key={status}
                                        label={status}
                                        active={beneficiaryForm.maritalStatus === status}
                                        hasError={!!maritalStatusError}
                                        onPress={() => {
                                            setBeneficiaryForm({ ...beneficiaryForm, maritalStatus: status });
                                            if (maritalStatusError) setMaritalStatusError(null);
                                        }}
                                    />
                                ))}
                            </ScrollView>
                            {maritalStatusError && (
                                <Text style={styles.errorText}>
                                    {maritalStatusError}
                                </Text>
                            )}
                        </View>

                        {/* Relationship Dropdown */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Relationship to Subscriber *</Text>
                            <TouchableOpacity
                                style={[styles.inputWithIcon, relationshipError ? { borderColor: '#EF4444' } : null]}
                                onPress={() => setShowRelationshipModal(true)}
                            >
                                <Text style={[styles.flexInput, (!beneficiaryForm.relationship || beneficiaryForm.relationship === 'Please Select') && { color: '#9CA3AF' }]}>
                                    {beneficiaryForm.relationship || 'Please Select'}
                                </Text>
                                <Ionicons name="chevron-down" size={20} color={relationshipError ? '#EF4444' : '#9CA3AF'} />
                            </TouchableOpacity>
                            {relationshipError && (
                                <Text style={styles.errorText}>
                                    {relationshipError}
                                </Text>
                            )}
                        </View>

                        {/* Custom Relationship Input for 'Other' */}
                        {(beneficiaryForm.relationship === 'Other' || !relationships.includes(beneficiaryForm.relationship)) && beneficiaryForm.relationship !== '' && (
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Please Specify Relationship *</Text>
                                <TextInput
                                    style={[styles.input, customRelationshipError ? { borderColor: '#EF4444' } : null]}
                                    placeholder="e.g. Grandfather, Aunt, etc."
                                    placeholderTextColor="#9CA3AF"
                                    value={beneficiaryForm.relationship === 'Other' ? '' : beneficiaryForm.relationship}
                                    maxLength={50}
                                    onChangeText={(t) => {
                                        setBeneficiaryForm({ ...beneficiaryForm, relationship: t });
                                        if (customRelationshipError) setCustomRelationshipError(null);
                                        if (relationshipError) setRelationshipError(null);
                                    }}
                                    autoFocus
                                />
                                {customRelationshipError && (
                                    <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 4, fontFamily: 'Poppins_400Regular' }}>
                                        {customRelationshipError}
                                    </Text>
                                )}
                            </View>
                        )}

                        {/* Phone Number */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Phone Number <Text style={{ color: '#EF4444' }}>*</Text></Text>
                            <TextInput
                                style={[styles.input, phoneError ? { borderColor: '#EF4444' } : null]}
                                placeholder="10-digit mobile number"
                                placeholderTextColor="#9CA3AF"
                                keyboardType="numeric"
                                maxLength={10}
                                value={beneficiaryForm.phone}
                                onChangeText={(t) => {
                                    const cleaned = t.replace(/[^0-9]/g, '').slice(0, 10);
                                    setBeneficiaryForm({ ...beneficiaryForm, phone: cleaned });
                                    if (phoneError) setPhoneError(null);
                                    if (cleaned.length === 10) {
                                        validatePhone(cleaned);
                                    }
                                }}
                                onBlur={() => {
                                    if (beneficiaryForm.phone.length === 10) {
                                        validatePhone(beneficiaryForm.phone);
                                    }
                                }}
                            />
                            {phoneError && (
                                <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 4, fontFamily: 'Poppins_400Regular' }}>
                                    {phoneError}
                                </Text>
                            )}
                        </View>

                        {/* Address Area */}
                        <AddressInputField
                            label=""
                            value={beneficiaryForm.address}
                            onChangeText={(t) => setBeneficiaryForm(prev => ({ ...prev, address: t }))}
                            onLocationFetched={(details) => setBeneficiaryForm(prev => ({
                                ...prev,
                                address: details.address || prev.address,
                                streetArea: details.address?.split(',')[0] || prev.streetArea,
                                city: details.city || prev.city,
                                state: details.state || prev.state,
                                pincode: details.pincode || prev.pincode,
                                latitude: details.latitude || 0,
                                longitude: details.longitude || 0,
                            }))}
                        />

                        <View style={styles.row}>
                            <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                                <Text style={[styles.label, styles.rowLabel]}>Flat / Plot / Building *</Text>
                                <TextInput
                                    style={[styles.input, flatPlotError ? { borderColor: '#EF4444' } : null]}
                                    placeholder="e.g. 402, Sunshine"
                                    placeholderTextColor="#9CA3AF"
                                    value={beneficiaryForm.flatPlot}
                                    maxLength={50}
                                    onChangeText={(t) => {
                                        setBeneficiaryForm({ ...beneficiaryForm, flatPlot: t });
                                        if (flatPlotError) setFlatPlotError(null);
                                    }}
                                />
                                {flatPlotError && (
                                    <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 4, fontFamily: 'Poppins_400Regular' }}>
                                        {flatPlotError}
                                    </Text>
                                )}
                            </View>
                            <View style={[styles.inputGroup, { flex: 1.5 }]}>
                                <Text style={[styles.label, styles.rowLabel]}>Street / Area *</Text>
                                <TextInput
                                    style={[styles.input, streetAreaError ? { borderColor: '#EF4444' } : null]}
                                    placeholder="e.g. Sector 15"
                                    placeholderTextColor="#9CA3AF"
                                    value={beneficiaryForm.streetArea}
                                    maxLength={80}
                                    onChangeText={(t) => {
                                        setBeneficiaryForm({ ...beneficiaryForm, streetArea: t });
                                        if (streetAreaError) setStreetAreaError(null);
                                    }}
                                />
                                {streetAreaError && (
                                    <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 4, fontFamily: 'Poppins_400Regular' }}>
                                        {streetAreaError}
                                    </Text>
                                )}
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Landmark (Optional)</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. Near HDFC Bank"
                                placeholderTextColor="#9CA3AF"
                                value={beneficiaryForm.landmark}
                                maxLength={80}
                                onChangeText={(t) => setBeneficiaryForm({ ...beneficiaryForm, landmark: t })}
                            />
                        </View>

                        <View style={styles.row}>
                            <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                                <Text style={styles.label}>City *</Text>
                                <TextInput
                                    style={[styles.input, cityError ? { borderColor: '#EF4444' } : null]}
                                    placeholder="City"
                                    placeholderTextColor="#9CA3AF"
                                    value={beneficiaryForm.city}
                                    maxLength={50}
                                    onChangeText={(t) => {
                                        setBeneficiaryForm({ ...beneficiaryForm, city: t });
                                        if (cityError) setCityError(null);
                                    }}
                                />
                                {cityError && (
                                    <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 4, fontFamily: 'Poppins_400Regular' }}>
                                        {cityError}
                                    </Text>
                                )}
                            </View>
                            <View style={[styles.inputGroup, { flex: 1 }]}>
                                <Text style={styles.label}>Pincode *</Text>
                                <TextInput
                                    style={[styles.input, pincodeError ? { borderColor: '#EF4444' } : null]}
                                    placeholder="Pincode"
                                    placeholderTextColor="#9CA3AF"
                                    keyboardType="numeric"
                                    maxLength={6}
                                    value={beneficiaryForm.pincode}
                                    onChangeText={(t) => {
                                        setBeneficiaryForm({ ...beneficiaryForm, pincode: t.replace(/[^0-9]/g, '').slice(0, 6) });
                                        if (pincodeError) setPincodeError(null);
                                    }}
                                />
                                {pincodeError && (
                                    <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 4, fontFamily: 'Poppins_400Regular' }}>
                                        {pincodeError}
                                    </Text>
                                )}
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>State *</Text>
                            <TextInput
                                style={[styles.input, stateError ? { borderColor: '#EF4444' } : null]}
                                placeholder="State"
                                placeholderTextColor="#9CA3AF"
                                value={beneficiaryForm.state}
                                maxLength={50}
                                onChangeText={(t) => {
                                    setBeneficiaryForm({ ...beneficiaryForm, state: t });
                                    if (stateError) setStateError(null);
                                }}
                            />
                            {stateError && (
                                <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 4, fontFamily: 'Poppins_400Regular' }}>
                                    {stateError}
                                </Text>
                            )}
                        </View>
                        {beneficiaryForm.latitude !== 0 && (
                            <View style={[styles.coordsBadge, { marginBottom: 20 }]}>
                                <Ionicons name="location" size={12} color="#10B981" />
                                <Text style={styles.coordsText}>GPS coordinates saved</Text>
                            </View>
                        )}

                         <View style={styles.divider} />
 
                        <View style={styles.buttonRow}>
                            <TouchableOpacity style={styles.prevBtn} onPress={handleBack}>
                                <Text style={styles.prevBtnText}>Previous</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
                                <Text style={styles.nextBtnText}>Next</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                </ScrollView>

                {/* Relationship Selection Modal */}
                <Modal visible={showRelationshipModal} transparent animationType="slide">
                    <Pressable style={styles.modalOverlay} onPress={() => setShowRelationshipModal(false)}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Select Relationship</Text>
                                <TouchableOpacity onPress={() => setShowRelationshipModal(false)}>
                                    <Ionicons name="close" size={24} color="#111827" />
                                </TouchableOpacity>
                            </View>
                            <ScrollView>
                                {relationships.map((rel) => (
                                    <TouchableOpacity
                                        key={rel}
                                        style={[
                                            styles.optionBtn,
                                            beneficiaryForm.relationship === rel && styles.optionBtnActive
                                        ]}
                                        onPress={() => {
                                            setBeneficiaryForm({ ...beneficiaryForm, relationship: rel });
                                            if (relationshipError) setRelationshipError(null);
                                            setShowRelationshipModal(false);
                                        }}
                                    >
                                        <Text style={[
                                            styles.optionText,
                                            beneficiaryForm.relationship === rel && styles.optionTextActive
                                        ]}>{rel}</Text>
                                        {beneficiaryForm.relationship === rel && (
                                            <Ionicons name="checkmark-circle" size={20} color="#F97316" />
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    </Pressable>
                </Modal>

                {/* Address Picker Modal handled internally by AddressInputField */}

                <DateTimePickerModal
                    isVisible={isDatePickerVisible}
                    mode="date"
                    onConfirm={handleConfirmDate}
                    onCancel={() => setDatePickerVisibility(false)}
                />


            </KeyboardAvoidingView>

            <GlobalDrawer
                isOpen={drawerOpen}
                onClose={closeDrawer}
                drawerAnim={drawerAnim}
                userData={userData}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#FFF1E6' },
    loadingContainer: { alignItems: 'center', justifyContent: 'center' },
    row: { flexDirection: 'row', alignItems: 'flex-start' },
    header: { backgroundColor: '#FFFFFF' },
    headerTopRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, paddingTop: 10, paddingBottom: 11 },
    headerIcons: { flexDirection: 'row', alignItems: 'center' },
    backButton: { width: 44, height: 44, justifyContent: 'center' },
    headerTextContainer: { flex: 1, alignItems: 'flex-start', justifyContent: 'center', paddingLeft: 7 },
    headerTitle: { fontFamily: 'Poppins_400Regular', fontSize: 18, lineHeight: 24, color: '#000000' },
    headerSubtitle: { fontFamily: 'Poppins_400Regular', fontSize: 16, lineHeight: 22, color: '#8F95A3', marginTop: 2 },
    notifBadge: { position: 'absolute', right: -7, top: -7, backgroundColor: '#FF5C00', borderRadius: 10, width: 19, height: 19, justifyContent: 'center', alignItems: 'center' },
    notifText: { color: 'white', fontSize: 10, fontWeight: '600', fontFamily: 'Poppins_600SemiBold' },
    progressBarBg: { height: 4, backgroundColor: '#E5E7EB', width: '100%' },
    progressBarFill: { height: 4, backgroundColor: '#FF5C00', width: '40%' },

    scrollContent: { paddingHorizontal: 22, paddingTop: 32, paddingBottom: 36 },
    formCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 15,
        paddingHorizontal: 26,
        paddingTop: 27,
        paddingBottom: 24,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.18,
        shadowRadius: 6,
        elevation: 5
    },
    sectionTitle: { fontFamily: 'Poppins_400Regular', fontSize: 20, lineHeight: 28, color: '#000000', marginBottom: 14 },
    sameAsSubscriberBox: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFF7ED',
        borderWidth: 1.5,
        borderColor: '#FFEDD5',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 20,
    },
    sameAsSubscriberBoxActive: {
        backgroundColor: '#FFF1E6',
        borderColor: '#FF5C00',
    },
    sameAsSubscriberLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    checkboxBox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#D1D5DB',
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxBoxActive: {
        backgroundColor: '#FF5C00',
        borderColor: '#FF5C00',
    },
    sameAsSubscriberTitle: {
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 14,
        color: '#111827',
    },
    sameAsSubscriberSub: {
        fontFamily: 'Poppins_400Regular',
        fontSize: 11,
        color: '#6B7280',
        marginTop: 1,
    },
    selfPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#FFEDD5',
        marginLeft: 8,
    },
    selfPillActive: {
        backgroundColor: '#FF5C00',
        borderColor: '#FF5C00',
    },
    selfPillText: {
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 11,
        color: '#FF5C00',
    },
    selfPillTextActive: {
        color: '#FFFFFF',
    },

    label: { fontFamily: 'Poppins_400Regular', fontSize: 14, lineHeight: 20, color: '#000000', marginBottom: 12 },
    rowLabel: { minHeight: 40 },
    inputGroup: { marginBottom: 14 },
    input: { height: 53, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 9, paddingHorizontal: 16, paddingVertical: 0, fontFamily: 'Poppins_400Regular', fontSize: 14, lineHeight: 20, color: '#111827' },
    inputWithIcon: { height: 53, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 9, paddingHorizontal: 16 },
    flexInput: { flex: 1, fontFamily: 'Poppins_400Regular', fontSize: 14, lineHeight: 20, color: '#111827' },
    textArea: { height: 103, textAlignVertical: 'top', paddingTop: 14 },

    photoUploadContainer: { alignItems: 'center', marginTop: 14, marginBottom: 25 },
    photoBox: { width: 150, height: 90, borderRadius: 12, borderStyle: 'dashed', borderWidth: 1, borderColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
    uploadLabel: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: '#4B5563', marginTop: 5 },
    editIconBadge: { position: 'absolute', bottom: -5, right: -5, backgroundColor: '#F97316', padding: 5, borderRadius: 10 },
    photoHint: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: '#4B5563', marginTop: 10 },

    segmentContainer: { flexDirection: 'row', marginBottom: 6 },
    segmentBtn: { backgroundColor: '#E5E5E5', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, marginRight: 9 },
    segmentBtnActive: { backgroundColor: '#FF5C00' },
    segmentText: { fontFamily: 'Poppins_400Regular', fontSize: 12, lineHeight: 16, color: '#000000' },
    segmentTextActive: { color: '#FFFFFF', fontFamily: 'Poppins_400Regular' },

    divider: { height: 1, backgroundColor: '#E5E7EB', marginTop: 8, marginBottom: 14 },
    buttonRow: { flexDirection: 'row', justifyContent: 'space-between' },
    prevBtn: { flex: 0.48, height: 53, borderWidth: 1, borderColor: '#FF5C00', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    prevBtnText: { color: '#FF5C00', fontSize: 18, lineHeight: 25, fontWeight: '600', fontFamily: 'Poppins_600SemiBold' },
    nextBtn: { flex: 0.48, height: 53, backgroundColor: '#FF5C00', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    nextBtnText: { color: '#FFFFFF', fontSize: 18, lineHeight: 25, fontWeight: '600', fontFamily: 'Poppins_600SemiBold' },

    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: 'white', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 20, maxHeight: '70%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    modalTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 18, fontWeight: '600', color: '#111827' },
    optionBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 10, borderRadius: 10, marginBottom: 5 },
    optionBtnActive: { backgroundColor: '#FFF5ED' },
    optionText: { fontFamily: 'Poppins_400Regular', fontSize: 16, color: '#4B5563' },
    optionTextActive: { color: '#F97316', fontWeight: '600', fontFamily: 'Poppins_600SemiBold' },
    coordsBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
    coordsText: { fontFamily: 'Poppins_500Medium', fontSize: 12, color: '#10B981', fontWeight: '500' },
    errorText: { color: '#EF4444', fontSize: 12, marginTop: 4, fontFamily: 'Poppins_400Regular' },
});
