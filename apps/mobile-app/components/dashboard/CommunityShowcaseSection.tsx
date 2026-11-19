import React, { useRef, useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    Animated,
    Dimensions,
    NativeSyntheticEvent,
    NativeScrollEvent,
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export interface CommunityShowcaseSectionProps {
    events: any[];
    loading?: boolean;
    horizontalGutter?: number;
    onEventPress: (eventId: string) => void;
    onExplorePress: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.min(Math.round(SCREEN_WIDTH * 0.80), 330);
const CARD_GAP = 14;
const SNAP_INTERVAL = CARD_WIDTH + CARD_GAP;
const SIDE_SPACER = (SCREEN_WIDTH - CARD_WIDTH) / 2;

export const CommunityShowcaseSection: React.FC<CommunityShowcaseSectionProps> = ({
    events = [],
    loading = false,
    horizontalGutter = 16,
    onEventPress,
    onExplorePress,
}) => {
    const nowTime = Date.now();
    const scrollX = useRef(new Animated.Value(0)).current;
    const scrollViewRef = useRef<Animated.ScrollView>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const isInteracting = useRef(false);
    const resumeTimeout = useRef<NodeJS.Timeout | null>(null);

    const getTimeline = (event: any): 'ongoing' | 'upcoming' | 'past' => {
        const start = new Date(event.startDateTime).getTime();
        const end = event.endDateTime ? new Date(event.endDateTime).getTime() : start;
        if (nowTime >= start && nowTime <= end) return 'ongoing';
        if (nowTime < start) return 'upcoming';
        return 'past';
    };

    // Filter to active/upcoming events only and take top 5
    const showcaseEvents = events
        .filter((e) => getTimeline(e) !== 'past')
        .slice(0, 5);

    // ── Auto-Sliding Loop (Every 3.8s) ──
    useEffect(() => {
        if (showcaseEvents.length <= 1) return;

        const interval = setInterval(() => {
            if (isInteracting.current) return;

            setActiveIndex((prevIndex) => {
                const nextIndex = (prevIndex + 1) % showcaseEvents.length;
                scrollViewRef.current?.scrollTo({
                    x: nextIndex * SNAP_INTERVAL,
                    animated: true,
                });
                return nextIndex;
            });
        }, 3800);

        return () => clearInterval(interval);
    }, [showcaseEvents.length]);

    const handleScrollBeginDrag = () => {
        isInteracting.current = true;
        if (resumeTimeout.current) clearTimeout(resumeTimeout.current);
    };

    const handleMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const offsetX = e.nativeEvent.contentOffset.x;
        const newIndex = Math.round(offsetX / SNAP_INTERVAL);
        const clampedIndex = Math.max(0, Math.min(newIndex, showcaseEvents.length - 1));
        setActiveIndex(clampedIndex);

        // Resume auto-slide 3.5 seconds after user releases touch
        if (resumeTimeout.current) clearTimeout(resumeTimeout.current);
        resumeTimeout.current = setTimeout(() => {
            isInteracting.current = false;
        }, 3500);
    };

    return (
        <View style={styles.container}>
            {/* ── Section Header ── */}
            <View style={styles.sectionHeader}>
                <View style={{ flex: 1 }}>
                    <View style={styles.titleRow}>
                        <View style={styles.headerIconBadge}>
                            <Ionicons name="people" size={16} color="#FE6700" />
                        </View>
                        <Text style={styles.sectionTitle}>Community</Text>
                    </View>
                    <Text style={styles.sectionSubtitle}>
                        Webinars, wellness workshops & interactive sessions
                    </Text>
                </View>

                <TouchableOpacity
                    style={styles.seeAllButton}
                    onPress={onExplorePress}
                    activeOpacity={0.7}
                >
                    <Text style={styles.seeAllText}>See All</Text>
                    <Ionicons name="chevron-forward" size={14} color="#FE6700" />
                </TouchableOpacity>
            </View>

            {/* ── Sliding Content Area ── */}
            {loading ? (
                <View style={styles.loaderContainer}>
                    <ActivityIndicator size="small" color="#FE6700" />
                    <Text style={styles.loaderText}>Loading showcase events...</Text>
                </View>
            ) : showcaseEvents.length === 0 ? (
                /* Empty Fallback Card */
                <View style={styles.emptyCard}>
                    <View style={styles.emptyIconCircle}>
                        <Feather name="calendar" size={24} color="#94A3B8" />
                    </View>
                    <View style={styles.emptyTextCol}>
                        <Text style={styles.emptyTitle}>New sessions coming soon</Text>
                        <Text style={styles.emptyDesc}>
                            Explore medical articles, doctor guides & wellness podcasts in the hub.
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={styles.emptyCtaBtn}
                        onPress={onExplorePress}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.emptyCtaText}>Explore</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={{ marginHorizontal: -horizontalGutter }}>
                    {/* Horizontal Animated Depth Carousel: Center focused, sides peeking with shadow & scale */}
                    <Animated.ScrollView
                        ref={scrollViewRef}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={[
                            styles.scrollContent,
                            { paddingHorizontal: SIDE_SPACER },
                        ]}
                        snapToInterval={SNAP_INTERVAL}
                        decelerationRate="fast"
                        scrollEventThrottle={16}
                        onScroll={Animated.event(
                            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                            { useNativeDriver: true }
                        )}
                        onScrollBeginDrag={handleScrollBeginDrag}
                        onMomentumScrollEnd={handleMomentumScrollEnd}
                    >
                        {showcaseEvents.map((event, index) => {
                            const timeline = getTimeline(event);
                            const isOngoing = timeline === 'ongoing';
                            const isRegistered = Boolean(event.isRegistered);

                            // Animated depth: Center card scale 1.0 + opacity 1.0; Left/Right peek cards scale 0.90 + opacity 0.55
                            const inputRange = [
                                (index - 1) * SNAP_INTERVAL,
                                index * SNAP_INTERVAL,
                                (index + 1) * SNAP_INTERVAL,
                            ];

                            const scale = scrollX.interpolate({
                                inputRange,
                                outputRange: [0.90, 1.0, 0.90],
                                extrapolate: 'clamp',
                            });

                            const opacity = scrollX.interpolate({
                                inputRange,
                                outputRange: [0.55, 1.0, 0.55],
                                extrapolate: 'clamp',
                            });

                            const translateY = scrollX.interpolate({
                                inputRange,
                                outputRange: [6, 0, 6],
                                extrapolate: 'clamp',
                            });

                            return (
                                <Animated.View
                                    key={event.id}
                                    style={[
                                        styles.cardWrapper,
                                        {
                                            width: CARD_WIDTH,
                                            marginRight: index === showcaseEvents.length - 1 ? 0 : CARD_GAP,
                                            transform: [{ scale }, { translateY }],
                                            opacity,
                                        },
                                    ]}
                                >
                                    <TouchableOpacity
                                        style={[
                                            styles.eventCard,
                                            isOngoing && styles.ongoingCard,
                                            isRegistered && styles.registeredCard,
                                        ]}
                                        onPress={() => onEventPress(event.id)}
                                        activeOpacity={0.92}
                                    >
                                        {/* Large Thumbnail Image or Gradient Fallback */}
                                        <View style={styles.imageContainer}>
                                            {event.resolvedThumbnailUrl ? (
                                                <Image
                                                    source={{ uri: event.resolvedThumbnailUrl }}
                                                    style={styles.thumbnail}
                                                    resizeMode="cover"
                                                />
                                            ) : (
                                                <View style={styles.thumbnailPlaceholder}>
                                                    <MaterialCommunityIcons
                                                        name="account-group"
                                                        size={46}
                                                        color="#FDBA74"
                                                    />
                                                </View>
                                            )}

                                            {/* Top Overlay Badges */}
                                            <View style={styles.badgeOverlayRow}>
                                                <View style={styles.badgeLeftGroup}>
                                                    {isOngoing ? (
                                                        <View style={styles.liveBadge}>
                                                            <View style={styles.pulsingDot} />
                                                            <Text style={styles.liveBadgeText}>LIVE NOW</Text>
                                                        </View>
                                                    ) : (
                                                        <View style={styles.typeBadge}>
                                                            <Text style={styles.typeBadgeText}>
                                                                {(event.eventType || 'ONLINE').toUpperCase()}
                                                            </Text>
                                                        </View>
                                                    )}

                                                    {typeof event.ranking === 'number' &&
                                                        event.ranking >= 1 &&
                                                        event.ranking <= 5 && (
                                                            <View style={styles.rankBadge}>
                                                                <Text style={styles.rankBadgeText}>
                                                                    Top {event.ranking} 🏆
                                                                </Text>
                                                            </View>
                                                        )}
                                                </View>

                                                {isRegistered && (
                                                    <View style={styles.rsvpBadge}>
                                                        <Feather name="check-circle" size={11} color="#059669" />
                                                        <Text style={styles.rsvpBadgeText}>RSVP'd</Text>
                                                    </View>
                                                )}
                                            </View>
                                        </View>

                                        {/* Card Content Body */}
                                        <View style={styles.cardBody}>
                                            {event.category && (
                                                <Text style={styles.categoryText} numberOfLines={1}>
                                                    {event.category.name}
                                                </Text>
                                            )}

                                            <Text style={styles.eventTitle} numberOfLines={2}>
                                                {event.title}
                                            </Text>

                                            {event.shortDescription ? (
                                                <Text style={styles.eventDesc} numberOfLines={2}>
                                                    {event.shortDescription}
                                                </Text>
                                            ) : null}

                                            {/* Footer with Date & Action Pill */}
                                            <View style={styles.cardFooter}>
                                                <View style={styles.dateCol}>
                                                    <Feather
                                                        name="clock"
                                                        size={14}
                                                        color={isOngoing ? '#E11D48' : '#64748B'}
                                                    />
                                                    <Text
                                                        style={[
                                                            styles.dateText,
                                                            isOngoing && styles.dateTextOngoing,
                                                        ]}
                                                        numberOfLines={1}
                                                    >
                                                        {new Date(event.startDateTime).toLocaleDateString(
                                                            'en-IN',
                                                            {
                                                                day: 'numeric',
                                                                month: 'short',
                                                                hour: '2-digit',
                                                                minute: '2-digit',
                                                            }
                                                        )}
                                                    </Text>
                                                </View>

                                                <View style={styles.actionPill}>
                                                    <Text
                                                        style={[
                                                            styles.actionPillText,
                                                            isOngoing && { color: '#E11D48' },
                                                            isRegistered && { color: '#059669' },
                                                        ]}
                                                    >
                                                        {isOngoing
                                                            ? 'Join Now'
                                                            : isRegistered
                                                            ? 'Details'
                                                            : 'RSVP'}
                                                    </Text>
                                                    <Ionicons
                                                        name="chevron-forward"
                                                        size={14}
                                                        color={
                                                            isOngoing
                                                                ? '#E11D48'
                                                                : isRegistered
                                                                ? '#059669'
                                                                : '#FE6700'
                                                        }
                                                    />
                                                </View>
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                </Animated.View>
                            );
                        })}
                    </Animated.ScrollView>

                    {/* Pagination Indicator Dots */}
                    {showcaseEvents.length > 1 && (
                        <View style={styles.paginationRow}>
                            {showcaseEvents.map((_, idx) => (
                                <View
                                    key={idx}
                                    style={[
                                        styles.dot,
                                        activeIndex === idx && styles.activeDot,
                                    ]}
                                />
                            ))}
                        </View>
                    )}
                </View>
            )}

            {/* ── More Button / Explore Community Hub Banner ── */}
            <TouchableOpacity
                style={styles.exploreBanner}
                onPress={onExplorePress}
                activeOpacity={0.82}
            >
                <View style={styles.exploreLeft}>
                    <View style={styles.exploreIconCircle}>
                        <Ionicons name="sparkles" size={18} color="#FE6700" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.exploreTitle}>Explore Community Hub</Text>
                        <Text style={styles.exploreSubtitle} numberOfLines={1}>
                            Discover health blogs, doctor podcasts & all events
                        </Text>
                    </View>
                </View>

                <View style={styles.exploreRightBadge}>
                    <Text style={styles.exploreRightText}>More</Text>
                    <Ionicons name="arrow-forward" size={14} color="#FE6700" />
                </View>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        paddingHorizontal: 2,
        marginBottom: 12,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    headerIconBadge: {
        width: 26,
        height: 26,
        borderRadius: 8,
        backgroundColor: '#FFF7ED',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sectionTitle: {
        fontFamily: 'Poppins-Bold',
        fontSize: 18,
        color: '#0F172A',
        lineHeight: 24,
    },
    sectionSubtitle: {
        fontFamily: 'Poppins-Regular',
        fontSize: 12,
        color: '#64748B',
        marginTop: 2,
    },
    seeAllButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        paddingVertical: 4,
        paddingHorizontal: 8,
    },
    seeAllText: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 13,
        color: '#FE6700',
    },
    loaderContainer: {
        height: 180,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        gap: 8,
    },
    loaderText: {
        fontFamily: 'Poppins-Regular',
        fontSize: 12,
        color: '#94A3B8',
    },
    emptyCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        gap: 12,
    },
    emptyIconCircle: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyTextCol: {
        flex: 1,
    },
    emptyTitle: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 14,
        color: '#0F172A',
        marginBottom: 2,
    },
    emptyDesc: {
        fontFamily: 'Poppins-Regular',
        fontSize: 12,
        color: '#64748B',
        lineHeight: 16,
    },
    emptyCtaBtn: {
        backgroundColor: '#FFF7ED',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#FED7AA',
    },
    emptyCtaText: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 12,
        color: '#EA580C',
    },
    scrollContent: {
        paddingVertical: 14,
    },
    cardWrapper: {
        // Depth shadow effect: Center card pops out, sides sit behind
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.16,
        shadowRadius: 16,
        elevation: 6,
    },
    eventCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    ongoingCard: {
        borderColor: '#FECDD3',
        borderWidth: 2,
    },
    registeredCard: {
        borderColor: '#A7F3D0',
        borderWidth: 1.5,
    },
    imageContainer: {
        width: '100%',
        height: 165,
        backgroundColor: '#FFF7ED',
        position: 'relative',
    },
    thumbnail: {
        width: '100%',
        height: '100%',
    },
    thumbnailPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: '#FFF7ED',
        alignItems: 'center',
        justifyContent: 'center',
    },
    badgeOverlayRow: {
        position: 'absolute',
        top: 10,
        left: 10,
        right: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    badgeLeftGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
    },
    typeBadge: {
        backgroundColor: 'rgba(15, 23, 42, 0.80)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    typeBadgeText: {
        fontFamily: 'Poppins-Bold',
        fontSize: 10,
        color: '#FFFFFF',
        letterSpacing: 0.4,
    },
    liveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#FFE4E6',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#FECDD3',
    },
    pulsingDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#E11D48',
    },
    liveBadgeText: {
        fontFamily: 'Poppins-Bold',
        fontSize: 10,
        color: '#E11D48',
        letterSpacing: 0.4,
    },
    rankBadge: {
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#FDE68A',
    },
    rankBadgeText: {
        fontFamily: 'Poppins-Bold',
        fontSize: 10.5,
        color: '#B45309',
    },
    rsvpBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#A7F3D0',
    },
    rsvpBadgeText: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 10.5,
        color: '#059669',
    },
    cardBody: {
        padding: 15,
    },
    categoryText: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 11,
        color: '#2563EB',
        marginBottom: 3,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    eventTitle: {
        fontFamily: 'Poppins-Bold',
        fontSize: 16,
        color: '#0F172A',
        lineHeight: 22,
        marginBottom: 4,
    },
    eventDesc: {
        fontFamily: 'Poppins-Regular',
        fontSize: 12.5,
        color: '#475569',
        lineHeight: 18,
        marginBottom: 12,
    },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
    },
    dateCol: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flex: 1,
    },
    dateText: {
        fontFamily: 'Poppins-Medium',
        fontSize: 12,
        color: '#475569',
    },
    dateTextOngoing: {
        color: '#E11D48',
        fontFamily: 'Poppins-SemiBold',
    },
    actionPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    actionPillText: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 12.5,
        color: '#FE6700',
    },
    paginationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 4,
        marginBottom: 6,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#CBD5E1',
    },
    activeDot: {
        width: 20,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#FE6700',
    },
    exploreBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 14,
        marginTop: 10,
        borderWidth: 1,
        borderColor: '#FED7AA',
        shadowColor: '#FE6700',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 1,
    },
    exploreLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    exploreIconCircle: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#FFF7ED',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#FFEDD5',
    },
    exploreTitle: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 13,
        color: '#0F172A',
    },
    exploreSubtitle: {
        fontFamily: 'Poppins-Regular',
        fontSize: 11,
        color: '#64748B',
        marginTop: 1,
    },
    exploreRightBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#FFF7ED',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
    },
    exploreRightText: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 12,
        color: '#EA580C',
    },
});
