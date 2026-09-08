import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Platform, ActivityIndicator, useWindowDimensions, RefreshControl } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/api';
import { ConnectContactButton } from '@/components/shared/ConnectContactModal';
import { sanitizeImageUri } from '@/utils/sanitizeImageUri';
import { useSafeBack } from '@/hooks/useSafeBack';
import { useGlobalRefresh } from '@/utils/events';
import { useFocusEffect } from 'expo-router';

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

    const [team, setTeam] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useFocusEffect(useCallback(() => { fetchTeam(); }, []));
    useGlobalRefresh(() => { fetchTeam(); });

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchTeam();
        setRefreshing(false);
    }, []);

    const fetchTeam = async () => {
        try {
            setLoading(true);
            setError(null);

            const token = await AsyncStorage.getItem('userToken');
            const userStr = await AsyncStorage.getItem('userData');

            if (!token || !userStr) {
                setError('User session not found. Please log in again.');
                setLoading(false);
                return;
            }

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
            setError('An error occurred while loading your care team');
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

            {loading ? (
                <View style={[styles.centerContainer, responsiveStyle]}>
                    <ActivityIndicator size="large" color="#FE6700" />
                    <Text style={styles.loaderText}>Loading your care team...</Text>
                </View>
            ) : error ? (
                <View style={[styles.centerContainer, responsiveStyle]}>
                    <Feather name="alert-triangle" size={48} color="#EF4444" />
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={fetchTeam}>
                        <Text style={styles.retryText}>Retry</Text>
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
    errorText: {
        fontFamily: 'Poppins-Medium',
        fontSize: 15,
        color: '#EF4444',
        textAlign: 'center',
        marginTop: 12,
    },
    retryButton: {
        backgroundColor: '#FE6700',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
        marginTop: 16,
    },
    retryText: {
        fontFamily: 'Poppins-Medium',
        fontSize: 14,
        color: '#FFFFFF',
    },
    emptyText: {
        fontFamily: 'Poppins-Regular',
        fontSize: 15,
        color: '#9CA3AF',
        marginTop: 12,
    },
});