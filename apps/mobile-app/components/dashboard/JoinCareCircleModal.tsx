import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '@/services/api';

interface JoinCareCircleModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const JoinCareCircleModal: React.FC<JoinCareCircleModalProps> = ({
    visible,
    onClose,
    onSuccess,
}) => {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);

    const handleJoin = async () => {
        const cleanCode = code.trim().toUpperCase();
        if (!cleanCode) {
            Alert.alert('Required', 'Please enter a Care Circle invite code.');
            return;
        }

        setLoading(true);
        try {
            const res = await api.post('/subscriber/care-circle/join', {
                inviteCode: cleanCode,
            });

            if (res.data?.success) {
                const benName = res.data.data?.beneficiaryName || 'your family member';
                Alert.alert(
                    'Connected!',
                    `You are now connected to ${benName}'s Care Circle. You can view visits and monitor health together.`,
                    [
                        {
                            text: 'OK',
                            onPress: () => {
                                setCode('');
                                onClose();
                                onSuccess();
                            },
                        },
                    ]
                );
            } else {
                Alert.alert('Join Failed', res.data?.message || 'Invalid invite code.');
            }
        } catch (err: any) {
            const msg = err.response?.data?.message || err.message || 'Failed to join Care Circle.';
            Alert.alert('Unable to Join', msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.dialog}>
                    <View style={styles.iconCircle}>
                        <Ionicons name="key-outline" size={26} color="#FE6700" />
                    </View>

                    <Text style={styles.title}>Join Family Care Circle</Text>
                    <Text style={styles.subtitle}>
                        Enter the 8-character invite code shared by your family member (e.g., CC-482910).
                    </Text>

                    <TextInput
                        style={styles.input}
                        placeholder="CC-XXXXXX"
                        placeholderTextColor="#9CA3AF"
                        value={code}
                        onChangeText={setCode}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        maxLength={12}
                    />

                    <View style={styles.btnRow}>
                        <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={loading}>
                            <Text style={styles.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.joinBtn, loading && styles.joinBtnDisabled]}
                            onPress={handleJoin}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <Text style={styles.joinBtnText}>Join Circle</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    dialog: {
        width: '100%',
        maxWidth: 380,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
    },
    iconCircle: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#FFF5ED',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    title: {
        fontSize: 18,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 6,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 13,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 18,
        marginBottom: 18,
    },
    input: {
        width: '100%',
        borderWidth: 1.5,
        borderColor: '#D1D5DB',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        textAlign: 'center',
        letterSpacing: 2,
        marginBottom: 20,
        backgroundColor: '#F9FAFB',
    },
    btnRow: {
        flexDirection: 'row',
        width: '100%',
        gap: 12,
    },
    cancelBtn: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 10,
        backgroundColor: '#F3F4F6',
    },
    cancelBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4B5563',
    },
    joinBtn: {
        flex: 1.5,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 10,
        backgroundColor: '#FE6700',
    },
    joinBtnDisabled: {
        opacity: 0.6,
    },
    joinBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});
