import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, ActivityIndicator, useWindowDimensions, Modal, TextInput, Alert, KeyboardAvoidingView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ProfilePhotoUploader } from '@/components/ui/ProfilePhotoUploader';
import { CompanionBackButton } from '../../components/care-companion/CompanionBackButton';
import { useLogoutWithConfirm } from '@/utils/logout';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    interpolateColor,
    FadeInUp
} from 'react-native-reanimated';

// Fonts & Colors
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { CompanionBottomNav } from '../../components/care-companion/CompanionBottomNav';
import { API_URL } from '@/constants/api';
import { useNavigationStack } from '@/contexts/NavigationStackContext';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';

const DEEP_ORANGE = '#FE6700';
const LIGHT_BEIGE = '#FAF3EB';
const API_BASE_URL = API_URL;

// PREMIUM REANIMATED TOGGLE COMPONENT
const CustomToggle = ({ value, onValueChange }: { value: boolean, onValueChange: (val: boolean) => void }) => {
    const isOn = useSharedValue(value ? 1 : 0);

    React.useEffect(() => {
        isOn.value = withSpring(value ? 1 : 0, { damping: 15, stiffness: 120 });
    }, [value]);

    const trackStyle = useAnimatedStyle(() => {
        const backgroundColor = interpolateColor(
            isOn.value,
            [0, 1],
            ['#D1D5DB', DEEP_ORANGE]
        );
        return { backgroundColor };
    });

    const thumbStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateX: isOn.value * 20 }]
        };
    });

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onValueChange(!value);
    };

    return (
        <TouchableOpacity activeOpacity={0.9} onPress={handlePress}>
            <Animated.View style={[styles.toggleTrack, trackStyle]}>
                <Animated.View style={[styles.toggleThumb, thumbStyle]} />
            </Animated.View>
        </TouchableOpacity>
    );
};

