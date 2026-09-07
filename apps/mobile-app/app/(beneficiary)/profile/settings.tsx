import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, useWindowDimensions, Linking, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeBack } from '@/hooks/useSafeBack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigationStack } from '@/contexts/NavigationStackContext';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';
import { LEGAL_CONFIG } from '@/constants/legal';
import { useDeleteAccountWithConfirm } from '@/utils/deleteAccount';
import Constants from 'expo-constants';

export default function SettingsScreen() {
    const { width } = useWindowDimensions();
    const contentWidth = Math.min(Math.max(width - 24, 0), 440);
    const responsiveContentStyle = { width: contentWidth, alignSelf: 'center' as const };
    const router = useRouter();
    const { push, replace, pop } = useNavigationStack();
    useAndroidBackHandler();
    const safeBack = useSafeBack();
    const deleteAccountWithConfirm = useDeleteAccountWithConfirm();

    const appVersion = Constants.expoConfig?.version || '1.0.0';
    const buildNumber = Constants.expoConfig?.ios?.buildNumber || Constants.expoConfig?.android?.versionCode?.toString() || '1.0.0';

    const openPrivacyPolicy = () => {
        Linking.openURL(LEGAL_CONFIG.PRIVACY_POLICY_URL).catch(err => console.log('Error opening privacy link:', err));
    };

    const openTermsOfService = () => {
        Linking.openURL(LEGAL_CONFIG.TERMS_OF_SERVICE_URL).catch(err => console.log('Error opening terms link:', err));
    };

    const openHelpSupport = () => {
        Alert.alert(
            'MaiHoonNa Care Support',
            'We are here to assist you with companion care, visits, and account assistance.\n\n✉️ Email: info@maihoonna.com\n⏱️ Support Hours: Mon–Sat, 9:00 AM – 7:00 PM IST\n📍 Service Hub: Gurugram, Haryana, India',
            [
                {
                    text: 'Send Email',
                    onPress: () => {
                        const mailUrl = `mailto:${LEGAL_CONFIG.SUPPORT_EMAIL}?subject=MaiHoonNa%20App%20Support`;
                        Linking.openURL(mailUrl).catch(() => {
                            Alert.alert('Email Support', `Please email us directly at:\n${LEGAL_CONFIG.SUPPORT_EMAIL}`);
                        });
                    }
                },
                { text: 'Close', style: 'cancel' }
            ]
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={[styles.header, responsiveContentStyle]}>
                <TouchableOpacity
                    onPress={() => safeBack()}
                    style={styles.backBtn}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Feather name="arrow-left" size={22} color="#111827" />
                </TouchableOpacity>

                <Text style={styles.headerTitle}>Settings</Text>

                <View style={styles.headerSpacer} />
            </View>

            <View style={styles.container}>
                <View style={[styles.aboutCard, responsiveContentStyle]}>
                    <Text style={styles.aboutTitle}>About</Text>

                    <View style={styles.aboutRows}>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Version</Text>
                            <Text style={styles.infoValue}>{appVersion}</Text>
                        </View>

                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Build</Text>
                            <Text style={styles.infoValue}>{buildNumber}</Text>
                        </View>
                    </View>
                </View>

                <View style={[styles.linksCard, responsiveContentStyle]}>
                    <TouchableOpacity style={styles.linkRow} activeOpacity={0.7} onPress={openPrivacyPolicy}>
                        <Text style={styles.linkText}>Privacy Policy</Text>
                    </TouchableOpacity>

                    <View style={styles.divider} />

                    <TouchableOpacity style={styles.linkRow} activeOpacity={0.7} onPress={openTermsOfService}>
                        <Text style={styles.linkText}>Terms of Service</Text>
                    </TouchableOpacity>

                    <View style={styles.divider} />

                    <TouchableOpacity style={styles.linkRow} activeOpacity={0.7} onPress={openHelpSupport}>
                        <Text style={styles.linkText}>Help & Support</Text>
                    </TouchableOpacity>
                </View>

                {/* Account & Privacy Section */}
                <View style={[styles.dangerCard, responsiveContentStyle]}>
                    <Text style={styles.dangerTitle}>Account</Text>
                    <TouchableOpacity
                        style={styles.deleteRow}
                        activeOpacity={0.7}
                        onPress={deleteAccountWithConfirm}
                    >
                        <View style={styles.deleteLeft}>
                            <Feather name="trash-2" size={18} color="#DC2626" />
                            <View style={styles.deleteTextCol}>
                                <Text style={styles.deleteTitle}>Delete Account</Text>
                                <Text style={styles.deleteSubtitle}>Permanently remove your account and profile</Text>
                            </View>
                        </View>
                        <Feather name="chevron-right" size={18} color="#DC2626" />
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        height: Platform.OS === 'ios' ? 72 : 70,
        paddingHorizontal: 0,
        backgroundColor: '#FFFFFF',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    backBtn: {
        width: 28,
        height: 28,
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    headerTitle: {
        fontFamily: 'Poppins-Regular',
        fontSize: 16,
        lineHeight: 22,
        color: '#000000',
        textAlign: 'center',
    },
    headerSpacer: {
        width: 28,
        height: 28,
    },
    container: {
        flex: 1,
        backgroundColor: '#FFF1E8',
        paddingTop: 18,
    },
    aboutCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingTop: 18,
        paddingBottom: 14,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.16,
        shadowRadius: 2,
        elevation: 2,
    },
    aboutTitle: {
        fontFamily: 'Poppins-Medium',
        fontSize: 18,
        lineHeight: 24,
        color: '#333333',
        marginBottom: 16,
    },
    aboutRows: {
        gap: 7,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    infoLabel: {
        fontFamily: 'Poppins-Regular',
        fontSize: 15,
        lineHeight: 20,
        color: '#333333',
    },
    infoValue: {
        fontFamily: 'Poppins-Regular',
        fontSize: 14,
        lineHeight: 20,
        color: '#111827',
        textAlign: 'right',
    },
    linksCard: {
        marginTop: 46,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 0,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.16,
        shadowRadius: 2,
        elevation: 2,
    },
    linkRow: {
        height: 56,
        justifyContent: 'center',
    },
    linkText: {
        fontFamily: 'Poppins-Medium',
        fontSize: 16,
        lineHeight: 22,
        color: '#333333',
    },
    divider: {
        height: 1,
        backgroundColor: '#F0F0F0',
    },
    dangerCard: {
        marginTop: 20,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 14,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.12,
        shadowRadius: 2,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#FEE2E2',
    },
    dangerTitle: {
        fontFamily: 'Poppins-Medium',
        fontSize: 16,
        color: '#991B1B',
        marginBottom: 12,
    },
    deleteRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
    },
    deleteLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    deleteTextCol: {
        flex: 1,
    },
    deleteTitle: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 14,
        color: '#DC2626',
    },
    deleteSubtitle: {
        fontFamily: 'Poppins-Regular',
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
});