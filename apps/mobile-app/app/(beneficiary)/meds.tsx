import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Platform, Animated, TouchableWithoutFeedback, Alert, Image, useWindowDimensions, RefreshControl } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { API_URL } from '@/constants/api';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { useGlobalRefresh, emitGlobalRefresh } from '@/utils/events';

const bellIcon = require('../../assets/icons/bell.png');
const calendarIcon = require('../../assets/icons/calendar.png');

// --- PIXEL PERFECT CUSTOM SVG ICONS ---
const CustomPillIcon = ({ size = 24, color = '#FE6700' }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M4.5 12.5l8-8a4.95 4.95 0 017 7l-8 8a4.95 4.95 0 01-7-7z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M8.5 8.5l7 7" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
);

const CustomCheckIcon = ({ size = 18, color = '#16A34A' }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M20 6L9 17l-5-5" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);

const CustomCrossIcon = ({ size = 18, color = '#E7000B' }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M18 6L6 18M6 6l12 12" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);

const CustomShieldIcon = ({ size = 42, color = '#9CA3AF' }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);

const CustomLockIcon = ({ size = 16, color = '#9CA3AF' }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M7 11V7a5 5 0 0110 0v4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);

// --- INLINE MICRO CUSTOM SWITCH (32x18.4px) ---
const CustomSwitch = ({ value, onValueChange }: { value: boolean, onValueChange: (v: boolean) => void }) => {
    const animatedValue = useRef(new Animated.Value(value ? 1 : 0)).current;

    useEffect(() => {
        Animated.timing(animatedValue, {
            toValue: value ? 1 : 0,
            duration: 250,
            useNativeDriver: false,
        }).start();
    }, [value]);

    const translateX = animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [2, 16],
    });

    const backgroundColor = animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['#E5E7EB', '#FE6700'],
    });

    return (
        <TouchableWithoutFeedback onPress={() => onValueChange(!value)}>
            <Animated.View style={[styles.switchTrack, { backgroundColor }]}>
                <Animated.View style={[styles.switchThumb, { transform: [{ translateX }] }]} />
            </Animated.View>
        </TouchableWithoutFeedback>
    );
};

type MedScheduleItem = {
    id: string;
    logId: string | null;
    name: string;
    dosage: string;
    frequency: string;
    instructions: string;
    scheduleTimeText: string;
    scheduledTimeIso: string;
    status: 'taken' | 'missed' | 'pending';
    adherencePercentage: number;
    isFutureSchedule?: boolean;
    futureDateText?: string;
    isToday?: boolean;
    canMark?: boolean;
};

type Metrics = {
    average: number;
    taken: number;
    missed: number;
};

type Props = {
    beneficiaryId?: string;
};

