import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Alert,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/AuthContext';
import { HomeHeader } from '@/components/dashboard/HomeHeader';
import { HomeColors } from '@/constants/homeTheme';
import { API_URL } from '@/constants/api';
import {
    triggerEmergencyAlert,
    dialEmergencyHelpline,
    EMERGENCY_HELPLINE_NUMBER,
} from '@/services/emergencyTrigger';
import {
    CommunityHeroBanner,
    EventCard,
    WellnessReadCard,
    PodcastPlayerCard,
} from '@/components/community';

// ─── API Response Types ───────────────────────────────────────────────────────

interface ApiCategory {
    id: string;
    name: string;
    slug: string;
    color?: string;
}

interface ApiHost {
    id: string;
    name: string;
    designation?: string;
}

interface ApiEvent {
    id: string;
    title: string;
    shortDescription?: string;
    startDateTime: string;
    endDateTime?: string;
    eventType: 'online' | 'offline' | 'hybrid';
    venueName?: string | null;
    timelineStatus: 'upcoming' | 'ongoing' | 'past';
    isRegistered: boolean;
    resolvedThumbnailUrl?: string | null;
    category?: ApiCategory | null;
    host?: ApiHost | null;
}

interface ApiAuthor {
    id: string;
    name: string;
    designation?: string;
    avatarUrl?: string | null;
}

interface ApiBlog {
    id: string;
    title: string;
    shortDescription?: string;
    readingTimeMinutes?: number;
    resolvedThumbnailUrl?: string | null;
    category?: ApiCategory | null;
    author?: ApiAuthor | null;
}

interface ApiPodcast {
    id: string;
    title: string;
    description?: string;
    resolvedCoverUrl?: string | null;
    host?: { id: string; name: string } | null;
    _count?: { episodes: number };
    totalEpisodes?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
}

function formatEventDate(isoString: string): string {
    const d = new Date(isoString);
    const day = d.getDate();
    const month = d.toLocaleString('en-IN', { month: 'short' }).toUpperCase();
    return `${day} ${month}`;
}

