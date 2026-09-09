import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Image, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { sanitizeImageUri } from '@/utils/sanitizeImageUri';

interface ConnectContactButtonProps {
    name: string;
    role: string;
    phone: string | null;
    photo?: string | null;
    trigger?: React.ReactNode; // Custom trigger, e.g. a Care Team card button
}

export const ConnectContactButton = ({ name, role, phone, photo, trigger }: ConnectContactButtonProps) => {
    const [visible, setVisible] = useState(false);

    const handleCall = () => {
        if (phone) {
            Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`);
        }
        setVisible(false);
    };

    const renderDefaultTrigger = () => (
        <TouchableOpacity style={styles.phoneButton} onPress={() => setVisible(true)}>
            <Ionicons name="call-outline" size={16} color="#F97316" />
        </TouchableOpacity>
    );

    return (
        <>
            {/* Render trigger */}
            {trigger ? (
                <TouchableOpacity onPress={() => setVisible(true)} activeOpacity={0.7}>
                    {trigger}
                </TouchableOpacity>
            ) : (
                renderDefaultTrigger()
            )}

            {/* Premium Call Popup Modal */}
            <Modal
                visible={visible}
                transparent
                animationType="fade"
                onRequestClose={() => setVisible(false)}
            >
                <View style={styles.overlay}>
                    <TouchableOpacity 
                        style={styles.backdrop} 
                        activeOpacity={1} 
                        onPress={() => setVisible(false)} 
                    />
                    
                    <View style={styles.modalCard}>
                        {/* Close button in top right */}
                        <TouchableOpacity style={styles.closeBtn} onPress={() => setVisible(false)}>
                            <Ionicons name="close" size={20} color="#6B7280" />
                        </TouchableOpacity>

                        {/* Profile Photo / Avatar */}
                        <View style={styles.avatarWrap}>
                            {photo ? (
                                <Image source={{ uri: sanitizeImageUri(photo) }} style={styles.avatarImage} />
                            ) : (

                                <View style={styles.avatarPlaceholder}>
                                    <Ionicons name="person" size={32} color="#9CA3AF" />
                                </View>
                            )}
                        </View>

                        {/* Title Role Tag */}
                        <Text style={styles.roleTag}>CALL {role.toUpperCase()}</Text>

                        {/* Name */}
                        <Text style={styles.nameText}>{name}</Text>

                        {/* Helper info text */}
                        <Text style={styles.infoText}>
                            Get in touch directly with {name} for updates, assistance, or scheduling support.
                        </Text>

                        {/* Phone Number Display Box */}
                        <View style={styles.phoneBox}>
                            <Ionicons name="call" size={18} color="#F97316" style={{ marginRight: 8 }} />
                            <Text style={styles.phoneText}>{phone || 'Contact unavailable'}</Text>
                        </View>

                        {/* Action Buttons Row */}
                        <View style={styles.btnRow}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setVisible(false)}>
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={[styles.callBtn, !phone && styles.disabledBtn]} 
                                onPress={handleCall}
                                disabled={!phone}
                            >
                                <Text style={styles.callBtnText}>Call</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    phoneButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#FFF5ED',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#FFEED9',
        marginLeft: 8,
    },
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    backdrop: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(17, 24, 39, 0.4)', // dark premium background tint
    },
    modalCard: {
        width: '85%',
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        position: 'relative',
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 10 },
            android: { elevation: 8 },
        }),
    },
    closeBtn: {
        position: 'absolute',
        top: 16,
        right: 16,
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    avatarWrap: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#F3F4F6',
        overflow: 'hidden',
        marginBottom: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#FFEED9',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    avatarPlaceholder: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    roleTag: {
        fontSize: 10,
        fontWeight: '700',
        color: '#F97316',
        letterSpacing: 1.2,
        marginBottom: 6,
    },
    nameText: {
        fontSize: 18,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 10,
    },
    infoText: {
        fontSize: 12,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 18,
        paddingHorizontal: 10,
        marginBottom: 20,
    },
    phoneBox: {
        width: '100%',
        backgroundColor: '#FFF5ED',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#FFEED9',
        marginBottom: 20,
    },
    phoneText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#F97316',
    },
    btnRow: {
        flexDirection: 'row',
        width: '100%',
        gap: 10,
    },
    cancelBtn: {
        flex: 1,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#4B5563',
    },
    callBtn: {
        flex: 1,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#F97316',
        alignItems: 'center',
        justifyContent: 'center',
    },
    disabledBtn: {
        backgroundColor: '#D1D5DB',
    },
    callBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});

export default ConnectContactButton;
