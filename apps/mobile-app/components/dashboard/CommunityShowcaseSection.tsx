import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { HomeColors, HomeShadows } from '@/constants/homeTheme';

export interface CommunityShowcaseSectionProps {
  events?: any[];
  loading?: boolean;
  horizontalGutter?: number;
  onEventPress: (eventId: string) => void;
  onExplorePress: () => void;
}

export const CommunityShowcaseSection: React.FC<CommunityShowcaseSectionProps> = ({
  events = [],
  onEventPress,
  onExplorePress,
}) => {
  // Use first event from API if available, else use fallback
  const firstEvent = events.length > 0 ? events[0] : null;

  const eventTitle = firstEvent?.title || 'Morning Chair Yoga';
  const eventHost = firstEvent?.host?.name ? `Live with ${firstEvent.host.name}` : 'Live with Ritu Mehra';
  const eventTimeTag = firstEvent?.startDateTime
    ? new Date(firstEvent.startDateTime).toLocaleDateString([], {
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).toUpperCase()
    : 'SAT · 8:00 AM';

  return (
    <View style={styles.container}>
      {/* ── Section Title Row ── */}
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionCategory}>FOR A BRIGHTER DAY</Text>
          <Text style={styles.sectionTitle}>Community & wellness</Text>
        </View>

        <TouchableOpacity onPress={onExplorePress} activeOpacity={0.7} style={styles.exploreLinkBtn}>
          <Text style={styles.exploreLinkText}>Explore all</Text>
        </TouchableOpacity>
      </View>

      {/* ── Card 1: Event Card (Mint) ── */}
      <TouchableOpacity
        style={styles.mintCard}
        onPress={() => (firstEvent?.id ? onEventPress(firstEvent.id) : onExplorePress())}
        activeOpacity={0.85}
      >
        <View style={styles.cardLeftContent}>
          <View style={styles.timePillMint}>
            <Text style={styles.timePillMintText}>{eventTimeTag}</Text>
          </View>

          <View style={styles.textWrap}>
            <Text style={styles.itemTitle} numberOfLines={2}>
              {eventTitle}
            </Text>
            <Text style={styles.itemSubtitleMint} numberOfLines={1}>
              {eventHost}
            </Text>
          </View>
        </View>

        <View style={styles.iconSideMint}>
          <MaterialCommunityIcons name="pulse" size={38} color={HomeColors.mintIcon} />
        </View>
      </TouchableOpacity>

      {/* ── Card 2: Article / Wellness Card (Peach) ── */}
      <TouchableOpacity
        style={styles.peachCard}
        onPress={onExplorePress}
        activeOpacity={0.85}
      >
        <View style={styles.cardLeftContent}>
          <View style={styles.timePillPeach}>
            <Text style={styles.timePillPeachText}>8 MIN READ</Text>
          </View>

          <View style={styles.textWrap}>
            <Text style={styles.itemTitle} numberOfLines={2}>
              A heart-healthy Indian plate
            </Text>
            <Text style={styles.itemSubtitlePeach} numberOfLines={1}>
              Simple everyday swaps
            </Text>
          </View>
        </View>

        <View style={styles.iconSidePeach}>
          <MaterialCommunityIcons name="heart-pulse" size={38} color={HomeColors.brandOrange} />
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginTop: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  sectionCategory: {
    fontFamily: 'Poppins-Bold',
    fontWeight: '700',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.56,
    color: HomeColors.brandOrange,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    fontSize: 21,
    lineHeight: 30,
    letterSpacing: -0.5,
    color: HomeColors.textPrimary,
  },
  exploreLinkBtn: {
    paddingVertical: 6,
  },
  exploreLinkText: {
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 20,
    color: HomeColors.brandOrange,
  },
  mintCard: {
    width: '100%',
    height: 148,
    backgroundColor: HomeColors.mintBg,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
    marginBottom: 16,
    ...HomeShadows.card,
  },
  peachCard: {
    width: '100%',
    height: 148,
    backgroundColor: HomeColors.peachBg,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
    ...HomeShadows.card,
  },
  cardLeftContent: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  timePillMint: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 36,
  },
  timePillMintText: {
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    fontSize: 12,
    lineHeight: 16,
    color: HomeColors.mintText,
  },
  timePillPeach: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 36,
  },
  timePillPeachText: {
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    fontSize: 12,
    lineHeight: 16,
    color: HomeColors.brandOrange,
  },
  textWrap: {
    flexDirection: 'column',
  },
  itemTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    fontSize: 16,
    lineHeight: 22,
    color: HomeColors.textPrimary,
  },
  itemSubtitleMint: {
    fontFamily: 'Poppins-Medium',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 20,
    color: '#527267',
    marginTop: 4,
  },
  itemSubtitlePeach: {
    fontFamily: 'Poppins-Medium',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 20,
    color: HomeColors.textSubtle,
    marginTop: 4,
  },
  iconSideMint: {
    width: 96,
    backgroundColor: '#D8EFE6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconSidePeach: {
    width: 96,
    backgroundColor: '#FCE2CE',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
