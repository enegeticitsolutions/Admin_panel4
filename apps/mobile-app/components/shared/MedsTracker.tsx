import React, { useEffect, useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
    Animated,
    TouchableWithoutFeedback,
    Alert,
    Platform
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { API_URL } from '@/constants/api';

// --- PIXEL PERFECT CUSTOM SVG ICONS ---
const CustomPillIcon = ({ size = 24, color = '#FE6700' }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M4.5 12.5l8-8a4.95 4.95 0 017 7l-8 8a4.95 4.95 0 01-7-7z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M8.5 8.5l7 7" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
);

const CustomCalendarBadgeIcon = ({ size = 32, color = '#FFFFFF' }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Rect x="3" y="4" width="18" height="18" rx="2" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M16 2v4M8 2v4M3 10h18" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <Circle cx="17.5" cy="17.5" r="4.5" fill="#FE6700" stroke={color} strokeWidth="1.5" />
        <Path d="M15.5 17.5l1.5 1.5 2.5-2.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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

const CustomBellOutlineIcon = ({ size = 26, color = '#FE6700' }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M13.73 21a2 2 0 0 1-3.46 0" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);

const CustomShieldIcon = ({ size = 42, color = '#9CA3AF' }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);

// --- PIXEL PERFECT CUSTOM OUTLINE SWITCH ---
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
        outputRange: [2, 22],
    });

    const borderColor = animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['#D1D5DB', '#FE6700'],
    });

    const thumbColor = animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['#D1D5DB', '#FE6700'],
    });

    return (
        <TouchableWithoutFeedback onPress={() => onValueChange(!value)}>
            <Animated.View style={[styles.switchTrack, { borderColor }]}>
                <Animated.View style={[styles.switchThumb, { transform: [{ translateX }], backgroundColor: thumbColor }]} />
            </Animated.View>
        </TouchableWithoutFeedback>
    );
};
// ------------------------------------------------

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
};

type Metrics = {
    average: number;
    taken: number;
    missed: number;
};

type Props = {
    beneficiaryId?: string; // Optional: If not provided, will read from AsyncStorage
};

