import React, { useState, useEffect, useRef, useCallback } from 'react';
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
    RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Feather, AntDesign, Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { API_URL } from '@/constants/api';
import NotificationBell from '@/components/shared/NotificationBell';
import { useExitOnBack } from '@/hooks/useExitOnBack';
import { useAuth } from '@/contexts/AuthContext';
import { triggerEmergencyAlert, dialEmergencyHelpline, EMERGENCY_HELPLINE_NUMBER } from '@/services/emergencyTrigger';
import { useCustomAlert } from '@/contexts/CustomAlertContext';
import {
    UnlinkedPlansBanner,
    FamilyCareSection,
    PersonalCareOverview,
    PersonalCarePromoCard,
    QuickActionsSection,
    CommunityShowcaseSection,
    FamilyConnectIntroModal,
    CareCircleModal,
    JoinCareCircleModal,
    RenewOrLinkModal,
} from '@/components/dashboard';
import {
    SaathiIntroModal,
    SaathiBeneficiaryPickerModal,
    SaathiEligibleMember,
} from '@/components/saathi';
import { AccessRequestsBanner } from '@/components/access';


const headerPattern = require('@/assets/images/header-pattern.png');

interface DashboardData {
    beneficiaryId?: string;
    beneficiaryName?: string;
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
    
    // Standardized containerisation across Android & iOS (compact phones, modern flagships, tablets)
    const isTablet = width >= 768;
    const MAX_CONTAINER_WIDTH = 640;
    const horizontalGutter = width < 380 ? 12 : 16;
    const containerWidth = Math.min(width, MAX_CONTAINER_WIDTH);
    const innerContentWidth = containerWidth - (horizontalGutter * 2);

    // Responsive grid for Quick Actions
    const numColumns = isTablet ? 4 : 2;
    const gridGap = 12;
    const actionCardWidth = Math.floor((innerContentWidth - ((numColumns - 1) * gridGap)) / numColumns);

    const responsiveContainerStyle = {
        width: '100%' as const,
        maxWidth: MAX_CONTAINER_WIDTH,
        alignSelf: 'center' as const,
        paddingHorizontal: horizontalGutter,
    };

    useExitOnBack();
    const { showConfirm, showAlert } = useCustomAlert();
    const { user, isGuest, requireAuth } = useAuth();

    const [triggeringEmergency, setTriggeringEmergency] = useState(false);
    const [locationStatus, setLocationStatus] = useState<'idle' | 'locating' | 'done'>('idle');
    const [emergencySuccessModal, setEmergencySuccessModal] = useState<{
        ticketNumber: string;
        message: string;
        locationAddress?: string;
        lat?: number;
        lng?: number;
    } | null>(null);
    const [emergencyEligible, setEmergencyEligible] = useState<boolean>(false);
    const [sathiEligible, setSathiEligible] = useState<boolean>(false);
    const [showFamilyIntroModal, setShowFamilyIntroModal] = useState<boolean>(false);
    const [showCareCircleModal, setShowCareCircleModal] = useState<boolean>(false);
    const [selectedCircleBen, setSelectedCircleBen] = useState<{ id: string; name: string } | null>(null);
    const [showJoinCircleModal, setShowJoinCircleModal] = useState<boolean>(false);
    const [showRenewalModal, setShowRenewalModal] = useState<boolean>(false);
    const [renewalTargetBen, setRenewalTargetBen] = useState<{ id: string; name: string; relationship?: string } | null>(null);
    const [sathiEligibleBeneficiaries, setSathiEligibleBeneficiaries] = useState<any[]>([]);
    const [showSaathiIntroModal, setShowSaathiIntroModal] = useState<boolean>(false);
    const [showSaathiPickerModal, setShowSaathiPickerModal] = useState<boolean>(false);

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

    const [refreshing, setRefreshing] = useState(false);

