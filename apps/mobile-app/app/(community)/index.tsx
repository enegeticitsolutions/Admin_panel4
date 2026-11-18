import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type TabType = 'events' | 'blogs' | 'podcasts';

export default function CommunityHomeScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('events');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const [events, setEvents] = useState<any[]>([]);
  const [blogs, setBlogs] = useState<any[]>([]);
  const [podcasts, setPodcasts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [eventTimelineFilter, setEventTimelineFilter] = useState<'upcoming' | 'ongoing' | 'past'>('upcoming');

  const fetchCommunityData = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const [res, eventsRes] = await Promise.all([
        fetch(`${API_URL}/community/home`, { headers }),
        fetch(`${API_URL}/community/events?timeline=all`, { headers }).catch(() => null),
      ]);
      const json = await res.json();
      const eventsJson = eventsRes ? await eventsRes.json().catch(() => null) : null;

      if (json.success && json.data) {
        setBlogs(json.data.blogs || []);
        setPodcasts(json.data.podcasts || []);
        setCategories(json.data.categories || []);
      }

      if (eventsJson && eventsJson.success && Array.isArray(eventsJson.data) && eventsJson.data.length > 0) {
        setEvents(eventsJson.data);
      } else if (json.success && json.data?.events) {
        setEvents(json.data.events || []);
      }
    } catch (err) {
      console.warn('[Community] Failed to fetch community data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchCommunityData();
    }, [])
  );

  useEffect(() => {
    fetchCommunityData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCommunityData();
  };

  const nowTime = new Date().getTime();

  const getEventTimeline = (e: any): 'ongoing' | 'upcoming' | 'past' => {
    const start = new Date(e.startDateTime).getTime();
    const end = e.endDateTime ? new Date(e.endDateTime).getTime() : start;
    if (nowTime >= start && nowTime <= end) return 'ongoing';
    if (nowTime < start) return 'upcoming';
    return 'past';
  };

  const matchesCategory = (item: any) => {
    if (selectedCategory === 'all') return true;
    return item.categoryId === selectedCategory || item.category?.id === selectedCategory;
  };

  const upcomingEvents = events.filter((e) => getEventTimeline(e) === 'upcoming' && matchesCategory(e));
  const ongoingEvents = events.filter((e) => getEventTimeline(e) === 'ongoing' && matchesCategory(e));
  const pastEvents = events.filter((e) => getEventTimeline(e) === 'past' && matchesCategory(e));

  const filteredBlogs = blogs.filter(matchesCategory);
  const filteredPodcasts = podcasts.filter(matchesCategory);

  // Current events list based on timeline filter
  const currentEventsList =
    eventTimelineFilter === 'ongoing'
      ? ongoingEvents
      : eventTimelineFilter === 'past'
      ? pastEvents
      : upcomingEvents;

  // Segment events into "Your Events" (RSVP'd) and "More Events"
  const yourEvents = currentEventsList.filter((e) => Boolean(e.isRegistered));
  const moreEvents = currentEventsList.filter((e) => !e.isRegistered);

  const renderEventCard = (event: any, isYourEvent: boolean) => {
    const timeline = getEventTimeline(event);
    const isOngoing = timeline === 'ongoing';
    const isPast = timeline === 'past';

    return (
      <TouchableOpacity
        key={event.id}
        style={[
          styles.eventCard,
          isYourEvent && styles.yourEventCard,
          isOngoing && styles.ongoingEventCard,
        ]}
        activeOpacity={0.85}
        onPress={() => router.push(`/(community)/events/${event.id}`)}
      >
        {event.resolvedThumbnailUrl && (
          <Image
            source={{ uri: event.resolvedThumbnailUrl }}
            style={styles.eventImage}
            resizeMode="cover"
          />
        )}
        <View style={styles.eventBody}>
          <View style={styles.eventBadgeRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {isOngoing ? (
                <View style={styles.ongoingBadge}>
                  <View style={styles.pulsingDot} />
                  <Text style={styles.ongoingBadgeText}>LIVE NOW</Text>
                </View>
              ) : isPast ? (
                <View style={styles.pastBadge}>
                  <Text style={styles.pastBadgeText}>COMPLETED</Text>
                </View>
              ) : (
                <View style={[styles.typeBadge, { backgroundColor: event.eventType === 'online' ? '#EFF6FF' : '#FEF3C7' }]}>
                  <Text style={[styles.typeBadgeText, { color: event.eventType === 'online' ? '#1D4ED8' : '#B45309' }]}>
                    {event.eventType.toUpperCase()}
                  </Text>
                </View>
              )}
              {event.category && (
                <Text style={styles.eventCategoryText}>{event.category.name}</Text>
              )}
              {typeof event.ranking === 'number' && event.ranking >= 1 && event.ranking <= 5 && (
                <View style={styles.topRankBadge}>
                  <Text style={styles.topRankText}>Top {event.ranking} 🏆</Text>
                </View>
              )}
            </View>

            {isYourEvent && (
              <View style={styles.rsvpBadge}>
                <Feather name="check-circle" size={12} color="#059669" />
                <Text style={styles.rsvpBadgeText}>RSVP Confirmed</Text>
              </View>
            )}
          </View>

          <Text style={styles.eventTitle}>{event.title}</Text>
          <Text style={styles.eventDescription} numberOfLines={2}>
            {event.shortDescription}
          </Text>

          <View style={styles.eventFooter}>
            <View style={styles.eventDateGroup}>
              <Feather name="clock" size={16} color={isOngoing ? '#E11D48' : '#64748B'} />
              <Text style={[styles.eventDateText, isOngoing && { color: '#E11D48', fontFamily: 'Poppins-SemiBold' }]}>
                {new Date(event.startDateTime).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>

            <View style={styles.rsvpButtonSmall}>
              <Text
                style={[
                  styles.rsvpButtonText,
                  isYourEvent && { color: '#059669' },
                  isOngoing && { color: '#E11D48', fontFamily: 'Poppins-Bold' },
                ]}
              >
                {isOngoing
                  ? 'Join Live Now'
                  : isPast
                  ? 'View Details'
                  : isYourEvent
                  ? 'View Details'
                  : 'Details & RSVP'}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={isOngoing ? '#E11D48' : isYourEvent ? '#059669' : '#FE6700'}
              />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Community & Health</Text>
          <Text style={styles.headerSubtitle}>Events, Articles & Audio Shows</Text>
        </View>
      </View>

      {/* ── Segmented Tab Selector ── */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'events' && styles.tabItemActive]}
          onPress={() => setActiveTab('events')}
        >
          <Feather
            name="calendar"
            size={18}
            color={activeTab === 'events' ? '#FE6700' : '#64748B'}
          />
          <Text style={[styles.tabText, activeTab === 'events' && styles.tabTextActive]}>
            Events
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'blogs' && styles.tabItemActive]}
          onPress={() => setActiveTab('blogs')}
        >
          <Feather
            name="book-open"
            size={18}
            color={activeTab === 'blogs' ? '#FE6700' : '#64748B'}
          />
          <Text style={[styles.tabText, activeTab === 'blogs' && styles.tabTextActive]}>
            Articles
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'podcasts' && styles.tabItemActive]}
          onPress={() => setActiveTab('podcasts')}
        >
          <Feather
            name="mic"
            size={18}
            color={activeTab === 'podcasts' ? '#FE6700' : '#64748B'}
          />
          <Text style={[styles.tabText, activeTab === 'podcasts' && styles.tabTextActive]}>
            Podcasts
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Categories Filter Pills ── */}
      {categories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryContent}
        >
          <TouchableOpacity
            style={[
              styles.categoryPill,
              selectedCategory === 'all' && styles.categoryPillActive,
            ]}
            onPress={() => setSelectedCategory('all')}
          >
            <Text
              style={[
                styles.categoryPillText,
                selectedCategory === 'all' && styles.categoryPillTextActive,
              ]}
            >
              All Topics
            </Text>
          </TouchableOpacity>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryPill,
                selectedCategory === cat.id && styles.categoryPillActive,
              ]}
              onPress={() => setSelectedCategory(cat.id)}
            >
              <Text
                style={[
                  styles.categoryPillText,
                  selectedCategory === cat.id && styles.categoryPillTextActive,
                ]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* ── Main Content Area ── */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#FE6700" />
          <Text style={styles.loadingText}>Loading community content...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.contentScroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FE6700']} />
          }
        >
          {/* ── TAB 1: EVENTS ── */}
          {activeTab === 'events' && (
            <View>
              {/* Event Timeline Selector */}
              <View style={styles.timelineTabs}>
                <TouchableOpacity
                  style={[styles.timelineTab, eventTimelineFilter === 'upcoming' && styles.timelineTabActive]}
                  onPress={() => setEventTimelineFilter('upcoming')}
                >
                  <Text style={[styles.timelineTabText, eventTimelineFilter === 'upcoming' && styles.timelineTabTextActive]}>
                    Upcoming ({upcomingEvents.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.timelineTab,
                    eventTimelineFilter === 'ongoing' && styles.timelineTabActiveOngoing,
                  ]}
                  onPress={() => setEventTimelineFilter('ongoing')}
                >
                  {ongoingEvents.length > 0 && <View style={styles.liveIndicatorDot} />}
                  <Text
                    style={[
                      styles.timelineTabText,
                      eventTimelineFilter === 'ongoing' && styles.timelineTabTextActiveOngoing,
                    ]}
                  >
                    Ongoing ({ongoingEvents.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.timelineTab, eventTimelineFilter === 'past' && styles.timelineTabActive]}
                  onPress={() => setEventTimelineFilter('past')}
                >
                  <Text style={[styles.timelineTabText, eventTimelineFilter === 'past' && styles.timelineTabTextActive]}>
                    Past ({pastEvents.length})
                  </Text>
                </TouchableOpacity>
              </View>

              {currentEventsList.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="calendar-outline" size={48} color="#94A3B8" />
                  <Text style={styles.emptyTitle}>
                    {eventTimelineFilter === 'ongoing'
                      ? 'No Live Sessions Right Now'
                      : eventTimelineFilter === 'past'
                      ? 'No Past Events'
                      : 'No Upcoming Events'}
                  </Text>
                  <Text style={styles.emptySubtitle}>
                    {eventTimelineFilter === 'ongoing'
                      ? 'Check the Upcoming tab to discover and RSVP for scheduled webinars and sessions.'
                      : eventTimelineFilter === 'past'
                      ? 'Completed wellness sessions and webinar recordings will appear here.'
                      : 'Check back soon for interactive workshops and health sessions.'}
                  </Text>
                </View>
              ) : (
                <View>
                  {/* Highlight ongoing sessions if browsing upcoming */}
                  {eventTimelineFilter === 'upcoming' && ongoingEvents.length > 0 && (
                    <View style={styles.eventSectionGroup}>
                      <View style={styles.sectionHeader}>
                        <View style={styles.sectionTitleRow}>
                          <View style={styles.liveIndicatorDot} />
                          <Text style={[styles.sectionTitle, { color: '#E11D48' }]}>Happening Right Now</Text>
                        </View>
                        <View style={[styles.registeredCountBadge, { backgroundColor: '#FFE4E6' }]}>
                          <Text style={[styles.registeredCountText, { color: '#E11D48' }]}>
                            {ongoingEvents.length} Live
                          </Text>
                        </View>
                      </View>
                      {ongoingEvents.map((event) => renderEventCard(event, Boolean(event.isRegistered)))}
                    </View>
                  )}

                  {/* Section 1: Your Events (RSVP'd) */}
                  {yourEvents.length > 0 && (
                    <View style={styles.eventSectionGroup}>
                      <View style={styles.sectionHeader}>
                        <View style={styles.sectionTitleRow}>
                          <MaterialCommunityIcons name="calendar-check" size={20} color="#059669" />
                          <Text style={styles.sectionTitle}>
                            {eventTimelineFilter === 'past' ? 'Attended Sessions' : 'Your Events'}
                          </Text>
                        </View>
                        <View style={styles.registeredCountBadge}>
                          <Text style={styles.registeredCountText}>
                            {yourEvents.length} {eventTimelineFilter === 'past' ? 'Attended' : 'RSVP\'d'}
                          </Text>
                        </View>
                      </View>
                      {yourEvents.map((event) => renderEventCard(event, true))}
                    </View>
                  )}

                  {/* Section 2: More Events */}
                  {moreEvents.length > 0 && (
                    <View style={styles.eventSectionGroup}>
                      <View style={styles.sectionHeader}>
                        <View style={styles.sectionTitleRow}>
                          <Feather name="calendar" size={18} color="#FE6700" />
                          <Text style={styles.sectionTitle}>
                            {eventTimelineFilter === 'ongoing'
                              ? 'Live Sessions'
                              : eventTimelineFilter === 'past'
                              ? 'Past Sessions Archive'
                              : yourEvents.length > 0
                              ? 'More Events'
                              : 'Upcoming Events'}
                          </Text>
                        </View>
                        <View style={styles.moreCountBadge}>
                          <Text style={styles.moreCountText}>
                            {moreEvents.length} {eventTimelineFilter === 'past' ? 'Archived' : 'Available'}
                          </Text>
                        </View>
                      </View>
                      {moreEvents.map((event) => renderEventCard(event, false))}
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          {/* ── TAB 2: ARTICLES / BLOGS ── */}
          {activeTab === 'blogs' && (
            <View>
              {filteredBlogs.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Feather name="book-open" size={48} color="#94A3B8" />
                  <Text style={styles.emptyTitle}>No Articles Found</Text>
                  <Text style={styles.emptySubtitle}>Health articles and geriatrician tips will be available shortly.</Text>
                </View>
              ) : (
                filteredBlogs.map((blog) => (
                  <TouchableOpacity
                    key={blog.id}
                    style={styles.blogCard}
                    activeOpacity={0.85}
                    onPress={() => router.push(`/(community)/blogs/${blog.id}`)}
                  >
                    {blog.resolvedThumbnailUrl && (
                      <Image
                        source={{ uri: blog.resolvedThumbnailUrl }}
                        style={styles.blogImage}
                        resizeMode="cover"
                      />
                    )}
                    <View style={styles.blogBody}>
                      <View style={styles.blogMetaRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          {blog.category && (
                            <Text style={styles.blogCategoryPill}>{blog.category.name}</Text>
                          )}
                          {typeof blog.ranking === 'number' && blog.ranking >= 1 && blog.ranking <= 5 && (
                            <View style={styles.topRankBadge}>
                              <Text style={styles.topRankText}>Top {blog.ranking} 🏆</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.readingTimeText}>
                          {blog.readingTimeMinutes || 3} min read
                        </Text>
                      </View>

                      <Text style={styles.blogTitle}>{blog.title}</Text>
                      <Text style={styles.blogShortDesc} numberOfLines={2}>
                        {blog.shortDescription}
                      </Text>

                      <View style={styles.authorRow}>
                        {blog.author?.avatarUrl ? (
                          <Image
                            source={{ uri: blog.author.avatarUrl }}
                            style={styles.authorAvatar}
                          />
                        ) : (
                          <View style={styles.authorAvatarPlaceholder}>
                            <Text style={styles.authorInitial}>
                              {blog.author?.name ? blog.author.name[0] : 'M'}
                            </Text>
                          </View>
                        )}
                        <Text style={styles.authorName}>
                          {blog.author?.name || 'MaiHoonNa Care Team'}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          {/* ── TAB 3: PODCASTS ── */}
          {activeTab === 'podcasts' && (
            <View>
              {filteredPodcasts.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Feather name="mic" size={48} color="#94A3B8" />
                  <Text style={styles.emptyTitle}>No Podcasts Yet</Text>
                  <Text style={styles.emptySubtitle}>Listen to elder wellness shows and expert discussions soon.</Text>
                </View>
              ) : (
                filteredPodcasts.map((podcast) => (
                  <TouchableOpacity
                    key={podcast.id}
                    style={styles.podcastCard}
                    activeOpacity={0.85}
                    onPress={() => router.push(`/(community)/podcasts/${podcast.id}`)}
                  >
                    {podcast.resolvedCoverUrl ? (
                      <Image
                        source={{ uri: podcast.resolvedCoverUrl }}
                        style={styles.podcastCover}
                      />
                    ) : (
                      <View style={styles.podcastCoverPlaceholder}>
                        <Feather name="headphones" size={32} color="#FE6700" />
                      </View>
                    )}
                    <View style={styles.podcastDetails}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <Text style={styles.podcastTitle} numberOfLines={1}>{podcast.title}</Text>
                        {typeof podcast.ranking === 'number' && podcast.ranking >= 1 && podcast.ranking <= 5 && (
                          <View style={styles.topRankBadge}>
                            <Text style={styles.topRankText}>Top {podcast.ranking} 🏆</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.podcastDesc} numberOfLines={2}>
                        {podcast.description}
                      </Text>
                      <View style={styles.podcastStatsRow}>
                        <MaterialCommunityIcons name="podcast" size={16} color="#64748B" />
                        <Text style={styles.podcastEpisodeCount}>
                          {podcast.totalEpisodes || podcast._count?.episodes || 1} Episodes
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
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
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 18,
    color: '#0F172A',
  },
  headerSubtitle: {
    fontFamily: 'Poppins-Regular',
    fontSize: 12,
    color: '#64748B',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  tabItemActive: {
    backgroundColor: '#FFF7ED',
  },
  tabText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 14,
    color: '#64748B',
  },
  tabTextActive: {
    color: '#FE6700',
    fontFamily: 'Poppins-SemiBold',
  },
  categoryScroll: {
    maxHeight: 46,
    backgroundColor: '#FFFFFF',
  },
  categoryContent: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  categoryPillActive: {
    backgroundColor: '#0F172A',
  },
  categoryPillText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 12,
    color: '#475569',
  },
  categoryPillTextActive: {
    color: '#FFFFFF',
  },
  contentScroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    color: '#64748B',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    marginTop: 16,
    fontFamily: 'Poppins-SemiBold',
    fontSize: 18,
    color: '#1E293B',
  },
  emptySubtitle: {
    marginTop: 6,
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  eventCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  eventImage: {
    width: '100%',
    height: 160,
  },
  eventBody: {
    padding: 16,
  },
  eventBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 11,
  },
  eventCategoryText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 12,
    color: '#64748B',
  },
  eventTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    color: '#0F172A',
    marginBottom: 4,
  },
  eventDescription: {
    fontFamily: 'Poppins-Regular',
    fontSize: 13,
    color: '#475569',
    marginBottom: 12,
  },
  eventFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  eventDateGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eventDateText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 13,
    color: '#0F172A',
  },
  rsvpButtonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rsvpButtonText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 13,
    color: '#FE6700',
  },
  blogCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  blogImage: {
    width: '100%',
    height: 160,
  },
  blogBody: {
    padding: 16,
  },
  blogMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  blogCategoryPill: {
    fontFamily: 'Poppins-Medium',
    fontSize: 12,
    color: '#2563EB',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  readingTimeText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 12,
    color: '#64748B',
  },
  blogTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    color: '#0F172A',
    marginBottom: 6,
  },
  blogShortDesc: {
    fontFamily: 'Poppins-Regular',
    fontSize: 13,
    color: '#475569',
    marginBottom: 12,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  authorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  authorAvatarPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorInitial: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 12,
    color: '#475569',
  },
  authorName: {
    fontFamily: 'Poppins-Medium',
    fontSize: 12,
    color: '#475569',
  },
  podcastCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  podcastCover: {
    width: 72,
    height: 72,
    borderRadius: 8,
    marginRight: 12,
  },
  podcastCoverPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  podcastDetails: {
    flex: 1,
  },
  podcastTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 15,
    color: '#0F172A',
    marginBottom: 4,
  },
  podcastDesc: {
    fontFamily: 'Poppins-Regular',
    fontSize: 12,
    color: '#64748B',
    marginBottom: 6,
  },
  podcastStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  podcastEpisodeCount: {
    fontFamily: 'Poppins-Medium',
    fontSize: 12,
    color: '#64748B',
  },
  eventSectionGroup: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
    color: '#0F172A',
  },
  registeredCountBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  registeredCountText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 11,
    color: '#059669',
  },
  moreCountBadge: {
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  moreCountText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 11,
    color: '#EA580C',
  },
  yourEventCard: {
    borderColor: '#A7F3D0',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
  },
  rsvpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  rsvpBadgeText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 11,
    color: '#059669',
  },
  topRankBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  topRankText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 11,
    color: '#B45309',
  },
  timelineTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  timelineTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  timelineTabActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  timelineTabActiveOngoing: {
    backgroundColor: '#FFE4E6',
    borderColor: '#F43F5E',
  },
  timelineTabText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 12,
    color: '#64748B',
  },
  timelineTabTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Poppins-SemiBold',
  },
  timelineTabTextActiveOngoing: {
    color: '#E11D48',
    fontFamily: 'Poppins-Bold',
  },
  liveIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E11D48',
    marginRight: 6,
  },
  ongoingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFE4E6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  pulsingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E11D48',
  },
  ongoingBadgeText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 10,
    color: '#E11D48',
    letterSpacing: 0.5,
  },
  pastBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pastBadgeText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 10,
    color: '#64748B',
  },
  ongoingEventCard: {
    borderColor: '#FECDD3',
    borderWidth: 1.5,
    backgroundColor: '#FFFBFB',
  },
});

