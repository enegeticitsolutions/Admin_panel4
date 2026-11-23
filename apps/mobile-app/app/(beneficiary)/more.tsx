import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Platform,
    Image,
    useWindowDimensions,
    Alert,
} from 'react-native';
import { router } from 'expo-router';
import {
    Feather,
    MaterialCommunityIcons,
    Ionicons,
    AntDesign,
} from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLogoutWithConfirm } from '@/utils/logout';
import { useDeleteAccountWithConfirm } from '@/utils/deleteAccount';
import { API_URL } from '@/constants/api';
import { useSafeBack } from '@/hooks/useSafeBack';
import { useAuth } from '@/contexts/AuthContext';
import { sanitizeImageUri } from '@/utils/sanitizeImageUri';
import { HomeColors, HomeShadows } from '@/constants/homeTheme';
import CareSupportModal from '@/components/shared/CareSupportModal';

interface ActionCardProps {
    icon: React.ReactNode;
    iconBg: string;
    title: string;
    subtitle: string;
    onPress: () => void;
}

function ActionCard({ icon, iconBg, title, subtitle, onPress }: ActionCardProps) {
    return (
        <TouchableOpacity style={styles.actionCard} onPress={onPress} activeOpacity={0.8}>
            <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
                {icon}
            </View>
            <View style={styles.actionTextWrap}>
                <Text style={styles.actionTitle} numberOfLines={1}>
                    {title}
                </Text>
                <Text style={styles.actionSubtitle} numberOfLines={1}>
                    {subtitle}
                </Text>
            </View>
            <Feather name="chevron-right" size={20} color="#667085" />
        </TouchableOpacity>
    );
}

