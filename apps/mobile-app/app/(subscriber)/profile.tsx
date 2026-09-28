import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Platform, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_URL } from '@/constants/api';
import { useLogoutWithConfirm } from '@/utils/logout';
import { useAuth } from '@/contexts/AuthContext';

// Components
import { ProfileHero } from './components/profile/ProfileHero';
import { PersonalTab } from './components/profile/PersonalTab';
import SecurityTab from './components/profile/SecurityTab';
import SubscriptionTab from './components/profile/SubscriptionTab';
import GlobalDrawer from './components/shared/GlobalDrawer';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigationStack } from '@/contexts/NavigationStackContext';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';

import NotificationBell from '@/components/shared/NotificationBell';
import { BeneficiariesModal } from './components/profile/BeneficiariesModal';

type TabType = 'Personal' | 'Security' | 'Subscription';

export default function ProfileScreen() {
    const router = useRouter();
    const { push, replace, pop } = useNavigationStack();
    const { updateUser } = useAuth();
    useAndroidBackHandler();
    const logoutWithConfirm = useLogoutWithConfirm();
    const [loading, setLoading] = useState(true);
    const [profileData, setProfileData] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<TabType>('Personal');
    const [showBeneficiariesModal, setShowBeneficiariesModal] = useState(false);

    // Drawer state
    const [drawerOpen, setDrawerOpen] = useState(false);
    const { width } = Dimensions.get('window');
    const DRAWER_WIDTH = width * 0.75;
    const drawerAnim = React.useRef(new Animated.Value(DRAWER_WIDTH)).current;

    const openDrawer = () => {
        setDrawerOpen(true);
        Animated.timing(drawerAnim, { toValue: 0, duration: 280, useNativeDriver: true }).start();
    };
    const closeDrawer = () => {
        Animated.timing(drawerAnim, { toValue: DRAWER_WIDTH, duration: 240, useNativeDriver: true }).start(() => setDrawerOpen(false));
    };

    const fetchProfile = async () => {
        try {
            const token = await AsyncStorage.getItem('userToken');
            if (!token) {
                replace('/(auth)');
                return;
            }

            const storedBenId = await AsyncStorage.getItem('selectedBeneficiaryId');
            let url = `${API_URL}/subscriber/profile`;
            if (storedBenId) {
                url += `?beneficiaryId=${storedBenId}`;
            }

            const res = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            const data = await res.json();
            if (data.success && data.data) {
                setProfileData(data.data);
                if (data.data.user) {
                    try {
                        const storedUser = await AsyncStorage.getItem('userData');
                        const parsed = storedUser ? JSON.parse(storedUser) : {};
                        const updatedUser = {
                            ...parsed,
                            ...data.data.user,
                            photo: data.data.user.profilePhoto || parsed.photo,
                            profilePhoto: data.data.user.profilePhoto || parsed.profilePhoto,
                        };
                        await AsyncStorage.setItem('userData', JSON.stringify(updatedUser));
                        if (updateUser) {
                            await updateUser(token, updatedUser);
                        }
                    } catch (e) {
                        // non-critical
                    }
                }
            }
        } catch (e) {
            console.error('Profile fetch error:', e);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchProfile();
        }, [])
    );

    if (loading) {
        return (
            <SafeAreaView style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#F97316" />
            </SafeAreaView>
        );
    }

    if (!profileData) {
        return (
            <SafeAreaView style={styles.centerContainer}>
                <Text style={styles.errorText}>Failed to load profile.</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={fetchProfile}>
                    <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Inline header */}
            <View style={styles.inlineHeader}>
                <TouchableOpacity onPress={() => pop()} style={styles.iconBtn}>
                    <Ionicons name="arrow-back" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Profile</Text>
                <View style={styles.iconBtn}>
                    <NotificationBell />
                </View>
                <TouchableOpacity onPress={openDrawer} style={styles.iconBtn}>
                    <Ionicons name="menu-outline" size={28} color="#111827" />
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 36 }}
            >
                {/* Hero section */}
                <ProfileHero
                    user={profileData.user}
                    stats={profileData.stats}
                    onPhotoUpdated={fetchProfile}
                    onPressBeneficiaries={() => setShowBeneficiariesModal(true)}
                />

                {/* Tabs Selector */}
                <View style={styles.tabsWrapper}>
                    <View style={styles.tabsContainer}>
                        {(['Personal', 'Security', 'Subscription'] as TabType[]).map((tab) => (
                            <TouchableOpacity
                                key={tab}
                                style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
                                onPress={() => setActiveTab(tab)}
                            >
                                <Ionicons
                                    name={tab === 'Personal' ? 'person-outline' : tab === 'Security' ? 'lock-closed-outline' : 'ribbon-outline'}
                                    size={15}
                                    color={activeTab === tab ? '#FFF' : '#3A3A3A'}
                                    style={{ marginRight: 4 }}
                                />
                                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]} numberOfLines={1}>{tab}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Tab Content */}
                <View style={styles.tabContent}>
                    {activeTab === 'Personal' && <PersonalTab user={profileData.user} onUpdate={fetchProfile} />}
                    {activeTab === 'Security' && <SecurityTab />}
                    {activeTab === 'Subscription' && (
                        <SubscriptionTab
                            plan={profileData.currentPlan}
                            beneficiaries={profileData.beneficiaries}
                            hasUnassignedPackage={profileData.hasUnassignedPackage}
                        />
                    )}
                </View>

                {/* Logout Button */}
                <TouchableOpacity style={styles.logoutBtn} onPress={logoutWithConfirm}>
                    <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>
            </ScrollView>

            <GlobalDrawer
                isOpen={drawerOpen}
                onClose={closeDrawer}
                drawerAnim={drawerAnim}
                userData={profileData.user}
            />

            {/* Beneficiaries List Modal (Active & Inactive) */}
            <BeneficiariesModal
                visible={showBeneficiariesModal}
                onClose={() => setShowBeneficiariesModal(false)}
                beneficiaries={profileData.beneficiaries || []}
                hasUnassignedPackage={profileData.hasUnassignedPackage}
                onSelectBeneficiary={(benId) => {
                    fetchProfile();
                }}
                onRefresh={fetchProfile}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF2E8' },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF2E8' },
    inlineHeader: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFF2E8',
    },
    headerTitle: { flex: 1, fontSize: 17, fontWeight: '600', color: '#111827', marginLeft: 6 },
    iconBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', position: 'relative' },
    badge: {
        position: 'absolute', top: 4, right: -2, backgroundColor: '#FE6700',
        width: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center',
        borderWidth: 1, borderColor: '#FFF2E8',
    },
    badgeText: { color: '#FFF', fontSize: 8, fontWeight: '800' },
    scrollView: { flex: 1 },
    tabsWrapper: {
        marginHorizontal: 15,
        marginTop: 18,
        marginBottom: 18,
    },
    tabContent: { paddingHorizontal: 15 },
    tabsContainer: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 15,
        padding: 4,
        borderWidth: 1,
        borderColor: '#F1DED0',
        ...Platform.select({
            ios: { shadowColor: '#4A2B17', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8 },
            android: { elevation: 3 }
        })
    },
    tabBtn: {
        flex: 1,
        paddingHorizontal: 4,
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
    },
    tabBtnActive: { backgroundColor: '#FF5B0A' },
    tabText: { fontSize: 13, fontWeight: '600', color: '#4B5563' },
    tabTextActive: { color: '#FFFFFF' },

    logoutBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#FFFFFF', marginHorizontal: 15, marginTop: 20,
        minHeight: 55, borderRadius: 15,
        borderWidth: 1, borderColor: '#F2E7DE',
        ...Platform.select({
            ios: { shadowColor: '#4A2B17', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8 },
            android: { elevation: 2 }
        })
    },
    logoutText: { marginLeft: 10, fontSize: 17, fontWeight: '700', color: '#DC2626' },
    errorText: { fontSize: 16, color: '#6B7280', marginBottom: 20 },
    retryBtn: { backgroundColor: '#F97316', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
    retryText: { color: '#FFFFFF', fontWeight: '700' },
});
