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

const MOCK_BENEFICIARY_ID = '8340d860-2641-479c-b26a-8b9a71bcec29';

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

    const { availableRoles, switchRole, isSwitchingRole } = useAuth();
    const isDualRole = availableRoles.includes('subscriber') && availableRoles.includes('beneficiary');

    const handleSwitchToSubscriber = async () => {
        try {
            await switchRole('subscriber');
            router.replace('/(subscriber)');
        } catch (err: any) {
            Alert.alert('Switch Failed', err?.message || 'Could not switch to subscriber view.');
        }
    };

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
        data,
        isLoading: loading,
    } = useQuery({
        queryKey: ['beneficiaryDashboardInfo', MOCK_BENEFICIARY_ID],
        queryFn: async () => {
            const [storedUser, storedToken] = await Promise.all([
                AsyncStorage.getItem('userData'),
                AsyncStorage.getItem('userToken'),
            ]);

            if (!storedUser || !storedToken) {
                throw new Error('Auth missing');
            }

            const response = await fetch(`${API_URL}/beneficiary/dashboard/dashboard/me`, {
                headers: {
                    Authorization: `Bearer ${storedToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error('Backend error');
            }

            const res = await response.json();
            if (res.success) {
                return res.data;
            }

            throw new Error('API returned false success');
        },
    });

    const handleEmergencyPress = async () => {
        if (triggeringEmergency) return;

        // Optimistic confirmation dialog first — then locate & dial 01142258823
        const executeEmergency = async () => {
            setTriggeringEmergency(true);
            setLocationStatus('locating');

            // Trigger immediate phone call to Emergency Helpline: 01142258823
            dialEmergencyHelpline().catch(() => {});

            try {
                const result = await triggerEmergencyAlert(
                    'SOS Emergency Support triggered from MaiHoonNa Mobile App',
                    { autoDial: false } // already dialed above
                );
                setLocationStatus('done');

                if (result.success) {
                    setEmergencySuccessModal({
                        ticketNumber: result.ticketNumber || 'EMG-ALERT',
                        message: `Helpline ${result.helplineNumber || '011-42258823'} dialed. Your Subscriber, Care Companions, and Admin Emergency Center have been alerted with your location.`,
                        locationAddress: result.locationAddress,
                        lat: result.lat,
                        lng: result.lng,
                    });
                } else {
                    const errMsg = result.error || 'Failed to dispatch emergency alert.';
                    if (Platform.OS === 'web') window.alert(`Alert: ${errMsg}`);
                    else Alert.alert('Emergency Alert', errMsg);
                }
            } catch (err: any) {
                const errMsg = err.message || 'Network error while triggering emergency alert.';
                if (Platform.OS === 'web') window.alert(`Notice: ${errMsg}`);
                else Alert.alert('Notice', errMsg);
            } finally {
                setTriggeringEmergency(false);
                setLocationStatus('idle');
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(`🚨 TRIGGER EMERGENCY SOS ALERT?\n\nThis will immediately call Emergency Helpline (${EMERGENCY_HELPLINE_NUMBER}) and alert your Subscriber, Care Companions, and Emergency Center.`)) {
                executeEmergency();
            }
        } else {
            Alert.alert(
                '🚨 Trigger Emergency Alert?',
                `This will immediately call our 24/7 Emergency Helpline (${EMERGENCY_HELPLINE_NUMBER}) and broadcast your live GPS location to your care team & emergency response center.`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'CALL & SEND SOS NOW', style: 'destructive', onPress: executeEmergency },
                ]
            );
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FE6700" />
            </View>
        );
    }

    const displayData: DashboardData = data || {
        greeting: 'Good Morning',
        firstName: 'User',
        emotionalScore: 8,
        nextVisit: 'Feb 27',
        adherence: '95%',
        careCoordinator: {
            id: '1',
            name: 'Dr. Sarah Johnson',
            role: 'Primary Care Coordinator',
            bio: 'Board-certified nurse practitioner with 15+ years of experience in geriatric care.',
            photo: null,
            phone: '+91 98765 43210',
        },
        todaysMedications: [
            {
                id: '1',
                name: 'Lisinopril',
                dosage: '10mg',
                condition: 'Blood Pressure',
                time: '08:00 AM',
                completed: false,
                adherenceScore: 95,
            },
            {
                id: '2',
                name: 'Metformin',
                dosage: '500mg',
                condition: 'Diabetes',
                time: '08:00 AM',
                completed: false,
                adherenceScore: 92,
            },
        ],
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'Not Scheduled';

        const date = new Date(dateString);
        if (Number.isNaN(date.getTime())) return dateString;

        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        });
    };

    return (
        <ScrollView
            style={styles.container}
            bounces={false}
            showsVerticalScrollIndicator={false}
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
                                <Text style={styles.greetingTitle}>{displayData.greeting}</Text>
                                <Text style={styles.greetingSubtitle}>
                                    How are you feeling today?
                                </Text>
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                {isDualRole && (
                                    <TouchableOpacity
                                        style={styles.switchHeaderPill}
                                        onPress={handleSwitchToSubscriber}
                                        disabled={isSwitchingRole}
                                        activeOpacity={0.8}
                                    >
                                        {isSwitchingRole ? (
                                            <ActivityIndicator size="small" color="#FF6A00" />
                                        ) : (
                                            <>
                                                <Ionicons name="swap-horizontal" size={14} color="#FF6A00" style={{ marginRight: 4 }} />
                                                <Text style={styles.switchHeaderPillText}>Subscriber View</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                )}

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
                <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                        <View style={[styles.statIconBadge, { backgroundColor: '#DBEAFE' }]}>
                            <Feather name="calendar" size={20} color="#155DFC" />
                        </View>

                        <Text style={styles.statLabel}>Next Visit</Text>
                        <Text style={styles.statValue}>
                            {formatDate(displayData.nextVisit)}
                        </Text>
                    </View>

                    <View style={styles.statCard}>
                        <View style={[styles.statIconBadge, { backgroundColor: '#DCFCE7' }]}>
                            <Feather name="trending-up" size={20} color="#00A63E" />
                        </View>

                        <Text style={styles.statLabel}>Adherence</Text>
                        <Text style={styles.statValue}>{displayData.adherence}</Text>
                    </View>
                </View>

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Your Care Coordinator</Text>
                    <TouchableOpacity onPress={() => router.push('/(beneficiary)/team')}>
                        <Text style={styles.linkText}>View Team</Text>
                    </TouchableOpacity>
                </View>

                {displayData.careCoordinator && (
                    <View style={styles.card}>
                        <View style={styles.ccHeader}>
                            <View style={styles.ccAvatar}>
                                {displayData.careCoordinator.photo ? (
                                    <Image
                                        source={{ uri: sanitizeImageUri(displayData.careCoordinator.photo) }}
                                        style={styles.ccImage}
                                    />

                                ) : (
                                    <AntDesign name="user" size={30} color="#AAAAAA" />
                                )}
                            </View>

                            <View style={styles.ccInfo}>
                                <Text style={styles.ccName}>
                                    {displayData.careCoordinator.name}
                                </Text>
                                <Text style={styles.ccRole}>
                                    {displayData.careCoordinator.role}
                                </Text>
                            </View>
                        </View>

                        <Text style={styles.ccBio} numberOfLines={2}>
                            {displayData.careCoordinator.bio}
                        </Text>

                        <ConnectContactButton
                            name={displayData.careCoordinator.name}
                            role={displayData.careCoordinator.role}
                            phone={displayData.careCoordinator.phone || null}
                            photo={displayData.careCoordinator.photo}
                            trigger={
                                <View style={styles.primaryBtn}>
                                    <Text style={styles.primaryBtnText}>Call Now</Text>
                                </View>
                            }
                        />
                    </View>
                )}

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Today's Medications</Text>
                    <TouchableOpacity onPress={() => router.push('/(beneficiary)/meds' as any)}>
                        <Text style={styles.linkText}>View All</Text>
                    </TouchableOpacity>
                </View>

                {displayData.todaysMedications.map((med) => (
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

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Quick Actions</Text>
                </View>

                <View style={styles.quickActionsGrid}>
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
                        onPress={() => router.push('/(beneficiary)/meds' as any)}
                    >
                        <View style={[styles.actionIconBadge, { backgroundColor: '#FEF3C7' }]}>
                            <MaterialCommunityIcons name="pill" size={24} color="#D97706" />
                        </View>

                        <Text style={styles.actionTitle} numberOfLines={1} adjustsFontSizeToFit>Medications</Text>
                        <Text style={styles.actionSubtitle} numberOfLines={2}>View schedule & details</Text>
                    </TouchableOpacity>

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
});