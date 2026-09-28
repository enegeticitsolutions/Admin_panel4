import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Animated, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.75;

import GlobalDrawer from '../(subscriber)/components/shared/GlobalDrawer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFonts, Poppins_400Regular, Poppins_600SemiBold } from '@expo-google-fonts/poppins';
import { useSafeBack } from '@/hooks/useSafeBack';
import { useNavigationStack } from '@/contexts/NavigationStackContext';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';
import { SafeAreaView } from 'react-native-safe-area-context';
import NotificationBell from '@/components/shared/NotificationBell';

export default function EmergencyContactsScreen() {
    const router = useRouter();
    const { push } = useNavigationStack();
    const safeBack = useSafeBack();
    useAndroidBackHandler();
    const params = useLocalSearchParams();
    const [fontsLoaded] = useFonts({
        Poppins_400Regular,
        Poppins_600SemiBold
    });

    const [drawerOpen, setDrawerOpen] = useState(false);
    const drawerAnim = useRef(new Animated.Value(DRAWER_WIDTH)).current;
    const scrollViewRef = useRef<ScrollView>(null);
    const [userData, setUserData] = useState<any>(null);

    const isVerificationFlow = params.isVerificationFlow === 'true';
    const beneficiaryId = params.beneficiaryId as string;
    const pendingDetailsRaw = params.pendingDetails as string;

    useEffect(() => {
        AsyncStorage.getItem('userData').then(data => {
            if (data) setUserData(JSON.parse(data));
        });

        // Pre-fill emergency contact details in verification flow
        if (isVerificationFlow && pendingDetailsRaw) {
            try {
                const b = JSON.parse(pendingDetailsRaw);
                if (b.emergencyContacts && Array.isArray(b.emergencyContacts)) {
                    const primary = b.emergencyContacts.find((c: any) => c.isPrimary) || b.emergencyContacts[0];
                    const secondary = b.emergencyContacts.find((c: any) => !c.isPrimary) || b.emergencyContacts[1];

                    setForm({
                        primaryName: primary?.name || '',
                        primaryPhone: primary?.phone || '',
                        primaryEmail: primary?.email || '',
                        secondaryName: secondary?.name || '',
                        secondaryPhone: secondary?.phone || '',
                        secondaryEmail: secondary?.email || ''
                    });
                }
            } catch (err) {
                console.error('Error parsing pending details in emergency-contacts:', err);
            }
        }
    }, [isVerificationFlow, pendingDetailsRaw]);

    const openDrawer = () => {
        setDrawerOpen(true);
        Animated.timing(drawerAnim, { toValue: 0, duration: 280, useNativeDriver: true }).start();
    };
    const closeDrawer = () => {
        Animated.timing(drawerAnim, { toValue: DRAWER_WIDTH, duration: 240, useNativeDriver: true }).start(() => setDrawerOpen(false));
    };

    const [form, setForm] = useState({
        primaryName: '',
        primaryPhone: '',
        primaryEmail: '',
        secondaryName: '',
        secondaryPhone: '',
        secondaryEmail: ''
    });
    const [primaryNameError, setPrimaryNameError] = useState('');
    const [primaryPhoneError, setPrimaryPhoneError] = useState('');
    const [primaryEmailError, setPrimaryEmailError] = useState('');
    const [secondaryPhoneError, setSecondaryPhoneError] = useState('');
    const [secondaryEmailError, setSecondaryEmailError] = useState('');

    const handleNext = () => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        let hasError = false;

        // Mandatory Primary Emergency Contact validation
        if (!form.primaryName.trim()) {
            setPrimaryNameError('Primary contact name is required');
            hasError = true;
        } else {
            setPrimaryNameError('');
        }

        const cleanedPhone = form.primaryPhone.replace(/\D/g, '');
        if (!cleanedPhone) {
            setPrimaryPhoneError('Primary contact phone number is required');
            hasError = true;
        } else if (cleanedPhone.length !== 10) {
            setPrimaryPhoneError('Phone number must be exactly 10 digits');
            hasError = true;
        } else {
            setPrimaryPhoneError('');
        }

        if (form.primaryEmail && !emailRegex.test(form.primaryEmail)) {
            setPrimaryEmailError('Please enter a valid email address');
            hasError = true;
        } else {
            setPrimaryEmailError('');
        }

        const cleanedSecondaryPhone = form.secondaryPhone.replace(/\D/g, '');
        if (cleanedSecondaryPhone && cleanedSecondaryPhone.length !== 10) {
            setSecondaryPhoneError('Phone number must be exactly 10 digits');
            hasError = true;
        } else {
            setSecondaryPhoneError('');
        }

        if (form.secondaryEmail && !emailRegex.test(form.secondaryEmail)) {
            setSecondaryEmailError('Please enter a valid email address');
            hasError = true;
        } else {
            setSecondaryEmailError('');
        }

        if (hasError) {
            scrollViewRef.current?.scrollTo({ y: 0, animated: true });
            return;
        }

        push('/(setup)/schedule-preferences', {
            packageId: params.packageId,
            subscriberData: params.subscriberData,
            beneficiaryData: params.beneficiaryData,
            medicalData: params.medicalData,
            emergencyContacts: JSON.stringify(form),
            isVerificationFlow: params.isVerificationFlow,
            beneficiaryId: params.beneficiaryId,
            pendingDetails: params.pendingDetails,
            isLinkingFlow: params.isLinkingFlow || 'false'
        });
    };

    const handleBack = () => {
        safeBack();
    };

    if (!fontsLoaded) {
        return (
            <SafeAreaView style={[styles.safeArea, styles.loadingContainer]}>
                <ActivityIndicator size="small" color="#FF5C00" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerTopRow}>
                        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                            <Ionicons name="arrow-back" size={24} color="#111827" />
                        </TouchableOpacity>
                        <View style={styles.headerTextContainer}>
                            <Text style={styles.headerTitle}>Subscribe to Care</Text>
                            <Text style={styles.headerSubtitle}>Step 4 of 5</Text>
                        </View>
                        <View style={styles.headerIcons}>
                            <NotificationBell />
                            <TouchableOpacity onPress={openDrawer}>
                                <Ionicons name="menu-outline" size={30} color="#111827" style={{ marginLeft: 15 }} />
                            </TouchableOpacity>
                        </View>
                    </View>
                    <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: '80%' }]} />
                    </View>
                </View>

                <ScrollView ref={scrollViewRef} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                    <View style={styles.formCard}>
                        <Text style={styles.sectionTitle}>Emergency Contacts</Text>

                        {/* Primary Emergency Contact */}
                        <Text style={styles.subtextLabel}>Primary Emergency Contact *</Text>
                        
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Name *</Text>
                            <TextInput
                                style={[styles.input, primaryNameError ? styles.inputError : null]}
                                value={form.primaryName}
                                maxLength={50}
                                onChangeText={(t) => {
                                    setForm({ ...form, primaryName: t });
                                    if (primaryNameError) setPrimaryNameError('');
                                }}
                            />
                            {primaryNameError ? (
                                <Text style={styles.errorText}>{primaryNameError}</Text>
                            ) : null}
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Phone *</Text>
                            <TextInput
                                style={[styles.input, primaryPhoneError ? styles.inputError : null]}
                                keyboardType="numeric"
                                value={form.primaryPhone}
                                maxLength={10}
                                onChangeText={(t) => {
                                    setForm({ ...form, primaryPhone: t.replace(/[^0-9]/g, '').slice(0, 10) });
                                    if (primaryPhoneError) setPrimaryPhoneError('');
                                }}
                            />
                            {primaryPhoneError ? (
                                <Text style={styles.errorText}>{primaryPhoneError}</Text>
                            ) : null}
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Email</Text>
                            <TextInput
                                style={styles.input}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                value={form.primaryEmail}
                                maxLength={80}
                                onChangeText={(t) => {
                                    setForm({ ...form, primaryEmail: t });
                                    if (primaryEmailError) setPrimaryEmailError('');
                                }}
                            />
                            {primaryEmailError ? (
                                <Text style={styles.errorText}>{primaryEmailError}</Text>
                            ) : null}
                        </View>

                        {/* Secondary Emergency Contact */}
                        <Text style={styles.subtextLabel}>Secondary Emergency Contact</Text>
                        
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Name</Text>
                            <TextInput
                                style={styles.input}
                                value={form.secondaryName}
                                maxLength={50}
                                onChangeText={(t) => setForm({ ...form, secondaryName: t })}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Phone</Text>
                            <TextInput
                                style={[styles.input, secondaryPhoneError ? styles.inputError : null]}
                                keyboardType="numeric"
                                value={form.secondaryPhone}
                                maxLength={10}
                                onChangeText={(t) => {
                                    setForm({ ...form, secondaryPhone: t.replace(/[^0-9]/g, '').slice(0, 10) });
                                    if (secondaryPhoneError) setSecondaryPhoneError('');
                                }}
                            />
                            {secondaryPhoneError ? (
                                <Text style={styles.errorText}>{secondaryPhoneError}</Text>
                            ) : null}
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Email</Text>
                            <TextInput
                                style={styles.input}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                value={form.secondaryEmail}
                                maxLength={80}
                                onChangeText={(t) => {
                                    setForm({ ...form, secondaryEmail: t });
                                    if (secondaryEmailError) setSecondaryEmailError('');
                                }}
                            />
                            {secondaryEmailError ? (
                                <Text style={styles.errorText}>{secondaryEmailError}</Text>
                            ) : null}
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.buttonRow}>
                            <TouchableOpacity style={styles.prevBtn} onPress={handleBack}>
                                <Text style={styles.prevBtnText}>Previous</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
                                <Text style={styles.nextBtnText}>Next</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                </ScrollView>

            </KeyboardAvoidingView>

            <GlobalDrawer 
                isOpen={drawerOpen} 
                onClose={closeDrawer} 
                drawerAnim={drawerAnim} 
                userData={userData} 
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#FFF1E6' },
    loadingContainer: { alignItems: 'center', justifyContent: 'center' },
    header: { backgroundColor: '#FFFFFF' },
    headerTopRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, paddingTop: 10, paddingBottom: 11 },
    headerIcons: { flexDirection: 'row', alignItems: 'center' },
    backButton: { width: 44, height: 44, justifyContent: 'center' },
    headerTextContainer: { flex: 1, alignItems: 'flex-start', justifyContent: 'center', paddingLeft: 7 },
    headerTitle: { fontFamily: 'Poppins_400Regular', fontSize: 18, lineHeight: 24, color: '#000000' },
    headerSubtitle: { fontFamily: 'Poppins_400Regular', fontSize: 16, lineHeight: 22, color: '#8F95A3', marginTop: 2 },
    notifBadge: { position: 'absolute', right: -7, top: -7, backgroundColor: '#FF5C00', borderRadius: 10, width: 19, height: 19, justifyContent: 'center', alignItems: 'center' },
    notifText: { color: 'white', fontSize: 10, fontWeight: '600', fontFamily: 'Poppins_600SemiBold' },
    progressBarBg: { height: 4, backgroundColor: '#E5E7EB', width: '100%' },
    progressBarFill: { height: 4, backgroundColor: '#FF5C00', width: '80%' },

    scrollContent: { paddingHorizontal: 22, paddingTop: 32, paddingBottom: 30 },
    formCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 15,
        paddingHorizontal: 26,
        paddingTop: 29,
        paddingBottom: 37,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.18,
        shadowRadius: 6,
        elevation: 5
    },
    sectionTitle: { fontFamily: 'Poppins_400Regular', fontSize: 20, lineHeight: 28, color: '#000000', marginBottom: 10 },
    subtextLabel: { fontFamily: 'Poppins_400Regular', fontSize: 14, lineHeight: 20, color: '#000000', marginBottom: 28 },

    divider: { height: 1, backgroundColor: '#E5E7EB', marginTop: 13, marginBottom: 14 },

    label: { fontFamily: 'Poppins_400Regular', fontSize: 14, lineHeight: 20, color: '#000000', marginBottom: 12 },
    inputGroup: { marginBottom: 15 },
    input: { height: 53, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 9, paddingHorizontal: 16, paddingVertical: 0, fontFamily: 'Poppins_400Regular', fontSize: 14, lineHeight: 20, color: '#111827' },

    buttonRow: { flexDirection: 'row', justifyContent: 'space-between' },
    prevBtn: { flex: 0.48, height: 53, borderWidth: 1, borderColor: '#FF5C00', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    prevBtnText: { color: '#FF5C00', fontSize: 18, lineHeight: 25, fontWeight: '600', fontFamily: 'Poppins_600SemiBold' },
    nextBtn: { flex: 0.48, height: 53, backgroundColor: '#FF5C00', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    nextBtnText: { color: '#FFFFFF', fontSize: 18, lineHeight: 25, fontWeight: '600', fontFamily: 'Poppins_600SemiBold' },
    inputError: { borderColor: '#EF4444' },
    errorText: { color: '#EF4444', fontSize: 12, fontFamily: 'Poppins_400Regular', marginTop: 4, marginLeft: 4 }
});
