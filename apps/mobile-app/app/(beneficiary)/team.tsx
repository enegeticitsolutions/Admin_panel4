import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Platform, ActivityIndicator, useWindowDimensions, RefreshControl } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/api';
import { ConnectContactButton } from '@/components/shared/ConnectContactModal';
import { sanitizeImageUri } from '@/utils/sanitizeImageUri';
import { useSafeBack } from '@/hooks/useSafeBack';
import { useGlobalRefresh } from '@/utils/events';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedBeneficiary } from '@/contexts/SelectedBeneficiaryContext';
import { HomeColors, HomeShadows } from '@/constants/homeTheme';

type TeamMember = {
    id: string;
    level: 'Primary' | 'Secondary' | 'Field Manager';
    name: string;
    role: string;
    bio: string;
    photo: string | null;
    phone: string | null;
};

export default function CareTeamScreen() {
    const safeBack = useSafeBack();
    const { width } = useWindowDimensions();
    const MAX_CONTENT_WIDTH = 440;
    const responsiveStyle = { width: '100%' as const, maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' as const };

    const router = useRouter();
    const params = useLocalSearchParams<{ beneficiaryId?: string; beneficiaryName?: string; isSelf?: string }>();
    const { isGuest, isLoggedIn, isLoading: authLoading } = useAuth();
    const { selectedBeneficiary } = useSelectedBeneficiary();

    const targetBeneficiaryId =
        (typeof params.beneficiaryId === 'string' && params.beneficiaryId.trim()) ||
        selectedBeneficiary?.id ||
        undefined;
    const targetBeneficiaryName =
        (typeof params.beneficiaryName === 'string' && params.beneficiaryName.trim()) ||
        selectedBeneficiary?.name ||
        undefined;
    const isSelfTarget =
        params.isSelf === 'true' ||
        (!targetBeneficiaryId && !selectedBeneficiary) ||
        Boolean(selectedBeneficiary && selectedBeneficiary.id === targetBeneficiaryId && selectedBeneficiary.isSelf);
    const headerTitle = isSelfTarget || !targetBeneficiaryName
        ? 'Your Care Team'
        : `${targetBeneficiaryName}'s Care Team`;
    const [isUnauthenticated, setIsUnauthenticated] = useState(false);
    const [team, setTeam] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useFocusEffect(
        useCallback(() => {
            if (authLoading) return;
            if (isGuest || !isLoggedIn) {
                setIsUnauthenticated(true);
                setLoading(false);
            } else {
                fetchTeam();
            }
        }, [authLoading, isGuest, isLoggedIn, targetBeneficiaryId])
    );

    useGlobalRefresh(() => {
        if (!isGuest && isLoggedIn) {
            fetchTeam();
        }
    });

    const onRefresh = useCallback(async () => {
        if (isGuest || !isLoggedIn) return;
        setRefreshing(true);
        await fetchTeam();
        setRefreshing(false);
    }, [isGuest, isLoggedIn, targetBeneficiaryId]);

    const fetchTeam = async () => {
        if (isGuest || !isLoggedIn) {
            setIsUnauthenticated(true);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const token = await AsyncStorage.getItem('userToken');
            const userStr = await AsyncStorage.getItem('userData');

            if (!token || !userStr) {
                setIsUnauthenticated(true);
                setLoading(false);
                return;
            }

            setIsUnauthenticated(false);
            const user = JSON.parse(userStr);
            const targetId = targetBeneficiaryId || user.id;

            const response = await fetch(`${API_URL}/beneficiary/${targetId}/team`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const data = await response.json();

            if (data.success) {
                setTeam(data.data);
            } else {
                setError(data.message || 'Failed to load care team');
            }
        } catch (e: any) {
            console.error('Fetch Team Error:', e);
            setError('An error occurred while loading your care team. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const getTagStyle = (level: string) => {
        if (level === 'Primary') return styles.badgePrimary;
        if (level === 'Field Manager') return styles.badgeMint;
        return styles.badgeBlue;
    };

    const getTagTextStyle = (level: string) => {
        if (level === 'Primary') return styles.badgeTextPrimary;
        if (level === 'Field Manager') return styles.badgeTextMint;
        return styles.badgeTextBlue;
    };

    const getInitials = (name: string) => {
        const parts = (name || '').trim().split(/\s+/);
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return (name || 'CT').slice(0, 2).toUpperCase();
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <View style={[styles.header, responsiveStyle]}>
                <TouchableOpacity
                    onPress={() => safeBack('/(beneficiary)')}
                    style={styles.backBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                >
                    <Feather name="arrow-left" size={20} color={HomeColors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>{headerTitle}</Text>
                <View style={styles.headerSpacer} />
            </View>

            {loading || authLoading ? (
                <View style={[styles.centerContainer, responsiveStyle]}>
                    <ActivityIndicator size="large" color="#FE6700" />
                    <Text style={styles.loaderText}>Loading your care team...</Text>
                </View>
            ) : isUnauthenticated || isGuest || !isLoggedIn ? (
                <ScrollView
                    contentContainerStyle={[styles.guestContent, responsiveStyle]}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.guestCard}>
                        {/* Care Team Badge */}
                        <View style={styles.guestBadge}>
                            <Feather name="users" size={13} color="#FE6700" />
                            <Text style={styles.guestBadgeText}>Dedicated Care Team</Text>
                        </View>

                        {/* Icon Wrap */}
                        <View style={styles.guestIconWrap}>
                            <MaterialCommunityIcons name="account-group" size={42} color="#FE6700" />
                        </View>

                        <Text style={styles.guestTitle}>Meet Your Dedicated Care Team</Text>
                        <Text style={styles.guestDesc}>
                            Create an account or sign in to connect directly with your assigned Saathi care companions, nurses, and dedicated care managers.
                        </Text>

                        {/* Feature Highlights */}
                        <View style={styles.guestFeatureList}>
                            <View style={styles.guestFeatureRow}>
                                <Feather name="check-circle" size={16} color="#10B981" />
                                <Text style={styles.guestFeatureText}>Verified & background-checked Saathi companions</Text>
                            </View>
                            <View style={styles.guestFeatureRow}>
                                <Feather name="check-circle" size={16} color="#10B981" />
                                <Text style={styles.guestFeatureText}>Direct 1-tap phone calls & messaging with caregivers</Text>
                            </View>
                            <View style={styles.guestFeatureRow}>
                                <Feather name="check-circle" size={16} color="#10B981" />
                                <Text style={styles.guestFeatureText}>Field managers overseeing personalized care plans</Text>
                            </View>
                            <View style={styles.guestFeatureRow}>
                                <Feather name="check-circle" size={16} color="#10B981" />
                                <Text style={styles.guestFeatureText}>24/7 care coordination & emergency assistance</Text>
                            </View>
                        </View>

                        {/* CTA Buttons */}
                        <TouchableOpacity
                            style={styles.guestPrimaryBtn}
                            onPress={() => router.push('/(auth)/register')}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.guestPrimaryBtnText}>Create Account</Text>
                            <Feather name="arrow-right" size={18} color="#FFFFFF" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.guestSecondaryBtn}
                            onPress={() => router.push('/(auth)')}
                            activeOpacity={0.75}
                        >
                            <Text style={styles.guestSecondaryBtnText}>
                                Already have an account? <Text style={styles.guestSecondaryLink}>Sign In</Text>
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            ) : error ? (
                <View style={[styles.centerContainer, responsiveStyle]}>
                    <View style={styles.errorIconWrap}>
                        <Feather name="alert-circle" size={36} color="#D97706" />
                    </View>
                    <Text style={styles.errorTitle}>Unable to Load Care Team</Text>
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={fetchTeam} activeOpacity={0.85}>
                        <Feather name="refresh-cw" size={15} color="#FFFFFF" style={{ marginRight: 8 }} />
                        <Text style={styles.retryText}>Try Again</Text>
                    </TouchableOpacity>
                </View>
            ) : team.length === 0 ? (
                <View style={[styles.centerContainer, responsiveStyle]}>
                    <View style={styles.emptyCard}>
                        <View style={styles.emptyIconCircle}>
                            <Feather name="users" size={32} color={HomeColors.brandOrange} />
                        </View>
                        <Text style={styles.emptyTitle}>No Care Team Assigned Yet</Text>
                        <Text style={styles.emptyText}>
                            Once a care coordinator or field manager is assigned, their contact details will appear here.
                        </Text>
                    </View>
                </View>
            ) : (
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={[styles.content, responsiveStyle]}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FE6700" />}
                >
                    {/* Hero Summary Banner */}
                    <View style={styles.heroCard}>
                        <View style={styles.heroDecorCircle} />
                        <Text style={styles.heroEyebrow}>DEDICATED SUPPORT</Text>
                        <Text style={styles.heroTitle}>{headerTitle}</Text>
                        <Text style={styles.heroSub}>
                            {team.length} {team.length === 1 ? 'specialist' : 'specialists'} assigned and ready to help with care coordination.
                        </Text>
                    </View>

                    {team.map((member) => {
                        const firstName = (member.name || 'Member').trim().split(/\s+/)[0];
                        return (
                            <View key={member.id} style={styles.card}>
                                {/* Top Badges Row */}
                                <View style={styles.badgeRow}>
                                    <View style={[styles.badge, getTagStyle(member.level)]}>
                                        <MaterialCommunityIcons
                                            name={member.level === 'Field Manager' ? 'shield-account-outline' : 'stethoscope'}
                                            size={13}
                                            color={
                                                member.level === 'Primary'
                                                    ? HomeColors.brandOrange
                                                    : member.level === 'Field Manager'
                                                    ? HomeColors.mintIcon
                                                    : HomeColors.blueIcon
                                            }
                                        />
                                        <Text style={[styles.badgeText, getTagTextStyle(member.level)]}>
                                            {member.level}
                                        </Text>
                                    </View>

                                    <View style={styles.verifiedPill}>
                                        <Feather name="check-circle" size={12} color={HomeColors.mintIcon} />
                                        <Text style={styles.verifiedText}>Verified</Text>
                                    </View>
                                </View>

                                {/* Profile Info */}
                                <View style={styles.profileRow}>
                                    <View
                                        style={[
                                            styles.avatarContainer,
                                            member.level === 'Primary'
                                                ? styles.avatarRingPrimary
                                                : member.level === 'Field Manager'
                                                ? styles.avatarRingMint
                                                : styles.avatarRingBlue,
                                        ]}
                                    >
                                        {member.photo ? (
                                            <Image source={{ uri: sanitizeImageUri(member.photo) }} style={styles.avatar} />
                                        ) : (
                                            <View
                                                style={[
                                                    styles.avatarPlaceholder,
                                                    member.level === 'Primary'
                                                        ? { backgroundColor: HomeColors.peachBg }
                                                        : member.level === 'Field Manager'
                                                        ? { backgroundColor: HomeColors.mintBg }
                                                        : { backgroundColor: HomeColors.blueBg },
                                                ]}
                                            >
                                                <Text
                                                    style={[
                                                        styles.avatarInitials,
                                                        member.level === 'Primary'
                                                            ? { color: HomeColors.brandOrange }
                                                            : member.level === 'Field Manager'
                                                            ? { color: HomeColors.mintIcon }
                                                            : { color: HomeColors.blueIcon },
                                                    ]}
                                                >
                                                    {getInitials(member.name)}
                                                </Text>
                                            </View>
                                        )}
                                    </View>

                                    <View style={styles.profileTextContainer}>
                                        <Text style={styles.name} numberOfLines={1}>{member.name}</Text>
                                        <Text style={styles.role} numberOfLines={1}>{member.role}</Text>
                                    </View>
                                </View>

                                {/* Bio Box */}
                                {member.bio ? (
                                    <View style={styles.bioBox}>
                                        <Text style={styles.description}>{member.bio}</Text>
                                    </View>
                                ) : null}

                                {/* Call Button — uses ConnectContactButton for the modal */}
                                <ConnectContactButton
                                    name={member.name}
                                    role={member.role}
                                    phone={member.phone}
                                    photo={member.photo}
                                    trigger={
                                        <View style={styles.callButton}>
                                            <Feather name="phone-call" size={17} color="#FFFFFF" style={styles.buttonIcon} />
                                            <Text style={styles.callButtonText}>Call {firstName}</Text>
                                        </View>
                                    }
                                />
                            </View>
                        );
                    })}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: HomeColors.pageBackground,
    },
    header: {
        height: 60,
        backgroundColor: HomeColors.pageBackground,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: HomeColors.cardWhite,
        borderWidth: 1,
        borderColor: HomeColors.borderSubtle,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerSpacer: {
        width: 40,
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
        fontFamily: 'Poppins-SemiBold',
        fontWeight: '600',
        fontSize: 18,
        color: HomeColors.textPrimary,
        paddingHorizontal: 8,
    },
    scroll: {
        flex: 1,
        backgroundColor: HomeColors.pageBackground,
    },
    content: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: Platform.OS === 'ios' ? 100 : 80,
    },
    heroCard: {
        backgroundColor: HomeColors.brandOrange,
        borderRadius: 24,
        padding: 20,
        marginBottom: 18,
        overflow: 'hidden',
        position: 'relative',
        ...HomeShadows.hero,
    },
    heroDecorCircle: {
        position: 'absolute',
        width: 150,
        height: 150,
        borderRadius: 75,
        right: -35,
        top: -45,
        borderWidth: 26,
        borderColor: 'rgba(255, 255, 255, 0.12)',
    },
    heroEyebrow: {
        fontFamily: 'Poppins-Bold',
        fontWeight: '700',
        fontSize: 11,
        letterSpacing: 1.4,
        color: HomeColors.textWhiteMuted,
        marginBottom: 4,
    },
    heroTitle: {
        fontFamily: 'Poppins-Bold',
        fontWeight: '700',
        fontSize: 22,
        lineHeight: 28,
        color: HomeColors.textWhite,
        marginBottom: 6,
    },
    heroSub: {
        fontFamily: 'Poppins-Regular',
        fontSize: 13,
        lineHeight: 19,
        color: HomeColors.textWhiteBody,
    },
    card: {
        backgroundColor: HomeColors.cardWhite,
        borderRadius: 24,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1.08,
        borderColor: HomeColors.borderSubtle,
        ...HomeShadows.card,
    },
    badgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
    },
    badgePrimary: {
        backgroundColor: HomeColors.peachBg,
    },
    badgeMint: {
        backgroundColor: HomeColors.mintBg,
    },
    badgeBlue: {
        backgroundColor: HomeColors.blueBg,
    },
    badgeText: {
        fontFamily: 'Poppins-SemiBold',
        fontWeight: '600',
        fontSize: 12,
    },
    badgeTextPrimary: {
        color: HomeColors.brandOrange,
    },
    badgeTextMint: {
        color: HomeColors.mintIcon,
    },
    badgeTextBlue: {
        color: HomeColors.blueText,
    },
    verifiedPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: HomeColors.mintBg,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
    },
    verifiedText: {
        fontFamily: 'Poppins-Medium',
        fontSize: 11,
        color: HomeColors.mintIcon,
    },
    profileRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    avatarContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        overflow: 'hidden',
        marginRight: 14,
        borderWidth: 2,
    },
    avatarRingPrimary: {
        borderColor: '#FFD6BA',
    },
    avatarRingMint: {
        borderColor: '#BDE8D8',
    },
    avatarRingBlue: {
        borderColor: '#C9DDFB',
    },
    avatar: {
        width: '100%',
        height: '100%',
        backgroundColor: '#E5E7EB',
    },
    avatarPlaceholder: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarInitials: {
        fontFamily: 'Poppins-Bold',
        fontWeight: '700',
        fontSize: 20,
    },
    profileTextContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    name: {
        fontFamily: 'Poppins-SemiBold',
        fontWeight: '600',
        fontSize: 18,
        color: HomeColors.textPrimary,
        marginBottom: 2,
    },
    role: {
        fontFamily: 'Poppins-Regular',
        fontSize: 13,
        color: HomeColors.textMuted,
    },
    bioBox: {
        backgroundColor: '#FAF7F3',
        borderRadius: 14,
        padding: 12,
        marginBottom: 18,
        borderWidth: 1,
        borderColor: '#F0E8E0',
    },
    description: {
        fontFamily: 'Poppins-Regular',
        fontSize: 13,
        color: HomeColors.textSecondary,
        lineHeight: 20,
    },
    callButton: {
        backgroundColor: HomeColors.brandOrange,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 16,
        ...HomeShadows.hero,
    },
    buttonIcon: {
        marginRight: 8,
    },
    callButtonText: {
        fontFamily: 'Poppins-SemiBold',
        fontWeight: '600',
        fontSize: 15,
        color: '#FFFFFF',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        backgroundColor: HomeColors.pageBackground,
    },
    emptyCard: {
        width: '100%',
        backgroundColor: HomeColors.cardWhite,
        borderRadius: 24,
        padding: 28,
        alignItems: 'center',
        borderWidth: 1.08,
        borderColor: HomeColors.borderSubtle,
        ...HomeShadows.card,
    },
    emptyIconCircle: {
        width: 68,
        height: 68,
        borderRadius: 34,
        backgroundColor: HomeColors.peachBg,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 14,
    },
    emptyTitle: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 17,
        color: HomeColors.textPrimary,
        marginBottom: 6,
        textAlign: 'center',
    },
    loaderText: {
        fontFamily: 'Poppins-Medium',
        fontSize: 15,
        color: '#6B7280',
        marginTop: 12,
    },
    errorIconWrap: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#FEF3C7',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 14,
    },
    errorTitle: {
        fontSize: 18,
        color: '#111827',
        fontFamily: 'Poppins-SemiBold',
        marginBottom: 6,
        textAlign: 'center',
    },
    errorText: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        fontFamily: 'Poppins-Regular',
        lineHeight: 20,
        marginBottom: 20,
        paddingHorizontal: 20,
    },
    retryButton: {
        backgroundColor: '#FE6700',
        paddingHorizontal: 24,
        height: 48,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#FE6700',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 2,
    },
    retryText: {
        fontFamily: 'Poppins-Medium',
        fontSize: 14,
        color: '#FFFFFF',
    },
    // Guest Encouragement Styles
    guestContent: {
        flexGrow: 1,
        backgroundColor: '#FAF5ED',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: Platform.OS === 'ios' ? 120 : 100,
        justifyContent: 'center',
    },
    guestCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F3F4F6',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.06,
                shadowRadius: 16,
            },
            android: {
                elevation: 3,
            },
        }),
    },
    guestBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#FFF7ED',
        borderWidth: 1,
        borderColor: '#FFEDD5',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 5,
        marginBottom: 16,
    },
    guestBadgeText: {
        fontSize: 12,
        fontFamily: 'Poppins-Medium',
        color: '#FE6700',
    },
    guestIconWrap: {
        width: 76,
        height: 76,
        borderRadius: 38,
        backgroundColor: '#FFF7ED',
        borderWidth: 1,
        borderColor: '#FFEDD5',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    guestTitle: {
        fontSize: 20,
        fontFamily: 'Poppins-SemiBold',
        color: '#111827',
        textAlign: 'center',
        marginBottom: 8,
    },
    guestDesc: {
        fontSize: 13,
        fontFamily: 'Poppins-Regular',
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 20,
    },
    guestFeatureList: {
        width: '100%',
        backgroundColor: '#F9FAFB',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#F3F4F6',
        gap: 12,
        marginBottom: 24,
    },
    guestFeatureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    guestFeatureText: {
        fontSize: 13,
        fontFamily: 'Poppins-Regular',
        color: '#374151',
        flex: 1,
        lineHeight: 18,
    },
    guestPrimaryBtn: {
        width: '100%',
        backgroundColor: '#FE6700',
        borderRadius: 14,
        height: 52,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        shadowColor: '#FE6700',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 3,
    },
    guestPrimaryBtnText: {
        fontSize: 15,
        fontFamily: 'Poppins-SemiBold',
        color: '#FFFFFF',
    },
    guestSecondaryBtn: {
        marginTop: 14,
        paddingVertical: 8,
        alignItems: 'center',
    },
    guestSecondaryBtnText: {
        fontSize: 14,
        fontFamily: 'Poppins-Regular',
        color: '#6B7280',
    },
    guestSecondaryLink: {
        fontFamily: 'Poppins-SemiBold',
        color: '#FE6700',
    },
    emptyText: {
        fontFamily: 'Poppins-Regular',
        fontSize: 14,
        lineHeight: 20,
        color: HomeColors.textMuted,
        textAlign: 'center',
    },
});