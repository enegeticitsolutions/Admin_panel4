import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, ActivityIndicator, Alert, Image, ImageBackground, useWindowDimensions,
    Modal, FlatList, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Share, Linking, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_URL } from '@/constants/api';
import { sanitizeImageUri } from '@/utils/sanitizeImageUri';
import { useAuth } from '@/contexts/AuthContext';

const INDUSTRIES = [
    "General Management / Leadership",
    "Sales & Marketing",
    "Human Resources",
    "Operations & Supply Chain",
    "Strategy & Consulting",
    "Entrepreneurship / Business Ownership",
    "Banking",
    "Chartered Accountancy / Auditing",
    "Investment & Wealth Management",
    "Insurance",
    "Taxation",
    "Information Technology / Software",
    "Civil Engineering",
    "Mechanical Engineering",
    "Electrical Engineering",
    "Telecommunications",
    "Civil Services (IAS/IPS/IFS etc.)",
    "Defence Services (Army/Navy/Air Force)",
    "Public Sector Undertakings (PSU)",
    "Judiciary & Legal Services",
    "Police Services",
    "Medicine (Doctor/Physician)",
    "Nursing",
    "Pharmacy",
    "Public Health / Hospital Administration",
    "Dentistry",
    "Corporate Law",
    "Litigation",
    "Legal Consulting",
    "School Teaching",
    "College/University Professor (Academia)",
    "Educational Administration",
    "Research & Development",
    "Journalism / Media",
    "Publishing / Writing",
    "Fine Arts / Performing Arts",
    "Design / Architecture",
    "Agriculture / Agri-Science",
    "NGO / Social Work",
    "Government Policy / Public Administration",
    "Homemaker with Professional Background",
    "Other (please specify)"
];

