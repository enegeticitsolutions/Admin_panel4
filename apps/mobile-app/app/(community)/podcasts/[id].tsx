import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/api';

export default function PodcastDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [podcast, setPodcast] = useState<any>(null);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeEpisodeId, setActiveEpisodeId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const fetchPodcastDetails = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_URL}/community/podcasts/${id}`, { headers });
      const json = await res.json();
      if (json.success && json.data) {
        setPodcast(json.data.podcast);
        setEpisodes(json.data.episodes || []);
      }
    } catch (e) {
      console.error('Fetch podcast detail error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchPodcastDetails();
  }, [id]);

  const togglePlayEpisode = (episode: any) => {
    if (activeEpisodeId === episode.id) {
      setIsPlaying(prev => !prev);
    } else {
      setActiveEpisodeId(episode.id);
      setIsPlaying(true);
    }
  };

  if (loading || !podcast) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FE6700" />
      </SafeAreaView>
    );
  }

  const activeEpisode = episodes.find(e => e.id === activeEpisodeId);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* ── Top Bar ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Podcast Show</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* ── Show Banner ── */}
        <View style={styles.showHero}>
          {podcast.resolvedCoverUrl ? (
            <Image source={{ uri: podcast.resolvedCoverUrl }} style={styles.showCover} />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Feather name="headphones" size={48} color="#FE6700" />
            </View>
          )}

          <Text style={styles.showTitle}>{podcast.title}</Text>
          <Text style={styles.showHost}>
            Hosted by {podcast.host?.name || 'MaiHoonNa Wellness Experts'}
          </Text>
          <Text style={styles.showDescription}>{podcast.description}</Text>
        </View>

        {/* ── Episodes Section ── */}
        <View style={styles.episodesHeader}>
          <Text style={styles.episodesTitle}>Episodes ({episodes.length})</Text>
        </View>

        {episodes.map((ep) => {
          const isThisActive = activeEpisodeId === ep.id;
          const isThisPlaying = isThisActive && isPlaying;

          return (
            <View key={ep.id} style={[styles.episodeCard, isThisActive && styles.episodeCardActive]}>
              <View style={styles.episodeRow}>
                <TouchableOpacity
                  style={[styles.playBtn, isThisPlaying && styles.playBtnActive]}
                  onPress={() => togglePlayEpisode(ep)}
                >
                  <Ionicons
                    name={isThisPlaying ? 'pause' : 'play'}
                    size={22}
                    color={isThisPlaying ? '#FFFFFF' : '#FE6700'}
                  />
                </TouchableOpacity>

                <View style={styles.episodeMeta}>
                  <Text style={styles.episodeNum}>Episode {ep.episodeNumber}</Text>
                  <Text style={styles.epTitle}>{ep.title}</Text>
                  <Text style={styles.epDesc} numberOfLines={2}>
                    {ep.description}
                  </Text>
                  <View style={styles.epTimingRow}>
                    <Feather name="clock" size={12} color="#64748B" />
                    <Text style={styles.epDuration}>
                      {Math.ceil((ep.durationSeconds || 600) / 60)} mins
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* ── Persistent Floating Audio Player Bar ── */}
      {activeEpisode && (
        <View style={styles.playerBar}>
          <View style={styles.playerBarInfo}>
            <Text style={styles.playerBarTitle} numberOfLines={1}>{activeEpisode.title}</Text>
            <Text style={styles.playerBarSub}>{podcast.title}</Text>
          </View>

          <View style={styles.playerBarControls}>
            <TouchableOpacity onPress={() => setIsPlaying(prev => !prev)} style={styles.playerBarPlayBtn}>
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={22}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    padding: 6,
    marginRight: 10,
  },
  headerTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    color: '#0F172A',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  showHero: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  showCover: {
    width: 140,
    height: 140,
    borderRadius: 16,
    marginBottom: 16,
  },
  coverPlaceholder: {
    width: 140,
    height: 140,
    borderRadius: 16,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  showTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 20,
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 4,
  },
  showHost: {
    fontFamily: 'Poppins-Medium',
    fontSize: 13,
    color: '#FE6700',
    marginBottom: 10,
  },
  showDescription: {
    fontFamily: 'Poppins-Regular',
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  episodesHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  episodesTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    color: '#0F172A',
  },
  episodeCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  episodeCardActive: {
    borderColor: '#FE6700',
    backgroundColor: '#FFFBF7',
  },
  episodeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnActive: {
    backgroundColor: '#FE6700',
  },
  episodeMeta: {
    flex: 1,
  },
  episodeNum: {
    fontFamily: 'Poppins-Medium',
    fontSize: 11,
    color: '#FE6700',
    textTransform: 'uppercase',
  },
  epTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 15,
    color: '#0F172A',
    marginTop: 2,
  },
  epDesc: {
    fontFamily: 'Poppins-Regular',
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  epTimingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  epDuration: {
    fontFamily: 'Poppins-Medium',
    fontSize: 12,
    color: '#64748B',
  },
  playerBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  playerBarInfo: {
    flex: 1,
  },
  playerBarTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  playerBarSub: {
    fontFamily: 'Poppins-Regular',
    fontSize: 12,
    color: '#94A3B8',
  },
  playerBarControls: {
    marginLeft: 12,
  },
  playerBarPlayBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FE6700',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

