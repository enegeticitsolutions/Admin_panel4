import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

export interface CommunityEventItem {
  id: string;
  title: string;
  startDateTime: string | Date;
  endDateTime?: string | Date;
  eventType?: 'online' | 'offline' | 'hybrid';
  venueName?: string | null;
  hostName?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  detailedDescription?: string | null;
  resolvedThumbnailUrl?: string | null;
  thumbnailUrl?: string | null;
  thumbnailKey?: string | null;
  isRegistered?: boolean;
  category?: {
    name?: string;
    color?: string;
  } | null;
}

interface CommunityEventCardProps {
  event: CommunityEventItem;
  themeIndex?: number;
  onPress: () => void;
  onRsvpPress?: () => void;
  onCancelRsvp?: () => void;
  isRsvpLoading?: boolean;
}

interface ThemeConfig {
  bgColor: string;
  iconColor: string;
  iconName: string;
}

const THEMES: ThemeConfig[] = [
  { bgColor: '#E8F7F1', iconColor: '#158263', iconName: 'pulse' },
  { bgColor: '#FFF3D2', iconColor: '#A56400', iconName: 'microphone-outline' },
  { bgColor: '#EAF2FF', iconColor: '#2865C7', iconName: 'stethoscope' },
];

export const CommunityEventCard: React.FC<CommunityEventCardProps> = ({
  event,
  themeIndex = 0,
  onPress,
  onRsvpPress,
  onCancelRsvp,
  isRsvpLoading = false,
}) => {
  const theme = THEMES[themeIndex % THEMES.length];

  // Format Date (e.g. "16 NOV")
  const dateObj = new Date(event.startDateTime);
  const formattedDate = !isNaN(dateObj.getTime())
    ? dateObj
        .toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
        .toUpperCase()
    : '16 NOV';

  // Format Time & Venue/Platform
  const formattedTime = !isNaN(dateObj.getTime())
    ? dateObj.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
    : '8:00 AM';

  const subtitle = event.venueName
    ? `${formattedTime} · ${event.venueName}`
    : event.hostName
    ? `${formattedTime} · ${event.hostName}`
    : event.eventType === 'offline'
    ? `${formattedTime} · Community Hall`
    : `${formattedTime} · Live on video`;

  const thumbnailUrl = event.resolvedThumbnailUrl || event.thumbnailUrl;
  const briefDescription = event.shortDescription || event.description || event.detailedDescription;

  // 1 hour cancellation window logic:
  // Allowed strictly before 1 hour of starting the event
  const timeUntilStartMs = !isNaN(dateObj.getTime()) ? dateObj.getTime() - Date.now() : 0;
  const canCancelRsvp = timeUntilStartMs > 60 * 60 * 1000;

  return (
    <View style={styles.card}>
      {/* 1. Thumbnail Image (if available) */}
      {Boolean(thumbnailUrl) && (
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={onPress}
          style={styles.thumbnailWrapper}
        >
          <Image
            source={{ uri: thumbnailUrl as string }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        </TouchableOpacity>
      )}

      {/* 2. Top Row: Icon on left, Date on right */}
      <View style={styles.topRow}>
        <View style={[styles.iconBox, { backgroundColor: theme.bgColor }]}>
          <MaterialCommunityIcons
            name={theme.iconName as any}
            size={22}
            color={theme.iconColor}
          />
        </View>

        <Text style={styles.dateText}>{formattedDate}</Text>
      </View>

      {/* 3. Title */}
      <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
        <Text style={styles.title} numberOfLines={2}>
          {event.title}
        </Text>
      </TouchableOpacity>

      {/* 4. Brief Description */}
      {Boolean(briefDescription) && (
        <Text style={styles.description} numberOfLines={2}>
          {briefDescription}
        </Text>
      )}

      {/* 5. Time & Location Subtitle */}
      <View style={styles.timeRow}>
        <Feather name="clock" size={14} color="#667085" />
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>

      {/* 6. Action Button & Cancellation Option */}
      {event.isRegistered ? (
        <View style={styles.registeredContainer}>
          <TouchableOpacity
            style={[styles.actionButtonRegistered, isRsvpLoading && { opacity: 0.7 }]}
            activeOpacity={0.85}
            onPress={canCancelRsvp ? onCancelRsvp : undefined}
            disabled={isRsvpLoading}
          >
            <Text style={styles.actionButtonTextRegistered}>✓ Reserved</Text>
          </TouchableOpacity>

          {canCancelRsvp && onCancelRsvp && (
            <TouchableOpacity
              style={styles.cancelLinkButton}
              activeOpacity={0.7}
              onPress={onCancelRsvp}
              disabled={isRsvpLoading}
            >
              <Feather name="x-circle" size={14} color="#DC2626" />
              <Text style={styles.cancelLinkText}>Cancel RSVP</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.actionButton, isRsvpLoading && { opacity: 0.7 }]}
          activeOpacity={0.85}
          onPress={onRsvpPress || onPress}
          disabled={isRsvpLoading}
        >
          <Text style={styles.actionButtonText}>Reserve my spot</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.08,
    borderColor: '#E7DED6',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    alignSelf: 'stretch',
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 1,
  },
  thumbnailWrapper: {
    width: '100%',
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 14,
    backgroundColor: '#F1F5F9',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.96,
    color: '#667085',
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 18,
    lineHeight: 26,
    color: '#1F2937',
    marginBottom: 6,
  },
  description: {
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    lineHeight: 21,
    color: '#4B5563',
    marginBottom: 10,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 18,
  },
  subtitle: {
    fontFamily: 'Poppins-Regular',
    fontSize: 13,
    lineHeight: 18,
    color: '#667085',
  },
  registeredContainer: {
    width: '100%',
    alignItems: 'center',
  },
  actionButton: {
    height: 48,
    backgroundColor: '#FE6700',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  actionButtonRegistered: {
    height: 48,
    backgroundColor: '#E8F7F1',
    borderWidth: 1,
    borderColor: '#158263',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  actionButtonText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
    lineHeight: 20,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  actionButtonTextRegistered: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
    lineHeight: 20,
    color: '#158263',
    textAlign: 'center',
  },
  cancelLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 10,
    paddingBottom: 2,
  },
  cancelLinkText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 13,
    color: '#DC2626',
  },
});