export default function LegacyCircleScreen() {
    const { width } = useWindowDimensions();
    const queryClient = useQueryClient();
    const MAX_CONTENT_WIDTH = 440;
    const responsiveStyle = { width: '100%' as const, maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' as const };

    const { user: userData, isGuest, requireAuth } = useAuth();
    const [successModalVisible, setSuccessModalVisible] = useState(false);
    const [successMessage, setSuccessMessage] = useState({ title: '', message: '' });
    const [isShareModalVisible, setIsShareModalVisible] = useState(false);

    // Re-fetch the profile and members every time the screen is focused so that
    // admin approval is reflected immediately without an app restart.
    useFocusEffect(
        useCallback(() => {
            queryClient.invalidateQueries({ queryKey: ['legacyCircleProfile'] });
            queryClient.invalidateQueries({ queryKey: ['legacyCircleMembers'] });
        }, [queryClient])
    );

    const fetchProfile = async () => {
        const token = await AsyncStorage.getItem('userToken');
        if (!token) return { success: true, data: null, isEligible: false, age: 0 };

        const res = await fetch(`${API_URL}/beneficiary/legacy-circle`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch profile');
        const json = await res.json();
        return json;
    };

    const { data: profileResponse, isLoading, error, refetch, isRefetching } = useQuery({
        queryKey: ['legacyCircleProfile'],
        queryFn: fetchProfile,
        staleTime: 0, // Always treat as stale so focus invalidation triggers a re-fetch
    });

    const profile = profileResponse?.data;
    const isEligible = profileResponse?.isEligible ?? ((userData?.age ?? 0) >= 60);
    const userAge = profileResponse?.age ?? userData?.age ?? 0;

    // Fetch approved legacy circle members for the community directory
    const fetchMembers = async () => {
        const token = await AsyncStorage.getItem('userToken');
        if (!token) return [];
        const res = await fetch(`${API_URL}/beneficiary/legacy-circle/members`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch members');
        const json = await res.json();
        return json.data || [];
    };

    const {
        data: members = [],
        isLoading: isMembersLoading,
        refetch: refetchMembers,
        isRefetching: isMembersRefetching
    } = useQuery({
        queryKey: ['legacyCircleMembers'],
        queryFn: fetchMembers,
        staleTime: 30000,
    });

    const handleRefreshAll = async () => {
        await Promise.all([refetch(), refetchMembers()]);
    };


    const createProfileMutation = useMutation({
        mutationFn: async (formData: any) => {
            const token = await AsyncStorage.getItem('userToken');
            const res = await fetch(`${API_URL}/beneficiary/legacy-circle`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || 'Failed to submit profile');
            }
            return json.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['legacyCircleProfile'] });
            setSuccessMessage({ title: 'Success', message: 'Your Legacy Circle profile has been submitted for review.' });
            setSuccessModalVisible(true);
        },
        onError: (err: any) => {
            Alert.alert('Error', err.message);
        }
    });

    const toggleActiveMutation = useMutation({
        mutationFn: async () => {
            const token = await AsyncStorage.getItem('userToken');
            const res = await fetch(`${API_URL}/beneficiary/legacy-circle/active`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || 'Failed to toggle account status');
            }
            return json.data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['legacyCircleProfile'] });
            const actionText = data.isActive ? 'activated' : 'deactivated';
            setSuccessMessage({ title: 'Success', message: `Your Legacy Circle profile has been ${actionText}.` });
            setSuccessModalVisible(true);
        },
        onError: (err: any) => {
            Alert.alert('Error', err.message);
        }
    });

    const updateProfileMutation = useMutation({
        mutationFn: async (formData: any) => {
            const token = await AsyncStorage.getItem('userToken');
            const res = await fetch(`${API_URL}/beneficiary/legacy-circle`, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || 'Failed to update profile');
            }
            return json.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['legacyCircleProfile'] });
            setSuccessMessage({ title: 'Success', message: 'Your Legacy Circle profile has been updated.' });
            setSuccessModalVisible(true);
            setIsEditing(false);
        },
        onError: (err: any) => {
            Alert.alert('Error', err.message);
        }
    });

    // Tab state: 'members' = Explore Members Directory; 'profile' = My Legacy Profile
    const [selectedTab, setSelectedTab] = useState<'members' | 'profile'>('members');
    const [memberSearch, setMemberSearch] = useState('');
    const [selectedFilterIndustry, setSelectedFilterIndustry] = useState<string>('All');
    const [selectedMember, setSelectedMember] = useState<any | null>(null);
    const [memberDetailVisible, setMemberDetailVisible] = useState(false);

    const [title, setTitle] = useState('');
    const [yearsOfExperience, setYearsOfExperience] = useState('');
    const [headline, setHeadline] = useState('');
    const [industry, setIndustry] = useState('');
    const [otherIndustry, setOtherIndustry] = useState('');
    const [email, setEmail] = useState('');
    const [agreed, setAgreed] = useState(false);
    const [industryModalVisible, setIndustryModalVisible] = useState(false);
    const [industrySearch, setIndustrySearch] = useState('');
    const [isEditing, setIsEditing] = useState(false);

    const filteredIndustries = INDUSTRIES.filter((ind) =>
        ind.toLowerCase().includes(industrySearch.trim().toLowerCase())
    );

    // Dynamic list of industries present across all approved members
    const availableIndustries: string[] = [
        'All',
        ...(Array.from(new Set(members.map((m: any) => m.industry).filter(Boolean))) as string[])
    ];

    // Filter members by search text and industry chip
    const filteredMembers = members.filter((m: any) => {
        const search = memberSearch.trim().toLowerCase();
        const matchesSearch = !search ||
            (m.name && m.name.toLowerCase().includes(search)) ||
            (m.role && m.role.toLowerCase().includes(search)) ||
            (m.headline && m.headline.toLowerCase().includes(search)) ||
            (m.industry && m.industry.toLowerCase().includes(search)) ||
            (m.city && m.city.toLowerCase().includes(search)) ||
            (m.state && m.state.toLowerCase().includes(search));

        const matchesIndustry = selectedFilterIndustry === 'All' || m.industry === selectedFilterIndustry;
        return matchesSearch && matchesIndustry;
    });

    const handleEditClick = () => {
        setIsEditing(true);
        setTitle(profile?.title || '');
        setYearsOfExperience(profile?.yearsOfExperience ? String(profile?.yearsOfExperience) : '');
        setHeadline(profile?.headline || '');
        setEmail(profile?.email || '');
        setAgreed(profile?.agreedToTerms ?? true);

        const ind = profile?.industry || '';
        if (INDUSTRIES.includes(ind)) {
            setIndustry(ind);
            setOtherIndustry('');
        } else if (ind) {
            setIndustry('Other (please specify)');
            setOtherIndustry(ind);
        } else {
            setIndustry('');
            setOtherIndustry('');
        }
    };

    const handleToggleActiveClick = () => {
        Alert.alert(
            profile.isActive ? "Deactivate Account?" : "Activate Account?",
            profile.isActive ? "Are you sure you want to deactivate your Legacy Circle profile? It will no longer be visible on the website." : "Are you sure you want to activate your Legacy Circle profile? It will be visible on the website.",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Yes", onPress: () => toggleActiveMutation.mutate() }
            ]
        );
    };

    const handleShareProfile = () => {
        if (!profile || !profile.id) return;
        setIsShareModalVisible(true);
    };

    const handleCopyLink = async () => {
        if (!profile) return;
        const url = `https://maihoonna.com/legacy/${profile.id}`;
        await Clipboard.setStringAsync(url);
        Alert.alert('Copied', 'Profile link copied to clipboard!');
    };

    const handleQuickShare = async (platform: 'whatsapp' | 'email' | 'sms' | 'more') => {
        if (!profile) return;
        const url = `https://maihoonna.com/legacy/${profile.id}`;
        const baseMessage = `Discover my professional journey and expertise on MaiHoonNa's Legacy Circle! Connect with me here:`;
        const fullMessage = `${baseMessage} ${url}`;
        
        try {
            if (platform === 'whatsapp') {
                const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(fullMessage)}`;
                const canOpen = await Linking.canOpenURL(whatsappUrl);
                if (canOpen) await Linking.openURL(whatsappUrl);
                else Alert.alert('Error', 'WhatsApp is not installed on this device.');
            } else if (platform === 'email') {
                const emailUrl = `mailto:?subject=${encodeURIComponent('My MaiHoonNa Legacy Circle Profile')}&body=${encodeURIComponent(fullMessage)}`;
                await Linking.openURL(emailUrl);
            } else if (platform === 'sms') {
                const smsUrl = Platform.OS === 'ios' ? `sms:&body=${encodeURIComponent(fullMessage)}` : `sms:?body=${encodeURIComponent(fullMessage)}`;
                await Linking.openURL(smsUrl);
            } else if (platform === 'more') {
                await Share.share({
                    message: Platform.OS === 'ios' ? baseMessage : fullMessage,
                    url: url, // For iOS
                    title: 'My MaiHoonNa Profile' // For Android
                });
            }
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }
    };

    const handleSubmit = () => {
        if (!title || !yearsOfExperience || !headline || !industry || !email || !agreed) {
            Alert.alert('Required Fields', 'Please fill in all fields and agree to the terms.');
            return;
        }

        const finalIndustry = industry === 'Other (please specify)' ? otherIndustry : industry;
        if (!finalIndustry) {
            Alert.alert('Required Fields', 'Please specify your industry.');
            return;
        }

        const formData = {
            title,
            yearsOfExperience: String(yearsOfExperience),
            headline,
            industry: finalIndustry,
            email,
            agreedToTerms: agreed
        };

        if (isEditing) {
            updateProfileMutation.mutate(formData);
        } else {
            createProfileMutation.mutate(formData);
        }
    };

    if (!isGuest && (isLoading || !userData)) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#FF6A00" />
                </View>
            </SafeAreaView>
        );
    }

    if (error) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Feather name="arrow-left" size={22} color="#111827" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Legacy Circle</Text>
                </View>
                <View style={styles.center}>
                    <Text style={styles.errorText}>Failed to load profile. Please try again.</Text>
                </View>
            </SafeAreaView>
        );
    }

    const renderMembersDirectory = () => {
        return (
            <ScrollView
                style={styles.scrollContainer}
                contentContainerStyle={[styles.directoryContent, responsiveStyle]}
                refreshControl={
                    <RefreshControl
                        refreshing={isMembersRefetching || isRefetching}
                        onRefresh={handleRefreshAll}
                        tintColor="#FF6A00"
                        colors={['#FF6A00']}
                    />
                }
            >
                {/* Community Header Banner */}
                <View style={styles.directoryHeroBanner}>
                    <View style={styles.directoryHeroBadge}>
                        <MaterialCommunityIcons name="star-circle" size={14} color="#D97706" />
                        <Text style={styles.directoryHeroBadgeText}>SENIOR ACHIEVERS COMMUNITY</Text>
                    </View>
                    <Text style={styles.directoryHeroTitle}>Honoring Senior Wisdom & Accomplishments</Text>
                    <Text style={styles.directoryHeroDesc}>
                        Discover the extraordinary careers, leadership, and lifetime journeys of our senior community members.
                    </Text>
                </View>

                {/* For Seniors (60+) who haven't created a profile yet: Invite card */}
                {isEligible && !profile && (
                    <TouchableOpacity
                        style={styles.seniorJoinBanner}
                        onPress={() => setSelectedTab('profile')}
                        activeOpacity={0.85}
                    >
                        <View style={styles.seniorJoinIconWrap}>
                            <Feather name="award" size={24} color="#FFFFFF" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.seniorJoinTitle}>Share Your Life Journey</Text>
                            <Text style={styles.seniorJoinDesc}>
                                Join the Legacy Circle and inspire our community with your professional story.
                            </Text>
                        </View>
                        <View style={styles.seniorJoinArrow}>
                            <Feather name="arrow-right" size={16} color="#FFFFFF" />
                        </View>
                    </TouchableOpacity>
                )}

                {/* For under 60 users: Informational banner */}
                {!isEligible && (
                    <View style={styles.juniorNoticeBanner}>
                        <Feather name="award" size={16} color="#B45309" style={{ marginTop: 2 }} />
                        <Text style={styles.juniorNoticeText}>
                            Legacy Circle profiles are curated exclusively for senior citizens aged 60+. You can browse verified member journeys and connect with them below.
                        </Text>
                    </View>
                )}

                {/* Search & Filter Bar */}
                <View style={styles.directorySearchWrap}>
                    <Feather name="search" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
                    <TextInput
                        style={styles.directorySearchInput}
                        placeholder="Search by name, role, or industry..."
                        placeholderTextColor="#9CA3AF"
                        value={memberSearch}
                        onChangeText={setMemberSearch}
                        autoCorrect={false}
                    />
                    {memberSearch.length > 0 && (
                        <TouchableOpacity onPress={() => setMemberSearch('')} style={{ padding: 4 }}>
                            <Feather name="x-circle" size={16} color="#9CA3AF" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Industry Filter Chips */}
                {availableIndustries.length > 1 && (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.filterChipsRow}
                    >
                        {availableIndustries.map((ind) => {
                            const isSelected = selectedFilterIndustry === ind;
                            return (
                                <TouchableOpacity
                                    key={ind}
                                    style={[styles.filterChip, isSelected && styles.filterChipActive]}
                                    onPress={() => setSelectedFilterIndustry(ind)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                                        {ind}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                )}

                {/* Members List or Loading / Empty states */}
                {isMembersLoading && !isMembersRefetching ? (
                    <View style={styles.directoryLoading}>
                        <ActivityIndicator size="small" color="#FF6A00" />
                        <Text style={styles.directoryLoadingText}>Loading senior members...</Text>
                    </View>
                ) : filteredMembers.length === 0 ? (
                    <View style={styles.directoryEmptyState}>
                        <View style={styles.directoryEmptyIconWrap}>
                            <Feather name="users" size={36} color="#9CA3AF" />
                        </View>
                        <Text style={styles.directoryEmptyTitle}>No Members Found</Text>
                        <Text style={styles.directoryEmptyDesc}>
                            {memberSearch || selectedFilterIndustry !== 'All'
                                ? 'No legacy members match your search criteria.'
                                : 'Our senior members are currently being curated. Check back soon!'}
                        </Text>
                        {(memberSearch.length > 0 || selectedFilterIndustry !== 'All') && (
                            <TouchableOpacity
                                style={styles.directoryResetBtn}
                                onPress={() => {
                                    setMemberSearch('');
                                    setSelectedFilterIndustry('All');
                                }}
                            >
                                <Text style={styles.directoryResetBtnText}>Reset Filters</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ) : (
                    <View style={styles.membersList}>
                        <Text style={styles.membersCountText}>
                            Showing {filteredMembers.length} verified {filteredMembers.length === 1 ? 'member' : 'members'}
                        </Text>
                        {filteredMembers.map((member: any) => (
                            <View key={member.id} style={styles.memberCard}>
                                <View style={styles.memberCardHeader}>
                                    {member.photo ? (
                                        <Image
                                            source={{ uri: sanitizeImageUri(member.photo) }}
                                            style={styles.memberAvatar}
                                        />
                                    ) : (
                                        <View style={[styles.memberAvatar, styles.memberAvatarPlaceholder]}>
                                            <Feather name="user" size={24} color="#9CA3AF" />
                                        </View>
                                    )}
                                    <View style={{ flex: 1, marginLeft: 14 }}>
                                        <View style={styles.memberNameRow}>
                                            <Text style={styles.memberName} numberOfLines={1}>
                                                {member.name}
                                            </Text>
                                            <View style={styles.verifiedBadge}>
                                                <MaterialCommunityIcons name="check-decagram" size={16} color="#10B981" />
                                            </View>
                                        </View>
                                        <Text style={styles.memberRole} numberOfLines={1}>
                                            {member.role}
                                        </Text>
                                        {(member.city || member.state) && (
                                            <View style={styles.memberLocationRow}>
                                                <Feather name="map-pin" size={12} color="#6B7280" />
                                                <Text style={styles.memberLocationText} numberOfLines={1}>
                                                    {[member.city, member.state].filter(Boolean).join(', ')}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                </View>

                                {/* Badges Row */}
                                <View style={styles.memberBadgesRow}>
                                    <View style={styles.memberIndustryPill}>
                                        <Text style={styles.memberIndustryPillText} numberOfLines={1}>
                                            {member.industry}
                                        </Text>
                                    </View>
                                    {member.yearsOfExperience ? (
                                        <View style={styles.memberExpPill}>
                                            <Feather name="briefcase" size={11} color="#6B7280" />
                                            <Text style={styles.memberExpPillText}>
                                                {member.yearsOfExperience} yrs exp
                                            </Text>
                                        </View>
                                    ) : null}
                                </View>

                                {/* Headline Quote */}
                                {member.headline ? (
                                    <View style={styles.memberQuoteBox}>
                                        <MaterialCommunityIcons name="format-quote-open" size={16} color="#FF6A00" style={{ marginBottom: -4 }} />
                                        <Text style={styles.memberQuoteText} numberOfLines={3}>
                                            {member.headline}
                                        </Text>
                                    </View>
                                ) : null}

                                {/* Action Buttons */}
                                <View style={styles.memberActionRow}>
                                    <TouchableOpacity
                                        style={styles.viewMemberBtn}
                                        onPress={() => {
                                            setSelectedMember(member);
                                            setMemberDetailVisible(true);
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.viewMemberBtnText}>View Story</Text>
                                        <Feather name="chevron-right" size={14} color="#FF6A00" />
                                    </TouchableOpacity>

                                    {member.email ? (
                                        <TouchableOpacity
                                            style={styles.connectMemberBtn}
                                            onPress={() => {
                                                if (requireAuth('Create a free account to connect with legacy circle members.')) return;
                                                const subject = encodeURIComponent(`Connecting via MaiHoonNa Legacy Circle`);
                                                const body = encodeURIComponent(`Dear ${member.name},\n\nI came across your inspiring profile in the MaiHoonNa Legacy Circle and would love to connect with you.\n\nWarm regards,\n${userData?.name || ''}`);
                                                Linking.openURL(`mailto:${member.email}?subject=${subject}&body=${body}`);
                                            }}
                                            activeOpacity={0.8}
                                        >
                                            <Feather name="mail" size={13} color="#FFFFFF" />
                                            <Text style={styles.connectMemberBtnText}>Connect</Text>
                                        </TouchableOpacity>
                                    ) : null}
                                </View>
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>
        );
    };

    const renderForm = () => (
        <ScrollView 
            style={styles.scrollContainer} 
            contentContainerStyle={[styles.content, responsiveStyle]}
            refreshControl={
                <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#FF6A00" colors={['#FF6A00']} />
            }
        >
            <View style={styles.orangeBanner}>
                <Feather name="clock" size={24} color="#FFFFFF" style={{ marginBottom: 12 }} />
                <Text style={styles.bannerTitle}>{isEditing ? 'Edit Your Profile' : 'Create Your Legacy Profile'}</Text>
                <Text style={styles.bannerDesc}>
                    {isEditing ? 'Update your information below.' : 'Your profile will be shared with the community and featured on the MaiHoonNa website.'}
                </Text>
            </View>

            <View style={styles.profilePicContainer}>
                {userData?.photo || userData?.profilePhoto ? (
                    <Image source={{ uri: sanitizeImageUri(userData?.photo || userData?.profilePhoto) }} style={styles.profilePic} />
                ) : (
                    <View style={[styles.profilePic, { backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' }]}>
                        <Feather name="user" size={40} color="#9CA3AF" />
                    </View>
                )}
            </View>

            <View style={styles.formGroup}>
                <Text style={styles.label}>Title <Text style={styles.asterisk}>*</Text></Text>
                <TextInput
                    style={styles.input}
                    placeholder="Your Job Role"
                    value={title}
                    onChangeText={setTitle}
                />
            </View>

            <View style={styles.formGroup}>
                <Text style={styles.label}>Years of Experience <Text style={styles.asterisk}>*</Text></Text>
                <TextInput
                    style={styles.input}
                    placeholder="e.g. 10"
                    keyboardType="numeric"
                    value={yearsOfExperience}
                    onChangeText={setYearsOfExperience}
                />
            </View>

            <View style={styles.formGroup}>
                <Text style={styles.label}>Headline <Text style={styles.asterisk}>*</Text></Text>
                <TextInput
                    style={styles.textArea}
                    placeholder="e.g. Retired educator with 30 years of experience inspiring young minds..."
                    multiline
                    maxLength={500}
                    value={headline}
                    onChangeText={setHeadline}
                />
                <Text style={styles.charCount}>{headline.length}/500</Text>
            </View>

            <View style={styles.formGroup}>
                <Text style={styles.label}>Industry <Text style={styles.asterisk}>*</Text></Text>
                <TouchableOpacity
                    style={styles.selectorBtn}
                    onPress={() => setIndustryModalVisible(true)}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.selectorText, !industry && styles.selectorPlaceholder]} numberOfLines={1}>
                        {industry || 'Select your industry'}
                    </Text>
                    <Feather name="chevron-down" size={20} color="#6B7280" />
                </TouchableOpacity>
            </View>

            {industry === 'Other (please specify)' && (
                <View style={styles.formGroup}>
                    <Text style={styles.label}>Specify Industry <Text style={styles.asterisk}>*</Text></Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Type your industry"
                        value={otherIndustry}
                        onChangeText={setOtherIndustry}
                    />
                </View>
            )}

            <View style={styles.formGroup}>
                <Text style={styles.label}>Email ID <Text style={styles.asterisk}>*</Text></Text>
                <TextInput
                    style={styles.input}
                    placeholder="yourname@email.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                />
                <Text style={styles.hintText}>This is used for connections request</Text>
            </View>

            <View style={styles.termsBox}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <TouchableOpacity 
                        onPress={() => setAgreed(!agreed)} 
                        style={{ padding: 4, marginLeft: -4, marginRight: 8, marginTop: -2 }}
                    >
                        <View style={[styles.checkbox, agreed && styles.checkboxChecked, { marginRight: 0 }]}>
                            {agreed && <Feather name="check" size={14} color="#FFFFFF" />}
                        </View>
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.termsDesc, { marginBottom: 0 }]}>
                            <Text onPress={() => setAgreed(!agreed)} style={{ fontFamily: 'Poppins-SemiBold', color: '#374151' }}>I agree to the </Text>
                            <Text 
                                style={[styles.linkText, { fontFamily: 'Poppins-SemiBold' }]} 
                                onPress={() => router.push('https://maihoonna.com/terms' as any)}
                            >
                                Terms & Conditions
                            </Text>
                            <Text onPress={() => setAgreed(!agreed)} style={{ fontFamily: 'Poppins-SemiBold', color: '#374151' }}>.{'\n'}</Text>
                            <Text onPress={() => setAgreed(!agreed)}>I understand and agree that my profile, including my headline, industry, email address and profile Photo, will be visible on the MaiHoonNa website after approval by the Operations Manager. I consent to my information being shared with the Legacy Circle community.</Text>
                        </Text>
                    </View>
                </View>
            </View>

            <View style={styles.infoBanner}>
                <Feather name="info" size={16} color="#059669" />
                <Text style={styles.infoBannerText}>
                    After submission, your profile will be reviewed by the Operations Manager for your zone. You will receive a WhatsApp notification when it goes live.
                </Text>
            </View>

            <TouchableOpacity
                style={[styles.submitBtn, (createProfileMutation.isPending || updateProfileMutation.isPending) && { opacity: 0.7 }]}
                onPress={handleSubmit}
                disabled={createProfileMutation.isPending || updateProfileMutation.isPending}
            >
                {createProfileMutation.isPending || updateProfileMutation.isPending ? (
                    <ActivityIndicator color="#FFFFFF" />
                ) : (
                    <Text style={styles.submitBtnText}>{isEditing ? 'Save Changes' : 'Submit for Approval'}</Text>
                )}
            </TouchableOpacity>
        </ScrollView>
    );

    const renderPending = () => {
        const submittedDate = new Date(profile.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

        return (
            <ScrollView 
                style={styles.scrollContainer} 
                contentContainerStyle={[styles.content, responsiveStyle]}
                refreshControl={
                    <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#FF6A00" colors={['#FF6A00']} />
                }
            >
                <View style={styles.pendingHeader}>
                    <View style={styles.clockIconWrap}>
                        <Feather name="clock" size={40} color="#FF6A00" />
                        <View style={styles.checkBadge}>
                            <Feather name="check" size={12} color="#FFFFFF" />
                        </View>
                    </View>
                    <Text style={styles.pendingTitle}>Under Review</Text>
                    <Text style={styles.pendingDesc}>Your Legacy Circle profile has been submitted successfully.</Text>
                    <Text style={styles.submittedDate}>Submitted on {submittedDate}</Text>
                </View>

                <View style={styles.card}>
                    <View style={styles.cardHeaderRow}>
                        <Text style={styles.cardTitle}>Profile Preview</Text>
                        <View style={styles.statusBadge}>
                            <Text style={styles.statusBadgeText}>Pending</Text>
                        </View>
                    </View>

                    <Text style={styles.previewLabel}>TITLE</Text>
                    <Text style={styles.previewValue}>{profile.title}</Text>

                    <Text style={styles.previewLabel}>EXPERIENCE</Text>
                    <Text style={styles.previewValue}>{profile.yearsOfExperience} years</Text>

                    <Text style={styles.previewLabel}>HEADLINE</Text>
                    <Text style={styles.previewValue}>{profile.headline}</Text>

                    <Text style={styles.previewLabel}>INDUSTRY</Text>
                    <Text style={styles.previewValue}>{profile.industry}</Text>

                    <Text style={styles.previewLabel}>EMAIL</Text>
                    <Text style={styles.previewValue}>{profile.email}</Text>
                </View>

                <View style={styles.blueBanner}>
                    <Feather name="info" size={16} color="#2563EB" />
                    <Text style={styles.blueBannerText}>
                        The Operations Manager for your zone will review your profile within 2-3 business days. You and your subscriber will receive a WhatsApp link once approved.
                    </Text>
                </View>
            </ScrollView>
        );
    };

    const renderApproved = () => {
        const approvedDate = new Date(profile.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

        return (
            <ScrollView 
                style={styles.scrollContainer}
                refreshControl={
                    <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#FF6A00" colors={['#FF6A00']} />
                }
            >
                <View style={styles.heroBannerContainer}>
                    <ImageBackground
                        source={require('../../assets/images/legacy-circle-bg.jpg')}
                        style={styles.heroBannerImage}
                        imageStyle={{ opacity: 0.60 }}
                        resizeMode="cover"
                    >
                        {/* Orange tint overlay matching Figma */}
                        <View style={styles.heroBannerOverlay} />
                    </ImageBackground>
                    {userData?.photo || userData?.profilePhoto ? (
                        <Image source={{ uri: sanitizeImageUri(userData?.photo || userData?.profilePhoto) }} style={styles.heroAvatar} />
                    ) : (
                        <View style={[styles.heroAvatar, { backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' }]}>
                            <Feather name="user" size={40} color="#9CA3AF" />
                        </View>
                    )}
                </View>

                <View style={[styles.approvedContent, responsiveStyle]}>
                    <View style={styles.liveBadgeRow}>
                        <View style={styles.liveBadge}>
                            <View style={styles.liveDot} />
                            <Text style={styles.liveBadgeText}>Live on Website</Text>
                        </View>
                    </View>

                    <View style={styles.approvedCard}>
                        <Text style={styles.approvedName}>{userData?.name}</Text>
                        <Text style={styles.approvedTitle}>{profile.title}</Text>
                        <Text style={styles.approvedHeadline}>{profile.headline}</Text>

                        <View style={styles.industryRow}>
                            <View style={styles.industryBadge}>
                                <Text style={styles.industryBadgeText}>{profile.industry}</Text>
                            </View>
                            <Text style={styles.approvedDate}>Approved {approvedDate}</Text>
                        </View>

                        <View style={styles.statsGrid}>
                            <View style={styles.statBox}>
                                <Text style={styles.statNumber}>{profile.connectRequests}</Text>
                                <Text style={styles.statLabelText}>Connect Requests</Text>
                            </View>
                            <View style={styles.statBox}>
                                <Text style={[styles.statNumber, { color: '#2563EB' }]}>{profile.profileStrength}%</Text>
                                <Text style={styles.statLabelText}>Profile Strength</Text>
                            </View>
                        </View>

                        <View style={styles.detailBox}>
                            <Text style={styles.detailTitle}>Experience</Text>
                            <Text style={styles.detailValue}>{profile.yearsOfExperience} years</Text>
                        </View>

                        <View style={styles.detailBox}>
                            <Text style={styles.detailTitle}>Industry</Text>
                            <Text style={styles.detailValue}>{profile.industry}</Text>
                        </View>

                        <View style={styles.shareBox}>
                            <View style={[styles.shareIconWrap, { backgroundColor: '#10B981' }]}>
                                <Feather name="share-2" size={24} color="#FFFFFF" />
                            </View>
                            <View style={styles.shareTextWrap}>
                                <Text style={styles.shareTitle}>Share your profile</Text>
                                <Text style={styles.shareDesc}>Send your link to your network</Text>
                            </View>
                            <TouchableOpacity style={styles.resendBtn} onPress={handleShareProfile}>
                                <Text style={styles.resendBtnText}>Share</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <TouchableOpacity style={styles.bottomEditBtn} onPress={handleEditClick}>
                        <Text style={styles.bottomEditBtnText}>Edit Profile</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[styles.bottomEditBtn, profile.isActive ? styles.deactivateBtn : styles.activateBtn]} 
                        onPress={handleToggleActiveClick}
                    >
                        <Text style={[styles.bottomEditBtnText, profile.isActive ? styles.deactivateBtnText : styles.activateBtnText]}>
                            {profile.isActive ? 'Deactivate Account' : 'Activate Account'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={[styles.header, responsiveStyle]}>
                <TouchableOpacity onPress={() => isEditing ? setIsEditing(false) : router.back()} style={styles.backBtn}>
                    <Feather name="arrow-left" size={22} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>
                    {isEditing 
                        ? 'Edit Profile' 
                        : (isEligible && selectedTab === 'profile') 
                            ? 'My Profile' 
                            : 'Legacy Circle'
                    }
                </Text>
                {isEligible && selectedTab === 'profile' && profile?.status === 'approved' && !isEditing && (
                    <TouchableOpacity onPress={handleEditClick} style={styles.headerEditBtn}>
                        <Feather name="edit-2" size={14} color="#FF6A00" style={{ marginRight: 4 }} />
                        <Text style={styles.headerEditBtnText}>Edit</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Segmented Navigation Tab Bar for 60+ users */}
            {isEligible && !isEditing && (
                <View style={[styles.tabBarWrapper, responsiveStyle]}>
                    <View style={styles.tabContainer}>
                        <TouchableOpacity
                            style={[styles.tabButton, selectedTab === 'members' && styles.tabButtonActive]}
                            onPress={() => setSelectedTab('members')}
                            activeOpacity={0.7}
                        >
                            <Feather
                                name="users"
                                size={15}
                                color={selectedTab === 'members' ? '#FF6A00' : '#6B7280'}
                            />
                            <Text style={[styles.tabButtonText, selectedTab === 'members' && styles.tabButtonTextActive]}>
                                Explore Members
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.tabButton, selectedTab === 'profile' && styles.tabButtonActive]}
                            onPress={() => setSelectedTab('profile')}
                            activeOpacity={0.7}
                        >
                            <Feather
                                name="user"
                                size={15}
                                color={selectedTab === 'profile' ? '#FF6A00' : '#6B7280'}
                            />
                            <Text style={[styles.tabButtonText, selectedTab === 'profile' && styles.tabButtonTextActive]}>
                                My Profile
                            </Text>
                            {profile?.status === 'approved' && (
                                <View style={styles.tabLiveDot} />
                            )}
                            {profile?.status === 'pending' && (
                                <View style={styles.tabPendingDot} />
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* Dual Content Switcher: Members Directory vs Senior Profile */}
            {(!isEligible || selectedTab === 'members')
                ? renderMembersDirectory()
                : (!profile || isEditing)
                    ? renderForm()
                    : profile.status === 'pending'
                        ? renderPending()
                        : renderApproved()
            }

            {/* Modern Industry Selection Bottom Sheet Modal */}
            <Modal
                visible={industryModalVisible}
                animationType="slide"
                transparent={true}
                statusBarTranslucent={true}
                onRequestClose={() => {
                    setIndustryModalVisible(false);
                    setIndustrySearch('');
                }}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.modalOverlay}
                >
                    <TouchableWithoutFeedback
                        onPress={() => {
                            setIndustryModalVisible(false);
                            setIndustrySearch('');
                        }}
                    >
                        <View style={styles.modalBackdrop} />
                    </TouchableWithoutFeedback>

                    <View style={styles.modalSheet}>
                        <View style={styles.modalHandle} />

                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalTitle}>Select Industry</Text>
                                <Text style={styles.modalSubtitle}>Choose the field that best matches your career</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => {
                                    setIndustryModalVisible(false);
                                    setIndustrySearch('');
                                }}
                                style={styles.modalCloseBtn}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Feather name="x" size={18} color="#4B5563" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.searchContainer}>
                            <Feather name="search" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search industries..."
                                placeholderTextColor="#9CA3AF"
                                value={industrySearch}
                                onChangeText={setIndustrySearch}
                                autoCorrect={false}
                                autoCapitalize="none"
                            />
                            {industrySearch.length > 0 && (
                                <TouchableOpacity onPress={() => setIndustrySearch('')} style={{ padding: 4 }}>
                                    <Feather name="x-circle" size={16} color="#9CA3AF" />
                                </TouchableOpacity>
                            )}
                        </View>

                        <FlatList
                            data={filteredIndustries}
                            keyExtractor={(item) => item}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={true}
                            contentContainerStyle={styles.industryList}
                            renderItem={({ item }) => {
                                const isSelected = industry === item;
                                return (
                                    <TouchableOpacity
                                        style={[styles.industryItem, isSelected && styles.industryItemSelected]}
                                        onPress={() => {
                                            setIndustry(item);
                                            setIndustryModalVisible(false);
                                            setIndustrySearch('');
                                        }}
                                        activeOpacity={0.6}
                                    >
                                        <Text style={[styles.industryItemText, isSelected && styles.industryItemTextSelected]}>
                                            {item}
                                        </Text>
                                        {isSelected && (
                                            <Feather name="check" size={18} color="#FF6A00" />
                                        )}
                                    </TouchableOpacity>
                                );
                            }}
                            ListEmptyComponent={
                                <View style={styles.emptyList}>
                                    <Feather name="search" size={32} color="#D1D5DB" style={{ marginBottom: 8 }} />
                                    <Text style={styles.emptyListText}>No industry found matching "{industrySearch}"</Text>
                                    <TouchableOpacity
                                        style={styles.selectOtherBtn}
                                        onPress={() => {
                                            setIndustry('Other (please specify)');
                                            setIndustryModalVisible(false);
                                            setIndustrySearch('');
                                        }}
                                    >
                                        <Text style={styles.selectOtherBtnText}>Select "Other (please specify)"</Text>
                                    </TouchableOpacity>
                                </View>
                            }
                        />
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Custom Success Modal */}
            <Modal
                visible={successModalVisible}
                animationType="fade"
                transparent={true}
                statusBarTranslucent={true}
                onRequestClose={() => setSuccessModalVisible(false)}
            >
                <View style={styles.successModalOverlay}>
                    <View style={styles.successModalContent}>
                        <View style={styles.successIconBox}>
                            <Feather name="check" size={32} color="#FFFFFF" />
                        </View>
                        <Text style={styles.successModalTitle}>{successMessage.title}</Text>
                        <Text style={styles.successModalText}>{successMessage.message}</Text>
                        
                        <TouchableOpacity
                            style={styles.successModalBtn}
                            onPress={() => setSuccessModalVisible(false)}
                        >
                            <Text style={styles.successModalBtnText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Share Profile Modal */}
            <Modal
                visible={isShareModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsShareModalVisible(false)}
            >
                <TouchableOpacity 
                    style={styles.shareModalOverlay} 
                    activeOpacity={1} 
                    onPress={() => setIsShareModalVisible(false)}
                >
                    <TouchableWithoutFeedback>
                        <View style={styles.shareModalContent}>
                            <View style={styles.shareModalHeader}>
                                <Text style={styles.shareModalTitle}>Share Profile</Text>
                                <TouchableOpacity onPress={() => setIsShareModalVisible(false)}>
                                    <Feather name="x" size={24} color="#6B7280" />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.linkContainer}>
                                <Text style={styles.shareLinkText} numberOfLines={1} ellipsizeMode="tail">
                                    {profile ? `https://maihoonna.com/legacy/${profile.id}` : ''}
                                </Text>
                                <TouchableOpacity style={styles.copyBtn} onPress={handleCopyLink}>
                                    <Feather name="copy" size={16} color="#FFFFFF" />
                                    <Text style={styles.copyBtnText}>Copy</Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.shareViaText}>Share via</Text>
                            
                            <View style={styles.shareIconsRow}>
                                <TouchableOpacity style={styles.shareIconCol} onPress={() => handleQuickShare('whatsapp')}>
                                    <View style={[styles.shareModalIconWrap, { backgroundColor: '#25D366' }]}>
                                        <FontAwesome name="whatsapp" size={24} color="#FFF" />
                                    </View>
                                    <Text style={styles.shareIconLabel}>WhatsApp</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.shareIconCol} onPress={() => handleQuickShare('email')}>
                                    <View style={[styles.shareModalIconWrap, { backgroundColor: '#DB4437' }]}>
                                        <Feather name="mail" size={22} color="#FFF" />
                                    </View>
                                    <Text style={styles.shareIconLabel}>Email</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.shareIconCol} onPress={() => handleQuickShare('sms')}>
                                    <View style={[styles.shareModalIconWrap, { backgroundColor: '#34B7F1' }]}>
                                        <Feather name="message-square" size={22} color="#FFF" />
                                    </View>
                                    <Text style={styles.shareIconLabel}>SMS</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.shareIconCol} onPress={() => handleQuickShare('more')}>
                                    <View style={[styles.shareModalIconWrap, { backgroundColor: '#6B7280' }]}>
                                        <Feather name="more-horizontal" size={24} color="#FFF" />
                                    </View>
                                    <Text style={styles.shareIconLabel}>More</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </TouchableOpacity>
            </Modal>

            {/* Member Detail Bottom Sheet Modal */}
            <Modal
                visible={memberDetailVisible && !!selectedMember}
                animationType="slide"
                transparent={true}
                statusBarTranslucent={true}
                onRequestClose={() => {
                    setMemberDetailVisible(false);
                    setSelectedMember(null);
                }}
            >
                <View style={styles.modalOverlay}>
                    <TouchableWithoutFeedback
                        onPress={() => {
                            setMemberDetailVisible(false);
                            setSelectedMember(null);
                        }}
                    >
                        <View style={styles.modalBackdrop} />
                    </TouchableWithoutFeedback>

                    <View style={[styles.modalSheet, styles.memberDetailSheet]}>
                        <View style={styles.modalHandle} />

                        <View style={styles.memberDetailHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalTitle}>Senior Achiever</Text>
                                <Text style={styles.modalSubtitle}>Verified Legacy Circle Member</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => {
                                    setMemberDetailVisible(false);
                                    setSelectedMember(null);
                                }}
                                style={styles.modalCloseBtn}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Feather name="x" size={18} color="#4B5563" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            contentContainerStyle={styles.memberDetailScrollContent}
                            showsVerticalScrollIndicator={false}
                        >
                            {selectedMember && (
                                <>
                                    <View style={styles.memberDetailHero}>
                                        {selectedMember.photo ? (
                                            <Image
                                                source={{ uri: sanitizeImageUri(selectedMember.photo) }}
                                                style={styles.memberDetailAvatar}
                                            />
                                        ) : (
                                            <View style={[styles.memberDetailAvatar, styles.memberAvatarPlaceholder]}>
                                                <Feather name="user" size={40} color="#9CA3AF" />
                                            </View>
                                        )}
                                        <Text style={styles.memberDetailName}>{selectedMember.name}</Text>
                                        <Text style={styles.memberDetailRole}>{selectedMember.role}</Text>

                                        <View style={styles.memberDetailVerifiedPill}>
                                            <MaterialCommunityIcons name="check-decagram" size={15} color="#059669" />
                                            <Text style={styles.memberDetailVerifiedText}>Verified Senior Member (60+)</Text>
                                        </View>
                                    </View>

                                    <View style={styles.memberDetailInfoGrid}>
                                        <View style={styles.memberDetailInfoCard}>
                                            <Text style={styles.memberDetailInfoLabel}>INDUSTRY</Text>
                                            <Text style={styles.memberDetailInfoValue}>{selectedMember.industry}</Text>
                                        </View>
                                        <View style={styles.memberDetailInfoCard}>
                                            <Text style={styles.memberDetailInfoLabel}>EXPERIENCE</Text>
                                            <Text style={styles.memberDetailInfoValue}>{selectedMember.yearsOfExperience} years</Text>
                                        </View>
                                        {(selectedMember.city || selectedMember.state) && (
                                            <View style={styles.memberDetailInfoCard}>
                                                <Text style={styles.memberDetailInfoLabel}>LOCATION</Text>
                                                <Text style={styles.memberDetailInfoValue}>
                                                    {[selectedMember.city, selectedMember.state].filter(Boolean).join(', ')}
                                                </Text>
                                            </View>
                                        )}
                                    </View>

                                    {selectedMember.headline && (
                                        <View style={styles.memberDetailBioCard}>
                                            <Text style={styles.memberDetailBioHeading}>Career Journey & Wisdom</Text>
                                            <Text style={styles.memberDetailBioText}>{selectedMember.headline}</Text>
                                        </View>
                                    )}

                                    <View style={styles.memberDetailActions}>
                                        {selectedMember.email && (
                                            <TouchableOpacity
                                                style={styles.memberDetailConnectBtn}
                                                onPress={() => {
                                                    const subject = encodeURIComponent(`Connecting via MaiHoonNa Legacy Circle`);
                                                    const body = encodeURIComponent(`Dear ${selectedMember.name},\n\nI came across your inspiring profile in the MaiHoonNa Legacy Circle and would love to connect with you.\n\nWarm regards,\n${userData?.name || ''}`);
                                                    Linking.openURL(`mailto:${selectedMember.email}?subject=${subject}&body=${body}`);
                                                }}
                                                activeOpacity={0.85}
                                            >
                                                <Feather name="mail" size={16} color="#FFFFFF" />
                                                <Text style={styles.memberDetailConnectBtnText}>Connect via Email</Text>
                                            </TouchableOpacity>
                                        )}

                                        <TouchableOpacity
                                            style={styles.memberDetailShareBtn}
                                            onPress={async () => {
                                                const shareText = `Discover ${selectedMember.name}'s inspiring career journey on MaiHoonNa's Legacy Circle: ${selectedMember.role} (${selectedMember.yearsOfExperience} yrs in ${selectedMember.industry}). https://maihoonna.com/legacy/${selectedMember.id}`;
                                                await Share.share({
                                                    message: shareText,
                                                    title: `${selectedMember.name} - Legacy Circle`
                                                });
                                            }}
                                            activeOpacity={0.7}
                                        >
                                            <Feather name="share-2" size={15} color="#FF6A00" />
                                            <Text style={styles.memberDetailShareBtnText}>Share Story</Text>
                                        </TouchableOpacity>
                                    </View>
                                </>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { height: 60, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    backBtn: { position: 'absolute', left: 20, zIndex: 1, padding: 5 },
    headerTitle: { fontSize: 18, color: '#111827', fontFamily: 'Poppins-Medium' },
    editBtn: { position: 'absolute', right: 20, zIndex: 1, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#FF6A00' },
    editBtnText: { color: '#FF6A00', fontFamily: 'Poppins-Medium', fontSize: 14 },
    scrollContainer: { flex: 1, backgroundColor: '#FFF0E6' },
    content: { padding: 20 },
    errorText: { color: '#DC2626', fontFamily: 'Poppins-Medium', fontSize: 16 },

    // Form Styles
    orangeBanner: { backgroundColor: '#FF6A00', borderRadius: 16, padding: 24, marginBottom: 24 },
    bannerTitle: { color: '#FFFFFF', fontFamily: 'Poppins-Bold', fontSize: 18, marginBottom: 8 },
    bannerDesc: { color: 'rgba(255,255,255,0.9)', fontFamily: 'Poppins-Regular', fontSize: 14, lineHeight: 20 },
    profilePicContainer: { alignItems: 'center', marginBottom: 24 },
    profilePic: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#FF6A00' },
    formGroup: { marginBottom: 20 },
    label: { fontFamily: 'Poppins-SemiBold', fontSize: 14, color: '#374151', marginBottom: 8 },
    asterisk: { color: '#FF6A00' },
    textArea: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, paddingTop: 16, fontFamily: 'Poppins-Regular', fontSize: 15, color: '#111827', height: 120, textAlignVertical: 'top', borderWidth: 1, borderColor: '#E5E7EB' },
    charCount: { alignSelf: 'flex-end', fontFamily: 'Poppins-Regular', fontSize: 12, color: '#9CA3AF', marginTop: 4 },
    input: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 16, height: 52, fontFamily: 'Poppins-Regular', fontSize: 15, color: '#111827', borderWidth: 1, borderColor: '#E5E7EB' },
    hintText: { fontFamily: 'Poppins-Regular', fontSize: 12, color: '#6B7280', marginTop: 4 },
    selectorBtn: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 52,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    selectorText: {
        fontFamily: 'Poppins-Regular',
        fontSize: 15,
        color: '#111827',
        flex: 1,
        marginRight: 8,
    },
    selectorPlaceholder: {
        color: '#9CA3AF',
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
    },
    modalSheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '85%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 10,
    },
    modalHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#E5E7EB',
        alignSelf: 'center',
        marginTop: 10,
        marginBottom: 8,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    modalTitle: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 18,
        color: '#111827',
    },
    modalSubtitle: {
        fontFamily: 'Poppins-Regular',
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    modalCloseBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        marginHorizontal: 20,
        marginTop: 12,
        marginBottom: 8,
        paddingHorizontal: 12,
        height: 44,
    },
    searchInput: {
        flex: 1,
        fontFamily: 'Poppins-Regular',
        fontSize: 14,
        color: '#111827',
        height: '100%',
        padding: 0,
    },
    industryList: {
        paddingHorizontal: 12,
        paddingBottom: 24,
    },
    industryItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 10,
        marginVertical: 2,
    },
    industryItemSelected: {
        backgroundColor: '#FFF7ED',
    },
    industryItemText: {
        fontFamily: 'Poppins-Medium',
        fontSize: 14,
        color: '#374151',
        flex: 1,
    },
    industryItemTextSelected: {
        fontFamily: 'Poppins-SemiBold',
        color: '#FF6A00',
    },
    emptyList: {
        alignItems: 'center',
        paddingVertical: 32,
        paddingHorizontal: 20,
    },
    emptyListText: {
        fontFamily: 'Poppins-Regular',
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 12,
    },
    selectOtherBtn: {
        backgroundColor: '#FFF7ED',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#FFEDD5',
    },
    selectOtherBtnText: {
        fontFamily: 'Poppins-Medium',
        fontSize: 13,
        color: '#EA580C',
    },
    termsBox: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#E5E7EB' },
    checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    checkboxChecked: { backgroundColor: '#FF6A00', borderColor: '#FF6A00' },
    termsTitle: { fontFamily: 'Poppins-SemiBold', fontSize: 14, color: '#374151' },
    termsDesc: { fontFamily: 'Poppins-Regular', fontSize: 13, color: '#6B7280', lineHeight: 20, marginBottom: 8 },
    linkText: { fontFamily: 'Poppins-Medium', fontSize: 13, color: '#FF6A00' },
    infoBanner: { backgroundColor: '#ECFDF5', borderRadius: 12, padding: 16, flexDirection: 'row', marginBottom: 24 },
    infoBannerText: { flex: 1, fontFamily: 'Poppins-Regular', fontSize: 13, color: '#059669', lineHeight: 20, marginLeft: 12 },
    submitBtn: { backgroundColor: '#FF6A00', borderRadius: 16, height: 56, justifyContent: 'center', alignItems: 'center', marginBottom: 40 },
    submitBtnText: { color: '#FFFFFF', fontFamily: 'Poppins-SemiBold', fontSize: 16 },

    // Pending Styles
    pendingHeader: { alignItems: 'center', marginVertical: 32 },
    clockIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#FFF7ED', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
    checkBadge: { position: 'absolute', top: 0, right: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: '#FDE047', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF7ED' },
    pendingTitle: { fontFamily: 'Poppins-Bold', fontSize: 22, color: '#111827', marginBottom: 8 },
    pendingDesc: { fontFamily: 'Poppins-Regular', fontSize: 15, color: '#6B7280', textAlign: 'center', marginBottom: 12, paddingHorizontal: 20 },
    submittedDate: { fontFamily: 'Poppins-Medium', fontSize: 14, color: '#9CA3AF' },
    card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    cardTitle: { fontFamily: 'Poppins-SemiBold', fontSize: 16, color: '#111827' },
    statusBadge: { backgroundColor: '#FEF08A', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
    statusBadgeText: { fontFamily: 'Poppins-Medium', fontSize: 12, color: '#854D0E' },
    previewLabel: { fontFamily: 'Poppins-Medium', fontSize: 12, color: '#9CA3AF', marginBottom: 4 },
    previewValue: { fontFamily: 'Poppins-Regular', fontSize: 15, color: '#374151', marginBottom: 16 },
    blueBanner: { backgroundColor: '#EFF6FF', borderRadius: 12, padding: 16, flexDirection: 'row', marginBottom: 40 },
    blueBannerText: { flex: 1, fontFamily: 'Poppins-Regular', fontSize: 13, color: '#2563EB', lineHeight: 20, marginLeft: 12 },

    // Approved Styles
    heroBannerContainer: { height: 160, position: 'relative', zIndex: 10 },
    heroBannerImage: { width: '100%', height: 160, backgroundColor: '#EA580C', overflow: 'hidden' },
    heroBannerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(234, 88, 12, 0.50)' },
    heroAvatar: { position: 'absolute', bottom: -42, left: 20, width: 84, height: 84, borderRadius: 42, borderWidth: 4, borderColor: '#FFFFFF', zIndex: 20 },
    approvedContent: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 40 },
    liveBadgeRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 16 },
    liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#D1FAE5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#059669', marginRight: 6 },
    liveBadgeText: { fontFamily: 'Poppins-Medium', fontSize: 12, color: '#059669' },
    approvedCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    approvedName: { fontFamily: 'Poppins-Bold', fontSize: 20, color: '#111827', marginBottom: 2 },
    approvedTitle: { fontFamily: 'Poppins-Medium', fontSize: 16, color: '#FF6A00', marginBottom: 8 },
    approvedHeadline: { fontFamily: 'Poppins-Regular', fontSize: 15, color: '#374151', marginBottom: 16 },
    industryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
    industryBadge: { backgroundColor: '#FFF7ED', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginRight: 12 },
    industryBadgeText: { fontFamily: 'Poppins-Medium', fontSize: 12, color: '#EA580C' },
    approvedDate: { fontFamily: 'Poppins-Regular', fontSize: 13, color: '#9CA3AF' },
    statsGrid: { flexDirection: 'row', gap: 12, marginBottom: 24 },
    statBox: { flex: 1, borderWidth: 1, borderColor: '#F3F4F6', borderRadius: 12, padding: 16, alignItems: 'center' },
    statNumber: { fontFamily: 'Poppins-Bold', fontSize: 24, color: '#EA580C', marginBottom: 4 },
    statLabelText: { fontFamily: 'Poppins-Medium', fontSize: 12, color: '#6B7280' },
    detailBox: { borderWidth: 1, borderColor: '#F3F4F6', borderRadius: 12, padding: 16, marginBottom: 24 },
    detailTitle: { fontFamily: 'Poppins-SemiBold', fontSize: 15, color: '#111827', marginBottom: 4 },
    detailValue: { fontFamily: 'Poppins-Regular', fontSize: 14, color: '#4B5563' },
    shareBox: { backgroundColor: '#ECFDF5', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center' },
    shareIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    shareTextWrap: { flex: 1 },
    shareTitle: { fontFamily: 'Poppins-SemiBold', fontSize: 14, color: '#111827' },
    shareDesc: { fontFamily: 'Poppins-Regular', fontSize: 12, color: '#6B7280' },
    resendBtn: { backgroundColor: '#10B981', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16 },
    resendBtnText: { fontFamily: 'Poppins-Medium', fontSize: 13, color: '#FFFFFF' },
    bottomEditBtn: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#FF6A00', height: 56, justifyContent: 'center', alignItems: 'center', marginTop: 24 },
    bottomEditBtnText: { color: '#FF6A00', fontFamily: 'Poppins-SemiBold', fontSize: 16 },
    deactivateBtn: { borderColor: '#EF4444', marginTop: 16 },
    deactivateBtnText: { color: '#EF4444' },
    activateBtn: { borderColor: '#10B981', marginTop: 16 },
    activateBtnText: { color: '#10B981' },
    
    // Success Modal Styles
    successModalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    successModalContent: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, width: '100%', maxWidth: 340, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 10 },
    successIconBox: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
    successModalTitle: { fontFamily: 'Poppins-Bold', fontSize: 20, color: '#111827', marginBottom: 8, textAlign: 'center' },
    successModalText: { fontFamily: 'Poppins-Regular', fontSize: 15, color: '#6B7280', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
    successModalBtn: { backgroundColor: '#FF6A00', borderRadius: 16, height: 52, width: '100%', justifyContent: 'center', alignItems: 'center' },
    successModalBtnText: { color: '#FFFFFF', fontFamily: 'Poppins-SemiBold', fontSize: 15 },

    // Share Modal Styles
    shareModalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
    shareModalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
    shareModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    shareModalTitle: { fontFamily: 'Poppins-Bold', fontSize: 18, color: '#111827' },
    linkContainer: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 12, padding: 12, alignItems: 'center', marginBottom: 24 },
    shareLinkText: { flex: 1, fontFamily: 'Poppins-Regular', fontSize: 13, color: '#4B5563', marginRight: 12 },
    copyBtn: { backgroundColor: '#FF6A00', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 6 },
    copyBtnText: { color: '#FFFFFF', fontFamily: 'Poppins-Medium', fontSize: 13 },
    shareViaText: { fontFamily: 'Poppins-Medium', fontSize: 15, color: '#374151', marginBottom: 16 },
    shareIconsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10 },
    shareIconCol: { alignItems: 'center', width: 70 },
    shareModalIconWrap: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    shareIconLabel: { fontFamily: 'Poppins-Medium', fontSize: 12, color: '#4B5563', textAlign: 'center' },

    // Ineligible Screen Styles
    ineligibleCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        marginVertical: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 16,
        elevation: 3,
    },
    ineligibleIconOuter: {
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: '#FEF3C7',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    ineligibleIconInner: {
        width: 68,
        height: 68,
        borderRadius: 34,
        backgroundColor: '#FDE68A',
        justifyContent: 'center',
        alignItems: 'center',
    },
    ineligiblePill: {
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 12,
        marginBottom: 12,
    },
    ineligiblePillText: {
        fontSize: 11,
        fontFamily: 'Poppins-Bold',
        color: '#B45309',
        letterSpacing: 0.5,
    },
    ineligibleTitle: {
        fontSize: 20,
        fontFamily: 'Poppins-Bold',
        color: '#111827',
        textAlign: 'center',
        marginBottom: 8,
    },
    ineligibleDesc: {
        fontSize: 13,
        fontFamily: 'Poppins-Regular',
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 20,
    },
    ageStatusBox: {
        width: '100%',
        backgroundColor: '#F9FAFB',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    ageStatusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 6,
    },
    ageStatusLabel: {
        fontSize: 13,
        fontFamily: 'Poppins-Medium',
        color: '#6B7280',
    },
    ageStatusValue: {
        fontSize: 14,
        fontFamily: 'Poppins-SemiBold',
        color: '#111827',
    },
    ageBadgeCurrent: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    ageBadgeCurrentText: {
        fontSize: 13,
        fontFamily: 'Poppins-SemiBold',
        color: '#1F2937',
    },
    ageStatusDivider: {
        height: 1,
        backgroundColor: '#E5E7EB',
        marginVertical: 4,
    },
    ageStatusNotEligiblePill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEE2E2',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        gap: 4,
    },
    ageStatusNotEligibleText: {
        fontSize: 12,
        fontFamily: 'Poppins-SemiBold',
        color: '#DC2626',
    },
    infoBannerOrange: {
        flexDirection: 'row',
        backgroundColor: '#FFF7ED',
        borderRadius: 14,
        padding: 14,
        gap: 10,
        width: '100%',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#FFEDD5',
    },
    infoBannerOrangeText: {
        flex: 1,
        fontSize: 12,
        fontFamily: 'Poppins-Regular',
        color: '#C2410C',
        lineHeight: 18,
    },
    backToMoreBtn: {
        width: '100%',
        backgroundColor: '#FF6A00',
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: 'center',
        marginBottom: 10,
    },
    backToMoreBtnText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontFamily: 'Poppins-SemiBold',
    },
    viewProfileBtn: {
        paddingVertical: 8,
        alignItems: 'center',
    },
    viewProfileBtnText: {
        color: '#6B7280',
        fontSize: 13,
        fontFamily: 'Poppins-Medium',
        textDecorationLine: 'underline',
    },

    // Header Edit Button
    headerEditBtn: {
        position: 'absolute',
        right: 20,
        zIndex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#FF6A00',
        backgroundColor: '#FFF7ED',
    },
    headerEditBtnText: {
        color: '#FF6A00',
        fontFamily: 'Poppins-SemiBold',
        fontSize: 13,
    },

    // Segmented Navigation Tabs
    tabBarWrapper: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: '#F3F4F6',
        borderRadius: 14,
        padding: 4,
        gap: 4,
    },
    tabButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 9,
        borderRadius: 10,
        gap: 6,
    },
    tabButtonActive: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2,
    },
    tabButtonText: {
        fontFamily: 'Poppins-Medium',
        fontSize: 13,
        color: '#6B7280',
    },
    tabButtonTextActive: {
        fontFamily: 'Poppins-SemiBold',
        color: '#FF6A00',
    },
    tabLiveDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: '#10B981',
        marginLeft: 2,
    },
    tabPendingDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: '#F59E0B',
        marginLeft: 2,
    },

    // Directory Styles
    directoryContent: {
        padding: 20,
        paddingBottom: 40,
    },
    directoryHeroBanner: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#F3F4F6',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 1,
    },
    directoryHeroBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF3C7',
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
        gap: 6,
        marginBottom: 10,
    },
    directoryHeroBadgeText: {
        fontSize: 10,
        fontFamily: 'Poppins-Bold',
        color: '#B45309',
        letterSpacing: 0.5,
    },
    directoryHeroTitle: {
        fontSize: 17,
        fontFamily: 'Poppins-Bold',
        color: '#111827',
        marginBottom: 6,
    },
    directoryHeroDesc: {
        fontSize: 13,
        fontFamily: 'Poppins-Regular',
        color: '#6B7280',
        lineHeight: 19,
    },
    seniorJoinBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF7ED',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1.5,
        borderColor: '#FFEDD5',
        gap: 12,
    },
    seniorJoinIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FF6A00',
        justifyContent: 'center',
        alignItems: 'center',
    },
    seniorJoinTitle: {
        fontSize: 14,
        fontFamily: 'Poppins-SemiBold',
        color: '#C2410C',
        marginBottom: 2,
    },
    seniorJoinDesc: {
        fontSize: 12,
        fontFamily: 'Poppins-Regular',
        color: '#7C2D12',
        lineHeight: 17,
    },
    seniorJoinArrow: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#FF6A00',
        justifyContent: 'center',
        alignItems: 'center',
    },
    juniorNoticeBanner: {
        flexDirection: 'row',
        backgroundColor: '#FEF3C7',
        borderRadius: 14,
        padding: 14,
        gap: 10,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#FDE68A',
    },
    juniorNoticeText: {
        flex: 1,
        fontSize: 12,
        fontFamily: 'Poppins-Regular',
        color: '#92400E',
        lineHeight: 18,
    },
    directorySearchWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        paddingHorizontal: 14,
        height: 48,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    directorySearchInput: {
        flex: 1,
        fontFamily: 'Poppins-Regular',
        fontSize: 14,
        color: '#111827',
        height: '100%',
        padding: 0,
    },
    filterChipsRow: {
        paddingBottom: 14,
        gap: 8,
    },
    filterChip: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    filterChipActive: {
        backgroundColor: '#FF6A00',
        borderColor: '#FF6A00',
    },
    filterChipText: {
        fontSize: 12,
        fontFamily: 'Poppins-Medium',
        color: '#4B5563',
    },
    filterChipTextActive: {
        fontFamily: 'Poppins-SemiBold',
        color: '#FFFFFF',
    },
    directoryLoading: {
        alignItems: 'center',
        paddingVertical: 40,
        gap: 8,
    },
    directoryLoadingText: {
        fontSize: 13,
        fontFamily: 'Poppins-Regular',
        color: '#9CA3AF',
    },
    directoryEmptyState: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 32,
        alignItems: 'center',
        marginVertical: 12,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    directoryEmptyIconWrap: {
        width: 68,
        height: 68,
        borderRadius: 34,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 14,
    },
    directoryEmptyTitle: {
        fontSize: 16,
        fontFamily: 'Poppins-Bold',
        color: '#111827',
        marginBottom: 6,
    },
    directoryEmptyDesc: {
        fontSize: 13,
        fontFamily: 'Poppins-Regular',
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 19,
        marginBottom: 16,
    },
    directoryResetBtn: {
        backgroundColor: '#FFF7ED',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#FFEDD5',
    },
    directoryResetBtnText: {
        fontSize: 13,
        fontFamily: 'Poppins-Medium',
        color: '#EA580C',
    },
    membersList: {
        gap: 16,
    },
    membersCountText: {
        fontSize: 12,
        fontFamily: 'Poppins-Medium',
        color: '#6B7280',
        marginBottom: 2,
    },
    memberCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 18,
        borderWidth: 1,
        borderColor: '#F3F4F6',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    memberCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    memberAvatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        borderWidth: 2,
        borderColor: '#FF6A00',
    },
    memberAvatarPlaceholder: {
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    memberNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 2,
    },
    memberName: {
        fontSize: 16,
        fontFamily: 'Poppins-Bold',
        color: '#111827',
        flexShrink: 1,
    },
    verifiedBadge: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    memberRole: {
        fontSize: 13,
        fontFamily: 'Poppins-Medium',
        color: '#EA580C',
        marginBottom: 4,
    },
    memberLocationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    memberLocationText: {
        fontSize: 11,
        fontFamily: 'Poppins-Regular',
        color: '#6B7280',
    },
    memberBadgesRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
    },
    memberIndustryPill: {
        backgroundColor: '#FFF7ED',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#FFEDD5',
    },
    memberIndustryPillText: {
        fontSize: 11,
        fontFamily: 'Poppins-Medium',
        color: '#C2410C',
    },
    memberExpPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        gap: 5,
    },
    memberExpPillText: {
        fontSize: 11,
        fontFamily: 'Poppins-Medium',
        color: '#4B5563',
    },
    memberQuoteBox: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 12,
        marginBottom: 14,
        borderLeftWidth: 3,
        borderLeftColor: '#FF6A00',
    },
    memberQuoteText: {
        fontSize: 12,
        fontFamily: 'Poppins-Regular',
        color: '#4B5563',
        lineHeight: 18,
        fontStyle: 'italic',
    },
    memberActionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    viewMemberBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 4,
    },
    viewMemberBtnText: {
        fontSize: 13,
        fontFamily: 'Poppins-SemiBold',
        color: '#FF6A00',
    },
    connectMemberBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FF6A00',
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 10,
        gap: 6,
    },
    connectMemberBtnText: {
        fontSize: 12,
        fontFamily: 'Poppins-Medium',
        color: '#FFFFFF',
    },

    // Member Detail Sheet Styles
    memberDetailSheet: {
        maxHeight: '90%',
    },
    memberDetailHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    memberDetailScrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    memberDetailHero: {
        alignItems: 'center',
        marginBottom: 20,
    },
    memberDetailAvatar: {
        width: 88,
        height: 88,
        borderRadius: 44,
        borderWidth: 3,
        borderColor: '#FF6A00',
        marginBottom: 12,
    },
    memberDetailName: {
        fontSize: 20,
        fontFamily: 'Poppins-Bold',
        color: '#111827',
        marginBottom: 4,
        textAlign: 'center',
    },
    memberDetailRole: {
        fontSize: 14,
        fontFamily: 'Poppins-Medium',
        color: '#EA580C',
        marginBottom: 10,
        textAlign: 'center',
    },
    memberDetailVerifiedPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#D1FAE5',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 14,
        gap: 6,
    },
    memberDetailVerifiedText: {
        fontSize: 12,
        fontFamily: 'Poppins-SemiBold',
        color: '#059669',
    },
    memberDetailInfoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 16,
    },
    memberDetailInfoCard: {
        flex: 1,
        minWidth: 100,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    memberDetailInfoLabel: {
        fontSize: 10,
        fontFamily: 'Poppins-Bold',
        color: '#9CA3AF',
        marginBottom: 4,
        letterSpacing: 0.5,
    },
    memberDetailInfoValue: {
        fontSize: 13,
        fontFamily: 'Poppins-SemiBold',
        color: '#1F2937',
    },
    memberDetailBioCard: {
        backgroundColor: '#FFF7ED',
        borderRadius: 14,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#FFEDD5',
    },
    memberDetailBioHeading: {
        fontSize: 13,
        fontFamily: 'Poppins-SemiBold',
        color: '#C2410C',
        marginBottom: 8,
    },
    memberDetailBioText: {
        fontSize: 13,
        fontFamily: 'Poppins-Regular',
        color: '#374151',
        lineHeight: 20,
    },
    memberDetailActions: {
        gap: 10,
    },
    memberDetailConnectBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FF6A00',
        borderRadius: 14,
        height: 50,
        gap: 8,
    },
    memberDetailConnectBtnText: {
        fontSize: 14,
        fontFamily: 'Poppins-SemiBold',
        color: '#FFFFFF',
    },
    memberDetailShareBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        height: 48,
        borderWidth: 1,
        borderColor: '#FF6A00',
        gap: 8,
    },
    memberDetailShareBtnText: {
        fontSize: 14,
        fontFamily: 'Poppins-SemiBold',
        color: '#FF6A00',
    },
});
