import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';

export interface CommunityPodcastItem {
  id: string;
  title: string;
  description?: string;
  speakerName?: string;
  durationMinutes?: number;
  audioUrl?: string | null;
}

interface CommunityPodcastCardProps {
  podcast: CommunityPodcastItem;
  onPress: () => void;
}

export const CommunityPodcastCard: React.FC<CommunityPodcastCardProps> = ({
  podcast,
  onPress,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<string>('1×');

  const speakerText = podcast.speakerName
    ? `${podcast.speakerName} · ${podcast.durationMinutes || 18} min`
    : `Dr. Asha Menon · ${podcast.durationMinutes || 18} min`;

  const togglePlay = () => {
    setIsPlaying(prev => !prev);
  };

  const cycleSpeed = () => {
    if (playbackSpeed === '1×') setPlaybackSpeed('1.25×');
    else if (playbackSpeed === '1.25×') setPlaybackSpeed('1.5×');
    else setPlaybackSpeed('1×');
  };

  return (
    <View style={styles.card}>
      {/* Top Row: Play button + Title/Speaker */}
      <View style={styles.topRow}>
        <TouchableOpacity
          style={styles.playButton}
          onPress={togglePlay}
          activeOpacity={0.85}
        >
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={24}
            color="#FFFFFF"
            style={{ marginLeft: isPlaying ? 0 : 3 }}
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.infoCol} activeOpacity={0.7} onPress={onPress}>
          <Text style={styles.title} numberOfLines={1}>
            {podcast.title}
          </Text>
          <Text style={styles.speaker} numberOfLines={1}>
            {speakerText}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBarTrack}>
        <View style={styles.progressBarFill} />
      </View>

      {/* Player Controls Row */}
      <View style={styles.controlsRow}>
        <TouchableOpacity
          style={styles.controlBtn}
          activeOpacity={0.7}
          onPress={() => {}}
        >
          <Text style={styles.controlText}>↶ 15s</Text>
        </TouchableOpacity>

        <Text style={styles.timerText}>02:12 / 18:10</Text>

        <TouchableOpacity
          style={styles.controlBtn}
          activeOpacity={0.7}
          onPress={cycleSpeed}
        >
          <Text style={styles.controlText}>{playbackSpeed} speed</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#252D3A',
    borderRadius: 26,
    padding: 24,
    alignSelf: 'stretch',
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 3,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FE6700',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FE6700',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 4,
  },
  infoCol: {
    flex: 1,
  },
  title: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  speaker: {
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255, 255, 255, 0.55)',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    alignSelf: 'stretch',
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressBarFill: {
    width: '35%',
    height: 6,
    backgroundColor: '#FE6700',
    borderRadius: 3,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  controlBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  controlText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255, 255, 255, 0.55)',
    textAlign: 'center',
  },
  timerText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(255, 255, 255, 0.55)',
  },
});
