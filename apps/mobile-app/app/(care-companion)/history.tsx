import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, ActivityIndicator, Modal, Pressable, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_URL } from '@/constants/api';
import { CompanionBackButton } from '../../components/care-companion/CompanionBackButton';

import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { CompanionBottomNav } from '../../components/care-companion/CompanionBottomNav';
import { useNavigationStack } from '@/contexts/NavigationStackContext';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';

const DEEP_ORANGE = '#FE6700';
const LIGHT_BEIGE = '#FAF3EB';
const GRAY_BG = '#F9FAFB';
const MAX_CONTENT_WIDTH = 398;
const BASE_HORIZONTAL_PADDING = 16;

export default function HistoryScreen() {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const { push, replace, pop } = useNavigationStack();
    useAndroidBackHandler();

    const handleSafeBack = () => {
        if (router.canGoBack()) {
            pop();
        } else {
            replace('/(care-companion)');
        }
    };

    const [loading, setLoading] = useState(true);
    const [historyData, setHistoryData] = useState<any>(null);
    const [filterOpen, setFilterOpen] = useState(false);

    const [selDate, setSelDate] = useState<string[]>([]);
    const [selMood, setSelMood] = useState<string[]>([]);
    const [selHasVitals, setSelHasVitals] = useState<string[]>([]);
    const [selFollowUp, setSelFollowUp] = useState<string[]>([]);
    const [selStatus, setSelStatus] = useState<string[]>([]);

    const DATE_FILTERS = [
        { key: 'today', label: 'Today' },
        { key: 'this_week', label: 'This Week' },
        { key: 'this_month', label: 'This Month' },
    ];

    const STATUS_FILTERS = [
        { key: 'completed', label: 'Completed' },
        { key: 'missed', label: 'Missed' },
        { key: 'cancelled', label: 'Cancelled' },
    ];

    const MOOD_FILTERS = [
        { key: 'Happy', label: 'Happy' },
        { key: 'Neutral', label: 'Neutral' },
        { key: 'Sad', label: 'Sad' },
        { key: 'Anxious', label: 'Anxious' },
        { key: 'Depressed', label: 'Depressed' },
    ];

    let [fontsLoaded] = useFonts({
        Poppins_400Regular,
        Poppins_500Medium,
        Poppins_600SemiBold,
        Poppins_700Bold,
    });

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const token = await AsyncStorage.getItem('userToken');
                if (!token) {
                    replace('/(auth)');
                    return;
                }

                const response = await fetch(`${API_URL}/care-companion/visits/history`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });

                const resJson = await response.json();

                if (resJson.success && resJson.data) {
                    setHistoryData(resJson.data);
                } else {
                    setFallbackData();
                }
            } catch (err) {
                console.error('Error fetching history', err);
                setFallbackData();
            } finally {
                setLoading(false);
            }
        };

        if (fontsLoaded) {
            fetchHistory();
        }
    }, [fontsLoaded]);

    const setFallbackData = () => {
        setHistoryData({
            stats: { totalVisits: '0', totalHours: '0', avgHours: '0' },
            visits: [],
        });
    };

    const toggleExpand = (id: string) => {
        setHistoryData((prev: any) => ({
            ...prev,
            visits: prev.visits.map((v: any) => (v.id === id ? { ...v, isExpanded: !v.isExpanded } : v)),
        }));
    };

    const toggleFilter = <T extends string>(val: T, setter: React.Dispatch<React.SetStateAction<T[]>>) => {
        setter(prev => (prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]));
    };

    const clearAllFilters = () => {
        setSelDate([]);
        setSelMood([]);
        setSelHasVitals([]);
        setSelFollowUp([]);
        setSelStatus([]);
    };

    const activeFilterCount = selDate.length + selMood.length + selHasVitals.length + selFollowUp.length + selStatus.length;
    const isCompact = width < 360;
    const contentWidth = Math.min(Math.max(width - BASE_HORIZONTAL_PADDING * 2, 0), MAX_CONTENT_WIDTH);

    const responsiveContentStyle = {
        width: contentWidth,
        alignSelf: 'center' as const,
    };

    const responsiveHeaderInnerStyle = {
        width: contentWidth,
        alignSelf: 'center' as const,
    };

    const dateMatchesFilter = (rawDate: string, key: string) => {
        const d = new Date(rawDate);
        const now = new Date();

        if (key === 'today') return d.toDateString() === now.toDateString();

        if (key === 'this_week') {
            const start = new Date(now);
            start.setDate(now.getDate() - now.getDay());
            start.setHours(0, 0, 0, 0);
            return d >= start;
        }

        if (key === 'this_month') {
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }

        return true;
    };

    const filteredVisits = useMemo(() => {
        if (!historyData || !historyData.visits) return [];

        return historyData.visits.filter((v: any) => {
            if (selDate.length > 0 && !selDate.some(d => dateMatchesFilter(v.rawDate || v.date, d))) return false;
            if (selMood.length > 0) {
                const visitMood = (v.details?.mood || v.mood || '').toLowerCase();
                const matchesMood = selMood.some(m => m.toLowerCase() === visitMood);
                if (!matchesMood) return false;
            }
            if (selHasVitals.length > 0) {
                const hasVitals = v.details?.vitals && v.details.vitals.some((vt: any) => vt.value && vt.value !== 'N/A');
                if (!hasVitals) return false;
            }
            if (selFollowUp.length > 0 && !v.followUpRequired) return false;
            if (selStatus.length > 0 && !selStatus.some(s => s.toLowerCase() === (v.status || '').toLowerCase())) return false;
            return true;
        });
    }, [historyData, selDate, selMood, selHasVitals, selFollowUp, selStatus]);

    if (!fontsLoaded || loading || !historyData) {
        return (
            <View style={[styles.container, styles.centered]}>
                <ActivityIndicator size="large" color={DEEP_ORANGE} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <Stack.Screen options={{ headerShown: false }} />

            <ScrollView bounces={false} contentContainerStyle={styles.scrollContent}>
                <View style={styles.deepOrangeHeader}>
                    <View style={[styles.headerTitleRow, responsiveHeaderInnerStyle]}>
                        <CompanionBackButton style={styles.backBtn} />

                        <View style={styles.headerTextBlock}>
                            <Text style={styles.headerTitle}>Visit History</Text>
                            <Text style={styles.headerSub}>Track your completed visits</Text>
                        </View>

                        <TouchableOpacity style={styles.filterBtn} onPress={() => setFilterOpen(true)}>
                            <Ionicons name="funnel-outline" size={24} color="#FFFFFF" />
                            {activeFilterCount > 0 && (
                                <View style={styles.filterBadge}>
                                    <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>

                    {activeFilterCount > 0 && (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={[styles.activeFiltersScroll, responsiveHeaderInnerStyle]}
                        >
                            {selDate.map(d => {
                                const f = DATE_FILTERS.find(df => df.key === d);
                                return (
                                    <TouchableOpacity key={d} style={styles.activeChip} onPress={() => setSelDate(prev => prev.filter(v => v !== d))}>
                                        <Text style={styles.activeChipText}>{f?.label} x</Text>
                                    </TouchableOpacity>
                                );
                            })}

                            {selStatus.map(s => {
                                const f = STATUS_FILTERS.find(sf => sf.key === s);
                                return (
                                    <TouchableOpacity key={s} style={styles.activeChip} onPress={() => setSelStatus(prev => prev.filter(v => v !== s))}>
                                        <Text style={styles.activeChipText}>{f?.label || s} x</Text>
                                    </TouchableOpacity>
                                );
                            })}

                            {selMood.map(m => (
                                <TouchableOpacity key={m} style={styles.activeChip} onPress={() => setSelMood(prev => prev.filter(v => v !== m))}>
                                    <Text style={styles.activeChipText}>{m} x</Text>
                                </TouchableOpacity>
                            ))}

                            {selHasVitals.length > 0 && (
                                <TouchableOpacity style={styles.activeChip} onPress={() => setSelHasVitals([])}>
                                    <Text style={styles.activeChipText}>Has Vitals x</Text>
                                </TouchableOpacity>
                            )}

                            {selFollowUp.length > 0 && (
                                <TouchableOpacity style={styles.activeChip} onPress={() => setSelFollowUp([])}>
                                    <Text style={styles.activeChipText}>Follow-Up x</Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity style={[styles.activeChip, styles.clearChip]} onPress={clearAllFilters}>
                                <Text style={styles.activeChipText}>Clear all</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    )}
                </View>

                <View style={[styles.contentArea, responsiveContentStyle]}>
                    <View style={styles.statsRow}>
                        <View style={styles.statBox}>
                            <View style={[styles.iconCircle, { backgroundColor: '#EFF6FF' }]}>
                                <Ionicons name="calendar-outline" size={20} color="#3B82F6" />
                            </View>
                            <Text style={[styles.statNumber, { color: '#3B82F6' }]}>{historyData.stats.totalVisits}</Text>
                            <Text style={styles.statLabel}>Total Visits</Text>
                        </View>

                        <View style={styles.statBox}>
                            <View style={[styles.iconCircle, { backgroundColor: '#ECFDF5' }]}>
                                <Ionicons name="time-outline" size={20} color="#10B981" />
                            </View>
                            <Text style={[styles.statNumber, { color: '#10B981' }]}>{historyData.stats.totalHours}</Text>
                            <Text style={styles.statLabel}>Total Hours</Text>
                        </View>

                        <View style={styles.statBox}>
                            <View style={[styles.iconCircle, { backgroundColor: '#FAF5FF' }]}>
                                <Ionicons name="trending-up" size={20} color="#A855F7" />
                            </View>
                            <Text style={[styles.statNumber, { color: '#A855F7' }]}>{historyData.stats.avgHours}</Text>
                            <Text style={styles.statLabel}>Avg Hours</Text>
                        </View>
                    </View>

                    <View style={styles.mainListContainer}>
                        <Text style={styles.sectionTitle}>Recent Visits</Text>

                        {activeFilterCount > 0 && (
                            <Text style={styles.resultsCount}>
                                Showing {filteredVisits.length} of {historyData.visits.length} visits
                            </Text>
                        )}

                        {filteredVisits.map((visit: any) => (
                            <TouchableOpacity
                                key={visit.id}
                                style={styles.visitCard}
                                onPress={() => toggleExpand(visit.id)}
                                activeOpacity={0.8}
                            >
                                <View style={styles.cardHeader}>
                                    <View style={styles.cardTitleBlock}>
                                        <Text style={styles.patientName}>{visit.patientName}</Text>
                                        {visit.visitCode ? (
                                            <Text style={styles.visitCodeText}>Visit ID: {visit.visitCode}</Text>
                                        ) : null}
                                    </View>

                                    <View style={[
                                        styles.completedBadge,
                                        visit.status === 'missed' && { backgroundColor: '#6B7280' },
                                        visit.status === 'cancelled' && { backgroundColor: '#EF4444' }
                                    ]}>
                                        <Text style={styles.completedText}>
                                            {visit.status === 'missed' ? 'Missed' : visit.status === 'cancelled' ? 'Cancelled' : 'Completed'}
                                        </Text>
                                    </View>
                                </View>

                                <Text style={styles.addressText}>{visit.address}</Text>

                                <View style={styles.metaRow}>
                                    <View style={styles.metaItem}>
                                        <Ionicons name="calendar-outline" size={16} color="#4B5563" />
                                        <Text style={styles.metaText}>{visit.date}</Text>
                                    </View>

                                    <View style={styles.metaItem}>
                                        <Ionicons name="time-outline" size={16} color="#4B5563" />
                                        <Text style={styles.metaText}>{visit.duration}</Text>
                                    </View>
                                </View>

                                <View style={styles.tagsRow}>
                                    {visit.tags.map((tag: string, index: number) => (
                                        <View key={index} style={styles.tagBadge}>
                                            <Text style={styles.tagText}>{tag}</Text>
                                        </View>
                                    ))}
                                </View>

                                {visit.isExpanded && visit.details && (
                                    <View style={styles.expandedSection}>
                                        <View style={styles.detailBlock}>
                                            <View style={styles.detailHeader}>
                                                <Ionicons name="pulse" size={18} color="#EF4444" />
                                                <Text style={styles.detailTitle}>Vitals</Text>
                                            </View>

                                            <View style={styles.vitalsGrid}>
                                                {Array.isArray(visit.details.vitals) ? (
                                                    visit.details.vitals.map((vit: any, idx: number) => (
                                                        <View key={idx} style={[styles.vitalBox, isCompact && styles.vitalBoxCompact]}>
                                                            <Text style={styles.vitalLabel}>{vit.name}</Text>
                                                            <Text style={styles.vitalValue}>{vit.value}</Text>
                                                        </View>
                                                    ))
                                                ) : (
                                                    <>
                                                        <View style={[styles.vitalBox, isCompact && styles.vitalBoxCompact]}>
                                                            <Text style={styles.vitalLabel}>Blood Pressure</Text>
                                                            <Text style={styles.vitalValue}>{visit.details.vitals?.bp || 'N/A'}</Text>
                                                        </View>

                                                        <View style={[styles.vitalBox, isCompact && styles.vitalBoxCompact]}>
                                                            <Text style={styles.vitalLabel}>Weight</Text>
                                                            <Text style={styles.vitalValue}>{visit.details.vitals?.weight || 'N/A'}</Text>
                                                        </View>

                                                        <View style={[styles.vitalBox, isCompact && styles.vitalBoxCompact]}>
                                                            <Text style={styles.vitalLabel}>Temperature</Text>
                                                            <Text style={styles.vitalValue}>{visit.details.vitals?.temp || 'N/A'}</Text>
                                                        </View>

                                                        <View style={[styles.vitalBox, isCompact && styles.vitalBoxCompact]}>
                                                            <Text style={styles.vitalLabel}>O2 Level</Text>
                                                            <Text style={styles.vitalValue}>{visit.details.vitals?.o2 || 'N/A'}</Text>
                                                        </View>
                                                    </>
                                                )}
                                            </View>
                                        </View>

                                        <View style={styles.detailBlock}>
                                            <View style={styles.detailHeader}>
                                                <Ionicons name="medkit-outline" size={18} color="#A855F7" />
                                                <Text style={styles.detailTitle}>Medications Taken</Text>
                                            </View>

                                            <View style={styles.tagsRow}>
                                                {visit.details.meds.map((med: string, index: number) => (
                                                    <View key={index} style={styles.tagBadge}>
                                                        <Text style={styles.tagText}>{med}</Text>
                                                    </View>
                                                ))}
                                            </View>
                                        </View>

                                        <View style={styles.detailBlock}>
                                            <Text style={styles.detailTitleNoIcon}>Mood</Text>
                                            <View style={styles.moodBadge}>
                                                <Text style={styles.moodText}>
                                                    {visit.details.mood ? (visit.details.mood.charAt(0).toUpperCase() + visit.details.mood.slice(1).toLowerCase()) : 'N/A'}
                                                </Text>
                                            </View>
                                        </View>

                                        <View style={styles.detailBlock}>
                                            <View style={styles.detailHeader}>
                                                <Ionicons name="document-text-outline" size={18} color="#3B82F6" />
                                                <Text style={styles.detailTitle}>Notes</Text>
                                            </View>

                                            <View style={styles.notesBox}>
                                                <Text style={styles.notesText}>{visit.details.notes}</Text>
                                            </View>
                                        </View>

                                        {visit.rawDate && Date.now() - new Date(visit.rawDate).getTime() <= 24 * 60 * 60 * 1000 && (
                                            <TouchableOpacity
                                                style={styles.editBtn}
                                                onPress={() => push({ pathname: '/(care-companion)/visit-details', params: { visitId: visit.id, editMode: 'true' } } as any)}
                                            >
                                                <Ionicons name="pencil" size={16} color="#FFFFFF" style={styles.editIcon} />
                                                <Text style={styles.editBtnText}>Edit Visit Details</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={styles.bottomSpacer} />
                </View>
            </ScrollView>

            <CompanionBottomNav />

            <Modal visible={filterOpen} transparent animationType="slide" onRequestClose={() => setFilterOpen(false)}>
                <Pressable style={styles.modalOverlay} onPress={() => setFilterOpen(false)}>
                    <Pressable style={styles.filterSheet} onPress={e => e.stopPropagation()}>
                        <View style={styles.sheetHandle} />

                        <View style={styles.sheetHeader}>
                            <Text style={styles.sheetTitle}>Filter History</Text>
                            <TouchableOpacity onPress={clearAllFilters}>
                                <Text style={styles.clearAllText}>Clear All</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
                            <Text style={styles.filterGroupLabel}>Date Range</Text>
                            <View style={styles.chipRow}>
                                {DATE_FILTERS.map(f => {
                                    const active = selDate.includes(f.key);
                                    return (
                                        <TouchableOpacity
                                            key={f.key}
                                            style={[styles.chip, active && styles.chipActive]}
                                            onPress={() => toggleFilter(f.key, setSelDate)}
                                        >
                                            {active && <Ionicons name="checkmark" size={13} color={DEEP_ORANGE} style={styles.chipIcon} />}
                                            <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <Text style={styles.filterGroupLabel}>Visit Status</Text>
                            <View style={styles.chipRow}>
                                {STATUS_FILTERS.map(f => {
                                    const active = selStatus.includes(f.key);
                                    return (
                                        <TouchableOpacity
                                            key={f.key}
                                            style={[styles.chip, active && styles.chipActive]}
                                            onPress={() => toggleFilter(f.key, setSelStatus)}
                                        >
                                            {active && <Ionicons name="checkmark" size={13} color={DEEP_ORANGE} style={styles.chipIcon} />}
                                            <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <Text style={styles.filterGroupLabel}>Patient Mood</Text>
                            <View style={styles.chipRow}>
                                {MOOD_FILTERS.map(f => {
                                    const active = selMood.includes(f.key);
                                    return (
                                        <TouchableOpacity
                                            key={f.key}
                                            style={[styles.chip, active && styles.chipActive]}
                                            onPress={() => toggleFilter(f.key, setSelMood)}
                                        >
                                            {active && <Ionicons name="checkmark" size={13} color={DEEP_ORANGE} style={styles.chipIcon} />}
                                            <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <Text style={styles.filterGroupLabel}>Other</Text>
                            <View style={styles.chipRow}>
                                <TouchableOpacity
                                    style={[styles.chip, selHasVitals.length > 0 && styles.chipActive]}
                                    onPress={() => setSelHasVitals(prev => (prev.length > 0 ? [] : ['yes']))}
                                >
                                    {selHasVitals.length > 0 && <Ionicons name="checkmark" size={13} color={DEEP_ORANGE} style={styles.chipIcon} />}
                                    <Text style={[styles.chipText, selHasVitals.length > 0 && styles.chipTextActive]}>Has Vitals</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.chip, selFollowUp.length > 0 && styles.chipActive]}
                                    onPress={() => setSelFollowUp(prev => (prev.length > 0 ? [] : ['yes']))}
                                >
                                    {selFollowUp.length > 0 && <Ionicons name="checkmark" size={13} color={DEEP_ORANGE} style={styles.chipIcon} />}
                                    <Text style={[styles.chipText, selFollowUp.length > 0 && styles.chipTextActive]}>Follow-Up Required</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>

                        <TouchableOpacity style={styles.applyBtn} onPress={() => setFilterOpen(false)}>
                            <Text style={styles.applyBtnText}>
                                Show {filteredVisits.length} Visit{filteredVisits.length !== 1 ? 's' : ''}
                            </Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: LIGHT_BEIGE,
    },
    centered: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        flexGrow: 1,
    },
    deepOrangeHeader: {
        backgroundColor: DEEP_ORANGE,
        height: 80,
        paddingHorizontal: BASE_HORIZONTAL_PADDING,
        paddingTop: Platform.OS === 'ios' ? 10 : 16,
        paddingBottom: 16,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 15,
        elevation: 4,
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 48,
    },
    headerTextBlock: {
        flex: 1,
        minWidth: 0,
    },
    backBtn: {
        marginRight: 12,
    },
    headerTitle: {
        fontFamily: 'Poppins_600SemiBold',
        color: '#FFFFFF',
        fontSize: 20,
        lineHeight: 28,
    },
    headerSub: {
        fontFamily: 'Poppins_400Regular',
        color: '#DBEAFE',
        fontSize: 14,
        lineHeight: 20,
    },
    filterBtn: {
        width: 36,
        height: 36,
        alignItems: 'flex-end',
        justifyContent: 'center',
        position: 'relative',
        flexShrink: 0,
    },
    filterBadge: {
        position: 'absolute',
        top: 0,
        right: -2,
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        width: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    filterBadgeText: {
        fontSize: 10,
        fontFamily: 'Poppins_700Bold',
        color: DEEP_ORANGE,
    },
    activeFiltersScroll: {
        marginTop: 10,
    },
    activeChip: {
        backgroundColor: 'rgba(255,255,255,0.25)',
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 5,
        marginRight: 8,
        flexDirection: 'row',
        alignItems: 'center',
    },
    clearChip: {
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    activeChipText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontFamily: 'Poppins_500Medium',
    },
    contentArea: {
        paddingHorizontal: 0,
        paddingTop: 19,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 0,
        marginBottom: 16,
    },
    statBox: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        paddingVertical: 16,
        paddingHorizontal: 8,
        alignItems: 'center',
        flex: 1,
        minHeight: 140,
        shadowColor: DEEP_ORANGE,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 4,
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    statNumber: {
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 24,
        lineHeight: 32,
        marginBottom: 2,
    },
    statLabel: {
        fontFamily: 'Poppins_400Regular',
        fontSize: 12,
        lineHeight: 16,
        color: '#333333',
        textAlign: 'center',
    },
    mainListContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    sectionTitle: {
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 18,
        lineHeight: 28,
        color: '#0A0A0A',
        marginBottom: 24,
    },
    resultsCount: {
        fontFamily: 'Poppins_400Regular',
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 8,
    },
    visitCard: {
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
        backgroundColor: GRAY_BG,
        borderRadius: 10,
        padding: 16,
        marginBottom: 16,
        minHeight: 152,
        overflow: 'hidden',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 12,
        marginBottom: 4,
    },
    cardTitleBlock: {
        flex: 1,
        minWidth: 0,
    },
    patientName: {
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 18,
        lineHeight: 27,
        color: '#000000',
        flexShrink: 1,
    },
    visitCodeText: {
        fontFamily: 'Poppins_500Medium',
        fontSize: 13,
        color: DEEP_ORANGE,
        marginTop: 2,
    },
    completedBadge: {
        backgroundColor: '#16A34A',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 8,
        flexShrink: 0,
    },
    completedText: {
        color: '#FFFFFF',
        fontSize: 12,
        lineHeight: 16,
        fontFamily: 'Poppins_400Regular',
    },
    addressText: {
        fontFamily: 'Poppins_400Regular',
        color: '#4B5563',
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 12,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        rowGap: 8,
        marginBottom: 12,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 16,
    },
    metaText: {
        fontFamily: 'Poppins_400Regular',
        color: '#333333',
        marginLeft: 6,
        fontSize: 14,
        lineHeight: 20,
    },
    tagsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    tagBadge: {
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 3,
        marginRight: 8,
        marginBottom: 8,
        backgroundColor: '#FFFFFF',
    },
    tagText: {
        color: '#333333',
        fontSize: 12,
        lineHeight: 16,
        fontFamily: 'Poppins_400Regular',
    },
    expandedSection: {
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.1)',
        paddingTop: 16,
        marginTop: 8,
    },
    detailBlock: {
        marginBottom: 16,
    },
    detailHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    detailTitle: {
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 14,
        color: '#111827',
        marginLeft: 8,
    },
    detailTitleNoIcon: {
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 14,
        color: '#111827',
        marginBottom: 8,
    },
    vitalsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    vitalBox: {
        width: '48%',
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        padding: 12,
        marginBottom: 10,
    },
    vitalBoxCompact: {
        width: '100%',
    },
    vitalLabel: {
        fontFamily: 'Poppins_400Regular',
        fontSize: 12,
        color: '#4B5563',
        marginBottom: 4,
    },
    vitalValue: {
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 15,
        color: '#111827',
    },
    moodBadge: {
        backgroundColor: '#10B981',
        alignSelf: 'flex-start',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 16,
    },
    moodText: {
        color: '#FFFFFF',
        fontFamily: 'Poppins_500Medium',
        fontSize: 12,
    },
    notesBox: {
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        padding: 16,
    },
    notesText: {
        fontFamily: 'Poppins_400Regular',
        fontSize: 14,
        color: '#374151',
        lineHeight: 22,
    },
    editBtn: {
        backgroundColor: DEEP_ORANGE,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        marginTop: 16,
    },
    editIcon: {
        marginRight: 6,
    },
    editBtnText: {
        color: '#FFFFFF',
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 14,
    },
    bottomSpacer: {
        height: 100,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'flex-end',
    },
    filterSheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        width: '100%',
        maxWidth: MAX_CONTENT_WIDTH,
        alignSelf: 'center',
        paddingHorizontal: 20,
        paddingBottom: 36,
        paddingTop: 12,
    },
    sheetHandle: {
        width: 40,
        height: 4,
        backgroundColor: '#E5E7EB',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 16,
    },
    sheetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    sheetTitle: {
        fontFamily: 'Poppins_700Bold',
        fontSize: 18,
        color: '#111827',
    },
    clearAllText: {
        fontFamily: 'Poppins_500Medium',
        fontSize: 14,
        color: DEEP_ORANGE,
    },
    sheetScroll: {
        maxHeight: 420,
    },
    filterGroupLabel: {
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 13,
        color: '#374151',
        marginBottom: 10,
        marginTop: 4,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 18,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#E5E7EB',
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: '#F9FAFB',
    },
    chipActive: {
        borderColor: DEEP_ORANGE,
        backgroundColor: '#FFF7ED',
    },
    chipIcon: {
        marginRight: 4,
    },
    chipText: {
        fontFamily: 'Poppins_500Medium',
        fontSize: 13,
        color: '#6B7280',
    },
    chipTextActive: {
        color: DEEP_ORANGE,
        fontFamily: 'Poppins_600SemiBold',
    },
    applyBtn: {
        backgroundColor: DEEP_ORANGE,
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 8,
        shadowColor: DEEP_ORANGE,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    applyBtnText: {
        color: '#FFFFFF',
        fontFamily: 'Poppins_700Bold',
        fontSize: 15,
    },
});
