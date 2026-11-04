import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { sanitizeImageUri } from '@/utils/sanitizeImageUri';

export interface BeneficiaryItem {
    id: string;
    name: string;
    relationship?: string;
    photo?: string | null;
    dateOfBirth?: string | null;
    age?: number | null;
    packageStatus?: 'active' | 'expired' | 'pending' | 'none';
    verificationStatus?: string;
    isSelf?: boolean;
    isCareCircleMember?: boolean;
    careCircleRole?: string;
    careCircleMembersCount?: number;
}

interface FamilyCareSectionProps {
    beneficiaries: BeneficiaryItem[];
    remainingHours: number;
    visitsThisWeek: number;
    onSelectBeneficiary: (beneficiary: BeneficiaryItem) => void;
    onAddMember: () => void;
    onOpenFamilyConnect: () => void;
    onOpenCareCircle?: (beneficiary: BeneficiaryItem) => void;
    onOpenJoinCircle?: () => void;
}

export const FamilyCareSection: React.FC<FamilyCareSectionProps> = ({
    beneficiaries,
    remainingHours,
    visitsThisWeek,
    onSelectBeneficiary,
    onAddMember,
    onOpenFamilyConnect,
    onOpenCareCircle,
    onOpenJoinCircle,
}) => {
    const getDisplayAge = (b: BeneficiaryItem): string => {
        if (b.dateOfBirth) {
            try {
                const dob = new Date(b.dateOfBirth);
                if (!isNaN(dob.getTime())) {
                    const today = new Date();
                    let age = today.getFullYear() - dob.getFullYear();
                    const m = today.getMonth() - dob.getMonth();
                    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
                    return `${age} yrs`;
                }
            } catch (_) { }
        }
        return b.age ? `${b.age} yrs` : '';
    };

    return (
        <View style={styles.container}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Family Care Activity</Text>
                <TouchableOpacity onPress={onOpenFamilyConnect} activeOpacity={0.7}>
                    <Text style={styles.linkText}>Family Connect</Text>
                </TouchableOpacity>
            </View>

            {beneficiaries.length > 0 ? (
                <>
                    {/* ── High-Level Snapshot Row ── */}
                    <View style={styles.snapshotRow}>
                        <View style={styles.snapshotCard}>
                            <View style={[styles.snapshotIconBox, { backgroundColor: '#EFF6FF' }]}>
                                <Ionicons name="people" size={18} color="#2563EB" />
                            </View>
                            <Text style={styles.snapshotValue} numberOfLines={1}>{beneficiaries.length}</Text>
                            <Text style={styles.snapshotLabel} numberOfLines={1} adjustsFontSizeToFit>Family Members</Text>
                        </View>

                        <View style={styles.snapshotCard}>
                            <View style={[styles.snapshotIconBox, { backgroundColor: '#ECFDF5' }]}>
                                <Ionicons name="time" size={18} color="#059669" />
                            </View>
                            <Text style={styles.snapshotValue} numberOfLines={1}>{remainingHours}h</Text>
                            <Text style={styles.snapshotLabel} numberOfLines={1} adjustsFontSizeToFit>Care Hours Left</Text>
                        </View>

                        <View style={styles.snapshotCard}>
                            <View style={[styles.snapshotIconBox, { backgroundColor: '#FFF7ED' }]}>
                                <Feather name="calendar" size={18} color="#EA580C" />
                            </View>
                            <Text style={styles.snapshotValue} numberOfLines={1}>{visitsThisWeek}</Text>
                            <Text style={styles.snapshotLabel} numberOfLines={1} adjustsFontSizeToFit>Visits This Week</Text>
                        </View>
                    </View>

                    {/* ── Beneficiary Cards ── */}
                    {beneficiaries.map((b) => {
                        const isSelf = (b.relationship || '').toLowerCase() === 'self' || b.isSelf;
                        const isPending = b.packageStatus === 'pending' || b.verificationStatus === 'pending';
                        const isExpired = b.packageStatus === 'expired';
                        const isActive = b.packageStatus === 'active';

                        return (
                            <TouchableOpacity
                                key={b.id}
                                style={styles.familyCard}
                                onPress={() => onSelectBeneficiary(b)}
                                activeOpacity={0.85}
                            >
                                <Image
                                    source={{
                                        uri: sanitizeImageUri(
                                            b.photo,
                                            `https://ui-avatars.com/api/?name=${encodeURIComponent(b.name || 'Member')}&background=FFE3D1&color=FE6700&bold=true`
                                        )
                                    }}
                                    style={styles.familyAvatar}
                                />

                                <View style={styles.familyInfo}>
                                    <View style={styles.nameRow}>
                                        <Text style={styles.familyName}>{b.name}</Text>
                                        {isSelf && (
                                            <View style={styles.selfBadge}>
                                                <Text style={styles.selfBadgeText}>Self</Text>
                                            </View>
                                        )}
                                        {b.isCareCircleMember && (
                                            <View style={styles.sharedBadge}>
                                                <Ionicons name="people" size={10} color="#2563EB" style={{ marginRight: 2 }} />
                                                <Text style={styles.sharedBadgeText}>Shared Care</Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text style={styles.familyMeta}>
                                        {getDisplayAge(b)}{b.relationship ? ` • ${b.relationship}` : ''}
                                    </Text>

                                    {/* Status & Care Circle Badges */}
                                    <View style={styles.pillRow}>
                                        {isExpired ? (
                                            <View style={styles.expiredPill}>
                                                <Ionicons name="time-outline" size={12} color="#DC2626" style={{ marginRight: 4 }} />
                                                <Text style={styles.expiredPillText}>Tap to renew package</Text>
                                            </View>
                                        ) : isPending ? (
                                            <View style={styles.pendingPill}>
                                                <Ionicons name="alert-circle-outline" size={12} color="#D97706" style={{ marginRight: 4 }} />
                                                <Text style={styles.pendingPillText}>Setup required</Text>
                                            </View>
                                        ) : isActive ? (
                                            <View style={styles.activePill}>
                                                <View style={styles.activeDot} />
                                                <Text style={styles.activePillText}>Active Care</Text>
                                            </View>
                                        ) : null}

                                        {onOpenCareCircle && (
                                            <TouchableOpacity
                                                style={styles.careCirclePill}
                                                onPress={() => onOpenCareCircle(b)}
                                                activeOpacity={0.8}
                                                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                            >
                                                <Ionicons name="people-outline" size={12} color="#FE6700" style={{ marginRight: 3 }} />
                                                <Text style={styles.careCirclePillText}>
                                                    Care Circle ({b.careCircleMembersCount || 1})
                                                </Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>

                                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                            </TouchableOpacity>
                        );
                    })}

                    <View style={styles.actionsRow}>
                        <TouchableOpacity
                            style={styles.addMemberBtn}
                            onPress={onAddMember}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="person-add-outline" size={15} color="#FE6700" style={{ marginRight: 6 }} />
                            <Text style={styles.addMemberBtnText}>Add Member</Text>
                        </TouchableOpacity>

                        {onOpenJoinCircle && (
                            <TouchableOpacity
                                style={styles.joinCircleBtn}
                                onPress={onOpenJoinCircle}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="key-outline" size={15} color="#2563EB" style={{ marginRight: 6 }} />
                                <Text style={styles.joinCircleBtnText}>Join Circle</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </>
            ) : (
                <View style={styles.emptyCard}>
                    <View style={styles.emptyIconBox}>
                        <Ionicons name="people-outline" size={26} color="#FE6700" />
                    </View>
                    <View style={styles.emptyTextWrap}>
                        <Text style={styles.emptyTitle}>No Family Members Added</Text>
                        <Text style={styles.emptySub}>
                            Add your parents or family members to monitor their health visits and companion support.
                        </Text>
                        <View style={styles.emptyActionsRow}>
                            <TouchableOpacity
                                style={styles.addFamilyBtn}
                                onPress={onAddMember}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="person-add-outline" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                                <Text style={styles.addFamilyBtnText}>Add Member</Text>
                            </TouchableOpacity>

                            {onOpenJoinCircle && (
                                <TouchableOpacity
                                    style={styles.emptyJoinBtn}
                                    onPress={onOpenJoinCircle}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons name="key-outline" size={14} color="#2563EB" style={{ marginRight: 5 }} />
                                    <Text style={styles.emptyJoinBtnText}>Join Circle</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        marginBottom: 8,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
        marginTop: 8,
        width: '100%',
        flexWrap: 'wrap',
        gap: 6,
    },
    sectionTitle: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 18,
        lineHeight: 24,
        color: '#0F172A',
        flexShrink: 1,
    },
    linkText: {
        fontFamily: 'Poppins-Medium',
        fontSize: 14,
        lineHeight: 20,
        color: '#FF6A00',
    },
    snapshotRow: {
        width: '100%',
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16,
    },
    snapshotCard: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 6,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 2,
    },
    snapshotIconBox: {
        width: 32,
        height: 32,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 6,
    },
    snapshotValue: {
        fontFamily: 'Poppins-Bold',
        fontSize: 16,
        color: '#0F172A',
        lineHeight: 22,
    },
    snapshotLabel: {
        fontFamily: 'Poppins-Regular',
        fontSize: 10,
        color: '#64748B',
        textAlign: 'center',
        marginTop: 2,
    },
    familyCard: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#F3F4F6',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    familyAvatar: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: '#F3F4F6',
    },
    familyInfo: {
        flex: 1,
        marginLeft: 12,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    familyName: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 15,
        color: '#111827',
    },
    selfBadge: {
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    selfBadgeText: {
        fontFamily: 'Poppins-Medium',
        fontSize: 10,
        color: '#2563EB',
    },
    familyMeta: {
        fontFamily: 'Poppins-Regular',
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    expiredPill: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: '#FEF2F2',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        marginTop: 4,
    },
    expiredPillText: {
        fontFamily: 'Poppins-Medium',
        fontSize: 11,
        color: '#DC2626',
    },
    pendingPill: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: '#FFFBEB',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        marginTop: 4,
    },
    pendingPillText: {
        fontFamily: 'Poppins-Medium',
        fontSize: 11,
        color: '#D97706',
    },
    activePill: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        marginTop: 4,
        gap: 5,
    },
    activeDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#10B981',
    },
    activePillText: {
        fontFamily: 'Poppins-Medium',
        fontSize: 11,
        color: '#059669',
    },
    actionsRow: {
        width: '100%',
        flexDirection: 'row',
        gap: 10,
        marginBottom: 18,
    },
    addMemberBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderWidth: 1,
        borderColor: '#FED7AA',
        borderStyle: 'dashed',
    },
    addMemberBtnText: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 13,
        color: '#FE6700',
    },
    joinCircleBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#EFF6FF',
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderWidth: 1,
        borderColor: '#BFDBFE',
    },
    joinCircleBtnText: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 13,
        color: '#2563EB',
    },
    emptyCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#F3F4F6',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    emptyIconBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#FFF5ED',
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyTextWrap: {
        flex: 1,
        marginLeft: 12,
    },
    emptyTitle: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 14,
        color: '#111827',
        marginBottom: 2,
    },
    emptySub: {
        fontFamily: 'Poppins-Regular',
        fontSize: 12,
        color: '#6B7280',
        lineHeight: 17,
        marginBottom: 10,
    },
    emptyActionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
    },
    addFamilyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FE6700',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 8,
    },
    addFamilyBtnText: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 12,
        color: '#FFFFFF',
    },
    emptyJoinBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EFF6FF',
        borderWidth: 1,
        borderColor: '#BFDBFE',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    emptyJoinBtnText: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 12,
        color: '#2563EB',
    },
    sharedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginLeft: 6,
    },
    sharedBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#2563EB',
    },
    pillRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 6,
        marginTop: 6,
    },
    careCirclePill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF5ED',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#FED7AA',
    },
    careCirclePillText: {
        fontFamily: 'Poppins-Medium',
        fontSize: 10,
        color: '#FE6700',
    },
});
