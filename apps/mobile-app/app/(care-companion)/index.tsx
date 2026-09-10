import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, ActivityIndicator, useWindowDimensions, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_URL } from '@/constants/api';

import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { CompanionBottomNav } from '../../components/care-companion/CompanionBottomNav';
import { UpcomingCelebrationsCard } from '../../components/care-companion/UpcomingCelebrationsCard';
import NotificationBell from '@/components/shared/NotificationBell';
import { useExitOnBack } from '@/hooks/useExitOnBack';
import { useNavigationStack } from '@/contexts/NavigationStackContext';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';
import { NavigationService } from '@/utils/NavigationService';

const DEEP_ORANGE = '#FE6700';
const LIGHT_ORANGE = '#F97316';
const LIGHT_BEIGE = '#FAF3EB';

export default function DashboardScreen() {
    useExitOnBack();
    const router = useRouter();
    const { push, replace, pop } = useNavigationStack();
    useAndroidBackHandler();
    const { width } = useWindowDimensions();

    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState('');
    const [currentDate, setCurrentDate] = useState('');

    // 🚀 BACKEND-READY STATE: This exactly mimics what your API will return
    const [dashboardData, setDashboardData] = useState<any>(null);
    const [currentVisitIndex, setCurrentVisitIndex] = useState(0);

    let [fontsLoaded] = useFonts({
        Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold,
    });

    const MAX_CONTENT_WIDTH = 440;
    const BASE_HORIZONTAL_PADDING = 20;
    const contentWidth = Math.min(Math.max(width - BASE_HORIZONTAL_PADDING * 2, 0), MAX_CONTENT_WIDTH);
    const responsiveContentStyle = {
        width: contentWidth,
        alignSelf: 'center' as const,
    };

    // Clock logic
    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            setCurrentTime(now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' }));
            setCurrentDate(now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }));
        };
        updateTime();
        const interval = setInterval(updateTime, 1000);
        return () => clearInterval(interval);
    }, []);

    // 🚀 THE DATA FETCH: This is where you will connect your backend API
    useFocusEffect(
        useCallback(() => {
            let isActive = true;
            const fetchDashboardData = async () => {
                setLoading(true);
                try {
                    const token = await AsyncStorage.getItem('userToken');
                    if (!token) {
                        // Auth missing — root layout handles redirect automatically.
                        return;
                    }

                    const response = await fetch(`${API_URL}/care-companion/dashboard`, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });

                    if (!response.ok) throw new Error("Dashboard API returned error");

                    const json = await response.json();
                    if (isActive) {
                        setDashboardData(json.data || json);
                        setCurrentVisitIndex(0);
                    }
                } catch (error) {
                    console.log("Failed to load dashboard data from backend. Loading Fallback Mocks...", error);
                    // TEMPORARY FALLBACK MOCK DATA FOR SEAMLESS USER EXPERIENCE
                    if (isActive) {
                        setDashboardData({
                            user: { firstName: "", role: "Care Mitra" },
                            stats: { todaysVisits: 0, pendingTasks: 0, milesDriven: 0 },
                            nextVisit: null,
                            upcomingVisits: [],
                            celebrations: []
                        });
                        setCurrentVisitIndex(0);
                    }
                } finally {
                    if (isActive) setLoading(false);
                }
            };

            if (fontsLoaded) fetchDashboardData();
            return () => { isActive = false; };
        }, [fontsLoaded])
    );

    const upcomingList: any[] = (dashboardData?.upcomingVisits && dashboardData.upcomingVisits.length > 0)
        ? dashboardData.upcomingVisits
        : (dashboardData?.nextVisit ? [dashboardData.nextVisit] : []);

    const currentVisit = upcomingList[currentVisitIndex] || dashboardData?.nextVisit;
    const isVisitInProgress = currentVisit?.status === 'in_progress';

    // 👆 Horizontal Swipe Gesture Handler for Visit Card
    const panResponder = useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => false,
                onMoveShouldSetPanResponder: (_, gestureState) => {
                    // Only capture horizontal swipes that exceed threshold and are predominantly horizontal
                    return Math.abs(gestureState.dx) > 18 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.3;
                },
                onPanResponderRelease: (_, gestureState) => {
                    if (gestureState.dx < -35) {
                        // Swiped Left -> Go to next visit
                        setCurrentVisitIndex(prev => Math.min(upcomingList.length - 1, prev + 1));
                    } else if (gestureState.dx > 35) {
                        // Swiped Right -> Go to previous visit
                        setCurrentVisitIndex(prev => Math.max(0, prev - 1));
                    }
                },
            }),
        [upcomingList.length]
    );

    const handleStartVisit = () => {
        if (!currentVisit) return;
        push({
            pathname: '/(care-companion)/visit-details' as any,
            params: {
                visitId: currentVisit.id,
                patientName: currentVisit.patientName,
                type: currentVisit.type
            }
        });
    };

    if (!fontsLoaded || loading || !dashboardData) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={DEEP_ORANGE} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <Stack.Screen options={{ headerShown: false }} />

            <ScrollView bounces={false} contentContainerStyle={styles.scrollContent}>

                {/* 1. DYNAMIC HEADER */}
                <View style={styles.deepOrangeHeader}>
                    <View style={[styles.headerTopRow, responsiveContentStyle]}>
                        <View>
                            <Text style={styles.headerTitle}>Care Mitra</Text>
                            <Text style={styles.headerSub}>Welcome back, {dashboardData.user.firstName}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <NotificationBell 
                                style={[styles.profileBtn, { marginRight: 12 }]} 
                                iconColor={DEEP_ORANGE} 
                            />
                            <TouchableOpacity style={styles.profileBtn} onPress={() => push('/(care-companion)/profile' as any)}>
                                <Ionicons name="person-outline" size={24} color={DEEP_ORANGE} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={[styles.dateTimeRow, responsiveContentStyle]}>
                        <Ionicons name="time-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={styles.dateTimeText}>{currentTime}</Text>
                        <Text style={styles.dotSeparator}>•</Text>
                        <Text style={styles.dateTimeText}>{currentDate}</Text>
                    </View>

                    {/* CHECK-IN CARD (inside header) */}
                    <View style={[styles.checkInCard, responsiveContentStyle]}>
                        <View style={styles.checkInLeft}>
                            <Ionicons name="location-outline" size={24} color="#FFFFFF" />
                            <View style={{ marginLeft: 12 }}>
                                <Text style={styles.checkInTitle}>
                                    {isVisitInProgress ? "Visit In Progress" : "Not Checked In"}
                                </Text>
                                <Text style={styles.checkInSub}>
                                    {isVisitInProgress ? `Active: ${dashboardData.nextVisit.patientName}` : "Ready to start"}
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            style={styles.checkInBtn}
                            onPress={handleStartVisit}
                        >
                            <Ionicons name={isVisitInProgress ? "arrow-forward-outline" : "log-in-outline"} size={20} color="#111827" />
                            <Text style={styles.checkInBtnText}>
                                {isVisitInProgress ? "Resume" : "Check In"}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Main Content Area */}
                <View style={[styles.contentArea, responsiveContentStyle]}>

                    {/* 2. DYNAMIC STATS ROW */}
                    <View style={styles.statsRow}>
                        <View style={styles.statBox}>
                            <View>
                                <Text style={styles.statLabel}>Today's Visits</Text>
                                <Text style={styles.statNumber}>{dashboardData.stats.todaysVisits}</Text>
                            </View>
                            <View style={[styles.statIconCircle, { backgroundColor: '#FFF7ED' }]}>
                                <Ionicons name="calendar-outline" size={24} color="#EA580C" />
                            </View>
                        </View>

                        <View style={styles.statBox}>
                            <View>
                                <Text style={styles.statLabel}>Hours Today</Text>
                                <Text style={styles.statNumber}>{dashboardData.stats.hoursToday}</Text>
                            </View>
                            <View style={[styles.statIconCircle, { backgroundColor: '#FDF2F8' }]}>
                                <Ionicons name="time-outline" size={24} color="#DB2777" />
                            </View>
                        </View>
                    </View>

                    {/* 3. DYNAMIC UPCOMING / NEXT VISIT CARD WITH CAROUSEL SWITCHER & SWIPE GESTURE */}
                    {currentVisit ? (
                        <View
                            style={styles.card}
                            {...(upcomingList.length > 1 ? panResponder.panHandlers : {})}
                        >
                            {/* Header Row: Title + Left/Right Switcher + Type Badge */}
                            <View style={styles.nextVisitHeader}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Ionicons name="notifications-outline" size={20} color={DEEP_ORANGE} />
                                    <Text style={styles.nextVisitTitle}>
                                        {upcomingList.length > 1 ? 'Upcoming Visit' : 'Next Visit'}
                                    </Text>
                                </View>

                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    {/* Left & Right Switcher Buttons */}
                                    {upcomingList.length > 1 && (
                                        <View style={styles.switcherContainer}>
                                            <TouchableOpacity
                                                style={[styles.arrowBtn, currentVisitIndex === 0 && styles.arrowBtnDisabled]}
                                                onPress={() => setCurrentVisitIndex(prev => Math.max(0, prev - 1))}
                                                disabled={currentVisitIndex === 0}
                                                activeOpacity={0.7}
                                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                            >
                                                <Ionicons
                                                    name="chevron-back"
                                                    size={16}
                                                    color={currentVisitIndex === 0 ? '#D1D5DB' : DEEP_ORANGE}
                                                />
                                            </TouchableOpacity>

                                            <View style={styles.counterBadge}>
                                                <Text style={styles.counterText}>
                                                    {currentVisitIndex + 1}/{upcomingList.length}
                                                </Text>
                                            </View>

                                            <TouchableOpacity
                                                style={[styles.arrowBtn, currentVisitIndex === upcomingList.length - 1 && styles.arrowBtnDisabled]}
                                                onPress={() => setCurrentVisitIndex(prev => Math.min(upcomingList.length - 1, prev + 1))}
                                                disabled={currentVisitIndex === upcomingList.length - 1}
                                                activeOpacity={0.7}
                                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                            >
                                                <Ionicons
                                                    name="chevron-forward"
                                                    size={16}
                                                    color={currentVisitIndex === upcomingList.length - 1 ? '#D1D5DB' : DEEP_ORANGE}
                                                />
                                            </TouchableOpacity>
                                        </View>
                                    )}

                                    <View style={styles.visitBadge}>
                                        <Text style={styles.visitBadgeText}>{currentVisit.type}</Text>
                                    </View>
                                </View>
                            </View>

                            {/* Patient Name */}
                            <Text style={styles.patientName}>{currentVisit.patientName}</Text>

                            {/* Full Address — tappable to navigate */}
                            <TouchableOpacity
                                style={styles.addressRow}
                                activeOpacity={0.7}
                                onPress={() => NavigationService.instance.navigate({
                                    address: currentVisit.address,
                                    latitude: currentVisit.latitude,
                                    longitude: currentVisit.longitude,
                                    label: currentVisit.patientName,
                                })}
                            >
                                <Ionicons name="location-outline" size={16} color={DEEP_ORANGE} style={{ marginTop: 2 }} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.addressText}>{currentVisit.address}</Text>
                                    {currentVisit.pincode ? (
                                        <Text style={styles.addressSubText}>
                                            {[currentVisit.city, currentVisit.pincode].filter(Boolean).join(' - ')}
                                        </Text>
                                    ) : null}
                                </View>
                                <Ionicons name="chevron-forward" size={14} color="#9CA3AF" />
                            </TouchableOpacity>

                            {/* Time & Duration Row */}
                            <View style={styles.metaRow}>
                                <View style={styles.metaItem}>
                                    <Ionicons name="time-outline" size={16} color="#4B5563" />
                                    <Text style={styles.metaText}>{currentVisit.time}</Text>
                                </View>
                                {currentVisit.durationMinutes ? (
                                    <View style={styles.metaItem}>
                                        <Ionicons name="hourglass-outline" size={16} color="#4B5563" />
                                        <Text style={styles.metaText}>
                                            {currentVisit.durationMinutes >= 60
                                                ? `${Math.floor(currentVisit.durationMinutes / 60)}h${currentVisit.durationMinutes % 60 > 0 ? ` ${currentVisit.durationMinutes % 60}m` : ''}`
                                                : `${currentVisit.durationMinutes} min`}
                                        </Text>
                                    </View>
                                ) : null}
                            </View>

                            {/* Action Buttons Row */}
                            <View style={styles.actionBtnsRow}>
                                {/* Navigate Button */}
                                <TouchableOpacity
                                    style={styles.navigateBtn}
                                    activeOpacity={0.85}
                                    onPress={() => NavigationService.instance.navigate({
                                        address: currentVisit.address,
                                        latitude: currentVisit.latitude,
                                        longitude: currentVisit.longitude,
                                        label: currentVisit.patientName,
                                    })}
                                >
                                    <Ionicons name="navigate-circle-outline" size={20} color={DEEP_ORANGE} />
                                    <Text style={styles.navigateBtnText}>Navigate</Text>
                                </TouchableOpacity>

                                {/* Start Visit Button */}
                                <TouchableOpacity
                                    style={[styles.primaryActionBtn, { flex: 1 }]}
                                    onPress={handleStartVisit}
                                >
                                    <Text style={styles.primaryActionBtnText}>
                                        {isVisitInProgress ? 'Continue Visit' : 'Start Visit'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.card}>
                            <View style={styles.emptyVisitHeader}>
                                <Text style={styles.nextVisitTitle}>Upcoming Visit</Text>
                            </View>
                            <Text style={[styles.addressText, { color: '#6B7280' }]}>
                                You have no upcoming scheduled visits at this time. Enjoy your rest!
                            </Text>
                        </View>
                    )}

                    {/* 4. QUICK ACTIONS GRID */}
                    <View style={styles.card}>
                        <Text style={styles.quickActionsTitle}>Quick Actions</Text>

                        <View style={styles.quickActionsGrid}>
                            <TouchableOpacity style={styles.actionBox} onPress={() => push('/(care-companion)/schedule' as any)}>
                                <Ionicons name="calendar-outline" size={24} color="#2563EB" style={{ marginBottom: 8 }} />
                                <Text style={styles.actionText}>Schedule</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionBox} onPress={() => push('/(care-companion)/history' as any)}>
                                <Ionicons name="pulse-outline" size={24} color="#16A34A" style={{ marginBottom: 8 }} />
                                <Text style={styles.actionText}>History</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* 5. UPCOMING CELEBRATIONS CARD */}
                    <UpcomingCelebrationsCard celebrations={dashboardData?.celebrations} />

                    <View style={{ height: 100 }} />
                </View>
            </ScrollView>

            <CompanionBottomNav />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: LIGHT_BEIGE },
    scrollContent: { flexGrow: 1 },

    // --- Header ---
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
    headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    headerTitle: { fontFamily: 'Poppins_700Bold', color: '#FFFFFF', fontSize: 24, lineHeight: 32 },
    headerSub: { fontFamily: 'Poppins_400Regular', color: '#FFFFFF', fontSize: 14, opacity: 0.9 },
    profileBtn: { width: 44, height: 44, backgroundColor: '#FFFFFF', borderRadius: 22, alignItems: 'center', justifyContent: 'center' },

    dateTimeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
    dateTimeText: { fontFamily: 'Poppins_400Regular', color: '#FFFFFF', fontSize: 13, opacity: 0.9 },
    dotSeparator: { color: '#FFFFFF', marginHorizontal: 8, opacity: 0.9 },

    // --- Check-In Card ---
    checkInCard: {
        backgroundColor: LIGHT_ORANGE,
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    checkInLeft: { flexDirection: 'row', alignItems: 'center' },
    checkInTitle: { fontFamily: 'Poppins_600SemiBold', color: '#FFFFFF', fontSize: 15 },
    checkInSub: { fontFamily: 'Poppins_400Regular', color: '#FFFFFF', fontSize: 12, opacity: 0.9 },
    checkInBtn: { flexDirection: 'row', backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
    checkInBtnText: { fontFamily: 'Poppins_600SemiBold', color: '#111827', fontSize: 13, marginLeft: 6 },

    // --- Content Area ---
    contentArea: {
        paddingHorizontal: 0,
        marginTop: 20,
        zIndex: 10,
        position: 'relative',
    },

    // --- Stats Row ---
    statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    statBox: {
        backgroundColor: '#FFFFFF', width: '48%', borderRadius: 16, padding: 16,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
    },
    statLabel: { fontFamily: 'Poppins_400Regular', color: '#4B5563', fontSize: 13, marginBottom: 4 },
    statNumber: { fontFamily: 'Poppins_700Bold', color: '#374151', fontSize: 24, lineHeight: 30 },
    statIconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },

    // --- Shared Card Styles ---
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1, borderColor: '#FDF2F8',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
    },

    // --- Next Visit Card ---
    nextVisitHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    emptyVisitHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
    nextVisitTitle: { fontFamily: 'Poppins_500Medium', fontSize: 15, color: '#111827' },

    switcherContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF7ED',
        borderRadius: 14,
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderWidth: 1,
        borderColor: '#FFEDD5',
        gap: 2,
    },
    arrowBtn: {
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
    },
    arrowBtnDisabled: {
        backgroundColor: 'transparent',
        opacity: 0.5,
    },
    counterBadge: {
        paddingHorizontal: 4,
    },
    counterText: {
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 11,
        color: DEEP_ORANGE,
    },

    patientRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    patientName: { fontFamily: 'Poppins_600SemiBold', fontSize: 18, color: '#111827', marginBottom: 10 },
    visitBadge: { backgroundColor: DEEP_ORANGE, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6 },
    visitBadgeText: { color: '#FFFFFF', fontSize: 11, fontFamily: 'Poppins_500Medium' },


    addressRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 6,
        backgroundColor: '#FFF7ED',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#FFEDD5',
    },
    addressText: { fontFamily: 'Poppins_400Regular', color: '#374151', fontSize: 13, lineHeight: 18 },
    addressSubText: { fontFamily: 'Poppins_400Regular', color: '#9CA3AF', fontSize: 11, marginTop: 2 },

    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontFamily: 'Poppins_400Regular', color: '#111827', fontSize: 13 },

    actionBtnsRow: { flexDirection: 'row', gap: 10 },
    navigateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#FFF7ED',
        borderWidth: 1.5,
        borderColor: DEEP_ORANGE,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    navigateBtnText: { fontFamily: 'Poppins_600SemiBold', color: DEEP_ORANGE, fontSize: 14 },

    primaryActionBtn: {
        backgroundColor: DEEP_ORANGE, borderRadius: 12, paddingVertical: 14, alignItems: 'center',
        shadowColor: DEEP_ORANGE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
    },
    primaryActionBtnText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Poppins_600SemiBold' },

    // --- Quick Actions Grid ---
    quickActionsTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: '#111827', marginBottom: 16 },
    quickActionsGrid: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    actionBox: {
        width: '48%', borderWidth: 1, borderColor: '#F3F4F6', borderRadius: 12,
        paddingVertical: 14, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.02, shadowRadius: 3, elevation: 1,
    },
    actionText: { fontFamily: 'Poppins_500Medium', color: '#374151', fontSize: 11.5, marginTop: 4, textAlign: 'center' },
});