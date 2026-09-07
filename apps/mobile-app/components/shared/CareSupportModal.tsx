import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Animated,
    Linking,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { LEGAL_CONFIG } from '@/constants/legal';
import { scale } from '@/utils/responsive';

interface CareSupportModalProps {
    visible: boolean;
    onClose: () => void;
    /** Optional: customise the email subject line */
    emailSubject?: string;
}

const CareSupportModal: React.FC<CareSupportModalProps> = ({
    visible,
    onClose,
    emailSubject = 'MaiHoonNa App Support',
}) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(40)).current;
    const scaleAnim = useRef(new Animated.Value(0.92)).current;

    useEffect(() => {
        if (visible) {
            fadeAnim.setValue(0);
            slideAnim.setValue(40);
            scaleAnim.setValue(0.92);
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 280,
                    useNativeDriver: true,
                }),
                Animated.spring(slideAnim, {
                    toValue: 0,
                    damping: 20,
                    stiffness: 260,
                    useNativeDriver: true,
                }),
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    damping: 18,
                    stiffness: 240,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visible]);

    const handleClose = () => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 180,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 30,
                duration: 180,
                useNativeDriver: true,
            }),
        ]).start(() => onClose());
    };

    const handleSendEmail = () => {
        const mailUrl = `mailto:${LEGAL_CONFIG.SUPPORT_EMAIL}?subject=${encodeURIComponent(emailSubject)}`;
        Linking.openURL(mailUrl).catch(() => {
            // Fallback – just close; user can copy the address
        });
        handleClose();
    };

    const handleCall = () => {
        Linking.openURL('tel:+919999999999').catch(() => {});
    };

    const INFO_ROWS: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; color: string }[] = [
        { icon: 'mail-outline', label: 'Email', value: 'info@maihoonna.com', color: '#F97316' },
        { icon: 'time-outline', label: 'Hours', value: 'Mon–Sat, 9 AM – 7 PM IST', color: '#3B82F6' },
        { icon: 'location-outline', label: 'Hub', value: 'Gurugram, Haryana, India', color: '#10B981' },
    ];

    return (
        <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={handleClose}>
            <View style={styles.backdrop}>
                {/* Tap outside to close */}
                <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleClose} />

                <Animated.View
                    style={[
                        styles.card,
                        {
                            opacity: fadeAnim,
                            transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
                        },
                    ]}
                >
                    {/* ── Gradient Header ─────────────────────────────── */}
                    <LinearGradient
                        colors={['#FF8C42', '#F97316', '#EA580C']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.header}
                    >
                        {/* Close button */}
                        <TouchableOpacity
                            style={styles.closeBtn}
                            onPress={handleClose}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        >
                            <Ionicons name="close" size={scale(16)} color="#FFFFFF" />
                        </TouchableOpacity>

                        {/* Icon circle */}
                        <View style={styles.headerIconCircle}>
                            <Ionicons name="headset-outline" size={scale(26)} color="#F97316" />
                        </View>

                        <Text style={styles.headerTitle}>Care Support</Text>
                        <Text style={styles.headerSubtitle}>
                            We're here to help with care plans,{'\n'}scheduling & billing inquiries
                        </Text>
                    </LinearGradient>

                    {/* ── Info Rows ───────────────────────────────────── */}
                    <View style={styles.body}>
                        {INFO_ROWS.map((row, idx) => (
                            <View key={row.label} style={[styles.infoRow, idx < INFO_ROWS.length - 1 && styles.infoRowBorder]}>
                                <View style={[styles.infoIconBox, { backgroundColor: row.color + '14' }]}>
                                    <Ionicons name={row.icon as any} size={scale(17)} color={row.color} />
                                </View>
                                <View style={styles.infoContent}>
                                    <Text style={styles.infoLabel}>{row.label}</Text>
                                    <Text style={styles.infoValue}>{row.value}</Text>
                                </View>
                            </View>
                        ))}
                    </View>

                    {/* ── Action Buttons ──────────────────────────────── */}
                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.emailBtn} onPress={handleSendEmail} activeOpacity={0.85}>
                            <LinearGradient
                                colors={['#F97316', '#EA580C']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.emailBtnGradient}
                            >
                                <Ionicons name="mail-outline" size={scale(16)} color="#FFF" style={{ marginRight: scale(6) }} />
                                <Text style={styles.emailBtnText}>Send Email</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.closeTextBtn} onPress={handleClose} activeOpacity={0.7}>
                            <Text style={styles.closeTextBtnLabel}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

/* ── Styles ────────────────────────────────────────────────── */
const CARD_RADIUS = scale(24);

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: scale(24),
    },
    card: {
        width: '100%',
        maxWidth: 400,
        borderRadius: CARD_RADIUS,
        backgroundColor: '#FFFFFF',
        overflow: 'hidden',
        ...Platform.select({
            ios: {
                shadowColor: '#0F172A',
                shadowOffset: { width: 0, height: 12 },
                shadowOpacity: 0.18,
                shadowRadius: 28,
            },
            android: { elevation: 28 },
        }),
    },

    /* Header */
    header: {
        paddingTop: scale(28),
        paddingBottom: scale(22),
        paddingHorizontal: scale(24),
        alignItems: 'center',
        position: 'relative',
    },
    closeBtn: {
        position: 'absolute',
        top: scale(14),
        right: scale(14),
        width: scale(28),
        height: scale(28),
        borderRadius: scale(14),
        backgroundColor: 'rgba(255,255,255,0.22)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    headerIconCircle: {
        width: scale(54),
        height: scale(54),
        borderRadius: scale(27),
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: scale(12),
        ...Platform.select({
            ios: {
                shadowColor: '#EA580C',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.18,
                shadowRadius: 10,
            },
            android: { elevation: 6 },
        }),
    },
    headerTitle: {
        fontSize: scale(19),
        fontWeight: '800',
        color: '#FFFFFF',
        marginBottom: scale(6),
        letterSpacing: 0.3,
    },
    headerSubtitle: {
        fontSize: scale(12),
        fontWeight: '500',
        color: 'rgba(255,255,255,0.88)',
        textAlign: 'center',
        lineHeight: scale(17),
    },

    /* Body – info rows */
    body: {
        paddingHorizontal: scale(20),
        paddingTop: scale(18),
        paddingBottom: scale(6),
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: scale(12),
    },
    infoRowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    infoIconBox: {
        width: scale(38),
        height: scale(38),
        borderRadius: scale(12),
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: scale(14),
    },
    infoContent: {
        flex: 1,
    },
    infoLabel: {
        fontSize: scale(10),
        fontWeight: '700',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginBottom: scale(2),
    },
    infoValue: {
        fontSize: scale(13.5),
        fontWeight: '600',
        color: '#1E293B',
    },

    /* Footer */
    footer: {
        paddingHorizontal: scale(20),
        paddingTop: scale(8),
        paddingBottom: scale(20),
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(10),
    },
    emailBtn: {
        flex: 1,
        borderRadius: scale(14),
        overflow: 'hidden',
    },
    emailBtnGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: scale(13),
        borderRadius: scale(14),
    },
    emailBtnText: {
        fontSize: scale(14),
        fontWeight: '700',
        color: '#FFFFFF',
    },
    closeTextBtn: {
        paddingVertical: scale(13),
        paddingHorizontal: scale(20),
        borderRadius: scale(14),
        backgroundColor: '#F1F5F9',
    },
    closeTextBtnLabel: {
        fontSize: scale(14),
        fontWeight: '600',
        color: '#64748B',
    },
});

export default CareSupportModal;
