import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    ScrollView,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '@/services/api';

interface AccessRequestsModalProps {
    visible: boolean;
    onClose: () => void;
    onChanged?: () => void;
    initialTab?: 'incoming' | 'outgoing';
}

interface IncomingAccessRequest {
    id: string;
    requestedRole: 'VIEWER' | 'EDITOR' | 'MANAGER';
    relationship?: string;
    note?: string;
    createdAt: string;
    beneficiary: { id: string; name: string };
    requester?: { id: string; name?: string; phone: string };
    invitedBy?: { id: string; name?: string; phone: string };
}

interface OutgoingAccessRequest {
    id: string;
    requestedRole: string;
    relationship?: string;
    targetPhone?: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';
    createdAt: string;
    beneficiary?: { id: string; name: string } | null;
}

export const AccessRequestsModal: React.FC<AccessRequestsModalProps> = ({
    visible,
    onClose,
    onChanged,
    initialTab = 'incoming',
}) => {
    const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing'>(initialTab);
    const [loading, setLoading] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [toApprove, setToApprove] = useState<IncomingAccessRequest[]>([]);
    const [invitesForMe, setInvitesForMe] = useState<IncomingAccessRequest[]>([]);
    const [outgoing, setOutgoing] = useState<OutgoingAccessRequest[]>([]);

    const loadAll = useCallback(async () => {
        setLoading(true);
        try {
            const [incRes, outRes] = await Promise.all([
                api.get('/access/requests/incoming'),
                api.get('/access/requests/outgoing'),
            ]);
            if (incRes.data?.success) {
                setToApprove(incRes.data.data?.accessRequestsToApprove || []);
                setInvitesForMe(incRes.data.data?.invitesForMe || []);
            }
            if (outRes.data?.success) {
                setOutgoing(outRes.data.data || []);
            }
        } catch (err: any) {
            console.warn('[AccessRequestsModal] Load error:', err?.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (visible) {
            setActiveTab(initialTab);
            loadAll();
        }
    }, [visible, initialTab, loadAll]);

    const handleRespond = async (
        requestId: string,
        action: 'APPROVE' | 'REJECT' | 'CANCEL',
        grantedRole?: 'VIEWER' | 'EDITOR'
    ) => {
        setBusyId(requestId);
        try {
            const res = await api.post(`/access/requests/${requestId}/respond`, {
                action,
                grantedRole,
            });
            if (res.data?.success) {
                await loadAll();
                onChanged?.();
            } else {
                Alert.alert('Action Failed', res.data?.message || 'Unable to process request.');
            }
        } catch (err: any) {
            const msg = err.response?.data?.message || err.message || 'Unable to process request.';
            Alert.alert('Error', msg);
        } finally {
            setBusyId(null);
        }
    };

    const incomingCount = toApprove.length + invitesForMe.length;

    const getStatusBadgeStyle = (status: string) => {
        switch (status) {
            case 'APPROVED':
                return { bg: '#ECFDF5', text: '#059669' };
            case 'REJECTED':
                return { bg: '#FEF2F2', text: '#DC2626' };
            case 'CANCELLED':
            case 'EXPIRED':
                return { bg: '#F3F4F6', text: '#6B7280' };
            default:
                return { bg: '#FFFBEB', text: '#D97706' };
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.sheet}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <View style={styles.iconBadge}>
                                <Ionicons name="notifications-outline" size={20} color="#FE6700" />
                            </View>
                            <View>
                                <Text style={styles.title}>Profile Access Requests</Text>
                                <Text style={styles.subtitle}>Approve family requests &amp; track your sent requests</Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="close" size={22} color="#6B7280" />
                        </TouchableOpacity>
                    </View>

                    {/* Segmented Tabs */}
                    <View style={styles.tabBar}>
                        <TouchableOpacity
                            style={[styles.tabBtn, activeTab === 'incoming' && styles.tabBtnActive]}
                            onPress={() => setActiveTab('incoming')}
                        >
                            <Text style={[styles.tabText, activeTab === 'incoming' && styles.tabTextActive]}>
                                Incoming ({incomingCount})
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tabBtn, activeTab === 'outgoing' && styles.tabBtnActive]}
                            onPress={() => setActiveTab('outgoing')}
                        >
                            <Text style={[styles.tabText, activeTab === 'outgoing' && styles.tabTextActive]}>
                                Sent ({outgoing.length})
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Content */}
                    {loading ? (
                        <View style={styles.centerBox}>
                            <ActivityIndicator size="large" color="#FE6700" />
                        </View>
                    ) : (
                        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
                            {activeTab === 'incoming' ? (
                                incomingCount === 0 ? (
                                    <View style={styles.emptyBox}>
                                        <Ionicons name="checkmark-circle-outline" size={40} color="#9CA3AF" />
                                        <Text style={styles.emptyTitle}>All Caught Up</Text>
                                        <Text style={styles.emptySub}>
                                            No pending access requests or invitations right now.
                                        </Text>
                                    </View>
                                ) : (
                                    <>
                                        {/* Requests awaiting caller's approval */}
                                        {toApprove.map((item) => {
                                            const isBusy = busyId === item.id;
                                            return (
                                                <View key={item.id} style={styles.card}>
                                                    <View style={styles.cardTop}>
                                                        <View style={styles.typePill}>
                                                            <Text style={styles.typePillText}>ACCESS REQUEST</Text>
                                                        </View>
                                                        <Text style={styles.roleTag}>
                                                            {item.requestedRole === 'EDITOR' ? 'View & Edit' : 'View Only'}
                                                        </Text>
                                                    </View>

                                                    <Text style={styles.cardHeadline}>
                                                        {item.requester?.name || item.requester?.phone || 'A family member'} wants access to{' '}
                                                        <Text style={styles.bold}>{item.beneficiary.name}</Text>
                                                    </Text>
                                                    <Text style={styles.cardMeta}>
                                                        {item.relationship || 'Family Member'} • {item.requester?.phone}
                                                    </Text>
                                                    {item.note ? <Text style={styles.noteText}>&ldquo;{item.note}&rdquo;</Text> : null}

                                                    <View style={styles.actionRow}>
                                                        <TouchableOpacity
                                                            style={styles.declineBtn}
                                                            disabled={isBusy}
                                                            onPress={() => handleRespond(item.id, 'REJECT')}
                                                        >
                                                            <Text style={styles.declineBtnText}>Decline</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity
                                                            style={styles.approveViewBtn}
                                                            disabled={isBusy}
                                                            onPress={() => handleRespond(item.id, 'APPROVE', 'VIEWER')}
                                                        >
                                                            <Text style={styles.approveViewBtnText}>View Only</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity
                                                            style={styles.approveEditBtn}
                                                            disabled={isBusy}
                                                            onPress={() => handleRespond(item.id, 'APPROVE', 'EDITOR')}
                                                        >
                                                            {isBusy ? (
                                                                <ActivityIndicator size="small" color="#FFFFFF" />
                                                            ) : (
                                                                <Text style={styles.approveEditBtnText}>Approve Edit</Text>
                                                            )}
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            );
                                        })}

                                        {/* Invites addressed directly to caller's phone */}
                                        {invitesForMe.map((inv) => {
                                            const isBusy = busyId === inv.id;
                                            return (
                                                <View key={inv.id} style={styles.card}>
                                                    <View style={styles.cardTop}>
                                                        <View style={[styles.typePill, { backgroundColor: '#EFF6FF' }]}>
                                                            <Text style={[styles.typePillText, { color: '#2563EB' }]}>INVITATION FOR YOU</Text>
                                                        </View>
                                                        <Text style={styles.roleTag}>
                                                            {inv.requestedRole === 'EDITOR' ? 'View & Edit' : 'View Only'}
                                                        </Text>
                                                    </View>

                                                    <Text style={styles.cardHeadline}>
                                                        {inv.invitedBy?.name || 'Family'} invited you to{' '}
                                                        <Text style={styles.bold}>{inv.beneficiary.name}&apos;s</Text> Care Profile
                                                    </Text>
                                                    <Text style={styles.cardMeta}>Role: {inv.relationship || 'Family Member'}</Text>

                                                    <View style={styles.actionRow}>
                                                        <TouchableOpacity
                                                            style={styles.declineBtn}
                                                            disabled={isBusy}
                                                            onPress={() => handleRespond(inv.id, 'REJECT')}
                                                        >
                                                            <Text style={styles.declineBtnText}>Decline</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity
                                                            style={[styles.approveEditBtn, { flex: 2 }]}
                                                            disabled={isBusy}
                                                            onPress={() => handleRespond(inv.id, 'APPROVE')}
                                                        >
                                                            {isBusy ? (
                                                                <ActivityIndicator size="small" color="#FFFFFF" />
                                                            ) : (
                                                                <Text style={styles.approveEditBtnText}>Accept Invite</Text>
                                                            )}
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            );
                                        })}
                                    </>
                                )
                            ) : outgoing.length === 0 ? (
                                <View style={styles.emptyBox}>
                                    <Ionicons name="paper-plane-outline" size={38} color="#9CA3AF" />
                                    <Text style={styles.emptyTitle}>No Sent Requests</Text>
                                    <Text style={styles.emptySub}>
                                        Use &ldquo;Ask for Access&rdquo; to request view or edit access to a loved one&apos;s care profile.
                                    </Text>
                                </View>
                            ) : (
                                outgoing.map((req) => {
                                    const badge = getStatusBadgeStyle(req.status);
                                    const isBusy = busyId === req.id;
                                    return (
                                        <View key={req.id} style={styles.card}>
                                            <View style={styles.cardTop}>
                                                <View style={[styles.typePill, { backgroundColor: badge.bg }]}>
                                                    <Text style={[styles.typePillText, { color: badge.text }]}>{req.status}</Text>
                                                </View>
                                                <Text style={styles.roleTag}>
                                                    {req.requestedRole === 'EDITOR' ? 'View & Edit' : 'View Only'}
                                                </Text>
                                            </View>
                                            <Text style={styles.cardHeadline}>
                                                {req.beneficiary?.name
                                                    ? `${req.beneficiary.name} (+91 ${req.targetPhone || ''})`
                                                    : `Mobile: +91 ${req.targetPhone || ''}`}
                                            </Text>
                                            <Text style={styles.cardMeta}>Relationship: {req.relationship || 'Family Member'}</Text>

                                            {req.status === 'PENDING' && (
                                                <TouchableOpacity
                                                    style={[styles.declineBtn, { marginTop: 10, alignSelf: 'flex-start', paddingHorizontal: 14 }]}
                                                    disabled={isBusy}
                                                    onPress={() => handleRespond(req.id, 'CANCEL')}
                                                >
                                                    <Text style={styles.declineBtnText}>
                                                        {isBusy ? 'Cancelling...' : 'Cancel Request'}
                                                    </Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    );
                                })
                            )}
                        </ScrollView>
                    )}
                </View>
            </View>
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
        height: '80%',
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
    tabBar: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingTop: 12,
        gap: 10,
    },
    tabBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
    },
    tabBtnActive: {
        backgroundColor: '#FFF5ED',
        borderWidth: 1,
        borderColor: '#FE6700',
    },
    tabText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#6B7280',
    },
    tabTextActive: {
        color: '#FE6700',
    },
    centerBox: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    body: {
        padding: 20,
        gap: 12,
    },
    emptyBox: {
        alignItems: 'center',
        paddingVertical: 48,
        paddingHorizontal: 20,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#374151',
        marginTop: 10,
    },
    emptySub: {
        fontSize: 13,
        color: '#6B7280',
        textAlign: 'center',
        marginTop: 4,
        lineHeight: 18,
    },
    card: {
        backgroundColor: '#F9FAFB',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    cardTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    typePill: {
        backgroundColor: '#FFF5ED',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    typePillText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#FE6700',
        letterSpacing: 0.4,
    },
    roleTag: {
        fontSize: 11,
        fontWeight: '700',
        color: '#4B5563',
    },
    cardHeadline: {
        fontSize: 14,
        color: '#111827',
        lineHeight: 20,
    },
    bold: {
        fontWeight: '800',
    },
    cardMeta: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 4,
    },
    noteText: {
        fontSize: 12,
        fontStyle: 'italic',
        color: '#374151',
        backgroundColor: '#FFFFFF',
        padding: 8,
        borderRadius: 8,
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    actionRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 12,
    },
    declineBtn: {
        flex: 1,
        paddingVertical: 9,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
    },
    declineBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#4B5563',
    },
    approveViewBtn: {
        flex: 1,
        paddingVertical: 9,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#2563EB',
        backgroundColor: '#EFF6FF',
        alignItems: 'center',
    },
    approveViewBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#2563EB',
    },
    approveEditBtn: {
        flex: 1.2,
        paddingVertical: 9,
        borderRadius: 10,
        backgroundColor: '#FE6700',
        alignItems: 'center',
    },
    approveEditBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});