    const fetchEligibility = useCallback(async () => {
        try {
            if (isGuest) {
                setEmergencyEligible(false);
                setSathiEligible(false);
                return;
            }

            const [storedUser, storedToken] = await Promise.all([
                AsyncStorage.getItem('userData'),
                AsyncStorage.getItem('userToken'),
            ]);
            if (!storedUser || !storedToken) {
                setEmergencyEligible(false);
                setSathiEligible(false);
                return;
            }
            const parsedUser = JSON.parse(storedUser);

            // Check emergency eligibility
            const emergencyRes = await fetch(`${API_URL}/beneficiary/${parsedUser.id}/emergency/eligibility`, {
                headers: { Authorization: `Bearer ${storedToken}` }
            });
            if (emergencyRes.ok) {
                const emergencyData = await emergencyRes.json();
                setEmergencyEligible(Boolean(emergencyData?.data?.eligible));
            } else {
                setEmergencyEligible(false);
            }

            // Check sathi eligibility
            const sathiRes = await fetch(`${API_URL}/beneficiary/sathi-requests/${parsedUser.id}/sathi/eligibility`, {
                headers: { Authorization: `Bearer ${storedToken}` }
            });
            if (sathiRes.ok) {
                const sathiData = await sathiRes.json();
                setSathiEligible(Boolean(sathiData?.data?.eligible));
            } else {
                setSathiEligible(false);
            }

            // Check sathi eligible beneficiaries for subscriber
            try {
                const sathiBenRes = await fetch(`${API_URL}/subscriber/beneficiaries/sathi-eligible`, {
                    headers: { Authorization: `Bearer ${storedToken}` }
                });
                const sathiBenData = await sathiBenRes.json();
                if (sathiBenRes.ok && sathiBenData?.success && Array.isArray(sathiBenData?.data)) {
                    setSathiEligibleBeneficiaries(sathiBenData.data);
                } else {
                    setSathiEligibleBeneficiaries([]);
                }
            } catch (benErr) {
                console.warn('[SathiEligibleBeneficiaries] Error fetching:', benErr);
                setSathiEligibleBeneficiaries([]);
            }
        } catch (err) {
            console.error('[EligibilityCheck] Error checking:', err);
            setEmergencyEligible(false);
            setSathiEligible(false);
        }
    }, [isGuest]);

    useEffect(() => {
        fetchEligibility();
    }, [fetchEligibility]);

