import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Platform, useWindowDimensions, RefreshControl
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { API_URL } from '@/constants/api';
import { useSafeBack } from '@/hooks/useSafeBack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';
import { VitalsCharts } from '../(subscriber)/components/beneficiary/VitalsCharts';
import { useGlobalRefresh } from '@/utils/events';

// ── Types ─────────────────────────────────────────────────────────────────────

interface VitalCard {
    code: string;
    name: string;
    icon: string;
    color: string;
    value: string;
    unit: string;
    dataType: string;
    hasReading: boolean;
}

interface HistoryVital {
    name: string;
    value: string;
    icon: string;
    source?: string;
    recorder?: string;
}

interface HistoryItem {
    id: string;
    date: string;
    recorder?: string;
    recorderType?: 'care_companion' | 'beneficiary';
    vitals: HistoryVital[];
}

// ── Colour palette for vitals cards ──────────────────────────────────────────
const CARD_BACKGROUNDS = [
    '#FEF2F2', '#FDF2F8', '#FFF7ED', '#EFF6FF',
    '#F0FDF4', '#FAF5FF', '#FEFCE8', '#F0F9FF',
];

export default function MedicalRecordsScreen() {
    const { width } = useWindowDimensions();
    const MAX_CONTENT_WIDTH = 440;
    const responsiveStyle = { width: '100%' as const, maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' as const };

    useAndroidBackHandler();
    const safeBack = useSafeBack();

    const [latestReadings, setLatestReadings] = useState<VitalCard[]>([]);
    const [trends, setTrends] = useState<any[]>([]);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

    useFocusEffect(useCallback(() => { fetchMedicalRecords(); }, []));
    useGlobalRefresh(() => { fetchMedicalRecords(); });

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchMedicalRecords();
        setRefreshing(false);
    }, []);

    const fetchMedicalRecords = async () => {
        try {
            setLoading(true);
            setError(null);
            const token = await AsyncStorage.getItem('userToken');
            if (!token) {
                setError('Session expired. Please sign in again.');
                return;
            }

            const response = await fetch(`${API_URL}/beneficiary/medical-records/me`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            const data = await response.json();
            if (data.success && data.data) {
                setLatestReadings(data.data.latestReadings || []);
                setTrends(data.data.trends || []);
                setHistory(data.data.history || []);
            } else {
                setError(data.message || 'Failed to fetch medical records.');
            }
        } catch (e) {
            console.error('Fetch Medical Records Error:', e);
            setError('Unable to connect to the server. Please check your network.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            {/* Header */}
            <View style={[styles.header, responsiveStyle]}>
                <TouchableOpacity onPress={() => safeBack()} style={styles.backBtn}>
                    <Feather name="arrow-left" size={22} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Medical Records</Text>
                <View style={styles.headerSpacer} />
            </View>

            {loading ? (
                <View style={[styles.centerWrap, responsiveStyle]}>
                    <ActivityIndicator size="large" color="#FE6700" />
                    <Text style={styles.loadingText}>Loading health vitals & records…</Text>
                </View>
            ) : error ? (
                <View style={[styles.centerWrap, responsiveStyle]}>
                    <Ionicons name="alert-circle-outline" size={48} color="#EF4444" style={{ marginBottom: 12 }} />
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity style={styles.retryBtn} onPress={fetchMedicalRecords}>
                        <Text style={styles.retryBtnText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={[styles.content, responsiveStyle]}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FE6700" />}
                >
                    <Text style={styles.subtitle}>Track your vitals</Text>

                    {/* ── Latest Readings ── */}
                    <Text style={styles.sectionTitle}>Latest Readings</Text>

                    {latestReadings.length === 0 ? (
                        <View style={styles.emptyCard}>
                            <MaterialCommunityIcons name="clipboard-text-off-outline" size={32} color="#D1D5DB" />
                            <Text style={styles.emptyCardText}>No vitals configured yet.</Text>
                        </View>
                    ) : (
                        <View style={styles.latestGrid}>
                            {latestReadings.map((vital, idx) => (
                                <View
                                    key={vital.code}
                                    style={[styles.latestCard, { backgroundColor: CARD_BACKGROUNDS[idx % CARD_BACKGROUNDS.length] }]}
                                >
                                    <View style={styles.cardIconWrap}>
                                        <MaterialCommunityIcons
                                            name={vital.icon as any}
                                            size={22}
                                            color={vital.color}
                                        />
                                    </View>
                                    <Text style={styles.cardLabel} numberOfLines={1}>{vital.name}</Text>
                                    <Text style={[
                                        styles.cardValue,
                                        !vital.hasReading && { color: '#9CA3AF' }
                                    ]}>
                                        {vital.value}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* ── Trends ── */}
                    <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Trends (Last 30 days)</Text>

                    {trends.length === 0 ? (
                        <View style={styles.emptyCard}>
                            <Text style={styles.emptyCardText}>Not enough data to display trends.</Text>
                        </View>
                    ) : (
                        <View style={styles.trendsCard}>
                            <VitalsCharts trends={trends} />
                        </View>
                    )}

                    {/* ── History ── */}
                    <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Readings History</Text>

                    {history.length === 0 ? (
                        <View style={styles.emptyCard}>
                            <Text style={styles.emptyCardText}>No readings history found.</Text>
                        </View>
                    ) : (
                        <View style={styles.historyList}>
                            {history.map(item => {
                                const isExpanded = expandedHistoryId === item.id;
                                return (
                                    <View key={item.id} style={styles.historyCard}>
                                        <TouchableOpacity
                                            style={styles.historyCardHeader}
                                            onPress={() => setExpandedHistoryId(isExpanded ? null : item.id)}
                                            activeOpacity={0.7}
                                        >
                                            <View style={styles.historyDateRow}>
                                                <Feather name="calendar" size={14} color="#6B7280" style={{ marginRight: 6 }} />
                                                <Text style={styles.historyDateText}>{item.date}</Text>
                                            </View>
                                            <View style={styles.historyMeta}>
                                                {/* Recorder badge */}
                                                {item.recorderType === 'beneficiary' ? (
                                                    <View style={styles.selfBadge}>
                                                        <Text style={styles.selfBadgeText}>Self</Text>
                                                    </View>
                                                ) : item.recorder ? (
                                                    <View style={styles.ccBadge}>
                                                        <Text style={styles.ccBadgeText} numberOfLines={1}>CC</Text>
                                                    </View>
                                                ) : null}
                                                <Text style={styles.historyCount}>{item.vitals.length} vital{item.vitals.length !== 1 ? 's' : ''}</Text>
                                                <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color="#6B7280" style={{ marginLeft: 4 }} />
                                            </View>
                                        </TouchableOpacity>

                                        {isExpanded && (
                                            <View style={styles.historyVitalsWrap}>
                                                <View style={styles.historyDivider} />
                                                {item.vitals.map((v, idx) => (
                                                    <View key={`${v.name}-${idx}`} style={styles.historyVitalRow}>
                                                        <MaterialCommunityIcons
                                                            name={v.icon as any}
                                                            size={15}
                                                            color="#6B7280"
                                                            style={{ marginRight: 8 }}
                                                        />
                                                        <Text style={styles.historyVitalName}>{v.name}</Text>
                                                        <Text style={styles.historyVitalValue}>{v.value}</Text>
                                                    </View>
                                                ))}
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    <View style={{ height: Platform.OS === 'ios' ? 100 : 80 }} />
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    safeArea:       { flex: 1, backgroundColor: '#FFF0E6' },
    header: {
        height: 60,
        backgroundColor: '#FFFFFF',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    backBtn:        { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerSpacer:   { width: 40, height: 40 },
    headerTitle:    { fontFamily: 'Poppins-Medium', fontSize: 17, color: '#111827' },
    content:        { paddingHorizontal: 16, paddingTop: 16 },
    centerWrap: {
        flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24,
    },
    loadingText: {
        marginTop: 12, color: '#374151', fontFamily: 'Poppins-Medium', fontSize: 14,
    },
    errorText: {
        fontFamily: 'Poppins-Regular', fontSize: 14, color: '#DC2626',
        textAlign: 'center', marginBottom: 16, lineHeight: 20,
    },
    retryBtn: {
        backgroundColor: '#FE6700', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12,
    },
    retryBtnText:   { fontFamily: 'Poppins-Medium', color: '#FFFFFF', fontSize: 14 },
    subtitle: {
        fontFamily: 'Poppins-Regular', fontSize: 15, color: '#4B5563', marginBottom: 16,
    },
    sectionTitle: {
        fontFamily: 'Poppins-SemiBold', fontSize: 17, color: '#111827', marginBottom: 12,
    },
    emptyCard: {
        backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24,
        alignItems: 'center', justifyContent: 'center', gap: 10,
        marginBottom: 4,
    },
    emptyCardText: { color: '#9CA3AF', fontFamily: 'Poppins-Medium', fontSize: 14 },

    // ── Latest Grid ──
    latestGrid: {
        flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 4,
    },
    latestCard: {
        width: '48%', borderRadius: 16, padding: 16,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
    },
    cardIconWrap: { marginBottom: 10 },
    cardLabel: {
        fontFamily: 'Poppins-Regular', fontSize: 12, color: '#6B7280', marginBottom: 4,
    },
    cardValue: {
        fontFamily: 'Poppins-Medium', fontSize: 16, color: '#111827',
    },

    // ── Trends ──
    trendsCard: {
        backgroundColor: '#FFFFFF', borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
        marginBottom: 4,
    },

    // ── History ──
    historyList: { gap: 12, marginBottom: 4 },
    historyCard: {
        backgroundColor: '#FFFFFF', borderRadius: 16,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
        overflow: 'hidden',
    },
    historyCardHeader: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', padding: 16,
    },
    historyDateRow: { flexDirection: 'row', alignItems: 'center' },
    historyDateText: { fontFamily: 'Poppins-Medium', fontSize: 14, color: '#111827' },
    historyMeta: { flexDirection: 'row', alignItems: 'center' },
    historyCount: { fontFamily: 'Poppins-Regular', fontSize: 13, color: '#6B7280' },
    historyVitalsWrap: { paddingHorizontal: 16, paddingBottom: 16 },
    historyDivider: { height: 1, backgroundColor: '#F3F4F6', marginBottom: 12 },
    historyVitalRow: {
        flexDirection: 'row', alignItems: 'center', marginBottom: 8,
    },
    historyVitalName: {
        fontFamily: 'Poppins-Regular', fontSize: 13, color: '#6B7280', flex: 1,
    },
    historyVitalValue: {
        fontFamily: 'Poppins-Medium', fontSize: 13, color: '#111827',
    },
    selfBadge: {
        backgroundColor: '#DBEAFE', borderRadius: 6,
        paddingHorizontal: 7, paddingVertical: 2, marginRight: 8,
    },
    selfBadgeText: { fontSize: 10, fontWeight: '700', color: '#1D4ED8' },
    ccBadge: {
        backgroundColor: '#F3F4F6', borderRadius: 6,
        paddingHorizontal: 7, paddingVertical: 2, marginRight: 8,
    },
    ccBadgeText: { fontSize: 10, fontWeight: '700', color: '#6B7280' },
});