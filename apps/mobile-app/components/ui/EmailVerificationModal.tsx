import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Modal,
    Alert,
    useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/api';

interface EmailVerificationModalProps {
    visible: boolean;
    initialEmail?: string;
    onClose: () => void;
    onSuccess: (verifiedEmail: string) => void;
    accentColor?: string;
}

export function EmailVerificationModal({
    visible,
    initialEmail = '',
    onClose,
    onSuccess,
    accentColor = '#FE6700',
}: EmailVerificationModalProps) {
    const { width } = useWindowDimensions();
    const contentWidth = Math.min(Math.max(width - 40, 0), 400);

    const [emailInput, setEmailInput] = useState(initialEmail);
    const [otpInput, setOtpInput] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [sendingOtp, setSendingOtp] = useState(false);
    const [verifyingOtp, setVerifyingOtp] = useState(false);
    const [status, setStatus] = useState({ message: '', isError: false });

    useEffect(() => {
        if (visible) {
            setEmailInput(initialEmail === '--' || initialEmail === 'Not provided' || initialEmail === 'Not specified' ? '' : initialEmail);
            setOtpInput('');
            setOtpSent(false);
            setStatus({ message: '', isError: false });
        }
    }, [visible, initialEmail]);

    const handleSendEmailOtp = async () => {
        const cleanEmail = emailInput.trim();
        if (!cleanEmail || !cleanEmail.includes('@')) {
            setStatus({ message: 'Please enter a valid email address', isError: true });
            return;
        }

        setSendingOtp(true);
        setStatus({ message: '', isError: false });

        try {
            const token = await AsyncStorage.getItem('userToken');
            const res = await fetch(`${API_URL}/auth/send-email-otp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ email: cleanEmail }),
            });

            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || 'Failed to send verification code');
            }

            setOtpSent(true);
            setStatus({ message: json.message || 'Verification code sent to your email address!', isError: false });
        } catch (err: any) {
            setStatus({ message: err.message || 'Failed to send verification code', isError: true });
        } finally {
            setSendingOtp(false);
        }
    };

    const handleVerifyEmailOtp = async () => {
        const cleanOtp = otpInput.trim();
        if (!cleanOtp || cleanOtp.length < 4) {
            setStatus({ message: 'Please enter the 6-digit verification code', isError: true });
            return;
        }

        setVerifyingOtp(true);
        setStatus({ message: '', isError: false });

        try {
            const token = await AsyncStorage.getItem('userToken');
            const res = await fetch(`${API_URL}/auth/verify-email-otp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    email: emailInput.trim(),
                    otp: cleanOtp,
                }),
            });

            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || 'Invalid verification code');
            }

            Alert.alert('Email Verified', 'Your email address has been verified successfully!');
            onSuccess(emailInput.trim());
            onClose();
        } catch (err: any) {
            setStatus({ message: err.message || 'Failed to verify code', isError: true });
        } finally {
            setVerifyingOtp(false);
        }
    };

    return (
        <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
            <View style={styles.modalBackdrop}>
                <View style={[styles.modalCard, { width: contentWidth }]}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Verify Email Address</Text>
                        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Feather name="x" size={22} color="#4B5563" />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.subtext}>
                        We will send a 6-digit verification code to your email address to confirm ownership.
                    </Text>

                    <Text style={styles.inputLabel}>Email Address</Text>
                    <TextInput
                        style={styles.textInput}
                        value={emailInput}
                        onChangeText={setEmailInput}
                        placeholder="Enter your email address"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        editable={!otpSent}
                    />

                    {status.message ? (
                        <Text style={[styles.statusText, status.isError ? styles.errorStatus : styles.successStatus]}>
                            {status.message}
                        </Text>
                    ) : null}

                    {!otpSent ? (
                        <TouchableOpacity
                            style={[styles.saveBtn, { backgroundColor: accentColor }, sendingOtp && { opacity: 0.7 }]}
                            onPress={handleSendEmailOtp}
                            disabled={sendingOtp}
                            activeOpacity={0.8}
                        >
                            {sendingOtp ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <Text style={styles.saveBtnText}>Send Verification Code</Text>
                            )}
                        </TouchableOpacity>
                    ) : (
                        <>
                            <Text style={[styles.inputLabel, { marginTop: 10 }]}>Enter 6-Digit Verification Code</Text>
                            <TextInput
                                style={[styles.textInput, styles.otpInputStyle, { color: accentColor }]}
                                value={otpInput}
                                onChangeText={setOtpInput}
                                placeholder="• • • • • •"
                                keyboardType="number-pad"
                                maxLength={6}
                                autoFocus
                            />

                            <TouchableOpacity
                                style={[styles.saveBtn, { backgroundColor: accentColor }, verifyingOtp && { opacity: 0.7 }]}
                                onPress={handleVerifyEmailOtp}
                                disabled={verifyingOtp}
                                activeOpacity={0.8}
                            >
                                {verifyingOtp ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Text style={styles.saveBtnText}>Verify & Save Email</Text>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={{ marginTop: 12, alignItems: 'center' }}
                                onPress={handleSendEmailOtp}
                                disabled={sendingOtp}
                            >
                                <Text style={{ fontFamily: 'Poppins-Medium', fontSize: 13, color: accentColor }}>
                                    Resend Code
                                </Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    modalCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 22,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    modalTitle: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 17,
        color: '#111827',
    },
    subtext: {
        fontFamily: 'Poppins-Regular',
        fontSize: 13,
        color: '#4B5563',
        marginBottom: 15,
    },
    inputLabel: {
        fontFamily: 'Poppins-Medium',
        fontSize: 13,
        color: '#374151',
        marginBottom: 6,
    },
    textInput: {
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontFamily: 'Poppins-Regular',
        fontSize: 14,
        color: '#111827',
        marginBottom: 14,
    },
    otpInputStyle: {
        textAlign: 'center',
        fontSize: 22,
        letterSpacing: 6,
        fontFamily: 'Poppins-Bold',
    },
    statusText: {
        fontFamily: 'Poppins-Medium',
        fontSize: 13,
        marginBottom: 14,
        textAlign: 'center',
    },
    errorStatus: {
        color: '#EF4444',
    },
    successStatus: {
        color: '#16A34A',
    },
    saveBtn: {
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 6,
    },
    saveBtnText: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 15,
        color: '#FFFFFF',
    },
});
