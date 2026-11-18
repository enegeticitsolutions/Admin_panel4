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
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '@/services/api';

interface RequestAccessModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

const RELATIONSHIPS = ['Son', 'Daughter', 'Spouse', 'Sibling', 'Relative', 'Family Member'];

export const RequestAccessModal: React.FC<RequestAccessModalProps> = ({
    visible,
    onClose,
    onSuccess,
}) => {
    const [phone, setPhone] = useState('');
    const [relationship, setRelationship] = useState('Son');
    const [requestedRole, setRequestedRole] = useState<'VIEWER' | 'EDITOR'>('VIEWER');
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const resetForm = () => {
        setPhone('');
        setRelationship('Son');
        setRequestedRole('VIEWER');
        setNote('');
    };

    const handleSubmit = async () => {
        const cleanPhone = phone.replace(/\D/g, '').slice(-10);
        if (cleanPhone.length !== 10) {
            Alert.alert('Valid Mobile Number Required', 'Please enter a valid 10-digit mobile number.');
            return;
        }

        setSubmitting(true);
        try {
            const res = await api.post('/access/request', {
                targetPhone: cleanPhone,
                requestedRole,
                relationship,
                note: note.trim() || undefined,
            });

            if (res.data?.success) {
                Alert.alert(
                    'Request Sent',
                    res.data.message ||
                        'Your access request has been sent. You will see their care profile once approved.',
                    [
                        {
                            text: 'Done',
                            onPress: () => {
                                resetForm();
                                onClose();
                                onSuccess?.();
                            },
                        },
                    ]
                );
            } else {
                Alert.alert('Request Failed', res.data?.message || 'Unable to submit request.');
            }
        } catch (err: any) {
            const msg = err.response?.data?.message || err.message || 'Unable to send access request.';
            Alert.alert('Unable to Send Request', msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <KeyboardAvoidingView
                style={styles.overlay}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={styles.sheet}>
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <View style={styles.iconBadge}>
                                <Ionicons name="hand-left-outline" size={20} color="#FE6700" />
                            </View>
                            <View>
                                <Text style={styles.title}>Ask for Profile Access</Text>
                                <Text style={styles.subtitle}>
                                    Request view or edit access to a loved one&apos;s care profile
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="close" size={22} color="#6B7280" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
                        <Text style={styles.label}>Loved One&apos;s Mobile Number *</Text>
                        <View style={styles.phoneInputWrap}>
                            <Text style={styles.prefix}>+91</Text>
                            <TextInput
                                style={styles.phoneInput}
                                placeholder="10-digit mobile number"
                                placeholderTextColor="#9CA3AF"
                                keyboardType="phone-pad"
                                maxLength={10}
                                value={phone}
                                onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))}
                            />
                        </View>

                        <Text style={styles.label}>Your Relationship</Text>
                        <View style={styles.chipWrap}>
                            {RELATIONSHIPS.map((rel) => {
                                const selected = relationship === rel;
                                return (
                                    <TouchableOpacity
                                        key={rel}
                                        style={[styles.chip, selected && styles.chipSelected]}
                                        onPress={() => setRelationship(rel)}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{rel}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <Text style={styles.label}>Access Level Needed</Text>
                        <View style={styles.roleRow}>
                            <TouchableOpacity
                                style={[styles.roleCard, requestedRole === 'VIEWER' && styles.roleCardSelected]}
                                onPress={() => setRequestedRole('VIEWER')}
                                activeOpacity={0.85}
                            >
                                <View style={styles.roleHeader}>
                                    <Ionicons
                                        name="eye-outline"
                                        size={18}
                                        color={requestedRole === 'VIEWER' ? '#FE6700' : '#6B7280'}
                                    />
                                    <Text style={[styles.roleTitle, requestedRole === 'VIEWER' && styles.roleTitleSelected]}>
                                        View Only
                                    </Text>
                                </View>
                                <Text style={styles.roleDesc}>Monitor visits, vitals &amp; updates safely.</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.roleCard, requestedRole === 'EDITOR' && styles.roleCardSelected]}
                                onPress={() => setRequestedRole('EDITOR')}
                                activeOpacity={0.85}
                            >
                                <View style={styles.roleHeader}>
                                    <Ionicons
                                        name="create-outline"
                                        size={18}
                                        color={requestedRole === 'EDITOR' ? '#FE6700' : '#6B7280'}
                                    />
                                    <Text style={[styles.roleTitle, requestedRole === 'EDITOR' && styles.roleTitleSelected]}>
                                        View &amp; Edit
                                    </Text>
                                </View>
                                <Text style={styles.roleDesc}>Update meds, upload reports &amp; edit profile.</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.label}>Short Note (Optional)</Text>
                        <TextInput
                            style={styles.noteInput}
                            placeholder="e.g., Hi Mom, it's Rahul — requesting access to track visits"
                            placeholderTextColor="#9CA3AF"
                            multiline
                            maxLength={200}
                            value={note}
                            onChangeText={setNote}
                        />

                        <View style={styles.privacyHint}>
                            <Ionicons name="shield-checkmark-outline" size={16} color="#059669" />
                            <Text style={styles.privacyHintText}>
                                Medical privacy protected: Access is only granted after approval by the profile owner or Care Manager.
                            </Text>
                        </View>
                    </ScrollView>

                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={submitting}>
                            <Text style={styles.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                            onPress={handleSubmit}
                            disabled={submitting}
                            activeOpacity={0.85}
                        >
                            {submitting ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <>
                                    <Ionicons name="paper-plane-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                                    <Text style={styles.submitBtnText}>Send Request</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '88%',
        paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 12,
    },
    iconBadge: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#FFF5ED',
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 17,
        fontWeight: '800',
        color: '#111827',
    },
    subtitle: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    closeBtn: {
        padding: 4,
    },
    body: {
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    label: {
        fontSize: 13,
        fontWeight: '700',
        color: '#374151',
        marginBottom: 8,
        marginTop: 12,
    },
    phoneInputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        backgroundColor: '#F9FAFB',
        paddingHorizontal: 14,
    },
    prefix: {
        fontSize: 15,
        fontWeight: '700',
        color: '#4B5563',
        marginRight: 8,
    },
    phoneInput: {
        flex: 1,
        paddingVertical: 12,
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
    },
    chipWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
    },
    chipSelected: {
        borderColor: '#FE6700',
        backgroundColor: '#FFF5ED',
    },
    chipText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#4B5563',
    },
    chipTextSelected: {
        color: '#FE6700',
    },
    roleRow: {
        flexDirection: 'row',
        gap: 10,
    },
    roleCard: {
        flex: 1,
        borderWidth: 1.5,
        borderColor: '#E5E7EB',
        borderRadius: 14,
        padding: 12,
        backgroundColor: '#FFFFFF',
    },
    roleCardSelected: {
        borderColor: '#FE6700',
        backgroundColor: '#FFF8F3',
    },
    roleHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    roleTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1F2937',
    },
    roleTitleSelected: {
        color: '#FE6700',
    },
    roleDesc: {
        fontSize: 11,
        color: '#6B7280',
        lineHeight: 15,
    },
    noteInput: {
        borderWidth: 1.5,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        backgroundColor: '#F9FAFB',
        padding: 12,
        minHeight: 72,
        fontSize: 13,
        color: '#111827',
        textAlignVertical: 'top',
    },
    privacyHint: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        backgroundColor: '#ECFDF5',
        borderRadius: 12,
        padding: 12,
        marginTop: 14,
    },
    privacyHintText: {
        flex: 1,
        fontSize: 12,
        color: '#065F46',
        lineHeight: 17,
    },
    footer: {
        flexDirection: 'row',
        gap: 10,
        paddingHorizontal: 20,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    cancelBtn: {
        flex: 1,
        paddingVertical: 13,
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
    submitBtn: {
        flex: 2,
        flexDirection: 'row',
        paddingVertical: 13,
        borderRadius: 12,
        backgroundColor: '#FE6700',
        alignItems: 'center',
        justifyContent: 'center',
    },
    submitBtnDisabled: {
        opacity: 0.65,
    },
    submitBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});
