import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Modal, Dimensions, ScrollView, Platform, Image, Linking, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, usePathname } from 'expo-router';
import { useLogoutWithConfirm } from '@/utils/logout';
import { useDeleteAccountWithConfirm } from '@/utils/deleteAccount';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigationStack } from '@/contexts/NavigationStackContext';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';
import { useAuth } from '@/contexts/AuthContext';
import { sanitizeImageUri } from '@/utils/sanitizeImageUri';
import { LEGAL_CONFIG } from '@/constants/legal';
import { scale } from '@/utils/responsive';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(width * 0.82, 350);

interface GlobalDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    drawerAnim: Animated.Value;
    userData: any;
}

const GlobalDrawer = ({ isOpen, onClose, drawerAnim, userData: _userDataProp }: GlobalDrawerProps) => {
    const router = useRouter();
    const { push } = useNavigationStack();
    useAndroidBackHandler();
    const pathname = usePathname();
    const logoutWithConfirm = useLogoutWithConfirm();
    const insets = useSafeAreaInsets();
    const { user: authUser, isLoggedIn, availableRoles, isSwitchingRole, switchRole } = useAuth();
    const userData = authUser || _userDataProp;
    const userName = isLoggedIn ? (userData?.name || 'User') : 'Welcome Guest';
    const userPhone = isLoggedIn ? (userData?.phone || userData?.email || '') : 'Sign in to manage your care';
    const userRole = (userData?.role || '').toUpperCase();
    const isSubscriber = isLoggedIn && (userRole === 'SUBSCRIBER' || !userRole);
    const hasSelfBeneficiary = (userData?.subscriberBeneficiaries || userData?.beneficiaries || []).some(
        (b: any) => (b.relationship || '').toLowerCase() === 'self' || b.isSelf || (userData?.id && b.userId === userData.id)
    );
    const isDualRole = isLoggedIn && (
        (availableRoles.includes('subscriber') && availableRoles.includes('beneficiary')) ||
        hasSelfBeneficiary
    );
    
    // Get user initials for avatar fallback
    const initials = userName
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || 'SU';

    const navigateTo = (path: string) => {
        onClose();
        setTimeout(() => {
            push(path as any);
        }, 260);
    };

    // ─── Dual-role handler ───────────────────────────────────────────────────
    const handleSwitchToBeneficiary = async () => {
        onClose();
        setTimeout(async () => {
            try {
                await switchRole('beneficiary');
                // AuthContext role change triggers automatic re-route via index.tsx
                router.replace('/(beneficiary)');
            } catch (err: any) {
                Alert.alert('Switch Failed', err?.message || 'Could not switch profile. Please try again.');
            }
        }, 300);
    };

    // ─── Reusable Account Deletion hook ───────────────────────────────────────
    const deleteAccountWithConfirm = useDeleteAccountWithConfirm(onClose);

    return (
        <Modal 
            visible={isOpen} 
            transparent 
            animationType="none" 
            onRequestClose={onClose}
        >
            <TouchableOpacity 
                style={styles.drawerOverlay} 
                activeOpacity={1} 
                onPress={onClose} 
            />
            <Animated.View style={[styles.drawer, { transform: [{ translateX: drawerAnim }] }]}>
                <View style={{ flex: 1, paddingTop: Math.max(insets.top, 16) }}>
                    
                    {/* Header Card */}
                    <View style={styles.headerContainer}>
                        <View style={styles.headerCard}>
                            <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: scale(10), bottom: scale(10), left: scale(10), right: scale(10) }}>
                                <Ionicons name="close-outline" size={scale(20)} color="#6B7280" />
                            </TouchableOpacity>

                            <View style={styles.headerProfileRow}>
                                {userData?.photo ? (
                                    <Image source={{ uri: sanitizeImageUri(userData.photo) }} style={styles.avatarImage} />
                                ) : (

                                    <LinearGradient colors={['#F97316', '#FB923C']} style={styles.avatarBadge}>
                                        <Text style={styles.avatarText}>{initials}</Text>
                                    </LinearGradient>
                                )}

                                <View style={styles.headerInfo}>
                                    <Text style={styles.drawerName} numberOfLines={1}>{userName}</Text>
                                    <Text style={styles.drawerPhone} numberOfLines={1}>{userPhone}</Text>
                                    {isSubscriber && (
                                        <View style={styles.roleBadge}>
                                            <View style={styles.onlineDot} />
                                            <Text style={styles.roleBadgeText}>Subscriber</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Menu Items */}
                    <ScrollView 
                        style={styles.menuScrollView} 
                        contentContainerStyle={styles.menuScrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {isLoggedIn ? (
                            <>
                                {/* ── Dual-Role Switch Card (only for self-subscriber/beneficiary) ── */}
                                {isDualRole && (
                                    <TouchableOpacity
                                        style={styles.switchRoleCard}
                                        onPress={handleSwitchToBeneficiary}
                                        activeOpacity={0.85}
                                        disabled={isSwitchingRole}
                                    >
                                        <LinearGradient
                                            colors={['#FF6B35', '#FF5C00']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={styles.switchRoleGradient}
                                        >
                                            <View style={styles.switchRoleLeft}>
                                                <View style={styles.switchRoleIconBox}>
                                                    {isSwitchingRole ? (
                                                        <ActivityIndicator size="small" color="#FF5C00" />
                                                    ) : (
                                                        <Ionicons name="heart-outline" size={scale(18)} color="#FF5C00" />
                                                    )}
                                                </View>
                                                <View>
                                                    <Text style={styles.switchRoleTitle}>Switch to My Care Profile</Text>
                                                    <Text style={styles.switchRoleSub}>Daily meds, visits & SOS</Text>
                                                </View>
                                            </View>
                                            <Ionicons name="swap-horizontal-outline" size={scale(20)} color="#FFFFFF" />
                                        </LinearGradient>
                                    </TouchableOpacity>
                                )}

                                <Text style={styles.sectionLabel}>MENU</Text>
                                <DrawerItem 
                                    label="Dashboard" 
                                    icon="grid-outline" 
                                    bg="#FFF7ED"
                                    color="#F97316"
                                    active={pathname === '/' || pathname === '/(subscriber)' || pathname === '/(subscriber)/'}
                                    onPress={() => { onClose(); push('/(subscriber)'); }} 
                                />
                                <DrawerItem 
                                    label="My Profile" 
                                    icon="person-outline" 
                                    bg="#EFF6FF"
                                    color="#2563EB"
                                    active={pathname.includes('/profile')}
                                    onPress={() => navigateTo('/(subscriber)/profile')} 
                                />
                                <DrawerItem 
                                    label="My Beneficiaries" 
                                    icon="people-outline" 
                                    bg="#ECFDF5"
                                    color="#059669"
                                    onPress={() => {
                                        onClose();
                                        setTimeout(() => {
                                            if (pathname === '/' || pathname === '/(subscriber)' || pathname === '/(subscriber)/') {
                                                router.setParams({ highlightBen: Date.now().toString() });
                                            } else {
                                                push(`/(subscriber)?highlightBen=${Date.now()}`);
                                            }
                                        }, 260);
                                    }} 
                                />
                                <DrawerItem 
                                    label="Saathi Companion" 
                                    icon="heart-half-outline" 
                                    bg="#FFF1F2"
                                    color="#E11D48"
                                    active={pathname.includes('/saathi')}
                                    onPress={() => navigateTo('/(subscriber)/saathi')} 
                                />
                                <DrawerItem 
                                    label="Browse Packages" 
                                    icon="sparkles-outline" 
                                    bg="#F5F3FF"
                                    color="#7C3AED"
                                    onPress={() => navigateTo('/(setup)/subscription-packages')} 
                                />
                                <DrawerItem 
                                    label="Order Summary" 
                                    icon="receipt-outline" 
                                    bg="#FFF1F2"
                                    color="#BE123C"
                                    onPress={() => navigateTo('/(subscriber)/order-history')} 
                                />

                                <View style={styles.sectionDivider} />
                                <Text style={styles.sectionLabel}>PREFERENCES</Text>

                                <DrawerItem 
                                    label="Security Settings" 
                                    icon="shield-checkmark-outline" 
                                    bg="#FFFBEB"
                                    color="#D97706"
                                    onPress={() => navigateTo('/(subscriber)/profile')} 
                                />
                                <DrawerItem 
                                    label="Help & Support" 
                                    icon="help-circle-outline" 
                                    bg="#EFF6FF"
                                    color="#2563EB"
                                    onPress={() => {
                                        onClose();
                                        setTimeout(() => {
                                            Alert.alert(
                                                'MaiHoonNa Care Support',
                                                'We are here to assist you with care plans, scheduling, and billing inquiries.\n\n✉️ Email: info@maihoonna.com\n⏱️ Support Hours: Mon–Sat, 9:00 AM – 7:00 PM IST\n📍 Service Hub: Gurugram, Haryana, India',
                                                [
                                                    {
                                                        text: 'Send Email',
                                                        onPress: () => {
                                                            Linking.openURL(`mailto:${LEGAL_CONFIG.SUPPORT_EMAIL}?subject=MaiHoonNa%20Subscriber%20Support`).catch(() => {
                                                                Alert.alert('Help & Support', `Please email us directly at:\n${LEGAL_CONFIG.SUPPORT_EMAIL}`);
                                                            });
                                                        }
                                                    },
                                                    { text: 'Close', style: 'cancel' }
                                                ]
                                            );
                                        }, 300);
                                    }} 
                                />
                                <DrawerItem 
                                    label="Privacy Policy" 
                                    icon="document-text-outline" 
                                    bg="#F0FDFA"
                                    color="#0D9488"
                                    onPress={() => {
                                        onClose();
                                        Linking.openURL(LEGAL_CONFIG.PRIVACY_POLICY_URL).catch(() => {});
                                    }} 
                                />

                                <DrawerItem 
                                    label="Delete Account" 
                                    icon="trash-outline" 
                                    bg="#FEF2F2"
                                    color="#DC2626"
                                    onPress={deleteAccountWithConfirm} 
                                />

                                <View style={styles.sectionDivider} />

                                <DrawerItem 
                                    label="Sign Out" 
                                    icon="log-out-outline" 
                                    bg="#FEF2F2"
                                    color="#EF4444"
                                    showArrow={false}
                                    onPress={() => { onClose(); setTimeout(() => logoutWithConfirm(), 260); }} 
                                />
                            </>
                        ) : (
                            <>
                                <Text style={styles.sectionLabel}>ACCOUNT</Text>
                                <DrawerItem 
                                    label="Sign In" 
                                    icon="log-in-outline" 
                                    bg="#FFF7ED"
                                    color="#F97316"
                                    onPress={() => navigateTo('/(auth)')} 
                                />
                                <DrawerItem 
                                    label="Create Account" 
                                    icon="person-add-outline" 
                                    bg="#ECFDF5"
                                    color="#059669"
                                    onPress={() => navigateTo('/(auth)/register')} 
                                />
                                
                                <View style={styles.sectionDivider} />
                                <Text style={styles.sectionLabel}>SERVICES</Text>

                                <DrawerItem 
                                    label="Browse Packages" 
                                    icon="sparkles-outline" 
                                    bg="#F5F3FF"
                                    color="#7C3AED"
                                    onPress={() => navigateTo('/(setup)/subscription-packages')} 
                                />
                                <DrawerItem 
                                    label="Privacy Policy" 
                                    icon="document-text-outline" 
                                    bg="#F0FDFA"
                                    color="#0D9488"
                                    onPress={() => {
                                        onClose();
                                        Linking.openURL(LEGAL_CONFIG.PRIVACY_POLICY_URL).catch(() => {});
                                    }} 
                                />
                            </>
                        )}
                    </ScrollView>

                    {/* Footer */}
                    <View style={styles.drawerFooter}>
                        <View style={styles.footerBrandRow}>
                            <View style={styles.brandDot} />
                            <Text style={styles.brandText}>Mai-Hoonaa Care</Text>
                        </View>
                        <Text style={styles.versionText}>v1.0.4</Text>
                    </View>
                </View>
            </Animated.View>
        </Modal>
    );
};

const DrawerItem = ({ label, icon, bg, color, active = false, showArrow = true, onPress }: any) => (
    <TouchableOpacity 
        style={[styles.drawerItem, active && styles.drawerItemActive]} 
        onPress={onPress}
        activeOpacity={0.7}
    >
        <View style={[styles.itemIconBox, { backgroundColor: bg || '#F3F4F6' }]}>
            <Ionicons name={icon} size={scale(18)} color={color || '#374151'} />
        </View>
        <Text style={[styles.drawerItemText, active && styles.drawerItemTextActive]}>{label}</Text>
        {showArrow && (
            <Ionicons name="chevron-forward" size={scale(14)} color={active ? '#F97316' : '#D1D5DB'} />
        )}
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    drawerOverlay: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
    },
    drawer: {
        position: 'absolute', right: 0, top: 0, bottom: 0, width: DRAWER_WIDTH,
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 28,
        borderBottomLeftRadius: 28,
        overflow: 'hidden',
        ...Platform.select({
            ios: { shadowColor: '#0F172A', shadowOffset: { width: -8, height: 0 }, shadowOpacity: 0.1, shadowRadius: 20 },
            android: { elevation: 24 },
        }),
    },
    headerContainer: {
        paddingHorizontal: scale(16),
        marginBottom: scale(8),
    },
    headerCard: {
        backgroundColor: '#FAF7F2',
        borderRadius: scale(20),
        padding: scale(16),
        position: 'relative',
        borderWidth: 1,
        borderColor: '#F3EFE6',
    },
    closeBtn: {
        position: 'absolute',
        top: scale(12),
        right: scale(12),
        width: scale(28),
        height: scale(28),
        borderRadius: scale(14),
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    headerProfileRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarImage: {
        width: scale(48),
        height: scale(48),
        borderRadius: scale(24),
        borderWidth: 2,
        borderColor: '#FFFFFF',
        marginRight: scale(12),
    },
    avatarBadge: {
        width: scale(48),
        height: scale(48),
        borderRadius: scale(24),
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: scale(12),
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    avatarText: {
        fontSize: scale(17),
        fontWeight: '800',
        color: '#FFFFFF',
    },
    headerInfo: {
        flex: 1,
        justifyContent: 'center',
        paddingRight: scale(24),
    },
    drawerName: {
        fontSize: scale(16),
        fontWeight: '700',
        color: '#1E293B',
    },
    drawerPhone: {
        fontSize: scale(12),
        color: '#64748B',
        marginTop: scale(2),
    },
    roleBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: scale(8),
        paddingVertical: scale(2),
        borderRadius: scale(8),
        marginTop: scale(6),
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    onlineDot: {
        width: scale(6),
        height: scale(6),
        borderRadius: scale(3),
        backgroundColor: '#10B981',
        marginRight: scale(5),
    },
    roleBadgeText: {
        fontSize: scale(10),
        fontWeight: '600',
        color: '#475569',
    },

    menuScrollView: {
        flex: 1,
    },
    menuScrollContent: {
        paddingVertical: scale(8),
    },
    sectionLabel: {
        fontSize: scale(10),
        fontWeight: '700',
        color: '#94A3B8',
        paddingHorizontal: scale(24),
        marginTop: scale(10),
        marginBottom: scale(6),
        letterSpacing: 1,
    },
    sectionDivider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginHorizontal: scale(24),
        marginVertical: scale(10),
    },
    drawerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: scale(14),
        paddingHorizontal: scale(12),
        paddingVertical: scale(9),
        borderRadius: scale(14),
    },
    drawerItemActive: {
        backgroundColor: '#FFF7ED',
        borderWidth: 1,
        borderColor: '#FFEDD5',
    },
    itemIconBox: {
        width: scale(36),
        height: scale(36),
        borderRadius: scale(12),
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: scale(12),
    },
    drawerItemText: {
        flex: 1,
        fontSize: scale(14),
        fontWeight: '600',
        color: '#334155',
    },
    drawerItemTextActive: {
        color: '#EA580C',
        fontWeight: '700',
    },

    // ── Dual-role Switch Card ─────────────────────────────────────────────────
    switchRoleCard: {
        marginHorizontal: scale(14),
        marginTop: scale(8),
        marginBottom: scale(4),
        borderRadius: scale(14),
        overflow: 'hidden',
    },
    switchRoleGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: scale(14),
        paddingVertical: scale(12),
    },
    switchRoleLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    switchRoleIconBox: {
        width: scale(34),
        height: scale(34),
        borderRadius: scale(10),
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: scale(10),
    },
    switchRoleTitle: {
        fontSize: scale(13),
        fontWeight: '700',
        color: '#FFFFFF',
    },
    switchRoleSub: {
        fontSize: scale(10),
        color: 'rgba(255,255,255,0.8)',
        marginTop: 1,
    },

    drawerFooter: {
        paddingHorizontal: scale(20),
        paddingVertical: scale(14),
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FAF9F6',
    },
    footerBrandRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    brandDot: {
        width: scale(7),
        height: scale(7),
        borderRadius: 3.5,
        backgroundColor: '#F97316',
        marginRight: scale(6),
    },
    brandText: {
        fontSize: scale(12),
        fontWeight: '600',
        color: '#475569',
    },
    versionText: {
        fontSize: scale(11),
        fontWeight: '500',
        color: '#94A3B8',
    },
});

export default GlobalDrawer;