export default function ProfileScreen() {
    const router = useRouter();
    const { push, replace, pop } = useNavigationStack();
    useAndroidBackHandler();
    
    const [loading, setLoading] = useState(true);
    const [profileData, setProfileData] = useState<any>(null);

    // Edit Profile Modal State
    const [isEditProfileModalVisible, setIsEditProfileModalVisible] = useState(false);
    const [editForm, setEditForm] = useState({
        name: '',
        phone: '',
        email: '',
        location: '',
        bio: '',
    });
    const [savingProfile, setSavingProfile] = useState(false);

    // Toggle States for Notifications (Persistent)
    const [toggles, setToggles] = useState({
        reminders: true,
        celebrations: true,
    });

    let [fontsLoaded] = useFonts({
        Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold,
    });

    // Load persistent toggle settings on mount
    React.useEffect(() => {
        const loadNotificationSettings = async () => {
            try {
                const saved = await AsyncStorage.getItem('cc_notification_toggles');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    setToggles({
                        reminders: parsed.reminders ?? true,
                        celebrations: parsed.celebrations ?? true,
                    });
                }
            } catch (err) {
                console.log('Failed to load notification settings:', err);
            }
        };
        loadNotificationSettings();
    }, []);

    // Toggle Handler: saves locally and syncs setting
    const handleToggleChange = async (key: 'reminders' | 'celebrations', value: boolean) => {
        const updated = { ...toggles, [key]: value };
        setToggles(updated);
        try {
            await AsyncStorage.setItem('cc_notification_toggles', JSON.stringify(updated));
        } catch (err) {
            console.log('Failed to save notification settings:', err);
        }
    };

    // Auto-Fetch Profile
    useFocusEffect(
        useCallback(() => {
            let isActive = true;

            const fetchProfileData = async () => {
                setLoading(true);
                try {
                    const token = await AsyncStorage.getItem('userToken');
                    if (!token) {
                        replace('/(auth)');
                        return;
                    }

                    const response = await fetch(`${API_BASE_URL}/care-companion/profile`, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    if (!response.ok) throw new Error("Backend offline");

                    const json = await response.json();
                    if (isActive) setProfileData(json.data || json);
                } catch (error) {
                    console.log("Backend offline or error. Loading Profile UI...", error);
                    if (isActive) {
                        setProfileData({
                            name: "",
                            initials: "",
                            role: "Care Mitra",
                            verified: false,
                            email: "",
                            phone: "",
                            location: "",
                            bio: "",
                            memberSince: "",
                            impact: { visits: 0, hours: 0, clients: 0 }
                        });
                    }
                } finally {
                    if (isActive) setLoading(false);
                }
            };

            if (fontsLoaded) fetchProfileData();
            return () => { isActive = false; };
        }, [fontsLoaded])
    );

    // Open Edit Profile Modal with current values
    const handleOpenEditProfile = () => {
        setEditForm({
            name: profileData?.name || '',
            phone: profileData?.phone || '',
            email: profileData?.email || '',
            location: profileData?.location === 'N/A' ? '' : (profileData?.location || ''),
            bio: profileData?.bio || '',
        });
        setIsEditProfileModalVisible(true);
    };

    // Save Profile Handler
    const handleSaveProfile = async () => {
        if (!editForm.name.trim()) {
            Alert.alert('Required', 'Please enter your full name.');
            return;
        }

        setSavingProfile(true);
        try {
            const token = await AsyncStorage.getItem('userToken');
            const trimmedName = editForm.name.trim();
            const trimmedPhone = editForm.phone.trim();
            const trimmedEmail = editForm.email.trim();
            const trimmedLocation = editForm.location.trim();
            const trimmedBio = editForm.bio.trim();
            const initials = trimmedName.split(' ').map(n => n[0]).join('').toUpperCase() || 'CC';

            if (token) {
                const res = await fetch(`${API_BASE_URL}/care-companion/profile`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: trimmedName,
                        phone: trimmedPhone || undefined,
                        email: trimmedEmail || undefined,
                        location: trimmedLocation,
                        bio: trimmedBio,
                    })
                });

                const resData = await res.json();
                if (!res.ok) {
                    throw new Error(resData.message || 'Failed to update profile on server');
                }

                if (resData.data) {
                    setProfileData((prev: any) => ({
                        ...prev,
                        name: resData.data.name,
                        phone: resData.data.phone || prev.phone,
                        email: resData.data.email ?? prev.email,
                        location: resData.data.location || prev.location,
                        bio: resData.data.bio ?? prev.bio,
                        initials,
                    }));
                }
            } else {
                setProfileData((prev: any) => ({
                    ...prev,
                    name: trimmedName,
                    phone: trimmedPhone || prev.phone,
                    email: trimmedEmail || prev.email,
                    location: trimmedLocation || prev.location,
                    bio: trimmedBio || prev.bio,
                    initials,
                }));
            }

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setIsEditProfileModalVisible(false);
        } catch (err: any) {
            console.log('Error saving profile:', err.message);
            Alert.alert('Update Failed', err.message || 'Could not update profile. Please try again.');
        } finally {
            setSavingProfile(false);
        }
    };

    const logoutWithConfirm = useLogoutWithConfirm();
    const { width } = useWindowDimensions();

    if (!fontsLoaded || loading || !profileData) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={DEEP_ORANGE} />
                <Text style={{ fontFamily: 'Poppins_400Regular', color: '#6B7280', marginTop: 12 }}>Loading profile...</Text>
            </View>
        );
    }
    const contentWidth = Math.min(Math.max(width - 40, 0), 440);
    const responsiveContentStyle = {
        width: contentWidth,
        alignSelf: 'center' as const,
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <Stack.Screen options={{ headerShown: false }} />

            <ScrollView bounces={false} contentContainerStyle={styles.scrollContent}>
                <View style={styles.deepOrangeHeader}>
                    <View style={[styles.headerRow, responsiveContentStyle]}>
                        <CompanionBackButton style={styles.backButton} />
                        <View style={styles.headerTextBlock}>
                            <Text style={styles.headerTitle}>Profile</Text>
                            <Text style={styles.headerSub}>Manage your account</Text>
                        </View>
                    </View>
                </View>

                <View style={[styles.contentArea, responsiveContentStyle]}>
                    {/* Identity Card */}
                    <Animated.View entering={FadeInUp.delay(200).duration(600)} style={[styles.card, styles.identityCard]}>
                        <View style={styles.avatarWrapper}>
                            <ProfilePhotoUploader
                                config={{
                                    targetType: 'self',
                                    currentPhotoUrl: profileData.photo || null,
                                    size: 96,
                                    editable: true,
                                    initials: profileData.initials || 'CC',
                                    accentColor: '#EF4444',
                                    onSuccess: (url) => setProfileData((prev: any) => ({ ...prev, photo: url })),
                                }}
                            />
                        </View>

                        <Text style={styles.profileName}>{profileData.name}</Text>
                        <Text style={styles.profileRole}>{profileData.role}</Text>

                        {profileData.verified && (
                            <View style={styles.verifiedBadge}>
                                <Ionicons name="shield-checkmark-outline" size={16} color="#16A34A" />
                                <Text style={styles.verifiedText}>Verified</Text>
                            </View>
                        )}

                        <View style={styles.divider} />

                        <View style={styles.infoList}>
                            <View style={styles.infoRow}>
                                <Ionicons name="call-outline" size={16} color="#333333" />
                                <Text style={styles.infoText}>{profileData.phone || 'No phone provided'}</Text>
                            </View>
                            {profileData.email ? (
                                <View style={styles.infoRow}>
                                    <Ionicons name="mail-outline" size={16} color="#333333" />
                                    <Text style={styles.infoText}>{profileData.email}</Text>
                                </View>
                            ) : null}
                            <View style={styles.infoRow}>
                                <Ionicons name="location-outline" size={16} color="#333333" />
                                <Text style={styles.infoText}>{profileData.location || 'Location not provided'}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Ionicons name="calendar-outline" size={16} color="#333333" />
                                <Text style={styles.infoText}>Member since {profileData.memberSince}</Text>
                            </View>
                        </View>
                    </Animated.View>

                    {/* About Me Section (if bio is present) */}
                    {profileData?.bio ? (
                        <Animated.View entering={FadeInUp.delay(300).duration(600)} style={styles.card}>
                            <View style={styles.cardHeaderRow}>
                                <Ionicons name="information-circle-outline" size={20} color="#111827" />
                                <Text style={styles.cardSectionTitle}>About Me</Text>
                            </View>
                            <Text style={styles.bioText}>{profileData.bio}</Text>
                        </Animated.View>
                    ) : null}

                    {/* Notifications Section (Visit Reminders & Celebration Alerts only) */}
                    <Animated.View entering={FadeInUp.delay(400).duration(600)} style={styles.card}>
                        <View style={styles.cardHeaderRow}>
                            <Ionicons name="notifications-outline" size={20} color="#111827" />
                            <Text style={styles.cardSectionTitle}>Notifications</Text>
                        </View>

                        <View style={styles.switchRow}>
                            <Text style={styles.switchLabel}>Visit Reminders</Text>
                            <CustomToggle
                                value={toggles.reminders}
                                onValueChange={v => handleToggleChange('reminders', v)}
                            />
                        </View>
                        <View style={[styles.switchRow, styles.lastRow]}>
                            <Text style={styles.switchLabel}>Celebration Alerts</Text>
                            <CustomToggle
                                value={toggles.celebrations}
                                onValueChange={v => handleToggleChange('celebrations', v)}
                            />
                        </View>
                    </Animated.View>

                    {/* Settings Section (Edit Profile & Privacy Security) */}
                    <Animated.View entering={FadeInUp.delay(600).duration(600)} style={styles.card}>
                        <View style={styles.cardHeaderRow}>
                            <Ionicons name="settings-outline" size={20} color="#111827" />
                            <Text style={styles.cardSectionTitle}>Settings</Text>
                        </View>

                        <TouchableOpacity
                            style={styles.settingsButton}
                            activeOpacity={0.75}
                            onPress={handleOpenEditProfile}
                        >
                            <View style={styles.settingsRowLeft}>
                                <Ionicons name="person-outline" size={16} color="#0A0A0A" />
                                <Text style={styles.settingsText}>Edit Profile</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.settingsButton, styles.lastRow]}
                            activeOpacity={0.75}
                            onPress={() => push('/(care-companion)/privacy-security' as any)}
                        >
                            <View style={styles.settingsRowLeft}>
                                <Ionicons name="shield-outline" size={16} color="#0A0A0A" />
                                <Text style={styles.settingsText}>Privacy & Security</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                        </TouchableOpacity>
                    </Animated.View>

                    {/* Impact Card */}
                    <Animated.View entering={FadeInUp.delay(800).duration(600)} style={styles.card}>
                        <Text style={styles.impactTitle}>Your Impact</Text>
                        <View style={styles.impactGrid}>
                            <View style={styles.impactBox}>
                                <Text style={styles.impactNumber}>{profileData.impact.visits}</Text>
                                <Text style={styles.impactLabel}>Total Visits</Text>
                            </View>
                            <View style={styles.impactBox}>
                                <Text style={styles.impactNumber}>{profileData.impact.hours}</Text>
                                <Text style={styles.impactLabel}>Hours</Text>
                            </View>
                            <View style={styles.impactBox}>
                                <Text style={styles.impactNumber}>{profileData.impact.clients}</Text>
                                <Text style={styles.impactLabel}>Clients</Text>
                            </View>
                        </View>
                    </Animated.View>

                    <TouchableOpacity style={styles.logoutBtn} onPress={logoutWithConfirm} activeOpacity={0.75}>
                        <Ionicons name="log-out-outline" size={20} color="#DC2626" />
                        <Text style={styles.logoutText}>Logout</Text>
                    </TouchableOpacity>

                    <View style={styles.bottomSpacer} />
                </View>
            </ScrollView>

            {/* Edit Profile Modal */}
            <Modal
                visible={isEditProfileModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setIsEditProfileModalVisible(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.modalOverlay}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Edit Profile Information</Text>
                            <TouchableOpacity
                                onPress={() => setIsEditProfileModalVisible(false)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <Ionicons name="close" size={22} color="#6B7280" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            style={styles.modalScrollView}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                        >
                            <Text style={styles.inputLabel}>Full Name *</Text>
                            <TextInput
                                style={styles.formInput}
                                value={editForm.name}
                                onChangeText={(text) => setEditForm(prev => ({ ...prev, name: text }))}
                                placeholder="Enter your full name"
                                placeholderTextColor="#9CA3AF"
                            />

                            <Text style={styles.inputLabel}>Phone Number *</Text>
                            <TextInput
                                style={styles.formInput}
                                value={editForm.phone}
                                onChangeText={(text) => setEditForm(prev => ({ ...prev, phone: text }))}
                                placeholder="Enter 10-digit phone number"
                                placeholderTextColor="#9CA3AF"
                                keyboardType="phone-pad"
                            />

                            <Text style={styles.inputLabel}>Email Address</Text>
                            <TextInput
                                style={styles.formInput}
                                value={editForm.email}
                                onChangeText={(text) => setEditForm(prev => ({ ...prev, email: text }))}
                                placeholder="Enter your email address"
                                placeholderTextColor="#9CA3AF"
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />

                            <Text style={styles.inputLabel}>Location / Society / Area</Text>
                            <TextInput
                                style={styles.formInput}
                                value={editForm.location}
                                onChangeText={(text) => setEditForm(prev => ({ ...prev, location: text }))}
                                placeholder="e.g. City Heights Society, Sector 45"
                                placeholderTextColor="#9CA3AF"
                            />

                            <Text style={styles.inputLabel}>About Me</Text>
                            <TextInput
                                style={[styles.formInput, styles.textAreaInput]}
                                value={editForm.bio}
                                onChangeText={(text) => setEditForm(prev => ({ ...prev, bio: text }))}
                                placeholder="Share a short note about your caregiving experience or interests..."
                                placeholderTextColor="#9CA3AF"
                                multiline
                                numberOfLines={3}
                                textAlignVertical="top"
                            />
                        </ScrollView>

                        <View style={styles.modalActionRow}>
                            <TouchableOpacity
                                style={styles.cancelBtn}
                                onPress={() => setIsEditProfileModalVisible(false)}
                                disabled={savingProfile}
                            >
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.saveBtn}
                                onPress={handleSaveProfile}
                                disabled={savingProfile}
                            >
                                {savingProfile ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Text style={styles.saveBtnText}>Save Changes</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            <CompanionBottomNav />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: LIGHT_BEIGE },
    scrollContent: { flexGrow: 1 },

    toggleTrack: {
        width: 44,
        height: 24,
        borderRadius: 15,
        justifyContent: 'center',
        paddingHorizontal: 2,
    },
    toggleThumb: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 2.5,
        elevation: 2,
    },

    deepOrangeHeader: {
        backgroundColor: DEEP_ORANGE,
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 10 : 16,
        paddingBottom: 16,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 15,
        elevation: 4,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 48,
    },
    headerTextBlock: {
        flex: 1,
        minWidth: 0,
    },
    backButton: {
        marginRight: 12,
    },
    headerTitle: {
        fontFamily: 'Poppins_600SemiBold',
        color: '#FFFFFF',
        fontSize: 20,
        lineHeight: 28,
    },
    headerSub: {
        fontFamily: 'Poppins_400Regular',
        color: '#DBEAFE',
        fontSize: 14,
        lineHeight: 20,
        opacity: 0.9,
    },

    contentArea: {
        paddingHorizontal: 0,
        paddingTop: 16,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
    },
    identityCard: {
        alignItems: 'center',
    },
    avatarWrapper: {
        marginBottom: 16,
    },
    profileName: {
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 20,
        lineHeight: 28,
        color: '#111827',
        textAlign: 'center',
    },
    profileRole: {
        fontFamily: 'Poppins_400Regular',
        fontSize: 14,
        color: '#6B7280',
        marginTop: 2,
    },
    verifiedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#DCFCE7',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        marginTop: 8,
    },
    verifiedText: {
        fontFamily: 'Poppins_500Medium',
        fontSize: 12,
        color: '#16A34A',
        marginLeft: 4,
    },
    divider: {
        height: 1,
        backgroundColor: '#F3F4F6',
        width: '100%',
        marginVertical: 16,
    },
    infoList: {
        width: '100%',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    infoText: {
        fontFamily: 'Poppins_400Regular',
        fontSize: 13.5,
        color: '#374151',
        marginLeft: 12,
    },

    // Card Section
    cardHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    cardSectionTitle: {
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 16,
        color: '#111827',
        marginLeft: 8,
    },
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    lastRow: {
        borderBottomWidth: 0,
        paddingBottom: 0,
    },
    switchLabel: {
        fontFamily: 'Poppins_500Medium',
        fontSize: 14,
        color: '#374151',
    },

    // Settings Buttons
    settingsButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    settingsRowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    settingsText: {
        fontFamily: 'Poppins_500Medium',
        fontSize: 14,
        color: '#111827',
        marginLeft: 10,
    },

    // Impact Section
    impactTitle: {
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 16,
        color: '#111827',
        marginBottom: 16,
    },
    impactGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    impactBox: {
        width: '31%',
        backgroundColor: '#FFF7ED',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
    },
    impactNumber: {
        fontFamily: 'Poppins_700Bold',
        fontSize: 20,
        color: DEEP_ORANGE,
    },
    impactLabel: {
        fontFamily: 'Poppins_400Regular',
        fontSize: 12,
        color: '#4B5563',
        marginTop: 4,
    },

    // Logout
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FEF2F2',
        borderRadius: 12,
        paddingVertical: 14,
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#FEE2E2',
    },
    logoutText: {
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 15,
        color: '#DC2626',
        marginLeft: 8,
    },
    bottomSpacer: {
        height: 100,
    },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    modalContent: {
        width: '100%',
        maxWidth: 380,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 5,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 17,
        color: '#111827',
    },
    bioText: {
        fontFamily: 'Poppins_400Regular',
        fontSize: 14,
        lineHeight: 22,
        color: '#4B5563',
    },
    modalScrollView: {
        maxHeight: 380,
        marginBottom: 16,
    },
    inputLabel: {
        fontFamily: 'Poppins_500Medium',
        fontSize: 13,
        color: '#374151',
        marginBottom: 6,
    },
    formInput: {
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontFamily: 'Poppins_400Regular',
        fontSize: 14,
        color: '#111827',
        backgroundColor: '#F9FAFB',
        marginBottom: 14,
    },
    textAreaInput: {
        minHeight: 70,
        paddingTop: 10,
    },
    modalActionRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
    },
    cancelBtn: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
    },
    cancelBtnText: {
        fontFamily: 'Poppins_500Medium',
        fontSize: 14,
        color: '#4B5563',
    },
    saveBtn: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: DEEP_ORANGE,
        minWidth: 110,
        alignItems: 'center',
    },
    saveBtnText: {
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 14,
        color: '#FFFFFF',
    },
});
