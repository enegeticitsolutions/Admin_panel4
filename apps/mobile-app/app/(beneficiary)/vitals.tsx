import React, { useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    Platform, ActivityIndicator, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { VitalEntrySheet } from '@/components/shared/VitalEntrySheet';
import { VitalsTrendsSection } from '@/components/shared/VitalsTrendsSection';
import { VitalTrend } from '@/app/(subscriber)/components/beneficiary/VitalsCharts';
import { useSafeBack } from '@/hooks/useSafeBack';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';
import { API_URL } from '@/constants/api';
import { useGlobalRefresh, emitGlobalRefresh } from '@/utils/events';
import { useAuth } from '@/contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SelfReportedHistoryEntry {
    id: string;
    date: string;
    recorder: string;
    recorderType: 'beneficiary' | 'care_companion';
    vitals: { name: string; value: string; icon: string; source: string; recorder: string }[];
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function VitalsScreen() {
    const router = useRouter();
    useAndroidBackHandler();
    const safeBack = useSafeBack();
    const { isGuest, requireAuth } = useAuth();

    const [authToken, setAuthToken] = useState('');
    const [userName, setUserName] = useState('');
    const [history, setHistory] = useState<SelfReportedHistoryEntry[]>([]);
    const [trends, setTrends] = useState<VitalTrend[]>([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showForm, setShowForm] = useState(false);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    useGlobalRefresh(() => { loadData(); });

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    }, []);

    const loadData = async () => {
        try {
            const [token, userRaw] = await Promise.all([
                AsyncStorage.getItem('userToken'),
                AsyncStorage.getItem('userData')
            ]);
            if (userRaw) {
                try {
                    const u = JSON.parse(userRaw);
                    if (u.name) setUserName(u.name);
                } catch (_) {}
            }
            if (token) {
                setAuthToken(token);
                await fetchHistory(token);
            }
        } catch (e) {
            console.error('VitalsScreen load error', e);
        }
    };

    const fetchHistory = async (token: string) => {
        try {
            setHistoryLoading(true);
            const res = await fetch(`${API_URL}/beneficiary/medical-records/me`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.success && data.data) {
                setTrends(data.data.trends || []);
                if (data.data.history) {
                    // Only show self-reported entries in the self-reported history list
                    const selfOnly = (data.data.history as SelfReportedHistoryEntry[]).filter(
                        h => h.recorderType === 'beneficiary'
                    );
                    setHistory(selfOnly);
                }
            }
        } catch (e) {
            console.error('Fetch history error', e);
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleSuccess = async () => {
        setShowForm(false);
        const token = await AsyncStorage.getItem('userToken');
        if (token) await fetchHistory(token);
        emitGlobalRefresh();
    };

    // ── Render ───────────────────────────────────────────────────────────────

    if (isGuest) {
        return (
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <View style={styles.topBar}>
                    <TouchableOpacity onPress={() => safeBack()} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
                    </TouchableOpacity>
                    <View style={styles.topBarContent}>
                        <Text style={styles.topBarTitle}>My Vitals</Text>
                        <Text style={styles.topBarSub}>Self-reported health readings</Text>
                    </View>
                </View>

                <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                    <View style={styles.guestCard}>
                        <View style={styles.guestIconWrap}>
                            <Ionicons name="pulse" size={32} color="#FE6700" />
                        </View>
                        <Text style={styles.guestTitle}>Free Daily Vitals Tracking</Text>
                        <Text style={styles.guestDesc}>
                            Track blood pressure, blood sugar, oxygen levels, and temperature daily with safety alerts.
                        </Text>

                        <View style={styles.guestFeatureList}>
                            <View style={styles.guestFeatureRow}>
                                <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                                <Text style={styles.guestFeatureText}>Standard default vitals monitored for all users</Text>
                            </View>
                            <View style={styles.guestFeatureRow}>
                                <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                                <Text style={styles.guestFeatureText}>Persistent history & health trends</Text>
                            </View>
                            <View style={styles.guestFeatureRow}>
                                <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                                <Text style={styles.guestFeatureText}>Share reports with doctors & family</Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={styles.guestCtaBtn}
                            onPress={() => requireAuth('Create an account to track your daily vitals.')}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.guestCtaBtnText}>Create Account to Log Vitals</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            {/* Header */}
            <View style={styles.topBar}>
                <TouchableOpacity onPress={() => safeBack()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={styles.topBarContent}>
                    <Text style={styles.topBarTitle}>My Vitals</Text>
                    <Text style={styles.topBarSub}>
                        {userName ? `Logging for ${userName} (You)` : 'Self-reported personal readings'}
                    </Text>
                </View>
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FE6700" />}
            >
                {/* Entry Form */}
                {showForm && (
                    <View style={styles.formCard}>
                        {authToken ? (
                            <VitalEntrySheet
                                authToken={authToken}
                                onSuccess={handleSuccess}
                                onClose={() => setShowForm(false)}
                            />
                        ) : (
                            <ActivityIndicator size="large" color="#FF6900" />
                        )}
                    </View>
                )}

                {/* Trends + Log Vitals CTA */}
                {!showForm && (
                    <>
                        <TouchableOpacity
                            style={styles.logVitalsBannerBtn}
                            onPress={() => setShowForm(true)}
                            activeOpacity={0.85}
                        >
                            <View style={styles.logVitalsIconWrap}>
                                <Ionicons name="pulse" size={20} color="#FE6700" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.logVitalsTitle}>Log Vitals</Text>
                            </View>
                            <View style={styles.logVitalsPill}>
                                <Ionicons name="add" size={16} color="#FFFFFF" />
                                <Text style={styles.logVitalsPillText}>Record</Text>
                            </View>
                        </TouchableOpacity>

                        {historyLoading && trends.length === 0 ? (
                            <ActivityIndicator style={{ marginTop: 32 }} size="large" color="#FF6900" />
                        ) : (
                            <VitalsTrendsSection trends={trends} defaultLimit={7} />
                        )}
                    </>
                )}

                {/* History */}
                {!showForm && history.length > 0 && (
                    <>
                        <View style={[styles.sectionRow, { marginTop: 24 }]}>
                            <Text style={styles.sectionTitle}>Previous Self-Reported Readings</Text>
                        </View>
                        {history.map(entry => (
                            <HistoryCard key={entry.id} entry={entry} />
                        ))}
                    </>
                )}

                <View style={{ height: 48 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

// ─── History Card ─────────────────────────────────────────────────────────────

const HistoryCard = ({ entry }: { entry: SelfReportedHistoryEntry }) => (
    <View style={styles.historyCard}>
        <View style={styles.historyHeader}>
            <View style={styles.historyIconBadge}>
                <Ionicons name="person-outline" size={14} color="#3B82F6" />
            </View>
            <View style={styles.historyHeaderText}>
                <Text style={styles.historyDate}>{entry.date}</Text>
                <Text style={styles.historyRecorder}>Self-reported</Text>
            </View>
        </View>
        <View style={styles.vitalsRow}>
            {entry.vitals.map((v, i) => (
                <View key={i} style={styles.vitalChip}>
                    <Text style={styles.vitalChipName}>{v.name}</Text>
                    <Text style={styles.vitalChipValue}>{v.value}</Text>
                </View>
            ))}
        </View>
    </View>
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#FAF8F5' },
    topBar: {
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
        width: 36, height: 36, borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center', alignItems: 'center',
    },
    topBarContent: { flex: 1 },
    topBarTitle: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
    topBarSub: { fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 1 },

    scroll: { flex: 1 },
    scrollContent: { padding: 16 },

    formCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 20,
        marginBottom: 24,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12 },
            android: { elevation: 2 },
        }),
    },

    sectionRow: { marginBottom: 12, marginTop: 4 },
    sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },

    logVitalsBannerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 14,
        borderWidth: 1,
        borderColor: '#FED7AA',
        gap: 12,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
            android: { elevation: 2 },
        }),
    },
    logVitalsIconWrap: {
        width: 42,
        height: 42,
        borderRadius: 12,
        backgroundColor: '#FFF3E8',
        alignItems: 'center',
        justifyContent: 'center',
    },
    logVitalsTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
    },
    logVitalsPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FE6700',
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 999,
        gap: 4,
    },
    logVitalsPillText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '700',
    },

    historyCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 8 },
            android: { elevation: 1 },
        }),
    },
    historyHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
    historyIconBadge: {
        width: 28, height: 28, borderRadius: 8,
        backgroundColor: '#DBEAFE',
        justifyContent: 'center', alignItems: 'center',
    },
    historyHeaderText: { flex: 1 },
    historyDate: { fontSize: 14, fontWeight: '700', color: '#111827' },
    historyRecorder: { fontSize: 11, color: '#3B82F6', fontWeight: '600', marginTop: 1 },

    vitalsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    vitalChip: {
        backgroundColor: '#F9FAFB',
        borderRadius: 10,
        paddingVertical: 6, paddingHorizontal: 10,
        borderWidth: 1, borderColor: '#E5E7EB',
    },
    vitalChipName: { fontSize: 10, color: '#6B7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
    vitalChipValue: { fontSize: 13, fontWeight: '800', color: '#111827', marginTop: 2 },

    emptyHistory: { padding: 40, alignItems: 'center', gap: 10 },
    emptyHistoryText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },
    recordNowBtn: {
        marginTop: 4, paddingVertical: 10, paddingHorizontal: 24,
        backgroundColor: '#FF6900', borderRadius: 12,
    },
    recordNowText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
    guestCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        marginVertical: 12,
        borderWidth: 1,
        borderColor: '#F3F4F6',
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12 },
            android: { elevation: 3 },
        }),
    },
    guestIconWrap: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#FFF7ED',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#FFEDD5',
    },
    guestTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
        textAlign: 'center',
    },
    guestDesc: {
        fontSize: 13,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 19,
        marginBottom: 20,
    },
    guestFeatureList: {
        width: '100%',
        backgroundColor: '#F9FAFB',
        borderRadius: 14,
        padding: 16,
        gap: 12,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    guestFeatureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    guestFeatureText: {
        fontSize: 13,
        color: '#374151',
        fontWeight: '500',
        flex: 1,
    },
    guestCtaBtn: {
        width: '100%',
        backgroundColor: '#FE6700',
        borderRadius: 14,
        height: 52,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#FE6700',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 3,
    },
    guestCtaBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});
