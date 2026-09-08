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
import { useSafeBack } from '@/hooks/useSafeBack';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';
import { API_URL } from '@/constants/api';
import { useGlobalRefresh, emitGlobalRefresh } from '@/utils/events';

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

    const [authToken, setAuthToken] = useState('');
    const [history, setHistory] = useState<SelfReportedHistoryEntry[]>([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showForm, setShowForm] = useState(true); // start with form visible

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
            const token = await AsyncStorage.getItem('userToken');
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
            if (data.success && data.data?.history) {
                // Only show self-reported entries on this page
                const selfOnly = (data.data.history as SelfReportedHistoryEntry[]).filter(
                    h => h.recorderType === 'beneficiary'
                );
                setHistory(selfOnly);
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
        router.replace('/(beneficiary)');
    };

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            {/* Header */}
            <View style={styles.topBar}>
                <TouchableOpacity onPress={() => safeBack()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={styles.topBarContent}>
                    <Text style={styles.topBarTitle}>My Vitals</Text>
                    <Text style={styles.topBarSub}>Self-reported health readings</Text>
                </View>
                {!showForm && (
                    <TouchableOpacity onPress={() => setShowForm(true)} style={styles.addBtn}>
                        <Ionicons name="add" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                )}
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
                                onClose={() => {
                                    if (history.length > 0) setShowForm(false);
                                    else safeBack();
                                }}
                            />
                        ) : (
                            <ActivityIndicator size="large" color="#FF6900" />
                        )}
                    </View>
                )}

                {/* History */}
                {!showForm && history.length > 0 && (
                    <>
                        <View style={styles.sectionRow}>
                            <Text style={styles.sectionTitle}>Previous Readings</Text>
                        </View>
                        {history.map(entry => (
                            <HistoryCard key={entry.id} entry={entry} />
                        ))}
                    </>
                )}

                {!showForm && history.length === 0 && !historyLoading && (
                    <View style={styles.emptyHistory}>
                        <Ionicons name="pulse-outline" size={44} color="#D1D5DB" />
                        <Text style={styles.emptyHistoryText}>No self-reported readings yet.</Text>
                        <TouchableOpacity style={styles.recordNowBtn} onPress={() => setShowForm(true)}>
                            <Text style={styles.recordNowText}>Record Now</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {historyLoading && !showForm && (
                    <ActivityIndicator style={{ marginTop: 32 }} size="large" color="#FF6900" />
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
    addBtn: {
        width: 36, height: 36, borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center', alignItems: 'center',
    },

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
});
