import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    ImageBackground,
    Platform,
    ActivityIndicator,
    useWindowDimensions,
    Alert,
    Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Feather, AntDesign, Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { API_URL } from '@/constants/api';
import { ConnectContactButton } from '@/components/shared/ConnectContactModal';
import NotificationBell from '@/components/shared/NotificationBell';
import { useExitOnBack } from '@/hooks/useExitOnBack';
import { sanitizeImageUri } from '@/utils/sanitizeImageUri';
import { useAuth } from '@/contexts/AuthContext';
import { triggerEmergencyAlert, dialEmergencyHelpline, EMERGENCY_HELPLINE_NUMBER } from '@/services/emergencyTrigger';
import { useCustomAlert } from '@/contexts/CustomAlertContext';


const headerPattern = require('@/assets/images/header-pattern.png');

interface DashboardData {
    greeting: string;
    firstName: string;
    emotionalScore: number;
    nextVisit: string | null;
    adherence: string;
    careCoordinator: {
        id: string;
        name: string;
        role: string;
        bio: string;
        photo: string | null;
        phone?: string | null;
    } | null;
    subscription?: {
        packageName: string;
        hoursTotal: number;
        hoursUsed: number;
        remainingHours: number;
    } | null;
    todaysMedications: Array<{
        id: string;
        name: string;
        dosage: string;
        condition: string;
        time: string;
        completed: boolean;
        adherenceScore: number;
    }>;
}

