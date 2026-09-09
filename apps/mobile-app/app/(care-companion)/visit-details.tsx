import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Platform, KeyboardAvoidingView, ActivityIndicator, Alert, useWindowDimensions } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, Stack, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';

import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { API_URL } from '@/constants/api';
import { CompanionBackButton } from '../../components/care-companion/CompanionBackButton';
import { VisitImageGallery } from '../../components/care-companion/VisitImageGallery';
import { useNavigationStack } from '@/contexts/NavigationStackContext';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';
import { NavigationService } from '@/utils/NavigationService';
import CustomAlertModal, { AlertType } from '@/components/shared/CustomAlertModal';

const DEEP_ORANGE = '#FE6700';
const LIGHT_BEIGE = '#FAF3EB';
const INPUT_BG = '#F3F4F6';

export default function VisitDetailsScreen() {
    const router = useRouter();
    const { push, replace, pop } = useNavigationStack();
    useAndroidBackHandler();
    const scrollViewRef = useRef<ScrollView>(null);
    const { width } = useWindowDimensions();

    // Custom Alert State
    const [alertConfig, setAlertConfig] = useState<{
        visible: boolean;
        title: string;
        message: string;
        type?: AlertType;
        primaryText?: string;
        onPrimary?: () => void;
        secondaryText?: string;
        onSecondary?: () => void;
    }>({
        visible: false,
        title: '',
        message: '',
        type: 'info',
    });

    const showAlert = (
        title: string,
        message: string,
        type: AlertType = 'info',
        primaryText: string = 'OK',
        onPrimary?: () => void,
        secondaryText?: string,
        onSecondary?: () => void
    ) => {
        setAlertConfig({
            visible: true,
            title,
            message,
            type,
            primaryText,
            onPrimary,
            secondaryText,
            onSecondary,
        });
    };

    const MAX_CONTENT_WIDTH = 440;
    const BASE_HORIZONTAL_PADDING = 20;
    const contentWidth = Math.min(Math.max(width - BASE_HORIZONTAL_PADDING * 2, 0), MAX_CONTENT_WIDTH);
    const responsiveContentStyle = {
        width: contentWidth,
        alignSelf: 'center' as const,
    };
    const { visitId, editMode } = useLocalSearchParams<{ visitId: string; editMode?: string }>();
    const isEdit = editMode === 'true';

    const handleSafeBack = () => {
        if (router.canGoBack()) {
            pop();
        } else {
            replace('/(care-companion)');
        }
    };

    // Dynamic State
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [visitDetail, setVisitDetail] = useState<any>(null);
    const [requiredVitals, setRequiredVitals] = useState<any[]>([]);
    const [vitalsValues, setVitalsValues] = useState<{ [key: string]: { valueNumeric: string; valueNumeric2: string; valueText: string } }>({});
    
    const [authToken, setAuthToken] = useState<string>('');
    const [manualRemarks, setManualRemarks] = useState('');
    const [medNotes, setMedNotes] = useState('');
    const [visitNotes, setVisitNotes] = useState('');
    const [mood, setMood] = useState('Neutral');
    const [isLocallySaved, setIsLocallySaved] = useState(false);
    const [showVitalsErrors, setShowVitalsErrors] = useState(false);

    // Geo-fencing state
    const [currentLat, setCurrentLat] = useState<number | null>(null);
    const [currentLng, setCurrentLng] = useState<number | null>(null);
    const [proximityMeters, setProximityMeters] = useState<number | null>(null);
    const [locationLoading, setLocationLoading] = useState(false);

    // CC Service Request state
    const [showBenefitDropdown, setShowBenefitDropdown] = useState(false);
    const [selectedBenefit, setSelectedBenefit] = useState<any>(null);
    const [reqPreferredDate, setReqPreferredDate] = useState(() => {
        return new Date().toISOString().split('T')[0];
    });
    const [reqPreferredTiming, setReqPreferredTiming] = useState('Morning');
    const [submittingServiceRequest, setSubmittingServiceRequest] = useState(false);

    const [meds, setMeds] = useState<any[]>([]);

    const toggleMed = (id: string) => {
        setMeds(meds.map(m => m.id === id ? { ...m, checked: !m.checked } : m));
    };

    const fetchVisitDetails = async () => {
        if (!visitId) return;
        setLoading(true);
        try {
            const token = await AsyncStorage.getItem('userToken');
            if (!token) {
                replace('/(auth)');
                return;
            }
            setAuthToken(token);

            const response = await fetch(`${API_URL}/care-companion/visits/${visitId}/details`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error("Failed to load visit details");
            }

            const json = await response.json();
            if (json.success && json.data) {
                setVisitDetail(json.data);
                setRequiredVitals(json.data.requiredVitals || []);
                setMood(json.data.visit?.mood || 'Neutral');
                setVisitNotes(json.data.visit?.notes || '');
                setManualRemarks(json.data.visit?.manualCheckInReason || '');

                if (json.data.activeMedications && json.data.activeMedications.length > 0) {
                    const adherence = json.data.visit?.medicationAdherenceRecords || [];
                    setMeds(json.data.activeMedications.map((m: any) => {
                        const record = adherence.find((a: any) => a.medicationId === m.id);
                        return {
                            id: m.id,
                            name: m.name,
                            checked: record ? record.taken : false
                        };
                    }));
                } else {
                    setMeds([]);
                }

                // Initialize vital values mapping
                const initialVals: any = {};
                const existingVitals = json.data.visit?.vitalReadings || [];
                (json.data.requiredVitals || []).forEach((v: any) => {
                    const existing = existingVitals.find((ev: any) => ev.vitalDefinitionId === v.id);
                    if (existing) {
                        initialVals[v.id] = {
                            valueNumeric: existing.valueNumeric !== null ? String(existing.valueNumeric) : '',
                            valueNumeric2: existing.valueNumeric2 !== null ? String(existing.valueNumeric2) : '',
                            valueText: existing.valueText !== null ? existing.valueText : (v.dataType === 'boolean' ? 'no' : '')
                        };
                    } else {
                        initialVals[v.id] = {
                            valueNumeric: '',
                            valueNumeric2: '',
                            valueText: v.dataType === 'boolean' ? 'no' : ''
                        };
                    }
                });
                setVitalsValues(initialVals);
            }
        } catch (error) {
            console.error("Error loading dynamic visit details:", error);
            showAlert("Connection Error", "Failed to retrieve live encounter details. Working with cached records.", "error");
            
            // Premium mock fallback
            setVisitDetail({
                visit: { id: visitId, status: 'scheduled', encounterId: '' },
                beneficiary: { name: 'Beneficiary', age: null, flatPlot: '', streetArea: '', city: '' },
                requiredVitals: []
            });
            setRequiredVitals([]);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchVisitDetails();
        }, [visitId])
    );

    // ── Geo helpers ───────────────────────────────────────────────────────────
    const haversineDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
        const R = 6371000;
        const toRad = (d: number) => (d * Math.PI) / 180;
        const dLat = toRad(lat2 - lat1);
        const dLng = toRad(lng2 - lng1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const getMyLocation = async (): Promise<{ latitude: number; longitude: number } | null> => {
        setLocationLoading(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                showAlert('Permission Denied', 'Location access is required for geo-verified check-in.', 'warning');
                return null;
            }
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
            const { latitude, longitude } = loc.coords;
            setCurrentLat(latitude);
            setCurrentLng(longitude);
            // Compute proximity if beneficiary GPS is available
            const ben = visitDetail?.beneficiary;
            if (ben?.latitude && ben?.longitude) {
                const dist = haversineDistance(latitude, longitude, ben.latitude, ben.longitude);
                setProximityMeters(Math.round(dist));
            }
            return { latitude, longitude };
        } catch {
            showAlert('Location Error', 'Could not get your current GPS location.', 'error');
            return null;
        } finally {
            setLocationLoading(false);
        }
    };

    const handleAutoCheckIn = async () => {
        if (!visitId) return;
        setActionLoading(true);
        try {
            const location = await getMyLocation();
            if (!location) {
                setActionLoading(false);
                return;
            }
            const token = await AsyncStorage.getItem('userToken');
            const response = await fetch(`${API_URL}/care-companion/visits/check-in`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    visitId,
                    latitude: location.latitude,
                    longitude: location.longitude,
                })
            });
            const json = await response.json();
            if (json.success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                const geoVerified = json.data?.isGeoVerified;
                const dist = json.data?.geoDistanceMeters;
                if (geoVerified) {
                    showAlert('Checked In', `Location verified! You are ${dist ?? '—'}m from the beneficiary's home.`, 'success');
                } else if (dist !== null && dist !== undefined) {
                    showAlert('Checked In (Flagged)', `You are ${dist}m away — outside the geo-fence. This check-in is flagged.`, 'warning');
                } else {
                    showAlert('Checked In', 'Check-in recorded. No beneficiary GPS on file for verification.', 'info');
                }
                fetchVisitDetails();
            } else {
                showAlert('Error', json.message || 'Failed to check-in.', 'error');
            }
        } catch {
            showAlert('Check-in Error', 'Unable to complete auto geo-fence check-in.', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const handleCheckIn = async () => {
        if (!visitId) return;
        if (!manualRemarks.trim()) {
            showAlert('Remarks Required', 'Please enter a reason for manual check-in.', 'warning');
            return;
        }
        setActionLoading(true);
        try {
            const token = await AsyncStorage.getItem('userToken');
            let lat = currentLat;
            let lng = currentLng;
            // Attempt to get location even for manual check-in so we can still log distance
            if (!lat || !lng) {
                const loc = await getMyLocation();
                lat = loc?.latitude ?? null;
                lng = loc?.longitude ?? null;
            }
            const response = await fetch(`${API_URL}/care-companion/visits/check-in`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    visitId,
                    latitude: lat ?? 0,
                    longitude: lng ?? 0,
                    manualCheckInReason: manualRemarks,
                })
            });
            const json = await response.json();
            if (json.success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                showAlert('Manual Check-in Recorded', 'Your check-in has been flagged as manual. The field manager will be notified.', 'success');
                fetchVisitDetails();
            } else {
                showAlert('Error', json.message || 'Failed to check-in.', 'error');
            }
        } catch {
            showAlert('Check-in Error', 'Unable to communicate with check-in endpoint.', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const getPayload = () => {
        const vitalsList = Object.keys(vitalsValues).map(vid => {
            const val = vitalsValues[vid];
            return {
                vitalDefinitionId: vid,
                valueNumeric: val.valueNumeric ? parseFloat(val.valueNumeric) : null,
                valueNumeric2: val.valueNumeric2 ? parseFloat(val.valueNumeric2) : null,
                valueText: val.valueText || null,
            };
        });

        const primaryBP = vitalsList.find(v => requiredVitals.find(rv => rv.id === v.vitalDefinitionId && rv.code === 'BP'));
        const primaryO2 = vitalsList.find(v => requiredVitals.find(rv => rv.id === v.vitalDefinitionId && rv.code === 'SPO2'));
        const primaryTemp = vitalsList.find(v => requiredVitals.find(rv => rv.id === v.vitalDefinitionId && rv.code === 'TEMP'));

        const vitalsCompatObj = {
            bpSystolic: primaryBP?.valueNumeric || undefined,
            bpDiastolic: primaryBP?.valueNumeric2 || undefined,
            oxygenLevel: primaryO2?.valueNumeric || undefined,
            temperature: primaryTemp?.valueNumeric || undefined,
        };

        return {
            visitId,
            vitals: vitalsCompatObj,
            vitalsList,
            medicationsList: meds.map(m => ({
                medicationId: m.id,
                taken: m.checked
            })),
            mood: mood.toLowerCase(),
            medicationAdherence: meds.every(m => m.checked),
            notes: visitNotes || medNotes
        };
    };

    const validateRequiredVitals = (): { isValid: boolean; message?: string } => {
        if (!requiredVitals || requiredVitals.length === 0) {
            return { isValid: true };
        }

        for (const v of requiredVitals) {
            const val = vitalsValues[v.id];
            const name = v.name || 'Vital sign';

            if (v.dataType === 'numeric') {
                const num = val?.valueNumeric ? String(val.valueNumeric).trim() : '';
                if (!num) {
                    return {
                        isValid: false,
                        message: `"${name}" cannot be blank. Please enter a valid number.`
                    };
                }
                if (isNaN(Number(num))) {
                    return {
                        isValid: false,
                        message: `Please enter a valid numeric value for "${name}".`
                    };
                }
            } else if (v.dataType === 'dual_numeric') {
                const num1 = val?.valueNumeric ? String(val.valueNumeric).trim() : '';
                const num2 = val?.valueNumeric2 ? String(val.valueNumeric2).trim() : '';
                const label1 = v.value1Label || 'Systolic';
                const label2 = v.value2Label || 'Diastolic';

                if (!num1) {
                    return {
                        isValid: false,
                        message: `"${name} (${label1})" cannot be blank. Please enter a valid number.`
                    };
                }
                if (isNaN(Number(num1))) {
                    return {
                        isValid: false,
                        message: `Please enter a valid numeric value for "${name} (${label1})".`
                    };
                }
                if (!num2) {
                    return {
                        isValid: false,
                        message: `"${name} (${label2})" cannot be blank. Please enter a valid number.`
                    };
                }
                if (isNaN(Number(num2))) {
                    return {
                        isValid: false,
                        message: `Please enter a valid numeric value for "${name} (${label2})".`
                    };
                }
            } else if (v.dataType === 'text') {
                const text = val?.valueText ? String(val.valueText).trim() : '';
                if (!text) {
                    return {
                        isValid: false,
                        message: `"${name}" cannot be blank. Please provide a value.`
                    };
                }
            } else if (v.dataType === 'boolean') {
                const boolVal = val?.valueText ? String(val.valueText).trim() : '';
                if (!boolVal) {
                    return {
                        isValid: false,
                        message: `Please select an option for "${name}".`
                    };
                }
            }
        }

        return { isValid: true };
    };

    const handleSaveEncounter = async () => {
        if (!visitId) return;

        const validation = validateRequiredVitals();
        if (!validation.isValid) {
            setShowVitalsErrors(true);
            showAlert("Vitals Required", `${validation.message} All required patient vitals must have values before saving the encounter.`, "warning");
            return;
        }

        setActionLoading(true);
        try {
            const token = await AsyncStorage.getItem('userToken');
            const response = await fetch(`${API_URL}/care-companion/visits/save-details`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(getPayload())
            });

            const json = await response.json();
            if (json.success) {
                setIsLocallySaved(true);
                setShowVitalsErrors(false);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                showAlert("Encounter Saved", "The visit details have been saved securely.", "success");
            } else {
                showAlert("Save Failed", json.message || "Failed to save details.", "error");
            }
        } catch (error) {
            showAlert("Error Saving Records", "Communication failed during records sync transaction.", "error");
        } finally {
            setActionLoading(false);
        }
    };

    const handleAutoCheckOut = async () => {
        if (!visitId) return;

        const validation = validateRequiredVitals();
        if (!validation.isValid) {
            setShowVitalsErrors(true);
            showAlert("Vitals Required", `${validation.message} All required patient vitals must have values before check-out.`, "warning");
            return;
        }

        setActionLoading(true);
        try {
            const location = await getMyLocation();
            if (!location) {
                setActionLoading(false);
                return;
            }
            
            const token = await AsyncStorage.getItem('userToken');
            const payload = {
                ...getPayload(),
                latitude: location.latitude,
                longitude: location.longitude,
            };

            const response = await fetch(`${API_URL}/care-companion/visits/check-out`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const json = await response.json();
            if (json.success) {
                setShowVitalsErrors(false);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                showAlert(
                    "Check-out Complete",
                    "The encounter is now completed and logged.",
                    "success",
                    "Done",
                    () => replace('/(care-companion)')
                );
            } else {
                showAlert("Checkout Failed", json.message || "Failed to complete checkout.", "error");
            }
        } catch {
            showAlert("Check-out Error", "Unable to complete auto geo-fence check-out.", "error");
        } finally {
            setActionLoading(false);
        }
    };

    const handleManualCheckOut = async () => {
        if (!visitId) return;

        const validation = validateRequiredVitals();
        if (!validation.isValid) {
            setShowVitalsErrors(true);
            showAlert("Vitals Required", `${validation.message} All required patient vitals must have values before check-out.`, "warning");
            return;
        }

        if (!manualRemarks.trim()) {
            showAlert('Remarks Required', 'Please enter a reason for manual check-out.', 'warning');
            return;
        }
        setActionLoading(true);
        try {
            const token = await AsyncStorage.getItem('userToken');
            let lat = currentLat;
            let lng = currentLng;
            if (!lat || !lng) {
                const loc = await getMyLocation();
                lat = loc?.latitude ?? null;
                lng = loc?.longitude ?? null;
            }

            const payload = {
                ...getPayload(),
                latitude: lat ?? 0,
                longitude: lng ?? 0,
                manualCheckOutReason: manualRemarks,
            };

            const response = await fetch(`${API_URL}/care-companion/visits/check-out`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const json = await response.json();
            if (json.success) {
                setShowVitalsErrors(false);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                showAlert(
                    "Check-out Complete",
                    "Your manual check-out has been recorded.",
                    "success",
                    "Done",
                    () => replace('/(care-companion)')
                );
            } else {
                showAlert("Checkout Failed", json.message || "Failed to complete checkout.", "error");
            }
        } catch {
            showAlert("Check-out Error", "Unable to communicate with check-out endpoint.", "error");
        } finally {
            setActionLoading(false);
        }
    };

    const handleCcRequestService = async () => {
        if (!selectedBenefit) {
            showAlert('Selection Required', 'Please select a benefit to request.', 'warning');
            return;
        }
        if (selectedBenefit.isExhausted || selectedBenefit.remainingUnits <= 0) {
            showAlert('Benefit Exhausted', `Benefit "${selectedBenefit.benefitName}" is exhausted. Connect with support team to renew or upgrade your package.`, 'warning');
            return;
        }
        if (!reqPreferredDate.trim()) {
            showAlert('Date Required', 'Preferred date is required.', 'warning');
            return;
        }
        
        setSubmittingServiceRequest(true);
        try {
            const token = await AsyncStorage.getItem('userToken');
            const body = {
                beneficiaryId: beneficiary?.id,
                benefitId: selectedBenefit.benefitId,
                preferredDate: reqPreferredDate,
                preferredTiming: reqPreferredTiming,
            };

            const res = await fetch(`${API_URL}/shared/utilization/request-service`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(body)
            });
            const result = await res.json();
            if (result.success) {
                showAlert('Success', 'Service request submitted successfully.', 'success');
                setSelectedBenefit(null);
                setReqPreferredDate(new Date().toISOString().split('T')[0]);
            } else {
                throw new Error(result.message || 'Failed to submit request');
            }
        } catch (e: any) {
            showAlert('Error', e.message, 'error');
        } finally {
            setSubmittingServiceRequest(false);
        }
    };

    let [fontsLoaded] = useFonts({
        Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold,
    });

    if (!fontsLoaded || loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={DEEP_ORANGE} />
                <Text style={{ fontFamily: 'Poppins_400Regular', color: '#6B7280', marginTop: 12 }}>Retrieving encounter data...</Text>
            </View>
        );
    }

    const { visit, beneficiary } = visitDetail || {};
    const fullAddress = NavigationService.instance.formatAddress({
        flatPlot: beneficiary?.flatPlot,
        streetArea: beneficiary?.streetArea,
        landmark: beneficiary?.landmark,
        city: beneficiary?.city,
        state: beneficiary?.state,
        pincode: beneficiary?.pincode,
    });
    const isCheckedIn = visit?.status === 'in_progress' || visit?.status === 'completed';
    const isCompleted = visit?.status === 'completed';

    // Geo-fencing display helpers
    const GEOFENCE_RADIUS = 50; // Must match backend .env GEOFENCE_RADIUS_METERS
    const beneficiaryHasGps = !!(beneficiary?.latitude && beneficiary?.longitude);
    const isInRange = proximityMeters !== null && proximityMeters <= GEOFENCE_RADIUS;
    const isGeoVerified = visit?.isGeoVerified === true;
    const isManualCheckIn = isCheckedIn && visit?.manualCheckInReason;

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            {/* FORCE hide the header */}
            <Stack.Screen options={{ headerShown: false, headerTransparent: true, title: '' }} />

            <KeyboardAvoidingView 
                style={{ flex: 1 }} 
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                enabled={Platform.OS !== 'web'}
            >
                <ScrollView ref={scrollViewRef} bounces={false} style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={true}>

                    {/* Header */}
                    <View style={styles.deepOrangeHeader}>
                        <View style={[styles.headerRow, responsiveContentStyle]}>
                            <CompanionBackButton style={styles.backBtn} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.headerTitle}>{beneficiary?.name || 'Loading Patient...'}</Text>
                                <Text style={styles.headerSub}>{beneficiary ? `Age: ${beneficiary.age} | ${fullAddress}` : 'Home Visit'}</Text>
                            </View>
                            {isCheckedIn && (
                                <TouchableOpacity onPress={() => scrollViewRef.current?.scrollToEnd({ animated: true })}>
                                    <Ionicons name="camera-outline" size={28} color="#FFFFFF" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* Content Area with adjusted overlap math */}
                    <View style={[styles.contentArea, responsiveContentStyle]}>

                        {/* 1. CHECK-IN CARD */}
                        <View style={styles.card}>
                            <View style={styles.cardHeader}>
                                <Ionicons name="location-outline" size={20} color="#3B82F6" />
                                <Text style={styles.cardTitle}>Encounter Verification</Text>
                            </View>

                            {/* Beneficiary Address + Navigate Button */}
                            {!isCompleted && (
                                <TouchableOpacity
                                    style={styles.addressNavigateRow}
                                    activeOpacity={0.75}
                                    onPress={() => NavigationService.instance.navigate({
                                        address: fullAddress,
                                        latitude: beneficiary?.latitude,
                                        longitude: beneficiary?.longitude,
                                        label: beneficiary?.name || 'Beneficiary',
                                    })}
                                >
                                    <View style={styles.addressNavigateLeft}>
                                        <Ionicons name="home-outline" size={15} color="#FE6700" />
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.addressNavText}>{fullAddress}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.navigatePill}>
                                        <Ionicons name="navigate-circle-outline" size={16} color="#FE6700" />
                                        <Text style={styles.navigatePillText}>Navigate</Text>
                                    </View>
                                </TouchableOpacity>
                            )}

                            {isCheckedIn ? (
                                <View style={[
                                    styles.statusRow,
                                    { backgroundColor: isGeoVerified ? '#F0FDF4' : '#FFFBEB' }
                                ]}>
                                    <View style={styles.statusLeft}>
                                        <Ionicons
                                            name={isGeoVerified ? 'checkmark-circle' : 'warning'}
                                            size={20}
                                            color={isGeoVerified ? '#059669' : '#D97706'}
                                        />
                                        <Text style={[styles.statusText, { color: isGeoVerified ? '#059669' : '#D97706', fontWeight: '600' }]}>
                                            {isGeoVerified
                                                ? 'Location Verified ✓'
                                                : isManualCheckIn
                                                    ? 'Manual Check-in (Flagged)'
                                                    : 'Checked In — Out of Range'}
                                        </Text>
                                    </View>
                                    <View style={[styles.outOfRangeBadge, { backgroundColor: isGeoVerified ? '#D1FAE5' : '#FEF3C7' }]}>
                                        <Text style={[styles.outOfRangeText, { color: isGeoVerified ? '#065F46' : '#92400E' }]}>
                                            {visit?.geoDistanceMeters != null ? `${visit.geoDistanceMeters}m` : 'Verified'}
                                        </Text>
                                    </View>
                                </View>
                            ) : (
                                <View style={styles.statusRow}>
                                    <View style={styles.statusLeft}>
                                        <Ionicons name="alert-circle" size={20} color="#EA580C" />
                                        <Text style={[styles.statusText, { color: '#EA580C', fontWeight: '600' }]}>Awaiting Site Arrival</Text>
                                    </View>
                                    <View style={[styles.outOfRangeBadge, { backgroundColor: '#FDF2F8' }]}>
                                        <Text style={[styles.outOfRangeText, { color: '#9D174D' }]}>Sync Pending</Text>
                                    </View>
                                </View>
                            )}

                            {!isCheckedIn && (
                                <>
                                    {/* Proximity indicator */}
                                    {beneficiaryHasGps && (
                                        <TouchableOpacity
                                            style={[styles.proximityRow, {
                                                backgroundColor: proximityMeters === null ? '#EFF6FF' :
                                                    isInRange ? '#F0FDF4' : '#FEF2F2'
                                            }]}
                                            onPress={getMyLocation}
                                            disabled={locationLoading}
                                        >
                                            {locationLoading ? (
                                                <ActivityIndicator size="small" color="#3B82F6" />
                                            ) : (
                                                <Ionicons
                                                    name={proximityMeters === null ? 'locate-outline' : isInRange ? 'checkmark-circle' : 'close-circle'}
                                                    size={18}
                                                    color={proximityMeters === null ? '#3B82F6' : isInRange ? '#059669' : '#DC2626'}
                                                />
                                            )}
                                            <Text style={[styles.proximityText, {
                                                color: proximityMeters === null ? '#1D4ED8' : isInRange ? '#065F46' : '#B91C1C'
                                            }]}>
                                                {locationLoading ? 'Getting location...'
                                                    : proximityMeters === null ? 'Tap to check your distance'
                                                    : isInRange ? `✓ You are ${proximityMeters}m away — in range`
                                                    : `✗ You are ${proximityMeters}m away — out of range (50m limit)`}
                                            </Text>
                                        </TouchableOpacity>
                                    )}

                                    {/* Auto Geofence Button */}
                                    <TouchableOpacity
                                        style={[styles.autoCheckInBtn, actionLoading && { opacity: 0.7 }]}
                                        onPress={handleAutoCheckIn}
                                        disabled={actionLoading}
                                    >
                                        {actionLoading ? (
                                            <ActivityIndicator size="small" color="#FFFFFF" />
                                        ) : (
                                            <Text style={styles.autoCheckInText}>Auto Geofence Check-in (50m Range)</Text>
                                        )}
                                    </TouchableOpacity>

                                    <Text style={styles.inputLabel}>Manual Override — Reason Required</Text>
                                    <TextInput
                                        style={styles.remarksInput}
                                        placeholder="Explain why you cannot auto check-in..."
                                        placeholderTextColor="#9CA3AF"
                                        value={manualRemarks}
                                        onChangeText={setManualRemarks}
                                    />
                                    <TouchableOpacity
                                        style={[styles.manualCheckInBtn, actionLoading && { opacity: 0.7 }]}
                                        onPress={handleCheckIn}
                                        disabled={actionLoading}
                                    >
                                        {actionLoading ? (
                                            <ActivityIndicator size="small" color="#111827" />
                                        ) : (
                                            <Text style={styles.manualCheckInText}>Manual Arrival Check-in</Text>
                                        )}
                                    </TouchableOpacity>
                                </>
                            )}

                            {/* Show manual check-in reason after check-in */}
                            {isCheckedIn && isManualCheckIn && (
                                <View style={styles.manualReasonBox}>
                                    <Ionicons name="information-circle-outline" size={14} color="#92400E" />
                                    <Text style={styles.manualReasonText}>
                                        Manual reason: {visit?.manualCheckInReason}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* 2. DYNAMIC VITAL SIGNS CARD */}
                        {isCheckedIn && requiredVitals.length > 0 && (
                            <View style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <Ionicons name="pulse-outline" size={22} color="#DC2626" />
                                    <Text style={styles.cardTitle}>Required Patient Vitals</Text>
                                </View>

                                <View style={styles.vitalsGrid}>
                                    {requiredVitals.map((v) => {
                                        if (v.dataType === 'numeric') {
                                            const val = vitalsValues[v.id]?.valueNumeric || '';
                                            const isMissing = !val.trim() || isNaN(Number(val));
                                            return (
                                                <View key={v.id} style={styles.vitalCol}>
                                                    <Text style={styles.inputLabel}>
                                                        {v.name} {v.unit ? `(${v.unit})` : ''}
                                                    </Text>
                                                    <TextInput 
                                                        style={[styles.gridInput, showVitalsErrors && isMissing && styles.gridInputError]} 
                                                        placeholder={v.description || "Enter number..."} 
                                                        keyboardType="decimal-pad" 
                                                        placeholderTextColor="#9CA3AF" 
                                                        value={val} 
                                                        onChangeText={t => {
                                                            let sanitized = t.replace(/[^0-9.]/g, '');
                                                            const parts = sanitized.split('.');
                                                            if (parts.length > 2) {
                                                                sanitized = parts[0] + '.' + parts.slice(1).join('');
                                                            }
                                                            setVitalsValues({
                                                                ...vitalsValues,
                                                                [v.id]: { ...(vitalsValues[v.id] || { valueNumeric: '', valueNumeric2: '', valueText: '' }), valueNumeric: sanitized }
                                                            });
                                                        }} 
                                                    />
                                                </View>
                                            );
                                        }

                                        if (v.dataType === 'dual_numeric') {
                                            const val1 = vitalsValues[v.id]?.valueNumeric || '';
                                            const val2 = vitalsValues[v.id]?.valueNumeric2 || '';
                                            const isMissing1 = !val1.trim() || isNaN(Number(val1));
                                            const isMissing2 = !val2.trim() || isNaN(Number(val2));
                                            return (
                                                <View key={v.id} style={styles.vitalColFull}>
                                                    <Text style={styles.inputLabel}>{v.name}</Text>
                                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                                        <View style={{ width: '48%' }}>
                                                            <Text style={styles.subInputLabel}>{v.value1Label || 'Systolic'}</Text>
                                                            <TextInput 
                                                                style={[styles.gridInput, showVitalsErrors && isMissing1 && styles.gridInputError]} 
                                                                placeholder="e.g. 120" 
                                                                keyboardType="numeric" 
                                                                placeholderTextColor="#9CA3AF" 
                                                                value={val1} 
                                                                onChangeText={t => {
                                                                    const sanitized = t.replace(/[^0-9]/g, '');
                                                                    setVitalsValues({
                                                                        ...vitalsValues,
                                                                        [v.id]: { ...(vitalsValues[v.id] || { valueNumeric: '', valueNumeric2: '', valueText: '' }), valueNumeric: sanitized }
                                                                    });
                                                                }} 
                                                            />
                                                        </View>
                                                        <View style={{ width: '48%' }}>
                                                            <Text style={styles.subInputLabel}>{v.value2Label || 'Diastolic'}</Text>
                                                            <TextInput 
                                                                style={[styles.gridInput, showVitalsErrors && isMissing2 && styles.gridInputError]} 
                                                                placeholder="e.g. 80" 
                                                                keyboardType="numeric" 
                                                                placeholderTextColor="#9CA3AF" 
                                                                value={val2} 
                                                                onChangeText={t => {
                                                                    const sanitized = t.replace(/[^0-9]/g, '');
                                                                    setVitalsValues({
                                                                        ...vitalsValues,
                                                                        [v.id]: { ...(vitalsValues[v.id] || { valueNumeric: '', valueNumeric2: '', valueText: '' }), valueNumeric2: sanitized }
                                                                    });
                                                                }} 
                                                            />
                                                        </View>
                                                    </View>
                                                </View>
                                            );
                                        }

                                        if (v.dataType === 'boolean') {
                                            const val = vitalsValues[v.id]?.valueText || 'no';
                                            return (
                                                <View key={v.id} style={styles.vitalColFull}>
                                                    <Text style={styles.inputLabel}>{v.name}</Text>
                                                    <View style={{ flexDirection: 'row', marginTop: 4 }}>
                                                        <TouchableOpacity 
                                                            style={[styles.booleanBtn, val === 'yes' && styles.booleanBtnActive]} 
                                                            onPress={() => setVitalsValues({
                                                                ...vitalsValues,
                                                                [v.id]: { ...(vitalsValues[v.id] || { valueNumeric: '', valueNumeric2: '', valueText: '' }), valueText: 'yes' }
                                                            })}
                                                        >
                                                            <Text style={[styles.booleanBtnText, val === 'yes' && styles.booleanBtnTextActive]}>
                                                                {v.booleanTrueLabel || 'Yes'}
                                                            </Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity 
                                                            style={[styles.booleanBtn, val === 'no' && styles.booleanBtnActive, { marginLeft: 12 }]} 
                                                            onPress={() => setVitalsValues({
                                                                ...vitalsValues,
                                                                [v.id]: { ...(vitalsValues[v.id] || { valueNumeric: '', valueNumeric2: '', valueText: '' }), valueText: 'no' }
                                                            })}
                                                        >
                                                            <Text style={[styles.booleanBtnText, val === 'no' && styles.booleanBtnTextActive]}>
                                                                {v.booleanFalseLabel || 'No'}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            );
                                        }

                                        if (v.dataType === 'text') {
                                            const currentText = vitalsValues[v.id]?.valueText || '';
                                            const hasOptions = Array.isArray(v.textOptions) && v.textOptions.length > 0;
                                            const isMissing = !currentText.trim();
                                            return (
                                                <View key={v.id} style={styles.vitalColFull}>
                                                    <Text style={styles.inputLabel}>{v.name}</Text>
                                                    {hasOptions ? (
                                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                                                            {v.textOptions.map((opt: string) => {
                                                                const isSelected = currentText === opt;
                                                                return (
                                                                    <TouchableOpacity 
                                                                        key={opt}
                                                                        style={[styles.chipBtn, isSelected && styles.chipBtnActive]}
                                                                        onPress={() => setVitalsValues({
                                                                            ...vitalsValues,
                                                                            [v.id]: { ...(vitalsValues[v.id] || { valueNumeric: '', valueNumeric2: '', valueText: '' }), valueText: opt }
                                                                        })}
                                                                    >
                                                                        <Text style={[styles.chipBtnText, isSelected && styles.chipBtnTextActive]}>{opt}</Text>
                                                                    </TouchableOpacity>
                                                                );
                                                            })}
                                                        </View>
                                                    ) : (
                                                        <TextInput 
                                                            style={[styles.gridInput, showVitalsErrors && isMissing && styles.gridInputError]} 
                                                            placeholder={v.description || `Enter ${v.name}...`} 
                                                            placeholderTextColor="#9CA3AF" 
                                                            value={currentText} 
                                                            onChangeText={t => setVitalsValues({
                                                                ...vitalsValues,
                                                                [v.id]: { ...(vitalsValues[v.id] || { valueNumeric: '', valueNumeric2: '', valueText: '' }), valueText: t }
                                                            })} 
                                                        />
                                                    )}
                                                </View>
                                            );
                                        }

                                        return null;
                                    })}
                                </View>
                            </View>
                        )}

                        {/* 3. MEDICATION ADHERENCE CARD */}
                        {isCheckedIn && meds.length > 0 && (
                            <View style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <MaterialCommunityIcons name="pill" size={20} color="#9333EA" />
                                    <Text style={styles.cardTitle}>Medication Adherence</Text>
                                </View>

                                {meds.map((med) => (
                                    <TouchableOpacity key={med.id} style={styles.checkboxRow} onPress={() => toggleMed(med.id)} activeOpacity={0.7}>
                                        <View style={[styles.checkbox, med.checked && styles.checkboxActive]}>
                                            {med.checked && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                                        </View>
                                        <Text style={styles.medName}>{med.name}</Text>
                                    </TouchableOpacity>
                                ))}

                                <Text style={[styles.inputLabel, { marginTop: 16 }]}>Additional Notes</Text>
                                <TextInput
                                    style={styles.textArea}
                                    placeholder="Any medication concerns or observations..."
                                    placeholderTextColor="#9CA3AF"
                                    multiline numberOfLines={3}
                                    value={medNotes} onChangeText={setMedNotes}
                                />
                            </View>
                        )}

                        {/* 4. MOOD ASSESSMENT CARD */}
                        {isCheckedIn && (
                            <View style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <Ionicons name="heart-outline" size={20} color="#DB2777" />
                                    <Text style={styles.cardTitle}>Mood Assessment</Text>
                                </View>

                                <View style={styles.moodRow}>
                                    {[
                                        { id: 'Happy', icon: 'happy-outline' },
                                        { id: 'Neutral', icon: 'happy-outline' },
                                        { id: 'Sad', icon: 'sad-outline' },
                                        { id: 'Anxious', icon: 'pulse-outline' },
                                        { id: 'Depressed', icon: 'sad-outline' },
                                    ].map((m) => {
                                        const isActive = mood.toLowerCase() === m.id.toLowerCase();
                                        return (
                                            <TouchableOpacity
                                                key={m.id}
                                                style={[styles.moodBox, isActive && styles.moodBoxActive]}
                                                onPress={() => setMood(m.id)}
                                            >
                                                <Ionicons name={m.icon as any} size={20} color={isActive ? '#FFFFFF' : '#4B5563'} style={{ marginBottom: 4 }} />
                                                <Text style={[styles.moodText, isActive && styles.moodTextActive]}>{m.id}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>
                        )}

                        {/* 5. REQUESTS CARD */}
                        {isCheckedIn && (
                            <View style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <MaterialCommunityIcons name="stethoscope" size={20} color="#0D9488" />
                                    <Text style={styles.cardTitle}>Request Service</Text>
                                </View>
                                
                                <Text style={styles.inputLabel}>Select Benefit *</Text>
                                <TouchableOpacity 
                                    style={styles.dropdownBtn}
                                    onPress={() => setShowBenefitDropdown(!showBenefitDropdown)}
                                >
                                    <Text style={[styles.dropdownText, selectedBenefit && { color: '#111827', fontWeight: '600' }]}>
                                        {selectedBenefit ? `${selectedBenefit.benefitName} (${selectedBenefit.remainingUnits} left)` : 'Select benefit type...'}
                                    </Text>
                                    <Ionicons name={showBenefitDropdown ? "chevron-up" : "chevron-down"} size={20} color="#9CA3AF" />
                                </TouchableOpacity>

                                {showBenefitDropdown && (
                                    <View style={styles.dropdownList}>
                                        {(visitDetail?.benefits || []).map((b: any) => (
                                            <TouchableOpacity 
                                                key={b.benefitId}
                                                style={styles.dropdownItem}
                                                onPress={() => {
                                                    setSelectedBenefit(b);
                                                    setShowBenefitDropdown(false);
                                                }}
                                            >
                                                <Text style={styles.dropdownItemText}>{b.benefitName}</Text>
                                                <Text style={styles.dropdownItemSubText}>{b.remainingUnits} remaining</Text>
                                            </TouchableOpacity>
                                        ))}
                                        {(visitDetail?.benefits || []).length === 0 && (
                                            <Text style={styles.emptyDropdownText}>No benefits found for this beneficiary.</Text>
                                        )}
                                    </View>
                                )}

                                {selectedBenefit && (
                                    <View style={{ marginTop: 12 }}>
                                        <Text style={styles.inputLabel}>Preferred Date *</Text>
                                        <TextInput
                                            style={styles.remarksInput}
                                            placeholder="YYYY-MM-DD (e.g. 2026-07-15)"
                                            placeholderTextColor="#9CA3AF"
                                            value={reqPreferredDate}
                                            onChangeText={setReqPreferredDate}
                                        />

                                        <Text style={styles.inputLabel}>Preferred Timing *</Text>
                                        <View style={[styles.moodRow, { gap: 4 }]}>
                                            {['Morning', 'Afternoon', 'Evening'].map((slot) => {
                                                const isActive = reqPreferredTiming === slot;
                                                return (
                                                    <TouchableOpacity
                                                        key={slot}
                                                        style={[styles.moodBox, isActive && styles.moodBoxActive, { flex: 1, paddingVertical: 10 }]}
                                                        onPress={() => setReqPreferredTiming(slot)}
                                                    >
                                                        <Text style={[styles.moodText, isActive && styles.moodTextActive]}>
                                                            {slot}
                                                        </Text>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>

                                        <TouchableOpacity
                                            style={[styles.autoCheckInBtn, { backgroundColor: '#0D9488', marginTop: 16 }, submittingServiceRequest && { opacity: 0.7 }]}
                                            onPress={handleCcRequestService}
                                            disabled={submittingServiceRequest}
                                        >
                                            {submittingServiceRequest ? (
                                                <ActivityIndicator size="small" color="#FFFFFF" />
                                            ) : (
                                                <Text style={styles.autoCheckInText}>Request Service for Patient</Text>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {/* Service Request History Sublist */}
                                {(visitDetail?.serviceRequests || []).length > 0 && (
                                    <View style={{ marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#E5E7EB', borderStyle: 'dashed' }}>
                                        <Text style={[styles.inputLabel, { color: '#0D9488', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }]}>
                                             Upcoming Requested Services
                                        </Text>
                                        <View style={{ gap: 10 }}>
                                            {(visitDetail?.serviceRequests || []).map((sr: any) => {
                                                const dateStr = new Date(sr.preferredDate).toLocaleDateString('en-IN', {
                                                    day: '2-digit',
                                                    month: 'short',
                                                    year: 'numeric'
                                                });
                                                return (
                                                    <View key={sr.id} style={{ padding: 12, backgroundColor: '#FAF3EB', borderRadius: 8, borderWidth: 1, borderColor: '#E7DED6', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <View style={{ flex: 1, paddingRight: 8 }}>
                                                            <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: '#374151' }}>
                                                                {sr.benefitName}
                                                            </Text>
                                                            <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                                                                Preferred: {dateStr} ({sr.preferredTiming})
                                                            </Text>
                                                            <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 10, color: '#9CA3AF', marginTop: 1, fontStyle: 'italic' }}>
                                                                {sr.requestedByRole === 'care_companion'
                                                                    ? 'Requested by Care Mitra'
                                                                    : sr.requestedByRole === 'subscriber'
                                                                        ? `Requested by Subscriber${sr.requesterName ? ` (${sr.requesterName})` : ''}`
                                                                        : 'Requested by Beneficiary itself'}
                                                            </Text>
                                                        </View>
                                                        <View style={{ backgroundColor: sr.isRead ? '#D1FAE5' : '#DBEAFE', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                                                            <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 9, color: sr.isRead ? '#065F46' : '#1E40AF', textTransform: 'uppercase' }}>
                                                                {sr.isRead ? 'Read' : 'Pending'}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* 6. VISIT NOTES CARD */}
                        {isCheckedIn && (
                            <View style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <Ionicons name="document-text-outline" size={20} color="#4F46E5" />
                                    <Text style={styles.cardTitle}>Visit Notes</Text>
                                </View>
                                <TextInput
                                    style={[styles.textArea, { height: 100 }]}
                                    placeholder="Additional observations and notes from the visit..."
                                    placeholderTextColor="#9CA3AF"
                                    multiline
                                    value={visitNotes} onChangeText={setVisitNotes}
                                />
                            </View>
                        )}

                        {/* 7. VISIT PHOTOS CARD */}
                        {isCheckedIn && authToken && (
                            <View style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <Ionicons name="images-outline" size={20} color="#0891B2" />
                                    <Text style={styles.cardTitle}>Visit Photos</Text>
                                </View>
                                <VisitImageGallery
                                    visitId={visitId}
                                    token={authToken}
                                    isCompleted={isCompleted}
                                />
                            </View>
                        )}

                        {/* 7. SAVE BUTTON */}
                        {isCheckedIn && (!isCompleted || isEdit) && !isLocallySaved && (
                            <TouchableOpacity 
                                style={[styles.saveBtn, actionLoading && { opacity: 0.7 }]} 
                                onPress={handleSaveEncounter}
                                disabled={actionLoading}
                            >
                                {actionLoading ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <>
                                        <Ionicons name="paper-plane-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                                        <Text style={styles.saveBtnText}>{isEdit ? 'Update Encounter' : 'Save Encounter'}</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        )}
                        {isCheckedIn && (!isCompleted || isEdit) && isLocallySaved && (
                            <View style={{ alignItems: 'flex-end', marginTop: 10, marginBottom: 16 }}>
                                <TouchableOpacity 
                                    style={[styles.saveBtn, { paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#E5E7EB', shadowOpacity: 0, marginTop: 0, marginBottom: 0 }]} 
                                    onPress={() => setIsLocallySaved(false)}
                                >
                                    <Ionicons name="pencil-outline" size={16} color="#4B5563" style={{ marginRight: 6 }} />
                                    <Text style={[styles.saveBtnText, { color: '#4B5563', fontSize: 13 }]}>Edit Encounter</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        
                        {/* 8. COMPLETE ENCOUNTER CARD */}
                        {isCheckedIn && !isCompleted && (
                            <View style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <Ionicons name="flag-outline" size={20} color="#059669" />
                                    <Text style={styles.cardTitle}>Complete Encounter</Text>
                                </View>
                                
                                <TouchableOpacity style={[styles.checkInBtn, actionLoading && { opacity: 0.7 }]} onPress={handleAutoCheckOut} disabled={actionLoading}>
                                    {actionLoading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.checkInBtnText}>Auto Geofence Check-out</Text>}
                                </TouchableOpacity>

                                <View style={{ marginTop: 16 }}>
                                    <Text style={styles.manualLabel}>Manual Override — Reason Required</Text>
                                    <TextInput
                                        style={styles.manualInput}
                                        placeholder="Explain why you cannot auto check-out..."
                                        placeholderTextColor="#9CA3AF"
                                        value={manualRemarks} onChangeText={setManualRemarks}
                                    />
                                    <TouchableOpacity style={[styles.manualBtn, actionLoading && { opacity: 0.7 }]} onPress={handleManualCheckOut} disabled={actionLoading}>
                                        <Text style={styles.manualBtnText}>Manual Check-out</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        <View style={{ height: 100 }} />
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            <CustomAlertModal
                visible={alertConfig.visible}
                title={alertConfig.title}
                message={alertConfig.message}
                type={alertConfig.type}
                primaryText={alertConfig.primaryText || 'OK'}
                onPrimary={() => {
                    const cb = alertConfig.onPrimary;
                    setAlertConfig(prev => ({ ...prev, visible: false }));
                    if (cb) cb();
                }}
                secondaryText={alertConfig.secondaryText}
                onSecondary={() => {
                    const cb = alertConfig.onSecondary;
                    setAlertConfig(prev => ({ ...prev, visible: false }));
                    if (cb) cb();
                }}
                onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: LIGHT_BEIGE },
    scrollContent: { flexGrow: 1 },

    deepOrangeHeader: {
        backgroundColor: DEEP_ORANGE,
        paddingHorizontal: 0,
        paddingTop: Platform.OS === 'ios' ? 10 : 30,
        paddingBottom: 24,
        borderBottomLeftRadius: 28,
        borderBottomRightRadius: 28,
        zIndex: 1,
        position: 'relative',
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    backBtn: { marginRight: 16 },
    headerTitle: { fontFamily: 'Poppins_600SemiBold', color: '#FFFFFF', fontSize: 20 },
    headerSub: { fontFamily: 'Poppins_400Regular', color: '#FFFFFF', fontSize: 13, opacity: 0.9 },

    contentArea: {
        paddingHorizontal: 0,
        marginTop: 20,
        zIndex: 10,
        position: 'relative',
    },

    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1, borderColor: '#FDF2F8',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
    },

    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    cardTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: '#111827', marginLeft: 8 },

    statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F9FAFB', padding: 12, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#F3F4F6' },
    statusLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    statusText: { fontFamily: 'Poppins_500Medium', fontSize: 14, marginLeft: 8, flexShrink: 1 },
    outOfRangeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    outOfRangeText: { fontFamily: 'Poppins_600SemiBold', fontSize: 11 },

    addressNavigateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFF7ED',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#FFEDD5',
        gap: 8,
    },
    addressNavigateLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
    addressNavText: { fontFamily: 'Poppins_400Regular', color: '#374151', fontSize: 12, lineHeight: 16, flexShrink: 1 },
    navigatePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#FE6700',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    navigatePillText: { fontFamily: 'Poppins_600SemiBold', color: '#FFFFFF', fontSize: 11 },

    proximityRow: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 12,
        borderWidth: 1, borderColor: '#DBEAFE',
    },
    proximityText: { fontFamily: 'Poppins_500Medium', fontSize: 13, flex: 1 },

    autoCheckInBtn: { backgroundColor: '#3B82F6', borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginBottom: 16 },
    autoCheckInText: { color: '#FFFFFF', fontFamily: 'Poppins_600SemiBold', fontSize: 14 },

    manualReasonBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFBEB', borderRadius: 8, padding: 10, marginTop: 8, borderWidth: 1, borderColor: '#FDE68A' },
    manualReasonText: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: '#92400E', flex: 1 },

    inputLabel: { fontFamily: 'Poppins_500Medium', fontSize: 13, color: '#111827', marginBottom: 8 },
    subInputLabel: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: '#4B5563', marginBottom: 4 },
    remarksInput: { backgroundColor: INPUT_BG, borderRadius: 8, padding: 14, fontFamily: 'Poppins_400Regular', fontSize: 14, marginBottom: 16 },

    manualCheckInBtn: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
    manualCheckInText: { color: '#111827', fontFamily: 'Poppins_600SemiBold', fontSize: 14 },

    vitalsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    vitalCol: { width: '48%', marginBottom: 16 },
    vitalColFull: { width: '100%', marginBottom: 16 },
    gridInput: { backgroundColor: INPUT_BG, borderRadius: 8, padding: 12, fontFamily: 'Poppins_500Medium', fontSize: 15, color: '#4B5563', borderWidth: 1, borderColor: 'transparent' },
    gridInputError: { borderColor: '#EF4444', borderWidth: 1, backgroundColor: '#FEF2F2' },

    booleanBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center', backgroundColor: '#FFFFFF' },
    booleanBtnActive: { backgroundColor: DEEP_ORANGE, borderColor: DEEP_ORANGE },
    booleanBtnText: { fontFamily: 'Poppins_500Medium', fontSize: 14, color: '#374151' },
    booleanBtnTextActive: { color: '#FFFFFF', fontFamily: 'Poppins_600SemiBold' },

    chipBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#FFFFFF' },
    chipBtnActive: { backgroundColor: DEEP_ORANGE, borderColor: DEEP_ORANGE },
    chipBtnText: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: '#374151' },
    chipBtnTextActive: { color: '#FFFFFF', fontFamily: 'Poppins_500Medium' },

    checkboxRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
    checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    checkboxActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
    medName: { fontFamily: 'Poppins_400Regular', fontSize: 14, color: '#374151' },
    textArea: { backgroundColor: INPUT_BG, borderRadius: 8, padding: 16, height: 80, textAlignVertical: 'top', fontFamily: 'Poppins_400Regular', fontSize: 14 },

    moodRow: { flexDirection: 'row', justifyContent: 'space-between' },
    moodBox: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingVertical: 12, marginHorizontal: 2 },
    moodBoxActive: { backgroundColor: DEEP_ORANGE, borderColor: DEEP_ORANGE },
    moodText: { fontFamily: 'Poppins_400Regular', fontSize: 10, color: '#4B5563' },
    moodTextActive: { color: '#FFFFFF', fontFamily: 'Poppins_600SemiBold' },

    dropdownBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 14 },
    dropdownText: { fontFamily: 'Poppins_400Regular', color: '#6B7280', fontSize: 14 },
    dropdownList: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, marginTop: 4, padding: 8, zIndex: 50 },
    dropdownItem: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    dropdownItemText: { fontFamily: 'Poppins_500Medium', fontSize: 13, color: '#374151' },
    dropdownItemSubText: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: '#9CA3AF' },
    emptyDropdownText: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: '#9CA3AF', padding: 8, textAlign: 'center' },

    saveBtn: { backgroundColor: DEEP_ORANGE, flexDirection: 'row', borderRadius: 8, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginTop: 10, marginBottom: 16, shadowColor: DEEP_ORANGE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
    saveBtnText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Poppins_600SemiBold' },

    checkInBtn: { backgroundColor: '#059669', borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
    checkInBtnText: { color: '#FFFFFF', fontFamily: 'Poppins_600SemiBold', fontSize: 14 },

    manualLabel: { fontFamily: 'Poppins_500Medium', fontSize: 13, color: '#111827', marginBottom: 8 },
    manualInput: { backgroundColor: INPUT_BG, borderRadius: 8, padding: 14, fontFamily: 'Poppins_400Regular', fontSize: 14, marginBottom: 16 },

    manualBtn: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
    manualBtnText: { color: '#111827', fontFamily: 'Poppins_600SemiBold', fontSize: 14 },
});