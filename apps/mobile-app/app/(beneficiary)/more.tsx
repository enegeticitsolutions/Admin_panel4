import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Image, useWindowDimensions, Alert, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
    Feather, MaterialCommunityIcons,
    FontAwesome5, Ionicons, AntDesign
} from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLogoutWithConfirm } from '@/utils/logout';
import { useDeleteAccountWithConfirm } from '@/utils/deleteAccount';
import { API_URL } from '@/constants/api';
import { useSafeBack } from '@/hooks/useSafeBack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { sanitizeImageUri } from '@/utils/sanitizeImageUri';

interface MenuItemProps {
    icon: React.ReactNode;
    label: string;
    iconBg: string;
    onPress: () => void;
}

function MenuItem({ icon, label, iconBg, onPress }: MenuItemProps) {
    return (
        <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.6}>
            <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
                {icon}
            </View>
            <Text style={styles.menuLabel}>{label}</Text>
            <Feather name="chevron-right" size={18} color="#9CA3AF" />
        </TouchableOpacity>
    );
}

export default function MoreOptionsScreen() {
    const { width } = useWindowDimensions();
    const MAX_CONTENT_WIDTH = 440;
    const responsiveStyle = { width: '100%' as const, maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' as const };

    const [profileName, setProfileName] = useState('Margaret Williams');
    const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
    const safeBack = useSafeBack();
    const logoutWithConfirm = useLogoutWithConfirm();
    const deleteAccountWithConfirm = useDeleteAccountWithConfirm();
    const { availableRoles, isSwitchingRole, switchRole } = useAuth();
    const isDualRole = availableRoles.includes('subscriber') && availableRoles.includes('beneficiary');

    useFocusEffect(
        useCallback(() => {
            loadProfileName();
        }, [])
    );

    const loadProfileName = async () => {
        try {
            const userDataStr = await AsyncStorage.getItem('userData');
            if (userDataStr) {
                const userData = JSON.parse(userDataStr);
                if (userData.name) {
                    setProfileName(userData.name);
                }
                if (userData.photo) {
                    setProfilePhoto(userData.photo);
                }
            }
        } catch (e) {
            console.error('Error loading profile name:', e);
        }
    };

    const handleSwitchToSubscriber = async () => {
        try {
            await switchRole('subscriber');
            router.replace('/(subscriber)');
        } catch (err: any) {
            Alert.alert('Switch Failed', err?.message || 'Could not switch profile. Please try again.');
        }
    };

    const menuItems: MenuItemProps[] = [
        {
            icon: <FontAwesome5 name="user-friends" size={16} color="#3B82F6" />,
            label: 'Care Team',
            iconBg: '#EFF6FF',
            onPress: () => router.push('/(beneficiary)/team'),
        },
        {
            icon: <MaterialCommunityIcons name="history" size={20} color="#8B5CF6" />,
            label: 'Interactions',
            iconBg: '#F5F3FF',
            onPress: () => router.push('/(beneficiary)/interactions'),
        },
        {
            icon: <MaterialCommunityIcons name="file-document-outline" size={20} color="#10B981" />,
            label: 'Medical Records',
            iconBg: '#ECFDF5',
            onPress: () => router.push('/(beneficiary)/medical-records'),
        },
        {
            icon: <Feather name="package" size={18} color="#F97316" />,
            label: 'Package Utilization',
            iconBg: '#FFF3EB',
            onPress: () => router.push('/package-utilization'),
        },
        {
            icon: <AntDesign name="heart" size={16} color="#EC4899" />,
            label: 'Saathi Network',
            iconBg: '#FDF2F8',
            onPress: () => router.push('/(beneficiary)/sathi-request'),
        },
        // {
        //     icon: <MaterialCommunityIcons name="star-circle-outline" size={20} color="#F59E0B" />,
        //     label: 'Legacy Circle',
        //     iconBg: '#FEF3C7',
        //     onPress: () => router.push('/(beneficiary)/legacy-circle'),
        // },
    ];

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={[styles.header, responsiveStyle]}>
                <TouchableOpacity onPress={() => safeBack()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Feather name="arrow-left" size={22} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>More Options</Text>
            </View>

            <ScrollView
                style={styles.scrollContainer}
                contentContainerStyle={[styles.content, responsiveStyle]}
                showsVerticalScrollIndicator={false}
            >
                <TouchableOpacity
                    style={styles.profileCard}
                    onPress={() => router.push('/(beneficiary)/profile')}
                    activeOpacity={0.9}
                >
                    {profilePhoto ? (
                        <Image
                            source={{ uri: sanitizeImageUri(profilePhoto) }}
                            style={styles.profileAvatar}
                        />
                    ) : (
                        <Image
                            source={require('../../assets/images/group4.png')}
                            style={styles.profileAvatar}
                            defaultSource={require('../../assets/images/group4.png')}
                        />
                    )}
                    <View style={styles.profileTextWrap}>
                        <Text style={styles.profileName}>{profileName}</Text>
                        <Text style={styles.profileSubtitle}>View & edit profile</Text>
                    </View>
                    <Feather name="chevron-right" size={20} color="#FFFFFF" />
                </TouchableOpacity>

                {isDualRole && (
                    <TouchableOpacity
                        style={styles.switchRoleCard}
                        onPress={handleSwitchToSubscriber}
                        activeOpacity={0.85}
                        disabled={isSwitchingRole}
                    >
                        <View style={styles.switchRoleLeft}>
                            <View style={styles.switchRoleIconBox}>
                                {isSwitchingRole ? (
                                    <ActivityIndicator size="small" color="#FF5C00" />
                                ) : (
                                    <Ionicons name="shield-checkmark-outline" size={18} color="#FF5C00" />
                                )}
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.switchRoleTitle}>Switch to Subscriber Dashboard</Text>
                                <Text style={styles.switchRoleSub}>Manage plans, payments & beneficiaries</Text>
                            </View>
                        </View>
                        <Ionicons name="swap-horizontal-outline" size={20} color="#FF5C00" />
                    </TouchableOpacity>
                )}

                <View style={styles.card}>
                    {menuItems.map((item, index) => (
                        <React.Fragment key={item.label}>
                            <MenuItem {...item} />
                            {index < menuItems.length - 1 && <View style={styles.divider} />}
                        </React.Fragment>
                    ))}
                </View>

                <TouchableOpacity
                    style={styles.logoutBtn}
                    onPress={logoutWithConfirm}
                    activeOpacity={0.75}
                >
                    <View style={styles.logoutIconWrap}>
                        <Feather name="log-out" size={18} color="#EF4444" />
                    </View>
                    <Text style={styles.logoutText}>Log Out</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.deleteAccountBtn}
                    onPress={deleteAccountWithConfirm}
                    activeOpacity={0.75}
                >
                    <View style={styles.deleteAccountIconWrap}>
                        <Feather name="trash-2" size={18} color="#DC2626" />
                    </View>
                    <Text style={styles.deleteAccountText}>Delete Account</Text>
                </TouchableOpacity>

                <View style={{ height: Platform.OS === 'ios' ? 120 : 100 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
    header: { height: 60, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    backBtn: { position: 'absolute', left: 20, zIndex: 1 },
    headerTitle: { fontSize: 18, color: '#111827', fontFamily: 'Poppins-Medium' },
    scrollContainer: { flex: 1, backgroundColor: '#FFF0E6' },
    content: { padding: 20 },
    profileCard: { backgroundColor: '#FE6700', borderRadius: 16, padding: 20, flexDirection: 'row', alignItems: 'center', marginBottom: 20, shadowColor: '#FE6700', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 6 },
    profileAvatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: '#FFFFFF', marginRight: 16 },
    profileTextWrap: { flex: 1 },
    profileName: { fontSize: 18, color: '#FFFFFF', fontFamily: 'Poppins-Medium', marginBottom: 2 },
    profileSubtitle: { fontSize: 13, color: 'rgba(255, 255, 255, 0.9)', fontFamily: 'Poppins-Regular' },
    switchRoleCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF7ED', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 20, borderWidth: 1.5, borderColor: '#FFEDD5' },
    switchRoleLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    switchRoleIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FFF1E6', justifyContent: 'center', alignItems: 'center', marginRight: 10, borderWidth: 1, borderColor: '#FFEDD5' },
    switchRoleTitle: { fontSize: 13, fontWeight: '700', color: '#111827' },
    switchRoleSub: { fontSize: 11, color: '#6B7280', marginTop: 1 },
    card: { backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 8, shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 2, marginBottom: 20, borderWidth: 1, borderColor: '#F3F4F6' },
    menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
    iconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    menuLabel: { flex: 1, fontSize: 15, color: '#374151', fontFamily: 'Poppins-Medium' },
    divider: { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: 16 },
    logoutBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: '#FEE2E2', marginBottom: 12 },
    logoutIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    logoutText: { flex: 1, fontSize: 15, color: '#EF4444', fontFamily: 'Poppins-Medium' },
    deleteAccountBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: '#FECDD3' },
    deleteAccountIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FFF1F2', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    deleteAccountText: { flex: 1, fontSize: 15, color: '#DC2626', fontFamily: 'Poppins-Medium' },
});