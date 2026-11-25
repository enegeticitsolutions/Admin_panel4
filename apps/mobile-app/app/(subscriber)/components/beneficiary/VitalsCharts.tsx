import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform, ScrollView } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

interface DataPoint {
    date: string;
    fullDate: string;
    value: number;
    source?: 'care_companion' | 'beneficiary'; // who recorded this reading
    recorder?: string; // display name (e.g. "Priya S." or "Self")
}

export interface VitalTrend {
    name: string;
    code: string;
    unit: string;
    dataType: string;
    gridMax: number;
    gridValues: number[];
    color: string;
    v1: DataPoint[];
    v2?: DataPoint[];
}

// Source colours
const CC_DOT_FILL = '#FFFFFF';       // white fill — CC readings
const SELF_DOT_FILL = '#DBEAFE';     // light-blue fill — self-reported readings
const SELF_DOT_BORDER = '#3B82F6';   // blue border — self-reported

export interface VitalsChartsProps {
    trends: VitalTrend[];
    showHeader?: boolean;
    title?: string;
}

export const VitalsCharts = ({ trends, showHeader = true, title }: VitalsChartsProps) => {
    const [chartWidth, setChartWidth] = useState(screenWidth - 40 - 45); // fallback default
    const chartHeight = 120;

    if (!trends || trends.length === 0) {
        return (
            <View style={styles.empty}>
                <Text style={styles.emptyText}>Not enough data for vitals trends.</Text>
            </View>
        );
    }

    // Helper to render segment line between two points
    const renderLineSegment = (
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        color: string,
        key: string
    ) => {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);

        return (
            <View
                key={key}
                style={{
                    position: 'absolute',
                    left: x1,
                    top: y1,
                    width: distance,
                    height: 2,
                    backgroundColor: color,
                    transform: [
                        { translateX: dx / 2 - distance / 2 },
                        { translateY: dy / 2 },
                        { rotate: `${angle}rad` },
                    ],
                }}
            />
        );
    };

    const renderChart = (
        vital: VitalTrend
    ) => {
        const hasV1 = vital.v1 && vital.v1.length > 0;
        const hasV2 = vital.v2 && vital.v2.length > 0;
        
        if (!hasV1 && !hasV2) return null;

        // Use v1 or v2 to extract common labels depending on what's available
        const labels = hasV1 ? vital.v1.map(p => p.date) : (hasV2 ? vital.v2!.map(p => p.date) : []);
        const gridValues = [...vital.gridValues].reverse(); // high to low for display

        const POINT_SPACING = 52;
        const HORIZONTAL_PAD = 20;
        const effectivePlotWidth = Math.max(
            chartWidth,
            labels.length <= 1
                ? chartWidth
                : (labels.length - 1) * POINT_SPACING + HORIZONTAL_PAD * 2
        );
        const needsScroll = effectivePlotWidth > chartWidth + 1;

        const getPointX = (index: number, count: number) => {
            if (count <= 1) return effectivePlotWidth / 2;
            return HORIZONTAL_PAD + (index / (count - 1)) * (effectivePlotWidth - HORIZONTAL_PAD * 2);
        };

        // Check if any reading in this chart has a self-reported entry
        const allPoints = [...(vital.v1 || []), ...(vital.v2 || [])];
        const hasSelfReported = allPoints.some(p => p.source === 'beneficiary');

        const renderPoints = (data: DataPoint[], lineColor: string) => {
            const points = data
                .map((pt, i) => {
                    const val = pt.value;
                    const x = getPointX(i, data.length);
                    const y = chartHeight - (Math.min(val, vital.gridMax) / vital.gridMax) * chartHeight;
                    return { x, y, val, source: pt.source ?? 'care_companion' };
                });

            const dotSize = 8;

            return (
                <React.Fragment key={lineColor}>
                    {/* Connecting Line Segments */}
                    {points.map((p, i) => {
                        if (i === points.length - 1) return null;
                        const next = points[i + 1];
                        return renderLineSegment(p.x, p.y, next.x, next.y, lineColor, `line-${lineColor}-${i}`);
                    })}

                    {/* Data Point Dots — different fill/border based on source */}
                    {points.map((p, i) => {
                        const isSelf = p.source === 'beneficiary';
                        return (
                            <View
                                key={`dot-${lineColor}-${i}`}
                                style={[
                                    styles.dot,
                                    {
                                        left: p.x - dotSize / 2,
                                        top: p.y - dotSize / 2,
                                        width: dotSize,
                                        height: dotSize,
                                        borderRadius: dotSize / 2,
                                        borderColor: isSelf ? SELF_DOT_BORDER : lineColor,
                                        backgroundColor: isSelf ? SELF_DOT_FILL : CC_DOT_FILL,
                                        borderWidth: isSelf ? 2.5 : 2,
                                    }
                                ]}
                            />
                        );
                    })}
                </React.Fragment>
            );
        };

        return (
            <View key={vital.code} style={styles.chartWrap}>
                <Text style={styles.chartTitle}>{vital.name} {vital.unit ? `(${vital.unit})` : ''}</Text>
                
                <View style={styles.chartRow}>
                    {/* Fixed Y-Axis Labels */}
                    <View style={styles.yAxis}>
                        {gridValues.map((val, idx) => (
                            <Text key={idx} style={styles.axisText}>
                                {val}
                            </Text>
                        ))}
                    </View>

                    {/* Horizontally Scrollable Plot + X-Axis Labels */}
                    <View
                        style={styles.scrollViewport}
                        onLayout={(e) => {
                            const { width } = e.nativeEvent.layout;
                            if (width > 0) setChartWidth(width);
                        }}
                    >
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={needsScroll}
                            bounces={false}
                            contentContainerStyle={{ width: effectivePlotWidth }}
                        >
                            <View style={{ width: effectivePlotWidth }}>
                                <View style={[styles.plotArea, { width: effectivePlotWidth }]}>
                                    {/* Dotted Grid Lines */}
                                    {gridValues.map((_, idx) => {
                                        const topPercent = (idx / (gridValues.length - 1)) * 100;
                                        return (
                                            <View
                                                key={idx}
                                                style={[
                                                    styles.gridLine,
                                                    { top: `${topPercent}%` }
                                                ]}
                                            />
                                        );
                                    })}

                                    {hasV1 && renderPoints(vital.v1, vital.color)}
                                    {hasV2 && renderPoints(vital.v2!, '#6B7280')}
                                </View>

                                {/* X-Axis Labels aligned to points */}
                                <View style={[styles.xAxisLabels, { width: effectivePlotWidth }]}>
                                    {labels.map((label, idx) => {
                                        const x = getPointX(idx, labels.length);
                                        return (
                                            <Text
                                                key={idx}
                                                style={[
                                                    styles.axisText,
                                                    styles.xAxisLabelItem,
                                                    { left: x - 24 },
                                                ]}
                                                numberOfLines={1}
                                            >
                                                {label}
                                            </Text>
                                        );
                                    })}
                                </View>
                            </View>
                        </ScrollView>
                    </View>
                </View>

                {/* Source Legend — only show when there are self-reported readings */}
                {hasSelfReported && (
                    <View style={styles.sourceLegend}>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: CC_DOT_FILL, borderColor: vital.color }]} />
                            <Text style={styles.legendText}>Care Companion</Text>
                        </View>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: SELF_DOT_FILL, borderColor: SELF_DOT_BORDER }]} />
                            <Text style={styles.legendText}>Self-reported</Text>
                        </View>
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={showHeader ? styles.container : undefined}>
            {showHeader && (
                <View style={styles.header}>
                    <View style={styles.trendIconContainer}>
                        <Text style={{ fontSize: 16 }}>📈</Text>
                    </View>
                    <Text style={styles.title}>{title || 'Vitals Trends'}</Text>
                </View>
            )}

            {trends.map(vital => renderChart(vital))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { paddingHorizontal: 20, marginBottom: 20 },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
    trendIconContainer: { marginRight: 8 },
    title: { fontSize: 16, fontWeight: '700', color: '#111827' },
    
    chartWrap: { 
        backgroundColor: '#FFF', 
        borderRadius: 16, 
        padding: 16, 
        marginBottom: 16,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6 },
            android: { elevation: 1 },
        }),
    },
    chartTitle: { fontSize: 13, fontWeight: '700', color: '#1F2937', marginBottom: 18 },
    
    chartRow: { flexDirection: 'row', minHeight: 152 },
    yAxis: { 
        width: 30, 
        justifyContent: 'space-between', 
        alignItems: 'flex-end', 
        paddingRight: 8,
        height: 120 
    },
    axisText: { fontSize: 10, color: '#9CA3AF', fontWeight: '500' },

    scrollViewport: {
        flex: 1,
        overflow: 'hidden',
    },
    plotArea: { 
        height: 120, 
        position: 'relative' 
    },
    gridLine: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: 1,
        borderWidth: 0.5,
        borderColor: '#E5E7EB',
        borderStyle: 'dashed',
    },
    
    dot: {
        position: 'absolute',
        borderWidth: 2,
        zIndex: 10,
    },
    
    xAxisLabels: { 
        height: 22,
        marginTop: 8,
        position: 'relative',
    },
    xAxisLabelItem: {
        position: 'absolute',
        width: 48,
        textAlign: 'center',
    },

    // Source legend
    sourceLegend: {
        flexDirection: 'row',
        gap: 16,
        marginTop: 10,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot: { width: 8, height: 8, borderRadius: 4, borderWidth: 2 },
    legendText: { fontSize: 11, color: '#6B7280', fontWeight: '500' },
    
    empty: { padding: 40, alignItems: 'center' },
    emptyText: { color: '#9CA3AF', fontSize: 14 },
});

export default VitalsCharts;
