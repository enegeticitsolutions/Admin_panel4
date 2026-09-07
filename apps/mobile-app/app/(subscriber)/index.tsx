import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Image, Platform, Animated, Dimensions, Modal, ActivityIndicator, ImageBackground, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { API_URL } from '@/constants/api';
import { useAuth } from '@/contexts/AuthContext';
import { CallbackButton } from '@/components/CallbackButton';
import { logoutWithConfirm } from '@/utils/logout';
import { formatHours } from '@/utils/timeFormat';
import GlobalDrawer from './components/shared/GlobalDrawer';
import { SafeAreaView } from 'react-native-safe-area-context';
import NotificationBell from '@/components/shared/NotificationBell';
import { useExitOnBack } from '@/hooks/useExitOnBack';
import { sanitizeImageUri } from '@/utils/sanitizeImageUri';

const { width, height } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.75;

import { scale, vscale } from '@/utils/responsive';
const HORIZONTAL_PADDING = scale(20);
const CARD_GAP = scale(12);

export default function SubscriberDashboardScreen() {
    useExitOnBack();
    const router = useRouter();
    const { availableRoles, switchRole, isSwitchingRole } = useAuth();

    const [userData, setUserData] = useState<any>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const drawerAnim = useRef(new Animated.Value(DRAWER_WIDTH)).current;
    const benScaleAnim = useRef(new Animated.Value(1)).current;
    const { highlightBen } = useLocalSearchParams();

    const [linkModalVisible, setLinkModalVisible] = useState(false);
    const [selectedUnlinkedSubId, setSelectedUnlinkedSubId] = useState<string | null>(null);
    const [isLinking, setIsLinking] = useState(false);
    const pullAnim = useRef(new Animated.Value(0)).current;

    const handleSwitchToBeneficiary = async () => {
        try {
            await switchRole('beneficiary');
            router.replace('/(beneficiary)');
        } catch (err: any) {
            Alert.alert('Switch Failed', err?.message || 'Could not switch to beneficiary profile.');
        }
    };

    useEffect(() => {
        if (highlightBen) {
            Animated.sequence([
                Animated.timing(benScaleAnim, { toValue: 1.05, duration: 250, useNativeDriver: true }),
                Animated.timing(benScaleAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
                Animated.timing(benScaleAnim, { toValue: 1.05, duration: 250, useNativeDriver: true }),
                Animated.timing(benScaleAnim, { toValue: 1, duration: 250, useNativeDriver: true })
            ]).start();
        }
    }, [highlightBen]);

    const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState<string | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        const init = async () => {
            const storedUser = await AsyncStorage.getItem('userData');
            if (storedUser) setUserData(JSON.parse(storedUser));
            
            const storedBenId = await AsyncStorage.getItem('selectedBeneficiaryId');
            if (storedBenId) setSelectedBeneficiaryId(storedBenId);
            
            setIsInitialized(true);
        };
        init();
    }, []);

    /* ─── API (React Query & Local Cache) ─────────────────────────────────────────────── */
    const {
        data: dashboard,
        isLoading: loading,
        refetch,
        isRefetching: refreshing
    } = useQuery({
        queryKey: ['subscriberDashboard', selectedBeneficiaryId],
        enabled: isInitialized,
        staleTime: 0,
        queryFn: async () => {
            const storedToken = await AsyncStorage.getItem('userToken');
            if (!storedToken) throw new Error("Auth missing");

            let url = `${API_URL}/subscriber/dashboard/me`;
            if (selectedBeneficiaryId) {
                url += `?beneficiaryId=${selectedBeneficiaryId}`;
            }

            // Check custom local cache first
            const cacheKey = 'beneficiaryDashboardCache';
            const cacheRaw = await AsyncStorage.getItem(cacheKey);
            let cache = cacheRaw ? JSON.parse(cacheRaw) : {};

            if (selectedBeneficiaryId && cache[selectedBeneficiaryId]) {
                const cachedData = cache[selectedBeneficiaryId];
                const ageMs = Date.now() - (cachedData.lastUpdated || 0);
                
                // If cache is under 30 seconds old, return instantly (prevents rapid tab-switch hammering)
                if (ageMs < 30 * 1000) {
                    return cachedData.response;
                }
            }

            const res = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${storedToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!res.ok) throw new Error("Failed to fetch");
            const data = await res.json();
            
            if (data.success) {
                // Save to local cache
                if (selectedBeneficiaryId) {
                    cache[selectedBeneficiaryId] = {
                        lastUpdated: Date.now(),
                        response: data
                    };
                    await AsyncStorage.setItem(cacheKey, JSON.stringify(cache));
                }
                return data;
            } else {
                throw new Error("Failed to fetch data");
            }
        }
    });

    useFocusEffect(
        useCallback(() => {
            if (isInitialized) {
                refetch();
            }
        }, [isInitialized, refetch])
    );

    // Fallback logic: Ensure valid selection
    useEffect(() => {
        if (dashboard?.beneficiaries?.length > 0) {
            const isValid = dashboard.beneficiaries.some((b: any) => b.id === selectedBeneficiaryId);
            if (!isValid) {
                const sorted = [...dashboard.beneficiaries].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                const newId = sorted[0].id;
                setSelectedBeneficiaryId(newId);
                AsyncStorage.setItem('selectedBeneficiaryId', newId);
            }
        }
    }, [dashboard?.beneficiaries, selectedBeneficiaryId]);

    const onRefresh = () => {
        // Manually invalidate custom cache on pull-to-refresh
        if (selectedBeneficiaryId) {
            AsyncStorage.getItem('beneficiaryDashboardCache').then(cacheRaw => {
                if (cacheRaw) {
                    let cache = JSON.parse(cacheRaw);
                    delete cache[selectedBeneficiaryId];
                    AsyncStorage.setItem('beneficiaryDashboardCache', JSON.stringify(cache)).then(() => refetch());
                } else {
                    refetch();
                }
            });
        } else {
            refetch();
        }
    };

    useFocusEffect(
        useCallback(() => {
            refetch();
        }, [refetch])
    );

    useEffect(() => {
        if (!refreshing) {
            Animated.timing(pullAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }
    }, [refreshing]);

    /* ─── Drawer helpers ─────────────────────────────────── */
    const openDrawer = () => {
        setDrawerOpen(true);
        Animated.timing(drawerAnim, { toValue: 0, duration: 280, useNativeDriver: true }).start();
    };
    const closeDrawer = () => {
        Animated.timing(drawerAnim, { toValue: DRAWER_WIDTH, duration: 240, useNativeDriver: true }).start(() => setDrawerOpen(false));
    };

    /* ─── Loading ─────────────────────────────────────────── */
    if (loading || !userData) {
        return (
            <SafeAreaView style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#FE6700" />
            </SafeAreaView>
        );
    }

    const stats = dashboard?.topStats || {};
    const beneficiaries = dashboard?.beneficiaries || [];
    const recentUpdates = dashboard?.recentUpdates || [];
    const unlinkedSubs = (dashboard?.activeSubscriptions || []).filter((sub: any) => !sub.beneficiaryId);

    const hasSelfBeneficiary = (beneficiaries || userData?.subscriberBeneficiaries || []).some(
        (b: any) => (b.relationship || '').toLowerCase() === 'self' || b.isSelf || (userData?.id && b.userId === userData.id)
    );
    const isDualRole = (availableRoles.includes('subscriber') && availableRoles.includes('beneficiary')) || hasSelfBeneficiary;

    const firstName = (userData?.name || 'there').split(' ')[0];
    const happinessScore = stats.happinessScore !== undefined && stats.happinessScore !== null ? `${stats.happinessScore}%` : '--';
    const visitsTotal = stats.visitsThisWeek?.total ?? 0;
    const visitsCompleted = stats.visitsThisWeek?.completed ?? 0;
    const activeHours = stats.activeHours?.used ?? 0;
    const remainingHours = stats.activeHours?.remaining ?? 0;
    const totalCarePlans = stats.totalCarePlans ?? 0;

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} • ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} AM`;
    };

    // Compute age from DOB if present — avoids showing stale stored age value
    const getDisplayAge = (b: any): string => {
        if (b.dateOfBirth) {
            try {
                const dob = new Date(b.dateOfBirth);
                if (!isNaN(dob.getTime())) {
                    const today = new Date();
                    let age = today.getFullYear() - dob.getFullYear();
                    const m = today.getMonth() - dob.getMonth();
                    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
                    return `${age} years`;
                }
            } catch (_) {}
        }
        return b.age ? `${b.age} years` : '';
    };

    const handleScroll = (event: any) => {
        const y = event.nativeEvent.contentOffset.y;
        if (y < 0) {
            pullAnim.setValue(Math.min(-y, 80));
        } else {
            pullAnim.setValue(0);
        }
    };

    const handleScrollEndDrag = (event: any) => {
        const y = event.nativeEvent.contentOffset.y;
        if (y < -50 && !refreshing) {
            onRefresh();
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            {/* ── Inline Dashboard Header (Figma) ── */}
            <View style={styles.dashHeader}>
                <Text style={styles.dashTitle}>Dashboard</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(16) }}>
                    <NotificationBell />
                    <TouchableOpacity onPress={openDrawer} style={styles.headerIconBtn}>
                        <Ionicons name="menu-outline" size={scale(28)} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── Floating Circle Arrow Indicator (iOS) ── */}
            {Platform.OS === 'ios' && (
                <Animated.View
                    pointerEvents="none"
                    style={[
                        styles.floatingRefreshCircle,
                        {
                            opacity: refreshing
                                ? 1
                                : pullAnim.interpolate({
                                      inputRange: [0, 20, 50],
                                      outputRange: [0, 0.4, 1],
                                      extrapolate: 'clamp',
                                  }),
                            transform: [
                                {
                                    translateY: refreshing
                                        ? scale(18)
                                        : pullAnim.interpolate({
                                              inputRange: [0, 50],
                                              outputRange: [-scale(90), scale(18)],
                                              extrapolate: 'clamp',
                                          }),
                                },
                                {
                                    scale: refreshing
                                        ? 1
                                        : pullAnim.interpolate({
                                              inputRange: [0, 25, 50],
                                              outputRange: [0.5, 0.85, 1],
                                              extrapolate: 'clamp',
                                          }),
                                },
                            ],
                        },
                    ]}
                >
                    {refreshing ? (
                        <ActivityIndicator size="small" color="#FE6700" />
                    ) : (
                        <Animated.View
                            style={{
                                transform: [
                                    {
                                        rotate: pullAnim.interpolate({
                                            inputRange: [0, 50],
                                            outputRange: ['0deg', '360deg'],
                                            extrapolate: 'clamp',
                                        }),
                                    },
                                ],
                            }}
                        >
                            <Feather name="rotate-cw" size={scale(18)} color="#FE6700" />
                        </Animated.View>
                    )}
                </Animated.View>
            )}

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={16}
                onScroll={Platform.OS === 'ios' ? handleScroll : undefined}
                onScrollEndDrag={Platform.OS === 'ios' ? handleScrollEndDrag : undefined}
                refreshControl={
                    Platform.OS === 'android' ? (
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FE6700']} />
                    ) : undefined
                }
            >
                {/* ── Hero Banner (top 2 stats only) ── */}
                <ImageBackground
                    source={require("../../assets/images/bg02.png")}
                    resizeMode="cover"
                    style={styles.heroBanner}
                    imageStyle={styles.heroBannerImage}
                >
                    <Text style={styles.heroGreeting}>Hi {firstName}</Text>

                </ImageBackground>

                {/* Row 1 — overlapping the orange image */}
                <View style={styles.statsGrid}>
                    {/* Happiness Score */}
                    <View style={styles.statCard}>
                        <View style={styles.statTopRow}>
                            <View style={styles.statEmojiCircle}>
                                <Text style={styles.statEmoji}>😊</Text>
                            </View>
                            <Text style={styles.statValue}>{happinessScore}</Text>
                        </View>
                        <Text style={styles.statLabel}>Happiness Score</Text>
                    </View>

                    {/* Visits This Week */}
                    <View style={styles.statCard}>
                        <View style={styles.statTopRow}>
                            <View style={styles.statIconCirclePink}>
                                <MaterialCommunityIcons name="account-heart" size={24} color="#E7000B" />
                            </View>
                            <Text style={styles.statValue}>{visitsTotal}</Text>
                        </View>
                        <Text style={styles.statLabel}>Visits This Week</Text>
                        <Text style={styles.statSub}>{visitsCompleted} completed</Text>
                    </View>
                </View>

                {/* Row 2 — outside orange banner, on white background */}
                <View style={styles.statsGridBottom}>
                    {/* Active Hours */}
                    <View style={styles.statCard}>
                        <View style={styles.statTopRow}>
                            <View style={styles.statIconCircleBlue}>
                                <Ionicons name="hourglass-outline" size={24} color="#155DFC" />
                            </View>
                            <Text style={styles.statValue}>{formatHours(activeHours)}</Text>
                        </View>
                        <Text style={styles.statLabel}>Active Hours</Text>
                        <Text style={[styles.statSub, { color: '#A855F7' }]}>⏰ {formatHours(remainingHours)} remaining</Text>
                    </View>

                    {/* Total Care Plans */}
                    <TouchableOpacity activeOpacity={0.85} onPress={() => router.push('/package-utilization')}>
                        <LinearGradient colors={['#FF6900', '#F54900']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.statCard, { overflow: 'hidden' }]}>
                            <View style={styles.statTopRow}>
                                <View style={styles.planIconCircle}>
                                    <Ionicons name="ribbon-outline" size={23} color="#333333" />
                                </View>
                                <Text style={[styles.statValue, { color: '#FFF' }]}>{totalCarePlans}</Text>
                            </View>
                            <Text style={[styles.statLabel, { color: '#FFE4CC' }]}>Total Care Plans</Text>
                            <TouchableOpacity onPress={() => router.push('/(setup)/subscription-packages')}>
                                <Text style={styles.addMoreText}>＋ Add more →</Text>
                            </TouchableOpacity>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                {/* ── Beneficiaries Section ── */}
                <Animated.View style={{ transform: [{ scale: benScaleAnim }] }}>
                <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>Your Beneficiaries</Text>
                    <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/(setup)/subscription-packages')}>
                        <Text style={styles.addBtnText}>+ Add</Text>
                    </TouchableOpacity>
                </View>

                {/* Unlinked Care Plan Attachment Cards */}
                {unlinkedSubs.map((sub: any) => (
                    <View key={sub.id} style={styles.unlinkedSubCard}>
                        <View style={styles.unlinkedInfo}>
                            <Feather name="user-plus" size={22} color="#FE6700" style={{ marginRight: 10 }} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.unlinkedTitle}>Unlinked Care Plan</Text>
                                <Text style={styles.unlinkedSubtitle}>
                                    Attach a beneficiary to {sub.package?.name || sub.packageType}
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity 
                            style={[styles.unlinkedBtn, { flexDirection: 'row', alignItems: 'center' }]}
                            onPress={() => {
                                if (beneficiaries.length > 0) {
                                    setSelectedUnlinkedSubId(sub.id);
                                    setLinkModalVisible(true);
                                } else {
                                    router.push({ pathname: '/(setup)/subscribe-form', params: { isLinkingFlow: 'true' } });
                                }
                            }}
                        >
                            <Feather name="user-plus" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                            <Text style={styles.unlinkedBtnText}>Add Beneficiary</Text>
                        </TouchableOpacity>
                    </View>
                ))}

                {beneficiaries.length === 0 ? (
                    dashboard?.activeSubscriptions && dashboard.activeSubscriptions.length > 0 ? (
                        <View style={styles.emptyBenCard}>
                            <Feather name="user-plus" size={40} color="#FE6700" style={{ marginBottom: 12 }} />
                            <Text style={styles.emptyTitle}>Add Beneficiary to your care plan</Text>
                            <Text style={styles.emptySubtitle}>({dashboard.activeSubscriptions[0]?.package?.name || dashboard.activeSubscriptions[0]?.packageType || 'Care Plan'})</Text>
                            <TouchableOpacity 
                                style={[styles.emptyBtn, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]} 
                                onPress={() => router.push({ pathname: '/(setup)/subscribe-form', params: { isLinkingFlow: 'true' } })}
                            >
                                <Feather name="user-plus" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                                <Text style={styles.emptyBtnText}>Add Beneficiary</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.emptyBenCard}>
                            <Ionicons name="person-add-outline" size={40} color="#FE6700" style={{ marginBottom: 12 }} />
                            <Text style={styles.emptyTitle}>No Beneficiaries Yet</Text>
                            <Text style={styles.emptySubtitle}>Subscribe to a care plan to add your first beneficiary</Text>
                            <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/(setup)/subscription-packages')}>
                                <Text style={styles.emptyBtnText}>Browse Packages</Text>
                            </TouchableOpacity>
                        </View>
                    )
                ) : (
                    beneficiaries.map((b: any, i: number) => {
                        const isSelected = b.id === selectedBeneficiaryId;
                        const isExpired = b.packageStatus === 'expired' || b.isExpired;
                        const isPending = b.verificationStatus === 'pending' || b.packageStatus === 'pending' || b.packageStatus === 'none' || b.isActive === false;
                        const isSelf = (b.relationship || '').toLowerCase() === 'self' || b.isSelf;

                        return (
                            <TouchableOpacity
                                key={b.id || i}
                                style={[
                                    styles.benCard, 
                                    isSelected && !isPending && !isExpired && styles.benCardActive,
                                    isPending && styles.benCardPending,
                                    isExpired && styles.benCardExpired,
                                    isSelf && !isPending && styles.benCardSelf
                                ]}
                                onPress={() => {
                                    console.log('[Dashboard] Tapped beneficiary:', b?.id, b?.name, 'isSelected:', isSelected);
                                    if (isPending) {
                                        router.push({
                                            pathname: '/(setup)/beneficiary-info',
                                            params: { isVerificationFlow: 'true', beneficiaryId: b.id }
                                        });
                                    } else if (isExpired) {
                                        router.push('/(setup)/subscription-packages');
                                    } else if (isSelected) {
                                        // Tap on active card → open beneficiary profile details
                                        console.log('[Dashboard] Navigating to beneficiary-profile with id:', b.id);
                                        router.push(`/(subscriber)/beneficiary-profile?id=${b.id}`);
                                    } else {
                                        // Select beneficiary and update dashboard view
                                        setSelectedBeneficiaryId(b.id);
                                        AsyncStorage.setItem('selectedBeneficiaryId', b.id);
                                    }
                                }}
                            >
                                <Image
                                    source={{ uri: sanitizeImageUri(b.photo, `https://ui-avatars.com/api/?name=${encodeURIComponent(b.name || 'Beneficiary')}&background=FFE3D1&color=FE6700&bold=true`) }}
                                    style={styles.benPhoto}
                                />

                                <View style={styles.benDetails}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                        <Text style={styles.benName}>{b.name}</Text>
                                        {isSelf && (
                                            <View style={styles.selfTagBadge}>
                                                <Text style={styles.selfTagText}>Self</Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text style={styles.benMeta}>{getDisplayAge(b)}{b.relationship ? ` • ${b.relationship}` : ''}</Text>

                                    {/* ── Status Badges ── */}
                                    {isPending ? (
                                        <View style={styles.inactiveBadge}>
                                            <Ionicons name="alert-circle" size={13} color="#D97706" style={{ marginRight: 4 }} />
                                            <Text style={styles.inactiveBadgeText}>Inactive - Review detail and set as active</Text>
                                        </View>
                                    ) : isExpired ? (
                                        <View style={styles.expiredBadge}>
                                            <Ionicons name="time-outline" size={13} color="#DC2626" style={{ marginRight: 4 }} />
                                            <Text style={styles.expiredBadgeText}>Expired - Tap to renew package</Text>
                                        </View>
                                    ) : null}
                                </View>

                                {isSelf && isDualRole && !isPending ? (
                                    <TouchableOpacity
                                        style={styles.switchCareBtn}
                                        onPress={handleSwitchToBeneficiary}
                                        disabled={isSwitchingRole}
                                    >
                                        {isSwitchingRole ? (
                                            <ActivityIndicator size="small" color="#FFFFFF" />
                                        ) : (
                                            <>
                                                <Ionicons name="swap-horizontal" size={13} color="#FFFFFF" style={{ marginRight: 3 }} />
                                                <Text style={styles.switchCareBtnText}>Switch UI</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                ) : (
                                    <Ionicons name="chevron-forward" size={20} color={isPending ? "#D97706" : "#A3A3A3"} />
                                )}
                            </TouchableOpacity>
                        );
                    })
                )}
                </Animated.View>

                {/* ── Recent Updates ── */}
                {recentUpdates.length > 0 && (
                    <View style={{ position: 'relative' }}>
                        <View style={styles.sectionHeaderRow}>
                            <Text style={styles.sectionTitle}>Recent Updates</Text>
                            <TouchableOpacity><Text style={styles.viewAllText}>View All</Text></TouchableOpacity>
                        </View>

                        {recentUpdates.map((update: any, i: number) => (
                            <View key={update.id || i} style={styles.updateCard}>
                                <View style={styles.updateIconBox}>
                                    <Ionicons name="chatbox-outline" size={20} color="#FE6700" />
                                </View>
                                <View style={{ flex: 1, marginLeft: 14 }}>
                                    <View style={styles.updateTopRow}>
                                        <Text style={styles.updateTitle}>{update.title || 'Care Companion Update'}</Text>
                                        {update.isNew && <View style={styles.newBadge}><Text style={styles.newBadgeText}>New</Text></View>}
                                    </View>
                                    <Text style={styles.updateDate}>{formatDate(update.date)}</Text>
                                    <Text style={styles.updateBody} numberOfLines={2}>{update.body}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* ── Assistance Card ── */}
                <View style={styles.assistanceCard}>
                    <View style={styles.assistanceHeader}>
                        <View style={styles.assistanceIllustration}>
                            <Image
                                source={require("../../assets/images/group4.png")}
                                resizeMode="contain"
                                style={{ width: 60, height: 60 }}
                            />
                        </View>
                        <View style={{ flex: 1, marginLeft: 15 }}>
                            <Text style={styles.assistanceTitle}>Need assistance?</Text>
                            <Text style={styles.assistanceSub}>Our experts are here to help you choose the right plan via Phone or WhatsApp.</Text>
                        </View>
                    </View>
                    <View style={styles.assistanceActions}>
                        <CallbackButton
                            subscriberId={userData?.id}
                            style={styles.callbackBtn}
                            textStyle={styles.callbackText}
                            notes="Requested assistance from Subscriber Dashboard"
                        />
                        {/* <TouchableOpacity style={styles.whatsappBtn}>
                            <Ionicons name="chatbubbles" size={36} color="#FE6700" />
                        </TouchableOpacity> */}
                    </View>
                </View>

            </ScrollView>

            <GlobalDrawer
                isOpen={drawerOpen}
                onClose={closeDrawer}
                drawerAnim={drawerAnim}
                userData={userData}
            />

            {/* ── Modal for Linking Existing Beneficiary ── */}
            <Modal visible={linkModalVisible} transparent animationType="slide" onRequestClose={() => setLinkModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Who is this care plan for?</Text>
                            <TouchableOpacity onPress={() => setLinkModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#111827" />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.modalSubtitle}>Select an existing beneficiary to link to this plan.</Text>
                        
                        <ScrollView style={{ maxHeight: height * 0.4, width: '100%', marginBottom: scale(16) }} showsVerticalScrollIndicator={false}>
                            {beneficiaries.map((b: any) => (
                                <TouchableOpacity 
                                    key={b.id} 
                                    style={styles.modalBenCard}
                                    disabled={isLinking}
                                    onPress={async () => {
                                        if (!selectedUnlinkedSubId) return;
                                        setIsLinking(true);
                                        try {
                                            const storedToken = await AsyncStorage.getItem('userToken');
                                            const res = await fetch(`${API_URL}/subscriber/subscriptions/${selectedUnlinkedSubId}/link-beneficiary`, {
                                                method: 'POST',
                                                headers: {
                                                    'Authorization': `Bearer ${storedToken}`,
                                                    'Content-Type': 'application/json'
                                                },
                                                body: JSON.stringify({ beneficiaryId: b.id })
                                            });
                                            const data = await res.json();
                                            if (data.success) {
                                                setLinkModalVisible(false);
                                                refetch();
                                            } else {
                                                alert(data.message || 'Failed to link beneficiary');
                                            }
                                        } catch (error) {
                                            console.error(error);
                                            alert('An error occurred while linking');
                                        } finally {
                                            setIsLinking(false);
                                        }
                                    }}
                                >
                                    <View style={styles.modalBenIcon}>
                                        <Ionicons name="person" size={20} color="#FE6700" />
                                    </View>
                                    <View>
                                        <Text style={styles.modalBenName}>{b.name}</Text>
                                        <Text style={styles.modalBenRel}>{b.relationship || 'Beneficiary'}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <TouchableOpacity 
                            style={styles.modalAddNewBtn}
                            disabled={isLinking}
                            onPress={() => {
                                setLinkModalVisible(false);
                                router.push({ pathname: '/(setup)/subscribe-form', params: { isLinkingFlow: 'true' } });
                            }}
                        >
                            <Feather name="user-plus" size={18} color="#FE6700" style={{ marginRight: 8 }} />
                            <Text style={styles.modalAddNewText}>Add New Beneficiary</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#FFF0E6' },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF0E6' },

    /* ── Dashboard Header ── */
    dashHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: scale(20), paddingVertical: scale(12),
        backgroundColor: '#FE6700', // Matches the top of the banner
    },
    dashTitle: { fontSize: scale(17), fontWeight: '600', color: '#FFFFFF' },
    headerIconBtn: { width: scale(36), height: scale(36), justifyContent: 'center', alignItems: 'center', position: 'relative' },
    headerBadge: {
        position: 'absolute', top: 2, right: -2, width: scale(18), height: scale(18),
        borderRadius: scale(9), backgroundColor: '#FE6700',
        justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FFF',
    },
    headerBadgeText: { color: '#FFF', fontSize: scale(9), fontWeight: '800' },
    floatingRefreshCircle: {
        position: 'absolute',
        top: scale(64),
        alignSelf: 'center',
        width: scale(38),
        height: scale(38),
        borderRadius: scale(19),
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 999,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.2,
                shadowRadius: 5,
            },
            android: {
                elevation: 6,
            },
        }),
    },

    scrollContent: { paddingBottom: scale(40) },

    /* ── Hero Banner ── */
    heroBanner: {
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingTop: scale(4),
        paddingBottom: scale(100),
        marginBottom: 0,
        overflow: 'hidden',
        borderBottomLeftRadius: scale(15),
        borderBottomRightRadius: scale(15),
        backgroundColor: '#FE6700',
    },
    heroBannerImage: {
        ...require('react-native').StyleSheet.absoluteFillObject,
        width: undefined,
        height: undefined,
        opacity: 0.68,
    },
    heroCurve: {
        // Removed — no longer needed with overflow:hidden approach
        display: 'none',
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 0,
    },
    heroGreeting: {
        fontSize: scale(18),
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: scale(12),
        zIndex: 1,
    },
    heroSubtitle: { display: 'none' },

    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: CARD_GAP,
        zIndex: 1,
        paddingHorizontal: HORIZONTAL_PADDING,
        marginTop: scale(-80),
    },
    statsGridBottom: {
        flexDirection: 'row',
        gap: CARD_GAP,
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingTop: scale(14),
        paddingBottom: scale(20),
        backgroundColor: 'transparent',
    },
    statCard: {
        width: (width - HORIZONTAL_PADDING * 2 - CARD_GAP) / 2,
        minHeight: scale(110),
        backgroundColor: '#FFFFFF',
        borderRadius: scale(16),
        paddingHorizontal: scale(14),
        paddingTop: scale(18),
        paddingBottom: scale(14),
        justifyContent: 'flex-start',
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 6 },
            android: { elevation: 3 },
        }),
    },
    statTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: scale(8) },
    statEmojiCircle: {
        width: scale(38), height: scale(38), borderRadius: scale(10), backgroundColor: '#FFEDD4',
        alignItems: 'center', justifyContent: 'center', marginRight: scale(8),
    },
    statEmoji: { fontSize: scale(22) },
    statIconCirclePink: {
        width: scale(38), height: scale(38), borderRadius: scale(10), backgroundColor: '#FFE2E2',
        alignItems: 'center', justifyContent: 'center', marginRight: scale(8),
    },
    statIconCircleBlue: {
        width: scale(38), height: scale(38), borderRadius: scale(10), backgroundColor: '#DBEAFE',
        alignItems: 'center', justifyContent: 'center', marginRight: scale(8),
    },
    planIconCircle: {
        width: scale(40), height: scale(40), borderRadius: scale(20), backgroundColor: '#FFFFFF',
        alignItems: 'center', justifyContent: 'center', marginRight: scale(8),
    },
    statIcon: {},
    statValue: { fontSize: scale(20), fontWeight: '700', color: '#111111' },
    statLabel: { fontSize: scale(13), color: '#4B5563', marginBottom: scale(2) },
    statSub: { fontSize: scale(11), color: '#A3A3A3' },
    addMoreText: { fontSize: scale(12), color: '#FFFFFF', marginTop: scale(4) },

    /* ── Sections ── */
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: HORIZONTAL_PADDING,
        marginBottom: scale(12),
    },
    sectionTitle: { fontSize: scale(16), fontWeight: '600', color: '#111827' },
    addBtn: {
        backgroundColor: '#FE6700',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: scale(14),
        paddingVertical: scale(7),
        borderRadius: scale(28),
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
            android: { elevation: 3 },
        }),
    },
    addBtnText: { color: '#FFF', fontSize: scale(13), fontWeight: '600' },
    viewAllText: { fontSize: scale(13), fontWeight: '500', color: '#FE6700' },

    /* ── Empty state ── */
    emptyBenCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: scale(16),
        padding: scale(28),
        marginHorizontal: HORIZONTAL_PADDING,
        marginBottom: scale(24),
        alignItems: 'center',
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
            android: { elevation: 2 },
        }),
    },
    emptyTitle: { fontSize: scale(16), fontWeight: '600', color: '#111827', marginBottom: scale(6) },
    emptySubtitle: { fontSize: scale(13), color: '#6B7280', textAlign: 'center', marginBottom: scale(18), lineHeight: scale(20) },
    emptyBtn: { backgroundColor: '#FE6700', paddingHorizontal: scale(20), paddingVertical: scale(10), borderRadius: scale(8) },
    emptyBtnText: { color: '#FFF', fontSize: scale(14), fontWeight: '600' },

    /* ── Beneficiary Card ── */
    benCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: scale(16),
        paddingHorizontal: scale(16),
        paddingVertical: scale(16),
        marginHorizontal: HORIZONTAL_PADDING,
        marginBottom: scale(12),
        flexDirection: 'row',
        alignItems: 'center',
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
            android: { elevation: 2 },
        }),
    },
    benCardActive: {
        backgroundColor: '#FFF5ED',
        borderColor: '#FE6700',
        borderWidth: 1,
    },
    benCardExpired: {
        backgroundColor: '#FEF2F2',
        borderColor: '#FCA5A5',
        borderWidth: 1,
    },
    benPhoto: { width: scale(64), height: scale(64), borderRadius: scale(32), marginRight: scale(16), backgroundColor: '#E5E7EB' },
    benDetails: { flex: 1 },
    benName: { fontSize: scale(16), fontWeight: '700', color: '#111827', marginBottom: scale(4) },
    benMeta: { fontSize: scale(13), color: '#6B7280' },

    /* ── Recent Updates ── */
    updateCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: scale(14),
        padding: scale(16),
        marginHorizontal: HORIZONTAL_PADDING,
        marginBottom: scale(10),
        flexDirection: 'row',
        alignItems: 'flex-start',
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6 },
            android: { elevation: 2 },
        }),
    },
    updateIconBox: {
        width: scale(42), height: scale(42), borderRadius: scale(21), backgroundColor: '#FFE8CE',
        justifyContent: 'center', alignItems: 'center',
    },
    updateTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: scale(3) },
    updateTitle: { fontSize: scale(14), fontWeight: '600', color: '#111827', flex: 1 },
    updateDate: { fontSize: scale(11), color: '#9CA3AF', marginBottom: scale(5) },
    updateBody: { fontSize: scale(13), color: '#4B5563', lineHeight: scale(19) },
    newBadge: { backgroundColor: '#FE6700', borderRadius: scale(10), paddingHorizontal: scale(8), paddingVertical: scale(2) },
    newBadgeText: { color: '#FFF', fontSize: scale(10), fontWeight: '700' },

    /* ── Assistance Card ── */
    assistanceCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: scale(20),
        padding: scale(20),
        marginHorizontal: HORIZONTAL_PADDING,
        marginTop: scale(8),
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
            android: { elevation: 2 },
        }),
    },
    assistanceHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: scale(16) },
    assistanceIllustration: { width: scale(56), height: scale(56), justifyContent: 'center', alignItems: 'center' },
    assistanceTitle: { fontSize: scale(17), fontWeight: '700', color: '#111827', marginBottom: scale(4) },
    assistanceSub: { fontSize: scale(13), color: '#4B5563', lineHeight: scale(19) },
    assistanceActions: { flexDirection: 'row', alignItems: 'center' },
    callbackBtn: {
        flex: 1, flexDirection: 'row', borderWidth: 1, borderColor: '#FE6700', borderRadius: scale(24),
        height: scale(48), alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF',
    },
    callbackText: { color: '#FE6700', fontWeight: '600', fontSize: scale(14) },
    whatsappBtn: {
        width: scale(48), height: scale(48),
        justifyContent: 'center', alignItems: 'center',
        marginLeft: scale(8),
    },
    unlinkedSubCard: {
        backgroundColor: '#FFF5ED',
        borderWidth: 1,
        borderColor: '#FFD7BC',
        borderRadius: scale(14),
        padding: scale(14),
        marginHorizontal: HORIZONTAL_PADDING,
        marginBottom: scale(12),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        ...Platform.select({
            ios: { shadowColor: '#FE6700', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6 },
            android: { elevation: 2 },
        }),
    },
    unlinkedInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: scale(12),
    },
    unlinkedTitle: {
        fontSize: scale(14),
        fontWeight: '700',
        color: '#111827',
        marginBottom: scale(2),
    },
    unlinkedSubtitle: {
        fontSize: scale(12),
        color: '#4B5563',
    },
    unlinkedBtn: {
        backgroundColor: '#FE6700',
        paddingHorizontal: scale(12),
        paddingVertical: scale(8),
        borderRadius: scale(8),
        flexDirection: 'row',
        alignItems: 'center',
    },
    unlinkedBtnText: {
        color: '#FFFFFF',
        fontSize: scale(12),
        fontWeight: '700',
    },
    /* ── Link Beneficiary Modal ── */
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end'
    },
    modalContent: {
        backgroundColor: '#FFF', borderTopLeftRadius: scale(24), borderTopRightRadius: scale(24),
        paddingHorizontal: scale(20), paddingVertical: scale(24),
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 10 },
            android: { elevation: 10 },
        }),
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: scale(8) },
    modalTitle: { fontSize: scale(18), fontWeight: '700', color: '#111827' },
    modalSubtitle: { fontSize: scale(13), color: '#6B7280', marginBottom: scale(20) },
    modalBenCard: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', 
        padding: scale(14), borderRadius: scale(12), marginBottom: scale(10),
        borderWidth: 1, borderColor: '#F3F4F6'
    },
    modalBenIcon: {
        width: scale(38), height: scale(38), borderRadius: scale(19), backgroundColor: '#FFE8CE',
        justifyContent: 'center', alignItems: 'center', marginRight: scale(12)
    },
    modalBenName: { fontSize: scale(15), fontWeight: '600', color: '#111827' },
    modalBenRel: { fontSize: scale(12), color: '#6B7280', marginTop: scale(2) },
    modalAddNewBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: scale(14), borderRadius: scale(12),
        borderWidth: 1, borderColor: '#FE6700', backgroundColor: '#FFF5ED'
    },
    modalAddNewText: { fontSize: scale(15), fontWeight: '600', color: '#FE6700' },

    // ── Self Beneficiary Card Styles ──
    benCardSelf: {
        backgroundColor: '#FFF7ED',
        borderColor: '#FFD7BC',
        borderWidth: 1.5,
    },
    selfTagBadge: {
        backgroundColor: '#FF6700',
        paddingHorizontal: scale(6),
        paddingVertical: scale(2),
        borderRadius: scale(6),
    },
    selfTagText: {
        color: '#FFFFFF',
        fontSize: scale(10),
        fontWeight: '700',
    },
    switchCareBtn: {
        backgroundColor: '#FE6700',
        paddingHorizontal: scale(10),
        paddingVertical: scale(6),
        borderRadius: scale(8),
        flexDirection: 'row',
        alignItems: 'center',
    },
    switchCareBtnText: {
        color: '#FFFFFF',
        fontSize: scale(11),
        fontWeight: '700',
    },
    benCardPending: {
        backgroundColor: '#FFFDF5',
        borderColor: '#FDE68A',
        borderWidth: 1.5,
    },
    inactiveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF3C7',
        paddingHorizontal: scale(8),
        paddingVertical: scale(4),
        borderRadius: scale(6),
        marginTop: scale(6),
        alignSelf: 'flex-start',
    },
    inactiveBadgeText: {
        color: '#92400E',
        fontSize: scale(11),
        fontWeight: '600',
    },
    expiredBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEE2E2',
        paddingHorizontal: scale(8),
        paddingVertical: scale(4),
        borderRadius: scale(6),
        marginTop: scale(6),
        alignSelf: 'flex-start',
    },
    expiredBadgeText: {
        color: '#991B1B',
        fontSize: scale(11),
        fontWeight: '600',
    },
});
