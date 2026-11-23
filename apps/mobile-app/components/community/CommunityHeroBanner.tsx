import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface CommunityHeroBannerProps {
    title?: string;
    subtitle?: string;
}

export function CommunityHeroBanner({
    title = 'Good company is good medicine.',
    subtitle = 'Join warm conversations, gentle movement and expert-led sessions from home or nearby.',
}: CommunityHeroBannerProps) {
    return (
        <View style={styles.card}>
            {/* Star / sparkle icon */}
            <Feather name="star" size={24} color="#F9C979" />

            {/* Overline */}
            <Text style={styles.overline}>COMMUNITY HUB</Text>

            {/* Headline */}
            <Text style={styles.headline}>{title}</Text>

            {/* Subtitle */}
            <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#4E6B60',
        borderRadius: 30,
        padding: 24,
        width: '100%',
    },
    overline: {
        marginTop: 28,
        fontFamily: 'Poppins-SemiBold',
        fontSize: 14,
        lineHeight: 20,
        letterSpacing: 1.96,
        textTransform: 'uppercase',
        color: 'rgba(255, 255, 255, 0.6)',
    },
    headline: {
        marginTop: 8,
        fontFamily: 'Poppins-SemiBold',
        fontSize: 30,
        lineHeight: 38,
        letterSpacing: -1.05,
        color: '#FFFFFF',
    },
    subtitle: {
        marginTop: 12,
        fontFamily: 'Poppins-Regular',
        fontSize: 14,
        lineHeight: 23,
        color: 'rgba(255, 255, 255, 0.7)',
    },
});
