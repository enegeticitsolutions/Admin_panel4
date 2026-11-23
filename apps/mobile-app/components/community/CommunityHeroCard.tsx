import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface CommunityHeroCardProps {
  categoryText?: string;
  title?: string;
  description?: string;
}

export const CommunityHeroCard: React.FC<CommunityHeroCardProps> = ({
  categoryText = 'COMMUNITY HUB',
  title = 'Good company is good medicine.',
  description = 'Join warm conversations, gentle movement and expert-led sessions from home or nearby.',
}) => {
  return (
    <View style={styles.card}>
      {/* Sparkle Icon */}
      <View style={styles.iconContainer}>
        <MaterialCommunityIcons name="star-four-points-outline" size={24} color="#F9C979" />
      </View>

      {/* Category / Subtitle */}
      <Text style={styles.categoryText}>{categoryText}</Text>

      {/* Heading */}
      <Text style={styles.title}>{title}</Text>

      {/* Description */}
      <Text style={styles.description}>{description}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#4E6B60',
    borderRadius: 30,
    padding: 24,
    alignSelf: 'stretch',
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 3,
  },
  iconContainer: {
    width: 24,
    height: 24,
    marginBottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 1.96,
    textTransform: 'uppercase',
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 8,
  },
  title: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: -1.05,
    color: '#FFFFFF',
    marginBottom: 12,
  },
  description: {
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    lineHeight: 23,
    color: 'rgba(255, 255, 255, 0.7)',
  },
});
