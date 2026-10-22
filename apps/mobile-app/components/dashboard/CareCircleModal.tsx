import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    TextInput,
    ActivityIndicator,
    Alert,
    Share,
    Dimensions,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import api from '@/services/api';

interface CareCircleMember {
    id: string;
    userId: string;
    name: string;
    phone: string;
    role: string;
    relationship: string;
    isPrimary?: boolean;
    canRenew: boolean;
    canViewVitals: boolean;
    canEditDetails?: boolean;
    status: string;
    inviteCode?: string;
}

interface CareCircleModalProps {
    visible: boolean;
    beneficiaryId: string;
    beneficiaryName: string;
    onClose: () => void;
    onMembersChanged?: () => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const RELATIONSHIPS = ['Daughter', 'Son', 'Sister', 'Brother', 'Spouse', 'Other'];

export const CareCircleModal: React.FC<CareCircleModalProps> = ({
    visible,
    beneficiaryId,
    beneficiaryName,
    onClose,
    onMembersChanged,
}) => {
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [primarySponsor, setPrimarySponsor] = useState<CareCircleMember | null>(null);
    const [members, setMembers] = useState<CareCircleMember[]>([]);
    const [isPrimarySponsorUser, setIsPrimarySponsorUser] = useState(false);

    // Invite form state
    const [showInviteForm, setShowInviteForm] = useState(false);
    const [invitePhone, setInvitePhone] = useState('');
    const [inviteName, setInviteName] = useState('');
    const [selectedRelation, setSelectedRelation] = useState('Daughter');
    const [canEditDetails, setCanEditDetails] = useState(false); // false = View Only, true = Can Edit
    const [canRenew, setCanRenew] = useState(true);
    const [canViewVitals, setCanViewVitals] = useState(true);
    const [lastInviteCode, setLastInviteCode] = useState<string | null>(null);

    const fetchCareCircle = useCallback(async () => {
        if (!beneficiaryId) return;
        setLoading(true);
        try {
            const res = await api.get(`/subscriber/care-circle/${beneficiaryId}`);
            if (res.data?.success) {
                setPrimarySponsor(res.data.data.primarySponsor || null);
                setMembers(res.data.data.members || []);
                setIsPrimarySponsorUser(!!res.data.data.isCurrentUserPrimarySponsor);
            }
        } catch (err: any) {
            console.error('[CareCircle] Fetch error:', err.message);
        } finally {
            setLoading(false);
        }
    }, [beneficiaryId]);

    useEffect(() => {
        if (visible && beneficiaryId) {
            fetchCareCircle();
            setShowInviteForm(false);
            setLastInviteCode(null);
            setInvitePhone('');
            setInviteName('');
            setCanEditDetails(false);
        }
    }, [visible, beneficiaryId, fetchCareCircle]);

    const handleToggleEditAccess = async (member: CareCircleMember) => {
        const nextState = !member.canEditDetails;
        try {
            const res = await api.patch(`/subscriber/care-circle/${beneficiaryId}/members/${member.id}/permissions`, {
                canEditDetails: nextState,
            });
            if (res.data?.success) {
                fetchCareCircle();
                onMembersChanged?.();
            }
        } catch (err: any) {
            Alert.alert('Error', err.response?.data?.message || 'Failed to update access level.');
        }
    };

    const handleSendInvite = async () => {
        const cleanPhone = invitePhone.trim().replace(/\D/g, '');
        if (cleanPhone.length !== 10) {
            Alert.alert('Invalid Phone', 'Please enter a valid 10-digit mobile number.');
            return;
        }

        setSubmitting(true);
        try {
            const res = await api.post('/subscriber/care-circle/invite', {
                beneficiaryId,
                phone: cleanPhone,
                name: inviteName.trim() || undefined,
                relationship: selectedRelation,
                canEditDetails,
                role: canEditDetails ? 'editor' : 'viewer',
                canRenew,
                canViewVitals,
            });

            if (res.data?.success) {
                Alert.alert('Invitation Sent', res.data.message || 'Family member invited successfully!');
                setLastInviteCode(res.data.data?.inviteCode || null);
                setShowInviteForm(false);
                setInvitePhone('');
                setInviteName('');
                fetchCareCircle();
                onMembersChanged?.();
            } else {
                Alert.alert('Invite Error', res.data?.message || 'Could not send invitation.');
            }
        } catch (err: any) {
            const msg = err.response?.data?.message || err.message || 'Failed to send invite.';
            Alert.alert('Invite Failed', msg);
        } finally {
            setSubmitting(false);
        }
    };

    const handleShareCode = async (code: string) => {
        try {
            await Share.share({
                message: `Hi! You have been invited to join ${beneficiaryName}'s Care Circle on MaiHoonNa to monitor visits and coordinate health care. Download the MaiHoonNa app and enter Care Circle code: ${code}`,
            });
        } catch (_) {}
    };

    const handleRemoveMember = (member: CareCircleMember) => {
        Alert.alert(
            'Remove Member',
            `Are you sure you want to remove ${member.name} from ${beneficiaryName}'s Care Circle?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const res = await api.delete(`/subscriber/care-circle/${beneficiaryId}/members/${member.id}`);
                            if (res.data?.success) {
                                fetchCareCircle();
                                onMembersChanged?.();
                            }
                        } catch (err: any) {
                            Alert.alert('Error', err.response?.data?.message || 'Failed to remove member.');
                        }
                    },
                },
            ]
        );
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.sheetContainer}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.titleWrap}>
                            <View style={styles.badgeWrap}>
                                <Ionicons name="people" size={16} color="#FE6700" style={{ marginRight: 4 }} />
                                <Text style={styles.badgeText}>Family Care Circle</Text>
                            </View>
                            <Text style={styles.title}>{beneficiaryName}</Text>
                        </View>
                        <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                            <Ionicons name="close" size={22} color="#6B7280" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                        <Text style={styles.description}>
                            All members of this Care Circle can view updates, visit reports, and track wellness for {beneficiaryName}.
                        </Text>

                        {/* Recent Invite Success Banner */}
                        {lastInviteCode && (
                            <View style={styles.inviteSuccessBanner}>
                                <View style={styles.inviteSuccessLeft}>
                                    <Ionicons name="checkmark-circle" size={20} color="#059669" />
                                    <View style={{ marginLeft: 8 }}>
                                        <Text style={styles.inviteSuccessTitle}>Invite Generated!</Text>
                                        <Text style={styles.inviteSuccessCode}>Code: {lastInviteCode}</Text>
                                    </View>
                                </View>
                                <TouchableOpacity style={styles.shareBtn} onPress={() => handleShareCode(lastInviteCode)} activeOpacity={0.8}>
                                    <Feather name="share-2" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                                    <Text style={styles.shareBtnText}>Share</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {loading ? (
                            <ActivityIndicator size="large" color="#FE6700" style={{ marginVertical: 32 }} />
                        ) : (
                            <>
                                {/* Primary Sponsor Card */}
                                <Text style={styles.sectionLabel}>Primary Sponsor & Payer</Text>
                                {primarySponsor && (
                                    <View style={styles.memberCard}>
                                        <View style={[styles.avatarBox, { backgroundColor: '#EFF6FF' }]}>
                                            <Ionicons name="person" size={20} color="#2563EB" />
                                        </View>
                                        <View style={styles.memberInfo}>
                                            <View style={styles.nameRow}>
                                                <Text style={styles.memberName}>{primarySponsor.name}</Text>
                                                <View style={styles.sponsorBadge}>
                                                    <Text style={styles.sponsorBadgeText}>Primary Sponsor</Text>
                                                </View>
                                            </View>
                                            <Text style={styles.memberMeta}>{primarySponsor.relationship} • {primarySponsor.phone}</Text>
                                            <View style={styles.chipsRow}>
                                                <View style={[styles.accessBadge, styles.editBadge]}>
                                                    <Feather name="shield" size={11} color="#059669" style={{ marginRight: 3 }} />
                                                    <Text style={[styles.accessBadgeText, styles.editBadgeText]}>Owner • Full Access</Text>
                                                </View>
                                            </View>
                                        </View>
                                    </View>
                                )}

                                {/* Co-Caregivers List */}
                                <View style={styles.sectionHeaderRow}>
                                    <Text style={styles.sectionLabel}>Co-Caregivers & Family ({members.length})</Text>
                                    {isPrimarySponsorUser && !showInviteForm && (
                                        <TouchableOpacity onPress={() => setShowInviteForm(true)} activeOpacity={0.7}>
                                            <Text style={styles.addMemberLink}>+ Invite Member</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>

                                {members.length === 0 && !showInviteForm && (
                                    <View style={styles.emptyMembersBox}>
                                        <Text style={styles.emptyMembersText}>
                                            No co-caregivers added yet. Invite brothers, sisters, or spouse to monitor care together.
                                        </Text>
                                        {isPrimarySponsorUser && (
                                            <TouchableOpacity
                                                style={styles.firstInviteBtn}
                                                onPress={() => setShowInviteForm(true)}
                                                activeOpacity={0.85}
                                            >
                                                <Ionicons name="person-add-outline" size={15} color="#FE6700" style={{ marginRight: 6 }} />
                                                <Text style={styles.firstInviteBtnText}>Invite First Family Member</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                )}

                                {members.map((m) => (
                                    <View key={m.id} style={styles.memberCard}>
                                        <View style={[styles.avatarBox, { backgroundColor: '#F3F4F6' }]}>
                                            <Ionicons name="person-outline" size={20} color="#4B5563" />
                                        </View>
                                        <View style={styles.memberInfo}>
                                            <View style={styles.nameRow}>
                                                <Text style={styles.memberName}>{m.name}</Text>
                                                <View style={m.status === 'active' ? styles.activeBadge : styles.invitedBadge}>
                                                    <Text style={m.status === 'active' ? styles.activeBadgeText : styles.invitedBadgeText}>
                                                        {m.status === 'active' ? 'Active' : 'Invited'}
                                                    </Text>
                                                </View>
                                            </View>
                                            <Text style={styles.memberMeta}>{m.relationship} • {m.phone}</Text>
                                            <View style={styles.chipsRow}>
                                                {/* Access Level Badge with Tap-to-Toggle for primary sponsor */}
                                                <TouchableOpacity
                                                    style={[styles.accessBadge, m.canEditDetails ? styles.editBadge : styles.viewBadge]}
                                                    onPress={() => isPrimarySponsorUser && handleToggleEditAccess(m)}
                                                    activeOpacity={isPrimarySponsorUser ? 0.7 : 1}
                                                >
                                                    <Feather
                                                        name={m.canEditDetails ? 'edit-2' : 'eye'}
                                                        size={11}
                                                        color={m.canEditDetails ? '#059669' : '#4B5563'}
                                                        style={{ marginRight: 3 }}
                                                    />
                                                    <Text style={[styles.accessBadgeText, m.canEditDetails ? styles.editBadgeText : styles.viewBadgeText]}>
                                                        {m.canEditDetails ? 'Can Edit' : 'View Only'}
                                                    </Text>
                                                    {isPrimarySponsorUser && (
                                                        <Ionicons
                                                            name="swap-horizontal"
                                                            size={10}
                                                            color={m.canEditDetails ? '#059669' : '#6B7280'}
                                                            style={{ marginLeft: 3 }}
                                                        />
                                                    )}
                                                </TouchableOpacity>

                                                {m.canRenew && (
                                                    <View style={styles.permChip}>
                                                        <Text style={styles.permChipText}>Can Renew</Text>
                                                    </View>
                                                )}
                                                {m.canViewVitals && (
                                                    <View style={styles.permChip}>
                                                        <Text style={styles.permChipText}>View Vitals</Text>
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                        {isPrimarySponsorUser && (
                                            <TouchableOpacity
                                                style={styles.removeBtn}
                                                onPress={() => handleRemoveMember(m)}
                                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                            >
                                                <Feather name="trash-2" size={16} color="#DC2626" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                ))}

                                {/* Invite Form Accordion */}
                                {showInviteForm && (
                                    <View style={styles.inviteFormCard}>
                                        <View style={styles.inviteFormHeader}>
                                            <Text style={styles.inviteFormTitle}>Invite Co-Caregiver</Text>
                                            <TouchableOpacity onPress={() => setShowInviteForm(false)}>
                                                <Ionicons name="close-circle-outline" size={20} color="#6B7280" />
                                            </TouchableOpacity>
                                        </View>

                                        <Text style={styles.inputLabel}>Mobile Number *</Text>
                                        <TextInput
                                            style={styles.textInput}
                                            placeholder="10-digit mobile number"
                                            placeholderTextColor="#9CA3AF"
                                            keyboardType="phone-pad"
                                            maxLength={10}
                                            value={invitePhone}
                                            onChangeText={setInvitePhone}
                                        />

                                        <Text style={styles.inputLabel}>Full Name (Optional)</Text>
                                        <TextInput
                                            style={styles.textInput}
                                            placeholder="e.g. Priya Sharma"
                                            placeholderTextColor="#9CA3AF"
                                            value={inviteName}
                                            onChangeText={setInviteName}
                                        />

                                        <Text style={styles.inputLabel}>Relationship</Text>
                                        <View style={styles.relationPills}>
                                            {RELATIONSHIPS.map((rel) => {
                                                const isSel = selectedRelation === rel;
                                                return (
                                                    <TouchableOpacity
                                                        key={rel}
                                                        style={[styles.relationPill, isSel && styles.relationPillActive]}
                                                        onPress={() => setSelectedRelation(rel)}
                                                        activeOpacity={0.8}
                                                    >
                                                        <Text style={[styles.relationPillText, isSel && styles.relationPillTextActive]}>
                                                            {rel}
                                                        </Text>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>

                                        {/* Access Level Selector (View Only vs Can Edit) */}
                                        <Text style={[styles.inputLabel, { marginTop: 14 }]}>Access Level</Text>
                                        <View style={styles.accessLevelRow}>
                                            <TouchableOpacity
                                                style={[styles.accessLevelCard, !canEditDetails && styles.accessLevelCardActive]}
                                                onPress={() => setCanEditDetails(false)}
                                                activeOpacity={0.8}
                                            >
                                                <View style={styles.accessLevelHeader}>
                                                    <Feather name="eye" size={15} color={!canEditDetails ? '#FE6700' : '#6B7280'} style={{ marginRight: 6 }} />
                                                    <Text style={[styles.accessLevelTitle, !canEditDetails && styles.accessLevelTitleActive]}>
                                                        View Only
                                                    </Text>
                                                </View>
                                                <Text style={styles.accessLevelDesc}>
                                                    Can monitor visits, vitals & companion updates. Cannot modify records.
                                                </Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={[styles.accessLevelCard, canEditDetails && styles.accessLevelCardActive]}
                                                onPress={() => setCanEditDetails(true)}
                                                activeOpacity={0.8}
                                            >
                                                <View style={styles.accessLevelHeader}>
                                                    <Feather name="edit-2" size={15} color={canEditDetails ? '#FE6700' : '#6B7280'} style={{ marginRight: 6 }} />
                                                    <Text style={[styles.accessLevelTitle, canEditDetails && styles.accessLevelTitleActive]}>
                                                        Can Edit
                                                    </Text>
                                                </View>
                                                <Text style={styles.accessLevelDesc}>
                                                    Full access: can edit medications, update records & details.
                                                </Text>
                                            </TouchableOpacity>
                                        </View>

                                        {/* Permissions */}
                                        <Text style={[styles.inputLabel, { marginTop: 12 }]}>Permissions</Text>
                                        <TouchableOpacity
                                            style={styles.permToggleRow}
                                            onPress={() => setCanRenew(!canRenew)}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons
                                                name={canRenew ? 'checkbox' : 'square-outline'}
                                                size={20}
                                                color={canRenew ? '#FE6700' : '#9CA3AF'}
                                            />
                                            <Text style={styles.permToggleText}>Allow renewing or buying care plans</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={styles.permToggleRow}
                                            onPress={() => setCanViewVitals(!canViewVitals)}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons
                                                name={canViewVitals ? 'checkbox' : 'square-outline'}
                                                size={20}
                                                color={canViewVitals ? '#FE6700' : '#9CA3AF'}
                                            />
                                            <Text style={styles.permToggleText}>Allow viewing vitals & medical reports</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[styles.sendInviteBtn, submitting && styles.sendInviteBtnDisabled]}
                                            onPress={handleSendInvite}
                                            disabled={submitting}
                                            activeOpacity={0.85}
                                        >
                                            {submitting ? (
                                                <ActivityIndicator size="small" color="#FFFFFF" />
                                            ) : (
                                                <>
                                                    <Ionicons name="paper-plane" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                                                    <Text style={styles.sendInviteBtnText}>Send Care Circle Invite</Text>
                                                </>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </>
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    sheetContainer: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: SCREEN_HEIGHT * 0.9,
        paddingTop: 16,
        paddingBottom: 28,
        paddingHorizontal: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    titleWrap: {
        flex: 1,
    },
    badgeWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 2,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FE6700',
        textTransform: 'uppercase',
    },
    title: {
        fontSize: 20,
        fontWeight: '800',
        color: '#111827',
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    scrollContent: {
        paddingBottom: 20,
    },
    description: {
        fontSize: 13,
        color: '#6B7280',
        lineHeight: 18,
        marginBottom: 16,
    },
    inviteSuccessBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: '#A7F3D0',
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
    },
    inviteSuccessLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    inviteSuccessTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#065F46',
    },
    inviteSuccessCode: {
        fontSize: 13,
        color: '#047857',
        fontWeight: '600',
    },
    shareBtn: {
        backgroundColor: '#059669',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 8,
    },
    shareBtnText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '700',
    },
    sectionLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: '#4B5563',
        marginBottom: 8,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 16,
        marginBottom: 8,
    },
    addMemberLink: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FE6700',
    },
    memberCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
    },
    avatarBox: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    memberInfo: {
        flex: 1,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    memberName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
    },
    sponsorBadge: {
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    sponsorBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#2563EB',
    },
    activeBadge: {
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    activeBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#059669',
    },
    invitedBadge: {
        backgroundColor: '#FFFBEB',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    invitedBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#D97706',
    },
    memberMeta: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    chipsRow: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 4,
    },
    permChip: {
        backgroundColor: '#EEF2F6',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    permChipText: {
        fontSize: 10,
        color: '#374151',
        fontWeight: '500',
    },
    accessBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 2.5,
        borderRadius: 4,
        borderWidth: 1,
    },
    accessBadgeText: {
        fontSize: 10,
        fontWeight: '700',
    },
    editBadge: {
        backgroundColor: '#ECFDF5',
        borderColor: '#A7F3D0',
    },
    editBadgeText: {
        color: '#059669',
    },
    viewBadge: {
        backgroundColor: '#F3F4F6',
        borderColor: '#E5E7EB',
    },
    viewBadgeText: {
        color: '#4B5563',
    },
    accessLevelRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 4,
        marginBottom: 8,
    },
    accessLevelCard: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        padding: 8,
    },
    accessLevelCardActive: {
        borderColor: '#FE6700',
        backgroundColor: '#FFF7ED',
    },
    accessLevelHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 2,
    },
    accessLevelTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#374151',
    },
    accessLevelTitleActive: {
        color: '#FE6700',
    },
    accessLevelDesc: {
        fontSize: 10,
        color: '#6B7280',
        lineHeight: 14,
    },
    removeBtn: {
        padding: 6,
    },
    emptyMembersBox: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderStyle: 'dashed',
    },
    emptyMembersText: {
        fontSize: 13,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 18,
        marginBottom: 12,
    },
    firstInviteBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF5ED',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#FFD9C0',
    },
    firstInviteBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FE6700',
    },
    inviteFormCard: {
        backgroundColor: '#FFFBF8',
        borderWidth: 1,
        borderColor: '#FED7AA',
        borderRadius: 14,
        padding: 14,
        marginTop: 12,
    },
    inviteFormHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    inviteFormTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 4,
    },
    textInput: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 9,
        fontSize: 14,
        color: '#111827',
        marginBottom: 10,
    },
    relationPills: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    relationPill: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    relationPillActive: {
        backgroundColor: '#FE6700',
        borderColor: '#FE6700',
    },
    relationPillText: {
        fontSize: 12,
        color: '#4B5563',
        fontWeight: '600',
    },
    relationPillTextActive: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    permToggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 5,
        gap: 8,
    },
    permToggleText: {
        fontSize: 13,
        color: '#374151',
    },
    sendInviteBtn: {
        backgroundColor: '#FE6700',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 10,
        marginTop: 14,
    },
    sendInviteBtnDisabled: {
        opacity: 0.6,
    },
    sendInviteBtnText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },
});
