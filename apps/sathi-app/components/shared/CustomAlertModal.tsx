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
import { Ionicons } from '@expo/vector-icons';

export type AlertType = 'warning' | 'error' | 'success' | 'info';

export interface CustomAlertModalProps {
    visible: boolean;
    title: string;
    message: string;
    type?: AlertType;
    primaryText?: string;
    onPrimary?: () => void;
    secondaryText?: string;
    onSecondary?: () => void;
    onClose?: () => void;
}

export const CustomAlertModal: React.FC<CustomAlertModalProps> = ({
    visible,
    title,
    message,
    type = 'info',
    primaryText = 'OK',
    onPrimary,
    secondaryText,
    onSecondary,
    onClose,
}) => {
    const handleClose = () => {
        if (onClose) {
            onClose();
        } else if (onPrimary) {
            onPrimary();
        }
    };

    const getIconDetails = () => {
        switch (type) {
            case 'warning':
                return {
                    name: 'alert-circle' as const,
                    color: '#EA580C',
                    bgColor: '#FFF7ED',
                    borderColor: '#FED7AA',
                };
            case 'error':
                return {
                    name: 'close-circle' as const,
                    color: '#DC2626',
                    bgColor: '#FEF2F2',
                    borderColor: '#FECACA',
                };
            case 'success':
                return {
                    name: 'checkmark-circle' as const,
                    color: '#16A34A',
                    bgColor: '#F0FDF4',
                    borderColor: '#BBF7D0',
                };
            case 'info':
            default:
                return {
                    name: 'information-circle' as const,
                    color: '#2563EB',
                    bgColor: '#EFF6FF',
                    borderColor: '#BFDBFE',
                };
        }
    };

    const iconDetails = getIconDetails();

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={handleClose}
        >
            <TouchableWithoutFeedback onPress={handleClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <View style={styles.card}>
                            {/* Close button in top right */}
                            <TouchableOpacity
                                style={styles.closeBtn}
                                onPress={handleClose}
                                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                            >
                                <Ionicons name="close" size={20} color="#9CA3AF" />
                            </TouchableOpacity>

                            {/* Circular Icon Badge */}
                            <View
                                style={[
                                    styles.iconBadge,
                                    {
                                        backgroundColor: iconDetails.bgColor,
                                        borderColor: iconDetails.borderColor,
                                    },
                                ]}
                            >
                                <Ionicons name={iconDetails.name} size={34} color={iconDetails.color} />
                            </View>

                            {/* Title */}
                            <Text style={styles.title}>{title}</Text>

                            {/* Message */}
                            <Text style={styles.message}>{message}</Text>

                            {/* Action Buttons */}
                            <View style={styles.buttonRow}>
                                {secondaryText && (
                                    <TouchableOpacity
                                        style={styles.secondaryBtn}
                                        onPress={onSecondary || handleClose}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={styles.secondaryBtnText}>{secondaryText}</Text>
                                    </TouchableOpacity>
                                )}

                                <TouchableOpacity
                                    style={[
                                        styles.primaryBtn,
                                        secondaryText ? { flex: 1 } : { width: '100%' },
                                    ]}
                                    onPress={onPrimary || handleClose}
                                    activeOpacity={0.85}
                                >
                                    <Text style={styles.primaryBtnText}>{primaryText}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    card: {
        width: '100%',
        maxWidth: 350,
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        paddingHorizontal: 22,
        paddingTop: 28,
        paddingBottom: 22,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F3F4F6',
        ...Platform.select({
            ios: {
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.18,
                shadowRadius: 20,
            },
            android: {
                elevation: 12,
            },
            default: {
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
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
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconBadge: {
        width: 68,
        height: 68,
        borderRadius: 34,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 18,
        fontFamily: Platform.select({ ios: 'Poppins-SemiBold', android: 'Poppins-Medium', default: 'sans-serif' }),
        fontWeight: '700',
        color: '#111827',
        textAlign: 'center',
        marginBottom: 8,
        paddingHorizontal: 10,
    },
    message: {
        fontSize: 14,
        lineHeight: 22,
        color: '#4B5563',
        textAlign: 'center',
        marginBottom: 24,
        paddingHorizontal: 6,
    },
    buttonRow: {
        flexDirection: 'row',
        width: '100%',
        gap: 12,
    },
    secondaryBtn: {
        flex: 1,
        height: 48,
        borderRadius: 14,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    secondaryBtnText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#4B5563',
    },
    primaryBtn: {
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
    primaryBtnText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: 0.3,
    },
});

export default CustomAlertModal;