export default function MedsTracker({ beneficiaryId: propBeneficiaryId }: Props) {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const MAX_CONTENT_WIDTH = 440;
    const responsiveStyle = { width: '100%' as const, maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' as const };

    const [schedule, setSchedule] = useState<MedScheduleItem[]>([]);
    const [metrics, setMetrics] = useState<Metrics>({ average: 100, taken: 0, missed: 0 });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [remindersActive, setRemindersActive] = useState(true);
    const [submittingId, setSubmittingId] = useState<string | null>(null);

    useFocusEffect(useCallback(() => { loadData(); }, [propBeneficiaryId]));
    useGlobalRefresh(() => { loadData(); });

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    }, [propBeneficiaryId]);

    const loadData = async () => {
        try {
            setLoading(true);
            let targetBeneficiaryId = propBeneficiaryId;

            if (!targetBeneficiaryId) {
                const userStr = await AsyncStorage.getItem('userData');
                if (userStr) {
                    const user = JSON.parse(userStr);
                    targetBeneficiaryId = user.id;
                }
            }

            if (!targetBeneficiaryId) {
                loadMocks();
                setLoading(false);
                return;
            }

            const token = await AsyncStorage.getItem('userToken');
            if (!token) {
                loadMocks();
                setLoading(false);
                return;
            }

            const [scheduleRes, metricsRes] = await Promise.all([
                fetch(`${API_URL}/shared/medications/beneficiary/${targetBeneficiaryId}/today`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                fetch(`${API_URL}/shared/medications/beneficiary/${targetBeneficiaryId}/metrics`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);

            const scheduleData = await scheduleRes.json();
            const metricsData = await metricsRes.json();

            if (scheduleData.success) {
                const items: MedScheduleItem[] = scheduleData.data || [];
                setSchedule(items);
                scheduleLocalReminders(items);
            }
            if (metricsData.success) {
                setMetrics(metricsData.data || { average: 100, taken: 0, missed: 0 });
            }

        } catch (err) {
            console.error('Failed to load medication data', err);
            loadMocks();
        } finally {
            setLoading(false);
        }
    };

    const scheduleLocalReminders = async (items: MedScheduleItem[]) => {
        if (Platform.OS === 'web') return;
        try {
            // Clear existing scheduled local notifications to avoid duplicates on refetch
            await Notifications.cancelAllScheduledNotificationsAsync();

            const now = new Date();
            for (const item of items) {
                const schedTime = new Date(item.scheduledTimeIso);
                const diffMs = schedTime.getTime() - now.getTime();
                if (diffMs > 0) {
                    const seconds = Math.max(1, Math.floor(diffMs / 1000));
                    await Notifications.scheduleNotificationAsync({
                        content: {
                            title: `💊 Medication Reminder: ${item.name}`,
                            body: `Time to take your ${item.dosage || ''} dose (${item.scheduleTimeText}). ${item.instructions}`,
                            data: { medicationId: item.id, scheduleTimeText: item.scheduleTimeText }
                        },
                        trigger: {
                            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                            seconds,
                            repeats: false,
                        } as any,
                    });
                }
            }
        } catch (err) {
            console.log('Failed to schedule local reminders', err);
        }
    };

    const loadMocks = () => {
        setMetrics({ average: 95, taken: 87, missed: 5 });
        setSchedule([
            {
                id: '1', logId: null,
                name: 'Lisinopril', dosage: '10mg', frequency: 'Once daily',
                instructions: 'Blood Pressure', scheduleTimeText: '08:00 AM',
                scheduledTimeIso: new Date().toISOString(),
                status: 'pending', adherencePercentage: 95, isToday: true, canMark: true
            },
            {
                id: '2', logId: null,
                name: 'Metformin', dosage: '500mg', frequency: 'Twice daily',
                instructions: 'Diabetes', scheduleTimeText: '08:00 AM, 08:00 PM',
                scheduledTimeIso: new Date().toISOString(),
                status: 'pending', adherencePercentage: 92, isToday: true, canMark: true
            },
            {
                id: '3', logId: null,
                name: 'Atorvastatin', dosage: '20mg', frequency: 'Once daily',
                instructions: 'Cholesterol', scheduleTimeText: '08:00 PM',
                scheduledTimeIso: new Date().toISOString(),
                status: 'pending', adherencePercentage: 98, isToday: true, canMark: true
            }
        ]);
    };

    const handleLogAdherence = async (item: MedScheduleItem, taken: boolean) => {
        // Enforce strict Today-Only marking rule
        const schedTime = new Date(item.scheduledTimeIso);
        const now = new Date();
        const isToday = schedTime.getDate() === now.getDate() &&
                        schedTime.getMonth() === now.getMonth() &&
                        schedTime.getFullYear() === now.getFullYear();

        if (!isToday || item.isFutureSchedule || item.canMark === false) {
            const lockMsg = 'Medication doses can only be marked on their scheduled day (Today). Past or future doses cannot be modified.';
            if (Platform.OS === 'web') {
                window.alert(`Dose Locked\n\n${lockMsg}`);
            } else {
                Alert.alert('Dose Locked', lockMsg);
            }
            return;
        }

        try {
            setSubmittingId(`${item.id}-${item.scheduleTimeText}`);
            let targetBeneficiaryId = propBeneficiaryId;

            if (!targetBeneficiaryId) {
                const userStr = await AsyncStorage.getItem('userData');
                if (userStr) {
                    targetBeneficiaryId = JSON.parse(userStr).id;
                }
            }

            if (!targetBeneficiaryId) {
                updateLocalStatus(item, taken);
                setSubmittingId(null);
                return;
            }

            const token = await AsyncStorage.getItem('userToken');
            if (!token) {
                updateLocalStatus(item, taken);
                setSubmittingId(null);
                return;
            }

            const res = await fetch(`${API_URL}/shared/medications/adherence/log`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    beneficiaryId: targetBeneficiaryId,
                    medicationId: item.id,
                    scheduledTimeIso: item.scheduledTimeIso,
                    taken,
                    recordedBy: 'beneficiary'
                })
            });

            const responseData = await res.json();
            if (responseData.success) {
                await loadData();
                emitGlobalRefresh();
            } else {
                Alert.alert('Error', responseData.message || 'Failed to update schedule');
            }

        } catch (err) {
            console.error('Failed to log adherence', err);
            updateLocalStatus(item, taken);
        } finally {
            setSubmittingId(null);
        }
    };

    const updateLocalStatus = (item: MedScheduleItem, taken: boolean) => {
        setSchedule(prev => prev.map(s => {
            if (s.id === item.id && s.scheduleTimeText === item.scheduleTimeText) {
                return { ...s, status: taken ? 'taken' : 'missed' };
            }
            return s;
        }));
        setMetrics(m => ({
            average: m.average,
            taken: taken ? m.taken + 1 : m.taken,
            missed: !taken ? m.missed + 1 : m.missed
        }));
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={[styles.center, responsiveStyle]}>
                    <ActivityIndicator size="large" color="#FE6700" />
                    <Text style={styles.loadingText}>Loading Medications...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={styles.headerContent}>
                    <Text style={styles.headerTitle}>Medications</Text>
                    <Text style={styles.headerSub}>Today's medication schedule</Text>
                </View>
            </View>

            <ScrollView 
                style={styles.container} 
                contentContainerStyle={[styles.content, responsiveStyle]} 
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FE6700" />
                }
            >
                <View style={styles.topRow}>
                    <Text style={styles.topTitle}>Medications</Text>
                    <View style={styles.toggleContainer}>
                        <Text style={styles.toggleLabel}>Reminders</Text>
                        <CustomSwitch value={remindersActive} onValueChange={setRemindersActive} />
                    </View>
                </View>

                {/* Overall Adherence Card */}
                <View style={styles.statsCard}>
                    <View style={styles.statsHeader}>
                        <Image source={calendarIcon} style={styles.statsIconImage} resizeMode="contain" />
                        <View style={styles.statsTitleBlock}>
                            <Text style={styles.statsTitle}>Overall Adherence</Text>
                            <Text style={styles.statsSubtitle}>Last 30 days</Text>
                        </View>
                    </View>

                    <View style={styles.metricsRow}>
                        <View style={styles.metricItem}>
                            <Text style={styles.metricValue}>{metrics.average}%</Text>
                            <Text style={styles.metricLabel}>Average</Text>
                        </View>
                        <View style={styles.metricItem}>
                            <Text style={styles.metricValue}>{metrics.taken}</Text>
                            <Text style={styles.metricLabel}>Taken</Text>
                        </View>
                        <View style={styles.metricItem}>
                            <Text style={styles.metricValue}>{metrics.missed}</Text>
                            <Text style={styles.metricLabel}>Missed</Text>
                        </View>
                    </View>
                </View>

                <Text style={styles.sectionTitle}>Your Medications</Text>

                {schedule.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <CustomShieldIcon size={42} color="#9CA3AF" />
                        <Text style={styles.emptyText}>No medications scheduled for today.</Text>
                    </View>
                ) : (
                    schedule.map((item, index) => {
                        const isSubmitting = submittingId === `${item.id}-${item.scheduleTimeText}`;
                        
                        const schedTime = new Date(item.scheduledTimeIso);
                        const now = new Date();
                        const isItemToday = item.isToday ?? (
                            schedTime.getDate() === now.getDate() &&
                            schedTime.getMonth() === now.getMonth() &&
                            schedTime.getFullYear() === now.getFullYear()
                        );
                        const canMarkItem = item.canMark ?? (isItemToday && !item.isFutureSchedule);
                        // Once marked, lock both buttons — no further changes allowed
                        const isMarked = item.status === 'taken' || item.status === 'missed';

                        return (
                            <View key={`${item.id}-${index}`} style={styles.medCard}>
                                <View style={styles.medMainRow}>
                                    <View style={styles.iconCircle}>
                                        <CustomPillIcon size={24} color="#FE6700" />
                                    </View>

                                    <View style={styles.medDetails}>
                                        <Text style={styles.medName}>{item.name}</Text>
                                        <Text style={styles.medSub}>
                                            {item.dosage} - {item.frequency}
                                        </Text>
                                        <Text style={styles.medInstructions}>
                                            For: {item.instructions}
                                        </Text>
                                    </View>

                                    <View style={styles.actionColumn}>
                                        {isSubmitting ? (
                                            <ActivityIndicator size="small" color="#FE6700" />
                                        ) : !canMarkItem ? (
                                            <View style={styles.lockedBadgeContainer}>
                                                <CustomLockIcon size={14} color="#9CA3AF" />
                                                <Text style={styles.lockedBadgeText}>
                                                    {item.isFutureSchedule ? `Scheduled: ${item.futureDateText}` : 'Past Dose'}
                                                </Text>
                                            </View>
                                        ) : (
                                            <View style={styles.btnRow}>
                                                <TouchableOpacity
                                                    onPress={() => !isMarked && handleLogAdherence(item, true)}
                                                    disabled={isMarked}
                                                    activeOpacity={isMarked ? 1 : 0.7}
                                                    style={[
                                                        styles.actionBtn,
                                                        styles.checkBtn,
                                                        item.status === 'taken' && styles.activeCheck,
                                                        isMarked && item.status !== 'taken' && styles.disabledBtn,
                                                    ]}
                                                >
                                                    <CustomCheckIcon
                                                        size={18}
                                                        color={item.status === 'taken' ? '#FFFFFF' : (isMarked ? '#9CA3AF' : '#16A34A')}
                                                    />
                                                </TouchableOpacity>

                                                <TouchableOpacity
                                                    onPress={() => !isMarked && handleLogAdherence(item, false)}
                                                    disabled={isMarked}
                                                    activeOpacity={isMarked ? 1 : 0.7}
                                                    style={[
                                                        styles.actionBtn,
                                                        styles.crossBtn,
                                                        item.status === 'missed' && styles.activeCross,
                                                        isMarked && item.status !== 'missed' && styles.disabledBtn,
                                                    ]}
                                                >
                                                    <CustomCrossIcon
                                                        size={18}
                                                        color={item.status === 'missed' ? '#FFFFFF' : (isMarked ? '#9CA3AF' : '#EF4444')}
                                                    />
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>
                                </View>

                                <View style={styles.innerDivider} />

                                <View style={styles.medFooter}>
                                    <View style={styles.scheduleRow}>
                                        <Text style={styles.scheduleTime}>
                                            Schedule: {item.scheduleTimeText}
                                        </Text>
                                        <Text style={styles.percentText}>{item.adherencePercentage}%</Text>
                                    </View>

                                    <View style={styles.trackBackground}>
                                        <View
                                            style={[
                                                styles.trackFill,
                                                { width: `${item.adherencePercentage}%` }
                                            ]}
                                        />
                                    </View>
                                </View>
                            </View>
                        );
                    })
                )}

                {/* Bottom Reminder Active Card */}
                <View style={styles.bannerCard}>
                    <View style={styles.bannerIconContainer}>
                        <Image source={bellIcon} style={styles.bannerIconImage} resizeMode="contain" />
                    </View>
                    <View style={styles.bannerCopy}>
                        <Text style={styles.bannerTitle}>On-Time Medication Reminders Active</Text>
                        <Text style={styles.bannerText}>
                            Background worker dispatches reminders on exact scheduled time. Doses can only be marked on their scheduled day (Today).
                        </Text>
                    </View>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginHorizontal: 16,
        marginTop: 8,
        backgroundColor: '#FF6900',
        borderRadius: 20,
        gap: 12,
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerContent: {
        flex: 1,
    },
    headerTitle: {
        fontFamily: 'Poppins-Medium',
        fontSize: 17,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    headerSub: {
        fontFamily: 'Poppins-Regular',
        fontSize: 12,
        color: 'rgba(255,255,255,0.9)',
        marginTop: 1,
    },
    container: {
        flex: 1,
        backgroundColor: '#FCFAF7',
    },
    content: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 96,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFF0E6',
    },
    loadingText: {
        marginTop: 12,
        fontFamily: 'Poppins-Medium',
        fontSize: 14,
        color: '#374151',
    },

    switchTrack: {
        width: 32,
        height: 18.4,
        borderRadius: 10,
        justifyContent: 'center',
    },
    switchThumb: {
        width: 14.4,
        height: 14.4,
        borderRadius: 8,
        position: 'absolute',
        left: 0,
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 2,
        elevation: 2,
    },

    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        marginTop: 8,
    },
    topTitle: {
        fontFamily: 'Poppins-Medium',
        fontSize: 16,
        color: '#111827',
    },
    statsIconImage: {
        width: 32,
        height: 32,
    },
    bannerIconImage: {
        width: 26,
        height: 26,
    },
    toggleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    toggleLabel: {
        fontFamily: 'Poppins-Regular',
        fontSize: 14,
        color: '#374151',
        marginRight: 8,
    },

    statsCard: {
        backgroundColor: '#FE6700',
        borderRadius: 14,
        padding: 20,
        marginBottom: 24,
        shadowColor: '#FE6700',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 6,
    },
    statsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statsTitleBlock: {
        marginLeft: 12,
    },
    statsTitle: {
        fontFamily: 'Poppins-Medium',
        fontSize: 18,
        color: '#FFFFFF',
    },
    statsSubtitle: {
        fontFamily: 'Poppins-Regular',
        fontSize: 13,
        color: 'rgba(255,255,255,0.85)',
        marginTop: -2,
    },
    metricsRow: {
        marginTop: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    metricItem: {
        alignItems: 'center',
        flex: 1,
    },
    metricValue: {
        fontFamily: 'Poppins-Medium',
        fontSize: 28,
        color: '#FFFFFF',
    },
    metricLabel: {
        fontFamily: 'Poppins-Regular',
        fontSize: 12,
        color: 'rgba(255,255,255,0.9)',
        marginTop: 2,
    },

    sectionTitle: {
        fontFamily: 'Poppins-Medium',
        fontSize: 16,
        color: '#111827',
        marginBottom: 12,
        marginLeft: 4,
    },

    medCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 2,
    },
    medMainRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    iconCircle: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#FFF7ED',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    medDetails: {
        flex: 1,
        justifyContent: 'center',
    },
    medName: {
        fontFamily: 'Poppins-Medium',
        fontSize: 16,
        color: '#111827',
    },
    medSub: {
        fontFamily: 'Poppins-Regular',
        fontSize: 13,
        color: '#6B7280',
        marginTop: 2,
    },
    medInstructions: {
        fontFamily: 'Poppins-Regular',
        fontSize: 13,
        color: '#4B5563',
        marginTop: 1,
    },

    actionColumn: {
        marginLeft: 12,
        justifyContent: 'center',
    },
    btnRow: {
        flexDirection: 'row',
        gap: 8,
    },
    actionBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkBtn: {
        backgroundColor: '#DCFCE7',
    },
    crossBtn: {
        backgroundColor: '#FEE2E2',
    },
    activeCheck: {
        backgroundColor: '#16A34A',
    },
    activeCross: {
        backgroundColor: '#EF4444',
    },
    disabledBtn: {
        opacity: 0.3,
    },
    lockedBadgeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 8,
        gap: 4,
    },
    lockedBadgeText: {
        fontFamily: 'Poppins-Medium',
        fontSize: 11,
        color: '#6B7280',
    },

    innerDivider: {
        height: 0,
        marginVertical: 6,
    },
    medFooter: {
        marginTop: 4,
    },
    scheduleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    scheduleTime: {
        fontFamily: 'Poppins-Regular',
        fontSize: 12,
        color: '#374151',
    },
    percentText: {
        fontFamily: 'Poppins-Medium',
        fontSize: 12,
        color: '#111827',
    },
    trackBackground: {
        height: 6,
        borderRadius: 3,
        backgroundColor: '#E5E7EB',
        overflow: 'hidden',
    },
    trackFill: {
        height: 6,
        borderRadius: 3,
        backgroundColor: '#16A34A',
    },

    bannerCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 16,
        marginTop: 8,
        flexDirection: 'row',
        alignItems: 'flex-start',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    bannerIconContainer: {
        marginTop: 2,
        marginRight: 14,
    },
    bannerCopy: {
        flex: 1,
    },
    bannerTitle: {
        fontFamily: 'Poppins-Medium',
        fontSize: 14,
        color: '#111827',
        marginBottom: 4,
    },
    bannerText: {
        fontFamily: 'Poppins-Regular',
        fontSize: 13,
        color: '#6B7280',
        lineHeight: 18,
    },

    emptyContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 40,
        alignItems: 'center',
        marginBottom: 12,
    },
    emptyText: {
        marginTop: 12,
        fontFamily: 'Poppins-Regular',
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
    },
});
