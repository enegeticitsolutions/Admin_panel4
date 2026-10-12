import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TouchableWithoutFeedback,
    Platform,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface CouponSuccessModalProps {
    visible: boolean;
    couponCode: string;
    savedAmount: number;
    isSaathi?: boolean;
    onClose: () => void;
}

export const CouponSuccessModal: React.FC<CouponSuccessModalProps> = ({
    visible,
    couponCode,
    savedAmount,
    isSaathi = false,
    onClose,
}) => {
    if (!visible) return null;

    const theme = isSaathi
        ? {
              primary: '#FE6700',
              accent: '#EA580C',
              dark: '#C2410C',
              lightBg: '#FFF7ED',
              cardBg: '#FFF5ED',
              border: '#FED7AA',
              badgeBorder: '#FDBA74',
              title: 'Saathi Coupon Applied!',
              iconName: 'gift' as const,
              subtext: 'Your Saathi reward discount has been applied.',
          }
        : {
              primary: '#10B981',
              accent: '#059669',
              dark: '#047857',
              lightBg: '#ECFDF5',
              cardBg: '#F0FDF4',
              border: '#BBF7D0',
              badgeBorder: '#A7F3D0',
              title: 'Coupon Applied!',
              iconName: 'checkmark-circle' as const,
              subtext: 'Promo code discount has been applied.',
          };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <View style={styles.card}>
                            {/* Close button in top right */}
                            <TouchableOpacity
                                style={styles.closeBtn}
                                onPress={onClose}
                                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="close" size={20} color="#94A3B8" />
                            </TouchableOpacity>

                            {/* Circular Celebration Ring */}
                            <View
                                style={[
                                    styles.iconOuterRing,
                                    {
                                        backgroundColor: theme.lightBg,
                                        borderColor: theme.badgeBorder,
                                    },
                                ]}
                            >
                                <View
                                    style={[
                                        styles.iconInnerCircle,
                                        { backgroundColor: theme.primary },
                                    ]}
                                >
                                    <Ionicons
                                        name={theme.iconName}
                                        size={32}
                                        color="#FFFFFF"
                                    />
                                </View>

                                {/* Decorative Sparkle Badge */}
                                <View style={styles.sparkleBadge}>
                                    <Ionicons name="sparkles" size={14} color="#F59E0B" />
                                </View>
                            </View>

                            {/* Headline */}
                            <Text style={styles.title}>{theme.title}</Text>

                            {/* Coupon Code Pill */}
                            <View
                                style={[
                                    styles.couponPill,
                                    {
                                        backgroundColor: theme.lightBg,
                                        borderColor: theme.border,
                                    },
                                ]}
                            >
                                <Ionicons
                                    name="pricetag"
                                    size={13}
                                    color={theme.accent}
                                    style={{ marginRight: 6 }}
                                />
                                <Text
                                    style={[
                                        styles.couponPillText,
                                        { color: theme.dark },
                                    ]}
                                >
                                    {couponCode ? couponCode.toUpperCase() : 'COUPON'}
                                </Text>
                            </View>

                            {/* Savings Highlight Box */}
                            <View
                                style={[
                                    styles.savingsCard,
                                    {
                                        backgroundColor: theme.cardBg,
                                        borderColor: theme.border,
                                    },
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.savingsLabel,
                                        { color: theme.accent },
                                    ]}
                                >
                                    TOTAL SAVINGS
                                </Text>
                                <Text
                                    style={[
                                        styles.savingsAmount,
                                        { color: theme.dark },
                                    ]}
                                >
                                    ₹{Number(savedAmount || 0).toFixed(2)}
                                </Text>
                                <Text style={styles.savingsSubtext}>
                                    {theme.subtext}
                                </Text>
                            </View>

                            {/* Primary Action Button */}
                            <TouchableOpacity
                                style={styles.actionBtn}
                                onPress={onClose}
                                activeOpacity={0.85}
                            >
                                <Text style={styles.actionBtnText}>Awesome!</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

const { width } = Dimensions.get('window');
const cardWidth = Math.min(width - 48, 360);

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    card: {
        width: cardWidth,
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        paddingHorizontal: 22,
        paddingTop: 28,
        paddingBottom: 22,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F1F5F9',
        ...Platform.select({
            ios: {
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 12 },
                shadowOpacity: 0.16,
                shadowRadius: 24,
            },
            android: {
                elevation: 10,
            },
            default: {
                boxShadow: '0 12px 30px rgba(0, 0, 0, 0.16)',
            },
        }),
    },
    closeBtn: {
        position: 'absolute',
        top: 16,
        right: 16,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconOuterRing: {
        width: 72,
        height: 72,
        borderRadius: 36,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        position: 'relative',
    },
    iconInnerCircle: {
        width: 52,
        height: 52,
        borderRadius: 26,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sparkleBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#FEF3C7',
        borderWidth: 1.5,
        borderColor: '#FDE68A',
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 20,
        fontFamily: Platform.select({
            ios: 'Poppins-Bold',
            android: 'Poppins_700Bold',
            default: 'sans-serif',
        }),
        fontWeight: '700',
        color: '#0F172A',
        textAlign: 'center',
        marginBottom: 8,
    },
    couponPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
        borderWidth: 1,
        marginBottom: 16,
    },
    couponPillText: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.8,
        fontFamily: Platform.select({
            ios: 'Poppins-SemiBold',
            android: 'Poppins_600SemiBold',
            default: 'sans-serif',
        }),
    },
    savingsCard: {
        width: '100%',
        borderRadius: 16,
        borderWidth: 1.5,
        paddingVertical: 14,
        paddingHorizontal: 16,
        alignItems: 'center',
        marginBottom: 20,
    },
    savingsLabel: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1.2,
        marginBottom: 2,
        fontFamily: Platform.select({
            ios: 'Poppins-SemiBold',
            android: 'Poppins_600SemiBold',
            default: 'sans-serif',
        }),
    },
    savingsAmount: {
        fontSize: 28,
        fontWeight: '800',
        fontFamily: Platform.select({
            ios: 'Poppins-Bold',
            android: 'Poppins_700Bold',
            default: 'sans-serif',
        }),
        marginVertical: 2,
    },
    savingsSubtext: {
        fontSize: 12,
        color: '#64748B',
        textAlign: 'center',
        marginTop: 2,
        fontFamily: Platform.select({
            ios: 'Poppins-Regular',
            android: 'Poppins_400Regular',
            default: 'sans-serif',
        }),
    },
    actionBtn: {
        width: '100%',
        height: 48,
        borderRadius: 14,
        backgroundColor: '#FE6700',
        justifyContent: 'center',
        alignItems: 'center',
        ...Platform.select({
            ios: {
                shadowColor: '#FE6700',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.25,
                shadowRadius: 8,
            },
            android: {
                elevation: 3,
            },
        }),
    },
    actionBtnText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: 0.3,
        fontFamily: Platform.select({
            ios: 'Poppins-SemiBold',
            android: 'Poppins_600SemiBold',
            default: 'sans-serif',
        }),
    },
});

export default CouponSuccessModal;
