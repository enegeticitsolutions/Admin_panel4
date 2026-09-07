import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Platform, ActivityIndicator, ImageBackground, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { API_URL } from '@/constants/api';
import { CallbackButton } from '@/components/CallbackButton';
import { ProfilePhotoUploader } from '@/components/ui/ProfilePhotoUploader';
import { TimelineTab } from './components/beneficiary/TimelineTab';
import { VitalsTab } from './components/beneficiary/VitalsTab';
import { MedicalTab } from './components/beneficiary/MedicalTab';

import { NextVisitCard } from './components/beneficiary/NextVisitCard';
import GlobalDrawer from './components/shared/GlobalDrawer';
import { Animated, Dimensions } from 'react-native';
import { useSafeBack } from '@/hooks/useSafeBack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigationStack } from '@/contexts/NavigationStackContext';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';
import { scale } from '@/utils/responsive';

type TabType = 'Timeline' | 'Vitals' | 'Medical';

export default function BeneficiaryProfileScreen() {
    const router = useRouter();
    const { push, replace, pop } = useNavigationStack();
    useAndroidBackHandler();
    const safeBack = useSafeBack();
    const params = useLocalSearchParams();
    const rawId = params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;


    const [activeTab, setActiveTab] = useState<TabType>('Timeline');
    const [userData, setUserData] = useState<any>(null);

    // Drawer state
    const [drawerOpen, setDrawerOpen] = useState(false);
    const { width } = Dimensions.get('window');
    const DRAWER_WIDTH = width * 0.75;
    const drawerAnim = React.useRef(new Animated.Value(DRAWER_WIDTH)).current;

    const openDrawer = () => {
        setDrawerOpen(true);
        Animated.timing(drawerAnim, { toValue: 0, duration: 280, useNativeDriver: true }).start();
    };
    const closeDrawer = () => {
        Animated.timing(drawerAnim, { toValue: DRAWER_WIDTH, duration: 240, useNativeDriver: true }).start(() => setDrawerOpen(false));
    };

    /* ─── API (React Query) ─────────────────────────────────────────────── */
    const {
        data: beneficiary,
        isLoading: loading,
        error,
        refetch
    } = useQuery({
        queryKey: ['beneficiary', id],
        queryFn: async () => {
            const [storedUser, storedToken] = await Promise.all([
                AsyncStorage.getItem('userData'),
                AsyncStorage.getItem('userToken')
            ]);

            if (storedUser) setUserData(JSON.parse(storedUser));

            if (!storedUser || !storedToken) {
                replace('/(auth)');
                throw new Error("Auth missing");
            }

            console.log(`[BeneficiaryProfile] Fetching profile for ID: "${id}" from: ${API_URL}/subscriber/beneficiaries/${id}/profile`);

            const res = await fetch(`${API_URL}/subscriber/beneficiaries/${id}/profile`, {
                headers: {
                    'Authorization': `Bearer ${storedToken}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log(`[BeneficiaryProfile] Response status: ${res.status}`);

            if (res.status === 401) {
                console.error('[BeneficiaryProfile] Unauthorized access - redirecting to login');
                replace('/(auth)');
                throw new Error("Unauthorized");
            }

            let data;
            try {
                data = await res.json();
            } catch (parseErr: any) {
                console.error('[BeneficiaryProfile] Failed to parse JSON response:', parseErr);
                throw new Error(`Server returned status ${res.status}`);
            }

            console.log(`[BeneficiaryProfile] Response payload:`, JSON.stringify(data));

            if (data.success && data.data) {
                return data.data;
            }
            throw new Error(data.message || `Failed to fetch beneficiary (status: ${res.status})`);
        },
        enabled: !!id,
    });

    useFocusEffect(
        useCallback(() => {
            refetch();
        }, [refetch])
    );

    useEffect(() => {
    // no-op: we no longer show a default-data alert since vitals are fully
    // filtered server-side based on the beneficiary's tracked selections.
    // Kept in case future telemetry is wired here.
    }, [beneficiary?.isDefaultData]);

    if (loading) {
        return (
            <SafeAreaView style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#F97316" />
            </SafeAreaView>
        );
    }

    if (!beneficiary) {
        return (
            <SafeAreaView style={styles.centerContainer}>
                <Ionicons name="warning-outline" size={scale(48)} color="#9CA3AF" style={{ marginBottom: scale(12) }} />
                <Text style={styles.notFoundText}>Beneficiary not found.</Text>
                {error ? (
                    <Text style={{ color: '#EF4444', fontSize: 13, marginTop: 8, marginBottom: 16, textAlign: 'center', paddingHorizontal: 24 }}>
                        {(error as any)?.message}
                    </Text>
                ) : null}
                <TouchableOpacity style={styles.backBtn} onPress={() => safeBack()}>
                    <Text style={styles.backBtnText}>← Go Back</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    // Use lastHappinessScore: derived from most recent CC visit with mood recorded (same as vitals).
    // null means no mood was ever recorded in any visit → show '--'
    const happinessScore = beneficiary.lastHappinessScore !== null && beneficiary.lastHappinessScore !== undefined
        ? `${beneficiary.lastHappinessScore}%`
        : '--';
    const conditions = beneficiary.conditions?.map((c: any) => c.condition?.name) || [];

    /** Returns a distinct pastel icon-box background for each vital type */
    /** Returns a distinct pastel icon-box background for each vital code */
    const getVitalBgColor = (code: string, label: string): string => {
        switch (code) {
            case 'PULSE':         return '#FFD9EC'; // pink
            case 'BP':            return '#FFD9D9'; // red-tint
            case 'BLOOD_GLUCOSE': return '#FFF3CD'; // amber
            case 'TEMP':          return '#D1F5FA'; // cyan
            case 'SPO2':          return '#D1FAE5'; // green
            case 'WEIGHT':        return '#DBEAFE'; // blue
            case 'PAIN':          return '#FFE8D9'; // orange
            case 'RESP':          return '#CCFBF1'; // teal
        }
        // Fallback: map by label (backwards compat + custom vitals)
        switch (label) {
            case 'Heart Rate':        return '#FFD9EC';
            case 'Blood Pressure':    return '#FFD9D9';
            case 'Blood Sugar':       return '#FFF3CD';
            case 'Temperature':       return '#D1F5FA';
            case 'Oxygen Saturation': return '#D1FAE5';
            case 'Weight':            return '#DBEAFE';
            default:                  return '#F3F4F6'; // grey fallback for custom vitals
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            {/* Simple inline header */}
            <View style={styles.inlineHeader}>
                <TouchableOpacity onPress={() => safeBack()} style={styles.iconBtn}>
                    <Ionicons name="arrow-back" size={scale(24)} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Beneficiary Details</Text>
                <TouchableOpacity onPress={() => push({ pathname: '/(subscriber)/beneficiary-edit', params: { id } })} style={styles.iconBtn}>
                    <Ionicons name="pencil-outline" size={scale(22)} color="#FE6700" />
                </TouchableOpacity>
                <TouchableOpacity onPress={openDrawer} style={styles.iconBtn}>
                    <Ionicons name="menu-outline" size={scale(28)} color="#111827" />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* ── Hero Card ── */}
                <View style={styles.heroSection}>
                    <ImageBackground
                        source={require("../../assets/images/bg01.png")}
                        style={styles.heroGradient}
                        imageStyle={styles.heroImage}
                        resizeMode="stretch"
                    >
                        <LinearGradient colors={['rgba(249,115,22,0.38)', 'rgba(253,186,116,0.24)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroOverlay} />
                    </ImageBackground>

                    <View style={styles.avatarFloating}>
                        <ProfilePhotoUploader
                            config={{
                                targetType: 'beneficiary',
                                targetId: beneficiary.id,
                                currentPhotoUrl: beneficiary.photo || null,
                                size: 90,
                                editable: true,
                                initials: (beneficiary.name || 'B').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2),
                                accentColor: '#F97316',
                                onSuccess: (url) => refetch(), // Instead of modifying local state, trigger refetch to update cache
                            }}
                            style={{ marginBottom: scale(12) }}
                        />
                    </View>

                    <View style={styles.profileCard}>
                        <Text style={styles.heroName}>{beneficiary.name}</Text>
                        <Text style={styles.heroMeta}>{beneficiary.age ? `${beneficiary.age} years` : ''}{beneficiary.relationship ? ` • ${beneficiary.relationship}` : ''}</Text>

                        {/* ── Stats Row ── */}
                        <View style={styles.statsRow}>
                            <View style={styles.statItem}>
                                <View style={[styles.statIconBox, styles.happinessIconBox]}>
                                    <Text style={styles.statEmoji}>😊</Text>
                                </View>
                                <Text style={styles.statValue}>{happinessScore}</Text>
                                <Text style={styles.statLabel}>Happiness Score</Text>
                            </View>
                            <View style={styles.statItem}>
                                <View style={[styles.statIconBox, styles.hoursIconBox]}>
                                    <Ionicons name="hourglass-outline" size={scale(25)} color="#1F6BFF" />
                                </View>
                                <Text style={styles.statValue}>{beneficiary.hoursUsedPercent || 0}%</Text>
                                <Text style={styles.statLabel}>Hours Used</Text>
                            </View>
                            {beneficiary.vitalsData?.slice(0, 4).map((v: any, i: number) => (
                                <View key={v.label} style={styles.statItem}>
                                    <View style={[styles.statIconBox, { backgroundColor: getVitalBgColor(v.code || '', v.label) }]}>
                                        <MaterialCommunityIcons name={v.icon} size={scale(24)} color={v.color} />
                                    </View>
                                    <Text style={styles.statValue}>{v.value}</Text>
                                    <Text style={styles.statLabel}>{v.label}</Text>
                                </View>
                            ))}
                        </View>

                        {conditions.length > 0 && (
                            <View style={styles.conditionsSection}>
                                <Text style={styles.conditionsTitle}>Medical Conditions:</Text>
                                <View style={styles.conditionsTags}>
                                    {conditions.map((c: string, i: number) => (
                                        <View key={i} style={styles.conditionTag}>
                                            <Text style={styles.conditionTagText}>{c}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}
                    </View>
                </View>

                {/* ── Next Visit Card (New Feature) ── */}
                <NextVisitCard nextVisit={beneficiary.nextVisit} />

                {/* ── Tabs & Content Wrapper ── */}
                <View style={styles.tabSectionWrapper}>
                    {/* ── Tab Bar ── */}
                    <View style={styles.tabBar}>
                        {(['Timeline', 'Vitals', 'Medical'] as TabType[]).map((tab) => (
                            <TouchableOpacity
                                key={tab}
                                style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
                                onPress={() => setActiveTab(tab)}
                            >
                                <Ionicons
                                    name={tab === 'Timeline' ? 'time-outline' : tab === 'Vitals' ? 'pulse-outline' : 'document-text-outline'}
                                    size={scale(16)}
                                    color={activeTab === tab ? '#FF5B0A' : '#333333'}
                                    style={{ marginRight: scale(4) }}
                                />
                                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* ── Tab Content ── */}
                    <View style={styles.tabContentContainer}>
                        {activeTab === 'Timeline' && <TimelineTab visits={beneficiary.timeline || []} />}
                        {activeTab === 'Vitals' && <VitalsTab beneficiary={beneficiary} />}
                        {activeTab === 'Medical' && <MedicalTab beneficiary={beneficiary} conditions={conditions} onRefresh={refetch} />}
                    </View>
                </View>

                {/* ── Assistance Card ── */}
                <View style={styles.assistanceCard}>
                    <View style={styles.assistanceHeader}>
                        <View style={styles.assistanceIllustration}>
                            <Image
                                source={require("../../assets/images/group4.png")}
                                resizeMode="contain"
                                style={{ width: scale(94), height: scale(94) }}
                            />
                        </View>
                        <View style={{ flex: 1, marginLeft: scale(15) }}>
                            <Text style={styles.assistanceTitle}>Need assistance?</Text>
                            <Text style={styles.assistanceSub}>Our experts are here to help you choose the right plan via Phone or WhatsApp.</Text>
                        </View>
                    </View>
                    <View style={styles.assistanceActions}>
                        <CallbackButton
                            subscriberId={beneficiary?.subscriberId}
                            beneficiaryId={beneficiary?.id}
                            notes="Subscriber requested callback from beneficiary profile"
                            style={styles.callbackBtn}
                            textStyle={styles.callbackText}
                        />
                        <TouchableOpacity style={styles.whatsappBtn}>
                            <MaterialCommunityIcons name="whatsapp" size={scale(28)} color="#F97316" />
                        </TouchableOpacity>
                    </View>
                </View>

            </ScrollView>

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
    safeArea: { flex: 1, backgroundColor: '#FFF2E8' },
    inlineHeader: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: scale(12), paddingVertical: scale(10), backgroundColor: '#FFF2E8',
    },
    headerTitle: { flex: 1, fontSize: scale(17), fontWeight: '600', color: '#111827', marginLeft: scale(6) },
    iconBtn: { width: scale(36), height: scale(36), justifyContent: 'center', alignItems: 'center' },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF2E8' },
    notFoundText: { fontSize: scale(16), color: '#6B7280', marginBottom: scale(16) },
    backBtn: { backgroundColor: '#F97316', paddingHorizontal: scale(20), paddingVertical: scale(10), borderRadius: scale(8) },
    backBtnText: { color: '#FFF', fontWeight: '600' },

    scrollContent: { paddingBottom: scale(34) },

    /* Hero */
    heroSection: {
        position: 'relative',
        paddingBottom: 0,
    },
    heroGradient: {
        width: '100%',
        height: scale(151),
        overflow: 'hidden',
        borderBottomLeftRadius: scale(23),
        borderBottomRightRadius: scale(23),
    },
    heroImage: {
        width: '100%',
        height: '100%',
        borderBottomLeftRadius: scale(23),
        borderBottomRightRadius: scale(23),
    },
    heroOverlay: {
        flex: 1,
    },
    avatarFloating: {
        position: 'absolute',
        top: scale(58),
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 20,
        elevation: 20,
    },
    profileCard: {
        backgroundColor: '#FFFFFF',
        marginHorizontal: scale(14),
        marginTop: scale(-48),
        borderRadius: scale(15),
        paddingTop: scale(83),
        paddingHorizontal: scale(30),
        paddingBottom: scale(28),
        alignItems: 'center',
        zIndex: 1,
        ...Platform.select({
            ios: { shadowColor: '#4A2B17', shadowOffset: { width: 0, height: scale(4) }, shadowOpacity: 0.14, shadowRadius: 8 },
            android: { elevation: 3 },
        }),
    },
    heroPhoto: { width: scale(80), height: scale(80), borderRadius: scale(40), marginBottom: scale(12), borderWidth: 3, borderColor: '#FFF' },
    heroName: { fontSize: scale(25), fontWeight: '800', color: '#111111', marginBottom: scale(3) },
    heroMeta: { fontSize: scale(17), color: '#333333' },

    /* Stats Row */
    statsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        width: '100%',
        marginTop: scale(34),
        rowGap: scale(25),
    },
    statItem: { width: '50%', alignItems: 'flex-start', paddingLeft: scale(20) },
    statDivider: { width: 0, height: 0 },
    statIconBox: {
        width: scale(40),
        height: scale(40),
        borderRadius: scale(12),
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: scale(4),
    },
    happinessIconBox: { backgroundColor: '#FFEBCB' },
    hoursIconBox: { backgroundColor: '#DDEBFF' },
    statEmoji: { fontSize: scale(22) },
    statValue: { fontSize: scale(21), fontWeight: '800', color: '#111111', marginBottom: 0 },
    statLabel: { fontSize: scale(15), color: '#333333' },
    conditionsSection: {
        width: '100%',
        marginTop: scale(26),
        paddingLeft: scale(20),
    },
    conditionsTitle: { fontSize: scale(15), color: '#4B5563', marginBottom: scale(9) },
    conditionsTags: { flexDirection: 'row', flexWrap: 'wrap', gap: scale(9) },
    conditionTag: {
        backgroundColor: '#FFE2E2',
        borderRadius: scale(14),
        paddingHorizontal: scale(13),
        paddingVertical: scale(6),
    },
    conditionTagText: { fontSize: scale(14), color: '#DC2626', fontWeight: '500' },

    /* Tab Section */
    tabSectionWrapper: {
        backgroundColor: '#FFFFFF',
        marginHorizontal: scale(14),
        borderRadius: scale(15),
        marginTop: scale(20),
        paddingBottom: scale(20),
        ...Platform.select({
            ios: { shadowColor: '#4A2B17', shadowOffset: { width: 0, height: scale(3) }, shadowOpacity: 0.08, shadowRadius: 6 },
            android: { elevation: 2 },
        }),
    },
    tabBar: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    tabContentContainer: {
        paddingTop: scale(20),
    },
    tabItem: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: scale(15) },
    tabItemActive: { borderBottomWidth: 2, borderBottomColor: '#FF5B0A' },
    tabText: { fontSize: scale(17), fontWeight: '500', color: '#333333' },
    tabTextActive: { color: '#FF5B0A' },

    /* Assistance Card */
    assistanceCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: scale(15),
        paddingHorizontal: scale(25),
        paddingTop: scale(26),
        paddingBottom: scale(29),
        marginHorizontal: scale(14),
        marginTop: scale(20),
        marginBottom: scale(20),
        ...Platform.select({
            ios: { shadowColor: '#4A2B17', shadowOffset: { width: 0, height: scale(4) }, shadowOpacity: 0.12, shadowRadius: 8 },
            android: { elevation: 2 },
        }),
    },
    assistanceHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: scale(24) },
    assistanceIllustration: { width: scale(94), height: scale(94), justifyContent: 'center', alignItems: 'center' },
    assistanceTitle: { fontSize: scale(25), fontWeight: '800', color: '#111111', marginBottom: scale(12) },
    assistanceSub: { fontSize: scale(20), color: '#111111', lineHeight: scale(29) },
    assistanceActions: { flexDirection: 'row', alignItems: 'center' },
    callbackBtn: {
        flex: 1, flexDirection: 'row', borderWidth: 1, borderColor: '#FF5B0A', borderRadius: scale(8),
        height: scale(48), alignItems: 'center', justifyContent: 'center', marginRight: scale(31)
    },
    callbackText: { color: '#FF5B0A', fontWeight: '700', fontSize: scale(16) },
    whatsappBtn: {
        width: scale(52), height: scale(52), borderRadius: scale(12), backgroundColor: '#FFF5ED',
        justifyContent: 'center', alignItems: 'center',
    },

    /* Empty tab */
    emptyTab: { alignItems: 'center', paddingVertical: scale(40) },
    emptyTabText: { fontSize: scale(14), color: '#9CA3AF', marginTop: scale(10) },
});
