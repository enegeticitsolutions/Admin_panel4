import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface AdherenceSummaryCardProps {
  percentage: number;
  completedDaysText?: string;
}

export function AdherenceSummaryCard({
  percentage = 92,
  completedDaysText = '6 of 7 days completed on time',
}: AdherenceSummaryCardProps) {
  const clampedPercent = Math.min(100, Math.max(0, percentage));

  return (
    <View style={styles.card}>
      {/* Header: Label, Percentage & Pulse Waveform Icon */}
      <View style={styles.headerRow}>
        <View style={styles.titleColumn}>
          <Text style={styles.titleText}>7-day adherence</Text>
          <Text style={styles.percentageText}>{clampedPercent}%</Text>
        </View>

        <View style={styles.pulseBox}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path
              d="M3 12h4l3 8 4-16 3 8h4"
              stroke="#6DDBAA"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${clampedPercent}%` }]} />
      </View>

      {/* Completion Caption */}
      <Text style={styles.captionText}>{completedDaysText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: '#252D3A',
    borderRadius: 26,
    padding: 20,
    marginTop: 16,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  titleColumn: {
    justifyContent: 'center',
  },
  titleText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  percentageText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 30,
    lineHeight: 36,
    color: '#FFFFFF',
    marginTop: 4,
  },
  pulseBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(66, 191, 138, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#42BF8A',
    borderRadius: 4,
  },
  captionText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(255, 255, 255, 0.55)',
    marginTop: 12,
  },
});
