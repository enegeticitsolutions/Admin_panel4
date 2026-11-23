import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/api';
import { useAuth } from '@/contexts/AuthContext';
import { HomeHeader } from '@/components/dashboard/HomeHeader';
import { triggerEmergencyAlert } from '@/services/emergencyTrigger';
import {
  CommunityHeroCard,
  CommunityEventCard,
  CommunityEventItem,
  CommunityArticleCard,
  CommunityArticleItem,
  CommunityPodcastCard,
  CommunityPodcastItem,
} from '@/components/community';

export default function BeneficiaryCommunityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user, isGuest, requireAuth } = useAuth();

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [events, setEvents] = useState<CommunityEventItem[]>([]);
  const [blogs, setBlogs] = useState<CommunityArticleItem[]>([]);
  const [podcasts, setPodcasts] = useState<CommunityPodcastItem[]>([]);
  const [rsvpLoadingId, setRsvpLoadingId] = useState<string | null>(null);

  // Time-aware greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const userName = useMemo(() => {
    if (user?.name) return user.name;
    return isGuest ? 'Guest' : 'Member';
  }, [user, isGuest]);

  // Fetch Community Data strictly from live backend
  const fetchCommunityData = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_URL}/community/home`, { headers });
      const json = await res.json();

      if (json.success && json.data) {
        setEvents(Array.isArray(json.data.events) ? json.data.events : []);
        setBlogs(Array.isArray(json.data.blogs) ? json.data.blogs : []);
        setPodcasts(Array.isArray(json.data.podcasts) ? json.data.podcasts : []);
      } else {
        setEvents([]);
        setBlogs([]);
        setPodcasts([]);
      }
    } catch (err) {
      console.warn('[Community] Error fetching live community feed:', err);
      setEvents([]);
      setBlogs([]);
      setPodcasts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchCommunityData();
    }, [fetchCommunityData])
  );

  useEffect(() => {
    fetchCommunityData();
  }, [fetchCommunityData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCommunityData();
  };

  // RSVP / Reserve handler
  const handleRsvp = async (event: CommunityEventItem) => {
    if (requireAuth('Create an account to register for community health events and interactive webinars.')) {
      return;
    }

    try {
      setRsvpLoadingId(event.id);
      const token = await AsyncStorage.getItem('userToken');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_URL}/community/events/${event.id}/register`, {
        method: 'POST',
        headers,
      });
      const json = await res.json();

      if (json.success) {
        Alert.alert('RSVP Confirmed!', 'Your reservation has been confirmed.');
        setEvents(prev =>
          prev.map(e => (e.id === event.id ? { ...e, isRegistered: true } : e))
        );
      } else {
        Alert.alert('Registration Notice', json.message || 'Unable to complete RSVP.');
      }
    } catch {
      Alert.alert('Notice', 'Unable to reserve spot right now. Please try again.');
    } finally {
      setRsvpLoadingId(null);
    }
  };

  // Cancel RSVP handler (Allowed strictly before 1 hour of event start)
  const handleCancelRsvp = (event: CommunityEventItem) => {
    const eventTime = new Date(event.startDateTime).getTime();
    const timeUntilStartMs = !isNaN(eventTime) ? eventTime - Date.now() : 0;

    if (timeUntilStartMs <= 60 * 60 * 1000) {
      Alert.alert(
        'Cancellation Closed',
        'Reservations can only be cancelled up to 1 hour before the session starts.'
      );
      return;
    }

    Alert.alert(
      'Cancel RSVP',
      `Are you sure you want to cancel your reservation for "${event.title}"?`,
      [
        { text: 'Keep Reservation', style: 'cancel' },
        {
          text: 'Yes, Cancel RSVP',
          style: 'destructive',
          onPress: async () => {
            try {
              setRsvpLoadingId(event.id);
              const token = await AsyncStorage.getItem('userToken');
              const headers: Record<string, string> = { 'Content-Type': 'application/json' };
              if (token) headers['Authorization'] = `Bearer ${token}`;

              const res = await fetch(`${API_URL}/community/events/${event.id}/register`, {
                method: 'DELETE',
                headers,
              });
              const json = await res.json();

              if (json.success) {
                setEvents(prev =>
                  prev.map(e => (e.id === event.id ? { ...e, isRegistered: false } : e))
                );
                Alert.alert('Cancelled', 'Your reservation has been cancelled.');
              } else {
                Alert.alert('Notice', json.message || 'Unable to cancel reservation.');
              }
            } catch {
              Alert.alert('Notice', 'Unable to cancel reservation right now. Please try again.');
            } finally {
              setRsvpLoadingId(null);
            }
          },
        },
      ]
    );
  };

  // SOS Emergency Press
  const handleSosPress = async () => {
    try {
      await triggerEmergencyAlert();
    } catch (err) {
      console.warn('SOS trigger error:', err);
    }
  };

  // Responsive container width
  const isTablet = width >= 768;
  const containerMaxWidth = isTablet ? 640 : 440;

  const displayEvents = events.slice(0, 5);
  const featuredArticle = blogs.length > 0 ? blogs[0] : null;
  const featuredPodcast = podcasts.length > 0 ? podcasts[0] : null;

  return (
    <View style={styles.screen}>
      {/* Top Header */}
      <View style={{ paddingTop: insets.top, backgroundColor: 'rgba(250, 243, 235, 0.95)' }}>
        <HomeHeader
          greeting={greeting}
          userName={userName}
          userPhoto={user?.avatarUrl}
          onSosPress={handleSosPress}
        />
      </View>

      {/* Main Content */}
      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color="#FE6700" />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { maxWidth: containerMaxWidth, paddingBottom: 112 + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#FE6700"
              colors={['#FE6700']}
            />
          }
        >
          {/* ── 1. Hero Card ── */}
          <View style={styles.heroSection}>
            <CommunityHeroCard />
          </View>

          {/* ── 2. Events Section ── */}
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionCategory}>COMING UP</Text>
              <Text style={styles.sectionTitle}>Events for you</Text>
            </View>

            {displayEvents.length === 0 ? (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIconBox}>
                  <Feather name="calendar" size={24} color="#FE6700" />
                </View>
                <Text style={styles.emptyTitle}>No upcoming events scheduled</Text>
                <Text style={styles.emptySubtitle}>
                  New wellness webinars, workshops, and community sessions will appear here once announced.
                </Text>
              </View>
            ) : (
              displayEvents.map((evt, idx) => (
                <CommunityEventCard
                  key={evt.id}
                  event={evt}
                  themeIndex={idx}
                  isRsvpLoading={rsvpLoadingId === evt.id}
                  onPress={() => router.push(`/(community)/events/${evt.id}` as any)}
                  onRsvpPress={() => handleRsvp(evt)}
                  onCancelRsvp={() => handleCancelRsvp(evt)}
                />
              ))
            )}
          </View>

          {/* ── 3. Wellness Reads Section ── */}
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionCategory}>WELLNESS READS</Text>
              <Text style={styles.sectionTitle}>Read at your pace</Text>
            </View>

            {featuredArticle ? (
              <CommunityArticleCard
                article={featuredArticle}
                onPress={() => router.push(`/(community)/blogs/${featuredArticle.id}` as any)}
              />
            ) : (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIconBox}>
                  <Feather name="book-open" size={24} color="#FE6700" />
                </View>
                <Text style={styles.emptyTitle}>No wellness reads published yet</Text>
                <Text style={styles.emptySubtitle}>
                  Health articles, nutrition advice, and geriatric care guides will appear here soon.
                </Text>
              </View>
            )}
          </View>

          {/* ── 4. Listen / Today's Podcast Section ── */}
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionCategory}>LISTEN</Text>
              <Text style={styles.sectionTitle}>Today's podcast</Text>
            </View>

            {featuredPodcast ? (
              <CommunityPodcastCard
                podcast={featuredPodcast}
                onPress={() => router.push(`/(community)/podcasts/${featuredPodcast.id}` as any)}
              />
            ) : (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIconBox}>
                  <Feather name="mic" size={24} color="#FE6700" />
                </View>
                <Text style={styles.emptyTitle}>No podcasts published yet</Text>
                <Text style={styles.emptySubtitle}>
                  Audio shows, sleep guides, and elder wellness episodes will be available soon.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FAF3EB',
  },
  loaderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  heroSection: {
    marginBottom: 32,
  },
  sectionWrap: {
    marginBottom: 36,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionCategory: {
    fontFamily: 'Poppins-Bold',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.56,
    textTransform: 'uppercase',
    color: '#FE6700',
    marginBottom: 4,
  },
  sectionTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 21,
    lineHeight: 32,
    letterSpacing: -0.525,
    color: '#1F2937',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.08,
    borderColor: '#E7DED6',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#FFF0E6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    lineHeight: 22,
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontFamily: 'Poppins-Regular',
    fontSize: 13,
    lineHeight: 19,
    color: '#667085',
    textAlign: 'center',
    maxWidth: 280,
  },
});