export default function BeneficiaryDashboard() {
    const { width } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const MAX_CONTENT_WIDTH = 800;
    const BASE_HORIZONTAL_PADDING = 16;
    const contentWidth = Math.min(Math.max(width - BASE_HORIZONTAL_PADDING * 2, 0), MAX_CONTENT_WIDTH);
    const responsiveContentStyle = { width: contentWidth, alignSelf: 'center' as const };
    const numColumns = contentWidth >= 600 ? 4 : 2;
    const availableGridWidth = contentWidth - 32; // account for mainContent paddingHorizontal: 16 (16 * 2)
    const actionCardWidth = Math.floor((availableGridWidth - ((numColumns - 1) * 16)) / numColumns);
    useExitOnBack();
    const { showConfirm, showAlert } = useCustomAlert();
    const { user } = useAuth();

    const [triggeringEmergency, setTriggeringEmergency] = useState(false);
    const [locationStatus, setLocationStatus] = useState<'idle' | 'locating' | 'done'>('idle');
    const [emergencySuccessModal, setEmergencySuccessModal] = useState<{
        ticketNumber: string;
        message: string;
        locationAddress?: string;
        lat?: number;
        lng?: number;
    } | null>(null);
    const [emergencyEligible, setEmergencyEligible] = useState<boolean>(true);
    const [sathiEligible, setSathiEligible] = useState<boolean>(true);

    // Pulsing animation for the SOS button while triggering
    const pulseAnim = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        if (triggeringEmergency) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.06, duration: 400, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
                ])
            ).start();
        } else {
            pulseAnim.setValue(1);
        }
    }, [triggeringEmergency, pulseAnim]);

    useEffect(() => {
        async function fetchEligibility() {
            try {
                const [storedUser, storedToken] = await Promise.all([
                    AsyncStorage.getItem('userData'),
                    AsyncStorage.getItem('userToken'),
                ]);
                if (!storedUser || !storedToken) return;
                const parsedUser = JSON.parse(storedUser);

                // Check emergency eligibility
                const emergencyRes = await fetch(`${API_URL}/beneficiary/${parsedUser.id}/emergency/eligibility`, {
                    headers: { Authorization: `Bearer ${storedToken}` }
                });
                const emergencyData = await emergencyRes.json();
                if (emergencyRes.ok && emergencyData?.data) {
                    setEmergencyEligible(emergencyData.data.eligible);
                }

                // Check sathi eligibility
                const sathiRes = await fetch(`${API_URL}/beneficiary/sathi-requests/${parsedUser.id}/sathi/eligibility`, {
                    headers: { Authorization: `Bearer ${storedToken}` }
                });
                const sathiData = await sathiRes.json();
                if (sathiRes.ok && sathiData?.data) {
                    setSathiEligible(sathiData.data.eligible);
                }
            } catch (err) {
                console.error('[EligibilityCheck] Error checking on mount:', err);
                setEmergencyEligible(false);
                setSathiEligible(false);
            }
        }
        fetchEligibility();
    }, []);


    const {
        data: personalData,
        isLoading: personalLoading,
    } = useQuery({
        queryKey: ['beneficiaryDashboardInfo', user?.id],
        queryFn: async () => {
            const storedToken = await AsyncStorage.getItem('userToken');
            if (!storedToken) return null;

            const response = await fetch(`${API_URL}/beneficiary/dashboard/dashboard/me`, {
                headers: {
                    Authorization: `Bearer ${storedToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (response.status === 404 || !response.ok) {
                return null;
            }

            const res = await response.json();
            return res.success ? (res.data as DashboardData) : null;
        },
    });

    const {
        data: subscriberData,
        isLoading: subscriberLoading,
    } = useQuery({
        queryKey: ['subscriberSummary', user?.id],
        queryFn: async () => {
            const storedToken = await AsyncStorage.getItem('userToken');
            if (!storedToken) return null;

            const response = await fetch(`${API_URL}/subscriber/dashboard/me`, {
                headers: {
                    Authorization: `Bearer ${storedToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) return null;
            const res = await response.json();
            return res.success ? res.data : null;
        },
    });

    const handleEmergencyPress = async () => {
        if (triggeringEmergency) return;

        // Optimistic confirmation dialog first — then locate & dial 01142258823
        const executeEmergency = async () => {
            setTriggeringEmergency(true);
            setLocationStatus('locating');

            try {
                const result = await triggerEmergencyAlert(
                    'SOS Emergency Support triggered from MaiHoonNa Mobile App',
                    { autoDial: false } // already dialed above
                );
                setLocationStatus('done');

                if (result.success) {
                    setEmergencySuccessModal({
                        ticketNumber: result.ticketNumber || 'EMG-ALERT',
                        message: `Your Subscriber, Care Companions, and Admin Emergency Center have been alerted with your location.`,
                        locationAddress: result.locationAddress,
                        lat: result.lat,
                        lng: result.lng,
                    });
                } else {
                    const errMsg = result.error || 'Failed to dispatch emergency alert.';
                    if (Platform.OS === 'web') window.alert(`Alert: ${errMsg}`);
                    else showAlert('Emergency Alert', errMsg, 'error');
                }
            } catch (err: any) {
                const errMsg = err.message || 'Network error while triggering emergency alert.';
                if (Platform.OS === 'web') window.alert(`Notice: ${errMsg}`);
                else showAlert('Notice', errMsg, 'warning');
            } finally {
                setTriggeringEmergency(false);
                setLocationStatus('idle');
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(`🚨 TRIGGER EMERGENCY SOS ALERT?\n\nThis will immediately alert your Subscriber, Care Companions, and Emergency Center with your live location.`)) {
                executeEmergency();
            }
        } else {
            showConfirm(
                '🚨 Trigger Emergency Alert?',
                `This will broadcast your live GPS location to your care team & emergency response center.`,
                executeEmergency,
                'SEND SOS'
            );
        }
    };

    if (personalLoading && subscriberLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FE6700" />
            </View>
        );
    }

    const hasPersonalCarePlan = Boolean(personalData);

    const currentHour = new Date().getHours();
    let defaultGreeting = 'Good Evening';
    if (currentHour < 12) defaultGreeting = 'Good Morning';
    else if (currentHour < 17) defaultGreeting = 'Good Afternoon';

    const greeting = personalData?.greeting || defaultGreeting;
    const firstName = user?.name ? user.name.split(' ')[0] : (personalData?.firstName || 'there');
    const familyBeneficiaries: any[] = subscriberData?.beneficiaries || [];

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'Not Scheduled';
        const date = new Date(dateString);
        if (Number.isNaN(date.getTime())) return dateString;
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        });
    };

    const getDisplayAge = (b: any): string => {
        if (b.dateOfBirth) {
            try {
                const dob = new Date(b.dateOfBirth);
                if (!isNaN(dob.getTime())) {
                    const today = new Date();
                    let age = today.getFullYear() - dob.getFullYear();
                    const m = today.getMonth() - dob.getMonth();
                    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
                    return `${age} yrs`;
                }
            } catch (_) { }
        }
        return b.age ? `${b.age} yrs` : '';
    };

    return (
        <ScrollView
            style={styles.container}
            bounces={false}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            stickyHeaderIndices={[0]}
        >
            <View style={styles.headerWrapper}>
                <ImageBackground
                    source={headerPattern}
                    style={styles.headerBackground}
                    resizeMode="cover"
                >
                    <View style={{ paddingTop: Math.max(insets.top, Platform.OS === 'android' ? 40 : 20), paddingBottom: 20 }}>
                        <View style={[styles.headerContent, responsiveContentStyle]}>
                            <View>
                                <Text style={styles.greetingTitle}>{greeting}, {firstName}!</Text>
                                <Text style={styles.greetingSubtitle}>
                                    How are you feeling today?
                                </Text>
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <TouchableOpacity
                                    style={styles.switchHeaderPill}
                                    onPress={() => router.push('/(subscriber)')}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="people-outline" size={14} color="#FF6A00" style={{ marginRight: 4 }} />
                                    <Text style={styles.switchHeaderPillText}>Family</Text>
                                </TouchableOpacity>

                                <View style={styles.notificationWrapper}>
                                    <NotificationBell />
                                </View>
                            </View>
                        </View>

                        {emergencyEligible && (
                            <Animated.View style={{ transform: [{ scale: pulseAnim }], ...responsiveContentStyle }}>
                                <TouchableOpacity
                                    style={[styles.emergencyBtn, triggeringEmergency && { opacity: 0.85 }]}
                                    activeOpacity={0.85}
                                    onPress={handleEmergencyPress}
                                    disabled={triggeringEmergency}
                                >
                                    {triggeringEmergency ? (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                            <ActivityIndicator color="#FFFFFF" size="small" />
                                            <Text style={styles.emergencyText}>
                                                {locationStatus === 'locating' ? 'Locating & Calling...' : 'Dialing Helpline...'}
                                            </Text>
                                        </View>
                                    ) : (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                                            <Feather name="phone-call" size={24} color="#FFFFFF" />
                                            <View style={{ marginLeft: 10 }}>
                                                <Text style={styles.emergencyText}>Emergency Support</Text>
                                                <Text style={styles.emergencySubtext}>24/7 Helpline: 011-42258823</Text>
                                            </View>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            </Animated.View>
                        )}
                    </View>
                </ImageBackground>
            </View>

            <View style={[styles.mainContent, responsiveContentStyle]}>
                {/* ── CASE 1: Primary User Has a Personal Care Plan ── */}
                {hasPersonalCarePlan ? (
                    <>
                        {(personalData?.nextVisit || personalData?.adherence) && (
                            <View style={styles.statsRow}>
                                {personalData?.nextVisit && (
                                    <View style={styles.statCard}>
                                        <View style={[styles.statIconBadge, { backgroundColor: '#DBEAFE' }]}>
                                            <Feather name="calendar" size={20} color="#155DFC" />
                                        </View>
                                        <Text style={styles.statLabel}>Next Visit</Text>
                                        <Text style={styles.statValue}>
                                            {formatDate(personalData.nextVisit)}
                                        </Text>
                                    </View>
                                )}

                                {personalData?.adherence && (
                                    <View style={styles.statCard}>
                                        <View style={[styles.statIconBadge, { backgroundColor: '#DCFCE7' }]}>
                                            <Feather name="trending-up" size={20} color="#00A63E" />
                                        </View>
                                        <Text style={styles.statLabel}>Adherence</Text>
                                        <Text style={styles.statValue}>{personalData.adherence}</Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {personalData?.careCoordinator && (
                            <>
                                <View style={styles.sectionHeader}>
                                    <Text style={styles.sectionTitle}>Your Care Coordinator</Text>
                                    <TouchableOpacity onPress={() => router.push('/(beneficiary)/team')}>
                                        <Text style={styles.linkText}>View Team</Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.card}>
                                    <View style={styles.ccHeader}>
                                        <View style={styles.ccAvatar}>
                                            {personalData.careCoordinator.photo ? (
                                                <Image
                                                    source={{ uri: sanitizeImageUri(personalData.careCoordinator.photo) }}
                                                    style={styles.ccImage}
                                                />
                                            ) : (
                                                <AntDesign name="user" size={30} color="#AAAAAA" />
                                            )}
                                        </View>

                                        <View style={styles.ccInfo}>
                                            <Text style={styles.ccName}>
                                                {personalData.careCoordinator.name}
                                            </Text>
                                            <Text style={styles.ccRole}>
                                                {personalData.careCoordinator.role}
                                            </Text>
                                        </View>
                                    </View>

                                    <Text style={styles.ccBio} numberOfLines={2}>
                                        {personalData.careCoordinator.bio}
                                    </Text>

                                    <ConnectContactButton
                                        name={personalData.careCoordinator.name}
                                        role={personalData.careCoordinator.role}
                                        phone={personalData.careCoordinator.phone || null}
                                        photo={personalData.careCoordinator.photo}
                                        trigger={
                                            <View style={styles.primaryBtn}>
                                                <Text style={styles.primaryBtnText}>Call Now</Text>
                                            </View>
                                        }
                                    />
                                </View>
                            </>
                        )}

                        {personalData?.todaysMedications && personalData.todaysMedications.length > 0 && (
                            <>
                                <View style={styles.sectionHeader}>
                                    <Text style={styles.sectionTitle}>Today's Medications</Text>
                                    <TouchableOpacity onPress={() => router.push('/(beneficiary)/meds' as any)}>
                                        <Text style={styles.linkText}>View All</Text>
                                    </TouchableOpacity>
                                </View>

                                {personalData.todaysMedications.map((med) => (
                                    <View key={med.id} style={styles.medCard}>
                                        <View style={styles.medHeader}>
                                            <View style={styles.medIconBadge}>
                                                <MaterialCommunityIcons
                                                    name="pill"
                                                    size={20}
                                                    color="#FE6700"
                                                />
                                            </View>

                                            <View style={styles.medInfo}>
                                                <Text style={styles.medName}>{med.name}</Text>
                                                <Text style={styles.medDosage}>
                                                    {med.dosage} • {med.condition}
                                                </Text>
                                            </View>
                                        </View>

                                        <View style={styles.medFooter}>
                                            <Text style={styles.medTime}>⏰ {med.time}</Text>

                                            <View style={styles.adherenceBadge}>
                                                <Text style={styles.adherenceBadgeText}>
                                                    Adherence {med.adherenceScore}%
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                ))}
                            </>
                        )}
                    </>
                ) : (
                    /* ── CASE 2: Primary User Has Not Bought a Personal Plan Yet ── */
                    <View style={styles.noPlanCard}>
                        <View style={styles.noPlanHeader}>
                            <View style={styles.noPlanIconBox}>
                                <Feather name="shield" size={24} color="#FE6700" />
                            </View>
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={styles.noPlanTitle}>Personal Care Plan</Text>
                                <Text style={styles.noPlanSubtitle}>No active plan for yourself yet</Text>
                            </View>
                        </View>
                        <Text style={styles.noPlanDesc}>
                            You are managing care and payments for your family. Protect your own wellness with dedicated companion visits, regular vitals checkups, and 24/7 care support.
                        </Text>
                        <TouchableOpacity
                            style={styles.noPlanBtn}
                            onPress={() => router.push('/(setup)/subscription-packages')}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.noPlanBtnText}>Explore Plans for Myself</Text>
                            <Feather name="arrow-right" size={16} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>
                )}

                {/* ── Family Care Activity (Beneficiaries under care) ── */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Family Care Activity</Text>
                    <TouchableOpacity onPress={() => router.push('/(subscriber)')}>
                        <Text style={styles.linkText}>Family Connect</Text>
                    </TouchableOpacity>
                </View>

                {familyBeneficiaries.length > 0 ? (
                    familyBeneficiaries.map((b) => {
                        const isSelf = (b.relationship || '').toLowerCase() === 'self' || b.isSelf;
                        const isPending = b.packageStatus === 'pending' || b.verificationStatus === 'pending';
                        const isExpired = b.packageStatus === 'expired';
                        const isActive = b.packageStatus === 'active';

                        return (
                            <TouchableOpacity
                                key={b.id}
                                style={styles.familyCard}
                                onPress={() => {
                                    if (isPending) {
                                        router.push({
                                            pathname: '/(setup)/beneficiary-info',
                                            params: { isVerificationFlow: 'true', beneficiaryId: b.id }
                                        });
                                    } else if (isExpired) {
                                        router.push('/(setup)/subscription-packages');
                                    } else {
                                        router.push(`/(subscriber)/beneficiary-profile?id=${b.id}`);
                                    }
                                }}
                                activeOpacity={0.85}
                            >
                                <Image
                                    source={{
                                        uri: sanitizeImageUri(
                                            b.photo,
                                            `https://ui-avatars.com/api/?name=${encodeURIComponent(b.name || 'Member')}&background=FFE3D1&color=FE6700&bold=true`
                                        )
                                    }}
                                    style={styles.familyAvatar}
                                />

                                <View style={styles.familyInfo}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Text style={styles.familyName}>{b.name}</Text>
                                        {isSelf && (
                                            <View style={styles.selfBadge}>
                                                <Text style={styles.selfBadgeText}>Self</Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text style={styles.familyMeta}>
                                        {getDisplayAge(b)}{b.relationship ? ` • ${b.relationship}` : ''}
                                    </Text>
                                </View>

                                <View style={styles.familyStatusWrap}>
                                    {isActive ? (
                                        <View style={styles.activePlanBadge}>
                                            <View style={styles.activeDot} />
                                            <Text style={styles.activePlanText}>Active Care</Text>
                                        </View>
                                    ) : isPending ? (
                                        <View style={styles.pendingPlanBadge}>
                                            <Ionicons name="time-outline" size={12} color="#D97706" />
                                            <Text style={styles.pendingPlanText}>Setup</Text>
                                        </View>
                                    ) : isExpired ? (
                                        <View style={styles.expiredPlanBadge}>
                                            <Text style={styles.expiredPlanText}>Renew</Text>
                                        </View>
                                    ) : (
                                        <View style={styles.neutralPlanBadge}>
                                            <Text style={styles.neutralPlanText}>No Plan</Text>
                                        </View>
                                    )}
                                    <Ionicons name="chevron-forward" size={16} color="#9CA3AF" style={{ marginLeft: 6 }} />
                                </View>
                            </TouchableOpacity>
                        );
                    })
                ) : (
                    <View style={styles.emptyFamilyCard}>
                        <View style={styles.emptyFamilyIconBox}>
                            <Ionicons name="people-outline" size={26} color="#FE6700" />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={styles.emptyFamilyTitle}>No Family Members Added</Text>
                            <Text style={styles.emptyFamilySub}>
                                Add your parents or family members to monitor their health visits and companion support.
                            </Text>
                            <TouchableOpacity
                                style={styles.addFamilyBtn}
                                onPress={() => router.push({ pathname: '/(setup)/subscribe-form', params: { isLinkingFlow: 'true' } })}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="person-add-outline" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                                <Text style={styles.addFamilyBtnText}>Add Family Member</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Quick Actions</Text>
                </View>

                <View style={styles.quickActionsGrid}>
                    <TouchableOpacity
                        style={[styles.actionCard, { width: actionCardWidth }]}
                        onPress={() => router.push('/(subscriber)')}
                    >
                        <View style={[styles.actionIconBadge, { backgroundColor: '#EFF6FF' }]}>
                            <Ionicons name="people" size={24} color="#2563EB" />
                        </View>

                        <Text style={styles.actionTitle} numberOfLines={1} adjustsFontSizeToFit>Family Connect</Text>
                        <Text style={styles.actionSubtitle} numberOfLines={2}>Reports & family status</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionCard, { width: actionCardWidth }]}
                        onPress={() => router.push('/(setup)/subscription-packages')}
                    >
                        <View style={[styles.actionIconBadge, { backgroundColor: '#FFF5ED' }]}>
                            <Feather name="shopping-bag" size={24} color="#FE6700" />
                        </View>

                        <Text style={styles.actionTitle} numberOfLines={1} adjustsFontSizeToFit>Browse Packages</Text>
                        <Text style={styles.actionSubtitle} numberOfLines={2}>Care plans & add members</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionCard, { width: actionCardWidth }]}
                        onPress={() => router.push('/(beneficiary)/vitals')}
                    >
                        <View style={[styles.actionIconBadge, { backgroundColor: '#FEE2E2' }]}>
                            <Feather name="heart" size={24} color="#EF4444" />
                        </View>

                        <Text style={styles.actionTitle} numberOfLines={1} adjustsFontSizeToFit>Log Vitals</Text>
                        <Text style={styles.actionSubtitle} numberOfLines={2}>Track blood pressure & more</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionCard, { width: actionCardWidth }]}
                        onPress={() => router.push('/(beneficiary)/meds' as any)}
                    >
                        <View style={[styles.actionIconBadge, { backgroundColor: '#FEF3C7' }]}>
                            <MaterialCommunityIcons name="pill" size={24} color="#D97706" />
                        </View>

                        <Text style={styles.actionTitle} numberOfLines={1} adjustsFontSizeToFit>Medications</Text>
                        <Text style={styles.actionSubtitle} numberOfLines={2}>View schedule & details</Text>
                    </TouchableOpacity>

                    {sathiEligible && (
                        <TouchableOpacity
                            style={[styles.actionCard, { width: actionCardWidth }]}
                            onPress={() => router.push('/(beneficiary)/sathi-request')}
                        >
                            <View style={[styles.actionIconBadge, { backgroundColor: '#FFF7ED' }]}>
                                <Feather name="users" size={24} color="#FF6A00" />
                            </View>

                            <Text style={styles.actionTitle} numberOfLines={1} adjustsFontSizeToFit>Saathi Companion</Text>
                            <Text style={styles.actionSubtitle} numberOfLines={2}>Request visit & help</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={[styles.actionCard, { width: actionCardWidth }]}
                        onPress={() => router.push('/package-utilization' as any)}
                    >
                        <View style={[styles.actionIconBadge, { backgroundColor: '#FFF3EB' }]}>
                            <Feather name="package" size={24} color="#F97316" />
                        </View>

                        <Text style={styles.actionTitle} numberOfLines={1} adjustsFontSizeToFit>Package Utilization</Text>
                        <Text style={styles.actionSubtitle} numberOfLines={2}>Track your benefits</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ height: 40 }} />
            </View>

            {/* Emergency Success Overlay Modal */}
            {emergencySuccessModal && (
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalIconWrapper}>
                            <Feather name="alert-triangle" size={32} color="#DC2626" />
                        </View>
                        <Text style={styles.modalTitle}>🚨 Emergency SOS Sent!</Text>
                        <View style={styles.ticketBadge}>
                            <Text style={styles.ticketBadgeText}>Ticket: {emergencySuccessModal.ticketNumber}</Text>
                        </View>
                        <Text style={styles.modalDesc}>{emergencySuccessModal.message}</Text>

                        {/* Location confirmation */}
                        {emergencySuccessModal.locationAddress ? (
                            <View style={styles.locationBadge}>
                                <Feather name="map-pin" size={13} color="#DC2626" />
                                <Text style={styles.locationBadgeText} numberOfLines={2}>
                                    📍 {emergencySuccessModal.locationAddress}
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.locationBadge}>
                                <Feather name="map-pin" size={13} color="#6B7280" />
                                <Text style={[styles.locationBadgeText, { color: '#6B7280' }]}>
                                    Location: Using registered address
                                </Text>
                            </View>
                        )}

                        {/* Direct Helpline Call Button */}
                        <TouchableOpacity
                            style={styles.callHelplineBtn}
                            onPress={() => dialEmergencyHelpline()}
                            activeOpacity={0.85}
                        >
                            <Feather name="phone-call" size={18} color="#FFFFFF" />
                            <Text style={styles.callHelplineBtnText}>Call Helpline: 011-42258823</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.modalDoneBtn}
                            onPress={() => setEmergencySuccessModal(null)}
                        >
                            <Text style={styles.modalDoneBtnText}>Dismiss</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    container: {
        flex: 1,
        backgroundColor: '#FFF0E6',
    },
    headerWrapper: {
        width: '100%',
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
        overflow: 'hidden',
        zIndex: 10,
        elevation: 10,
    },
    headerBackground: {
        width: '100%',
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 16,
    },
    greetingTitle: {
        fontFamily: 'Poppins-Bold',
        fontSize: 24,
        lineHeight: 32,
        color: '#FFFFFF',
    },
    greetingSubtitle: {
        fontFamily: 'Poppins-Regular',
        fontSize: 14,
        lineHeight: 20,
        color: 'rgba(255, 255, 255, 0.95)',
    },
    notificationWrapper: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    emergencyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#E7000B',
        borderRadius: 16,
        paddingVertical: 10,
        paddingHorizontal: 16,
        minHeight: 58,
        marginHorizontal: 16,
        marginTop: 8,
        shadowColor: '#E7000B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    emergencyText: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 16,
        lineHeight: 22,
        color: '#FFFFFF',
    },
    emergencySubtext: {
        fontFamily: 'Poppins-Medium',
        fontSize: 12,
        lineHeight: 16,
        color: 'rgba(255, 255, 255, 0.92)',
    },
    mainContent: {
        paddingHorizontal: 16,
        paddingTop: 20, // Reduced from hypothetical 40 back to 20 because we kept paddingBottom on headerCurve
    },
    statsRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
    statCard: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    statIconBadge: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    statLabel: {
        fontFamily: 'Poppins-Regular',
        fontSize: 12,
        lineHeight: 16,
        color: '#64748B',
    },
    statValue: {
        fontFamily: 'Poppins-Bold',
        fontSize: 16,
        lineHeight: 24,
        color: '#0F172A',
        marginTop: 2,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
        marginTop: 8,
    },
    sectionTitle: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 18,
        lineHeight: 24,
        color: '#0F172A',
    },
    linkText: {
        fontFamily: 'Poppins-Medium',
        fontSize: 14,
        lineHeight: 20,
        color: '#FF6A00',
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    ccHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    ccAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    ccImage: {
        width: 48,
        height: 48,
    },
    ccInfo: {
        marginLeft: 12,
        flex: 1,
    },
    ccName: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 16,
        lineHeight: 22,
        color: '#0F172A',
    },
    ccRole: {
        fontFamily: 'Poppins-Regular',
        fontSize: 12,
        lineHeight: 16,
        color: '#64748B',
    },
    ccBio: {
        fontFamily: 'Poppins-Regular',
        fontSize: 13,
        lineHeight: 18,
        color: '#334155',
        marginBottom: 14,
    },
    primaryBtn: {
        backgroundColor: '#FF6A00',
        borderRadius: 12,
        paddingVertical: 10,
        alignItems: 'center',
    },
    primaryBtnText: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 14,
        color: '#FFFFFF',
    },
    medCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    medHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    medIconBadge: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#FFF7ED',
        justifyContent: 'center',
        alignItems: 'center',
    },
    medInfo: {
        marginLeft: 12,
        flex: 1,
    },
    medName: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 15,
        color: '#0F172A',
    },
    medDosage: {
        fontFamily: 'Poppins-Regular',
        fontSize: 12,
        color: '#64748B',
    },
    medFooter: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    medTime: {
        fontFamily: 'Poppins-Medium',
        fontSize: 13,
        color: '#334155',
    },
    adherenceBadge: {
        backgroundColor: '#F0FDF4',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    adherenceBadgeText: {
        fontFamily: 'Poppins-Medium',
        fontSize: 12,
        color: '#16A34A',
    },
    quickActionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        rowGap: 16,
    },
    actionCard: {
        height: 132,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        padding: 16,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    actionIconBadge: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionTitle: {
        marginTop: 8,
        fontFamily: 'Poppins-Medium',
        fontSize: 13,
        color: '#000000',
    },
    actionSubtitle: {
        fontFamily: 'Poppins-Regular',
        fontSize: 11,
        color: '#4B5563',
        marginTop: 2,
    },
    modalOverlay: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        zIndex: 9999,
    },
    modalCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 24,
        width: '100%',
        maxWidth: 360,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 10,
    },
    modalIconWrapper: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#FEE2E2',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontFamily: 'Poppins-Bold',
        fontSize: 18,
        color: '#111827',
        marginBottom: 8,
        textAlign: 'center',
    },
    ticketBadge: {
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FCA5A5',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
        marginBottom: 12,
    },
    ticketBadgeText: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 13,
        color: '#991B1B',
    },
    modalDesc: {
        fontFamily: 'Poppins-Regular',
        fontSize: 13,
        color: '#4B5563',
        textAlign: 'center',
        lineHeight: 18,
        marginBottom: 20,
    },
    callHelplineBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#DC2626',
        borderRadius: 12,
        paddingVertical: 13,
        paddingHorizontal: 16,
        width: '100%',
        marginBottom: 10,
    },
    callHelplineBtnText: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 15,
        color: '#FFFFFF',
    },
    modalDoneBtn: {
        backgroundColor: '#F3F4F6',
        paddingVertical: 12,
        paddingHorizontal: 32,
        borderRadius: 12,
        width: '100%',
        alignItems: 'center',
    },
    modalDoneBtnText: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 14,
        color: '#4B5563',
    },
    locationBadge: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 6,
        backgroundColor: '#FFF5F5',
        borderWidth: 1,
        borderColor: '#FECACA',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 7,
        marginBottom: 16,
        width: '100%',
    },
    locationBadgeText: {
        fontFamily: 'Poppins-Regular',
        fontSize: 11,
        color: '#B91C1C',
        flex: 1,
        lineHeight: 16,
    },
    switchHeaderPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    switchHeaderPillText: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 12,
        color: '#FF6A00',
    },
    emptyCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#F3F4F6',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
    emptyCardTitle: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 14,
        color: '#111827',
        marginBottom: 2,
    },
    emptyCardSub: {
        fontFamily: 'Poppins-Regular',
        fontSize: 12,
        color: '#6B7280',
    },
    noPlanCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 18,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#FFE4D6',
        shadowColor: '#FE6700',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 3,
    },
    noPlanHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    noPlanIconBox: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: '#FFF5ED',
        justifyContent: 'center',
        alignItems: 'center',
    },
    noPlanTitle: {
        fontFamily: 'Poppins-Bold',
        fontSize: 16,
        color: '#111827',
    },
    noPlanSubtitle: {
        fontFamily: 'Poppins-Regular',
        fontSize: 12,
        color: '#6B7280',
    },
    noPlanDesc: {
        fontFamily: 'Poppins-Regular',
        fontSize: 13,
        color: '#4B5563',
        lineHeight: 19,
        marginBottom: 14,
    },
    noPlanBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FE6700',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        gap: 8,
    },
    noPlanBtnText: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 14,
        color: '#FFFFFF',
    },
    familyCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#F3F4F6',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    familyAvatar: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: '#F3F4F6',
    },
    familyInfo: {
        flex: 1,
        marginLeft: 12,
    },
    familyName: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 15,
        color: '#111827',
    },
    selfBadge: {
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    selfBadgeText: {
        fontFamily: 'Poppins-Medium',
        fontSize: 10,
        color: '#2563EB',
    },
    familyMeta: {
        fontFamily: 'Poppins-Regular',
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    familyStatusWrap: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    activePlanBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        gap: 5,
    },
    activeDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#10B981',
    },
    activePlanText: {
        fontFamily: 'Poppins-Medium',
        fontSize: 11,
        color: '#059669',
    },
    pendingPlanBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFBEB',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        gap: 4,
    },
    pendingPlanText: {
        fontFamily: 'Poppins-Medium',
        fontSize: 11,
        color: '#D97706',
    },
    expiredPlanBadge: {
        backgroundColor: '#FEF2F2',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    expiredPlanText: {
        fontFamily: 'Poppins-Medium',
        fontSize: 11,
        color: '#DC2626',
    },
    neutralPlanBadge: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    neutralPlanText: {
        fontFamily: 'Poppins-Medium',
        fontSize: 11,
        color: '#6B7280',
    },
    emptyFamilyCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#F3F4F6',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    emptyFamilyIconBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#FFF5ED',
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyFamilyTitle: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 14,
        color: '#111827',
        marginBottom: 2,
    },
    emptyFamilySub: {
        fontFamily: 'Poppins-Regular',
        fontSize: 12,
        color: '#6B7280',
        lineHeight: 17,
        marginBottom: 10,
    },
    addFamilyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: '#FE6700',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    addFamilyBtnText: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 12,
        color: '#FFFFFF',
    },
});