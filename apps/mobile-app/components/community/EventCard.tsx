import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';

export interface EventCardProps {
    // Real API fields
    id: string;
    title: string;
    shortDescription?: string;
    timeVenue: string;          // formatted by parent: "8:00 AM · Live on video"
    date: string;               // formatted by parent: "16 NOV"
    ctaLabel: string;
    isRegistered?: boolean;
    timelineStatus?: 'upcoming' | 'ongoing' | 'past';
    thumbnailUrl?: string | null;
    onCta: () => void;
    onPress?: () => void;

    // Fallback icon (shown when no thumbnail)
    iconBg?: string;
    iconColor?: string;
    iconName?: keyof typeof Feather.glyphMap;
}

export function EventCard({
    title,
    shortDescription,
    timeVenue,
    date,
    ctaLabel,
    isRegistered = false,
    timelineStatus = 'upcoming',
    thumbnailUrl,
    onCta,
    onPress,
    iconBg = '#E8F7F1',
    iconColor = '#158263',
    iconName = 'activity',
}: EventCardProps) {
    const isOngoing = timelineStatus === 'ongoing';

    return (
        <TouchableOpacity
            style={styles.card}
            activeOpacity={0.88}
            onPress={onPress}
        >
            {/* Thumbnail (if available) */}
            {thumbnailUrl ? (
                <Image
                    source={{ uri: thumbnailUrl }}
                    style={styles.thumbnail}
                    resizeMode="cover"
                />
            ) : null}

            <View style={styles.body}>
                {/* Top row: icon (when no thumbnail) + date */}
                <View style={styles.topRow}>
                    {!thumbnailUrl ? (
                        <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
                            <Feather name={iconName} size={22} color={iconColor} />
                        </View>
                    ) : (
                        <View />
                    )}
                    <View style={styles.dateRow}>
                        {isOngoing && (
                            <View style={styles.liveDot} />
                        )}
                        <Text style={[styles.date, isOngoing && styles.dateOngoing]}>
                            {isOngoing ? 'LIVE NOW' : date}
                        </Text>
                    </View>
                </View>

                {/* Event title */}
                <Text style={styles.title}>{title}</Text>

                {/* Short description (from API) */}
                {shortDescription ? (
                    <Text style={styles.description} numberOfLines={2}>
                        {shortDescription}
                    </Text>
                ) : null}

                {/* Time & venue */}
                <Text style={styles.timeVenue}>{timeVenue}</Text>

                {/* CTA button */}
                <TouchableOpacity
                    style={[
                        styles.ctaButton,
                        isRegistered && !isOngoing && styles.ctaButtonRegistered,
                        isOngoing && styles.ctaButtonLive,
                    ]}
                    onPress={onCta}
                    activeOpacity={0.85}
                >
                    {isRegistered && !isOngoing && (
                        <Feather name="check-circle" size={16} color="#059669" style={styles.ctaIcon} />
                    )}
                    <Text
                        style={[
                            styles.ctaLabel,
                            isRegistered && !isOngoing && styles.ctaLabelRegistered,
                        ]}
                    >
                        {ctaLabel}
                    </Text>
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        borderWidth: 1.08,
        borderColor: '#E7DED6',
        overflow: 'hidden',
        width: '100%',
    },
    thumbnail: {
        width: '100%',
        height: 160,
    },
    body: {
        padding: 20,
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 4,
    },
    iconBox: {
        width: 48,
        height: 48,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    liveDot: {
        width: 7,
        height: 7,
        borderRadius: 999,
        backgroundColor: '#E11D48',
    },
    date: {
        fontFamily: 'Poppins-Bold',
        fontSize: 12,
        lineHeight: 16,
        letterSpacing: 0.96,
        color: '#667085',
    },
    dateOngoing: {
        color: '#E11D48',
        letterSpacing: 1,
    },
    title: {
        marginTop: 12,
        fontFamily: 'Poppins-SemiBold',
        fontSize: 18,
        lineHeight: 27,
        color: '#1F2937',
    },
    description: {
        marginTop: 4,
        fontFamily: 'Poppins-Regular',
        fontSize: 13,
        lineHeight: 20,
        color: '#667085',
    },
    timeVenue: {
        marginTop: 4,
        fontFamily: 'Poppins-Regular',
        fontSize: 14,
        lineHeight: 20,
        color: '#667085',
    },
    ctaButton: {
        marginTop: 20,
        backgroundColor: '#FE6700',
        borderRadius: 24,
        height: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    ctaButtonRegistered: {
        backgroundColor: '#F0FDF4',
        borderWidth: 1.5,
        borderColor: '#86EFAC',
    },
    ctaButtonLive: {
        backgroundColor: '#E11D48',
    },
    ctaIcon: {
        marginRight: 2,
    },
    ctaLabel: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 14,
        lineHeight: 20,
        color: '#FFFFFF',
    },
    ctaLabelRegistered: {
        color: '#059669',
    },
});
