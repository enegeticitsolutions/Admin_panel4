import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, ActivityIndicator, Alert, Image, ImageBackground, useWindowDimensions,
    Modal, FlatList, KeyboardAvoidingView, Platform, TouchableWithoutFeedback
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_URL } from '@/constants/api';
import { sanitizeImageUri } from '@/utils/sanitizeImageUri';

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

    const [userData, setUserData] = useState<any>(null);
    const [successModalVisible, setSuccessModalVisible] = useState(false);
    const [successMessage, setSuccessMessage] = useState({ title: '', message: '' });

    useFocusEffect(
        useCallback(() => {
            const loadUser = async () => {
                const data = await AsyncStorage.getItem('userData');
                if (data) {
                    setUserData(JSON.parse(data));
                }
            };
            loadUser();
        }, [])
    );

    // Re-fetch the profile every time the screen is focused so that
    // admin approval is reflected immediately without an app restart.
    useFocusEffect(
        useCallback(() => {
            queryClient.invalidateQueries({ queryKey: ['legacyCircleProfile'] });
        }, [queryClient])
    );

    const fetchProfile = async () => {
        const token = await AsyncStorage.getItem('userToken');
        if (!token) throw new Error('No token found');

        const res = await fetch(`${API_URL}/beneficiary/legacy-circle`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch profile');
        const json = await res.json();
        return json.data;
    };

    const { data: profile, isLoading, error } = useQuery({
        queryKey: ['legacyCircleProfile'],
        queryFn: fetchProfile,
        staleTime: 0, // Always treat as stale so focus invalidation triggers a re-fetch
    });


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
        const isCurrentlyActive = profile?.isActive;
        Alert.alert(
            isCurrentlyActive ? 'Deactivate Account' : 'Activate Account',
            isCurrentlyActive 
                ? 'Are you sure you want to deactivate your Legacy Circle profile? It will no longer be visible to others.' 
                : 'Are you sure you want to activate your Legacy Circle profile? It will become visible to others.',
            [
                { text: 'Cancel', style: 'cancel' },
                { 
                    text: isCurrentlyActive ? 'Deactivate' : 'Activate', 
                    style: isCurrentlyActive ? 'destructive' : 'default',
                    onPress: () => toggleActiveMutation.mutate() 
                }
            ]
        );
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

    if (isLoading || !userData) {
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

    const renderForm = () => (
        <ScrollView style={styles.scrollContainer} contentContainerStyle={[styles.content, responsiveStyle]}>
            <View style={styles.orangeBanner}>
                <Feather name="clock" size={24} color="#FFFFFF" style={{ marginBottom: 12 }} />
                <Text style={styles.bannerTitle}>{isEditing ? 'Edit Your Profile' : 'Create Your Legacy Profile'}</Text>
                <Text style={styles.bannerDesc}>
                    {isEditing ? 'Update your information below.' : 'Your profile will be shared with the community and featured on the MaiHoonNa website.'}
                </Text>
            </View>

            <View style={styles.profilePicContainer}>
                {userData?.photo ? (
                    <Image source={{ uri: sanitizeImageUri(userData.photo) }} style={styles.profilePic} />
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
            <ScrollView style={styles.scrollContainer} contentContainerStyle={[styles.content, responsiveStyle]}>
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
            <ScrollView style={styles.scrollContainer} bounces={false}>
                <View style={styles.heroBannerContainer}>
                    <ImageBackground
                        source={require('../../assets/images/legacy-circle-bg.png')}
                        style={styles.heroBannerImage}
                        imageStyle={{ opacity: 0.60 }}
                        resizeMode="cover"
                    >
                        {/* Orange tint overlay matching Figma */}
                        <View style={styles.heroBannerOverlay} />
                    </ImageBackground>
                    {userData?.photo ? (
                        <Image source={{ uri: sanitizeImageUri(userData.photo) }} style={styles.heroAvatar} />
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
                            <View style={styles.shareIconWrap}>
                                <MaterialCommunityIcons name="whatsapp" size={24} color="#FFFFFF" />
                            </View>
                            <View style={styles.shareTextWrap}>
                                <Text style={styles.shareTitle}>Share your profile</Text>
                                <Text style={styles.shareDesc}>Your link was sent via WhatsApp</Text>
                            </View>
                            <TouchableOpacity style={styles.resendBtn}>
                                <Text style={styles.resendBtnText}>Resend</Text>
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
                <Text style={styles.headerTitle}>{isEditing ? 'Edit Profile' : 'Legacy Circle'}</Text>
            </View>

            {(!profile || isEditing) ? renderForm() : profile.status === 'pending' ? renderPending() : renderApproved()}

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
    successModalBtnText: { color: '#FFFFFF', fontFamily: 'Poppins-SemiBold', fontSize: 15 }
});
