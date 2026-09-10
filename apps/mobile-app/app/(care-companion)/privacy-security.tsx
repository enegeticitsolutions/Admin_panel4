import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Linking,
    useWindowDimensions,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { CompanionBackButton } from '../../components/care-companion/CompanionBackButton';
import { useNavigationStack } from '@/contexts/NavigationStackContext';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';
import { LEGAL_CONFIG } from '@/constants/legal';
import { useDeleteAccountWithConfirm } from '@/utils/deleteAccount';
import CareSupportModal from '@/components/shared/CareSupportModal';

const DEEP_ORANGE = '#FE6700';
const LIGHT_BEIGE = '#FAF3EB';

export default function PrivacySecurityScreen() {
    const { push } = useNavigationStack();
    useAndroidBackHandler();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const [supportModalVisible, setSupportModalVisible] = useState(false);
    const deleteAccountWithConfirm = useDeleteAccountWithConfirm();

    const [fontsLoaded] = useFonts({
        Poppins_400Regular,
        Poppins_500Medium,
        Poppins_600SemiBold,
        Poppins_700Bold,
    });

    const contentWidth = Math.min(Math.max(width - 32, 0), 440);
    const responsiveContentStyle = {
        width: contentWidth,
        alignSelf: 'center' as const,
    };

    const handleOpenPrivacyPolicy = () => {
        Linking.openURL(LEGAL_CONFIG.PRIVACY_POLICY_URL).catch((err) =>
            console.log('Error opening privacy link:', err)
        );
    };

    const handleOpenTermsOfService = () => {
        Linking.openURL(LEGAL_CONFIG.TERMS_OF_SERVICE_URL).catch((err) =>
            console.log('Error opening terms link:', err)
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <Stack.Screen options={{ headerShown: false }} />

            <ScrollView bounces={false} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Clean, spacious header with safe-area support */}
                <View style={[styles.deepOrangeHeader, { paddingTop: Math.max(insets.top, Platform.OS === 'android' ? 16 : 12) }]}>
                    <View style={[styles.headerRow, responsiveContentStyle]}>
                        <CompanionBackButton style={styles.backButton} />
                        <View style={styles.headerTextBlock}>
                            <Text style={styles.headerTitle}>Privacy & Security</Text>
                            <Text style={styles.headerSub}>Manage your account safety & privacy</Text>
                        </View>
                    </View>
                </View>

                <View style={[styles.contentArea, responsiveContentStyle]}>
                    {/* Section 1: Security & Login */}
                    <Animated.View entering={FadeInUp.delay(150).duration(500)} style={styles.card}>
                        <View style={styles.cardHeaderRow}>
                            <View style={styles.sectionHeaderIconWrap}>
                                <Ionicons name="shield-checkmark" size={18} color={DEEP_ORANGE} />
                            </View>
                            <Text style={styles.cardSectionTitle}>Security & Login</Text>
                        </View>

                        <TouchableOpacity
                            style={styles.menuRow}
                            activeOpacity={0.7}
                            onPress={() => push('/(care-companion)/settings/change-password' as any)}
                        >
                            <View style={styles.menuRowLeft}>
                                <View style={[styles.iconBadge, { backgroundColor: '#FFF4EB' }]}>
                                    <Ionicons name="key-outline" size={19} color={DEEP_ORANGE} />
                                </View>
                                <View style={styles.menuTextCol}>
                                    <Text style={styles.menuTitle}>Change Password</Text>
                                    <Text style={styles.menuSub}>Update your account login password</Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                        </TouchableOpacity>

                        <View style={styles.divider} />

                        <View style={[styles.menuRow, styles.lastRow]}>
                            <View style={styles.menuRowLeft}>
                                <View style={[styles.iconBadge, { backgroundColor: '#ECFDF5' }]}>
                                    <Ionicons name="lock-closed-outline" size={19} color="#16A34A" />
                                </View>
                                <View style={styles.menuTextCol}>
                                    <Text style={styles.menuTitle}>Security Status</Text>
                                    <Text style={styles.menuSub}>Protected with verified session authentication</Text>
                                </View>
                            </View>
                            <View style={styles.statusBadge}>
                                <View style={styles.activeDot} />
                                <Text style={styles.statusBadgeText}>Active</Text>
                            </View>
                        </View>
                    </Animated.View>

                    {/* Section 2: Privacy, Policies & Support */}
                    <Animated.View entering={FadeInUp.delay(300).duration(500)} style={styles.card}>
                        <View style={styles.cardHeaderRow}>
                            <View style={styles.sectionHeaderIconWrap}>
                                <Ionicons name="document-text" size={18} color={DEEP_ORANGE} />
                            </View>
                            <Text style={styles.cardSectionTitle}>Privacy & Policies</Text>
                        </View>

                        <TouchableOpacity
                            style={styles.menuRow}
                            activeOpacity={0.7}
                            onPress={handleOpenPrivacyPolicy}
                        >
                            <View style={styles.menuRowLeft}>
                                <View style={[styles.iconBadge, { backgroundColor: '#EFF6FF' }]}>
                                    <Ionicons name="shield-outline" size={19} color="#2563EB" />
                                </View>
                                <View style={styles.menuTextCol}>
                                    <Text style={styles.menuTitle}>Privacy Policy</Text>
                                    <Text style={styles.menuSub}>Read how we protect and process your data</Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                        </TouchableOpacity>

                        <View style={styles.divider} />

                        <TouchableOpacity
                            style={styles.menuRow}
                            activeOpacity={0.7}
                            onPress={handleOpenTermsOfService}
                        >
                            <View style={styles.menuRowLeft}>
                                <View style={[styles.iconBadge, { backgroundColor: '#F5F3FF' }]}>
                                    <Ionicons name="reader-outline" size={19} color="#7C3AED" />
                                </View>
                                <View style={styles.menuTextCol}>
                                    <Text style={styles.menuTitle}>Terms of Service</Text>
                                    <Text style={styles.menuSub}>Platform service terms & agreements</Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                        </TouchableOpacity>

                        <View style={styles.divider} />

                        <TouchableOpacity
                            style={[styles.menuRow, styles.lastRow]}
                            activeOpacity={0.7}
                            onPress={() => setSupportModalVisible(true)}
                        >
                            <View style={styles.menuRowLeft}>
                                <View style={[styles.iconBadge, { backgroundColor: '#FEF3C7' }]}>
                                    <Ionicons name="help-circle-outline" size={19} color="#D97706" />
                                </View>
                                <View style={styles.menuTextCol}>
                                    <Text style={styles.menuTitle}>Contact Support</Text>
                                    <Text style={styles.menuSub}>Get help with privacy or account inquiries</Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                        </TouchableOpacity>
                    </Animated.View>

                    {/* Section 3: Account Management (Renamed from Danger Zone) */}
                    <Animated.View entering={FadeInUp.delay(450).duration(500)} style={styles.card}>
                        <View style={styles.cardHeaderRow}>
                            <View style={styles.sectionHeaderIconWrap}>
                                <Ionicons name="person-circle-outline" size={18} color="#6B7280" />
                            </View>
                            <Text style={[styles.cardSectionTitle, { color: '#374151' }]}>Account Management</Text>
                        </View>

                        <TouchableOpacity
                            style={[styles.menuRow, styles.lastRow]}
                            activeOpacity={0.7}
                            onPress={deleteAccountWithConfirm}
                        >
                            <View style={styles.menuRowLeft}>
                                <View style={[styles.iconBadge, { backgroundColor: '#FEF2F2' }]}>
                                    <Ionicons name="trash-outline" size={19} color="#DC2626" />
                                </View>
                                <View style={styles.menuTextCol}>
                                    <Text style={[styles.menuTitle, { color: '#DC2626' }]}>Delete Account</Text>
                                    <Text style={styles.menuSub}>Permanently deactivate and delete your account</Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color="#DC2626" />
                        </TouchableOpacity>
                    </Animated.View>

                    <View style={styles.bottomSpacer} />
                </View>
            </ScrollView>

            <CareSupportModal
                visible={supportModalVisible}
                onClose={() => setSupportModalVisible(false)}
                emailSubject="Care Companion Privacy & Account Support"
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: LIGHT_BEIGE,
    },
    scrollContent: {
        flexGrow: 1,
    },
    deepOrangeHeader: {
        backgroundColor: DEEP_ORANGE,
        paddingBottom: 28,
        borderBottomLeftRadius: 28,
        borderBottomRightRadius: 28,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.22)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    headerTextBlock: {
        flex: 1,
    },
    headerTitle: {
        fontFamily: 'Poppins_700Bold',
        fontSize: 20,
        color: '#FFFFFF',
        letterSpacing: 0.2,
    },
    headerSub: {
        fontFamily: 'Poppins_400Regular',
        fontSize: 13,
        color: 'rgba(255, 255, 255, 0.9)',
        marginTop: 1,
    },
    contentArea: {
        marginTop: -10,
        paddingBottom: 30,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 14,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#F3F4F6',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    cardHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F9FAFB',
    },
    sectionHeaderIconWrap: {
        width: 28,
        height: 28,
        borderRadius: 8,
        backgroundColor: '#FFF7ED',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    cardSectionTitle: {
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 15,
        color: '#111827',
    },
    menuRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 11,
    },
    lastRow: {
        paddingBottom: 2,
    },
    menuRowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 10,
    },
    iconBadge: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    menuTextCol: {
        flex: 1,
    },
    menuTitle: {
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 14,
        color: '#1F2937',
    },
    menuSub: {
        fontFamily: 'Poppins_400Regular',
        fontSize: 12,
        color: '#6B7280',
        marginTop: 1,
        lineHeight: 16,
    },
    divider: {
        height: 1,
        backgroundColor: '#F3F4F6',
        marginVertical: 3,
        marginLeft: 54,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#D1FAE5',
    },
    activeDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#16A34A',
        marginRight: 5,
    },
    statusBadgeText: {
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 11,
        color: '#15803D',
    },
    bottomSpacer: {
        height: 30,
    },
});
