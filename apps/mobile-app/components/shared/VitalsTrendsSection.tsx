import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { VitalsCharts, VitalTrend } from '@/app/(subscriber)/components/beneficiary/VitalsCharts';

export type ReadingFilterCount = 7 | 15 | 30;

interface VitalsTrendsSectionProps {
    trends: VitalTrend[];
    defaultLimit?: ReadingFilterCount;
    emptyMessage?: string;
}

const FILTER_OPTIONS: ReadingFilterCount[] = [7, 15, 30];

/**
 * Reusable Vitals Trends & Graphs section with Last 7 / 15 / 30 readings filter.
 * Recalculates gridMax and gridValues dynamically for the selected reading window.
 */
export const VitalsTrendsSection: React.FC<VitalsTrendsSectionProps> = ({
    trends,
    defaultLimit = 7,
    emptyMessage = 'Not enough data to display trends.',
}) => {
    const [readingLimit, setReadingLimit] = useState<ReadingFilterCount>(defaultLimit);

    const filteredTrends = useMemo<VitalTrend[]>(() => {
        if (!trends || trends.length === 0) return [];

        return trends
            .map<VitalTrend | null>((t) => {
                const v1 = (t.v1 || []).slice(-readingLimit);
                const v2 = t.v2 ? t.v2.slice(-readingLimit) : undefined;

                if (v1.length === 0 && (!v2 || v2.length === 0)) {
                    return null;
                }

                let maxVal = 0;
                [...v1, ...(v2 || [])].forEach((pt) => {
                    if (pt.value > maxVal) maxVal = pt.value;
                });

                const rawMax = maxVal > 0 ? Math.ceil(maxVal * 1.2) : (t.gridMax || 200);
                const step = Math.max(1, Math.ceil(rawMax / 4));
                const gridValues = [0, step, step * 2, step * 3, step * 4];

                return {
                    ...t,
                    v1,
                    v2,
                    gridValues,
                    gridMax: gridValues[4],
                };
            })
            .filter((t): t is VitalTrend => t !== null);
    }, [trends, readingLimit]);

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.sectionTitle}>Vitals Trends & Graphs</Text>
                    <Text style={styles.sectionSub}>
                        Plotting last {readingLimit} readings per vital parameter
                    </Text>
                </View>
                <View style={styles.badge}>
                    <Feather name="sliders" size={12} color="#FE6700" style={{ marginRight: 4 }} />
                    <Text style={styles.badgeText}>Last {readingLimit}</Text>
                </View>
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
            >
                {FILTER_OPTIONS.map((count) => {
                    const active = readingLimit === count;
                    return (
                        <TouchableOpacity
                            key={`vitals-filter-${count}`}
                            style={[styles.filterChip, active && styles.filterChipActive]}
                            onPress={() => setReadingLimit(count)}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                                Last {count} readings
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {filteredTrends.length === 0 ? (
                <View style={styles.emptyCard}>
                    <Text style={styles.emptyText}>{emptyMessage}</Text>
                </View>
            ) : (
                <View style={styles.chartsWrap}>
                    <VitalsCharts trends={filteredTrends} showHeader={false} />
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: 16,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
        gap: 10,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    sectionSub: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF7ED',
        borderWidth: 1,
        borderColor: '#FED7AA',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#EA580C',
    },
    filterRow: {
        flexDirection: 'row',
        gap: 8,
        paddingBottom: 12,
    },
    filterChip: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 8,
    },
    filterChipActive: {
        backgroundColor: '#FE6700',
        borderColor: '#FE6700',
    },
    filterChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#4B5563',
    },
    filterChipTextActive: {
        color: '#FFFFFF',
    },
    chartsWrap: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    emptyCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    emptyText: {
        fontSize: 13,
        color: '#9CA3AF',
    },
});
