import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';

export interface DoseScheduleItem {
  id: string;
  logId: string | null;
  name: string;
  dosage: string;
  cadence?: string;
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
}

interface MedicationDoseCardProps {
  item: DoseScheduleItem;
  index: number;
  onMarkTaken: (item: DoseScheduleItem) => void;
  onMarkMissed?: (item: DoseScheduleItem) => void;
  onDelete?: (medId: string, medName: string) => void;
  isSubmitting?: boolean;
  canMark?: boolean;
}

// Icon themes based on time of day or index
function getSlotTheme(scheduleTimeText: string, index: number) {
  const lower = (scheduleTimeText || '').toLowerCase();
  if (lower.includes('pm') || lower.includes('night') || lower.includes('evening') || lower.includes('dinner')) {
    if (lower.includes('1:') || lower.includes('2:') || lower.includes('3:') || lower.includes('4:') || lower.includes('lunch') || lower.includes('afternoon')) {
      return {
        bg: '#E8F7F1',
        iconColor: '#158263',
        label: scheduleTimeText.includes('·') ? scheduleTimeText : `Afternoon · ${scheduleTimeText}`,
      };
    }
    return {
      bg: '#EAF2FF',
      iconColor: '#2865C7',
      label: scheduleTimeText.includes('·') ? scheduleTimeText : `Night · ${scheduleTimeText}`,
    };
  }

  // Morning default
  return {
    bg: '#FFF3D2',
    iconColor: '#A56400',
    label: scheduleTimeText.includes('·') ? scheduleTimeText : `Morning · ${scheduleTimeText}`,
  };
}

export function MedicationDoseCard({
  item,
  index,
  onMarkTaken,
  onMarkMissed,
  onDelete,
  isSubmitting = false,
  canMark = true,
}: MedicationDoseCardProps) {
  const isTaken = item.status === 'taken';
  const isMissed = item.status === 'missed';
  const slotTheme = getSlotTheme(item.scheduleTimeText, index);

  // Subtitle generation
  const subtitle = item.instructions
    ? `${item.dosage ? `${item.dosage} · ` : ''}${item.instructions}`
    : `${item.dosage || ''} · ${item.frequency || 'Daily'}`;

  return (
    <View style={styles.card}>
      {/* Top Header: Timing */}
      <View style={styles.timingRow}>
        <Feather name="clock" size={14} color="#667085" style={styles.clockIcon} />
        <Text style={styles.timingText}>{slotTheme.label}</Text>
      </View>

      {/* Main Content Row */}
      <View style={styles.contentRow}>
        {/* Left: Tinted Pill Icon */}
        <View style={[styles.iconBox, { backgroundColor: slotTheme.bg }]}>
          <Svg width={21} height={21} viewBox="0 0 24 24" fill="none">
            <Path
              d="M4.5 12.5l8-8a4.95 4.95 0 017 7l-8 8a4.95 4.95 0 01-7-7z"
              stroke={slotTheme.iconColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d="M8.5 8.5l7 7"
              stroke={slotTheme.iconColor}
              strokeWidth="2"
              strokeLinecap="round"
            />
          </Svg>
        </View>

        {/* Center: Name & Subtitle */}
        <View style={styles.detailsContainer}>
          <Text style={styles.medName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.medSubtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>

        {/* Right: Action Button */}
        <View style={styles.actionContainer}>
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#FE6700" />
          ) : isTaken ? (
            <TouchableOpacity
              style={styles.takenButton}
              onPress={() => canMark && onMarkMissed?.(item)}
              activeOpacity={0.8}
              disabled={!canMark}
            >
              <Feather name="check" size={16} color="#14724F" style={{ marginRight: 4 }} />
              <Text style={styles.takenText}>Taken</Text>
            </TouchableOpacity>
          ) : !canMark ? (
            <View style={styles.lockedBadge}>
              <Feather name="lock" size={13} color="#9CA3AF" style={{ marginRight: 4 }} />
              <Text style={styles.lockedText}>
                {isMissed ? 'Missed' : item.isFutureSchedule ? 'Scheduled' : 'Past'}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.markButton}
              onPress={() => onMarkTaken(item)}
              activeOpacity={0.85}
            >
              <Text style={styles.markButtonText}>Mark taken</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.08,
    borderColor: '#E7DED6',
    borderRadius: 24,
    padding: 20,
    marginBottom: 12,
  },
  timingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  clockIcon: {
    marginRight: 2,
  },
  timingText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 12,
    lineHeight: 16,
    color: '#667085',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  medName: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 18,
    lineHeight: 27,
    color: '#1F2937',
  },
  medSubtitle: {
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#667085',
    marginTop: 2,
  },
  actionContainer: {
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  markButton: {
    height: 48,
    minHeight: 48,
    paddingHorizontal: 16,
    backgroundColor: '#FE6700',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FE6700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 2,
  },
  markButtonText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 12,
    lineHeight: 16,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  takenButton: {
    height: 48,
    minHeight: 48,
    paddingHorizontal: 14,
    backgroundColor: '#DFF4E6',
    borderRadius: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  takenText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 12,
    lineHeight: 16,
    color: '#14724F',
    textAlign: 'center',
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
  },
  lockedText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 11,
    color: '#9CA3AF',
  },
});