function formatEventTime(isoString: string): string {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function buildTimeVenue(event: ApiEvent): string {
    const time = formatEventTime(event.startDateTime);
    if (event.eventType === 'online' || event.eventType === 'hybrid') {
        return `${time} · Live on video`;
    }
    return `${time} · ${event.venueName || 'Community Hall'}`;
}

function buildCtaLabel(event: ApiEvent): string {
    if (event.timelineStatus === 'ongoing') return 'Join Live Now';
    if (event.isRegistered) return '✓ Registered · View';
    return event.eventType === 'online' ? 'RSVP / Join session' : 'Reserve my spot';
}

function formatDuration(seconds: number): string {
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function CommunityScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { user } = useAuth();

    const [triggeringSos, setTriggeringSos] = useState(false);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [registeringId, setRegisteringId] = useState<string | null>(null);

    const [events, setEvents] = useState<ApiEvent[]>([]);
    const [blogs, setBlogs] = useState<ApiBlog[]>([]);
    const [podcasts, setPodcasts] = useState<ApiPodcast[]>([]);

    // Derive display name
    const userName =
        (user as { name?: string; full_name?: string } | null)?.name ||
        (user as { name?: string; full_name?: string } | null)?.full_name ||
        'Friend';
    const greeting = getGreeting();

    // ── Fetch community home data ─────────────────────────────────────────────
    const fetchData = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const token = await AsyncStorage.getItem('userToken');
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`${API_URL}/community/home`, { headers });
            const json = await res.json();

            if (json.success && json.data) {
                setEvents(json.data.events || []);
                setBlogs(json.data.blogs || []);
                setPodcasts(json.data.podcasts || []);
            }
        } catch (err) {
            console.warn('[Community] fetch error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

    const onRefresh = () => {
        setRefreshing(true);
        fetchData(true);
    };

    // ── RSVP / Registration ──────────────────────────────────────────────────
    const handleEventCta = useCallback(async (event: ApiEvent) => {
        // If already registered or ongoing, navigate to detail
        if (event.isRegistered || event.timelineStatus === 'ongoing') {
            router.push(`/(community)/events/${event.id}` as any);
            return;
        }

        Alert.alert(
            event.title,
            'Register for this event?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Register',
                    onPress: async () => {
                        setRegisteringId(event.id);
                        try {
                            const token = await AsyncStorage.getItem('userToken');
                            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                            if (token) headers['Authorization'] = `Bearer ${token}`;

                            const res = await fetch(`${API_URL}/community/events/${event.id}/register`, {
                                method: 'POST',
                                headers,
                            });
                            const json = await res.json();

                            if (json.success) {
                                Alert.alert(
                                    '🎉 Registered!',
                                    json.data?.registration?.status === 'waitlisted'
                                        ? "You're on the waitlist. We'll notify you if a spot opens up."
                                        : "You're confirmed! We'll send a reminder before the session.",
                                    [{ text: 'Got it', onPress: () => fetchData(true) }],
                                );
                            } else {
                                Alert.alert('Registration failed', json.message || 'Please try again.');
                            }
                        } catch {
                            Alert.alert('Error', 'Could not register. Please try again later.');
                        } finally {
                            setRegisteringId(null);
                        }
                    },
                },
            ],
        );
    }, [fetchData, router]);

    // ── SOS ───────────────────────────────────────────────────────────────────
    const handleSosPress = useCallback(async () => {
        Alert.alert(
            'Emergency SOS',
            'Send an emergency alert to your care circle?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Send Alert',
                    style: 'destructive',
                    onPress: async () => {
                        setTriggeringSos(true);
                        try {
                            await triggerEmergencyAlert();
                        } catch {
                            Alert.alert(
                                'Alert sent',
                                `If you need immediate help, call ${EMERGENCY_HELPLINE_NUMBER}`,
                                [
                                    { text: 'OK' },
                                    { text: `Call ${EMERGENCY_HELPLINE_NUMBER}`, onPress: () => dialEmergencyHelpline() },
                                ],
                            );
                        } finally {
                            setTriggeringSos(false);
                        }
                    },
                },
            ],
        );
    }, []);

    // ── Featured items ────────────────────────────────────────────────────────
    // Show up to 3 upcoming/ongoing events
    const featuredEvents = events
        .filter(e => e.timelineStatus !== 'past')
        .slice(0, 3);

    // First published blog
    const featuredBlog = blogs[0] ?? null;

    // First podcast
    const featuredPodcast = podcasts[0] ?? null;

    // ─────────────────────────────────────────────────────────────────────────

    return (
        <View style={[styles.root, { paddingTop: insets.top }]}>
            {/* Sticky header */}
            <HomeHeader
                greeting={greeting}
                userName={userName}
                onSosPress={handleSosPress}
                triggeringSos={triggeringSos}
            />

            {/* Loading state */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={HomeColors.brandOrange} />
                    <Text style={styles.loadingText}>Loading community...</Text>
                </View>
            ) : (
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={[
                        styles.scrollContent,
                        { paddingBottom: Math.max(insets.bottom + 80, 112) },
                    ]}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={[HomeColors.brandOrange]}
                            tintColor={HomeColors.brandOrange}
                        />
                    }
                >
                    {/* ── Hero ───────────────────────────────────────── */}
                    <CommunityHeroBanner />

                    {/* ── Coming Up / Events ─────────────────────────── */}
                    <View style={styles.section}>
                        <Text style={styles.sectionOverline}>COMING UP</Text>
                        <Text style={styles.sectionHeading}>Events for you</Text>

                        {featuredEvents.length === 0 ? (
                            <View style={styles.emptyCard}>
                                <Text style={styles.emptyText}>No upcoming events right now.</Text>
                                <Text style={styles.emptySubText}>Check back soon for sessions and workshops.</Text>
                            </View>
                        ) : (
                            <View style={styles.cardStack}>
                                {featuredEvents.map(event => (
                                    <EventCard
                                        key={event.id}
                                        id={event.id}
                                        title={event.title}
                                        shortDescription={event.shortDescription}
                                        date={formatEventDate(event.startDateTime)}
                                        timeVenue={buildTimeVenue(event)}
                                        ctaLabel={
                                            registeringId === event.id
                                                ? 'Registering...'
                                                : buildCtaLabel(event)
                                        }
                                        isRegistered={event.isRegistered}
                                        timelineStatus={event.timelineStatus}
                                        thumbnailUrl={event.resolvedThumbnailUrl}
                                        onPress={() => router.push(`/(community)/events/${event.id}` as any)}
                                        onCta={() => handleEventCta(event)}
                                    />
                                ))}
                            </View>
                        )}
                    </View>

                    {/* ── Wellness Reads ─────────────────────────────── */}
                    {featuredBlog && (
                        <View style={styles.section}>
                            <Text style={styles.sectionOverline}>WELLNESS READS</Text>
                            <Text style={styles.sectionHeading}>Read at your pace</Text>

                            <View style={styles.cardStack}>
                                <WellnessReadCard
                                    category={featuredBlog.category?.name ?? 'Wellness'}
                                    readTime={`${featuredBlog.readingTimeMinutes ?? 5} MIN`}
                                    title={featuredBlog.title}
                                    description={featuredBlog.shortDescription ?? ''}
                                    thumbnailUrl={featuredBlog.resolvedThumbnailUrl}
                                    onRead={() => router.push(`/(community)/blogs/${featuredBlog.id}` as any)}
                                />
                            </View>
                        </View>
                    )}

                    {/* ── Podcast ────────────────────────────────────── */}
                    {featuredPodcast && (
                        <View style={styles.section}>
                            <Text style={styles.sectionOverline}>LISTEN</Text>
                            <Text style={styles.sectionHeading}>Today's podcast</Text>

                            <View style={styles.cardStack}>
                                <PodcastPlayerCard
                                    podcastId={featuredPodcast.id}
                                    title={featuredPodcast.title}
                                    authorDuration={
                                        featuredPodcast.host?.name
                                            ? `${featuredPodcast.host.name} · ${featuredPodcast._count?.episodes ?? featuredPodcast.totalEpisodes ?? 1} ep`
                                            : `${featuredPodcast._count?.episodes ?? featuredPodcast.totalEpisodes ?? 1} episodes`
                                    }
                                    coverUrl={featuredPodcast.resolvedCoverUrl}
                                    onPress={() => router.push(`/(community)/podcasts/${featuredPodcast.id}` as any)}
                                />
                            </View>
                        </View>
                    )}

                    {/* Empty state when all sections are empty */}
                    {featuredEvents.length === 0 && !featuredBlog && !featuredPodcast && (
                        <View style={styles.globalEmpty}>
                            <Text style={styles.globalEmptyTitle}>Nothing here yet</Text>
                            <Text style={styles.globalEmptyText}>
                                The admin team is building great content — check back soon!
                            </Text>
                        </View>
                    )}
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: HomeColors.pageBackground,
    },
    scroll: {
        flex: 1,
        backgroundColor: HomeColors.pageBackground,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 20,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    loadingText: {
        fontFamily: 'Poppins-Regular',
        fontSize: 14,
        color: HomeColors.textMuted,
    },

    // ── Section header ──
    section: {
        marginTop: 32,
        width: '100%',
    },
    sectionOverline: {
        fontFamily: 'Poppins-Bold',
        fontSize: 12,
        lineHeight: 16,
        letterSpacing: 1.56,
        textTransform: 'uppercase',
        color: HomeColors.brandOrange,
    },
    sectionHeading: {
        marginTop: 4,
        fontFamily: 'Poppins-SemiBold',
        fontSize: 21,
        lineHeight: 32,
        letterSpacing: -0.525,
        color: HomeColors.textPrimary,
    },
    cardStack: {
        marginTop: 16,
        gap: 16,
    },

    // ── Empty states ──
    emptyCard: {
        marginTop: 16,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 24,
        borderWidth: 1.08,
        borderColor: '#E7DED6',
        alignItems: 'center',
    },
    emptyText: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 15,
        color: HomeColors.textPrimary,
    },
    emptySubText: {
        marginTop: 4,
        fontFamily: 'Poppins-Regular',
        fontSize: 13,
        color: HomeColors.textMuted,
        textAlign: 'center',
    },
    globalEmpty: {
        marginTop: 60,
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    globalEmptyTitle: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 18,
        color: HomeColors.textPrimary,
    },
    globalEmptyText: {
        marginTop: 8,
        fontFamily: 'Poppins-Regular',
        fontSize: 14,
        color: HomeColors.textMuted,
        textAlign: 'center',
        lineHeight: 22,
    },
});
