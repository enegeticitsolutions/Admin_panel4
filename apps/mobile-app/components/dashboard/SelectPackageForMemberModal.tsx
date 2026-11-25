import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface SelectPackageForMemberModalProps {
    visible: boolean;
    unassignedPackages: any[];
    onClose: () => void;
    onSelectPackage: (subscription: any) => void;
    onContinueWithoutPackage: () => void;
}

const formatDuration = (sub: any): string => {
    const d = (sub?.duration || '').toLowerCase();
    if (d === 'annual' || d === 'yearly') return 'Annual Plan (12 Mo)';
    if (d === 'six_months' || d === 'semi_annual') return '6-Month Plan';
    if (d === 'three_months' || d === 'quarterly') return '3-Month Plan';
    return 'Monthly Plan (1 Mo)';
};

/**
 * Shown when adding a new family member while the subscriber has unassigned care packages.
 * Lets the user pick an unassigned package to assign during enrollment or continue without one.
 */
export const SelectPackageForMemberModal: React.FC<SelectPackageForMemberModalProps> = ({
    visible,
    unassignedPackages,
    onClose,
    onSelectPackage,
    onContinueWithoutPackage,
}) => {
    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.sheet}>
                    <View style={styles.header}>
                        <View style={styles.iconCircle}>
                            <Ionicons name="shield-checkmark" size={24} color="#FE6700" />
                        </View>
                        <View style={styles.headerTextWrap}>
                            <Text style={styles.title}>Assign Care Package</Text>
                            <Text style={styles.subtitle}>
                                You have {unassignedPackages.length} unassigned care{' '}
                                {unassignedPackages.length === 1 ? 'package' : 'packages'}. Select one for this member or continue without a package.
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={onClose}
                            style={styles.closeBtn}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Ionicons name="close" size={22} color="#6B7280" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.scrollList} showsVerticalScrollIndicator={false}>
                        <View style={styles.sectionHeaderRow}>
                            <Text style={styles.sectionTitle}>
                                Unassigned Packages ({unassignedPackages.length})
                            </Text>
                            <View style={styles.readyBadge}>
                                <Text style={styles.readyBadgeText}>Ready to Assign</Text>
                            </View>
                        </View>

                        {unassignedPackages.map((sub: any, idx: number) => {
                            const packageName = sub.package?.name || sub.packageType || 'Care Package';
                            return (
                                <TouchableOpacity
                                    key={sub.id || `unassigned-sub-${idx}`}
                                    style={styles.packageCard}
                                    onPress={() => onSelectPackage(sub)}
                                    activeOpacity={0.85}
                                >
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

                                    <View style={styles.selectBtn}>
                                        <Text style={styles.selectBtnText}>Select</Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={styles.skipBtn}
                            onPress={onContinueWithoutPackage}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="person-add-outline" size={16} color="#1F2937" style={{ marginRight: 8 }} />
                            <Text style={styles.skipBtnText}>Continue without package</Text>
                        </TouchableOpacity>
                        <Text style={styles.footerHint}>
                            You can always assign a care package later from their profile.
                        </Text>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(17, 24, 39, 0.55)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 20,
        paddingHorizontal: 20,
        paddingBottom: 28,
        maxHeight: '82%',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    iconCircle: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: '#FFF3E8',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    headerTextWrap: {
        flex: 1,
        paddingRight: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 13,
        color: '#6B7280',
        lineHeight: 18,
    },
    closeBtn: {
        padding: 4,
    },
    scrollList: {
        maxHeight: 320,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    readyBadge: {
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
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
        backgroundColor: '#FAF3EB',
        borderWidth: 1,
        borderColor: '#E7DED6',
        borderRadius: 16,
        padding: 14,
        marginBottom: 10,
    },
    packageInfo: {
        flex: 1,
        paddingRight: 12,
    },
    packageName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1F2937',
        marginBottom: 6,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
    },
    durationChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        marginRight: 8,
    },
    durationText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#4B5563',
    },
    benefitsCountText: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '500',
    },
    selectBtn: {
        backgroundColor: '#FE6700',
        paddingHorizontal: 16,
        paddingVertical: 9,
        borderRadius: 999,
    },
    selectBtnText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '700',
    },
    footer: {
        marginTop: 14,
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    skipBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 14,
        paddingVertical: 14,
    },
    skipBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1F2937',
    },
    footerHint: {
        marginTop: 8,
        fontSize: 12,
        color: '#6B7280',
        textAlign: 'center',
    },
});
