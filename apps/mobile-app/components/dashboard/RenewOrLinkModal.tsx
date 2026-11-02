import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '@/services/api';

export interface RenewOrLinkModalProps {
    visible: boolean;
    beneficiary: { id: string; name: string; relationship?: string } | null;
    unassignedPackages: any[];
    onClose: () => void;
    onBrowseNew: () => void;
    onSuccess: (linkedPackageName?: string) => void;
}

export const RenewOrLinkModal: React.FC<RenewOrLinkModalProps> = ({
    visible,
    beneficiary,
    unassignedPackages,
    onClose,
    onBrowseNew,
    onSuccess,
}) => {
    const [linkingId, setLinkingId] = useState<string | null>(null);

    if (!beneficiary) return null;

    const formatDuration = (sub: any): string => {
        const d = (sub?.duration || '').toLowerCase();
        if (d === 'annual' || d === 'yearly') return 'Annual Plan (12 Mo)';
        if (d === 'six_months' || d === 'semi_annual') return '6-Month Plan';
        if (d === 'three_months' || d === 'quarterly') return '3-Month Plan';
        return 'Monthly Plan (1 Mo)';
    };

    const handleLink = async (sub: any) => {
        const packageName = sub.package?.name || sub.packageType || 'Care Plan';
        setLinkingId(sub.id);

        try {
            const res = await api.post(`/subscriber/subscriptions/${sub.id}/link-beneficiary`, {
                beneficiaryId: beneficiary.id,
            });

            if (res.data?.success) {
                Alert.alert(
                    'Care Activated!',
                    `${packageName} has been successfully activated for ${beneficiary.name}. Dedicated companion visits and support are now live.`,
                    [
                        {
                            text: 'View Care Activity',
                            onPress: () => {
                                setLinkingId(null);
                                onClose();
                                onSuccess(packageName);
                            },
                        },
                    ]
                );
            } else {
                Alert.alert('Activation Failed', res.data?.message || 'Could not link care plan.');
            }
        } catch (err: any) {
            const msg = err.response?.data?.message || err.message || 'Failed to activate plan.';
            Alert.alert('Activation Error', msg);
        } finally {
            setLinkingId(null);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.sheet}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.iconCircle}>
                            <Ionicons name="shield-checkmark" size={24} color="#FE6700" />
                        </View>
                        <View style={styles.headerTextWrap}>
                            <Text style={styles.title}>Renew Care for {beneficiary.name}</Text>
                            <Text style={styles.subtitle}>
                                Select an unassigned package to activate care immediately, or browse new plans.
                            </Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="close" size={22} color="#6B7280" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.scrollList} showsVerticalScrollIndicator={false}>
                        {/* Section 1: Available Unassigned Packages */}
                        {unassignedPackages.length > 0 && (
                            <View style={styles.section}>
                                <View style={styles.sectionHeaderRow}>
                                    <Text style={styles.sectionTitle}>
                                        Available Purchased Plans ({unassignedPackages.length})
                                    </Text>
                                    <View style={styles.readyBadge}>
                                        <Text style={styles.readyBadgeText}>Ready to Link</Text>
                                    </View>
                                </View>

                                {unassignedPackages.map((sub: any) => {
                                    const packageName = sub.package?.name || sub.packageType || 'Care Package';
                                    const isLinkingThis = linkingId === sub.id;
                                    const isAnyLinking = linkingId !== null;

                                    return (
                                        <View key={sub.id} style={styles.packageCard}>
                                            <View style={styles.packageInfo}>
                                                <Text style={styles.packageName}>{packageName}</Text>
                                                <View style={styles.metaRow}>
                                                    <View style={styles.durationChip}>
                                                        <Ionicons name="calendar-outline" size={12} color="#4B5563" style={{ marginRight: 4 }} />
                                                        <Text style={styles.durationText}>{formatDuration(sub)}</Text>
                                                    </View>
                                                    {sub.benefitBalances?.length > 0 && (
                                                        <Text style={styles.benefitsCountText}>
                                                            • {sub.benefitBalances.length} benefits
                                                        </Text>
                                                    )}
                                                </View>
                                            </View>

                                            <TouchableOpacity
                                                style={[
                                                    styles.linkBtn,
                                                    isAnyLinking && !isLinkingThis && styles.linkBtnDisabled,
                                                ]}
                                                onPress={() => handleLink(sub)}
                                                disabled={isAnyLinking}
                                                activeOpacity={0.85}
                                            >
                                                {isLinkingThis ? (
                                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                                ) : (
                                                    <Text style={styles.linkBtnText}>Activate</Text>
                                                )}
                                            </TouchableOpacity>
                                        </View>
                                    );
                                })}
                            </View>
                        )}

                        {/* Divider */}
                        <View style={styles.dividerRow}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>OR</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        {/* Section 2: Browse New Plans */}
                        <TouchableOpacity
                            style={styles.browseCard}
                            onPress={onBrowseNew}
                            activeOpacity={0.85}
                        >
                            <View style={styles.browseIconCircle}>
                                <Ionicons name="cart-outline" size={20} color="#FE6700" />
                            </View>
                            <View style={styles.browseTextWrap}>
                                <Text style={styles.browseTitle}>Browse & Buy New Package</Text>
                                <Text style={styles.browseSubtitle}>
                                    Select from monthly, quarterly, or annual plans tailored for {beneficiary.name}
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '85%',
        paddingBottom: 28,
        paddingTop: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    iconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FFF7ED',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    headerTextWrap: {
        flex: 1,
    },
    title: {
        fontSize: 17,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 2,
    },
    subtitle: {
        fontSize: 12,
        color: '#6B7280',
        lineHeight: 16,
    },
    closeBtn: {
        padding: 4,
        marginLeft: 8,
    },
    scrollList: {
        paddingHorizontal: 20,
        paddingTop: 16,
    },
    section: {
        marginBottom: 8,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#374151',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    readyBadge: {
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#A7F3D0',
    },
    readyBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#059669',
    },
    packageCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FAFAFA',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
    },
    packageInfo: {
        flex: 1,
        marginRight: 12,
    },
    packageName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1F2937',
        marginBottom: 4,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    durationChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E5E7EB',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    durationText: {
        fontSize: 11,
        color: '#374151',
        fontWeight: '500',
    },
    benefitsCountText: {
        fontSize: 11,
        color: '#6B7280',
        marginLeft: 6,
    },
    linkBtn: {
        backgroundColor: '#FE6700',
        paddingHorizontal: 16,
        paddingVertical: 9,
        borderRadius: 10,
        minWidth: 84,
        alignItems: 'center',
        justifyContent: 'center',
    },
    linkBtnDisabled: {
        opacity: 0.5,
    },
    linkBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 14,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#E5E7EB',
    },
    dividerText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#9CA3AF',
        paddingHorizontal: 12,
    },
    browseCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF7ED',
        borderWidth: 1.5,
        borderColor: '#FFEDD5',
        borderRadius: 14,
        padding: 14,
        marginBottom: 16,
    },
    browseIconCircle: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
        borderWidth: 1,
        borderColor: '#FED7AA',
    },
    browseTextWrap: {
        flex: 1,
        marginRight: 8,
    },
    browseTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#9A3412',
        marginBottom: 2,
    },
    browseSubtitle: {
        fontSize: 11,
        color: '#C2410C',
        lineHeight: 15,
    },
});

