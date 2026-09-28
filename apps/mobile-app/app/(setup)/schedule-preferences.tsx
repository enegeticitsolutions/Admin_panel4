import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Animated, Dimensions, Alert, Linking, Modal } from 'react-native';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.75;

import GlobalDrawer from '../(subscriber)/components/shared/GlobalDrawer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFonts, Poppins_400Regular, Poppins_600SemiBold } from '@expo-google-fonts/poppins';
import { useSafeBack } from '@/hooks/useSafeBack';
import { useNavigationStack } from '@/contexts/NavigationStackContext';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';
import { SafeAreaView } from 'react-native-safe-area-context';
import HeaderSpacer from '../../components/HeaderSpacer';
import { API_URL } from '@/constants/api';
import { useAuth } from '@/contexts/AuthContext';
import { LEGAL_CONFIG } from '@/constants/legal';
import NotificationBell from '@/components/shared/NotificationBell';
import { queryClient } from '@/services/queryClient';

export default function SchedulePreferencesScreen() {
    const router = useRouter();
    const { push } = useNavigationStack();
    const { updateUser } = useAuth();
    const safeBack = useSafeBack();
    useAndroidBackHandler();
    const params = useLocalSearchParams();
    const [fontsLoaded] = useFonts({
        Poppins_400Regular,
        Poppins_600SemiBold
    });

    const [drawerOpen, setDrawerOpen] = useState(false);
    const drawerAnim = useRef(new Animated.Value(DRAWER_WIDTH)).current;
    const scrollViewRef = useRef<ScrollView>(null);
    const [userData, setUserData] = useState<any>(null);

    const isVerificationFlow = params.isVerificationFlow === 'true';
    const isLinkingFlow = params.isLinkingFlow === 'true';
    const beneficiaryId = params.beneficiaryId as string;
    const pendingDetailsRaw = params.pendingDetails as string;
    const [isLinking, setIsLinking] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [enrolledName, setEnrolledName] = useState('');

    useEffect(() => {
        AsyncStorage.getItem('userData').then(data => {
            if (data) setUserData(JSON.parse(data));
        });

        // Pre-fill schedule timing details in verification flow
        if (isVerificationFlow && pendingDetailsRaw) {
            try {
                const b = JSON.parse(pendingDetailsRaw);
                if (b.schedulePreference?.preferredSlot) {
                    setVisitTiming(b.schedulePreference.preferredSlot);
                }
            } catch (err) {
                console.error('Error parsing pending details in schedule-preferences:', err);
            }
        }
    }, [isVerificationFlow, pendingDetailsRaw]);

    const openDrawer = () => {
        setDrawerOpen(true);
        Animated.timing(drawerAnim, { toValue: 0, duration: 280, useNativeDriver: true }).start();
    };
    const closeDrawer = () => {
        Animated.timing(drawerAnim, { toValue: DRAWER_WIDTH, duration: 240, useNativeDriver: true }).start(() => setDrawerOpen(false));
    };

    const [visitTiming, setVisitTiming] = useState('');
    const [visitTimingError, setVisitTimingError] = useState<string | null>(null);
    const [agreed, setAgreed] = useState(false);
    const [agreedError, setAgreedError] = useState<string | null>(null);

    const handleEnrollment = async () => {
        let hasError = false;

        if (!visitTiming) {
            setVisitTimingError('Please select a preferred visit timing');
            hasError = true;
        } else {
            setVisitTimingError(null);
        }

        if (!agreed) {
            setAgreedError('Please agree to the Terms of Service and Privacy Policy');
            hasError = true;
        } else {
            setAgreedError(null);
        }

        if (hasError) {
            scrollViewRef.current?.scrollTo({ y: 0, animated: true });
            return;
        }

        if (isLinkingFlow) {
            // Post-purchase: link beneficiary to the existing unlinked subscription
            setIsLinking(true);
            try {
                const token = await AsyncStorage.getItem('userToken');
                let beneficiaryData: any = {};
                let medicalData: any = {};
                let emergencyContacts: any = {};
                try { beneficiaryData = JSON.parse(params.beneficiaryData as string || '{}'); } catch (e) {}
                try { medicalData = JSON.parse(params.medicalData as string || '{}'); } catch (e) {}
                try { emergencyContacts = JSON.parse(params.emergencyContacts as string || '{}'); } catch (e) {}

                const response = await fetch(`${API_URL}/subscriber/subscriptions/link-beneficiary`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        beneficiaryData,
                        medicalData,
                        emergencyContacts,
                        preferencesData: { preferredTiming: visitTiming }
                    })
                });
                const result = await response.json();

                if (result.success) {
                    const linkedBeneficiaryId = result.beneficiaryId || params.beneficiaryId;
                    if (beneficiaryData.photoUri && linkedBeneficiaryId) {
                        try {
                            const uri = beneficiaryData.photoUri;
                            const ext = uri.split('.').pop() || 'jpg';
                            const fileName = `photo_${Date.now()}.${ext}`;
                            const mimeType = `image/${ext === 'png' ? 'png' : 'jpeg'}`;

                            const formData = new FormData();
                            if (Platform.OS === 'web') {
                                const blobResponse = await fetch(uri);
                                const blob = await blobResponse.blob();
                                formData.append('file', blob, fileName);
                            } else {
                                formData.append('file', {
                                    uri,
                                    name: fileName,
                                    type: mimeType,
                                } as any);
                            }
                            formData.append('targetType', 'beneficiary');
                            formData.append('targetId', linkedBeneficiaryId);

                            await fetch(`${API_URL}/profile-photo/upload`, {
                                method: 'POST',
                                headers: {
                                    'Authorization': token ? `Bearer ${token}` : ''
                                },
                                body: formData
                            });
                        } catch (uploadErr) {
                            console.error('Failed to upload beneficiary photo during link enrollment:', uploadErr);
                        }
                    }

                    await AsyncStorage.removeItem('beneficiaryDashboardCache');
                    queryClient.invalidateQueries({ queryKey: ['subscriberDashboard'] });
                    queryClient.invalidateQueries({ queryKey: ['beneficiaries'] });

                    if (result.token && result.user) {
                        await updateUser(result.token, result.user);
                    }
                    if (Platform.OS === 'web') {
                        alert(`Beneficiary enrolled successfully!\n\n${result.beneficiaryName || 'Beneficiary'} has been linked to your subscription.`);
                        router.replace('/(subscriber)');
                    } else {
                        setEnrolledName(result.beneficiaryName || 'Beneficiary');
                        setShowSuccessModal(true);
                    }
                } else {
                    if (Platform.OS === 'web') {
                        alert(`Enrollment Failed: ${result.message || 'Please try again.'}`);
                    } else {
                        Alert.alert('Enrollment Failed', result.message || 'Please try again.');
                    }
                }
            } catch (err: any) {
                Alert.alert('Error', err.message || 'Something went wrong. Please try again.');
            } finally {
                setIsLinking(false);
            }
            return;
        }

        push('/(setup)/checkout', {
            packageId: params.packageId,
            subscriberData: params.subscriberData,
            beneficiaryData: params.beneficiaryData,
            medicalData: params.medicalData,
            emergencyContacts: params.emergencyContacts,
            preferencesData: JSON.stringify({ preferredTiming: visitTiming }),
            isVerificationFlow: params.isVerificationFlow,
            beneficiaryId: params.beneficiaryId,
            pendingDetails: params.pendingDetails
        });
    };

    const handleBack = () => {
        safeBack('/(setup)/emergency-contacts');
    };

    if (!fontsLoaded) {
        return (
            <SafeAreaView style={[styles.safeArea, styles.loadingContainer]}>
                <ActivityIndicator size="small" color="#FE6700" />
            </SafeAreaView>
        );
    }

    const TimingPill = ({ label, active, onPress }: { label: string, active: boolean, onPress: () => void }) => (
        <TouchableOpacity
            style={[styles.timingPill, active && styles.timingPillActive]}
            onPress={onPress}
        >
            <Text style={[styles.timingText, active && styles.timingTextActive]}>{label}</Text>
        </TouchableOpacity>
    );

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
                            <Text style={styles.headerSubtitle}>Step 5 of 5</Text>
                        </View>
                        <View style={styles.headerIcons}>
                            <NotificationBell />
                            <TouchableOpacity onPress={openDrawer}>
                                <Ionicons name="menu-outline" size={30} color="#111827" style={{ marginLeft: 15 }} />
                            </TouchableOpacity>
                        </View>
                    </View>
                    <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: '60%' }]} />
                    </View>
                </View>

                <ScrollView ref={scrollViewRef} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                    <View style={styles.formCard}>
                        <Text style={styles.sectionTitle}>Schedule Preferences</Text>

                        <Text style={styles.label}>Preferred Visit Timing *</Text>
                        <View style={styles.pillContainer}>
                            <TimingPill
                                label="Morning (8AM - 12 PM)"
                                active={visitTiming === 'Morning'}
                                onPress={() => {
                                    setVisitTiming('Morning');
                                    if (visitTimingError) setVisitTimingError(null);
                                }}
                            />
                            <TimingPill
                                label="Afternoon (12PM - 4 PM)"
                                active={visitTiming === 'Afternoon'}
                                onPress={() => {
                                    setVisitTiming('Afternoon');
                                    if (visitTimingError) setVisitTimingError(null);
                                }}
                            />
                            <TimingPill
                                label="Evening (4PM - 8 PM)"
                                active={visitTiming === 'Evening'}
                                onPress={() => {
                                    setVisitTiming('Evening');
                                    if (visitTimingError) setVisitTimingError(null);
                                }}
                            />
                        </View>
                        {visitTimingError && (
                            <Text style={{ color: '#EF4444', fontSize: 12, marginTop: -20, marginBottom: 20, fontFamily: 'Poppins_400Regular' }}>
                                {visitTimingError}
                            </Text>
                        )}

                        <View style={styles.agreementBox}>
                            <TouchableOpacity
                                style={styles.checkbox}
                                onPress={() => {
                                    const next = !agreed;
                                    setAgreed(next);
                                    if (next && agreedError) setAgreedError(null);
                                }}
                            >
                                <Ionicons
                                    name={agreed ? "checkbox" : "square-outline"}
                                    size={20}
                                    color={agreed ? "#FE6700" : (agreedError ? "#EF4444" : "#000000")}
                                />
                            </TouchableOpacity>
                            <Text style={styles.agreementText}>
                                I agree to the{' '}
                                <Text
                                    style={styles.linkText}
                                    onPress={() => Linking.openURL(LEGAL_CONFIG.TERMS_OF_SERVICE_URL)}
                                >
                                    Terms of Service
                                </Text>
                                {' '}and{' '}
                                <Text
                                    style={styles.linkText}
                                    onPress={() => Linking.openURL(LEGAL_CONFIG.PRIVACY_POLICY_URL)}
                                >
                                    Privacy Policy
                                </Text>
                                . I understand that this is a demo application and no actual data will be stored.
                            </Text>
                        </View>
                        {agreedError && (
                            <Text style={{ color: '#EF4444', fontSize: 12, marginTop: -25, marginBottom: 20, fontFamily: 'Poppins_400Regular' }}>
                                {agreedError}
                            </Text>
                        )}

                        <View style={styles.divider} />

                        <View style={styles.buttonContainerStacked}>
                            <TouchableOpacity style={[styles.completeBtn, isLinking && { opacity: 0.7 }]} onPress={handleEnrollment} disabled={isLinking}>
                                {isLinking ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Text style={styles.completeBtnText}>
                                        Complete Enrollment
                                    </Text>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.prevBtnStacked} onPress={handleBack}>
                                <Text style={styles.prevBtnTextStacked}>Previous</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                </ScrollView>

            </KeyboardAvoidingView>

            {/* Custom Success Modal */}
            <Modal transparent visible={showSuccessModal} animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalIconBox}>
                            <Ionicons name="checkmark-circle" size={54} color="#10B981" />
                        </View>
                        <Text style={styles.modalTitle}>Beneficiary Enrolled!</Text>
                        <Text style={styles.modalDesc}>{enrolledName} has been linked to your subscription.</Text>
                        <TouchableOpacity style={styles.modalBtn} onPress={() => {
                            setShowSuccessModal(false);
                            router.replace('/(subscriber)');
                        }}>
                            <Text style={styles.modalBtnText}>Go to Dashboard</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

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
    safeArea: { flex: 1, backgroundColor: '#FCECE0' },
    loadingContainer: { alignItems: 'center', justifyContent: 'center' },
    header: { backgroundColor: '#FFFFFF' },
    headerTopRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, paddingTop: 10, paddingBottom: 10 },
    headerIcons: { flexDirection: 'row', alignItems: 'center' },
    backButton: { width: 44, height: 44, justifyContent: 'center' },
    headerTextContainer: { flex: 1, alignItems: 'flex-start', justifyContent: 'center', paddingLeft: 7 },
    headerTitle: { fontFamily: 'Poppins_400Regular', fontSize: 18, lineHeight: 24, color: '#000000' },
    headerSubtitle: { fontFamily: 'Poppins_400Regular', fontSize: 16, lineHeight: 22, color: '#8F95A3', marginTop: 2 },
    notifBadge: { position: 'absolute', right: -7, top: -7, backgroundColor: '#FE6700', borderRadius: 10, width: 19, height: 19, justifyContent: 'center', alignItems: 'center' },
    notifText: { color: 'white', fontSize: 10, fontWeight: 'bold', fontFamily: 'Poppins_600SemiBold' },
    progressBarBg: { height: 3, backgroundColor: '#E5E7EB', width: '100%' },
    progressBarFill: { height: 3, backgroundColor: '#FE6700', width: '100%' },

    scrollContent: { paddingHorizontal: 21, paddingTop: 30, paddingBottom: 36 },
    formCard: {
        minHeight: 837,
        backgroundColor: '#FFFFFF',
        borderRadius: 15,
        paddingHorizontal: 24,
        paddingTop: 27,
        paddingBottom: 22,
        shadowColor: '#7A4E35',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 4
    },
    sectionTitle: { fontFamily: 'Poppins_400Regular', fontSize: 20, lineHeight: 28, color: '#000000', marginBottom: 13 },

    label: { fontFamily: 'Poppins_400Regular', fontSize: 14, lineHeight: 20, color: '#000000', marginBottom: 21 },
    pillContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 31 },
    timingPill: { backgroundColor: '#E5E5E5', borderRadius: 14, paddingHorizontal: 11, paddingVertical: 3, marginRight: 10, marginBottom: 10 },
    timingPillActive: { backgroundColor: '#FE6700', borderColor: '#FE6700' },
    timingText: { color: '#000000', fontFamily: 'Poppins_400Regular', fontSize: 12, lineHeight: 16 },
    timingTextActive: { color: '#FFFFFF', fontFamily: 'Poppins_600SemiBold' },

    agreementBox: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 37 },
    checkbox: { marginRight: 8, marginTop: 1 },
    agreementText: { flex: 1, fontFamily: 'Poppins_400Regular', fontSize: 14, color: '#000000', lineHeight: 20 },
    boldText: { fontFamily: 'Poppins_400Regular', color: '#000000' },
    linkText: { fontFamily: 'Poppins_600SemiBold', color: '#FE6700', textDecorationLine: 'underline' },
    divider: { height: 1, backgroundColor: '#E5E7EB', marginBottom: 13 },

    buttonContainerStacked: { alignItems: 'center' },
    completeBtn: { width: '48%', minWidth: 169, height: 50, backgroundColor: '#FE6700', borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 19 },
    completeBtnText: { color: '#FFFFFF', fontSize: 18, lineHeight: 25, fontWeight: '600', fontFamily: 'Poppins_600SemiBold', textAlign: 'center' },
    prevBtnStacked: { width: '48%', minWidth: 169, height: 50, borderWidth: 1, borderColor: '#FE6700', borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
    prevBtnTextStacked: { color: '#FE6700', fontSize: 18, lineHeight: 25, fontWeight: '600', fontFamily: 'Poppins_600SemiBold', textAlign: 'center' },

    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '85%', maxWidth: 400, backgroundColor: '#FFF', borderRadius: 16, padding: 24, alignItems: 'center' },
    modalIconBox: { marginBottom: 16 },
    modalTitle: { fontSize: 22, color: '#111827', fontFamily: 'Poppins_600SemiBold', marginBottom: 8, textAlign: 'center' },
    modalDesc: { fontSize: 16, color: '#4B5563', fontFamily: 'Poppins_400Regular', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
    modalBtn: { backgroundColor: '#FE6700', width: '100%', height: 48, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    modalBtnText: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_600SemiBold' }
});