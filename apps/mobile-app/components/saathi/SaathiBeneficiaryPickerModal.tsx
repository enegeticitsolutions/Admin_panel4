import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    Image,
    Dimensions,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';

export interface SaathiEligibleMember {
    id: string;
    name: string;
    relationship?: string;
    photo?: string | null;
    age?: number | string | null;
    isPersonal?: boolean;
    remainingHours?: number;
    planName?: string;
}

interface SaathiBeneficiaryPickerModalProps {
    visible: boolean;
    onClose: () => void;
    beneficiaries: SaathiEligibleMember[];
    onSelectBeneficiary: (beneficiary: SaathiEligibleMember) => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const SaathiBeneficiaryPickerModal: React.FC<SaathiBeneficiaryPickerModalProps> = ({
    visible,
    onClose,
    beneficiaries,
    onSelectBeneficiary,
}) => {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.sheetContainer}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <View style={styles.iconCircle}>
                                <Feather name="users" size={22} color="#FF6A00" />
                            </View>
                            <View>
                                <Text style={styles.title}>Select Family Member</Text>
                                <Text style={styles.subtitle}>Whose Saathi service do you want to access?</Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            style={styles.closeBtn}
                            onPress={onClose}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        >
                            <Feather name="x" size={20} color="#6B7280" />
                        </TouchableOpacity>
                    </View>

                    {/* Beneficiaries List */}
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.listContent}
                    >
                        {beneficiaries.map((item) => {
                            const initials = item.name
                                ? item.name
                                      .split(' ')
                                      .map((n) => n[0])
                                      .slice(0, 2)
                                      .join('')
                                      .toUpperCase()
                                : 'ME';

                            return (
                                <TouchableOpacity
                                    key={item.id}
                                    style={styles.memberCard}
                                    activeOpacity={0.8}
                                    onPress={() => {
                                        onClose();
                                        onSelectBeneficiary(item);
                                    }}
                                >
                                    <View style={styles.memberLeft}>
                                        {item.photo ? (
                                            <Image source={{ uri: item.photo }} style={styles.avatar} />
                                        ) : (
                                            <View style={[styles.avatar, styles.initialsBadge]}>
                                                <Text style={styles.initialsText}>{initials}</Text>
                                            </View>
                                        )}
                                        <View style={styles.infoWrap}>
                                            <View style={styles.nameRow}>
                                                <Text style={styles.memberName} numberOfLines={1}>
                                                    {item.name}
                                                </Text>
                                                {item.isPersonal && (
                                                    <View style={styles.selfBadge}>
                                                        <Text style={styles.selfBadgeText}>Self</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text style={styles.memberSub}>
                                                {item.relationship ? `${item.relationship}` : (item.isPersonal ? 'Personal Account' : 'Family Member')}
                                                {item.age ? ` • ${item.age} yrs` : ''}
                                            </Text>
                                            {item.planName && (
                                                <Text style={styles.planName} numberOfLines={1}>
                                                    {item.planName}
                                                </Text>
                                            )}
                                        </View>
                                    </View>

                                    <View style={styles.memberRight}>
                                        <View style={styles.arrowCircle}>
                                            <Feather name="chevron-right" size={18} color="#FF6A00" />
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        justifyContent: 'flex-end',
    },
    sheetContainer: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        maxHeight: SCREEN_HEIGHT * 0.75,
        paddingTop: 16,
        paddingBottom: 28,
        paddingHorizontal: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 10,
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
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 18,
        fontWeight: '800',
        color: '#111827',
        letterSpacing: -0.3,
    },
    subtitle: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    listContent: {
        gap: 12,
        paddingTop: 4,
        paddingBottom: 16,
    },
    memberCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FAFAFA',
        padding: 14,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    memberLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 10,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        marginRight: 12,
    },
    initialsBadge: {
        backgroundColor: '#FFF7ED',
        borderWidth: 1.5,
        borderColor: '#FFEDD5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    initialsText: {
        fontSize: 16,
        fontWeight: '800',
        color: '#FF6A00',
    },
    infoWrap: {
        flex: 1,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    memberName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1F2937',
    },
    selfBadge: {
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#DBEAFE',
    },
    selfBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#2563EB',
    },
    memberSub: {
        fontSize: 13,
        color: '#6B7280',
        marginTop: 2,
    },
    planName: {
        fontSize: 11,
        fontWeight: '600',
        color: '#059669',
        marginTop: 2,
    },
    memberRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    arrowCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#FFF7ED',
        alignItems: 'center',
        justifyContent: 'center',
    },
});

