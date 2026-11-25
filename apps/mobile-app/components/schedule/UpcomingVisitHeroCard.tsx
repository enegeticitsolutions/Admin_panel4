import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Linking, Alert } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { sanitizeImageUri } from '@/utils/sanitizeImageUri';
import type { ScheduleVisit } from './index';

interface UpcomingVisitHeroCardProps {
  visit: ScheduleVisit;
  onViewDetails: (visit: ScheduleVisit) => void;
  onMessagePress?: (visit: ScheduleVisit) => void;
}

export function UpcomingVisitHeroCard({
  visit,
  onViewDetails,
  onMessagePress,
}: UpcomingVisitHeroCardProps) {
  const companionFirst = visit.companionFirstName || visit.companionName?.split(' ')[0] || 'your companion';
  const photoUri = sanitizeImageUri(visit.companionPhoto);

  const statusLabel =
    visit.status === 'in_progress'
      ? 'Visit in progress'
      : visit.changeRequestStatus === 'pending'
      ? 'Change requested'
      : 'Confirmed visit';

  const handleCall = () => {
    if (visit.companionPhone) {
      Linking.openURL(`tel:${visit.companionPhone.replace(/[^\d+]/g, '')}`).catch(() => {
        Alert.alert('Unavailable', 'Unable to open phone dialer on this device.');
      });
    } else {
      Alert.alert('Contact Unavailable', 'Care companion phone number is not available yet.');
    }
  };

  const handleMessage = () => {
    if (onMessagePress) {
      onMessagePress(visit);
    } else if (visit.companionPhone) {
      const clean = visit.companionPhone.replace(/[^\d]/g, '');
      Linking.openURL(`https://wa.me/${clean.length === 10 ? `91${clean}` : clean}`).catch(() => {
        Alert.alert('Unavailable', 'Unable to open messaging app.');
      });
    } else {
      onViewDetails(visit);
    }
  };

  return (
    <View style={styles.card}>
      {/* Top Peach Status Banner */}
      <View style={styles.banner}>
        <View style={styles.bannerLeft}>
          <View style={styles.dot} />
          <Text style={styles.bannerStatus}>{statusLabel}</Text>
        </View>
        <View style={styles.dayPill}>
          <Text style={styles.dayPillText}>{visit.relativeDayLabel || visit.shortDate || 'Upcoming'}</Text>
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.body}>
        <Text style={styles.timeRange}>{visit.timeRange || visit.time}</Text>
        <Text style={styles.title}>{visit.title}</Text>
        <Text style={styles.subtitle}>
          {visit.beneficiaryName ? `For ${visit.beneficiaryName}` : 'Care visit'}
          {visit.location ? ` · ${visit.location}` : ''}
        </Text>

        {/* Companion Info Row */}
        <View style={styles.companionRow}>
          <View style={styles.avatarCircle}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarInitials}>{visit.companionInitials || 'CC'}</Text>
            )}
          </View>

          <View style={styles.companionInfo}>
            <View style={styles.companionNameRow}>
              <Text style={styles.companionName} numberOfLines={1}>
                {visit.companionName}
              </Text>
              {visit.companionVerified !== false && (
                <MaterialCommunityIcons name="shield-check-outline" size={16} color="#15956E" />
              )}
            </View>
            <Text style={styles.companionMeta} numberOfLines={1}>
              Verified Saathi
              {typeof visit.companionRating === 'number' ? ` · ${visit.companionRating.toFixed(1)} ★` : ''}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.callBtn}
            onPress={handleCall}
            activeOpacity={0.8}
            accessibilityLabel="Call companion"
          >
            <Feather name="phone" size={18} color="#FE6700" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.msgBtn}
            onPress={handleMessage}
            activeOpacity={0.8}
            accessibilityLabel="Message companion"
          >
            <Feather name="message-circle" size={18} color="#2865C7" />
          </TouchableOpacity>
        </View>

        {/* Dark Navy Arrival Window Box */}
        <View style={styles.arrivalBox}>
          <Text style={styles.arrivalEyebrow}>ARRIVAL WINDOW</Text>
          <Text style={styles.arrivalTime}>{visit.arrivalWindow || visit.time}</Text>
          <Text style={styles.arrivalHint}>
            {visit.status === 'in_progress' && visit.checkInTime
              ? `${companionFirst} checked in at ${visit.checkInTime}.`
              : `Live status will appear here when ${companionFirst} starts the journey.`}
          </Text>

          <TouchableOpacity
            style={styles.detailsBtn}
            onPress={() => onViewDetails(visit)}
            activeOpacity={0.85}
          >
            <Text style={styles.detailsBtnText}>View visit details</Text>
            <Feather name="arrow-right" size={17} color="#252D3A" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#513422',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
    elevation: 4,
  },
  banner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFF0E6',
  },
  bannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FE6700',
    opacity: 0.6,
  },
  bannerStatus: {
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 20,
    color: '#FE6700',
  },
  dayPill: {
    backgroundColor: '#FFFFFF',
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  dayPillText: {
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    fontSize: 12,
    lineHeight: 16,
    color: '#5C6370',
  },
  body: {
    padding: 20,
  },
  timeRange: {
    fontFamily: 'Poppins-Medium',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 20,
    color: '#667085',
  },
  title: {
    marginTop: 4,
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    fontSize: 20,
    lineHeight: 28,
    color: '#1F2937',
  },
  subtitle: {
    marginTop: 6,
    fontFamily: 'Poppins-Regular',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 22,
    color: '#667085',
  },
  companionRow: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
    borderWidth: 1.08,
    borderColor: '#E7DED6',
    borderRadius: 16,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F7F1',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitials: {
    fontFamily: 'Poppins-Bold',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 24,
    color: '#158263',
  },
  companionInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  companionNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  companionName: {
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    fontSize: 16,
    lineHeight: 24,
    color: '#1F2937',
    flexShrink: 1,
  },
  companionMeta: {
    fontFamily: 'Poppins-Regular',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 16,
    color: '#667085',
  },
  callBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF0E6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  msgBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EAF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrivalBox: {
    marginTop: 20,
    backgroundColor: '#252D3A',
    borderRadius: 22,
    padding: 20,
  },
  arrivalEyebrow: {
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.44,
    textTransform: 'uppercase',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  arrivalTime: {
    marginTop: 8,
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    fontSize: 24,
    lineHeight: 32,
    color: '#FFFFFF',
  },
  arrivalHint: {
    marginTop: 8,
    fontFamily: 'Poppins-Regular',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  detailsBtn: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
  },
  detailsBtnText: {
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 20,
    color: '#252D3A',
  },
});