export default function MedsTracker({ beneficiaryId: propBeneficiaryId }: Props) {
    const [schedule, setSchedule] = useState<MedScheduleItem[]>([]);
    const [metrics, setMetrics] = useState<Metrics>({ average: 100, taken: 0, missed: 0 });
    const [loading, setLoading] = useState(true);
    const [remindersActive, setRemindersActive] = useState(true);
    const [submittingId, setSubmittingId] = useState<string | null>(null);

    useEffect(() => {
        loadData();
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
                // High-fidelity Mock state if no active session
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

            // Fetch schedule & metrics in parallel
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
                setSchedule(scheduleData.data || []);
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

    const loadMocks = () => {
        setMetrics({ average: 95, taken: 87, missed: 5 });
        setSchedule([
            {
                id: 'mock-med-1',
                logId: null,
                name: 'Lisinopril',
                dosage: '10mg',
                frequency: 'once daily',
                instructions: 'Take after food',
                scheduleTimeText: '08:00 AM',
                scheduledTimeIso: new Date().toISOString(),
                status: 'pending',
                adherencePercentage: 96
            },
            {
                id: 'mock-med-2',
                logId: null,
                name: 'Metformin',
                dosage: '500mg',
                frequency: 'twice daily',
                instructions: 'Take before meal',
                scheduleTimeText: '08:00 PM',
                scheduledTimeIso: new Date().toISOString(),
                status: 'pending',
                adherencePercentage: 92
            }
        ]);
    };

    const handleLogAdherence = async (item: MedScheduleItem, taken: boolean) => {
        try {
            setSubmittingId(`${item.id}-${item.scheduleTimeText}`);
            let targetBeneficiaryId = propBeneficiaryId;

            if (!targetBeneficiaryId) {
                const userStr = await AsyncStorage.getItem('userData');
                if (userStr) {
                    const user = JSON.parse(userStr);
                    targetBeneficiaryId = user.id;
                }
            }

            if (!targetBeneficiaryId) {
                // local mock state modification
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
                // reload entire dynamic schedule + metrics
                await loadData();
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
        // adjust quick count
        setMetrics(m => ({
            average: m.average,
            taken: taken ? m.taken + 1 : m.taken,
            missed: !taken ? m.missed + 1 : m.missed
        }));
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#FE6700" />
                <Text style={styles.loadingText}>Loading Medications...</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* Header Row with Reminder Toggle */}
            <View style={styles.headerRow}>
                <Text style={styles.sectionTitle}>Medications</Text>
                <View style={styles.toggleContainer}>
                    <Text style={styles.toggleLabel}>Reminders</Text>
                    <CustomSwitch value={remindersActive} onValueChange={setRemindersActive} />
                </View>
            </View>

            {/* Adherence Percentage Banner Card (Figma Match) */}
            <View style={styles.statsCard}>
                <View style={styles.statsHeader}>
                    <CustomCalendarBadgeIcon size={32} color="#FFFFFF" />
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

            {/* Daily schedule title - Logic preserved, style updated */}
            <Text style={styles.groupTitle}>
                {schedule.length > 0 && schedule[0].isFutureSchedule
                    ? `Upcoming Doses (Starting ${schedule[0].futureDateText})`
                    : "Your Medications"}
            </Text>

            {schedule.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <CustomShieldIcon size={42} color="#9CA3AF" />
                    <Text style={styles.emptyText}>No medications scheduled for today.</Text>
                </View>
            ) : (
                schedule.map((item, index) => {
                    const isSubmitting = submittingId === `${item.id}-${item.scheduleTimeText}`;

                    return (
                        <View key={`${item.id}-${index}`} style={styles.medCard}>
                            <View style={styles.medMainRow}>
                                {/* Icon with soft orange backdrop */}
                                <View style={styles.iconCircle}>
                                    <CustomPillIcon size={24} color="#FE6700" />
                                </View>

                                {/* Title & subtitiles */}
                                <View style={styles.medDetails}>
                                    <Text style={styles.medName}>{item.name}</Text>
                                    <Text style={styles.medSub}>
                                        {item.dosage} - {item.frequency}
                                    </Text>
                                    <Text style={styles.medInstructions}>
                                        For: {item.instructions}
                                    </Text>
                                </View>

                                {/* Action buttons */}
                                <View style={styles.actionColumn}>
                                    {isSubmitting ? (
                                        <ActivityIndicator size="small" color="#FE6700" />
                                    ) : (
                                        <View style={styles.btnRow}>
                                            <TouchableOpacity
                                                onPress={() => item.status !== 'taken' && handleLogAdherence(item, true)}
                                                disabled={item.status === 'taken'}
                                                activeOpacity={0.7}
                                                style={[
                                                    styles.actionBtn,
                                                    styles.checkBtn,
                                                    item.status === 'taken' && styles.activeCheck
                                                ]}
                                            >
                                                <CustomCheckIcon
                                                    size={18}
                                                    color={item.status === 'taken' ? '#FFFFFF' : '#16A34A'}
                                                />
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                onPress={() => item.status !== 'missed' && handleLogAdherence(item, false)}
                                                disabled={item.status === 'missed'}
                                                activeOpacity={0.7}
                                                style={[
                                                    styles.actionBtn,
                                                    styles.crossBtn,
                                                    item.status === 'missed' && styles.activeCross
                                                ]}
                                            >
                                                <CustomCrossIcon
                                                    size={18}
                                                    color={item.status === 'missed' ? '#FFFFFF' : '#EF4444'}
                                                />
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                            </View>

                            {/* Divider line in card */}
                            <View style={styles.innerDivider} />

                            {/* Lower metadata + individual progress bars */}
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

            {/* Reminder bottom banner card - Logic preserved, style updated */}
            <View style={styles.bannerCard}>
                <View style={styles.bannerIconContainer}>
                    <CustomBellOutlineIcon size={26} color="#FE6700" />
                </View>
                <View style={styles.bannerCopy}>
                    <Text style={styles.bannerTitle}>Medication Reminders Active</Text>
                    <Text style={styles.bannerText}>
                        Medication Reminders Active. You'll receive system alerts for your scheduled medication timings.
                    </Text>
                </View>
            </View>

            <View style={{ height: 40 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFF0E6', // Strict Figma match
    },
    content: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: Platform.OS === 'ios' ? 120 : 100,
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

    // --- Outline Style Toggle Switch ---
    switchTrack: {
        width: 44,
        height: 24,
        borderRadius: 12,
        borderWidth: 1.5,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
    },
    switchThumb: {
        width: 16,
        height: 16,
        borderRadius: 8,
        position: 'absolute',
        left: 0,
    },

    // --- Top Row ---
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    sectionTitle: {
        fontFamily: 'Poppins-Medium',
        fontSize: 16,
        color: '#111827',
    },
    toggleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    toggleLabel: {
        fontFamily: 'Poppins-Regular',
        fontSize: 14,
        color: '#374151',
        marginRight: 10,
    },

    // --- Stats Card (Figma Match) ---
    statsCard: {
        backgroundColor: '#FE6700',
        borderRadius: 16,
        padding: 24,
        marginBottom: 24,
        shadowColor: '#FE6700',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 6,
    },
    statsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
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
        fontSize: 32,
        color: '#FFFFFF',
    },
    metricLabel: {
        fontFamily: 'Poppins-Regular',
        fontSize: 13,
        color: '#FFFFFF',
        marginTop: 4,
    },

    groupTitle: {
        fontFamily: 'Poppins-Medium',
        fontSize: 18,
        color: '#111827',
        marginBottom: 16,
    },

    // --- Medication List Cards ---
    medCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#F3F4F6',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
        elevation: 2,
    },
    medMainRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconCircle: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: '#FFF0E6',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    medDetails: {
        flex: 1,
        justifyContent: 'center',
    },
    medName: {
        fontFamily: 'Poppins-Medium',
        fontSize: 17,
        color: '#111827',
        marginBottom: 2,
    },
    medSub: {
        fontFamily: 'Poppins-Regular',
        fontSize: 13,
        color: '#4B5563',
    },
    medInstructions: {
        fontFamily: 'Poppins-Regular',
        fontSize: 13,
        color: '#4B5563',
        marginTop: 2,
    },

    // --- Action Buttons ---
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
        backgroundColor: '#FCE7F3',
    },
    activeCheck: {
        backgroundColor: '#16A34A',
    },
    activeCross: {
        backgroundColor: '#EF4444',
    },

    innerDivider: {
        height: 1,
        backgroundColor: '#F3F4F6',
        marginVertical: 16,
    },
    medFooter: {
        marginTop: 0,
    },
    scheduleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    scheduleTime: {
        fontFamily: 'Poppins-Regular',
        fontSize: 13,
        color: '#374151',
    },
    percentText: {
        fontFamily: 'Poppins-Medium',
        fontSize: 13,
        color: '#111827',
    },
    trackBackground: {
        height: 8,
        borderRadius: 4,
        backgroundColor: '#E5E7EB',
        overflow: 'hidden',
    },
    trackFill: {
        height: 8,
        borderRadius: 4,
        backgroundColor: '#16A34A',
    },

    // --- Bottom Bell Banner ---
    bannerCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginTop: 8,
        flexDirection: 'row',
        alignItems: 'flex-start',
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    bannerIconContainer: {
        marginTop: 2,
        marginRight: 16,
    },
    bannerCopy: {
        flex: 1,
    },
    bannerTitle: {
        fontFamily: 'Poppins-Medium',
        fontSize: 15,
        color: '#111827',
        marginBottom: 6,
    },
    bannerText: {
        fontFamily: 'Poppins-Regular',
        fontSize: 14,
        color: '#4B5563',
        lineHeight: 22,
    },

    emptyContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 40,
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    emptyText: {
        marginTop: 16,
        fontFamily: 'Poppins-Regular',
        fontSize: 15,
        color: '#6B7280',
        textAlign: 'center',
    },
});