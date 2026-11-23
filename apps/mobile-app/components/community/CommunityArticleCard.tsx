import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';

export interface CommunityArticleItem {
  id: string;
  title: string;
  shortDescription?: string;
  readingTimeMinutes?: number;
  category?: {
    name?: string;
  } | null;
  resolvedThumbnailUrl?: string | null;
}

interface CommunityArticleCardProps {
  article: CommunityArticleItem;
  onPress: () => void;
}

export const CommunityArticleCard: React.FC<CommunityArticleCardProps> = ({
  article,
  onPress,
}) => {
  const categoryName = article.category?.name?.toUpperCase() || 'NUTRITION';
  const readingTime = article.readingTimeMinutes || 8;
  const tagText = `${categoryName} · ${readingTime} MIN`;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.88}
      onPress={onPress}
    >
      {/* Category & Read Time Badge */}
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{tagText}</Text>
      </View>

      {/* Article Title */}
      <Text style={styles.title} numberOfLines={3}>
        {article.title}
      </Text>

      {/* Description */}
      {Boolean(article.shortDescription) && (
        <Text style={styles.description} numberOfLines={2}>
          {article.shortDescription}
        </Text>
      )}

      {/* Bottom Link: Read article -> */}
      <View style={styles.linkRow}>
        <Text style={styles.linkText}>Read article</Text>
        <Feather name="arrow-right" size={18} color="#FE6700" />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF0E6',
    borderRadius: 26,
    padding: 24,
    alignSelf: 'stretch',
    shadowColor: '#FE6700',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 2,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 36,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 20,
  },
  badgeText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.5,
    color: '#FE6700',
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 24,
    lineHeight: 30,
    color: '#1F2937',
    marginBottom: 12,
  },
  description: {
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    lineHeight: 23,
    color: '#725A4B',
    marginBottom: 20,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  linkText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    lineHeight: 24,
    color: '#FE6700',
  },
});
