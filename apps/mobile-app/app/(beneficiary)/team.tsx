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
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

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
    const { isGuest, isLoggedIn, isLoading: authLoading } = useAuth();
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
        }, [authLoading, isGuest, isLoggedIn])
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
    }, [isGuest, isLoggedIn]);

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
            const userId = user.id;

            const response = await fetch(`${API_URL}/beneficiary/${userId}/team`, {
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

    const getTagStyle = (level: string) =>
        level === 'Primary' ? styles.badgePrimary : styles.badgeSecondary;

    const getTagTextStyle = (level: string) =>
        level === 'Primary' ? styles.badgeTextPrimary : styles.badgeTextSecondary;

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={[styles.header, responsiveStyle]}>
                <TouchableOpacity
                    onPress={() => safeBack('/(beneficiary)')}
                    style={styles.backBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                >
                    <Feather name="arrow-left" size={22} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Your Care Team</Text>
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
                    <Feather name="users" size={48} color="#9CA3AF" />
                    <Text style={styles.emptyText}>No care team assigned yet.</Text>
                </View>
            ) : (
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={[styles.content, responsiveStyle]}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FE6700" />}
                >
                    {team.map((member) => (
                        <View key={member.id} style={styles.card}>
                            {/* Tag Badge */}
                            <View style={[styles.badge, getTagStyle(member.level)]}>
                                <Text style={[styles.badgeText, getTagTextStyle(member.level)]}>
                                    {member.level}
                                </Text>
                            </View>

                            {/* Profile Info */}
                            <View style={styles.profileRow}>
                                <View style={styles.avatarContainer}>
                                    {member.photo ? (
                                        <Image source={{ uri: sanitizeImageUri(member.photo) }} style={styles.avatar} />
                                    ) : (
                                        <View style={styles.avatarPlaceholder}>
                                            <Feather name="user" size={26} color="#9CA3AF" />
                                        </View>
                                    )}
                                </View>

                                <View style={styles.profileTextContainer}>
                                    <Text style={styles.name}>{member.name}</Text>
                                    <Text style={styles.role}>{member.role}</Text>
                                </View>
                            </View>

                            {/* Bio */}
                            <Text style={styles.description}>{member.bio}</Text>

                            {/* Call Button — uses ConnectContactButton for the modal */}
                            <ConnectContactButton
                                name={member.name}
                                role={member.role}
                                phone={member.phone}
                                photo={member.photo}
                                trigger={
                                    <View style={styles.callButton}>
                                        <Feather name="phone" size={18} color="#FFFFFF" style={styles.buttonIcon} />
                                        <Text style={styles.callButtonText}>Call</Text>
                                    </View>
                                }
                            />
                        </View>
                    ))}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        height: 60,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    backBtn: {
        position: 'absolute',
        left: 20,
        zIndex: 1,
    },
    headerTitle: {
        fontFamily: 'Poppins-Medium',
        fontSize: 18,
        color: '#111827',
    },
    scroll: {
        flex: 1,
        backgroundColor: '#FAF5ED',
    },
    content: {
        padding: 20,
        paddingBottom: Platform.OS === 'ios' ? 100 : 80,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    badge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        marginBottom: 16,
    },
    badgePrimary: {
        backgroundColor: '#FFF0E6',
    },
    badgeSecondary: {
        backgroundColor: '#F3F4F6',
    },
    badgeText: {
        fontFamily: 'Poppins-Medium',
        fontSize: 12,
    },
    badgeTextPrimary: {
        color: '#FE6700',
    },
    badgeTextSecondary: {
        color: '#4B5563',
    },
    profileRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    avatarContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        overflow: 'hidden',
        marginRight: 16,
    },
    avatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#E5E7EB',
    },
    avatarPlaceholder: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    profileTextContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    name: {
        fontFamily: 'Poppins-Medium',
        fontSize: 18,
        color: '#111827',
        marginBottom: 2,
    },
    role: {
        fontFamily: 'Poppins-Regular',
        fontSize: 14,
        color: '#9CA3AF',
    },
    description: {
        fontFamily: 'Poppins-Regular',
        fontSize: 14,
        color: '#4B5563',
        lineHeight: 22,
        marginBottom: 20,
    },
    callButton: {
        flex: 1,
        backgroundColor: '#FE6700',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
    },
    buttonIcon: {
        marginRight: 8,
    },
    callButtonText: {
        fontFamily: 'Poppins-Medium',
        fontSize: 15,
        color: '#FFFFFF',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        backgroundColor: '#FAF5ED',
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
        fontSize: 15,
        color: '#9CA3AF',
        marginTop: 12,
    },
});