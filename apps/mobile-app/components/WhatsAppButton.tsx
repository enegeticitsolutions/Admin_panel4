import React, { useState } from 'react';
import {
    TouchableOpacity,
    Text,
    StyleSheet,
    View,
    Alert,
    Linking,
    StyleProp,
    ViewStyle,
    TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface WhatsAppButtonProps {
    phone?: string;
    message?: string;
    label?: string;
    variant?: 'button' | 'icon' | 'floating';
    floating?: boolean;
    showTooltip?: boolean;
    tooltipText?: string;
    subText?: string;
    style?: StyleProp<ViewStyle>;
    textStyle?: StyleProp<TextStyle>;
    iconSize?: number;
    iconColor?: string;
    onPress?: () => void;
}

const DEFAULT_PHONE = '918527070049';
const DEFAULT_MESSAGE = 'Hello! I would like to know more about MaiHoonNa senior care services.';

/**
 * Open WhatsApp via native app scheme or wa.me web link fallback
 */
export const openWhatsApp = async (
    phone: string = DEFAULT_PHONE,
    message: string = DEFAULT_MESSAGE
) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const encodedMessage = encodeURIComponent(message);
    const nativeUrl = `whatsapp://send?phone=${cleanPhone}&text=${encodedMessage}`;
    const webUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

    try {
        const canOpen = await Linking.canOpenURL(nativeUrl);
        if (canOpen) {
            await Linking.openURL(nativeUrl);
            return;
        }

        const canOpenWeb = await Linking.canOpenURL(webUrl);
        if (canOpenWeb) {
            await Linking.openURL(webUrl);
            return;
        }

        Alert.alert(
            'WhatsApp Not Available',
            'Please install WhatsApp to chat with us, or reach us directly at +91 85270 70049.'
        );
    } catch (error) {
        try {
            await Linking.openURL(webUrl);
        } catch (fallbackError) {
            Alert.alert(
                'Error',
                'Could not open WhatsApp. Please reach us directly at +91 85270 70049.'
            );
        }
    }
};

/**
 * WhatsAppButton Component
 * Supports 3 modes:
 *  - 'button' (inline with label, like CallbackButton)
 *  - 'icon' (circular icon for assistance card rows)
 *  - 'floating' (bottom-right FAB with optional popup tooltip speech card)
 */
export const WhatsAppButton: React.FC<WhatsAppButtonProps> = ({
    phone = DEFAULT_PHONE,
    message = DEFAULT_MESSAGE,
    label = 'Chat on WhatsApp',
    variant = 'button',
    floating = false,
    showTooltip = true,
    tooltipText = 'Need help? Chat with us on WhatsApp!',
    subText = 'Typically replies in minutes',
    style,
    textStyle,
    iconSize,
    iconColor,
    onPress,
}) => {
    const [bubbleVisible, setBubbleVisible] = useState(showTooltip);
    const isFloating = floating || variant === 'floating';

    const handlePress = async () => {
        if (onPress) {
            onPress();
        } else {
            await openWhatsApp(phone, message);
        }
    };

    // ── Floating Action Button (FAB) Mode ──
    if (isFloating) {
        return (
            <View style={[styles.floatingWrap, style]} pointerEvents="box-none">
                {bubbleVisible && (
                    <TouchableOpacity
                        style={styles.popupCard}
                        onPress={handlePress}
                        activeOpacity={0.9}
                    >
                        <View style={styles.popupHeader}>
                            <View style={styles.onlineBadge}>
                                <View style={styles.onlineDot} />
                                <Text style={styles.onlineText}>Care Support</Text>
                            </View>
                            <TouchableOpacity
                                onPress={(e) => {
                                    e.stopPropagation();
                                    setBubbleVisible(false);
                                }}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                accessibilityLabel="Dismiss notification"
                            >
                                <Ionicons name="close" size={14} color="#9CA3AF" />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.popupTitle}>{tooltipText}</Text>
                        {subText ? <Text style={styles.popupSub}>{subText}</Text> : null}
                        <View style={styles.popupTail} />
                    </TouchableOpacity>
                )}

                <TouchableOpacity
                    style={styles.floatingBtn}
                    onPress={handlePress}
                    activeOpacity={0.85}
                    accessibilityLabel="Chat with us on WhatsApp"
                    accessibilityRole="button"
                >
                    <Ionicons name="logo-whatsapp" size={iconSize || 30} color={iconColor || '#FFFFFF'} />
                </TouchableOpacity>
            </View>
        );
    }

    // ── Circular Icon Button Mode ──
    if (variant === 'icon') {
        return (
            <TouchableOpacity
                style={[styles.iconButton, style]}
                onPress={handlePress}
                activeOpacity={0.8}
                accessibilityLabel="Chat on WhatsApp"
                accessibilityRole="button"
            >
                <Ionicons
                    name="logo-whatsapp"
                    size={iconSize || 24}
                    color={iconColor || '#25D366'}
                />
            </TouchableOpacity>
        );
    }

    // ── Inline Button Mode (matches CallbackButton style) ──
    return (
        <TouchableOpacity
            style={[styles.button, style]}
            onPress={handlePress}
            activeOpacity={0.8}
            accessibilityLabel={label}
            accessibilityRole="button"
        >
            <Ionicons
                name="logo-whatsapp"
                size={iconSize || 18}
                color={iconColor || '#25D366'}
                style={{ marginRight: 8 }}
            />
            <Text style={[styles.buttonText, textStyle]}>{label}</Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    // Inline Trigger Button
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 12,
        backgroundColor: '#F0FDF4',
        borderWidth: 1,
        borderColor: '#DCFCE7',
    },
    buttonText: {
        color: '#15803D',
        fontWeight: '600',
        fontSize: 15,
    },

    // Circular Icon Button
    iconButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F0FDF4',
        borderWidth: 1,
        borderColor: '#DCFCE7',
    },

    // Floating FAB Container
    floatingWrap: {
        position: 'absolute',
        bottom: 24,
        right: 20,
        alignItems: 'flex-end',
        zIndex: 999,
        elevation: 10,
    },
    floatingBtn: {
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: '#25D366',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#25D366',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.38,
        shadowRadius: 8,
        elevation: 8,
    },

    // Popup Speech Balloon
    popupCard: {
        width: 230,
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
        elevation: 6,
    },
    popupHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    onlineBadge: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    onlineDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: '#25D366',
        marginRight: 5,
    },
    onlineText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#128C7E',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    popupTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1F2937',
        lineHeight: 18,
    },
    popupSub: {
        fontSize: 11,
        color: '#6B7280',
        marginTop: 2,
    },
    popupTail: {
        position: 'absolute',
        bottom: -5,
        right: 22,
        width: 10,
        height: 10,
        backgroundColor: '#FFFFFF',
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#E2E8F0',
        transform: [{ rotate: '45deg' }],
    },
});

export default WhatsAppButton;
