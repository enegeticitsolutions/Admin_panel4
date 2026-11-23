import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { HomeColors, HomeShadows } from '@/constants/homeTheme';

interface HeroOverviewCardProps {
  dayOverviewText?: string;
  title?: string;
  subtext?: string;
}

export function HeroOverviewCard({
  dayOverviewText,
  title = "Everyone's care, beautifully in sync.",
  subtext = "Stay connected with daily updates, health monitoring, and family care routines.",
}: HeroOverviewCardProps) {
  // Compute default day of week if not passed
  const getDayOverview = () => {
    const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const today = days[new Date().getDay()];
    return `${today} · FAMILY OVERVIEW`;
  };

  const overviewTag = dayOverviewText || getDayOverview();

  return (
    <View style={styles.cardContainer}>
      {/* Decorative background shapes */}
      <View style={styles.decorativeCircle} />
      <View style={styles.decorativeRotatedBox} />

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.subtitle}>{overviewTag}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtext}>{subtext}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    width: '100%',
    minHeight: 214,
    backgroundColor: HomeColors.brandOrange,
    borderRadius: 28,
    padding: 24,
    position: 'relative',
    overflow: 'hidden',
    ...HomeShadows.hero,
  },
  decorativeCircle: {
    position: 'absolute',
    width: 224,
    height: 224,
    right: -50,
    top: -64,
    borderWidth: 38,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 112,
  },
  decorativeRotatedBox: {
    position: 'absolute',
    width: 112,
    height: 112,
    right: 40,
    bottom: -30,
    backgroundColor: 'rgba(255, 170, 106, 0.35)',
    borderRadius: 30,
    transform: [{ rotate: '12deg' }],
  },
  content: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    zIndex: 1,
  },
  subtitle: {
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.8,
    color: HomeColors.textWhiteMuted,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: 'Poppins-Bold',
    fontWeight: '700',
    fontSize: 27,
    lineHeight: 33,
    letterSpacing: -0.8,
    color: HomeColors.textWhite,
    marginBottom: 10,
    maxWidth: 320,
  },
  subtext: {
    fontFamily: 'Poppins-Regular',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 22,
    color: HomeColors.textWhiteBody,
    maxWidth: 320,
  },
});
