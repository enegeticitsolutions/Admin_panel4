import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';

export interface WellnessReadCardProps {
    category: string;
    readTime: string;
    title: string;
    description: string;
    thumbnailUrl?: string | null;
    onRead: () => void;
}

export function WellnessReadCard({
    category,
    readTime,
    title,
    description,
    thumbnailUrl,
    onRead,
}: WellnessReadCardProps) {
    return (
        <View style={styles.card}>
            {/* Thumbnail */}
            {thumbnailUrl ? (
                <Image
                    source={{ uri: thumbnailUrl }}
                    style={styles.thumbnail}
                    resizeMode="cover"
                />
            ) : null}

            <View style={styles.body}>
                {/* Pill badge */}
                <View style={styles.badgePill}>
                    <Text style={styles.badgeText}>
                        {category.toUpperCase()} · {readTime}
                    </Text>
                </View>

                {/* Article title */}
                <Text style={styles.title}>{title}</Text>

                {/* Description */}
                <Text style={styles.description} numberOfLines={3}>
                    {description}
                </Text>

                {/* Read article link */}
                <TouchableOpacity
                    style={styles.readRow}
                    onPress={onRead}
                    activeOpacity={0.75}
                >
                    <Text style={styles.readLabel}>Read article</Text>
                    <Feather name="arrow-right" size={18} color="#FE6700" />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#FFF0E6',
        borderRadius: 26,
        overflow: 'hidden',
        width: '100%',
    },
    thumbnail: {
        width: '100%',
        height: 180,
    },
    body: {
        padding: 24,
    },
    badgePill: {
        alignSelf: 'flex-start',
        backgroundColor: '#FFFFFF',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 4,
    },
    badgeText: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 12,
        lineHeight: 16,
        color: '#FE6700',
    },
    title: {
        marginTop: 20,
        fontFamily: 'Poppins-SemiBold',
        fontSize: 22,
        lineHeight: 29,
        color: '#1F2937',
    },
    description: {
        marginTop: 10,
        fontFamily: 'Poppins-Regular',
        fontSize: 14,
        lineHeight: 23,
        color: '#725A4B',
    },
    readRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 20,
        gap: 6,
    },
    readLabel: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 16,
        lineHeight: 24,
        color: '#FE6700',
    },
});