export default function MoreOptionsScreen() {
    const { width } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const MAX_CONTENT_WIDTH = 440;
    const responsiveStyle = { width: '100%' as const, maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' as const };

    const safeBack = useSafeBack();
    const logoutWithConfirm = useLogoutWithConfirm();
    const deleteAccountWithConfirm = useDeleteAccountWithConfirm();
    const { user, isGuest, requireAuth } = useAuth();

    const [supportModalVisible, setSupportModalVisible] = useState(false);

    // Fetch subscriber & plan data for the Active Plan Card
    const { data: subscriberData } = useQuery({
        queryKey: ['subscriberSummary', user?.id],
        queryFn: async () => {
            const storedToken = await AsyncStorage.getItem('userToken');
            if (!storedToken) return null;
            const response = await fetch(`${API_URL}/subscriber/dashboard/me`, {
                headers: {
                    Authorization: `Bearer ${storedToken}`,
                    'Content-Type': 'application/json',
                },
            });
            if (!response.ok) return null;
            const res = await response.json();
            return res.success ? (res.data || res) : null;
        },
        enabled: !isGuest,
    });

    // User Profile details
    const profileName = isGuest ? 'Guest User' : (user?.name || 'Care Member');
    const profilePhoto = isGuest ? null : (user?.photo || user?.profilePhoto || null);
    const getInitials = (name: string): string => {
        if (!name || isGuest) return 'GU';
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.slice(0, 2).toUpperCase();
    };
    const initials = getInitials(profileName);

    // Dynamic Care Circle & Role
    const careCircleCount = subscriberData?.beneficiaries?.length || 2;
    const profileRole = isGuest
        ? 'Guest Explorer'
        : user?.role === 'subscriber'
        ? 'Primary sponsor'
        : 'Care recipient';
    const profileSubtitle = isGuest
        ? 'Tap to sign in or create account'
        : `${profileRole} · ${careCircleCount} care circle${careCircleCount !== 1 ? 's' : ''}`;

    // Active Plan details
    const firstBeneficiary = subscriberData?.beneficiaries?.[0];
    const activeSub =
        firstBeneficiary?.subscriptions?.[0] ||
        subscriberData?.unlinkedSubscriptions?.[0] ||
        null;

    const packageName = activeSub?.package?.name || '';
    const assignedBeneficiary = firstBeneficiary?.name || user?.name || '';

    // Benefit hours metrics
    const hoursUsed = activeSub?.hoursUsed ?? 0;
    const hoursTotal = activeSub?.hoursTotal ?? 0;
    const rolloverHours = activeSub?.rolloverHours ?? 0;
    const usagePercent = hoursTotal > 0
        ? Math.min(Math.max((hoursUsed / hoursTotal) * 100, 0), 100)
        : 0;

    const handleRenewTopUp = () => {
        if (isGuest && requireAuth('Explore care packages and subscription plans.')) return;
        router.push('/(setup)/subscription-packages');
    };

    return (
        <View style={styles.root}>
            {/* Header with Safe Inset */}
            <View style={[styles.headerContainer, { paddingTop: Math.max(insets.top, 16) }]}>
                <View style={[styles.headerRow, responsiveStyle]}>
                    <View style={styles.headerTitles}>
                        <Text style={styles.headerCategory}>ACCOUNT & SUPPORT</Text>
                        <Text style={styles.headerTitle}>More</Text>
                    </View>
                </View>
            </View>

            <ScrollView
                style={styles.scrollContainer}
                contentContainerStyle={[styles.contentContainer, responsiveStyle]}
                showsVerticalScrollIndicator={false}
                bounces={true}
            >
                {/* ── 1. User Profile Card (Dark Navy #252D3A) ── */}
                <TouchableOpacity
                    style={styles.profileCard}
                    onPress={() => {
                        if (isGuest) {
                            requireAuth('Sign in or create an account to manage your profile.');
                        } else {
                            router.push('/(beneficiary)/profile');
                        }
                    }}
                    activeOpacity={0.88}
                >
                    <View style={styles.avatarWrap}>
                        {profilePhoto ? (
                            <Image
                                source={{ uri: sanitizeImageUri(profilePhoto) }}
                                style={styles.avatarImage}
                            />
                        ) : (
                            <Text style={styles.avatarInitials}>{initials}</Text>
                        )}
                    </View>

                    <View style={styles.profileTextWrap}>
                        <Text style={styles.profileName} numberOfLines={1}>
                            {profileName}
                        </Text>
                        <Text style={styles.profileSubtitle} numberOfLines={1}>
                            {profileSubtitle}
                        </Text>
                    </View>

                    <View style={styles.profileChevronBtn}>
                        <Feather name="chevron-right" size={20} color="#FFFFFF" />
                    </View>
                </TouchableOpacity>

                {/* ── 2. Active Plan Card (#FFFFFF with progress) ── */}
                {activeSub ? (
                    <View style={styles.activePlanCard}>
                        {/* Top Row: Badge & Renew Button */}
                        <View style={styles.planTopRow}>
                            <View style={styles.planBadge}>
                                <Text style={styles.planBadgeText}>ACTIVE PLAN</Text>
                            </View>

                            <TouchableOpacity
                                style={styles.renewBtn}
                                onPress={handleRenewTopUp}
                                activeOpacity={0.85}
                            >
                                <Text style={styles.renewBtnText}>Renew / top up</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Plan Heading & Assignment */}
                        <Text style={styles.planTitle}>{packageName}</Text>
                        {Boolean(assignedBeneficiary) && (
                            <Text style={styles.planAssignedText}>Assigned to {assignedBeneficiary}</Text>
                        )}

                        {/* Hours Stat Row */}
                        <View style={styles.hoursRow}>
                            <View>
                                <Text style={styles.hoursValue}>
                                    {hoursUsed} <Text style={styles.hoursTotal}>/ {hoursTotal} hrs</Text>
                                </Text>
                                <Text style={styles.hoursSubtext}>Available this month</Text>
                            </View>

                            {rolloverHours > 0 && (
                                <Text style={styles.rolloverText}>
                                    +{rolloverHours} rollover hours
                                </Text>
                            )}
                        </View>

                        {/* Progress Bar Track */}
                        <View style={styles.progressTrack}>
                            <View style={[styles.progressFill, { width: `${usagePercent}%` }]} />
                        </View>
                    </View>
                ) : (
                    <View style={styles.activePlanCard}>
                        <View style={styles.planTopRow}>
                            <View style={[styles.planBadge, { backgroundColor: '#F1F5F9' }]}>
                                <Text style={[styles.planBadgeText, { color: '#64748B' }]}>CARE PLANS</Text>
                            </View>

                            <TouchableOpacity
                                style={styles.renewBtn}
                                onPress={handleRenewTopUp}
                                activeOpacity={0.85}
                            >
                                <Text style={styles.renewBtnText}>Browse plans</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.planTitle}>No active plan</Text>
                        <Text style={[styles.planAssignedText, { marginBottom: 12 }]}>
                            Choose a care plan to get dedicated companions, vitals monitoring, and emergency support.
                        </Text>
                    </View>
                )}

                {/* ── 3. Dedicated Action Cards (Figma 6-Cards List) ── */}
                <View style={styles.actionCardsSection}>
                    {/* 1. Manage care circles */}
                    <ActionCard
                        icon={<Feather name="users" size={21} color="#2865C7" />}
                        iconBg="#EAF2FF"
                        title="Manage care circles"
                        subtitle="Members, permissions & invites"
                        onPress={() => {
                            if (requireAuth('Manage family care circles and members.')) return;
                            router.push('/(subscriber)');
                        }}
                    />

                    {/* 2. Invoices & payments */}
                    <ActionCard
                        icon={<Feather name="file-text" size={21} color="#158263" />}
                        iconBg="#E8F7F1"
                        title="Invoices & payments"
                        subtitle="GST invoices and payment methods"
                        onPress={() => {
                            if (requireAuth('View payment receipts and GST invoices.')) return;
                            router.push('/(subscriber)/order-history');
                        }}
                    />

                    {/* 3. Saathi Network */}
                    <ActionCard
                        icon={<MaterialCommunityIcons name="account-sync-outline" size={23} color="#FE6700" />}
                        iconBg="#FFF0E6"
                        title="Saathi Network"
                        subtitle="Connect requests and companions"
                        onPress={() => {
                            if (requireAuth('Request verified Saathi companions.')) return;
                            router.push('/(beneficiary)/sathi-request');
                        }}
                    />

                    {/* 4. Legacy Circle */}
                    <ActionCard
                        icon={<MaterialCommunityIcons name="star-four-points-outline" size={22} color="#A56400" />}
                        iconBg="#FFF3D2"
                        title="Legacy Circle"
                        subtitle="Stories, memories and profile"
                        onPress={() => router.push('/(beneficiary)/legacy-circle')}
                    />

                    {/* 5. Package Utilisation */}
                    <ActionCard
                        icon={<Feather name="pie-chart" size={21} color="#7154A4" />}
                        iconBg="#EFEAF8"
                        title="Package Utilisation"
                        subtitle="Track care hours, benefits & addon usage"
                        onPress={() => {
                            if (requireAuth('Track care hours and package utilization.')) return;
                            router.push('/package-utilization');
                        }}
                    />

                    {/* 6. Help & care support */}
                    <ActionCard
                        icon={<Ionicons name="help-buoy-outline" size={22} color="#D83E3E" />}
                        iconBg="#FDE7E7"
                        title="Help & care support"
                        subtitle="Chat or call us, anytime"
                        onPress={() => setSupportModalVisible(true)}
                    />
                </View>

                {/* ── 4. Additional Care Services Link Row ── */}
                <View style={styles.secondaryServicesRow}>
                    <TouchableOpacity
                        style={styles.secondaryServicePill}
                        onPress={() => {
                            if (requireAuth('Access medical records.')) return;
                            router.push('/(beneficiary)/medical-records');
                        }}
                        activeOpacity={0.75}
                    >
                        <Feather name="folder" size={14} color="#667085" />
                        <Text style={styles.secondaryServiceText}>Medical Records</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.secondaryServicePill}
                        onPress={() => {
                            if (requireAuth('View dedicated care team.')) return;
                            router.push('/(beneficiary)/team');
                        }}
                        activeOpacity={0.75}
                    >
                        <Feather name="user-check" size={14} color="#667085" />
                        <Text style={styles.secondaryServiceText}>Care Team</Text>
                    </TouchableOpacity>
                </View>

                {/* ── 5. Auth & Account Management Actions ── */}
                {isGuest ? (
                    <TouchableOpacity
                        style={styles.signInBtn}
                        onPress={() => requireAuth('Sign in or create an account to unlock all features.')}
                        activeOpacity={0.85}
                    >
                        <View style={styles.signInIconWrap}>
                            <Feather name="log-in" size={18} color="#FE6700" />
                        </View>
                        <Text style={styles.signInText}>Sign In / Create Account</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={styles.accountActionSection}>
                        <TouchableOpacity
                            style={styles.logoutBtn}
                            onPress={logoutWithConfirm}
                            activeOpacity={0.85}
                        >
                            <View style={styles.logoutIconBox}>
                                <Feather name="log-out" size={17} color="#DC2626" />
                            </View>
                            <Text style={styles.logoutText}>Log Out</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.deleteAccountBtn}
                            onPress={deleteAccountWithConfirm}
                            activeOpacity={0.75}
                        >
                            <Feather name="trash-2" size={14} color="#DC2626" />
                            <Text style={styles.deleteAccountText}>Delete Account</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={{ height: Platform.OS === 'ios' ? 120 : 100 }} />
            </ScrollView>

            {/* ── Care Support Modal ── */}
            <CareSupportModal
                visible={supportModalVisible}
                onClose={() => setSupportModalVisible(false)}
                emailSubject="MaiHoonNa Beneficiary Support"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: HomeColors.pageBackground,
    },
    headerContainer: {
        backgroundColor: 'rgba(250, 243, 235, 0.95)',
        borderBottomWidth: 1.08,
        borderBottomColor: HomeColors.borderSubtle,
        paddingHorizontal: 16,
        paddingBottom: 14,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
    },
    headerTitles: {
        flexDirection: 'column',
    },
    headerCategory: {
        fontFamily: 'Poppins-Bold',
        fontSize: 12,
        lineHeight: 16,
        letterSpacing: 1.56,
        textTransform: 'uppercase',
        color: HomeColors.brandOrange,
        marginBottom: 2,
    },
    headerTitle: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 21,
        lineHeight: 30,
        letterSpacing: -0.525,
        color: '#1F2937',
    },
    scrollContainer: {
        flex: 1,
        backgroundColor: HomeColors.pageBackground,
    },
    contentContainer: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 40,
    },

    /* ── Profile Card (#252D3A) ── */
    profileCard: {
        width: '100%',
        backgroundColor: '#252D3A',
        borderRadius: 26,
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        shadowColor: '#252D3A',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.16,
        shadowRadius: 16,
        elevation: 5,
    },
    avatarWrap: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#FFF0E6',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
        overflow: 'hidden',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    avatarInitials: {
        fontFamily: 'Poppins-Bold',
        fontSize: 18,
        lineHeight: 26,
        color: HomeColors.brandOrange,
    },
    profileTextWrap: {
        flex: 1,
        justifyContent: 'center',
    },
    profileName: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 18,
        lineHeight: 25,
        color: '#FFFFFF',
        marginBottom: 3,
    },
    profileSubtitle: {
        fontFamily: 'Poppins-Regular',
        fontSize: 13,
        lineHeight: 18,
        color: 'rgba(255, 255, 255, 0.58)',
    },
    profileChevronBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },

    /* ── Active Plan Card (#FFFFFF) ── */
    activePlanCard: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 26,
        borderWidth: 1.08,
        borderColor: HomeColors.borderSubtle,
        padding: 20,
        marginBottom: 22,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 2,
    },
    planTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    planBadge: {
        backgroundColor: '#FFF0E6',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
    },
    planBadgeText: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 11,
        lineHeight: 15,
        letterSpacing: 0.5,
        color: HomeColors.brandOrange,
    },
    renewBtn: {
        backgroundColor: HomeColors.brandOrange,
        paddingHorizontal: 18,
        height: 38,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: HomeColors.brandOrange,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 3,
    },
    renewBtnText: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 13,
        color: '#FFFFFF',
    },
    planTitle: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 20,
        lineHeight: 27,
        color: '#1F2937',
        marginTop: 4,
    },
    planAssignedText: {
        fontFamily: 'Poppins-Regular',
        fontSize: 14,
        lineHeight: 20,
        color: '#667085',
        marginTop: 2,
        marginBottom: 16,
    },
    hoursRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: 12,
    },
    hoursValue: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 28,
        lineHeight: 34,
        color: '#1F2937',
    },
    hoursTotal: {
        fontFamily: 'Poppins-Regular',
        fontSize: 20,
        color: '#667085',
    },
    hoursSubtext: {
        fontFamily: 'Poppins-Regular',
        fontSize: 13,
        lineHeight: 18,
        color: '#667085',
        marginTop: 2,
    },
    rolloverText: {
        fontFamily: 'Poppins-Medium',
        fontSize: 12,
        lineHeight: 16,
        textAlign: 'right',
        color: '#14724F',
    },
    progressTrack: {
        width: '100%',
        height: 12,
        backgroundColor: '#EFE5DD',
        borderRadius: 6,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: HomeColors.brandOrange,
        borderRadius: 6,
    },

    /* ── Action Cards Section (6 Individual Cards) ── */
    actionCardsSection: {
        width: '100%',
        gap: 12,
        marginBottom: 20,
    },
    actionCard: {
        width: '100%',
        minHeight: 88,
        backgroundColor: '#FFFFFF',
        borderRadius: 22,
        borderWidth: 1.08,
        borderColor: HomeColors.borderSubtle,
        paddingHorizontal: 16,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 2,
    },
    iconBox: {
        width: 48,
        height: 48,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    actionTextWrap: {
        flex: 1,
        justifyContent: 'center',
    },
    actionTitle: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 16,
        lineHeight: 22,
        color: '#1F2937',
        marginBottom: 2,
    },
    actionSubtitle: {
        fontFamily: 'Poppins-Medium',
        fontSize: 12,
        lineHeight: 17,
        color: '#667085',
    },

    /* ── Secondary Services Row ── */
    secondaryServicesRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
        marginBottom: 24,
    },
    secondaryServicePill: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1.08,
        borderColor: HomeColors.borderSubtle,
        borderRadius: 14,
        paddingVertical: 10,
        paddingHorizontal: 8,
        gap: 6,
    },
    secondaryServiceText: {
        fontFamily: 'Poppins-Medium',
        fontSize: 11,
        color: '#4B5563',
    },

    /* ── Account Actions ── */
    accountActionSection: {
        width: '100%',
        alignItems: 'center',
        gap: 8,
        marginTop: 6,
    },
    logoutBtn: {
        width: '100%',
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 22,
        borderWidth: 1.2,
        borderColor: '#FEE2E2',
        paddingVertical: 12,
        paddingHorizontal: 20,
        gap: 12,
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 2,
    },
    logoutIconBox: {
        width: 34,
        height: 34,
        borderRadius: 12,
        backgroundColor: '#FEE2E2',
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoutText: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 15,
        color: '#DC2626',
    },
    deleteAccountBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 16,
        gap: 6,
        marginTop: 2,
    },
    deleteAccountText: {
        fontFamily: 'Poppins-Medium',
        fontSize: 13,
        color: '#9CA3AF',
    },

    /* ── Guest Sign-in ── */
    signInBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderWidth: 1.5,
        borderColor: '#FFEDD5',
        shadowColor: HomeColors.brandOrange,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 2,
    },
    signInIconWrap: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: '#FFF7ED',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    signInText: {
        flex: 1,
        fontSize: 15,
        fontFamily: 'Poppins-SemiBold',
        color: HomeColors.brandOrange,
    },
});
