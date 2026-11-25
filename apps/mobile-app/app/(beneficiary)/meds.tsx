import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
    Platform,
    Alert,
    RefreshControl,
    useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { API_URL } from '@/constants/api';
import { useGlobalRefresh, emitGlobalRefresh } from '@/utils/events';
import { useAuth } from '@/contexts/AuthContext';
import { HomeHeader } from '@/components/dashboard/HomeHeader';
import { EmergencyAssistanceModal } from '@/components/shared/EmergencyAssistanceModal';
import { HomeColors } from '@/constants/homeTheme';
import { triggerEmergencyAlert, dialEmergencyHelpline, EMERGENCY_HELPLINE_NUMBER } from '@/services/emergencyTrigger';
import {
    FamilyMemberFilterPills,
    FamilyFilterMember,
    WeeklyCalendarStrip,
    MedicationDoseCard,
    DoseScheduleItem,
    AdherenceSummaryCard,
    ReportsPrescriptionsCard,
    AddMedicationModal,
    MedicationFormPayload,
} from '@/components/medications';
import { MedicationPresetItem } from '@/constants/medicationPresets';

type Metrics = {
    average: number;
    taken: number;
    missed: number;
    totalExpected?: number;
    completedDays?: number;
    totalDays?: number;
};

export default function MedsTracker() {
    const router = useRouter();
    const routeParams = useLocalSearchParams<{ beneficiaryId?: string; highlightMedId?: string }>();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const { user, isGuest, requireAuth } = useAuth();

    // Responsive container
    const isTablet = width >= 768;
    const MAX_CONTAINER_WIDTH = 640;
    const horizontalGutter = width < 380 ? 12 : 16;
    const containerStyle = {
        width: '100%' as const,
        maxWidth: MAX_CONTAINER_WIDTH,
        alignSelf: 'center' as const,
        paddingHorizontal: horizontalGutter,
    };

    // State
    const [schedule, setSchedule] = useState<DoseScheduleItem[]>([]);
    const [metrics, setMetrics] = useState<Metrics>({ average: 0, taken: 0, missed: 0 });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [submittingId, setSubmittingId] = useState<string | null>(null);
    const [triggeringSos, setTriggeringSos] = useState(false);
    const [showEmergencyModal, setShowEmergencyModal] = useState(false);

    // Beneficiary switching
    const [familyMembers, setFamilyMembers] = useState<FamilyFilterMember[]>([]);
    const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState<string>(routeParams.beneficiaryId || '');

    // Calendar selection
    const getTodayDateStr = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    const [selectedDate, setSelectedDate] = useState<string>(getTodayDateStr());

    // Modal state
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedPreset, setSelectedPreset] = useState<MedicationPresetItem | null>(null);
    const [editingMed, setEditingMed] = useState<MedicationFormPayload | null>(null);
    const [modalLoading, setModalLoading] = useState(false);

    // Current Greeting & Name
    const currentHour = new Date().getHours();
    let defaultGreeting = 'Good morning';
    if (currentHour >= 12 && currentHour < 17) defaultGreeting = 'Good afternoon';
    else if (currentHour >= 17) defaultGreeting = 'Good evening';

    const userName = user?.name || (isGuest ? 'Guest' : 'Member');

    // Load available beneficiaries (Family Members + Self)
    const loadBeneficiaries = useCallback(async () => {
        try {
            const token = await AsyncStorage.getItem('userToken');
            if (!token) {
                setFamilyMembers([
                    { id: 'self', name: 'My health', isSelf: true },
                ]);
                return;
            }

            const members: FamilyFilterMember[] = [];

            // 1. Fetch Subscriber Dashboard to get family circle members
            try {
                const subRes = await fetch(`${API_URL}/subscriber/dashboard/me`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const subJson = await subRes.json();
                const list = subJson?.data?.beneficiaries || subJson?.beneficiaries || [];
                list.forEach((b: any) => {
                    if (b?.id && b?.name) {
                        members.push({ id: b.id, name: b.name });
                    }
                });
            } catch (e) {
                console.warn('[MedsTracker] Could not load subscriber beneficiaries:', e);
            }

            // 2. Fetch Beneficiary Self Profile
            try {
                const benRes = await fetch(`${API_URL}/beneficiary/dashboard/dashboard/me`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const benJson = await benRes.json();
                if (benJson.success && benJson.data?.beneficiaryId) {
                    const selfId = benJson.data.beneficiaryId;
                    await AsyncStorage.setItem('selfBeneficiaryId', selfId);
                    // Add My health at the end or begin
                    const alreadyPresent = members.some((m) => m.id === selfId);
                    if (!alreadyPresent) {
                        members.push({ id: selfId, name: 'My health', isSelf: true });
                    }
                }
            } catch (e) {
                console.warn('[MedsTracker] Could not load beneficiary self ID:', e);
            }

            if (members.length === 0) {
                members.push({ id: user?.id || 'self', name: 'My health', isSelf: true });
            }

            setFamilyMembers(members);

            // Set initial selected beneficiary if none is set
            setSelectedBeneficiaryId((prev) => {
                if (prev) return prev;
                if (routeParams.beneficiaryId) return routeParams.beneficiaryId;
                return members[0]?.id || 'self';
            });
        } catch (err) {
            console.error('Failed to load beneficiaries:', err);
        }
    }, [user?.id, routeParams.beneficiaryId]);

    // Resolve Target Beneficiary ID
    const resolveTargetBeneficiaryId = useCallback(async (): Promise<string | null> => {
        if (selectedBeneficiaryId && selectedBeneficiaryId !== 'self') {
            return selectedBeneficiaryId;
        }
        if (routeParams.beneficiaryId) return routeParams.beneficiaryId;
        const storedSelfBenId = await AsyncStorage.getItem('selfBeneficiaryId');
        if (storedSelfBenId) return storedSelfBenId;

        const token = await AsyncStorage.getItem('userToken');
        if (token) {
            try {
                const res = await fetch(`${API_URL}/beneficiary/dashboard/dashboard/me`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const json = await res.json();
                if (json.success && json.data?.beneficiaryId) {
                    await AsyncStorage.setItem('selfBeneficiaryId', json.data.beneficiaryId);
                    return json.data.beneficiaryId;
                }
            } catch (e) {
                console.warn('[MedsTracker] Failed to resolve target benId:', e);
            }
        }

        const userStr = await AsyncStorage.getItem('userData');
        if (userStr) {
            const parsed = JSON.parse(userStr);
            return parsed.id;
        }
        return null;
    }, [selectedBeneficiaryId, routeParams.beneficiaryId]);

    // Load Medications & Metrics
    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const targetBeneficiaryId = await resolveTargetBeneficiaryId();

            if (!targetBeneficiaryId) {
                setSchedule([]);
                setMetrics({ average: 0, taken: 0, missed: 0 });
                setLoading(false);
                return;
            }

            const token = await AsyncStorage.getItem('userToken');
            if (!token) {
                setSchedule([]);
                setMetrics({ average: 0, taken: 0, missed: 0 });
                setLoading(false);
                return;
            }

            const [scheduleRes, metricsRes] = await Promise.all([
                fetch(`${API_URL}/shared/medications/beneficiary/${targetBeneficiaryId}/today?date=${encodeURIComponent(selectedDate)}`, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
                fetch(`${API_URL}/shared/medications/beneficiary/${targetBeneficiaryId}/metrics`, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
            ]);

            const scheduleData = await scheduleRes.json();
            const metricsData = await metricsRes.json();

            if (scheduleData.success) {
                const items: DoseScheduleItem[] = scheduleData.data || [];
                setSchedule(items);
                if (selectedDate === getTodayDateStr()) {
                    scheduleLocalReminders(items);
                }
            } else {
                setSchedule([]);
            }

            if (metricsData.success && metricsData.data) {
                setMetrics({
                    average: metricsData.data.average ?? 0,
                    taken: metricsData.data.taken ?? 0,
                    missed: metricsData.data.missed ?? 0,
                    totalExpected: metricsData.data.totalExpected ?? 0,
                    completedDays: metricsData.data.completedDays ?? 0,
                    totalDays: metricsData.data.totalDays ?? 7,
                });
            } else {
                setMetrics({ average: 0, taken: 0, missed: 0, totalExpected: 0, completedDays: 0, totalDays: 7 });
            }
        } catch (err) {
            console.error('Failed to load medication data:', err);
            setSchedule([]);
            setMetrics({ average: 0, taken: 0, missed: 0, totalExpected: 0, completedDays: 0, totalDays: 7 });
        } finally {
            setLoading(false);
        }
    }, [resolveTargetBeneficiaryId, selectedDate]);

    // Initial load
    useEffect(() => {
        loadBeneficiaries();
    }, [loadBeneficiaries]);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    useGlobalRefresh(() => {
        loadData();
    });

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([loadBeneficiaries(), loadData()]);
        setRefreshing(false);
    }, [loadBeneficiaries, loadData]);

    // Schedule notifications for on-time alerts
    const scheduleLocalReminders = async (items: DoseScheduleItem[]) => {
        if (Platform.OS === 'web') return;
        try {
            await Notifications.cancelAllScheduledNotificationsAsync();
            const { status } = await Notifications.getPermissionsAsync();
            if (status !== 'granted') {
                const req = await Notifications.requestPermissionsAsync();
                if (req.status !== 'granted') return;
            }

            const now = new Date();
            for (const item of items) {
                const schedTime = new Date(item.scheduledTimeIso);
                const diffMs = schedTime.getTime() - now.getTime();
                if (diffMs > 0) {
                    const seconds = Math.max(1, Math.floor(diffMs / 1000));
                    await Notifications.scheduleNotificationAsync({
                        content: {
                            title: `💊 Medication Reminder: ${item.name}`,
                            body: `Time to take your ${item.dosage || ''} dose (${item.scheduleTimeText}). ${item.instructions || ''}`,
                            data: { medicationId: item.id, scheduleTimeText: item.scheduleTimeText },
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
            console.log('Failed to schedule local reminders:', err);
        }
    };

    // Is the user viewing today?
    const isViewingToday = selectedDate === getTodayDateStr();

    // Log Adherence (Mark Taken)
    const handleLogAdherence = async (item: DoseScheduleItem, taken: boolean) => {
        if (requireAuth('Create an account to record your medication adherence.')) return;

        if (!isViewingToday) {
            Alert.alert(
                'Dose Locked',
                'Medication doses can only be marked on their scheduled day (Today).'
            );
            return;
        }

        if (item.scheduledTimeIso && new Date(item.scheduledTimeIso).getTime() > Date.now()) {
            Alert.alert(
                'Scheduled for Later',
                `This dose is scheduled for ${item.scheduleTimeText}. You can mark it taken once that time arrives.`
            );
            return;
        }

        try {
            setSubmittingId(item.id);
            const targetBeneficiaryId = await resolveTargetBeneficiaryId();

            if (!targetBeneficiaryId) {
                updateLocalStatus(item, taken);
                return;
            }

            const token = await AsyncStorage.getItem('userToken');
            if (!token) {
                updateLocalStatus(item, taken);
                return;
            }

            const res = await fetch(`${API_URL}/shared/medications/adherence/log`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    beneficiaryId: targetBeneficiaryId,
                    medicationId: item.id,
                    scheduledTimeIso: item.scheduledTimeIso,
                    taken,
                    recordedBy: 'beneficiary',
                }),
            });

            const responseData = await res.json();
            if (responseData.success) {
                await loadData();
                emitGlobalRefresh();
            } else {
                Alert.alert('Error', responseData.message || 'Failed to update schedule');
            }
        } catch (err) {
            console.error('Failed to log adherence:', err);
            updateLocalStatus(item, taken);
        } finally {
            setSubmittingId(null);
        }
    };

    const updateLocalStatus = (item: DoseScheduleItem, taken: boolean) => {
        setSchedule((prev) =>
            prev.map((s) => (s.id === item.id ? { ...s, status: taken ? 'taken' : 'missed' } : s))
        );
        setMetrics((m) => ({
            ...m,
            taken: taken ? m.taken + 1 : m.taken,
            missed: !taken ? m.missed + 1 : m.missed,
        }));
    };

    // Open Add Medication Modal
    const handleOpenAdd = () => {
        if (requireAuth('Create an account to add and manage your medications.')) return;
        setSelectedPreset(null);
        setEditingMed(null);
        setShowAddModal(true);
    };

    // Save Medication from Modal
    const handleSaveMedication = async (payload: MedicationFormPayload) => {
        try {
            setModalLoading(true);
            const targetBeneficiaryId = await resolveTargetBeneficiaryId();
            const token = await AsyncStorage.getItem('userToken');
            if (!token || !targetBeneficiaryId) {
                Alert.alert('Error', 'Please sign in to add medication.');
                return;
            }

            const isEdit = !!payload.id;
            const url = isEdit
                ? `${API_URL}/shared/medications/${payload.id}`
                : `${API_URL}/shared/medications`;
            const method = isEdit ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    beneficiaryId: targetBeneficiaryId,
                    name: payload.name,
                    genericName: payload.genericName,
                    dosage: payload.dosage,
                    route: payload.route,
                    cadence: payload.cadence,
                    frequency: payload.frequency,
                    timeSlots: payload.timeSlots,
                    instructions: payload.instructions,
                    totalDays: payload.totalDays,
                    setReminders: payload.setReminders,
                    isActive: true,
                }),
            });

            const data = await res.json();
            if (data.success) {
                setShowAddModal(false);
                setSelectedPreset(null);
                setEditingMed(null);
                await loadData();
                emitGlobalRefresh();
                Alert.alert('Saved', `${payload.name} has been added to your schedule.`);
            } else {
                Alert.alert('Error', data.message || 'Failed to save medication.');
            }
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to save medication.');
        } finally {
            setModalLoading(false);
        }
    };

    // Emergency SOS Trigger
    const handleSosPress = () => {
        if (requireAuth('Trigger emergency SOS and broadcast your live location to care responders.')) return;
        if (triggeringSos) return;
        setShowEmergencyModal(true);
    };

    const executeSosCall = async () => {
        setShowEmergencyModal(false);
        setTriggeringSos(true);
        try {
            const result = await triggerEmergencyAlert(
                'Emergency SOS triggered from Medication Screen',
                { autoDial: true }
            );
            if (result.success) {
                Alert.alert(
                    'Emergency Alert Sent',
                    `Emergency ticket ${result.ticketNumber || 'EMG-ALERT'} has been broadcast.`
                );
            } else {
                dialEmergencyHelpline();
            }
        } catch (e) {
            dialEmergencyHelpline();
        } finally {
            setTriggeringSos(false);
        }
    };

    return (
        <View style={styles.safeArea}>
            {/* Top Navigation Header matching Home Screen */}
            <View style={[styles.headerWrapper, { paddingTop: Math.max(insets.top, Platform.OS === 'android' ? 24 : 12) }]}>
                <HomeHeader
                    greeting={defaultGreeting}
                    userName={userName}
                    onSosPress={handleSosPress}
                    triggeringSos={triggeringSos}
                />
            </View>

            <ScrollView
                style={styles.container}
                contentContainerStyle={[
                    styles.scrollContent,
                    containerStyle,
                    { paddingBottom: Math.max(insets.bottom, 16) + 80 },
                ]}
                showsVerticalScrollIndicator={false}
                bounces={true}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FE6700" />
                }
            >
                {/* ── Category & Action Header Row ── */}
                <View style={styles.categoryActionRow}>
                    <View style={styles.titleColumn}>
                        <Text style={styles.categoryTag}>DAILY CARE</Text>
                        <Text style={styles.headingTitle}>Meds & health</Text>
                    </View>

                    <TouchableOpacity
                        style={styles.addMedButton}
                        onPress={handleOpenAdd}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="add" size={18} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text style={styles.addMedButtonText}>Add medication</Text>
                    </TouchableOpacity>
                </View>

                {/* ── Family Member / Care Circle Filter Pills ── */}
                <FamilyMemberFilterPills
                    members={familyMembers}
                    selectedId={selectedBeneficiaryId}
                    onSelectMember={(id) => {
                        setSelectedBeneficiaryId(id);
                    }}
                />

                {/* ── Weekly Calendar Day Strip ── */}
                <WeeklyCalendarStrip
                    selectedDate={selectedDate}
                    onSelectDate={(dateStr) => {
                        setSelectedDate(dateStr);
                    }}
                />

                {/* ── Medication Dose Cards List ── */}
                <View style={styles.doseListContainer}>
                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="small" color="#FE6700" />
                            <Text style={styles.loadingSubText}>Loading medication schedule...</Text>
                        </View>
                    ) : schedule.length === 0 ? (
                        <View style={styles.emptyCard}>
                            <Feather name="check-circle" size={36} color="#42BF8A" />
                            <Text style={styles.emptyTitle}>No medications scheduled</Text>
                            <Text style={styles.emptySubtitle}>
                                All caught up! Add a new prescription or supplement using the button above.
                            </Text>
                        </View>
                    ) : (
                        schedule.map((item, index) => (
                            <MedicationDoseCard
                                key={`${item.id}-${item.scheduledTimeIso || item.scheduleTimeText}-${index}`}
                                item={item}
                                index={index}
                                onMarkTaken={(it) => handleLogAdherence(it, true)}
                                onMarkMissed={(it) => handleLogAdherence(it, false)}
                                isSubmitting={submittingId === item.id}
                                canMark={isViewingToday}
                            />
                        ))
                    )}
                </View>

                {/* ── 7-Day Adherence Widget ── */}
                <AdherenceSummaryCard
                    percentage={metrics.average}
                    completedDaysText={
                        (metrics.totalExpected ?? 0) === 0 && metrics.taken === 0
                            ? 'No dose activity recorded yet'
                            : `${metrics.completedDays ?? 0} of ${metrics.totalDays ?? 7} days completed on time`
                    }
                />

                {/* ── Reports & Prescriptions Action Card ── */}
                <ReportsPrescriptionsCard
                    onPress={() => {
                        router.push({
                            pathname: '/(beneficiary)/medical-records',
                            params: selectedBeneficiaryId ? { beneficiaryId: selectedBeneficiaryId } : undefined,
                        });
                    }}
                />
            </ScrollView>

            {/* ── Add Medication Modal ── */}
            <AddMedicationModal
                visible={showAddModal}
                onClose={() => {
                    setShowAddModal(false);
                    setSelectedPreset(null);
                    setEditingMed(null);
                }}
                onSave={handleSaveMedication}
                initialPreset={selectedPreset}
                initialData={editingMed}
                loading={modalLoading}
            />

            <EmergencyAssistanceModal
                visible={showEmergencyModal}
                loading={triggeringSos}
                onCancel={() => setShowEmergencyModal(false)}
                onConfirmCall={executeSosCall}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#FAF3EB',
    },
    headerWrapper: {
        backgroundColor: 'rgba(250, 243, 235, 0.95)',
        borderBottomWidth: 1.08,
        borderBottomColor: '#E7DED6',
        zIndex: 10,
    },
    container: {
        flex: 1,
        backgroundColor: '#FAF3EB',
    },
    scrollContent: {
        paddingTop: 20,
    },
    categoryActionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: 12,
    },
    titleColumn: {
        flex: 1,
        justifyContent: 'center',
    },
    categoryTag: {
        fontFamily: 'Poppins-Bold',
        fontSize: 12,
        lineHeight: 16,
        letterSpacing: 1.56,
        textTransform: 'uppercase',
        color: '#FE6700',
        marginBottom: 4,
    },
    headingTitle: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 21,
        lineHeight: 32,
        letterSpacing: -0.525,
        color: '#1F2937',
    },
    addMedButton: {
        height: 48,
        minHeight: 48,
        paddingHorizontal: 18,
        backgroundColor: '#FE6700',
        borderRadius: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#FE6700',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 20,
        elevation: 3,
    },
    addMedButtonText: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 14,
        lineHeight: 20,
        color: '#FFFFFF',
        textAlign: 'center',
    },
    doseListContainer: {
        width: '100%',
        marginTop: 8,
    },
    loadingContainer: {
        paddingVertical: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingSubText: {
        fontFamily: 'Poppins-Regular',
        fontSize: 13,
        color: '#667085',
        marginTop: 8,
    },
    emptyCard: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderWidth: 1.08,
        borderColor: '#E7DED6',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 12,
    },
    emptyTitle: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 16,
        color: '#1F2937',
        marginTop: 12,
    },
    emptySubtitle: {
        fontFamily: 'Poppins-Regular',
        fontSize: 13,
        color: '#667085',
        textAlign: 'center',
        marginTop: 4,
        lineHeight: 18,
    },
});
