import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';

export interface PodcastPlayerCardProps {
    podcastId?: string;
    title: string;
    authorDuration: string;
    coverUrl?: string | null;
    progressRatio?: number;
    currentTime?: string;
    totalTime?: string;
    onPress?: () => void;
}

export function PodcastPlayerCard({
    podcastId,
    title,
    authorDuration,
    coverUrl,
    progressRatio = 0,
    currentTime = '00:00',
    totalTime = '00:00',
    onPress,
}: PodcastPlayerCardProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [speed, setSpeed] = useState<'0.5×' | '1×' | '1.5×' | '2×'>('1×');
    const animatedWidth = useRef(new Animated.Value(progressRatio)).current;

    const speedOptions: Array<'0.5×' | '1×' | '1.5×' | '2×'> = ['0.5×', '1×', '1.5×', '2×'];
    const handleSpeedToggle = () => {
        const idx = speedOptions.indexOf(speed);
        setSpeed(speedOptions[(idx + 1) % speedOptions.length]);
    };

    useEffect(() => {
        if (isPlaying) {
            Animated.timing(animatedWidth, {
                toValue: Math.min(progressRatio + 0.08, 1),
                duration: 4000,
                useNativeDriver: false,
            }).start();
        }
    }, [isPlaying]);

    return (
        <TouchableOpacity
            style={styles.card}
            activeOpacity={onPress ? 0.88 : 1}
            onPress={onPress}
        >
            {/* Top: cover image + play button + track info */}
            <View style={styles.trackRow}>
                {/* Cover image or play-button circle */}
                <TouchableOpacity
                    style={styles.playButton}
                    onPress={(e) => {
                        e.stopPropagation();
                        setIsPlaying(prev => !prev);
                    }}
                    activeOpacity={0.85}
                >
                    {coverUrl ? (
                        <>
                            <Image
                                source={{ uri: coverUrl }}
                                style={styles.coverImage}
                                resizeMode="cover"
                            />
                            {/* Play overlay */}
                            <View style={styles.playOverlay}>
                                <Feather
                                    name={isPlaying ? 'pause' : 'play'}
                                    size={18}
                                    color="#FFFFFF"
                                    style={!isPlaying ? { marginLeft: 2 } : undefined}
                                />
                            </View>
                        </>
                    ) : (
                        <Feather
                            name={isPlaying ? 'pause' : 'play'}
                            size={22}
                            color="#FFFFFF"
                            style={!isPlaying ? { marginLeft: 3 } : undefined}
                        />
                    )}
                </TouchableOpacity>

                <View style={styles.trackInfo}>
                    <Text style={styles.trackTitle} numberOfLines={2}>{title}</Text>
                    <Text style={styles.trackMeta} numberOfLines={1}>{authorDuration}</Text>
                </View>
            </View>

            {/* Progress bar */}
            <View style={styles.progressTrack}>
                <Animated.View
                    style={[
                        styles.progressFill,
                        {
                            width: animatedWidth.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['0%', '100%'],
                            }),
                        },
                    ]}
                />
            </View>

            {/* Controls row */}
            <View style={styles.controlsRow}>
                <TouchableOpacity style={styles.controlBtn} activeOpacity={0.7}>
                    <Text style={styles.controlText}>↶ 15s</Text>
                </TouchableOpacity>

                <Text style={styles.timeText}>
                    {currentTime} / {totalTime}
                </Text>

                <TouchableOpacity
                    style={styles.controlBtn}
                    onPress={handleSpeedToggle}
                    activeOpacity={0.7}
                >
                    <Text style={styles.controlText}>{speed} speed</Text>
                </TouchableOpacity>
            </View>

            {/* Tap to open hint */}
            {onPress && (
                <View style={styles.tapHint}>
                    <Text style={styles.tapHintText}>Tap for all episodes</Text>
                    <Feather name="chevron-right" size={12} color="rgba(255,255,255,0.4)" />
                </View>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#252D3A',
        borderRadius: 26,
        padding: 24,
        width: '100%',
    },
    trackRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    playButton: {
        width: 56,
        height: 56,
        borderRadius: 999,
        backgroundColor: '#FE6700',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        overflow: 'hidden',
    },
    coverImage: {
        width: 56,
        height: 56,
        borderRadius: 999,
    },
    playOverlay: {
        position: 'absolute',
        width: 56,
        height: 56,
        borderRadius: 999,
        backgroundColor: 'rgba(0,0,0,0.42)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    trackInfo: {
        flex: 1,
    },
    trackTitle: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 16,
        lineHeight: 24,
        color: '#FFFFFF',
    },
    trackMeta: {
        marginTop: 4,
        fontFamily: 'Poppins-Regular',
        fontSize: 14,
        lineHeight: 20,
        color: 'rgba(255, 255, 255, 0.55)',
    },
    progressTrack: {
        marginTop: 20,
        height: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 999,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#FE6700',
        borderRadius: 999,
    },
    controlsRow: {
        marginTop: 14,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    controlBtn: {
        paddingHorizontal: 8,
        paddingVertical: 6,
        minWidth: 65,
        alignItems: 'center',
    },
    controlText: {
        fontFamily: 'Poppins-Medium',
        fontSize: 15,
        lineHeight: 22,
        color: 'rgba(255, 255, 255, 0.55)',
    },
    timeText: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 12,
        lineHeight: 16,
        color: 'rgba(255, 255, 255, 0.55)',
    },
    tapHint: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 14,
        gap: 4,
    },
    tapHintText: {
        fontFamily: 'Poppins-Regular',
        fontSize: 11,
        color: 'rgba(255,255,255,0.4)',
    },
});
