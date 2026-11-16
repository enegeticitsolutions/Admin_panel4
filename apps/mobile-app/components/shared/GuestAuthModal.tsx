import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TouchableWithoutFeedback,
    Platform,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

interface GuestAuthModalProps {
    visible: boolean;
    reason?: string | null;
    onClose: () => void;
}

export function GuestAuthModal({ visible, reason, onClose }: GuestAuthModalProps) {
    if (!visible) return null;

    const handleCreateAccount = () => {
        onClose();
        router.push('/(auth)/register');
    };

    const handleSignIn = () => {
        onClose();
        router.push('/(auth)');
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            statusBarTranslucent={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <TouchableWithoutFeedback onPress={onClose}>
                    <View style={styles.modalBackdrop} />
                </TouchableWithoutFeedback>

                <View style={styles.modalSheet}>
                    <View style={styles.modalHandle} />

                    <View style={styles.headerRow}>
                        <View style={styles.iconWrap}>
                            <MaterialCommunityIcons name="shield-account" size={28} color="#FF6A00" />
                        </View>
                        <TouchableOpacity
                            onPress={onClose}
                            style={styles.closeBtn}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Feather name="x" size={18} color="#6B7280" />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.title}>Create Your Free Account</Text>
                    <Text style={styles.subtitle}>
                        {reason || 'Sign in or create a free account to access vital health tracking, book care services, and unlock personalized support.'}
                    </Text>

                    {/* Value Points */}
                    <View style={styles.featureBox}>
                        <View style={styles.featureRow}>
                            <Feather name="check-circle" size={16} color="#10B981" />
                            <Text style={styles.featureText}>Free daily vitals monitoring & history</Text>
                        </View>
                        <View style={styles.featureRow}>
                            <Feather name="check-circle" size={16} color="#10B981" />
                            <Text style={styles.featureText}>Verified Saathi companion requests</Text>
                        </View>
                        <View style={styles.featureRow}>
                            <Feather name="check-circle" size={16} color="#10B981" />
                            <Text style={styles.featureText}>Interactive community health workshops</Text>
                        </View>
                        <View style={styles.featureRow}>
                            <Feather name="check-circle" size={16} color="#10B981" />
                            <Text style={styles.featureText}>24/7 emergency care assistance</Text>
                        </View>
                    </View>

                    {/* Action Buttons */}
                    <TouchableOpacity
                        style={styles.primaryBtn}
                        onPress={handleCreateAccount}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.primaryBtnText}>Create Free Account</Text>
                        <Feather name="arrow-right" size={16} color="#FFFFFF" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.secondaryBtn}
                        onPress={handleSignIn}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.secondaryBtnText}>Already have an account? <Text style={styles.secondaryBtnHighlight}>Sign In</Text></Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.cancelBtn}
                        onPress={onClose}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.cancelBtnText}>Continue Exploring as Guest</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
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
        paddingHorizontal: 24,
        paddingTop: 12,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
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
        marginBottom: 16,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    iconWrap: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#FFF7ED',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#FFEDD5',
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 20,
        fontFamily: 'Poppins-Bold',
        color: '#111827',
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 13,
        fontFamily: 'Poppins-Regular',
        color: '#6B7280',
        lineHeight: 19,
        marginBottom: 18,
    },
    featureBox: {
        backgroundColor: '#F9FAFB',
        borderRadius: 14,
        padding: 14,
        gap: 10,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    featureText: {
        fontSize: 13,
        fontFamily: 'Poppins-Medium',
        color: '#374151',
    },
    primaryBtn: {
        backgroundColor: '#FF6A00',
        borderRadius: 14,
        height: 52,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 12,
        shadowColor: '#FF6A00',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 3,
    },
    primaryBtnText: {
        fontSize: 15,
        fontFamily: 'Poppins-SemiBold',
        color: '#FFFFFF',
    },
    secondaryBtn: {
        alignItems: 'center',
        paddingVertical: 8,
        marginBottom: 6,
    },
    secondaryBtnText: {
        fontSize: 13,
        fontFamily: 'Poppins-Regular',
        color: '#6B7280',
    },
    secondaryBtnHighlight: {
        fontFamily: 'Poppins-SemiBold',
        color: '#FF6A00',
    },
    cancelBtn: {
        alignItems: 'center',
        paddingVertical: 8,
    },
    cancelBtnText: {
        fontSize: 12,
        fontFamily: 'Poppins-Medium',
        color: '#9CA3AF',
    },
});