    const {
        data: personalData,
        isLoading: personalLoading,
        refetch: refetchPersonalData,
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
        refetch: refetchSubscriberData,
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
            return res.success ? (res.data || res) : null;
        },
    });

    const {
        data: communityEvents = [],
        isLoading: communityLoading,
        refetch: refetchCommunityEvents,
    } = useQuery({
        queryKey: ['communityShowcaseEvents', user?.id],
        queryFn: async () => {
            const storedToken = await AsyncStorage.getItem('userToken');
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (storedToken) headers['Authorization'] = `Bearer ${storedToken}`;

            const response = await fetch(`${API_URL}/community/events?timeline=upcoming`, { headers });
            if (!response.ok) return [];
            const res = await response.json();
            return res.success && Array.isArray(res.data) ? res.data : [];
        },
    });

    const refetchAllData = useCallback(async () => {
        await Promise.allSettled([
            refetchPersonalData(),
            refetchSubscriberData(),
            fetchEligibility(),
            refetchCommunityEvents(),
        ]);
    }, [refetchPersonalData, refetchSubscriberData, fetchEligibility, refetchCommunityEvents]);

    const handlePullToRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await refetchAllData();
        } finally {
            setRefreshing(false);
        }
    }, [refetchAllData]);

    // Auto-refresh when screen receives focus (e.g. after clicking any event, modal, or returning from actions)
    useFocusEffect(
        useCallback(() => {
            refetchAllData();
        }, [refetchAllData])
    );

    const handleEmergencyPress = async () => {
        if (requireAuth('Trigger emergency SOS and broadcast your live location to care responders.')) return;
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
    const firstName = isGuest ? 'Guest' : (user?.name ? user.name.split(' ')[0] : (personalData?.firstName || 'there'));
    const familyBeneficiaries: any[] = subscriberData?.beneficiaries || subscriberData?.data?.beneficiaries || [];
    const activeSubscriptions: any[] = subscriberData?.activeSubscriptions || subscriberData?.data?.activeSubscriptions || [];
    const unlinkedSubs: any[] = activeSubscriptions.filter((sub: any) => !sub.beneficiaryId);
    const hasFamilyOrPlans = familyBeneficiaries.length > 0 || hasPersonalCarePlan || unlinkedSubs.length > 0;
    const topStats = subscriberData?.topStats || subscriberData?.data?.topStats || {};
    const remainingHours = topStats?.activeHours?.remaining ?? 0;
    const visitsThisWeek = topStats?.visitsThisWeek?.total ?? 0;

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

    const getEligibleSaathiList = (): SaathiEligibleMember[] => {
        const list: SaathiEligibleMember[] = [];

        // 1. Personal user if eligible
        if (sathiEligible && user?.id) {
            list.push({
                id: user.id,
                name: user.name || 'Personal Account',
                relationship: 'Self',
                isPersonal: true,
                photo: (user as any)?.profilePhoto || (user as any)?.photo || null,
            });
        }

        // 2. Beneficiaries returned by /sathi-eligible
        const seenIds = new Set(list.map((m) => m.id));
        (sathiEligibleBeneficiaries || []).forEach((b: any) => {
            if (!seenIds.has(b.id)) {
                seenIds.add(b.id);
                list.push({
                    id: b.id,
                    name: b.name || `${b.firstName || ''} ${b.lastName || ''}`.trim() || 'Family Member',
                    relationship: b.relationship || 'Family',
                    photo: b.photo || null,
                    age: b.age || null,
                    planName: b.activePackageName || b.packageName || undefined,
                });
            }
        });

        // 3. Fallback: check familyBeneficiaries if plan includes sathi
        (familyBeneficiaries || []).forEach((b: any) => {
            if (
                !seenIds.has(b.id) &&
                b.hasActivePlan &&
                (b.sathiEligible || b.packageName?.toLowerCase?.().includes('sathi') || b.packageName?.toLowerCase?.().includes('premium'))
            ) {
                seenIds.add(b.id);
                list.push({
                    id: b.id,
                    name: b.name || `${b.firstName || ''} ${b.lastName || ''}`.trim() || 'Family Member',
                    relationship: b.relationship || 'Family',
                    photo: b.photo || null,
                    age: b.age || null,
                    planName: b.packageName || undefined,
                });
            }
        });

        return list;
    };

    const handleSaathiPress = () => {
        if (requireAuth('Request a verified Saathi companion or book your free care assessment.')) return;
        const eligibleList = getEligibleSaathiList();

        if (eligibleList.length === 0) {
            // No Saathi package active -> show educational overview modal
            setShowSaathiIntroModal(true);
            return;
        }

        if (eligibleList.length === 1) {
            // Exactly 1 eligible profile -> directly open
            const target = eligibleList[0];
            router.push({
                pathname: '/(beneficiary)/sathi-request',
                params: {
                    beneficiaryId: target.id,
                    beneficiaryName: target.name,
                },
            });
            return;
        }

        // Multiple eligible profiles -> open Beneficiary Selector Modal
        setShowSaathiPickerModal(true);
    };

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]}
            bounces={true}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={handlePullToRefresh}
                    colors={['#FE6700']}
                    tintColor="#FE6700"
                    progressBackgroundColor="#FFFFFF"
                />
            }
        >
            <View style={styles.headerWrapper}>
                <ImageBackground
                    source={headerPattern}
                    style={styles.headerBackground}
                    resizeMode="cover"
                >
                    <View
                        style={{
                            paddingTop: Math.max(insets.top, Platform.OS === 'android' ? 24 : 16) + 10,
                            paddingBottom: 22,
                        }}
                    >
                        <View style={responsiveContainerStyle}>
                            <View style={styles.headerContent}>
                                <View style={{ flex: 1, marginRight: 10 }}>
                                    <Text style={styles.greetingTitle} numberOfLines={1} adjustsFontSizeToFit>
                                        {isGuest ? 'Welcome to MaiHoonNa!' : `${greeting}, ${firstName}!`}
                                    </Text>
                                    <Text style={styles.greetingSubtitle} numberOfLines={1}>
                                        {isGuest ? 'Explore our trusted senior care services' : 'How are you feeling today?'}
                                    </Text>
                                </View>

                                {isGuest ? (
                                    <TouchableOpacity
                                        style={styles.guestHeaderSignInBtn}
                                        onPress={() => requireAuth('Create an account or sign in to unlock all features.')}
                                        activeOpacity={0.8}
                                    >
                                        <Feather name="user-plus" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                                        <Text style={styles.guestHeaderSignInText}>Create Account</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <View style={styles.headerRightGroup}>
                                        <TouchableOpacity
                                            style={styles.switchHeaderPill}
                                            onPress={() => {
                                                if (!hasFamilyOrPlans) {
                                                    setShowFamilyIntroModal(true);
                                                } else {
                                                    router.push('/(subscriber)');
                                                }
                                            }}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons name="people-outline" size={14} color="#FF6A00" style={{ marginRight: 4 }} />
                                            <Text style={styles.switchHeaderPillText}>Family</Text>
                                        </TouchableOpacity>

                                        <View style={styles.notificationWrapper}>
                                            <NotificationBell />
                                        </View>
                                    </View>
                                )}
                            </View>

                            {!isGuest && emergencyEligible && (
                                <Animated.View style={{ transform: [{ scale: pulseAnim }], width: '100%', marginTop: 12 }}>
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
                                                <Feather name="phone-call" size={22} color="#FFFFFF" />
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
                    </View>
                </ImageBackground>
            </View>

            <View style={[styles.mainContent, responsiveContainerStyle]}>
                {/* ── Guest Exploration Banner ── */}
                {isGuest && (
                    <TouchableOpacity
                        style={styles.guestBannerCard}
                        onPress={() => requireAuth('Create an account to track your daily vitals and request care.')}
                        activeOpacity={0.88}
                    >
                        <View style={styles.guestBannerIconWrap}>
                            <MaterialCommunityIcons name="shield-star" size={24} color="#FF6A00" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                <Text style={styles.guestBannerTitle}>Guest Exploration Mode</Text>
                                <View style={styles.guestPill}>
                                    <Text style={styles.guestPillText}>PREVIEW</Text>
                                </View>
                            </View>
                            <Text style={styles.guestBannerDesc}>
                                Create an account to track vitals, book companions, and get 24/7 care support.
                            </Text>
                        </View>
                        <View style={styles.guestBannerCta}>
                            <Text style={styles.guestBannerCtaText}>Create Account</Text>
                            <Feather name="arrow-right" size={12} color="#FFFFFF" />
                        </View>
                    </TouchableOpacity>
                )}

                {/* ── Unlinked Care Plans Alert (High Priority Action) ── */}
                <UnlinkedPlansBanner
                    unlinkedCount={unlinkedSubs.length}
                    packageName={unlinkedSubs[0]?.package?.name}
                    onAssignPress={() => router.push('/(subscriber)')}
                />

                {/* ── Pending Profile Access Requests & Invitations Banner ── */}
                <AccessRequestsBanner
                    pendingCount={subscriberData?.pendingIncomingRequestsCount || 0}
                    onChanged={refetchAllData}
                />

                {/* ── Personal Care Plan (If Active) ── */}
                {hasPersonalCarePlan && personalData && (
                    <PersonalCareOverview
                        data={personalData}
                        onViewTeam={() => router.push('/(beneficiary)/team')}
                        onViewAllMeds={() => router.push({
                            pathname: '/(beneficiary)/meds',
                            params: { beneficiaryId: personalData.beneficiaryId }
                        } as any)}
                        onSelectMed={(medId) => router.push({
                            pathname: '/(beneficiary)/meds',
                            params: { beneficiaryId: personalData.beneficiaryId, highlightMedId: medId }
                        } as any)}
                        onOpenCareCircle={() => {
                            if (personalData.beneficiaryId) {
                                setSelectedCircleBen({
                                    id: personalData.beneficiaryId,
                                    name: personalData.beneficiaryName ? `${personalData.beneficiaryName} (My Care)` : 'My Profile (Self)'
                                });
                                setShowCareCircleModal(true);
                            }
                        }}
                    />
                )}

                {/* ── Brand-New User with No Plan AND No Family Members Added ── */}
                {!hasPersonalCarePlan && familyBeneficiaries.length === 0 && (
                    <PersonalCarePromoCard
                        isCompact={false}
                        isGuest={isGuest}
                        onExplorePress={() => {
                            if (isGuest && requireAuth('Create an account to explore and subscribe to care plans.')) return;
                            router.push('/(setup)/subscription-packages');
                        }}
                    />
                )}

                {/* ── Family Care Activity ── */}
                <FamilyCareSection
                    beneficiaries={familyBeneficiaries}
                    remainingHours={remainingHours}
                    visitsThisWeek={visitsThisWeek}
                    onSelectBeneficiary={(b) => {
                        const isPending = b.packageStatus === 'pending' || b.verificationStatus === 'pending';
                        const isExpired = b.packageStatus === 'expired';
                        if (isPending) {
                            router.push({
                                pathname: '/(setup)/beneficiary-info',
                                params: { isVerificationFlow: 'true', beneficiaryId: b.id }
                            });
                        } else if (isExpired) {
                            if (unlinkedSubs.length > 0) {
                                setRenewalTargetBen(b);
                                setShowRenewalModal(true);
                            } else {
                                router.push({
                                    pathname: '/(setup)/subscription-packages',
                                    params: { beneficiaryId: b.id, beneficiaryName: b.name }
                                });
                            }
                        } else {
                            AsyncStorage.setItem('selectedBeneficiaryId', b.id);
                            router.push(`/(subscriber)/beneficiary-profile?id=${b.id}`);
                        }
                    }}
                    onAddMember={() => {
                        if (isGuest && requireAuth('Create an account to add and manage family care members.')) return;
                        router.push({ pathname: '/(setup)/subscribe-form', params: { isLinkingFlow: 'true' } });
                    }}
                    onOpenFamilyConnect={() => {
                        if (isGuest && requireAuth('Create an account to access Family Connect.')) return;
                        if (!hasFamilyOrPlans) {
                            setShowFamilyIntroModal(true);
                        } else {
                            router.push('/(subscriber)');
                        }
                    }}
                    onOpenCareCircle={(b) => {
                        if (isGuest && requireAuth('Create an account to view and manage care circles.')) return;
                        setSelectedCircleBen({ id: b.id, name: b.name });
                        setShowCareCircleModal(true);
                    }}
                    onOpenJoinCircle={() => {
                        if (isGuest && requireAuth('Create an account to join a family care circle.')) return;
                        setShowJoinCircleModal(true);
                    }}
                    pendingAccessRequestsCount={subscriberData?.pendingIncomingRequestsCount || 0}
                    onAccessChanged={refetchAllData}
                />

                {/* ── Personal Wellness Card (when user manages family but has no personal plan yet) ── */}
                {!hasPersonalCarePlan && familyBeneficiaries.length > 0 && (
                    <PersonalCarePromoCard
                        isCompact={true}
                        isGuest={isGuest}
                        onExplorePress={() => {
                            if (isGuest && requireAuth('Create an account to explore and subscribe to care plans.')) return;
                            router.push('/(setup)/subscription-packages');
                        }}
                    />
                )}

                {/* ── Quick Actions Grid ── */}
                <QuickActionsSection
                    actionCardWidth={actionCardWidth}
                    sathiEligible={sathiEligible || sathiEligibleBeneficiaries.length > 0}
                    hasFamilyOrPlans={hasFamilyOrPlans}
                    onFamilyConnectPress={() => {
                        if (requireAuth('Monitor family reports, care hours, and care circles.')) return;
                        if (!hasFamilyOrPlans) {
                            setShowFamilyIntroModal(true);
                        } else {
                            router.push('/(subscriber)');
                        }
                    }}
                    onLogVitalsPress={() => {
                        if (requireAuth('Track and monitor your daily health vitals.')) return;
                        router.push('/(beneficiary)/vitals');
                    }}
                    onSaathiPress={handleSaathiPress}
                    onActionPress={(route) => {
                        if (route === '/(beneficiary)/request-service' && requireAuth('Request home care, nursing, or attendant services.')) return;
                        router.push(route as any);
                    }}
                />

                {/* ── Community Showcase Section ── */}
                <CommunityShowcaseSection
                    events={communityEvents}
                    loading={communityLoading}
                    horizontalGutter={horizontalGutter}
                    onEventPress={(eventId) => {
                        router.push(`/(community)/events/${eventId}` as any);
                    }}
                    onExplorePress={() => {
                        router.push('/(community)' as any);
                    }}
                />

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

            {/* Family Connect Educational Intro Modal (when user has no family/plans) */}
            <FamilyConnectIntroModal
                visible={showFamilyIntroModal}
                onClose={() => setShowFamilyIntroModal(false)}
                onExplorePackages={() => router.push('/(setup)/subscription-packages')}
                onAddFamilyMember={() => router.push({ pathname: '/(setup)/subscribe-form', params: { isLinkingFlow: 'true' } })}
                onJoinWithCode={() => setShowJoinCircleModal(true)}
            />

            {/* Care Circle Management Modal */}
            {selectedCircleBen && (
                <CareCircleModal
                    visible={showCareCircleModal}
                    beneficiaryId={selectedCircleBen.id}
                    beneficiaryName={selectedCircleBen.name}
                    onClose={() => {
                        setShowCareCircleModal(false);
                        setSelectedCircleBen(null);
                        refetchAllData();
                    }}
                    onMembersChanged={() => refetchAllData()}
                />
            )}

            {/* Join Care Circle Modal via Invite Code */}
            <JoinCareCircleModal
                visible={showJoinCircleModal}
                onClose={() => setShowJoinCircleModal(false)}
                onSuccess={() => refetchAllData()}
            />

            {/* Renew / Link Unassigned Care Plan Modal */}
            <RenewOrLinkModal
                visible={showRenewalModal}
                beneficiary={renewalTargetBen}
                unassignedPackages={unlinkedSubs}
                onClose={() => {
                    setShowRenewalModal(false);
                    setRenewalTargetBen(null);
                    refetchAllData();
                }}
                onBrowseNew={() => {
                    const benId = renewalTargetBen?.id;
                    const benName = renewalTargetBen?.name;
                    setShowRenewalModal(false);
                    setRenewalTargetBen(null);
                    router.push({
                        pathname: '/(setup)/subscription-packages',
                        params: { beneficiaryId: benId, beneficiaryName: benName }
                    });
                }}
                onSuccess={() => {
                    refetchAllData();
                }}
            />

            {/* Saathi Educational & Discovery Modal */}
            <SaathiIntroModal
                visible={showSaathiIntroModal}
                onClose={() => setShowSaathiIntroModal(false)}
                onExplorePackages={() => router.push('/(setup)/subscription-packages')}
                onRequestCallback={() => {
                    Alert.alert(
                        'Request Callback',
                        'A dedicated MaiHoonNa Care Coordinator will call you shortly to assist with Saathi companion services.',
                        [{ text: 'OK' }]
                    );
                }}
            />

            {/* Saathi Beneficiary Selector Modal */}
            <SaathiBeneficiaryPickerModal
                visible={showSaathiPickerModal}
                onClose={() => setShowSaathiPickerModal(false)}
                beneficiaries={getEligibleSaathiList()}
                onSelectBeneficiary={(selected) => {
                    setShowSaathiPickerModal(false);
                    router.push({
                        pathname: '/(beneficiary)/sathi-request',
                        params: {
                            beneficiaryId: selected.id,
                            beneficiaryName: selected.name,
                        },
                    });
                }}
            />
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
    scrollContent: {
        flexGrow: 1,
    },
    headerWrapper: {
        width: '100%',
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        overflow: 'hidden',
    },
    headerBackground: {
        width: '100%',
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
    },
    greetingTitle: {
        fontFamily: 'Poppins-Bold',
        fontSize: 22,
        lineHeight: 28,
        color: '#FFFFFF',
    },
    greetingSubtitle: {
        fontFamily: 'Poppins-Regular',
        fontSize: 13,
        lineHeight: 18,
        color: 'rgba(255, 255, 255, 0.95)',
        marginTop: 2,
    },
    headerRightGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
    },
    guestHeaderSignInBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.6)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    guestHeaderSignInText: {
        fontSize: 12,
        fontFamily: 'Poppins-SemiBold',
        color: '#FFFFFF',
    },
    guestBannerCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
        borderWidth: 1.5,
        borderColor: '#FFEDD5',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    guestBannerIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FFF7ED',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#FFEDD5',
    },
    guestBannerTitle: {
        fontSize: 14,
        fontFamily: 'Poppins-SemiBold',
        color: '#111827',
    },
    guestPill: {
        backgroundColor: '#FFF7ED',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#FFEDD5',
    },
    guestPillText: {
        fontSize: 9,
        fontFamily: 'Poppins-Bold',
        color: '#EA580C',
        letterSpacing: 0.5,
    },
    guestBannerDesc: {
        fontSize: 11,
        fontFamily: 'Poppins-Regular',
        color: '#6B7280',
        lineHeight: 16,
    },
    guestBannerCta: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FF6A00',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
        gap: 4,
    },
    guestBannerCtaText: {
        fontSize: 12,
        fontFamily: 'Poppins-SemiBold',
        color: '#FFFFFF',
    },
    notificationWrapper: {
        width: 38,
        height: 38,
        borderRadius: 19,
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
        minHeight: 52,
        width: '100%',
        shadowColor: '#E7000B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    emergencyText: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 15,
        lineHeight: 20,
        color: '#FFFFFF',
    },
    emergencySubtext: {
        fontFamily: 'Poppins-Medium',
        fontSize: 11,
        lineHeight: 15,
        color: 'rgba(255, 255, 255, 0.92)',
    },
    mainContent: {
        paddingTop: 16,
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
});